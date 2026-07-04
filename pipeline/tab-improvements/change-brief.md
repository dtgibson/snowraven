# Change Brief — tab-improvements batch (v0.5.59)

**Lane: Improve (confirmed).** These are three small enhancements to *existing* tabs built entirely on *existing* patterns — a pure duration string, a species `<select>` like the ones other tabs already ship, and a DOM-marker locator dot plus a session-only `SegControl` view toggle. No new data model, no new network call, no strategy/PRD, and no open brand/design space (each approach is specified concretely by its scout). The one genuinely new decision is small and closeout-loggable: the **per-species meaning** of the Calendar filter (stated below). None of the three needs strategy or new data; there is **no blocking flag**.

The batch ships as one patch release **v0.5.59** with the usual close-out: bump BOTH `frontend/package.json` and `src-tauri/tauri.conf.json` (both currently `0.5.58`) to `0.5.59`, update `CHANGELOG.md`, `docs/HELP.md`, `README.md`, and `website/` (feature copy + version pill/footer) in the same change; then push + tag + `./release.sh` per CLAUDE.md.

**User-facing impact (this batch DOES add visible controls/info):**
1. A new secondary **sighting-duration** line under each Named Birds row's date range (e.g. "1 yr. 2 mos.", "5 days").
2. A new **"Species" `<select>`** on the Calendar tab ("All species" default) that narrows the whole calendar to one species.
3. A visible **locator dot** at each Nearby Lifers / Media Targets marker's exact coordinate, plus a new per-panel **"Marker style: Labels | Dots"** `SegControl` toggle.

**Decisions touched:** Likely **none in `DECISIONS.md` are being changed**. One NEW small decision to LOG at closeout: the Calendar per-species filter semantics (change 2) — record that a selected species filters observations *before* `buildDayCells` derivation, that filtering is by **normalized** common name (folds subspecies/form parentheticals into the parent), and that the spuh/include-forms toggle is disabled while a concrete species is selected.

---

### 1 Named Birds sighting duration

**What is changing.** Each Named Birds row header currently shows a date range ("first – last seen") and a sighting count. Add a small secondary line showing the **elapsed span** between first and last sighting (e.g. "1 yr. 2 mos.", "3 mos.", "5 days", "1 day"). Display-only; no sort/filter/data change.

**Files / symbols.**
- `frontend/src/lib/formatDate.ts` — add a new pure helper `formatSightingDuration(fromDate, toDate)` alongside the existing `formatDate` / `formatDateRange`; reuse the module's `parseParts` (line 49) for lexical, timezone-safe parsing.
- `frontend/src/components/NamedBirdRow.tsx` — the trailing date-range `<span>` group (lines 67–74); render the duration under `formatDate(bird.firstSeen) – formatDate(bird.lastSeen)`. Import `formatSightingDuration`.
- Source data: `NamedBird.firstSeen` / `lastSeen` (fixed `YYYY-MM-DD` strings, `lib/namedBirds.ts` lines 28–29, set at lines 87–88/101–102).
- Tests: `frontend/src/components/NamedBirdsTable.test.tsx` (or a new `formatDate` unit block) for the duration strings.

**Proposed approach (concrete).** Add `formatSightingDuration(from, to): string` to `formatDate.ts`: parse both via `parseParts`; return `''` if either is null (never throws, matching the module contract). Compute a Y/M/D diff with month-borrow (approximate 30-day borrow is acceptable for a display label), then format most-significant-first: years+months → "N yr(s). M mo(s).", years only → "N yr(s).", months → "N mo(s).", else "N days" (same-day → "1 day"). Because `firstSeen`/`lastSeen` are fixed strings (never `Date.now()`), the helper is **pure and render/memo-safe** per the `react-hooks/purity` rule. In `NamedBirdRow.tsx`, stack the duration as a second line under the date range using `var(--sr-text-muted)` at one tier smaller than the date (~`0.6875rem`), keeping the existing sighting-count element; the parent already `flexWrap`s for phones.

**Decisions / semantics.** "Duration" = calendar span between the first and last recorded sighting of that named individual, inclusive-ish. It is a rounded human label (year → month → day granularity), not an exact day count; the 30-day month-borrow is a deliberate display approximation.

**Edge cases.** Same-day (single sighting, `firstSeen === lastSeen`) → "1 day". Missing/invalid date → `''` (no crash, no stray line). Multi-year spans show years + months. Singular/plural handled ("1 mo." vs "2 mos.", "1 day" vs "5 days"). Colors via tokens only; layout wraps as a unit on phones (existing `flexWrap`).

**What done looks like.** Every Named Birds row shows the date range with a subtle duration line beneath it; single-sighting rows read "1 day"; the helper returns `''` for bad input; new unit tests cover same-day / multi-day / multi-month (plural) / multi-year and the empty-input case; `npm run build` + vitest green.

---

### 2 Calendar per-species filter

**What is changing.** The Calendar tab shows counts across **all** recorded species per day. Add a **"Species" `<select>`** (default "All species") that narrows the calendar to a single species. When a species is selected, every day cell, the shading tiers, the legend, and the day popup reflect only that species.

**Files / symbols.**
- `frontend/src/lib/calendar.ts` — `buildDayCells(observations, view)` (line 103): add an optional third parameter `speciesFilter?: string` (a normalized common name; `undefined` = all). Filter at the top of the observation loop: `if (speciesFilter !== undefined && normalizeSpeciesName(o.commonName) !== speciesFilter) continue`. `metricCount` / `nonZeroMetricCounts` need **no change** — they read the already-filtered `DayCellMap`.
- `frontend/src/components/Calendar.tsx` — add `selectedSpecies` state (session `useState`, no `storage` seam); derive a sorted, deduped species list from `observations` via `normalizeSpeciesName`; add a `<select>` in the primary control row (the `.sr-wrap-flex` row at ~line 737, beside the existing `SegControl`s); thread the filter into the `buildDayCells` memo (line 594) and into `nonZeroMetricCounts` via the same `cells` memo (line 598); disable the spuh/include-forms toggle (line 792, `textures`/`includeForms` region) while a concrete species is selected.
- Tests: `frontend/src/lib/calendar.test.ts` — new cases for the `speciesFilter` parameter.

**Proposed approach (concrete).** Pass `speciesFilter` as a separate optional arg (not folded into the `CalendarView` union — it is orthogonal to year/combined). Filtering happens **before** derivation, so `buildDayCells` stays a single pure pass and the metric/tiering/legend/popup pipeline is unchanged — it simply operates over a smaller `DayCellMap`. UI is the native `<select>` (keyboard- and touch-accessible out of the box, responsive inside `.sr-wrap-flex`) with an explicit `aria-label` per the filter-control convention; "All species" is the reset option; the list is normalized common names sorted A–Z. Style with `var(--sr-*)` tokens to match the adjacent controls.

**Decisions / semantics (the NEW decision to log).**
- **OFF ("All species", default):** exactly today's behavior.
- **ON (one species):** derive over observations where `normalizeSpeciesName(o.commonName) === selectedSpeciesNorm`, then apply the existing metric + view toggles on top.
- **Metric meaning under a filter:** *Species* metric becomes a 0-or-1-per-day presence of that species; *Checklists* metric = the number of checklists that recorded that species that day. Combined view aggregates that one species' occurrences across years via the existing union/sum semantics.
- **Normalization folds forms:** the filter matches the **normalized parent** name, so subspecies/form parentheticals ("Dark-eyed Junco (Oregon)") collapse into the one selectable "Dark-eyed Junco" — intentional and consistent with the app's subspecies-folding elsewhere.
- **Spuh/include-forms toggle:** disabled while a concrete species is selected (a normalized name has no forms to include), matching the scout's decided behavior.

**Edge cases.** Species with no data in the selected year → all cells blank, empty legend (existing empty-input path handles it). Combined mode with a filter → that species' cross-year occurrences only. A spuh-only entry (e.g. "Gull sp.") selected → matches its own normalized row; toggle disabled so no confusion. Filter persists across year navigation and metric switches within a session; it is not persisted across relaunch (session `useState`).

**What done looks like.** A "Species" dropdown sits in the Calendar control row; selecting a species repaints the grid, tiers, legend, and popups to that species and disables the spuh toggle; "All species" restores the current behavior exactly; `buildDayCells` unit tests confirm (a) null filter unchanged, (b) filtered counts count only that species, (c) combined cross-year aggregation, (d) empty-year blank grid. `npm run build` + vitest green.

---

### 3 Maps location markers + toggle

**What is changing.** The Nearby Lifers and Media Targets marker chips float without a clear anchor to their exact coordinate. Add (i) a small **locator dot** at each marker's anchor point (always visible), and (ii) a session-only **"Marker style: Labels | Dots"** `SegControl` in each of those two sidebar panels that switches between the full label chip and a minimal dot.

**Files / symbols.**
- `frontend/src/components/map/NearbyLiferMarkers.tsx` — the per-location `<Marker anchor="left">` + `<button>` (lines 62–73); add a locator dot element and a `markerMode: 'labels' | 'dots'` prop.
- `frontend/src/components/map/TargetMarkers.tsx` — the parallel `<Marker>` + `<button>` (lines 77–88); same dot + `markerMode` prop (its label uses `dangerouslySetInnerHTML` with `escHtml`-escaped media icons — preserve that; only gate its visibility).
- `frontend/src/components/MapExplorer.tsx` — add two session `useState`s (`liferMarkerMode`, `targetMarkerMode`), one `SegControl` in each panel (near the existing "Time Range" `SegControl`s at ~lines 1793/1936), and pass `markerMode` to the marker components at their call sites (lines 2192 / 2195). Fold `markerMode` into each component's existing `key` so a mode switch cleanly remounts, consistent with the current `key={\`${...length}-${viewMode}\`}` convention.
- Shared helpers reused as-is: `neutralizeMarkerWrapper` (`lib/mapPins.ts`), `tierColors` / `recencyTier` (`lib/mapExplorerFormat.ts`), tier tokens `--sr-map-target-{fresh|mid|old}`.
- Tests: extend `NearbyLiferMarkers` / `TargetMarkers` component tests (or add) for dot presence and dots-mode label hiding.

**Proposed approach (concrete).** In each marker, wrap the anchor content in a small flex row: a `aria-hidden` locator dot (~10px circle, `tierColors(tier).bg` fill, white 2px ring via `boxShadow` so it reads on the basemap) always rendered, plus the existing `<button>` label. In **Dots** mode, keep the real `<button>` (so Enter/Space still open the popup and the `aria-label` is unchanged) but hide its visible label text (`display:none` on the label content), leaving just the dot. State lives in `MapExplorer` as two independent session `useState`s (no `storage` seam — session-only), each driven by a `SegControl` with options `Labels` / `Dots` and an explicit `aria-label` ("Marker style"). No new tokens; reuse the existing tier fills; markers stay real `<button>`s (the DOM-marker-as-button contract).

**Decisions / semantics.** The locator dot is **ground truth** and always visible in both modes; the toggle only controls the label chip. Dots mode is for a clean overview of *where* birds are; the popup (opened by click/Enter/Space) still shows the full species list at that location in either mode. Toggle state is session-only and per-panel (Lifers and Targets independent).

**Edge cases.** Cluster markers ("{n} species") in Dots mode hide the count chip but keep the `aria-label` ("{n} nearby lifers/target species at {locName}") and still open the popup listing all species. Overlapping dots in dense clusters are accepted (zoom to separate; white ring aids visibility; keyboard focus + popup still work). Media Targets' `escHtml`-escaped media-icon label markup stays injection-safe — only its visibility is gated, never its escaping. Theme switch and pan/zoom unaffected (MapLibre `<Marker>` transform + token fills). Touch target: the dot+button footprint and the popup-on-tap keep it usable on phones.

**What done looks like.** Every Nearby Lifers and Media Targets marker shows a locator dot at its exact coordinate; each of the two panels has a Labels/Dots `SegControl`; switching to Dots hides the label chips while dots remain and popups still open on click/keyboard; contrast holds in both themes; no new tokens; `npm run build` + vitest green.

---

**Batch close-out reminder.** One patch release **v0.5.59**: version bump in both manifests, `CHANGELOG.md`, `docs/HELP.md`, `README.md`, and `website/` (feature list + version pill/footer) updated together; log the change-2 per-species-filter semantics as a short new `DECISIONS.md` entry at closeout; then push → tag `v0.5.59` → wait for Windows CI → `./release.sh`.
