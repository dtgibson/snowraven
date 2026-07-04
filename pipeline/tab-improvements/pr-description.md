# tab-improvements (v0.5.59) — three small tab enhancements

One patch release bundling three display/UX improvements to existing tabs, all built on existing patterns. No new data model, no new network calls, no privacy-policy change.

## 1. Named Birds — sighting duration

Each Named Birds row now shows a subtle second line under its first-seen–last-seen date range with the elapsed span between the first and last sighting ("2 yrs. 3 mos.", "5 mos.", "5 days", single sighting → "1 day").

- New pure helper `formatSightingDuration(from, to)` in `lib/formatDate.ts` — reuses the module's lexical `parseParts` (timezone-safe), returns `''` on null/invalid (never throws). Y/M/D diff with a 30-day month-borrow (a deliberate display approximation), formatted most-significant-first with correct singular/plural. Because it operates on fixed date strings (never `Date.now()`), it is render/memo-safe per `react-hooks/purity`.
- Rendered in `NamedBirdRow.tsx` as a `var(--sr-text-muted)` line (0.6875rem, one tier under the date) inside a small right-aligned column, so the date + duration stay a unit when the header wraps on phones. The sighting count is unchanged.

## 2. Calendar — per-species filter

A new **Species** `<select>` ("All species" default) narrows the whole calendar — every day cell, the shading tiers, the legend, and the day popup — to one species.

- `buildDayCells(observations, view, speciesFilter?)` gained an optional third arg (a normalized common name). Rows are filtered **before** bucketing, so the metric/tiering/legend/popup pipeline is unchanged — it just operates over a smaller `DayCellMap`. `metricCount`/`nonZeroMetricCounts` are untouched.
- `Calendar.tsx`: session `selectedSpecies` `useState` (no storage seam); a sorted, deduped normalized species list derived from the observations; a native `<select>` in the primary control row with an explicit `aria-label`; the filter threaded into the `cells` memo. The spuh/include-forms toggle is disabled while a concrete species is selected (a normalized name has no forms to admit).
- **Semantics (new decision to log):** filter matches the **normalized** parent name, so subspecies/form parentheticals fold into the parent. Under a filter the Species metric is a 0-or-1-per-day presence and Checklists counts the checklists that recorded the species; combined view folds that one species across years.

## 3. Map Explorer — locator dot + Labels/Dots toggle (Nearby Lifers + Media Targets)

Every Nearby Lifers and Media Targets marker now carries an always-visible locator dot at its exact coordinate, and each of those two panels has a **Marker Style** `SegControl` (Labels | Dots).

- `NearbyLiferMarkers.tsx` and `TargetMarkers.tsx`: added a `markerMode: 'labels' | 'dots'` prop and an `aria-hidden` locator dot (11px circle, tier fill via the existing `--sr-map-target-*` tokens, a white ring for basemap legibility). In Dots mode the visible label chip is `display:none`, but the real `<button>`, its `aria-label`, and popup behavior (click/Enter/Space) are unchanged. `TargetMarkers`' `escHtml`-escaped media-icon label markup is preserved — only its visibility is gated, never its escaping.
- `MapExplorer.tsx`: two session `useState`s (`liferMarkerMode`, `targetMarkerMode`), a "Marker Style" `SegControl` with an explicit `aria-label` in each panel (beside Time Range), threaded to the marker components and folded into each component's remount `key`.

## Tests

- `lib/formatDate.test.ts` — same-day, multi-day, multi-month (plural), multi-year (+ years+months), month-borrow, reversed range, empty/invalid.
- `lib/calendar.test.ts` — null filter unchanged, filtered per-species counts, Checklists counts checklists recording the species, form-folding, combined cross-year, empty-year blank.
- `components/Calendar.test.tsx` — the Species select + options, disabling the spuh toggle + sub-line note, no storage-seam persistence.
- `components/map/NearbyLiferMarkers.test.tsx` — locator dot presence, dots-mode label hiding, popup still opens.
- `components/map/TargetMarkers.test.tsx` (new) — same contracts, plus the escaped label chip preserved.

## Gates (from `frontend/`)

- `npm run typecheck` — clean (`tsc -b`).
- `npm run lint` — clean.
- Targeted test files — 6 files, 123 tests pass. Full suite — 112 files, 1374 tests pass.
- `npm run build` — succeeds.

## Version / docs

Bumped `frontend/package.json` + `src-tauri/tauri.conf.json` to 0.5.59; updated `CHANGELOG.md`, `docs/HELP.md`, `README.md`, and `website/` (feature copy + version pill/footer). `PRIVACY_POLICY.md` unchanged (no new network/telemetry/providers).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
