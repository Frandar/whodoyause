# Frontend Design System — WhoDoYaUse

> Reference doc for Claude Code. Governs all frontend work. Read alongside CLAUDE.md and
> the current milestone spec. The design direction is NO LONGER Fresha — it is the
> **WhoDoYaUse** design captured in `frontend/design-reference/home.html` (a bundled
> export) and its decoded form `frontend/design-reference/home-decoded.html`. That file is
> the source of truth for look and feel. Tokens below are extracted from it; when in doubt,
> open the reference and match it. This is a 2-person validation MVP — match complexity to
> the milestone (M1 is a bare shell; real styling lands in M2). Do not let polish pull the
> project back toward over-engineering.

## Product name
The product is **WhoDoYaUse** — the literal question the app answers ("who do ya use for
an electrician?"). Use this name in the wordmark, titles, and copy. Tagline direction:
"Recommended by your neighbors, not algorithms" / "Word of mouth, organized."

## Tech (locked)
- Next.js, **static export** (`output: 'export'`). UI only — never the backend.
- **Tailwind CSS** for all styling, driven by the tokens below (define as CSS variables in
  globals.css, map in tailwind.config).
- **shadcn/ui** for primitives where one exists (Button, Input, Card, Dialog, Select,
  Badge, Skeleton, Toast/Sonner, Form, DropdownMenu). Compose these; restyle them with the
  tokens so they match the reference. Hand-build only what shadcn doesn't cover (the pro/
  recommendation card, the search hero, category tiles).
- Icons: lucide-react. Fonts: **next/font** (Google fonts — see Typography).

## Brand palette (extracted from the reference — use exactly)
Deep forest green is the brand's signature background; warm gold is the single accent.

```
--brand-green        #15493f   /* primary brand background, dark surfaces, headings on light */
--brand-green-deep   #14241e   /* darkest text / near-black on light backgrounds */
--brand-green-900    #0e2a20   /* deep shadows, gradient stops */
--accent-gold        #ffc23d   /* THE accent — primary CTA, logo mark, highlights */
--accent-gold-deep   #e3a84a   /* gold hover/pressed */
--terracotta         #cf7d63   /* secondary warm accent, used sparingly */

/* Light / cream surfaces */
--cream              #faf6ef   /* warm off-white page canvas on light sections */
--cream-alt          #fffdf9
--surface-green-050  #eaf3ee   /* pale green tint surface */
--surface-green-100  #e6efe7
--border-green-100   #c7dccf   /* hairline borders on light green surfaces */

/* Text on dark green */
--on-green           #ffffff
--on-green-muted     #9fb6ab   /* muted sage text on green */
--on-green-subtle    #7f968b

/* Text on light */
--ink                #14241e
--ink-muted          #6a786f
--ink-subtle         #7a887f

--danger             #b00020
```

Usage discipline: dark forest green and cream are the two dominant fields; **gold is spent
only on the primary CTA, the logo mark, and small highlights** (e.g. star ratings). Don't
scatter gold. Terracotta and the purple/blue tints seen in the reference are incidental —
keep them rare.

## Typography (extracted — use exactly)
Two Google fonts, loaded via next/font:
- **Bricolage Grotesque** — display/headings. Weights 600–800. Big, characterful, tight
  tracking on the hero. This is the personality face; use it for the hero, section titles,
  the wordmark, and big numbers.
- **Plus Jakarta Sans** — body/UI. Weights 600/700/800 in the reference; use 400–600 for
  running text, 600–700 for labels/buttons. All body copy, nav, cards, forms.

Type scale (from the reference):
- Hero headline: responsive `clamp(40px, 6vw, 72px)` up to `clamp(56px, 7vw, 104px)` for
  the biggest statement lines. Bricolage 700–800, tight line-height.
- Section titles: `clamp(30px, 4vw, 44px)`, Bricolage 700.
- Body: 14.5–16.5px, Plus Jakarta 400–600.
- Labels / meta / captions: 12.5–14px, Plus Jakarta 600.
- Weights in play: 600 (medium emphasis), 700 (default bold), 800 (hero / big numbers).
- Case: sentence case for copy; the wordmark is "WhoDoYaUse" camel-case.

## Shape, elevation, spacing (extracted)
- **Radius:** pills use `border-radius: 999px` (buttons, chips, search bar, badges);
  cards use `12–15px` (12, 14, 15 all appear). Default card radius ~14px; pill everything
  interactive that's a chip/CTA.
- **Shadows:** soft, green-tinted, directional. Examples from the reference:
  `0 4px 10px -4px rgba(8,30,22,.6)`, `0 8px 18px -8px rgba(8,30,22,.45)`,
  `0 12px 22px -8px rgba(8,30,22,.5)`, big hero cards `0 24px 50px -24px rgba(0,0,0,.6)`.
  Focus ring: `0 0 0 3px rgba(255,194,61,.25)` (gold glow) — reuse as the `--ring`.
- **Spacing:** generous, airy. Rounded cards float on the green or cream field with real
  padding. Mobile-first.

## Signature elements (what makes it WhoDoYaUse, not generic)
1. **Deep-green hero** with a huge Bricolage headline ("Find a local pro your neighbors
   already trust.") and an **eyebrow**: "Recommended by your neighbors, not algorithms."
2. **A prominent pill search bar** ("Find a pro") with popular-category quick chips (HVAC,
   Lawn care, Plumbing, …) directly beneath it.
3. **Neighbor recommendation cards** — the trust workhorse: neighbor's name + hyper-local
   proximity line ("Maple Street · 4 doors down"), "recommends [Business]", star rating,
   usage count ("· used 3×"), and a short quote. This proximity/trust framing is the core
   of the brand — lean into it.
4. **Social-proof stats** in Bricolage: "40,000+ neighbors across 200+ towns", "12,000
   vetted pros", "4.9★ avg", "98% would book again".
5. **"How it works" 3-step**: "Tell us what you need → See who neighbors use → Book with
   confidence" (headline: "Three steps from 'who do ya use?' to booked.").
6. **Category grid** — tiles with "[N] pros nearby" counts.

## Component inventory (MVP — build only what the current milestone needs)
- **AppShell / header** — WhoDoYaUse wordmark + gold logo mark, nav (How it works,
  Categories, Reviews, For pros), Log in, primary "Find a pro" CTA.
- **SearchHero** — green field, Bricolage headline, pill search + popular category chips.
  The signature element.
- **RecommendationCard** — neighbor name, proximity line, "recommends [business]", stars,
  usage count, optional quote, "+1"/endorse action.
- **CategoryGrid / CategoryTile** — icon, name, "[N] pros nearby" (from the app-side seed
  list; counts are dynamic later).
- **AddRecommendationForm** — shadcn Form + Input + Select(category) + Textarea; dedupe
  "+1 instead?" via Dialog/Toast.
- **StatBand** — the big Bricolage social-proof numbers.
- **HowItWorks** — 3-step strip.
- **EmptyState / ZeroResults** — directive invitations, in WhoDoYaUse voice.
- **Loading** — shadcn Skeleton for lists.

Do NOT build: ratings-authoring UI beyond the simple endorse, business-owner dashboards,
messaging, multi-neighborhood switching, "Book"/payments (the reference shows "Book with
confidence" and "For pros" — these are future/marketing framing, NOT MVP features; the MVP
is search + recommend + endorse only). Keep marketing-only sections (For pros, Pricing,
Book) as static content or omit until validated. Challenge any request to build booking.

## Copy rules
- Sentence case; warm, neighborly voice ("Word of mouth, organized"; "The advice you'd get
  over the fence — searchable"; "Made for good neighbors").
- Plain verbs; action names consistent through a flow (an "Add" button → "Recommendation
  added" toast).
- Zero-results is an invitation: "No one's vouched for a plumber on your street yet — be the
  first." Not an apology.
- Trust framing everywhere: name the neighbor and the proximity, not anonymous stars.

## Quality floor (non-negotiable)
- Mobile-first from ~380px; the reference uses `vw`-based `clamp()` type — preserve that
  responsiveness.
- Visible keyboard focus using the gold `--ring`; sufficient contrast (white/sage text on
  green, ink on cream — verify contrast ratios, especially `--on-green-muted` on green).
- Respect `prefers-reduced-motion`. Semantic HTML; don't undo shadcn a11y.

## Restraint
Spend boldness on the green hero + gold CTA + neighbor cards. Keep everything else quiet.
Match the reference; don't embellish past it. The goal is a clean, trustworthy, distinctly
"over-the-fence" surface that validates the idea, shipped fast.
