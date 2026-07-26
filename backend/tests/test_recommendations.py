import datetime
import json
from unittest.mock import patch

import psycopg
import pytest

from src.handler import lambda_handler
from src.routes import recommendations as rec

CLAIMS = {
    "sub": "11111111-1111-1111-1111-111111111111",
    "email": "mike@example.com",
    "user_metadata": {"name": "Mike Rivera"},
}


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


def test_full_name_from_metadata():
    # Full name is stored (not abbreviated) — from first/last fields...
    assert rec._full_name({"user_metadata": {"first_name": "Mike", "last_name": "Rivera"}}) == "Mike Rivera"
    # ...or a combined "name" field.
    assert rec._full_name({"user_metadata": {"name": "Mike Rivera"}, "email": "m@e.com"}) == "Mike Rivera"
    assert rec._full_name({"user_metadata": {"first_name": "Mike"}}) == "Mike"
    # Email is NEVER used as a name (privacy) — no name means None.
    assert rec._full_name({"email": "m@e.com"}) is None
    assert rec._full_name({}) is None


def test_abbreviate_shows_first_name_and_last_initial():
    # Privacy display: full last name is never shown.
    assert rec._abbreviate("Shania Roberts") == "Shania R."
    assert rec._abbreviate("Mike Rivera") == "Mike R."
    assert rec._abbreviate("Mary Jane Watson") == "Mary W."  # last token initial
    assert rec._abbreviate("Cher") == "Cher"  # single name → as-is
    assert rec._abbreviate(None) == "Neighbor"  # fallback
    assert rec._abbreviate("") == "Neighbor"


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
    created_by_me=False, phone=None, email=None, website=None, contact_name=None,
    social_link=None, endorsement_notes=None,
):
    """Build a list/search SELECT row matching _list_select's column order:
    base cols, endorsed_by_me, created_by_me, the 5 contact cols, then the
    endorsement_notes json."""
    return (
        rec_id, business, category, note, count, name, endorsed, created_by_me,
        phone, email, website, contact_name, social_link,
        [] if endorsement_notes is None else endorsement_notes,
    )


def test_to_summary_abbreviates_stored_full_names():
    # DB holds full names; the read boundary abbreviates recommender + note names.
    row = _summary_row(
        "a", "Ace", "Plumber", None, 3, "Shania Roberts", False,
        endorsement_notes=[{"name": "Mike Rivera", "note": "great", "is_mine": False}],
    )
    out = rec._to_summary(row)
    assert out["created_by_name"] == "Shania R."
    assert out["endorsement_notes"][0]["name"] == "Mike R."
    assert out["endorsement_notes"][0]["note"] == "great"  # non-name fields preserved


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
    assert result["body"]["created_by_name"] == "Mike R."
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
    # Viewer appears 3× (created_by_me, is_mine subquery, join), then WHERE + page.
    assert captured["params"] == (viewer, viewer, viewer, "Plumber", 20, 0)
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


def test_search_uses_prefix_tsquery_and_ranks():
    rows = [_summary_row("a", "Ace Plumbing", "Plumber", None, 4, "Mike", False)]
    captured = {}
    def execute_fn(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return _Cursor(rows=rows)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.search("plumber")
    assert "to_tsquery('english', %s)" in captured["sql"]
    assert "order by r.endorsement_count desc" in captured["sql"]
    assert "limit %s offset %s" in captured["sql"]
    # bound param, not interpolated; last term gets the :* prefix marker
    assert captured["params"] == ("plumber:*", rec.DEFAULT_PAGE_SIZE, 0)
    assert result["body"][0]["business_name"] == "Ace Plumbing"


def test_search_prefix_matches_partial_word():
    """The autocomplete fires at 2 chars, so "plumb" must match "Plumber"."""
    assert rec._prefix_tsquery("plumb") == "plumb:*"
    # Earlier terms are ANDed and exact; only the word being typed is a prefix.
    assert rec._prefix_tsquery("ace plumb") == "ace & plumb:*"


def test_prefix_tsquery_strips_tsquery_operators():
    """Operators must not survive into the tsquery — the value is a bound param,
    but a stray `!` or `:` would still make to_tsquery raise and 500 the request."""
    assert rec._prefix_tsquery("joe's | plumbing!") == "joe & s & plumbing:*"
    assert rec._prefix_tsquery("!!!") == ""


def test_search_falls_back_to_websearch_when_query_has_no_terms():
    captured = {}
    def execute_fn(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return _Cursor(rows=[])
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        rec.search("!!!")
    assert "websearch_to_tsquery('english', %s)" in captured["sql"]
    assert captured["params"][0] == "!!!"


def test_search_with_category_filter():
    def execute_fn(sql, params):
        assert "and r.category = %s" in sql
        assert params == ("plumber:*", "Plumber", rec.DEFAULT_PAGE_SIZE, 0)
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
    # viewer ×3 (created_by_me, is_mine subquery, join) → query → category → page
    assert captured["params"] == (
        viewer, viewer, viewer, "plumber:*", "Plumber", rec.DEFAULT_PAGE_SIZE, 0,
    )


def test_search_applies_limit_and_offset():
    captured = {}
    def execute_fn(sql, params):
        captured["params"] = params
        return _Cursor(rows=[])
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        rec.search("plumber", None, None, 5, 10)
    assert captured["params"] == ("plumber:*", 5, 10)


def test_search_zero_results_on_later_page_is_not_a_content_gap(capsys):
    """An empty page 3 is exhausted pagination, not a missing category."""
    def execute_fn(sql, params):
        return _Cursor(rows=[])
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        rec.search("plumber", None, None, 20, 40)
    assert "ZERO_RESULTS" not in capsys.readouterr().out


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


# --- delete / edit a note (US3) ---

def test_delete_note_invalid_uuid_returns_404():
    result = rec.delete_note(CLAIMS, "not-a-uuid")
    assert result["statusCode"] == 404


def _note_execute(captured=None):
    """Fake execute for the delete_note path: the UPDATE returns nothing, then
    the existence probe (`select endorsement_count`) returns a row."""
    def execute_fn(sql, params):
        if captured is not None and sql.startswith("update endorsement"):
            captured["sql"] = sql
            captured["params"] = params
        if sql.startswith("select endorsement_count"):
            return _Cursor((3,))
        return _Cursor(None)
    return execute_fn


def test_delete_note_clears_note_keeps_endorsement():
    captured = {}
    with patch.object(rec.db, "get_connection", return_value=_Conn(_note_execute(captured))):
        result = rec.delete_note(CLAIMS, VALID_ID)
    assert result["statusCode"] == 200
    # Clears the note only — never deletes the endorsement row (the +1 stays).
    assert "update endorsement set note = null" in captured["sql"]
    assert "delete from endorsement" not in captured["sql"]
    assert captured["params"] == (VALID_ID, CLAIMS["sub"])


def test_delete_note_missing_recommendation_returns_404():
    """A well-formed UUID that doesn't exist is a 404, not a cheerful 200."""
    def execute_fn(sql, params):
        return _Cursor(None)  # existence probe finds nothing
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        assert rec.delete_note(CLAIMS, VALID_ID)["statusCode"] == 404


def test_unendorse_missing_recommendation_returns_404():
    def execute_fn(sql, params):
        return _Cursor(None)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        assert rec.unendorse(CLAIMS, VALID_ID)["statusCode"] == 404


def test_delete_note_route_requires_auth():
    resp = lambda_handler(_event("DELETE", f"/recommendations/{VALID_ID}/note"), None)
    assert resp["statusCode"] == 401


def test_delete_note_route_dispatches_with_auth():
    with patch("src.handler.verify_token", return_value=CLAIMS), \
         patch.object(rec.db, "get_connection", return_value=_Conn(_note_execute())):
        resp = lambda_handler(
            _event("DELETE", f"/recommendations/{VALID_ID}/note",
                   headers={"authorization": "Bearer ok"}),
            None,
        )
    assert resp["statusCode"] == 200


def test_list_with_viewer_flags_is_mine_in_notes_sql():
    viewer = "88888888-8888-8888-8888-888888888888"
    captured = {}
    def execute_fn(sql, params):
        captured["sql"] = sql
        return _Cursor(rows=[])
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        rec.list_by_category("Plumber", viewer)
    assert "'is_mine', (e.user_id = %s)" in captured["sql"]


def test_list_with_viewer_flags_created_by_me():
    viewer = "99999999-9999-9999-9999-999999999999"
    rows = [_summary_row("a", "Ace", "Plumber", "note", 1, "Mike", False, created_by_me=True)]
    def execute_fn(sql, params):
        assert "as created_by_me" in sql
        return _Cursor(rows=rows)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.list_by_category("Plumber", viewer)
    assert result["body"][0]["created_by_me"] is True


# --- edit / delete the recommendation's own note (creator-scoped) ---

def test_update_note_invalid_uuid_returns_404():
    assert rec.update_note(CLAIMS, "not-a-uuid", "hi")["statusCode"] == 404


def test_update_note_too_long_raises():
    with pytest.raises(rec.InvalidInput):
        rec.update_note(CLAIMS, VALID_ID, "x" * (rec.NOTE_MAX + 1))


def test_update_note_edits_scoped_to_creator():
    captured = {}
    def execute_fn(sql, params):
        captured["sql"] = sql
        captured["params"] = params
        return _Cursor(("new text",))
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.update_note(CLAIMS, VALID_ID, "  new text  ")
    assert result["statusCode"] == 200
    assert result["body"]["note"] == "new text"
    assert "created_by = %s" in captured["sql"]  # creator scope
    assert captured["params"] == ("new text", VALID_ID, CLAIMS["sub"])


def test_update_note_empty_clears_to_null():
    captured = {}
    def execute_fn(sql, params):
        captured["params"] = params
        return _Cursor((None,))
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.update_note(CLAIMS, VALID_ID, "   ")
    assert result["statusCode"] == 200
    assert result["body"]["note"] is None
    assert captured["params"][0] is None  # note set to NULL


def test_update_note_not_creator_returns_404():
    def execute_fn(sql, params):
        return _Cursor(None)  # no row updated → not found / not owner
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        assert rec.update_note(CLAIMS, VALID_ID, "hi")["statusCode"] == 404


def test_update_note_route_requires_auth():
    resp = lambda_handler(
        _event("PATCH", f"/recommendations/{VALID_ID}", body=json.dumps({"note": "hi"})),
        None,
    )
    assert resp["statusCode"] == 401


def test_update_note_route_dispatches_with_auth():
    def execute_fn(sql, params):
        return _Cursor(("edited",))
    with patch("src.handler.verify_token", return_value=CLAIMS), \
         patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        resp = lambda_handler(
            _event("PATCH", f"/recommendations/{VALID_ID}",
                   headers={"authorization": "Bearer ok"}, body=json.dumps({"note": "edited"})),
            None,
        )
    assert resp["statusCode"] == 200
    assert json.loads(resp["body"])["note"] == "edited"


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


# --- input hardening (F-18, F-32) ---

def test_display_name_is_capped_and_sanitized():
    """user_metadata is client-controlled: cap length, strip control chars."""
    long_claims = {"sub": CLAIMS["sub"], "user_metadata": {"name": "A" * 500}}
    assert len(rec._full_name(long_claims)) == rec.DISPLAY_NAME_MAX
    messy = {"sub": CLAIMS["sub"],
             "user_metadata": {"first_name": "Mi ke", "last_name": "  Ri  vera "}}
    assert rec._full_name(messy) == "Mi ke Ri vera"
    assert rec._full_name({"sub": "x", "user_metadata": {"name": 42}}) is None


def test_url_fields_reject_non_http_schemes():
    for bad in ("javascript://%0aalert(1)", "data:text/html,<script>", "file:///etc/passwd"):
        with pytest.raises(rec.InvalidInput):
            rec._contact_fields({"website": bad})


def test_bare_domain_still_gets_https_prefix():
    assert rec._contact_fields({"website": "joesplumbing.com"})["website"] == \
        "https://joesplumbing.com"
    assert rec._contact_fields({"website": "http://joes.com"})["website"] == "http://joes.com"


def test_phone_strips_injection_characters():
    assert rec._contact_fields({"phone": "(555) 123-4567"})["phone"] == "(555) 123-4567"
    assert rec._contact_fields({"phone": "555-1234?body=hi"})["phone"] == "555-1234"


def test_email_rejects_mailto_parameters():
    assert rec._contact_fields({"email": "joe@x.com"})["email"] == "joe@x.com"
    newline_injection = "a@b.com" + chr(13) + chr(10) + "Bcc: eve@evil.com"
    for bad in ("joe@x.com?bcc=a@b.com", "joe@x.com,eve@evil.com", newline_injection):
        with pytest.raises(rec.InvalidInput):
            rec._contact_fields({"email": bad})


# --- moderation (F-02) ---

MOD_ID = "99999999-9999-9999-9999-999999999999"
MOD_CLAIMS = {"sub": MOD_ID, "user_metadata": {"name": "Founder One"}}


def test_moderation_fails_closed_when_unconfigured(monkeypatch):
    monkeypatch.delenv("MODERATOR_USER_IDS", raising=False)
    assert rec.is_moderator(MOD_CLAIMS) is False
    assert rec.delete_recommendation(MOD_CLAIMS, VALID_ID)["statusCode"] == 403


def test_non_moderator_cannot_delete(monkeypatch):
    monkeypatch.setenv("MODERATOR_USER_IDS", MOD_ID)
    assert rec.delete_recommendation(CLAIMS, VALID_ID)["statusCode"] == 403


def test_moderator_deletes_and_logs(monkeypatch, capsys):
    monkeypatch.setenv("MODERATOR_USER_IDS", f" {MOD_ID} , other-id ")
    captured = {}
    def execute_fn(sql, params):
        captured["sql"] = sql
        return _Cursor(("Spam Plumbing", "Plumber"))
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        result = rec.delete_recommendation(MOD_CLAIMS, VALID_ID)
    assert result["statusCode"] == 200
    assert "delete from recommendation where id = %s" in captured["sql"]
    assert "MODERATION_DELETE" in capsys.readouterr().out


def test_moderator_delete_missing_returns_404(monkeypatch):
    monkeypatch.setenv("MODERATOR_USER_IDS", MOD_ID)
    def execute_fn(sql, params):
        return _Cursor(None)
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        assert rec.delete_recommendation(MOD_CLAIMS, VALID_ID)["statusCode"] == 404


def test_delete_route_requires_auth():
    resp = lambda_handler(_event("DELETE", f"/recommendations/{VALID_ID}"), None)
    assert resp["statusCode"] == 401


def test_delete_route_dispatches_to_moderation(monkeypatch):
    monkeypatch.setenv("MODERATOR_USER_IDS", MOD_ID)
    def execute_fn(sql, params):
        return _Cursor(("Spam Plumbing", "Plumber"))
    with patch("src.handler.verify_token", return_value=MOD_CLAIMS), \
         patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        resp = lambda_handler(
            _event("DELETE", f"/recommendations/{VALID_ID}",
                   headers={"authorization": "Bearer ok"}),
            None,
        )
    assert resp["statusCode"] == 200


# --- logging hygiene (F-33) ---

def test_suggest_edit_log_omits_values_and_submitter(capsys):
    def execute_fn(sql, params):
        # Distinct from CLAIMS["sub"] so the "submitter id absent" assert is real.
        return _Cursor(("abcdef00-0000-0000-0000-000000000abc",))
    with patch.object(rec.db, "get_connection", return_value=_Conn(execute_fn)):
        rec.suggest_edit(CLAIMS, VALID_ID, {"phone": "(555) 123-4567", "message": "wrong"})
    out = capsys.readouterr().out
    assert "EDIT_SUGGESTION" in out
    assert "fields=['phone']" in out
    assert "555" not in out
    assert CLAIMS["sub"] not in out
