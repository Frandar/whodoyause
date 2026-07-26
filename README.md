# WhoDoYaUse

Searchable, neighbor-sourced local business recommendations — the thing that replaces the
repeated "who do ya use for a good electrician?" posts in neighborhood Facebook groups.
The differentiator is trust: named neighbors recommend pros, not anonymous algorithms.

Two-person startup, validation-stage MVP. Optimize for learning speed and maintainability.
See `CLAUDE.md` for the working rules and `docs/` for the locked product, architecture and
milestone specs.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router), **static export** (`output: 'export'`), Tailwind v4, shadcn/ui |
| Hosting | S3 + CloudFront (private bucket, OAC) |
| Backend | One Python 3.14 Lambda (arm64) behind a Lambda Function URL — no API Gateway |
| DB + Auth | Supabase (Postgres + magic-link Auth) |
| Search | Postgres full-text (`tsvector` + GIN). No AI, no vector DB |
| IaC | AWS SAM (backend) + CloudFormation (hosting) |
| Analytics | PostHog · Errors: Sentry (frontend) + CloudWatch (Lambda) |

## Prerequisites

- **uv** (Python; version pinned in `backend/.python-version`)
- **pnpm** 10
- **Docker running** — `psycopg-binary` is a compiled C extension and the Lambda is arm64,
  so the build must run in a Lambda-like container. A plain `sam build` on macOS packages
  Mac wheels that fail at runtime.
- AWS CLI configured, and a Supabase project with **asymmetric JWT signing keys enabled**
  (the Lambda verifies RS256/ES256 via JWKS; legacy HS256 projects 401 on every write).

## First run

```bash
# Backend
cd backend && uv sync
uv run pytest                      # 96 tests, no DB needed

# Frontend
cd frontend && pnpm install
cp .env.example .env.local         # then fill in the values
pnpm dev                           # http://localhost:3000
```

### Environment (`frontend/.env.local`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key — **never** the service role key |
| `NEXT_PUBLIC_API_BASE` | Lambda Function URL |
| `NEXT_PUBLIC_SITE_URL` | Public origin; drives canonical URLs, Open Graph and sitemap |
| `NEXT_PUBLIC_POSTHOG_KEY` / `_HOST` | Optional — analytics no-ops if unset |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional — error reporting no-ops if unset |

The service role key and the DB pooler string live **only** in Lambda env vars.

## Database

Plain SQL, applied by hand (no migration framework at ~4 files):

```bash
psql "$DATABASE_URL" -f db/migrations/001_init.sql   # then 002, 003 in order
```

`DATABASE_URL` must be the Supabase **pooler** endpoint (port 6543, transaction mode), never
the direct 5432 connection — Lambda scales horizontally and will exhaust Postgres otherwise.

## Commands

```bash
# Backend
cd backend && uv run pytest
uv export --no-hashes --no-dev -o requirements.txt && sam build --use-container && sam deploy

# Frontend
cd frontend
pnpm lint          # ESLint (incl. jsx-a11y)
pnpm typecheck     # tsc --noEmit
pnpm a11y          # axe-core against the built routes — fails on any WCAG A/AA violation
pnpm build

# Deploy
aws cloudformation deploy --template-file infra/hosting.yaml --stack-name whodoyause-hosting
BUCKET=... DIST_ID=... ./scripts/deploy.sh
```

CI (`.github/workflows/ci.yml`) runs pytest, lint, typecheck, build and the axe gate on
every PR.

## Moderation

Content removal (`DELETE /recommendations/{id}`) is gated on the `MODERATOR_USER_IDS` Lambda
env var — a comma-separated allow-list of founder Supabase user ids. **It is empty by
default, which means nobody can moderate.** Set it before announcing the tool to a real
group:

```bash
sam deploy --parameter-overrides ModeratorUserIds="<uuid>,<uuid>"
```

This is an allow-list, not a role system, and must not grow into one (see
`docs/ARCHITECTURE.md` §0).

## Repo layout

```
backend/    Lambda source (src/), tests, SAM template
frontend/   Next.js app — app/ routes, components/, lib/, scripts/a11y.mjs
db/         Hand-applied SQL migrations
infra/      CloudFormation for S3 + CloudFront hosting
docs/       PRD, ARCHITECTURE, MILESTONES, FRONTEND design system
scripts/    deploy.sh (frontend build + sync + invalidation)
```
