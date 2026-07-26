# WhoDoYaUse — Engineering & Design Review

Read-only audit. No code was modified. Date: 2026-07-26. Branch: `main` @ `34fd352`.

## Provenance & method

This review executes the prompt in **`docs/review-prompt.md`** (Phases 0–6, output format,
and the four rules — cite real file:line, prefer substantiated over generic, flag
uncertainty, don't fix). Two things from that document's "Notes on using it" section were
also applied:

- **Automated a11y was run, not just static reading** (the doc: *"Static reading catches maybe
  half of a11y issues… run axe-core or pa11y against the main routes… Note which findings are
  automated vs. manual."*). Results in §3.0 below; every finding is tagged `[axe]` or
  `[manual]`.
- **Its closing recommendation — fold the settled standards into CLAUDE.md** — is written up
  as §7, together with the doc's suggested follow-up prompts.

One deviation, disclosed: the doc advises **running the phases as separate passes** for depth
on a large repo. This was a single pass. The repo is small enough (82 tracked files, ~3.5k
lines of app code) that I read every source file rather than sampling, but Phase 6's journey
walkthroughs are the section most likely to reward a dedicated second pass.

> Note: `docs/review-prompt.md` (untracked) and `docs/REVIEW_PROMPT.md` (tracked, commit
> `c494b82`) are **two different documents** — the latter is a three-lens Designer/Engineer/SEO
> prompt aimed at a Fable session reviewing M1 artifacts. Confirmed distinct (different
> inodes and hashes; the names differ by `_` vs `-`, so there is no case-collision risk on a
> case-insensitive checkout — I checked). Minor docs hygiene: the near-identical names invite
> confusion, and the newer one isn't committed. Where the tracked prompt asks lens-specific
> questions, this review answers them: sage-on-green contrast (F-04 table — `#9fb6ab` 4.74:1
> and `#7f968b` 4.60:1 both **pass**), reference fidelity and token drift (F-25), the missing
> proximity/trust line (§6), and marketing framing built as real copy (F-23).

Verification performed: read the full front-end and back-end source; ran `uv run pytest`
(75 passed), `tsc --noEmit` (clean), `pnpm lint` (**broken**, see F-11), `pnpm build`
(succeeds); served the static export and ran **axe-core 4.10.2** against all four routes;
measured landmarks, headings, focus styles and target sizes in Chrome; computed WCAG contrast
ratios by hand for every hardcoded colour pair.

---

## STATUS: all 37 findings addressed (branch `fix/review-findings`)

Every finding below has been fixed. Verification after the changes:

| Gate | Before | After |
| --- | --- | --- |
| `uv run pytest` | 75 pass | **96 pass** (+21 covering the new behaviour) |
| `pnpm lint` | **crashed** (`next lint` removed in Next 16; no ESLint installed) | **0 errors**, 7 documented warnings |
| `pnpm typecheck` | (no script) | clean |
| `pnpm a11y` (axe, 4 routes) | (did not exist) — 16 WCAG violations when run by hand | **0 violations** |
| CI | none | `.github/workflows/ci.yml` — pytest + lint + typecheck + build + axe |

Manually re-verified in Chrome, because axe does not test these: the hero search
focus ring now renders (screenshotted), the skip link becomes a real 152×47 target on
focus, `#main` exists with exactly one `<main>`, and **0 targets remain under 24×24**
(was 19).

Three notes on judgement calls, since "fixed" is doing different work in different rows:

1. **F-34 (idempotency contract)** — I flagged this as possibly intentional and asked. With
   no answer available I chose: idempotent for the *endorsement* (un-doing something you
   never did is a 200), 404 for a *recommendation that doesn't exist*. That matches
   `endorse` and is now written into ARCHITECTURE §5. Easy to flip if you disagree.
2. **F-11 (`react-hooks/set-state-in-effect`)** — set to `warn`, not `error`. All seven
   violations are pre-existing sync-from-external-state effects, including the
   static-export hydration gates that exist to fix a real bug. Failing the build on them
   would have forced either a risky seven-site refactor at the end of a large change set or
   seven inline disables. The rationale is in `eslint.config.mjs`; the proper fix
   (`useSyncExternalStore` for the URL reads) is a separate piece of work.
3. **F-24 (dead footer links)** — Privacy/Terms/Cookies were *removed*, not pointed
   somewhere. Writing your privacy policy is not my call, and a fake Privacy link on a
   product that collects emails is worse than none. **This is the one item that still needs
   you** before launch.

**Two things need your input before this ships:**
- `MODERATOR_USER_IDS` is empty by default and moderation fails closed — set it to the
  founders' Supabase user ids (`sam deploy --parameter-overrides ModeratorUserIds="…"`) or
  F-02 is fixed in code but not in effect.
- Supabase → Authentication → URL Configuration must list the new `emailRedirectTo` targets
  (your CloudFront origin + `/recommend`, `/browse`, `/`), or F-01's magic links will be
  rejected. Code side is done; the dashboard side is yours.

---

## 1. Executive summary

1. **The magic-link flow drops the user's destination.** `signInWithOtp` is called without
   `emailRedirectTo` (`AuthProvider.tsx:109-118`), so the `?next=/recommend` the sign-in page
   carefully computes is only honoured for users who were *already* signed in. Every genuine
   sign-up lands on the site root and has to re-navigate. This is the supply-side funnel the
   whole validation experiment depends on.
2. **The primary control on the site has no visible focus indicator.** The hero search input
   sets `focus:outline-none` with no replacement (`SearchAutocomplete.tsx:259`); measured in
   Chrome: `outline: none, box-shadow: none`, border unchanged. WCAG 2.4.7 (AA). Used on
   both `/` and `/browse`.
3. **The global focus ring fails contrast everywhere except on green.** `--ring: #ffc23d`
   measures **1.50:1 on cream, 1.61:1 on white** (needs 3:1, SC 1.4.11). Every focus ring on
   a light surface — i.e. most of the product — is effectively invisible.
4. **No skip link (SC 2.4.1, Level A), and the homepage has no `<main>` landmark** — verified
   in-browser: landmarks are `HEADER`, `NAV[Primary]`, `FOOTER` only, and axe reports 40 nodes
   of content sitting outside any landmark.
5. **Links shared into Facebook groups — the stated GTM channel — render with no preview
   card.** No Open Graph tags, no `metadataBase`, no per-page `<title>` (all five pages
   ship `<title>WhoDoYaUse</title>`), no robots.txt, no sitemap.
6. **Search has no `LIMIT`** (`recommendations.py:338-348`) and Postgres FTS does no prefix
   matching, so typing "plumb" returns nothing from the autocomplete while a broad query
   returns every matching row unbounded.
7. **Category chips and search clobber each other unpredictably** — clicking a chip while viewing
   search results discarded the query (`browse/page.tsx:200-203`) while the reverse did not.
   *Resolved as two explicit, symmetric modes rather than composable filters — see F-17.*
8. **There is no moderation path.** Before launching UGC to an 8k-member group there is no
   delete endpoint, no rate limiting, and `AuthType: NONE` on the Function URL. Removing spam
   means opening the Supabase SQL editor.
9. **No CI, no linting, no front-end tests.** `pnpm lint` fails outright (`next lint` was
   removed in Next 16), there is no ESLint config or dependency, and `.github/` does not exist.
   The back end is genuinely well tested (75 tests); the front end has zero.
10. **The landing page promises features that are explicitly out of scope.** "Message or book
    in a tap", "Book with confidence", "Set your neighborhood" (`HowItWorks.tsx:6,15-16`) —
    PRD §7 and FRONTEND.md both say booking is not the MVP. First-visit expectations are set
    against a product that cannot meet them.

**What's good, and worth protecting:** the back end is disciplined — thin handler, testable
route modules, parameterised queries throughout, dedupe and one-+1 enforced by DB constraints
rather than app logic (exactly as ARCHITECTURE §0 demands), pooler-only connections, no
wildcard IAM, and a 75-test suite that asserts behaviour (status codes, SQL parameter order,
409 paths) rather than implementation. TypeScript is strict with **zero** `any`, `as any`,
or `@ts-ignore` in the app code. Race conditions in the browse page are handled properly with
a monotonic request id.

---

## 2. Stack & Architecture (Phase 0)

| Layer | Actual |
| --- | --- |
| Framework | Next.js **16.2.7** (Turbopack), React **19.2.7**, App Router, `output: 'export'` (`next.config.js:3`) |
| Routes | `/`, `/browse`, `/recommend`, `/signin` — all `'use client'`; 13 of 20 components are client components |
| Styling | Tailwind **v4** (CSS-first, `@import "tailwindcss"` + `@theme inline` in `app/globals.css`) — **no `tailwind.config.*` exists**; shadcn/ui "new-york" via `radix-ui` 1.5, `cva`, `tw-animate-css` |
| State | Local `useState` + two React contexts (`AuthProvider`, implicit analytics). No Redux/Zustand/React Query. URL state on `/browse` is managed with the **History API**, deliberately not `router.push` (static-export constraint, documented at `browse/page.tsx:85-90`) |
| Fonts | `next/font/google` — Bricolage Grotesque (display) + Plus Jakarta Sans (body), self-hosted at build |
| Images | None. No `<img>` or `next/image` anywhere; avatars are initials in a `<span>` |
| API | Single AWS Lambda (Python **3.14**, arm64, 256 MB, 10 s) behind a **Lambda Function URL**, `AuthType: NONE`, CORS locked to the CloudFront origin (`template.yaml:32-54`). Hand-rolled `if method/path` router in `handler.py:52-184` — 10 routes |
| Auth | Supabase Auth, **magic link only** (`signInWithOtp`). Lambda verifies RS256/ES256 against Supabase JWKS with `PyJWKClient` (`auth.py:16-47`). Authorization is the one-liner "valid JWT → may write", plus the sanctioned `created_by = caller` self-scope on `PATCH /recommendations/{id}` |
| Data | Supabase Postgres via the **pooler (6543, tx mode)**, `psycopg` 3.3.4, `autocommit=True`. 3 hand-applied SQL migrations, no framework. FTS via `tsvector` + GIN + `websearch_to_tsquery` |
| Deploy | AWS SAM (`backend/template.yaml`) for the Lambda; a separate CloudFormation stack (`infra/hosting.yaml`) for a private S3 bucket + CloudFront with OAC and a viewer-request function that appends `.html`; `scripts/deploy.sh` for `s3 sync` + invalidation |
| Tests | `pytest` 8, **75 tests, back end only**. No Vitest/Jest/Playwright/axe |
| Observability | PostHog wired (7 events + `edit_suggested`); **Sentry is specified in CLAUDE.md and ARCHITECTURE §8 but is not installed**; one CloudWatch `Errors` alarm |

### Could not verify (stated, not guessed)

- **320 px reflow (SC 1.4.10) and 200 % zoom.** The Chrome window resize did not propagate to
  the page viewport, and `body { overflow-x: clip }` (`globals.css:106`) *masks* horizontal
  overflow rather than preventing it — so a static read cannot rule out reflow failures either.
  Needs a real device-emulation pass.
- **Whether Supabase asymmetric JWT signing keys are actually enabled** on project
  `gbvmauojtpadkovzmnyf`. `auth.py:7-10` warns that legacy HS256 projects 401 on every write.
  Since Gate 1 passed in production I assume it is enabled, but I cannot see the dashboard.
- **Production CORS behaviour end-to-end.** `CorsAllowOrigin` is `https://dt7h6pugbmxvl.cloudfront.net`
  (`samconfig.toml:9`); I verified the template, not a live preflight.
- **Real bundle transfer sizes.** Next 16 no longer prints per-route sizes; `out/_next/static/`
  is ~1.5 MB of uncompressed JS across 40+ chunks, with the three largest at 251/237/222 KB.
  I did not map chunks back to packages.
- **`db/migrations/*.sql` are actually applied.** They're hand-run; there is no schema check.

### Assumption flagged

The `.env.local` file is present locally and gitignored; I read only the variable **names**,
not values. `NEXT_PUBLIC_*` correctly contains only the Supabase publishable key, API base and
PostHog key — **no service-role key is exposed client-side**, and nothing sensitive is tracked
in git (82 tracked files; `samconfig.toml` and `.env.local` are both ignored).

---

## 3. Findings

Severity reflects impact *on this product at this milestone* (a 2-person validation MVP about
to be shown to one real Facebook group), not abstract best practice.

### 3.0 Automated accessibility results (axe-core 4.10.2)

Run against the production build served statically, all four routes, rulesets
`wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa` plus `best-practice` reported separately.

| Route | WCAG violations | Best-practice violations |
| --- | --- | --- |
| `/` | **15** nodes, all `color-contrast` (serious) | `landmark-one-main` ×1; `region` ×**40** |
| `/browse` | 0 | `region` ×3 |
| `/signin` | 0 | `page-has-heading-one` ×1 |
| `/recommend` | 1 node, `color-contrast` | none |

The four distinct contrast failures axe found — which **independently confirm my hand-computed
ratios to two decimals**:

| Measured | Colour pair | Where | Finding |
| --- | --- | --- | --- |
| **2.74:1** | `#8a9a8f` on `#faf6ef`, 13.5 px bold | section eyebrows on `/` and `/recommend` | F-12 |
| **2.91:1** | `#8a9a8f` on `#fffdf9`, 13.5 px bold | "Browse by category" eyebrow | F-12 |
| **3.06:1** | `#6f9079` on `#e9f1ea`, 13.5 px bold | `HowItWorks.tsx:25` "How it works" eyebrow | F-12 |
| **4.30:1** | `#6a786f` on `#faf6ef`, 13.5 px | category counts | F-13 |

**Three caveats on the automated coverage — read these before trusting the green cells.**

1. **axe skips `opacity: 0` elements.** All 22 `data-reveal` sections start hidden
   (`globals.css:126-129`), so the first run reported only 2 violations. I had to force
   `is-revealed` and inline `opacity: 1` before axe saw the page — that is when the 15
   contrast failures appeared. Any future axe-in-CI job (F-11) **must** do the same or it will
   report a false pass.
2. **`/browse` was only ever scanned in its skeleton state.** `BrowseFallback` renders until
   `mounted`, and the CloudFront-locked CORS policy blocks the prod API from `localhost`, so
   **`RecommendationCard` was never rendered for axe**. Its 0-violation row is not evidence of
   compliance — F-13 (`#7a887f` at 3.39–3.71:1), F-15 (undersized card controls) and F-16
   (live region) all live in code axe never reached.
3. **axe caught 4 of the 37 findings.** It found nothing for F-01, F-03, F-04, F-06, F-15,
   F-16 or F-17 — including the two highest-impact a11y defects (invisible focus ring on the
   primary control; a global focus-ring token failing 1.4.11). Automated tooling does not test
   focus-indicator contrast, target size in context, live-region timing, or whether a recovery
   action disappears on a timer. This is the concrete argument for keeping a manual pass in the
   loop rather than treating a green axe run as done.

Every finding below is tagged **`[axe]`** (independently confirmed by automated tooling) or
**`[manual]`** (found by reading/measuring; axe does not detect it).

### Critical

| ID | Area | File:line | Issue | Impact | Fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| **F-01** `[manual]` | Auth / UX | `frontend/components/AuthProvider.tsx:109-118` | `signInWithOtp` is called with `{data:{...}}` or `{shouldCreateUser:false}` — **never `emailRedirectTo`**. The `?next=` destination computed at `signin/page.tsx:14-23` is only applied by the already-signed-in shortcut at `:39`. | A neighbor who clicks "Recommend a pro" → sign in → email link lands on the site root, not `/recommend`. Their intent (and any typed business name) is lost at the exact moment the product needs a contribution. This is the funnel M2's Gate depends on. | Pass `options.emailRedirectTo = ${window.location.origin}/signin?next=${next}` (or the destination directly) and add the URL to Supabase's redirect allow-list. | S |
| **F-02** `[manual]` | Security / Ops | `backend/src/handler.py:66-178`; `backend/template.yaml:38-54` | No delete/hide endpoint for a recommendation, endorsement or note; no rate limiting; Function URL is `AuthType: NONE` and anyone can self-serve a Supabase account. | The product is about to be announced to an 8k-member group. A single bad actor (or a bored one) can post unbounded recommendations and the only remediation is the Supabase SQL editor. "Manual moderation by the founders" (PRD §6) has no tool. | Before M3: add `DELETE /recommendations/{id}` gated to a founder user-id allow-list (a constant, not a role system), or a one-off `scripts/moderate.py`. Decide explicitly — this is a launch gate, not a feature. | M |

### High

| ID | Area | File:line | Issue | Impact | Fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| **F-03** `[manual]` | a11y — SC 2.4.7 (AA) | `frontend/components/SearchAutocomplete.tsx:259` | Hero-variant input sets `focus:outline-none` and the wrapping `<form>` (`:254`) has no `focus-within` style. Measured in Chrome after `.focus()`: `outlineStyle:"none", outlineWidth:"0px", boxShadow:"none"`, border unchanged. The `default` variant at `:288` *does* have `focus:ring-2`. | The single most important control in the product is completely invisible to keyboard users, on both the landing page and `/browse`. | Add `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2` to the form wrapper at `:254`, matching the default variant. | S |
| **F-04** `[manual]` | a11y — SC 1.4.11 (AA) | `frontend/app/globals.css:46` | `--ring: #ffc23d`. Computed: **1.50:1 vs `--background` #faf6ef**, **1.61:1 vs `--card` #ffffff**, 6.34:1 vs `--primary` #15493f. SC 1.4.11 requires 3:1 for focus indicators. | Every `focus-visible:ring-ring` in the app — nav, chips, buttons, inputs, dialogs — is unusable on cream/white surfaces, i.e. everywhere except the green hero bands. The comment on `:46` claims it is "visible on green AND cream"; the math disagrees. | Keep gold on green; introduce a second token (e.g. `--ring-on-light: #15493f`, 9.0:1 on cream) and switch light-surface components to it. Or make the ring a 2 px gold core with a 1 px dark outer stroke. | M |
| **F-05** `[axe]` | a11y — SC 2.4.1 (A) + landmark structure | `frontend/app/layout.tsx:30-39` | Two distinct defects. (a) **No skip-to-content link** — verified: `document.querySelectorAll('a[href^="#"]')` returns `[]`. This is the SC 2.4.1 (Level A) failure and axe does *not* detect it. (b) The homepage has **no `<main>` landmark** — `children` sits in a bare `<div className="flex-1">` at `:35`; `/browse`, `/recommend`, `/signin` each supply their own `<main>`, `/` does not. axe flags (b) as `landmark-one-main` plus `region` across **40 nodes** — but classifies both as *best-practice*, not a WCAG SC, so a WCAG-only CI gate would miss it. | Keyboard and screen-reader users must tab through the entire header + nav on every page load. Landmark navigation is unavailable on the highest-traffic page. | Add a visually-hidden-until-focused skip link as the first child of `<body>`, change the wrapper at `:35` to `<main id="main">`, and remove the now-nested `<main>` from the three page components. | S |
| **F-06** `[manual]` | a11y — SC 2.2.1 (A) / UX | `frontend/components/AddRecommendationForm.tsx:96-116` | The dedupe recovery — the "+1 it instead" action from US2's acceptance criteria — exists **only** inside a Sonner toast, which auto-dismisses (default ~4 s). | The single most important recovery path in the add flow vanishes on a timer, with no way to extend it. Keyboard users must reach the toast before it disappears; screen-reader users may never reach it at all. | Move the duplicate outcome into inline form state (an alert region with a persistent "+1 the existing one" button), or use a `Dialog`. Keep the toast as a bonus, not the mechanism. | M |
| **F-07** `[manual]` | SEO / distribution | `frontend/app/layout.tsx:22-25`; build output | Only `title` + `description` are set, globally. Verified in the build: all five HTML files ship `<title>WhoDoYaUse</title>`; no `og:*`, no `twitter:*`, no `canonical`, no JSON-LD, no `metadataBase`; `out/robots.txt` and `out/sitemap.xml` do not exist. | The GTM channel is **Facebook posts** (PRD §4, Dana the Admin). Every link a founder or admin shares renders as a bare URL with no title, image or description — measurably worse click-through on the one channel that matters. Distinct pages are also indistinguishable in browser tabs and history. | Add `metadataBase` + `openGraph`/`twitter` defaults in `layout.tsx`, a static `app/opengraph-image.png`, and per-page `metadata`. Note: `/browse`, `/recommend`, `/signin` are `'use client'` and **cannot** export `metadata` — each needs a small server `layout.tsx` wrapper. Add `app/robots.ts` and `app/sitemap.ts`. | M |
| **F-08** `[manual]` | Back end — perf | `backend/src/routes/recommendations.py:338-348` | `search()` builds `select … where search_vector @@ websearch_to_tsquery(…) order by …` with **no `LIMIT`**. `list_by_category()` paginates (`:301-308`); search does not. | An unbounded result set is serialised into a single Lambda response. Worse: `SearchAutocomplete.tsx:149` fires this same unbounded query on every debounced keystroke ≥2 chars, and `browse/page.tsx:168` fires it *again* on submit — so a two-word search runs 3–6 full-table FTS scans. | Add `limit %s offset %s` to `search()` reusing `parse_pagination`, and cap the autocomplete at `?limit=5`. | S |
| **F-09** `[manual]` | Back end — search quality | `backend/src/routes/recommendations.py:338`; `frontend/components/SearchAutocomplete.tsx:134-169` | `websearch_to_tsquery('english', q)` does **no prefix matching**. `to_tsvector` stores `plumber`; the query `plumb` produces the lexeme `plumb`, which does not match. | The autocomplete opens at 2 characters, so for most of the typing session it returns zero business suggestions — the user sees only the client-side category substring match and concludes the site is empty. For a search-first product this directly suppresses the activation metric. | Append `:*` to the final lexeme (`to_tsquery` with a sanitised prefix term) for the autocomplete path, or add a `pg_trgm` GIN index on `business_name` and `ILIKE '%q%'` as a fallback when FTS returns nothing. | M |
| **F-10** `[manual]` | Back end — reliability | `backend/src/auth.py:16-20` | `PyJWKClient` is constructed with defaults. Verified from the installed PyJWT signature: **`timeout=30`**, `lifespan=300`. The Lambda timeout is 10 s (`template.yaml:12`). | A slow or hung Supabase JWKS endpoint blocks the request past the Lambda timeout — the caller gets an opaque 502/timeout, not a clean 401/503, and CloudWatch records a `Duration` spike with no `ERROR` line. Also: the comment at `:12` and MILESTONE_1.md both say "fetch once per cold start", but `lifespan=300` means a synchronous HTTPS round-trip is paid inside a request every 5 minutes. | `PyJWKClient(uri, timeout=3, lifespan=3600)` and correct the comment. | S |
| **F-11** `[manual]` | CI / quality gate | `frontend/package.json:9`; repo root | `"lint": "next lint"` — `next lint` was **removed in Next 16**, so `pnpm lint` fails with `Invalid project directory provided, no such directory: …/frontend/lint` (reproduced). There is no `eslint.config.*`, no `.eslintrc*`, and ESLint is not in `devDependencies`. No `typecheck` script. `.github/` does not exist. `SuggestEditDialog.tsx:49` carries an `eslint-disable-next-line react-hooks/exhaustive-deps` for a rule that nothing enforces. | Zero automated quality gate on the front end. `tsc --noEmit` passes today but nothing keeps it passing; the back end's 75 tests only run when someone remembers. | Add `eslint` + `eslint-config-next` + `eslint-plugin-jsx-a11y`, an `eslint.config.mjs`, `"lint": "eslint ."`, `"typecheck": "tsc --noEmit"`, and one GitHub Actions workflow running lint + typecheck + `uv run pytest`. | M |

### Medium

| ID | Area | File:line | Issue | Impact | Fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| **F-12** `[axe]` | a11y — SC 1.4.3 (AA) | `frontend/components/marketing/TrustStrip.tsx:37`; `frontend/app/page.tsx:52`; `frontend/app/recommend/page.tsx:29`; `frontend/components/marketing/HowItWorks.tsx:25` | Every section eyebrow fails AA. axe-confirmed: `#8a9a8f` **2.74:1** on cream and **2.91:1** on `#fffdf9`; `#6f9079` **3.06:1** on `#e9f1ea`. All 13.5 px bold. Needs 4.5:1. | Four section eyebrows — "Word of mouth, organized", "Browse by category", "Pay it forward", "How it works" — are below the AA floor. These are the labels that orient a first-time visitor through the landing page. | Darken to ~`#5f6d64` (the existing `--muted-foreground`, 5.05:1) and use the token rather than a hex. Note `#6f9079` sits on the green-tinted `#e9f1ea` band, so it needs its own token or a darker shared one. | S |
| **F-13** `[axe]` | a11y — SC 1.4.3 (AA) | `frontend/components/RecommendationCard.tsx:291, 352, 454`; `frontend/components/CategoryGrid.tsx:53`; `frontend/components/CategoryChips.tsx:33` | `#7a887f` on white = **3.71:1**, on the quote surface `#f1f6f1` = **3.39:1**. `#6a786f` on cream = **4.30:1**. All used at 12.5–13.5 px. | The "recommends" bridge line, the note attribution ("— Mike R."), "Suggest an edit", and every category count fail AA. These carry the trust framing that *is* the product. | Replace with `text-muted-foreground` (`#5f6d64`, 5.05:1 on cream / 6.4:1 on white). | S |
| **F-14** `[manual]` | a11y — SC 1.4.11 (AA) | `frontend/app/globals.css:44-45` | `--border` / `--input` = `#d4e1d8`: **1.35:1 on white, 1.25:1 on cream**. The chip border `rgb(21 73 63/.25)` (`CategoryChips.tsx:28`) composites to **1.55:1**. UI component boundaries need 3:1. | Form fields on `/recommend`, `/signin` and the Suggest-an-edit dialog have effectively no perceivable boundary; unselected category chips likewise. | Darken `--input` to ~`#9db0a4` (3.0:1) while leaving `--border` for decorative dividers, and raise the chip border to `/.45`. | S |
| **F-15** `[manual]` | a11y — SC 2.5.8 (AA, 2.2) | `frontend/components/layout/Navbar.tsx:50`; `frontend/components/layout/Footer.tsx:29, 95`; `frontend/components/RecommendationCard.tsx:382, 454` | Measured in Chrome: **19 targets under 24×24 px**. Desktop nav links 93×**23**, 81×23, 132×23, 43×23; all 12 footer links 254×**22**; legal links 46×**20**. Card controls "Show N more notes" and "Suggest an edit" are ~18–21 px tall and are not inline in a sentence, so the SC 2.5.8 inline exception does not apply. | Fails the 2.2 target-size minimum; a real problem given PRD §7 notes traffic is mobile-first from Facebook. | Add `py-1` (nav), `py-1.5` (footer) and `py-1.5` to the two card controls. Cheap and non-visual. | S |
| **F-16** `[manual]` | a11y — SC 4.1.3 (AA) | `frontend/app/browse/page.tsx:263-267` | The only live region is `<p aria-live="polite">` that is **conditionally rendered together with its content** (`mode === 'search' && !loading && !error`). A live region inserted into the DOM with content already in it is generally not announced. There is no announcement at all for category browse, for "Loading…", or for the error state. | Screen-reader users get no feedback that a search completed or how many results arrived — the core interaction of the product is silent. | Render the `<p aria-live="polite">` unconditionally (empty when idle) and write text into it for all four states: loading, N results, zero results, error. | S |
| **F-17** `[manual]` | UX — dead capability | `frontend/app/browse/page.tsx:168, 196-203, 256-260` | The API supports `GET /recommendations/search?q=…&category=…` (`recommendations.py:342-344`) but the UI never sends a category: `searchRecommendations(q)` at `:168` passes one argument, and `browseCategory` at `:200-203` navigates to `category=…` alone, **discarding `q`**. `CategoryChips` `selected` is forced to `null` in search mode (`:258`). | A user who searches "leak" and then clicks "Plumber" — the single most natural refinement — silently loses their query and gets an unrelated list. A built, tested back-end capability is unreachable. | **Resolved differently than first proposed.** Composing the two was implemented, then reverted on the product owner's call: tapping a category means "show me everything in this category", so it clears `?q=`, and running a search clears `?category=`. Search and browse are mutually exclusive modes, symmetric in both directions, with exactly one param ever in the URL. The API keeps its `q`+`category` support (still tested) for a future "filter within these results" control — which would be a separate affordance, not the category chips. | M |
| **F-18** `[manual]` | Data integrity / abuse | `backend/src/routes/recommendations.py:41-51, 106-111`; `db/migrations/001_init.sql:5` | `_full_name()` reads `first_name`/`last_name`/`name` straight from JWT `user_metadata` — which the client controls via `supabase.auth.updateUser({data:{…}})` — and writes it into `app_user.display_name` (`text`, unbounded) with **no length check and no sanitisation**. Every other user string in the module is length-checked. | Two problems: (a) any user can set a multi-megabyte display name, which is then embedded in every `json_agg` note payload on every card; (b) a user can name themselves after a real neighbor or "WhoDoYaUse Admin" — impersonation on a product whose entire value proposition is attributed trust. | Add `DISPLAY_NAME_MAX = 80`, truncate in `_full_name`, strip control characters. Impersonation is a policy question worth raising before launch. | S |
| **F-19** `[manual]` | Routing / SEO | `infra/hosting.yaml:90-94` | `CustomErrorResponses` maps S3 **403 → 200 + /index.html**. The viewer-request function (`:28-37`) appends `.html` to any dotless path, so `/plumbr` becomes `/plumbr.html` → 403 → the homepage with HTTP **200**. The build *does* emit a real `out/404.html`, which is therefore never served. | Every typo'd or stale URL is a soft 404: search engines index duplicates, and users see the homepage with no indication anything went wrong. The comment "Harmless for M1's single page" is now stale — there are four routes. | Point the 403 rule at `/404.html` with `ResponseCode: 404`. Keep 200/index.html only if a client-side router genuinely needs it — with static export it does not. | S |
| **F-20** `[manual]` | Next.js — hydration | `frontend/app/recommend/page.tsx:16-24` vs `frontend/app/browse/page.tsx:339-348` | `RecommendPage` reads `window.location.search` inside a `useState` initialiser. That initialiser runs during the hydration render (where `window` exists) but the prerendered HTML was built with `''`, so arriving at `/recommend?category=Plumber` renders a different `SelectValue` on client vs server. `/browse` solves exactly this with a `mounted` gate and an explicit comment; `/recommend` does not. | Hydration mismatch on the deep link that the browse page's own "Recommend a pro" CTA generates (`browse/page.tsx:66-68`). The codebase disagrees with itself about a problem it already diagnosed. | Apply the same `mounted` gate, or read the param in a `useEffect` and `setCategory`. | S |
| **F-21** `[manual]` | Bundle / CWV | `frontend/components/AnalyticsProvider.tsx:4`; `frontend/lib/analytics.ts:1`; `frontend/components/AuthProvider.tsx:4` | `posthog-js` and `@supabase/supabase-js` are statically imported from the root layout, so both load on every page including the marketing landing page. Largest chunks in `out/`: 251 KB, 237 KB, 222 KB uncompressed (~1.5 MB total JS). PostHog is only needed after first paint; Supabase only when a session is read. | Slower LCP/INP on the page that has to convert a cold Facebook visitor. Compounded by every one of the 22 `data-reveal` sections being `opacity: 0` until JS runs (`globals.css:126-129`) — nothing below the hero is visible pre-hydration. | `await import('posthog-js')` inside `initAnalytics()`; consider deferring `AnalyticsProvider` behind `requestIdleCallback`. Measure before/after; don't guess. | M |
| **F-22** `[manual]` | Observability gap | `frontend/package.json` (whole); vs `CLAUDE.md` "Errors: Sentry (frontend)" and ARCHITECTURE §8 "Sentry on frontend from day one" | No `@sentry/*` dependency and no Sentry reference anywhere in `app/`, `components/`, `lib/`. | The locked architecture's only front-end error channel does not exist. Client-side failures — the CORS/hydration/session class of bug most likely to break this app — are invisible. Per the repo's own rules this is a silent divergence from a reference doc that should have been flagged. | Either install `@sentry/nextjs` or amend ARCHITECTURE §8 to record the deliberate deferral. Don't leave the docs lying. | S |
| **F-23** `[manual]` | Product / trust | `frontend/components/marketing/HowItWorks.tsx:6, 15-16`; `frontend/components/marketing/Hero.tsx:20` | Step 1 says "Set your neighborhood" (no such feature); step 3 says "Book with confidence… Message or book in a tap" (booking and messaging are PRD §7 explicit non-scope, and FRONTEND.md says "Challenge any request to build booking"). The hero eyebrow hardcodes the neighborhood name "Magnolia". | A first-time visitor is told they can message and book, then can only search and +1. That expectation gap is exactly the kind of thing that poisons the 7-day-return metric M4 is trying to measure. FRONTEND.md anticipated this and the copy shipped anyway. | Rewrite step 3 to the real action: "Call them, then vouch for the ones you'd send next door." Rewrite step 1 to drop the neighborhood setting. Move "Magnolia" to a constant if it must stay hardcoded. | S |
| **F-24** `[manual]` | Trust / legal | `frontend/components/layout/Footer.tsx:14, 20-23, 26, 92-98` | Pricing, About, Careers, Blog, **Privacy, Terms, Cookies** all `href="/"`. Eleven of sixteen footer links go nowhere. | The product collects email addresses and publishes user-attributed content, and its Privacy and Terms links are decoys. On a trust-branded product, dead legal links are worse than absent ones. | Delete the marketing-only columns for the MVP (FRONTEND.md: "Keep marketing-only sections as static content or omit"). Ship a real one-page privacy notice before M3. | S |
| **F-25** `[manual]` | Design system consistency | `frontend/app/globals.css:6-52` vs 30+ hardcoded hexes across `components/` | Tokens are properly defined, then bypassed. Greys in play: `#7a887f`, `#6a786f`, `#8a9a8f`, `#52635a`, `#42564c`, `#3c4b44`, `#22332c`, `#33433b`, `#6f9079` — nine one-off values where `--muted-foreground` and `--foreground` would do. Surfaces `#eaf3ee`, `#f1f6f1`, `#f6faf5`, `#e9f1ea`, `#fffdf9` duplicate `--secondary`/`--muted`. `#15493f`, `#ffc23d`, `#b00020` are re-typed instead of `primary`/`amber`/`destructive`. Focus rings use three different recipes: `ring-2 ring-ring`, `ring-[3px] ring-ring/50` (shadcn), and `ring-2 ring-[#ffc23d] ring-offset-2` (hand-written). | Fixing F-04, F-12, F-13 means editing ~30 call sites instead of three token values. This is the single biggest maintenance tax in the front end. | Add `--ink-muted`, `--surface-quote`, `--surface-tint` tokens; sweep the hexes; standardise one focus-ring utility. Mechanical, high leverage. | M |
| **F-26** `[manual]` | API contract consistency | `frontend/lib/api.ts:64-96` vs `:104-257` | Read helpers **throw** (`getCategoryCounts`, `getRecommendations`, `searchRecommendations`); write helpers **return result unions** (documented at `:104-107` as a deliberate fix after throws stranded disabled buttons). Reads still have the original hazard: `SearchAutocomplete.tsx:166` swallows errors with `.catch(() => {})`, and `page.tsx:32-34` with a bare comment. | Two error idioms in one 257-line module. The reason writes were changed applies to reads too — a failed autocomplete is silently indistinguishable from "no results", which is exactly the signal US1 cares about. | Converge on the result-union style for reads as well, or at minimum document why the split is intentional at the top of the file. | M |
| **F-27** `[manual]` | Type safety at the boundary | `frontend/lib/api.ts:67, 82, 95, 120, 151` | `return res.json()` is implicitly typed as `Recommendation[]`/`CategoryCount[]` with **no runtime validation**; `(await res.json()).endorsement_count` is `any`. Credit where due: the app code contains zero `any`, `as any`, or `@ts-ignore` — the gap is purely at the network seam. | A back-end shape change (e.g. renaming `endorsement_notes`) type-checks clean and fails at render with a stack trace no one sees (F-22: no Sentry). | A ~30-line hand-written `parseRecommendation()` guard is enough; a schema library is overkill at this scale. | S |
| **F-28** `[manual]` | Config consistency | `frontend/lib/supabase.ts:9-10` vs `frontend/lib/api.ts:5-8` | `api.ts` throws a clear message when `NEXT_PUBLIC_API_BASE` is missing; `supabase.ts` uses `!` non-null assertions, so a missing Supabase URL/key surfaces as an opaque `createClient` failure at first auth use. | Same class of misconfiguration, two very different debugging experiences — and the auth one fails later and more confusingly. | Apply the `api.ts` pattern in `supabase.ts`. | S |
| **F-29** `[manual]` | Docs / onboarding | repo root | **`README.md` does not exist**, despite being listed in `docs/MILESTONE_1.md` §"Files to create". The category seed list is duplicated by hand in `frontend/lib/categories.ts:3` and `backend/src/categories.py:3` (both acknowledge it), with no test asserting they match — a drift produces a 400 `unknown category` with no user-facing recovery in `AddRecommendationForm`. | New-contributor (or second-founder) onboarding depends entirely on CLAUDE.md, which is written for Claude rather than for a human running the stack. CLAUDE.md itself is excellent and accurate. | Add a short README (prereqs, `uv sync`/`pnpm install`, the four commands, where env vars come from). Add a one-line test that the two category lists are equal, or generate one from the other at build. | S |

### Low

| ID | Area | File:line | Issue | Impact | Fix | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| **F-30** `[axe]` | a11y — SC 1.3.1 / 2.4.6 | `frontend/app/signin/page.tsx:84-86`; `frontend/components/ui/card.tsx:31-39` | `/signin` has **zero headings of any level** — confirmed in-browser: `querySelectorAll('h1,h2,h3')` returns `[]`, and axe raises `page-has-heading-one`. Its apparent title ("Create your account") is a `<CardTitle>`, which renders a `<div>` (`card.tsx:31-39`). | The auth page — the one every contributor must pass through — has no heading structure at all. Combined with F-07 (all pages share the title "WhoDoYaUse"), a screen-reader user has no way to identify where they are. | `<CardTitle asChild><h1>…</h1></CardTitle>`, or give `CardTitle` an `as` prop. Worth auditing the other three `CardTitle` uses at the same time. | S |
| **F-31** `[manual]` | a11y — ARIA hygiene | `frontend/components/AddRecommendationForm.tsx:179, 191`; `frontend/components/SearchAutocomplete.tsx:232` | `aria-controls="contact-details"` points at an element that only exists while expanded. `aria-controls={listboxId}` is always present though `Suggestions` returns `null` when empty (`:52`), so `aria-expanded="true"` can coexist with no listbox. | Dangling IDREFs; minor AT confusion. The combobox otherwise follows the APG pattern correctly (roles, `aria-activedescendant`, arrow/Escape handling, `onMouseDown` before blur — all right). | Render the panel always and toggle `hidden`; drive `aria-expanded` off `suggestions.length > 0 && open`. | S |
| **F-32** `[manual]` | Security — link safety | `backend/src/routes/recommendations.py:75-80`; `frontend/components/RecommendationCard.tsx:233-238, 400-412` | `_normalize_url` only prepends `https://` when `"://"` is absent — there is **no scheme allow-list**. Any URL a recommender types is rendered as a card link labelled "Website"/"Social". Verified mitigations: React 19.2.7 *does* neutralise `javascript:` hrefs, and external links correctly use `rel="noopener noreferrer"`, so this is **not** script execution. `phone`/`email` are interpolated unvalidated into `tel:`/`mailto:`. | A recommender can point "Website" at a phishing page that inherits a neighbor's attributed trust — the highest-value abuse vector for this specific product. `mailto:` values with `?bcc=…&body=…` can pre-populate a victim's mail client. | Allow-list `http`/`https` server-side and reject the rest; strip `?`/`#` from `mailto:` and non-dial characters from `tel:`. | S |
| **F-33** `[manual]` | Logging — PII | `backend/src/routes/recommendations.py:522-526` | `EDIT_SUGGESTION` prints the submitter's user id **and the full proposed payload** (phone, email, contact name) to CloudWatch. `ZERO_RESULTS` at `:352` logs raw user queries. | Personal contact data lands in logs with default (indefinite) retention, outside the DB where it's actually governed. The durable record already exists in `edit_suggestion` — the log adds exposure, not information. | Log only `rec`, `by`, and the *keys* of `proposed`. Set a CloudWatch `RetentionInDays` on the log group in `template.yaml`. | S |
| **F-34** `[manual]` | Back end — correctness | `backend/src/routes/recommendations.py:427-443` | `unendorse()` never checks the recommendation exists; a random valid UUID returns `200 {endorsement_count: 0}`. `delete_note()` (`:446-459`) behaves the same. | Cosmetic — no data risk, and idempotency is deliberate — but "200 OK" for a nonexistent resource is an inconsistent contract next to `endorse()`, which does return 404 via `ForeignKeyViolation`. Flagging as **possibly intentional**: is the idempotent-200 the desired contract, or should these 404 like `endorse`? | Decide and document one way in ARCHITECTURE §5. | S |
| **F-35** `[manual]` | Analytics fidelity | `frontend/components/AuthProvider.tsx:17-29`; `frontend/components/AddRecommendationForm.tsx:104` | `isNewSignup` writes the user id to `localStorage` **before** the age check (`:21` precedes `:22-23`), so a user whose `created_at` is missing or stale is permanently marked "seen" and can never fire `signup`. It also returns `false` outright when `localStorage` is unavailable (private mode) — documented, but it means signups are structurally undercounted. Separately, `recommendation_added`→`endorsement_added` from the dedupe path omits the `has_note` prop that `RecommendationCard.tsx:108` always sends. | `signup` is one of the seven PRD §9 events and feeds Gate 2. It will read low, on top of the known ad-blocker undercount. Inconsistent props make the PostHog funnel harder to slice. | Move the `localStorage` write after the age check; add `has_note: false` to the dedupe capture. | S |
| **F-36** `[manual]` | Ops | `backend/samconfig.toml:11` | `disable_rollback = true`. | A failed `sam deploy` leaves the stack in `UPDATE_FAILED` rather than reverting, which for a solo deployer with no staging environment (ARCHITECTURE §7: "one (prod) for MVP") means a broken API until someone manually recovers. Reasonable while iterating on Gate 1; risky once real users exist. | Flip to `false` before M3. | S |
| **F-37** `[manual]` | Dead code / UX polish | `frontend/package.json:17`; `frontend/app/globals.css:101` + `frontend/components/layout/Navbar.tsx:30` | `next-themes` is a dependency but is imported nowhere — `ui/sonner.tsx:12` explicitly says it was skipped. Separately, `html { scroll-behavior: smooth }` plus a `sticky` header with no `scroll-margin-top` on `#how`/`#categories`/`#pros` means anchor targets land underneath the header. | Unused dependency in the bundle graph; anchor navigation from the nav bar lands ~68 px off-target. | Remove `next-themes`; add `scroll-mt-20` to the three anchored sections. | S |

---

## 4. Quick wins (each under ~30 minutes)

| # | Finding | Change |
| --- | --- | --- |
| 1 | F-03 | Add `focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2` to the hero search form (`SearchAutocomplete.tsx:254`). Restores keyboard visibility on the product's primary control. |
| 2 | F-01 | Pass `emailRedirectTo` in `signInWithOtp` (`AuthProvider.tsx:109-118`) + allow-list the URL in Supabase. Unblocks the contribution funnel. |
| 3 | F-05 | Skip link in `layout.tsx`; change `<div className="flex-1">` to `<main id="main">` and drop the nested `<main>`s. |
| 4 | F-12 / F-13 | Swap `#8a9a8f`, `#7a887f`, `#6a786f` for `text-muted-foreground`. Nine call sites; clears three AA text-contrast failures. |
| 5 | F-15 | `py-1` on nav links, `py-1.5` on footer links and the two card text-buttons. Clears 19 of the 19 undersized targets. |
| 6 | F-10 | `PyJWKClient(uri, timeout=3, lifespan=3600)` — one line, removes a timeout cliff and a per-5-minute network round-trip from the auth path. |
| 7 | F-08 | Add `LIMIT`/`OFFSET` to `search()` and `?limit=5` to the autocomplete call. |
| 8 | F-19 | Change the CloudFront 403 rule to `/404.html` + `ResponseCode: 404`. |
| 9 | F-18 | `DISPLAY_NAME_MAX = 80` + truncate in `_full_name`. |
| 10 | F-16 | Render the `aria-live` paragraph unconditionally and write all four states into it. |
| 11 | F-11 (partial) | Fix the `lint` script and add `"typecheck": "tsc --noEmit"` — the full ESLint/CI setup is larger, but stopping `pnpm lint` from erroring is minutes. |
| 12 | F-37 | `pnpm remove next-themes`; add `scroll-mt-20` to `#how`, `#categories`, `#pros`. |

---

## 5. Suggested remediation order

**Stage 1 — before anything is shown to a real group (hours).**
F-01, F-02, F-18, F-24. Rationale: F-01 breaks the funnel M2 exists to prove, so every metric
collected before it is fixed is contaminated. F-02 and F-18 are the two ways a public launch
can go wrong in a way you cannot undo. F-24 is a legal-surface question that should not be
discovered by a user.

**Stage 2 — accessibility floor (half a day).**
F-03, F-05, F-04, F-12, F-13, F-15, F-14, F-16, F-30, F-31. Rationale: F-03 and F-05 are the
two that make the product unusable rather than merely non-conformant, so they lead. Do F-04
before F-12/F-13 — fixing the ring token first means the text-colour sweep and the token sweep
touch the same files once. F-25 (the token cleanup) is the natural vehicle for the whole
group; consider merging them into one pass.

**Stage 3 — search actually working (a day).**
F-08, F-09, F-17. Rationale: these three are one story — the product is a search product and
today it silently returns nothing for partial words, cannot combine a query with a category,
and scans unbounded. Fix them together and re-baseline `search_zero_results` afterwards,
because F-09 alone will move that number and you don't want to misread it as a supply signal
(PRD §10 treats it as exactly that).

**Stage 4 — distribution and observability (a day).**
F-07, F-22, F-19. Rationale: F-07 multiplies every share Dana makes, and there is no point
optimising the funnel before the top of it renders correctly on Facebook. F-22 should land
before traffic arrives, not after — the first real bug report will otherwise be a screenshot.

**Stage 5 — engineering hygiene (a day, do it once traffic is live and you're editing under
pressure).** F-11, F-25, F-26, F-27, F-28, F-29, F-20, F-21. Rationale: all real, none
user-visible. F-11 first so the rest is enforced; F-25 next because it unblocks cheap design
changes for the rest of the MVP.

**Stage 6 — defer deliberately.** F-32, F-33, F-34, F-35, F-36, F-37. Small, and none of them
change what M4 can conclude.

---

## 6. Open questions for you

1. **F-34** — is the idempotent `200` on `unendorse`/`delete_note` for a nonexistent id the
   intended contract, or should they 404 like `endorse` does? I did not want to assume.
2. **F-23** — is the "Book with confidence / message or book in a tap" copy a deliberate
   aspirational placeholder from the design reference, or an oversight? FRONTEND.md explicitly
   anticipates this tension, which makes me think it may be intentional.
3. **F-18** — display-name impersonation: is "any signed-in user can call themselves anything"
   an accepted risk for a single seeded neighborhood, or does it need a check before M3?
4. **F-07** — is SEO in scope at all? The PRD's GTM is Facebook groups, so indexing may be
   genuinely irrelevant — but Open Graph tags are not SEO, they're the share card on your only
   distribution channel, and I'd argue those are in scope regardless.
5. **F-02** — how do you intend to remove a bad recommendation today? If the answer is "SQL
   editor", that's a defensible MVP answer; I'd just want it written down before launch rather
   than discovered during it.

---

## 7. Carrying the standard forward (from `docs/review-prompt.md`)

The prompt doc closes with: *"Worth adding to CLAUDE.md once the review settles: the design
system tokens, the a11y bar (WCAG 2.2 AA), the API error contract, and the testing
expectations. That way future Claude Code sessions build to the standard instead of drifting
and getting re-reviewed."*

That is the highest-leverage item in this whole report, because it is the only one that stops
the findings above from recurring. Concretely, once the fixes land, CLAUDE.md should gain:

1. **Design tokens as law.** "Use tokens from `app/globals.css`; do **not** write hex literals
   in components." F-25 documents nine one-off greys and five duplicate surfaces that exist
   purely because this rule was never written down. A single line in CLAUDE.md would have
   prevented most of §3's Medium tier.
2. **The a11y bar: WCAG 2.2 AA, with the three rules that were actually broken here** — every
   interactive element keeps a visible focus indicator at ≥3:1 (F-03, F-04); text ≥4.5:1
   (F-12, F-13); targets ≥24×24 px (F-15). Generic "be accessible" guidance would not have
   caught any of these; these three specifics would have caught eight findings.
3. **The API error contract**, which the back end already follows consistently
   (`{error:{code,message}}`) — worth recording so it stays that way, along with the
   read-throws/write-returns split in `lib/api.ts` that currently disagrees with itself (F-26).
4. **Testing expectations.** Today: 75 back-end tests, zero front-end. State the floor —
   e.g. "new API routes ship with handler tests; new interactive components ship with an axe
   assertion" — so the asymmetry is a decision rather than an accident.
5. **One correction to make in the docs themselves:** ARCHITECTURE §8 and CLAUDE.md both
   promise Sentry on the front end from day one; it is not installed (F-22). Either install it
   or amend the doc — a reference doc that is quietly untrue is worse than no doc, and the
   repo's own rules say to flag divergence rather than let it stand.

### Suggested follow-ups (adapted from the doc, now that findings have IDs)

- `Read REVIEW.md. Fix every Critical and High finding in the accessibility section (F-03,
  F-04, F-05, F-06). One commit per finding, with the finding ID in the commit message. Show
  me the diff before committing.`
- `Read REVIEW.md §3.0. Add axe-core to CI against all four built routes — and make sure the
  job force-reveals [data-reveal] elements first, or it will report a false pass.`
- `Read REVIEW.md. For F-06 (toast-only dedupe recovery) and F-17 (category+query), propose
  two alternative designs each and explain the tradeoffs. Don't implement yet.`
- `Read REVIEW.md §7. Draft the CLAUDE.md additions — tokens, a11y bar, error contract,
  testing floor — as a diff for me to approve.`
