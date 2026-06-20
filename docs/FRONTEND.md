# Frontend Design System — Neighborhood Recommendations

> Reference doc for Claude Code. Governs all frontend work. Read alongside CLAUDE.md
> and docs/MILESTONE_N.md. Aesthetic direction is **inspired by Fresha**
> (https://www.fresha.com) — clean, trustworthy, local-marketplace feel — adapted to a
> 2-person validation MVP. This is DIRECTION, not a pixel-clone mandate. Match complexity
> to the milestone: M1 is a bare shell; real styling effort lands in M2.

## Tech (locked)

- Next.js, **static export** (`output: 'export'`). UI only — never the backend.
- **Tailwind CSS** for all styling. No CSS-in-JS, no styled-components.
- **shadcn/ui** for primitives where a primitive exists (Button, Input, Card, Dialog,
  Select, Badge, Skeleton, Toast/Sonner, DropdownMenu, Form). Compose these; do not
  hand-roll equivalents. Build custom components only for things shadcn doesn't cover
  (e.g. the recommendation card, the search hero).
- Icons: lucide-react.
- Fonts: load via `next/font`.

## How to capture the Fresha direction accurately

Before finalizing tokens, **inspect the live site yourself** rather than guessing:

1. Use the Claude-in-Chrome browser tools (or ask the user to paste values) to open
   https://www.fresha.com and read the computed primary color, font families, border
   radii, and spacing rhythm from the rendered page / its CSS.
2. Translate what you observe into the token system below. If you cannot inspect it,
   use the documented starting tokens and flag that they are approximations to confirm.

## Observed Fresha design language (direction to emulate)

- **Clean, photo-forward, generous whitespace.** Lots of breathing room; content sits on
  a light/white canvas. Not dense, not "dashboard-y."
- **Prominent search as the hero.** The primary action on the landing surface is a large,
  inviting search control. Mirror this: search is the centerpiece of the recommendations
  experience.
- **Rounded, soft cards** with subtle shadows for list items / results. Friendly, not sharp.
- **Trust & social proof patterns** — ratings, reviewer names, location, counts. Our analog
  is endorsement counts + the recommender's name (the "from your neighbors" trust signal).
- **Confident single accent color** used for primary actions; otherwise restrained, mostly
  neutral palette. Spend boldness on the primary CTA and the search, keep the rest quiet.
- **Modern geometric sans typography**, medium weights, clear hierarchy. Not a serif display.
- **Mobile-first.** Facebook-group traffic is overwhelmingly mobile; design for a ~380px
  viewport first, then scale up.

## Token system (starting point — verify against the live site, then lock)

Define these as CSS variables in `globals.css` and map them in `tailwind.config`. Replace
the hex/scale values once you've inspected Fresha; the _roles_ below stay fixed.

```
Color (roles — set exact values after inspection):
  --background      near-white canvas            e.g. #FFFFFF
  --foreground      near-black text              e.g. #1A1A1A
  --muted           soft grey surfaces           e.g. #F4F5F7
  --muted-foreground secondary text              e.g. #6B7280
  --border          hairline card/input borders  e.g. #E5E7EB
  --primary         single confident accent      (sample from Fresha's CTA)
  --primary-foreground  text on primary          e.g. #FFFFFF
  --ring            focus ring                    = primary at lower opacity

Radius:
  --radius          soft, friendly                e.g. 0.75rem (cards), full for pills

Typography:
  Display/headings  geometric sans, medium/semibold  (e.g. via next/font: a clean grotesk)
  Body              same family or a neutral sans, regular
  Type scale        clear steps; large hero search label, comfortable body
  Case              sentence case everywhere (per the copy rules below)

Spacing & layout:
  Generous vertical rhythm; content max-width ~ 640–760px for lists on desktop,
  full-bleed friendly on mobile. 16px base gutters on mobile.

Elevation:
  Subtle shadows on cards (e.g. shadow-sm / a soft custom shadow). Avoid heavy drop shadows.
```

## Signature element

The one memorable thing: a **prominent, inviting search bar** as the hero of the browse/
search surface, echoing Fresha's "search your area" centerpiece — but phrased for trust
("Find a trusted local pro your neighbors recommend"). Everything else stays quiet so this
and the primary "Add a recommendation" CTA carry the personality.

## Component inventory (MVP — build only what the current milestone needs)

- **AppShell / header** — logo/wordmark, sign-in/out, minimal nav.
- **SearchHero** — large search input + category chips. The signature element.
- **CategoryChips / CategoryGrid** — browse entry points (from the app-side seed list).
- **RecommendationCard** — business name, category badge, recommender name, endorsement
  count, optional note, "+1" action. The trust-signal workhorse.
- **AddRecommendationForm** — shadcn Form + Input + Select(category) + Textarea(note);
  dedupe "+1 instead?" handled via a Dialog/Toast.
- **EmptyState / ZeroResults** — directive, not moody (see copy rules).
- **Loading** — shadcn Skeleton for lists; never block the whole screen.

Do NOT build: ratings/stars UI, business-owner profiles, messaging, multi-neighborhood
switching, dark mode (unless trivial via tokens), elaborate animations.

## Copy rules (design material, not decoration)

- Sentence case throughout. Plain verbs. No filler.
- Name things by what the user does: "Add a recommendation," "Search," not system terms.
- An action keeps its name through the flow: a "Add" button → toast "Recommendation added."
- Zero-results is an invitation: "No recommendations for plumbers yet — be the first to add
  one." Not an apology.
- Errors say what happened and how to fix it, in the interface's voice.

## Quality floor (non-negotiable, build it in quietly)

- Responsive from ~380px up; mobile-first.
- Visible keyboard focus on every interactive element (use the `--ring` token).
- Respect `prefers-reduced-motion`.
- Sufficient color contrast on text and the primary CTA.
- Semantic HTML; shadcn primitives already handle most a11y — don't undo it.

## Restraint

Spend boldness only on the search hero + primary CTA. Keep cards, forms, and chrome quiet
and consistent. Before shipping a screen, remove one decorative thing that isn't earning its
place. Do not let styling pull the project back toward over-engineering — the goal is a
clean, trustworthy surface that validates the idea, shipped fast.

```

```
