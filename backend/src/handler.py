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


def _optional_user_id(event: dict) -> str | None:
    """For public reads that personalize when signed in: return the caller's id
    if they sent a valid JWT, otherwise None. A bad/expired token is treated as
    anonymous (no 401) — these endpoints are public."""
    header = _auth_header(event)
    if not header:
        return None
    try:
        return verify_token(header)["sub"]
    except AuthError:
        return None


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

        if method == "GET" and path == "/recommendations/search":
            params = event.get("queryStringParameters") or {}
            limit, offset = recommendations.parse_pagination(params)
            try:
                # search() validates q (presence/length) and raises InvalidInput.
                result = recommendations.search(
                    params.get("q"),
                    params.get("category"),
                    _optional_user_id(event),
                    limit,
                    offset,
                )
            except recommendations.InvalidInput as exc:
                return _response(400, {"error": {"code": "invalid_input", "message": str(exc)}})
            return _response(result["statusCode"], result["body"])

        if method == "GET" and path == "/recommendations":
            params = event.get("queryStringParameters") or {}
            category = params.get("category")
            if not category:
                return _response(400, {"error": {"code": "invalid_input", "message": "category is required"}})
            limit, offset = recommendations.parse_pagination(params)
            try:
                result = recommendations.list_by_category(
                    category, _optional_user_id(event), limit, offset
                )
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

        segments = path.strip("/").split("/")

        # PATCH /recommendations/{id}  (edit/clear your own recommendation note; AUTH)
        if method == "PATCH" and len(segments) == 2 and segments[0] == "recommendations":
            claims = verify_token(_auth_header(event))
            try:
                body = _json_body(event)
            except (ValueError, json.JSONDecodeError):
                return _response(400, {"error": {"code": "invalid_json", "message": "Malformed JSON body"}})
            try:
                result = recommendations.update_note(claims, segments[1], body.get("note"))
            except recommendations.InvalidInput as exc:
                return _response(400, {"error": {"code": "invalid_input", "message": str(exc)}})
            return _response(result["statusCode"], result["body"])

        # DELETE /recommendations/{id}  (founder-only moderation removal; AUTH)
        if method == "DELETE" and len(segments) == 2 and segments[0] == "recommendations":
            claims = verify_token(_auth_header(event))
            result = recommendations.delete_recommendation(claims, segments[1])
            return _response(result["statusCode"], result["body"])

        # POST /recommendations/{id}/suggest-edit  (queues a correction; AUTH)
        if (
            method == "POST"
            and len(segments) == 3
            and segments[0] == "recommendations"
            and segments[2] == "suggest-edit"
        ):
            claims = verify_token(_auth_header(event))
            try:
                body = _json_body(event)
            except (ValueError, json.JSONDecodeError):
                return _response(400, {"error": {"code": "invalid_json", "message": "Malformed JSON body"}})
            try:
                result = recommendations.suggest_edit(claims, segments[1], body)
            except recommendations.InvalidInput as exc:
                return _response(400, {"error": {"code": "invalid_input", "message": str(exc)}})
            return _response(result["statusCode"], result["body"])

        # DELETE /recommendations/{id}/note  (clear your own +1 note; AUTH)
        if (
            method == "DELETE"
            and len(segments) == 3
            and segments[0] == "recommendations"
            and segments[2] == "note"
        ):
            claims = verify_token(_auth_header(event))
            result = recommendations.delete_note(claims, segments[1])
            return _response(result["statusCode"], result["body"])

        # POST/DELETE /recommendations/{id}/endorse
        if len(segments) == 3 and segments[0] == "recommendations" and segments[2] == "endorse":
            if method in ("POST", "DELETE"):
                claims = verify_token(_auth_header(event))
                rec_id = segments[1]
                if method == "POST":
                    try:
                        body = _json_body(event)
                    except (ValueError, json.JSONDecodeError):
                        return _response(400, {"error": {"code": "invalid_json", "message": "Malformed JSON body"}})
                    note = (body.get("note") or "").strip() or None
                    try:
                        result = recommendations.endorse(claims, rec_id, note)
                    except recommendations.InvalidInput as exc:
                        return _response(400, {"error": {"code": "invalid_input", "message": str(exc)}})
                else:
                    result = recommendations.unendorse(claims, rec_id)
                return _response(result["statusCode"], result["body"])

        return _response(404, {"error": {"code": "not_found", "message": "Route not found"}})

    except AuthError:
        return _response(401, {"error": {"code": "unauthorized", "message": "Invalid or missing token"}})
    except Exception as exc:
        print(f"ERROR unhandled exception: {exc}", flush=True)
        return _response(500, {"error": {"code": "internal_error", "message": "Internal server error"}})
