# PRD - First of Year on Species Detail
**Feature:** species-first-of-year
**Date:** 2026-10-03
**Stage:** 2 - The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

A new section on the Species Detail tab that lists, for the selected species, the first date it was reported in each calendar year present in the tab's current observation set, each date opening its eBird checklist, with a compact chart of those first dates by day of year across the years. It is derived entirely from the loaded eBird export; nothing is fetched or stored.

## Terms used below

- **In-scope observations**: the Species Detail tab's existing `speciesObs` set: the selected species' rows after the Show subspecies merge and the county and date-range filters, with no further exclusion. This document never defines a different set.
- **Well-formed date**: an observation `date` string of exactly the shape `YYYY-MM-DD` whose month is 01 to 12 and whose day is within that month's length for that year (February has 29 days in a leap year: a year divisible by 4, except a year divisible by 100 that is not divisible by 400).
- **Year row**: the pair (year, first observation) this feature derives for one calendar year.
- **First seen**: the tab's existing Sightings card value, `sightingsStats.firstObs`, computed by `computeSightingsStats` over the same in-scope observations.
- **Date format**: the app's user-selected date format, as produced by the existing `formatDate` function (month-first, day-first or ISO).

## User Stories

> **US-01** - As a birder with several years of eBird history, I want to see the first date I reported a species in each year, so that I know when it usually shows up for me.

> **US-02** - As a birder checking this year's arrival, I want this year's first date to appear beside the earlier years' first dates, so that I can tell whether this year was early or late against my own record.

> **US-03** - As a birder reading a per-year first date, I want to open the checklist it came from on eBird, so that I can see the whole outing that produced it.

> **US-04** - As a birder who reads patterns faster than lists, I want a compact chart of the first dates by day of year across the years, so that a steady arrival, a drift earlier or later, and a year I missed the bird each read at a glance.

> **US-05** - As a birder using the tab's county or date filters, I want the per-year first dates to follow the same filters as every other section, so that the tab never shows me two different answers for one bird.

> **US-06** - As a birder using a screen reader or a keyboard, I want the per-year dates to be a complete, reachable record on their own, so that nothing is told only by the chart.

## Functional Requirements

### Derivation

> **FR-01** - The app shall derive year rows from exactly the in-scope observations. No observation in that set is excluded for being a non-countable form, an escapee, or any other reason except FR-03, and no observation outside that set is included.

> **FR-02** - For each distinct calendar year among the in-scope observations with a well-formed date, the app shall produce exactly one year row, whose observation is the one with the lexicographically smallest date string in that year. Where two or more observations share that smallest date, the year row's observation shall be the first of them in the observations' existing order (file order), which is the same rule `computeSightingsStats` uses for First seen.

> **FR-03** - An observation whose date is not well-formed shall contribute no year row and shall not be the observation of any year row. This is the only exclusion this feature adds, and it is a shape check on one already-parsed field.

> **FR-04** - The year of an observation shall be the first four characters of its date string, and the ordering of dates shall be the lexicographic ordering of the date strings. The result shall be identical on every device regardless of the device's time zone, locale or clock.

> **FR-05** - The day of year of a date shall be computed from the string's month and day with a leap-aware table: January 1 is day 1; February 29 is day 60 of its year; March 1 is day 61 in a leap year and day 60 otherwise; December 31 is day 366 in a leap year and 365 otherwise.

> **FR-06** - A calendar year with no in-scope observation with a well-formed date shall produce no year row (a gap year). Year rows are never interpolated, zero-filled or inferred.

> **FR-07** - The current calendar year shall be treated exactly like any other year: its year row, when present, holds the smallest well-formed date in that year so far. The derivation shall not read the clock.

> **FR-08** - Invariant with First seen: whenever First seen's date is well-formed, the earliest year row's observation shall have the same date and the same submission id as `sightingsStats.firstObs`, under every combination of Show subspecies, Show all forms, Show escapees, county filter and date-range filter. (Show all forms and Show escapees change which species the selector offers, not which rows a selected species has, so while the species stays selected they leave the year rows unchanged.)

> **FR-09** - Changing Show subspecies, the county filter or the date range shall update the year rows and the chart in the same render as every other section of the tab; the section shall never show rows derived from a previous species, switch state or filter.

### The section

> **FR-10** - When the in-scope observations yield zero year rows, the app shall render no part of the section: no heading, no empty-state box, no note.

> **FR-11** - When the in-scope observations yield one or more year rows, the app shall render the section with one row per year row and no other rows.

> **FR-12** - Each row shall show the four-digit year and that year's first date in the app's date format. The date is the row's checklist link (FR-15). No row shows a day-of-year number.

> **FR-13** - Rows shall be ordered by year, newest year first, in every render. (The order is fixed; there is no sort control.)

> **FR-14** - The current calendar year's row shall carry no marker, note or styling that other rows do not, unless OQ-01 is resolved otherwise. If a marker is ever added, the year it marks shall be read from a session constant set once when the module loads, never from a clock read during render.

> **FR-15** - Each row's date shall be a checklist link to that year row's observation, rendered through the shared `ChecklistLink` component with the formatted date as its visible label, so it carries the component's existing accessible-name formula, external-link glyph, id-shape guard (`^S\d{1,15}$`) and new-tab dispatch. A year row whose submission id fails the guard shall show the formatted date as plain text with no link.

> **FR-16** - The section's heading and any caption shall remain true when a date-range filter is active. Default: the heading reads "First of Year"; while a date-range filter is active, the section shows one muted line, "First dates within the selected date range." While no date-range filter is active, that line is absent. (A county filter needs no line: a first date within a county is still the first of that year there, and the tab's filter strip names the county.)

> **FR-17** - The section shall sit on the Species Detail tab among the existing per-species sections, in the visual register of the Sightings and Sightings Over Time cards (same card, heading and type conventions), at the position The Designer specifies. It shall render in every body state in which the Sightings card renders and in no state where FR-10 applies.

### The chart

> **FR-18** - The chart shall render only when there are two or more year rows. With exactly one year row the section shows that row and no chart, no chart placeholder and no sentence about the missing chart.

> **FR-19** - The chart's horizontal axis shall be the calendar year, spanning every integer year from the earliest year row to the latest year row, continuously. A gap year occupies its position on the axis and has no point.

> **FR-20** - The chart's vertical axis shall be the day of year (FR-05), increasing upward, labeled with abbreviated month names at month boundaries rather than with day numbers. The number of month labels shown may vary with the chart's height, but January and December shall always be labeled when the axis spans them, and labels shall never overlap.

> **FR-21** - Each year row shall be drawn as one point at (year, day of year). Consecutive years that both have a year row shall be connected by a line segment; no segment shall cross a gap year, so a gap reads as a missing point and a broken line, never as a value.

> **FR-22** - The chart shall use the tab's existing graph tokens (`--sr-graph-*` and the surrounding `--sr-*` tokens) for every color, so it renders correctly in both themes with no hardcoded color.

> **FR-23** - The chart shall contribute no information that the rows do not. It shall expose a single accessible name stating what it charts and that the dates are listed in the rows (for example, "First of year by day of year, one point per year. The dates are listed above."), and its internal elements shall add no tab stop and no separately announced content.

> **FR-24** - The chart shall be loaded lazily, and the space it will occupy shall be reserved at its final height before it loads, so that nothing on the page moves when it appears. The chart's height for a given width shall be a pure function the host can call without loading the chart library.

> **FR-25** - The chart shall have no hover tooltip and no pointer or keyboard interaction unless OQ-02 is resolved otherwise.

### Help and held copy

> **FR-26** - `docs/HELP.md` shall gain, in the Species Detail section's list of sections and at the position matching the section's place on screen, one bullet describing the section: one row per year with the first date and its checklist link, the chart appearing at two or more years, that it follows the tab's Show subspecies switch and the county and date filters, and that it reads only the loaded export. The bullet shall follow the file's existing register and the standing copy rules (NFR-05, NFR-06).

> **FR-27** - If any sentence is wanted for the website, README, App Store listing or privacy policy, the build shall write it only as a held proposal in `pipeline/species-first-of-year/held-copy.md`, at most one sentence for the Species Detail section of each surface, and shall not write to `website/`, `README.md`, `appstore/` or `PRIVACY_POLICY.md`. The default is that no such sentence is proposed.

## Non-Functional Requirements

> **NFR-01 - Accessibility:** The section meets WCAG 2.1 AA at a 320px viewport width and at 200% in-app text scale in both themes: no horizontal page scroll is introduced, no text is clipped, every row's link is reachable by Tab through the canonical `Link` primitive (which `ChecklistLink` already uses) and has a visible focus indicator, and all text meets the contrast ratios the tokens guarantee. The rows are the accessible alternative to the chart (FR-23).

> **NFR-02 - Theming:** Every color in the section and chart is a `var(--sr-*)` token defined in both themes. No hex, RGB or named color appears in the component or chart source.

> **NFR-03 - Performance:** The derivation is one pass over the in-scope observations, with any sort applied only to the per-year results (bounded by the number of distinct years). On a species with tens of thousands of in-scope observations the section adds no perceptible delay to switching species or filters, and the derivation re-runs only when the in-scope observations change.

> **NFR-04 - Network and storage:** The feature makes no third-party request, adds no new endpoint or host, moves no request between components, and adds no stored document, cache, iCloud Sync change or `clearDerived.ts` row. Its only input is the observation array already in memory; its result lives in a render-time memo discarded with that array.

> **NFR-05 - Copy:** No em dash (U+2014) appears in any user-facing string of the feature, in the Help text, or in this pipeline folder's records. Spelling is American.

> **NFR-06 - Copy accuracy:** No user-facing sentence of the feature claims "first of the year" unconditionally in a state where a date-range filter can make it false (FR-16), and no sentence states that the feature works offline or makes no network call as a selling point; the register is the tab's existing informational register.

> **NFR-07 - Bundle:** The chart library stays off the app's entry chunk; the existing `entryChunk.test.ts` guard remains green, and the section's non-chart part (rows, heading, note) renders without the chart chunk.

> **NFR-08 - Correctness of dates:** No `Date` object participates in deriving a year, ordering dates or computing a day of year (FR-04, FR-05). The results for an observation dated `2024-02-29` are identical whether the process time zone is UTC, America/Los_Angeles or Pacific/Kiritimati.

> **NFR-09 - Security:** The one scan this feature adds over user-file-derived text is the well-formed-date check of FR-03, an anchored fixed-shape test on a field of at most the row's date length, linear in that length, and it is declared as such in the Architect's schema. Submission ids reach a URL only through `ChecklistLink`'s existing guard and encoding.

## Out of Scope

- Any Calendar change, including the deferred lifer/first-of-year overlay (ROADMAP, Calendar follow-ons). This feature is a precedent for it, not a dependency, and settles "first of year" only where the species is fixed.
- Any Statistics change, including a cross-species "earliest arrivals this year" view.
- Last-of-year dates, departure dates, arrival-to-departure spans, average or median arrival, or any comparison against eBird's regional bar charts.
- Any network call: no eBird, taxonomy or other request, and no reuse of a cached network answer.
- Any new stored document, cache, iCloud Sync change, `clearDerived.ts` row or persisted preference.
- A new toolbar switch, a sort control for the rows, a "count all forms" control (Species Detail has none; that is a Calendar control), or any change to the existing Show subspecies, Show all forms or Show escapees switches.
- Widget, Alerts, Targets, Map Explorer or native (Rust, Swift) changes.
- Changes to `computeSightingsStats`, the Sightings card or First seen.
- A hover tooltip, point selection, zoom, scroll or any other chart interaction (OQ-02 default).
- A visual marker on the current year (OQ-01 default).
- Writing to `website/`, `README.md`, `appstore/` or `PRIVACY_POLICY.md`. A held proposal in the pipeline folder is the only permitted form (FR-27).
- A change to the date-format preference or to `formatDate`.

## Open Questions

> **OQ-01** - Should the current year's row be visibly marked as in progress? Default: no marker; the current year is an ordinary row (FR-14). If The Designer adds one, it reads the year from a module-level session constant and never from a render-time clock.

> **OQ-02** - Should the chart offer a hover tooltip naming the year and date under the pointer? Default: no tooltip and no interaction (FR-25); the rows carry every date, and a tooltip would add nothing a keyboard or screen-reader user could reach.

> **OQ-03** - Where does the section sit on the tab? Default: directly after the Sightings and Media card row and before the Subspecies and Forms section, full width, in the same card register as Sightings. The Designer may move it among the per-species sections; FR-26's Help bullet follows the final position.

> **OQ-04** - Should the rows be newest-first or oldest-first? Default: newest first (FR-13), because the usual question is about this year against earlier years, and the chart already reads oldest to newest left to right. The Designer may reverse it; whichever is chosen is fixed, with no sort control.

> **OQ-05** - How should a row read when the species was seen in only one year? Default: the single row renders exactly as it would among many (FR-11, FR-18), with no sentence such as "seen in one year only"; the absence of a chart is the only difference.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01: observation set | Unit test: a fixture whose in-scope rows include a hybrid, a "(Domestic type)" form and an escapee-tagged row yields year rows that consider all of them; a row outside `speciesObs` (another species, filtered county, out-of-range date) never appears in any year row. |
| QA-02 | FR-02: smallest date per year | Unit test: a year holding dates 2023-04-02, 2023-03-30 and 2023-11-01 yields the 2023-03-30 observation. |
| QA-03 | FR-02: tie resolution | Unit test: two observations on 2022-05-05 with different submission ids, in file order A then B, yield A; reversing the file order yields B; the chosen id equals `computeSightingsStats` on the same two rows. |
| QA-04 | FR-03: malformed dates | Unit test: rows dated "", "2024-13-01", "2023-02-29", "24-03-01" and "2024-3-1" produce no year row and are never a year row's observation; a sibling well-formed row in the same year is chosen instead. |
| QA-05 | FR-04, NFR-08: string-based year and order | Unit test: the derivation runs with `Date` replaced by a constructor that throws, and produces correct results; results for 2024-02-29 are byte-identical under `TZ=UTC`, `America/Los_Angeles` and `Pacific/Kiritimati`. |
| QA-06 | FR-05: leap-aware day of year | Unit test: 2024-01-01 is 1, 2024-02-29 is 60, 2024-03-01 is 61, 2023-03-01 is 60, 2024-12-31 is 366, 2023-12-31 is 365, 2000-03-01 is 61, 1900-03-01 is 60. |
| QA-07 | FR-06: gap years | Unit test: observations in 2019, 2021 and 2022 yield exactly three year rows with those years; 2020 is absent from the rows; the chart's year axis domain spans 2019 to 2022 with no point at 2020. |
| QA-08 | FR-07: current year | Unit test: an observation dated in the current calendar year yields an ordinary year row; the derivation module is checked by source scan to contain no `Date.now`, `new Date(` or clock read. |
| QA-09 | FR-08: First seen invariant | Property test over randomized fixtures (species, merge on/off, county filter on/off, date range on/off, Show all forms on/off, Show escapees on/off): wherever `sightingsStats.firstObs.date` is well-formed, the earliest year row's date and submission id equal `firstObs.date` and `firstObs.submissionId`; toggling Show all forms or Show escapees with the species still selected leaves the year rows deep-equal. |
| QA-10 | FR-09: filter parity | Component test: changing the date range, county filter and Show subspecies each re-renders the section from the new `speciesObs` in the same commit as the Sightings card; no row from the previous state remains. |
| QA-11 | FR-10: zero rows | Component test: a species whose in-scope observations are empty (or all malformed) renders no heading, no list and no note for this section; the section's root element is absent from the DOM. |
| QA-12 | FR-11, FR-12: row content | Component test: three year rows render exactly three rows, each containing the four-digit year and `formatDate(date)` for the active date-format preference (checked under month-first, day-first and ISO), and no day-of-year number. |
| QA-13 | FR-13 / OQ-04: order | Component test: rows for 2021, 2024 and 2019 render in document order 2024, 2021, 2019 (or the Designer's fixed reverse, if OQ-04 is changed, in which case this row's expected order is updated once). |
| QA-14 | FR-14 / OQ-01: current year unmarked | Component test: the current year's row has the same class list and the same accessible text shape as other rows (under the OQ-01 default); if a marker is adopted, a source scan shows it reads a module-level constant and no clock. |
| QA-15 | FR-15: checklist links | Component test: each row's date is a `ChecklistLink` with `label` equal to the formatted date; its accessible name is `{formatted date}: open checklist on eBird (opens in a new tab)`, the component's existing formula; a row with submission id "junk" renders the date as plain text with no anchor. |
| QA-16 | FR-15: own dispatch | Existing `newTabLinkDispatch.test.ts` stays green and a runtime row through `frontend/src/test/tauriOpener.ts` shows a click on a row's link sends exactly `https://ebird.org/checklist/{id}` for the clicked row. |
| QA-17 | FR-16: filter copy | Component test: with no date range set the muted note is absent; with a date range set the note "First dates within the selected date range." is present; a county filter alone adds no note; the heading never contains "of the year" in a form the note does not qualify. |
| QA-18 | FR-17: placement and body states | Component test: the section renders in each body state where the Sightings card renders; a snapshot of its heading and card classes matches the Sightings card register. |
| QA-19 | FR-18: chart threshold | Component test: one year row renders rows and no chart container, placeholder or sentence; two year rows render the chart container. |
| QA-20 | FR-19: year axis | Unit test on the geometry module: year rows for 2017 and 2023 yield an axis domain of [2017, 2023] with one tick per integer year; a gap year has no point datum. |
| QA-21 | FR-20: month axis | Unit test on the geometry module: the tick set at every supported chart height includes January and December, every tick sits on a month boundary's day of year, labels are abbreviated month names, and no two labels overlap at that height. |
| QA-22 | FR-21: points and segments | Unit test on the chart data shape: year rows 2019, 2021, 2022 yield three points and exactly one connecting segment (2021 to 2022); the 2019 point stands alone; no segment spans 2019 to 2021. |
| QA-23 | FR-22, NFR-02: tokens | Source scan of the section and chart files finds no hex, `rgb(`, `hsl(` or named color literal; every color value is `var(--sr-`. A stylesheet test asserts any new `--sr-*` token is defined in both `:root` and `[data-theme="dark"]`. |
| QA-24 | FR-23, NFR-01: accessible chart | Component test: the chart wrapper has exactly one accessible name stating what it charts and that the dates are in the rows; Tab from the last row link leaves the section without stopping inside the chart (zero focusable elements inside the chart subtree). |
| QA-25 | FR-24, NFR-07: lazy, no shift | Component test: the chart module is a dynamic import; the fallback's height equals the geometry function's height for the same width, so the section's measured height is unchanged before and after the chart chunk resolves. `entryChunk.test.ts` stays green with no recharts edge from the section's static graph. |
| QA-26 | FR-25 / OQ-02: no interaction | Component test (default): the chart renders no tooltip element and no pointer or key handlers of its own. |
| QA-27 | FR-26: Help | Test: `docs/HELP.md`'s Species Detail section list contains one bullet naming the section, stating one row per year, the checklist link, the two-year chart threshold, and that it follows Show subspecies and the county and date filters; the bullet sits at the position matching OQ-03's resolution; `helpToc.test.ts` stays green. |
| QA-28 | FR-27: held copy only | `git diff` of the build touches none of `website/`, `README.md`, `appstore/`, `PRIVACY_POLICY.md`; if `held-copy.md` exists it holds at most one sentence per surface. |
| QA-29 | NFR-01: 320px and 200% | Real-engine check (Chromium and WebKit) at 320px and 200% in-app text scale, both themes: `document.scrollWidth` equals the viewport width, no row text is clipped, every row link shows a focus ring on Tab, and the chart fits its card. |
| QA-30 | NFR-03: linear derivation | Unit test: a generated fixture of 100,000 in-scope observations across 30 years derives in one pass (an instrumented iteration counter equals the row count plus a sort over at most 30 year rows); a CPU-time ratio test through `frontend/src/test/cpuTiming.ts` shows 10x rows cost no more than about 10x time. |
| QA-31 | NFR-04: no network or storage | Source scan of the feature's files finds no `fetch`, `transport.`, `storage.`, `replayStore`, `clearDerived` or iCloud import; `cacheInventory.test.ts` is unchanged and green; a test spying on `fetch` during render records zero calls. |
| QA-32 | NFR-05, NFR-06: copy | Scan of the feature's user-facing strings, the Help bullet and `pipeline/species-first-of-year/*.md` finds no U+2014; strings use American spelling; no string claims offline or no-network as a feature. |
| QA-33 | NFR-09: declared scan | The Architect's schema names the well-formed-date check as the feature's one scan over user-file-derived text with its linearity argument; the implementation is an anchored, fixed-shape test with no unbounded quantifier. |
