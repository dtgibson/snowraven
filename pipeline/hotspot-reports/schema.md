# Schema: Hotspot Reports

**Feature:** hotspot-reports
**Date:** 2026-11-10
**Stage:** 3, The Architect (hands-off: the path is declared here and proceeded on)
**Source:** strategic-brief.md, prd.md (63 FRs, 12 NFRs, 73 QA rows; Open Question 5 is decided here, the other six keep their defaults for the Designer)
**Extends:** `pipeline/life-list-region-filter/schema.md` and `pipeline/life-lists-tab/schema.md` (the first-sighting rule, the comparators, the passive provenance reader, the pager, the codes batch; carried forward by reference)
**Ships as:** one patch bump across the six-file set (section 15). `main` is at 1.0.70, so this ships as 1.0.71 unless another ship lands first; the Deployer reads the number off `main` at ship time, never off this document.
**Amended:** 2026-11-10, after the design review (`decisions.md` D-01 to D-03, `design-spec.md`). The amendments are made in place and listed in section 19; nothing outside them was re-opened and no measurement was re-taken.
**Amended:** 2026-11-11, after the build, the QA report and the security review (`decisions.md` D-04 to D-24, `security-report.md`): the shapes brought in line with the code as built, section 12.4's gates, two measured differences recorded as decisions not to act, and eight places where this document trailed the tab as built (section 19, rows 12 to 23).

## Path

Frontend Only: no data layer change is required.

## Architect assessment

> **Architect assessment: Frontend Only**
>
> SnowRaven has no database. Its data layer is the set of documents under `AppLocalData/data/` (mirrored by the web/Pi backend), the epoch modules that announce a change to them, the durable caches behind the `storage` seam, and the pure `lib/` modules that derive what the UI shows. The PRD's "Re-derivation and persistence" section (FR-57, FR-58) was read against that list before classifying: the feature writes no setting, no document and no cache, adds no iCloud item kind, no `clearDerived.ts` row, no route and no epoch module, and the selected location lives in component state for the session. Everything it shows is derived in memory from the two files already loaded. Proceeding on this assessment per the hands-off run.

## Confirmation

Every user story and functional requirement was checked for a record created, read from a new source, updated or deleted, a new relationship that is stored, or a derived value that is stored. There is none. What follows is therefore the module and data-shape design the Engineer builds from: the new `lib/` modules and their exports, where each derivation runs and what holds it, the declared scans with their bounds and measured costs, the rule-file gates, the seams, and the guard plan.

Settled by reading the code rather than the PRD alone, each returned as a flag in the hand-back:

1. **FR-35 and NFR-05 pull against each other.** FR-35 cites `lifeListsClassification(...).escapees`, which calls `confirmPublishedNames`: one `Set.has` per observation row, re-run on every provenance snapshot (measured here at 18 to 39 ms at the 150,000-row cap). NFR-05 forbids a row pass on a snapshot change. This schema keeps FR-35's result and NFR-05's cost: an indexed confirmation proven equal to the shipped function over a generated corpus (section 6).
2. **FR-22 and FR-23 collide for any backup with more locations than the option cap**, which is an ordinary backup, not a hostile one: a selected location that sorts past the first 200 rows cannot be "the selected row active" in a list that renders the first 200. Settled in section 3.3 (the window slides to the selection when the query is empty).
3. **FR-05 could not be met by moving the pixel cap alone, and the user has decided it.** Read off the stylesheet, a More-sheet row is 44px, the sheet lists every destination that is not one of the four bar cells, and the cap's own comment says it was measured with eleven tabs. Twelve ship today and this feature makes thirteen: about 616px against `70dvh` of 852px (596px). The sheet is made tall enough for thirteen tabs, and both terms of the cap move to the built app's WebKit measurement (section 10.3).
4. **NFR-03 lists no bound for the years figure**, and `dayKey` admits any four-digit year, so a hostile file can render ten thousand year rows. Section 4.4 adds one.
5. **The demo data already has several locations sharing a region** (seven in US-NY, three in US-NJ); only the weather blocks are missing. Section 14.

---

## Existing data used by this feature

Nothing below is modified. This is what the Engineer has to work with.

### Stored documents

| Document | This feature |
|---|---|
| `data/ebird-backup.csv`, `data/ml-export.csv`, `data/metadata.json` | Read only, through `storage.getFilesStatus()`, `loadEbirdObservations()` and `loadMLExport()` exactly as Life Lists reads them. Not modified |
| `data/api-keys.json` | Read only, `storage.getApiKey('ebird')` reduced to a boolean on the keys epoch, the Statistics shape, for FR-27's reason sentence. Not modified |
| `data/settings.json` (and the web/Pi `settingskv` route) | Not read and not written by the tab's own modules. The shared hotspot Set reads and writes its own `hotspot-regions-v1` entry on its own schedule, unchanged |
| `exotic-provenance-v1` | Read passively through `lib/exoticProvenanceCache.ts` (`subscribe`, `getSnapshot`, `loadSnapshot`). Nothing is published to it |
| `data/barcharts*`, `data/county-day-obs.json`, `data/replay.json`, the other derived stores, `ITEM_SUBDIRS` and its Rust twin, `lib/clearDerived.ts` | Not touched (FR-58, QA-56) |

### Parsed rows

- **`ObservationEntry`** (`frontend/src/types.ts`), from `loadEbirdObservations().observations`, the cache's own array. Fields read: `submissionId`, `commonName`, `scientificName`, `date`, `time`, `location`, `locationId`, `latitude`, `longitude`, `county`, `stateProvince`, `protocol`, `duration`, `allObsReported`, `checklistComments`. `count`, `breedingCode`, `speciesComments`, `catalogIds`, `distance`, `area` and `numObservers` are not read by this feature's own code (`computeChecklists` reads `count` for a field the tab does not show).
- **`MLExportRow`** (`lib/parseMLExport.ts`), from `loadMLExport().rows`. Fields read: `checklistId`, `format`. Its `location`, `county`, `latitude` and `longitude` are never read (FR-55).
- **`HotspotResolution`** (`lib/hotspotSet.ts`), through `useHotspotSet()` (which starts the shared build) and `useHotspotResolution()` (passive): `set`, `byRegion`.
- **`ProvenanceSnapshot`** (`lib/exoticProvenance.ts`): `excludedNames`, `checklists`. `exoticNames` and `species` are not read (FR-35).

### Requests the tab can cause, all existing

`/map/hotspot-region` (inside the shared Set, at its existing gate and store), the batched `transport.post('/taxonomy/codes', ...)` for `<BirdName>` marks, map tiles and style through `<SnowMap>`, favicons through `<BirdName>`, and on web/Pi the seam reads above to the user's own server. Section 11 makes this checkable.

---

## Changes in this feature

### Added

Library modules, all under `frontend/src/lib/` and all matching one new glob, `frontend/src/lib/hotspotReports*.ts` (section 12.4):

1. **`hotspotReports.ts`**: the per-location index, the ML join, the overview derivation (section 2).
2. **`hotspotReportsPicker.ts`**: the per-keystroke filter and its window (section 3).
3. **`hotspotReportsLocation.ts`**: one location's facts and the species rule applied to them (section 4).
4. **`hotspotReportsKind.ts`**: the kind in three states over the shared Set (section 5).
5. **`hotspotReportsProvenance.ts`**: the passive escapee reader (section 6).
6. **`hotspotReportsCopy.ts`**: every user-facing string (NFR-11).

Components under `frontend/src/components/hotspotReports/` (the Designer names and shapes them; this schema fixes their data contracts): `HotspotReportsTab.tsx` (the load effect, state and memos, section 7), `HotspotReportsPicker.tsx` (the combobox, section 3.4), an overview component, the report section components, and **`HotspotReportMap.tsx`**, the only file that imports `SnowMap`, reached only through `React.lazy` (section 9).

One shared component, **`frontend/src/components/WeatherDistRow.tsx`**: the distribution row, extracted verbatim from `WeatherStatsSection.tsx` so Statistics and this tab render one implementation (section 8.1).

**Suites, as they stand on disk (read 2026-11-11):**

- `frontend/src/lib/`: `hotspotReports.test.ts`, `hotspotReportsPicker.test.ts`, `hotspotReportsLocation.test.ts`, `hotspotReportsKind.test.ts`, `hotspotReportsProvenance.test.ts`, `hotspotReportsLinearity.test.ts`, `hotspotReportsCopy.test.ts`, `hotspotReportsNetwork.test.ts`, `hotspotReportsCss.test.ts` (13.4, 8.1), `hotspotReportsPublishedClaims.test.ts`, `hotspotReportsSurfacesPublishedClaims.test.ts`, and **`hotspotReportsSeamParity.test.ts`** (QA-71's dynamic half: one fixture through the real `storage.ts`, `observationsCache.ts` and `mlExportCache.ts` under BOTH seams, each in its own module graph, with each seam's output also held to an oracle outside both runs, because an agreeing wrong number is invisible to parity checking).
- `frontend/src/components/`: `WeatherDistRow.test.tsx` (the extracted row and its two defaulted props) and **`WeatherDistRow.golden.test.tsx`** with its fixture `WeatherDistRow.golden.json` (8.1: the Statistics Weather section's and the Species Detail Weather card's markup, captured from the unmodified section before the extraction, `decisions.md` D-16).
- `frontend/src/components/hotspotReports/`: `HotspotReportsTab.test.tsx` and `HotspotReportsPicker.test.tsx`.
- `frontend/src/test/hotspotReportsRows.ts`: not a suite. Test-only row builders the suites share, building rows as the parser delivers them; nothing in the app imports it, and it sits under `testing.md`'s `frontend/src/test/**`.
- **Existing suites the build edited**, beyond the registration rosters of 10.1 (`tabLayout.test.ts`, `entryChunk.test.ts`, `exoticProvenanceGraph.test.ts`, `transportPathSets.test.ts`, `helpToc.test.ts`, `TabLoadErrorAlert.test.tsx`, `honestLoadFailures.test.tsx`, `settingsAlertsOff.test.tsx`, `controlRegisters.test.ts`, `TabNav.test.tsx`): `weatherTidePlanPublishedClaims.test.ts` (the Help sentence about maps with no corner row now names the report's map beside the Plan form's, section 15) and `bottomSurfaceSideInsets.test.ts` (a comment that quoted the More sheet's 528px cap now says its measured cap, 10.3).

### Modified

1. `lib/tabLayout.ts`, `lib/tabIcons.tsx`, `App.tsx`, `components/HelpDocs.tsx`, `globals.css`, `docs/HELP.md`, and the guard rosters a new tab moves: the full list with the guard for each is section 10.
2. `lib/lifeLists.ts`: **a type-only widening** of `compareDisplay`'s two parameters to `Pick<LifeListRow, 'day' | 'minute' | 'name'>` (section 8). The emitted JavaScript is byte-identical, and `lifeLists.test.ts` and `lifeListsLinearity.test.ts` run unchanged as the proof.
3. Rule files: `.claude/rules/security.md`, `bird-names.md`, `maps.md`, `ui.md` and `weather-tide.md` gain `paths` entries in the same change (section 12.4).
4. `website/tools/gen-demo-data.mjs`, `capture.mjs`, `capture-appstore.mjs`: the demo weather blocks and the new frame's jobs (section 14).
5. `components/WeatherStatsSection.tsx`: `DistRow` moves out, verbatim, to `components/WeatherDistRow.tsx`, and the section imports it back. Its rendered output is byte-identical, pinned by a markup golden captured in an earlier commit of its own (section 8.1). `DistGroup` stays where it is.
6. `verify-hotspot-reports.mjs` (new, tooling): the real-engine probe that holds the container thresholds (13.4). **As built it is held at `pipeline/hotspot-reports/held/verify-hotspot-reports.mjs`** until the user approves the `website/` change, and lands at `website/tools/verify/verify-hotspot-reports.mjs` after that (`decisions.md` D-18).

### Unchanged (used, not modified)

`transport.ts` (`CACHED_GET_PATHS`, `EBIRD_GATED_PATHS`), `storage.ts`, `frontend/vite.config.ts`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/**`, every backend file, every `lib/tauri/` service, `observationsCache.ts`, `mlExportCache.ts`, `filesChanged.ts`, `useFilesEpoch.ts`, `keysChanged.ts`, `clearDerived.ts`, `cacheInventory.test.ts`, `hotspotSet.ts`, `hotspotRegionCache.ts`, `hotspotShare.ts`, `useHotspotSet.ts`, `exoticProvenance.ts`, `exoticProvenanceCache.ts`, `useExoticProvenance.ts`, `lifeListsRegion.ts`, `lifeListsProvenance.ts`, `birdingStats.ts`, `weatherStats.ts`, `weatherBlockParse.ts`, `commentBlocks.ts`, `weatherDisplay.ts`, `checklistMeta.ts`, `regionNames.ts`, `pageList.ts`, `speciesUtils.ts`, `statsFormat.ts`, `SnowMap.tsx`, `mapStyle.ts`, `BirdName.tsx`, `ChecklistLink.tsx`, `HotspotLink.tsx`, `TabLoadErrorAlert.tsx`, `SetupRequired.tsx`, Statistics, Map Explorer, Life Lists, Targets and every other tab.

---

## 1. Data flow, stated once

```
storage.getFilesStatus()                         -> { ebird, ml }        a rejection is UNKNOWN: the load-error state, never setup guidance
loadEbirdObservations()                          -> ObservationEntry[]   (shared cache)
loadMLExport().catch(() => null)                 -> MLExportRow[] | null (shared cache, optional)

pass I    buildLocationIndex(obs)                 O(rows + L log L)   once per files epoch
pass M    deriveMediaCounts(ml.rows, index)       O(mlRows)           once per files epoch, only with a readable ML export

escapees  useHotspotReportsEscapees(index, obs)   per snapshot change: the published names' own carrier rows, never a row pass
overview  speciesTotals(index, escapees)          O(L + rows of escapee species)   per index or escapee-set change
          rankLocations(index, totals)            O(L)                             same
kind      computeHotspotShare(index.locations, resolution)   O(L)   per index or Set change; kindOf(...) is O(1) per rendered row
picker    filterLocations(index, query, selected) O(L x haystack)   per keystroke, at most 200 rows out

select    deriveLocationFacts(index, obs, ord)    O(rows at that location + its weather blocks)   per selection and per epoch
          applySpeciesRule(facts, escapees)       O(S_loc log S_loc + C_loc)                      per facts or escapee-set change
codes     transport.post('/taxonomy/codes', { species })   at most one per selection, only for names not yet resolved this epoch
```

Passes I and M run inside the tab's load effect, after the awaited loads, never in a render body. Everything else is a memo keyed on the inputs named beside it. A picker press builds nothing file-scaled (QA-06): it changes one piece of state, and the memo that follows walks one location.

---

## 2. The index module: `frontend/src/lib/hotspotReports.ts`

Pure: no I/O, no clock, no React, no network import, no module-scoped mutable binding and no memo. Imports `./speciesUtils` (`normalizeSpeciesName`, `isNonCountableForm`), `./lifeLists` (`dayKey`, `placeOf`, `STATE_CODE_SCAN_CHARS`), `./lifeListsRegion` (`COUNTY_CELL_MAX_CHARS`), `./regionNames` (`regionName`) and types. Its suite carries the comment-stripped absence guard `lifeLists.test.ts` carries (no `.includes(`, `.indexOf(`, `.find(`, `.filter(`, `.match(`, `.search(`, `.split(`, `RegExp`, no regex literal), so every read is a hand loop, a `Map` operation or a typed-array index.

### 2.1 Decision: columns, not a Map of per-location records

The index holds three per-row typed columns, two row lists in compressed (start, rows) form, and small per-location arrays. A location's rows are a slice of one `Int32Array`; a species' rows are a slice of another. Per-location `Map`s (the Life Lists region shape) were measured beside it and declined:

| Measured on this Mac, Node 24.18, CPU time, first call / best of 5 | Columns (chosen) | Map of records with a species Map per location |
|---|---|---|
| Realistic cap: 150,000 rows, 3,000 species, 2,000 locations, 21,429 checklists | 64.1 / 31.9 ms; heap +1.9 MB plus 2.7 MB of typed arrays | 42.1 / 34.5 ms; heap +5.1 MB, and it holds no carrier lists, haystacks or sort |
| Hostile: every row its own location, checklist and species | 266.3 / 225.9 ms; heap +60.2 MB | 172.4 ms; heap +70.2 MB, same omissions |
| Escapee confirmation per snapshot change, 10 published names | 0.04 ms (0.3 ms hostile) | not available: needs the shipped row pass, 21.0 ms (18 to 39 ms across shapes) |

The columns win on what NFR-05 asks for (a snapshot change costs the published names' own rows, not a pass), on allocation that the file cannot multiply (no object per (location, species) pair), and they are transferable buffers if the pass ever has to leave the main thread (section 12.6).

### 2.2 Shapes

```ts
export const LOCATION_ID_MAX_CHARS = 16        // FR-10. Declared here, never imported from hotspotRegionCache.ts
                                               // (that module reaches the storage seam); a test compares the two numbers.
export const LOCATION_NAME_MAX_CHARS = 200     // FR-13, Open Question 5
export const RANKED_LIST_SIZE = 10             // FR-28, FR-29

/** One location. `locationId` and `stateProvince` carry the names `ShareChecklist` uses,
 *  so `computeHotspotShare(index.locations, resolution)` takes this array as it is. */
export interface LocationRecord {
  readonly ord: number                 // position in `locations`: the only thing an id or key is built from
  readonly locationId: string          // the Location ID cell, 1..16 code units, exactly as parsed
  readonly name: string                // the Location cell cut to LOCATION_NAME_MAX_CHARS; '' when the cell is empty
  readonly truncated: boolean          // the cell was longer than the bound; the surface writes the ellipsis
  readonly county: string              // the County cell when a string of at most COUNTY_CELL_MAX_CHARS (96), else ''
  readonly stateProvince: string | null // the State/Province cell when a non-empty string of at most STATE_CODE_SCAN_CHARS (16), else null
  readonly place: string               // placeOf(county, stateProvince): "County, ST" | "County" | "ST" | ''
  readonly stateName: string           // the full state or province name where regionName knows one, else '' (2.4)
  readonly lat: number | null          // FR-12; both null or both finite and in range
  readonly lng: number | null
  readonly haystack: string            // lowercased `name + '\n' + place + '\n' + stateName`, built once (3.1)
}

export interface LocationIndex {
  readonly rowCount: number                          // obs.length the index was built from
  readonly locations: readonly LocationRecord[]      // by ordinal, in first-appearance order
  readonly ordById: ReadonlyMap<string, number>      // Location ID -> ordinal
  readonly checklistLoc: ReadonlyMap<string, number> // Submission ID -> ordinal, or -1 for a checklist with no location

  // per-row columns, length rowCount
  readonly rowLoc: Int32Array        // the ordinal of the row's CHECKLIST's location, or -1
  readonly rowSpecies: Int32Array    // the ordinal of the row's normalized countable name, or -1 for a non-countable form
  readonly rowDay: Int32Array        // dayKey(o.date), or 0 for an invalid date (dayKey is never 0: month is at least 1)

  // row lists
  readonly locStart: Int32Array      // length L + 1
  readonly locRows: Int32Array       // row indexes grouped by location, FILE ORDER kept inside each group
  readonly speciesNames: readonly string[]            // ordinal -> normalized name ('' is possible and never eligible)
  readonly speciesOrd: ReadonlyMap<string, number>
  readonly spStart: Int32Array       // length S + 1
  readonly spRows: Int32Array        // every countable-form row grouped by species, located or not: the escapee carriers

  // per-location figures, length L
  readonly checklistCount: Int32Array // FR-11: distinct non-empty Submission IDs whose first row names this location
  readonly speciesBase: Int32Array    // distinct ELIGIBLE species, escapees included (2.5)

  // picker order, length L
  readonly pickerOrder: Int32Array    // ordinals in FR-20's order
  readonly rankOf: Int32Array         // ordinal -> position in pickerOrder
  readonly showId: Uint8Array         // 1 where another location shares both name and place (FR-21)
}

export function buildLocationIndex(obs: readonly ObservationEntry[]): LocationIndex
export function deriveMediaCounts(rows: readonly MLExportRow[], index: LocationIndex): Int32Array   // 3 per location: photo, audio, video
export function speciesTotals(index: LocationIndex, escapees: ReadonlySet<string>): Int32Array     // FR-36, one per location
export interface RankedRow { readonly ord: number; readonly checklists: number; readonly species: number }
export function rankLocations(index: LocationIndex, totals: Int32Array): { readonly byChecklists: readonly RankedRow[]; readonly bySpecies: readonly RankedRow[] }
/** As built (D-12): the ONE bound helper, used for the location name (H2) and the protocol label (H11). A length read first,
 *  then one slice of at most `max` code units, one fewer when the last kept unit is a high surrogate. */
export function boundText(raw: string, max: number): { readonly text: string; readonly truncated: boolean }
```

Every table keyed on file text is a `Map` (`ordById`, `checklistLoc`, `speciesOrd`), so a Location ID, a Submission ID or a species name spelled `__proto__` or `constructor` is an ordinary key (NFR-06, QA-10, QA-67). No composite string key exists anywhere in the module, so there is no delimiter to argue about.

### 2.3 Pass I: `buildLocationIndex`

One loop over `obs`, then four linear post-passes and one sort.

**The loop, per row `i`:**

1. **Species column.** `if (!isNonCountableForm(o.commonName))`: `norm = normalizeSpeciesName(o.commonName)`, its ordinal from `speciesOrd` (assigned on first sight), `rowSpecies[i] = ordinal`. This runs for EVERY row, before any location test, because the escapee confirmation counts every carrier of a name, including a row with no Submission ID or no usable Location ID (section 6).
2. **Day column.** `rowDay[i] = dayKey(o.date) ?? 0`: the row's own date cell, the Life Lists rule.
3. **Checklist.** `sub = o.submissionId`; an empty one ends the row (FR-11: ignored by every figure). `loc = checklistLoc.get(sub)`. On a miss this row is the checklist's first in file order and decides everything (FR-11):
   - `id = o.locationId`. Not a string, empty, or longer than `LOCATION_ID_MAX_CHARS`: `loc = -1`. The checklist has no location and neither do its later rows, whatever they carry.
   - Otherwise `loc = ordById.get(id)`; on a miss a `LocationRecord` is created FROM THIS ROW, which is the location's first checklist in file order (FR-12): name, county, state, place, state name, haystack.
   - `checklistCount[loc] += 1`.
   - Coordinates (FR-12): if the record has none and this row's `latitude` and `longitude` are both finite numbers with latitude in -90..90 and longitude in -180..180, take them. A later checklist can supply what the first lacked; a later one never replaces what an earlier one supplied.
   - `checklistLoc.set(sub, loc)`, set for the `-1` case too, so a rejected key is recorded at first sight and never re-examined (security.md, v1.0.40).
4. `rowLoc[i] = loc`.

**One reading the PRD leaves open, settled:** FR-10 says a row with an empty or over-long Location ID belongs to no location, and FR-11 says a row belongs to its checklist's location with the first row governing. Where they differ (a later row of a located checklist with a blank or junk Location ID), FR-11 governs: the row counts at its checklist's location. Where a checklist's FIRST row has no usable id, the whole checklist counts nowhere. No eBird export disagrees within a checklist; a test row pins both directions.

**Post-passes:**

- **Row lists.** Two stable counting sorts over the columns: `locStart` / `locRows` from `rowLoc`, `spStart` / `spRows` from `rowSpecies`. Each is three typed-array loops (count, prefix sum, place). File order survives inside each group, which is what lets `computeChecklists` see each checklist's first row first (section 4.1).
- **`speciesBase`.** For each location, walk its rows and count distinct species among ELIGIBLE rows with one reusable `Int32Array(S)` stamp (`stamp[s] !== ord`), so no per-location Set is allocated.
- **Picker order.** `pickerOrder` sorted by: unnamed after named; then `a.name.localeCompare(b.name)`; then `a.place.localeCompare(b.place)`; then `locationId` by code-unit comparison (FR-20). `localeCompare` is used directly, as the Region picker orders its labels: measured over 150,000 shuffled names it sorted in 83.5 ms in V8 and 50.9 ms in JavaScriptCore, against 201.6 ms and 101.5 ms through one `Intl.Collator`, with the same order in both. The order never reads the kind, so rows cannot move when the classification arrives (QA-20). Stated limit: collation is the engine's, so two engines may order unusual strings differently; identity, selection and every figure key on the Location ID and are unaffected.
- **`rankOf`** is the inverse permutation. **`showId`**: one walk over `pickerOrder` marking each run of two or more adjacent records whose `name` and `place` compare equal (FR-21). **As built, equal means `localeCompare(...) === 0` on each of the two fields, the same comparison the sort orders by (`decisions.md` D-11).** That is a superset of code-unit equality: two canonically equivalent spellings, which render identically, also show their ids, and every exactly-equal pair lands in one run because the sort that makes them adjacent uses the same comparison. The comparison is on the BOUNDED name, which is what the row shows, so two names that differ only past the bound are told apart by their ids.

### 2.4 The record's bounded fields

- **`name`.** `raw = o.location` when a string, else `''`. If `raw.length > LOCATION_NAME_MAX_CHARS` the name is the first 200 code units, shortened by one when the 200th is a high surrogate so no lone surrogate is shown, and `truncated` is true. The observation already holds the full cell for the session, so the slice retains nothing new. The surface appends the ellipsis from the copy module, written there as the escape `'\u2026'`; matching reads `name` only (FR-13, QA-13).
- **`stateName`.** `regionName` reads its two tables by bare key (`US[sub]`), so a cell like `US-constructor` returns an inherited member that is not a string. The call is therefore gated and checked, the form `lifeListsRegion.ts` already uses: only for a cell that passes the shape gate, and the result is kept only when `typeof` is `'string'`, it is not empty, and it differs from the code. Otherwise `''`. **The gate as built (`isCodeShape` in `lib/hotspotReports.ts`), exactly:** the cell is not `null`; its length is 1 to `STATE_CODE_SCAN_CHARS` (16) code units, checked before any character is read; and every code unit is an ASCII uppercase letter (`A` to `Z`, 65 to 90), an ASCII digit (`0` to `9`, 48 to 57) or the hyphen (45). Nothing else is admitted: no lowercase letter, no underscore, no space, no non-ASCII character. The hyphen is in the alphabet because every subnational code carries one (`US-CA`); the first draft of this sentence left it out. No prototype member name passes, since each of them contains a lowercase letter or an underscore. The gate checks the alphabet and the length only, never the position of the hyphens, which `regionName` itself reads. It is a hand loop over at most 16 code units, not an import of `isAskableRegionCode`, which would pull `hotspotSet.ts` and `transport.ts` into this module's closure (QA-10).
- **`stateProvince`.** A cell over 16 code units is held as `null`: the location reads as having no region code, so its kind is not yet known, never personal (the safe direction of FR-16). eBird's longest subnational code is 6 characters.

### 2.5 Eligibility, defined once (FR-33, FR-36)

A row `i` is ELIGIBLE when `rowLoc[i] >= 0` (a non-empty Submission ID whose checklist has a location), `rowSpecies[i] >= 0` (a countable form on the name as exported), `speciesNames[rowSpecies[i]] !== ''`, and `rowDay[i] !== 0` (a valid `YYYY-MM-DD` on the row). These are pass 1's gates from `lifeLists.ts` plus the location. One exported predicate, `isEligibleRow(index, i)`, is the only spelling; the index, the totals and the report all call it, so the three cannot drift.

### 2.6 Pass M: `deriveMediaCounts` (FR-55)

One loop over the ML rows: `cid = row.checklistId` (`''` skips); `loc = index.checklistLoc.get(cid)` (`undefined` or `-1` skips); `counts[loc * 3 + f] += 1` with `f` from the closed `format` union. The ML row's locality, county and coordinates are never read, so QA-54 is structural. The tab keeps the returned `Int32Array` and reads three numbers per selection.

### 2.7 The overview: `speciesTotals` and `rankLocations`

- **`speciesTotals(index, escapees)`**: `totals = speciesBase.slice()`; for each escapee name present in `speciesOrd`, walk that species' rows in `spRows` and, for each eligible row, decrement its location once (a reusable `Int32Array(L)` stamp keyed on the species ordinal). Cost: one array copy plus the escapee species' own rows. With no escapees it is the copy alone. For every location this equals the length of the report's life list (FR-36); QA-36 asserts it location by location over a mixed generated fixture.
- **`rankLocations`**: two bounded insertions over the locations, each keeping the best ten under FR-28's and FR-29's orders (checklists, then species total, then `name.localeCompare`, then Location ID; and species total, then checklists, then name, then id, skipping a total of zero). No sort over all locations. Each list holds at most `RANKED_LIST_SIZE` rows whatever the file holds.

---

## 3. The picker module: `frontend/src/lib/hotspotReportsPicker.ts`

### 3.1 The haystack

Built once per location in pass I: `(name + '\n' + place + '\n' + stateName).toLowerCase()`. Its length is bounded by construction at 200 + 1 + (96 + 2 + 16) + 1 + the longest state name in `regionNames.ts`, under 360 code units. The line feed cannot be typed into a single-line input, so a query cannot match across two fields. This is FR-19's matching (bounded name, place label, full state name), with no fuzzy matching and no accent folding.

### 3.2 Constants (Open Question 5, set from measurement)

```ts
export const PICKER_OPTION_CAP = 200          // FR-22: location options rendered, a number the file cannot change
export const PICKER_QUERY_MAX_CHARS = 100     // FR-19
```

### 3.3 `filterLocations`

```ts
export interface PickerWindow {
  readonly ords: readonly number[]   // at most PICKER_OPTION_CAP ordinals, in FR-20's order
  readonly matches: number           // every location that matches, for "Showing 200 of N"
  readonly start: number             // rank of the first rendered match among the matches
}
export function filterLocations(index: LocationIndex, query: string, selectedOrd: number | null): PickerWindow
```

- The query is cut to `PICKER_QUERY_MAX_CHARS` inside the function (the input's `maxLength` is the first bound, this is the one the function owns), trimmed and lowercased once.
- **A non-empty query:** one walk over `pickerOrder`; `haystack.includes(q)` per location; count every match and keep the first `PICKER_OPTION_CAP`. `start` is 0. This is the module's single use of a native search, on a string bounded at build; the suite asserts the module holds exactly one search-primitive call, with comments stripped, instead of a file-wide absence guard it could not honestly pass.
- **An empty query** matches every location: `matches = L`, no haystack is read. The window is the first `PICKER_OPTION_CAP` ranks, EXCEPT when a location is selected and its rank falls outside them: then `start = min(rankOf[selectedOrd], L - PICKER_OPTION_CAP)`, so the selected row is rendered and can be the active row on open (FR-23). Typing returns to the first matches. This is the settlement of the FR-22 / FR-23 collision; the narrowing line reads the same in both cases.

### 3.4 The picker component's data contract (FR-18 to FR-25)

The Designer owns its look within the `LifeListsRegionPicker` family. Fixed here:

- Props: `index`, `selectedOrd: number | null`, `onSelect(ord: number | null)`, `resolution` (for the kind marks), `disabled` (true when `index.locations.length === 0`, FR-08: native `disabled` on the input and the chevron, the overview wording shown).
- Rendered rows: the overview row at index 0, then `window.ords`, then one non-option narrowing line when `window.matches > window.ords.length`, or the no-match line when `matches === 0`. The narrowing line carries no `role="option"` and no id an arrow key can reach.
- **Every id and IDREF is `${useId()}-opt-${i}` with `i` the row's index in the rendered list.** No id, IDREF, CSS selector or `href` contains a name, a place or a Location ID. A Location ID shown for a namesake is text.
- **The window is a memo, as built `useMemo(() => filterLocations(index, open ? query : '', selectedOrd), [index, open, query, selectedOrd])`.** Four dependencies, not three: `open` is one of them, because a CLOSED list reads the empty query whatever was last typed, so the window a closed picker holds is always the selection's own window and reopening never shows a stale filter. The kind marks are computed for the rendered rows only, `kindOf(record, resolution)` each. (The input's `onChange` makes a second call for the active row; 12.5 records it.)
- Two tab stops at any location count: the input (a native control, outside `tabOrderCoverage.test.ts`'s population) and the chevron `Button` with the default `tabIndex`. No roster row is added.
- A per-row checklist count, if the Designer wants one, is `index.checklistCount[ord]`: free.

---

## 4. The per-location module: `frontend/src/lib/hotspotReportsLocation.ts`

Pure, same absence guard as section 2. Imports `./birdingStats` (`computeChecklists`), `./weatherStats` (`computeWeatherStats`, `WEATHER_SPECIES_MIN_CHECKLISTS`, the row types), `./weatherDisplay` (`CONDITION_DISPLAY_ORDER`), `./checklistMeta` (`protocolName`), `./lifeLists` (`dayKey`, `minuteOf12h`, `compareInstant`, `compareDisplay`, `firstSightingRecord`), `./hotspotReports` (the index and `isEligibleRow`).

The report is split in two so that an escapee change never re-reads a checklist or re-parses a weather block:

```ts
export function deriveLocationFacts(index: LocationIndex, obs: readonly ObservationEntry[], ord: number): LocationFacts   // escapee-independent
export function applySpeciesRule(facts: LocationFacts, escapees: ReadonlySet<string>): LocationSpecies                    // species-scaled
```

### 4.1 `deriveLocationFacts`

1. **The location's rows.** `locObs = index.locRows.subarray(locStart[ord], locStart[ord + 1])` mapped to `obs[r]`, in file order.
2. **Checklists.** `checklists = computeChecklists(locObs)`, the shipped function, unmodified and called with no new parameter. Because every row of a checklist is in `locObs` and file order is kept, each entry's fields are those of the checklist's first row in the file, which is FR-11, and equal the entries `computeChecklists(allObs)` would produce for the same Submission IDs (a test row asserts that equality). Its own `speciesCount` and `individualCount` are not read.
3. **Weather.** `weather = computeWeatherStats(checklists, NO_OBSERVATIONS)`: the shipped function, with an empty observation array because the per-species tally (its second pass) is not shown. QA-44's equality is then literal.
4. **Checklist figures**, one loop over `checklists`: the protocol tally (4.3), the complete-checklist counts (FR-44: `allObsReported` true, false, null), first and latest visit (4.5), months and years (4.4), time birded (4.6).
5. **Species facts**, one loop over the location's rows that carry a species ordinal with a non-empty name: for each species, the earliest ELIGIBLE row under the Life Lists order (`compareInstant` on the row's day and `minuteOf12h(o.time)`, then the smaller Submission ID by code-unit comparison), the number of distinct checklists carrying it on a countable-form row, dated or not (FR-37), and the list of distinct checklists carrying it on an ELIGIBLE row. Distinctness is a `Set<number>` keyed `speciesOrdinal * C + checklistIndex` (two integers, no string key; `C` is the location's checklist count, so the product stays far inside the safe integer range). Checklist indexes come from one `Map<submissionId, index>` built from `checklists`.

```ts
export interface SpeciesFact {
  readonly name: string
  readonly first: FirstSighting | null          // firstSightingRecord(obs[r], name, day, minute) of the earliest eligible row; null when the species has none
  readonly checklistCount: number               // FR-37
  readonly eligibleChecklists: readonly number[] // indexes into `checklists`, for FR-54 under the rule
}
export interface LocationFacts {
  readonly ord: number
  readonly checklists: readonly ChecklistEntry[]
  readonly weather: WeatherStats
  readonly protocols: readonly ProtocolRow[]
  readonly complete: { readonly complete: number; readonly known: number; readonly unknown: number }
  readonly firstVisit: VisitRef | null
  readonly latestVisit: VisitRef | null         // null when there is no dated checklist, equal to firstVisit when there is one
  readonly datedChecklists: number
  readonly months: readonly number[]            // exactly 12
  readonly years: readonly YearRow[]
  readonly timeBirded: { readonly minutes: number; readonly counted: number }
  readonly species: readonly SpeciesFact[]
  readonly checklistSpecies: Int32Array         // per checklist: distinct species with an eligible row there, escapees included
  readonly checklistDay: Int32Array             // as built (D-12). Per checklist: dayKey of its date, or 0 when undated
  readonly checklistMinute: Int32Array          // as built (D-12). Per checklist: minuteOf12h of its time, or -1 when blank
}
```

`firstSightingRecord` is the constructor pass 1 of Life Lists uses, so a row's binomial, checklist id and place are built exactly as Life Lists builds them, once per species at the location.

### 4.2 `applySpeciesRule` (FR-33 to FR-38, FR-54)

```ts
export interface LocationLifeRow {
  readonly name: string; readonly scientificName: string
  readonly day: number; readonly minute: number | null
  readonly checklistId: string
  readonly checklists: number          // FR-37: the location's checklists carrying the species
  readonly position: number            // 1 for the oldest row, rows.length for the newest (the design's "N of M")
}
export interface LocationSpecies {
  readonly rows: readonly LocationLifeRow[]     // newest first, compareDisplay
  readonly total: number                        // rows.length: THE species total (FR-36)
  readonly biggest: { readonly checklist: ChecklistEntry; readonly species: number; readonly day: number } | null   // `day` as built (D-12)
}
```

- `rows`: every `SpeciesFact` with a `first` whose `name` is not in `escapees`, sorted with `compareDisplay` (section 8). `position` is assigned after the sort, as Life Lists assigns it: the newest row carries `rows.length` and the oldest carries 1, so the design's position cell and its "N of M" prefix read two integers the row and the list already hold.
- `biggest`: `counts = checklistSpecies.slice()`; for each fact whose name is an escapee, decrement each of its `eligibleChecklists`; the maximum wins, a tie going to the earlier checklist under FR-51's order, an undated checklist losing to a dated one and two undated ones ordered by Submission ID. `null` when the maximum is zero (FR-54, QA-53). **As built (D-12), three additive fields serve this rule and its display.** `LocationFacts.checklistDay` and `checklistMinute` hold each checklist's day key and minute, parsed once in `deriveLocationFacts`, so the tie-break in `applySpeciesRule` compares integers and reads no date or time string on an escapee change. `biggest.day` is the winning checklist's day key (0 when it is undated), so the component dates the line without searching the checklist array or re-parsing a cell.
- Cost: the species at the location, their sort, the escapee facts' checklist lists and one pass over the checklist counts. No row and no comment is read.

### 4.3 Protocols (FR-42, FR-43)

```ts
export const PROTOCOL_ROWS_MAX = 10           // Open Question 5
export const PROTOCOL_NAME_MAX_CHARS = 64     // FR-43
export interface ProtocolRow {
  readonly kind: 'named' | 'other' | 'blank'
  readonly name: string            // the protocolName label cut to PROTOCOL_NAME_MAX_CHARS; '' for other and blank
  readonly truncated: boolean      // as built (D-12): the label was longer than the bound
  readonly count: number
}
```

A `Map` from the Protocol cell to its count; a `null` or empty cell is the blank bucket. Named entries are labeled `protocolName(cell)` (which reads its table through `Object.hasOwn`), sorted by count descending then label, and the rows that are kept are then cut to `PROTOCOL_NAME_MAX_CHARS` with the same surrogate rule as a name. **As built, the order of those two steps is merge, sort, cut:** the sort compares the FULL labels and the bound is applied afterwards, to the ten rows kept (12.1, H5 and H11, where the measured cost and the decision are). **`truncated` (D-12) is what lets the surface write the ellipsis:** the lib module returns the cut text and the flag, and the component appends the copy module's ellipsis, so no user-facing character lives in a derivation module and the name and the protocol label are cut by one helper, `boundText`. The first ten stay; the rest sum into one `other` row; the blank bucket is last. The counts sum to the checklist total by construction, and a row asserts it over a generated corpus. Two cells that map to one label ("P60" and "P62" are both "Pelagic") are merged into one row AFTER naming, so the list never shows a label twice.

### 4.4 Months and years (FR-52), and the bound NFR-03 did not list

```ts
export const REPORT_YEAR_ROWS_MAX = 100
export type YearRow =
  | { readonly kind: 'year'; readonly year: number; readonly count: number }
  | { readonly kind: 'earlier'; readonly before: number; readonly count: number }   // `before` is the first SHOWN year
```

Months and years come from `dayKey(checklist.date)`: the month is `floor(day / 100) % 100` and the year `floor(day / 10000)`. No `Date` is constructed. `months` is always twelve entries. Years are a `Map<number, number>` of years present, sorted ascending. **`dayKey` admits any four-digit year, so a hostile file can present ten thousand distinct years; rendered output must not follow it.** At most the `REPORT_YEAR_ROWS_MAX` most recent years are rows; any older ones are summed into a single leading `earlier` row whose `before` is the first shown year, so the figure still sums to the dated checklists. **The design labels that row "Before {first shown year}" and the shape supports it directly:** the first shown year is known where the row is built (the function sorts the distinct years ascending, keeps the last `REPORT_YEAR_ROWS_MAX`, and the first of those is `before`), so the label is one number handed to a copy builder and nothing is derived in the component. A real export never reaches the bound (eBird records span decades, not centuries), so the common path shows exactly the years present. The PRD's QA-51 (1900 and 2025 give two entries) holds.

**No count of calendar days exists in this feature.** Every date is read as text by `dayKey`, compared as an integer and shown through the house `formatDate`. No millisecond difference between two midnights is taken, so no daylight-saving row is owed. If the Designer adds a span ("birded here for N days"), it owes the rounding rule and a row pinned to a daylight-saving zone (`lib/mapExplorerFormat.test.ts` is the reference) in the same change.

### 4.5 First and latest visit (FR-51)

Over checklists whose date passes `dayKey`: the minimum and the maximum under `compareInstant(day, minuteOf12h(time))`, ties broken by the smaller Submission ID for the first and the larger for the latest. A blank time ranks after a timed one of the same day in both directions, the one rule `compareInstant` already states. `VisitRef` is `{ submissionId, day, minute }`.

### 4.6 Time birded (FR-53)

The sum of `duration` over checklists where it is not null, not negative and at most 1,440, the rule `computeDurationBins` applies. `DURATION_SANE_MAX_MIN` is module-private in `birdingStats.ts`, so the module declares `DURATION_MAX_MIN = 1440` and a test row holds the pair together through behavior, not by restating the number: for a generated corpus `counted` equals `computeDurationBins(checklists).durationCount`, and `minutes` equals `Math.round(avgDurationMin * durationCount)`. A summed integer is kept rather than the function's average multiplied back.

### 4.7 The weather summary (FR-46 to FR-49)

```ts
export type WeatherView =
  | { readonly state: 'none' }
  | { readonly state: 'below-floor'; readonly readable: number; readonly unreadable: number; readonly total: number }
  | { readonly state: 'full'; readonly readable: number; readonly unreadable: number; readonly total: number
      readonly sky: WeatherFigure; readonly temperature: WeatherFigure; readonly wind: WeatherFigure }
export interface WeatherFigure { readonly rows: readonly WeatherDistRow[]; readonly denominator: number; readonly typical: number | null }
export function weatherView(weather: WeatherStats, floor: number = WEATHER_SPECIES_MIN_CHECKLISTS): WeatherView
```

`none` when `foundCount === 0`; `below-floor` when `readableCount < floor`; otherwise `full`. Each figure's `denominator` is the sum of its rows' `checklists`, and `typical` is the row index with the most checklists, or `null` when the denominator is under the floor. **A tie goes to the band the section shows first**: `CONDITION_DISPLAY_ORDER` (`lib/weatherDisplay.ts`) for sky condition, ascending band order for temperature and wind. The floor is read from `WEATHER_SPECIES_MIN_CHECKLISTS` and never restated; the default parameter exists so QA-46's test double can move it. `total` is `weather.totalChecklists`, the location's checklist total. The floor of 10 was confirmed by the user at the design review (Open Question 2); the mechanism is unchanged.

---

## 5. The kind module: `frontend/src/lib/hotspotReportsKind.ts` (FR-15 to FR-17, FR-27)

Imports `./hotspotSet` (`isPublicHotspot`, `isAskableRegionCode`, the resolution types) and `./hotspotShare` (`computeHotspotShare`, `HotspotShare`). It is kept apart from the derivation modules because `hotspotSet.ts` statically imports `transport.ts`; this module issues no request and starts no build, which the network suite asserts by a symbol scan (section 11).

```ts
export type LocationKind = 'hotspot' | 'personal' | null     // null is "not yet known"
export function kindOf(loc: Pick<LocationRecord, 'locationId' | 'stateProvince'>, res: HotspotResolution): LocationKind
export type KindReason = 'none' | 'no-key' | 'checking' | 'offline' | 'unanswered' | 'no-region'
export function kindReason(share: HotspotShare, input: { hasEbirdKey: boolean | null; online: boolean }): KindReason
```

- **`kindOf`** is `computeHotspotShare`'s classification for one row, **in that function's own order, as built (`decisions.md` D-04; FR-15 and FR-16 now say the same):** (1) a location whose State/Province cell is not an askable region code (`isAskableRegionCode`) is not yet known, `null`, WHATEVER the Set holds; (2) otherwise `isPublicHotspot(locationId, res.set)` is hotspot; (3) otherwise a region whose `res.byRegion.get(code) ?? 'pending'` is `'answered'` is personal; (4) otherwise `null`. The first draft of this section put the Set test first. The shipped share tests the region code first and counts a code-less row as unclassified, and QA-15's equality (the sum of `kindOf` over the locations equals `computeHotspotShare(index.locations, res)`) holds only in that order. The difference cannot be reached from a real export (the Set holds only ids some askable region answered with, and a hotspot's own rows carry its state), so nothing a user sees depends on it; it is stated so nobody reorders the function to match older prose. If `computeHotspotShare` ever reorders, `kindOf` follows it and the sum row in `hotspotReportsKind.test.ts` says so.
- **The count block** is `computeHotspotShare(index.locations, res)` itself: `total`, `hotspot`, `personal`, `unclassified` sum by its own invariant.
- **`kindReason` is a new function beside `hotspotShareView`, not a new parameter on it**, because FR-27's precedence differs from the Statistics block's in two places, and changing the shipped function would change Statistics: (1) with nothing unclassified there is no reason at all, even with no key, where `hotspotShareView` returns `no-key` first; (2) the known figures are shown with every reason, where the Statistics block hides its bar with no key. The order is: `unclassified === 0` gives `none`; then `hasEbirdKey === false`; then `hasEbirdKey === null` or `regionsPending > 0`; then `!online`; then `regionsUnanswered > 0`; then `no-region`. The suite tabulates both functions over the same generated shares and asserts they agree everywhere except those two named differences.
- **No split is drawn when nothing is classified** (the user's decision at the design review; `decisions.md` D-01 and D-02). `export function kindSplitDrawn(share: HotspotShare): boolean` returns `share.hotspot + share.personal > 0`. When it is false and `share.total > 0`, the count block shows the location total and the one reason row from `kindReason`, and no hotspot or personal figure, so a zero is never printed for a count nobody has. When it is true the figures are drawn and sum to the total, the third omitted at zero. One predicate, read by the count block and by its tests, so the block and its reason row cannot half-agree. This is narrower than QA-27's "the three figures sum to the location total in every state"; the Planner's amendment is in the hand-back.

---

## 6. The passive provenance reader: `frontend/src/lib/hotspotReportsProvenance.ts` (FR-35, NFR-05)

Imports `./exoticProvenanceCache` (`subscribe`, `getSnapshot`, `loadSnapshot`) and types only. No `transport`, no `lib/tauri/*Service`, no `useExoticProvenance`. It builds NO cover index, so `loadEscapeeJoin()` is not called and `buildCoverIndex` appears nowhere in this feature: the rule that every builder of an escapee cover index passes the one taxonomy join is honored by not building one. The tab shows no completion status (Out of Scope), which is the only thing that index is for.

```ts
export function confirmEscapeesIndexed(
  published: readonly string[], consulted: ReadonlySet<string>,
  index: LocationIndex, obs: readonly ObservationEntry[],
): ReadonlySet<string>
export function useHotspotReportsEscapees(index: LocationIndex | null, obs: readonly ObservationEntry[]): ReadonlySet<string>
```

- **`confirmEscapeesIndexed`**: for each published name that is in `index.speciesOrd`, walk its rows in `spRows`; the name is confirmed when every row's `submissionId` is in `consulted`, with an early exit on the first one that is not. A published name the backup does not hold is left out.
- **The equivalence it owes** (a predicate re-implemented, so the difference is argued in both directions, from a measurement over a generated corpus, with the seam's own failure return as the first row): `confirmEscapeesIndexed(p, s.checklists, index, obs)` equals `confirmPublishedNames(p, s, obs)` intersected with the names in the backup. First rows: an empty published list; a snapshot with nothing consulted; a store that failed to load (the empty snapshot). Then the rows that separate a wrong implementation: a carrier with an empty Submission ID (unconsulted by definition, so the name stays listed); a carrier on a checklist with no usable Location ID; a carrier with an invalid date; a carrier that is a subspecies form of the name; a published name held only on non-countable-form rows; every carrier consulted. The carriers are every countable-form row, which is why step 1 of pass I runs before any location test.
- **The hook.** `snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)`; `useEffect(() => { void loadSnapshot() }, [])`; `confirmed = useMemo(() => confirmEscapeesIndexed(...), [snapshot, index, obs])`; then **content stability without a ref**: `key = useMemo(() => JSON.stringify([...confirmed].sort()), [confirmed])` and `escapees = useMemo(() => new Set<string>(JSON.parse(key)), [key])`. A string compares by value, so the returned Set keeps its identity across every snapshot that does not change the confirmed names, and every memo downstream stays put. The published list is capped by the store (2,048 names), so the sort is bounded independently of the backup.
- **What a snapshot change costs:** the published names' own carrier rows and one small sort. Measured: 0.04 ms at the realistic cap, 0.3 ms at the hostile shapes. What it rebuilds: nothing. Only when the confirmed names actually change do the totals (section 2.7), the two ranked lists and the selected location's `applySpeciesRule` re-run, each species-scaled or location-scaled. QA-35's "zero index builds" row counts `buildLocationIndex` AND `deriveLocationFacts` across snapshot changes.

---

## 7. The tab: `components/hotspotReports/HotspotReportsTab.tsx`

### 7.1 State

```ts
type Media = { tag: 'none' } | { tag: 'unreadable' } | { tag: 'ready'; counts: Int32Array }
type Phase =
  | { tag: 'loading' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: readonly ObservationEntry[]; index: LocationIndex; media: Media }

const [selectedId, setSelectedId] = useState<string | null>(null)   // a Location ID; null is the overview. Session only (FR-58)
```

**What holds the index: the tab's `ready` phase, and nothing else** (NFR-04, the Life Lists shape). No module in this feature declares a mutable module-scoped binding or a module-scoped collection, and `buildLocationIndex` has no memo, so when the load effect replaces the phase the previous index, its columns and its records are unreachable; when the observations cache drops a parse, nothing here holds it. A `WeakRef` memo was considered and declined: there is one consumer and one build per epoch, so a memo would add a holder to remove one call that never repeats. QA-66's rows: two calls with the same array return two distinct objects; a comment-stripped scan of the six lib modules finds no module-scoped `let`, `new Map`, `new Set` or array literal outside declared constants.

### 7.2 The load effect (FR-06, FR-07, FR-57)

Deps `[filesEpoch]`, with `useFilesEpoch()` read in the component. `setPhase({ tag: 'loading' })`; `getFilesStatus()` (a rejection lands in the catch and is the error phase, never setup guidance); no backup is `setup-required`; then `Promise.all([loadEbirdObservations(), loadMLExport().catch(() => null)])`; a null backup is the error phase; then pass I and, with a readable ML export, pass M; `status.ml` without rows is `unreadable` and no `status.ml` is `none` (FR-09, FR-55). Then:

- `setSelectedId(prev => (prev !== null && index.ordById.has(prev) ? prev : null))`, and `null` in the setup and error branches. A selection whose id the new backup lacks is DROPPED, silently: no message and no announcement, and a later file that holds the id again does not bring it back (QA-55). A selection the new backup still holds re-derives in place.
- The resolved taxon codes are cleared, so nothing keyed on the old file's names outlives it.

`TabLoadErrorAlert` is the first child of every branch, as in `LifeListsTab.tsx`. The tab joins the two load rosters (section 10).

### 7.3 Memos

```ts
useHotspotSet()                                            // starts the shared build; its return value is not needed
const resolution = useHotspotResolution()
const escapees = useHotspotReportsEscapees(index, observations)
const share    = useMemo(() => computeHotspotShare(index.locations, resolution), [index, resolution])
const totals   = useMemo(() => speciesTotals(index, escapees), [index, escapees])
const ranks    = useMemo(() => rankLocations(index, totals), [index, totals])
const ord      = selectedId === null ? undefined : index.ordById.get(selectedId)
const facts    = useMemo(() => (ord === undefined ? null : deriveLocationFacts(index, observations, ord)), [index, observations, ord])
const species  = useMemo(() => (facts === null ? null : applySpeciesRule(facts, escapees)), [facts, escapees])
```

`useHotspotSet()` and `useHotspotResolution()` are called in the SAME component: the build's own settle replaces the resolution snapshot without announcing, and it is the first hook's resolved load that re-renders the caller so the second adopts the new snapshot (`lib/useHotspotSet.ts`).

The key status is `storage.getApiKey('ebird')` reduced to a boolean on `useKeysEpoch()`, and `useOnline()`, both as Statistics reads them; they feed `kindReason` only. The announcement (FR-25) reads `totals[ord]` and `index.checklistCount[ord]`, so it is available in the press's own render and equals the report's figures by section 2.7's equality.

### 7.4 What a hidden tab does and does not recompute

Tabs stay mounted under `display: none`, and React still renders them.

| Event while the tab is hidden | Work |
|---|---|
| A files epoch | The load effect re-runs: the two shared loads (a cache hit or the shared parse, never a second parse), pass I, pass M, and, if a location is selected and still present, its facts. This is what every mounted tab does and is why the figures are right on return (QA-06) |
| The hotspot Set changes | `computeHotspotShare` over the locations (0.2 ms at 2,000 locations, 20.6 ms at 150,000) and the kind marks of the rows on screen. No facts, no index |
| A provenance snapshot | The indexed confirmation and one key string. Nothing else unless the confirmed names changed |
| The keys epoch, online state | One seam read; the reason sentence |
| A picker press or keystroke elsewhere | Nothing: there is none while hidden |

It never: rebuilds the index outside an epoch, re-parses weather outside an epoch or a selection, moves the map (section 9), issues a codes post without a selection change, or writes anything.

### 7.5 The codes batch (NFR-01 c, QA-63)

Lives in the tab component, the Life Lists shape, with one difference: it is keyed on the SELECTED location's names, not the world roster, and it accumulates. **As built (`decisions.md` D-13):**

- **State.** `codes`, a `Map<string, string>` in component state (a `Map`, so a species name is never an object key); `asked`, a `Set<string>` in a ref, the names ASKED this files epoch; and an epoch counter in a ref. All three are reset by the load effect at every files epoch, so nothing keyed on the old file's names outlives it.
- **A name is asked at most once per files epoch, answered or not.** On a change of `facts`, the batch is the names of `facts.species` that have a `first` (escapees included, so an escapee change never posts) and are not in `asked`. If there is none, no request is made. Otherwise the names are added to `asked` BEFORE the post, and ONE `transport.post('/taxonomy/codes', { species: withNormalizedParents(missing) })` is sent. The first draft of this section said "not in `codes` and not in flight"; under that rule a name the answer carries no code for would be posted again on every later selection that shows it, which breaks QA-63's "choosing a second location with the same names issues none". Recording the ASK, not the answer, is what closes it.
- **The answer.** Codes are merged into `codes` for the names of that batch only, each read through `Object.hasOwn` and kept only when it is a string. A name with no code in the answer stays in `asked` and is not asked again this epoch.
- **An answer that lands after an epoch change is dropped.** The post captures the epoch counter when it is sent; the `then` returns without merging when the counter has moved, so a code for the old file's name never enters the new epoch's map.
- **A failed post releases its names.** The `catch` removes that batch's names from `asked`, so the next selection that shows them asks again; it does so only when the epoch has not moved, so a late failure cannot release names in the new epoch's record. The marks stay absent meanwhile.
- The overview never posts. The list renders at once and never waits on the batch.

### 7.6 Selection, focus and the announcement

`onSelect(ord)` from the picker and a ranked row's press both call one handler: `setSelectedId(ord === null ? null : index.locations[ord].locationId)` and bump the announcement sequence. The live region is always mounted, holds a sequence-keyed child and only the sentence. Where focus lands after a ranked-row press (FR-30) is the Designer's; it must be an element that exists in the report's first render.

---

## 8. Reuse map: every figure, the function it calls, or why it cannot

| Figure | Calls | New parameter or new function, and why |
|---|---|---|
| Checklist roll-up (FR-11) | `computeChecklists(locObs)` (`lib/birdingStats.ts`) | Neither. Called on the location's rows in file order; existing callers untouched |
| Life list membership and first date (FR-33, FR-34) | `isNonCountableForm`, `normalizeSpeciesName`, `dayKey`, `minuteOf12h`, `compareInstant`, `firstSightingRecord` | New passes (2.3, 4.1), because the tier is the location and `lifeListsRegion.ts`'s tiers are keyed on region cells. The gates, the order and the record constructor are the shipped ones, imported, never restated |
| Display order (FR-37) | `compareDisplay` (`lib/lifeLists.ts`) | **A type-only widening** of its parameters to `Pick<LifeListRow, 'day' \| 'minute' \| 'name'>`, the three fields it reads. No runtime change, no new function. Declined: building full `LifeListRow` objects with unused `position` and `media` fields, which would carry Life Lists display fields into a different table |
| Paging (FR-37) | `pageList`, `PAGE_SIZE` (`lib/pageList.ts`) | Neither |
| Escapee rule (FR-35) | The store's `subscribe` / `getSnapshot` / `loadSnapshot`; `confirmPublishedNames` as the TEST ORACLE | New function `confirmEscapeesIndexed` beside it, in this feature's module, because the shipped one is a row pass per snapshot and NFR-05 forbids that here; `exoticProvenance.ts` is not touched. Equivalence is section 6 |
| Exotics (FR-35) | Nothing | By requirement: the published exotic list is not read |
| Cover index, taxonomy join | Nothing | None is built (section 6) |
| Protocol names (FR-42) | `protocolName` (`lib/checklistMeta.ts`) | Neither |
| Complete share (FR-44) | `fmtSharePct` (`lib/statsFormat.ts`) | Neither; the counts are section 4.1's |
| Weather (FR-45 to FR-49) | `computeWeatherStats(checklists, [])`, `WEATHER_SPECIES_MIN_CHECKLISTS`, `CONDITION_DISPLAY_ORDER`, band labels from `lib/weatherDisplay.ts` | New function `weatherView` beside `weatherSectionState` and `speciesWeatherState`: their floors and state names answer other questions (the export, a bird). `stripWeatherTideBlocks` is not involved: the tab shows no comment text, and the reader and its span finder are called only through `computeWeatherStats` |
| Distribution rows: protocols, sky, temperature, wind, months, years | `DistRow`, extracted to `components/WeatherDistRow.tsx` | An extraction plus two defaulted props, because a second surface gets the one implementation and the design needs a count-only row and an emphasis mark (8.1). `DistGroup` is not shared |
| Kind in three states (FR-15) | `isPublicHotspot`, `isAskableRegionCode`, `computeHotspotShare`, `useHotspotSet`, `useHotspotResolution` | New `kindOf` (one row of the same classification) and `kindReason` (section 5 says why not `hotspotShareView`) |
| Place label (FR-12) | `placeOf` (`lib/lifeLists.ts`), `regionName` (`lib/regionNames.ts`) behind the gate of 2.4 | Neither |
| Time birded (FR-53) | The rule of `computeDurationBins` | A four-line sum, because the function returns an average, not a total; held to it by a behavioral row (4.6) |
| Media counts (FR-55) | `MLExportRow.checklistId`, `MLExportRow.format` | New pass M (2.6): the region asset pass dates assets and keys them by region; this needs three counts per location |
| Hotspot and checklist links | `HotspotLink` (its `L` plus digits gate), `ChecklistLink` (its Submission ID gate) | Neither. The header passes `isHotspot = kindOf(...) === 'hotspot'` |
| Bird names | `<BirdName>` with `hasEntry` true and `onOpenSpecies` from `App` | Neither |
| Setup and failure states | `SetupRequired`, `EBIRD_BACKUP_STEPS`, `EBIRD_BACKUP_LOAD_ERROR`, `TabLoadErrorAlert` | Neither |
| Statistics' top locations (`computeGeo`), Map Explorer's My species (`buildHotspotPersonalStats`) | Not called | By requirement: two other rules for two other figures (PRD, Out of Scope). The tab explains them in copy |

### 8.1 The distribution row on a second component surface (`decisions.md` D-02)

**Decision: `DistRow` is EXTRACTED, verbatim, into its own file, `frontend/src/components/WeatherDistRow.tsx`, and both surfaces import it. `DistGroup` stays private to `WeatherStatsSection.tsx`.**

- **What the rule asks of a further surface.** "ONE PRIMITIVE, TWO SURFACES" (`pipeline/design-system.md`) is written about `WeatherSpeciesRow`, the per-species row, and its ground is in that component's own header: a row two surfaces render has exactly one implementation, "by construction rather than by agreement", so it was extracted to its own file, never copied. The distribution row is the same case one step later. It is private to the Statistics section because it has had one component surface; this tab is its second (and the third surface of the `.sr-wx-*` class family, after the Species Detail card). The precedent answers the question: extract. Rendering the shared classes from this tab's own row component would re-implement the row's three states (the dashed empty rail at zero, the fill's 3px floor, "<1%") beside the original, which is the pair that agrees today and disagrees later.
- **Why its own file and not an export from `WeatherStatsSection.tsx`.** That file statically imports `SpeciesCombobox`, `BirdName`, `WeatherSpeciesRow` and the Statistics weather copy, so importing a row from it would put the whole section on this tab's static graph. `WeatherDistRow.tsx` imports `fmt` from `lib/statsFormat.ts` and nothing else.
- **Why `DistGroup` is not shared.** Its header prints `axisDenominatorSuffix(axis)`, Statistics' own weather copy, and it has no place for the "Most common" line or for a group that prints no share. The tab draws its own group head (`.sr-hsr-grouphead`, words from its copy module) and maps its rows to `DistRow` inside `.sr-wx-rows`.
- **Two defaulted props are added, because the design needs two things the row cannot say today.** `share?: string`: when omitted the count cell prints the figure alone, with no separator and no share (the month and year rows). `emphasis?: boolean`, default false: adds the class `is-typical` to the row (the most common band, set at weight 700 by a rule scoped under this tab). With both omitted the markup is today's, character for character.
- **The proof that Statistics and Species Detail are unchanged**, in the order testing.md's v1.0.22 rule requires. (1) A commit of its own that captures the Statistics Weather section's rendered markup as a golden fixture (the full state, the below-floor state and the per-species view) and touches nothing else. (2) The extraction commit, which leaves that golden, `WeatherStatsSection.test.tsx` and `SpeciesWeatherCard.test.tsx` untouched and green. (3) A row in the new file's suite showing that the two props, omitted, render the golden's row, and supplied, change only what they name. Species Detail's card does not render `DistRow` at all (it renders `WeatherSpeciesRow`), so its part of the proof is that its suite is untouched.
- **No shared declaration changes** (`decisions.md` D-01). The tab's refinements are rules under its own classes (a protocol label that wraps under `.sr-hsr-proto`; the emphasis weight under a `.sr-hsr-*` ancestor), placed ABOVE the established 640px block so the phone tier's own rule for the same class still wins on source order where the two tie. `weatherRowTierCss.test.ts` runs unchanged, and a comment-stripped declaration-block multiset diff of `globals.css` against `HEAD` shows zero blocks removed.
- **What must learn the new surface.** (1) The comment above `.sr-wx-pair > *:not(.sr-only)` in `globals.css` says `.sr-wx-rows` "appears in three places"; it gains this tab's groups, as prose swept from the source. (2) `hotspotReportsCss.test.ts` (13.4) pins, as resolved cascades at this surface, that a protocol label's `white-space` above 640px is not `nowrap`, and that no rule under `.sr-hsr-` redeclares the row's `grid-template-columns` or a `grid-area`. (3) `entryChunk.test.ts` gains the negative that `components/WeatherStatsSection.tsx` is off this tab's static closure, with the positive leg that `components/WeatherDistRow.tsx` is on it and on Statistics'. (4) **Not extended, and why:** `website/tools/verify/verify-weather-species-rows.mjs` and its `SURFACES` roster measure the per-species row, which this tab does not draw; `controlRegisters.test.ts` pins control registers and label pairings, not this row, and learns only the picker's label (10.1 row 9). No guard in the repo rosters the surfaces of the distribution row today; (2) and (3) are the ones this build adds.
- **One fact the Designer's rail depends on.** The distribution row's stacked shape is triggered by the VIEWPORT (the 640px tier), not by its container; only the per-species row has a container trigger. In this tab's 24rem rail the row therefore keeps its inline shape in every window wider than 640px. The rail and the row's label track are both sized in rem, so the proportion holds as text scales, and 13.4's re-measurement covers the rail at 200% in the built app.
- **Rule files.** `components/WeatherDistRow.tsx` is under `ui.md`'s `frontend/src/components/**`, the same gate that governed the code inside `WeatherStatsSection.tsx`, so the move changes no gate and no `paths` entry is owed. The file mints no id and holds no scan; its `label` is rendered as React text, and the one caller that passes user-file text (a protocol name, bounded at 64) sits inside the `components/hotspotReports/**` gates of 12.4.

---

## 9. Chunking (NFR-09)

| Chunk | Holds | Guard |
|---|---|---|
| Entry | Only the registry lines: `lib/tabLayout.ts`, `lib/tabIcons.tsx`, the `lazy()` line and the panel in `App.tsx` | `entryChunk.test.ts`: the tab's component, its six lib modules and its copy module are each absent from the App static closure |
| The tab's lazy chunk | `HotspotReportsTab.tsx`, the picker, the overview and report components, the six lib modules, and modules other tabs already share (`lifeLists.ts`, `lifeListsRegion.ts`, `birdingStats.ts`, `weatherStats.ts`, `weatherDisplay.ts`, `pageList.ts`, and `components/WeatherDistRow.tsx`, shared with Statistics). `components/WeatherStatsSection.tsx` is NOT on it (8.1) | The positive leg: the closure from `HotspotReportsTab.tsx` reaches every one of its own files; `App.tsx` contains the import string. `maplibreIn(closure.externals)` is empty and so is the Recharts filter |
| The map's lazy chunk | `HotspotReportMap.tsx`, `SnowMap.tsx`, `react-map-gl`, `maplibre-gl` (the existing vendor chunk) | `HotspotReportMap.tsx` is absent from the tab's static closure; the closure from `HotspotReportMap.tsx` DOES reach maplibre (the positive leg, so the negative cannot pass by a rename) |
| County geometry | Not reached by anything in this feature | The existing rows |

- **The map mounts only when the selected location has coordinates.** `HotspotReportMap` is `React.lazy` inside the tab and is rendered only in that branch, so the overview and a location without coordinates load no map chunk and no tile (FR-40, QA-26, QA-40). Its height lives in a stylesheet class the `Suspense` fallback shares, never a constant imported from the map module.
- **One map instance per run of selections with coordinates.** A change of location moves the marker by props and re-centers with `map.jumpTo` (no animation: a GL transition does not follow the app's reduced-motion rule). It is not keyed on the location and is not remounted; it unmounts when the selection has no coordinates or is cleared.
- **No chart library.** The distributions (protocols, sky, temperature, wind, months, years) are the shared distribution row, `DistRow` (8.1): text with a decorative rail. The life list's per-row share bar is a CSS width from two integers the row already prints (the species' checklist count over the location's checklist total), `aria-hidden`, computed in the row component; it reads no file text. Nothing is lazy besides the map, and the entry-chunk row above keeps Recharts off the tab's graph.
- **Not warmed at idle.** The tab is left out of `App.tsx`'s `warm()` list, the Life Lists precedent. The maplibre vendor chunk is already warmed there for the Named Birds map.

---

## 10. The tab registration set

Found by reading how `life-lists` was registered (commit `139d3718` and a grep for `'life-lists'` and `Life Lists` across `frontend/src` and `docs`).

### 10.1 Files and the guard for each

| # | File | Change | Guard |
|---|---|---|---|
| 1 | `lib/tabLayout.ts` | `'hotspot-reports'` joins `ConfigurableTab`, `TAB_LABELS` ("Hotspot Reports") and `DEFAULT_TAB_ORDER` at index 8, **between `'breeding-codes'` and `'checklists'`** (the user's direction at the design review, `decisions.md` D-03, replacing FR-02's default of directly after `'life-lists'`). `PREVIOUS_DEFAULT_TAB_ORDER` becomes today's twelve-id default as a spelled-out literal; the 1.0.38 order it holds is retired. Its doc comment is rewritten for the new generation. Both lists are spelled out in 10.2 | `tabLayout.test.ts`, the rows named in 10.2 (QA-01 to QA-03); the build fails to typecheck without the `TAB_LABELS` and `TAB_ICONS` entries |
| 2 | `lib/tabIcons.tsx` | A `TAB_ICONS` entry drawing lucide `MapPinned`, the Designer's choice (`decisions.md` D-01), imported nowhere else in the app today | Typecheck; a new row in `tabLayout.test.ts` or beside it rendering every entry and asserting pairwise-distinct markup (QA-04) |
| 3 | `App.tsx` | `importHotspotReports`, the `lazy()` line, `'hotspot-reports'` in `DEFERRED_TABS`, and the tabpanel block (`id="panel-hotspot-reports"`, `aria-labelledby="tab-hotspot-reports"`, `aria-label`, the `mountedTabs` gate, the `Suspense` fallback, `onGoToSettings` and `onOpenSpecies={navigateToSpeciesDetail}`). No `filesVersion` prop | `entryChunk.test.ts`; the component suites |
| 4 | Navigation, Search, tab-layout settings | No code: `TabNav`, `CommandPalette` (`visibleTabs` labeled from `TAB_LABELS`) and Settings' list draw from the registry (FR-04) | `settingsAlertsOff.test.tsx` and `settingsOffIos.fixture.json` re-captured and diffed first: exactly one inserted row per platform naming Hotspot Reports, between Breeding Codes and Checklists. Any palette suite whose query "Hotspot Reports" now matches (the `list` row in `alphaCodeSearch.test.ts` is the precedent) is found by the full suite, not by reading |
| 5 | `components/HelpDocs.tsx`, `docs/HELP.md` | The TOC entry between Breeding Codes and Checklists; the `## Hotspot Reports` section at the same place in `docs/HELP.md` (FR-59: where the tab sits in the default order); the tab's name between Breeding Codes and Checklists in the two tab lists in Getting Started (line 19) and Default Files (line 100) | `helpToc.test.ts` (19 becomes 20, on purpose; its parity row compares the two orders); `hotspotReportsPublishedClaims.test.ts` |
| 6 | `globals.css` | The `.sr-hsr-*` family (the prefix is unused today), every phone-tier declaration INSIDE the established 640px block, the More-sheet cap (10.3) | `TabNav.test.tsx` (10.3); `hotspotReportsCss.test.ts` (13.4); the scroll-leak, filter-control-size, inline-style and control-register guards with the tab's files in scope |
| 7 | `components/TabLoadErrorAlert.test.tsx` | A roster row, `epochDriven: true`; ten becomes eleven | Itself |
| 8 | `components/honestLoadFailures.test.tsx` | An `EBIRD_MESSAGE_TABS` row | Itself |
| 9 | `lib/controlRegisters.test.ts` | If the picker's label takes `.sr-ctl-label` beside the `.sr-input-16` input (the Region picker's shape), the paired-label count goes from 31 to 32 with a roster line for `components/hotspotReports/HotspotReportsPicker.tsx` | Itself |
| 10 | `lib/entryChunk.test.ts`, `lib/exoticProvenanceGraph.test.ts`, `lib/transportPathSets.test.ts` | Sections 9, 13 and 11 | Themselves |
| 11 | `lib/tabOrderCoverage.test.ts`, `androidReadings.test.ts`, `inlineStyleShorthand.test.ts` | No row added; they must pass with the new files in scope | Themselves |

### 10.2 The migration (FR-03)

`parseLayout` is unchanged. Only the two constants move.

**The new default (thirteen ids):** `weather`, `birding-stats`, `map-explorer`, `species-detail`, `calendar`, `targets`, `life-list`, `breeding-codes`, `hotspot-reports`, `checklists`, `life-lists`, `comparer`, `named-birds`. The phone bar's default four cells are the first four and do not change.

**The new previous default (twelve ids, a spelled-out literal):** the same list without `hotspot-reports`, which is today's `DEFAULT_TAB_ORDER` exactly.

**What each saved order reads as**, by the code as it stands: the unknown-id drop, then `appendMissing`, then the one equality `sameOrder(knownOrder, appendMissing(PREVIOUS_DEFAULT_TAB_ORDER))`.

| Saved order | Reads as |
|---|---|
| Nothing saved, or a malformed value | The new default |
| Today's twelve-id default (what Restore defaults, or a hide or show with no reorder, wrote back) | **The new default**, Hotspot Reports between Breeding Codes and Checklists. The saved twelve gain the missing id LAST by the append, the constant gains it last the same way, the two are equal, and the migration fires. The hidden set is kept and nothing is written back |
| The new thirteen-id default | Itself |
| **Any other order: a custom order** | **The saved order verbatim, with `hotspot-reports` appended LAST and visible.** `appendMissing` pushes every known id the saved order lacks onto the END, in default order; it never inserts a tab at its default position. Life Lists arrived in custom orders the same way: the shipped row "leaves a custom order verbatim with Life Lists appended LAST" says "at the end, not after Checklists". For this tab the sentence is "at the end, not between Breeding Codes and Checklists". The tab's default position decides only where it sits in the default and in a migrated previous default |
| A custom order that lacks more than one id | The saved order, then the missing ids in the NEW default's order. Hotspot Reports now precedes Life Lists in the default, so a saved 1.0.38 default (eleven ids) reads as those eleven, then `hotspot-reports`, then `life-lists`; the retired 1.0.19 default reads as its ids, then `targets`, `hotspot-reports`, `life-lists` |
| A prefix of today's default cut at or before `breeding-codes` (its first eight ids or fewer) | The new default, by the append alone, because every id from the insertion point on is restored in default order. A prefix cut AFTER `breeding-codes` (through `checklists`, say) is a custom order: that prefix, then `hotspot-reports`, then the rest. This is where the new anchor differs from Life Lists', whose shipped row cuts through `checklists` |

**One consequence of the one-generation rule, stated so nobody meets it as a defect.** A device that saved the 1.0.38 default before Life Lists shipped and has not saved since has been shown Life Lists after Checklists by the migration, which writes nothing back. From this release that saved order is two generations old and reads as a custom order, so Life Lists moves to the end, behind Hotspot Reports. FR-03 and QA-03 accept this in so many words ("a saved 1.0.38 default is treated as a custom order"); it is in the hand-back so the Planner sees the visible effect.

**The `tabLayout.test.ts` rows that pin each.** The existing rows are rewritten in place for the new generation, and the suite's two helper constants become the twelve-id previous default and the thirteen-id new default.

| Row | Pins |
|---|---|
| `matches the intended first-run navigation order` | The thirteen-id literal |
| NEW: `places Hotspot Reports at index 8, between Breeding Codes and Checklists, under its own key and label` | The index, both neighbors, `TAB_LABELS['hotspot-reports']`, and that removing the id yields the previous default exactly (QA-01, QA-02) |
| `places Life Lists at index 9, directly after Checklists, under its own key and label (QA-01)` | Rewritten: index 10, still directly after Checklists; `life-list` is still "Multimedia" |
| `keeps the 1.0.38 default as a literal, since the migration below is one equality against it` | Rewritten: the twelve-id literal |
| `maps the previous default to the new default ...`, `keeps the hidden set through the migration ...`, `returns the new default unchanged (round-trip)` | The migration, the hidden set, the round trip |
| `leaves a custom order verbatim with Life Lists appended LAST, including a single swap elsewhere` | Rewritten for Hotspot Reports: a single swap and a thoroughly custom twelve-id order each end with `hotspot-reports`, and nothing else moves |
| `compares AFTER the unknown-id drop ...`, `compares against the constant given the SAME missing-tab append ...` | The same two properties on the new constants |
| `a previous default missing its tail reaches the new default through the append alone` | Rewritten: the cut is through `breeding-codes` (the first eight ids); a second assertion cuts through `checklists` and expects the custom reading in the table above |
| `does NOT migrate the retired 1.0.19 default ...`, `does NOT migrate a pre-Calendar (0.5.42) default ...` | Rewritten expectations: each appended tail gains `hotspot-reports` before `life-lists` |
| NEW: `does NOT migrate the 1.0.38 default: exactly one generation migrates` | The eleven ids, then `hotspot-reports`, then `life-lists`; the hidden set kept |
| `loadTabLayout`: `reads as the new default and writes nothing back` | Rewritten for the twelve-id default on disk; the stored string is byte-identical afterwards |

### 10.3 The More sheet (FR-05), and why the pixel cap is not enough

Read from `globals.css` and `TabNav.tsx`: the sheet lists every destination that is not one of the four bar cells (`PHONE_FAVOURITES = 4`), each row is `min-height: 44px`, the cap is `min(70dvh, 528px)`, and both the cap's comment and `TabNav.test.tsx` say 528px was measured with "all eleven tabs visible". Twelve configurable tabs ship today (Life Lists joined without a recorded re-measure in its pipeline folder), which by arithmetic is one row over, about 572px; thirteen is about 616px. On the reference phone (393x852) `70dvh` is 596px, so with thirteen tabs the viewport term binds before any pixel cap and the list scrolls at the default text size.

**Decided at the design review (2026-11-10): the sheet is made tall enough to hold thirteen tabs without scrolling.** The arithmetic above is from the stylesheet. The mockup, with the sheet's styles copied from `globals.css`, measures 616px in Chromium and in WebKit at 393x852 with a 34px inset and draws `min(73dvh, 616px)` (`decisions.md` D-01). Neither is the built app: **the Engineer's WebKit measurement of the built app governs both terms.**

- **Measure** the open sheet on the production build in WebKit, with Chromium as the second reading, at 393x852 with `.sr-ios-app` on the root and a 34px bottom inset, all thirteen tabs visible, text at 100%: the body, the foot, the padding and border, and the total `H`.
- **The rule** becomes `max-height: min(<v>dvh, <H>px)`, with `v` the smallest whole number for which `v / 100 * 852 >= H` (73 if `H` is 616).
- **`TabNav.test.tsx`'s cap row is a property the Engineer re-measures, not a typed-in pair.** `SHEET_AT_1X_PX` is the measured `H`. The row parses `min(<v>dvh, <px>px)` out of the resolved declaration (its pattern stops requiring the literal `70dvh`), asserts `px >= SHEET_AT_1X_PX`, and asserts `v / 100 * 852 >= SHEET_AT_1X_PX`, so a later edit that lowers either term below the measured sheet goes red. The row still cannot see the content grow: a tab added later owes a new measurement and a new constant, and the row's comment says so. The row's comment and the cap's comment in `globals.css` are restated for thirteen tabs (both say eleven today).
- **The measurement is recorded** in `pipeline/hotspot-reports/decisions.md`: the build commit, both engines, the viewport and inset, the four heights, and the two terms chosen. A leg with today's `min(70dvh, 528px)` restored must show the list scrolling, so the probe is known to be able to reject a revert.
- Settings stays pinned in the foot. The short SE screens still scroll, where the viewport term binds first; that is unchanged in kind.

FR-05 and QA-05 name only the pixel cap and the number 528; the Planner's amendment for the viewport term is in the hand-back.

---

## 11. Network posture, made checkable (NFR-01, QA-17, QA-62, QA-63)

Confirmed against the code: the tab needs no entry in `CACHED_GET_PATHS` (`'/map/hotspots'`, `'/map/recent-obs'`), none in `EBIRD_GATED_PATHS` (`/map/hotspot-region` is already there, below the cache), no Vite proxy prefix (`/taxonomy`, `/map` and `/settings` are already forwarded), no `app.security.csp` host (the tile, style and favicon hosts are derived from `lib/mapStyle.ts` and `components/SpeciesLinks.tsx`, which this feature does not edit), and no `http:allow-fetch` entry (no file is added under `lib/tauri/`).

| Table | What goes red today if this feature changed it | What this build adds |
|---|---|---|
| `CACHED_GET_PATHS`, `EBIRD_GATED_PATHS` | `transportPathSets.test.ts` checks named members and named absences, so a NEW path added to either set would leave it green | One row pinning each set's exact membership as a sorted literal, so an addition is a deliberate edit of that row (QA-62) |
| Vite proxy | `transport.test.ts` checks two prefixes are forwarded; an added prefix turns nothing red | Covered by the source scan below: with no new route there is nothing to forward |
| `app.security.csp` | `tauriCsp.test.ts` derives the hosts from `mapStyle.ts`, `MediaEmbed.tsx` and `SpeciesLinks.tsx` and pins the exact set of directive names: a host added at those call sites without a policy entry, or a new directive, is red | Nothing; the scan below proves the tab adds no host-loading call site |
| `http:allow-fetch` | `tauriHttpScope.test.ts` reads every https literal in files that import `tauriFetch`, both ways: a new service URL with no entry is red, and so is an entry no call site uses | Nothing |
| Backend routes, `lib/tauri/` | Nothing mechanical | QA reads `git diff --stat`: no file under `backend/routers/` or `frontend/src/lib/tauri/` |

**`hotspotReportsNetwork.test.ts`**, a comment-stripped source scan over `lib/hotspotReports*.ts` and `components/hotspotReports/**` (tests excluded), with a positive leg so it cannot pass on an empty file set:

- No `fetch(`, no `XMLHttpRequest`, no `navigator.sendBeacon`, no `<iframe`, no `https://` or `http://` literal, no `window.open`.
- `transport.` appears exactly once across those files: the `/taxonomy/codes` post in `HotspotReportsTab.tsx`.
- None of `getHotspotSet(`, `loadHotspotSet(`, `buildHotspotSet(`, `dedupedFetch(`, `invalidateHotspotSet(` appears; `useHotspotSet(` appears exactly once (QA-17).
- No `storage.set`, `storage.delete`, `storage.write` or `localStorage` (QA-56's static half; the component row with a seam spy is the dynamic half).

The import-graph rows (QA-10, NFR-05) go in `exoticProvenanceGraph.test.ts`: `lib/hotspotReports.ts`, `hotspotReportsPicker.ts`, `hotspotReportsLocation.ts` and `hotspotReportsProvenance.ts` each statically reach no `transport` and no `lib/tauri/*Service`; the positive leg that `HotspotReportsTab.tsx` reaches the provenance reader and the reader reaches the store; a symbol row that `buildCoverIndex` and `useExoticProvenance` appear in none of the feature's files. `hotspotReportsKind.ts` is deliberately NOT in the no-transport rows (it imports `hotspotSet.ts`); the scan above is what bounds it.

QA-63's browser run answers `/map/hotspot-region`, `/checklists/` and every other eBird-backed path inside the browser with `page.route`, counts them, and fails if anything outside the routed set reaches the preview's server, before it loops over configurations.

---

## 12. Security declaration: scans, bounds and measured costs (NFR-02, NFR-03, NFR-06)

### 12.1 Reads over user-file text this feature adds

Each is a read over an already-parsed field, each with its own bound enforced inside the function that makes it. None is a regex. One is a native search and its end bound is named.

| # | Read | Module that holds it | Input | Bound and linearity argument |
|---|---|---|---|---|
| H1 | Pass I: the index build | `lib/hotspotReports.ts` | Every observation's `submissionId`, `locationId`, `location`, `county`, `stateProvince`, `commonName`, `date`, `latitude`, `longitude` | One loop over the rows. Per row: two memoized name reads (`isNonCountableForm`, `normalizeSpeciesName`, each bounded in `speciesUtils.ts`), `dayKey` (a length gate then ten fixed positions), and at most three `Map` operations on keys of bounded length (a Location ID over 16 code units is rejected by one length read before it is hashed; a Submission ID is hashed as the parse delivered it). The record builds in H2 run once per distinct location. Then four typed-array passes of length `rows`, `L` or `S`, and one sort of `L` records. `O(rows + L log L)`, `L <= rows`. No loop is driven by a number read from a cell |
| H2 | The record's bounded fields | `lib/hotspotReports.ts` | `location`, `county`, `stateProvince` of a location's first checklist | Length reads first (200, 96, 16), then one `slice` of at most 200 code units, `placeOf` (its own scan of at most 16), the askable-shape hand loop of at most 16, `regionName` on that gated cell, and one `toLowerCase` over at most 360 code units. Once per distinct location |
| H3 | The picker order | `lib/hotspotReports.ts` | The bounded names and place labels | `L log L` `localeCompare` calls over strings of at most 200 and 114 code units. The same primitive and residual class as the Region picker's choice sort; its linearity row derives its limit from `L log L` |
| H4 | The per-keystroke filter | `lib/hotspotReportsPicker.ts` | The haystacks, against the typed query | One `String.prototype.includes` per location over a haystack bounded at 360 code units (the whole string IS the bounded cell, so the search cannot run past it) with a query cut to 100 inside the function. `O(L x 360 x 100)` in the worst case the engine's search can reach, `O(L)` haystack reads otherwise; at most 200 ordinals out. **As built the picker calls it twice per keystroke** (12.5) |
| H5 | The location's facts | `lib/hotspotReportsLocation.ts` | The selected location's rows and checklists | One copy of the location's row slice, `computeChecklists` over it (its own `Map` and `Set` work, and a `C log C` date sort), one loop over the checklists, one loop over the rows with integer-keyed `Set` and `Map` operations, and a sort of the distinct protocol LABELS (`P <= C`). **As built, that sort compares the FULL labels: the 64-character bound of H11 is applied after it, to the rows kept, so the comparisons run on text as long as the Protocol cells** (security I1; the measurement and the decision follow this table). `O(R_loc + C_loc log C_loc)` comparisons with `R_loc <= rows`, each comparison linear in the two labels it reads |
| H6 | The weather-block parse | `lib/weatherStats.ts`, `lib/weatherBlockParse.ts`, `lib/commentBlocks.ts` (existing, called from H5) | `checklistComments` of the selected location's checklists | Unchanged code at a new call site with a SUBSET of what Statistics hands it: the attribution gate, then the span finder and the field parse on block-bearing comments only, each linear in the comment by construction and measured so by `weatherStatsLinearity.test.ts`. Per selection the cost is bounded by the comment text at that one location, which is at most the comment text in the file |
| H7 | The species rule | `lib/hotspotReportsLocation.ts` | The location's species facts | `S_loc` `Set.has` reads on normalized names, one `S_loc log S_loc` sort (`compareDisplay`, the S6 class of the Life Lists schema), and the escapee facts' checklist lists |
| H8 | The ML join | `lib/hotspotReports.ts` | Every ML row's `checklistId` and `format` | One loop, one `Map.get` per row on the id as parsed. `O(mlRows)` |
| H9 | The escapee confirmation | `lib/hotspotReportsProvenance.ts` | The published names; the carriers' `submissionId` | Per published name one `Map.get`, then one `Set.has` per carrier row with an early exit. At most the published names' rows, at most `rows`; the published list is capped by its store |
| H10 | Totals and ranks | `lib/hotspotReports.ts` | The escapee names; the per-location figures | One array copy of length `L`, the escapee species' rows, then two bounded top-ten insertions over `L` whose tie-break is `localeCompare` on bounded names |
| H11 | Protocol and name display bounds | `lib/hotspotReportsLocation.ts`, `lib/hotspotReports.ts` | A Protocol cell after `protocolName`; a Location cell | A length read and one `slice` of at most 64 (or 200) code units with the surrogate check, through the one helper `boundText`. Once per location for a name, BEFORE any use of it. For a protocol label, once per row KEPT (at most ten), AFTER the merge by label and the sort of H5: the bound limits what is rendered, not what the sort and the `Map` of labels read |

**If the Designer adds a tighter DISPLAY bound for a narrow surface** (a ranked row, the picker's input value), it is a second read over the same cell and takes its own row in this table in the same change (ui.md, v1.0.38: a safety bound is not a layout budget).

**The design (`design-spec.md`, 2026-11-10) adds no read over file text, checked element by element, so the table above is unchanged and no row is owed.** No display bound was added for the location name: the closed picker input clips the 200-character bounded name natively and the report header prints it in full, so H2 and H11 stand as written. The jump row is five fixed labels. The header totals, the count sentence, "On N of M checklists here" and the column header "Of M checklists" are integers the facts already hold (`LocationSpecies.total`, `SpeciesFact.checklistCount`, `facts.checklists.length`). The share bar is a width from those same two integers. The row position is an integer assigned after the sort (4.2). The kind tag, the meta line and the ranked row's accessible name print fields of `LocationRecord` that H2 already bounds, as text. A distribution row's label is the app's own vocabulary or a protocol name bounded by H11.

**What "Show next 100" bounds, and what it does not.** The list renders `PAGE_SIZE` (100) rows at first and 100 more per press; "Show all (N)" renders every row. Rendered rows are therefore bounded by the page size only until "Show all" is pressed, and after it by the species on the location's list: a few hundred at a real place, at most the distinct countable species in the backup, and for a hand-built file whose every row is its own species at one location, as many as the rows. This is the Life Lists pager unchanged, and the Life Lists tab carries the same residual with the same control. **It changes no cost measured in 12.5:** `applySpeciesRule` builds and sorts every row whatever page is shown (`pageList` only slices), so the derivation figures already are the Show-all figures. What grows with the page is DOM, one `li` with one `<BirdName>` and one `ChecklistLink` per row, which the Engineer records at the live look for a 3,000-species location. NFR-03's "the life list by its page size" is true of the first render and of each "Show next 100", not of "Show all"; the hand-back carries that for the Planner.

**Loops driven by a number read from the file: none.** Days, years, durations and coordinates are compared or summed, never iterated. The year list is driven by the distinct years present and capped (4.4).

**The protocol sort runs on unbounded labels: measured, and not changed for this ship (security I1).** A measured difference from this declaration as first written, so it is recorded as a decision with its evidence, its reversal and its fix.

- **What the code does.** `protocolRows` in `frontend/src/lib/hotspotReportsLocation.ts` (lines 280 to 294) merges the cells by their `protocolName` label, sorts the labels by count and then `localeCompare` (line 286), and only then cuts the kept rows with `boundText(..., PROTOCOL_NAME_MAX_CHARS)` (line 291). `protocolName` returns the raw cell for any code it does not know, so a label can be as long as a Protocol cell.
- **The evidence** (the security review's measurement, through the real entry point `deriveLocationFacts`: one location, every checklist its own protocol, all counts tied so every comparison reaches `localeCompare`, labels sharing all but their last 8 characters; Node 24): 5.3, 8.3 and 14.8 ms at 1, 2 and 4 MB of label text; 25.5, 52.4 and 98.7 ms at 8, 16 and 32 MB. The bare sort in JavaScriptCore read 44, 70 and 131 ms at 8, 16 and 32 MB. Linear in the location's protocol text in both engines: **52 ms at 16 MB and 99 ms at 32 MB in Node, 131 ms at 32 MB in JavaScriptCore.** The rendered output is unchanged by it: ten named rows plus the other and blank rows, each label cut at 64.
- **The decision.** Not changed for this ship. The cost is linear, it is paid once per selection, it is bounded by the Protocol text at one location (at most the file), and an eBird export's Protocol cells are a closed set of short names. The declaration was what was incomplete, and H5 and H11 above now say where the bound applies.
- **What would reverse it.** A measured super-linear case through `deriveLocationFacts` (a quotient over doubled label text that leaves the linear band), or a live report of a slow report at a real location.
- **The exact fix, and where.** In `protocolRows`, same file and lines: call `boundText(label, PROTOCOL_NAME_MAX_CHARS)` on each merged label BEFORE the sort; sort by count descending, then the BOUNDED text by `localeCompare`, then the FULL label by code-unit comparison as the last tie-break (so two labels equal inside the bound keep a stable order); build the rows from that order. The merge stays keyed on the full label, so two cells are still one row exactly when their labels are equal. A row in `hotspotReportsLocation.test.ts` then pins that no comparison reads past the bound except on a tie inside it, and H5 and H11 return to their first wording.

### 12.2 Bounded allocation (NFR-03): every file-sized structure and its two bounds

| Structure | Sized by | First bound (content-driven) | Second bound (the content cannot inflate) |
|---|---|---|---|
| `rowLoc`, `rowSpecies`, `rowDay` | The parsed array's length | `rows` entries each | Sized from `obs.length`, an array the parse already holds, never from a cell: 12 bytes per row against an `ObservationEntry` the row already cost |
| `locRows`, `spRows` | Located rows; countable rows | At most `rows` each | The same: 8 bytes per row at most |
| `locStart`, `spStart`, `checklistCount`, `speciesBase`, `pickerOrder`, `rankOf`, `showId` | Distinct locations or species | `L + 1` or `S + 1` | `L <= checklists <= rows`; `S <= rows` |
| `locations` and their haystacks | Distinct Location IDs | One record per distinct id | At most `rows` records; each id at most 16 code units, each name at most 200, each haystack at most 360. Total haystack text is bounded by the names' own text in the file plus a constant per location |
| `ordById`, `checklistLoc`, `speciesOrd` | Distinct ids, submissions, names | One entry each | At most `rows` entries; `checklistLoc` records a rejected checklist once |
| (location, species) pairs | Nothing: no structure is sized by pairs in the index | The stamp arrays are `S` and `L` long | The pair count never becomes an allocation. In the facts, the pair `Set` holds at most the rows at one location |
| Facts: `checklists`, the two `Map`s, `species`, `checklistSpecies` | One location's checklists and species | `C_loc`, `S_loc` | Each at most the rows at that location, at most `rows` |
| Media counts | Locations | `3 x L` integers | `L <= rows` |
| Escapee set | Published names in the backup | The names | The store's own cap on the published list |

**Rendered output, bounded independently of the file:** the picker at `PICKER_OPTION_CAP` (200) options plus the overview row and one line; each ranked list at `RANKED_LIST_SIZE` (10); protocol rows at `PROTOCOL_ROWS_MAX` (10) plus the other and blank rows; months at 12; years at `REPORT_YEAR_ROWS_MAX` (100) plus one; the weather figures at the 11, 7 and 9 bands the app already has; the life list at `PAGE_SIZE` (100) rows per page until "Show all" is pressed (12.1); a name at 200 code units and a protocol name at 64.

The row count itself is bounded by the per-platform upload cap enforced at import by `uploadGuard.ts` (about 150,000 rows of ordinary width at the 50 MB platforms); iCloud pulls are deliberately unguarded, the same stated residual every row-sized structure in the app carries. **The delimiter flood**, a file of minimal rows, raises the row count toward the cap in bytes divided by a few bytes per row; every structure above then grows only with `rows`, 20 bytes per row in typed arrays, while the parse it rides on grows far faster. A flood of delimiters inside one cell is cut by the cell bounds in H2 and H11.

### 12.3 Open Question 5, closed from measurement

| Constant | Value | Ground |
|---|---|---|
| `PICKER_OPTION_CAP` | 200 | The PRD default stands. The scan is what scales with the file and it is cheap (12.5); 200 rows is a fixed amount of DOM whatever the backup holds. The Engineer records the open-list commit time at 150,000 locations in both engines at the live look |
| `LOCATION_NAME_MAX_CHARS` | 200 | The PRD default stands. At 150,000 locations whose names all sit at the bound, a keystroke measured 2.3 ms for an ordinary query and 97 ms for the engine's worst query in V8 (3.1 ms in JavaScriptCore). Halving the bound halves only that corner |
| `PROTOCOL_ROWS_MAX` | 10 | The PRD default stands. It is a render bound, not a cost bound: the protocol tally is one `Map` over the location's checklists either way |
| `PROTOCOL_NAME_MAX_CHARS` | 64 | The PRD default |
| `PICKER_QUERY_MAX_CHARS` | 100 | The PRD's figure, enforced in the function as well as the input |
| `REPORT_YEAR_ROWS_MAX` | 100 | New (4.4): no real export reaches it |

### 12.4 Rule-file `paths` the build extends, in the same change

Checked file by file against the frontmatter read on 2026-11-10.

| Rule file | Entry to add | Files it gates | Why |
|---|---|---|---|
| `.claude/rules/security.md` | `frontend/src/lib/hotspotReports*.ts` | All six lib modules and their suites | They hold H1 to H5 and H7 to H11 and every `Map` keyed on file text. No existing glob matches: `hotspotShare*.ts` and `hotspotRegionCache*.ts` do not |
| `.claude/rules/security.md` | `frontend/src/components/hotspotReports/**` | Every component of the tab | They mint ids and IDREFs over file-derived rows, render user-file text, and hold the one `transport.post`. A component's `ui.md` gate does not discharge this |
| `.claude/rules/security.md` | `frontend/src/lib/weatherBlockParse*.ts`, `frontend/src/lib/weatherStats*.ts` | Two existing files, not edited | They HOLD scan H6, which this schema declares at a new call site, and match no `security.md` glob today (`commentBlocks*.ts` does). The gate is on the module that holds the scan |
| `.claude/rules/security.md` | `frontend/src/lib/birdingStats.ts`, `frontend/src/lib/speciesUtils.ts` | Two existing files, not edited | **Added after the security review (L1).** They hold reads this schema declares, exactly as the weather modules do, and the first pass of this table missed them: `computeChecklists` (H5: the grouping by Submission ID and the `localeCompare` date sort, now called per selected location) and `normalizeSpeciesName` and `isNonCountableForm` (H1: called on every row by pass I). The rule is the gate on the module that HOLDS the scan, checked file by file, and the check is made for EVERY existing module a declared read goes through, in the same pass |
| `.claude/rules/security.md` | `frontend/src/lib/checklistMeta.ts`, `frontend/src/lib/regionNames.ts` | Two existing files, not edited | **Added after the security review (L1, its optional pair), and in the rule file as read on 2026-11-11.** `protocolName` is a table keyed by the Protocol cell, read through `Object.hasOwn` (H11's input); `regionName` reads its tables by bare key, so every caller must gate the cell, as `stateNameOf` in `lib/hotspotReports.ts` does (H2) |
| `.claude/rules/security.md` | `frontend/src/lib/hotspotSet.ts`, `frontend/src/lib/useHotspotSet.ts` | Two existing files, not edited | **Added after the security review.** They plan the `/map/hotspot-region` requests, and this tab is a new trigger of that plan (section 7.3: it may be the first surface in a session to start the shared build). Neither matched a `security.md` glob: `hotspotShare*.ts` and `hotspotRegionCache*.ts` do, and `maps.md`'s `hotspot*.ts` is a different rule file. This is CLAUDE.md's rule that a controller planning eBird requests sits inside `security.md`'s gate even when no file is added |
| `.claude/rules/bird-names.md` | `frontend/src/lib/hotspotReports*.ts`, `frontend/src/components/hotspotReports/**` | The modules applying the species rule and drawing `<BirdName>` | FR-63; the `lifeLists*.ts` and `components/lifeLists/**` precedent |
| `.claude/rules/maps.md` | `frontend/src/components/hotspotReports/HotspotReportMap*.tsx` | The map-bearing component | FR-63. Note that `maps.md`'s existing `frontend/src/lib/hotspot*.ts` glob already matches every lib module of this feature by name; that is harmless and is recorded so nobody reads it as the gate FR-63 asks for |
| `.claude/rules/ui.md` | `frontend/src/lib/hotspotReportsCopy.ts` | The copy module | The `lifeListsCopy.ts` precedent. `components/**`, `App.tsx`, `tabLayout.ts` and `globals.css` are already gated |
| `.claude/rules/weather-tide.md` | `website/tools/gen-demo-data.mjs` | The demo generator | Section 14 makes it a second writer of the weather-block text, so a formatter change must load the rule there too |
| `.claude/rules/testing.md` | Nothing | | Every new suite matches `frontend/src/**/*.test.ts(x)`; the generator's test matches `website/tools/*.test.mjs`. If the Engineer adds a JSON fixture it is named `hotspotReports*.fixture.json` and gains its own entry in the same change |

`docs-and-website.md` already gates `docs/**`, `website/**`, `HelpDocs*.tsx` and `*PublishedClaims.test.ts`.

### 12.5 Measured costs, per draw and per re-draw

Architect's scratch measurement on this Mac (Apple M1 Pro), Node 24.18, against the repo's REAL `speciesUtils`, `lifeLists`, `birdingStats`, `weatherStats`, `exoticProvenance` and `weatherFormatter` modules bundled with rolldown, CPU time unless marked, first call / best of 5. Scripts: `/private/tmp/claude-502/-Users-developer-devwork-snowraven/4ce7f458-e84c-4f85-a667-25cf1a9d5e2b/scratchpad/measure.ts`, `/private/tmp/claude-502/-Users-developer-devwork-snowraven/4ce7f458-e84c-4f85-a667-25cf1a9d5e2b/scratchpad/breakdown.ts`, `/private/tmp/claude-502/-Users-developer-devwork-snowraven/4ce7f458-e84c-4f85-a667-25cf1a9d5e2b/scratchpad/fine.mjs`, `/private/tmp/claude-502/-Users-developer-devwork-snowraven/4ce7f458-e84c-4f85-a667-25cf1a9d5e2b/scratchpad/jsc-sort.js`.

**Pass I, per draw (once per files epoch). Its re-draw cost is zero: nothing rebuilds it between epochs.**

| Input | first / best | locations, checklists, species | heap, typed arrays |
|---|---|---|---|
| Demo-shaped: 7,869 rows | 10.5 / 1.7 ms | 10, 415, 149 | +0.2 MB, +0.1 MB |
| Realistic cap: 150,000 rows, 3,000 species, 2,000 locations | 64.1 / 31.9 ms | 2,000, 21,429, 3,000 | +1.9 MB, +2.7 MB |
| Hostile: every row its own location, checklist and species | 266.3 / 225.9 ms | 150,000, 150,000, 145,945 | +60.2 MB, +2.8 MB |
| Hostile: every row its own location and checklist, 200 species | 191.3 / 174.4 ms | 150,000, 150,000, 200 | +52.8 MB, +5.1 MB |
| Hostile: one location holds every row | 71.6 / 41.5 ms | 1, 21,429, 3,000 | +1.0 MB, +2.9 MB |
| Hostile: every row its own location, 200-character names sharing a 192-character prefix | 239.1 / 228.3 ms | 150,000, 150,000, 200 | +101.0 MB, +2.3 MB |

The hostile corpora create locations in nearly sorted order, which flatters the sort; over 150,000 SHUFFLED names the order sort alone is 83.5 ms in V8 and 50.9 ms in JavaScriptCore, so the worst hostile build is about 0.3 s on this Mac. No eBird export takes those shapes: a backup at the cap holds locations in the low thousands.

**The overview, per draw and per re-draw (an index, an escapee-set or a Set change):** totals under 0.1 ms in every shape; the two ranked lists 0.7 ms at the realistic cap and 18 to 48 ms where every one of 150,000 locations ties; the kind split 0.2 ms at 2,000 locations and 20.6 ms at 150,000 (wall clock).

**H4, per keystroke (wall clock, best of 9). The list re-renders at most 201 rows per keystroke.**

| Locations | empty query | ordinary match | no match | worst query the engine's search can be given |
|---|---|---|---|---|
| 300 | 0.01 ms | 0.02 ms | 0.01 ms | 0.01 ms |
| 2,000 | under 0.01 ms | 0.04 to 0.07 ms | 0.03 ms | 0.01 ms |
| 150,000, short names | 0.15 ms | 1.8 to 4.4 ms | 1.6 ms | 0.4 ms |
| 150,000, names at the 200 bound | 0.15 ms | 2.3 to 4.2 ms | 2.3 ms | 97.0 ms in V8, 3.1 ms in JavaScriptCore |

**The figures above are for ONE call of `filterLocations`, and the picker as built makes TWO per keystroke (security I2): measured, and not changed for this ship.**

- **What the code does.** `frontend/src/components/hotspotReports/HotspotReportsPicker.tsx` calls `filterLocations` in the input's `onChange` (line 179), only to decide the active row (the overview row for a blank query, the first match, or none), and again in the render's memo for the same query (line 58), which is the window that is drawn. Each keystroke therefore walks every haystack twice.
- **The evidence.** The table's worst reading, 97.0 ms per call in V8 at 150,000 locations whose names sit at the 200 bound, becomes about 0.2 s per keystroke in the Chromium engines (Windows, Android, the web); the same case is about 6 ms in JavaScriptCore (two calls of 3.1 ms). That shape is a hand-built file and an adversarial query together. The Tester's live reading at 150,000 locations with ordinary queries, 6 to 16 ms per keystroke to commit in both engines (`decisions.md` D-23), already includes both calls and the render. At a real backup's location count (the low thousands) two calls are under 0.2 ms.
- **The decision.** Not changed for this ship. The factor is two, not a change of order; the output stays bounded at 201 rows; and the only user who can meet the 0.2 s case loaded the file that causes it.
- **What would reverse it.** A live report of typing lag in the picker, a location count in real use that makes the doubled figure perceptible (the Tester's reading doubling again would do it), or any later change that adds work to `filterLocations`.
- **The exact fix, and where.** In `HotspotReportsPicker.tsx`, remove the `filterLocations` call from `onChange` (line 179) and take the active row from the memoized window instead: `onChange` sets `active` to 0 for a blank query and to 1 otherwise, and the line that derives `act` from `win` (beside the memo at line 58) reads it as -1 when `active` is 1 or more and `win.ords.length` is 0, which is the no-match answer the removed call gave, and otherwise keeps today's clamp. One scan per keystroke, the same active row in every case; `HotspotReportsPicker.test.tsx` gains a call-count row (one `filterLocations` call per keystroke) beside its existing first-row and no-match rows.

**H5 and H6, per draw (one selection, or one epoch with a selection). Their re-draw cost is zero: a kind arrival, a keystroke and an escapee change do not re-run them.** Wall clock, best of 5.

| Location | `computeChecklists` | `computeWeatherStats` | whole derivation |
|---|---|---|---|
| Typical: 2,100 rows, 300 checklists, 1 in 9 with a block | 0.3 ms | 0.3 ms | about 1 ms |
| Heavy patch: 35,000 rows, 5,000 checklists, 1 in 9 with a block | 6.2 ms | 6.1 ms | about 20 ms |
| Heavy patch, every checklist with a block | 6.1 ms | 54.4 ms | about 75 ms |
| Hostile: one location, 150,000 rows, 21,429 checklists, every one with a block | 39.4 ms | 232.9 ms | 451.6 / 343.1 ms |
| 3,000 checklists each carrying a block inside 2,000 characters of prose | 3.3 ms | 189.0 ms | about 200 ms |

A weather block costs about 11 microseconds to gate and parse, about 63 when 2,000 characters of prose share its comment. That parse, not the roll-up, is what a selection costs at a block-heavy place.

**H7, per re-draw (an escapee change with a location selected):** species-scaled, under a millisecond at 3,000 species.

**H8, per draw (once per epoch):** 0.03 ms for the demo's 515 ML rows, 1.4 ms for 50,000, 8.7 ms for 200,000 against 150,000 checklists.

**H9, per snapshot change:** 0.04 ms at the realistic cap, 0.3 ms at the hostile shapes, against 18 to 39 ms for the shipped row pass it replaces on this tab.

**Expected in the app:** opening the tab at the realistic cap costs roughly 35 to 70 ms of main-thread CPU after the shared parse, inside the load effect and behind the loading indicator; the Life Lists region schema expected about 200 to 250 ms for that tab's own load at the same cap. A selection is about a millisecond at a typical place and tens of milliseconds at a heavily birded, block-rich one. An engine ten times slower (a Pi's browser, an older phone) sits near half a second for the load at the cap and under a second for the heaviest realistic selection.

### 12.6 Decision: the main thread, measured, with the reversal named

Pass I runs on the main thread in the load effect, as the Life Lists passes do. A worker would hold a second copy of the observations (the Statistics session's copy is about 19 MB on the reference export, by that module's own note) to save 32 to 64 ms once per epoch, and `createStatsSession` belongs to Statistics, whose lifecycle (an idle teardown, a per-request settle, a fallback to the main thread) this tab would have to share or copy. **Reversal, in order:** (1) if the Engineer measures pass I above about 150 ms first call at the realistic cap on this Mac, drop the eager haystacks and build them on the picker's first open; (2) if a selection at the every-checklist-a-block heavy patch measures above about 100 ms, give the weather summary its own memo and render it under a transition so the rest of the report paints first; (3) only then a worker, and the columns of section 2.2 are what cross: transferred buffers and a string table, never cloned records.

---

## 13. The linearity guard and the test plan

### 13.1 `hotspotReportsLinearity.test.ts` (NFR-02, QA-64, QA-65)

The `lifeListsLinearity.test.ts` procedure: `bestPerCallCpuMs` from `frontend/src/test/cpuTiming.ts`, legs interleaved, inputs built flat with `[...].join('')` before any timing, a distinct input per leg so no memo is measured, the raw quotient reported beside the asserted one, and the suite stating its own `testTimeout`.

**Legs sized for CI, not for this Mac.** CI's shared runners read about twice this Mac on the Life Lists rows at 5,000 / 50,000 (22.40 against a limit of 20, the open item from 1.0.70), because the large leg leaves the caches there. Every row here runs at **500 / 5,000**, the legs the Life Lists pass-3 row moved to, where both legs stay cache-resident. Scratch quotients on this Mac at 500 / 5,000, with the larger legs for comparison:

| Row | Shape | 500 / 5,000 | 2,000 / 20,000 | 5,000 / 50,000 | Limit at 500 / 5,000 |
|---|---|---|---|---|---|
| Pass I | every row its own location, checklist and species | 10.87 | 12.42 | 13.27 | 27.4, derived from `L log L` (the order sort) |
| Pass I | every row its own location, 200 species | 10.21 | 11.32 | 12.88 | 27.4, derived |
| Pass I | one location holds every row | 9.42 | 10.74 | 12.63 | 20 |
| Pass I | 300 locations, the realistic shape | 7.71 | 7.78 | 9.32 | 20 |
| Facts and weather | one location, every checklist with a block | 8.78 | 10.50 | 11.34 | 30.7, derived from `C log C` (the roll-up's date sort) |
| Filter | every row its own location | 10.30 | 11.77 | 16.19 | 20 |

- **Derived limits** follow security.md's v1.0.63 form, `2 x (rows ratio) x log2(large sorted count) / log2(small sorted count)`, computed in the row from the counts each leg actually sorts; a leg where the sorted count does not grow keeps the flat 20.
- **The filter row's small leg is 0.007 ms for one query, under the quotient floor of 0.05 ms.** Each timed call therefore runs the filter over a fixed list of 32 queries (match-all, an ordinary match, no match, a 100-character near miss), which lifts the small leg above the floor without changing what is measured; names sit at the 200 bound and share a prefix.
- **Further rows, same legs:** `applySpeciesRule` at 500 / 5,000 species at one location (limit derived from `S log S`); `deriveMediaCounts` at 500 / 5,000 ML rows each citing its own checklist (flat 20); `speciesTotals` plus `rankLocations` at 500 / 5,000 locations with 50 escapee species spread across them (flat 20); `confirmEscapeesIndexed` with 50 published names whose carriers grow (flat 20).
- **The three hostile shapes NFR-02 names** are the first, third and fifth rows of the table: every row its own location; one location holding every row; every checklist of one location carrying a weather block.
- **Non-vacuity, three mutants in the test file, never in the modules:** pass I with `ordById` replaced by a linear search over the records; the facts with the (species, checklist) dedupe as an array search; the ML join with `checklistLoc` as an array search. Each must exceed its row's limit at 500 / 5,000, and each runs a capped replica over 1,000 rows first, so a hang cannot sit behind the timeout.
- **Acceptance before the build ships:** each row reads at or under 0.65 of its limit on this Mac, in the file, in a bare process on Node 20, and under `NODE_OPTIONS=--max-semi-space-size=1`. A row above that shrinks its legs; no limit moves. The readings go in `pipeline/hotspot-reports/decisions.md` in the D-04 table shape.
- **QA-65's overview budget** is asserted as a quotient too (the overview over 500 and 5,000 distinct locations), never as an absolute time; the absolute figures of 12.5 are the Engineer's to re-measure and record, and the 150,000-location fixture is derived and rendered once, under the suite's stated timeout, asserting ten rows per list and at most 201 option elements.

### 13.2 Module suites

- **`hotspotReports.test.ts`**: QA-10 to QA-14, QA-20; first-row-governs in both directions (2.3); the coordinate rule (latitude 91, a non-finite value, blank on the first checklist and present on the second); the name bound including a surrogate pair straddling it; `__proto__`, `constructor`, quotes and `<script>` as ids and names; `LOCATION_ID_MAX_CHARS === HOTSPOT_ID_MAX_CHARS` (two declarations compared, never restated); the `stateName` gate with `US-constructor`; column invariants (`locStart[L]` equals the located row count, `rowLoc` agrees with `checklistLoc` for every row, file order inside each group); `speciesTotals` equals the facts' list length for every location of a mixed corpus (QA-36); the picker order equals a `localeCompare` sort of the same records as the oracle; the absence guard; the no-memo and no-module-state rows (7.1).
- **`hotspotReportsPicker.test.ts`**: QA-19, QA-22; the window rule of 3.3 at a selection inside and outside the cap; the query bound; the single-search-primitive row.
- **`hotspotReportsLocation.test.ts`**: QA-11, QA-33, QA-34, QA-37, QA-38, QA-41 to QA-53; the roll-up equals `computeChecklists(allObs)` filtered to the location's Submission IDs; the weather stats equal `computeWeatherStats` over those entries (the oracle is the shipped function over an independently filtered input); the protocol sum; the year cap with its sum preserved; time birded against `computeDurationBins`; the typical band's tie-break under `CONDITION_DISPLAY_ORDER`; the floor moved by the parameter (QA-46).
- **`hotspotReportsKind.test.ts`**: QA-15, QA-16, QA-27; the two-function table of section 5.
- **`hotspotReportsProvenance.test.ts`**: section 6's equivalence in both directions; identity of the returned Set across snapshots that do not change the names; QA-35.
- **`hotspotReportsCopy.test.ts`**: every string from the module; no U+2014 and no literal non-ASCII character in the source (the ellipsis and any other such character written as an escape, with the grep after writing that testing.md requires); American spelling; agreement rules over a corpus generated per render state by calling every exported builder at 0, 1 and 2 (NFR-11); the rule sentence names its three tabs from `TAB_LABELS` (QA-39).
- **Component suites**: QA-06 to QA-09, QA-17, QA-18, QA-21, QA-23 to QA-26, QA-28 to QA-32, QA-40, QA-54 to QA-56, QA-67, QA-69. Async rows wait for the exact observable the next assertion reads, never a sleep.
- **Parity (QA-71)**, in two halves as built. The dynamic half is `hotspotReportsSeamParity.test.ts`: one fixture arrives through the real storage seam under the Tauri and the web/Pi transports, each in its own module graph, the derivation's output is compared across the two, and each is also held to an oracle outside both. The static half is in `hotspotReportsNetwork.test.ts`: no module of the feature reads `isTauri()`, `isIOS()` or `isAndroid()`.

### 13.3 Symmetric-difference obligations, listed

1. `confirmEscapeesIndexed` against `confirmPublishedNames` (section 6): both directions, generated corpus, the failure return first.
2. `kindReason` against `hotspotShareView` (section 5): agreement everywhere except two named, tested differences.
3. `kindOf` against `computeHotspotShare` (QA-15): the shipped function is the oracle.
4. The index's roll-up against `computeChecklists`, and the weather figures against `computeWeatherStats` (13.2): the shipped functions are the oracles.

No shipped predicate is replaced in place; each new one sits beside its original and is measured against it.

### 13.4 The container thresholds as shipped: 28em and 53.25em, measured in the built app (`decisions.md` D-07)

Two thresholds in the design came from the mockup's containers (30em and 55em). They were values to re-measure, not numbers to copy (CLAUDE.md, v1.0.50; ui.md, v1.0.56), and the built app's measurement replaced both. **The tab ships 28em and 53.25em:**

| Threshold | Rule as shipped | Mockup value, replaced | Measured: the last container width at which the WIDER form still fits, at 100% / 150% / 200% text | What it decides |
|---|---|---|---|---|
| The list row's stacked form | `@container sr-hsr-ll (max-width: 28em)` | 30em | 27em / 24.75em / 23.75em. It breaks at the name cell (the bird-name link past `.sr-hsr-ll-name`) | The stacked row, with no header row and no share bar, at 28em and under |
| The report's column switch | `@container sr-hsr-report (max-width: 53.25em)` | 55em | 39.5em / 36.75em / 35.5em. It breaks at the same cell, in the stacked list of a narrow first column | One column and the jump row at 53.25em and under; two columns above |

- **How they were measured (D-07).** On the production build served by a scratch backend, in Chromium and WebKit (Playwright 1.62), at 100%, 150% and 200% text, over synthetic demo data plus a stress location at every bound: a 223-character name shown at 200 plus the ellipsis, 10,050 checklists so every count is five digits, a 79-character protocol label, and eBird's longest unbreakable common-name tokens. The probe forces each WIDER form and sweeps its container width in 0.25em steps, reading text ink (client rects over a `Range` per text node) and every control box against its grid CELL and its card's content box. Both engines agree to the hundredth in every cell of the table. The detector was shown to reject: the wide list forced to 12em reads 121.59px, 144.39px and 188.9px past its card at the three scales in both engines. A first, card-only detector that missed a name overlapping its neighbour cell was discarded (it read 19.5em and 32.75em): containment is judged per cell.
- **Why 28em.** One em above the measured break at the scale where it is widest (27em at 100%), as room for the other platforms' system fonts: the app ships no font, so 27em would have been exact on this Mac only.
- **Why 53.25em, and not just above 39.5em: the two thresholds are COUPLED.** Two columns are drawn, in the approved design, with the life list in its wide form beside the rail. The list column is the report less the 24rem rail, the 16px gap and the 2px card border, so the report must exceed 24 + 28 + 18 / 16 = 53.125em for two columns to imply a wide list, rounded up to 53.25em. Two columns over a stacked list would fit from 39.5em and is not the picture the user approved.
- **The mockup's pair failed that coupling under a classic scrollbar**, which is the case ui.md's v1.0.56 rule exists for: with 55em and 30em, a classic 15px scrollbar at a 1160px window and 100% text gave a report of 55.06em and a list of 29.94em, two columns over a stacked list, in both engines. Re-run with 53.25em and 28em: 1,032 window configurations (641 to 1500px in 10px steps, three text scales, classic and overlay scrollbars, both engines), none with two columns over a stacked list, worst ink overhang 0.02px, no page scroll. At 100% text the report goes two columns from a 1121px window with an overlay scrollbar and 1141px with a classic one.
- **Reversal (D-07).** A font measured wider on another platform at the list's bound raises 28em and, by the same sum, 53.25em, together. Neither moves alone.
- **Where the result is held.** (1) The readings and the reasoning are `decisions.md` D-07, summarized above. (2) `frontend/src/lib/hotspotReportsCss.test.ts`, a declaration-only stylesheet guard that says so in its own header, pins the two container names, that each query is a `max-width` query on its named container, and both shipped values, so a later edit of either number is a deliberate change of that row. (3) **QA-68, the live-look row, holds the geometric claim** through the real-engine probe, `verify-hotspot-reports.mjs`, which reads the thresholds from the BUILT stylesheet, sweeps the band on both sides of each in both engines and under both scrollbars, declares how many configurations it measured, and fails on any ink or box past its container.
- **Where that probe lives (`decisions.md` D-18).** It is HELD at `pipeline/hotspot-reports/held/verify-hotspot-reports.mjs`, not committed under `website/`, because every change under `website/` waits for the user's yes; on that yes it lands at `website/tools/verify/verify-hotspot-reports.mjs` with its `run.mjs` budget of 900,000 ms (four times its time on this Mac, the house rule beside the plan harnesses). Until then it is run from a scratch copy beside the shipped `serveDist.mjs`, `playwright.mjs` and `dismissWelcome.mjs`. Its run against this build's dist, hermetic (served dist, stubbed backend, every other host refused): fixed mode, 24 checks pass, 540 configurations measured against 344 window configurations declared, no window failure, 181 seconds; with both container queries neutered (`--expect-broken`), 266 of 344 window configurations fail, so the harness is known to reject a revert. The More-sheet measurement of 10.3 was taken on the built app the same way and is recorded in D-08: 616px in both engines, `min(73dvh, 616px)`.
- **`container-type` is containment as well as a query anchor** (ui.md, v1.0.23). `.sr-hsr-report` and `.sr-hsr-ll` each become a containing block for absolutely and fixed positioned descendants and a stacking context. **Checked in the built app (D-07):** the two containers hold only `.sr-only` spans, the map's own positioned controls (inside `.sr-hsr-map`, which is `position: relative`) and the `<BirdName>` fallback glyphs (inside their own `position: relative` slots); neither declares a `z-index`; the picker's listbox sits outside both.
- The same stylesheet guard carries 8.1's two resolved-cascade rows.

---

## 14. Demo data and the new frame (FR-62)

**What the generator already gives:** ten locations, all real public hotspots, seven in US-NY and three in US-NJ, so "several locations of which some share a region" holds today. **What it lacks:** any weather block.

**The change to `website/tools/gen-demo-data.mjs`:**

1. **A post-pass, not a change to the main loop.** After the checklists are generated and before the files are written (where the named-birds injection already sits), append a weather block to the Checklist Comments cell of a fixed subset of the framed location's checklists: every third one in date order, which at about forty checklists per location gives about fourteen, clear of the floor of ten with room for a figure whose own denominator is smaller. Default framed location: Jamaica Bay Wildlife Refuge (`L152773`); the Designer may name another.
2. **It draws nothing from the main seeded generator.** Block values (condition, temperature range by month, wind, cloud cover, sunrise and sunset) come from a second generator with its own seed, or from the checklist's index. So every other cell of every row, every Submission ID and every ML row is byte-identical to today's output, and a test asserts exactly that: the dataset with the post-pass disabled equals the dataset with it enabled in every column but one.
3. **The block text is the app's own format** in the form an eBird export delivers it (the formatter's lines joined by spaces, the SnowRaven attribution last), appended after any prose the checklist already has.
4. **The dataset becomes a function.** The generator's body moves into an exported pure `buildDemoData()` returning the two CSV texts, with the file writes left in a thin command-line wrapper. A vitest row then imports it, runs the text through `parseEbirdObservations`, `computeChecklists` and `computeWeatherStats`, and asserts QA-60's properties (at least two locations sharing a State/Province code; at the framed location, readable blocks at or above `WEATHER_SPECIES_MIN_CHECKLISTS`, none unreadable, and sky, temperature and wind each at or above the floor) with no dependence on the gitignored `website/tools/demo-data/` folder.
5. **No personal location is added by default.** Every demo place is a real public hotspot, and calling one personal in a published image would be false. If the Designer wants the frame to show a personal-location mark, the post-pass moves a fixed subset of checklists to one synthetic location with an id above eBird's live allocation, which adds a pin to both Map Explorer frames and a row to Statistics' top locations; that is a separate decision with its own regenerated frames.

**Existing frames this will alter** (each decided per image against its committed frame, as FR-62 already requires):

| Frame | Effect |
|---|---|
| Statistics (website light, dark and phone; App Store 02) | The export goes from no weather block to about fourteen readable ones, so the Weather section and its jump-navigation entry appear, and Data Quality's weather coverage moves. Visible wherever the frame's clip includes the navigation or those sections |
| Species Detail (website; App Store 05) | A Weather card can appear for the framed species (the export now clears the section floor): the chart at ten or more of its checklists with a block, the sentence below that |
| Weather (website; App Store 03) | The list of checklists with no weather block is shorter by the number of blocks, where the frame includes it |
| Calendar (website; App Store 04) | Only if the frame's opened day holds one of the block-bearing checklists |
| Map Explorer, Breeding Codes, Multimedia, Named Birds, Life Lists | No data change |

**The new frame's capture job** goes in `capture.mjs` and in `capture-appstore.mjs`'s `SHOTS` list (one per family). If the frame shows kinds, the job answers `/map/hotspot-region` for US-NY and US-NJ inside the browser with the ten demo ids and counts the requests; no capture sends an eBird request with a real key.

**Held, not written at this stage or in the build without the user's yes:** the regenerated `website/demo/*.csv` (tracked and published), every image under `website/assets/shots/` and `appstore/screenshots/`. The generator and capture scripts under `website/tools/` are tooling; the hand-back asks the orchestrator to confirm that reading of the `website/` approval rule before the Engineer edits them.

---

## 15. Help, held copy, version

- **`docs/HELP.md`**: the `## Hotspot Reports` section between Breeding Codes and Checklists, the tab's place in the default order (FR-59), covering FR-59's topics; the tab added at the same place in the two tab lists (lines 19 and 100). **One existing sentence is made false by a plain map:** "Copying a location works on every map in the app" (line 359). The user decided at the design review that the report's map has no corner controls, so the Engineer re-scopes that sentence to the maps that carry a share pin, at paragraph scope, in the same change. No U+2014.
- **Held copy** under `pipeline/hotspot-reports/held/`: at most one proposed sentence each for the README, the website and the App Store listing, the What's New and Fastlane changelog text, any caption, the regenerated demo files and images, and the recorded read of `PRIVACY_POLICY.md` and `ACCESSIBILITY.md` against the shipped tab. Expected outcome of that read: no privacy sentence changes (no new stored document, no registry row, no new host, no request moved between components; the Map Tiles section already describes a map requesting the tiles for the area it shows), and `ACCESSIBILITY.md`'s statements about comboboxes, live regions and map controls are checked against the picker and the map as built.
- **Version**: 1.0.70 to 1.0.71, read off `main` at ship time. The six-file set: `frontend/package.json`; `src-tauri/tauri.conf.json` (`version`, `bundle.android.versionCode = 1000071`); `CHANGELOG.md`; `website/index.html` (the `version-pill` text and its `aria-label`, and the `footer-version` line); the three Fastlane changelogs `10000711.txt`, `10000712.txt`, `10000714.txt` (after the user's yes, present at the tag); `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` (`CurrentVersion: 1.0.71`, `CurrentVersionCode: 10000714`, the three per-ABI `Builds` entries). Then the all-platforms rhythm through the `snowraven-release` skill.

---

## 16. Build order for the Engineer

No data migration: no stored document changes shape and nothing is written.

1. **`lib/lifeLists.ts`**: the type-only widening of `compareDisplay`. Run `lifeLists.test.ts` and `lifeListsLinearity.test.ts` unchanged. Own commit. **Then the distribution row (8.1):** one commit that captures the Statistics Weather section's markup golden and touches nothing else, then the extraction to `components/WeatherDistRow.tsx` in a commit of its own.
2. **`lib/hotspotReports.ts` and its suite**, the absence guard first.
3. **`lib/hotspotReportsLocation.ts`, `hotspotReportsPicker.ts`, `hotspotReportsKind.ts`, `hotspotReportsProvenance.ts`** and their suites.
4. **`hotspotReportsLinearity.test.ts`**; record the quotients and the 12.5 re-measurement in `decisions.md`.
5. **Rule-file `paths`** (12.4), in the same change as the files they gate.
6. **The registry** (10.1 rows 1 to 3) and `tabLayout.test.ts`.
7. **`lib/hotspotReportsCopy.ts`** and the components, to the Designer's spec within sections 3.4, 7 and 9.
8. **The rosters and guards** of 10.1 rows 4 to 11, sections 9 and 11.
9. **The More sheet** (10.3): measure the built app in WebKit and Chromium, set both terms of the cap, rewrite the `TabNav.test.tsx` row as the property, and record the measurement in `decisions.md`. **The container thresholds** (13.4) are measured in the same session and recorded beside it.
10. **`docs/HELP.md`**, the TOC, the published-claims guards, and the held copy.
11. **The demo generator and capture jobs** (section 14), once the orchestrator confirms the tooling reading.
12. Full vitest suite, `npm run build`, `eslint`; grep every changed file for a literal U+2014 and any literal control or non-ASCII character an editing tool may have substituted for an escape.
13. **The live look** at the built app in Chromium and WebKit for the rows the PRD marks, with eBird-backed paths answered in the browser.

---

## 17. Open questions closed here

- **Open Question 5** (the rendered-option cap, the name bound, the protocol-row cap): 200, 200 and 10, the PRD's defaults, each confirmed by measurement (12.3).
- **Open Questions 1 to 4 were decided by the user at the design review (2026-11-10).** The tab sits between Breeding Codes and Checklists (10.2). The weather floor is 10, the shipped `WEATHER_SPECIES_MIN_CHECKLISTS`, still read through a defaulted parameter (4.7). The known figures are shown with the reason sentence, and no hotspot or personal split is drawn when nothing at all is classified (section 5). The report's map has no corner controls, which makes one Help sentence false, and section 15 says which.
- **Open Questions 6 and 7 keep their defaults:** the wordings are the Designer's, and the typical value is a band index with the tie-break of 4.7.

---

## 18. Design decisions

1. **Frontend Only.** Nothing is persisted (FR-58). Reversal: remembering the selection is one settings key through the `storage` seam with a validator, the `lifeListsRegion` shape, and would make the path Incremental.
2. **The index is columns and compressed row lists, built once per epoch, held by the tab's ready phase** (2.1, 7.1). Declined: per-location Maps (no cheaper, no carrier lists, an object per pair) and a module memo (a holder with one consumer). Reversal: none expected; the hostile heap figure is the price of 150,000 location records, not of the columns.
3. **The report is facts plus a rule** (section 4), so an escapee change never re-parses weather. Reversal: if the split's bookkeeping proves heavier than a full re-derivation on a measured heavy patch, fold `applySpeciesRule` back in; the content-stable escapee Set (section 6) already makes a re-derivation rare.
4. **The escapee set is confirmed from an index, proven equal to the shipped row pass** (section 6). Reversal: if the Planner prefers the literal function over NFR-05, the hook becomes `lifeListsClassification(snapshot, observations).escapees` behind the same content-stable key, at 18 to 39 ms per snapshot at the cap.
5. **`localeCompare`, not one `Intl.Collator`,** for the picker order and the rank tie-breaks: faster in both shipped engines on these names, and the Region picker's own form.
6. **The picker window slides to the selection only on an empty query** (3.3).
7. **`computeChecklists` and `computeWeatherStats` are called as they are, on the location's rows** (section 8). Declined: a hand roll-up that skips their unused fields, which would save a few milliseconds at a heavy patch and lose the literal equality QA-44 asks for.
8. **`kindReason` and `weatherView` are new functions beside the shipped discriminators, never new parameters on them** (sections 5, 4.7).
9. **Main thread, measured, with three reversal steps before a worker** (12.6).
10. **Legs at 500 / 5,000 with limits derived where a sort grows** (13.1), sized against the 1.0.70 CI readings.
11. **The map is its own lazy component, one instance re-centered by `jumpTo`, no chart library on the tab's graph** (section 9).
12. **A rendered-years bound the PRD did not list** (4.4).
13. **The module name `hotspotReports*`** gives one glob per rule file. It also falls under `maps.md`'s existing `hotspot*.ts` glob, noted in 12.4.
14. **The distribution row is extracted, not exported in place and not re-rendered** (8.1), on the `WeatherSpeciesRow` precedent. Declined: an export from `WeatherStatsSection.tsx` (the whole section on this tab's graph) and a second row component (two implementations of three states). Reversal: none expected; if a third defaulted prop is ever wanted, the row has become two rows and is split then.
15. **A custom saved order gets the new tab last, wherever its default position is** (10.2). The missing-tab append is position-blind, as it was for Life Lists. Reversal: inserting at the default position inside a custom order would be a new rule in `parseLayout` with its own table of what it changes for every saved order; nobody has asked for it.
16. **The More-sheet cap is two measured terms held by a property test** (10.3).

---

## 19. Amendments after the design review (2026-11-10)

A scoped errand, not a stage re-run. Only what is listed moved.

| # | Direction or question | Source | Where it is settled |
|---|---|---|---|
| 1 | The tab sits between Breeding Codes and Checklists | The user; `decisions.md` D-03 | 10.1 rows 1, 4 and 5; 10.2 (both orders, every saved-order reading, the test rows); section 15 |
| 2 | The More sheet holds thirteen tabs without scrolling | The user | 10.3 (decided; both terms measured in the built app; the test row a property; the measurement recorded) |
| 3 | The map has no corner controls | The user | Section 15 (the Help sentence at line 359 is re-scoped in the build); section 9 unchanged |
| 4 | The weather floor is 10 | The user | 4.7, section 17 |
| 5 | No hotspot or personal split when nothing is classified | The user; D-01, D-02 | Section 5 (`kindSplitDrawn`) |
| 6 | `DistRow` and `DistGroup` on a further surface | The Designer, D-02 | 8.1: `DistRow` extracted to `components/WeatherDistRow.tsx` with two defaulted props; `DistGroup` stays private |
| 7 | The summed years row is labeled "Before {first shown year}" | The Designer, D-02 | 4.4: the `earlier` row now carries `before`, the first shown year |
| 8 | The 55em and 30em container thresholds | The Designer, D-01 | 13.4: re-measured in the built app under a classic scrollbar; held by `hotspotReportsCss.test.ts` and QA-68's probe |
| 9 | Whether the design adds a read over file text | The coordinator | 12.1: none; the declared reads are unchanged. The rendered life-list bound under "Show all" is stated there and in 12.2 |
| 10 | The life-list row's position ("N of M") | `design-spec.md` | 4.2: `LocationLifeRow.position` |
| 11 | The tab glyph | The Designer, D-01 | 10.1 row 2: lucide `MapPinned` |

**After the build, the QA report and the security review (2026-11-11).** A second scoped errand. Only what is listed moved; no measurement was re-taken by the Architect, and the figures in rows 14 and 15 are the Auditor's and the Tester's.

| # | Direction or finding | Source | Where it is settled |
|---|---|---|---|
| 12 | The shapes as built: `ProtocolRow.truncated`, `LocationSpecies.biggest.day`, `LocationFacts.checklistDay` and `checklistMinute`, and the exported `boundText` | The Engineer, D-12 | 2.2, 4.1, 4.2 and 4.3, each field with what it is for |
| 13 | Existing modules that hold declared reads, or plan the eBird requests this tab can trigger, were outside `security.md`'s gate | Security L1 | 12.4: `birdingStats.ts`, `speciesUtils.ts`, `checklistMeta.ts`, `regionNames.ts`, `hotspotSet.ts`, `useHotspotSet.ts` |
| 14 | The protocol sort compares full labels before the 64-character cut | Security I1 | 12.1 (H5, H11 and the decision under the table) and 4.3: declared with the measured figures; not changed for this ship; the reversal and the exact fix are stated |
| 15 | The picker filters twice per keystroke | Security I2; D-23 | 12.1 (H4) and 12.5: the factor of two recorded with the evidence; not changed for this ship; the reversal and the exact fix are stated |
| 16 | `kindOf` tests the region code first, then the Set | The Engineer, D-04; FR-15 and FR-16 as amended | Section 5: the built order, why it is the oracle's order, and that no real export reaches the difference |
| 17 | Namesakes are joined by `localeCompare === 0` | The Engineer, D-11 | 2.3 (`showId`) |
| 18 | The codes batch records each name as asked once per files epoch, answered or not, and drops an answer that lands after an epoch change | The Engineer, D-13 | 7.5, rewritten as built |
| 19 | The askable-shape gate's exact alphabet and length bound | The built code (`isCodeShape`) | 2.4: `A` to `Z`, `0` to `9` and the hyphen; 1 to 16 code units |
| 20 | The picker memo's dependency list | The built code | 3.4: `[index, open, query, selectedOrd]`, a closed list reading the empty query |
| 21 | The thresholds shipped at 28em and 53.25em | The Engineer, D-07 | 13.4: the shipped rules, the measured readings beside them, the coupling between the two, and the reversal |
| 22 | The real-engine probe is held, not committed under `website/` | The Engineer, D-18 | 13.4 and the Modified list: held at `pipeline/hotspot-reports/held/` until the user's yes, then `website/tools/verify/` |
| 23 | The suite list | The files on disk, read 2026-11-11 | The Added list and 13.2: `hotspotReportsSeamParity.test.ts`, `WeatherDistRow.golden.test.tsx` and its fixture, the shared row builders, and the two further existing suites the build edited |
