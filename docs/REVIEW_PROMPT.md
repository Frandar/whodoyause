# Expert review prompt (paste into a Claude Fable session)

Fable is an API model — run this in a Fable session where you've attached the repo
artifacts (docs + M1 code + `frontend/design-reference/home.html` and its decoded copy).
Fable can only review what's in its context, so include the files.

---

You are reviewing an early-stage startup's MVP artifacts across three expert lenses at once.
Adopt all three and keep them distinct in your output:

1. **Expert product designer** — visual design system, UX, information architecture,
   accessibility, mobile-first execution, and how faithfully the build reproduces the
   product's own design reference.
2. **Staff software engineer** — architecture, code, security, correctness, operational
   risk, and whether the simplicity/complexity balance fits a 2-person team optimizing for
   validation speed.
3. **SEO expert** — discoverability given the real constraints, assessed honestly.

## Context

Two-person startup building **WhoDoYaUse** — a neighborhood recommendations platform:
searchable, neighbor-sourced local business recommendations that replace the repeated "who
do ya use for a good electrician?" posts in neighborhood Facebook groups. Differentiator is
trust: named local neighbors with hyper-local proximity ("Maple Street · 4 doors down")
recommend pros — not anonymous algorithmic reviews. Demand is validated (concierge test +
admin enthusiasm). They build milestone by milestone.

**Locked architecture:** Next.js static export (`output: 'export'`) → S3 + CloudFront; a
single consolidated Python Lambda behind a Lambda Function URL (no API Gateway); Supabase
(Postgres + Auth); Postgres full-text search (no AI, no vector DB); AWS SAM; PostHog +
Sentry. Two non-negotiables: (1) Lambda reaches Postgres only via the Supabase pooler
(port 6543, transaction mode); (2) authorization is a one-line "valid JWT → may write"
check, one-endorsement-per-user enforced by a DB unique constraint.

**Design system:** The look and feel is defined by the product's own reference,
`frontend/design-reference/home.html` (decoded: `home-decoded.html`), captured in
docs/FRONTEND.md. Key tokens: deep forest green #15493f fields, gold #ffc23d accent (spent
only on primary CTA / logo / highlights), cream #faf6ef surfaces; Bricolage Grotesque
display + Plus Jakarta Sans body; pill (999px) interactive elements, 12–15px cards, soft
green-tinted shadows, gold focus ring. Signature elements: green hero with a big Bricolage
headline, a pill search + popular-category chips, and neighbor recommendation cards
(name + proximity + "recommends [business]" + stars + usage count + quote). Stack for the
frontend is Tailwind + shadcn/ui, mobile-first (traffic is mostly mobile, from Facebook).

Artifacts provided alongside this message: `CLAUDE.md`, `PRD.md`, `ARCHITECTURE.md`,
`MILESTONES.md`, `MILESTONE_1.md`, `FRONTEND.md`, `FRONTEND_PROMPT.md`, the design reference
HTML (bundled + decoded), and any Milestone 1 code (Python Lambda `handler.py`, `auth.py`,
`db.py`, `routes/health.py`; `template.yaml`; `001_init.sql`; the Next.js shell).

## How to review

Be a critical peer, not a cheerleader. Find what's wrong, risky, or missing; challenge
assumptions and name tradeoffs. Where something is genuinely good, say so briefly and move
on — spend words on problems and concrete fixes. Distinguish (a) real defects/risks, (b)
judgment calls you'd make differently and why, and (c) things correctly deferred for a
validation MVP that should stay deferred. Do not recommend adding complexity, AI, or scale
machinery the stage doesn't warrant; justify any addition against "learning speed for a
2-person team."

For each lens, address at minimum:

**Designer**
- Does the build faithfully reproduce the WhoDoYaUse reference (green/gold/cream palette,
  Bricolage + Plus Jakarta type, pill/card radii, green-tinted shadows, the hero/search/
  neighbor-card signatures)? Where does docs/FRONTEND.md drift from the reference file?
- Is the trust framing (neighbor name + proximity + usage count + quote) carried through as
  the core pattern, or diluted into generic star-review UI?
- Token/type/spacing coherence and mobile-first execution. Accessibility gaps: gold focus
  ring present? Contrast of sage text (#9fb6ab/#7f968b) on green — does it pass? Reduced
  motion, semantics?
- Is the component inventory the minimum that validates the idea? Flag any
  marketing/future framing from the reference ("Book with confidence", "For pros",
  "Pricing", payments) being built as real MVP features — it shouldn't be.
- Copy quality in the WhoDoYaUse voice (empty/zero-result/error states).

**Staff engineer**
- Architecture correctness and appropriate simplicity. Scrutinize the two non-negotiables
  (pooler usage, one-line authz) for correctness and failure modes.
- Review the M1 code specifically: JWKS verification + module-scope caching, CORS handling,
  Function-URL event parsing, error handling, the SQL schema/triggers (search_vector +
  endorsement_count), the SAM template, and the CodeUri/Handler import ambiguity flagged in
  the M1 spec. Security: service-role key handling, planned FTS input validation for M2.
- Is the milestone gating realistic? What's under-specified that will bite in M2?

**SEO expert**
- Assess discoverability honestly for a client-rendered static-export SPA behind CloudFront,
  auth-gated writes / public reads, launching in one neighborhood with sparse seeded
  content. Where will it fail to get indexed, and does that matter at the validation stage?
- If SEO matters for growth (local long-tail like "best electrician in [neighborhood]"),
  what's the smallest set of changes that would help, and what's premature? Be specific
  about the static-export tradeoff (no SSR/ISR) and whether it should be revisited — without
  reflexively recommending a rewrite.

## Output format

1. **Top findings** — 5–8 highest-impact items, each tagged `[Designer]`/`[Engineer]`/
   `[SEO]` and `[defect]`/`[judgment call]`/`[correctly deferred]`, ordered by impact.
2. **Detailed review** — one section per lens, tied to actual files/code.
3. **Fix before Milestone 2** vs. **Leave alone** — two short lists.
4. **One thing you'd push back on hardest** — the single most important risk/disagreement,
   stated plainly.

Prioritize specificity over completeness: reference actual files, functions, tokens, and
decisions rather than generic advice.
