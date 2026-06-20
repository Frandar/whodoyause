import base64
import json

from src.auth import AuthError, verify_token
from src.routes import health, recommendations

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


def _auth_header(event: dict) -> str | None:
    headers = event.get("headers", {})
    return headers.get("authorization") or headers.get("Authorization")


def _json_body(event: dict) -> dict:
    """Parse the Function URL request body as JSON. Raises ValueError if malformed."""
    raw = event.get("body")
    if raw is None or raw == "":
        return {}
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("body must be a JSON object")
    return parsed


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
            claims = verify_token(_auth_header(event))
            return _response(200, {"user_id": claims["sub"]})

        if method == "GET" and path == "/recommendations/categories":
            result = recommendations.category_counts()
            return _response(result["statusCode"], result["body"])

        if method == "GET" and path == "/recommendations":
            params = event.get("queryStringParameters") or {}
            category = params.get("category")
            if not category:
                return _response(400, {"error": {"code": "invalid_input", "message": "category is required"}})
            try:
                result = recommendations.list_by_category(category)
            except recommendations.InvalidInput as exc:
                return _response(400, {"error": {"code": "invalid_input", "message": str(exc)}})
            return _response(result["statusCode"], result["body"])

        if method == "POST" and path == "/recommendations":
            claims = verify_token(_auth_header(event))
            try:
                body = _json_body(event)
            except (ValueError, json.JSONDecodeError):
                return _response(400, {"error": {"code": "invalid_json", "message": "Malformed JSON body"}})
            try:
                result = recommendations.create(claims, body)
            except recommendations.InvalidInput as exc:
                return _response(400, {"error": {"code": "invalid_input", "message": str(exc)}})
            return _response(result["statusCode"], result["body"])

        return _response(404, {"error": {"code": "not_found", "message": "Route not found"}})

    except AuthError:
        return _response(401, {"error": {"code": "unauthorized", "message": "Invalid or missing token"}})
    except Exception as exc:
        print(f"ERROR unhandled exception: {exc}", flush=True)
        return _response(500, {"error": {"code": "internal_error", "message": "Internal server error"}})
