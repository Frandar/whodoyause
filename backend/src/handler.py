import json

from src.auth import AuthError, verify_token
from src.routes import health

# CORS is owned entirely by the Lambda Function URL config (ARCHITECTURE.md §6),
# which is locked to the CloudFront origin and auto-handles OPTIONS preflight.
# The handler must NOT emit Access-Control-* headers, or the browser sees the
# origin twice and rejects it with a "multiple values" CORS error.


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def lambda_handler(event: dict, _context) -> dict:
    http = event.get("requestContext", {}).get("http", {})
    method = http.get("method", "").upper()
    path = http.get("path", "/")

    # Strip trailing slash for consistent matching (except root).
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")

    # Function URL CORS normally answers preflight before we run; this is a safety net.
    if method == "OPTIONS":
        return {"statusCode": 204, "body": ""}

    try:
        if method == "GET" and path == "/health":
            result = health.handle(event)
            return _response(result["statusCode"], result["body"])

        if method == "GET" and path == "/whoami":
            auth_header = event.get("headers", {}).get("authorization") or \
                          event.get("headers", {}).get("Authorization")
            claims = verify_token(auth_header)
            return _response(200, {"user_id": claims["sub"]})

        return _response(404, {"error": {"code": "not_found", "message": "Route not found"}})

    except AuthError:
        return _response(401, {"error": {"code": "unauthorized", "message": "Invalid or missing token"}})
    except Exception as exc:
        print(f"ERROR unhandled exception: {exc}", flush=True)
        return _response(500, {"error": {"code": "internal_error", "message": "Internal server error"}})
