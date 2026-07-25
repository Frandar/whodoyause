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


def _summary_row(
    rec_id, business, category, note, count, name, endorsed,
    phone=None, email=None, website=None, contact_name=None,
    social_link=None, endorsement_notes=None,
):
    """Build a list/search SELECT row matching _list_select's column order:
    base cols, endorsed_by_me, the 5 contact cols, then endorsement_notes json."""
    return (
        rec_id, business, category, note, count, name, endorsed,
        phone, email, website, contact_name, social_link,
        [] if endorsement_notes is None else endorsement_notes,
    )


def test_create_success():
    created = datetime.datetime(2026, 6, 9, tzinfo=datetime.timezone.utc)
    rec_id = "22222222-2222-2222-2222-222222222222"

    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into recommendation" in sql:
            # 6 base cols + the 5 contact cols, matching create()'s RETURNING clause.
            return _Cursor((rec_id, "Joe Plumbing", "Plumber", "great work", 0, created,
                            None, None, None, None, None))
        raise AssertionError(f"unexpected SQL: {sql}")

    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.create(CLAIMS, {"business_name": "Joe Plumbing", "category": "Plumber", "note": "great work"})

    assert result["statusCode"] == 201
    assert result["body"]["id"] == rec_id
    assert result["body"]["endorsement_count"] == 0
    assert result["body"]["created_by_name"] == "mike@example.com"
    assert result["body"]["endorsement_notes"] == []


def test_create_with_contact_fields_normalizes_url_and_roundtrips():
    created = datetime.datetime(2026, 6, 9, tzinfo=datetime.timezone.utc)
    rec_id = "22222222-2222-2222-2222-222222222222"
    captured = {}

    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into recommendation" in sql:
            captured["params"] = params
            # Echo the persisted contact values back in RETURNING-column order.
            return _Cursor((rec_id, "Joe Plumbing", "Plumber", None, 0, created,
                            "555-1234", "joe@ex.com", "https://joeplumbing.com",
                            "Joe", "https://facebook.com/joe"))
        raise AssertionError(f"unexpected SQL: {sql}")

    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.create(CLAIMS, {
            "business_name": "Joe Plumbing", "category": "Plumber",
            "phone": "555-1234", "email": "joe@ex.com",
            "website": "joeplumbing.com",  # bare domain → https:// prepended
            "contact_name": "Joe", "social_link": "https://facebook.com/joe",
        })

    assert result["statusCode"] == 201
    assert result["body"]["phone"] == "555-1234"
    assert result["body"]["website"] == "https://joeplumbing.com"
    assert result["body"]["contact_name"] == "Joe"
    # The bare domain was normalized before hitting the INSERT params.
    assert "https://joeplumbing.com" in captured["params"]


def test_create_contact_field_too_long_raises():
    with pytest.raises(rec.InvalidInput):
        rec.create(CLAIMS, {"business_name": "Joe", "category": "Plumber", "phone": "9" * 100})


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
        _summary_row("a", "Top Plumber", "Plumber", None, 5, "Mike", False),
        _summary_row("b", "Joe Plumbing", "Plumber", "solid", 2, "Dana", False),
    ]
    def execute_fn(sql, params):
        assert "order by r.endorsement_count desc" in sql
        return _Cursor(rows=rows)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.list_by_category("Plumber")
    assert result["statusCode"] == 200
    assert [r["business_name"] for r in result["body"]] == ["Top Plumber", "Joe Plumbing"]
    assert result["body"][0]["created_by_name"] == "Mike"
    assert result["body"][0]["endorsed_by_me"] is False
    assert "created_at" not in result["body"][0]  # summary shape


def test_list_anonymous_omits_endorsement_join():
    # No viewer → endorsed_by_me is a constant false, no join, no extra param.
    captured = {}
    def execute_fn(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return _Cursor(rows=[])
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        rec.list_by_category("Plumber")
    assert "false as endorsed_by_me" in captured["sql"]
    assert "left join endorsement me" not in captured["sql"]
    assert "limit %s offset %s" in captured["sql"]
    # category, then the default page bounds.
    assert captured["params"] == ("Plumber", 20, 0)


def test_list_with_viewer_joins_their_endorsement():
    viewer = "55555555-5555-5555-5555-555555555555"
    rows = [_summary_row("a", "Top Plumber", "Plumber", None, 5, "Mike", True)]
    captured = {}
    def execute_fn(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return _Cursor(rows=rows)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.list_by_category("Plumber", viewer)
    assert "left join endorsement me" in captured["sql"]
    # Join param precedes the WHERE param, then the page bounds.
    assert captured["params"] == (viewer, "Plumber", 20, 0)
    assert result["body"][0]["endorsed_by_me"] is True


def test_list_by_category_applies_limit_and_offset():
    captured = {}
    def execute_fn(sql, params):
        captured["params"] = params
        return _Cursor(rows=[])
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        rec.list_by_category("Plumber", None, limit=5, offset=10)
    assert captured["params"] == ("Plumber", 5, 10)


def test_parse_pagination_defaults_and_clamps():
    assert rec.parse_pagination({}) == (rec.DEFAULT_PAGE_SIZE, 0)
    assert rec.parse_pagination({"limit": "5", "offset": "10"}) == (5, 10)
    # Over the cap → clamped; junk/negatives → safe defaults.
    assert rec.parse_pagination({"limit": "999"}) == (rec.MAX_PAGE_SIZE, 0)
    assert rec.parse_pagination({"limit": "0"}) == (1, 0)
    assert rec.parse_pagination({"limit": "abc", "offset": "-4"}) == (rec.DEFAULT_PAGE_SIZE, 0)


def test_list_handler_passes_pagination():
    captured = {}
    def execute_fn(sql, params):
        captured["params"] = params
        return _Cursor(rows=[])
    event = _event("GET", "/recommendations")
    event["queryStringParameters"] = {"category": "Plumber", "limit": "5", "offset": "10"}
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        resp = lambda_handler(event, None)
    assert resp["statusCode"] == 200
    assert captured["params"] == ("Plumber", 5, 10)


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


# --- search (US1) ---

def test_search_empty_query_raises():
    with pytest.raises(rec.InvalidInput):
        rec.search("   ")


def test_search_query_too_long_raises():
    with pytest.raises(rec.InvalidInput):
        rec.search("x" * 200)


def test_search_unknown_category_raises():
    with pytest.raises(rec.InvalidInput):
        rec.search("plumber", "Wizardry")


def test_search_uses_websearch_tsquery_and_ranks():
    rows = [_summary_row("a", "Ace Plumbing", "Plumber", None, 4, "Mike", False)]
    captured = {}
    def execute_fn(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return _Cursor(rows=rows)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.search("plumber")
    assert "websearch_to_tsquery('english', %s)" in captured["sql"]
    assert "order by r.endorsement_count desc" in captured["sql"]
    assert captured["params"] == ("plumber",)  # bound param, not interpolated
    assert result["body"][0]["business_name"] == "Ace Plumbing"


def test_search_with_category_filter():
    def execute_fn(sql, params):
        assert "and r.category = %s" in sql
        assert params == ("plumber", "Plumber")
        return _Cursor(rows=[])
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        rec.search("plumber", "Plumber")


def test_search_with_viewer_orders_params_join_query_category():
    viewer = "66666666-6666-6666-6666-666666666666"
    captured = {}
    def execute_fn(sql, params):
        captured["params"] = params
        return _Cursor(rows=[])
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        rec.search("plumber", "Plumber", viewer)
    # join param (viewer) → query → category
    assert captured["params"] == (viewer, "plumber", "Plumber")


def test_search_zero_results_logs_content_gap(capsys):
    def execute_fn(sql, params):
        return _Cursor(rows=[])
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.search("nonexistent biz")
    assert result["body"] == []
    assert "ZERO_RESULTS" in capsys.readouterr().out


def test_search_handler_without_q_returns_400():
    resp = lambda_handler(_event("GET", "/recommendations/search"), None)
    assert resp["statusCode"] == 400


def test_search_handler_is_public():
    def execute_fn(sql, params):
        return _Cursor(rows=[])
    event = _event("GET", "/recommendations/search")
    event["queryStringParameters"] = {"q": "plumber"}
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        resp = lambda_handler(event, None)
    assert resp["statusCode"] == 200


# --- endorse (US3) ---

VALID_ID = "44444444-4444-4444-4444-444444444444"


def test_endorse_invalid_uuid_returns_404():
    result = rec.endorse(CLAIMS, "not-a-uuid")
    assert result["statusCode"] == 404


def test_endorse_success_returns_new_count():
    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into endorsement" in sql:
            return _Cursor(None)
        if "select endorsement_count" in sql:
            return _Cursor(row=(1,))
        raise AssertionError(sql)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.endorse(CLAIMS, VALID_ID)
    assert result["statusCode"] == 200
    assert result["body"] == {"recommendation_id": VALID_ID, "endorsement_count": 1}


def test_endorse_twice_returns_409():
    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into endorsement" in sql:
            raise psycopg.errors.UniqueViolation()
        if "select endorsement_count" in sql:
            return _Cursor(row=(3,))
        raise AssertionError(sql)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.endorse(CLAIMS, VALID_ID)
    assert result["statusCode"] == 409
    assert result["body"]["endorsement_count"] == 3
    assert result["body"]["error"]["code"] == "already_endorsed"


def test_endorse_missing_recommendation_returns_404():
    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into endorsement" in sql:
            raise psycopg.errors.ForeignKeyViolation()
        raise AssertionError(sql)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.endorse(CLAIMS, VALID_ID)
    assert result["statusCode"] == 404


def test_unendorse_returns_decremented_count():
    def execute_fn(sql, params):
        if "delete from endorsement" in sql:
            return _Cursor(None)
        if "select endorsement_count" in sql:
            return _Cursor(row=(0,))
        raise AssertionError(sql)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.unendorse(CLAIMS, VALID_ID)
    assert result["statusCode"] == 200
    assert result["body"]["endorsement_count"] == 0


def test_endorse_with_note_upserts_and_returns_count():
    captured = {}

    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into endorsement" in sql:
            captured["sql"] = sql
            captured["params"] = params
            return _Cursor(None)
        if "select endorsement_count" in sql:
            return _Cursor(row=(2,))
        raise AssertionError(sql)

    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.endorse(CLAIMS, VALID_ID, note="Fixed our leak same day")

    assert result["statusCode"] == 200
    assert result["body"]["endorsement_count"] == 2
    # Note path upserts so it never dead-ends on an existing +1.
    assert "on conflict" in captured["sql"]
    assert captured["params"] == (VALID_ID, CLAIMS["sub"], "Fixed our leak same day")


def test_endorse_note_too_long_raises():
    with pytest.raises(rec.InvalidInput):
        rec.endorse(CLAIMS, VALID_ID, note="x" * (rec.ENDORSEMENT_NOTE_MAX + 1))


def test_endorse_route_passes_note_from_body():
    captured = {}

    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into endorsement" in sql:
            captured["params"] = params
            return _Cursor(None)
        if "select endorsement_count" in sql:
            return _Cursor(row=(1,))
        raise AssertionError(sql)

    with patch("src.handler.verify_token", return_value=CLAIMS), \
         patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        resp = lambda_handler(
            _event("POST", f"/recommendations/{VALID_ID}/endorse",
                   headers={"authorization": "Bearer ok"},
                   body=json.dumps({"note": "great with old pipes"})),
            None,
        )
    assert resp["statusCode"] == 200
    assert captured["params"][2] == "great with old pipes"


def test_endorse_route_malformed_json_returns_400():
    with patch("src.handler.verify_token", return_value=CLAIMS):
        resp = lambda_handler(
            _event("POST", f"/recommendations/{VALID_ID}/endorse",
                   headers={"authorization": "Bearer ok"}, body="{not json"),
            None,
        )
    assert resp["statusCode"] == 400
    assert json.loads(resp["body"])["error"]["code"] == "invalid_json"


def test_endorse_requires_auth():
    resp = lambda_handler(_event("POST", f"/recommendations/{VALID_ID}/endorse"), None)
    assert resp["statusCode"] == 401


def test_endorse_route_dispatches_with_auth():
    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into endorsement" in sql:
            return _Cursor(None)
        if "select endorsement_count" in sql:
            return _Cursor(row=(1,))
        raise AssertionError(sql)
    with patch("src.handler.verify_token", return_value=CLAIMS), \
         patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        resp = lambda_handler(_event("POST", f"/recommendations/{VALID_ID}/endorse", headers={"authorization": "Bearer ok"}), None)
    assert resp["statusCode"] == 200
    assert json.loads(resp["body"])["endorsement_count"] == 1


# --- suggest an edit ---

SUGGESTION_ID = "77777777-7777-7777-7777-777777777777"


def _suggest_conn(captured):
    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into edit_suggestion" in sql:
            captured["params"] = params
            return _Cursor((SUGGESTION_ID,))
        raise AssertionError(sql)
    return _Conn(execute_fn)


def test_suggest_edit_invalid_uuid_returns_404():
    result = rec.suggest_edit(CLAIMS, "not-a-uuid", {"phone": "555"})
    assert result["statusCode"] == 404


def test_suggest_edit_requires_a_correction_or_message():
    with pytest.raises(rec.InvalidInput):
        rec.suggest_edit(CLAIMS, VALID_ID, {})


def test_suggest_edit_message_too_long_raises():
    with pytest.raises(rec.InvalidInput):
        rec.suggest_edit(CLAIMS, VALID_ID, {"message": "x" * (rec.SUGGESTION_MESSAGE_MAX + 1)})


def test_suggest_edit_success_stores_normalized_proposal(capsys):
    captured = {}
    with patch.object(rec.db, "get_connection", return_value=_suggest_conn(captured)):
        result = rec.suggest_edit(
            CLAIMS, VALID_ID,
            {"phone": "555-1234", "website": "joesplumbing.com", "message": "wrong number"},
        )
    assert result["statusCode"] == 201
    assert result["body"]["id"] == SUGGESTION_ID
    # proposed is stored as a Jsonb-wrapped dict: rec_id, user, message, proposed
    proposed = captured["params"][3].obj
    assert proposed["phone"] == "555-1234"
    assert proposed["website"] == "https://joesplumbing.com"  # URL normalized
    assert captured["params"][2] == "wrong number"
    # Founders' review queue is surfaced in CloudWatch.
    assert "EDIT_SUGGESTION" in capsys.readouterr().out


def test_suggest_edit_missing_recommendation_returns_404():
    def execute_fn(sql, params):
        if "insert into app_user" in sql:
            return _Cursor(None)
        if "insert into edit_suggestion" in sql:
            raise psycopg.errors.ForeignKeyViolation()
        raise AssertionError(sql)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.suggest_edit(CLAIMS, VALID_ID, {"phone": "555"})
    assert result["statusCode"] == 404


def test_suggest_edit_route_requires_auth():
    resp = lambda_handler(
        _event("POST", f"/recommendations/{VALID_ID}/suggest-edit",
               body=json.dumps({"phone": "555"})),
        None,
    )
    assert resp["statusCode"] == 401


def test_suggest_edit_route_dispatches_with_auth():
    captured = {}
    with patch("src.handler.verify_token", return_value=CLAIMS), \
         patch.object(rec.db, "get_connection", return_value=_suggest_conn(captured)):
        resp = lambda_handler(
            _event("POST", f"/recommendations/{VALID_ID}/suggest-edit",
                   headers={"authorization": "Bearer ok"},
                   body=json.dumps({"email": "correct@ex.com"})),
            None,
        )
    assert resp["statusCode"] == 201
    assert json.loads(resp["body"])["id"] == SUGGESTION_ID


def test_suggest_edit_route_malformed_json_returns_400():
    with patch("src.handler.verify_token", return_value=CLAIMS):
        resp = lambda_handler(
            _event("POST", f"/recommendations/{VALID_ID}/suggest-edit",
                   headers={"authorization": "Bearer ok"}, body="{not json"),
            None,
        )
    assert resp["statusCode"] == 400
    assert json.loads(resp["body"])["error"]["code"] == "invalid_json"
