# Design Spec -- Calendar Overlays

**Feature:** calendar-overlays
**Stage:** 4, The Designer (approved direction: round 2 plus the codes control, 2026-09-26)
**Mockup:** `pipeline/calendar-overlays/design.html` (the approved rendering; where this document and the mockup disagree, the mockup is what the user approved and this document is corrected)
**Decisions:** `pipeline/calendar-overlays/decisions.md` D4-01 to D4-10 (D4-09 records the direction change from round 1; D4-10 the codes control)
**Design system:** `pipeline/design-system.md`, designed within; no token is added and no deviation from it is made

## Visual Direction

The Calendar stays the quiet, shaded wall calendar it is today until the birder turns an overlay on; then each birded day becomes a small, dense tile of facts in the cell's own white ink: the count first, exactly where it is now, then one row per fact. Density is deliberate and opt-in (both switches default off, and off is byte-identical to today); the tone stays informational, never decorative. Everything uses vocabulary the app already has: the Multimedia tab's camera, microphone and video glyphs, the eBird breeding codes and the Breeding Codes tab's tier tints, and the breeding-atlas fill ladder (open, half, solid) for Possible / Probable / Confirmed so category never rests on color.

## Screens / Views

### The control strip (settling row)

The settling row becomes two clusters. The existing "Count all forms" switch and its helper move, unchanged, into a `.sr-cal-forms` cluster that keeps today's dim/inert treatment (`opacity: 0.45`, `pointer-events: none`, `aria-disabled`, `aria-describedby` to the helper). After it, with `margin-left: auto` and a 1px `--sr-border` hairline on its left, the **Overlays** group:

- `role="group"` `aria-label="Overlays"`, an uppercase "OVERLAYS" label in the strip's `ctrlLabelStyle` register (`.sr-ctl-label`, 0.6875rem / 700 / 0.07em / `--sr-text-muted`).
- Two `small` switches through the local `Switch` (which renders the `Button` primitive): **Media** and **Breeding**, `role="switch"`, visible label inside the button (so the accessible name contains it), `aria-checked`. Never dimmed; never inside the forms cluster.
- The **codes control**: a `SegControl` in the Calendar's own register (`.sr-seg` pill on `--sr-surface-subtle`, options at 0.71875rem, `padding: 0.35rem 12px`, radius 5, `aria-pressed`), `role="group"` `aria-label="Breeding rows"`, options **Every code** (default) and **By category**. Wrapped in `.sr-cal-codes`. With Breeding off: the wrapper carries `aria-disabled="true"` and dims to opacity 0.45; each option carries `aria-disabled="true"` and `aria-describedby` pointing at a visually hidden `.sr-only` sentence "Turn on Breeding to choose how codes show."; click and keyboard activation are ignored; both options remain tab stops (no `tabIndex` override, no `pointer-events: none`). With Breeding on the wrapper's attribute and dim are removed.

Phone tier (<=640): the Overlays group takes its own line under the forms cluster (`flex: 1 1 100%`, the hairline becomes a top rule); the codes control takes its own line inside it with its two options sharing the width (`.sr-seg > .sr-seg-btn { flex: 1 1 auto }`); every control in the strip is already under the `.sr-ctl-row` 16px floor.

Key decisions: trailing placement mirrors "Use Textures" ending the row above (display toggles end their row); dim-not-hide follows the app's gated-sub-option rule (ui.md, design-system Switches); no new label for the codes control because its options name themselves and the group name carries "Breeding rows" for assistive technology.

### Compact view: the tile

With either overlay on, `.sr-cal-months` gains `--rich` (card minimum 340px instead of 230px) and every month's `.sr-cal-grid` gains `--rich`:

- Every cell (pad, no-data, zero, data) drops `aspect-ratio: 1/1` for `aspect-ratio: auto; min-height: 2.125rem`; the grid's `align-items: stretch` makes every cell in a week the height of the tallest, so a week with no facts stays a row of near-squares.
- Data and zero cells become top-aligned column flex tiles: `padding: 0.25rem 0.125rem 0.2rem; gap: 0.1875rem`. The count span is unchanged (0.6875rem / 600 / tabular, `--sr-cal-fg` on data, `--sr-text-muted` on zero; its textures pill unchanged).
- Each cell is a size container (`container-type: inline-size`).
- Beneath the count, TWO `aria-hidden` fact blocks are rendered, `.sr-cal-facts--rich` and `.sr-cal-facts--condensed`; the stylesheet shows one. Above `2.4em` of cell width the rich block shows; at or below it (`@container (max-width: 2.4em)`) the condensed block shows. Both are drawn in `currentColor` (the cell's number color) at 0.5625rem / 600 / tabular / line-height 1, column gap 0.125rem, block width 100%.
- **Rich block rows** (`.sr-fact`, a 3-column grid `auto minmax(0,1fr) auto`, `max-width: 3.6rem`, `white-space: nowrap`, glyphs 0.5625rem square):
  - Media, ML export loaded: one row per format present, in the fixed order photo, audio, video: glyph, empty middle, count right-aligned. Ids the export does not name: one further row with the generic frame glyph. Not loaded: one row, frame glyph, total distinct ids.
  - Breeding, "Every code": one row per distinct code that day, strongest first (the table's rank): category circle, code in 700 with 0.02em tracking, count of species carrying it right-aligned. More than three codes: three rows then a centered `+N` row (`.sr-fact--more`, opacity 0.85).
  - Breeding, "By category" (revised D4-11): one row per category present, in the order Confirmed, Probable, Possible: the circle, the category NAME in its title-case short form (`Conf` / `Prob` / `Poss`, from `BREEDING_CATEGORY_SHORT`), and the count of distinct species with evidence at that category (`DayCell.codeCategoryCounts`). No code appears on the tile in this mode. The row carries `.sr-fact--cat`, whose name is set at 600 with no tracking (a code is 700 with 0.02em), so the two row kinds differ in weight as well as words. At most three rows, so no `+N`.
- **Condensed block rows** (`display: flex; flex-wrap: wrap; justify-content: center`): one media row (frame glyph, total distinct ids); then, under Every code, one breeding row (circle, strongest code, no count) and `+N` when further codes exist (N = distinct codes minus one); under By category (D4-11), one row per category present as its circle and its species count, no text (at most three, no `+N`). On a cell too narrow for glyph and text on one line (320px at 200%) the two wrap onto two lines and the tile grows taller.
- Textures on: each fact block takes `background: rgba(var(--sr-cal-N-rgb), 0.9); border-radius: 3px; padding: 0.125rem` (`.is-backed`), the same backing the count's pill wears over the hatch; the hatch itself renders as today.
- Hover: unchanged (`brightness(1.12)` on solid fills; none on hatch).
- Measured in the mockup: desktop cells at 100% are about 48px wide and rich; a 320px phone cell at 100% is 32.56px and condensed; at 200% it is 34 x 144, wrapped, zero overflow, zero page scroll.

### Large view (Year Overview)

Unchanged geometry. With an overlay on, each data or zero thumbnail gets up to two corner marks (`.sr-cal-mark`, `aria-hidden`): the frame glyph bottom-left for media presence, the category circle bottom-right for the day's strongest code. Sized `clamp(4px, 1.75cqw, 6px)` against the `.sr-cal-minimonth` container, 1px insets, `currentColor`, hidden below the shipped `@container (min-width: 152px)` floor exactly as `.sr-cal-daynum` is (one more selector under the same query, never a second threshold). Textures on: the mark takes the same `rgba(--sr-cal-N-rgb, 0.9)` backing with 1px padding. The codes setting does not change Large view.

### Legend

With an overlay on, one key block per active overlay is appended to the legend flex row (`.legend-ov`: a column of micro-label, entries row, caption):

- **MEDIA** (`.legend-unit` register): entries `photos`, `audio`, `videos`, `media` when the ML export is loaded, `media` alone when it is not; caption (0.5625rem, `--sr-text-gray`, max 34ch) "count: Macaulay Library items that day · plain frame: format not in the ML export" or "count: Macaulay Library items that day · load the ML export for formats".
- **BREEDING**: entries `Confirmed`, `Probable`, `Possible` (strongest to weakest along the row, the direction of "fewer -> more"); under By category the entries read `Conf · Confirmed`, `Prob · Probable`, `Poss · Possible` (short form at 600 in `--sr-text`, then the word in the entry's muted register), keying the tile's short form to its word beside its circle. Caption "every code recorded that day · count: species carrying it" or, under By category, "one row per category that day · count: species with evidence at that category".
- Each entry swatch is a 14px radius-3 `--sr-cal-3` square with the glyph in `--sr-cal-fg` at 8px and a 1px `--sr-surface` ring, so the key shows the glyph as it sits on a cell.
- Entries and cells read the same spec table (`OVERLAY_MARK_SPECS`). Both overlays off: no block is rendered.

### Day popup

Unchanged structure. While an overlay is on:

- Header, under the date (and the "Across all years" / forms note lines): `.sr-popup-facts`, 0.6875rem `--sr-text-muted`, one line per overlay. Media: the frame glyph, "media on N checklists:", then per-format totals for the day each with its glyph ("4 photos", "1 audio"; or "5 media" without the export). Breeding: "breeding evidence: Confirmed", then every distinct code that day with its circle, the code in bold and its species count. The popup always lists every code regardless of the codes setting.
- Each checklist row, under the "time · place · N species" line: `.sr-popup-ov`. Media: "N media" in `--sr-text` 600 then per-format phrases with the Multimedia tab's 11px glyphs (plain "N media" when no format resolves). Breeding: one `.sr-bcode` chip per distinct code on that checklist: code (700), label, "· Category" (600), and "· N species" when more than one; tinted with the Breeding Codes tab's register (Confirmed `data-tier="4"`, Probable `2`, Possible `1` with tier-2 foreground, the shipped cross-case). A row with neither shows nothing extra.
- Both overlays off: byte-identical to today.

### Accessible names

Data day: `{date}: {N} {noun}{suffix}. Open day details`; zero day: `{date}: birded, 0 {noun}{suffix}. Open day details`, where `{noun}` is `metricNoun` (FR-28) and `{suffix}` is `, media: 3 photos, 1 audio` (or `, media: 5` with no export) and `, breeding: NY 1 (Confirmed), S 2 (Possible)` (every code with its species count and category; the codes setting does not shorten it), each part present only while its overlay is on. The fact blocks and corner marks are `aria-hidden`.

## Component Usage

- `Button` primitive for every control (switches, seg options, cells, popup close); no raw `<button>`.
- Local `Switch` (Calendar.tsx) for Media and Breeding, `small`, no `disabled`.
- `SegControl` (Calendar.tsx) for the codes control, with `aria-disabled` and `aria-describedby` passed through to its option buttons (a small extension to the component's props, matching `Switch`'s existing `disabled` / `describedBy`).
- `DayCellButton`, `MiniDayCell`, `CalendarLegend`, `DayPopup`, `PopupChecklistRow`: extended, not replaced.
- Lucide `Camera`, `Mic`, `Video` (as the Multimedia tab uses them) for format glyphs; the frame and the three circles are inline SVG paths defined once in the spec table.
- No new library, no new dependency.

## Design Tokens Applied

- Tile and mark ink: `currentColor`, i.e. `--sr-cal-fg` on data cells and `--sr-text-muted` on zero cells (the number's own tokens; `OVERLAY_MARK_SPECS[*].token` is `var(--sr-cal-fg)` for all seven keys, which is what the contrast guard parses against `--sr-cal-1..5`).
- Textures backing: `rgba(var(--sr-cal-N-rgb), 0.9)`.
- Legend swatch: `--sr-cal-3` fill, `--sr-cal-fg` glyph, `--sr-surface` ring; captions `--sr-text-gray`; labels `--sr-text-muted`.
- Popup chips: the `.sr-pill[data-tier]` tints (`rgba(--sr-tier-N-rgb, 0.08 / 0.15)` backgrounds, `0.3 / 0.5` borders, `--sr-tier-N-fg` text, tier 1 with `--sr-tier-2-fg`).
- Codes control: the SegControl register (`--sr-surface-subtle` pill, `--sr-surface` + `--sr-border` pressed option, `--sr-text` / `--sr-text-muted`).
- Hairline between clusters: `--sr-border`.
- No new token; nothing added to `globals.css`'s token blocks.

## Interaction Notes

- Flipping Media or Breeding re-renders cells, legend and an open popup from the same `overlays` value read at render; the day-cell derivation memo is not recomputed.
- The codes control changes only how the cell rows and the legend caption are drawn; the popup and accessible names always carry every code.
- With Breeding off the codes control ignores click, Enter and Space, stays focusable, and its reason is announced through `aria-describedby`.
- Persistence: one settings value `calendarOverlays: { media: boolean, breeding: boolean, codes: 'every' | 'category' }`, written whole on every change of any of the three; hydration validates each field independently (a non-boolean reads off; a `codes` value other than the two strings reads `'every'`); a flip before hydration wins; a failed write is silent and the next change retries.
- The rich / condensed choice is made by the stylesheet from the cell's width; nothing measures or re-renders on resize.
- Everything else (metric, year, All years, species filter, textures, Count all forms, popup open/close/focus return) behaves exactly as today.

## Motion Spec

- Fact block on an overlay turning ON: `scaleY(0.6) -> 1` plus opacity, `cubic-bezier(0.2, 0, 0, 1)`, 160ms, `transform-origin: top center` (it grows down from the count), CSS keyframes, only on the flip that turned that overlay on; OFF is instant; a re-render that did not change overlay state does not animate; reduced motion: instant (the global block).
- Legend key block on an overlay turning ON: opacity 0 -> 1, ease-out, 160ms, CSS; OFF instant; reduced motion instant.
- Codes control dim/undim: opacity, 150ms ease-out, CSS (the forms cluster's value); reduced motion instant.
- Switch knob and track: the shipped 120ms.
- Day popup entrance: unchanged (none), because FR-19 requires its markup byte-identical with both overlays off.
- Large-view corner marks: no motion.

## Content Notes

- Copy is short and specific, American spelling, no em dashes. Switch labels "Media", "Breeding"; group label "Overlays"; codes options "Every code", "By category"; codes group name "Breeding rows"; gated reason "Turn on Breeding to choose how codes show."
- Media phrases and nouns are fixed by `mediaFormatPhrases`: `1 photo` / `2 photos`, `1 audio` / `2 audio`, `1 video` / `2 videos`, `N media`; order photo, audio, video.
- Category words come from `BREEDING_CATEGORY_LABELS` (Confirmed / Probable / Possible), never from a raw code; the tile's short forms come from `BREEDING_CATEGORY_SHORT` (`Conf` / `Prob` / `Poss`) and appear only on rich By-category rows and in the legend that keys them; an unknown code renders its raw text (escaped) as its code and label, category Possible, visually truncated with an ellipsis past 8 characters in the popup.
- Legend captions state what each count means (see Legend); they are the only place the meaning of a number is spelled out on the grid.
- `docs/HELP.md` Calendar section describes: the two switches, the codes control and its two renderings, what each count means, the condensed form on narrow cells, the Large-view marks, the popup detail, and that the three preferences persist.

## Data-layer implications (for the PRD and schema amendment)

Reverses the brief's Out of Scope "per-format media marks on the cell" and PRD FR-20's "never extend the cell" (D4-09).

- **Settings value** `calendarOverlays` gains a third field: `{ media: boolean, breeding: boolean, codes: 'every' | 'category' }`. `normalizeCalendarOverlays`: booleans as before; `codes` honored only when strictly one of the two strings, otherwise `'every'`; the frozen default is `{ media: false, breeding: false, codes: 'every' }` and is returned only when all three fields equal it. `toggle(layer)` gains a sibling `setCodes(v)`; every write carries all three fields.
- **`DayCell.mediaIds: string[]`** (distinct catalog ids across the day's rows, string references into the parsed rows) replaces a bare count; `mediaIdCount` (= its length) and `mediaChecklistCount` stay. Per-format counts are joined at render from `mediaIds` x `mediaMap`: `mediaFormatCounts` gains an `unknown` bucket (ids the export does not name), which is the "frame" row when the export is loaded.
- **`DayCell.codes: { def: BreedingCodeDef; speciesCount: number }[]`**: every distinct display code recorded that day, sorted by the table's rank (unknown codes last, first-seen order among equals), `speciesCount` = number of distinct normalized species names carrying that code that day (a `Set` per code in the pass, its size on output). `DayCell.breeding` stays as `codes[0]?.def ?? null`.
- **Per checklist row:** `codes: { def; speciesCount }[]` (same shape, that checklist's rows only) beside the existing `catalogIds` and `breeding`.
- **All years:** `mediaIds` is the union across years; per-code species sets are unions across years. **Species filter:** both narrow to that species' rows (every `speciesCount` becomes 1). Countability and the escapee exclusion are still ignored (FR-14).
- **`OVERLAY_MARK_SPECS`** has seven keys: `photo`, `audio`, `video`, `media`, `confirmed`, `probable`, `possible`; each `{ key, label, glyph, token }` where `glyph` is the SVG (or lucide component reference) and `token` is `var(--sr-cal-fg)`. `breedingMarkKey(def)` unchanged. A pure `tileRows(cell, overlays, mediaMap)` returns the rich and condensed row lists (media rows, code rows capped at three plus `more`; under `codes === 'category'` one row per category from `codeCategoryCounts` with `label = BREEDING_CATEGORY_SHORT[cat]`, `isCategory: true`, and the condensed list is the same categories as circle plus count with no label, D4-11) so cells and tests share one derivation. `BREEDING_CATEGORY_SHORT: Record<BreedingCategory, string> = { confirmed: 'Conf', probable: 'Prob', possible: 'Poss' }` lives beside `BREEDING_CATEGORY_LABELS` in `lib/breedingCodes.ts`.
- **Legend:** per-overlay blocks; the media entries depend on `mediaMap !== null`; the breeding caption depends on `codes`.
- **Accessible-name suffix:** `, media: 3 photos, 1 audio` / `, media: 5`; `, breeding: NY 1 (Confirmed), S 2 (Possible)` (every code, whatever `codes` is).
- **Rendering classes:** `.sr-cal-months--rich`, `.sr-cal-grid--rich`, `.sr-cal-codes` and its `[aria-disabled]` rule, `.sr-cal-facts`, `.sr-cal-facts--rich/--condensed`, `.sr-fact`, `.sr-fact--more`, `.legend-ov`, `.legend-cap`, `.sr-popup-facts`, `.sr-popup-ov`, `.sr-bcode`; `container-type: inline-size` on `.sr-cal-day` under `--rich`; one `@container (max-width: 2.4em)` rule; `.sr-cal-mark` under the existing 152px query. All lifted to `globals.css` (responsive by class, never inline).
- **PRD text to amend:** FR-17 (marks are counted rows, not presence marks), FR-20 (tile may grow in height; count stays first; no horizontal page scroll at 320px/200%), FR-22 (Large view: corner presence marks), FR-24/FR-26 (popup lists every code with species counts; per-format day totals in the header), FR-29 (suffix format above), FR-30 (legend blocks and captions), FR-01/FR-03/FR-04 (the third field and control), QA-19/QA-23/QA-27/QA-30/QA-33/QA-34 accordingly, plus a QA row for the codes control's gated state (aria-disabled, focusable, activation ignored, reason via aria-describedby) and its persistence round trip.
- **Popup** always lists every code with its species count; the codes setting never reaches it.
