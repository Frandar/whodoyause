import psycopg

from src import db
from src.categories import CATEGORIES, CATEGORY_SET

BUSINESS_NAME_MAX = 200
NOTE_MAX = 1000
QUERY_MAX = 100


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

    user_id = claims["sub"]
    display_name = _display_name(claims)

    with db.get_connection() as conn:
        # Just-in-time user provisioning (recommendation.created_by → app_user.id).
        conn.execute(
            "insert into app_user (id, display_name) values (%s, %s) "
            "on conflict (id) do nothing",
            (user_id, display_name),
        )
        try:
            row = conn.execute(
                "insert into recommendation (business_name, category, note, created_by) "
                "values (%s, %s, %s, %s) "
                "returning id, business_name, category, note, endorsement_count, created_at",
                (business_name, category, note, user_id),
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

    rec_id, bn, cat, nt, count, created_at = row
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
        },
    }


def _to_summary(row) -> dict:
    rec_id, business_name, category, note, count, created_by_name = row
    return {
        "id": str(rec_id),
        "business_name": business_name,
        "category": category,
        "note": note,
        "endorsement_count": count,
        "created_by_name": created_by_name,
    }


_LIST_SELECT = (
    "select r.id, r.business_name, r.category, r.note, r.endorsement_count, u.display_name "
    "from recommendation r join app_user u on u.id = r.created_by"
)


def list_by_category(category: str) -> dict:
    """Public: recommendations in a category, ranked by endorsements (US4)."""
    if category not in CATEGORY_SET:
        raise InvalidInput("unknown category")
    with db.get_connection() as conn:
        rows = conn.execute(
            _LIST_SELECT + " where r.category = %s "
            "order by r.endorsement_count desc, r.created_at desc",
            (category,),
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


def search(query: str, category: str | None = None) -> dict:
    """Public full-text search (US1). Uses websearch_to_tsquery with a bound
    param (never string-interpolated), ranked by endorsements. Zero-result
    queries are logged server-side as a content-gap signal."""
    query = (query or "").strip()
    if not query:
        raise InvalidInput("q is required")
    if len(query) > QUERY_MAX:
        raise InvalidInput("q is too long")
    if category is not None and category not in CATEGORY_SET:
        raise InvalidInput("unknown category")

    sql = _LIST_SELECT + " where r.search_vector @@ websearch_to_tsquery('english', %s)"
    params: list = [query]
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
