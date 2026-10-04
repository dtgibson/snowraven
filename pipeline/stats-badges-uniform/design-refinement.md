# Design Refinement: Milestone badges (stats-badges-uniform)

Improve lane, design pass. Surface: Statistics > Firsts & Milestones, the
Milestones badge set only. Mockup: `pipeline/stats-badges-uniform/design.html`
(served at `https://hephaestus-developer.giraffe-chuckwalla.ts.net:8823/design.html`).
Designed within `pipeline/design-system.md`; no token value changes, no new
tokens, no deviation to log.

## Visual Direction

One badge, repeated. Every milestone is the same tile: same width, same height,
same padding, same internal order (threshold, species, date), set on an even
grid whose columns line up from row to row, with the last row sitting in the
same columns, left-aligned. The four tier colors and the `--sr-milestone-*`
family are unchanged, so the set reads as it does today, only regular. The
threshold is the one display-weight element per tile; the species name is the
body; the date is the caption and the link. Nothing is added: the check mark
and the stray rule are removed, and the sub-label now says what the number is.

## Screens / Views

### Statistics > Firsts & Milestones > Milestones (the only surface)

Structure, top to bottom inside the existing `SectionCard`:

1. `SubLabel` reading **Life list milestones** (the house uppercase sub-label,
   unchanged in style). The leading `Divider` is removed: it sat directly under
   the card head's own rule and double-ruled the section.
2. `<ul class="sr-ms-grid" role="list" aria-label="Life list milestones">`, one
   `<li class="sr-ms-badge" data-tier="N">` per reached threshold, in
   `MILESTONE_THRESHOLDS` order. Unreached thresholds render nothing, as today.
3. Inside each badge, in DOM and visual order:
   - `<span class="sr-ms-num">{fmt(threshold)}</span>`: the threshold with the
     tab's thousands separator (`1,000`, `2,500`).
   - `<span class="sr-ms-name"><BirdName size="sm" breakAfterSlash ... /></span>`:
     the species, with its eBird and Birds of the World marks.
   - `<span class="sr-ms-date"><ChecklistLink submissionId label={fmtDate(date)}
     style={{ color: 'var(--sr-milestone-N-date)' }} /></span>`: the date, linking
     to the checklist.

Key decisions for this screen (the brief's open choices, each with its reason):

- **Check mark: dropped.** Only reached milestones are rendered, so the mark
  carried no information; it was a hardcoded `#fff` glyph in a px circle inside
  rem padding, read aloud on every badge. The tier color and the threshold
  already say "reached". The `--sr-milestone-N-check` tokens stay (Frivolous
  Lists uses tier 1's; tiers 2 to 4 are now unused and harmless).
- **Thousands separators: yes.** `fmt(threshold)` from `lib/statsFormat.ts`, so
  `1000` prints as `1,000` like every other count on the tab.
- **Divider: dropped. Sub-label: kept and reworded** to "Life list milestones".
  The section is named "Firsts & Milestones", so a sub-label reading
  "Milestones" repeated the title; one that names what the number counts earns
  its place and gives the list its accessible name.
- **List semantics: yes.** `ul role="list"` (the explicit role because WebKit
  drops list semantics from a `list-style: none` list), so a screen reader hears
  "list, 36 items" and can step through them.
- **Long names wrap inside the badge; the badge never widens.** The `BirdName`
  box is forced to the badge width and its row is allowed to wrap, so a long
  name breaks on its own spaces and hyphens and the two marks drop beneath it as
  one unit (they are one inline-flex span already). This is the shipped v1.0.48
  pattern (`.sr-bc-name-col`, `.sr-fl-name`, `.sr-tg-name`), applied at all
  widths here rather than only in the phone tier, because the badge is narrow
  at every width. `breakAfterSlash` is passed so a slash name, should one ever
  reach a milestone, wraps after the slash.
- **Equal heights at every width.** `grid-auto-rows: 1fr` sizes every row to the
  tallest badge in the set, so a wrapped name or a species with no marks never
  produces a short or tall tile. Measured: one height per set in Chromium and
  WebKit at 1280px and 320px, 100% and 200%, both themes.
- **Internal alignment.** Threshold at the top, date at the bottom, species
  centred in the band between (`flex: 1 1 auto` with centred content). So the
  thresholds align across a row, the dates align across a row, and a one-line
  name floats level with its neighbours while a two-line name fills its band.

### Measured results (the mockup, Chromium and WebKit)

| Viewport / text | Columns | Badge width | Badge height | Page scroll width |
|---|---|---|---|---|
| 1280px wide card / 100% | 6 (mockup card is 880px; the app's card gives about 8 to 9) | 135.7px, all equal | 111.8px, all equal | none |
| 1280px / 200% | 3 | 266px | 205.6px | none |
| 320px / 100% | 2 | 125px | 128.1px | 320 = viewport |
| 320px / 200% | 1 | 258px | 205.6px | 320 = viewport |

In every cell the last row is left-aligned in the grid's own columns and no
descendant leaves its badge.

## Component Usage

- `SectionCard`, `SubLabel` (statsPrimitives): unchanged components; `Divider`
  no longer rendered in this section.
- `BirdName size="sm" breakAfterSlash` with `taxonCode`, `hasEntry`,
  `onOpenSpecies` as today. The shared `.sr-birdname-*` rules are untouched; the
  badge scopes its own overrides under `.sr-ms-name`.
- `ChecklistLink` with `label={fmtDate(m.date)}` and a `style` carrying only
  `color` (the tier's date token). Font size comes from the `.sr-ms-date`
  wrapper by inheritance, so the inline style varies one value and no key is
  ever removed (ui.md, inline shorthand rule).
- `fmt` from `lib/statsFormat.ts` for the threshold.
- Lucide: none new. The section keeps its `Trophy`; the marks and the
  checklist glyph come from the shared components.

## Design Tokens Applied

Per tier N in 1 to 4, through four badge-scoped custom properties set by
`data-tier` so the badge rule itself names one token per role:

| Role | Property on `.sr-ms-badge[data-tier="N"]` | Token |
|---|---|---|
| Tile fill | `--sr-ms-bg` | `--sr-milestone-N-bg` |
| Tile border (1.5px) | `--sr-ms-border` | `--sr-milestone-N-border` |
| Threshold | `--sr-ms-num` | `--sr-milestone-N-num` |
| Date link | `--sr-ms-date` | `--sr-milestone-N-date` |
| Species name | (inherited) | `--sr-text` via `.sr-birdname-link` / `-text` |
| Name hover / focus | (inherited) | `--sr-accent` via `.sr-birdname-link:hover` |
| Marks | (inherited) | favicon raster, or the `--sr-text` glyph fallback at the anchor's 0.75 opacity |
| Focus ring | global | `--sr-accent` outline, the app's global `:focus-visible` rule |

No token value changes. No new tokens in `:root` or `[data-theme="dark"]`; the
four `--sr-ms-*` names are badge-local properties, never declared on a theme
block. Contrast, re-checked for this spec:

- Light tier 1 threshold `#2D8653` on `#E8F5EE` is 4.03:1, so it passes only as
  large bold text: the threshold is **1.25rem / 700** (20px bold at the default
  root size, above the 18.66px bold threshold). Do not go below about 1.17rem.
- Every date token is already at or above 4.5:1 on its tile (light tier 4 is
  the tightest at 4.51:1), so the date can sit at 0.6875rem / 500.
- The `--sr-text` glyph fallback at 0.75 opacity measures about 7.1:1 on the
  darkest light tile stop and about 7.5:1 on the darkest dark tile stop.
- Dark theme is guarded by `milestoneContrast.test.ts`, which stays green:
  its inputs are the tokens, and none change.

## Stylesheet (what the Engineer adds to `globals.css`)

Top-level rules, beside the other Statistics registers. Every size in rem so
the grid tracks the Text size control. No phone-tier rule is needed: the grid
self-collapses, so nothing goes into the `@media (max-width: 640px)` block.

```css
/* Milestone badges (Statistics > Firsts & Milestones): one tile, repeated. */
.sr-ms-grid {
  list-style: none; margin: 0; padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(7.5rem, 100%), 1fr));
  grid-auto-rows: 1fr;
  gap: 0.5rem;
}
.sr-ms-badge {
  display: flex; flex-direction: column; align-items: center; text-align: center;
  min-width: 0;
  gap: 0.25rem;
  padding: 0.625rem 0.625rem 0.5625rem;
  border-radius: 10px;
  border: 1.5px solid var(--sr-ms-border);
  background: var(--sr-ms-bg);
}
.sr-ms-badge[data-tier="1"] { --sr-ms-bg: var(--sr-milestone-1-bg); --sr-ms-border: var(--sr-milestone-1-border); --sr-ms-num: var(--sr-milestone-1-num); --sr-ms-date: var(--sr-milestone-1-date); }
.sr-ms-badge[data-tier="2"] { /* same four, tier 2 */ }
.sr-ms-badge[data-tier="3"] { /* same four, tier 3 */ }
.sr-ms-badge[data-tier="4"] { /* same four, tier 4 */ }
.sr-ms-num {
  font-size: 1.25rem; font-weight: 700; line-height: 1; letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  color: var(--sr-ms-num);
}
.sr-ms-name { flex: 1 1 auto; display: flex; align-items: center; justify-content: center; width: 100%; min-width: 0; }
.sr-ms-name .sr-birdname { width: 100%; max-width: 100%; }
.sr-ms-name .sr-birdname-row { flex-wrap: wrap; justify-content: center; row-gap: 2px; }
.sr-ms-name .sr-birdname-link,
.sr-ms-name .sr-birdname-text { text-align: center; line-height: 1.3; overflow-wrap: anywhere; min-width: 0; }
.sr-ms-name .sr-birdname-link { transition: color 120ms cubic-bezier(0.2, 0, 0, 1); }
.sr-ms-date { font-size: 0.6875rem; font-weight: 500; line-height: 1.3; }
```

Reasoning for the grid rule: `auto-fill` rather than `auto-fit`, so a short
last row keeps its empty tracks and its badges stay in the same columns instead
of stretching; `1fr` columns, so every badge is the same width; `minmax(min(7.5rem,
100%), 1fr)` is the house self-collapse form (`.sr-grid-auto`) and 7.5rem is the
narrowest tile that still holds `Nov 15, 2014` with its glyph and `1,000` at
1.25rem bold with room, chosen so a 320px phone gets two columns at 100% text
(two tracks need 15.5rem = 248px of the 258px available) and one column at 200%;
`grid-auto-rows: 1fr` is what makes every row the height of the tallest badge in
the whole set. `min-width: 0` on the badge releases the grid item's automatic
minimum so a long name can never widen a track; `overflow-wrap: anywhere` on the
name text is the backstop for an unbreakable run, which on this surface should
never occur (species names have spaces and hyphens) and is there so it cannot
leak page scroll if it does.

The 10px radius and 1.5px border are the badge's own shipped values, kept;
`gap: 0.5rem` replaces the old 8px, the same at the default root size.

## Interaction Notes

- The badge itself is not interactive and has no hover state (doctrine:
  hover-scale on every card is a tell; the actions are the links inside).
- Species name: the shared `BirdName` behaviour. At rest it reads as text; on
  hover or keyboard focus it turns `--sr-accent` and underlines; activation opens
  Species Detail when `hasEntry`.
- Marks: the shared `SpeciesLinks` anchors, opacity 0.75 at rest, 1 on hover,
  the existing 24px hit target via padding and negative margin.
- Date: the shared `ChecklistLink`, underline on hover, opens the checklist on
  eBird in a new tab; accessible name `{date}, open checklist on eBird (opens in
  a new tab)` as everywhere else.
- Keyboard: Tab visits the name button, the two mark links and the date link of
  each badge in that order, all through the `Button` / `Link` primitives (no new
  controls, so `tabOrderCoverage.test.ts` is unaffected). Focus ring is the
  global one; the badge's `overflow` is visible, so the 3px ring plus 3px offset
  is never clipped by the tile.
- Screen reader: "Life list milestones, list, N items", then per item "250",
  "Yellow-bellied Sapsucker, button", "View Yellow-bellied Sapsucker on eBird
  (opens in a new tab), link", the Birds of the World link, "Oct 8, 2016, open
  checklist on eBird (opens in a new tab), link". No check mark is read.
- Empty state: unchanged. With no reached milestone the whole block is not
  rendered (`accumulation.milestones.size > 0` gate), as today.

## Motion Spec

Implementing library: CSS, through the app's global reduced-motion block
(`globals.css` line 4163 onward), which collapses every transition to 0.001ms;
no per-component media query.

- Species name hover / focus (`.sr-ms-name .sr-birdname-link`): color
  `--sr-text` to `--sr-accent`, `cubic-bezier(0.2, 0, 0, 1)` (ease-out), 120ms,
  no transform (origin not applicable), reduced motion instant, CSS.
- Marks hover (`SpeciesLinks` anchors): opacity 0.75 to 1, which the component
  writes inline on mouseenter; a 120ms ease-out `transition: opacity` on the
  anchor can be added under `.sr-ms-name` if the Engineer wants it to match the
  name, otherwise it stays instant as it is app-wide. Reduced motion instant. CSS.
- Date hover (`ChecklistLink`): underline appears, instant, as everywhere else
  in the app. No change.
- Entrance: none. The set is static content; a mount animation would be the
  doctrine's "motion-on-mount for static content". No badge hover lift, no
  stagger.
- Theme and text-size changes: instant, as the app does them.

## Content Notes

- Sub-label copy: **Life list milestones** (sentence case in source; the
  `SubLabel` component uppercases it). In-app text, no approval stop.
- The list's `aria-label` is the same words, so the visible label and the
  accessible name agree.
- Threshold: `fmt(threshold)`; never a hand-formatted string.
- Date: `formatDate(m.date)` as today, so it follows the user's date format
  preference.
- No em dashes anywhere in the badge or its labels.
- `docs/HELP.md`: the Firsts and Milestones paragraph stays true (what a badge
  shows is unchanged: the threshold, the species, the date); no edit needed
  unless the Engineer finds it names the check mark.

## For the Engineer

- `BirdingStats.tsx` lines 1013 to 1053: remove `<Divider />`, change the
  `SubLabel` text, replace the inline flex container with
  `<ul className="sr-ms-grid" role="list" aria-label="Life list milestones">`,
  replace each inline-styled `<div>` with `<li className="sr-ms-badge"
  data-tier={tier}>`, delete the check `<div>`, wrap the number in
  `.sr-ms-num` with `fmt(threshold)`, wrap `BirdName` in `.sr-ms-name` (add
  `breakAfterSlash`), wrap `ChecklistLink` in `.sr-ms-date` and pass
  `style={{ color: \`var(--sr-milestone-${tier}-date)\` }}` only (no
  `fontSize`; the wrapper sets it). The `ts` object and every inline
  display / padding / border / gap goes away.
- `globals.css`: the block above, top level. Nothing in the 640 tier.
- `milestoneContrast.test.ts`: stays green with no token change. Update its
  header comment and the `WHITE` constant's comment: the milestone badges no
  longer draw a check glyph; the two check rows now guard the Frivolous Lists
  tier-1 check (which still paints white on `--sr-milestone-1-check`) and the
  unused tier 2 to 4 check tokens. Do not delete the rows: the tokens are
  shipped and Frivolous Lists reads one of them.
- Component test (new): renders the Milestones block with a fixture that
  reaches some thresholds and not others; asserts one `li.sr-ms-badge` per
  reached threshold inside `ul[role="list"]`, nothing for an unreached one,
  `data-tier` per the `<100 / <500 / <1000 / else` ladder, the text `1,000` for
  threshold 1000, no element containing the check glyph, and no inline
  `display`, `grid`, `flex-wrap` or `padding` on the container or the badge.
- Browser measurement (the verify gate pattern in `website/tools/verify/`): at
  320px and 1280px, 100% and 200%, Chromium and WebKit, both themes: one
  distinct badge width and one distinct badge height per set, the last badge's
  left edge equal to some column's left edge, no descendant rect outside its
  badge, and `document.documentElement.scrollWidth` equal to the viewport. The
  mockup already measures clean on exactly these legs; the build should too.
- `design-system.md`: add one pattern entry under Patterns, suggested text:
  "**Uniform badge set (Statistics milestones):** a set of equal tiles is a
  `ul role="list"` on `repeat(auto-fill, minmax(min(7.5rem, 100%), 1fr))` with
  `grid-auto-rows: 1fr`, so every tile is one width and one height and a short
  last row keeps its columns. Each tile is a column: display figure (1.25rem /
  700, tier token), the name through `BirdName` centred in a band that grows,
  the caption link at the foot. A long name wraps inside the tile with its marks
  dropping beneath as one unit (`.sr-ms-name` scopes the v1.0.48 BirdName wrap);
  the tile never widens. No decorative affirmations (a check on a set that only
  shows achieved items says nothing). `.sr-ms-*` is the exemplar."
