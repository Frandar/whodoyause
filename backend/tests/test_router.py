import json
from unittest.mock import patch

from src.handler import lambda_handler


def _event(method: str, path: str, headers: dict | None = None) -> dict:
    return {
        "requestContext": {"http": {"method": method, "path": path}},
        "headers": headers or {},
    }


def test_options_preflight():
    resp = lambda_handler(_event("OPTIONS", "/health"), None)
    assert resp["statusCode"] == 204


def test_unknown_route():
    resp = lambda_handler(_event("GET", "/unknown"), None)
    assert resp["statusCode"] == 404
    body = json.loads(resp["body"])
    assert body["error"]["code"] == "not_found"


def test_whoami_without_token():
    resp = lambda_handler(_event("GET", "/whoami"), None)
    assert resp["statusCode"] == 401
    body = json.loads(resp["body"])
    assert body["error"]["code"] == "unauthorized"


def test_whoami_with_bad_token():
    resp = lambda_handler(
        _event("GET", "/whoami", {"authorization": "Bearer bad.token.here"}), None
    )
    assert resp["statusCode"] == 401
