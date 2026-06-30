# Change Brief — efficiency-and-docs-audit

**Lane:** Improve · **Stage 1 (The Evaluator) output** · **Date:** 2026-06-30
**Decision:** Full sweep → one patch release (**v0.5.52**).

---

## Why this exists

The user asked for a comprehensive audit: (1) can the app be made more
efficient, and (2) are the README, docs, and website still current. A
multi-agent audit (efficiency finders + doc-currency checkers, each finding
adversarially verified as real *and* behavior-preserving) returned **28
verified findings, all low-severity**.

**Headline:** the app is already efficient — prior sweeps (v0.5.16 map perf,
v0.5.42 lazy-maplibre, v0.5.31 a11y) did the heavy lifting; hot paths are
memoized; the big libraries stay off first paint; there is no real bottleneck.
The genuine value is **doc-currency catch-up** after the fast v0.5.46–v0.5.51
county-overlay releases plus a **handful of safe, output-identical code tidies**
(one real, if modest, backend latency win).

**Feature-check: PASS.** Nothing here changes what a user can see, hear, or do.
Every code change is output-identical; the doc changes describe existing
behavior. This stays firmly in the Improve lane.

---

## Scope — IN (this run, v0.5.52)

### A. Docs currency (describe existing behavior; ride in the release commit)

1. **`docs/HELP.md`** (~line 436, the "Using SnowRaven offline" bullet) — add the
   county overlay to the offline-capable enumeration, e.g. "…draw your sightings,
   the heatmap, the atlas blocks, **and the county lines & shading**, plus the
   base map's place labels." (Counties are bundled + fully offline-capable —
   HELP.md:251, CHANGELOG v0.5.46.)
2. **`README.md`** (~line 21 offline parenthetical) — extend
   "(sightings, heatmap, atlas blocks)" to include the **county overlay** so the
   offline own-data layer list matches the current set (README ~line 14 already
   describes county lines/shading).
3. **`README.md`** (~line 72, build-from-source) — clarify the Tauri desktop path
   runs from the **repo root** and needs its own install:
   `npm install && npm run desktop:dev`. As written it yields the exact
   "tauri: command not found" failure CLAUDE.md documents (`desktop:dev` lives
   only in the non-workspace root `package.json`).
4. **`ACCESSIBILITY.md`** (~line 15, Map-markers paragraph) — add a **"Counties in
   view"** sentence parallel to the existing atlas-blocks one: when the county
   overlay is on, a focusable "Counties in view" panel lists in-view counties,
   each row a real button that opens the county popup and pans the map (the
   county GL fill is pointer-only, so this panel is its sole keyboard route).
   Shipped behavior: `CountyLayer.tsx` (~lines 377/382). CLAUDE.md requires this
   statement stay true to shipped a11y behavior.
5. **`CLAUDE.md`** (~line 170 website-sync note) — replace the stale
   "(currently `v0.5.38`)" with **source-of-truth wording** that points at
   `website/index.html`'s version pill/footer rather than hardcoding a number
   that drifts almost every release (stops the recurring-drift class of bug, not
   just this instance).
6. **`frontend/vite.config.ts`** (~lines 36–40, `chunkSizeWarningLimit` comment) —
   rewrite the rationale: the >500 kB chunks are now the bundled **data assets**
   `us-counties` (~3.8 MB) and `ebird-taxonomy` (~1.7 MB), both isolated and
   off-first-paint (lazy/dynamic-import only); `vendor-maplibre` (~1.03 MB) is now
   *under* the 1100 limit; the build still warns because the data chunks exceed
   1100 by design. Comment-only; byte-identical build.
7. **`frontend/src/lib/networkCache.ts`** (~line 2) **and**
   **`frontend/src/components/Settings.tsx`** (~line 1103) — remove the phantom
   **`nemesis`** entry from the cached-data list comments. `CACHED_GET_PATHS` is
   `['/map/hotspots','/map/recent-obs','/map/hotspot-region']` (+ region-info);
   the `/stats/nemesis` route was removed in v0.5.35. Comment-only.

### B. Dev-tooling / hygiene (byte-identical bundle)

8. **`frontend/package.json`** — change `"typecheck": "tsc --noEmit"` →
   `"typecheck": "tsc -b"`. Non-build-mode `tsc` does **not** follow project
   references, so today the script compiles **zero files** (the CLAUDE.md 0.5.35
   advice "or at minimum `npm run typecheck`" is currently false). Referenced
   tsconfigs already set `noEmit`, so `tsc -b` still emits no JS.
   **Keep** the explicit `typecheck` step in `.github/workflows/pipeline.yml` —
   with the fixed script it now does real work and gives an early, clear
   type-check signal, matching the documented full-CI-mirror practice. (Do *not*
   drop it; the small redundancy with the build's `tsc -b` is acceptable.)
9. **Delete `frontend/src/lib/utils.ts`** (its only export, `cn`, is imported
   nowhere) and remove **`clsx`**, **`tailwind-merge`**, and
   **`class-variance-authority`** from `frontend/package.json` dependencies;
   refresh `package-lock.json`. **Re-verify with a grep first** (`cn(`, each dep
   name, `cva`) — confirmed unused at audit time (the sole ui component,
   `ToggleSwitch.tsx`, uses none of them). Byte-identical bundle (already
   tree-shaken) — per CLAUDE.md's dev-dependency-cleanup precedent, no version
   bump is *required* by this item alone, but it rides in the 0.5.52 commit.
10. **Delete dead Vite-template assets**: `frontend/src/assets/react.svg`,
    `frontend/src/assets/vite.svg`, `frontend/src/assets/hero.png` (~26 KB,
    referenced nowhere in `src/` or `index.html`). **Re-verify with a grep
    first.**

### C. CI (byte-identical app)

11. **`.github/workflows/pipeline.yml`** — add top-level
    `concurrency: { group: pipeline-${{ github.ref }}, cancel-in-progress: true }`.
    Group by ref so main and PRs don't cancel each other; cancels only superseded
    in-flight runs of the same ref. (Leave `pages.yml`'s
    `cancel-in-progress: false` — correct for a publish job.)
12. **`.github/workflows/windows-build.yml`** — add `cache: 'npm'` to the
    `setup-node@v6` step (~line 33) with `cache-dependency-path` listing **both**
    lockfiles (root + `frontend`). `npm ci` stays deterministic, so the installer
    is unchanged.

### D. Shipped-code efficiency fixes (the reason for the patch bump)

All verified **output-identical**:

13. **`backend/services/noaa.py`** (`fetch_tides`, ~lines 28–32) — replace the
    three sequential `await _get(...)` calls (water_level / predictions interval 6
    / predictions interval hilo) with one
    `obs, pred, hilo = await asyncio.gather(...)`. `_get` already swallows
    exceptions → `None`, so `gather` cannot raise and the tuple is byte-identical;
    cuts `/tide/{id}` and `/tide/at` from ~3 NOAA round-trips to ~1. **The one
    real latency win.** (Web/Pi path only; the desktop TS twin `tideService.ts`
    already uses `Promise.all`.)
14. **`frontend/src/components/SpeciesDetail.tsx`** (~lines 727–729) — lift
    `baseCount` into a **phase-guarded `useMemo`** keyed on
    `[observations, selectedSpecies, mergeSubspecies]` (it doesn't depend on the
    date/county filter), declared before the early returns. Removes a full-backup
    O(N) scan (+ per-row `normalizeSpeciesName` in merge mode) from every
    date-filter keystroke. Matches the file's existing memo pattern.
15. **`frontend/src/lib/birdingStats.ts`** (`computeTotals`, ~lines 147–165) —
    track `firstDate`/`lastDate` by lexicographic string compare **inside the
    existing loop** and delete the `dates.map(...).sort()`. Fixed-width
    `YYYY-MM-DD` makes `<` byte-identical to default `.sort()`; init both to
    `null` to preserve the empty-input `?? null` behavior.
16. **`frontend/src/components/Checklists.tsx`** (~lines 421 & 430) — load eBird
    and ML in parallel:
    `const [ebird, ml] = await Promise.all([loadEbirdObservations(), loadMLExport().catch(() => null)])`,
    keeping the `if (!ebird) return` early-out and `ml?.mediaMap ?? null`. The
    `.catch(() => null)` is required (`loadMLExport` catches parse errors, not
    `readFile` IO). Matches BirdingStats / MapExplorer / SpeciesDetail.
    **Note:** this is the *Checklists* parallelization only — do **not** touch
    LifeList's ML load (the verifier flagged that variant as behavior-risky;
    it's deferred).
17. **`backend/routers/settings.py`** (`_upload`: `target.write_bytes` +
    `_write_meta`) **and** **`backend/.../settingskv.py`** (`save_setting`,
    ~line 79 `path.write_text`) — wrap the blocking writes in
    `await run_in_threadpool(...)` (`from starlette.concurrency import run_in_threadpool`;
    starlette is already a FastAPI dep). **Keep `encoding="utf-8"`** on the
    `write_text` (via `functools.partial` or kwargs). On-disk result identical;
    only the event loop stays free during multi-MB writes (matters on slow Pi
    SD-card IO).

### E. Release mechanics (because of section D)

18. Bump **`frontend/package.json`** AND **`src-tauri/tauri.conf.json`** to
    **0.5.52** (lockstep — CLAUDE.md).
19. **`CHANGELOG.md`** — add a 0.5.52 entry (user-facing framing: faster tide
    loads on the web/Pi build; under-the-hood tidying; docs caught up to the
    county overlay).
20. **`website/index.html`** — bump the version pill + footer (currently `v0.5.51`
    at ~lines 48 & 572) to **v0.5.52**; scan for any other version string. Keep
    the site's feature copy honest/current (Chronicler will confirm sync).
21. Confirm **README / HELP / website** read consistently after the docs edits.

---

## Scope — OUT (deferred; do not touch this run)

- **recent-obs cache-by-codes restructure** (L; lifts filtering out of the
  lockstep dual-transport seam `mapService.ts` + `backend/routers/map.py` — needs
  its own run + parity tests).
- **Pooled/lifespan `httpx.AsyncClient`** (M; current tests patch
  `httpx.AsyncClient` per call site, so a startup-scoped client needs
  test-harness rework; web/Pi-only benefit).
- **Full geolocation-plugin removal** (JS dep + Cargo crate + `lib.rs`
  registration + `capabilities/default.json` grants in lockstep). Genuinely dead
  (app uses the native `get_location` command), but it **alters the shipped
  desktop binary** → its own small run with a bump + Mac release.
- **EXCLUDED (behavior-change risk):** the weather/tide block-detector
  consolidation in `commentBlocks.ts` (must keep the raincrow no-strip path
  distinct from the snowraven tag-strip path); routing **LifeList**'s ML load
  through `loadMLExport()` (diverges error/`detectFileType` semantics).
- **Optional/marginal (no runtime gain):** haversine dedup (`geoDistance.ts`),
  `normalizeSpeciesName` / ML-catalog-id dedup across the parse modules, and the
  LifeList unstable-prop-identity memo (M). Safe but not worth the churn now;
  pick up opportunistically later.

These go to ROADMAP "On the Horizon" via the Chronicler, not into this run.

---

## Acceptance criteria

- Every code change in section D is **output-identical** (no user-visible
  behavior change), backed by the existing test suite + reasoning.
- **Full CI mirror green before push**: `lint` → `typecheck` (now meaningful) →
  `test` (1173+ tests) → `build`. The entry-chunk guard (`entryChunk.test.ts`)
  stays green — no maplibre/county on first paint.
- Docs (README, HELP, ACCESSIBILITY, website) accurately reflect the **v0.5.52**
  app, including the county overlay's offline + keyboard behavior.
- Version bumped to 0.5.52 in **both** manifests; CHANGELOG + website pill
  updated.
- No new network calls, providers, accounts, or telemetry → **no
  `PRIVACY_POLICY.md` change** (verified: the county/offline work added no
  providers).

## Release path (Improve lane Stages 5–6)

Chronicler runs **before** the push. This VM commits + pushes `main` + the
`v0.5.52` tag (Windows CI starts on the tag). The **Mac** runs `release.sh` for
the binary release (macOS universal DMG + Windows installer + `latest.json`).
Standing check before `release.sh`: the selected `windows-build.yml` run's
`headSha == git rev-parse v0.5.52^{commit}` and green.
