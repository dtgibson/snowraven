# Change Brief — Hotspot report order and stats

## What is changing
The user asked for two changes to the per-place Hotspot Reports report: "make the life list last, since it can be long on mobile. Also, lets add more stats to the beginning, to the extent they apply to hotspots". (1) The Life list section moves to the end of the report at every width, so the short sections no longer sit below a list that can run to hundreds of rows on a phone. (2) A block of place-scoped figures goes at the top, directly under the header. These are the kinds of figure Statistics shows for the whole record, restricted to this one place, and each comes from fields the report already parses. Every figure that counts species follows the tab's one species rule (FR-36): it is computed from the per-checklist counts `applySpeciesRule` builds, never from `ChecklistEntry.speciesCount` or `computeEffort`. Those two count spuhs, hybrids and escapees here, and `computeEffort` applies no 24-hour duration bound. Files that change: `components/hotspotReports/HotspotReport.tsx`, `HotspotReportSections.tsx` (plus `HotspotReportHeader.tsx` if the block joins the header band), `lib/hotspotReportsLocation.ts`, `lib/hotspotReportsCopy.ts`, the `.sr-hsr-*` layout in `globals.css`, `docs/HELP.md`, their suites, `website/tools/verify/verify-hotspot-reports.mjs`, and the six-file version set. Unchanged: the index pass, the picker, the overview, the map, the weather derivation, the ML join, storage, transport, every network path, and Statistics itself, whose modules are read for definitions only.
- **Recommended for the opening block** (single figures, no new pass over rows):
  - **Days birded here:** distinct dates of dated checklists, from an integer Set over `checklistDay`.
  - **Years birded here:** the span with its count (Statistics' Years Active), with the year count exposed from `deriveLocationFacts`.
  - **First and latest visit:** moved up from Visits and media (FR-51, unchanged).
  - **Time birded plus average checklist length:** FR-53, with the average as minutes over counted.
  - **Most species on one checklist:** moved up (FR-54).
  - **Species per hour:** the mean, over checklists with a usable nonzero duration, of each checklist's species under the rule per hour (Statistics' Key metrics).
  - **First species here and newest species here:** the oldest and newest life-list rows, each with date and checklist link (Statistics' First species ever).
- **Offered for the design review** (each applies and is cheap, but adds length or a list):
  - **Distance traveled here:** total and average over the checklists that recorded one, shown only when any did. It sums the existing distance field and needs a stated plausibility bound, as FR-53 has for duration.
  - **Most-recorded species here:** the top ten by how many checklists here include each. This is the life list's own figure, so no new pass.
  - **Highest counts here:** the top ten species by their largest single count on one checklist, from a per-species maximum over countable rows in the existing species loop.
  - **Species on only one checklist here:** a count only.
  - **Party size:** solo share, average observers and largest group.
  - **Longest gap between visits:** from consecutive distinct days by integer day arithmetic, never by stepping across the span and never through `Date`.
- **Left out:**
  - Locations, states, countries and Geographic Stats: one place makes each trivial.
  - Any Count all forms or Count escapees switch, and anything that starts the exotic status check: FR-56 forbids switches, and the check runs only from Statistics, over the network.
  - Projects: it makes an eBird request per checklist.
  - Breeding Stats and tide figures: both are named exclusions in the brief and in FR-56, so re-opening them is the user's call.
  - Data Quality shares: low value at one place, and the comment shares would be new reads over comment text.
  - The accumulation chart and milestone badges: a new chart surface on this tab.
  - Biggest single day: it would be a second "most species" figure, counted a different way.
  - Individuals figures and Shannon diversity: FR-36 has no rule for individuals.
  - Day-of-week, start-hour and duration distributions, and per-protocol averages: these are distributions, not opening figures.
  - Most photographed species: it widens the declared ML join.
  - Frivolous Lists: they cover the whole record.

## Why now
- The user asked on 2026-11-12, the day after 1.0.71 shipped the tab. The life list comes first after the header and pushes every other section far down on a phone, and the top of the report carries only the two totals.
- The shipped order and the closed set of figures were deliberate (FR-31, FR-56, and the brief's "this set and no more"). This change reverses them by the user's direction and is recorded as a reversal.
- Feature check: passed, and the work stays in Improve. It is the same surface, with no new screen, flow, control, schema, stored value or request. Every new figure is one Statistics already shows for the whole record, restricted to the place this report already covers and taken from fields already parsed. The work becomes New Feature if a chosen figure needs a network call, a switch or filter, a stored value, or a Breeding or tide section.

## User-facing impact
- **Reading order:** header, then the new opening figures, then the remaining sections, with the Life list last, at every width. Help's "Five sections follow" sentence and its wide-layout sentence change in the same change, with no approval stop.
- **Totals:** new figures open every place's report. The Species and Checklists totals and the rule sentence stay in the header and are not repeated (FR-50).
- **What is counted:** nothing changes. The species total, life list, protocols, weather and media read exactly as in 1.0.71.
- **Published copy:** the README, website and App Store sentences stay true, so no edit is needed; an optional one-sentence update would only be a proposal. The website frame's alt text names the life list in view, so it becomes false once the frame is recaptured. That makes it a held proposal that waits for the user's yes.
- **Screenshots:** `website/assets/shots/hotspot-reports.webp` and the three App Store `07-hotspot-reports.png` frames (iPhone 6.9-inch, iPad 13-inch, iPhone Duo) are captured from the top of the report, so all four go stale. They are regenerated from demo data and the user decides each image before the release goes out. No other frame changes, since the navigation is unchanged.
- **Other:** no network, storage, privacy-policy or accessibility-statement change. A patch bump ships to all platforms.

## Design pass
Needed.
- **Surfaces:**
  - The per-place report's section order, in one column (phones, narrow windows, 200% text) and in two.
  - The new opening figures block under the header.
  - The jump row.
- **What should feel better:** on a phone the report opens on a summary of the place, and every short section comes before the long list.
- **Decisions for The Designer, with the user at the review:**
  - Which shortlisted figures to show and how to arrange them. Statistics already has registers for stat tiles and fact lists, so no new token or pattern unless the Designer argues for one.
  - Whether first and latest visit, time birded and the biggest checklist move into the block, and what Visits and media is then called.
  - The order of map, protocols, weather and visits.
  - The two-column form. Today the list runs down the left beside a 24rem rail, and a list that comes last in the DOM cannot sit on the left without breaking reading order (no `order` or grid-area reordering, per ui.md).
  - Whether the jump row stays. Its D-01 reason, that the long list sits above the other sections, no longer holds.
- **Constraints:**
  - The report's 53.25em threshold was derived from the list beside the rail (D-07). Any new two-column form re-derives its thresholds and re-measures them in the built app, per grid cell, under a classic scrollbar, in both engines (ui.md v1.0.71).
  - Each new figure states its denominator where one applies.
  - A ranked list follows the many / one / none rule.

## Decisions touched
- **`pipeline/hotspot-reports/prd.md`:**
  - FR-31 (reading order and jump row): MODIFIED. The life list goes last and the opening block comes after the header.
  - FR-56 and the strategic brief's Scope line ("other statistics, this set and no more"): REVERSED IN PART by user direction. The exclusions of filters, switches, a gallery, and tide, breeding-code and named-bird sections are KEPT.
  - FR-50 (totals in the header, not repeated): KEPT.
  - FR-36 (one species rule): KEPT, and extended to every new figure that counts species.
  - FR-51, FR-53, FR-54: figures unchanged, possibly moved.
  - NFR-01 (no new request, host or endpoint), NFR-03 (rendered output bounded; any new ranked list capped at ten), NFR-05 (only per-location work after a snapshot change) and FR-58 (nothing persisted): KEPT.
- **`pipeline/hotspot-reports/decisions.md`:**
  - D-01: "the other statistics stay in their own card" and the jump row's reason are MODIFIED.
  - D-07 (the coupled 53.25em / 28em pair): RE-DERIVED if the two-column form changes, with the 28em list threshold re-measured against the list's new container.
  - D-18 and D-25 (the held harness): its thresholds and window legs follow D-07.
- **`DECISIONS.md` v1.0.71 Hotspot Reports entry:** "The container thresholds are a coupled pair" is touched as D-07. "One counting rule for a place" is APPLIED.
- **`.claude/rules/ui.md`:** its coupled-pair rule cites this report's 53.25em as the example, so the Chronicler updates that example if the threshold moves.
- **Not touched:** D-03 (tab position), D-08 (More sheet cap; no new destination), and D-26 I1 and I2 (left as recorded unless the Engineer opens those functions).

## What done looks like
- **Layout:** on a phone (320px, 200% text) and in a wide window, a place's report reads header, opening figures, other sections, life list last. Nothing scrolls sideways, Chromium and WebKit agree, and the held harness passes with any new thresholds.
- **Figures and tests:** each new species figure equals what the life list and FR-36 imply, under test, and each figure states its denominator. Full vitest, typecheck, eslint and the build are green, Help matches the report, and the network suite still shows no new request.
- **Sign-off:** the user has had a live look at the built app, approved any published-copy change, and decided each regenerated frame before the release ships.
