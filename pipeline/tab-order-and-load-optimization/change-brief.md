# Change Brief — tab-order-and-load-optimization (0.5.42)

Three small, independent Improve threads shipped together as 0.5.42 to avoid
three separate release cycles. Confirmed Improve-territory (no new user-facing
capability, surface, or copy; the tab move is a default reorder, the load work
is invisible performance, the npm piece is build-tooling + docs).

## What is changing

1. **Default tab order** — move `checklists` to sit between `breeding-codes`
   and `comparer`. New `DEFAULT_TAB_ORDER`: weather, birding-stats,
   species-detail, map-explorer, life-list, breeding-codes, **checklists**,
   comparer, named-birds.
2. **Initial load** — take the maplibre map library off first paint, where it
   is currently eagerly loaded (~273 KB gzip) despite the map tabs being lazy.
   Then quiet the now-benign chunk-size build warning. Also lazy-load the
   List Comparer and Checklists tabs to trim the entry chunk (the optional
   extra — included).
3. **npm-audit noise (Pi)** — non-breaking `npm audit fix` to clear the two
   dev-only advisories, plus a short note in `update.sh`/README explaining that
   the install-time count audits dev/build tooling that never ships.

## Why now

The user flagged all three. Each run ends in a full macOS+Windows release, so
bundling saves two release cycles.

## User-facing impact

Only the tab order changes visibly, and only for first-run / reset-to-default
users — `parseLayout` preserves any saved custom layout. Everything else is
faster initial load and quieter tooling. No behavior change to any tab.

## Scope / files (verified)

- `frontend/src/lib/tabLayout.ts` — reorder the one `DEFAULT_TAB_ORDER` array
  (sole source of truth; `parseLayout`/`KNOWN_TABS`/reset/is-default all derive
  from it). The `ConfigurableTab` union and `TAB_LABELS` do NOT change.
- `frontend/src/lib/tabLayout.test.ts` — update the one literal full-order
  assertion (~lines 28–38). The append-order test (~line 113) stays green
  unchanged. All other tests reference `DEFAULT_TAB_ORDER` by import.
- `frontend/src/components/NamedBirdRow.tsx` — replace the static
  `import { SightingsMap }` with `React.lazy(() => import('./SightingsMap')
  .then(m => ({ default: m.SightingsMap })))` and wrap the existing on-open
  `<SightingsMap/>` in `<Suspense>`. This is the SOLE remaining static-entry
  path to maplibre (WeatherForecastPanel→PredictMap is already lazy). Add a
  warm for it to the existing `requestIdleCallback` warmer in App.tsx so first
  row-open stays instant. Single-WebGL-context accordion gating is unchanged.
- `frontend/src/App.tsx` — make `ListComparer` and `Checklists` `React.lazy`
  tabs (same pattern as MapExplorer/SpeciesDetail/BirdingStats/HelpDocs),
  inside the existing Suspense boundary; add to the idle warmer. Do NOT touch
  `DEFERRED_TABS` ordering.
- `frontend/vite.config.ts` — set `build.chunkSizeWarningLimit` (~1100 kB)
  AFTER the maplibre defer, so the limit isn't masking a real eager-load.
- `frontend/package-lock.json` — via `npm audit fix` (within existing ^ ranges;
  installed vite 8.0.10, @babel/core 7.29.0; both report a non-breaking fix).
- `update.sh` + `README.md` — one-line note on the dev-tooling audit scope.
- Version chores: bump `frontend/package.json` + `src-tauri/tauri.conf.json` to
  0.5.42, `CHANGELOG.md`, `docs/HELP.md` (if it lists tab order), and the
  `website/` version pill + footer.

## Decisions touched

Lightly amends the 0.5.41 default-tab-order decision (Checklists position) in
`DECISIONS.md`. The Chronicler records the tweak at closeout.

## What done looks like

- First-run tab order is correct (Checklists between Breeding Codes and List
  Comparer); saved custom layouts untouched.
- A fresh `npm run build`: maplibre no longer on the first-paint modulepreload
  list (no bare `import "./vendor-maplibre"` in the entry chunk), no chunk-size
  warning.
- Full CI mirror green: lint + typecheck + vitest + build.
- `npm audit` clean at both full and `--omit=dev` scopes.
