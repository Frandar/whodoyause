import os
import jwt
from jwt import PyJWKClient

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")

# NOTE: verification is JWKS-based (asymmetric RS256/ES256), so the Supabase
# project MUST use asymmetric JWT signing keys. Legacy projects that still sign
# with the shared HS256 secret will fail every write with 401 here — enable
# asymmetric signing keys in the Supabase dashboard before deploying.

# Cached in module scope so the client survives across invocations in a warm
# container. Two defaults are overridden deliberately:
#   timeout=3   — PyJWT defaults to 30s, which is longer than the Lambda's own
#                 10s timeout (template.yaml). A hung JWKS endpoint would kill
#                 the whole invocation with an opaque timeout instead of a clean
#                 401/503; 3s fails fast and still leaves room to respond.
#   lifespan=1h — PyJWT defaults to 300s, so the JWK set was silently re-fetched
#                 every 5 minutes *inside a request*. Supabase signing keys don't
#                 rotate on that cadence; an hour keeps the fetch off the hot path.
#                 Rotation mid-container-life self-heals on the next refresh
#                 (ARCHITECTURE §10 already accepts this seam).
_jwks_client: PyJWKClient | None = None

JWKS_TIMEOUT_SECONDS = 3
JWKS_LIFESPAN_SECONDS = 3600


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(
            f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json",
            timeout=JWKS_TIMEOUT_SECONDS,
            lifespan=JWKS_LIFESPAN_SECONDS,
        )
    return _jwks_client


class AuthError(Exception):
    pass


def verify_token(authorization_header: str | None) -> dict:
    if not authorization_header or not authorization_header.startswith("Bearer "):
        raise AuthError("Missing or malformed Authorization header")

    token = authorization_header[len("Bearer "):]
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            issuer=f"{SUPABASE_URL}/auth/v1",
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
        return claims
    except jwt.PyJWTError as exc:
        raise AuthError(str(exc)) from exc
    except Exception as exc:
        raise AuthError(str(exc)) from exc
