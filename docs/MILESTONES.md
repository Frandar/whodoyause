# Milestones — Execution Plan

> Reference doc for Claude Code. Milestones are **gated** and built **one at a time**.
> Do not write code for a milestone until the previous gate is met and the user approves.
> Each milestone has its own detailed spec file (`docs/MILESTONE_N.md`) created when it
> becomes the current milestone.

## Working rules (apply to every milestone)

1. Never implement more than one milestone at a time.
2. Do not generate code for future milestones.
3. Challenge complexity before implementation; explain tradeoffs before coding.
4. Favor maintainability and speed over elegance.
5. Stop when the current milestone is complete and wait for approval.

## Status

- **M0 — Validation: COMPLETE & SUCCESSFUL.** Concierge test thrilled users; admins
  enthusiastic. Demand validated.
- **M1 — Walking skeleton: current / in progress.** See `docs/MILESTONE_1.md`.
- **M2–M4: NOT STARTED.** Specs below are planning-level only — do not implement.

---

## Milestone 1 — Foundation & walking skeleton _(current)_

**Goal:** one authenticated request flowing browser → CloudFront → Lambda → Postgres →
back, with **zero product features**. De-risk the integration seams (JWT verify, pooled
DB, CORS) before building features.

Detailed spec: `docs/MILESTONE_1.md`.

**Gate 1 (done when):** `/health` returns `{status: ok, db: true}`; `/whoami` returns the
user id from a verified JWT; CORS is clean from the CloudFront origin; and a 50-concurrent
smoke test against `/health` keeps Postgres connection count bounded (pooler proven).

---

## Milestone 2 — Core MVP features

**Goal:** the actual product — add, search, browse, endorse — against the schema already
applied in M1. Maps to user stories US1–US5.

**Build order (dependency-driven):**

1. `POST /recommendations` + dedupe 409 logic (US2).
2. Add-recommendation UI: form, category from app-side seed list, dedupe → "+1 instead?"
   flow (US2).
3. Supabase Auth flow in frontend (one method); JWT attached to writes (US5).
4. `GET /recommendations?category=` + browse-by-category UI, ranked by endorsements (US4).
5. `GET /recommendations/search` (`websearch_to_tsquery`) + search UI; **log zero-result
   queries** server-side (US1).
6. `POST /recommendations/{id}/endorse` (+1) + UI; one-per-user via DB unique constraint
   (US3). Optional `DELETE` un-+1.
7. Empty / loading / zero-result states; mobile-friendly layout (FB traffic is mobile).
8. Wire all PostHog events: `search` (+ results_count), `search_zero_results`,
   `recommendation_added`, `endorsement_added`, `category_browsed`, `return_visit`, `signup`.

**Complexity guardrails for M2:**

- New API routes register in the existing single Lambda's router. Never add a second
  function or API Gateway.
- Authorization stays a one-line "valid JWT → may write" check. No roles/ownership.
- Dedupe is enforced by the `uq_recommendation_business_category` index; the handler
  catches the unique violation and returns 409 with the existing id.
- Endorsement uniqueness is enforced by the `endorsement` unique constraint; the handler
  catches the violation and returns 409. Do not check-then-insert in app code.
- No AI, no vector search, no ratings.

**Acceptance:** all five user stories pass their ACs in production (see `docs/PRD.md` §5).
Both founders dogfood add/search/browse/+1 on a phone.

**Gate 2 (done when):** US1–US5 pass ACs in production; PostHog events fire correctly and
appear in the funnel.

---

## Milestone 3 — Seed & soft launch (one group)

**Goal:** solve cold-start and put the product in front of real users. Mostly Product-Lead
work; minimal code.

**Tasks:**

1. With admin permission, manually seed the target group's top recommendations from its
   post history so no common category dead-ends.
2. QA the seeded data; ensure every common category returns ≥1 good result.
3. Admin announces / pins the tool to the **single** chosen group.
4. Founder presence in-group: when someone asks "who's a good X?", reply with a link to
   the result.
5. Set up the PostHog funnel dashboard (visit → search → result found → 7-day return).

**Likely code work (small, only if needed):** a lightweight internal/admin path or script
to bulk-insert seed recommendations attributed to a founder account. Keep it a script or a
single protected route — do not build a moderation/admin console. Challenge any scope
beyond bulk insert.

**Gate 3 (done when):** tool is live, seeded so common searches don't dead-end, and
announced to one real group. The validation experiment is now running.

---

## Milestone 4 — Measure, learn, decide

**Goal:** get the validation answer. Minimal building — the job is learning.

**Tasks:**

1. Weekly funnel review: activation, **7-day return (the substitution signal)**, organic
   contributions.
2. Watch `search_zero_results`; fill genuine content gaps; note failing categories.
3. Qualitative: talk to 5–10 users — did they use it instead of posting? Why / why not?
4. Tiny fixes only (copy, bugs, obvious friction). **No new features.**

**Gate 4 — the real decision:** Do users return and search again within 7 days, and do
recommendations get added by people other than the founders?

- **Yes →** expand (group #2; then consider V2 candidates below).
- **No →** the substitution hypothesis failed → pivot (admin-side tool inside Facebook) or
  stop. Do not add features hoping to rescue a missing core signal.

---

## Post-validation candidates (V2 — only after Gate 4 = yes)

Do NOT build any of these during M1–M4. Listed so intent is captured, not so they get
built early:

- AI retrieval/summarization ("what do my neighbors recommend for a leaking roof?"),
  single provider first; multi-provider abstraction only if cost/availability forces it.
- Multi-neighborhood support: add `tenant_id` column + scoping.
- Vector search: only if Postgres full-text demonstrably fails users.
- Business-owner profiles, ratings, monetization (featured listings / group subscriptions).
- Staging environment, migration framework, Sentry-on-Lambda, rate limiting / API Gateway —
  add when the corresponding pain is real.

## Timeline (rough)

| Milestone      | Calendar               | Primary load |
| -------------- | ---------------------- | ------------ |
| M0 Validation  | done                   | PL           |
| M1 Skeleton    | ~3–4 days              | TL           |
| M2 Features    | ~1.5–2 weeks           | TL + PL      |
| M3 Seed/Launch | ~1 week                | PL           |
| M4 Measure     | ~4–6 weeks observation | Both (light) |
