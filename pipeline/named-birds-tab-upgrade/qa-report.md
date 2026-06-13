# QA Report — Named Birds Tab Upgrade

**Date:** 2026-06-09
**Test Runner:** vitest (frontend)
**Lane:** New Feature (Stage 6 — The Tester)
**Result:** PASSED

## Verification gates

| Gate | Command | Result |
|---|---|---|
| Test suite | `npx vitest run` | **691 passing / 0 failing**, 50 files (5.09s) — independently confirms the Engineer's 691 count |
| Typecheck | `npx tsc --noEmit` | Exit 0 — clean |
| Project build typecheck | `npx tsc -b` | Exit 0 — clean |
| Lint | `npx eslint .` | Exit 0 — clean |
| Production build | `npx vite build` | Exit 0 — built in 488ms (the >500kB maplibre vendor-chunk advisory is pre-existing, not introduced by this feature) |

New/updated test files all green:
- `lib/namedBirds.test.ts` — sort options (`alphabetical` rename, `taxonomic` with `orderFor` stub, unknown-order tail, graceful `Infinity` fallback, `orderFor` omitted), `location`/`latitude`/`longitude` threading.
- `lib/sightingMarkers.test.ts` (NEW) — empty input, skip-null, all-null → `[]`, same-coord aggregation, newest-first dates, submissionId preserved.
- `components/NamedBirdsTable.test.tsx` — four-option vs reduced-set labels, location render + omission, map mount-on-expand / no-mount-when-no-coord, single-open vs multi-open accordion, taxonomic re-sort.

## Acceptance Criteria Verification

| ID | Criterion | Result | How verified |
|---|---|---|---|
| QA-01 | Contrast — real content | ✓ Pass | Per-sighting date `0.75rem`/`--sr-text` (was muted); checklist link `0.75rem`/`--sr-accent` (was `0.6875rem`); header date-range `0.75rem`/`--sr-text-gray`. Smallest content ≥ `0.75rem`. The lone `0.6875rem` is the new uppercase map caption ("Where … has been seen"), not the flagged content. (NamedBirdRow.tsx) |
| QA-02 | No disabled token on content | ✓ Pass | `--sr-text-disabled` appears only on the decorative `·` separators (`aria-hidden`) and the passive "N named birds" count — the one element QA-02 permits at a lower-emphasis token. No content text uses it. |
| QA-03 | Token-only colors | ✓ Pass | Zero hardcoded hex/RGB in all four changed component files. New tokens `--sr-quote-bg`/`--sr-quote-border` exist in BOTH `:root` (globals.css 39–40) and `[data-theme="dark"]` (140–141). The only literal is `fill="white"` inside the static `SP_PIN_HTML` sprite (the inner dot), unchanged from the shipped Species Detail sprite. |
| QA-04 | Header alignment | ✓ Pass (code) | Header button is `display:flex; alignItems:'baseline'`; name span and `renderSpecies` BirdName both sit on the shared baseline; species wrapper is `alignItems:'baseline'`. Visual confirmation deferred to manual eyeball (Known Limitations). |
| QA-05 | Alignment in-component, BirdName unchanged | ✓ Pass | Alignment lives entirely in `NamedBirdRow`'s flex baseline; species still renders via `<BirdName … size="sm">`; no change to shared `BirdName` defaults. |
| QA-06 | Comment background distinct | ✓ Pass | Comment wrapped in its own `<div>` on `--sr-quote-bg` (light `#EFF1F3` one step deeper than `--sr-surface-subtle`; dark `#2E2E33`) with `--sr-quote-border`, a `--sr-accent-border` left rule, radius 7, padding — reads as a quoted block in both themes. |
| QA-07 | Four sort options, labels/order | ✓ Pass | `showSpecies` branch yields exactly **Name (Individual) · Alphabetical · Taxonomic · Last Seen** in order; asserted by `NamedBirdsTable.test.tsx`. |
| QA-08 | Sort behavior | ✓ Pass | `sortNamedBirds`: name→display name; alphabetical→common name A–Z; taxonomic→`orderFor`; lastSeen→most-recent date. Unit-tested in `namedBirds.test.ts`. |
| QA-09 | Taxonomic wiring, no new fetch | ✓ Pass | `NamedBirds.tsx` captures `data.orders` from the existing `/taxonomy/codes` POST (already fired for favicons) into `taxonOrders`; builds `orderFor` (`useCallback`, normalized-name fallback, `Infinity` tail). No new request. |
| QA-10 | Sort stability + tie-breaks | ✓ Pass | Every case carries a `byName` tie-break; unknown order → `Infinity` tail then name; `Infinity-Infinity = NaN` sorts as 0 (no swap) → stable. Asserted (unknown-tail + name-tie cases). |
| QA-11 | Taxonomic graceful degradation | ✓ Pass | `orderFor` returns `Infinity` until `orders` loads → first comparator term `NaN` for all pairs → pure name order, no error/empty list. `orderFor`'s identity changes only on load, keyed in the table's sort `useMemo` deps → re-sorts when `orders` resolves. Tested (no-orders + omitted-`orderFor`). |
| QA-12 | Species Detail sort set unchanged | ✓ Pass | `SpeciesDetail.tsx:1377` passes `showSpecies={false}` and no `orderFor` → reduced **Name (Individual) + Last Seen** set; Taxonomic/Alphabetical absent. Tested. |
| QA-13 | Location threaded, no parser change | ✓ Pass | `NamedSighting` gains `location: string`; both `sighting` literals in `computeNamedBirds` set `location: obs.location`. No parser/CSV change. Tested. |
| QA-14 | Location rendered in position | ✓ Pass | Expand-row renders `date · {location} · {S… ↗}` with location between date and link in `--sr-text-muted`. Tested (location appears for the report that has one). |
| QA-15 | Location edge cases | ✓ Pass | Falsy location → segment + its separator omitted (no placeholder); present location ellipsizes (`overflow:hidden; textOverflow:ellipsis; whiteSpace:nowrap` + `title`). Omission tested. |
| QA-16 | Coordinates threaded, no parser change | ✓ Pass | `NamedSighting` gains nullable `latitude`/`longitude`; both literals pass them through verbatim; null-coord sightings stay in the list (only the map skips them). Tested. |
| QA-17 | Map renders, reuses Species Detail pattern | ✓ Pass | Expanded card renders `<SightingsMap>` (shared `<SnowMap>` + DOM `<Marker>` pins + single state-driven `<Popup>` + `MapBoundsFitter`). One SnowMap mounts on expand. Tested via stub. |
| QA-18 | Map lifecycle bound to expansion | ✓ Pass | Map subtree lives in the `open && (…)` block; collapse unmounts `SightingsMap` → MapLibre/WebGL disposed. Single-open test confirms map tears down when another card opens. |
| QA-19 | Null-coord sightings skip | ✓ Pass | `buildSightingMarkers` continues on null lat OR lng. Unit-tested (mixed null/usable → only usable pinned). |
| QA-20 | No-coord individual shows no map | ✓ Pass | `cardMarkers.length > 0` gates the map; empty array → no `<SightingsMap>`, no WebGL context. Tested (Ghost, all-null → no snowmap-stub). |
| QA-21 | Coordinate aggregation + popup | ✓ Pass | Same-coord sightings collapse to one marker; popup lists that coord's dates newest-first (first 6 + "+N more"), each a checklist link guarded by `SUBMISSION_ID_RE`. Aggregation + ordering unit-tested. |
| QA-22 | No new tile source / egress | ✓ Pass | Card map reuses `<SnowMap>`'s existing keyless providers; no new tile source, no new outbound request. (Security review confirms egress separately.) |
| QA-23 | Concurrency stability | ✓ Pass (structural) | Single-open accordion (`singleOpen` on the Named Birds tab) caps live maps at ONE WebGL context — opening a card empties `expanded` to the new key. Tested: opening Honk tears down Pete's map, still exactly one snowmap-stub. Live in-browser smoothness deferred to manual (Known Limitations). |
| QA-24 | Tests updated and green | ✓ Pass | All three test files updated for new sort keys/labels, `location`, coords; new `sightingMarkers.test.ts` added. Full suite 691/691 green. |

## Species Detail migration findings (the prime risk)

The shipped, working Species Detail map was refactored onto the shared `SightingsMap`. Scrutinized by reading the code (there is no `SpeciesDetail.test.tsx`):

- **Pins path is behavior-preserving.** Pins mode is now `<SightingsMap markers={coordMarkers} switcher />`. The extracted `SightingsMap` carries the same `SP_PIN_HTML` sprite (lifted verbatim, `fill:var(--sr-accent)` + white dot), the same popup body (dates newest-first, first-6 + "+N more", `SUBMISSION_ID_RE`-guarded checklist links), `switcher` true (Species Detail parity), `scrollZoom={false}`, the same `initialViewState` (first coord, zoom 5), and `height/width: 100%`. The caller still wraps it in `.sr-map-container` (unchanged height). Pixel-identical contract met.
- **`MapBoundsFitter` fires in BOTH modes.** Pins mode: the fitter runs *inside* `SightingsMap` (`coordinates={coords}`). Heatmap mode: the inline `SnowMap` keeps its top-level `<MapBoundsFitter coordinates={uniqueCoords} />` (SpeciesDetail.tsx:1242). Confirmed both branches frame the points; the one subtle migration point is handled.
- **Popup self-clears on species change.** `selectedCoord` is `SightingsMap`-local state and `selected` is recomputed each render via `markers.find(...)`. A new species produces a fresh `coordMarkers` array whose coords won't match the stale `selectedCoord` string → `selected` becomes `null` → popup closes. Preserved.
- **`coordMarkers` shape unchanged for all consumers.** It is now produced by `buildSightingMarkers(speciesObs)` (`speciesObs: ObservationEntry[]` carries `latitude`/`longitude`/`submissionId`/`date`). The shape `{lat, lng, sightings:[{submissionId, date}]}` is identical to before; `uniqueCoords`, `heatPoints` (`m.sightings.length`), and `SightingsMap` all read `.lat`/`.lng`/`.sightings` consistently. No consumer references an old shape.
- **No orphaned references.** Grep confirms zero leftover `SP_PIN_HTML`, `selectedCoord`, `<Marker>`, `<Popup>`, old `'species'` sort key, or `CoordMarker` type in `SpeciesDetail.tsx` (or anywhere in `src`). The heatmap/intensity/mode-toggle block is untouched.
- **Concurrent-WebGL bound is structural.** The single-open accordion on the Named Birds tab makes ≥2 live maps impossible — `toggle` sets `expanded` to `new Set([key])`. This is the schema's chosen answer to the one real engineering risk; the failure mode is designed out, not merely "probably fine," and the single-open teardown is unit-asserted.

## Edge cases tested
- Sort with no taxonomic orders loaded (pure name order) and with `orderFor` omitted entirely.
- Species with unknown taxonomic order landing in a stable tail, then by name.
- Sighting with null lat OR null lng OR both → skipped from markers, still listed as a report.
- Individual with zero usable coordinates → no map, no broken container.
- Same-coordinate sightings aggregated to one pin with newest-first dates.
- Location present vs absent (no placeholder/empty separator when absent).
- Single-open accordion tears down the prior card's map; multi-open (Species Detail) opens a second card without closing the first.
- FR-15 reduced sort set on the Species Detail "Named Individuals" section.
- Pathological unclosed `[name:` tag — no catastrophic regex backtracking (pre-existing guard, still green).

## Known Limitations
- **Live MapLibre canvas needs a manual in-browser eyeball.** Automated tests stub `SnowMap`/`react-map-gl` (no real WebGL/GL context), so the *rendered* map — pin placement, popup open-on-click, bounds-fit on single vs many coords, the base switcher, both light/dark map chrome — is verified structurally, not pixel-rendered. Manual smoke recommended on Species Detail (pins click → popup, heatmap toggle, bounds fit) and a card map.
- **Concurrent-map smoothness (QA-23 / NFR-01) is structurally guaranteed but not perf-measured in a browser.** The single-open cap makes stacked WebGL contexts impossible; the *feel* of expand/collapse over a long session (no jank) still warrants a manual pass.
- **Header alignment & comment-block contrast (QA-04/QA-06) are confirmed in code** (baseline flex, distinct token surfaces in both themes) but the visual "reads deliberate / distinct at a glance" judgment is a manual both-themes eyeball.
- **Version not yet bumped.** `frontend/package.json` and `src-tauri/tauri.conf.json` are still at `0.5.25` (the released version). Per CLAUDE.md and the PRD Carry-Forward Flags, this feature carries a patch bump (both files to the same version), a `CHANGELOG.md` entry, and a docs/website review (four sort options, per-report location, the new map). This is a release-stage item — not a test failure — surfaced for the Auditor/release stages so it isn't forgotten.

## Convention Flags
- **Shared-map extraction is a reuse standard worth recording.** When a second surface needs an existing map's pins/popup/bounds-fit, extract the pins path into a shared, test-covered component (`SightingsMap`) and migrate the original with a pixel-identical contract — rather than inline-duplicating the sprite + popup state machine + aggregation. Pair it with a pure, unit-tested aggregation helper (`buildSightingMarkers`) so FR-22/23/24-style behavior (skip-null / empty→no-map / same-coord aggregation) lives in one tested function.
- **Bound concurrent WebGL maps structurally.** Where a list can mount per-row maps, prefer a single-open accordion (one live map = one context) over an instance counter/queue. Makes the stacked-context failure mode impossible and trivially testable.
