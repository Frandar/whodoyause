# Product Requirements Document — Neighborhood Recommendations Platform

> Reference doc for Claude Code. This is the **approved** product spec. It changes
> rarely and only by deliberate decision. If a request conflicts with this doc,
> stop and flag it rather than silently diverging.

## 1. Problem

Neighborhood Facebook groups receive the same questions every day: "Who's a good
HVAC company / electrician / lawn service / dentist / contractor?" People re-ask
because previous answers are buried in old posts, Facebook search is poor, and
valuable community knowledge is effectively lost. Re-asking is the only reliable
retrieval method, so the same questions recur indefinitely.

## 2. Objective

Validate that people will use a dedicated platform to **retrieve and contribute**
neighbor recommendations instead of re-asking on Facebook. The differentiator is
trust: recommendations come from named local community members, not anonymous
internet reviews.

**Primary success signal:** users return and search again within 7 days (the
substitution signal vs. Facebook), plus organic recommendation contributions from
people other than the founders.

**Key risk being tested:** Will users substitute this for the Facebook re-ask
behavior?

## 3. Validation status

Milestone 0 (pre-build validation) is **complete and successful**:

- Concierge experiment (manually compiling past recommendations in real FB groups)
  produced strong pull — users were thrilled.
- Group admins were enthusiastic and willing to promote the tool.

Demand is validated. The build is therefore justified. Proceed milestone by milestone.

## 4. Personas

**Rachel — the Asker (32, new homeowner).** Just moved in, needs a plumber, doesn't
know neighbors yet. Currently posts in the FB group and waits. Wants a fast, trusted
answer without broadcasting her needs publicly.

**Mike — the Recommender (45, long-time resident).** Loves helping; answers the same
questions repeatedly and is mildly annoyed by the repetition. Will contribute if it's
easy and gives him recognition.

**Dana — the Admin (50, runs an 8k-member group).** Tired of duplicate posts cluttering
her group. She is the gatekeeper to the audience and the primary distribution channel.
Will promote a tool that reduces her moderation load. **This is the true GTM lever.**

## 5. User stories & acceptance criteria

### US1 — Search for a recommendation

_As Rachel, I want to search a category so I can find a trusted business fast._

- **AC:** Given recommendations exist, when I search "plumber", then I see matching
  businesses with recommender name, endorsement count, and any notes, ranked by
  endorsements.
- Zero-result queries are logged server-side (content-gap signal).

### US2 — Add a recommendation

_As Mike, I want to add a business I trust._

- **AC:** Given I'm logged in, when I submit business name + category + optional note,
  then it appears in search and is attributed to me.
- **AC (dedupe):** A duplicate business name within the same category does NOT create a
  second row; instead the client is offered "+1 the existing one?" (server returns 409
  with the existing recommendation id).

### US3 — Endorse an existing recommendation

_As Mike, I want to +1 a business someone already added._

- **AC:** One +1 per user per business, enforced by a DB unique constraint (not app
  logic). Count updates immediately and affects ranking.

### US4 — Browse by category

_As Rachel, I want to browse categories so I can explore without a specific query._

- **AC:** Category list shows recommendation counts; selecting a category lists
  businesses ordered by endorsement count.

### US5 — Authenticate

_As any contributor, I want to sign in so I can add and endorse._

- **AC:** One auth method (email magic link or Google) via Supabase Auth. Anyone can
  browse/search without auth; only authenticated users can add or +1.

## 6. MVP scope

Single neighborhood. One auth method. Add recommendation (name, category, recommender,
note). Dedupe-via-+1. Search (Postgres full-text). Browse by category. Endorsements.
PostHog + Sentry. Manual moderation by the founders.

## 7. Explicitly NOT in scope (do not build until validated)

AI summarization / chat / multi-provider AI abstraction; multi-neighborhood / tenancy;
business-owner profiles & claiming; star ratings; in-app messaging; Facebook import /
scraping; "Facebook independence"; monetization; mobile apps; SST / CloudFront-Lambda@Edge
custom infra beyond what's specified; second auth method; advanced moderation tooling;
API Gateway; staging environment; migration framework.

These are deferred until the validation gate (return + organic contribution) is met.

## 8. Categories

Start as an app-side seed list (a constant in code), NOT a database table. Adding or
renaming a category via code deploy is acceptable at MVP. Initial list (adjust freely):
HVAC, Electrician, Plumber, Lawn/Landscaping, Dentist, General Contractor, Roofing,
Pest Control, House Cleaning, Auto Repair, Painter, Handyman.

## 9. Analytics events (PostHog)

`signup`, `search` (props: query, category, results_count),
`search_zero_results` (props: query, category),
`recommendation_added`, `endorsement_added`, `category_browsed`, `return_visit`.

North-star funnel: **visit → search → result found → return within 7 days.**
Watch `search_zero_results` rate as the supply-gap signal.

## 10. Success metrics (kill/continue gate)

Measured over ~4–6 weeks in one seeded group:

- **Activation:** a meaningful share of visitors perform ≥1 search.
- **Retention (the real test):** users return and search again within 7 days.
- **Supply:** organic recommendations added by people other than the founders.
- `search_zero_results` trending down as content fills in.

If retention and organic contribution don't materialize, the substitution hypothesis
failed → pivot (e.g., an admin-side tool that compiles answers inside Facebook) or stop.
