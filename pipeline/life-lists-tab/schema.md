# Schema: Life Lists Tab

**Feature:** life-lists-tab
**Date:** 2026-11-06
**Stage:** 3, The Architect (hands-off: the path is declared here and proceeded on)
**Source:** strategic-brief.md, prd.md (41 FRs, 9 NFRs, 53 QA rows, 6 open questions decided on their defaults), design-spec.md revision 1 and decisions.md D-10 to D-13 (cascaded 2026-11-06: the Planner is adding FR-42 to FR-44 and QA-54 to QA-56 and amending FR-39 and QA-41 in parallel; this schema uses those IDs)
**Extends:** `pipeline/targets-tab/schema.md` (the tab roster and the one-generation default-order migration), `pipeline/escapee-count-toggle/` and `pipeline/clear-means-clear/` (the provenance store, its passive readers and its purge row), `pipeline/large-file-and-memory-handling/` (the parse caches and the measured per-row costs)
**Ships as:** one patch bump across the six-file set (section 11). `main` is at 1.0.61, so this ships as 1.0.62 unless another ship lands first; the Deployer reads the number off `main` at ship time, never off this document.

## Path

Incremental (extending the existing data layer: one stored derived document gains a field, the tab roster gains a tab, and a new pure derivation module is added over the two parsed files).

## Architect assessment

> **Architect assessment: Incremental**
>
> SnowRaven has no database. Its data layer is the set of documents under `AppLocalData/data/` (mirrored by the web/Pi backend), the epoch modules that announce a change to them, the durable caches keyed through the `storage` seam, and the pure `lib/` modules that derive what the UI shows. This feature is almost entirely a pure derivation over the two parsed files and the provenance record Statistics already caches, which on its own would be Frontend Only. It is not, because FR-16, FR-17 and OQ-2 have the Statistics pass PUBLISH a second name list into the stored `exotic-provenance-v1` document (`frontend/src/lib/exoticProvenanceCache.ts`, a durable store keyed on user-file content with a clear-registry row). A new field on a stored, validated, purged document is a data-layer change, so the path is Incremental. Proceeding on this assessment per the hands-off run.

Three findings from reading the code change what the PRD assumed, and each is settled below rather than deferred: `loadMLExport()` resolves `null` for BOTH "no export saved" and "export unreadable", so FR-27's two sentences are told apart by `getFilesStatus().ml`, not by the cache (section 5.2); QA-15's "reaches neither `buildCoverIndex`" cannot be a module-graph assertion, because the passive model module that exports `buildCoverIndex` is the same module that exports the confirmation the tab must use, so it is a symbol-level scan beside the module-level walk (section 3.6); and `frontend/src/lib/exoticProvenance.ts`, which this feature must edit, is one of the two source files the repo records as binary to git (a literal U+0000 at line 160), so the Engineer repairs that first, in its own commit, or the feature's diff to that file is invisible to review (section 3.7).

---

## Existing data model used by this feature (unchanged unless named in section 3)

| Existing structure | Where | How this feature uses it |
|---|---|---|
| `data/metadata.json` + `data/ebird-backup.csv` + `data/ml-export.csv` | `storage.getFilesStatus()` (`FilesStatus { ebird, ml }`), `loadEbirdObservations()` (`lib/observationsCache.ts:164`, returns `LoadedEbird { headerLine, observations: ObservationEntry[] }` or `null`), `loadMLExport()` (`lib/mlExportCache.ts:25`, returns `MLExportResult { entries, mediaMap, rows: MLExportRow[] }` or `null`; cannot reject) | Read only, through the shared caches, concurrently, exactly as `components/Checklists.tsx:424-450` does. A rejected `getFilesStatus()` is UNKNOWN (load-error state); `{ ebird: null }` is the setup state |
| `ObservationEntry` (`types.ts:63-87`) | `commonName` (raw), `date` (`YYYY-MM-DD` as exported), `time?` (`"H:MM AM"` / `"HH:MM PM"` as exported, `null` when blank; `parseEbirdObservations.ts:186` trims and nulls it), `submissionId`, `location`, `county`, `stateProvince` (`"US-MN"`) | The first-sighting pass (section 2.2) reads these six parsed fields and nothing else |
| `MLExportRow` (`lib/parseMLExport.ts:4-32`) | `commonName` (already normalized by the ML parser's classify-then-`truncateAtFirstParen` contract, bird-names.md), `format: 'Photo' \| 'Audio' \| 'Video'`, `date`, `time` (`"HMM"` / `"HHMM"` 24-hour, `''` when blank), `catalogId`, `checklistId` (`''` when absent), `location` (Locality), `county` | The first-asset pass (section 2.3) reads these eight parsed fields |
| `normalizeSpeciesName`, `isNonCountableForm` | `lib/speciesUtils.ts` | The countable fold (FR-10): `isNonCountableForm(raw)` then `normalizeSpeciesName(raw)`, the house pair and order (bird-names.md). Both are linear scans with an admission-controlled memo |
| `parseMlHour` and `dayNumber` | `lib/mediaStats.ts:210-232` | PRECEDENT for the two bounded parses, not reused: `dayNumber` is module-private and returns a UTC day number (this feature needs a comparable day key, not an epoch day), and `parseMlHour` drops the minute. Section 7 declares this feature's own two parsers, which keep `dayNumber`'s range check (month 1 to 12, day 1 to 31) |
| `exotic-provenance-v1` (`lib/exoticProvenanceCache.ts`: `ProvenanceStore`, `sanitizeStore`, `rebuildSnapshot`, `scheduleWrite`, `publishExcludedNames`, `purgeProvenanceStore`) | A settings-document durable store, FIFO ledger plus admission-controlled species index, 250 ms debounced best-effort whole-document write, `Object.hasOwn` reads throughout, purge generation | MODIFIED: gains one optional field (section 3). Same key, same `version: 1` |
| `ProvenanceSnapshot`, `EMPTY_SNAPSHOT`, `classifySpecies`, `buildProvenanceLookup`, `confirmExcludedNames`, `seenToken` / `categoryOfToken` (`lib/exoticProvenance.ts`) | The pure model; no I/O, no clock | MODIFIED: the snapshot and the lookup gain the exotic list; the confirmation is generalized (section 3) |
| `useProvenanceLookup` (`lib/useProvenanceLookup.ts`) and `useExoticProvenance` (`lib/useExoticProvenance.ts`, the ONE controller, the ONE publisher at `:207-213`) | `useSyncExternalStore(subscribe, getSnapshot)` + `loadSnapshot()` once + `useMemo(confirm)` | The tab gets a hook of the same shape that returns both sets plus the two status booleans (section 3.5). The controller's publish effect publishes both lists in one call (section 3.3). The tab NEVER imports `useExoticProvenance` |
| `lib/clearDerived.ts` row `{ store: 'exotic-provenance-v1', purge: purgeProvenanceStore }` (`:76-77`); `lib/cacheInventory.test.ts:135` pairing | The clear registry | UNCHANGED and sufficient: the purge deletes the whole document, so the new field is covered by the existing row (section 3.4). No new row, no new store |
| `lib/settingsRouteBudget.test.ts:155-231` | Builds the provenance store's worst case through `sanitizeStore` and holds it under `_MAX_BYTES` (16 MiB) | Gains the new list in its worst-case document (section 3.2, with the arithmetic) |
| `exoticProvenanceGraph.test.ts` | Walks the passive readers' static closure for `transport` / `lib/tauri/*Service` / the controller | Gains the Life Lists roots (section 3.6) |
| `tabLayout.ts` (`ConfigurableTab`, `DEFAULT_TAB_ORDER`, `PREVIOUS_DEFAULT_TAB_ORDER`, `TAB_LABELS`, `parseLayout` with `appendMissing`), `tabIcons.tsx` (`TAB_ICONS: Record<Tab, TabIcon>`), `App.tsx` (`DEFERRED_TABS:139`, lazy thunks `:63-96`, panel blocks `:1462+`, `filesVersion = useFilesEpoch()` at `:206`, `dateFormatVersion` at `:215`) | The roster | Section 4 |
| `lib/useFilesEpoch.ts` (`useFilesEpoch()`), `lib/filesChanged.ts` | The two-data-file change signal, bumped by every save, replace, remove, delete-all and iCloud clear | The tab's load effect dependency (section 5.1). No new epoch module |
| `lib/weatherBacklog.ts` `PAGE_SIZE = 100`, `pageBacklog(all, shown)` returning `{ visible, total, hasMore, nextCount }`; `components/WeatherBacklog.tsx:405, 442, 561-580` (`shown` state reset to `PAGE_SIZE` on a selection change; two `Button`s "Show next 100" and "Show all (N)") | The long-list pattern | Reused through a generic helper (section 6.2) |
| `components/SetupRequired.tsx`, `components/setupCopy.tsx` (`EBIRD_BACKUP_STEPS`, `EBIRD_BACKUP_LOAD_ERROR`), `components/ui/TabLoadErrorAlert.tsx` | The shared setup and load-error surfaces | FR-05, FR-06, FR-07, byte-for-byte the Checklists shape |
| `components/ui/Button.tsx`, `components/ui/Link.tsx`, `components/ui/ToggleSwitch.tsx` (`label`, `checked`, `onChange`, `disabled`, `describedBy`, `ariaDisabled`), `components/ChecklistLink.tsx` (gated on `SUBMISSION_ID_RE` inside), `components/BirdName.tsx` (`commonName`, `hasEntry`, `onOpenSpecies`) | The primitives every control and link renders through | Sections 5 and 6 |
| `lib/formatDate.ts` `formatDate(value)` reading the module-level preference; `App.tsx`'s `data-date-fmt-version` re-render | Date display | Rows call `formatDate(row.date)` at render; no `React.memo` on a row component, or the preference change stops reaching it (section 6.3) |
| `frontend/src/test/cpuTiming.ts` (`bestPerCallCpuMs`) | The same-run CPU-time quotient helper | The linearity guard (section 8) |
| `transport.post('/taxonomy/codes', { species })` (`lib/transport.ts:251-256` routes it to the local `lib/tauri/taxonomyService.ts` `getTaxonomyCodes` on Tauri, `WebTransport.post` to the backend's bundled taxonomy on web/Pi; the caching wrapper's `post` at `:344-346` passes every POST straight through, and the path is in neither `CACHED_GET_PATHS` (GET-only) nor `EBIRD_GATED_PATHS`), `withNormalizedParents` (`lib/speciesUtils.ts:294`), `components/Checklists.tsx:460-474` and `:522` (`codeFor`) | The Checklists-shaped taxon-code batch | ONE post per roster name set (section 5.4, D-11). `transport.ts` is unchanged; the caller owns the once-per-roster discipline because the transport has no enforcement point for this path, and this schema invents none |
| `ObservationEntry.scientificName` (`parseEbirdObservations.ts:142`, the `Scientific Name` cell trimmed, `''` when the column is absent) | | The binomial on each first-sighting record (section 2.2, S8 in section 7). Never from the ML export |

---

## Changes in this feature

### Added

1. **`frontend/src/lib/lifeLists.ts`**: the pure derivation (three passes, one comparator family, the row shape) (section 2).
2. **`frontend/src/lib/lifeListsCopy.ts`**: every sentence and label the tab renders, generated from one ordered media-format manifest (section 6.4).
3. **`frontend/src/lib/lifeListsProvenance.ts`**: the tab's passive provenance hook and the ledger-coverage predicate (section 3.5).
4. **`frontend/src/lib/pageList.ts`**: the generic 100-row paging helper, extracted from `weatherBacklog.ts` (section 6.2).
5. **`frontend/src/components/lifeLists/LifeListsTab.tsx`**, **`LifeListsControls.tsx`**, **`LifeListsRows.tsx`**: the tab, lazy-loaded (section 4.3). Names chosen so no new file is `LifeList.tsx` or `LifeListTable.tsx` (FR-04) and no new file differs from either by one letter.
6. **The `exoticNames` field** on the stored `exotic-provenance-v1` document and on `ProvenanceSnapshot` (section 3).
7. **The exotic classification** in `lib/exoticProvenance.ts`: `isExoticToken`, `isExoticOnly`, `ProvenanceLookup.exoticNames`, `confirmPublishedNames` (section 3.1).
8. **The tab roster entry** `'life-lists'` (section 4).
9. **Tests**: `lib/lifeLists.test.ts`, `lib/lifeListsCopy.test.ts`, `lib/lifeListsLinearity.test.ts`, `lib/lifeListsProvenance.test.ts`, `lib/pageList.test.ts`, `components/lifeLists/LifeListsTab.test.tsx`, plus the rows owed in existing rosters (section 9).
10. **`docs/HELP.md` "## Life Lists"** directly after "## Checklists", and the Getting Started and Default Files tab lists naming Life Lists (section 10).
11. **`pipeline/life-lists-tab/held-copy.md`**: the held README, website and App Store proposals (section 10).

### Modified

1. `lib/exoticProvenanceCache.ts`: `ProvenanceStore.exoticNames: string[] | null`, admitted by `sanitizeStore` under the existing name bounds, copied by `rebuildSnapshot` and `scheduleWrite`, written by `publishClassifiedNames` (which replaces `publishExcludedNames`). Key suffix and `version` UNCHANGED (section 3.2, the decision).
2. `lib/exoticProvenance.ts`: `ProvenanceSnapshot.exoticNames`, `EMPTY_SNAPSHOT`, `ProvenanceLookup.exoticNames`, `EMPTY_LOOKUP`, `buildProvenanceLookup`, `confirmExcludedNames` delegating to `confirmPublishedNames`; and the one-byte NUL repair at line 160 (section 3.7).
3. `lib/useExoticProvenance.ts:207-213`: the publish effect calls `publishClassifiedNames` with both lists. Nothing else in the controller changes: no request, no cache, no status line, no UI (FR-17).
4. `lib/tabLayout.ts`, `lib/tabIcons.tsx`, `App.tsx`, `components/HelpDocs.tsx` (TOC entry): the roster (section 4).
5. `lib/weatherBacklog.ts`: `pageBacklog` becomes a one-line delegate to `pageList` (section 6.2); its outputs are byte-identical and its tests do not change.
6. `lib/settingsRouteBudget.test.ts`, `lib/exoticProvenanceCache.test.ts`, `lib/clearDerived.test.ts`, `lib/exoticProvenanceGraph.test.ts`, `lib/tabLayout.test.ts`, `components/TabNav.test.tsx`, `components/TabLoadErrorAlert.test.tsx`, `components/honestLoadFailures.test.tsx`, `lib/helpToc.test.ts`: the rows named in sections 3 and 9.
7. Rule files: the `paths` extensions in section 9.

### Unchanged (used, not modified)

`observationsCache.ts`, `mlExportCache.ts`, `parseEbirdObservations.ts`, `parseMLExport.ts`, `speciesUtils.ts`, `mediaStats.ts`, `useProvenanceLookup.ts`, `clearDerived.ts`, `cacheInventory.test.ts`, `storage.ts`, `filesChanged.ts`, `useFilesEpoch.ts`, `formatDate.ts`, `checklistId.ts`, `ChecklistLink.tsx`, `BirdName.tsx`, `SetupRequired.tsx`, `setupCopy.tsx`, `TabLoadErrorAlert.tsx`, `ToggleSwitch.tsx`, `Button.tsx`, `Link.tsx`, `LifeList.tsx`, `LifeListTable.tsx`, the `life-list` label, `BirdingStats.tsx`, `transport.ts` (the codes post uses its existing route, section 5.4), `SpeciesLinks.tsx`, `speciesUtils.ts`'s `withNormalizedParents`, every backend file, every `lib/tauri/` service, `src-tauri/**`, `PRIVACY_POLICY.md`. No new route, no Vite proxy entry, no CSP entry, no http permit entry, no `docChains` key, no `clearDerived.ts` row, no epoch module, no `uploadGuard` change.

---

## 1. Data flow, stated once

```
storage.getFilesStatus()          -> { ebird, ml }        (setup / none / unreadable decisions)
loadEbirdObservations()           -> ObservationEntry[]   (shared cache, off-thread parse)
loadMLExport()                    -> MLExportRow[] | null (shared cache, optional)
getSnapshot() via useSyncExternalStore -> ProvenanceSnapshot (passive, storage seam only)

pass 1  deriveFirstSightings(observations)        O(rows)      -> Map<norm, FirstSighting>
pass 2  deriveFirstAssets(mlRows)                 O(mlRows)    -> Map<norm, FirstAssets>
confirm useLifeListsProvenance(observations)      O(rows)      -> { escapees, exotics, exoticsPublished, ledgerCoversExport }
pass 3  selectRows(firsts, assets, provenance, controls)  O(S log S), S = species -> LifeListRow[] (position assigned after the sort)
codes   transport.post('/taxonomy/codes', { species })   ONE per roster name set -> codeFor(name)   (D-11; the only request the tab makes)
paging  pageList(rows, shown)                     O(shown)
```

Passes 1 and 2 run once per files epoch, inside the load effect after the awaited loads, and their results are held in component state. Pass 3 runs in a `useMemo` keyed on the two maps, the provenance result and the control state. The codes batch runs in its own effect keyed on the roster's name set (section 5.4); it never blocks, re-orders or re-derives the list. Nothing runs in a render body that constructs a `Date` or scans a row (NFR-02); nothing is retained in module scope (NFR-03): a new epoch replaces the state and the previous maps become garbage.

**The request statement, in the amended FR-39 form (D-11):** the tab makes exactly one `/taxonomy/codes` post per derivation and no other request: no third-party request, no new endpoint or host, no request moved between components, no hotspot-set load, no provenance request. That post is a call to the user's own server on web/Pi and a local function in every Tauri app, the same call Checklists, Statistics and Species Detail already make, so it stays inside the brief's durable no-network form. On web/Pi the HTTP the tab causes is therefore the two stored-file reads, the lazy chunk, and this one post.

---

## 2. The derivation module: `frontend/src/lib/lifeLists.ts`

Pure, no I/O, no clock, no React, no network import of any kind. Imports exactly `normalizeSpeciesName`, `isNonCountableForm` from `./speciesUtils` and the two row types. Test file: `frontend/src/lib/lifeLists.test.ts`.

### 2.1 Shapes

```ts
export type MediaFormat = MLExportRow['format']            // 'Photo' | 'Audio' | 'Video'
export const MEDIA_FORMATS: readonly MediaFormat[] = ['Photo', 'Audio', 'Video']   // the one ordered manifest; copy generates from it (6.4)

/** A comparable instant inside one day. `day` is YYYYMMDD as an integer (20190502),
 *  comparable with `<`; `minute` is 0..1439, or null when the time is blank or unparseable. */
export interface Instant { readonly day: number; readonly minute: number | null }

export interface FirstSighting extends Instant {
  readonly name: string            // normalized common name (the Map key, repeated for the row)
  readonly scientificName: string  // the binomial from THIS observation's Scientific Name cell (section 2.7), '' when blank; never from the ML export (FR-43)
  readonly submissionId: string    // '' never: FR-10 rows with no id are skipped (they cannot carry a checklist)
  readonly location: string        // ObservationEntry.location, verbatim
  readonly place: string           // "County, ST" | "County" | "ST" | '' (section 2.5)
}

/** FR-44: which formats the species has a dated first asset in. Derived from `FirstAssets` presence, no new pass. */
export interface MediaPresence { readonly photo: boolean; readonly audio: boolean; readonly video: boolean }

export interface FirstAsset extends Instant {
  readonly catalogId: string
  readonly checklistId: string     // '' when the ML row carries none
  readonly location: string        // MLExportRow.location (Locality)
  readonly place: string           // MLExportRow.county ?? '' (no state column in the ML export)
}

/** At most one record per species per format (NFR-03). Absent key = no dated asset of that format. */
export type FirstAssets = Readonly<Partial<Record<MediaFormat, FirstAsset>>>

export interface LifeListRow extends Instant {
  readonly name: string
  readonly scientificName: string  // from the first-sighting record, whatever the media selection (FR-43)
  readonly position: number        // FR-42: 1-based from the OLDEST row of the current selection; the newest row carries rows.length (section 2.4 step 5)
  readonly media: MediaPresence    // FR-44: identical whatever the selection; it reports what the species has, not what is selected
  readonly time: string | null     // display form "7:05 AM", or null (the row renders a dash)
  readonly checklistId: string     // '' or an unvalidated id; ChecklistLink applies the shape gate at render
  readonly location: string
  readonly place: string
}

export interface LifeListControls {
  readonly includeEscapees: boolean
  readonly includeExotics: boolean
  readonly formats: ReadonlySet<MediaFormat>
}

export interface LifeListClassification {
  readonly escapees: ReadonlySet<string>   // confirmed escapee-only names (3.5)
  readonly exotics: ReadonlySet<string>    // confirmed exotic-only names (3.5)
}
```

### 2.2 Pass 1: `deriveFirstSightings(obs: readonly ObservationEntry[]): Map<string, FirstSighting>`

One `for` loop over `obs`. Per row, in this order so the cheapest rejection runs first:

1. `const day = dayKey(o.date)`; `null` skips the row (FR-12: an undated row establishes nothing).
2. `if (!o.submissionId) continue` (a row with no id is not a sighting the tab can show; the exporter always writes one).
3. `if (isNonCountableForm(o.commonName)) continue` (FR-10, raw name).
4. `const name = normalizeSpeciesName(o.commonName)`.
5. `const minute = minuteOf12h(o.time)`.
6. `const cur = map.get(name)`; replace when `cur === undefined` or `compareFirst({ day, minute }, o.submissionId, cur) < 0`. The replacing record carries `scientificName: binomialOf(o.scientificName)` (section 2.7), so the binomial is always the one on the first-sighting observation itself, computed only when a record is written (at most once per row, usually once per species).

`compareFirst(a: Instant, aSub: string, b: Instant, bSub: string): number` is day ascending, then timed before blank, then minute ascending, then `aSub < bSub ? -1 : aSub > bSub ? 1 : 0` (plain code-unit comparison; eBird ids are `S` plus digits of varying length, so this is a stable tiebreak, not a numeric one, and the test says so). The Map is keyed by the normalized name; `Map` has no prototype keys, so a `__proto__` name is an ordinary key (security.md, the v1.0.22 family).

Output holds one record per species (NFR-03, QA-46). Nothing from `obs` is copied except the strings the row needs (name, submission id, location, county, state, and the binomial), the first five being the parser's own string instances (no slicing of a long parent string, testing.md v1.0.13) and the binomial a fresh bounded copy (S8).

### 2.3 Pass 2: `deriveFirstAssets(rows: readonly MLExportRow[]): Map<string, FirstAssets>`

One `for` loop over `rows`. Per row: `dayKey(row.date)` (null skips, FR-22), `minuteOfMlClock(row.time)`, `const name = row.commonName` (already normalized by the ML parser; no second normalization, and the test pins that the parser's output equals `normalizeSpeciesName` of its input over the fixture so the join key agrees with pass 1), then replace the slot `assets[row.format]` when absent or when `compareFirst(candidate, row.catalogId, cur, cur.catalogId) < 0` (date, then time blank-last, then catalog id as the stable tiebreak; `catalogId` compared as a string the same way). The inner record is a fresh object per species with at most three slots, built as `Object.create(null)`-free plain object because its keys are the closed `MediaFormat` union, never a file string.

No join to `obs` happens here (FR-23's narrowing happens in pass 3), so a species present in the ML export and absent from the backup costs one Map entry and is never shown.

### 2.4 Pass 3: `selectRows(firsts, assets, classification, controls): LifeListRow[]`

One loop over `firsts` (S species, never over rows), then one sort over the output:

1. Skip when `!controls.includeEscapees && classification.escapees.has(name)`; skip when `!controls.includeExotics && classification.exotics.has(name)` (FR-18; a species in both sets cannot occur, section 3.1, but the two checks are independent anyway).
2. If `controls.formats.size === 0`: the row is the first sighting (FR-26): `time = formatClock12h(first.minute)`, `checklistId = first.submissionId`, `location`, `place`.
3. Else: `const a = assets.get(name)`; for each selected format in `MEDIA_FORMATS` order, if `a?.[f]` is absent, skip the species (FR-23). Otherwise the row is the LATEST of the selected firsts under `compareInstant` (day, then timed before blank, then minute), with the format name (`MEDIA_FORMATS` order) as the final tiebreak (FR-25); one format selected makes that the row (FR-24). Its `time`, `checklistId` (= `asset.checklistId`), `location`, `place` are the chosen asset's.
4. Sort: `compareDisplay(a, b)` = day DESCENDING, then timed before blank, then minute DESCENDING, then `a.name.localeCompare(b.name)` (FR-28). Identical inputs, in any input order, give identical output (QA-30), because every key is total and the final key is the Map key, which is unique.
5. Position (FR-42, D-10): AFTER the sort, one loop over the sorted output assigns `position = rows.length - index`, so the newest row (index 0) carries the count sentence's N and the oldest carries 1. It is assigned over the FINAL roster for the current selection, so a media selection or a switch renumbers (the photo life list's newest is its own N), and it is independent of paging (page two continues from where page one stopped, because `pageList` slices rows that already carry their position). Every row's `scientificName` is copied from its first-sighting record whatever the selection (a media row's date and place come from the asset; its binomial does not, FR-43), and `media = { photo: !!a?.Photo, audio: !!a?.Audio, video: !!a?.Video }` is read off the species's `FirstAssets` record for every row (FR-44), identical under every selection and all-false when the ML export is absent or unreadable. No new pass: both are reads of records passes 1 and 2 already produced.

"Blank after timed" is ONE rule expressed by one comparator family: `compareInstant` places a blank after every timed instant of the same day. The first of a set is its minimum, the latest its maximum, and the newest-first display is the reverse. The test states this in its own body with a row where the same two instants are passed through all three uses.

### 2.5 The place string

`placeOf(county: string | null, stateProvince: string | null | undefined): string`: the state is the text after the first `-` in `stateProvince`, found by a hand scan over at most 16 characters (S5 in section 7; `''` when there is no hyphen, the cell is blank, or it is longer than the cap), then `county` and `state` joined with `", "` when both are present, either alone otherwise. On every well-formed code this equals `components/Checklists.tsx:332-333`'s `split('-')[1]` form, which the test pins. For an ML asset: `row.county ?? ''`. Plain text, never `HotspotLink` (FR-32; the Calendar precedent in ui.md). The test includes `"US-MN"`, `"MX-ROO"`, `"MN"`, `""`, `null`, and a 40,000-character hyphen run.

### 2.6 Time display

`formatClock12h(minute: number | null): string | null`: `null` for `null`; otherwise `${h12}:${mm} ${ampm}` with `h12 = ((minute / 60 | 0) % 12) || 12`, `mm` two digits. Both the backup's `"7:05 AM"` and an ML `"0705"` therefore render `"7:05 AM"`, and a backup `"07:05 AM"` (which the exporter does not write, but a hand-edited file might) renders the same. QA-32's four rows pass under this one formatter. The dash is rendered by the component (section 6.3), not placed in the row.

### 2.7 The binomial: `binomialOf(scientificName: string): string`

The backup's `Scientific Name` cell holds a binomial, a trinomial for a subspecies row (`Junco hyemalis oreganus`), a slash or group form for the names `isNonCountableForm` has already rejected, and `''` when the column is blank. The row shows the species, so the first-sighting record carries the first TWO whitespace-separated tokens of that cell and nothing after them: a hand scan over at most `BINOMIAL_SCAN_CHARS = 96` characters that copies characters into the result until the second run of whitespace or the cap, then stops (the longest binomial in eBird's 2026 taxonomy is well under 50 characters; 96 leaves room for a future name and is the scan's own bound, enforced in the function). Fewer than two tokens returns what there is (`''` for blank, the one token for a genus-only cell). No regex, no `split` (a `split` over a long cell allocates every token). Declared as S8 in section 7.

---

## 3. The exotic classification and its publication

### 3.1 Model (`lib/exoticProvenance.ts`)

```ts
/** FR-16: a category that is present. 'X|', 'N|', 'P|' and any future value qualify; '|' does not. */
export function isExoticToken(token: string): boolean { return categoryOfToken(token) !== '' }

/** FR-16 (realigned to the brief at QA round 1, decisions.md D-25): not an escapee, at least one
 *  observation consulted, every CONSULTED token carries a category. No carrier clause. */
export function isExoticOnly(snapshot: ProvenanceSnapshot, index: CoverIndex, code: string): boolean {
  const rec = snapshot.species.get(code)
  if (!rec || rec.seen.length === 0) return false          // nothing consulted: native (FR-16, FR-19)
  if (classifySpecies(snapshot, index, code) !== 'counting') return false   // escapee-only and unresolved are not exotic
  for (const t of rec.seen) if (!isExoticToken(t)) return false            // one categoryless observation: native
  return true
}
```

`classifySpecies` is unchanged; `ProvenanceClass` gains no member, so `classCounts`, every Statistics count, the status line and the stats bundle are untouched. QA-17's rows map directly: `['N|', 'P|']` → exotic, with every carrier consulted or with one; `['N|', '|']` → native; `['X|', 'N|']` → `counting` (N counts) and all tokens carry a category → exotic, not escapee; an all-`X|` species with an unconsulted carrier is `unresolved`, not exotic. The rule originally also required every carrier in the export to be consulted; the Statistics cover consults one checklist per species and stops seeking at the first counting token (15 of 368 checklists on the demo export), so that clause almost never held after a complete pass and was dropped to the brief's rule (D-25). An escapee-only species is never exotic because the second test refuses it, so the two published lists are disjoint by construction, and `lifeLists.test.ts` asserts the disjointness over a generated token corpus.

`ProvenanceLookup` gains `readonly exoticNames: ReadonlySet<string>`; `EMPTY_LOOKUP.exoticNames = new Set()`. `buildProvenanceLookup` computes it in its existing loop over `index.nameForCode` (one extra `isExoticOnly` call per species; the same code-to-name direction, never a name round trip). Statistics' consumers of `lookup.excludedNames` do not change.

`ProvenanceSnapshot` gains `readonly exoticNames: readonly string[] | null`, where `null` means "never published on this document" and `[]` means "published, and no species is exotic-only". `EMPTY_SNAPSHOT.exoticNames = null`.

`confirmPublishedNames(published: readonly string[], snapshot: ProvenanceSnapshot, obs: readonly ObservationEntry[]): ReadonlySet<string>` is the body of today's `confirmExcludedNames` with the list as a parameter; `confirmExcludedNames(snapshot, obs)` becomes `confirmPublishedNames(snapshot.excludedNames, snapshot, obs)`, byte-identical in behaviour (its existing tests do not change; one new row pins the delegation with comments stripped).

**Considered and declined (D-11 consequence): classifying exotics in the tab from codes.** With a `/taxonomy/codes` batch now in hand (section 5.4), the tab COULD build its own cover index and classify exotics from `snapshot.species`'s raw tokens by code, with no published list at all. It does not, and the published `exoticNames` list stays the design, because (a) it keeps the tab's exotic reading the same mechanism as its escapee reading (a published name confirmed against the ledger with the tab's own observations), so the two switches cannot drift apart; (b) Statistics must still have run a pass for the record to hold any tokens, so nothing about the user-facing "has not finished for this export" sentence (FR-20) would change; and (c) it avoids a second classifier that could disagree with Statistics on an edge the two implementations handle differently. The tab never imports `useExoticProvenance` (section 3.6), and the codes batch never feeds classification. Since D-25 it does feed one other reader: the FR-20 status builds Statistics' own cover index from the tab's codes to read Statistics' completion signal (section 3.5), which classifies nothing.

### 3.2 Store (`lib/exoticProvenanceCache.ts`): the decision, optional field on the same key

**Decision: `exoticNames` is an optional field on the existing `exotic-provenance-v1` document; the key suffix and `version: 1` do not change.** A suffix bump would orphan every user's consulted-checklist ledger (up to 131,072 entries) and species index, and the next Statistics visit would re-run a full cover pass of eBird requests to rebuild what the old document already held; the header comment that prescribes a bump exists for a shape change that would MISREAD an old document, and an absent optional field whose absence is a defined state ("not yet published") misreads nothing. The Engineer amends that header comment to say so, in one sentence, so the next shape change does not read this feature as licence to skip the bump.

Store shape and validator:

```ts
export interface ProvenanceStore {
  version: 1
  checklists: Record<string, number>; order: string[]
  species: Record<string, SpeciesProvenanceRecord>; speciesOrder: string[]
  excludedNames: string[]
  /** Published exotic-only names (life-lists-tab). `null` = never published on this document,
   *  which every document written before 1.0.62 is. Absence is UNRESOLVED, never "no exotics". */
  exoticNames: string[] | null
}
```

- `EMPTY_STORE()` sets `exoticNames: null`.
- `sanitizeStore`: `if (Array.isArray(doc.exoticNames))` admit under the SAME two bounds as `excludedNames` (`MAX_PUBLISHED_NAMES`, lowered to 2,048 for both lists by the budget measurement below; `MAX_PUBLISHED_NAME_LENGTH = 128` code units; malformed entries dropped; the list truncated at the cap); anything else (absent, `null`, a non-array) → `null`. A hostile non-array degrades to "unresolved", the safe direction (every species listed, FR-19).
- `rebuildSnapshot`: `exoticNames: store.exoticNames ? [...store.exoticNames] : null`.
- `scheduleWrite`'s snapshot copy: `exoticNames: store.exoticNames ? [...store.exoticNames] : null`. A `null` serializes as JSON `null` and reads back as `null` through the validator, so the round trip is stable; the store test asserts sanitize(serialize(sanitize(x))) is idempotent on both the `null` and the `[]` shapes, because they MEAN different things (testing.md's write-chokepoint round trip).
- `publishExcludedNames(names)` is REPLACED by:

```ts
export async function publishClassifiedNames(
  lists: { excludedNames: readonly string[]; exoticNames: readonly string[] },
): Promise<void>
```

  Same purge-generation guard, same `ensureLoaded`, both lists sliced to `MAX_PUBLISHED_NAMES` and sorted, no-op when BOTH are unchanged (`exoticNames` compared against a `null` store value is always a change, which is what first publishes `[]`), one `rebuildSnapshot`, one `scheduleWrite`. The single caller is `useExoticProvenance.ts:212`; `exoticProvenanceCache.test.ts` and `clearDerived.test.ts` rename their calls. The old name is not kept as an alias (one publisher, one function).

- `purgeProvenanceStore`: no change; it installs `EMPTY_STORE()` (so `exoticNames` is `null` again) and deletes the document.

**Budget arithmetic (settingsRouteBudget.test.ts), measured rather than reasoned.** The Architect rebuilt the guard's worst-case document through the shipped `sanitizeStore` with the guard's own constructions (131,072 ledger keys, 16,384 species at eight full-width tokens, 4,096 published names of 128 `'\u0001'` units, which JSON escapes to six bytes each): **15,118,421 B** against the route's 16,777,216 B. Adding `exoticNames` at the same bounds and the same unit: **18,276,453 B, over by 1.5 MB**, so the field at 4,096 entries turns the guard red. **Decision: `MAX_PUBLISHED_NAMES` becomes 2,048 for BOTH lists**, `MAX_PUBLISHED_NAME_LENGTH` stays 128. The worst case is then byte-for-byte today's plus the field name (two lists of 2,048 cost what one list of 4,096 did), the headroom stays 1.66 MB, and no real list approaches the cap: the escapee-only list on the reference export is single digits, and the exotic-only list for a world lister is at most a few hundred (the world taxonomy holds 11,201 species and eBird's N and P categories are per region). Neither the route limit nor the document's home moves. The cap's comment in the store (`:78-83`, "published names (4,096 of 128 characters)") is rewritten with these figures, the guard's `mostNames()` reads the new cap through the validator as it does today, and its worst-case document gains `exoticNames` built exactly as `excludedNames` is. A document written by an earlier build with up to 4,096 escapee names is truncated to 2,048 on load (the existing `break` at the cap), which is the safe direction: a dropped name is unconfirmed and counts.

### 3.3 Publisher (`lib/useExoticProvenance.ts:207-213`)

```ts
useEffect(() => {
  if (snapshot.species.size === 0 || index.bySpecies.size === 0) return
  void publishClassifiedNames({ excludedNames: [...lookup.excludedNames], exoticNames: [...lookup.exoticNames] })
}, [lookup, snapshot, index])
```

The guard condition is unchanged, so publication happens exactly when it did before: after Statistics has a resolved snapshot and a cover index, which is after the tab has been opened once on this build with the provenance record loaded. QA-18's "no additional request" holds structurally: the publish effect touches the store only, and the controller's request path (`runPass`, `dedupedFetchChecklist`) is untouched. The Tester's transport-seam request count before and after the change over the same fixture is the measurement.

### 3.4 Purge registration: covered, no change

`clearDerived.ts:76-77` purges `exotic-provenance-v1` through `purgeProvenanceStore`, which deletes the whole document; the new field lives in that document, so it is purged by the existing row. `cacheInventory.test.ts:135` pairs that row to that export and does not change. The purge-generation guard in `publishClassifiedNames` is inherited from `publishExcludedNames` unchanged, so a Clear racing a publish still refuses the stale write. QA-38's "`clearDerived.ts` and `cacheInventory.test.ts` unchanged" is therefore satisfied by design, and the Engineer verifies with `git diff --stat` on both.

### 3.5 The tab's passive reader: `lib/lifeListsProvenance.ts`

```ts
export interface LifeListsProvenance extends LifeListClassification {
  /** FR-17: false until a Statistics pass on this build has written the list. */
  readonly exoticsPublished: boolean
  /** FR-20: true when every submission id in `obs` is in the consulted ledger. */
  readonly ledgerCoversExport: boolean
}

/** O(rows), one Set lookup per distinct submission id. No regex, no indexOf. */
export function ledgerCoversExport(snapshot: ProvenanceSnapshot, obs: readonly ObservationEntry[]): boolean

export function useLifeListsProvenance(observations: readonly ObservationEntry[]): LifeListsProvenance
```

The hook is `useProvenanceLookup`'s shape: `useSyncExternalStore(subscribe, getSnapshot, getSnapshot)`, `useEffect(() => { void loadSnapshot() }, [])`, then a memo on `[snapshot, observations]` for `{ escapees: confirmPublishedNames(snapshot.excludedNames, snapshot, obs), exotics: snapshot.exoticNames ? new Set(snapshot.exoticNames) : EMPTY_SET }` and a memo on `[snapshot, observations, codes]` for `checkComplete`. Since D-25 the exotic list is read AS PUBLISHED (its rule judges the consulted observations, so an unconsulted checklist cannot change it); the escapee list keeps the carrier confirmation. It imports `./exoticProvenanceCache`, `./exoticProvenance` and React, nothing else; it never imports `useExoticProvenance`.

`checkComplete` (`statisticsCheckComplete(snapshot, obs, codes)`) is the SAME completion Statistics ends a pass on: `remainingSpecies(snapshot, buildCoverIndex(obs, codeFor), none).length === 0`, every species in the export's cover index answered (counting or escapee-only), built from the tab's own codes for the CURRENT roster (`codes` is null until the batch for this roster resolves, and on its failure). It is false with no codes, an empty snapshot or a vacuous index, so it never reads as finished by accident, and it is computed against the current export rather than a flag persisted from an older one. The codes feed this check and the marks only, never classification.

The FR-20 sentence is the first when `!exoticsPublished || !checkComplete`, else the second. FR-19 is structural: an unpublished list is an empty `exotics` set, an unconfirmed escapee name is absent from its set, and an absent name is listed with both switches off. The superseded `ledgerCoversExport` ("is every checklist in this backup consulted") was removed at D-25: a set-cover pass never consults most checklists, so it held almost never.

### 3.6 The graph guard (`exoticProvenanceGraph.test.ts`)

The passive-reader root `lib/lifeListsProvenance.ts` joins the existing walk, asserted to reach no `transport`, no `lib/tauri/*Service`, and not `lib/useExoticProvenance.ts`, with the positive leg (it DOES reach `exoticProvenanceCache.ts` and `exoticProvenance.ts`) so the negatives are live; `lib/lifeLists.ts` and `lib/lifeListsCopy.ts` get the same no-network row. The tab component `components/lifeLists/LifeListsTab.tsx` reaches `transport` BY DESIGN for the one codes batch (D-11, section 5.4), exactly as `Checklists.tsx` and `SpeciesDetail.tsx` do, so its row is the Species Detail shape at `exoticProvenanceGraph.test.ts:177`: it reads provenance through the passive hook only and never reaches `lib/useExoticProvenance.ts` (the `useExoticProvenance is imported by exactly one component` row at `:190` keeps its count). **Deviation from QA-15's wording, stated:** `buildCoverIndex` is exported by `exoticProvenance.ts`, which every passive reader reaches by design, so it is asserted as a comment-stripped source scan over the tab's own modules (`lib/lifeLists*.ts`, `components/lifeLists/**`), not as a module-graph edge: `useExoticProvenance` appears in none of them, and since D-25 `buildCoverIndex` appears in `lifeListsProvenance.ts` alone (the FR-20 completion check, with a positive leg) and never in the derivation or the components. The row's failure message says which of the two kinds it is.

### 3.7 The binary-file repair in `exoticProvenance.ts`

`frontend/src/lib/exoticProvenance.ts:160` reads `` const pair = `${sub}\u0000${code}` `` in intent and holds a literal U+0000 byte in the file, so git treats the file as binary and no diff to it is reviewable (`.claude/rules/testing.md`, v1.0.22, which names this file and prescribes the escape as the repair). Because this feature must edit that file, the Engineer first replaces the one byte with the six characters `\u0000` through a byte-level script that refuses unless the exact old line occurs once (the v1.0.55 shape), as its OWN commit before any feature edit, so the feature's diff is a text diff. A template literal resolves `\u0000` to the same character, so the pair key is byte-identical and `exoticProvenance.test.ts` is unchanged; one new source row in that suite asserts the module's code (comments aside) holds no literal control or non-ASCII character, which is the rule's enforcement form. `statsExcludedKey.test.ts`, the other binary file the rule names, is out of scope and stays as it is.

---

## 4. The tab

### 4.1 `lib/tabLayout.ts`

- `ConfigurableTab` gains `'life-lists'`; `TAB_LABELS['life-lists'] = 'Life Lists'`. The key is not `life-list` (FR-01, QA-01).
- `DEFAULT_TAB_ORDER` becomes `['weather', 'birding-stats', 'map-explorer', 'species-detail', 'calendar', 'targets', 'life-list', 'breeding-codes', 'checklists', 'life-lists', 'comparer', 'named-birds']` (index 9, directly after `checklists` at index 8).
- `PREVIOUS_DEFAULT_TAB_ORDER` becomes the 1.0.38-through-1.0.61 order (today's 11-id `DEFAULT_TAB_ORDER` literal); the 10-id 1.0.19 literal is retired (exactly one generation, FR-03). Its docstring is rewritten for this generation.
- `parseLayout` is UNCHANGED: `appendMissing` already appends the new id to a saved order and to the constant alike, which is what lets an 11-id saved default equal the 12-id current default after the append (the Targets finding, `pipeline/targets-tab/schema.md` 6.1). QA-03's three outcomes follow: the saved 1.0.61 default reads as the new default with Life Lists at index 9 and its hidden set intact; a one-swap order gets `life-lists` appended last; the retired 1.0.19 order is a custom order and also gets it appended last. Nothing is written back.
- `tabLayout.test.ts`: the literal rows move to the new generation; a QA-01 row asserts index 9 and the label; a QA-03 row asserts the three outcomes above.

### 4.2 `lib/tabIcons.tsx`, `App.tsx`, `HelpDocs.tsx`

- `TAB_ICONS['life-lists']`: lucide `ListChecks` (a list with check marks; unused in `tabIcons.tsx`, distinct from Checklists' `ClipboardList` and Multimedia's `Images`). The Engineer confirms the export exists in the installed `lucide-react` before committing; fallbacks in order: `ListOrdered`, `ScrollText`. `Record<Tab, TabIcon>` makes the entry a build error until it exists.
- `App.tsx`: `const importLifeLists = () => import('./components/lifeLists/LifeListsTab')`; `const LifeListsTab = lazy(() => importLifeLists().then(m => ({ default: m.LifeListsTab })))`; `'life-lists'` in `DEFERRED_TABS` (`:139-142`, REQUIRED or the panel never mounts); a panel block directly after Checklists' (`:1462-1481`) with `id="panel-life-lists"`, `aria-labelledby="tab-life-lists"`, `aria-label="Life Lists"`, `className="sr-panel"`, the same `display` toggle and padding, and `<LifeListsTab onGoToSettings={() => setActiveTab('settings')} onOpenSpecies={navigateToSpeciesDetail} />`. No `filesVersion` prop (section 5.1). Not added to the idle `warm()` prefetch list, matching Checklists.
- `HelpDocs.tsx` TOC: `{ id: 'life-lists', label: 'Life Lists', sub: false }` between `checklists` and `list-comparer` (`textToId('Life Lists')` is `life-lists`, so the TOC id and the stamped heading id agree; `helpToc.test.ts` asserts this and the `DEFAULT_TAB_ORDER` order).

### 4.3 Components (`components/lifeLists/`, all lazy, every control through `Button` / `Link` / `ToggleSwitch`)

- `LifeListsTab.tsx`: the phase gate (section 5), the two file loads, passes 1 and 2 in the load effect, the provenance hook, pass 3 in a `useMemo`, the controls, the count sentence, the status sentence, paging, the rows.
- `LifeListsControls.tsx`: two `ToggleSwitch`es ("Include Escapees", "Include Exotics"; FR-35) and three `Button`s with `aria-pressed` (FR-21, ui.md `SegControl` rule), disabled with the FR-27 sentence wired through `aria-describedby` to an index-keyed id (ui.md's not-operable-but-readable rule) when the ML export is absent or unreadable.
- `LifeListsRows.tsx`: the rows, each `li.sr-lfl-row` on the design spec's seven-track grid (`num name date time link place media`). In order:
  - **num** (FR-42, D-10): `row.position` as plain text in `.sr-lfl-num` (right-aligned, tabular figures, the fixed `2.5rem` track on desktop and `1.9rem` on the card), `aria-hidden`; the accessible form is an `.sr-only` "`{position} of {rows.length}.`" prefix inside the name cell, so a screen reader hears the position with the name and the visible number is never a second announcement.
  - **name** (FR-43, D-11): `<BirdName commonName={row.name} scientificName={row.scientificName} taxonCode={codeFor(row.name)} hasEntry onOpenSpecies={onOpenSpecies} showSci size="md" />`, exactly the Checklists species-comment lead (`Checklists.tsx:619-626`) with `showSci`. `hasEntry` is `true` for every row (all from the backup). `SpeciesLinks` draws the eBird and Birds of the World marks beside the name when `codeFor` returns a code that passes its own `SPECIES_CODE_RE` gate, and nothing when it is pending, rejected or missing; the component imports `BirdName` only, never `SpeciesLinks` (bird-names.md), so no new rule path is owed for the marks. The cell overrides the shared `nowrap` on `.sr-birdname-sci` per the design spec.
  - **date**, **time**, **link** (`<ChecklistLink submissionId={row.checklistId} compact />` in the `.sr-lfl-cl` box when `isValidChecklistId(row.checklistId)`, else a dash; FR-31, D-04; the shared guard decides and `ChecklistLink`'s own `SUBMISSION_ID_RE` gate is the second enforcement point), **place** as two plain-text lines (D-06).
  - **media** (FR-44, D-12, the Quiet treatment unless the user picks Count or Off at the gate): `.sr-lfl-media`, a passive `<span role="img" aria-label={mediaLabel(row.media)}>` of the three lucide glyphs (`Camera`, `Mic`, `Video`, 12px) in `MEDIA_FORMATS` order, a present format in `--sr-text` and an absent one as the faint `--sr-border-medium` placeholder, never a link, button or tab stop, on the fixed `max(46px, 2.5rem)` track. `mediaLabel` lives in `lifeListsCopy.ts` and yields "Media: photo, audio" (the present formats in the fixed order) or "No media". The cell is OMITTED, and the grid's track dropped (`[data-media="off"]`), when `getFilesStatus().ml` is falsy or `loadMLExport()` returned `null` (section 5.2's `none` and `unreadable` states), so a row never shows three empty placeholders about a file the app does not have.
  - Every DOM id and IDREF is `${prefix}-${index}` (FR-38). No `React.memo` on a row, so `formatDate` tracks the preference through App's re-render (section 6.3).

The Designer owns layout, the 320px / 200% behaviour and the control placement; the boundaries above are what the Tester tests.

---

## 5. Loading, states and the epoch

### 5.1 The load effect

```ts
const filesEpoch = useFilesEpoch()
useEffect(() => {
  let cancelled = false
  async function load() {
    setPhase({ tag: 'loading' })
    try {
      const status = await storage.getFilesStatus()     // a rejection lands in the catch: UNKNOWN, never EMPTY
      if (cancelled) return
      if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }
      const [ebird, ml] = await Promise.all([loadEbirdObservations(), loadMLExport().catch(() => null)])
      if (cancelled) return
      if (!ebird) { setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR }); return }
      const firsts = deriveFirstSightings(ebird.observations)
      const mlState: MlState = !status.ml ? { tag: 'none' } : ml ? { tag: 'ready', assets: deriveFirstAssets(ml.rows) } : { tag: 'unreadable' }
      if (cancelled) return
      setPhase({ tag: 'ready', observations: ebird.observations, firsts, ml: mlState })
    } catch {
      if (!cancelled) setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR })
    }
  }
  void load()
  return () => { cancelled = true }
}, [filesEpoch])
```

The epoch is read with `useFilesEpoch()` inside the component (the `BirdingStats.tsx:176` shape), not through a prop, so the tab's own re-trigger is the signal itself and the roster row for it is epoch-driven (`TabLoadErrorAlert.test.tsx`'s `epochDriven`). Every save, replace, remove, delete-all and iCloud clear bumps it (CLAUDE.md, data-file change signals), so FR-09's "clearing all data leaves the tab in the setup state" is one re-run of this effect. `observations` is kept in the phase ONLY as the stable array the provenance hook confirms against (its memo keys on the reference); it is the cache's own array, not a copy.

### 5.2 The three file states, told apart correctly

`loadMLExport()` returns `null` for "no file" AND for "unreadable or unparseable" (`mlExportCache.ts:14-18`), so FR-27's two sentences come from `status.ml` (the metadata record) combined with the load result: `status.ml` falsy → none; truthy and `ml === null` → unreadable; truthy and `ml` → ready. The ML export never blocks or errors the first-sighting list (FR-08). `getFilesStatus()` rejecting is the one case that takes the `error` arm: the tab cannot say whether a backup exists, which is UNKNOWN, never the setup panel (CLAUDE.md, transport seam).

### 5.3 Setup, error, loading

`phase.tag !== 'ready'` renders the `TabLoadErrorAlert` frame with `message` (always mounted, so the live region exists before the message arrives, ui.md v1.0.15), then `SetupRequired` with title "eBird Backup Required", body "The Life Lists tab loads automatically from your stored eBird backup. You haven't saved one yet.", `steps={EBIRD_BACKUP_STEPS}`, `onGoToSettings`, or the `role="status" aria-label="Loading your life list"` indicator (FR-05 to FR-07). The Checklists block at `Checklists.tsx:529-546` is the template.

### 5.4 The taxon-code batch (FR-43, D-11; the amended FR-39)

The load effect's `ready` phase also carries `rosterKey: string`, computed once per epoch after pass 1 as `[...firsts.keys()].sort().join('\n')` (O(S log S) over species, never rows; `\n` cannot occur in a normalized name because the parser trims cells and `normalizeSpeciesName` keeps no line terminator, and the test pins that over a hostile corpus). A second effect, keyed on `rosterKey` alone, issues the batch:

```ts
useEffect(() => {
  if (phase.tag !== 'ready' || phase.firsts.size === 0) return
  let cancelled = false
  const species = withNormalizedParents([...phase.firsts].map(([name, f]) => [name, f.scientificName] as const))
  transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', { species })
    .then(data => { if (!cancelled) setTaxonMap(data.codes ?? {}) })
    .catch(() => { /* marks absent until the next roster change; names render and link without them */ })
  return () => { cancelled = true }
}, [rosterKey])            // the name SET, so a re-parse of the same file re-issues nothing
```

- **Shape:** the Checklists batch (`Checklists.tsx:460-474`) over the roster's normalized names paired with their first-sighting binomials. The roster's names are already normalized, so `withNormalizedParents` adds no parent row and the request does not grow (its own docstring states the no-op); it is called anyway so the request shape is byte-for-byte the shipped one on both transports.
- **Once per roster name set:** the dependency is the sorted joined key, not the `firsts` Map identity, so two epochs that parse the same species set issue one batch, and QA-41's amended form ("exactly one `/taxonomy/codes` post per derivation, zero other requests") holds as one post per DISTINCT roster. A roster that changes (a new backup with a new species) re-issues; nothing else does.
- **Never blocking:** `taxonMap` starts `{}`; a pending or rejected batch renders every name without marks (`SpeciesLinks` draws nothing for a missing code), and the list's order, rows, count and derivation do not depend on it (pass 3 never reads it). The `cancelled` flag refuses a late reply after the roster changed.
- **`codeFor(name)`** reads the map through `Object.hasOwn` with the normalized-name fallback: `Object.hasOwn(taxonMap, name) ? taxonMap[name] : Object.hasOwn(taxonMap, norm) ? taxonMap[norm] : undefined` where `norm = normalizeSpeciesName(name)`. This is the Checklists `codeFor` (`:522`) with the bare-index read replaced, because a table keyed by a species name out of the user's CSV is the v1.0.22 `__proto__` family (security.md names `BirdingStats.tsx`'s and `SpeciesDetail.tsx`'s members as the shape to REPLACE, never to copy); `taxonMap` is held in `useState` as it is in Checklists. For this tab's already-normalized keys the fallback is the same lookup; it is written so a raw form name handed in later still resolves.
- **Transport:** on Tauri `transport.ts:251-256` routes the post to the local `getTaxonomyCodes` (no network); on web/Pi `WebTransport.post` calls the backend's bundled taxonomy with `APP_REQUEST_HEADERS`. The path is in neither `CACHED_GET_PATHS` (GET-only) nor `EBIRD_GATED_PATHS`, and the caching wrapper's `post` (`:344-346`) passes it through, so there is no transport-level dedupe or gate for it and this schema adds none: the once-per-roster effect above is the one enforcement point, as it is for the other three tabs that make this call. No Vite proxy entry, CSP entry or http permit entry is needed (an existing route on an existing host, local on Tauri).
- **Guards:** QA-41's spy counts exactly one `transport.post` to `/taxonomy/codes` across mount, both loads, every control and Show all, and zero `fetch`, zero hotspot-set loads, zero provenance requests; a second row re-renders with a new `firsts` Map of the same names and asserts the count stays one; a third rejects the post and asserts the rows, order and count are unchanged and every name renders without a mark.

---

## 6. State, paging and copy

### 6.1 Control state

`useState(false)` for each switch and `useState<ReadonlySet<MediaFormat>>(EMPTY)` for the formats, in `LifeListsTab.tsx`. Session-only by construction: nothing calls `storage.*`, nothing joins iCloud Sync, nothing registers in `clearDerived.ts` (FR-36; QA-38's seam spy sees zero writes). The tab stays mounted while hidden, so the state survives tab switches and resets on relaunch.

### 6.2 Paging: `lib/pageList.ts`

```ts
export const PAGE_SIZE = 100
export interface Paged<T> { visible: T[]; total: number; hasMore: boolean; nextCount: number }
export function pageList<T>(all: readonly T[], shown: number): Paged<T>
```

The body is `weatherBacklog.ts:107-117` made generic; `pageBacklog(all, shown)` becomes `return pageList(all, shown)` and `weatherBacklog.ts` re-exports `PAGE_SIZE` from the new module so its consumers do not move. `pageList.test.ts` carries the four shapes (empty, under a page, exactly a page, over) plus the clamp rows; `weatherBacklog.test.ts` does not change, which is the proof the extraction changed nothing.

In the tab: `const [shown, setShown] = useState(PAGE_SIZE)`, reset to `PAGE_SIZE` whenever the selection (`rows` identity) changes, exactly as `WeatherBacklog.tsx:442` does; "Show next 100" sets `Math.min(shown + PAGE_SIZE, rows.length)`, "Show all" sets `rows.length`, both `Button`s, both unmounted once `!hasMore`. Focus (FR-37, QA-39): "Show next 100" leaves its own button mounted and focused while more remain; when either control's activation reveals the last row the controls unmount, so the handler bumps a `focusSeq` counter and an effect keyed on it focuses a `tabIndex={-1}` anchor on the list's own container (the element that carries the count sentence's heading, not the live region), which the Designer places. The test asserts `document.activeElement` by element IDENTITY (testing.md, v1.0.39 rule 2). The count sentence always states `rows.length`, never `visible.length`.

### 6.3 Rows

Date: `formatDate(dayToIso(row.day))` at render, where `dayToIso` writes `YYYY-MM-DD` back from the integer key (no `Date` construction; `formatDate`'s `parseParts` refuses nothing a valid day key produces). Time: `row.time ?? '-'` as a single hyphen-minus character. Checklist and location per section 4.3.

### 6.4 Copy: `lib/lifeListsCopy.ts`

Generated from `MEDIA_FORMATS` plus a per-format record `{ key, label: 'Photo' | 'Audio' | 'Video', withNoun: 'a photo' | 'audio' | 'video', firstNoun: 'your first photo' | 'your first audio recording' | 'your first video' }` (ui.md v0.5.81: one ordered manifest, never a hand-written 2^N table), with pure builders:

- `countSentence(n: number, formats: ReadonlySet<MediaFormat>): string`, producing FR-33's eight sentences verbatim: the no-format sentence, the three single-format sentences from `firstNoun`, the two-format form "N species with {a photo and audio | a photo and video | audio and video}, newest first by the date each had both.", and the three-format "N species with a photo, audio, and video, newest first by the date each had all three." N is `n.toLocaleString('en-US')`.
- `emptySentence(formats)`: FR-34's two.
- `STATUS_UNRESOLVED`, `STATUS_RESOLVED`: FR-20's two, verbatim.
- `ML_NONE_SENTENCE`, `ML_UNREADABLE_SENTENCE`: FR-27's two, verbatim.
- `SETUP_TITLE`, `SETUP_BODY`, `LOADING_LABEL`, `SWITCH_LABELS`, `FORMAT_LABELS`, `SHOW_NEXT_LABEL`, `SHOW_ALL_LABEL`.

`lifeListsCopy.test.ts` is the generated-corpus guard (ui.md v1.0.5): it calls every builder over every reachable state (n in {0, 1, 2, 1204}, all eight format sets), asserts the eight FR-33 sentences and the FR-27 and FR-20 sentences as literals (the one content test, testing.md v1.0.14), asserts the serial comma in the three-format sentence, and asserts no U+2014 anywhere in the module's output (NFR-09). "1 species" is correct English for the singular and the sweep's plural rule exempts "species" explicitly.

---

## 7. Security declaration: the scans this feature adds over user-file text

CLAUDE.md requires a build that adds a scan over user-file content to declare it here, with its linearity argument, the clamp on any number read from the file, the `security.md` glob the build adds, and the measured-cost obligation. The PRD's NFR-07 says the derivation "adds no new scan"; it adds the ones below, each a read over an already-parsed field, and this section contradicts the PRD rather than leaving the Auditor to find them (DECISIONS.md, the v1.0.23 declared-exception pattern).

| # | Scan | Where | Input | Bound and linearity argument |
|---|---|---|---|---|
| S1 | `dayKey(date: string): number \| null` | `lib/lifeLists.ts` | `ObservationEntry.date`, `MLExportRow.date` | Length gate first: `date.length !== 10` returns `null` before any character is read, so a cell of any length costs one length read. Then ten fixed-position character-code checks (digits at 0-3, 5-6, 8-9; hyphens at 4 and 7), then the range check month 1-12, day 1-31. No regex, no `indexOf`, no loop over the cell. Returns `y * 10000 + m * 100 + d` |
| S2 | `minuteOf12h(time: string \| null \| undefined): number \| null` | `lib/lifeLists.ts` | `ObservationEntry.time` | `null`/`''` or `length > 8` returns `null` first. Then a hand loop over at most 8 characters reading `H` or `HH`, `:`, `MM`, a space, `AM` or `PM`; hour 1-12, minute 0-59. No `indexOf` (its absence case would search to the end of the cell, security.md v1.0.39; the length gate makes that moot, and the hand loop makes the file-scoped absence guard clean) |
| S3 | `minuteOfMlClock(time: string): number \| null` | `lib/lifeLists.ts` | `MLExportRow.time` | `length === 0` or `length > 4` returns `null` first (the ML parser already trims). Then 1-4 digit checks, `hour = n / 100`, `minute = n % 100`, hour 0-23, minute 0-59. Same contract as `mediaStats.parseMlHour`, keeping the minute |
| S4 | `isNonCountableForm(raw)`, `normalizeSpeciesName(raw)` | existing, `lib/speciesUtils.ts` | `ObservationEntry.commonName` | Existing linear scans (v0.5.84) with admission-controlled memos; one call each per row. The memo degrades to recompute past its cap (capacity+1 measured, testing.md v0.5.85), so a 150k-distinct-name corpus costs 150k linear scans, still linear in total characters |
| S5 | `placeOf` | `lib/lifeLists.ts` | `county`, `stateProvince` | Once per written first-sighting record (once per SPECIES in practice). The state is the text after the first `-` found by a hand scan over at most `STATE_CODE_SCAN_CHARS = 16` characters of `stateProvince` (eBird codes are `US-MN`, `CA-ON`, `MX-ROO`; a longer cell yields no state), then one string concatenation with the county. No `split`, so the module's absence guard holds; the result equals `Checklists.tsx:332-333`'s `split('-')[1]` form on every well-formed code, and the test pins that over the shipped region-code fixture |
| S6 | The display sort's `localeCompare` | `lib/lifeLists.ts` | normalized names | S log S comparisons over S distinct species (S ≤ rows), each linear in the shorter name. Total characters in the file are bounded by the per-platform upload cap (`EBIRD_MAX_UPLOAD_BYTES_BY_PLATFORM`), so the worst case is `log2(S) × total name characters`, about 17 × 50 M on the 50 MB platforms: bounded, and the same primitive `buildProvenanceLookup` and the Multimedia table already apply to the same names. Stated as the one residual that is super-linear in a degenerate file (every row its own species) |
| S7 | `confirmPublishedNames` (twice) and `ledgerCoversExport` | `lib/exoticProvenance.ts`, `lib/lifeListsProvenance.ts` | `commonName`, `submissionId` | One `Set.has` per row each; `confirmPublishedNames` is the existing `confirmExcludedNames` body. The `Set` accumulators make a `__proto__` id or name an ordinary key |
| S8 | `binomialOf(scientificName)` (FR-43, section 2.7) | `lib/lifeLists.ts` | `ObservationEntry.scientificName` | A NEW read of user-file text per written first-sighting record (at most once per row, once per species in practice): a hand scan copying characters until the second whitespace run, capped at two tokens and at `BINOMIAL_SCAN_CHARS = 96` characters, so the cost is O(min(field length, 96)) whatever the cell holds. The field itself carries no parser-side bound: `parseEbirdObservations.ts` trims each cell and the only bound on a cell is the file's, the per-platform upload cap (`EBIRD_MAX_UPLOAD_BYTES_BY_PLATFORM`, `uploadGuard.ts:77`; iCloud pulls are deliberately unguarded, CLAUDE.md), which is why the function enforces its own character cap rather than resting on the producer (security.md v1.0.30). No regex, no `split`, no `indexOf` |

The per-row media cell (FR-44) and the position number (FR-42) add no scan: both are reads of booleans and an index off records passes 1 to 3 already produced. The taxon-code batch (FR-43) sends the roster's names and binomials and reads back a code map through `Object.hasOwn` (section 5.4); it scans nothing.

**Loops driven by a number read from the file: none.** `day` and `minute` are compared, never iterated; the row count and species count drive every loop, and both are bounded by the parsed arrays' lengths. No clamp is therefore needed, and none is declared.

**Enforcement point (security.md v1.0.30):** S1-S3's bounds are enforced inside the functions themselves (the length gates), not by a producer's cap, so they hold for any string the parsers can hand over, including a hand-edited file within the upload cap. S6's bound rests on the upload cap, which `uploadGuard.ts` enforces at import and iCloud pulls deliberately do not (CLAUDE.md); that residual is the same one every name-sorting surface carries and is stated, not closed.

**`security.md` `paths` the build adds:** `"frontend/src/lib/lifeLists*.ts"` (covers `lifeLists.ts`, `lifeListsCopy.ts`, `lifeListsProvenance.ts`, their tests and any fixture) and `"frontend/src/lib/exoticProvenance.ts"` (it holds the user-text scan `confirmPublishedNames` and was gated only by `bird-names.md`; its cache twin is already in the list).

**Measured-cost obligation.** The Engineer measures and records in `decisions.md`: (a) the cost of passes 1 and 2 per LOAD (once per files epoch) on the tracked demo export and on a generated 150,000-row backup with a 50,000-row ML export, read through `cpuTiming.ts`; (b) the cost of pass 3 per RE-DRAW (one control change) on the same inputs. The Architect's own scratch measurement of a pass-1-shaped loop over 15k, 150k and 300k synthetic rows (V8, Node 24, this Mac) read 3.4 ms, 35.4 ms and 69.5 ms (0.23 us per row, flat), and `confirmExcludedNames` 1.4, 10.6 and 19.8 ms, so the expected figures are about 40-50 ms per load at the 150k-row cap on a desktop engine and a few milliseconds per re-draw; a tenfold slower engine (a Pi's browser, an older phone) sits near half a second per load, which runs inside the load effect after the awaited parse and never in render. The Tester checks the ratio guard (section 8) and reads the recorded figures against this expectation.

**Guard the file-scoped absence (testing.md v1.0.23):** `lifeLists.test.ts` asserts, comments stripped, that `lifeLists.ts` contains none of `.includes(`, `.indexOf(`, `.find(`, `.filter(`, `.match(`, `.search(`, `.split(`, `RegExp`, and no regex literal with an unbounded quantifier; the hand loops above (S1 to S3, S5, S8) are what make that assertion true without an exemption.

---

## 8. Thread decision and the linearity guard

**Decision: main thread, inside the load effect, with the cost measured and the ratio guarded.** The observations are already resident on the main thread (`observationsCache`), so a worker would owe a hand-over (packed or cloned) that costs more than the pass it would move: the Statistics hand-over measured 620 ms of packing at 1M rows against 35 ms for this pass at 150k rows. `confirmExcludedNames` and `buildCoverIndex` already run exactly this shape on the main thread for Calendar, Species Detail and Map Explorer. Passes 1 and 2 run once per epoch in the effect after the awaited loads; pass 3 runs in a `useMemo` and is species-scaled. No `Date` is constructed anywhere in the module.

**The guard: `lib/lifeListsLinearity.test.ts`**, `testTimeout: 60_000` stated in the file:

- Generates backups of N = 20,000 and 10N = 200,000 rows (flat strings, `[...].join('')`-built fields, testing.md v1.0.46) with a distinct-species leg (every row its own species, so the per-key path runs at volume, security.md v1.0.41) and a repeated-species leg (200 species), and ML exports of M and 10M rows likewise.
- Times `deriveFirstSightings`, `deriveFirstAssets` and `selectRows` through `bestPerCallCpuMs` with interleaved legs and a rotating start.
- Asserts each per-call CPU quotient `t(10N) / t(N) <= 20` (linear is 10; the margin is 2x, the house margin for a doubling guard's 3.2 against 2), and names the collector residual in the file.
- Non-vacuity: a mutant that replaces the Map lookup in pass 1 with a `for` search over the output array is run in the same file behind a flag only the test uses, and must exceed the limit on the distinct-species leg; a structural row asserts the module has no nested loop over rows (the absence guard in section 7).
- A capped-replica row first (testing.md v1.0.33): the pass over 1,000 rows completes in under the wall-clock step before the timed legs run, so a hang cannot sit behind the `testTimeout`.

---

## 9. Guards, rosters and rule-file `paths` the build owes

Rows owed in tab-enumerating guards (the Targets precedent, `pipeline/targets-tab/schema.md` 6.3):

- `components/TabLoadErrorAlert.test.tsx` `ROSTER` 9 → 10 (`epochDriven: true`).
- `components/honestLoadFailures.test.tsx` `EBIRD_MESSAGE_TABS`: one row with `setupTitle: /eBird Backup Required/`.
- `lib/helpToc.test.ts`: 18 → 19 sections, `## Life Lists` between `## Checklists` and `## List Comparer`.
- `components/TabNav.test.tsx`: the hand-written tab count and the index expectations after `checklists` move by one.
- `lib/tabLayout.test.ts`, `lib/paletteRows.test.ts` / `components/CommandPalette.test.tsx` (via `test/alphaCodeRoster.ts`'s `DEFAULT_ITEMS`, which derives from `DEFAULT_TAB_ORDER` and needs no edit), the `Settings*.test.tsx` rows that count tabs.
- `lib/entryChunk.test.ts`: a negative that `App.tsx`'s static graph does not reach `lib/lifeLists.ts`, `lib/lifeListsProvenance.ts` or `components/lifeLists/LifeListsTab.tsx`, with the positive leg that the tab's own closure does (testing.md v1.0.23); `lib/tabLayout.ts` and `lib/tabIcons.tsx` stay on the entry chunk by design (NFR-06).
- `lib/tabOrderCoverage.test.ts` passes without an exclusion: no `tabIndex` on any `Button` / `Link`; the one `tabIndex={-1}` focus anchor (section 6.2) is a `div`, outside its population, and the Engineer confirms the roster's cardinality is unchanged.
- `lib/androidReadings.test.ts`, `lib/androidInsetsCss.test.ts`: pass unchanged (no platform predicate, no safe-area rule; NFR-08). If the Designer adds an `.sr-ios-app` rule, its `.sr-android-app` twin ships beside it.
- `exoticProvenanceGraph.test.ts`, `settingsRouteBudget.test.ts`, `exoticProvenanceCache.test.ts`, `clearDerived.test.ts`, `exoticProvenance.test.ts`: sections 3.1 to 3.7.
- **QA-54 (FR-42, position):** `lifeLists.test.ts` asserts, over a generated roster, that positions are `rows.length` down to 1 in display order, that a media selection renumbers from its own count, and that `pageList` slices carry the same positions (page two's first row is `total - PAGE_SIZE`); `LifeListsTab.test.tsx` asserts the visible number is `aria-hidden` and the `.sr-only` "N of M." prefix sits inside the name cell with M equal to the count sentence's figure.
- **QA-55 (FR-43, scientific name and marks):** `lifeLists.test.ts` asserts the binomial is the first-sighting observation's (a species whose first sighting is a subspecies row `Junco hyemalis oreganus` yields `Junco hyemalis`; a later observation with a different cell changes nothing; a media row keeps the sighting's binomial; a blank cell yields `''`; a 40,000-character cell is cut at the cap with no scan past it). `LifeListsTab.test.tsx` renders `BirdName` with `showSci`, asserts `.sr-birdname-sci` holds the binomial, and asserts the two `SpeciesLinks` openers appear once `taxonMap` resolves and are absent while it is pending or after a rejection; the request-count rows are in section 5.4.
- **QA-56 (FR-44, media cell):** `lifeLists.test.ts` asserts `media` reports presence per format from the first-asset records and is identical under every selection; `LifeListsTab.test.tsx` asserts the cell is `role="img"` with the fixed-order label ("Media: photo, audio" / "No media"), is not in the tab order (`tabOrderCoverage.test.ts`'s roster unchanged), and is absent from every row in the `none` and `unreadable` ML states.
- `lifeListsCopy.test.ts` sweeps `mediaLabel` over all eight presence combinations beside the eight count sentences.

Rule-file `paths` extensions, in the same change that adds the files (CLAUDE.md, v1.0.32):

| Rule file | Glob to add | Why |
|---|---|---|
| `.claude/rules/security.md` | `"frontend/src/lib/lifeLists*.ts"`, `"frontend/src/lib/exoticProvenance.ts"`, `"frontend/src/lib/pageList.ts"` | Section 7's scans; the generalized confirmation; a helper that slices by a count read from state (not from a file, but gated beside its backlog twin for the same reason) |
| `.claude/rules/bird-names.md` | `"frontend/src/lib/lifeLists*.ts"`, `"frontend/src/components/lifeLists/**"` | The countable fold and `<BirdName>` rendering with `showSci` and a taxon code. `SpeciesLinks` is reached only through `BirdName` (the component never imports it), and `SpeciesLinks.tsx` is already in this file's and `security.md`'s globs, so the marks owe no further path |
| `.claude/rules/ui.md` | `"frontend/src/lib/lifeListsCopy.ts"`, `"frontend/src/lib/pageList.ts"` | Display copy generated from a manifest; the long-list control (components are already under `components/**`) |
| `.claude/rules/testing.md` | `"frontend/src/lib/lifeLists*.fixture.json"` (only if the Engineer adds a JSON fixture) | Fixtures are production inputs here |
| `.claude/rules/docs-and-website.md` | none (`docs/**` and `HelpDocs*.tsx` already match) | |

---

## 10. Help and published copy

- `docs/HELP.md`: a `## Life Lists` section directly after `## Checklists`, in the house register (what the tab shows, the two switches and that their status comes from the Statistics exotic status check, the three media buttons and the combined-date rule in one sentence, that the controls reset on relaunch), no U+2014, American spelling, serial comma. The Getting Started and Default Files sentences that list the tabs reading the eBird backup and the ML export add "Life Lists". Written in the build without a stop (CLAUDE.md, in-app text).
- `pipeline/life-lists-tab/held-copy.md`: at most one proposed sentence each for `README.md`, `website/index.html` and `appstore/LISTING.md`, plus the "What's New" and Fastlane changelog line for the version bump, each shown as before and after. NOTHING is written to those surfaces, to `PRIVACY_POLICY.md` or to `fastlane/metadata/` before the user's explicit yes (FR-41; CLAUDE.md, published copy). The privacy policy needs no change: no third-party request, no new endpoint or host, no request moved between components (the one `/taxonomy/codes` post is an existing route the browser-side tabs already call, local on Tauri), no new stored document, and the one modified document is already described.

---

## 11. The version bump set (for the Deployer)

A feature, so a patch bump: 1.0.61 → 1.0.62 (read off `main` at ship time). The SIX-file set, all guarded: `frontend/package.json`; `src-tauri/tauri.conf.json` (`version`, `bundle.android.versionCode = 1000062`); `CHANGELOG.md`; `website/index.html` (the `version-pill` text AND its `aria-label`, and the `footer-version` line); the three Fastlane changelogs `fastlane/metadata/android/en-US/changelogs/10000621.txt`, `10000622.txt`, `10000624.txt` with the same text and none under `1000062.txt` (published copy: after the user's yes, present AT the tag); and `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` (`CurrentVersion: 1.0.62`, `CurrentVersionCode: 10000624`, the three per-ABI `Builds` entries). Then the all-platforms rhythm through the `snowraven-release` skill, the ASC query, and the `RELEASE_LEDGER.md` sentences for both legs. The iOS plist stamp follows at the TestFlight step.

---

## 12. Design decisions

1. **Incremental, not Frontend Only**, because a stored, validated, purged document gains a field (section 3). Reversal condition: none; the PRD's OQ-2 default requires the publication.
2. **Optional field on the existing key, `null` for unpublished**, over a key-suffix bump (section 3.2). What would reverse it: a change that makes an old document MISREAD, which an added optional field with a defined absence is not.
3. **Exotic is a separate predicate, not a fifth `ProvenanceClass`**, so Statistics' counts are provably untouched (section 3.1).
4. **One publish function for both lists**, one write, replacing `publishExcludedNames` (section 3.2).
5. **The tab reads the epoch itself** (`useFilesEpoch()`), not through a prop, so the roster row's re-trigger is the signal (section 5.1).
6. **Main thread, measured, ratio-guarded** (section 8); a worker is the reversal if the measured per-load cost at the 150k-row cap exceeds about one second on the slowest shipped engine, which the scratch figures put an order of magnitude away.
7. **The binary-file repair ships first, in its own commit** (section 3.7), because a feature diff that git cannot show is a review gap, and the testing rule already prescribes exactly this repair for this file.
8. **`pageList` is extracted rather than `weatherBacklog.ts` imported**, so the Life Lists chunk does not carry weather code and the backlog's tests prove the extraction changed nothing (section 6.2).
9. **Time is re-formatted from the parsed minute on both sources** rather than echoed from the backup, so one formatter and one dash rule serve both (section 2.6).
10. **The QA-15 `buildCoverIndex` assertion is a symbol scan, not a graph edge**, for the structural reason in section 3.6.
11. **A species name sort is the one super-linear-in-a-degenerate-file residual** (S6), bounded by the upload cap and shared with every other name-sorting surface; stated rather than closed.
12. **Position is assigned on the row after the FR-28 sort, over the final roster for the current selection** (D-10, FR-42), so it renumbers per selection and is independent of paging; the component renders it and never derives a second numbering (section 2.4 step 5).
13. **Scientific name and the species-link marks, reversing OQ-6 and the PRD's original FR-39** (D-11, FR-43): the binomial comes from the first-sighting observation's own cell, capped at two tokens and 96 characters (S8), never from the ML export; the codes come from ONE Checklists-shaped `/taxonomy/codes` post per roster name set, read through `Object.hasOwn`, never blocking the list (section 5.4). The tab's request statement is now "exactly one `/taxonomy/codes` post per derivation, zero other requests" (the amended FR-39 and QA-41). The codes are NOT used to classify exotics; the published list stays (section 3.1's declined alternative).
14. **Per-row media presence is a passive `role="img"` cell read off the first-asset records** (D-12, FR-44), identical under every selection, omitted when the ML export is absent or unreadable; the Quiet treatment ships unless the user picks Count or Off at the gate, with no setting either way. The card's right rail is the one px-floored column of D-13, which is layout and owes nothing here.
