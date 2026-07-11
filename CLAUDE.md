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
- Frontend dev: cd frontend && pnpm dev
- Frontend deploy: BUCKET=... DIST_ID=... ./scripts/deploy.sh
