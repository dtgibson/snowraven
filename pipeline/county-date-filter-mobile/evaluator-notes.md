# Evaluator notes: county-date-filter-mobile

Supporting detail for `change-brief.md`. Measured 2026-09-22 against HEAD `f5e52a3`
and the current `frontend/dist` build (no `frontend/src` change since it was built).

## Every surface that renders a county filter and/or a date-range filter

There is no shared component. The same control is drawn five times, by hand, in
three different layouts.

| Tab (from `TAB_LABELS`) | File | Layout pattern | Phone result |
|---|---|---|---|
| Multimedia | `components/LifeList.tsx` ~769-850 | inline at the tail of the wrapping pill row (`.sr-ctl-row`), after a separator; county select, then a `.sr-field-row` holding From (icon wrapper), a bare `→` span, To | broken (the reported screenshot) |
| Breeding Codes | `components/BreedingCodeList.tsx` ~346-432 | same inline pattern, after a separator, only when counties exist | broken (date stack wraps alone under the sort toggle) |
| Species Detail | `components/SpeciesDetail.tsx` ~789-860 | same inline pattern, own `.sr-ctl-row`, plus a "Clear filter" button when active | broken (also photographed in the App Store iPhone screenshot, below) |
| Checklists | `components/Checklists.tsx` ~686-720 | a labeled row, "Where & when", that is itself the `.sr-field-row`: label, county, From, `→`, To, count | stacks into six full-width lines with a lone arrow line between two blank boxes |
| Map Explorer (sidebar) | `components/MapExplorer.tsx` ~2063-2082 | labeled panel sections, "Date Range" (two inputs, no arrow) and "County" | layout is fine (stacks full-width through the phone tier by design); the two date boxes are blank on iOS and not told apart |

Not surfaces of this control: `WeatherForecastPanel.tsx` (a single forecast date),
`NamedBirdRangeControl.tsx` (a last-sighting/today switch, not a date range),
Statistics and Calendar (county shading, no county or date filter), and
`App.tsx:1011` (a `.sr-field-row` consumer holding the Weather tab's checklist ID
field, which must not change).

Heights differ on every surface: 26px (Breeding Codes), 1.625rem (Species Detail),
1.75rem (Multimedia), 28px (Checklists), 34px (Map sidebar). The arrow is
`--sr-text-muted` at 0.6875rem on three surfaces and `--sr-text-disabled` at
0.75rem on Checklists, and is not `aria-hidden` anywhere, so VoiceOver reads a
"right arrow" between the two fields. None of the county or date controls is on
the v1.0.33 `.sr-pill` / `.sr-segbar` registers; every one is an inline drawing.

## Measured cause

Four probes, all against the shipped built stylesheet, with a markup replica
copied from the call sites.

1. **iOS WebKit (iPhone 17 Pro simulator, 402pt, Mobile Safari = the WKWebView
   engine the app ships on).** Reproduces the user's screenshot exactly. The
   separator sits at x=307, the last thing on line 1. Line 2 holds the county
   select (154 x 28, top 66) and the date group (135 x 87, top 36), with the
   county vertically centred against a three-row tower. Inside the tower From is
   135 wide, the arrow is a full-width row of its own, and To is **151 wide in a
   135 box**: the iOS date input reports a computed width of 134.66px and paints
   151px (UA `min-width: 102px`, `display: flex`). **An empty iOS date input
   paints no text at all** (no `mm/dd/yyyy`), so both boxes are blank; the only
   mark is the lucide Calendar glyph overlaid on From.
2. **Desktop WebKit and Chromium (Playwright, built CSS), 402/390/320px at 100%
   and 200% text scale.** Same tower in both engines at every width: 130px wide
   (WebKit) / 176px (Chromium) at 100%, never the row's width. At 200% the tower
   drops to its own line below the county, 174px / 237px wide, 153px tall,
   left-aligned. No page horizontal scroll anywhere (`scrollWidth` equals the
   viewport). Desktop WebKit shows a greyed date placeholder, so **the blank-box
   half of the defect is iOS-only and cannot be seen in Playwright**; the layout
   half reproduces in both engines.
3. **Checklists replica.** The "Where & when" row stacks into six full-width
   lines: label, county, From, a lone arrow line, To, then the count. 174px tall
   at 100%, 222px at 200%.
4. **Breeding Codes replica, 402px/100%.** The county stays on the sort line after
   the separator and the 130px date tower wraps alone onto the next line.

**The mechanism.** `.sr-field-row` at `max-width: 480px` is
`flex-direction: column` with `> *:not(.sr-only) { width: 100% }` (globals.css
~5489). It was written for a row that is full width on its own (the Weather
checklist field, the map sidebar, the Checklists row), where "100%" means the
panel. On Multimedia, Breeding Codes and Species Detail the `.sr-field-row` is a
shrink-to-fit flex ITEM inside the wrapping `.sr-ctl-row`, so "100%" resolves
against the group's own intrinsic width. The group becomes a narrow tower; the
arrow, as a flex item given `width: 100%`, becomes a line of its own; and
`.sr-ctl-row`'s `align-items: center` centres the county select against the
tower. The source comment on those three call sites ("stacks From/To full-width
<=480") states an intent that only holds where the row is itself full width.

Separately, each separator is a fixed 1 x 20 flex item, so whenever the pill row
wraps one can land at the end of a line (five do in the user's screenshot).

## Guard tests that pin this area

- `lib/filterControlSizeCss.test.ts`: the `.sr-ctl-row` / `.sr-input-16` floor,
  and that the map sidebar's `.sr-field-row` stacks inside the <=640 tier while
  the GLOBAL `.sr-field-row` stays at <=480 ("scopes the stacking to the map
  sidebar rather than moving the global tier").
- `lib/scrollLeakCss.test.ts`: every universal-child width rule on these rows
  carries `:not(.sr-only)` (the Checklists row holds a live region).
- `lib/controlRegisters.test.ts`: the `.sr-ctl-label` roster ("opts each of the 22
  paired labels in, and no unpaired one", per-file counts, and
  `<SidebarLabel ctlRem=` counted 5 times in `MapExplorer.tsx`); no inline
  border/background/height/fontSize on `.sr-pill` / `.sr-segbar-btn` call sites.
- `lib/breedingCodeFilterRowCss.test.ts` and `components/BreedingCodeList.test.tsx`:
  the Breeding Codes containment hooks stay off separators, sort, county and date
  controls, and no `min-width` rides a rule selected through `.sr-ctl-row`.
- `components/MapExplorerInputZoom.test.tsx`: both sidebar date inputs and the
  county select carry `.sr-input-16`, found by label text `From date` / `To date`
  / `County`.
- `components/SpeciesDetailChecklistFrequency.test.tsx`,
  `components/SubspeciesExplorer.test.tsx`,
  `components/SpeciesDetailCountableForms.test.tsx`: query the controls by
  accessible name `County`, `From date`, `To date`.
- `lib/tabOrderCoverage.test.ts`: any new button or link goes through `Button` /
  `Link`.

## Published-surface and screenshot consequences

- `appstore/screenshots/iphone-6.9/05-species-detail.png` **photographs this
  defect**: Species Detail at phone width with the county select beside a
  From / arrow / To tower (captured in Chromium, so its boxes show `mm/dd/yyyy`).
  1.0.33 is in review with it. Once the fix ships it is stale and needs a
  recapture (`website/tools/capture-appstore.mjs`) and a store-record update at
  that ship.
- `appstore/screenshots/iphone-6.9/06-breeding-codes.png` is scrolled past the
  filter row: unaffected.
- `appstore/screenshots/ipad-13/*` (1032pt) and every `website/assets/shots/*`
  image (1600px desktop; `statistics-mobile.webp` has no county or date filter)
  are above the 640px phone tier: unaffected **as long as the change is
  phone-tier only**.
- `docs/HELP.md` lines 206, 452 and 524 describe the filters in general terms
  ("County and date-range filters appear in the toolbar"); they change only if
  the Designer changes where or whether the filters appear.
- No `website/`, `README.md` or App Store listing copy is expected to change.

## Adjacent, deliberately left out

- ROADMAP "The Map Explorer sidebar's Date Range year clips at 641px": just above
  the phone tier, a separate measured defect.
- The 26px / 28px fixed heights holding 24px text at 200% on Breeding Codes and
  Checklists: pre-existing tightness recorded at v0.5.81. The Designer may take it
  in passing if the controls are redrawn, but it is not the reported problem.
