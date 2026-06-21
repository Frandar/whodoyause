# Milestone 1 — Foundation & Walking Skeleton _(CURRENT MILESTONE)_

> Detailed spec for Claude Code. Implement **this milestone only**. Do not write code for
> M2+ (no recommendations/search/browse/endorse endpoints or UI). Stop at Gate 1 and wait
> for approval. See `docs/ARCHITECTURE.md` for the locked design and the two corrections.

## Goal

One authenticated request flowing **browser → CloudFront → Lambda → Postgres → back**,
with zero product features. Prove the stack is wired and the integration seams work:
JWT verification, pooled DB access, and CORS.

## Scope guardrails

- **No product features.** Only `/health` (public) and `/whoami` (auth). `/whoami` exists
  solely to exercise the JWT path end-to-end — it is not a feature.
- Apply the **full** approved schema now (cheap; avoids a later migration dance), but
  exercise it only via a trivial health query.
- No staging, no CI/CD, no migration framework. One prod stack; SQL applied by hand;
  `sam deploy` and `deploy.sh` run from the developer's laptop.

## Files to create

```
backend/
  src/
    handler.py            # Lambda entry: routing
    auth.py               # JWKS fetch + cached JWT verify
    db.py                 # pooled psycopg connection (port 6543, tx mode)
    routes/
      health.py           # /health handler
  tests/
    test_router.py
    test_auth.py
    test_health.py
  requirements.txt
  template.yaml           # SAM
db/
  migrations/
    001_init.sql          # full approved schema (see ARCHITECTURE.md §4)
frontend/
  app/
    layout.tsx
    page.tsx              # shell: auth state + /health ping
  lib/
    supabase.ts           # Supabase client (auth only)
    api.ts                # fetch wrapper, attaches JWT
  next.config.js          # output: 'export'
  package.json
  .env.example
scripts/
  deploy.sh               # frontend build + s3 sync + invalidation
.gitignore
README.md
```

Files to modify: none (greenfield).

## Key implementation requirements

### db.py

- Read `DATABASE_URL` from env — must be the **Supabase pooler** URI (port 6543, tx mode).
- `psycopg.connect(DATABASE_URL, autocommit=True, connect_timeout=5)`.
- `healthcheck()` runs `select 1;` through a pooled connection and returns bool.

### auth.py

- JWKS URL: `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
- Use `PyJWKClient` cached in a **module-scope global** (fetch once per cold start).
- `verify_token(authorization_header)`: require `Bearer <jwt>`; decode with algorithms
  `["RS256","ES256"]`, `issuer={SUPABASE_URL}/auth/v1`, `audience="authenticated"`,
  `options={"require":["exp","sub"]}`. Raise `AuthError` on anything invalid.
- Authorization is one line: a valid token means the caller may write. No roles.

### handler.py

- Parse `(method, path)` from the Function URL event (`requestContext.http`).
- Handle `OPTIONS` → 204 (CORS preflight).
- Routes: `GET /health` (public), `GET /whoami` (auth → returns `{user_id: claims["sub"]}`).
- Unknown route → 404 `{error:{code:"not_found"}}`.
- `AuthError` → 401 `{error:{code:"unauthorized"}}`.
- Any other exception → 500; `print("ERROR ...")` so the CloudWatch metric filter catches it.
- CORS headers from `CORS_ALLOW_ORIGIN` env (the CloudFront URL); `*` only as local default.

### template.yaml (SAM)

- One `AWS::Serverless::Function`, Python 3.14, 256 MB, 10s timeout.
- `FunctionUrlConfig` with `AuthType: NONE` (auth enforced in-code) and CORS limited to the
  CloudFront origin.
- Env vars: `DATABASE_URL` (pooler), `SUPABASE_URL`, `CORS_ALLOW_ORIGIN`.
- A `CloudWatch::Alarm` on the function's `Errors` metric (threshold ≥1 over 5 min).
- Decide handler/CodeUri layout consistently: either `CodeUri: .` + `Handler:
src.handler.lambda_handler` (keeps `from src...` imports), or package `src/` as root.
  Pick one and keep tests' `PYTHONPATH` consistent with it.

### Frontend

- `next.config.js`: `output: 'export'`, `images: { unoptimized: true }`.
- `lib/supabase.ts`: client from `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  only. Never the service role key.
- `lib/api.ts`: `getHealth()` (no auth) and `whoami()` (attaches `Bearer` from the current
  Supabase session). Base URL from `NEXT_PUBLIC_API_BASE` (the Function URL).
- `app/page.tsx`: show API health string, signed-in user id (via `/whoami` if a session
  exists), and a sign-in button (magic link via `supabase.auth.signInWithOtp`).

## Tests (pytest)

- `test_auth.py`: missing header → AuthError; non-Bearer → AuthError; malformed token →
  AuthError.
- `test_router.py`: `OPTIONS` → 204; unknown route → 404; `/whoami` without token → 401.
- `test_health.py`: patch `db.healthcheck` → True gives 200 with `db:true`; False gives 503.
- Run: `cd backend && pip install -r requirements.txt pytest && PYTHONPATH=. pytest`.

## Migration

Apply `db/migrations/001_init.sql` (full schema from `docs/ARCHITECTURE.md` §4) via the
Supabase SQL editor or `psql "$DATABASE_URL" -f db/migrations/001_init.sql`. No framework.

## Deployment

- Backend: `cd backend && sam build && sam deploy --guided` (supply `DatabaseUrl` =
  pooler URI, `SupabaseUrl`, `CorsAllowOrigin` = CloudFront URL). Note the `FunctionUrl`
  output.
- S3 bucket + CloudFront distribution: create once (console with OAC origin is fastest at
  M1). Set the bucket as the CloudFront origin.
- Frontend: fill `.env.local`, then `BUCKET=... DIST_ID=... ./scripts/deploy.sh`.

## Manual testing steps

1. Run `001_init.sql`; confirm 3 tables + triggers exist.
2. Confirm `DATABASE_URL` is the **pooler** (port 6543), not 5432.
3. `sam build && sam deploy --guided`; note `FunctionUrl`.
4. `curl <FunctionUrl>/health` → `{"status":"ok","db":true}`. If `db:false`, the pooler
   string is wrong — fix before anything else.
5. Fill frontend `.env.local` (Supabase URL, anon key, `NEXT_PUBLIC_API_BASE=<FunctionUrl>`).
6. `BUCKET=... DIST_ID=... ./scripts/deploy.sh`; open the CloudFront URL.
7. Page shows "API health: ok" → browser→CloudFront→Lambda→Postgres path proven.
8. Sign in via magic link, reload → "Signed-in user: <uuid>" → JWT verify path proven.
9. Confirm no CORS errors in the browser console.
10. **Gate 1 concurrency test:** `seq 50 | xargs -P50 -I{} curl -s <FunctionUrl>/health
    > /dev/null` while watching Supabase connection count → stays bounded (pooler working).

## Gate 1 — done when

Health endpoint green; auth round-trip returns the user id from a verified JWT; CORS clean;
50-concurrent smoke test keeps Postgres connections bounded. Then STOP and wait for approval
to begin Milestone 2.
