# Architecture — Neighborhood Recommendations Platform

> Reference doc for Claude Code. This is the **approved, locked** architecture from
> the Principal Engineer review. Favor simplicity over technical purity. If a task
> would add complexity beyond what's here, challenge it before implementing.

## 0. Two non-negotiable corrections (NEVER regress)

1. **CORRECTNESS — connection pooler.** The Lambda connects to Postgres via the
   Supabase **pooler endpoint (port 6543, transaction mode)**, never the direct 5432
   connection. Lambda scales horizontally and will exhaust Postgres connections on
   the direct endpoint. Transaction-mode pooling implies: use `autocommit=True`, no
   reliance on session-level state (no persistent `SET`, no cross-call prepared
   statements).
2. **VELOCITY — one-line authorization.** Authorization is "valid JWT → may write."
   No roles, no per-row ownership checks. One +1 per user is enforced by a DB unique
   constraint, not application logic. Do not build an authorization framework.

## 1. Stack (locked)

| Layer          | Choice                                          | Notes                                                |
| -------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Frontend       | Next.js, **static export** (`output: 'export'`) | UI only; never the backend                           |
| Hosting        | S3 + CloudFront                                 | static SPA, OAC origin                               |
| Backend        | **One** consolidated Python Lambda              | internal routing; not microservices                  |
| API front door | **Lambda Function URL**                         | CORS locked to CloudFront origin; **no API Gateway** |
| DB + Auth      | Supabase (Postgres + Auth)                      | pooler endpoint from Lambda                          |
| Search         | Postgres full-text (`tsvector` + GIN)           | **no AI, no vector DB**                              |
| IaC            | AWS **SAM**                                     | not SST                                              |
| Analytics      | PostHog                                         | the actual point of the MVP                          |
| Errors         | Sentry (frontend) + CloudWatch (Lambda)         | Sentry-on-Lambda deferred                            |

## 2. Service boundaries (only three, deliberately)

- **Presentation** — Next.js static SPA on S3/CloudFront. Renders UI, holds the JWT,
  calls the API, fires analytics. Owns the auth _flow_ (Supabase client SDK). Owns no
  persistent state.
- **Application/API** — single Python Lambda via Function URL. The only writer to the
  DB. Verifies JWTs, routes internally, enforces minimal authz, runs queries. Does NOT
  own identity and does NOT serve UI.
- **Data & Identity** — Supabase Postgres + Auth. Durable storage, full-text search,
  hosted authentication. The pooler is part of this boundary's contract with the Lambda.

NOT boundaries at MVP: separate search service, per-domain microservices, API Gateway
tier, notification service.

## 3. Request flow

```
Browser (Next.js SPA, PostHog + Sentry)
  ├─ static assets ── CloudFront ── S3
  ├─ login/magic link ──────────── Supabase Auth (issues JWT, held in browser)
  └─ API calls w/ Bearer JWT ───── Lambda Function URL (CORS)
                                      └─ Single Python Lambda
                                           ├─ JWT verify (cached JWKS)
                                           ├─ internal router (method, path)
                                           ├─ business logic
                                           └─ pooled conn (6543, tx mode) ── Supabase Postgres
```

## 4. Database schema (full, applied in Milestone 1)

```sql
create extension if not exists "pgcrypto";  -- gen_random_uuid()

create table if not exists app_user (
  id            uuid primary key,                 -- = auth.users.id
  display_name  text not null,
  created_at    timestamptz not null default now()
);

create table if not exists recommendation (
  id                uuid primary key default gen_random_uuid(),
  business_name     text not null,
  category          text not null,                -- app-side seed list, not a table
  note              text,
  created_by        uuid not null references app_user(id),
  endorsement_count int  not null default 0,      -- denormalized for ranking
  search_vector     tsvector,
  created_at        timestamptz not null default now()
);

create unique index if not exists uq_recommendation_business_category
  on recommendation (lower(business_name), category);
create index if not exists idx_recommendation_category
  on recommendation (category);
create index if not exists idx_recommendation_search
  on recommendation using gin (search_vector);

create table if not exists endorsement (
  id                 uuid primary key default gen_random_uuid(),
  recommendation_id  uuid not null references recommendation(id) on delete cascade,
  user_id            uuid not null references app_user(id),
  created_at         timestamptz not null default now(),
  unique (recommendation_id, user_id)             -- one +1 per user per business
);

-- search_vector maintenance
create or replace function recommendation_search_trigger() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.business_name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(new.category,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(new.note,'')), 'C');
  return new;
end
$$ language plpgsql;

drop trigger if exists trg_recommendation_search on recommendation;
create trigger trg_recommendation_search
  before insert or update on recommendation
  for each row execute function recommendation_search_trigger();

-- endorsement_count maintenance
create or replace function endorsement_count_trigger() returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    update recommendation set endorsement_count = endorsement_count + 1
      where id = new.recommendation_id;
  elsif (tg_op = 'DELETE') then
    update recommendation set endorsement_count = endorsement_count - 1
      where id = old.recommendation_id;
  end if;
  return null;
end
$$ language plpgsql;

drop trigger if exists trg_endorsement_count on endorsement;
create trigger trg_endorsement_count
  after insert or delete on endorsement
  for each row execute function endorsement_count_trigger();
```

Deliberately omitted at MVP: `category` table, business-owner accounts, ratings, audit
tables, multi-neighborhood `tenant_id`. Add `tenant_id` as a column only when onboarding
group #2.

## 5. API contracts

Single base URL (the Function URL). JSON in/out. Bearer JWT on writes. No version prefix
until there's an external consumer. Errors: `{ "error": { "code", "message" } }`.

```
GET  /health
     → 200 { status, db }                         public; M1

GET  /whoami                                       AUTH; M1 (exercises JWT path)
     → 200 { user_id }

GET  /recommendations?category={cat}               public; M2
     → 200 [{ id, business_name, category, note, endorsement_count, created_by_name }]
     ranked by endorsement_count desc

GET  /recommendations/search?q={query}&category={cat?}   public; M2
     → 200 [ ...same shape ]
     uses websearch_to_tsquery against search_vector; logs zero-result queries

POST /recommendations                              AUTH; M2
     body: { business_name, category, note? }
     → 201 { id, ...record }
     → 409 { existing_recommendation_id }          dedupe hit → client offers "+1 instead?"

POST   /recommendations/{id}/endorse               AUTH; M2
     → 200 { recommendation_id, endorsement_count }
     → 409 already endorsed by this user

DELETE /recommendations/{id}/endorse               AUTH; M2 (optional un-+1)
     → 200 { recommendation_id, endorsement_count }
```

The Lambda's internal router maps `(method, path)` to handlers. New routes register the
same way the M1 `/health` route does — never split into separate functions.

## 6. Security model

- **Authentication.** Supabase issues JWTs to the browser. Lambda verifies every write:
  validate signature against Supabase JWKS (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
  check `exp`, `iss` (`{SUPABASE_URL}/auth/v1`), and `aud` (`authenticated`). **Cache the
  JWKS client in module scope** — fetch once per cold start, not per request. Reads need
  no auth.
- **Authorization.** Trivial: valid token → may write. One +1 per user via DB unique
  constraint. No roles, no ownership machinery.
- **Secrets.** Service role key + DB pooler connection string live ONLY in Lambda env vars
  (KMS-encrypted; Secrets Manager only if rotation is needed later). The service role key
  must NEVER reach the browser. Frontend holds only the Supabase anon key + the user's JWT.
- **Network / CORS.** Function URL CORS locked to the CloudFront domain (not `*`). HTTPS only.
- **Input handling.** Parameterized queries only. Never string-interpolate the FTS query —
  use `websearch_to_tsquery` with bound params. Length-limit `note` and `business_name`.
- **Rate limiting.** None at MVP (Lambda concurrency is a natural bound). Adding throttling
  is the moment API Gateway would earn its place — not yet.
- **Accepted risk.** Bypassing RLS via the service role means a Lambda authz bug is a
  data-integrity bug. Mitigation: keep the write surface tiny (two write endpoints) and
  review those handlers carefully.

## 7. Deployment strategy

- **Frontend:** `next build` (with `output: 'export'`) → `./out` → `aws s3 sync ./out
s3://<bucket> --delete` → `aws cloudfront create-invalidation --paths "/*"`. Wrapped in
  `scripts/deploy.sh`.
- **Backend + infra (SAM):** `template.yaml` defines the Lambda, Function URL, IAM role,
  env vars, and a CloudWatch error alarm. `sam build && sam deploy`.
- **Environments:** one (prod) for MVP. Add staging only when two people deploy concurrently.
- **DB migrations:** plain `.sql` files in `db/migrations/`, applied via the Supabase SQL
  editor or `psql "$DATABASE_URL" -f file.sql`. No migration framework for ~3 tables; adopt
  one only past ~5 migrations or a second deployer.
- **Rollback:** frontend = re-sync previous build; Lambda = `sam deploy` previous version
  (Lambda versioning/alias optional).

## 8. Monitoring strategy

- **Product (the goal):** the PostHog funnel — visit → search → result found → 7-day
  return. Watch `search_zero_results`. This dashboard matters more than any infra metric.
- **Errors:** Sentry on frontend from day one. Lambda errors via CloudWatch Logs + a metric
  filter alarming on `ERROR`/unhandled exceptions. Add Sentry-on-Lambda once there are users
  worth retaining.
- **Infra health:** CloudWatch alarms on Lambda error rate, p95 duration (cold start +
  connection issues surface here), and throttles. Watch Supabase connection count as the
  early warning for pooler misconfiguration.

Three alarms + the PostHog funnel are enough. Don't build dashboards for traffic you don't
have.

## 9. Cost (MVP scale)

Effectively a rounding error: Lambda + Function URL ~$0 (free tier), S3 <$1, CloudFront
~$0–1, Supabase $0–25 (Pro $25 buys pooler guarantees + backups), PostHog $0, Sentry $0.
**Total ~$0–30/mo.** The real cost is engineering hours — spend them on the auth seam and
deploy plumbing, not the AWS bill.

## 10. Known seams to handle with care

- **JWKS rotation mid-container-life** → 401s until next cold start (self-healing, accepted).
- **Lambda↔Postgres connections** → only safe via the pooler (see §0).
- **Static export limits** → no SSR/ISR/image optimization/middleware. Accepted for a
  UI-only SPA. If SSR is ever truly needed, that's the moment to reconsider Vercel/Amplify,
  not to bolt on Lambda@Edge.
