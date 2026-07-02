# QA Report — mobile-prep-sweep

**Date:** 2026-07-02
**Session:** 65 · Improve lane (`sessionType: "maintain"`), Stage 3 (Tester)
**Test Runner:** vitest + pytest + cargo (per `pipeline.config.json` stack) + `tsc -b` + eslint + production build
**Result:** PASSED

An Improve run bundling four recorded tidies with the 71-finding responsive/mobile
audit fix set (66 fixed, 1 accepted-constraint, 4 deferred-behavior by scope
agreement). Verified against the change-brief "What done looks like" criteria and,
because this is the Improve lane, with regression as the primary concern.

---

## Test Suite Results

| Gate | Command | Baseline | Actual | Result |
|---|---|---|---|---|
| Unit (vitest) | `npx vitest run` | 1253 | **1256 passed / 106 files, 0 failing** | PASS (+3, see Fixes) |
| Backend (pytest) | `.venv/bin/python -m pytest tests/` | 172 | **172 passed, 0 failing** | PASS |
| Lint | `npm run lint` (eslint) | clean | **clean** | PASS |
| Typecheck | `npm run typecheck` (`tsc -b`) | clean | **clean** | PASS |
| Build (pre-push gate) | `npm run build` (`tsc -b && vite build`) | passes | **built, no type errors** | PASS |
| Entry-chunk guard | `dist/index.html` modulepreload inspection | no maplibre/county | **maplibre/county ABSENT from entry** | PASS |
| Desktop compile | `cargo check` | green | **Finished, green** | PASS |

The build's `> 1100 kB` chunk warning is the on-demand `vendor-maplibre` (~1.03 MB) and
`us-counties` (~3.79 MB) chunks — off first paint, documented, unchanged by this run,
covered by `entryChunk.test.ts`. Not a regression.

`cargo check` reports `snowraven v0.0.0` — the crate version is intentionally 0.0.0;
the bundle version is sourced from `tauri.conf.json` (0.5.55), per the CLAUDE.md rule.

---

## Verification — change-brief "done" criteria

### Tidy #1 — Test hardening (parity + hook gating), ADDITIVE

| Criterion | Result | Evidence |
|---|---|---|
| Taxonomy-collapse parity test exists in BOTH runtimes | ✓ Pass | `backend/tests/test_taxonomy_collapse_parity.py` + `frontend/src/lib/taxonomyCollapse.parity.test.ts` |
| Both readers use the SAME fixture (drift-detection) | ✓ Pass | Both load `frontend/src/lib/taxonomyCollapse.fixture.json` — Python via `__file__` path (parity.py:33–36), TS via `import` (parity.test.ts:18). Both assert the same `cases.expected`. If either twin's collapse output drifts from the shared JSON, that twin's own test fails. Python additionally re-derives the module dicts from `rawTaxonomy` via the router's own `_derive_from_taxonomy` and cross-checks the fixture's pre-derived `snapshot` (`test_snapshot_matches_derivation`), so the two fixture forms can't silently disagree. |
| useCountyCompleteness hook tests lock the five gating rules | ✓ Pass | `frontend/src/lib/useCountyCompleteness.test.ts` — birded-only (124–140), no-key gate incl. `false` AND `null` (142–157), pool-of-4 cap (`EAGER_FETCH_CONCURRENCY===4`, launches 4, pumps 1 on settle, 159–189), dedupe (same region ×3 pans → 1 fetch, 191–207), TTL skip (209–231). Bonus: TTL-window-not-blanket (233–255), unresolvable-geoid/FR-18 (257–263). |
| Additive — no existing production code changed by this tidy | ✓ Pass | All four files are new (`git status` `??`). `useCountyCompleteness.ts` production file is NOT modified. `taxonomy.py`'s collapse logic is unchanged — its only diff is the tidy #2 httpx conversion (verified: `async with httpx.AsyncClient()` → `get_client()`, timeout 30.0 preserved). |

### Tidy #2 — Pooled httpx client

| Criterion | Result | Evidence |
|---|---|---|
| Zero `httpx.AsyncClient(` in routers + services | ✓ Pass | `grep -rn 'httpx.AsyncClient(' routers/ services/` → **ZERO**. |
| Shared client is a LAZY singleton, NOT lifespan-created | ✓ Pass | `backend/http_client.py` — `get_client()` creates `_client` on first use (line 33–34). `backend/main.py` lifespan startup does nothing (comment 27–30); shutdown only `close_client()` (line 32). This is why module-level `TestClient(app)` (no context manager, so lifespan startup never runs) works — proven by the 172 green tests. |
| Per-request timeouts preserved at call sites | ✓ Pass | All 17 `client.get`/`.post` calls across routers/services carry an explicit `timeout=` (mechanically enumerated). |
| Test mocks repointed to the shared accessor | ✓ Pass | Mocks patch `routers.<mod>.get_client` (e.g. `test_map_router.py`, `test_version_router.py`, `test_checklists_router.py` — the two-module shared-client note at its lines 74/94). |

### Tidy #3 — Codes-independent recent-obs cache (BOTH runtimes)

| Criterion | Result | Evidence |
|---|---|---|
| Two same-center calls (with/without codes) hit eBird once — backend | ✓ Pass | `test_recent_obs_same_center_hits_upstream_once` asserts `instance.get.call_count == 1` across a no-codes + a codes call, each returning its own filter. Backend cache keyed on `(lat,lng,dist)` only (`map.py:158`); codes filter applied after (`map.py:189,201`). |
| Two same-center calls hit eBird once — desktop (TS twin) | ✓ Pass (test added this stage) | The desktop twin `mapService.getRecentObs` keys the raw fetch codes-independently via `rawKey` (mapService.ts:139, codes excluded) → `cachedGet`. This was implemented correctly but **untested** — `transport.test.ts` exercises only the web path (where `networkCacheKey` deliberately includes codes). Added `frontend/src/lib/tauri/mapService.recentObs.test.ts` (3 tests): same-center no-codes + with-codes → `tauriFetch` called once; different center re-fetches; raw URL carries no `codes` param. Mutation-verified: adding codes back into `rawKey` makes it fail. |
| Errors are not cached | ✓ Pass | Backend: `test_recent_obs_error_is_not_cached` (502 then success re-fetches). Loader raises before the cache write (`map.py:176–177`). Frontend: `cachedGet` never caches a rejected loader (`networkCache.ts:42–43`). |
| Both runtimes key codes-independently | ✓ Pass | Backend `_cached_recent_obs_raw` key `(lat,lng,dist)`; desktop `rawKey` codes-excluded. Web/Pi's codes-independent dedup is server-side (backend cache); desktop's is the TS `rawKey` — different layer, same guarantee. |
| Optional-codes route contract + response shape + CACHED_GET_PATHS unchanged | ✓ Pass | `/map/recent-obs` still in `CACHED_GET_PATHS` (`transport.ts:183`); optional `codes=""` (`map.py:186`), lat/lng/dist bounds (422 tests present), grouped `RecentObs` response shape unchanged in both. |

### Tidy #4 — Dead geolocation plugin removal

| Criterion | Result | Evidence |
|---|---|---|
| Zero refs to the removed plugin in source | ✓ Pass | `plugin-geolocation` / `@tauri-apps/plugin-geolocation` / `tauri-plugin-geolocation` / `geolocation:*` grants → **ZERO** across `frontend/src`, `src-tauri/src`, `Cargo.toml`, `capabilities`. Remaining `geolocation` hits are the legitimate web `navigator.geolocation` path (`location.ts`), a `platform.ts` comment, and the Windows `Devices.Geolocation` native feature (`location_windows.rs`) — none touch the removed plugin. |
| cargo check green | ✓ Pass | `cargo check` → Finished, green. |
| Native `get_location` path untouched | ✓ Pass | `location.rs` and `location_windows.rs` are NOT modified. `lib.rs` still registers `location::get_location` (line 62) and `location_windows::get_location` (line 64) in the invoke handler; the only diff is the removed `.plugin(tauri_plugin_geolocation::init())` line. `Cargo.toml` and `capabilities/default.json` diffs remove exactly the dep + the three `geolocation:*` grants, nothing else. |

### Responsive — new vocabulary + flagship high

| Criterion | Result | Evidence |
|---|---|---|
| The 4 new `globals.css` classes exist with phone-tier (≤640) rules | ✓ Pass | `.sr-touch-target` (base no-op; `min-height: 2.75rem` @ ≤640, globals.css:711/984), `.sr-map-popup-body` (`max-height: min(60dvh, 26rem); overflow-y: auto; overscroll-behavior: contain`, :728), `.sr-input-16` (`font-size: 16px` @ ≤640 only, :992), `.sr-wrap-flex` (`display: flex; flex-wrap: wrap`, :745). Bonus helper `.sr-map-icon-btn-touch` (:720/988) for dense icon buttons. |
| Flagship high (CountyLayer completeness popup) has `.sr-map-popup-body` (max-height + internal scroll) | ✓ Pass | `CountyLayer.tsx:354` — inner div `className="sr-map-popup-body"`; the fixed `anchor` was also removed (348–351) so MapLibre keeps the popup on-screen; the "Counties in view" panel width lifted to rem `min(14.5rem, 62vw)` (:446). |

### Responsive — representative spot-checks (10)

| # | Finding (surface) | Result | Evidence — fix present, layout-only |
|---|---|---|---|
| 1 | HIGH TargetMarkers popup (map markers) | ✓ Pass | `.sr-map-popup-body` (:93) + `maxWidth="min(280px, 80vw)"` (:92) |
| 2 | HIGH NearbyLiferMarkers popup (map markers) | ✓ Pass | `.sr-map-popup-body` (:78) + `maxWidth="min(280px, 80vw)"` (:77) |
| 3 | MED MapExplorer sidebar width inline→class | ✓ Pass | inline `width` removed; lifted to `.sr-map-sidebar-overlay` (base `clamp(240px,28vw,300px)` globals.css:761, ≤640 override :1011). Comment MapExplorer.tsx:2055 documents it. |
| 4 | MED MapExplorer Date Range row → `.sr-field-row` | ✓ Pass | MapExplorer.tsx:1342 `className="sr-field-row"` |
| 5 | MED SpeciesDetail comment wrap + stat grid | ✓ Pass | comment body `.sr-wrap-anywhere` (:1385–1386); stat grid lifted to `.sr-grid-2` w/ `--sr-grid-gap` (:845) |
| 6 | MED SegControl inline flex → `.sr-wrap-flex` | ✓ Pass | MapSidebarUI.tsx:18 `className="sr-wrap-flex"` w/ `--sr-wrap-gap:2px` |
| 7 | MED App weather checklist-ID row + iOS input | ✓ Pass | row `.sr-field-row` (App.tsx:779); input `.sr-input-16` (:790); copy buttons `.sr-touch-target` (:899,974,993) |
| 8 | MED/LOW BirdingStats hand-rolled px rows → rem | ✓ Pass | year/county/state/month label spans converted to rem widths (`2.25rem`/`6.25rem`/`6rem`/`1.75rem`) with `flexShrink:1` + `minWidth:0` + ellipsis (BarRow pattern; :669,901,975,1602) |
| 9 | MED MediaStatsSections age-class legend wrap | ✓ Pass | `flexWrap:'wrap'` on the legend row (:258) |
| 10 | MED NamedBirdRow species-comment wrap + Named sort control | ✓ Pass | comment `.sr-wrap-anywhere` (NamedBirdRow.tsx:107); NamedBirdsTable sort group reworked to self-bordered pills in `.sr-wrap-flex` (removes the broken-bar-on-wrap), buttons `.sr-touch-target` |

Plus: `index.html` viewport gained `viewport-fit=cover` (:6); the SpeciesDetail/SightingsMap
one-finger scroll-trap fixed via a new `cooperativeGestures` prop threaded through `SnowMap`
(SnowMap.tsx:35/193, SightingsMap.tsx:58, SpeciesDetail.tsx:1286).

### Regression checks (Improve-lane primary concern)

| Check | Result | Evidence |
|---|---|---|
| Pooled httpx + recent-obs did not alter response shapes | ✓ Pass | All existing router tests pass unchanged (172 green) — the strongest evidence: they assert the exact response bodies. `RecentObs` grouping shape identical in both runtimes. |
| Responsive changes are class/rem additions that cannot change desktop (>640px) rendering | ✓ Pass | `.sr-touch-target` / `.sr-input-16` size rules live ONLY in the ≤640 media block (base is a no-op / absent). `.sr-map-popup-body` and `.sr-wrap-flex` are behavior-neutral above 640 (a popup shorter than 26rem never hits the cap; a flex row that already fits never wraps). Sidebar `clamp(240px,28vw,300px)` base preserves the prior 641–1024 tablet behavior. |
| Responsive changes are layout-only (no logic/prop/behavior) | ✓ Pass | Diff scan for added logic (hooks/handlers/conditionals/data-flow) across all component diffs found only one match — `sortOptions.map((o) =>` — which is the container-only rework of the Named sort pills (drops the unused `i` that drove the removed `borderLeft` dividers). No state/handler/data change. |
| No hardcoded colors introduced | ✓ Pass | Added component lines contain no raw hex/rgb outside `var(--sr-*)` except the pre-existing `rgba(255,255,255,0.85)` marker-chip border/shadow (a basemap-anchored decoration that merely MOVED when `.sr-touch-target` was added — not a new color). globals.css added rules use tokens only. |
| Geolocation removal did not touch the native location invoke path | ✓ Pass | `location.rs`/`location_windows.rs` unmodified; both `get_location` handlers still registered (lib.rs:62/64). |

### Out-of-scope findings (by agreement — NOT failures)

The 4 deferred-behavior + 1 accepted-constraint are confirmed to be the ONLY unaddressed
audit findings, and each genuinely requires new content or a scroll-model change (not a
silently-skipped visual repair):

| Finding | Status | Confirmation it needs new content / scroll model |
|---|---|---|
| #5 ChecklistComparer per-cell A/B labels | Deferred | `SideCell` (ChecklistComparer.tsx:90) still carries no A/B tag when `mode='both'`; A/B labels live only on `CommentLine`/header. Requires adding new visible content inside each cell. |
| #26 Breeding-code meanings hover-only | Deferred | `BreedingCodeTable.tsx:184/194` still terse-code + `title=`/aria-label; no visible-label or expandable legend. Requires surfacing definitions as new content. |
| #27 Badge/media counts title-only | Deferred | `BreedingBadge`/`MediaIcons` (ChecklistComparer.tsx:42–77) still convey via `title=`/aria-label only. Requires new visible count text. |
| #40 LifeListTable sticky header | Deferred | `LifeListTable.tsx:212` still `position:sticky` inside a non-vertical-scrolling wrapper; no bounded `dvh` scroll-box added. Requires a scroll-model change. |
| #47 SightingsMap 24px pin | Accepted constraint | `SightingsMap.tsx:70` still `width:24, height:34` — the standard map-pin exception. |

---

## Edge Cases Tested

- **Lazy-singleton under module-scope TestClient** — the 172 pytest suite mounts
  `TestClient(app)` without a context manager, so lifespan startup never runs; the
  shared client's first-use creation (not lifespan creation) is what keeps every
  backend test green. Verified this is the deliberate design (http_client.py + main.py).
- **Recent-obs error not cached (both runtimes)** — backend `test_recent_obs_error_is_not_cached`;
  frontend `cachedGet` never-cache-on-reject. A transient 401/502 does not stick for the 90 s TTL.
- **Codes-order cache stability (web path)** — `transport.test.ts:70` confirms reordered
  codes hit the same `networkCacheKey`; the new desktop test confirms the twin dedupes
  codes-independently at the `rawKey` layer.
- **Mutation check on the new test** — temporarily re-adding `codes` to `rawKey` made
  `mapService.recentObs.test.ts` fail; restoring it passed. The test genuinely detects drift.
- **iOS focus-zoom guard uses px deliberately** — `.sr-input-16` is the one sanctioned
  px font-size (the iOS 16px zoom threshold is absolute), scoped to ≤640 only, so pinch-zoom
  is preserved (no `maximum-scale`).
- **Version lockstep** — `frontend/package.json` and `src-tauri/tauri.conf.json` both 0.5.55;
  CHANGELOG `[0.5.55] - 2026-07-02` present; website pill 0.5.55.

## Known Limitations

- **Live 375px browser verification was NOT run.** The audit's phone-viewport claims
  (no horizontal page scroll at 320px / 200% text scale; popups scroll internally; no
  iOS focus-zoom) were verified by reading the applied code against each finding, not by
  driving a running app at phone width — most surfaces require loaded eBird data and API
  keys to render the affected components (map popups, weather/tide output, stats, life
  list). **Recommendation:** before release, do a brief manual phone smoke (or 375px
  responsive-mode) of at least the map popups (a shaded-county completeness card and a
  sighting/target/lifer marker taller than the viewport → confirm internal scroll) and the
  Weather/Forecast tab (tap a search/date input → confirm no iOS page zoom; confirm the
  checklist-ID row stacks and "Use my location" still works via native `get_location`).
- **Desktop (Tauri) behavior of the recent-obs dedup** is now unit-tested at the TS-service
  level, but not exercised end-to-end in a running desktop build; the native `get_location`
  path was verified as untouched by static inspection (no compile-and-run of the .app).
- **The `[0.5.55]` CHANGELOG entry also carries the County Completeness "Added" block**
  (the released-0.5.54 feature folded into this version's rollup). That is a
  Chronicler/Deployer concern, not a QA blocker — the mobile-prep-sweep changes are
  themselves accurately described in the "Changed" section.

## Fixes Applied (this stage)

1. **Added `frontend/src/lib/tauri/mapService.recentObs.test.ts` (3 tests).** Closes a
   coverage gap against the tidy #3 done-criterion "two same-center calls provably hit
   eBird once **in both runtimes**." The backend runtime was proven by
   `test_recent_obs_same_center_hits_upstream_once`; the desktop TS twin
   (`mapService.getRecentObs`'s codes-independent `rawKey`) was implemented correctly but
   had no direct test — `transport.test.ts` covers only the web path, where the cache key
   intentionally includes codes. The new test mocks `./http` + `../storage` and asserts:
   same-center no-codes + with-codes → `tauriFetch` called once; different center
   re-fetches; the raw URL carries no `codes` param. Two follow-up fixes to satisfy the
   `tsc -b` + eslint pre-push gate (an empty-tuple cast, then an unused-param lint) —
   final vitest 1256, typecheck clean, lint clean. No production code was changed.

## Convention Flags

None. The implementation already recorded the durable conventions (use the four new
`globals.css` classes; pooled backend HTTP via `http_client.get_client()` with a
per-call `timeout=`; no inline responsive styles) in its notes for Stage 9. One
observation worth noting to the Chronicler, not a standing rule: **a dual-transport
"provably once in both runtimes" criterion needs a test per runtime** — the web/Pi and
desktop paths achieve the same guarantee at different layers (server-side cache vs. TS
`rawKey`), so a single transport-layer test does not cover both. This stage added the
missing desktop-side test.
