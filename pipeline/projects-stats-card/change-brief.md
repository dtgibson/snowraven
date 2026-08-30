# Change Brief — Projects Stats Card

## What is changing
The Projects card on the Statistics tab (`SectionCard` in `BirdingStats.tsx`
mounting `ProjectsSection.tsx`) reads tall and empty: a status block, note
sentences, then sparse full-width text rows (project rows and portal rows)
stretched across a panel up to 1280px wide, with most of each row blank.
The improvement densifies the layout and adds a chart visualizing the
checklists-per-project/portal shares the view already derives (the
`ProjectsView` rows: label, checklists, share of checked, date span).
Rendering only; the data layer, sweep, and store are untouched.

## Why now
Saved user idea: "the projects stats card looks tall and empty. Let's fix it
so it looks nicer, and perhaps displays a chart of the projects the user has
participated in." Pure visual refinement of an existing card, so it fits the
Improve lane with a design pass.

## User-facing impact
The Projects card looks denser and more visual: same facts, plus a chart of
project/portal participation. No new data, no new network calls, no new
controls beyond what the chart itself needs. All states (idle, running,
complete, error, empty) keep their current meaning and announcements.

## Design pass
Needed. The surface is the Projects card on the Statistics tab; what should
feel better is its density and visual interest: less dead horizontal space in
the rows, a participation chart (recharts + existing `--sr-chart-*` /
`--sr-*` tokens, both themes, decorative charts wrapped `inert`), holding
WCAG 2.1 AA at 320px and 200% text scale. Constraints the design must keep:
project identifiers are never links (FR-29), the live-region/progress
structure in `ProjectsSection.tsx` stays intact, and the portals block stays
visually subordinate to projects.

## Decisions touched
"The projects store persists two raw fields and nothing derived" (2026-08-27,
v1.0.5): touched, not reversed. The chart must derive at render time from
`deriveProjectsView` output; no aggregate is persisted and the store,
admission policy, and Check again chokepoint are out of scope.

## What done looks like
The card presents the same facts in a tighter layout with a participation
chart, correct in both themes, AA at 320px/200%, all controller states
rendering sensibly (chart only when there is something to chart, per the
degenerate-list rule). Count-bearing copy stays in `projectsCopy.ts`. Tests
green including `ProjectsSection.test.tsx`; patch version bump in BOTH
`frontend/package.json` and `src-tauri/tauri.conf.json`, CHANGELOG entry,
and `docs/HELP.md`/`README.md`/`website/` updated if the card's described
behavior shifts.
