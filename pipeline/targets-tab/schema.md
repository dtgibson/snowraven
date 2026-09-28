# Schema: Targets Tab

**Feature:** targets-tab
**Date:** 2026-09-26
**Stage:** 3, The Architect (hands-off: the path is declared here and proceeded on)
**Source:** strategic-brief.md, prd.md (63 FRs, 11 NFRs, 73 QA rows; FR-53's window default is **Any time** per decisions.md), decisions.md
**Extends:** `pipeline/ios-lifer-widgets/schema.md` (the epoch modules, `isWithinWindow`'s declared difference, the eBird body reducers), `pipeline/county-completeness/` (the county pool store), `pipeline/project-checker-rate-limiting/` (the pass-scale pacing precedent), `pipeline/clear-means-clear/` (the clear registry), `pipeline/large-file-and-memory-handling/` (the refusal registry)
**Ships as:** one patch bump across the four-file set. `launch-splash-screen` has already bumped `main`'s working copy to **1.0.37**, so this build ships as **1.0.38** if it lands second (the expected order) and as 1.0.37 only if it lands first; the Engineer reads the number off `main` at rebase time rather than off this document.

## Path

Incremental (extending the existing data layer: the stored-document set under `AppLocalData/data/`, the durable caches, both transports, the clear registry, and the tab roster).

## Architect assessment

> **Architect assessment: Incremental**
>
> SnowRaven has no database. Its data layer is the set of documents under `AppLocalData/data/` (mirrored by the web/Pi backend's `data/` directory), the epoch modules that announce a change to them, the durable caches keyed through the `storage` seam, the two transports' route sets, and the pure `lib/` modules that derive what the UI shows. Prior `schema.md` files document all of that, and this feature adds a new stored user-file kind with its own manifest document, a new durable cache with a clear-registry row, one new eBird-backed route on both transports, a new configurable tab, and one shared-predicate repair. Nothing here is greenfield and nothing is UI-only, so the path is Incremental. Proceeding on this assessment per the hands-off run.

Three findings from reading the code change what the PRD assumed, and each is settled below rather than deferred: the Tauri metadata document is rewritten as exactly `{ebird, ml}` on every write, so the new file kind cannot share it (section 1); the transport gate matches paths by exact `Set.has`, so the new route carries its parameters as query strings, never path segments (section 4); and the one-generation tab migration compares after the missing-tab append, so an 11-id saved order can never equal a 10-id constant unless the constant is appended the same way (section 6).

---

## Existing data model used by this feature (unchanged)

| Existing structure | Where | How this feature uses it |
|---|---|---|
| `data/metadata.json` + `data/ebird-backup.csv` + `data/ml-export.csv` | `storage.getFilesStatus()`, `loadEbirdObservations()` (`lib/observationsCache.ts`), `loadMLExport()` (`lib/mlExportCache.ts`) | Read only. The county picker and every classification derive from the parsed rows; a rejected `getFilesStatus()` is UNKNOWN (load-error with retry), a resolved `{ebird: null}` is the setup state (FR-09) |
| `data/settings.json` (Tauri, the `SETTINGS_PATH` chain) / `data/settings/<key>.json` (web/Pi, `settingskv.py`) | `storage.getSetting` / `setSetting` / `deleteSetting` | Hosts the new preference `targetsCounty` (section 5.4); every Tauri write is a link on the existing chain. **Amended 2026-09-27:** it no longer hosts the day cache; the store moved to its own document (next row), and the one remaining touch is a one-time `deleteSetting('county-day-obs-v1')` that removes the preview-build key (section 3.6) |
| `data/replay.json` (Tauri, own file, own ordered writer in `replayStore.ts`) / `data/settings/replay-store-v1.json` (web/Pi, the generic `settingskv.py` route) | `storage.getReplayStore` / `setReplayStore` | **Amended 2026-09-27:** the house precedent for a durable store with its OWN document. The day cache copies it exactly: `data/county-day-obs.json` on Tauri through three new typed seam methods, and the generic `/settings/{key}` route with key `county-day-obs-v2` on web/Pi (section 3.2). No new backend route, no Vite proxy entry |
| `county-completeness-v1` (`lib/countyCompletenessCache.ts`: `loadAll`, `dedupedFetch`, `COMPLETENESS_TTL_MS`, `purgeCountyCompletenessStore`) | Written only through `dedupedFetch(regionCode, loader)` | THE species pool (FR-11). The tab reads `loadAll()` for the pre-network render and calls `dedupedFetch` with the same `/map/county-species` loader `useCountyCompleteness.ts:133` uses. No second copy, no new store for the pool |
| `/map/county-species` (`backend/routers/map.py:88-122`; `lib/tauri/mapService.ts:61 getCountySpecies`) | `EBIRD_GATED_PATHS` member, not `CACHED_GET_PATHS` | The pool loader. Unchanged |
| `EBIRD_GATED_PATHS`, `gatedEbirdCall`, `ebirdGateState().waveCount`, `sweepSpacingMs`, `SWEEP_PAUSE_WAVES`, `ACTIVITY_START_SPACING_MS` | `lib/transport.ts:278`, `lib/ebirdGate.ts`, `lib/rateLimit.ts` | The new route joins the set (section 4); the sweep controller layers its own pacing exactly as `useChecklistProjects.ts:315-458` does, over the same shared state (section 3.4) |
| `throwEbirdHttpError` / `raise_ebird_http_error`, `parseRetryAfterSeconds` / `parse_retry_after_seconds` | `lib/tauri/ebirdErrors.ts:63`; `backend/services/ebird_errors.py:47,77` (aliased in `map.py:30-31`) | The shared 429 mapper on both sides of the new route |
| `lib/clearDerived.ts` `TEARDOWNS`, `purgeDerivedOnClear`; `lib/cacheInventory.test.ts` | The clear registry | Gains ONE row for the day cache, named `county-day-obs.json` after the 2026-09-27 amendment (section 3.5). Gains NO row for the bar-chart files (section 1.6) |
| `lib/uploadGuard.ts` (`refuseByFilename`, `refuseByContent`, `MAX_UPLOAD_BYTES`, `exceedsUtf8ByteLimit`, `TOO_LARGE_MESSAGE`), `lib/firstLine.ts` (`MAX_HEADER_CHARS = 8192`) | The refusal registry (on the entry graph, because `Settings.tsx` is) | Extended with the bar-chart kind (section 2.3); the parser itself stays off the entry graph |
| `lib/filesChanged.ts` shape (`getXEpoch`, `subscribeXChanged`, `notifyXChanged`), `lib/mapDefaultsChanged.ts` | entry-safe epoch modules | A fourth module of this shape is added for the bar-chart files (section 1.4) |
| `docChains` in `TauriStorage` (`storage.ts:558-587`) | Keyed by the path constants `API_KEYS_PATH`, `SETTINGS_PATH`, `META_PATH` | Gains a fourth key, `BARCHARTS_META_PATH` (section 1.2) |
| `normalizeSpeciesName`, `isNonCountableForm`, `withNormalizedParents` | `lib/speciesUtils.ts:217, 450, 293` | The name fold (section 5.2), the non-species-form rule (section 2.5), the `/taxonomy/codes` request shape |
| `/taxonomy/codes` (`backend/routers/taxonomy.py:265-321`; `lib/tauri/taxonomyService.ts:231 getTaxonomyCodes`) | `transport.post('/taxonomy/codes', { species: withNormalizedParents(...) })` | The code half of the Lifer subtraction (section 5.2). Local on both transports (bundled taxonomy / backend static), so it works offline |
| `BREEDING_CODES`, `BREEDING_CODE_MAP`, `CATEGORY_CODES.confirmed` | `lib/breedingCodes.ts:7-34, 36, 92-96` | The Breeding type (section 5.2). `CATEGORY_CODES.confirmed` is tier >= 3, as the PRD states; Map Explorer's tier-4-only `CONFIRMED_CODES` (`MapExplorer.tsx:151`) is NOT the reference |
| `ObservationEntry` (`types.ts:63-87`: `commonName`, `scientificName`, `county`, `stateProvince`, `submissionId`, `breedingCode`, `latitude`, `longitude`, `date`) | `loadEbirdObservations()` | The record. No taxonomic-order field exists (the CSV column is not parsed), so taxonomic order comes from the pool array (section 5.5) |
| `MLExportRow` (`format: 'Photo' \| 'Audio' \| 'Video'`, `commonName`) | `loadMLExport().rows` | The Media type (section 5.2) |
| `countyKeyFromState`, `countyKey`, `deriveCountyRegionCode`, `CountyProps { geoid, name, stusps, statefp }` | `lib/countyBoundaries.ts:201, 192, 217, 20` | The picker's join (section 5.1); `loadCountyGeometry()` (`lib/countyGeometry.ts:39`) reached through `import()` only |
| `isWithinWindow` | `lib/nearbyLifers.ts:115-126` | The window predicate (FR-53), repaired here (section 7) |
| `distanceMiles` | `lib/mapExplorerFormat.ts:44` | The distance cell and sort |
| `map-defaults` setting `{ lat, lng, dist }`, `subscribeMapDefaultsChanged`; `getCurrentLocation()` (`lib/location.ts:45`) | Settings writes; Map Explorer reads | The distance anchor (FR-51); no new permission, no new storage |
| `openExternalUrl` | `lib/openExternal.ts` | The bar-chart page link (FR-38) |
| `<BirdName>` (`components/BirdName.tsx`), `navigateToSpeciesDetail` (`App.tsx:287`) | | Every row's name; row activation for recorded species (section 5.6) |
| `tabLayout.ts` (`ConfigurableTab`, `TAB_LABELS`, `DEFAULT_TAB_ORDER`, `PREVIOUS_DEFAULT_TAB_ORDER`, `parseLayout`), `tabIcons.tsx`, `App.tsx` (`DEFERRED_TABS`, lazy thunks, the panel block) | | Section 6 |

---

## Changes in this feature

### Added

1. **The bar-chart file kind**: `data/barcharts/<regionCode>.txt` (one file per county) plus the manifest `data/barcharts.json`, on Tauri; `DATA_DIR/barcharts/<regionCode>.txt` plus `DATA_DIR/barcharts.json` on web/Pi, served by a new router at `/settings/barcharts` (section 1).
2. **Four `StorageAdapter` methods** for that kind, chained on a new `BARCHARTS_META_PATH` key in Tauri (section 1.2, 1.3).
3. **`lib/barChartFilesChanged.ts`**, a fourth epoch module of the `filesChanged.ts` shape (section 1.4).
4. **`lib/barChart/`**: the pure parser, filename parser, frequency derivation, pool join, and the lazy import tail (section 2).
5. **The refusal registry extension** in `lib/uploadGuard.ts`: `UploadKind`, `refuseByFilename(filename, kind)`, `refuseBarChartByContent(...)`, and the bar-chart messages (section 2.3).
6. **`lib/countyDayObsCache.ts`**: the durable per-(regionCode, date) store, its OWN document on both transports since the 2026-09-27 amendment (`data/county-day-obs.json` on Tauri; key `county-day-obs-v2` on web/Pi) with a 10,000,000-code-unit payload budget, its `clearDerived.ts` row and `cacheInventory` pairing (section 3). `storage.ts` gains the three typed seam methods it rides on (`getCountyDayObsStore` / `setCountyDayObsStore` / `deleteCountyDayObsStore`).
7. **`/map/county-day-obs`** on both transports, in `EBIRD_GATED_PATHS`, with a twinned reducer `lib/countyDayObsReduce.ts` / `_reduce_county_day_obs` and a shared malformed-row fixture (section 4).
8. **`lib/targets/`**: the county choices, the record fold, the classification, the filter, the sorts, the live derivation, the window rule, and the hooks (section 5).
9. **The `targets` tab**: `components/targets/*.tsx`, the `tabLayout.ts` roster and migration change, the `tabIcons.tsx` entry, the `App.tsx` wiring (section 6).
10. **The preference `targetsCounty`** (section 5.4).
11. **Guards** (section 9) and `paths` extensions in `.claude/rules/security.md` and `.claude/rules/testing.md` (section 9.4).
12. **Published surfaces**: `docs/HELP.md` `## Targets` section and its TOC entry; `PRIVACY_POLICY.md` two sentences shown to the user first; one PROPOSED sentence each for `website/` and `README.md`, not written until approved (section 10).

### Modified

- `lib/storage.ts`: four interface methods, a fourth chain key, a fourth Tauri document, four `WebStorage` routes. No existing method, path or chain changes.
- `backend/main.py`: includes `barcharts_router` before `settingskv_router`; `backend/routers/settingskv.py`: `"barcharts"` joins `_RESERVED_KEYS`.
- `lib/uploadGuard.ts`: `refuseByFilename` gains a defaulted `kind` parameter (every existing call keeps its behaviour); new exports beside it.
- `lib/transport.ts`: one `TauriTransport.get` branch, one `EBIRD_GATED_PATHS` member.
- `lib/tauri/mapService.ts`: `getCountyDayObs`. `backend/routers/map.py`: `get_county_day_obs`.
- `lib/clearDerived.ts`: one row. `lib/cacheInventory.test.ts`, `lib/clearDerived.test.ts`: the matching rows.
- `lib/nearbyLifers.ts:124`: `Math.floor` becomes `Math.round`, and the docstring at 111-113 and the comment at 31 say so; `lib/hotspotActivity.ts:12, 74` and `lib/widgets/widgetRows.ts:27-35` comments updated; `lib/widgets/widgetRows.parity.test.ts:262-275` flipped to agreement (section 7).
- `lib/tabLayout.ts`, `lib/tabIcons.tsx`, `App.tsx` (section 6). `App.tsx` edits are additive: one import thunk plus `lazy`, one `DEFERRED_TABS` member, one prefetch line, one panel block.
- `components/HelpDocs.tsx` TOC: one entry between `calendar` and `map-explorer`.
- `.claude/rules/docs-and-website.md:30, 45` "ten tabs" and the stale-count comments the tab agent listed (`tabIcons.tsx:3`, `TabNav.tsx:3, 484`, `globals.css:5977`, `lib/mapPanelChrome.ts:60`) are corrected to the PROPERTY rather than a new count where the sentence allows it.
- `ROADMAP.md`: the `isWithinWindow` DST line (`:29`) is retired.
- Version four-file set and `CHANGELOG.md`.

### Unchanged (used, not modified)

`countyCompletenessCache.ts` (no new export: `loadAll` and `dedupedFetch` suffice), `useCountyCompleteness.ts`, `countyCompleteness.ts` (`completenessTargets` is NOT reused: it subtracts against one county's countable names and stops at five; section 5.2 says what is reused instead), `replayStore.ts`, `exoticProvenanceCache.ts`, `checklistProjectsCache.ts`, `hotspotActivityCache.ts`, `ebirdGate.ts`, `rateLimit.ts`, `icloud/**` and `src-tauri/src/icloud.rs` (section 1.5 proves the exclusion), `src-tauri/**` entirely (no native change: the new files live under `AppLocalData/data/`, which the granted `fs` scope already covers), `vite.config.ts` (the `/map` and `/settings` prefixes already proxy), `Calendar.tsx` and `MapExplorer.tsx` (the shared-predicate fix reaches them through `nearbyLifers.ts`; their source is untouched), `settings.py` (its `MAX_BYTES` is imported, not moved), `PRIVACY_POLICY.md`'s structure (two sentences added, nothing removed).

---

## 1. The bar-chart file kind

### 1.1 Decision: a separate family, not a third slot

`TauriStorage.readMeta` (`storage.ts:747-750`) returns exactly `{ ebird, ml }` and every `META_PATH` link (`writeFile`, `deleteFile`, `applySyncedFile`, `applySyncedClear`, `stampFileOrigin`) rewrites `metadata.json` from that object, so a bar-chart entry stored there would be erased by the next backup upload, clear or iCloud arrival, on Tauri only (the backend's `_upload` preserves unknown keys). Widening the `'ebird' | 'ml'` union instead would touch `FileSlot` (`clearDerived.ts:50`), `Slot` / `SLOTS` (`icloud/icloudRecord.ts:14, 44`), `ICLOUD_CSV_FILES`, the Rust `Slot` enum, and every `SLOTS` loop in `icloudSync.ts`, which is the opposite of "provably never synced". So the bar-chart files are their **own family**: their own directory, their own manifest document, their own chain key, their own methods, their own epoch, their own backend router. The two existing slots are untouched.

### 1.2 Tauri layout

```
data/barcharts.json                 the manifest (chained document, key BARCHARTS_META_PATH)
data/barcharts/US-CA-001.txt        one file per county, named by its eBird region code
```

New constants beside the existing ones in `storage.ts` (near line 398): `BARCHARTS_META_PATH = 'data/barcharts.json'`, `BARCHARTS_DIR = 'data/barcharts'`, `barChartFilePath(regionCode) = \`${BARCHARTS_DIR}/${regionCode}.txt\``. The region code is validated by `REGION_CODE_RE = /^US-[A-Z]{2}-[0-9]{3}$/` (the same literal `countyCompletenessCache.ts:67` and `mapService.ts:47` carry; a single-sourced export from `lib/regionCode.ts` is preferred so the three become one, with each consumer keeping its own test per the security.md "single-sourcing prevents drift, not dropping" rule) BEFORE it becomes a path segment; a code that fails the shape never reaches the filesystem on either transport.

**Manifest shape (version 1):**

```
interface BarChartFilesStatus {
  version: 1
  counties: Record<string /* regionCode */, BarChartFileMeta>
}
interface BarChartFileMeta { filename: string; uploadedAt: string }   // uploadedAt: ISO-8601 UTC, as the two slots record it
```

Nothing derived is stored (FR-39): year range, month range, taxa count and the frequency table are re-derived from the file on load, so deleting the file is its whole teardown. `filename` is kept because FR-30 reads the range from it when present.

**Read normalization** (the read side of the write-chokepoint rule, security.md v1.0.11): `normalizeBarChartManifest(raw: unknown): BarChartFilesStatus` keeps an entry only when the key matches `REGION_CODE_RE`, `filename` and `uploadedAt` are strings, `filename.length <= 255` and `uploadedAt.length <= 40`; anything else is dropped. A non-object or wrong `version` reads as the empty manifest. A **rejected** read (fs import failure, read failure, `JSON.parse` failure) propagates: that is UNKNOWN, and the Targets tab shows "Couldn't check for a bar-chart file" with a retry (FR-40), exactly as `readMeta` propagates for `getFilesStatus()`.

### 1.3 The four methods (both transports)

```
getBarChartFiles(): Promise<BarChartFilesStatus>                       // rejects = UNKNOWN; resolves {counties: {}} = EMPTY
readBarChartFile(regionCode: string): Promise<string | null>           // null = absent or unreadable (the readFile contract)
writeBarChartFile(regionCode: string, content: string, filename: string): Promise<void>
deleteBarChartFile(regionCode: string): Promise<void>                  // idempotent: absent is done
```

**Tauri.** `getBarChartFiles`, `writeBarChartFile` and `deleteBarChartFile` are links on `this.chain(BARCHARTS_META_PATH, ...)`, following `writeFile` / `deleteFile` line for line: `mkdir(BARCHARTS_DIR, { recursive: true })`, write the text file, read the manifest with the unchained `readJson`, set or delete `counties[regionCode]`, write the manifest with the unchained `writeJson`. The chain rule holds (no chained call inside a link; a failed link rejects only its caller). `readBarChartFile` is unchained, like `readFile`, with `await this.fs()` outside the `try`. The `docChains` comment at `storage.ts:572-573` ("keys are the three internal path constants") is corrected to "four". The `SINGLE-WEBVIEW INVARIANT` note at `:574-579` covers the new chain by construction: it is module-scoped state in the same webview. `cacheInventory.test.ts:63-71` forbids `Map<`/`Set<`/`shift(`/`splice(`/`MAX_ENTRIES`/`MAX_BYTES` in `storage.ts`; none is needed here (the manifest is a plain record and the size cap lives in the guard and the backend).

**Web/Pi.** A new router `backend/routers/barcharts.py`:

| Route | Behaviour |
|---|---|
| `GET /settings/barcharts` | the manifest; `{"version": 1, "counties": {}}` when absent. A corrupt manifest returns **500**, not empty (the v1.0.25 rule, applied correctly here where `settings.py:34-37`'s "corrupt reads as empty" is a recorded pre-existing weakness) |
| `GET /settings/barcharts/{regionCode}` | `FileResponse` `text/plain; charset=utf-8`, or 404 `"No bar-chart file stored for this county."` |
| `POST /settings/barcharts/{regionCode}` | multipart `file`; filename must end `.txt` or `.tsv` (case-insensitive) else 400 `"Only .txt or .tsv bar-chart files are accepted."`; reads `MAX_BYTES + 1` (imported from `routers.settings`) and returns 413 with the same `_max_bytes_label()` sentence on overflow; writes `DATA_DIR/barcharts/<regionCode>.txt` via `run_in_threadpool`; updates the manifest preserving other keys; `uploadedAt` in the same `strftime` form `settings.py` uses |
| `DELETE /settings/barcharts/{regionCode}` | unlink if present, drop the manifest entry; 200 either way (the web seam already treats 404 as done on `deleteFile`, so this router simply never raises it) |

`regionCode` is `Path(..., pattern=r"^US-[A-Z]{2}-[0-9]{3}$")`: explicit `[0-9]`, never `\d` (security.md v0.5.54); pydantic `pattern=` runs on the Rust engine and is the deliberate carve-out from `fullmatch` (security.md v0.5.88). The docstring states why the on-disk path cannot be steered: Starlette's `str` converter matches one segment, and the pattern admits no separator, dot or percent. `"barcharts"` joins `_RESERVED_KEYS` in `settingskv.py` so `POST /settings/barcharts` can never fall through to the generic key/value store, and `main.py` includes the router before `settingskv_router`. The `/settings` prefix is already in `vite.config.ts`'s proxy, so no proxy change is owed. `backend/tests/test_datadir.py` gains the new router's constants as `DATA_DIR` children. No content validation happens server-side, matching `_upload`: the content rule is the client registry's (section 2.3), and the server's job is the cap and the extension.

`WebStorage` maps the four methods onto those routes with the same failure shapes as its slot methods: `getBarChartFiles` throws on `!res.ok` (UNKNOWN); `writeBarChartFile` posts `new Blob([content], { type: 'text/plain' })` and throws `File save failed (${status})` on `!ok`; `deleteBarChartFile` throws unless `ok`; `readBarChartFile` reuses `readWebFile`'s inactivity watchdog (`storage.ts:185-254`, generalized to take a URL) and returns `null` on `!ok`.

**Interleaving guard (QA-73):** a new `storageWriteSerialization`-shaped test drives `writeBarChartFile` concurrently with `setSetting` and with `writeFile('ebird', ...)` and asserts both documents survive, plus two concurrent `writeBarChartFile` calls for different counties on the SAME manifest, asserting both entries exist afterwards (this is the case the chain exists for).

### 1.4 The epoch: `lib/barChartFilesChanged.ts`, and a stated deviation from FR-26's wording

FR-26 says every add, replace or remove "shall bump the `filesChanged` epoch". Bumping THAT module has three consequences its author did not intend: `icloudSync.ts:1161` runs `requestCheck('files changed')` (a CloudKit metadata query) whenever the bump is not self-notified; `widgetHandoverController.ts:269` regenerates the App Group hand-over; and every tab keyed on `useFilesEpoch()` re-runs its stored-file load effect. None of those readers has any interest in a bar-chart file. CLAUDE.md's standing rule (v1.0.12) is that a stored document with a reader outside the handler that wrote it gets **its own** epoch module of the `filesChanged.ts` shape, and the two shipped instances (`keysChanged.ts`, `mapDefaultsChanged.ts`) are exactly that. So: `lib/barChartFilesChanged.ts` exports `getBarChartFilesEpoch`, `subscribeBarChartFilesChanged`, `notifyBarChartFilesChanged`, entry-safe and dependency-free, with `lib/useBarChartFilesEpoch.ts` as its hook. The import tail (section 2.4) bumps it exactly once per successful add, replace or remove; a refusal bumps nothing (FR-27). **QA-28's "bumps the `filesChanged` epoch exactly once" therefore reads "bumps the bar-chart files epoch exactly once"**, and the PRD is amended to name this module. This is flagged in the hand-back.

The Targets tab keys its manifest read on this epoch AND on the shared `filesVersion` prop (a backup replace can change the county set, which changes which manifest entries are reachable).

### 1.5 Provably never synced

The iCloud controller iterates `SLOTS = ['ebird', 'ml']` (`icloudRecord.ts:44`) at every one of its nine loops, reads `files[slot]` out of `getFilesStatus()` (which never sees the manifest), and on the native side `icloud.rs`'s `Slot` enum admits only `Ebird` and `Ml` at the command boundary (`:129-134`), with `csv_name()` mapping only the two CSVs and the container query predicate `%K LIKE '*.record.json'` (`:1390`). Nothing in this feature adds a `Slot`, a record name, a `SLOTS` member or a native command. **Guard:** `icloudPaths.parity.test.ts` gains a row asserting `SLOTS` is exactly `['ebird','ml']`, that no file under `lib/icloud/**` or `src-tauri/src/icloud.rs` contains the string `barchart` (case-insensitive), and that `storage.ts`'s `BARCHARTS_DIR` is not one of the `ICLOUD_CSV_FILES` values. `PRIVACY_POLICY.md` gains the sentence that the file is stored only on the device and is not part of iCloud Sync (section 10).

### 1.6 Why the bar-chart files are NOT in the clear registry

`clearDerived.ts` registers DERIVED documents keyed on the content of a user file, and `cacheInventory.test.ts` pairs each row to an exported purge that ends in `storage.deleteSetting`. A bar-chart file is a user file the user chose to import, not a derivation of the backup; deleting the backup should no more delete it than deleting the ML export deletes the backup. So no row is owed, and `cacheInventory.test.ts:216-232`'s "registry must not match /handover|widget/i" pattern gains a sibling: the registry must not match `/barchart/i`, with this reason in the message. **Stated residual:** with no backup stored the Targets tab shows setup guidance and no county view, so a stored bar-chart file cannot be removed from the UI until a backup is loaded again. The files are small (about 100 KB each) and device-local; a Settings listing of stored bar-chart files with a Remove control is a ROADMAP item, not part of this build.

---

## 2. The bar-chart file: parser, derivation, join, import

### 2.1 The format, pinned against real bytes

Cornell's `auk` package ships a real download (`inst/extdata/barchart-sample.txt`), read for this design. Its layout, and the tolerances the parser applies:

| Line | Shape in the sample | Parser rule |
|---|---|---|
| title | `Frequency of observations in the selected location(s).:` (note the `.:`) | Ignored. Not required: FR-28 defines the layout by the Sample Size row and species rows, and eBird has changed cosmetic lines before (`ebird-histogramr`'s changelog) |
| taxa count | `Number of taxa: [TAB]133` | Optional. If present and parseable, kept as `declaredTaxa` for the status line; never trusted as a bound |
| blank lines | between every row | Skipped |
| month header | `[TAB]Jan[TAB][TAB][TAB][TAB]Feb…` | Ignored (period positions are fixed at 4 per month) |
| sample sizes | `Sample Size:[TAB]0.0[TAB]0.0[TAB]2.0…` 48 values, trailing tab | **Required, exactly once.** Prefix match `Sample Size:` (case-insensitive, after trim). Exactly 48 numeric cells after dropping one trailing empty cell; each finite, `>= 0`; parsed as a number (eBird writes `1095.0`) |
| species rows | `Bar-headed Goose[TAB]0.0[TAB]…` 48 values, trailing tab; values may be `9.132E-4`; the CURRENT download wraps the scientific name as `Lincoln's Sparrow (<em class="sci">Melospiza lincolnii</em>)` | One row per line after the Sample Size row. Exactly 48 numeric cells after dropping one trailing empty cell; each finite and in `[0, 1]`; an empty cell reads as `0`. Otherwise the row is `malformed` (counted, skipped, never refuses the file) |

**Bounds** (each named at its enforcement point in `parseBarChart.ts`):

| Bound | Value | Why |
|---|---|---|
| input size | `MAX_UPLOAD_BYTES` (50 MB), checked by the registry BEFORE the parser runs | the app's stored-file cap; a real file is ~100 KB |
| preamble | at most `MAX_PREAMBLE_LINES = 64` non-blank lines before the Sample Size row | a file that has not shown its Sample Size row in 64 lines is not a bar-chart file; refused cheaply rather than scanned to the end |
| line length | `MAX_LINE_CHARS = 65_536` | a species row is ~600 chars; a longer line is `malformed` (skipped); a longer Sample Size line refuses the file |
| cells per row | exactly 48 + at most one trailing empty | the format; the scanner stops after finding 50 tab positions and checks the remainder is empty, so a hostile 60 MB single line costs one pass and one check, never 60 MB of cells |
| numeric token | `<= 32` chars, then `Number()` | `Number()` on a bounded string is constant time; a longer token is malformed |
| name cell | `<= 512` chars after tag stripping | the widget's `RECORD_MAX_STRING`; eBird's longest name is ~60 |
| raw name cell | `MAX_RAW_NAME_CELL = 2_048` (4 x the name bound), line start to the first tab, markup and entities included | the current download's cell is ~130 chars; a longer raw cell is `malformed` before any name work runs, which is what makes the per-row name work O(1) (section 10) |
| sample size | each Sample Size cell `<= MAX_SAMPLE_SIZE = 1_000_000_000` | keeps the sample-weighted sums finite (48 x 1e9 x a frequency in [0, 1]), so no percent can read NaN or Infinity; a larger cell refuses the file as `bad-sample-size` (security review I2: 48 cells of ~9e307 rendered "NaN%") |
| species rows | `MAX_TAXA_ROWS = 20_000` | the world list is ~11,000; forms and spuhs add hundreds; a 20,001st row refuses the file as not a bar chart |

**The name cell.** `splitNameCell(cell): { name: string; sciName: string | null }`: find `<em class="sci">` with `indexOf`; if present, `sciName` is the text up to the following `</em>`, and `name` is the text before it with one trailing ` (` (space, paren) removed and trimmed; if absent, `name` is the whole cell trimmed. Then any remaining `<`…`>` span is removed by one character loop (a tag eBird has not shown yet is stripped, not rendered; the app never interprets the file as HTML). `sciName` is captured for the unmatched-rows list's display only and is NOT a join key in v1 (the pool carries no scientific name; section 2.5).

### 2.2 The derivation: one pure function, one switch

`lib/barChart/barChartFrequency.ts`:

```
export type FrequencyMethod = 'sample-weighted' | 'period-mean'
export const FREQUENCY_METHOD: FrequencyMethod = 'sample-weighted'      // pinned against the user's Alameda file (section 2.6)

export function frequencyPercent(freqs: readonly number[], sampleSizes: readonly number[], periods: readonly number[], method = FREQUENCY_METHOD): number | null
//   sample-weighted: 100 * Σ_{p∈periods} freqs[p]·sampleSizes[p] / Σ_{p∈periods} sampleSizes[p]; null when the denominator is 0
//   period-mean:     100 * mean over p∈periods with sampleSizes[p] > 0 of freqs[p]; null when no such p
export const ALL_PERIODS: readonly number[]                              // 0..47
export function monthPeriods(month1to12: number): readonly number[]      // [4(m-1) .. 4(m-1)+3]
export function yearRoundPercent(row, sampleSizes) = frequencyPercent(row.freqs, sampleSizes, ALL_PERIODS)
export function thisMonthPercent(row, sampleSizes, month) = frequencyPercent(row.freqs, sampleSizes, monthPeriods(month))
```

Why `sample-weighted` is the default: eBird's per-period frequency is `checklists reporting / checklists`, so `Σ f_p·n_p` is the total number of checklists reporting the species and `Σ n_p` the total number of checklists, and their ratio is the Targets page's "frequency" over the same range. The alternative (`period-mean`) over-weights thin periods and is kept only so the pin in section 2.6 can be re-run against it in one line if the user's file disagrees. Display rounds with `toFixed(2)`; sorts use the raw number (a row with `null` sorts after every number, FR-34).

**Ranges.** `lib/barChart/barChartFilename.ts` exports `parseBarChartFilename(filename): { regionCode: string | null; years: [number, number] | null; months: [number, number] | null; malformedCode: boolean }` over one anchored pattern:

```
/^ebird_(US-[A-Z]{2}-[0-9]{3})__([0-9]{4})_([0-9]{4})_([0-9]{1,2})_([0-9]{1,2})_barchart(?: \([0-9]{1,3}\))?\.(?:txt|tsv)$/i
```

Fixed classes, bounded quantifiers, no alternation inside a quantifier, anchored: linear. The optional ` (N)` group accepts the duplicate-download suffix browsers add. A filename that begins `ebird_` and contains `__` but does NOT match sets `malformedCode: true` (a non-US code such as `ebird_CA-ON__…`, or junk), and the import is refused with a message that names only the selected county, never the filename (QA-70). Any other filename (`barchart.txt`) yields all-null and is attributed to the selected county (FR-29). Months from the filename `bmo`/`emo` may wrap (`11..2`); `monthsInRange(b, e)` handles `b > e`. When the filename carries no range, `monthsPresent[m]` is true iff any of the month's four periods has `sampleSizes[p] > 0`; years are then `null` and the status line omits them ("eBird bar chart, {County}, {months}").

### 2.3 The refusal registry extension (`lib/uploadGuard.ts`)

`uploadGuard.ts` is on the entry graph (`Settings.tsx` imports it), so the parser cannot be a static import there. The registry stays ONE module by taking the parse as a function:

```
export type UploadKind = 'csv' | 'barchart'
export function refuseByFilename(filename: string, kind: UploadKind = 'csv'): string | null
//   'csv' unchanged; 'barchart' accepts /\.(txt|tsv)$/i else BARCHART_EXTENSION_MESSAGE,
//   then refuses a name over BARCHART_FILENAME_MAX (255 UTF-16 code units, the manifest reader's
//   bound, one exported declaration also read by storage.ts) with BARCHART_NAME_TOO_LONG_MESSAGE;
//   TauriStorage.writeBarChartFile refuses the same names and the web/Pi route answers 400
//   (`_FILENAME_MAX`, compared to the TS constant by uploadGuard.test.ts). Security review L2.
export const BARCHART_EXTENSION_MESSAGE = 'Only .txt or .tsv bar-chart files are accepted.'
export const BARCHART_LAYOUT_MESSAGE = 'This is not an eBird bar-chart file. Download it from the county\'s bar chart page on ebird.org (Download Histogram Data).'
export const BARCHART_UNREADABLE_CODE_MESSAGE = 'This file\'s name carries a region code SnowRaven cannot read. Rename it, or download the county\'s file again from ebird.org.'
export function barChartRegionMismatchMessage(fileRegionCode: string, countyLabel: string): string
//   'This file is for {fileRegion}, not {County}. Open {County} and add it there, or download {County}\'s file.'  (fileRegion is the VALIDATED code, safe to show)
export function refuseBarChartByContent(
  content: string,
  ctx: { filename: string; regionCode: string; countyLabel: string },
  parse: (text: string) => BarChartParseOutcome,          // the caller passes parseBarChart; import type only here
): string | null
//   1. exceedsUtf8ByteLimit(content, MAX_UPLOAD_BYTES) → TOO_LARGE_MESSAGE
//   2. parseBarChartFilename(ctx.filename).malformedCode → BARCHART_UNREADABLE_CODE_MESSAGE   (the filename parser is a few lines; it lives in uploadGuard.ts so the registry owns every filename rule)
//   3. regionCode from the filename present and !== ctx.regionCode → barChartRegionMismatchMessage
//   4. parse(content): !ok (no Sample Size row, malformed Sample Size row, zero species rows, a bound tripped) → BARCHART_LAYOUT_MESSAGE
//   5. null
```

`refuseByFilename`'s defaulted parameter keeps `Settings.tsx`'s two call sites byte-identical in behaviour; `uploadGuard.test.ts` gains rows for every branch above plus a guard that `uploadGuard.ts` has no static import of `barChart/parseBarChart` (`entryChunk.test.ts` asserts the parser is not in App's closure; section 9). `BarChartParseOutcome` is exported from `parseBarChart.ts` and imported into `uploadGuard.ts` with `import type` (erased; `entryChunk.test.ts` skips `import type`).

### 2.4 The import tail: `lib/barChart/barChartImport.ts` (lazy)

```
export async function importBarChartFile(regionCode: string, countyLabel: string, filename: string, getContent: () => Promise<string>): Promise<{ ok: true } | { ok: false; reason: string }>
//   refuseByFilename(filename, 'barchart') → reason           (before the bytes are read)
//   content = await getContent()
//   refuseBarChartByContent(content, { filename, regionCode, countyLabel }, parseBarChart) → reason   (before anything is written)
//   await storage.writeBarChartFile(regionCode, content, filename)
//   notifyBarChartFilesChanged()          (exactly once)
export async function removeBarChartFile(regionCode: string): Promise<void>   // deleteBarChartFile, then notify once
```

A refusal returns before `writeBarChartFile`, so the previous file and manifest entry are byte-identical afterwards (FR-27, FR-37, QA-29). Replace is the same call as Add: `writeBarChartFile` overwrites, and the manifest entry is replaced in the same link. The component that owns the `<input type="file" accept=".txt,.tsv">` (section 6.3) calls this and renders the reason in an always-mounted `role="alert"` region with a sequence-keyed child, the `FileRow` shape (`Settings.tsx:439-446`).

### 2.5 The join and the three-way accounting (`lib/barChart/barChartJoin.ts`)

```
export function joinBarChartToPool(file: BarChartFile, pool: readonly EbirdSpecies[]): BarChartJoin
interface BarChartJoin {
  bySpeciesCode: Map<string, BarChartRow>        // the joined rows, keyed by pool speciesCode
  matched: number
  skippedForms: number                           // rows whose name isNonCountableForm(name) (spuh, slash, hybrid, domestic)
  unmatched: { name: string; sciName: string | null }[]   // species-shaped names that joined nothing
  malformed: number                              // rows the parser skipped (not species rows; reported separately, not in the FR-35 sum)
}
```

The join key on both sides is `normalizeSpeciesName(name).toLowerCase()`: the Nearby Lifers rule (`buildNearbyLifers`, `nearbyLifers.ts:42, 49`). A pool index `Map<key, speciesCode>` is built once (O(pool)); each file row is one `Map.get` (O(rows)). Subspecies rows in the file (`Dark-eyed Junco (Oregon)`) fold to their species key by `normalizeSpeciesName` and would collide with the species row; the rule is **the species-shaped row wins** (a row whose raw name equals its normalized name is taken; a folded row is taken only when no species-shaped row exists for the key, and is counted `matched`). `isNonCountableForm(rawName)` runs BEFORE the fold, on the raw name (the house order in `subspeciesExplorer.ts:199-202`). `matched + skippedForms + unmatched.length === species rows` is asserted by the join's own test (QA-37). The scientific name is display-only in the unmatched list; joining on it is a v2 item because the pool carries none.

### 2.6 The Alameda pin (FR-33, NFR-11): what the Engineer runs

The user's real file arrives before the Engineer starts. The Engineer:

1. Runs `node scripts/barchart-pin.mjs <file>` (a 40-line dev script added by this build under `frontend/scripts/`, importing the built `parseBarChart` and `frequencyPercent`) which prints, for Lincoln's Sparrow, the `sample-weighted` and `period-mean` year-round figures to two decimals, the September figure, and the count of zero-sample periods.
2. If `sample-weighted` prints `3.29`, `FREQUENCY_METHOD` stays. If `period-mean` prints `3.29` and `sample-weighted` does not, the constant flips and this section and the PRD's Open Question 1 are amended in the same commit. If neither prints `3.29`, the Engineer stops and returns a flag (the derivation is then a user conversation, not a guess).
3. Writes `frontend/src/lib/barChart/alameda.fixture.json`: the 48 sample sizes, the rows for Lincoln's Sparrow and at least two other species (one common, one with a zero-sample period), the filename, and the expected figures as printed. `barChartFrequency.test.ts` asserts the figures from the fixture (never re-typed), asserts Lincoln's Sparrow `=== '3.29'` after `toFixed(2)`, and asserts the two methods DIFFER on at least one fixture row (so the pin discriminates the methods rather than passing on both; testing.md's "a fixture must contain a row that separates the twins").

The fixture is public eBird data (frequencies and checklist counts for a county); it carries nothing of the user's.

**Pin result (2026-09-27):** run against the user's `ebird_US-CA-001__1900_2026_1_12_barchart.txt` (645 rows, 0 malformed, 0 zero-sample periods): Lincoln's Sparrow year-round `sample-weighted` 3.29, `period-mean` 3.16; September 3.47 against 3.22. `sample-weighted` confirmed and `FREQUENCY_METHOD` unchanged; `alameda.fixture.json` carries Lincoln's Sparrow, American Crow (most frequent) and Red-crested Cardinal (least frequent) with both methods' figures, and since the file has no zero-sample period the null denominator stays covered by the synthetic fixture's February.

---

## 3. The live sweep cache: `lib/countyDayObsCache.ts`

### 3.1 Decision: the `countyCompletenessCache` pattern, keyed per (regionCode, date)

Same shape as `countyCompletenessCache.ts` (an in-memory mirror over one persisted document, entry and payload budgets, an in-flight dedupe map, errors never cached, offline stale reads), with three things that pattern lacked and CLAUDE.md now requires: validation at the WRITE chokepoint (`checklistProjectsCache.ts:379` is the reference), a purge generation captured at the fetch chokepoint (the `exoticProvenanceCache.ts:519` internal-capture shape, since the chokepoint is inside this module), and a per-entry `complete` flag that replaces a TTL. `replayStore` was considered and rejected as the STORE: it has no per-entry validation on load, it is keyed by transport path and its semantics are "the last answer for this request", not "a complete day". **Amended 2026-09-27: `replayStore` is, however, the precedent for the store's HOME.** The document is no longer a key in the shared settings document; it is its own file with its own ordered writer, exactly as `data/replay.json` is (section 3.2), and its eviction is no longer plain insertion FIFO (section 3.2, "Eviction order").

**Why the amendment (user decision at the live look, `decisions.md` 2026-09-27).** Measured in the preview against the user's real data: Alameda's 30 days are 0.61 MB and Los Angeles's 0.93 MB, about 170 bytes per saved record, so the 2,000,000-code-unit budget held two or three busy counties before re-downloading. The reason the budget was kept that small was where the store lived: on Tauri every settings key sits in the single `data/settings.json`, which every `setSetting` rewrites, so a 10 MB key there would have made every preference save a 10 MB write. Moving the store to its own document removes that coupling and lets the budget be sized for the feature: 10,000,000 code units, about ten busy counties.

### 3.2 Document (amended 2026-09-27)

**Home, both transports.** Tauri: its own file `data/county-day-obs.json` under `AppLocalData`, reached through three typed seam methods on `StorageAdapter` (`getCountyDayObsStore(): Promise<unknown | null>`, `setCountyDayObsStore(doc): Promise<void>`, `deleteCountyDayObsStore(): Promise<void>`), written the way `setReplayStore` writes `data/replay.json` (`mkdir(DATA_DIR, recursive)` then `writeTextFile`), read the way `getReplayStore` reads it (`exists` then `readTextFile`, `null` on absence or on any failure: for a derived cache an unreadable document IS an empty one, which is the branch `ensureLoaded` already takes; this is not the v1.0.25 UNKNOWN-vs-EMPTY case, which is about a file-status read), and deleted with the granted `fs:allow-remove` after an `exists` check so an absent file is already the state asked for. The path constant `COUNTY_DAY_OBS_PATH = \`${DATA_DIR}/county-day-obs.json\`` is EXPORTED, as `BARCHARTS_META_PATH` is, for the iCloud exclusion guard. Web/Pi: the generic `settingskv.py` route, key `county-day-obs-v2`, so the file is `data/settings/county-day-obs-v2.json`, its own file already by that router's one-file-per-key design; the three seam methods map onto `this.getSetting` / `this.setSetting` / `this.deleteSetting` with that key, exactly as the web `getReplayStore` / `setReplayStore` do. **No new backend route, no `_RESERVED_KEYS` change, no Vite proxy entry, no `PRIVACY_POLICY.md` change** (the published sentence says the answers are kept on this device; which on-device file holds them is not a published fact). The store module never names the key or path itself: `storage.ts` owns both, so the seam stays the single place the layout is known.

**Inside the webview's `fs` grant on purpose.** `capabilities/default.json` grants read, write, mkdir, exists and remove on `$APPLOCALDATA/**`, and this file is a NON-dotted name under `data/`, so it is inside that grant, which is what a webview-owned document needs. The v1.0.13 leading-dot rule in `security.md` is for NATIVE-side documents the webview must not reach; it does not apply here, and applying it (a leading dot) would put the file outside the grant and fail every write. Nothing native reads this file. **Never synced:** `icloudNative.ts`'s `ICLOUD_CSV_FILES` names exactly the two CSVs, `icloud.rs` names only those two and `*.record.json`, and the controller's slot set is `['ebird', 'ml']`; the guard in section 9 pins the new path against all three, the same three legs section 1.5 uses for the bar-chart files.

```
COUNTY_DAY_OBS_PATH = 'data/county-day-obs.json'    // storage.ts, exported; Tauri
'county-day-obs-v2'                                 // storage.ts; the web/Pi settingskv key (its own file there)
LEGACY_DAY_OBS_SETTING_KEY = 'county-day-obs-v1'    // countyDayObsCache.ts; the preview-build key, deleted once (3.6)
DAY_OBS_MAX_ENTRIES = 3_000                          // a backstop on envelope count, sized so the payload budget binds first (below)
DAY_OBS_MAX_BYTES  = 10_000_000                      // JSON.stringify(entry.species).length code units, summed; NOT a byte cap
DAY_OBS_MAX_SPECIES = 5_000                          // unchanged
WRITE_DEBOUNCE_MS = 1_000                            // was 250; a 10 MB flush is the reason (below)

interface DayRecord {
  speciesCode: string      // ^[a-z0-9]{1,16}$ (lib/speciesCode.ts's SPECIES_CODE_RE; the widget's bound)
  obsDt: string            // ^[0-9]{4}-[0-9]{2}-[0-9]{2}( [0-9]{2}:[0-9]{2})?$ and its date part === the entry's date
  locId: string | null     // ^L[0-9]{1,15}$ else null (the app's location-id gate; a HotspotLink can use it later)
  locName: string          // <= 512 code units; display only
  lat: number | null       // finite, in [-90, 90], else null (both null when either fails)
  lng: number | null       // finite, in [-180, 180]
}
interface DayObsEntry {
  fetchedAt: number        // ms epoch
  complete: boolean        // true iff the entry's date < the device's local date AT FETCH TIME
  bytes: number
  species: DayRecord[]     // <= 5_000
}
interface DayObsStore { version: 2; entries: Record<string, DayObsEntry>; order: string[] }   // version 1 → 2 with the move (3.6); `order` is INSERTION order, kept for hygienic enumeration, no longer the eviction order
key = `${regionCode}|${YYYY-MM-DD}`      // KEY_RE = /^US-[A-Z]{2}-[0-9]{3}\|[0-9]{4}-[0-9]{2}-[0-9]{2}$/
```

`isValidEntry` checks every field above (finite numbers, the string bounds, the array cap, and every record's fields) and runs on load (`sanitizeStore` drops invalid entries and keys, never throws) AND inside `putEntry` before the merge, so no out-of-bound value can exist in the document whatever the producer did. The species array holds exactly what the reducer emits (section 4.3), so a store entry and a fresh response have one shape and one validator. **Load-time admission (amended):** `sanitizeStore` admits at most `DAY_OBS_MAX_ENTRIES` valid keys in `order` sequence and drops the rest before it runs `evict`, so the O(n) victim scan below is bounded by the cap and not by whatever a bloated document holds; the byte budget is then enforced by `evict` as at any put.

**Why 10,000,000 and 3,000 (amended 2026-09-27), and what each costs.** The unit is unchanged: `JSON.stringify(entry.species).length`, UTF-16 code units summed over entries, the completeness and replay stores' unit; keys, `fetchedAt`, `complete`, `bytes` and `order` are outside it (about 120 code units per entry, so at most ~360 KB at the entry cap), and one sole oversized newest entry is allowed, as in both precedents. Measured: 0.61 MB (Alameda) and 0.93 MB (Los Angeles) per 30-day window, ~170 bytes per record, so 10,000,000 code units is ten to sixteen busy counties' windows, "about ten" being the honest figure once quieter days and re-fetched todays are counted. **In bytes:** a record is ~130-140 code units of ASCII (species code, `obsDt`, `locId`, two numbers, the JSON keys and punctuation) plus a `locName`; only the name can be non-ASCII, so UTF-8 is about 1.0-1.05x the code-unit figure for real eBird data and up to about 2.6x in the adversarial limit (a 512-character name made entirely of three-byte characters; corrected from "~1.4x" at the re-entry security review, I8), which is why the 413 fallback below is load-bearing rather than theoretical. The on-disk document is therefore ~10-11 MB, and the web/Pi write fits `settingskv.py`'s 16 MiB `_MAX_BYTES` at any realistic mix. Stated residual, not fixed: a payload of 5,000 records each carrying a 512-code-unit non-ASCII `locName` is ~8 MB of UTF-8 per ENTRY, so three of them would exceed 16 MiB and the web/Pi flush would 413; the flush is best-effort, the mirror stays the live source, and the next flush retries. Tauri has no such cap (a file write). **The entry cap is 3,000 so the payload budget is the constraint that binds.** At the measured 20-31 KB per busy day, 10 MB is 320-490 busy days, so the old cap of 300 would have bound at 6-9 MB of busy days and at under 1 MB of quiet ones (a 20-report day is ~3.4 KB; 300 of them are 1 MB). For the payload budget to bind first down to a ~3.3 KB day the count cap must be at least ~3,000; above that the cap is only a backstop against a document of near-empty days (an empty day is 2 code units of payload but ~120 of envelope, outside the budget), which is what it is for. The budget bounds records (10,000,000 / ~170 is ~59,000), the cap bounds envelopes, and each victim scan is O(cap).

**Why the write cadence changes with the size.** A flush serializes the WHOLE document on the main thread (`JSON.stringify` of up to ~10 MB) and writes it. The sweep's gap between puts is one request's latency plus the 150 ms gate spacing, typically 300-600 ms, so the old 250 ms trailing debounce fired after nearly every day and a 30-day pass could stringify 30 x 10 MB. `WRITE_DEBOUNCE_MS` becomes 1,000 ms, which coalesces a pass into a handful of flushes; the cost is that a crash inside the window loses at most one second of answers, each of which costs one request to re-ask. The Engineer measures the stringify-plus-write time for a ~10 MB document once in the live look and records it in `decisions.md`; if it exceeds ~50 ms on the build Mac the durable answer is a trailing max-wait rather than a longer debounce (flagged, not specified). The same live look measures the first-load cost: `sanitizeStore` validates every record of a ~10 MB document once per session on the Targets tab's first open (~59,000 records through the record validator), off the entry chunk and before the cached cells render.

**Eviction order (amended 2026-09-27: the Engineer's flagged limitation is fixed now, not deferred).** Plain insertion FIFO was wrong for this store in a way the first draft stated but did not fix: the sweep inserts NEWEST-first, so within one county the first-inserted key is its most recent day, a re-fetched today moves to the tail, and a FIFO victim was a county's newest days, the ones the live rows and "last reported" read most. Eviction is now a comparator over every entry except the one being written, and the victim is the minimum under, in order:

1. **outside the window first** -- `date < lastNDates(now)[SWEEP_DAYS - 1]` (the oldest date of the sweep's own 30-day window, from `targets/targetsDates.ts`, which the store already imports); a day the tab can no longer show is dead weight whatever county it belongs to;
2. **the oldest-visited county** -- `lastVisited(regionCode) = max(fetchedAt)` over that county's entries; a visit always re-fetches today, so this IS the last visit time, with no new field in the document;
3. **the smallest `date` within it**, so a county sheds its oldest days first and keeps its newest;
4. the key itself, as a deterministic tiebreak.

`evict(store, keep)` recomputes the comparator's inputs on each iteration (evicting an entry can lower its county's `lastVisited`), so one victim costs O(n) with n <= 3,001 and a worst-case load-time drain is O(n^2) with the same n, about 9 M comparisons, milliseconds; a put at capacity evicts one entry, one scan. `keep` is the key being written, exempt so the newest answer always survives (the one-sole-oversized rule); when nothing but `keep` remains, eviction stops. A single county over the budget on its own (impossible at the measured record size, theoretically ~25 MB at 5,000 records a day for 30 days) therefore evicts the day fetched just before the current one, since the sweep runs newest to oldest; stated, accepted. A crafted `fetchedAt` in the far future would make its county "most recently visited" and last to be evicted; it is bounded by the same caps as every other entry and is stated rather than clamped. `order[]` remains in the document as insertion order, used for hygienic enumeration on load and by `loadAll`, and is no longer read by `evict`.

### 3.3 Read and write API

```
export async function loadAll(): Promise<ReadonlyMap<string, DayObsEntry>>                // fresh, stale and incomplete alike; no network
export async function dedupedFetch(regionCode: string, date: string, loader: () => Promise<DayObsPayload>): Promise<{ entry: DayObsEntry; fromNetwork: boolean }>
//   complete hit → returned without calling the loader
//   incomplete hit → the CALLER decides (section 3.4 fetches today at most once per visit); dedupedFetch itself always refetches an incomplete entry when called
//   in-flight for the same key → shared
//   gen = _purgeGeneration captured BEFORE the loader; putEntry refuses when gen changed or store !== _store
//   loader rejects → rethrow; if isOfflineError(err) and an entry (complete or not) exists → return it with fromNetwork:false; NEVER cached
export async function purgeCountyDayObsStore(): Promise<void>     // timer cleared, _inflight.clear(), _purgeGeneration += 1, mirror swapped to EMPTY, then `await writeThrough(() => storage.deleteCountyDayObsStore())` (amended 2026-09-27: the delete rides the store's own write chain, section 3.6)
export function _resetCountyDayObsCacheForTests(): void           // also resets _writeChain and the legacy-delete latch (3.6)
export function _getCountyDayObsCacheWorkStatsForTests(): { loads: number; loaderCalls: number; puts: number; evictions: number; writeSchedules: number; writeFlushes: number }
```

`complete` is decided at write time from `localDateString(Date.now())` (device local date, the same rule the sweep uses to build its 30 days). Late eBird submissions to a past day are a stated residual: a complete day is never re-fetched, so a checklist entered two days late is invisible until the entry is evicted. Eviction order is the comparator in section 3.2 (amended 2026-09-27; the earlier sentence here claiming insertion order was "chronological within a county" was wrong, since the sweep inserts newest-first).

### 3.6 Write discipline and migration (added 2026-09-27)

**Its own ordered writer; it does NOT join `docChains`.** `docChains` exists for SHARED documents (settings, api-keys, metadata, the bar-chart manifest), where two writers each rewrite the whole file from a base they read, and an unserialized read-modify-write is the lost-update clobber of v1.0.9. `data/county-day-obs.json` has no read-modify-write to clobber: it is its own file with a single writing MODULE, whose writes are whole-document snapshots of an in-memory mirror that is the source of truth. The reason that argument holds is structural and is written down here because a future change would break it silently, exactly as CLAUDE.md records for `replay.json`: **a write is reachable only from a flush, which requires a completed `ensureLoaded`, or from the purge, which awaits it.** Add a re-load-after-purge, a second module that writes the document, or any read of the file that feeds a write, and the reason is gone, at which point this document owes the full `docChains` treatment (a `COUNTY_DAY_OBS_PATH` key on the chain and its methods as links). But one module is not one write at a time, which is the half `replay.json` paid for in v1.0.14: two `setCountyDayObsStore` calls in flight complete in whatever order the filesystem returns, and the purge's document is the smaller one, so it is the likelier to land first and be overwritten by a pre-purge flush already inside the seam, which neither the cancelled timer nor the `store !== _store` identity check reaches, because by then the write has begun. So every write goes through one module-scoped chain, `replayStore.writeThrough`'s shape with one difference: it takes a THUNK, not a snapshot, because the purge's link is a delete rather than a write.

```
let _writeChain: Promise<void> = Promise.resolve()
function writeThrough(op: () => Promise<void>): Promise<void> {
  const link = _writeChain.then(op)
  _writeChain = link.then(() => undefined, () => undefined)   // the stored tail swallows: one failed link never poisons the chain
  return link
}
// flush:  void writeThrough(() => storage.setCountyDayObsStore(snapshot)).catch(() => {})   // best-effort, mirror stays live
// purge:  await writeThrough(() => storage.deleteCountyDayObsStore())                       // awaited and NOT caught: clearDerived collects the failure
```

Same two rules as `TauriStorage.chain`: a link never awaits another chained write, and a failed link rejects only its own caller. The purge's delete being ON the chain is what guarantees a flush already in flight lands BEFORE the delete rather than after it. `scheduleWrite` keeps its identity check (`store !== _store` skips a pre-purge closure) and the purge keeps cancelling the timer, clearing `_inflight` and moving `_purgeGeneration` before it touches disk; the chain is the fourth guard, not a replacement for the three.

**SINGLE-WEBVIEW INVARIANT.** The mirror, the in-flight map, the purge generation and now `_writeChain` are all module-scoped JS state, so each protects one JS context only, sufficient while the app runs exactly one webview. The module's existing marker note is rewritten to point at CLAUDE.md (Desktop storage (Tauri), the v1.0.9 entry) for the reversal condition rather than at `storage.ts`, because `singleWebviewInvariant.test.ts` gains this file as a SIXTH site (section 9) and its "every note points at CLAUDE.md" row requires the literal `CLAUDE.md`. `replayStore.ts:259`'s comment, "the app's one durable document NOT on the storage seam's `docChains`", becomes false with this change and is corrected to name both documents.

**Purge = delete, not an empty write.** Unlike `purgeChecklistReplay`, which keeps the coordinate-keyed entries and so must write a smaller document, this purge removes the whole store, so its link deletes the file (Tauri `remove` behind an `exists` check; web/Pi `DELETE /settings/county-day-obs-v2`, idempotent). `fs:allow-remove` on `$APPLOCALDATA/**` is already granted (`deleteBarChartFile` and the CSV delete depend on it); the guard in section 9 pins the grant because the clear path now depends on it here too.

**Migration: bump, delete the preview key once, argue nothing else.** The store has never shipped. The only places `county-day-obs-v1` has ever been persisted are the unreleased preview builds this run produced: the desktop dev app's `data/settings.json` on the build Mac, and the tailnet preview backend's `data/settings/county-day-obs-v1.json`. No released version, no App Store or TestFlight build, and no iCloud record has ever carried it (settings are never synced), so there is no user population to migrate FROM and nothing worth carrying: the answers are re-askable at one request per day. The document `version` moves 1 -> 2 and the new home has no `-v1` anywhere, so a stray v1 document read from the wrong place would be the empty store, never a migration, per the module's own rule. What the move must NOT leave behind is the preview key as up to 2 MB of dead weight rewritten on every settings change in `settings.json`: `ensureLoaded` therefore fires `void storage.deleteSetting(LEGACY_DAY_OBS_SETTING_KEY).catch(() => {})` exactly once per session, from a module-scoped latch, AFTER the new store's read resolves and OUTSIDE `_writeChain` (it is a link on the seam's own `SETTINGS_PATH` chain and touches a different document). On Tauri that is one `settings.json` rewrite without the key; on web/Pi it unlinks the old file; on a device that never ran a preview it is a `deleteSetting` of an absent key, which both adapters treat as done. It is not on the purge path (`purgeCountyDayObsStore` deletes the v2 document only), so `cacheInventory.test.ts`'s "settings-document stores call `storage.deleteSetting(`" check cannot be satisfied by it vacuously: that check is re-scoped in section 9. **Removal condition, stated at the definition site:** the line may be deleted in any release after 1.0.38 has been run once on the build Mac and the preview backend, and it is not worth a ROADMAP row.

### 3.4 The sweep controller: `lib/targets/useCountyDaySweep.ts`

Inputs: `regionCode`, `hasEbirdKey: boolean | null`, `online: boolean`, `poolCodes: ReadonlySet<string>`. State: `days: Map<YYYY-MM-DD, DayObsEntry | 'unchecked' | 'failed'>` for the 30 local calendar days ending today, plus a status of kind `idle | no-key | offline | sweeping {checked,total} | cooldown {seconds} | paused | unanswered {failed[]} | complete {at}`.

Pass shape (the `useChecklistProjects.ts:315-458` precedent, with one difference stated):

1. Seed from `loadAll()` for the 30 keys. Every complete entry is final. Today's entry, if present, is displayed immediately and marked for ONE refetch this visit (`refetchedTodayRef`), so a same-day revisit costs exactly one call (FR-44, QA-46) and the next day costs one or two.
2. If `hasEbirdKey !== true` → status `no-key`, no request (FR-43, NFR-07). If `!online` → status `offline`, cells from cache, line "Offline; live counts from {date}" where `{date}` is the newest complete entry's date, or "Offline; no live data yet".
3. Otherwise iterate the unchecked days **newest first** (so the last-report date settles early), sequentially:
   - `wavesThisPass = ebirdGateState().waveCount - wavesAtStart`; if `>= SWEEP_PAUSE_WAVES` → `paused`, stop; if `> 0` → `await sleep(sweepSpacingMs(waves, ACTIVITY_START_SPACING_MS))` (the FULL widened interval; the gate's floor elapses inside it).
   - `await countyDayObsCache.dedupedFetch(regionCode, date, () => transport.get<DayObsPayload>('/map/county-day-obs', { regionCode, date }))`. **The controller does NOT wrap this in `gatedEbirdCall`**: the route is in `EBIRD_GATED_PATHS`, so `transport.get` already applies the spaced start, the cooldown wait and the two bounded retries (CLAUDE.md: one enforcement point per request; `useChecklistProjects` wraps only because `/checklists/{id}` cannot be in the set).
   - On rejection: `classifyLiveError`; `offline` or `no-key` ends the pass with that status; anything else marks the day `failed` (never cached) and continues.
4. A ticker reads `ebirdGateState().cooldownUntil` while it is in the future and emits `cooldown {seconds}` for "eBird asked us to slow down; resuming in {s} s" (FR-46).
5. End: `complete {at: Date.now()}` when every day is checked; `unanswered {failed}` when some failed, with `retry()` re-running step 3 over the failed days only; `paused` exposes `resume()`.

Progress copy is derived from `checked` / `total` (FR-45, FR-42's "of {K} days checked so far").

### 3.5 Registry and inventory

- `clearDerived.ts` `TEARDOWNS` gains `{ slot: 'ebird', store: 'county-day-obs.json', purge: async () => (await import('./countyDayObsCache')).purgeCountyDayObsStore() }` (amended 2026-09-27: the row is named after its Tauri file, the `replay.json` row's convention for an own-document store; it was `'county-day-obs-v1'`). Keyed on counties the user has birded (the key set argument CLAUDE.md requires), so the row is owed; accepted cost: a county's 30 days re-fetch once after a clear and re-upload. The purge generation is still captured at the fetch chokepoint (`dedupedFetch`, before the loader) and checked in `putEntry`; the move changes where the document lives, not how a Clear supersedes in-flight work.
- `cacheInventory.test.ts` `stores` keeps `['./countyDayObsCache.ts', 'purgeCountyDayObsStore']` as its fourth row, and the trailing settings-document check is RE-SCOPED (amended 2026-09-27): the three settings-document stores (`slice(0, 3)`) must match `storage.deleteSetting(`; the two own-document stores (day-obs and replay) must each contain `function writeThrough(` and `_writeChain`; and the day-obs module's only `storage.deleteSetting(` call must name `LEGACY_DAY_OBS_SETTING_KEY`, while its purge calls `storage.deleteCountyDayObsStore()`. Without the re-scope the legacy delete would satisfy the old check for the wrong reason. The `slot: 'ebird'` count stays 5. `clearDerived.test.ts:181`'s sorted list reads `'county-day-obs.json'`, and the non-vacuity row in the bar-chart test reads `store: 'county-day-obs.json'`.
- `entryChunk.test.ts`: `countyDayObsCache.ts` is NOT in App's closure (positive leg: it is in the Targets chunk's closure). `clearDerived.ts` reaches it through `import()` only, so its closure stays exactly 1 file.

---

## 4. The route: `/map/county-day-obs`

### 4.1 Shape

`GET /map/county-day-obs?regionCode=US-CA-001&date=2026-09-26` → `DayObsPayload { regionCode: string; date: string; species: DayRecord[] }`. Query strings, not path segments, because `EBIRD_GATED_PATHS` and `CACHED_GET_PATHS` are exact `Set.has(path)` checks (`transport.ts:289-297`). It joins `EBIRD_GATED_PATHS` and NOT `CACHED_GET_PATHS` (the durable store is its one caching layer; the same reasoning as `/map/county-species`).

**Validation, identical on both transports (a twinned guard, so both halves are stated):**

| Parameter | Rule | Python | TypeScript |
|---|---|---|---|
| `regionCode` | `^US-[A-Z]{2}-[0-9]{3}$` | `Query(..., pattern=...)` (Rust engine; the `fullmatch` carve-out) | `REGION_CODE_RE.test()`; failure throws `{ status: 422 }` (the `getCountySpecies` shape) |
| `date` | `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`, then a REAL calendar day, year in `[1900, 2100]` | pattern, then `datetime.date.fromisoformat` in a `try` → 422 | pattern, then `isRealCalendarDay(y, m, d)` (days-in-month arithmetic; NEVER `new Date(y, m-1, d)`, which rolls `2026-02-30` into March, the `tideService` lesson) → 422 |

The shared malformed fixture (`countyDayObs.fixture.json`, generated by an env-gated vitest that drives both validators per testing.md's twin-fixture rule) carries: a trailing-newline date, a non-ASCII-digit region (`US-CA-٠١٢`), `2026-02-30`, `2026-13-01`, `1899-12-31`, `2101-01-01`, a lowercase state, and a 10-character valid row; each asserts the same verdict on both sides.

**Outbound URL:** `${EBIRD_BASE}/data/obs/${encodeURIComponent(regionCode)}/historic/${y}/${m}/${d}` where `y`, `m`, `d` are integers formatted by the code (not the input string), with no extra parameters (eBird's defaults: `rank=mrec`, `detail=simple`, `includeProvisional=false`, so one record per taxon, the most recent that day; parity with `/map/recent-obs`'s defaults, stated because "live" could argue for provisional and this build does not). The docstring on both sides says why the destination cannot be steered: three validated segments, none able to express a scheme, host, credential, separator or query. The pooled client (`get_client()`) with `timeout=15.0`, redirects not followed; `tauriFetch` with its default 10 s timeout. `429` and other statuses go through the shared mappers (`_raise_ebird_http_error` / `throwEbirdHttpError`); `RequestError` → 502 "Could not reach the eBird API."

### 4.2 Wiring

- `lib/tauri/mapService.ts`: `export async function getCountyDayObs(regionCode: string, date: string): Promise<DayObsPayload>` (validate → `ebirdHeaders()` → fetch → `if (!res.ok) throwEbirdHttpError(res)` → `reduceCountyDayObs(await res.json(), regionCode, date)`).
- `lib/transport.ts`: `if (path === '/map/county-day-obs') { const { getCountyDayObs } = await import('./tauri/mapService'); return getCountyDayObs(params?.regionCode ?? '', params?.date ?? '') as Promise<T> }` before the fall-through at `:235`; `EBIRD_GATED_PATHS` gains the path.
- `backend/routers/map.py`: `get_county_day_obs(regionCode: str = Query(..., pattern=...), date: str = Query(..., pattern=...))`; `_route_cases()` in `backend/tests/test_map_router.py` gains `("/map/county-day-obs", {"regionCode": "US-CA-001", "date": "2026-09-01"})` so the four parametrized 429 tests cover it; the malformed-region test list gains the date rows.
- `transportPathSets.test.ts` (its non-vacuity pin), `transport.test.ts` gate block, `mapService.rateLimit.test.ts` `CASES`: one row each.
- `vite.config.ts`: no change (`/map` is proxied).

### 4.3 The reducer twin: `lib/countyDayObsReduce.ts` / `_reduce_county_day_obs`

One function on each side, shaped like `reduceWidgetRecords` (`widgets/widgetRows.ts:206-234`), NOT like `reduceRecentObs` (which casts with `as string ?? ''` and range-checks nothing): body must be a list (else 502 / `{status: 502}`, the v1.0.29 "the builder is inside the try" rule); at most `5_000` records read (the rest ignored); Tauri additionally refuses a body whose text length exceeds `2_000_000` code units before `JSON.parse`; per record, every string field is a string of at most 512 code units (else the record is dropped), `speciesCode` matches `SPECIES_CODE_RE`, `obsDt` matches the strict date pattern AND its first 10 characters equal the requested `date` (a record eBird files under another day is dropped), `locId` is kept only when it matches `^L[0-9]{1,15}$`, `lat`/`lng` are kept only when both are finite numbers in range (a boolean is not a number on either side: `isinstance(v, bool)` excluded explicitly, `typeof v === 'number'`). Records are de-duplicated by `speciesCode` keeping the greatest `obsDt` (the `reduceActivityRecords` rule). The shared fixture carries conforming rows and one malformed row per field with the same verdict on both sides (security.md v1.0.29: the twins agree on what a malformed figure IS).

`PRIVACY_POLICY.md`'s eBird bullet gains the per-day county query (section 10). It is a new request kind to an already-disclosed host, initiated by the tab with the user's key, on the same component (browser-to-eBird on desktop, backend-to-eBird on web/Pi) as the existing map calls.

---

## 5. The Targets derivations: `lib/targets/`

All pure, all testable without React, all off the entry chunk (they join the Targets lazy closure).

### 5.1 Counties: `targetsCounties.ts`

```
export interface CountyChoice { key: string /* countyKey */; label: string /* "Alameda, CA" */; regionCode: string | null; checklists: number; unavailableReason: string | null }
export function buildCountyChoices(observations: readonly ObservationEntry[], geometry: CountyFC): CountyChoice[]
```

Build a reverse index once, `Map<countyKey(f.properties.stusps, f.properties.name), CountyProps>` over the geometry (the join no existing module has; every shipped join runs geometry → backup). Count distinct `submissionId` per `countyKeyFromState(o.stateProvince, o.county)` over the observations (a `Map`, one pass; non-US rows return `null` and are skipped, which is the US-only mechanism). For each key: a geometry match with `deriveCountyRegionCode(geoid, stusps)` non-null is available; a key with no geometry match, or a match yielding no code, is listed with `unavailableReason = 'SnowRaven cannot map this county to an eBird region'` (FR-06). Sort by `checklists` desc, then `label` asc (`localeCompare` is fine on ~100 rows). The label is `${props.name}, ${props.stusps}`: TIGER's `name` carries no suffix, eBird's own region name for `US-CA-001` is "Alameda, California, US", and FR-05 asks for "County, ST", so **`{County}` in every copy string is "Alameda, CA"**, and QA-32 / QA-38's literal "Alameda County" is amended to "Alameda, CA" (flagged). `loadCountyGeometry()` is reached through `import()` from the Targets hook only.

### 5.2 The record fold and the classification: `targetsRecord.ts`, `targetsClassify.ts`

```
export type SpeciesKey = string                                  // normalizeSpeciesName(name).toLowerCase()
export function speciesKey(name: string): SpeciesKey
export interface TargetsRecord {
  names: ReadonlySet<SpeciesKey>                                 // every observation row, the Nearby Lifers rule (no countability or escapee filter)
  codes: ReadonlySet<string>                                     // /taxonomy/codes over the distinct (name, sci) pairs, read with Object.hasOwn; empty when the lookup failed (name-only subtraction then, as useCountyCompleteness falls back)
  mediaByKey: ReadonlyMap<SpeciesKey, ReadonlySet<'Photo'|'Audio'|'Video'>> | null   // null = no ML export usable
  codesByKey: ReadonlyMap<SpeciesKey, ReadonlySet<string>>       // breeding codes, BREEDING_CODE_MAP.has(code) only
  openNameByKey: ReadonlyMap<SpeciesKey, string>                 // the raw backup name to hand to navigateToSpeciesDetail (section 5.6)
}
export function buildTargetsRecord(observations, mlRows: readonly MLExportRow[] | null, codeByName: Record<string,string> | null): TargetsRecord
```

**The roll-up rule, stated because the PRD's three source rules are not all species-level.** The pool is species-level (`collapseToSpeciesList`), so every record fact is folded to `speciesKey`: a species HAS a media type if any row of any form of it has that type; a species HAS a breeding code if any observation of any form of it carries it; a species is RECORDED if any form of it was observed. Map Explorer's Media Targets rule is per raw name (`MapExplorer.tsx:886-985`), so "Dark-eyed Junco (Oregon)" and "Dark-eyed Junco" are separate targets there and one here; this is the only reading a species-level list can have, and it is written in the module doc and in HELP.

```
export interface Classified { speciesCode; commonName; poolIndex; lifer: boolean; missingMedia: ('Photo'|'Audio'|'Video')[] | null; codes: ReadonlySet<string>; openName: string | null }
export function classifyPool(pool: readonly EbirdSpecies[], record: TargetsRecord): Classified[]
//   lifer     = !record.codes.has(speciesCode) && !record.names.has(speciesKey(commonName))
//   media     = !lifer && record.mediaByKey !== null ? ALL_TYPES.filter(t => !have.has(t)) : null   ([] = has all three = not a Media target)
//   breeding  = !lifer ? codes (possibly empty) : empty
```

Disjointness (FR-17) is by construction: `missingMedia` and `codes` are computed only when `!lifer`.

### 5.3 The filter and the summary: `targetsFilter.ts`

```
export interface TargetsToggles { lifer: boolean; media: boolean; breeding: boolean; chips: ReadonlySet<'Photo'|'Audio'|'Video'>; threshold: 'any' | 'confirmed' }
export function isMediaTarget(c, chips): boolean      // c.missingMedia !== null && c.missingMedia.length > 0 && (chips.size === 0 || [...chips].every(t => c.missingMedia.includes(t)))   (Map Explorer's AND)
export function isBreedingTarget(c, threshold): boolean   // 'any': c.codes.size === 0;  'confirmed': ![...c.codes].some(code => CATEGORY_CODES.confirmed.has(code))
export function visibleTargets(classified, toggles, mediaAvailable): { rows: Classified[]; counts: { lifer; media; breeding } }
//   a row shows iff (toggles.lifer && c.lifer) || (toggles.media && mediaAvailable && isMediaTarget) || (toggles.breeding && isBreedingTarget)
//   counts are per type AMONG the visible rows (FR-25)
```

Media unavailable (no ML export, or the export unreadable) forces the Media toggle off (FR-20). "Turn on at least one target type" is the state where all three toggles are off (FR-23), rendered by the component from `toggles`, not from an empty result.

### 5.4 The county preference

`targetsCounty` (a `regionCode` string) through `storage.getSetting` / `setSetting`: a preference the user chose, not a derivation, so no `clearDerived.ts` row (the `calendarOverlays` precedent in the sibling build's schema §1.5). Read through a shape guard (`REGION_CODE_RE`); a remembered code not in the available choices falls back to the top choice without error (FR-08). One `setSetting` per change; nothing written at read time.

### 5.5 The sorts: `targetsSort.ts`

```
export type TargetsSort = 'freq-month' | 'freq-year' | 'live-days' | 'distance' | 'alpha' | 'taxonomic'
export const SORT_LABELS: Record<TargetsSort, string>   // the six exact FR-48 strings
export interface TargetRow extends Classified { monthPct: number | null; yearPct: number | null; live: LiveCell | null; distanceMi: number | null }
export function sortRows(rows: TargetRow[], sort: TargetsSort): TargetRow[]
//   every comparator ends in (a.poolIndex - b.poolIndex); alpha compares displayed commonName with localeCompare; null keys sort last (FR-34, FR-51)
export function defaultSort(hasFileForThisMonth: boolean): TargetsSort   // 'freq-month' : 'live-days'
export function sortAvailability(ctx): Record<TargetsSort, string | null>  // null = available, else the disabled reason text of FR-38 / FR-50 / FR-51
```

Taxonomic order is the pool's array position (`poolIndex`): the pool arrives in eBird taxonomic order from both `spplist` reducers, the record has no taxonomic-order field, and the file has none either.

### 5.6 Live derivation and the window: `targetsLive.ts`

```
export interface LiveCell { daysReported: number; checkedDays: number; lastDate: string | null; place: string | null; lat: number | null; lng: number | null }
export function deriveLive(days: ReadonlyMap<string, DayObsEntry | 'unchecked' | 'failed'>, poolCodes: ReadonlySet<string>): Map<string, LiveCell>
//   one pass over the checked entries' records; per code: count days, keep the record with the greatest obsDt as the last report
export function hiddenByWindow(cell: LiveCell, window: 'day'|'week'|'30'|'any', days, nowMs): boolean
//   'any' → false; else let W = 1 | 7 | 30; if cell.lastDate !== null → !isWithinWindow(cell.lastDate, W, nowMs)
//   else → every date d in the 30-day list with isWithinWindow(d, W, nowMs) is a checked entry (not 'unchecked'/'failed')   (FR-53: never hidden for a day not yet checked)
export function distanceCell(cell, anchor: {lat,lng} | null): number | null   // distanceMiles; null when either side lacks coordinates
```

Row activation (FR-57): `Classified.openName` is the raw backup name for the key (preferring a species-shaped raw name over a form name when both were observed), passed to `navigateToSpeciesDetail`, because `openSpeciesInTab` (`SpeciesDetail.tsx:380-400`) matches the user's own names and silently does nothing for a name that is not in the backup. Lifer rows have `openName: null` and render `<BirdName hasEntry={false}>`.

### 5.7 Hooks (the React seams, thin)

- `useTargetsRecord(filesVersion)`: `getFilesStatus()` → `setup-required` on `{ebird: null}`; `loadEbirdObservations()` → `EBIRD_BACKUP_LOAD_ERROR` on null; `status.ml ? loadMLExport() : null` where a present-but-null ML result is the `unavailable` media state ("Couldn't check for an ML export", retry), distinct from `status.ml === null` ("Add your ML export in Settings to see media targets"); `/taxonomy/codes` once per record; a rejected status lookup is the load-error state with retry (the `BreedingCodeList.tsx:105-134` shape, plus a retry the existing `TabLoadErrorAlert` lacks, which is why `Targets.tsx` carries its own retry control beside it). Re-runs on `filesVersion`.
- `useTargetsPool(regionCode, hasEbirdKey, online)`: `loadAll()` first (render from fresh OR stale, FR-12), then `dedupedFetch` only when the key is present and online (FR-13, FR-14); failure state with retry, nothing cached (FR-15).
- `useBarChartFile(regionCode, barChartEpoch)`: manifest read (UNKNOWN → FR-40 state), `readBarChartFile`, `parseBarChart`, `joinBarChartToPool` once the pool exists ("Species list not loaded yet" until then, Open Question 6).
- `useCountyDaySweep` (section 3.4).
- `useDistanceAnchor()`: `map-defaults` through a shape guard (the `readDefaultLocation` rule from `widgetHandover.ts:124-131`, re-exported rather than copied), re-read on `subscribeMapDefaultsChanged`; `useMyLocation()` calls `getCurrentLocation()` and holds the result in session state only.

---

## 6. The tab

### 6.1 `lib/tabLayout.ts`

- `ConfigurableTab` gains `'targets'`; `TAB_LABELS.targets = 'Targets'` (TypeScript forces both; `TAB_LABELS` is the authoritative surface name).
- `DEFAULT_TAB_ORDER` becomes `['weather','birding-stats','map-explorer','species-detail','calendar','targets','life-list','breeding-codes','checklists','comparer','named-birds']` (index 5).
- `PREVIOUS_DEFAULT_TAB_ORDER` becomes the 1.0.19-through-1.0.37 order (the current `DEFAULT_TAB_ORDER` literal, 10 ids); the 1.0.18 literal is retired (exactly one generation).
- **The comparison in `parseLayout` changes**: `sameOrder(knownOrder, appendMissing(PREVIOUS_DEFAULT_TAB_ORDER))` where `appendMissing` is the existing missing-tab step factored into a function and applied to the constant too. Without this the saved 1.0.19 default (10 ids) becomes 11 ids after the append and can never equal the 10-id constant, and the migration would silently never fire. Consequence, stated: a saved order that is the previous default MINUS its tail (the 1.0.18-era "missing only its tail" test at `tabLayout.test.ts:120`) is a two-generation shape and is no longer recognized; that test is rewritten to assert the new property (equal-after-append migrates; a tail-truncated previous default is kept verbatim plus append). The hidden set is untouched; nothing is written back.
- `tabLayout.test.ts`: the eleven tests the tab agent listed by line (27, 45, 77, 83, 91, 97, 114, 120, 130, 146, 307) are updated to the new literals; a QA-02 row asserts index 5; a QA-03 row asserts the three outcomes (the previous default → the new default with `targets` at index 5; a one-swap custom order → verbatim with `targets` appended last; a pre-1.0.19 order → as saved with the missing tabs appended, no migration). `TabNav.test.tsx`'s hand-written `ELEVEN` becomes `TWELVE` with the three index expectations moved (312, 349, 386-389).

### 6.2 `lib/tabIcons.tsx`, `App.tsx`

- `TAB_ICONS.targets` renders lucide `Target` (concentric rings; unused anywhere in `frontend/src`; distinct in the rail from `LocateFixed`'s reticle and `Crosshair`). The Engineer confirms the export exists in the installed `lucide-react` before committing (no `node_modules` in this worktree); fallbacks in order: `Goal`, `Telescope`. The header comment's "eleven glyphs" becomes the property.
- `App.tsx`: `const importTargets = () => import('./components/targets/Targets')`; `const Targets = lazy(...)`; `'targets'` in `DEFERRED_TABS` (`:125-128`, REQUIRED or the panel never mounts); `void importTargets().catch(() => {})` in `warm()`; a panel block after Calendar's (`:1443`) with `id="panel-targets"`, `aria-labelledby="tab-targets"`, `aria-label="Targets"`, `className="sr-panel"`, the `display` toggle, and `<Targets onGoToSettings filesVersion keysVersion onOpenSpecies={navigateToSpeciesDetail} />`. Nothing else in `App.tsx` changes; the splash build's uncommitted edits to `App.tsx` are in other regions (boot / error boundary), so the rebase is additive on both sides.

### 6.3 Components (`components/targets/`, all lazy, all through `Button` / `Link` primitives)

`Targets.tsx` (the tab: load gate, county, controls, list), `TargetsCountyPicker.tsx` (a searchable `aria-activedescendant` listbox over ~100 rows with index-keyed option ids, NOT `SpeciesCombobox`, whose four-site identity guard `speciesComboboxOptionsIdentity.test.tsx:381-399` would otherwise move to five), `TargetsControls.tsx` (toggles with `aria-pressed`, chips, threshold, sort `<select>` with `aria-label`, window), `TargetsBarChartFile.tsx` (Add / Replace / Remove, the status line, the unmatched list disclosure, the ebird.org link through `openExternalUrl` on a `Button`), `TargetsList.tsx` (rows; every name through `<BirdName>`; the two kinds' cells with their exact copy; DOM ids index-keyed). The Designer owns layout and copy placement; the module boundaries above are what the Tester tests. Status text and reasons are single-sourced in `lib/targets/targetsCopy.ts` so the guards can read them.

New rows owed in tab-enumerating guards: `TabLoadErrorAlert.test.tsx` `ROSTER` (8 → 9), `honestLoadFailures.test.tsx` `EBIRD_MESSAGE_TABS` (one row), `helpToc.test.ts` (17 → 18, with `{ id: 'targets', label: 'Targets', sub: false }` between `calendar` and `map-explorer` in `HelpDocs.tsx`'s TOC and the `## Targets` section placed between `## Calendar` and `## Map Explorer` in `docs/HELP.md`). `tabOrderCoverage.test.ts` passes without an exclusion (no `tabIndex` on any `Button` / `Link`; the listbox container's `tabIndex` is outside its population).

---

## 7. The shared `isWithinWindow` repair (FR-55)

`lib/nearbyLifers.ts:124`: `Math.floor(...)` → `Math.round(...)`. Between two local midnights the gap is `N·24h ± 1h` across a DST transition, so rounding equals the calendar-day count wherever the offset changes by less than 12 hours (every real zone), which is the count the widget computes with integer civil-day arithmetic (`widgetRows.ts:151-174`, `ObsDate.swift:59-79`). **Correction to the PRD's example (FR-55, QA-57):** on the day after spring-forward, `floor` already admits a report exactly 7 days old (it reads as 6); the defect is that it admits an 8-day-old one (read as 7) under Week and a 2-day-old one (47 h → 1) under Day. The new tests assert those.

**Consumers, all in the widget's direction:** `MapExplorer.tsx:1022` (Media Targets Time Range), `:1074` (Nearby Lifers Time Range), `lib/hotspotActivity.ts:86` (the 7-day hotspot count; its test name at `hotspotActivity.test.ts:50-59` "(inclusive, day-floored)" is renamed), `lib/widgets/widgetRows.corpus.test.ts:39` (unaffected: sign only), and this tab. Not in scope and stated: `recencyTier` (`lib/mapExplorerFormat.ts:57-66`) carries a second floor for the fresh/mid/old pin tier; it is a ROADMAP line, not part of this fix.

**The flip:** `widgets/widgetRows.parity.test.ts:262-275` replaces the single `expect(isWithinWindow('2026-03-01 08:00', 7, dstNow)).toBe(true)` with, per fixture row, `expect(isWithinWindow(r.obsDt, 7, dstNow)).toBe(r.inWeek)`, and renames the describe to "the day-count agreement". The fixture (`widgetRows.fixture.json:2328-2352`, days `[1,7,8]`, inWeek `[true,true,false]`) is generated from the widget twin and is byte-unchanged; the Swift `testCalendarDaysOnTheDayAfterSpringForward` reads only the fixture and needs nothing. A Day-window row (`2026-03-07 08:00` on `DST_NOW_ISO`, 2 days, not in Day) is added to `nearbyLifers.test.ts` with the zone pinned to `America/Los_Angeles`, because the fixture has no Day case. Stale comments to correct: the parity file's header (`:15, 22-23`), `widgetRows.ts:27-35`, `ObsDate.swift:9-14` (comment only), `pipeline/ios-lifer-widgets/schema.md` §6.2 is a record and is left as written; `ROADMAP.md:29` is retired.

**Concurrent-build check (done):** `lib/nearbyLifers.ts` and `lib/widgets/widgetRows.parity.test.ts` are byte-identical across the `main` checkout, the `parallel-feature` worktree and this one; the splash build edits `lib/widgetPaths.parity.test.ts`, a different file with zero `isWithinWindow` references.

---

## 8. Concurrent builds: every overlapping file

| File | `launch-splash-screen` (`main`, uncommitted, at testing) | `calendar-overlays` (`parallel-feature`, at design) | This build |
|---|---|---|---|
| `frontend/src/App.tsx` | edits boot / error boundary regions | none | one import thunk + `lazy`, one `DEFERRED_TABS` member, one prefetch line, one panel block after Calendar's. Additive; rebase conflicts are unlikely and mechanical |
| `frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, `website/index.html` pill | bumped to 1.0.37 | not yet | 1.0.38 (or 1.0.37 if first); `CHANGELOG.md` entry above theirs |
| `.claude/rules/security.md`, `testing.md` `paths` | none | appends globs | appends globs (both additive; merge keeps both) |
| `docs/HELP.md` | none | edits `## Calendar` | adds `## Targets` after `## Calendar`: adjacent, so the rebase is checked by eye and `helpToc.test.ts` |
| `frontend/src/lib/widgetPaths.parity.test.ts` | edited | none | untouched (the DST fixture is `widgets/widgetRows.parity.test.ts`) |
| `Calendar.tsx`, `calendarOverlays` setting | none | owns | untouched |
| `storage.ts`, `transport.ts`, `clearDerived.ts`, `cacheInventory.test.ts`, `tabLayout.ts`, `tabIcons.tsx`, `uploadGuard.ts`, `nearbyLifers.ts`, `map.py`, `main.py`, `settingskv.py`, `vite.config.ts`, `PRIVACY_POLICY.md` | none | none (`settings.json` gains a key through `setSetting` only) | edited as above |

The Engineer rebases onto whichever lands first and re-runs the tab guards (`tabLayout`, `TabNav`, `helpToc`, `entryChunk`, `tabOrderCoverage`).

---

## 9. Guards

### 9.1 Extended

| Guard | Extension |
|---|---|
| `lib/entryChunk.test.ts` | Negative legs: `components/targets/**`, `lib/targets/**`, `lib/barChart/**` (the parser especially), `lib/countyDayObsCache.ts`, `lib/countyDayObsReduce.ts`, `lib/countyGeometry.ts` (already) are NOT in App's closure. Positive legs: `lib/barChartFilesChanged.ts` IS in App's closure (the Targets panel's epoch hook) and `uploadGuard.ts` still is; the Targets subtree is map-free (no `maplibre`/`react-map-gl`/`recharts`) and has more than 10 files (the Calendar pair template at `:304-322`) |
| `lib/cacheInventory.test.ts` | the `stores` row for `countyDayObsCache`; the re-scoped settings-document / own-document split of section 3.5 (amended 2026-09-27); the `storage remains an I/O adapter` row gains `return this.getSetting<unknown>('county-day-obs-v2')` and `await this.setSetting('county-day-obs-v2', doc)` beside the replay rows, and the new Tauri methods must keep that row green (no `Map<` / `Set<` / `shift(` / `splice(` / `MAX_` in `storage.ts`); the caps row gains `/DAY_OBS_MAX_ENTRIES = 3_000[\s\S]*DAY_OBS_MAX_BYTES = 10_000_000/`; a `not.toMatch(/barchart/i)` over the registry with the section 1.6 reason |
| `lib/clearDerived.test.ts` | `registeredTeardowns('ebird')` list gains `'county-day-obs.json'`; `('ml')` stays `[]`; the purge-failure row (`resolves.toEqual([...])`) names the store by that id |
| `lib/icloudPaths.parity.test.ts` | (amended 2026-09-27) a fourth `it` beside the section 1.5 rows: `COUNTY_DAY_OBS_PATH` is not among `ICLOUD_CSV_FILES`' values and matches no synced name's suffix; no `icloud/*.ts` module and no `icloud.rs` text matches `/county-day-obs/i` (the existing `'county'` substring in `icloudSync.test.ts:205`'s excluded list already covers the native call log); the controller's `SLOTS` is still exactly `['ebird', 'ml']` |
| `lib/singleWebviewInvariant.test.ts` | (amended 2026-09-27) `SITES` gains `{ label: 'countyDayObsCache.ts (purge generation + ordered writer)', file: './countyDayObsCache.ts' }`; the module's note must carry the marker and the literal `CLAUDE.md`; the "spelled one way" count row covers it |
| the Tauri fs-scope row (in `lib/storage.countyDayObs.test.ts`, section 9.2) | `COUNTY_DAY_OBS_PATH` begins with `data/` and no path segment begins with `.` (inside the `$APPLOCALDATA/**` grant by construction, the inverse of `security.md`'s v1.0.13 dot rule, stated as such); `src-tauri/capabilities/default.json` parsed as JSON grants `fs:allow-remove` on `$APPLOCALDATA/**`, because the clear path's delete now depends on it |
| `lib/transportPathSets.test.ts`, `lib/transport.test.ts`, `lib/tauri/mapService.rateLimit.test.ts`, `backend/tests/test_map_router.py` `_route_cases()` | one row each for `/map/county-day-obs`; the 429 mapping on BOTH transports (QA-72) |
| `lib/uploadGuard.test.ts` | every branch of section 2.3; the `refuseByFilename` default keeps the two existing rows green; the backend `MAX_BYTES` regex row is unchanged |
| `lib/icloudPaths.parity.test.ts` | the section 1.5 exclusion row |
| `lib/storageWriteSerialization.test.ts` (or a sibling) | the section 1.3 interleaving rows |
| `lib/tabLayout.test.ts`, `components/TabNav.test.tsx`, `lib/helpToc.test.ts`, `components/TabLoadErrorAlert.test.tsx`, `components/honestLoadFailures.test.tsx` | section 6 |
| `lib/nearbyLifers.test.ts`, `lib/hotspotActivity.test.ts`, `lib/widgets/widgetRows.parity.test.ts` | section 7 |
| `backend/tests/test_datadir.py` | the barcharts router's paths are `DATA_DIR` children |
| the published-claims guard suites (`docs-and-website.md` house pattern) | a Targets passage row for `docs/HELP.md` with a non-vacuity leg; `PRIVACY_POLICY.md` sentence rows |

### 9.2 New

- **`lib/barChart/parseBarChart.test.ts`**: the auk sample as a committed fixture (`barchart-sample.fixture.txt`, public data) parses to 133 rows and 48 sample sizes; scientific-notation cells; the `<em class="sci">` cell shape (a synthetic row, since the sample predates it); blank lines; trailing tabs; CRLF; each bound in section 2.1 at the bound and one over (testing.md v1.0.20: tested under every line terminator); a doubling-input timing check over five hostile shapes (a 40 MB line with no newline, all tabs, `<em` repeated, a name cell at 512 and 513, 20,000 blank-separated rows) and the two delimiter-ABSENT shapes the security review found quadratic (M1: tab-free lines before a long tab-free tail; `&` with no `;` filling name cells), requiring roughly 2x per doubling at a small leg (256 KB to 512 KB) BEFORE the large one (2 MB to 4 MB), so a quadratic fails in about a second rather than running toward CI's timeout, with an explicit `testTimeout` and a capped-replica pre-walk of every timed input (the v1.0.33 hang rule); a doubling row on `splitNameCell` for the `&` cell, because the raw name-cell bound shields the entity decoder from every file-level shape (security.md v1.0.22, per-guard mutation); bound rows for `MAX_RAW_NAME_CELL` and `MAX_SAMPLE_SIZE`, plus a non-vacuity leg showing a named wrong implementation (an index-keyed reader like `ebird-histogramr`) fails the sample.
- **`lib/barChart/barChartFilename.test.ts`**: the FR-29 / QA-31 / QA-32 rows, the ` (1)` suffix, the wrap `11..2`, the malformed-code refusal, the anchored-pattern mutation (drop the anchor → red).
- **`lib/barChart/barChartFrequency.test.ts`**: section 2.6; the zero-denominator `null`; the two methods differ on a fixture row.
- **`lib/barChart/barChartJoin.test.ts`**: the three-way sum; a renamed species and a spuh → unmatched 1, skipped 1 (QA-37); the species-shaped-row-wins collision rule.
- **`lib/barChart/barChartImport.test.ts`**: a refusal writes nothing, bumps nothing, leaves the manifest byte-identical (QA-29); a success writes once and bumps once (QA-28).
- **`lib/countyDayObsCache.test.ts`** (amended 2026-09-27: the `storage` mock now supplies `getCountyDayObsStore` / `setCountyDayObsStore` / `deleteCountyDayObsStore` plus `deleteSetting` for the legacy key): validation on load and at the write chokepoint (a malformed entry is dropped, never thrown on, QA-46); **eviction at capacity+1 asserting WORK DONE not time** (testing.md v0.5.85): with `setDayObsMaxEntries(k)` and two counties whose `fetchedAt` differ, the k+1th put evicts exactly one entry (`evictions === 1`), the victim is the oldest-visited county's smallest date, the just-written key survives; the same at the byte budget via `setDayObsMaxBytes`; an entry dated before `lastNDates(now)[SWEEP_DAYS - 1]` is evicted before any in-window entry whatever its county's recency; a re-fetched today (moved to the tail of `order`) is NOT the victim; the sole-oversized rule (one entry over the budget on its own is kept); load-time admission stops at `DAY_OBS_MAX_ENTRIES` keys; errors never cached; offline stale read; purge generation (a fetch that started before the purge cannot write); `complete` decided at write time; **the ordered writer**: two flushes and a purge resolve their seam calls in call order with the delete LAST even when the earlier `setCountyDayObsStore` promise settles later (the `storageWriteSerialization.test.ts` interleaving shape), a rejected flush does not block the next link; **the legacy delete**: `deleteSetting('county-day-obs-v1')` is called exactly once per session after the first load, never by the purge, and a rejection of it is swallowed; the purge calls `deleteCountyDayObsStore` and never `setCountyDayObsStore`; `cacheInventory` pairing.
- **`lib/storage.countyDayObs.test.ts`** (new, 2026-09-27; the `storage.barcharts.test.ts` shape): Tauri `getCountyDayObsStore` is `null` on an absent file, on unreadable text and on a `readTextFile` rejection; `setCountyDayObsStore` calls `mkdir('data', recursive)` then `writeTextFile(COUNTY_DAY_OBS_PATH, JSON.stringify(doc))` under `BaseDirectory.AppLocalData`; `deleteCountyDayObsStore` calls `remove` only when `exists` is true and resolves on an absent file; none of the three touches `docChains` (the chain map holds no `COUNTY_DAY_OBS_PATH` key after all three run) and none touches `SETTINGS_PATH`; the web adapter maps the three onto `/settings/county-day-obs-v2` with GET / POST / DELETE and the `deleteSetting` failure shape (non-2xx throws); the Tauri fs-scope and `fs:allow-remove` rows of section 9.1.
- **`lib/countyDayObsReduce.test.ts`** + **`backend/tests/test_county_day_obs.py`** + **`lib/countyDayObs.fixtureGen.test.ts`** (env-gated): the shared fixture, conforming and malformed rows with identical verdicts, the wrong-date drop, the dedupe rule, the record cap, the body-not-a-list 502.
- **`backend/tests/test_barcharts_router.py`**: extension refusal, 413 with the patched-down constant and a canary row (security.md v1.0.20), the region pattern including `US-CA-٠١٢` and a trailing-newline segment, traversal shapes over raw sockets (the v0.5.88 rule: `%2F`, `..`, `%C0%AF`), manifest round trip, corrupt manifest → 500, delete idempotence, `_RESERVED_KEYS` contains `barcharts`.
- **`lib/storage.barcharts.test.ts`**: Tauri chain membership (`BARCHARTS_META_PATH` in `docChains` after a write), UNKNOWN (rejects) vs EMPTY (`{counties: {}}`), the manifest normalizer's drop rules, `readBarChartFile` null on absence; the web mapping of each route and each failure shape.
- **`lib/targets/*.test.ts`**: `targetsCounties` (QA-05, QA-06, the reverse index), `targetsRecord` + `targetsClassify` (QA-16 to QA-20, the roll-up rule, `Object.hasOwn` on the codes map with a `__proto__` probe written with `JSON.parse`), `targetsFilter` (QA-21 to QA-27), `targetsSort` (QA-50, QA-51, QA-52: null last, taxonomic tiebreak, availability reasons), `targetsLive` (QA-43, QA-49, QA-55, QA-56: the never-hidden-for-unchecked rule).
- **`lib/targets/useCountyDaySweep.test.ts`**: 30 requests on first visit, 0 or 1 on a same-day revisit, 1 or 2 the next day (QA-46, QA-66) with request starts >= 150 ms apart on client observation; the 429 pause and resume through the shared gate with a concurrent Map Explorer call observing the cooldown (QA-48); failed days unanswered, never cached, retry re-issues only them; no request without a key (QA-45).
- **`components/targets/Targets.test.tsx`**: the load gate states (QA-09, QA-22, QA-42), the summary line equals the visible rows after each control change (QA-27), the two kinds' exact copy and accessible names (QA-38, QA-44, QA-58: no live cell or header contains `%`), row activation (QA-60), no id built from a name (QA-59; render with a hostile county and species name and scan every `id` / IDREF for it), the bar-chart link goes through `openExternalUrl` never `window.open` (QA-40), a stylesheet scan for hex/RGB literals in the tab's files (QA-68).
- **`lib/targets/targetsCopy.test.ts`**: no U+2014 in any copy string, "%" present in every probability string and absent from every live string, generated over the whole copy table (a COPY GUARD OVER A GENERATED CORPUS, ui.md v1.0.5).

### 9.3 Browser-verified before the deploy gate (not vitest)

320 px and 200% text scale with the longest county label, the longest sort name and the longest status line (NFR-03, QA-67); the live tailnet look with the user's real backup and the real Alameda file (FR-63, QA-65).

### 9.4 `.claude/rules/*.md` `paths` to extend in the same change (CLAUDE.md v1.0.32)

- `security.md`: `frontend/src/lib/barChart/**` (a parser over untrusted user-file text and a filename pattern), `frontend/src/lib/uploadGuard.ts` (the refusal registry hosts filename and content rules over untrusted input and was matched by no glob), `frontend/src/lib/targets/**` (the name fold and the codes table read), `frontend/src/lib/countyDayObs*.ts` (a twinned eBird body reducer and a durable store), `frontend/src/lib/barChartFilesChanged.ts` (the `mapDefaultsChanged.ts` precedent), `frontend/src/lib/regionCode.ts` (if extracted). `backend/routers/barcharts.py` is covered by `backend/routers/**`.
- `testing.md`: `frontend/src/lib/barChart/*.fixture.json`, `frontend/src/lib/barChart/*.fixture.txt`, `frontend/src/lib/countyDayObs.fixture.json` (committed fixtures the suites read).
- `maps.md`: `frontend/src/lib/county*.ts` already matches `countyDayObsCache.ts` and `countyDayObsReduce.ts`; `lib/tauri/mapService*.ts` and `backend/routers/map.py` already match. No change owed.
- (Amended 2026-09-27) The own-document move adds no rule-file `paths`: `security.md` already gates `frontend/src/lib/storage.ts`, `frontend/src/lib/replayStore.ts`, `frontend/src/lib/clearDerived.ts` and (from this feature) `frontend/src/lib/countyDayObs*.ts`; the new test file reads no committed fixture, so `testing.md` is unchanged; `src-tauri/capabilities/default.json` is not edited (the grant it needs already exists).
- `ui.md`: `frontend/src/components/**` already matches `components/targets/**`. No change owed.
- `docs-and-website.md`: path-gated on `docs/**`; the HELP edit loads it. Its "ten tabs" wording at `:30, 45` is corrected to the property.

---

## 10. Declared scans over untrusted text (security.md v1.0.23: declared up front, with the linearity argument)

| Scan | Input | Bound | Linearity |
|---|---|---|---|
| `parseBarChart` | the imported file (user-supplied bytes; any file the user picks) | 50 MB (registry, before parse); 64 preamble lines; 65,536 per line; 50 tab positions per row; 2,048 per RAW name cell (`MAX_RAW_NAME_CELL`, checked before any name work); 32 per numeric token; 512 per name cell after stripping; 1e9 per Sample Size cell (`MAX_SAMPLE_SIZE`); 20,000 rows | one forward pass, and every native search names its END, because `indexOf` has no end parameter and runs to the end of the whole string when its character is absent: `indexOf('\n')` per line, from the line's start to its own terminator; the cell scan is a character loop over [line start, line end) that stops at the 50th tab, never `indexOf('\t')` (which ran past a tab-free line to the next tab anywhere in the file: security review M1, 23 s at 49 MB); a raw name cell over 2,048 is malformed before it is sliced, split, stripped, decoded or tidied, so all name work (including `indexOf('<em class="sci">')` / `indexOf('</em>')` inside the cell's own copy) is O(1) per row; each `&` looks at most 6 characters ahead for its `;` with a bounded loop, never `indexOf(';')` (which searched to the cell's end per `&`: M1, 33 s at 49 MB); `Number()` over <= 32 chars. No regex over content. So each character of the file is visited a bounded constant number of times: O(n) in the file. Measured after the fix on the build Mac under Node 24, both M1 worst cases inside the cap: 7.4 ms and 113.7 ms (from 23,169 ms and 33,478 ms before it); a dated measurement, not a bound. Worst case named: a 50 MB single line with no `\n` is one `indexOf` scan (returns -1), then the tail is treated as the last line and refused for length |
| `parseBarChartFilename` | the picked file's name (user-controlled) | one anchored regex over <= 255 chars | fixed classes, bounded quantifiers, no alternation under a quantifier: linear, no backtracking blowup; the sibling of `BIRD_SUFFIX_RE` |
| `joinBarChartToPool` | file row names (from the file) against pool names (from eBird) | <= 20,000 rows, <= ~1,000 pool species | one `Map` over the pool, one `Map.get` per row: O(rows + pool). `normalizeSpeciesName` is the already-linear v0.5.84 scan with its memo bound |
| `buildTargetsRecord` | every observation row's `commonName`, `breedingCode`; every ML row's `commonName`, `format` | the 50 MB upload cap bounds both files | one pass over each file's rows into `Map` / `Set` accumulators keyed by `speciesKey` (`Object.create(null)` is not needed: these are real `Map`s); no `includes` / `indexOf` / `find` inside a loop (the v1.0.21 primitive rule); the `/taxonomy/codes` result is read with `Object.hasOwn` |
| `buildCountyChoices` | `stateProvince`, `county` per observation | as above; geometry ~3,200 features | one `Map` over the geometry, one `Map` over the observations: O(features + rows). `countyKeyFromState` → `normalizeCountyName` is the v0.5.85 linear scan |
| `reduceCountyDayObs` (TS) / `_reduce_county_day_obs` (Py) | the eBird body (a third party's bytes over TLS) | Tauri: 2,000,000 code units before parse; both: 5,000 records read; 512 per string | one decode, one pass, a `Map` keyed by `speciesCode` for the dedupe; the two anchored patterns are fixed-width |
| `normalizeBarChartManifest`, `isValidEntry` (day-obs) | the app's own persisted documents (self-authored, untrusted at the file-type level) | manifest keys must match `REGION_CODE_RE`; entries as in 3.2 | one pass per document |
| `hiddenByWindow` | `lastDate` from a store entry; the 30-day date list | 30 dates | constant per row; `isWithinWindow`'s two `split`s are over a <= 512 string |

Nothing from the file reaches a URL, an `id`, an IDREF, a log or a format string: the region code in the bar-chart page link comes from the geometry-derived `regionCode`, gated by `REGION_CODE_RE` and `encodeURIComponent`, never from the filename; the filename itself is shown only in the status line as text; unmatched names render as React children.

---

## 11. Published surfaces (what each gains; the Designer and Engineer own the words)

- `docs/HELP.md`: `## Targets` between `## Calendar` and `## Map Explorer`: the county picker, the three types and the roll-up sentence, what probability and live each mean and how they are told apart, the ebird.org download steps (bar chart page → Download Histogram Data, signed in; the file's name), that the file and the day cache stay on the device and are not part of iCloud Sync, and the window. No U+2014. `HelpDocs.tsx` TOC entry.
- `PRIVACY_POLICY.md`, **shown to the user before landing** (FR-61): in the eBird bullet, "a per-day list of the species reported in a county over the last 30 days, when you open the Targets tab"; and a new sentence that an eBird bar-chart file you add is stored only on this device, is read only to show eBird's frequencies, and is not synced.
- `website/index.html`, `README.md`: ONE proposed sentence for Targets in `TAB_LABELS` order, shown as before/after tailnet pages, written only on an explicit yes (CLAUDE.md, user direction 2026-09-21). The App Store listing is not touched.
- `CHANGELOG.md`: the 1.0.38 entry. `frontend/package.json`, `src-tauri/tauri.conf.json`, `website/index.html` pill + footer: the four-file set (the version-stamp step moves only the pill and footer).

---

## 12. Migration plan (ordered steps for The Engineer)

1. `lib/regionCode.ts` (`REGION_CODE_RE`, single-sourced) and `lib/barChartFilesChanged.ts` + `useBarChartFilesEpoch.ts`. `entryChunk` positive leg.
2. `storage.ts`: the four methods on both adapters, `BARCHARTS_META_PATH` chain key, the normalizer; `storage.barcharts.test.ts`; the interleaving rows.
3. `backend/routers/barcharts.py`, `main.py` include order, `settingskv.py` reserved key; `test_barcharts_router.py`; `test_datadir.py` row.
4. `lib/barChart/`: `parseBarChart.ts`, `barChartFilename.ts`, `barChartFrequency.ts`, `barChartJoin.ts`, `barChartImport.ts`; the auk sample fixture and tests. `uploadGuard.ts` extension and rows. **Run the Alameda pin (section 2.6) against the user's file and commit `alameda.fixture.json` before writing any UI that shows a figure.**
5. `lib/countyDayObsReduce.ts` + `_reduce_county_day_obs`, the env-gated fixture generator, both reducer test files.
6. The route on both transports, `EBIRD_GATED_PATHS`, the four path-set / gate / 429 rows.
7. `lib/countyDayObsCache.ts`, its tests, the `clearDerived.ts` row, the `cacheInventory` and `clearDerived.test` rows. **Amended 2026-09-27 (the own-document move, in this order):** (a) `storage.ts`: `COUNTY_DAY_OBS_PATH` exported, the three methods on `StorageAdapter`, `TauriStorage` (own file, unchained, `remove` behind `exists`) and `WebStorage` (`county-day-obs-v2` through `getSetting` / `setSetting` / `deleteSetting`); `storage.countyDayObs.test.ts`. (b) `countyDayObsCache.ts`: `version: 2`, `LEGACY_DAY_OBS_SETTING_KEY`, `DAY_OBS_MAX_ENTRIES = 3_000`, `DAY_OBS_MAX_BYTES = 10_000_000`, `WRITE_DEBOUNCE_MS = 1_000`, `_writeChain` + `writeThrough(op)`, the comparator `evict(store, keep)` with `lastNDates(now)[SWEEP_DAYS - 1]` as the horizon, load-time admission at the cap, the once-per-session legacy delete, the purge's chained delete, the header rewritten (no settings-document claim, no FIFO claim, the SINGLE-WEBVIEW note pointing at CLAUDE.md); `_resetCountyDayObsCacheForTests` resets the chain, the latch and both constants to the new values. (c) `clearDerived.ts` row id `'county-day-obs.json'`; `clearDerived.test.ts:181`; `cacheInventory.test.ts` (the re-scoped check, the adapter rows, the caps row, the non-vacuity row); `icloudPaths.parity.test.ts` fourth `it`; `singleWebviewInvariant.test.ts` sixth site; `replayStore.ts:259` comment ("one of two durable documents not on `docChains`"). (d) `countyDayObsCache.test.ts` rewritten against the new seam methods with the rows of section 9.2. No change to `useCountyDaySweep.ts`, the route, the reducer, `backend/`, `vite.config.ts`, `docs/HELP.md` or `PRIVACY_POLICY.md`.
8. `lib/nearbyLifers.ts` round, the parity flip, the Day-window row, the comment sweep, `ROADMAP.md:29`.
9. `lib/targets/` pure modules and tests; then the hooks.
10. `tabLayout.ts` (union, orders, `appendMissing`, the comparison), `tabIcons.tsx`, `App.tsx`; the tab guard rows (section 6).
11. `components/targets/` per the Designer's spec; the component tests; `TabLoadErrorAlert` / `honestLoadFailures` / `helpToc` rows.
12. `docs/HELP.md` + TOC; `PRIVACY_POLICY.md` text shown to the user; the website/README proposal pages; the rule `paths` extensions; the version four-file set and `CHANGELOG.md`.
13. `npm run build` (the pre-push gate), the backend suite, the tailnet preview with the real backup and the real Alameda file.

---

## 13. Design decisions

1. **The bar-chart file is its own family** (directory, manifest, chain key, methods, epoch, router), never a third slot: the Tauri metadata rewrite would erase it, and widening the slot union would reach every iCloud loop (section 1.1).
2. **A dedicated epoch module** (`barChartFilesChanged.ts`) rather than FR-26's `filesChanged`, because bumping the shared one runs an iCloud check and a widget rebuild for a file neither reads; the PRD is amended (section 1.4).
3. **No `clearDerived.ts` row for the files, one row for the day cache**: the files are user input, the cache is derived from counties the user birded (sections 1.6, 3.5).
4. **Query-string route, gated once**: `/map/county-day-obs?regionCode&date` joins `EBIRD_GATED_PATHS`; the controller layers pass-scale pacing over the shared state and does NOT wrap `gatedEbirdCall` (sections 3.4, 4.1).
5. **`complete` replaces a TTL**: a past day is final once fetched; today is re-fetched at most once per visit; late eBird submissions to a past day are an accepted residual (section 3.3).
6. **One derivation function, one constant**: `sample-weighted` by default, `period-mean` one line away, pinned by a fixture drawn from the user's real file that must discriminate the two (section 2.2, 2.6).
7. **Species-level roll-up of the record**: any form's media or code counts for the species; stated in code and HELP because Map Explorer's Media rule is per raw name (section 5.2).
8. **The migration compares after appending the previous default too**, or it would never fire; the tail-truncated-previous-default shape is deliberately dropped as two-generation (section 6.1).
9. **`{County}` is "Alameda, CA"**: TIGER carries no suffix and eBird's own region naming has none; QA-32 / QA-38's "Alameda County" literals are amended (section 5.1).
10. **`recencyTier`'s second floor and the Tauri single-document settings growth are named as residuals**, not fixed here (sections 7, 3.2).

---

## 14. Risks and Engineer verify-items

1. **The Alameda pin.** If neither method prints 3.29, stop and flag; do not fit a third method silently. Possible causes to report with the numbers: eBird's Targets page may use the current taxonomy's rollup of forms into the species row (check whether the file has a separate `Lincoln's Sparrow` row and no forms), or may exclude periods below a checklist floor.
2. **The `<em class="sci">` cell shape** is stated from the task brief, not from the auk sample (which predates it). Confirm against the user's file; `splitNameCell` handles both.
3. **`Target` in the installed `lucide-react`**: verify the export; fall back per section 6.2.
4. **`Path(..., pattern=)` for the region code** must be a path parameter constraint; confirm FastAPI applies the pattern on `Path` in the pinned version (it does on `Query`; the map router is the precedent for `Query`).
5. **The historic endpoint's per-taxon behaviour** (one record per taxon by default) is from eBird's documentation; the reducer's dedupe makes the payload correct either way, but the fixture should include a body with two records for one code to prove it.
6. **The window's "checked" set** (section 5.6) depends on the 30-day list and the store agreeing on the local date string; both use one `localDateString(ms)` helper in `lib/targets/targetsDates.ts`, tested at a DST boundary and at midnight.
7. **Settings document size on Tauri**: measure `data/settings.json` after a five-county sweep and record the number in the run's decisions; if it exceeds 8 MB in practice, lower `DAY_OBS_MAX_BYTES` before ship rather than after.
8. **Rebase order** with `launch-splash-screen` (version number, `App.tsx`) and `calendar-overlays` (`HELP.md` adjacency, rule `paths`).
