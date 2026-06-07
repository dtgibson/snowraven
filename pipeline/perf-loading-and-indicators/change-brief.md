# Change Brief — perf-loading-and-indicators

> Reconstructed from the cross-machine session record (the original Stage 1
> scoping was done on another machine; its full plan lived in a workflow run
> there). This file restores the Stage 2+ input artifact. Lane: Improve.
> Target release: **0.5.16** on branch `improve/performance`.

## Goal

Full-sweep performance improvement: make SnowRaven feel fast — faster first
paint, no redundant network/computation, and a visible indicator anywhere the
app is working. No new user-facing features; loading indicators and progressive
rendering are polish on existing behavior, not new surfaces.

## Scope — batches

### Done (committed + tested on the other machine, 392 frontend tests, build clean)

- **A** — gate eager tabs; Tauri fetch timeouts via `tauri/http.ts`; theme
  storage-seam persistence; `#root` boot skeleton; `RootErrorBoundary`.
- **B** — taxonomy in-flight coalescing; observations cache fast-path +
  Settings invalidation; heatmap paint-expression via `heatWeightDivisor`;
  memoized `normalizeSpeciesName`.
- **C** — lazy `HelpDocs`; idle-prefetch heavy chunks; labeled `TabLoading`.
- **D** — `mlExportCache` shared across Stats/Map/SpeciesDetail + invalidation;
  Breeding Codes derives from shared observations via `deriveBreedingData`
  (with equivalence test).
- **F** — `LifeListTable` filter + sort memoized.

### Remaining (this machine)

- **E — Statistics progressive render.** Computing phase + `useDeferredValue`;
  defer the geographic map below the charts so the tab shell and charts paint
  before the heavy stats and map mount.
- **G — Map render rewrite.** DOM markers → GL circle layer; atlas viewport
  cap. **Highest regression risk — requires Dave's visual verification.**
- **H — Network cache + remaining indicators.** Short-TTL cache for
  hotspots / recent-obs / nemesis / region-info; map loading chip; updater
  spinner; favicon placeholder.

### Skipped as low-value (decided in Stage 1)

- Date-substring micro-optimization.
- SpeciesDetail co-occurrence index.

## Constraints

- Improve lane: no new user-visible features beyond loading/progress polish.
- All conventions in CLAUDE.md apply (tokens via `var(--sr-*)`, storage seam,
  transport seam, BirdName for bird names, map rules).
- Ship as **0.5.16**; bump `frontend/package.json` + `src-tauri/tauri.conf.json`,
  update `CHANGELOG.md`. **Release pauses for the Mac** — `release.sh` cannot
  run on this Linux machine.
