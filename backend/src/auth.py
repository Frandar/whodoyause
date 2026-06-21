import os
import jwt
from jwt import PyJWKClient

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")

# NOTE: verification is JWKS-based (asymmetric RS256/ES256), so the Supabase
# project MUST use asymmetric JWT signing keys. Legacy projects that still sign
# with the shared HS256 secret will fail every write with 401 here — enable
# asymmetric signing keys in the Supabase dashboard before deploying.

# Cached per cold start — fetch JWKS once, not per request.
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
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
