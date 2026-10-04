## First of Year on Species Detail (species-first-of-year)

### What this does
Adds a First of Year card to the Species Detail tab, directly after the Sightings and Media row: one row per calendar year with the first date the user reported the selected species that year, newest year first, each date opening its checklist on eBird. From two years on, a compact chart plots those first dates by day of year across the years, beside the rows on a wide screen and above them on a phone, so a steady arrival reads as a flat line and a missed year as a missing point. Everything is derived from the export already loaded, from the same in-scope rows as First seen, so it follows Show subspecies and the county and date filters with the rest of the tab.

### How to test
1. Load an eBird backup in Settings and open Species Detail.
2. Pick a species you have reported in several years. A "First of Year" card appears after the Sightings and Media cards: one row per year, newest first, each with the year and that year's first date in your date format.
3. Check the oldest row: its date and checklist are the same as the Sightings card's "First seen".
4. Click a date: its checklist opens on eBird in a new tab (in the Mac and iPhone apps, in the browser).
5. Hover a row, or Tab to its date: the row tints and that year's point grows in the chart. The chart itself takes no Tab stop.
6. Pick a species seen in one year only: one row, no chart. Pick a species with a missing year: the chart's line breaks at that year, with no point there.
7. Set a From date in the toolbar: the rows and the chart change with the Sightings card, and the line "First dates within the selected date range." appears above them. Clear it and the line goes. A county filter alone changes the rows and adds no line.
8. Turn Show subspecies on and pick a form: the rows are that form's own.
9. Narrow the window to phone width: the chart moves above the rows, each full width, with nothing scrolling sideways. Repeat at 200% text size (Settings, Text size) and in dark mode.

### Notes for reviewer
- New files: `lib/firstOfYear.ts` (the derivation: one pass, a strict ten-character YYYY-MM-DD check, the year and order from the string, a leap-aware day of year, no Date object anywhere), `lib/firstOfYearChartGeometry.ts` (the chart's box, axes, gap-filled points, month ticks, segments and year-label thinning as pure functions), `components/speciesDetail/FirstOfYearSection.tsx` (the card and rows) and `components/speciesDetail/FirstOfYearChart.tsx` (the lazy Recharts chart, the only new file that imports Recharts). Species Detail gains one memo and one mount line. The stylesheet gains the `.sr-foy-*` rules, with the phone declarations inside the established 640px tier block.
- The chart is lazy and its box is reserved at its final height and max width by the Suspense fallback (both read the geometry module), so nothing moves when it lands. Stated plainly: SightingsGraph already loads Recharts statically on this tab, so this keeps the section's own graph free of Recharts; it does not make Recharts load later.
- The chart measures its own width (PlanChart's shape) rather than using `ResponsiveContainer`, so the design's year-label thinning is decided in the same render that draws the labels. decisions.md E1 and E2.
- Accessibility: the rows are the complete record; every date is a `ChecklistLink` (the shared accessible name, id guard and own new-tab dispatch). The chart is one `role="img"` with one accessible name, everything inside `aria-hidden` and `inert`, `accessibilityLayer={false}`, no tooltip and no handlers of its own; the row hover and focus highlight is row state passed in as a prop.
- No network request, setting, stored document, cache, epoch, iCloud Sync, `clearDerived.ts` row or CSP change. The one new read over user-file text is the declared ten-character date scan (schema.md 7.1), held to at most ten character reads per row by a test.
- `docs/HELP.md` gains one bullet in the Species Detail section list, guarded by `lib/firstOfYearHelpClaims.test.ts`. No website, README, App Store or privacy-policy copy is proposed.
- Pre-existing defect found, not fixed here: `buildGraphData` (lib/sightingsGraph.ts, the Sightings Over Time data) loops forever on the default Monthly interval when a species' rows mix a malformed date with another month. decisions.md E12; saved as a fix idea.
- Tests: `lib/firstOfYear.test.ts`, `lib/firstOfYearChartGeometry.test.ts`, `lib/firstOfYearHelpClaims.test.ts`, `components/speciesDetail/FirstOfYearSection.test.tsx`, `components/speciesDetail/FirstOfYearChart.test.tsx` (real Recharts under jsdom), `components/SpeciesDetailFirstOfYear.test.tsx` (the real tab), and two paired rows in `lib/entryChunk.test.ts`. Every new guard was mutation-checked against its subject (decisions.md, Verification record).
- Not covered by the unit suite, and owed to The Tester: QA-29's real-engine reading (Chromium and WebKit, 320px and 200% text, both themes: page scroll width, row text, focus rings, chart inside its card).
- No version bump or changelog entry: the release step owns both.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
