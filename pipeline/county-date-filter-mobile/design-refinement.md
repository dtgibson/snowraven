# Design Refinement: County and date filters on small screens

Improve lane, design pass. Approved by the user on 2026-09-22 ("Joined pair, yes
to both, this looks much better."). Mockup: `pipeline/county-date-filter-mobile/design.html`
(the `Joined` option is the approved state; `Two fields` is kept for reference only).
Phone tier (640px and below) only. Desktop and iPad render byte-identical.

## Visual Direction

On a phone the county picker and the date range stop being pieces of the wrapping
pill cloud and become one aligned "where and when" block on a row of their own:
the county picker on top, then a joined pair of date rows that read From and To
inside the field, so an empty date says what it is even where iOS paints nothing.
Every control in the block shares the pill's 30px height and one radius, so the
whole filter strip reads at one weight. The accent still means "set": a chosen
county or date tints its own row, and the From/To word tints with it. Quiet
utility, no new chrome, no new tokens, the phone's own native pickers.

## Screens / Views

Every surface below is phone tier only. The layout mechanism is the same on all
five and lives in one register (see Component Usage).

### Multimedia (`components/LifeList.tsx`)
- The block takes the full width of the last row of the `.sr-ctl-row` pill row
  (`flex: 0 0 100%`), beneath the switches, with 2px extra top margin.
- Rows: county select (MapPin glyph, "All Counties", caret), then the joined
  From / To pair.
- The separator immediately before the county is hidden with the rest of the
  row's separators (whole-row change, below).
- Filled: county row and each set date row take `--sr-accent-bg` /
  `--sr-accent-border-strong` / `--sr-accent` text, as today's inline state.

### Breeding Codes (`components/BreedingCodeList.tsx`)
- Same block, at the end of the `.sr-ctl-row.sr-bc-filter-row`, on its own row
  under the sort toggle. The single separator before the county is hidden.
- The `.sr-bc-filter-row` containment hooks (`.sr-bc-filter-pill`,
  `.sr-bc-filter-pill-label`) are not touched; the block carries none of them.

### Species Detail (`components/SpeciesDetail.tsx`)
- Same block in the filter `.sr-ctl-row`. "Clear filter" (when a filter is on)
  moves to its own line beneath the pair, left-aligned, unchanged in style.

### Checklists (`components/Checklists.tsx`, "Where & when" row)
- The row keeps its three-row structure. On phones: line 1 the "Where & when"
  label (full width), then the block (county select in this surface's plain
  register: `--sr-text` colour, no glyph), the joined pair, then the count
  right-aligned on its own line. Six lines become four.
- The `.sr-only` live region stays a child of the row; every new universal-child
  rule carries `:not(.sr-only)`.
- The two mid-row separators (after "All" and after the media-type pills) hide
  on phones as well. Whole-row change, approved by the user.

### Map Explorer sidebar (`components/MapExplorer.tsx`)
- The Date Range pair becomes the same joined pair with From / To words inside,
  at this panel's 34px register, full width of the 250px content box (it already
  stacked). Approved beyond "labelling only": the fields also tint green when
  set, like the other four surfaces. The county select and the rest of the
  sidebar are unchanged.

## Component Usage

**One shared date-range group, recommended:** `components/ui/DateRangeFields.tsx`
(name is the Engineer's call). Props: `from`, `to`, `onFrom`, `onTo`,
`register` (`'inline' | 'checklists' | 'panel'`, which chooses the desktop
height/radius/colour set so each surface stays byte-identical), and the existing
`className` pass-through. It renders:

```
<div className="sr-daterange">
  <div className="sr-daterange-field">
    <label htmlFor={fromId} className="sr-ctl-label sr-daterange-word">From</label>
    <Calendar ... className="sr-daterange-glyph" aria-hidden />   (desktop only, as today)
    <input id={fromId} type="date" className="sr-input-16" aria-label="From date" ... />
  </div>
  <span className="sr-daterange-arrow" aria-hidden="true">→</span>
  <div className="sr-daterange-field">
    <label htmlFor={toId} className="sr-ctl-label sr-daterange-word">To</label>
    <input id={toId} type="date" className="sr-input-16" aria-label="To date" ... />
  </div>
</div>
```

- `fromId` / `toId` come from `useId()`: index/instance keyed, never from user
  file content.
- `aria-label="From date"` / `"To date"` stay on the inputs and remain the
  accessible names (aria-label wins over the label element; the visible word is
  contained in the name, so label-in-name holds). Every test that queries by
  those names keeps passing.
- The desktop rendering is today's inline drawing moved verbatim into class
  rules keyed by `register` (the v1.0.33 `.sr-pill` move, applied to five
  inline copies). Desktop values per register: inline (Multimedia 1.75rem,
  Species Detail 1.625rem, Breeding Codes 26px), checklists (28px, radius 6,
  `--sr-text`), panel (34px, radius 6). If the Engineer prefers to keep the
  inline desktop styles and add only the phone-tier classes, that is acceptable
  too; the phone rules below must then carry `!important` where they beat an
  inline `height`, `border-radius` or `width`.
- The county select is NOT componentised (five different option lists and
  three registers); it gets the wrapper class `sr-whenwhere-county` and joins
  the block.
- The block wrapper is `sr-whenwhere` on all five call sites, holding
  `[county wrapper][DateRangeFields][optional tail: Clear filter / count]`.

**Pill-row separators:** lift the five inline `width: 1, height: 20` separator
objects (`pillSep` in LifeList, the inline copies in BreedingCodeList and
Checklists) to one class `sr-pill-sep` with today's exact declarations
(`width: 1px; height: 20px; background: var(--sr-border); flex-shrink: 0;
align-self: center`, plus Checklists' `margin: 0 3px` as a modifier or kept
inline). Desktop byte-identical. Phone tier: `display: none`.

**Motion:** CSS transitions only (the pill's own 120ms ease-out), no library.

## Design Tokens Applied

No new tokens. Both themes already carry every value used:
- Rest: `--sr-surface` fill, `--sr-border` 1.5px, `--sr-text-muted` text and
  word (Checklists / Map registers keep `--sr-text` for the value).
- Set: `--sr-accent-bg` fill, `--sr-accent-border-strong` border, `--sr-accent`
  text and word (Checklists' county keeps its existing `--sr-accent-border` +
  weight 600 treatment).
- Focus: the global input ring, `outline: 2px solid var(--sr-accent)`, offset 0.
- Type: the phone floor `max(var(--sr-ctl-floor), var(--sr-ctl-rem, 0.75rem))`
  for every control (already in force through `.sr-ctl-row` / `.sr-input-16`);
  the From / To words through `.sr-ctl-label`, sentence case, weight 600, no
  `--sr-label-ratio`, no `--sr-ctl-rem` (every date input on these surfaces is
  the 0.75rem fallback register).
- Radius 6 for the whole block on phones; 15px pills beside it are unchanged.

## Interaction Notes

- Filtering, state, results, `lib/`, storage: unchanged. Native `<select>` and
  native `<input type="date">` remain the controls.
- The From / To word is a real `<label for>`: tapping it focuses the input,
  which opens the iOS picker. It sits absolutely inside the field's left
  padding; the input's `padding-left` is `3.75em` (em of the input's own
  floored size, so it tracks text scale and the word never overlaps the value).
- Joined pair: the two fields share one edge. The first has
  `border-radius: 6px 6px 0 0`, the second `0 0 6px 6px; margin-top: -1.5px`.
  A set or focused field takes `position: relative; z-index: 1` so its border
  or ring wins the shared edge.
- Empty and set states: the word is muted when empty, accent when set; the
  field tints exactly as today's inline conditional does. State class from React
  (`data-set="true"` or a modifier class), not `:placeholder-shown` (unreliable
  on date inputs).
- Species Detail's "Clear filter" `Button` is unchanged and simply follows the
  block as the block's last flex child, taking a full-width line
  (`flex: 0 0 100%` on the phone tier, `width: auto` so the underline hugs the
  text).
- Checklists' count span keeps `margin-left: auto` and takes its own full-width
  line on phones (`flex: 0 0 100%; text-align: right`).
- iOS device check for the Engineer: WebKit on iOS may centre a date input's
  value text inside a wide field; if the device screenshot shows this, add
  `text-align: left` to the phone-tier input rule. Also confirm the set value
  paints inside the frame at 320px and 200% (the input is `width: 100%` inside
  a 272px content box, above the UA's intrinsic width).

## Motion Spec

- Field set / cleared (county row, date rows, From / To word): `background-color`,
  `border-color`, `color` 120ms ease-out, no transform, origin n/a; reduced
  motion: instant via the global `prefers-reduced-motion` block; CSS.
- Focus ring: instant (the app's global rule), CSS.
- Joined / separate, row wrap, text-scale change: instant, never animated
  (layout changes are not entrances); CSS.
- No entrance animation on the block: it is static content on mount.

## Content Notes

- Words: "From" and "To" (sentence case, exactly these). Option copy unchanged:
  "All Counties" on Multimedia, Breeding Codes and Species Detail; "All counties"
  on Checklists and the Map sidebar (today's strings, not harmonised here).
- No user-facing copy elsewhere changes. `docs/HELP.md` lines 206, 452, 524
  still describe the filters truthfully (they still appear in the toolbar).
- Screenshot consequence (from the Evaluator): `appstore/screenshots/iphone-6.9/05-species-detail.png`
  photographs the old tower and needs a recapture at the ship that carries this
  fix, with the store record updated. Not part of this build's code.

## Exact CSS approach for the Engineer (phone tier)

Add ONE new scoped block in `globals.css` inside the existing
`@media (max-width: 640px)` tier. Never redefine `.sr-field-row` (six consumers,
including the Weather tab in `App.tsx`); the group stops using `.sr-field-row`
on the four non-sidebar surfaces and uses its own class instead. The Map
sidebar's `.sr-map-sidebar-overlay .sr-field-row` rules stay as they are (the
guard in `filterControlSizeCss.test.ts` asserts them); the sidebar's pair either
keeps `.sr-field-row` beneath the new class or drops it, either is fine as long
as that guard's rules remain in the stylesheet untouched.

```css
/* Where & when block: county + date range, phone tier (county-date-filter-mobile) */
.sr-whenwhere { display: flex; flex-wrap: wrap; gap: 6px; flex: 0 0 100%; min-width: 0; margin-top: 2px; }
.sr-whenwhere > *:not(.sr-only) { width: 100%; }             /* :not(.sr-only): Checklists' live region */
.sr-whenwhere-county { position: relative; display: flex; align-items: center; }
.sr-whenwhere-county > select { width: 100%; height: auto; min-height: 30px; border-radius: 6px; }  /* !important only if desktop height stays inline */
.sr-daterange { display: flex; flex-direction: column; width: 100%; }
.sr-daterange-arrow { display: none; }
.sr-daterange-field { position: relative; display: flex; align-items: center; min-width: 0; }
.sr-daterange-field > input { width: 100%; height: auto; min-height: 30px; padding: 2px 8px 2px 3.75em; border-radius: 6px; text-align: left; }
.sr-daterange-glyph { display: none; }                          /* the word replaces the Calendar glyph on phones */
.sr-daterange-word { display: inline; position: absolute; left: 10px; font-weight: 600; color: var(--sr-text-muted); pointer-events: none; }
.sr-daterange-field:first-child > input { border-radius: 6px 6px 0 0; }
.sr-daterange-field + .sr-daterange-field { margin-top: -1.5px; }
.sr-daterange-field + .sr-daterange-field > input { border-radius: 0 0 6px 6px; }
.sr-daterange-field[data-set="true"] > input, .sr-daterange-field > input:focus-visible { position: relative; z-index: 1; }
.sr-daterange-field[data-set="true"] > .sr-daterange-word { color: var(--sr-accent); }
.sr-whenwhere > .sr-whenwhere-tail { flex: 0 0 100%; width: auto; }   /* Clear filter / count line */
.sr-pill-sep { display: none; }
```

Base tier (outside the media query): `.sr-daterange-word { display: none; }`
and `.sr-pill-sep` carrying the lifted desktop declarations. `pointer-events:
none` on the word is optional; with it, a tap lands on the input directly, which
is equally correct. Prefer `min-height` over `height` everywhere in the phone
rules so 200% text grows the rows instead of clipping (the v0.5.81 26px/28px
tightness on Breeding Codes and Checklists is resolved by this in passing).

Desktop must stay byte-identical: verify with the same both-engine, 641px
comparison used at v0.5.82 (fonts, widths, layout).

## Guard tests to extend (deliberate, stated changes)

- `lib/controlRegisters.test.ts`: the `.sr-ctl-label` roster goes from 22 to
  **24**: +2 in the new shared date-range component file (the From and To
  labels). Per-file counts on the five surfaces are unchanged unless the
  Engineer inlines the labels per surface instead of sharing (then +2 per file,
  +10 total, and the roster line must say so). `<SidebarLabel ctlRem=` in
  `MapExplorer.tsx` stays at 5.
- `lib/filterControlSizeCss.test.ts`: add the assertion that no `.sr-whenwhere` /
  `.sr-daterange` rule sets a positive `min-width`, and that the GLOBAL
  `.sr-field-row` stacking tier is still <=480 (unchanged). If the desktop
  inline `fontSize: '0.75rem'` moves into class rules, the source-scan assertion
  pairing `sr-input-16` with `--sr-ctl-rem` needs re-reading against the new
  file.
- `lib/scrollLeakCss.test.ts`: `.sr-whenwhere > *:not(.sr-only)` is a new
  universal-child width rule on a row that holds Checklists' live region; add it
  to the scanned set so the `:not(.sr-only)` is asserted, not assumed.
- `lib/breedingCodeFilterRowCss.test.ts` and `components/BreedingCodeList.test.tsx`:
  unchanged expectations; re-run to confirm the containment hooks are still off
  the separators, sort, county and date controls (the new block carries none).
- `components/MapExplorerInputZoom.test.tsx`: both sidebar date inputs still
  carry `.sr-input-16` and are found by `From date` / `To date`; add one row that
  the visible `From` / `To` labels exist and point at those inputs (`for` = id).
- `components/SpeciesDetailChecklistFrequency.test.tsx`, `SubspeciesExplorer.test.tsx`,
  `SpeciesDetailCountableForms.test.tsx`: unchanged (accessible names preserved).
- `lib/tabOrderCoverage.test.ts`: no new button or link; the `<label>` is not a
  control. If a new `Button` appears anywhere, it goes through the primitive.
- New, recommended: a stylesheet guard that the phone tier hides
  `.sr-daterange-arrow` and `.sr-pill-sep`, and that the arrow span carries
  `aria-hidden="true"` at every call site (a source scan over the five files).
- Playwright/iOS: the layout half is measurable in both desktop engines at 320,
  390, 402 at 100% and 200% (no page `scrollWidth` growth; the block's rows are
  full width; no line holding only an arrow). The blank-box half and the
  `text-align` question are iOS-only and need the simulator or device screenshot
  the brief asks for.

## Counted rosters and stated changes, in one place

- `.sr-ctl-label`: 22 -> 24 (+2, shared component).
- `.sr-pill-sep`: new class, 5 separator sites lifted (LifeList 5 instances via
  `pillSep`, BreedingCodeList 1, Checklists 2). Hidden on phones on all of them:
  Multimedia's whole row and Checklists' two rows are the user-approved
  whole-row changes; Breeding Codes' one sits before the group.
- `aria-hidden="true"` added to the arrow span on the four surfaces that draw it
  (DOM-only on desktop, no render change; fixes VoiceOver's "right arrow").
- Phone-tier unified height: 30px min-height and radius 6 on the block's
  controls on all five surfaces (Map sidebar keeps 34px, its panel register).
- Map sidebar: tint-when-set added to its date fields (user-approved).
