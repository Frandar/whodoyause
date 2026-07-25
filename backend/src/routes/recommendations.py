import uuid

import psycopg
from psycopg.types.json import Jsonb

from src import db
from src.categories import CATEGORIES, CATEGORY_SET

BUSINESS_NAME_MAX = 200
NOTE_MAX = 1000
QUERY_MAX = 100
SUGGESTION_MESSAGE_MAX = 1000
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 50
PHONE_MAX = 40
EMAIL_MAX = 200
WEBSITE_MAX = 300
CONTACT_NAME_MAX = 120
SOCIAL_MAX = 300
ENDORSEMENT_NOTE_MAX = 1000

# Optional contact fields on a recommendation: (body key, column, max length).
CONTACT_FIELDS = (
    ("phone", "phone", PHONE_MAX),
    ("email", "email", EMAIL_MAX),
    ("website", "website", WEBSITE_MAX),
    ("contact_name", "contact_name", CONTACT_NAME_MAX),
    ("social_link", "social_link", SOCIAL_MAX),
)
# Contact fields that hold URLs — bare domains get https:// prepended so links work.
_URL_FIELDS = {"website", "social_link"}


class InvalidInput(Exception):
    """Raised on bad request input → handler maps to 400."""


def _display_name(claims: dict) -> str:
    metadata = claims.get("user_metadata") or {}
    return metadata.get("name") or claims.get("email") or "Neighbor"


def _require_str(body: dict, key: str) -> str:
    value = body.get(key)
    if value is None:
        return ""
    if not isinstance(value, str):
        raise InvalidInput(f"{key} must be a string")
    return value.strip()


def _normalize_url(value: str) -> str:
    """Prepend https:// to a bare domain so the link is clickable. We keep this
    deliberately light — no strict URL validation (that just causes drop-off)."""
    if value and "://" not in value:
        return "https://" + value
    return value


def _contact_fields(body: dict) -> dict:
    """Parse, length-check and lightly normalize the optional contact fields.
    Returns {column: value_or_None}. Raises InvalidInput on an over-length field."""
    values: dict = {}
    for key, column, max_len in CONTACT_FIELDS:
        value = _require_str(body, key) or None
        if value is not None:
            if len(value) > max_len:
                raise InvalidInput(f"{key} is too long")
            if column in _URL_FIELDS:
                value = _normalize_url(value)
        values[column] = value
    return values


def _ensure_app_user(conn, claims: dict) -> None:
    """Just-in-time provisioning so writes can reference app_user.id."""
    conn.execute(
        "insert into app_user (id, display_name) values (%s, %s) "
        "on conflict (id) do nothing",
        (claims["sub"], _display_name(claims)),
    )


def create(claims: dict, body: dict) -> dict:
    """Create a recommendation. Returns {statusCode, body}.

    Dedupe is enforced by the uq_recommendation_business_category index — on a
    unique violation we return 409 with the existing id rather than checking
    first (ARCHITECTURE §0, M2 guardrails).
    """
    business_name = _require_str(body, "business_name")
    category = _require_str(body, "category")
    note = _require_str(body, "note") or None

    if not business_name:
        raise InvalidInput("business_name is required")
    if len(business_name) > BUSINESS_NAME_MAX:
        raise InvalidInput("business_name is too long")
    if category not in CATEGORY_SET:
        raise InvalidInput("unknown category")
    if note is not None and len(note) > NOTE_MAX:
        raise InvalidInput("note is too long")

    contact = _contact_fields(body)  # {column: value_or_None}; raises on over-length

    user_id = claims["sub"]
    display_name = _display_name(claims)

    contact_cols = [column for _, column, _ in CONTACT_FIELDS]

    with db.get_connection() as conn:
        _ensure_app_user(conn, claims)
        try:
            row = conn.execute(
                "insert into recommendation "
                "(business_name, category, note, created_by, "
                + ", ".join(contact_cols) + ") "
                "values (%s, %s, %s, %s, " + ", ".join(["%s"] * len(contact_cols)) + ") "
                "returning id, business_name, category, note, endorsement_count, created_at, "
                + ", ".join(contact_cols),
                (business_name, category, note, user_id, *(contact[c] for c in contact_cols)),
            ).fetchone()
        except psycopg.errors.UniqueViolation:
            existing = conn.execute(
                "select id from recommendation "
                "where lower(business_name) = lower(%s) and category = %s",
                (business_name, category),
            ).fetchone()
            return {
                "statusCode": 409,
                "body": {
                    "error": {
                        "code": "duplicate_recommendation",
                        "message": "This business is already recommended in this category",
                    },
                    "existing_recommendation_id": str(existing[0]) if existing else None,
                },
            }

    rec_id, bn, cat, nt, count, created_at = row[:6]
    contact_values = dict(zip(contact_cols, row[6:]))
    return {
        "statusCode": 201,
        "body": {
            "id": str(rec_id),
            "business_name": bn,
            "category": cat,
            "note": nt,
            "endorsement_count": count,
            "created_by_name": display_name,
            "created_at": created_at.isoformat(),
            "endorsement_notes": [],
            **contact_values,
        },
    }


def _to_summary(row) -> dict:
    (
        rec_id,
        business_name,
        category,
        note,
        count,
        created_by_name,
        endorsed_by_me,
        phone,
        email,
        website,
        contact_name,
        social_link,
        endorsement_notes,
    ) = row
    return {
        "id": str(rec_id),
        "business_name": business_name,
        "category": category,
        "note": note,
        "endorsement_count": count,
        "created_by_name": created_by_name,
        "endorsed_by_me": bool(endorsed_by_me),
        "phone": phone,
        "email": email,
        "website": website,
        "contact_name": contact_name,
        "social_link": social_link,
        # psycopg loads the json_agg result as a Python list of {name, note} dicts.
        "endorsement_notes": endorsement_notes or [],
    }


# Neighbor +1 notes, aggregated per recommendation. Correlated (uses r.id, no bound
# param) so it doesn't affect the endorsed_by_me join-param ordering below.
_ENDORSEMENT_NOTES_SQL = (
    "(select coalesce(json_agg(json_build_object('name', eu.display_name, 'note', e.note) "
    "order by e.created_at), '[]') "
    "from endorsement e join app_user eu on eu.id = e.user_id "
    "where e.recommendation_id = r.id and e.note is not null and e.note <> '') "
    "as endorsement_notes"
)


def _list_select(user_id: str | None) -> str:
    """Build the list/search SELECT. When a viewer is known (valid JWT on an
    otherwise-public read), left-join their endorsement so the client can render
    the +1 state correctly; otherwise endorsed_by_me is constant false. The
    user_id is always a bound parameter (the join clause carries the first %s)."""
    if user_id:
        endorsed = "(me.user_id is not null)"
        join = " left join endorsement me on me.recommendation_id = r.id and me.user_id = %s"
    else:
        endorsed = "false"
        join = ""
    return (
        "select r.id, r.business_name, r.category, r.note, r.endorsement_count, "
        "u.display_name, " + endorsed + " as endorsed_by_me, "
        "r.phone, r.email, r.website, r.contact_name, r.social_link, "
        + _ENDORSEMENT_NOTES_SQL +
        " from recommendation r join app_user u on u.id = r.created_by" + join
    )


def parse_pagination(params: dict) -> tuple[int, int]:
    """Clamp ?limit/?offset query params to safe bounds. A bad value falls back
    to the default rather than erroring — pagination is a convenience, not input
    worth rejecting the request over."""
    def _int(value, default: int) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    limit = max(1, min(_int(params.get("limit"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE))
    offset = max(0, _int(params.get("offset"), 0))
    return limit, offset


def list_by_category(
    category: str,
    user_id: str | None = None,
    limit: int = DEFAULT_PAGE_SIZE,
    offset: int = 0,
) -> dict:
    """Public: one page of recommendations in a category, ranked by endorsements
    (US4). A valid JWT is optional; when present it populates endorsed_by_me.
    The client pages by requesting the next offset until it gets a short page."""
    if category not in CATEGORY_SET:
        raise InvalidInput("unknown category")
    # Join param (if any) precedes the WHERE param — see _list_select.
    params = ([user_id] if user_id else []) + [category, limit, offset]
    with db.get_connection() as conn:
        rows = conn.execute(
            _list_select(user_id) + " where r.category = %s "
            "order by r.endorsement_count desc, r.created_at desc "
            "limit %s offset %s",
            tuple(params),
        ).fetchall()
    return {"statusCode": 200, "body": [_to_summary(r) for r in rows]}


def category_counts() -> dict:
    """Public: every seed category with its recommendation count (US4 chips)."""
    with db.get_connection() as conn:
        rows = conn.execute(
            "select category, count(*) from recommendation group by category"
        ).fetchall()
    counts = {category: count for category, count in rows}
    return {
        "statusCode": 200,
        "body": [{"category": c, "count": counts.get(c, 0)} for c in CATEGORIES],
    }


def search(query: str, category: str | None = None, user_id: str | None = None) -> dict:
    """Public full-text search (US1). Uses websearch_to_tsquery with a bound
    param (never string-interpolated), ranked by endorsements. Zero-result
    queries are logged server-side as a content-gap signal. A valid JWT is
    optional; when present it populates endorsed_by_me."""
    query = (query or "").strip()
    if not query:
        raise InvalidInput("q is required")
    if len(query) > QUERY_MAX:
        raise InvalidInput("q is too long")
    if category is not None and category not in CATEGORY_SET:
        raise InvalidInput("unknown category")

    sql = _list_select(user_id) + " where r.search_vector @@ websearch_to_tsquery('english', %s)"
    # Join param (if any) precedes the WHERE params — see _list_select.
    params: list = ([user_id] if user_id else []) + [query]
    if category:
        sql += " and r.category = %s"
        params.append(category)
    sql += " order by r.endorsement_count desc, r.created_at desc"

    with db.get_connection() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()

    if not rows:
        # Content-gap signal (US1) — surfaced in CloudWatch.
        print(f"ZERO_RESULTS query={query!r} category={category!r}", flush=True)

    return {"statusCode": 200, "body": [_to_summary(r) for r in rows]}


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _endorsement_count(conn, recommendation_id: str) -> int:
    # endorsement_count is maintained by a DB trigger; in autocommit mode the
    # trigger's update is committed before we read it back.
    row = conn.execute(
        "select endorsement_count from recommendation where id = %s",
        (recommendation_id,),
    ).fetchone()
    return row[0] if row else 0


def endorse(claims: dict, recommendation_id: str, note: str | None = None) -> dict:
    """+1 a recommendation (US3), optionally with a note ("add your take").

    Without a note it's the fast path: plain insert, one per user via the unique
    constraint — a repeat returns 409 (no check-then-insert).

    With a note we upsert (on conflict update the note) so a neighbor can add or
    edit their take even after they've already +1'd — it never dead-ends on 409.
    On a fresh row the count trigger fires (an implicit +1); on conflict the note
    is updated and the count is untouched (no double count)."""
    if not _is_uuid(recommendation_id):
        return {"statusCode": 404, "body": {"error": {"code": "not_found", "message": "Recommendation not found"}}}
    if note is not None and len(note) > ENDORSEMENT_NOTE_MAX:
        raise InvalidInput("note is too long")

    with db.get_connection() as conn:
        _ensure_app_user(conn, claims)
        try:
            if note:
                conn.execute(
                    "insert into endorsement (recommendation_id, user_id, note) "
                    "values (%s, %s, %s) "
                    "on conflict (recommendation_id, user_id) do update set note = excluded.note",
                    (recommendation_id, claims["sub"], note),
                )
            else:
                conn.execute(
                    "insert into endorsement (recommendation_id, user_id) values (%s, %s)",
                    (recommendation_id, claims["sub"]),
                )
        except psycopg.errors.UniqueViolation:
            # Only reachable on the no-note fast path (the upsert absorbs conflicts).
            return {
                "statusCode": 409,
                "body": {
                    "error": {"code": "already_endorsed", "message": "You already +1'd this"},
                    "recommendation_id": recommendation_id,
                    "endorsement_count": _endorsement_count(conn, recommendation_id),
                },
            }
        except psycopg.errors.ForeignKeyViolation:
            return {"statusCode": 404, "body": {"error": {"code": "not_found", "message": "Recommendation not found"}}}

        return {
            "statusCode": 200,
            "body": {
                "recommendation_id": recommendation_id,
                "endorsement_count": _endorsement_count(conn, recommendation_id),
            },
        }


def unendorse(claims: dict, recommendation_id: str) -> dict:
    """Remove a +1 (US3, optional). Idempotent."""
    if not _is_uuid(recommendation_id):
        return {"statusCode": 404, "body": {"error": {"code": "not_found", "message": "Recommendation not found"}}}

    with db.get_connection() as conn:
        conn.execute(
            "delete from endorsement where recommendation_id = %s and user_id = %s",
            (recommendation_id, claims["sub"]),
        )
        return {
            "statusCode": 200,
            "body": {
                "recommendation_id": recommendation_id,
                "endorsement_count": _endorsement_count(conn, recommendation_id),
            },
        }


def suggest_edit(claims: dict, recommendation_id: str, body: dict) -> dict:
    """Record a neighbor's proposed correction to a recommendation (wrong phone,
    email, etc.). This does NOT change the live record — it queues a suggestion
    for the founders to review manually (PRD: manual moderation). Authz is the
    usual one line: valid JWT → may write.

    `proposed` carries only the contact fields the neighbor supplied (parsed and
    normalized like create()); `message` is an optional free-text note. At least
    one of the two is required."""
    if not _is_uuid(recommendation_id):
        return {"statusCode": 404, "body": {"error": {"code": "not_found", "message": "Recommendation not found"}}}

    message = _require_str(body, "message") or None
    if message is not None and len(message) > SUGGESTION_MESSAGE_MAX:
        raise InvalidInput("message is too long")

    proposed = {k: v for k, v in _contact_fields(body).items() if v is not None}
    if not proposed and not message:
        raise InvalidInput("suggest at least one correction or add a message")

    with db.get_connection() as conn:
        _ensure_app_user(conn, claims)
        try:
            row = conn.execute(
                "insert into edit_suggestion (recommendation_id, suggested_by, message, proposed) "
                "values (%s, %s, %s, %s) returning id",
                (recommendation_id, claims["sub"], message, Jsonb(proposed)),
            ).fetchone()
        except psycopg.errors.ForeignKeyViolation:
            return {"statusCode": 404, "body": {"error": {"code": "not_found", "message": "Recommendation not found"}}}

    # Notify the founders' review queue via CloudWatch (mirrors ZERO_RESULTS).
    # The durable record lives in edit_suggestion; this line surfaces it live.
    print(
        f"EDIT_SUGGESTION rec={recommendation_id} by={claims['sub']} "
        f"proposed={proposed} message={message!r}",
        flush=True,
    )
    return {"statusCode": 201, "body": {"id": str(row[0])}}
