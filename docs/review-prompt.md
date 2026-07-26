# WhoDoYaUse — Claude Code Review Prompt

Drop this in the repo (e.g. `docs/review-prompt.md`) and paste the block below into Claude Code from the repo root.

---

## Main prompt (paste this)

```
You are performing a comprehensive engineering and design review of WhoDoYaUse, a
local professional recommendation web app. Next.js front end, Python AWS Lambda back end.

DO NOT modify any code. This is a read-and-report pass. Produce findings only.

## Phase 0 — Discover the stack yourself
Before reviewing anything, build an accurate picture of the project. Read:
- package.json, lockfile, next.config.*, tsconfig.json, eslint/prettier config, tailwind config
- pyproject.toml / requirements*.txt, and any serverless.yml, template.yaml (SAM), CDK or
  Terraform files
- CI workflows, Dockerfiles, .env.example, README, CLAUDE.md if present
- The directory tree (depth 3) for both front end and back end
Then write a short "Stack & Architecture" section: framework versions, router style
(App vs Pages), state management, styling approach, API surface, auth mechanism, data
store, deploy pipeline, test tooling. Flag anything you could NOT determine rather than
guessing. If a major assumption is unverifiable, say so explicitly.

## Phase 1 — Accessibility (target: WCAG 2.2 Level AA)
Audit against the standard, not vibes. Check specifically:
- Semantic HTML and landmark structure; heading order; one h1 per page
- Keyboard operability: every interactive element reachable and operable, logical tab
  order, visible focus indicators, no keyboard traps, skip-to-content link
- Focus management on route changes, modals, drawers, toasts, and async content
- Accessible names for icon-only buttons, links, and form controls; label/input association
- Form errors: programmatically associated, announced, not color-only
- Live regions for async state (search results, submissions, validation)
- Color contrast (4.5:1 text, 3:1 UI components and graphics) — evaluate the Tailwind
  palette and any hardcoded colors
- Framer Motion / CSS animation: honor prefers-reduced-motion; no parallax or auto-motion
  that can't be stopped
- Images: meaningful alt text, decorative images correctly hidden
- Touch target size (24x24 CSS px minimum per 2.2), and 200% zoom / 320px reflow
- Any custom widget implementing an ARIA pattern — verify it matches the APG spec
For each issue: WCAG success criterion number, file:line, why it fails, and the fix.

## Phase 2 — Next.js front end
- Server vs client component boundaries; unnecessary "use client"
- Data fetching, caching, and revalidation correctness; waterfalls; N+1 client fetches
- Bundle size and code splitting; heavy dependencies; dynamic import opportunities
- next/image and next/font usage; Core Web Vitals risks (LCP, CLS, INP)
- Metadata, sitemap, robots, structured data — this is a local-discovery product, so
  local SEO and per-listing metadata matter
- Error boundaries, loading states, not-found handling
- Type safety: any `any`, unsafe casts, untyped API responses, missing runtime validation
  at the network boundary
- Component design: prop drilling, god components, duplicated logic, unclear naming,
  inconsistent patterns across the codebase

## Phase 3 — Python Lambda back end
- Handler structure: thin handler, business logic in testable modules, no import-time side
  effects that hurt cold start
- Input validation and schema enforcement at every entry point
- Error handling: no leaked stack traces or internal details in responses; consistent
  error contract; correct HTTP status mapping
- Structured logging with correlation IDs; no PII or secrets in logs
- Idempotency for write paths; retry and DLQ behavior; timeout and memory sizing
- Least-privilege IAM: flag any wildcard actions or resources
- Secrets handling: Secrets Manager / Parameter Store vs env vars vs anything hardcoded
- Dependency footprint, packaging, layer usage, cold start cost
- Type hints, docstrings, module boundaries, dead code
- Data access patterns: query efficiency, injection risk, connection reuse across invokes

## Phase 4 — Security and cross-cutting
- AuthN/AuthZ: is every protected route and every Lambda enforcing authorization
  server-side, not just hiding UI?
- CORS configuration, rate limiting, abuse vectors (this app collects user-submitted
  recommendations — check for spam, injection, and stored XSS paths)
- Dependency vulnerabilities and unmaintained packages
- Secrets or keys committed to the repo or exposed via NEXT_PUBLIC_*
- PII handling and data retention

## Phase 5 — Maintainability and testing
- Test coverage by area; identify the highest-risk untested paths
- Test quality: are they asserting behavior or implementation details?
- CI: lint, type check, test, a11y check (axe/pa11y/Lighthouse) — what's missing?
- Documentation: README accuracy, onboarding friction, CLAUDE.md quality
- Consistency: naming, file organization, error handling, and API conventions across
  the codebase. Call out where the codebase disagrees with itself.

## Phase 6 — UI/UX and workflows
Walk the actual primary user journeys end to end by reading the routes and components.
For a local recommendation product, evaluate at minimum:
  (a) first-time visitor → understands the value prop → takes an action
  (b) searching / browsing for a professional → evaluating → contacting
  (c) submitting or endorsing a recommendation
  (d) any auth, onboarding, or profile flow
For each journey: list every step and required input, then flag
- Steps that could be removed, deferred, or defaulted
- Forms asking for more than is needed at that moment
- Missing empty, loading, error, and success states
- Unclear affordances, ambiguous labels, or hidden primary actions
- Trust signals — for a recommendation product, how does a user judge credibility?
- Mobile-first behavior; anything hover-dependent
- Consistency of the design system: spacing scale, type scale, color roles, button
  hierarchy, component variants. Flag one-off values that should be tokens.
- Content and microcopy: jargon, vague CTAs, unhelpful error messages

## Output format
Write findings to `REVIEW.md` at the repo root, organized as:
1. Executive summary (10 bullets max) — the things that actually matter
2. Stack & Architecture (from Phase 0), including what you couldn't verify
3. Findings table, sorted by severity: Critical / High / Medium / Low, each with
   ID, area, file:line, issue, impact, recommended fix, effort (S/M/L)
4. Quick wins — high impact, under 30 minutes each
5. Suggested remediation order with rough sequencing rationale

Rules:
- Every finding must cite a real file and line. If you can't cite it, don't claim it.
- Prefer 20 substantiated findings over 100 generic ones. No boilerplate advice that
  would apply to any repo.
- Where you're uncertain whether something is a bug or intentional, say so and ask.
- Do not fix anything yet. I'll pick what to act on from REVIEW.md.
```

---

## Notes on using it

**Run it in phases if the repo is large.** A single pass over a full-stack repo tends to go
shallow. Paste Phase 0 first, let it write the Stack & Architecture section, then run each
phase as its own prompt referencing that context. Same total work, much better depth.

**Give it a way to actually test accessibility.** Static reading catches maybe half of a11y
issues. Add to the prompt if you can run the app locally:

```
The dev server runs with `npm run dev` on localhost:3000. Install and run axe-core or
pa11y against the main routes, and include the automated results alongside your manual
review. Note which findings are automated vs. manual.
```

**Follow-up prompts once you have REVIEW.md:**

- `Read REVIEW.md. Fix every Critical and High finding in the accessibility section. One commit per finding, with the finding ID in the commit message. Show me the diff before committing.`
- `Read REVIEW.md. For the top 3 UX findings, propose two alternative designs each and explain the tradeoffs. Don't implement yet.`
- `Turn the Phase 1 accessibility checklist into a CI job that fails the build on new violations.`

**Worth adding to CLAUDE.md** once the review settles: the design system tokens, the a11y
bar (WCAG 2.2 AA), the API error contract, and the testing expectations. That way future
Claude Code sessions build to the standard instead of drifting and getting re-reviewed.
