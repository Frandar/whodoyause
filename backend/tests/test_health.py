import json
from unittest.mock import patch

from src.handler import lambda_handler


def _health_event() -> dict:
    return {"requestContext": {"http": {"method": "GET", "path": "/health"}}, "headers": {}}


def test_health_ok():
    with patch("src.routes.health.db.healthcheck", return_value=True):
        resp = lambda_handler(_health_event(), None)
    assert resp["statusCode"] == 200
    body = json.loads(resp["body"])
    assert body["status"] == "ok"
    assert body["db"] is True


def test_health_db_down():
    with patch("src.routes.health.db.healthcheck", return_value=False):
        resp = lambda_handler(_health_event(), None)
    assert resp["statusCode"] == 503
    body = json.loads(resp["body"])
    assert body["db"] is False
