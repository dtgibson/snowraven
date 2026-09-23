# Change Brief — County and date filters on small screens

## What is changing
On phones, the county filter and the date-range filter should read as two clear,
aligned controls: a county picker, and one "from, to" date range whose empty
fields say what they are. Today, on Multimedia, Breeding Codes and Species Detail,
the date range collapses into a narrow tower (a blank box, a lone arrow, a second
blank box) that sits beside the county picker with the picker centred against it.
Checklists stacks the same pieces into six lines with the arrow on its own line,
and the Map Explorer sidebar shows two blank, untold-apart date boxes. The filtering
itself (what the controls do, their state, their results) does not change.

## Why now
The user reported it from the shipped 1.0.33 iPhone app with a screenshot of the
Multimedia tab (`user-report-iphone.png`).

## Measured cause
Two mechanisms, reproduced on the iOS simulator and in desktop WebKit and Chromium
against the built stylesheet (detail and figures in `evaluator-notes.md`):
1. `.sr-field-row` stacks its children at 480px and below and makes each one
   `width: 100%`. That was written for a row that is full width on its own. On three
   tabs the date group is a shrink-to-fit item inside the wrapping filter row, so
   "100%" means the group's own narrow width: the fields stack into a 130-176px tower,
   the arrow becomes a line of its own, and the county picker is centred against it.
2. iOS paints an empty date input with no text at all, and three of the five surfaces
   have no visible label, only a screen-reader name. So the boxes are blank.
Also: separators dangle at wrapped line ends; five surfaces, five control heights.

## Scope
Changes (as the Designer decides): the county and date-range controls on
`components/LifeList.tsx` (Multimedia), `BreedingCodeList.tsx` (Breeding Codes),
`SpeciesDetail.tsx` (Species Detail), `Checklists.tsx` (the "Where & when" row),
`MapExplorer.tsx` (sidebar date fields, labelling only); phone-tier rules in
`globals.css`; the guard tests below, extended deliberately. A new supporting file
(say, one shared date-range group) is fine if it only reshapes existing behaviour.
Does not change: filter logic and state, `lib/`, backend, storage; the Weather tab's
`.sr-field-row` consumer (`App.tsx`); `WeatherForecastPanel.tsx`; the `.sr-pill` /
`.sr-segbar` registers and Breeding Codes pill hooks; desktop and iPad (above 640px).

## User-facing impact
Phone widths (640px and below) only: the county and date controls on five tabs look
and wrap differently, and empty date fields become identifiable. Desktop, iPad and
every filtered result stay the same.

## Design pass
**Needed.** Surfaces: the county and date-range controls on Multimedia, Breeding
Codes, Species Detail, Checklists, and the Map Explorer sidebar's date fields.
What should feel better: the range reads as one "from, to" unit, never two orphaned
boxes; county and dates align and wrap predictably from 320 to 430px, at 100% and
200% text size; an empty date field says what it is on iOS; the separator that
introduces the group never dangles at a line end (the pill row's other separators
are the Designer's call, named as a whole-row change if taken). Constraints and
options belong to the Designer; the constraints are listed in `evaluator-notes.md`
and summarised in the hand-back.

## Decisions touched
None reversed. Touched, and each must hold:
- v0.5.37 responsive sweep: `.sr-field-row` is the mechanism; extend with a scoped rule, never redefine it (six consumers).
- v0.5.81 filter text size: `.sr-ctl-row` hook, one `max(floor, rem)` size for every control in a filter block.
- v0.5.82 Map Explorer focus-zoom: sidebar-scoped stack; rules live in the feature's subtree; probes are not renders for native controls.
- v0.5.86 Breeding Codes row hooks: stay off separators, sort, county and date controls.
- v1.0.4 scroll leaks: `:not(.sr-only)` on every universal-child width rule (the Checklists row holds a live region).
- v1.0.33 control registers: `.sr-ctl-label` pairing and its counted 22-label roster, `--sr-ctl-rem`, pin a property at its surface.
- `pipeline/design-system.md` Filters clause (native `<select>`, paired native date inputs); Checklists' three labelled rows (`pipeline/checklists-tab/decisions.md`).

## What done looks like
On an iPhone (iOS render, not only Playwright, since the blank-box half is iOS-only),
at 320, 390 and 402px and at 100% and 200% text size, each of the five surfaces shows
the county picker and a readable, labelled from-to range with no lone arrow line, no
dangling separator before the group, and no page sideways scroll. Desktop renders
byte-identical, and every existing filter test still passes.
