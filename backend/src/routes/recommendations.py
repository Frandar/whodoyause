import os
import re
import uuid

import psycopg
from psycopg.types.json import Jsonb

from src import db
from src.categories import CATEGORIES, CATEGORY_SET

BUSINESS_NAME_MAX = 200
# Display names come from client-controlled JWT user_metadata, so they need the
# same length discipline as every other user string here.
DISPLAY_NAME_MAX = 80
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


def _moderator_ids() -> frozenset[str]:
    """Founder user ids allowed to delete content, from MODERATOR_USER_IDS
    (comma-separated). Read per call rather than at import so the env var can be
    changed without a code deploy. Empty by default: if it isn't configured,
    nobody can moderate — fail closed."""
    raw = os.environ.get("MODERATOR_USER_IDS", "")
    return frozenset(part.strip() for part in raw.split(",") if part.strip())


def is_moderator(claims: dict) -> bool:
    """The ONLY privilege check in the codebase. ARCHITECTURE §0 keeps authz to
    "valid JWT → may write"; this is a deliberate, minimal exception for content
    removal, which cannot be self-scoped the way editing your own note can."""
    return claims.get("sub") in _moderator_ids()


def _clean_name(value: object) -> str:
    """Normalize one name part from JWT metadata: strings only, control chars
    stripped, whitespace collapsed. `user_metadata` is client-controlled (a user
    can call auth.updateUser with anything), so it is untrusted input."""
    if not isinstance(value, str):
        return ""
    without_controls = "".join(ch for ch in value if ch.isprintable())
    return re.sub(r"\s+", " ", without_controls).strip()


def _full_name(claims: dict) -> str | None:
    """The full name given at signup (Supabase user_metadata) — first + last, or
    a combined `name`. We store this in app_user. NEVER the email. Returns None
    when no name is set so callers can apply the fallback.

    Sanitized and length-capped: the value is client-controlled and lands in
    every card payload via json_agg, so an unbounded name would bloat every
    read. Truncation is silent — a name is not worth failing a write over."""
    metadata = claims.get("user_metadata") or {}
    first = _clean_name(metadata.get("first_name"))
    last = _clean_name(metadata.get("last_name"))
    full = f"{first} {last}".strip()
    if not full:
        full = _clean_name(metadata.get("name"))
    return full[:DISPLAY_NAME_MAX] or None


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


# Only these schemes may end up in a card's href. Everything else is rejected
# rather than silently rewritten — a recommender has no legitimate reason to
# point "Website" at a data:, file: or javascript: URL, and these links inherit
# a named neighbor's trust, which is exactly what makes them worth abusing.
_ALLOWED_URL_SCHEMES = ("http://", "https://")


def _normalize_url(value: str, key: str) -> str:
    """Prepend https:// to a bare domain so the link is clickable, and reject
    any non-http(s) scheme. Still deliberately light on *format* validation —
    strict URL parsing just causes drop-off — but the scheme is not negotiable."""
    if not value:
        return value
    lowered = value.lower()
    if "://" not in value and ":" not in value.split("/")[0]:
        # Bare domain like "joesplumbing.com" — the common case.
        return "https://" + value
    if not lowered.startswith(_ALLOWED_URL_SCHEMES):
        raise InvalidInput(f"{key} must be a http:// or https:// link")
    return value


def _sanitize_phone(value: str) -> str:
    """Keep only characters that are meaningful to a dialler. Blocks header/param
    injection into the `tel:` href the client builds."""
    return re.sub(r"[^0-9+()\-.\s]", "", value).strip()


def _sanitize_email(value: str, key: str) -> str:
    """A single address, no mailto: parameters. Without this, a value like
    "a@b.com?bcc=…&body=…" pre-populates the viewer's mail client."""
    if any(ch in value for ch in "?&\r\n,;") or value.count("@") != 1:
        raise InvalidInput(f"{key} must be a single email address")
    return value


def _contact_fields(body: dict) -> dict:
    """Parse, length-check, sanitize and lightly normalize the optional contact
    fields. Returns {column: value_or_None}. Raises InvalidInput on an
    over-length, malformed or unsafe field."""
    values: dict = {}
    for key, column, max_len in CONTACT_FIELDS:
        value = _require_str(body, key) or None
        if value is not None:
            if len(value) > max_len:
                raise InvalidInput(f"{key} is too long")
            if column in _URL_FIELDS:
                value = _normalize_url(value, key)
            elif column == "phone":
                value = _sanitize_phone(value) or None
            elif column == "email":
                value = _sanitize_email(value, key)
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


def _prefix_tsquery(query: str) -> str:
    """Turn a user query into a prefix-matching tsquery string.

    `websearch_to_tsquery` does no prefix matching: the lexeme for "plumb" never
    matches the stored lexeme "plumber", so an autocomplete that fires at two
    characters returned nothing for most of the typing session. We build the
    query ourselves instead: split on non-word characters, AND the terms, and
    suffix the LAST term with `:*` so the word being typed matches as a prefix.

    Terms are stripped to word characters before interpolation, so nothing that
    could be tsquery syntax (`&`, `|`, `!`, `:`, parens) survives — the result is
    still passed to `to_tsquery` as a BOUND parameter, never concatenated into
    the SQL text."""
    terms = [t for t in re.split(r"[^\w]+", query) if t]
    if not terms:
        return ""
    *leading, last = terms
    return " & ".join([*leading, f"{last}:*"])


def search(
    query: str,
    category: str | None = None,
    user_id: str | None = None,
    limit: int = DEFAULT_PAGE_SIZE,
    offset: int = 0,
) -> dict:
    """Public full-text search (US1), ranked by endorsements.

    The tsquery is built by _prefix_tsquery (so the word being typed matches as a
    prefix) and passed to `to_tsquery` as a bound param — never string-interpolated
    into the SQL. Falls back to `websearch_to_tsquery` when the query reduces to
    nothing usable, so quoted phrases and operators still behave.

    Zero-result queries are logged server-side as a content-gap signal. A valid
    JWT is optional; when present it populates endorsed_by_me. Paginated like
    list_by_category — an unbounded result set was being serialised into one
    Lambda response on every keystroke."""
    query = (query or "").strip()
    if not query:
        raise InvalidInput("q is required")
    if len(query) > QUERY_MAX:
        raise InvalidInput("q is too long")
    if category is not None and category not in CATEGORY_SET:
        raise InvalidInput("unknown category")

    prefix = _prefix_tsquery(query)
    if prefix:
        match_sql = "r.search_vector @@ to_tsquery('english', %s)"
        match_param = prefix
    else:
        match_sql = "r.search_vector @@ websearch_to_tsquery('english', %s)"
        match_param = query

    sql = _list_select(user_id) + f" where {match_sql}"
    # Viewer params (created_by_me, is_mine subquery, then join) precede the
    # WHERE params — see _list_select.
    params: list = ([user_id, user_id, user_id] if user_id else []) + [match_param]
    if category:
        sql += " and r.category = %s"
        params.append(category)
    sql += " order by r.endorsement_count desc, r.created_at desc limit %s offset %s"
    params += [limit, offset]

    with db.get_connection() as conn:
        rows = conn.execute(sql, tuple(params)).fetchall()

    if not rows and offset == 0:
        # Content-gap signal (US1) — surfaced in CloudWatch. Only on the first
        # page: an empty page 3 is exhausted pagination, not a content gap.
        print(f"ZERO_RESULTS query={query!r} category={category!r}", flush=True)

    return {"statusCode": 200, "body": [_to_summary(r) for r in rows]}


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _not_found() -> dict:
    return {
        "statusCode": 404,
        "body": {"error": {"code": "not_found", "message": "Recommendation not found"}},
    }


def _endorsement_count(conn, recommendation_id: str) -> int | None:
    # endorsement_count is maintained by a DB trigger; in autocommit mode the
    # trigger's update is committed before we read it back. Returns None when the
    # recommendation doesn't exist, which callers map to 404.
    row = conn.execute(
        "select endorsement_count from recommendation where id = %s",
        (recommendation_id,),
    ).fetchone()
    return row[0] if row else None


def endorse(claims: dict, recommendation_id: str, note: str | None = None) -> dict:
    """+1 a recommendation (US3), optionally with a note ("add your take").

    Without a note it's the fast path: plain insert, one per user via the unique
    constraint — a repeat returns 409 (no check-then-insert).

    With a note we upsert (on conflict update the note) so a neighbor can add or
    edit their take even after they've already +1'd — it never dead-ends on 409.
    On a fresh row the count trigger fires (an implicit +1); on conflict the note
    is updated and the count is untouched (no double count)."""
    if not _is_uuid(recommendation_id):
        return _not_found()
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
            count = _endorsement_count(conn, recommendation_id)
            if count is None:
                return _not_found()
            return {
                "statusCode": 409,
                "body": {
                    "error": {"code": "already_endorsed", "message": "You already +1'd this"},
                    "recommendation_id": recommendation_id,
                    "endorsement_count": count,
                },
            }
        except psycopg.errors.ForeignKeyViolation:
            return _not_found()

        count = _endorsement_count(conn, recommendation_id)
        if count is None:
            return _not_found()
        return {
            "statusCode": 200,
            "body": {
                "recommendation_id": recommendation_id,
                "endorsement_count": count,
            },
        }


def unendorse(claims: dict, recommendation_id: str) -> dict:
    """Remove a +1 (US3, optional).

    Idempotent with respect to the *endorsement* — removing a +1 you don't have
    is a 200, not an error — but a recommendation that doesn't exist is a 404,
    matching endorse(). Previously any well-formed UUID returned 200 with a
    count of 0, which made a typo indistinguishable from success."""
    if not _is_uuid(recommendation_id):
        return _not_found()

    with db.get_connection() as conn:
        conn.execute(
            "delete from endorsement where recommendation_id = %s and user_id = %s",
            (recommendation_id, claims["sub"]),
        )
        count = _endorsement_count(conn, recommendation_id)
        if count is None:
            return _not_found()
        return {
            "statusCode": 200,
            "body": {
                "recommendation_id": recommendation_id,
                "endorsement_count": count,
            },
        }


def delete_note(claims: dict, recommendation_id: str) -> dict:
    """Clear the caller's own +1 note, keeping the +1 itself. Idempotent with
    respect to the note (a no-op if they have no endorsement or no note), but
    404s for a recommendation that doesn't exist — same contract as unendorse.
    To remove the +1 entirely (which also drops the note), use unendorse."""
    if not _is_uuid(recommendation_id):
        return _not_found()

    with db.get_connection() as conn:
        conn.execute(
            "update endorsement set note = null "
            "where recommendation_id = %s and user_id = %s",
            (recommendation_id, claims["sub"]),
        )
        if _endorsement_count(conn, recommendation_id) is None:
            return _not_found()
    return {"statusCode": 200, "body": {"recommendation_id": recommendation_id}}


def update_note(claims: dict, recommendation_id: str, note: str | None) -> dict:
    """Edit or clear a recommendation's OWN note — the one written at creation.
    Scoped to the creator (`created_by = caller`): a deliberate, minimal per-row
    ownership scope (the only sensible way to let people fix their own note
    without letting anyone rewrite anyone's). An empty note clears it. A row that
    doesn't exist or isn't the caller's yields 404. The search_vector trigger
    reindexes the note on update."""
    if not _is_uuid(recommendation_id):
        return _not_found()

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
        return _not_found()
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
        return _not_found()

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
            return _not_found()

    # Notify the founders' review queue via CloudWatch (mirrors ZERO_RESULTS).
    # Only the suggestion id and which FIELDS changed — never the values or the
    # submitter's id. The durable record (with values) lives in edit_suggestion,
    # where retention is governed; logs are not the place for contact PII.
    print(
        f"EDIT_SUGGESTION id={row[0]} rec={recommendation_id} "
        f"fields={sorted(proposed)} has_message={message is not None}",
        flush=True,
    )
    return {"statusCode": 201, "body": {"id": str(row[0])}}


def delete_recommendation(claims: dict, recommendation_id: str) -> dict:
    """Founder-only removal of a recommendation (spam/abuse moderation).

    PRD §6 says moderation is manual by the founders; until now "manual" meant
    the Supabase SQL editor, which is not a workable answer once the tool is
    announced to a real group. This is deliberately the narrowest possible
    mechanism: a comma-separated allow-list of founder user ids in an env var,
    checked inline. It is NOT a role system and must not grow into one — if a
    third person ever needs it, add their id to the env var.

    Endorsements cascade via the FK; edit suggestions cascade too (003)."""
    if not is_moderator(claims):
        return {
            "statusCode": 403,
            "body": {"error": {"code": "forbidden", "message": "Not permitted"}},
        }
    if not _is_uuid(recommendation_id):
        return _not_found()

    with db.get_connection() as conn:
        row = conn.execute(
            "delete from recommendation where id = %s returning business_name, category",
            (recommendation_id,),
        ).fetchone()

    if row is None:
        return _not_found()
    # Moderation actions are worth an audit line; a business name is not PII.
    print(
        f"MODERATION_DELETE rec={recommendation_id} by={claims['sub']} "
        f"business={row[0]!r} category={row[1]!r}",
        flush=True,
    )
    return {"statusCode": 200, "body": {"deleted": recommendation_id}}
