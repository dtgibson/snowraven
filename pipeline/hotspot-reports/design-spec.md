# Design Spec: Hotspot Reports

**Feature:** hotspot-reports
**Stage:** 4, The Designer
**Status:** first design direction, reviewed by the user on 2026-11-10. The user moved the tab's default position (decisions.md, D-03) and accepted the rest as drawn. Revisions amend this file and the mockup together.
**Mockup:** `pipeline/hotspot-reports/design.html` (self-contained). Its review bar switches the page shown (Overview, Hotspot report, Thin personal location), the viewport (Desktop, Phone 393, Phone 320), the theme, the text size, the hotspot classification (Answered, Some unanswered, No eBird key), the ML export, and on a phone the More sheet and its height cap. The journey is live: open the picker, type, choose a place from the picker or from either ranked list, choose Overview to come back. Every place opens a report; two are written by hand. A "Frames held still" section below the live page holds the states a live control cannot keep open.
**Design system:** `pipeline/design-system.md` applies in full. This feature extends it and mints no token. Recorded choices and the one deliberate pattern deviation are in `decisions.md`, D-01; flags for the Planner and Architect are in D-02.

## Visual Direction

A quiet reading page in SnowRaven's own register: the house tab header, one control that chooses the page, and cards of plain figures. A place is the subject, so its name is the largest thing on the page and its species total is the one figure set in the accent. Everything that is a kind, a state or a share is carried in words first and in a glyph or a bar second, never in a hue. The page reads as a sibling of Life Lists (the ledger row), Statistics (the hotspot partition and the weather distribution rows) and Species Detail (the headed section cards).

## Screens / Views

### Tab shell and header

- `TAB_LABELS['hotspot-reports']` is "Hotspot Reports". The tab root is `.sr-hsr-tab` (a column, `gap: 16px`).
- House header `.sr-hsr-head`: a 30px `--sr-accent-bg` tile, radius 8, holding the tab glyph at 15px / 2.2 in `--sr-accent`; `h2` "Hotspot Reports" at 1.125rem / 700 / -0.01em; one line beneath at 0.8125rem `--sr-text-muted`: "Your own record at any one place in your eBird backup, hotspot or personal location."
- Order inside the tab root: header, picker row, the always-mounted live region, the view (overview or report).

### The location picker (FR-18 to FR-25)

`HotspotReportsPicker.tsx`, a member of the house combobox family, drawn as the Life Lists Region picker at the 40px hero register.

- **Row** `.sr-hsr-pickrow`: a wrapping flex row, `gap: 6px 10px`. The label "Location" (`.sr-hsr-label.sr-ctl-label`, 0.6875rem / 700 uppercase, 0.06em, `--sr-text-muted`, `--sr-ctl-rem: 0.875rem`, `--sr-label-ratio: calc(11 / 14)`; its `id` is the input's `aria-labelledby`) sits beside the control at desktop width and above it on a phone.
- **Control** `.sr-hsr-picker`: `position: relative; flex: 0 1 34rem; min-width: 0; z-index: 20`.
- **Field** `.sr-hsr-field`: `min-height: 40px`, `padding: 0 4px 0 12px`, 1.5px `--sr-border-input`, radius 8, `--sr-surface`. lucide `Search` 15px / 2.2 in `--sr-text-muted` (`.sr-hsr-field-glyph`). The `<input type="text" role="combobox">` (`.sr-hsr-input.sr-input-16`: 0.875rem / 600, borderless, `padding: 7px 0`, `text-overflow: ellipsis`, `maxLength` 100; placeholder 500 `--sr-text-muted`). A trailing chevron `Button` (`.sr-hsr-chev.sr-touch-target`, 32px square, radius 6, `aria-label` "Show locations", `aria-expanded`; lucide `ChevronDown` 15px with its own class `.sr-hsr-chev-glyph`, rotated 180 degrees while open). `:focus-within` takes the `--sr-accent` border and the input ring's 4px `rgba(45,134,83,0.12)` halo; the input draws no ring of its own (the Region picker's rule, placed after the global ring block).
- **Value.** Closed, the input shows the selection: "Overview", or the location's bounded name (the placeholder wording "Unnamed location" for an empty name). Open, it is the typed query and the placeholder reads "Type a place name, county, or state". A 200-character name ellipsizes inside the closed input; the full bounded name is printed in the report header directly below, so no display bound is added (no new read over the name cell).
- **Listbox** `.sr-hsr-list` (`role="listbox"`, `aria-label` "Locations in your backup"): absolute, `left: 0; right: 0; top: calc(100% + 4px)`, `z-index: 1200`, `padding: 4px`, `--sr-surface`, 1px `--sr-border`, radius 10, `--sr-card-shadow`, `max-height: 24rem`, `overflow: auto`, `overscroll-behavior: contain`.
- **Rows** `.sr-hsr-opt` (plain `div role="option"`, no tab stop, no per-option handler, `id` `${useId()}-opt-${i}`): `min-height: 2.5rem`, `padding: 6px 10px`, radius 6, two lines.
  - Line one, the name: 0.8125rem `--sr-text`, `overflow-wrap: anywhere`, never truncated by CSS. A name over the bound is the first 200 characters plus the written ellipsis from the copy module. An empty name is "Unnamed location" in italics.
  - Line two, the meta line (`.sr-hsr-meta`, 0.71875rem `--sr-text-muted`, wrapping, items separated by an `aria-hidden` middle dot that travels with the item before it): the kind tag when the kind is known, the place label when there is one, the Location ID when another location shares both name and place, and the checklist count ("412 checklists", from `index.checklistCount[ord]`).
  - The first row is always "Overview" in italics (the species picker's clearing-row convention), with the meta line "All 214 locations".
  - Selected row (`aria-selected="true"`): name at 600 in `--sr-accent`, plus a trailing lucide `Check` 13px / 2.5 in `--sr-accent`. Active row (`aria-activedescendant`): `--sr-surface-subtle` with a 2px inset `--sr-accent` outline. Hover: `--sr-surface-subtle`, inside `@media (hover: hover)`.
- **Narrowing line** `.sr-hsr-more`: after the last option when more locations match than are drawn, a 1px `--sr-border-subtle` rule above it, 0.75rem `--sr-text-muted`: "Showing 200 of 214 locations. Type to narrow." It carries no role and no id.
- **No match** `.sr-hsr-nomatch`: the Overview row stays and one line follows, "No location matches."
- **Disabled (FR-08):** native `disabled` on the input and the chevron, the field `.is-disabled` (`--sr-surface-subtle` fill, `--sr-border` edge, `--sr-text-disabled` glyph, text and chevron, `cursor: not-allowed`), the value "Overview", and under the picker the sentence "Your eBird backup has no locations to report on." Nothing else renders.

### The kind tag (FR-15, FR-21, FR-32)

One component for the picker rows, the ranked rows and the report header: `.sr-hsr-kind`, an inline-flex pair of a 12px / 2.2 lucide glyph (`.sr-hsr-kind-glyph`) and its word at 600 in `--sr-text-muted`.

| Kind | Glyph | Word |
|---|---|---|
| hotspot | `MapPin` | Hotspot |
| personal | `Star` (the Map Explorer's personal-location pin mark) | Personal location |
| not yet known | none | none; the tag is not rendered and nothing stands in for it |

The word is ordinary text, so assistive technology reads it; removing color changes nothing. In the report header the tag is the eyebrow above the name (`.sr-hsr-eyebrow`: uppercase, 0.6875rem, 0.06em).

### Overview: general statistics before a choice (FR-26 to FR-30)

One card, `.sr-hsr-card` (`--sr-surface`, 1px `--sr-border`, radius 12, `--sr-card-shadow`, `overflow: hidden`), in two parts.

**Count block** `.sr-hsr-sum` (`padding: 18px 20px 16px`, a column, `gap: 12px`):

- The total: the figure at 1.75rem / 700 / -0.02em in tabular numerals, then "locations in your backup" at 0.8125rem `--sr-text-muted`.
- The split, capped at 36rem wide: Statistics' hotspot partition (`.sr-hs-figs`, `.sr-hs-bar`) with counts in place of percentages. "61 hotspots" at the row's start and "153 personal locations" at its end, each figure 1rem / 700 over a 0.6875rem label. The bar is 20px, radius 4, `aria-hidden`, no text inside: the hotspot segment in `--sr-chart-blue-dark` at the unrounded share with a 3px floor, the personal segment as the `--sr-surface-subtle` track.
- **Three states.**
  1. *Every location classified:* the two figures and the bar. No third figure, no reason.
  2. *Some not yet known:* the two known figures and the bar, with a third segment at the bar's end drawn as a dashed outline (`.sr-hsr-seg--unk`: `--sr-surface` fill, 1px dashed `--sr-border-medium`), then a status row (`.sr-hs-status`: a 14px muted `Info` glyph, "**8** not yet known.", and the reason beneath in 0.75rem `--sr-text-muted`).
  3. *Nothing classified (no eBird key and nothing stored):* no split and no bar. The total stands, with a status row: "Whether each is a hotspot or a personal location is not yet known." and the reason beneath, followed in the no-key case by the house link `.sr-proj-link` "Add a key in Settings". No location is called a hotspot or personal, and no zero figure is printed for either.
- Reason sentences, chosen by `kindReason` in FR-27's order: no key, "No eBird API key is saved, so hotspots and personal locations cannot be told apart yet."; checking, "Still checking which of your locations are eBird hotspots."; offline, "You are offline, and eBird has not been asked about some of your regions yet."; unanswered, "eBird has not answered for some of your regions yet."; no region, "These locations have no state or province in your backup, so eBird cannot be asked about them."
- One closing line in the note register (0.71875rem `--sr-text-muted`): "Choose a place with the picker above, or from either list."

**Ranked lists** `.sr-hsr-ranks`: a self-collapsing grid, `repeat(auto-fit, minmax(min(19rem, 100%), 1fr))`, with `gap: 1px` over a `--sr-border-subtle` ground so the hairline between the two lists appears whether they sit side by side or stacked. Each list `.sr-hsr-rank` has an `h3` in the SubLabel register ("Most checklists", "Most species") over an `ol`.

- Each row is one `Button` (`.sr-hsr-rankrow`): a grid `1.6rem minmax(0, 1fr) auto 14px`, `padding: 8px 12px`, radius 8. Rank in 0.75rem muted tabular numerals (`aria-hidden`); the name at 0.84375rem / 600, wrapping, never truncated; the meta line (kind tag, place, Location ID for namesakes) beneath; the figure at 0.9375rem / 700 tabular; a lucide `ChevronRight` 14px in `--sr-border-medium`. The unit ("checklists", "species") is in the DOM after the figure and visually hidden at desktop width, where the list's heading names it.
- Accessible name: the row's own text, so it contains the visible name and figure: "Home, Personal location, Marin, CA, L8841207, 1,204 checklists".
- Hover (inside `@media (hover: hover)`): `--sr-surface-subtle`, the chevron to `--sr-text`.
- Degenerate forms (ui.md, v1.0.3): with exactly one location each list is one sentence naming it with a `Button` that opens its report and no rank; a list with no qualifying location renders nothing, heading included.

### The report (FR-31 to FR-56)

`.sr-hsr-report` is a size container (`container-type: inline-size; container-name: sr-hsr-report`), a column with `gap: 16px`: header band, jump row, body. DOM order is reading order at every width: header, jump row, life list, map, protocols, weather, visits and media.

**Header band** `.sr-hsr-hero` (a card; a wrapping flex row, `gap: 16px 36px`, `padding: 20px 22px`):

- Identity (`flex: 1 1 22rem`): the kind tag as an eyebrow when the kind is known; the name as an `h3` (`.sr-hsr-name`, 1.375rem / 700 / -0.015em, line-height 1.25, `overflow-wrap: anywhere`, `tabIndex={-1}`, `outline: none`); beneath it the place label and, for a namesake, the Location ID, in the meta line register.
- A hotspot's name is `HotspotLink` in its full-name form (accent text, the external glyph bound to the last word). A personal or not-yet-known location's name is plain text.
- Totals (`flex: 1 1 20rem`): two figures side by side, each a micro-caps label (0.6875rem / 600, 0.07em) over a 1.625rem / 700 tabular figure. "Species" is in `--sr-accent` (the figure the page exists to answer); "Checklists" is in `--sr-text`. These are FR-50's totals.
- The rule sentence of FR-39 sits directly under the totals (`.sr-hsr-rule`, 0.71875rem, line-height 1.5, `--sr-text-muted`, at most 62ch). It is always visible.

**Jump row** `.sr-hsr-jump` (a `nav` named "Jump to section"): the Statistics jump-nav's chip (a `Link`, 0.71875rem / 500, `--sr-text-muted` on `--sr-surface-subtle`, 1px `--sr-border`, fully rounded, `.sr-touch-target`), one per section: Life list, Map, Protocols, Weather, Visits. `display: none` while the report is two columns; shown while it is one. A press scrolls the section into view and moves focus to its heading.

**Body** `.sr-hsr-body`: a grid, `minmax(0, 1fr) minmax(0, 24rem)`, `gap: 16px`, `align-items: start`. Under `@container sr-hsr-report (max-width: 55em)` it is one column and the jump row shows. The list is the first column; the other four sections stack in the second (`.sr-hsr-rail`, `gap: 16px`).

Every section is a card with the Species Detail section head (`.sr-hsr-sechead`: a 28px `--sr-accent-bg` tile, radius 7, a 14px / 2.2 glyph in `--sr-accent`, and an `h4` at 0.8125rem / 600 with `tabIndex={-1}` as the jump target) over a body padded `14px 18px 16px`.

**Life list** (`ListChecks`, "Life list"):

- Lead `.sr-hsr-lead`: the count sentence, the list's caption, in the Life Lists register (0.8125rem `--sr-text-muted`, the figure 700 in `--sr-text`, `tabIndex={-1}` for paging focus): "**126** species at this location, newest first by the date you first recorded each one here, with how many of your 412 checklists here include it."
- The list `.sr-hsr-ll` is a size container (`sr-hsr-ll`). Rows are `li` in an `ol`, each its own grid: `2.5rem minmax(0, 1fr) 5.6rem 1.5rem 5.25rem`, `column-gap: 14px`, `padding: 11px 18px 12px`, divided by `--sr-border-subtle`, every cell on the row's first line.
  - Position (right-aligned 0.75rem muted, `aria-hidden`, with the `.sr-only` "N of M." prefix in the name cell), counted from the oldest as on Life Lists.
  - The species through `<BirdName showSci>` with `onOpenSpecies`, the wrap scoped under `.sr-hsr-ll-name` (the box `width: 100%`, the name row `flex-wrap: wrap`, the scientific name `white-space: normal; overflow-wrap: anywhere`).
  - First date here: 0.75rem / 600 tabular, with an `.sr-only` "First recorded here" before it.
  - The checklist link: `ChecklistLink` as the 1.5rem icon box (`.sr-hsr-ll-cl`, `--sr-accent`, `--sr-accent-bg` on hover and focus, the local ring override after the global ring block).
  - Checklists the species is on: the figure right-aligned at 0.75rem (600 in `--sr-text`) over a 3px share bar (track `--sr-border`, fill `--sr-chart-slate`, a 2px floor, width the share of the location's checklists, `aria-hidden`, no animation). Its `.sr-only` text is "On 212 of 412 checklists here."
- A column header row `.sr-hsr-ll-cols` at wide widths, `aria-hidden`, on `--sr-surface-faint` in the 0.625rem / 700 uppercase label register: "Species", "First here", "Of 412 checklists" (right-aligned).
- Under `@container sr-hsr-ll (max-width: 30em)` the header row is gone and the row stacks: position, name, a 44px link rail; beneath the name one flowing line, "**Jul 26, 2026** · on **1** of 412 checklists", in 0.75rem `--sr-text-muted`; the bar is not drawn.
- Paging is the Life Lists row, unchanged (`.sr-lfl-paging`: "Show next 100", "Show all (126)", "Showing 1 to 100" with the en dash the shipped control uses), 100 rows a page; when the last rows appear focus moves to the count sentence.
- Empty (FR-38): the list is replaced by "No countable species at this location yet." (`.sr-hsr-empty`, centered, `--sr-text-muted`); the species figure reads 0 and every other section renders.

**Map** (`MapPin`, "Map"):

- With coordinates: `HotspotReportMap` (lazy) fills `.sr-hsr-map`, `height: 232px` (200px in the phone tier), flush to the card's edges under the head. One marker at the coordinates, no popup, no corner controls; `SnowMap`'s own zoom control and compact attribution as on every map. Accessible name "Map showing {name}". The `Suspense` fallback is the same class on `--sr-surface-subtle`, so the page does not move when the chunk lands. The gesture posture is the other in-page maps' (`cooperativeGestures`, `scrollZoom={false}`).
- Without coordinates: the head, then one sentence in the body register: "Your backup has no coordinates for this location, so there is no map." No map container is mounted.

**Checklists by protocol** (`ClipboardList`, "Checklists by protocol"):

- A group head (`.sr-hsr-grouphead`: the SubLabel "By eBird protocol" and, at the row's end, "**412** checklists" in the denominator register), then one distribution row per protocol (`.sr-wx-row.no-glyph`): label, rail, "**268** · 65%". Fills scale to the largest row. Order and bounds are the schema's (count, then name; ten named rows; "Other protocols"; "No protocol recorded" last). Under `.sr-hsr-proto` the label wraps (`white-space: normal; overflow-wrap: anywhere`) and the row aligns to its first line.
- A divider, the SubLabel "Complete checklists", and one sentence in the body register: "**92%** complete: 371 of the 404 checklists that say whether every species was reported. 8 do not say." The percentage is `fmtSharePct`. When none says: "None of your checklists here says whether every species was reported."

**Weather on your visits** (`CloudSun`, "Weather on your visits"):

| State | What is drawn |
|---|---|
| No block found (FR-49) | One sentence: "None of your checklists here carries a weather block." Nothing else. |
| Below the floor (FR-47) | The coverage sentence, then in the note register: "That is too few to summarize. Sky, temperature, and wind are shown once 10 of your checklists here carry a block." The 10 is read from `WEATHER_SPECIES_MIN_CHECKLISTS`. No band, no typical value. |
| At or above the floor (FR-48) | The coverage sentence; the source note; a divider; three groups. |

- Coverage sentence (body register): "**96** of your 412 checklists here carry a weather block SnowRaven can read." and, when any found block is unreadable, " 2 more carry a block it could not read."
- Source note: "From the weather blocks in your own checklist comments here. Nothing is looked up."
- Each group is the Statistics group form: a group head (the SubLabel "By sky", "By temperature" or "By wind", with its own denominator at the row's end: "**96** with a sky condition", "**94** with a temperature", "**88** with a wind reading"), then "Most common: **Few clouds**" (`.sr-hsr-typical`, 0.75rem, the band name 600 in `--sr-text`), then the rows, 16px between groups.
- Rows are the shipped distribution row in the app's own vocabulary and order: sky in `CONDITION_DISPLAY_ORDER` with its condition glyph, the seven temperature bands, the nine wind bands. Every band is drawn, including zero bands (the dashed empty rail, muted label). The most common band's row label is set at 700 (`.is-typical`).
- A figure whose own denominator is under the floor shows its rows and, in place of the "Most common" line, "Too few to name a most common one."

**Visits and media** (`CalendarDays`, "Visits and media"):

- Facts, a `dl` (`.sr-hsr-facts`; each row a wrapping flex pair, the term 8.75rem wide at 0.75rem `--sr-text-muted`, the value at 0.8125rem, rows divided by `--sr-border-subtle`):
  - First visit and Latest visit: `ChecklistLink` with the date as its visible label (accent, 600). One dated checklist shows one row, "Only visit". None: "None of your checklists here has a valid date."
  - Time birded: "**497 hours 30 minutes**" with, beneath in the note register, "over 398 of 412 checklists that recorded a duration". None recorded: "None of your checklists here recorded a duration."
  - Most species on one checklist: "**61 species** on" followed by the dated `ChecklistLink`. The row is omitted when no checklist here has a countable species.
- Divider; group head "Visits by month" with "**412** dated checklists"; twelve distribution rows (Jan to Dec, always twelve, count only, no share). When some checklists have no valid date the denominator reads "**404** of 412 checklists with a valid date".
- Divider; group head "Visits by year"; one row per year present, ascending; where the schema sums older years, the leading row is labeled "Before {first shown year}".
- Divider; the SubLabel "Photos, audio, and video"; three items in a wrapping row, each a 13px muted glyph (`Camera`, `Mic`, `Video`) with "**214** photos", "**37** audio recordings", "**3** videos"; then the note "Counted by the checklist each photo, recording, or video is linked to." With the ML export absent, one sentence instead: "Media counts need your Macaulay Library export." With it unreadable: "Your Macaulay Library export could not be read, so media is not counted here." Neither prints a zero.

### Phone (640px and under, and any report narrower than 55em)

Every phone-tier declaration goes inside the established 640px block, scoped to this feature's classes.

- **Order on a phone:** tab header, picker (label above, field full width), then for a report: header band (kind, name, place, the two totals side by side, the rule sentence), the jump row, the life list, then Map, Checklists by protocol, Weather, Visits and media. The list comes first because it is what the user came for; the jump row is how the four sections beneath a long list stay one tap away. Nothing collapses, so nothing is hidden.
- **Above the fold at 393 by 852:** the place's name and kind, both totals, the rule sentence, the jump row, and the head of the life list. List rows begin just below.
- **Life list density:** the stacked row is three lines (name with its marks, scientific name, one line of date and checklist share), about 82px, so eight rows show at once on the reference phone.
- Picker: `.sr-hsr-picker { flex: 1 1 100% }`; the field `min-height: 2.75rem`; the chevron a 2.75rem box; options `min-height: 2.75rem`; the listbox `max-height: 20rem`. `.sr-input-16` gives the input 16px, so iOS does not zoom on focus; the label keeps its ratio through `.sr-ctl-label`.
- Ranked rows: `min-height: 2.75rem`, and the figure moves to its own line under the meta line with its unit shown ("**1,204** checklists"), so no row carries an incompressible trailing figure beside a long name.
- Cards: header band `padding: 16px 14px`, name 1.25rem, totals 1.5rem; section heads `12px 14px 10px`, bodies `12px 14px 14px`; list rows `10px 12px 11px`; the map 200px.
- Distribution rows take their shipped phone form (identity on line one, the rail on line two, the label wrapping).
- Jump chips and paging buttons take the 2.75rem touch height.

### Navigation

- **Position:** between Breeding Codes and Checklists in `DEFAULT_TAB_ORDER`, the ninth of thirteen (the user's direction at the design review, decisions.md D-03). The default order reads Weather, Statistics, Map Explorer, Species Detail, Calendar, Targets, Multimedia, Breeding Codes, Hotspot Reports, Checklists, Life Lists, List Comparer, Named Birds. The phone bar's four cells are unchanged, so on a phone the tab is in More, its fifth row.
- **Glyph:** lucide `MapPinned` in `TAB_ICONS`, at the four nav sizes.
- **More sheet (FR-05):** with thirteen tabs the sheet holds nine rows plus Settings in its foot. Default drawn: the cap becomes `min(73dvh, 616px)`, so every destination shows with nothing to scroll on the reference phone and the sheet covers about 72% of its height. In the mockup, with the sheet's styles copied from `globals.css`, it measures 616px in Chromium and in WebKit at 393 by 852 with a 34px inset; 73 is the smallest whole dvh that holds 616px of 852px. The Engineer re-measures the built app in WebKit and moves the cap and `TabNav.test.tsx` together. On the 320 by 568 frame the viewport term binds and the list scrolls, as it does today on short screens; Settings stays pinned.

### States specified here and not drawn

Setup guidance and the load-failure state are the shared components (`SetupRequired`, `TabLoadErrorAlert` as the first child of every branch); the loading phase is the house `TabLoading`. Also not drawn, and specified above in words: the one-location overview, the empty life list, a location with no weather block, a weather figure under the floor, the unreadable ML export, the undated-checklist denominators, and the reasons other than no key and unanswered.

## Component Usage

- `components/hotspotReports/HotspotReportsTab.tsx`: the phase switch, the picker row, the live region, the view.
- `HotspotReportsPicker.tsx`: native `<input role="combobox">`; the chevron is `Button`; options are `div role="option"`; one `mousedown` handler on the listbox reading `data-i`; lucide `Search`, `ChevronDown`, `Check`, each with its own class.
- `HotspotReportsOverview.tsx`: the count block and the two ranked lists; ranked rows are `Button`; the no-key link is `Button.sr-proj-link`.
- `HotspotReportHeader.tsx`, `HotspotReportLifeList.tsx`, `HotspotReportProtocols.tsx`, `HotspotReportWeather.tsx`, `HotspotReportVisits.tsx`, and `HotspotReportMap.tsx` (the only importer of `SnowMap`, reached through `React.lazy`).
- Shared components used as they are: `BirdName` (`showSci`, `onOpenSpecies`, `hasEntry` true), `ChecklistLink` (icon form in the list, dated form in the facts), `HotspotLink` (full-name form, header only), `Link` for the jump chips, `SetupRequired`, `TabLoadErrorAlert`.
- The distribution row and group are the Statistics Weather section's (`.sr-wx-row`, `.sr-wx-rows`, `.sr-wx-track`, `.sr-wx-fill`, `.sr-wx-count`) with their shipped tiers. Whether the Engineer exports `DistRow` and `DistGroup` or renders the classes from this tab's own row component is the Architect's call (decisions.md, D-02).
- A kind tag component shared by the picker, the overview and the header; a meta line component shared by the same three.
- New lucide imports: `MapPinned`, `Star`. Everything else is already imported somewhere in the app.

## Design Tokens Applied

`--sr-bg`, `--sr-surface`, `--sr-surface-subtle`, `--sr-surface-faint`; `--sr-text`, `--sr-text-muted`, `--sr-text-gray` (scientific names), `--sr-text-disabled` (the disabled picker only); `--sr-border`, `--sr-border-subtle`, `--sr-border-medium`, `--sr-border-input`; `--sr-accent`, `--sr-accent-bg`; `--sr-chart-blue-dark` (the hotspot segment of the count bar, as on Statistics); `--sr-chart-slate` (the life list's share bars); `--sr-card-shadow`; the global input ring's `rgba(45,134,83,0.12)` halo. Map marker and basemap colors are `SnowMap`'s own. No new token.

Type: the place name 1.375rem / 700; figures 1.75rem (overview total), 1.625rem (report totals), 1rem (count split), 0.9375rem (ranked figures), all 700 tabular; tab heading 1.125rem / 700; body 0.84375rem and 0.8125rem; captions 0.75rem and 0.71875rem; labels 0.6875rem and 0.625rem uppercase. Inter / system-ui, as the design system sets.

## Interaction Notes

- **Picker.** Focus on the input, ArrowDown or ArrowUp on it, or the chevron opens the list with the query cleared and the selected row active (Overview when nothing is selected), scrolled into view inside the listbox only (set the listbox's `scrollTop`; never `scrollIntoView` on the option). Typing filters and makes the first location row active; with no match no row is active and Enter does nothing. ArrowDown and ArrowUp move and stop at the ends; Home and End jump; Enter chooses the active row; Escape closes and is consumed only while open; Tab closes and moves on; a press outside closes. A row is chosen on `mousedown` with `preventDefault`, so focus never leaves the input. After a choice the list is closed, focus is in the input, and the next focus, arrow or chevron opens it again.
- **Window.** With nothing typed and a selected location beyond the first 200 rows, the window slides so the selected row is drawn and active (the schema's settlement); the narrowing line reads the same.
- **Ranked row press.** Selects that location through the same handler as the picker, replaces the view, and moves focus to the report's name heading (`h3`, `tabIndex={-1}`, no ring). The heading exists in the report's first render. The picker's list stays closed. Focus is not sent to the picker, because focus there opens its list.
- **Live region.** One `role="status"` `aria-live="polite"` element, `.sr-only`, mounted in every ready render before its first message, holding a sequence-keyed child with only the sentence: "{name}: {S} species, {C} checklists." or "Overview: {L} locations."
- **Kinds.** When the hotspot Set changes, the tags in the open list, the count block, the ranked rows and the header update in place. Names do not move: the tag is on the meta line and the order never reads the kind.
- **Jump chip.** `jumpTo` the section card, then focus its `h4`.
- **Paging.** As on Life Lists.
- **Map.** Mounted only for a location with coordinates; re-centered by `jumpTo` on a change of location; unmounted when the selection has no coordinates or is cleared.
- **Tab stops.** The picker adds two (input, chevron). The overview adds one per ranked row and, with no key, the Settings link. The report adds the hotspot link, the jump chips while shown, each `BirdName` and its marks, each checklist link, the paging buttons, and the map's own attribution control.
- **Thresholds.** The 55em report threshold and the 30em list threshold were measured in the mockup; both are re-measured against the real containers in the built app under a classic scrollbar before they ship.

## Motion Spec

- Picker listbox open: `cubic-bezier(0.2, 0, 0, 1)`, 140ms, opacity with scaleY 0.92 to 1, `transform-origin: top left` (the field's own corner); close instant; reduced motion: the global block (instant); CSS keyframe `sr-hsr-list-in`.
- Picker chevron: ease-out, 140ms, rotate 180 degrees while open; reduced motion instant; CSS.
- Picker field focus: ease-out, 120ms, border color and halo; reduced motion instant; CSS.
- Overview to report, report to overview, report to report: `cubic-bezier(0.16, 1, 0.3, 1)`, 160ms, opacity with a 3px rise, on the view's one child keyed on the selection so it replays only when the selection changed; no origin (a content swap in place); reduced motion instant; CSS keyframe `sr-hsr-in` (the hotspot share block's entrance).
- Distribution bars (protocols, weather, months, years): the shipped `sr-wx-grow`, `cubic-bezier(0.2, 0, 0, 1)`, 300ms, width from zero, from the rail's leading edge; reduced motion shows the final width; CSS.
- Count bar's hotspot segment: the shipped `sr-hs-fill`, `cubic-bezier(0.2, 0, 0, 1)`, 240ms, scaleX from the left edge, when the state changed; reduced motion final state; CSS.
- Ranked row, option, chevron, paging button, checklist link hover: ease-out, 120ms, background color (and the ranked row's chevron color), inside `@media (hover: hover)`; reduced motion instant; CSS.
- Life list rows, share bars, the kind tags arriving, the map re-centering: no motion.
- More sheet: unchanged (220ms `cubic-bezier(0.2, 0, 0, 1)` rise from the bar, 160ms scrim).

## Content Notes

Plain, short, second person, American spelling, "weather" lowercase, no em dashes (U+2014). Every string lives in `lib/hotspotReportsCopy.ts`; count-bearing sentences are generated and swept over a generated corpus. Inside the page the terms are eBird's: hotspot, personal location. The tab is named only "Hotspot Reports".

| Constant | Wording |
|---|---|
| Tab description | Your own record at any one place in your eBird backup, hotspot or personal location. |
| Picker label, chevron, list label | Location; Show locations; Locations in your backup |
| Overview row and its meta | Overview; All {L} locations |
| Placeholder (open) | Type a place name, county, or state |
| Unnamed location | Unnamed location |
| Narrowing line | Showing {cap} of {N} locations. Type to narrow. |
| No match | No location matches. |
| No locations | Your eBird backup has no locations to report on. |
| Kind words | Hotspot; Personal location |
| Count total | {L} locations in your backup |
| Third figure | {U} not yet known. |
| Nothing classified | Whether each is a hotspot or a personal location is not yet known. |
| Overview hint | Choose a place with the picker above, or from either list. |
| List headings | Most checklists; Most species |
| Rule sentence (FR-39) | Counted as Life Lists counts: subspecies fold into their species, and spuhs, slashes, hybrids, and species the exotic status check on Statistics found to be escapees are left out. Statistics and Map Explorer count a place by their own rules, so their numbers for this place can differ. |
| Life list caption | {S} species at this location, newest first by the date you first recorded each one here, with how many of your {C} checklists here include it. |
| Column headers | Species; First here; Of {C} checklists |
| Section titles | Life list; Map; Checklists by protocol; Weather on your visits; Visits and media |
| Jump chips | Life list; Map; Protocols; Weather; Visits |
| Blank protocol, overflow row | No protocol recorded; Other protocols |
| Announcements | {name}: {S} species, {C} checklists. / Overview: {L} locations. |

The three tab names in the rule sentence are read from `TAB_LABELS`. The reason sentences, the weather sentences, the facts and the media sentences are given in their sections above. Nothing here is published copy; no README, website or store text is written at this stage.

## Decisions for the user

Settled at the design review of 2026-11-10 (decisions.md, D-03): item 1 by the user's direction, items 2 to 5 accepted as drawn. Item 6 stands at its default.

1. **Tab position.** Decided: between Breeding Codes and Checklists, inside More on a phone. The first direction drew it directly after Life Lists.
2. **More sheet.** Drawn: the cap raised to `min(73dvh, 616px)`, nothing to scroll on the reference phone. Alternative: keep today's cap and let the list scroll (the mockup's "Today's cap, scrolls" switch shows it).
3. **Map corner controls.** Drawn: none. Alternative: the share and fullscreen row the other in-page maps carry, which keeps the Help sentence about copying a location true as written; without it that sentence is re-scoped.
4. **Weather when thin.** Drawn: below 10 readable blocks the section states how many there are and summarizes nothing. Alternative: a floor of 5.
5. **Count block with nothing classified.** Drawn: no split, the reason stands in. Alternative: print 0 hotspots, 0 personal locations and the total as not yet known.
6. **Temperature's typical value.** Drawn: the most common band. Alternative: a mean in degrees, a new figure.

## Alternatives considered

- **Sections as collapsed disclosures above the list on a phone.** Reaches everything within one screen, at the cost of hiding the map and every figure until tapped, and of a second behavior per section to build and test. Rejected for the jump row, which hides nothing.
- **The map in the header band beside the name.** A stronger first screen on desktop; on a phone it pushes the list a quarter screen further down, and moving it below the list there would break the rule that DOM order is reading order. Rejected for the map at the head of the second column.
- **The life list last, after the compact sections.** Buries what the user came for under four cards. Rejected.
- **A glyph alone for the kind, in a fixed leading slot.** More compact; asks the user to learn two glyphs and leaves an empty slot for the third state. Rejected for the glyph with its word.
- **Kind as grouping in the picker.** Rows would move when the classification arrives. The schema forbids it.
- **A Recharts chart for months or weather.** Would need a second lazy chunk and a geometry module for a figure that reads well as rows. Not drawn.
- **A column chart for the twelve months.** Fails at 200% text and with five-digit counts. Rejected for rows.

## Measurements taken in the mockup

Headless Chromium and WebKit, the mockup file itself (not the built app). Text ink (client rects over a `Range` per text node) and every control, card, rail and the open listbox, measured against the tab panel's content box and against the clipping card: 360 configurations (three viewports: the 320px and 393px frames and desktop windows at 1360, 1000 and 760px; text at 100%, 150% and 200%; overview, the hotspot report and the thin personal report; classification answered and no key; picker closed and open on a query that lists the 200-character name; both engines), none over by more than half a pixel and none scrolling sideways. The probe flagged eight configurations before the kind tag was allowed to wrap, so it can see the defect it looks for. Picker behavior (open on focus with the selected row active, filter, Enter, focus kept in the picker, End stopping at the last option, the narrowing line, no-match, the two tab stops, the ranked-row focus landing, the live region idle and after each change) was read back in both engines. None of this replaces the built-app look the PRD's "live look" rows require.
