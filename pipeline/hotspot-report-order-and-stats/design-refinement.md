# Design Refinement: Hotspot report order and stats

**Task:** hotspot-report-order-and-stats (Improve lane, design pass)
**Stage:** 2, The Designer
**Status:** FINAL. The user approved the first direction as drawn on 2026-11-12 ("Looks great") and let the three recommendations stand (decisions.md, D-02).
**Mockup:** `pipeline/hotspot-report-order-and-stats/design.html` (one self-contained file, nothing loaded from outside). It opens in the approved state. Its review bar still shows today's report beside the approved one at four widths, three places, both themes and two text sizes, and keeps the mockup-only switches for the figures and the jump row that were compared, so the record shows what was chosen against what.
**Design system:** `pipeline/design-system.md` applies in full. Nothing is minted. The recorded choices and two small deviations are in `decisions.md`, D-01 and D-02.
**Refines:** `pipeline/hotspot-reports/design-spec.md` as built in 1.0.71. Anything not named here is unchanged.

## Visual Direction

The report stays the quiet reading page it is: cards of plain figures in SnowRaven's own registers, the place's name the largest thing on the page, the species total the one figure in the accent. What changes is the order in which it is read. It now opens on a summary of the place, runs through the short sections, and ends on the long list, so on a phone nothing short is buried under hundreds of rows. The new opening card borrows the header's own way of setting a figure, one step smaller, so the header's two totals still lead.

## Screens / Views

### Reading order (FR-31, modified)

At every width, in the DOM and on screen:

1. Header band (unchanged)
2. At a glance (new)
3. Jump row (only while the report is one column)
4. Map
5. Visits and media
6. Weather on your visits
7. Checklists by protocol
8. Most-recorded species (new; absent where it has nothing to rank)
9. Life list

- One column (phones, any report 53.25em wide or narrower, any window at 200% text): the parts stack in that order.
- Two columns (the report wider than 53.25em): the header and At a glance span the full width; beneath them parts 4 to 8 run down a 24rem rail on the left and the life list runs down the right. Reading goes down the left column, then the right, which is DOM order. The jump row is not shown.
- No `order`, no grid-area placement: the DOM is the order.

Why this order for the compact sections: the map is the shortest and says where the place is; Visits by month and by year continue the account of visits the opening figures begin; weather describes those visits; protocols are how they were recorded; the most-recorded list is the life list's own digest, so it sits directly above it.

### Header band

Unchanged in markup, classes and copy. The Species and Checklists totals and the rule sentence stay here and are not repeated below (FR-50). `HotspotReportHeader.tsx` is not touched.

### At a glance (`.sr-hsr-glance`)

A section card like the others: the section head (a 28px accent tile with lucide `BarChart2` at 14px / 2.2, the Statistics tab's own glyph, and an `h4` "At a glance" with `tabIndex={-1}`; its id a fixed literal), over a body holding two definition lists in a column, tiles above facts, 14px apart (`.sr-hsr-glance { display: flex; flex-direction: column; gap: 14px }`).

**Tiles** (`dl.sr-hsr-tiles`; each tile a `div.sr-hsr-tile` holding a `dt` and two `dd`):

- Label (`dt`): the header's figure label, `.sr-hsr-fig-label` (0.6875rem / 600, uppercase, 0.07em, `--sr-text-muted`).
- Figure (`dd.sr-hsr-tile-value`): 1.25rem / 700, -0.02em, line-height 1.15, tabular numerals, `--sr-text`. No accent. A unit that is a word follows in `.sr-hsr-tile-unit` (0.8125rem / 600, 4px after the figure).
- Denominator (`dd.sr-hsr-note`): 0.71875rem `--sr-text-muted`, wrapping freely.
- Grid: `repeat(auto-fit, minmax(min(8rem, 100%), 1fr))`, `gap: 14px 16px`. Nothing in a tile is `nowrap`.

Tiles, in this order:

| Label | Figure | Denominator line, exact | Drawn when |
|---|---|---|---|
| Days birded | the number of distinct dates among dated checklists | all dated: "from {D} dated checklists"; otherwise "from {D} of {C} checklists with a valid date" (D dated checklists, C all checklists) | two or more dated checklists |
| Years birded | the number of distinct years with a dated checklist | "{first year} to {last year}"; one year: "{year}" | two or more dated checklists |
| Species per hour | the mean, over the checklists it rests on, of each checklist's species under the tab's one species rule divided by its hours; one decimal | "averaged over {n} of {C} checklists with a duration"; when n is 1, "from the 1 checklist here with a duration". **Zero-minute case:** the figure rests on checklists whose usable duration is above zero. When n is smaller than Time birded's count (a checklist recorded a duration of zero), the line reads "averaged over {n} of {C} checklists with a duration above zero" (n of 1: "from the 1 checklist here with a duration above zero"), so the two denominators never read as a disagreement | n is 1 or more and the place has a countable species |
| Recorded once | the number of species on the life list that are on exactly one checklist here | "of {S} species, each on 1 checklist" | two or more checklists and two or more species |
| Longest gap | the largest number of days between two consecutive distinct dates, with the unit "day" or "days" | "{from} to {to}", the two dates either side of the gap: same year "Jun 11 to Aug 27, 2016", different years "Dec 20, 2019 to Feb 3, 2020". The earliest gap wins a tie | three or more distinct dates |

**Facts** (`dl.sr-hsr-facts`, the shipped fact row: a muted term 8.75rem wide beside its value, wrapping apart when they must):

| Term | Value, exact | Rule |
|---|---|---|
| First visit, Latest visit | the dated `ChecklistLink` at 600 | FR-51 unchanged. One dated checklist: one row, "Only visit". None dated: the term "First visit" and "None of your checklists here has a valid date." |
| Time birded | "**{hours and minutes}**" over the note "over {n} of {C} checklists that recorded a duration, {average} on average" | FR-53 unchanged, plus the average: minutes over counted, in the same hours-and-minutes form ("1 hour 15 minutes"). The ", {average} on average" clause is dropped when n is 1. None recorded: "None of your checklists here recorded a duration." |
| Distance traveled | "**{X} miles**" over the note "over {n} of {C} checklists that recorded a distance, {Y} miles on average" | see Distance below. The ", {Y} miles on average" clause is dropped when n is 1. The row is absent when no checklist here recorded a usable distance |
| Most species on one checklist | "**{n} species** on" and the dated link | FR-54 unchanged |
| First species here | the bird through `<BirdName>` (`size="md"`, no scientific name, `hasEntry`, `onOpenSpecies`, `taxonCode` from `codeFor`), then the dated checklist link | the life list's oldest row (position 1) |
| Newest species here | the same form | the life list's newest row (position N) |

Fact layout in this card:

- One column, or two where each can hold a 19rem row: `repeat(auto-fit, minmax(min(max(19rem, 34%), 100%), 1fr))`, `column-gap: 36px`. The 34% term caps the grid at two.
- Each row's rule is on its top edge (`border-top: 1px solid var(--sr-border-subtle)`, `padding: 9px 0`, no bottom rule; the list takes `margin-bottom: -9px`), so the first row's rule is the divider under the tiles and the last row leaves none behind. Scoped under `.sr-hsr-glance`.
- DOM order is row order, so in two columns the rows read across.
- The bird-and-date value is a wrapping pair (`dd.sr-hsr-fact-sp`: flex, wrap, baseline, `gap: 0 10px`), with the name's own wrap scoped under it (`.sr-birdname { max-width: 100% }`, `.sr-birdname-row { flex-wrap: wrap }`). The shared BirdName rules are untouched.

**Distance (the bound and the unit).**

- *Usable:* a checklist's distance counts when it is a finite number, at least 0 and at most `DISTANCE_MAX_KM = 2400` kilometers. Anything else (blank, negative, not finite, above the bound) is left out of the total, the average and n, exactly as an unusable duration is left out of Time birded, and the note's "{n} of {C}" is where that shows.
- *Why 2,400:* it is derived from the bound FR-53 already rests on. eBird caps a checklist at 24 hours (`DURATION_MAX_MIN = 1440`), and 24 hours at 100 km/h is 2,400 km, so no distance traveled during one checklist can honestly exceed it. It is deliberately generous: it never drops a real checklist, including a long driving count, and it exists so one corrupt cell cannot become the place's total. It is a plausibility ceiling, not a claim about good practice.
- *Zero:* a recorded distance of 0 counts, as a recorded duration of 0 does.
- *Unit:* the export's distance is kilometers. The report sums in kilometers and converts once, at display, with the shared `KM_TO_MI`, and shows miles, because Statistics shows distance in miles and has no unit setting; a place's distance should read in the same unit as the whole record's. One decimal, always ("312.4 miles", "1.0 miles", "0.8 miles"), so the word is always "miles" and no "1 miles" can be written. A total above zero that rounds to 0.0 reads "less than 0.1 miles".
- *Against Statistics:* Statistics applies no distance bound, so for a file with a corrupt distance its total and this one can differ, as they already can for duration. Help states it with the other differences.

**Thin places (the many / one / none rule applied to figures).**

- One dated checklist: no Days birded, no Years birded; the header's "1 checklist" and the "Only visit" row already say it.
- No checklist with a duration above zero: no Species per hour tile; Time birded carries its shipped sentence when none recorded a duration at all.
- One checklist with a duration: Time birded and Distance traveled drop their average clauses; Species per hour reads "from the 1 checklist here with a duration".
- One species on the list: no First or Newest row; a single row, "Only species here", in the same bird-and-date form. No Recorded once tile.
- The oldest and newest life-list rows share a first date (a place birded once, or whose every species came on the first visit): neither First species here nor Newest species here is drawn.
- No countable species: no species rows, no Species per hour, no Recorded once, and Most species on one checklist is absent as shipped.
- Fewer than three distinct dates: no Longest gap.
- No tile applies: the tiles list is not rendered, and the facts stand alone in one column with no rule above the first row (`.sr-hsr-glance > .sr-hsr-facts:first-child`).

### Jump row

Kept, in the shipped chip register, shown only while the report is one column. It sits after At a glance, and its chips are the sections after it, in order: Map, Visits, Weather, Protocols, Most recorded, Life list. Every section after the row has a chip and nothing before it does; the "Most recorded" chip is present exactly when that section is. A chip scrolls its section card into view and moves focus to the section's heading, as shipped.

### Map, Weather on your visits, Checklists by protocol

Unchanged inside. Only their place in the order moves.

### Visits and media

Keeps its name and its chip. It holds Visits by month, Visits by year, and Photos, audio, and video. The facts list and the divider under it leave this card.

### Most-recorded species (new section)

A section card: head with lucide `ListOrdered` at 14px / 2.2 and the `h4` "Most-recorded species"; body padded like the others. It is the last card in the rail, directly above the life list.

- **Lead line** (`.sr-hsr-note`, 10px above the list): more than ten species, "The ten species on the most of your {C} checklists here."; two to ten species, "Your {S} species here, by how many of your {C} checklists here include each."
- **List:** an `ol.sr-hsr-toplist` of at most **ten** rows (NFR-03). Each row `li.sr-hsr-toprow` is a two-track grid, `1.6rem minmax(0, 1fr)`, `column-gap: 10px`, rows divided by `--sr-border-subtle`, with three things in it:
  1. Rank: right-aligned 0.75rem `--sr-text-muted` tabular numerals, `aria-hidden` (the ordered list carries the position).
  2. Species: `<BirdName>` (`size="md"`, no scientific name, `hasEntry`, `onOpenSpecies`, `taxonCode`), its wrap scoped under the row.
  3. Figure, on its own line under the name at every width: "on **{n}** of {C} checklists · {share}" (0.75rem `--sr-text-muted`, the count 600 in `--sr-text`), the share through `fmtSharePct(n, C)`. It never sits beside the name, so no row carries an incompressible trailing figure.
- **Order:** checklists the species is on, descending; ties by name (locale compare). The figure is the life list's own per-row figure, so each row equals its row in the list. A tie at the tenth place is cut by that order; no "and more" line.
- **Many / one / none:** two or more species and two or more checklists, the list. Exactly one species (two or more checklists), one sentence and no list: "{Bird} is the only species here, on {n} of {C} checklists.", the bird through `<BirdName>` with its `trailing` punctuation. One checklist (every species ties at one) or no countable species: nothing is rendered, heading and chip included.

### Life list

Unchanged inside (caption, rows, column header, paging, the 28em stack). It is the last child of `.sr-hsr-body`.

### Two columns

`.sr-hsr-body` is `minmax(0, 24rem) minmax(0, 1fr)`, `gap: 16px`, `align-items: start`: the rail first, the life list second. Under `@container sr-hsr-report (max-width: 53.25em)` it is one column and the jump row shows. (The mockup writes the traded tracks on a `--next` modifier so it can draw both versions on one page; the build changes the base rule.)

### Phone

One column in the order above. No new phone-tier declaration: the tiles and fact rows collapse by their own grids, the section head and body take the shipped phone padding, and the chips take the shipped 2.75rem height. Tiles are two across on a 390px phone and one across at 320px and at 200% text.

### Left out, by the user's decision

Party size and the ten highest counts were offered, drawn, and not taken. Neither is built.

## Component Usage

- `HotspotReport.tsx`: the new order; inside `.sr-hsr-body` the rail first and the life list second; the jump row after the new card; `REPORT_SECTIONS` and the heading ids extended (fixed literals) and reordered.
- `HotspotReportSections.tsx`: a `GlanceBody` and a `MostRecordedBody` beside the other bodies; `VisitsBody` loses its facts list.
- `HotspotReportHeader.tsx`: untouched.
- `lib/hotspotReportsLocation.ts`: days, year count, longest gap and its dates, the species-per-hour mean and its n, the distance total and n under `DISTANCE_MAX_KM`, all from arrays and fields the facts already hold; species-counting figures from the per-checklist counts `applySpeciesRule` builds.
- Shared components as they are: `SectionCard`, `ChecklistLink` (dated form), `BirdName`, `Link` (chips). New lucide imports on this tab: `BarChart2`, `ListOrdered`.
- Every new string in `lib/hotspotReportsCopy.ts`, count-bearing ones generated and swept at 0, 1 and 2.

## Design Tokens Applied

`--sr-surface`, `--sr-border`, `--sr-border-subtle`, `--sr-card-shadow` (cards and row rules); `--sr-accent-bg`, `--sr-accent` (section tiles, checklist links); `--sr-text` (figures, values, counts); `--sr-text-muted` (labels, denominators, terms, ranks). No new token. Type: label 0.6875rem / 600 uppercase; figure 1.25rem / 700 (the share-breakdown headline figure's size, below the header totals' 1.625rem); unit 0.8125rem / 600; denominator 0.71875rem; fact term 0.75rem; fact value 0.8125rem; ranked figure line 0.75rem.

## Interaction Notes

- No new kind of control. New tab stops: in At a glance, the dated checklist links (first, latest, biggest, and the two species rows) and, on the species rows, the `BirdName` name and its two marks; in Most-recorded species, each row's `BirdName` name and marks.
- A jump chip scrolls to its section card and focuses the heading without a second scroll, as shipped. The chip set is computed from the sections actually rendered after the row.
- Paging the life list is unchanged, including focus moving to the count sentence when the last rows appear.
- The live region's sentence is unchanged.
- Reading order equals DOM order at every width.
- Declared reads for the Auditor (the Improve lane has no schema): `distance` on each checklist, a numeric cell already parsed, bounded as above; no new read over comment text; the longest gap is integer arithmetic over the sorted distinct days, never a walk across the span.

## Motion Spec

- At a glance card, tiles, fact rows, Most-recorded rows: no motion of their own; they arrive inside the view's entrance; reduced motion: nothing to reduce; lib: none.
- View entrance on a change of place: `cubic-bezier(0.16, 1, 0.3, 1)`, 160ms, opacity with a 3px rise, no origin (a content swap in place); skipped under reduced motion; Web Animations API, as shipped (hotspot-reports D-09).
- Distribution bars (months, years, weather, protocols): the shipped `sr-wx-grow`, `cubic-bezier(0.2, 0, 0, 1)`, 300ms, width from the rail's leading edge; reduced motion shows the final width; CSS.
- Chips, checklist links, bird names, paging buttons on hover: ease-out, 120ms, color or background, inside `@media (hover: hover)`; reduced motion instant; CSS.
- Jump chip scroll: the shipped `smoothScrollIntoView`; instant under reduced motion.
- The sections' new order, the columns trading sides, the figures themselves: no motion.

## Content Notes

Plain, short, American spelling, "weather" lowercase, no em dashes. New or changed strings:

| Constant | Wording |
|---|---|
| Section titles added | At a glance; Most-recorded species |
| Jump chips, in order | Map; Visits; Weather; Protocols; Most recorded; Life list |
| Tile labels | Days birded; Years birded; Species per hour; Recorded once; Longest gap |
| Days note | from {D} dated checklists / from {D} of {C} checklists with a valid date |
| Years note | {first} to {last} / {year} |
| Species per hour note | averaged over {n} of {C} checklists with a duration / from the 1 checklist here with a duration; with "above zero" appended to "duration" when n is below Time birded's count |
| Recorded once note | of {S} species, each on 1 checklist |
| Longest gap | {n} day / {n} days; note {from} to {to} |
| Time birded note | over {n} of {C} checklists that recorded a duration, {average} on average |
| Distance traveled | {X} miles; note: over {n} of {C} checklists that recorded a distance, {Y} miles on average; floor: less than 0.1 miles |
| Fact terms added | Distance traveled; First species here; Newest species here; Only species here |
| Most-recorded lead | The ten species on the most of your {C} checklists here. / Your {S} species here, by how many of your {C} checklists here include each. |
| Most-recorded row | on {n} of {C} checklists · {share} |
| Most-recorded, one species | {Bird} is the only species here, on {n} of {C} checklists. |

Every "{C} checklists" follows the copy module's singular and plural rule. Help's "Five sections follow" sentence and its wide-layout sentence change with the build, without an approval stop. No README, website or store sentence is written here.

## Thresholds

| Threshold | Container | Derivation | Re-measure in the built app |
|---|---|---|---|
| One column at `53.25em` and under; coupled with the next row | `.sr-hsr-report` (`@container sr-hsr-report`) | hotspot-reports D-07, unchanged: the 24rem rail, the 16px gap, the 2px card border and the list's 28em, rounded up. The two tracks trade sides, so the list column is the width it was | yes, as a pair with 28em: ink per grid cell, **classic and overlay scrollbars**, Chromium and WebKit, 100% to 200% text; the held harness's thresholds and window legs follow |
| Life list stacks at `28em` and under | `.sr-hsr-ll` (`@container sr-hsr-ll`) | D-07, unchanged: the name cell breaks at 27em at 100%, plus 1em for other platforms' fonts | yes, against the list's new container, the right column |
| Fact rows two across at a track minimum of `max(19rem, 34%)` | the facts list in the At a glance body (a self-collapsing grid, no query) | 19rem is the term's 8.75rem, the 12px gap and the value's 9rem basis, the figure the overview's ranked lists already collapse at; 34% caps the grid at two | yes: at the width where two columns first appear, the longest term and value sit side by side inside their own cell, both engines, 100% to 200% text |
| Tiles two across at a track minimum of `8rem` | the tiles list in the At a glance body (a self-collapsing grid, no query) | the longest label, "SPECIES PER HOUR", stays on one line; in the mockup that gives two columns in the 310px card body of a 390px phone, one in the 240px body at 320px, and one at 200% text | yes: the real card body widths at 320px and 390px (the mockup's frames are 2px narrower than a phone), and each tile's ink against its own cell |

**Owed in the built app, not done here:** the classic-scrollbar leg. The mockup's attempt at it did not take effect in the headless engines and is not claimed. The pair above is re-measured under a 15px classic scrollbar in the built app before it ships.

## Measurements taken in the mockup

Headless Chromium and WebKit (Playwright) on the mockup file, not the built app.

- **Containment and order.** 168 configurations across the two engines (four widths, 100% and 200% text, the three places, the three figure sets including the approved one, and the other jump-row placements), each reading both frames: no frame scrolls sideways, no text ink overhangs its card, tile, fact cell or ranked row by more than half a pixel, DOM order equals on-screen order, and the life list is the last section in every proposed frame. The probe's first run flagged the picker's ellipsized value at 13.7px to 182px over, a clip it had not yet been told to skip, so it can see an overhang.
- **The pair of thresholds, mirrored.** Frame widths from 860px to 1300px in 2px steps at 100% and 125% text, both layouts, both engines (442 readings a leg, overlay scrollbars): no width draws two columns over a stacked list. Two columns begin at a report width of 854px at 100% and 1,066px at 125%, in the shipped and the approved layout alike.
- **Length on a phone**, the hotspot with 126 species (100 rows shown), 100% text, the two engines agreeing:

| 390px phone | Today | Approved |
|---|---|---|
| Life list starts | 372px down the report | 5,168px down (about 7.8 screens of 660px) |
| The compact sections start | 9,720px down (about 14.7 screens) | 1,185px down (Map) |
| At a glance | none | 748px tall |
| Most-recorded species | none | 634px tall |

At 320px the approved life list starts 5,462px down and At a glance is 970px tall.

None of this replaces the built-app look.
