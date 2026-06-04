# Design Spec — Standardized Bird-Name Format

**Lane:** New Feature · **Date:** 2026-06-04 · Builds on schema.md

## Guiding principle
Preserve the look users already like (Breeding Codes / Media tabs) and add the
link affordance *quietly*. A bird name should not shout — it reads as text at
rest, and reveals itself as clickable on hover/focus. Favicons and the stacked
scientific name match the existing treatment exactly.

## Layout (matches current Media/Breeding tabs)
- **Row:** `[common name] [eBird favicon][BoW favicon]` — flex, vertically
  centered. Favicons 14px, 0.75 opacity → 1 on hover, ~5px gap, ~6px after name.
- **Scientific name (when `showSci`):** a second line beneath the row, italic,
  muted (`--sr-text-gray`), ~11.5px. Stacked layout = `flex-direction: column;
  gap: 1px`.
- **Inline (no sci):** the wrapper is an inline-flex row so it flows inside a
  sentence or a pill (e.g. milestones, map popups).

## The common-name link affordance
- **Rest:** same as today — `--sr-text`, weight 500, no underline. (So compliant
  tabs look unchanged.)
- **Hover/focus (only when it's a link, i.e. `hasEntry`):** color → `--sr-accent`,
  underline, `cursor: pointer`. Visible focus ring (`outline` via accent) for
  keyboard users.
- **No entry (D1):** plain text, no hover affordance, no cursor change — but
  favicons still present. Never looks like a dead link.
- Rendered as a `<button>` styled as inline link (not an `<a>`, since it triggers
  in-app navigation), `tabIndex={0}`, `aria-label` optional (text is the label).

## Scientific-name "where there's room"
- **Stacked sci shown:** table rows (Media, Breeding, Stats wide lists), Species
  Detail sections, List Comparer panels.
- **Omitted:** milestone pills, map popups, tight inline mentions, mobile-narrow.
- The sci line uses `white-space: nowrap; overflow: hidden; text-overflow:
  ellipsis` within a `min-width:0` flex parent so it truncates, never overflows.

## Relocated-link affordance ("move the link to the number")
- The **number/count** that takes over a former name-link is styled like the
  app's existing inline links (accent, hover underline) — e.g. the media count in
  Most Photographed becomes the Macaulay Library link, visually a normal link.
- For the **map nearest-targets** pan: a small **locate icon** (lucide
  `Crosshair`/`LocateFixed`, 13px, muted → accent on hover) sits at the row end
  and carries the pan; the name carries Species Detail. (Distance text stays as
  a label.)

## Tokens / CSS classes
- `.sr-birdname` (inline-flex; `column` when sci, else `row`; `min-width:0`)
- `.sr-birdname-link` (button: `color:var(--sr-text)`, weight 500, no underline;
  `:hover/:focus-visible` → `color:var(--sr-accent)`, `text-decoration:underline`;
  focus ring; inherits font-size from context)
- `.sr-birdname-text` (plain span, `color:var(--sr-text)`, weight 500)
- `.sr-birdname-sci` (italic, `--sr-text-gray`, 11.5px, truncates)
- Sizes: `md` = 13.5px name / 11.5px sci (table default); `sm` = 12.5 / 11 for
  dense/popup contexts. Tokens only; works light + dark.

## A11y
- Name link keyboard-focusable + visible focus; favicons already labelled
  (`aria-label` in SpeciesLinks). Favicons are siblings after the name button —
  never nested inside it.

## Mockup
`design.html` (self-contained, light + dark) shows: the stacked table treatment
(matching Media/Breeding), an inline no-sci pill (milestone), a map popup, a
no-entry nemesis (plain + favicons), and a "Most Photographed" row with the
count carrying the relocated ML link — each with rest + hover states noted.
