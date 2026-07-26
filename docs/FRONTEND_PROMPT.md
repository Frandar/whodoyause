# Frontend kickoff prompt (paste into Claude Code)

Use when starting frontend work for the current milestone. Assumes CLAUDE.md,
docs/FRONTEND.md, and frontend/design-reference/home.html are committed in the repo.

---

Read CLAUDE.md and docs/FRONTEND.md in full before doing anything. The frontend follows the
**WhoDoYaUse** design captured in `frontend/design-reference/home.html` (a bundled export;
a decoded, readable copy is at `frontend/design-reference/home-decoded.html`). That file is
the source of truth for look and feel — open it and match it. docs/FRONTEND.md contains the
tokens I already extracted from it (deep forest green #15493f field, gold #ffc23d accent,
cream #faf6ef surfaces; Bricolage Grotesque for display, Plus Jakarta Sans for body; pill
buttons at 999px radius, cards ~12–15px, soft green-tinted shadows). Treat docs/FRONTEND.md
as authoritative for tokens and match the reference for anything not tokenized. This is NOT
Fresha-inspired anymore — ignore any earlier Fresha references.

Stack is locked: Next.js static export (output: 'export'), Tailwind CSS driven by the
tokens, shadcn/ui for primitives (restyled with the tokens so they match the reference),
lucide-react icons, fonts via next/font (Bricolage Grotesque + Plus Jakarta Sans).

Before writing component code, show me a short build plan:
1. Confirm the token values from docs/FRONTEND.md wired into globals.css + tailwind.config
   (colors, the two fonts, radius scale, shadow scale, gold focus ring).
2. The component list you'll build for THIS milestone only (see CLAUDE.md "Current
   milestone" and the matching docs/MILESTONE_N.md).
3. One line on how you'll reproduce the signature elements — the green hero with the big
   Bricolage headline, the pill search + category chips, and the neighbor recommendation
   card (name + proximity line + "recommends [business]" + stars + usage count + quote).
Wait for my OK before writing component code.

Constraints while building:
- Implement ONLY what the current milestone needs. For Milestone 1 that is a minimal shell
  only (the /health ping + auth state) — NOT the hero/search/cards. Do not build ahead.
- The reference shows marketing/future framing ("Book with confidence", "For pros",
  "Pricing"). These are NOT MVP features. The MVP is search + recommend + endorse only.
  Do not build booking or payments. Keep marketing-only sections static or omit them.
- Mobile-first from ~380px; preserve the reference's vw-based clamp() responsive type.
- Gold focus ring on every interactive element; check contrast (sage text on green is the
  risky one). Respect prefers-reduced-motion. Don't undo shadcn a11y.
- Warm neighborly copy in WhoDoYaUse voice; sentence case; zero-result/empty states are
  directive invitations, not apologies.
- Spend boldness on the green hero + gold CTA + neighbor cards; keep the rest quiet.
- Challenge complexity before adding it; explain tradeoffs before coding. Stop at the
  milestone's gate and wait for approval.

Start by reading the docs + the reference file, then propose the build plan. Don't write
component code until I approve.

---

## Notes for you (not part of the prompt)

- The design tokens in docs/FRONTEND.md were extracted directly from your uploaded file, so
  they're real values, not guesses: brand green #15493f, gold #ffc23d, cream #faf6ef,
  Bricolage Grotesque + Plus Jakarta Sans, pill (999px) + 12–15px card radii, soft
  green-tinted shadows, gold focus glow.
- For Milestone 1 you barely need this prompt — M1 is a bare shell. The full design pass is
  a Milestone 2 activity, when the hero, search, category grid, and recommendation cards are
  actually built. Committing these files now just means the design is locked and ready.
- shadcn/ui needs `npx shadcn@latest init` then per-component `npx shadcn@latest add ...`.
  Let Claude Code run these during M2 setup; they work fine with static export.
- The reference is a marketing landing page. Your MVP app is the functional core of it:
  reuse the visual system and the hero/search/card patterns, but the app's job is
  search → see neighbor recommendations → add/endorse, not the full marketing site.
