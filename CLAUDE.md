# WhoDoYaUse — Neighborhood Recommendations Platform

## What this is

WhoDoYaUse: searchable, neighbor-sourced local business recommendations. Replaces the
repeated "who do ya use for a good electrician?" posts in neighborhood Facebook groups. The
differentiator is trust — named neighbors with hyper-local proximity recommend pros, not
anonymous algorithmic reviews. Demand is VALIDATED (concierge test + admin enthusiasm).
Building the MVP milestone by milestone.

## Team

Two-person startup. Tech lead is experienced with AWS, Python, and Lambda.
Optimize for LEARNING SPEED and MAINTAINABILITY, not technical elegance.

## Hard rules for working in this repo

- Implement ONE milestone at a time. Do not write code for future milestones.
- Stop when the current milestone is complete and wait for approval.
- Challenge complexity BEFORE implementing it. Explain tradeoffs before coding.
- No premature scalability, no over-engineering, no enterprise patterns pre-validation.
- NO AI features in the MVP. Postgres full-text search only.
- If a request conflicts with the reference docs, stop and flag it — don't silently diverge.

## Architecture (locked — see docs/ARCHITECTURE.md)

- Frontend: Next.js, STATIC EXPORT (output: 'export'). UI only — never the backend.
- Hosting: S3 + CloudFront.
- Backend: ONE consolidated Python Lambda, internal routing. NOT microservices.
- API front door: Lambda Function URL. NO API Gateway at MVP.
- DB + Auth: Supabase (Postgres + Auth).
- IaC: AWS SAM. NOT SST.
- Observability: PostHog (product), Sentry (frontend), CloudWatch (Lambda).

## Two non-negotiable corrections (NEVER regress)

1. CORRECTNESS: Lambda connects to Postgres via the Supabase POOLER endpoint
   (port 6543, transaction mode). NEVER the direct 5432 connection.
2. VELOCITY: Authorization is one line — "valid JWT → may write." No roles, no ownership
   checks. One +1 per user is enforced by a DB unique constraint, not app logic.

## Design (see docs/FRONTEND.md)

Design system is WhoDoYaUse's own, defined by frontend/design-reference/home.html (the
source of truth; decoded copy: home-decoded.html). Deep forest green #15493f fields, gold
#ffc23d accent, cream #faf6ef surfaces; Bricolage Grotesque display + Plus Jakarta Sans
body; pill (999px) interactive elements, 12–15px cards. Tailwind + shadcn/ui, mobile-first.
This is NO LONGER Fresha-inspired — ignore any earlier Fresha references.

## Secrets

- Frontend holds ONLY the Supabase anon key + the user's JWT.
- Service role key + DB pooler string live ONLY in Lambda env vars. Never client-side.

## Quality bar (enforced — do not regress)

These came out of a full engineering/design review. `pnpm lint`, `pnpm typecheck`,
`pnpm a11y` and `uv run pytest` all run in CI on every PR.

**Design tokens are law.** Never write a hex literal in a component. Every colour lives in
`frontend/app/globals.css` and is used via its Tailwind token (`text-ink-muted`,
`bg-surface-quote`, `border-border-strong`, …). If a shade you need doesn't exist, add a
token — don't inline it. The codebase previously carried nine one-off greys and five
duplicate surfaces, which made a three-value contrast fix a thirty-file edit.

**Accessibility: WCAG 2.2 Level AA.** Three rules cover most of what actually broke here:
- Every interactive element keeps a **visible focus indicator at ≥3:1**. Use `ring-ring` on
  light surfaces and `ring-ring-on-dark` on the green fields — gold on cream is 1.5:1 and
  fails. Never `focus:outline-none` without a replacement.
- Body text ≥4.5:1 against its actual background.
- Interactive targets ≥24×24 CSS px (SC 2.5.8).
Plus: one `<main>` (owned by the root layout — pages must not nest another), a skip link,
and live regions that are present in the DOM *before* their content changes.

**API error contract.** Backend errors are always `{ "error": { "code", "message" } }` with
the right status. Frontend: **read** helpers throw (caller shows an error state + retry);
**write** helpers return result unions the caller branches on. Validate at the network
boundary — `res.json()` is untrusted.

**Testing floor.** New API routes ship with handler tests (status codes, auth, the failure
branches). New interactive UI must keep `pnpm a11y` green. The axe job **must**
force-reveal `[data-reveal]` elements first — axe skips `opacity:0` nodes and will
otherwise report a false pass.

**Copy tells the truth.** Never describe a capability the MVP doesn't have. Booking,
messaging and neighborhood-switching are explicit non-scope (PRD §7) and must not appear in
copy, however good the design reference makes them look.

## Current milestone

Milestone 2 — core MVP features (add, search, browse, endorse; US1–US5).
See docs/MILESTONES.md §"Milestone 2". M1 (walking skeleton) is complete:
Gate 1 passed and deployed.

## Reference docs

- Product spec: @docs/PRD.md
- Locked architecture, schema, API, security: @docs/ARCHITECTURE.md
- Milestone plan + gates: @docs/MILESTONES.md
- Current milestone spec: @docs/MILESTONE_1.md
- Frontend design system (WhoDoYaUse, shadcn + Tailwind): @docs/FRONTEND.md
- Design source of truth: frontend/design-reference/home.html (decoded: home-decoded.html)

## Tooling

- Python: managed by **uv** (`pyproject.toml` is the source of truth). Run `uv sync` in
  `backend/` to create/update the venv. Python version pinned in `backend/.python-version`.
- Frontend: managed by **pnpm**. Run `pnpm install` in `frontend/`.
- SAM build uses `backend/requirements.txt` (auto-generated — do NOT edit by hand).
  Regenerate it with: `cd backend && uv export --no-hashes --no-dev -o requirements.txt`
- Lambda is **arm64**. `psycopg-binary` is a compiled C extension, so the build MUST run
  in a Lambda-like Linux container (`sam build --use-container`) — a plain `sam build` on
  macOS packages Mac wheels that fail at runtime. **Docker must be running** to deploy.

## Commands

- Backend tests: cd backend && uv run pytest
- Backend deploy: cd backend && uv export --no-hashes --no-dev -o requirements.txt && sam build --use-container && sam deploy
- Provision frontend hosting (once): aws cloudformation deploy --template-file infra/hosting.yaml --stack-name whodoyause-hosting
- Provision email (once): aws cloudformation deploy --template-file infra/email.yaml --stack-name whodoyause-email --capabilities CAPABILITY_NAMED_IAM
- Print SMTP credentials for Supabase: ./scripts/ses-smtp-credentials.sh
- Frontend dev: cd frontend && pnpm dev
- Frontend deploy: BUCKET=... DIST_ID=... ./scripts/deploy.sh

## Auth email (magic links)

Supabase's built-in mailer is capped at a few emails per hour and is not for production.
Magic links go out through **AWS SES** instead: `infra/email.yaml` owns the verified
`whodoyause.com` identity (Easy DKIM), the `mail.whodoyause.com` MAIL FROM subdomain, the
DMARC record, and a send-only IAM user. Supabase is pointed at it via Auth → SMTP Settings.

Two things that bite:

- The SMTP password is **not** the IAM secret key — it's that secret run through a
  region-specific SigV4 derivation. `scripts/ses-smtp-credentials.sh` does it.
- Custom SMTP alone does **not** raise the cap. Supabase's own
  Authentication → Rate Limits → "Rate limit for sending emails" is a separate setting and
  stays at its low default until you change it.
