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

# Shown when a neighbor hasn't provided a name (never their email).
DISPLAY_NAME_FALLBACK = "Neighbor"

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


def _full_name(claims: dict) -> str | None:
    """The full name given at signup (Supabase user_metadata) — first + last, or
    a combined `name`. We store this in app_user. NEVER the email. Returns None
    when no name is set so callers can apply the fallback."""
    metadata = claims.get("user_metadata") or {}
    first = (metadata.get("first_name") or "").strip()
    last = (metadata.get("last_name") or "").strip()
    full = f"{first} {last}".strip()
    if not full:
        full = (metadata.get("name") or "").strip()
    return full or None


def _abbreviate(name: str | None) -> str:
    """Neighbor-facing display form: first name + last initial ("Shania Roberts"
    -> "Shania R."). For privacy the full last name is never shown. The full name
    stays in the DB; this is applied only at read time. Falls back to "Neighbor"."""
    parts = (name or "").split()
    if not parts:
        return DISPLAY_NAME_FALLBACK
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0].upper()}."


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
    """Just-in-time provisioning so writes can reference app_user.id.

    Stores the FULL name (display abbreviates it). Refreshes when the JWT carries
    a name so a neighbor who signs up (or later sets one) replaces any earlier
    placeholder — but never clobbers a real name with the fallback: the `where`
    skips the update when name is absent."""
    name = _full_name(claims)  # full name, str | None
    conn.execute(
        "insert into app_user (id, display_name) values (%s, %s) "
        "on conflict (id) do update set display_name = excluded.display_name "
        "where %s::text is not null",
        (claims["sub"], name or DISPLAY_NAME_FALLBACK, name),
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
    display_name = _abbreviate(_full_name(claims))  # neighbor-facing "First L."

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
            "created_by_me": True,  # the caller just created it
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
        created_by_me,
        phone,
        email,
        website,
        contact_name,
        social_link,
        endorsement_notes,
    ) = row
    # DB stores full names; abbreviate to "First L." at the display boundary here.
    notes = [
        {**n, "name": _abbreviate(n.get("name"))} for n in (endorsement_notes or [])
    ]
    return {
        "id": str(rec_id),
        "business_name": business_name,
        "category": category,
        "note": note,
        "endorsement_count": count,
        "created_by_name": _abbreviate(created_by_name),
        "endorsed_by_me": bool(endorsed_by_me),
        "created_by_me": bool(created_by_me),
        "phone": phone,
        "email": email,
        "website": website,
        "contact_name": contact_name,
        "social_link": social_link,
        # psycopg loads the json_agg result as a Python list of {name, note} dicts.
        "endorsement_notes": notes,
    }


def _endorsement_notes_sql(user_id: str | None) -> str:
    """Neighbor +1 notes, aggregated per recommendation. Each note carries an
    `is_mine` flag so the viewer can edit/delete their own. Correlated on r.id;
    when a viewer is known its id is a bound %s INSIDE the SELECT list — so it is
    the FIRST param, before the endorsed_by_me join param (see _list_select)."""
    is_mine = "(e.user_id = %s)" if user_id else "false"
    return (
        "(select coalesce(json_agg(json_build_object("
        "'name', eu.display_name, 'note', e.note, 'is_mine', " + is_mine + ") "
        "order by e.created_at), '[]') "
        "from endorsement e join app_user eu on eu.id = e.user_id "
        "where e.recommendation_id = r.id and e.note is not null and e.note <> '') "
        "as endorsement_notes"
    )


def _list_select(user_id: str | None) -> str:
    """Build the list/search SELECT. When a viewer is known (valid JWT on an
    otherwise-public read), left-join their endorsement so the client can render
    the +1 state correctly; otherwise endorsed_by_me is constant false.

    Param order when a viewer is present: the notes subquery's is_mine param
    comes first (it's earlier in the SELECT text), then the join param. Callers
    therefore pass the viewer id TWICE — see list_by_category / search."""
    if user_id:
        endorsed = "(me.user_id is not null)"
        mine_rec = "(r.created_by = %s)"
        join = " left join endorsement me on me.recommendation_id = r.id and me.user_id = %s"
    else:
        endorsed = "false"
        mine_rec = "false"
        join = ""
    # Param order when a viewer is present, in SELECT-then-FROM text order:
    # created_by_me → is_mine (notes subquery) → join. Callers pass viewer ×3.
    return (
        "select r.id, r.business_name, r.category, r.note, r.endorsement_count, "
        "u.display_name, " + endorsed + " as endorsed_by_me, "
        + mine_rec + " as created_by_me, "
        "r.phone, r.email, r.website, r.contact_name, r.social_link, "
        + _endorsement_notes_sql(user_id) +
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
    # Viewer params (created_by_me, is_mine subquery, then join) precede the
    # WHERE/page params — see _list_select.
    params = ([user_id, user_id, user_id] if user_id else []) + [category, limit, offset]
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
    # Viewer params (created_by_me, is_mine subquery, then join) precede the
    # WHERE params — see _list_select.
    params: list = ([user_id, user_id, user_id] if user_id else []) + [query]
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


def delete_note(claims: dict, recommendation_id: str) -> dict:
    """Clear the caller's own +1 note, keeping the +1 itself. Idempotent: a
    no-op if they have no endorsement or no note. To remove the +1 entirely
    (which also drops the note), use unendorse."""
    if not _is_uuid(recommendation_id):
        return {"statusCode": 404, "body": {"error": {"code": "not_found", "message": "Recommendation not found"}}}

    with db.get_connection() as conn:
        conn.execute(
            "update endorsement set note = null "
            "where recommendation_id = %s and user_id = %s",
            (recommendation_id, claims["sub"]),
        )
    return {"statusCode": 200, "body": {"recommendation_id": recommendation_id}}


def update_note(claims: dict, recommendation_id: str, note: str | None) -> dict:
    """Edit or clear a recommendation's OWN note — the one written at creation.
    Scoped to the creator (`created_by = caller`): a deliberate, minimal per-row
    ownership scope (the only sensible way to let people fix their own note
    without letting anyone rewrite anyone's). An empty note clears it. A row that
    doesn't exist or isn't the caller's yields 404. The search_vector trigger
    reindexes the note on update."""
    if not _is_uuid(recommendation_id):
        return {"statusCode": 404, "body": {"error": {"code": "not_found", "message": "Recommendation not found"}}}

    note = (note or "").strip() or None
    if note is not None and len(note) > NOTE_MAX:
        raise InvalidInput("note is too long")

    with db.get_connection() as conn:
        row = conn.execute(
            "update recommendation set note = %s "
            "where id = %s and created_by = %s returning note",
            (note, recommendation_id, claims["sub"]),
        ).fetchone()

    if row is None:
        # Either no such recommendation, or the caller didn't create it.
        return {"statusCode": 404, "body": {"error": {"code": "not_found", "message": "Recommendation not found"}}}
    return {"statusCode": 200, "body": {"id": recommendation_id, "note": row[0]}}


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
