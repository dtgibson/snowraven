# Change Brief — Calendar Date Placement (v0.5.63)

## What is changing
The Calendar tab's day-of-month numbers move between its two views; the v0.5.62 toggle
LABELS ("Compact" = big `MonthGrid`, "Large" = `YearOverview` thumbnails) and internal
values (`'months'`/`'overview'`) stay UNCHANGED. Two moves: (1) REMOVE the day-of-month
number from the big `MonthGrid` cells — delete the three `{desc.day != null && <DayCorner …/>}`
renders in `DayCellButton` (Calendar.tsx ~L176 nodata, ~L200 zero, ~L228 data); big cells
keep shading + count only, returning to the pre-v0.5.61 look. (2) ADD the day number back to
`YearOverview`'s `MiniDayCell` thumbnails (restore the v0.5.60 mini-cell number span) AND
restore the `.sr-cal-minimonth` `container-type: inline-size` + `@container (min-width: 152px)`
legibility floor in globals.css (currently retired — see the L700-701 "no container query is
needed" comment). Thumbnails show shading + a small day number (no count). The `DayCorner`
component itself stays (still used by the mini-cells' restored number).
(3) REMOVE the cross-view link: in `YearOverview`, each `MiniMonth` is currently a `<button>`
(aria-label "Open {month} in the month view") whose click runs `expandMonth` → `setViewMode('months')`,
jumping the user into the big-grid view. The user finds this confusing. Make the overview
mini-months NON-interactive — convert `MiniMonth` from a `<button>` to a static container (month
name as readable text + the shaded, now-numbered thumbnail), and remove the `expandMonth`/`onExpand`
plumbing. View switching happens ONLY via the Compact/Large toggle. Confirm no OTHER cross-view
link exists (nothing in `MonthGrid` jumps to the overview); neither view links to the other.

## Preview-driven additions (confirmed live with the user during preview)
While previewing, the user approved the three changes above and requested three
popup enhancements, all folded into this same v0.5.63 run:
(4) The year-overview ("Large") DAY cells open the same day popup in place (real
per-day `<button>`s reusing the grid's `onOpen`) — restoring day-detail access
that change 3 removed, WITHOUT reintroducing any cross-view/month navigation.
(5) Each popup checklist row shows the checklist's start TIME and LOCATION
(threaded through `DayCell.checklists` from the already-loaded backup; location is
deliberate PLAIN TEXT — no HotspotLink/network, to keep the Calendar offline).
(6) Each popup row also shows that checklist's distinct SPECIES COUNT (countable
by default, with-forms when the toggle is on — per-submissionId sets mirroring the
day-level accumulation; additive display fields, day counts unchanged).

## Why now
User reviewed v0.5.62 and is unhappy with two of its date-placement choices (day numbers on the
big grids; the earlier label swap). Explicitly re-confirmed this run via a binary question —
"Keep names, move dates" — so labels stay put and only the numbers move. Off-roadmap user request.

## User-facing impact
Yes — intended and visible. Big month grids lose their per-day date corner (count only again);
whole-year thumbnails regain a small per-day date number (with the sub-152px legibility hide).
No count/metric value changes. Phone still forces the (now dateless) big-grid "Compact" view —
acceptable per the user's choice; flagged for sign-off. The overview months stop navigating to the
big-grid view (they become read-only); the big-grid day popup + interactivity are unchanged, and
the Compact/Large toggle is the only way to switch views. HELP.md L234-241, README, and website
copy currently describe the opposite placement and must be corrected.

## Decisions touched
- v0.5.61 "day-of-month in every big Large-view cell" — REVERSED (numbers leave the big grids).
- v0.5.60 "mini-cell day numbers + 152px container-query floor" — RESTORED (v0.5.62 had removed both).
- v0.5.62 (DECISIONS.md L7) — PARTIALLY reversed: only its date-placement half. Its combined-view
  CURRENT-YEAR alignment (item 1, incl. Feb-29 pinning) and the label swap (item 3) are NOT touched.
Still binding & untouched: the union/sum count invariants, `--sr-cal-*` ramp, `calendarContrast.test.ts`,
`calendarTextures.test.ts`. Chronicler logs this as the 2nd Calendar run to reverse/restore prior decisions.

## What done looks like
Big grids render count-only (no date corner); thumbnails render shaded + a small day number that
disappears below the 152px cell floor; labels/values unchanged; combined-view alignment + Feb-29
cell preserved; vitest/typecheck/lint/build green with the two calendar tests updated (see the
Feb-29 hazard); docs (HELP/README/website) corrected; version 0.5.63 in both manifests + CHANGELOG.
