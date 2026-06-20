import datetime
import json
from unittest.mock import patch

import psycopg
import pytest

from src.handler import lambda_handler
from src.routes import recommendations as rec

CLAIMS = {"sub": "11111111-1111-1111-1111-111111111111", "email": "mike@example.com"}


# --- input validation (no DB) ---

def test_missing_business_name():
    with pytest.raises(rec.InvalidInput):
        rec.create(CLAIMS, {"category": "Plumber"})


def test_unknown_category():
    with pytest.raises(rec.InvalidInput):
        rec.create(CLAIMS, {"business_name": "Joe Plumbing", "category": "Wizardry"})


def test_business_name_too_long():
    with pytest.raises(rec.InvalidInput):
        rec.create(CLAIMS, {"business_name": "x" * 300, "category": "Plumber"})


def test_non_string_field():
    with pytest.raises(rec.InvalidInput):
        rec.create(CLAIMS, {"business_name": 123, "category": "Plumber"})


def test_display_name_precedence():
    assert rec._display_name({"user_metadata": {"name": "Mike R"}, "email": "m@e.com"}) == "Mike R"
    assert rec._display_name({"email": "m@e.com"}) == "m@e.com"
    assert rec._display_name({}) == "Neighbor"


# --- DB paths with a fake connection ---

class _Cursor:
    def __init__(self, row=None, rows=None):
        self._row = row
        self._rows = rows or []

    def fetchone(self):
        return self._row

    def fetchall(self):
        return self._rows


class _Conn:
    def __init__(self, execute_fn):
        self._execute_fn = execute_fn

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, sql, params=None):
        return self._execute_fn(sql, params)


def test_create_success():
    created = datetime.datetime(2026, 6, 9, tzinfo=datetime.timezone.utc)
    rec_id = "22222222-2222-2222-2222-222222222222"

    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into recommendation" in sql:
            return _Cursor((rec_id, "Joe Plumbing", "Plumber", "great work", 0, created))
        raise AssertionError(f"unexpected SQL: {sql}")

    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.create(CLAIMS, {"business_name": "Joe Plumbing", "category": "Plumber", "note": "great work"})

    assert result["statusCode"] == 201
    assert result["body"]["id"] == rec_id
    assert result["body"]["endorsement_count"] == 0
    assert result["body"]["created_by_name"] == "mike@example.com"


def test_create_dedupe_returns_409_with_existing_id():
    existing_id = "33333333-3333-3333-3333-333333333333"

    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into recommendation" in sql:
            raise psycopg.errors.UniqueViolation()
        if "select id from recommendation" in sql:
            return _Cursor((existing_id,))
        raise AssertionError(f"unexpected SQL: {sql}")

    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.create(CLAIMS, {"business_name": "Joe Plumbing", "category": "Plumber"})

    assert result["statusCode"] == 409
    assert result["body"]["existing_recommendation_id"] == existing_id
    assert result["body"]["error"]["code"] == "duplicate_recommendation"


# --- routing through the handler ---

def _event(method, path, headers=None, body=None):
    return {
        "requestContext": {"http": {"method": method, "path": path}},
        "headers": headers or {},
        "body": body,
        "isBase64Encoded": False,
    }


def test_post_requires_auth():
    resp = lambda_handler(_event("POST", "/recommendations", body=json.dumps({"business_name": "x", "category": "Plumber"})), None)
    assert resp["statusCode"] == 401


def test_post_malformed_json_returns_400():
    with patch("src.handler.verify_token", return_value=CLAIMS):
        resp = lambda_handler(_event("POST", "/recommendations", headers={"authorization": "Bearer ok"}, body="{not json"), None)
    assert resp["statusCode"] == 400
    assert json.loads(resp["body"])["error"]["code"] == "invalid_json"


def test_post_invalid_input_returns_400():
    with patch("src.handler.verify_token", return_value=CLAIMS):
        resp = lambda_handler(_event("POST", "/recommendations", headers={"authorization": "Bearer ok"}, body=json.dumps({"category": "Plumber"})), None)
    assert resp["statusCode"] == 400
    assert json.loads(resp["body"])["error"]["code"] == "invalid_input"


# --- browse (US4) ---

def test_list_by_category_unknown_raises():
    with pytest.raises(rec.InvalidInput):
        rec.list_by_category("Wizardry")


def test_list_by_category_ranked():
    rows = [
        ("a", "Top Plumber", "Plumber", None, 5, "Mike"),
        ("b", "Joe Plumbing", "Plumber", "solid", 2, "Dana"),
    ]
    def execute_fn(sql, params):
        assert "order by r.endorsement_count desc" in sql
        return _Cursor(rows=rows)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.list_by_category("Plumber")
    assert result["statusCode"] == 200
    assert [r["business_name"] for r in result["body"]] == ["Top Plumber", "Joe Plumbing"]
    assert result["body"][0]["created_by_name"] == "Mike"
    assert "created_at" not in result["body"][0]  # summary shape


def test_category_counts_includes_all_seed_categories():
    def execute_fn(sql, params):
        return _Cursor(rows=[("Plumber", 3), ("Electrician", 1)])
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.category_counts()
    body = result["body"]
    assert len(body) == 12  # full seed list
    by_cat = {item["category"]: item["count"] for item in body}
    assert by_cat["Plumber"] == 3
    assert by_cat["Electrician"] == 1
    assert by_cat["Roofing"] == 0  # categories with no rows still appear


def test_get_recommendations_without_category_returns_400():
    resp = lambda_handler(_event("GET", "/recommendations"), None)
    assert resp["statusCode"] == 400


def test_get_recommendations_is_public():
    # no auth header — browse must not require a token
    def execute_fn(sql, params):
        return _Cursor(rows=[])
    event = _event("GET", "/recommendations")
    event["queryStringParameters"] = {"category": "Plumber"}
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        resp = lambda_handler(event, None)
    assert resp["statusCode"] == 200
    assert json.loads(resp["body"]) == []
