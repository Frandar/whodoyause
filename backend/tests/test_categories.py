"""The seed category list is duplicated by hand in the backend and the frontend
(PRD §8 keeps it out of the database). Nothing enforced that they matched, and a
drift is silent until a neighbor picks a category the API rejects with a bare 400
"unknown category" and no recovery in the form. This test is the enforcement."""

import json
import pathlib
import re

from src.categories import CATEGORIES, CATEGORY_SET

FRONTEND_CATEGORIES = (
    pathlib.Path(__file__).resolve().parents[2] / "frontend" / "lib" / "categories.ts"
)


def _frontend_categories() -> list[str]:
    source = FRONTEND_CATEGORIES.read_text()
    body = re.search(r"export const CATEGORIES = \[(.*?)\] as const;", source, re.S)
    assert body, "could not find the CATEGORIES array in frontend/lib/categories.ts"
    return [json.loads(m.group(0).replace("'", '"')) for m in re.finditer(r"'[^']*'", body.group(1))]


def test_frontend_and_backend_category_lists_match():
    assert _frontend_categories() == CATEGORIES, (
        "frontend/lib/categories.ts and backend/src/categories.py have drifted. "
        "They must stay identical — a mismatch means the dropdown offers a "
        "category the API will reject."
    )


def test_category_set_matches_list():
    assert CATEGORY_SET == frozenset(CATEGORIES)
    assert len(CATEGORY_SET) == len(CATEGORIES), "duplicate category in the seed list"
