# Schema: Life Lists Region Filter

**Feature:** life-list-region-filter
**Date:** 2026-11-09
**Stage:** 3, The Architect (hands-off: the path is declared here and proceeded on)
**Source:** strategic-brief.md, prd.md (31 FRs, 7 NFRs, 34 QA rows, 7 open questions decided on their defaults except OQ-5, which is decided here)
**Extends:** `pipeline/life-lists-tab/schema.md` (the tab's three passes, its copy module, its load effect and its codes batch; cumulative state carried forward from it by reference), `pipeline/targets-tab/schema.md` (the `targetsCounty` preference, the precedent for a remembered region)
**Ships as:** one patch bump across the six-file set (section 9). `main` is at 1.0.69, so this ships as 1.0.70 unless another ship lands first; the Deployer reads the number off `main` at ship time, never off this document.

## Path

Incremental (extending the existing data layer: one new validated key in the settings document, one new pure derivation module over the two parsed files, two small additions to the existing derivation module).

## Architect assessment

> **Architect assessment: Incremental**
>
> SnowRaven has no database. Its data layer is the set of documents under `AppLocalData/data/` (mirrored by the web/Pi backend), the epoch modules that announce a change to them, the durable caches keyed through the `storage` seam, and the pure `lib/` modules that derive what the UI shows. This feature is mostly a pure derivation over the two parsed files, which on its own would be Frontend Only. It is not, because FR-22 to FR-25 write a new key, `lifeListsRegion`, into `data/settings.json` (the web/Pi `settingskv` store) through `storage.setSetting`, read it back during the tab's load and validate it on read. A new persisted, validated key is a data-layer change, so the path is Incremental. Proceeding on this assessment per the hands-off run.

Two things settled by reading the code rather than the PRD alone: the shipped `selectRows` reads the media presence cell (tab FR-44) from the same map it selects assets from, so handing it a regional asset map would make the presence cell regional, which FR-12 forbids; it gains one defaulted parameter (section 2.6). And the PRD's FR-02 and QA-02 disagree on whether a county is offered under a State/Province cell with no hyphen; this schema follows QA-02 and FR-02's own "never under a country alone" clause (section 2.2, flagged in the hand-back).

---

## Current schema state (cumulative, after this feature)

Everything in `pipeline/life-lists-tab/schema.md`'s "Existing data model" table stands unchanged, and that document's sections 2 to 6 describe the tab as it ships today. What changes is one row in the settings document and the set of in-memory derivations the tab builds.

### Stored documents (unchanged unless named)

| Document | This feature |
|---|---|
| `data/ebird-backup.csv`, `data/ml-export.csv`, `data/metadata.json` | Read only, through `loadEbirdObservations()` and `loadMLExport()` exactly as today. Not modified |
| `data/settings.json` (Tauri; the web/Pi `settingskv` route, one file per key) | GAINS one key, `lifeListsRegion` (section 3). Every other key (`targetsCounty`, `map-defaults`, `icloud-sync`, the derived stores that live here) is untouched |
| `data/api-keys.json`, `data/barcharts.json`, `data/barcharts/<regionCode>.txt`, `data/county-day-obs.json`, `data/replay.json` | Not touched |
| Derived stores (`exotic-provenance-v1`, `county-completeness-v1`, `hotspot-activity-v1`, `checklist-projects-v1`, `hotspot-regions`, the replay store) | Not touched. The tab keeps reading `exotic-provenance-v1` passively through `lib/lifeListsProvenance.ts`; nothing new is published to it |
| iCloud Sync item kinds (`ITEM_SUBDIRS` and the Rust twin) | Not touched (FR-27) |
| `lib/clearDerived.ts` registry | Not touched (FR-27). `lifeListsRegion` is a preference keyed on nothing, like `targetsCounty` |

### The settings document's preference keys, for the record

| Key | Value shape | Writer | Validation on read | Cleared by |
|---|---|---|---|---|
| `targetsCounty` (shipped) | `"US-CA-001"` | `components/targets/Targets.tsx` | `isRegionCode` | the next choice only |
| `map-defaults` (shipped) | `{ lat, lng, dist }` | `Settings.tsx` | its own | Settings' Clear button (`deleteSetting`) |
| **`lifeListsRegion` (new)** | `{ level: 'country' \| 'state', code }` or `{ level: 'county', code, county }`; absent when the list is unfiltered | `components/lifeLists/LifeListsTab.tsx` | `parseStoredRegion` (section 3.2) | choosing Everywhere (`deleteSetting`); otherwise the next choice |

### In-memory derivations of the Life Lists tab, after this feature

```
pass 1   deriveFirstSightings(observations)                 O(rows)        world firsts, UNCHANGED
pass 1R  deriveRegionIndex(observations)                    O(rows)        NEW: regional first-sighting slots, the checklist-to-cells join, the choices
pass 2   deriveFirstAssets(mlRows)                          O(mlRows)      world first assets, UNCHANGED
pass 2R  deriveRegionAssets(mlRows, index.join)             O(mlRows)      NEW: regional first-asset slots
press    regionFirsts(index, region, observations)          O(S_region)    NEW: materializes the selected region's first-sighting records
press    regionAssets(assetIndex, region, mlRows)           O(S_region)    NEW: materializes the selected region's first-asset records
pass 3   selectRows(firsts, assets, provenance, controls, presence)   O(S log S)   one defaulted parameter added
```

Passes 1, 1R, 2 and 2R run once per files epoch inside the load effect. The two `press` materializations and pass 3 run in memos keyed on the selected region and the control state. The unfiltered state hands pass 3 the same two maps it receives today, so FR-05 is structural (section 4.3).

---

## Changes in this feature

### Added

1. **`frontend/src/lib/lifeListsRegion.ts`**: the region module (section 2): the two region passes, the two materializers, the choice list, the stored-value validator, the labels, the three constants. Named so it lands inside `security.md`'s and `bird-names.md`'s existing `frontend/src/lib/lifeLists*.ts` globs (CLAUDE.md, v1.0.32); no glob is extended (section 5).
2. **`frontend/src/lib/lifeListsRegion.test.ts`** and rows in `lifeListsLinearity.test.ts`, `lifeListsCopy.test.ts`, `components/lifeLists/LifeListsTab.test.tsx` (sections 6 and 7).
3. **The `lifeListsRegion` key** in the settings document (section 3).
4. **The Region control**, `frontend/src/components/lifeLists/LifeListsRegionControl.tsx` (the Designer names and shapes it; this schema fixes only its data contract and its id rule, section 4.4).
5. **Region-aware copy builders** in `lib/lifeListsCopy.ts` (section 4.5).
6. **`docs/HELP.md` "## Life Lists"** additions (FR-30) and **`pipeline/life-list-region-filter/held-copy.md`** (FR-31), section 9.

### Modified

1. `lib/lifeLists.ts`: `selectRows` gains a fifth parameter `presence: ReadonlyMap<string, FirstAssets> = assets` (section 2.6); the record constructors inside pass 1 and pass 2 are extracted as exported `firstSightingRecord` and `firstAssetRecord` so the materializers build byte-identical records (section 2.5). Outputs for every existing call are unchanged, and QA-05's golden comparison is the proof.
2. `lib/lifeListsCopy.ts`: `countSentenceParts`, `countSentence` and `emptySentence` take an optional region label; with none passed they return today's strings byte for byte (section 4.5).
3. `components/lifeLists/LifeListsTab.tsx`: the load effect also reads the saved region and runs passes 1R and 2R; the ready phase carries the index, the asset index, the ML rows and the remembered region; the region state, the press handler and the write (section 4).
4. `components/lifeLists/LifeListsControls.tsx`: hosts the Region control in the strip (placement is the Designer's; OQ-4's default is first).
5. Guards: `lifeListsLinearity.test.ts`, `lifeListsCopy.test.ts`, `LifeListsTab.test.tsx`, `exoticProvenanceGraph.test.ts`, `entryChunk.test.ts`, `lifeListsPublishedClaims.test.ts` (section 7).

### Unchanged (used, not modified)

`storage.ts` (both transports' `getSetting`, `setSetting`, `deleteSetting`; the settings document's `docChains` link is what a `setSetting` call already is), `transport.ts`, the `/taxonomy/codes` batch effect in `LifeListsTab.tsx` (section 4.2), `lib/lifeListsProvenance.ts` and the status line (section 4.2), `deriveFirstSightings`, `deriveFirstAssets`, `compareInstant`, `compareDisplay`, `placeOf`, `dayKey`, `minuteOf12h`, `minuteOfMlClock`, `binomialOf`, `pageList.ts`, `regionNames.ts` (`regionName` is called, not changed), `regionCode.ts`, `observationsCache.ts`, `mlExportCache.ts`, `parseEbirdObservations.ts`, `parseMLExport.ts`, `speciesUtils.ts`, `filesChanged.ts`, `useFilesEpoch.ts`, `clearDerived.ts`, `cacheInventory.test.ts`, `exoticProvenanceCache.ts`, `exoticProvenance.ts`, `useExoticProvenance.ts`, `tabLayout.ts`, `tabIcons.tsx`, `App.tsx`, every other tab, every backend file (`backend/routers/settingskv.py` already carries any key matching `^[A-Za-z0-9._-]{1,128}$`, caps a value at 16 MiB, answers 404 for an absent key, which the seam reads as `null`, and treats DELETE of an absent key as a no-op success), every `lib/tauri/` service, `src-tauri/**`, `frontend/vite.config.ts` (`/settings` is already proxied), `PRIVACY_POLICY.md`. No new route, no Vite proxy entry, no CSP entry, no http permit entry, no `docChains` key, no `clearDerived.ts` row, no epoch module, no `uploadGuard` change, no iCloud item kind.

---

## 1. Data flow, stated once

```
storage.getFilesStatus()                      -> { ebird, ml }
loadEbirdObservations()                       -> ObservationEntry[]        (shared cache)
loadMLExport()                                -> MLExportRow[] | null      (shared cache, optional)
storage.getSetting('lifeListsRegion')         -> unknown                   (NEW, concurrent with the two loads; a rejection reads as null)

pass 1   deriveFirstSightings(obs)            -> Map<norm, FirstSighting>                    UNCHANGED
pass 1R  deriveRegionIndex(obs)               -> { firsts: RegionTiers<SpeciesSlots>, join: Map<sub, ChecklistCells>, choices }   NEW
pass 2   deriveFirstAssets(ml.rows)           -> Map<norm, FirstAssets>                      UNCHANGED
pass 2R  deriveRegionAssets(ml.rows, index.join) -> RegionTiers<AssetSlots>                  NEW
remembered = parseStoredRegion(saved)         -> RegionRef | null                            NEW

region   = the session choice if one was made this session, else the remembered value; applied only if findChoice(index.choices, want) matches, else null (unfiltered)
firsts   = region ? regionFirsts(index, region, obs) : pass 1's map
assets   = region ? regionAssets(assetIndex, region, ml.rows) : pass 2's map
pass 3   selectRows(firsts, assets, provenance, controls, pass 2's map)   -> LifeListRow[]   presence stays global (FR-12)
codes    transport.post('/taxonomy/codes', { species })   ONE per WORLD roster name set       UNCHANGED (section 4.2)
write    on a user choice: setSetting('lifeListsRegion', region) or deleteSetting('lifeListsRegion') for Everywhere, best-effort
```

**The request statement, in the durable form (FR-29):** the feature makes no third-party request, adds no endpoint or host, and moves no request between components. The one existing `/taxonomy/codes` post is unchanged in shape, count and trigger. On web/Pi the HTTP this feature adds is one `GET /settings/lifeListsRegion` per load (to the user's own server, with the seam's existing error handling) and one `POST` or `DELETE` on that key per user choice, carrying `APP_REQUEST_HEADERS` because `WebStorage.setSetting` and `deleteSetting` already do. In the Tauri apps those are a chained read and a chained write of `data/settings.json`. No request a system component makes from the app's process is added.

---

## 2. The region module: `frontend/src/lib/lifeListsRegion.ts`

Pure, no I/O, no clock, no React, no network import. Imports from `./lifeLists` (`dayKey`, `minuteOf12h`, `minuteOfMlClock`, `compareInstant`, `placeOf`, `firstSightingRecord`, `firstAssetRecord`, `STATE_CODE_SCAN_CHARS`, the types), from `./speciesUtils` (`normalizeSpeciesName`, `isNonCountableForm`), from `./regionNames` (`regionName`), and the two row types. Test file: `lifeListsRegion.test.ts`, which carries the same comment-stripped absence guard `lifeLists.test.ts` carries (no `.includes(`, `.indexOf(`, `.find(`, `.filter(`, `.match(`, `.search(`, `.split(`, `RegExp`, no regex literal), so every read below is a hand loop or a Map operation.

### 2.1 Shapes

```ts
export type RegionLevel = 'country' | 'state' | 'county'

/** A region as the backup spells it. `code` is the country part for a country,
 *  the whole State/Province cell for a state or a county. Never rendered: the
 *  matched choice's label is what renders (FR-25). */
export type RegionRef =
  | { readonly level: 'country'; readonly code: string }
  | { readonly level: 'state';   readonly code: string }
  | { readonly level: 'county';  readonly code: string; readonly county: string }

export interface RegionChoice { readonly region: RegionRef; readonly label: string }

/** FR-04: three groups, each sorted by label with localeCompare, each de-duplicated by identity (the Map keys). */
export interface RegionChoices {
  readonly countries: readonly RegionChoice[]
  readonly states: readonly RegionChoice[]
  readonly counties: readonly RegionChoice[]
  readonly total: number
}

/** One slot per (region, species) or (region, species, format): the INDEX of the
 *  dating row in the parsed array it came from, with its instant cached so the
 *  comparison never re-reads the row. The record is materialized at press time
 *  for the selected region only (2.5). */
export interface Slot { readonly day: number; readonly minute: number | null; readonly i: number }

export type SpeciesSlots = Map<string, Slot>                                  // normalized name -> slot
export type AssetSlots   = Map<string, { Photo?: Slot; Audio?: Slot; Video?: Slot }>

/** The three levels as three Map tiers, keyed by the parsed cells themselves.
 *  No composite string key, so no delimiter and no collision argument: a county
 *  is reached as counties.get(stateCell).get(countyCell). */
export interface RegionTiers<T> {
  readonly countries: Map<string, T>               // country part -> T
  readonly states:    Map<string, T>               // State/Province cell (hyphenated only) -> T
  readonly counties:  Map<string, Map<string, T>>  // State/Province cell -> County cell -> T
}

/** FR-13: the cells of a checklist, from its first observation in file order. */
export interface ChecklistCells {
  readonly country: string; readonly state: string; readonly county: string; readonly hyphenated: boolean
}

export interface RegionIndex {
  readonly firsts: RegionTiers<SpeciesSlots>
  readonly join: Map<string, ChecklistCells>       // submission id -> cells
  readonly choices: RegionChoices
}
export type RegionAssetIndex = RegionTiers<AssetSlots>

export const LIFE_LISTS_REGION_SETTING = 'lifeListsRegion'
/** The county cell bound, the same kind as BINOMIAL_SCAN_CHARS (96): the longest
 *  county name in eBird's US and Canada sets is under 40 characters. */
export const COUNTY_CELL_MAX_CHARS = 96
```

A `Map` keyed by a cell out of the user's CSV has no prototype keys, so a `__proto__` state or county is an ordinary key (security.md, the v1.0.22 family). The `AssetSlots` inner object is keyed by the closed `MediaFormat` union, never a file string, exactly as `FirstAssets` is today.

### 2.2 Levels, membership and the cell bounds (FR-02, FR-03, FR-11)

For an observation with State/Province cell `sp` and County cell `c`:

- **Eligible cells.** `sp` must be a non-empty string of at most `STATE_CODE_SCAN_CHARS` (16) characters; `c` is taken as the cell when it is a string of at most `COUNTY_CELL_MAX_CHARS` (96) characters, else as `''`. An observation whose `sp` is empty, missing or over the bound contributes to no level and belongs to no region (FR-03). **Deviation from FR-02's "exactly as the parser delivers them", declared:** the PRD bounds the STORED parts at 16 and 96 (NFR-04) but not the offered ones, which would let a hostile cell become a choice whose label is unbounded in the DOM and which can never be saved and read back. Bounding the offer at the same figures keeps "every offered region is a valid stored region" true by construction (a test row asserts it over a generated corpus) and costs no real backup anything: eBird's longest subnational code is 6 characters. The hand-back flags it for the Planner.
- **Country** = `countryOf(sp).country`: the text before the first hyphen within the cell, or the whole cell when it has none (`hyphenated` false).
- **State/province** = `sp`, only when `hyphenated`.
- **County** = the pair (`sp`, `c`), only when `hyphenated` AND `c !== ''`. **This follows QA-02 ("an observation with county 'Marin' and no hyphenated state yields no county choice") and FR-02's "a county is never offered under a country alone"; FR-02's first sentence reads as if the pair were offered under any non-empty State/Province cell, and the Planner should align its wording.** eBird counties exist only under a subnational1 code, so no real backup meets the case.
- **Membership (FR-11)** is realized by insertion, not by a predicate at press time: each eligible row is inserted under its country key, under its state key when hyphenated, and under its (state, county) keys when hyphenated with a county. Exact Map-key equality on the parsed text is the comparison, so `"us-ca"` and `"US-CA"` are two keys (QA-11).

`countryOf` is memoized per DISTINCT `sp` inside one pass (`Map<string, { country, hyphenated }>`), so the 16-character scan and the one short slice run once per distinct cell, not once per row.

### 2.3 Pass 1R: `deriveRegionIndex(obs: readonly ObservationEntry[]): RegionIndex`

One `for` loop over `obs`. Per row, cheapest rejection first:

1. `sp = o.stateProvince`; continue unless a string with `0 < length <= 16`.
2. `sub = o.submissionId`; continue when `''`.
3. `cells = memo.get(sp)` or compute `countryOf(sp)` and memoize; `c = o.county` when a string of length `<= 96`, else `''`.
4. **Join (FR-13):** `if (!join.has(sub)) join.set(sub, { country, state: sp, county: c, hyphenated })`. Set BEFORE the countability and date gates, because a checklist's cells come from any of its rows (a checklist holding only a spuh still places its assets). First observation in file order governs, as FR-13 says.
5. `day = dayKey(o.date)`; null continues. `isNonCountableForm(o.commonName)` continues. `name = normalizeSpeciesName(o.commonName)`; `''` continues. `minute = minuteOf12h(o.time)`. These are pass 1's gates in pass 1's order, so the eligible set is pass 1's (FR-01).
6. `put(tier(firsts.countries, country), name, day, minute, i)`; if `hyphenated`, `put(tier(firsts.states, sp), ...)`; if `hyphenated && c`, `put(tier(tier2(firsts.counties, sp), c), ...)`.

`put(slots, name, day, minute, i)` keeps the earlier slot under `compareInstant(day, minute, cur.day, cur.minute)`, and on an exact tie the smaller submission id by code-unit comparison, reading `obs[cur.i].submissionId` only on the tie (tab FR-11's order, so a regional first is decided by the same rule as the world first, QA-10).

After the loop, `choices` is built from the tiers' KEY SETS, never from a separate accumulator, so a region is offered exactly when it holds a slot (FR-01): countries from `firsts.countries.keys()`, states from `firsts.states.keys()`, counties from each `(sp, c)` pair in `firsts.counties`. Each gets its label (2.7) and each group is sorted by `label.localeCompare`. `total` is the sum.

### 2.4 Pass 2R: `deriveRegionAssets(rows: readonly MLExportRow[], join: ReadonlyMap<string, ChecklistCells>): RegionAssetIndex`

One `for` loop over the ML rows. Per row: `day = dayKey(row.date)` (null skips), the `format` check pass 2 makes, `name = row.commonName` (already normalized; `''` skips), `cid = row.checklistId` (`''` skips: FR-14), `cells = join.get(cid)` (`undefined` skips: FR-14, an id the backup does not hold), `minute = minuteOfMlClock(row.time)`. Then the same three insertions as 2.3 step 6 under `cells.country`, `cells.state` (when `cells.hyphenated`) and `(cells.state, cells.county)` (when hyphenated with a county), into the per-species per-format slot, keeping the earlier under `compareInstant` with `catalogId` as the tiebreak (tab FR-22's order), reading `rows[cur.i].catalogId` only on a tie. The ML row's own `county`, `location`, `latitude` and `longitude` are never read here (FR-16; QA-16 is structural: the pass does not touch them).

### 2.5 Materialization at press: `regionFirsts` and `regionAssets`

```ts
export function lookupTier<T>(tiers: RegionTiers<T>, region: RegionRef): T | undefined   // O(1): one or two Map gets
export function regionFirsts(index: RegionIndex, region: RegionRef, obs: readonly ObservationEntry[]): Map<string, FirstSighting> | null
export function regionAssets(assets: RegionAssetIndex | null, region: RegionRef, rows: readonly MLExportRow[]): Map<string, FirstAssets>
```

`regionFirsts` returns `null` when the region holds no slots (not offered), else a fresh `Map` with one `firstSightingRecord(obs[slot.i], name, slot.day, slot.minute)` per slot: the SAME constructor pass 1 uses (extracted from `deriveFirstSightings` in this change, output byte-identical), so the regional record carries that observation's binomial, time, checklist, location and `placeOf` place (FR-10, FR-12), computed once per regional species per press, never per row. `regionAssets` does the same with `firstAssetRecord(rows[slot.i], slot.day, slot.minute)` per (species, format) slot, and returns an empty map when the asset index is absent or the region has no assets. Both are species-scaled: `S_region` records, at most three asset records per species.

**Why slots rather than full records in the index.** An index of full records holds up to three `FirstSighting` objects per eligible row (each with a fresh binomial string); a slot is three numbers. On the generated every-row-distinct worst case (section 5.4) the slot index measured 67 MB of heap at 450,000 entries; the full-record form is roughly double that. The materialization costs `S_region` record builds per press (about a millisecond at 3,000 species), which the design accepts in exchange.

### 2.6 `selectRows` gains a `presence` parameter (FR-12, FR-15)

```ts
export function selectRows(firsts, assets, classification, controls, presence: ReadonlyMap<string, FirstAssets> = assets): LifeListRow[]
```

The media presence cell is read from `presence` (`presence.get(name)`), the selection from `assets`, everything else is unchanged. With the parameter omitted the function is byte-for-byte today's, which every existing call and QA-05's golden rely on. Under a region the tab passes the regional firsts and regional assets with the WORLD asset map as `presence`, so: a species appears only if it is on the regional roster (it iterates `firsts`), only if it has an in-region first asset in every selected format (`assets` is regional, FR-15), and its presence marks stay what it has anywhere (FR-12, QA-12). Order, positions and the combined-date rule are unchanged because the function body after the two lookups is unchanged (FR-18, QA-15, QA-18).

### 2.7 Labels: `regionLabel(region: RegionRef): string`

- country: the English NAME of the code, resolved offline from the engine's own locale data through `Intl.DisplayNames` (the user's direction at the design review, amending OQ-2; the PRD is being amended to match): `countryDisplayName(code)` in `lifeListsRegion.ts` constructs `new Intl.DisplayNames('en', { type: 'region', fallback: 'code' })` ONCE per module, lazily, inside a `try/catch` (a missing or throwing constructor leaves a module-level `null` and every country labels as its code; the tab never breaks), and wraps `.of(code)` so a `RangeError` (a code outside the `unicode_region_subtag` grammar, which a hostile cell can be), an `undefined` return, or a return equal to the input all yield the code itself. "US" labels "United States", "MX" "Mexico"; a code the engine cannot name shows as itself. The result is memoized per distinct country code in a module `Map` bounded by the distinct cells (5.2). Platform check against the shipped floors: `Intl.DisplayNames` is Chromium 81+ (the Android floor is `ANDROID_WEBVIEW_FLOOR = 111`, `lib/webviewFloor.ts`), WebKit 14.1+ (every WKWebView on the app's iOS 16 and macOS 16 minimums), and WebView2 is evergreen, so no shipped engine takes the fallback except by locale-data gap. No bundled table, no network, no new host or endpoint: the locale data ships inside the engine. `regionNames.ts` is NOT extended with countries (it stays the state and province table) and nothing is added to the entry chunk.
- state: `regionName(region.code)`, which names US states and Canadian provinces offline and returns the code otherwise. Its internal `split('-')` runs over a cell already bounded at 16 characters by 2.2, once per distinct state choice, never per row.
- county: `placeOf(region.county, region.code)`, the Checklists place form "Marin, CA" (the existing S5 scan, once per distinct county choice).

Labels are computed when the choices are built (once per epoch) and stored on the choice; the control renders `choice.label` and the sentences interpolate it. A stored region's own text never reaches a label (FR-25): the label comes from the matched choice. The country group is ordered by its displayed label with `localeCompare`, as FR-04 already says for every group, so "Canada" sorts before "United States" whatever their codes. The name is DISPLAY only: identity, the Map keys, `findChoice`'s matching and the stored `RegionRef` all carry the code, never the name, so a locale-data difference between engines can change what a country is called and never which region is selected, matched or saved.

### 2.8 The stored-value validator: `parseStoredRegion(v: unknown): RegionRef | null`

Accepts exactly the shape the app writes: `v` is a non-null, non-array object; `Object.hasOwn(v, 'level')` and the value is one of the three literals; `Object.hasOwn(v, 'code')` and the value is a string of length 1 to 16; for `'county'`, `Object.hasOwn(v, 'county')` and a string of length 1 to 96; for the other two levels a `county` key, if present, is ignored. Anything else returns `null` (Everywhere), never throws (QA-25). The reads are `Object.hasOwn` because the object came from storage (security.md, v0.5.81), and the suite's malformed list includes `'__proto__'` and `'constructor'` shaped keys built through `JSON.parse`, a string, an array, an unknown level, each part at its bound and one past it.

`findChoice(choices: RegionChoices, want: RegionRef): RegionChoice | null` matches by level and exact part equality against the choice list (a loop over the one group, `C_level` comparisons of bounded strings; or an O(1) tier lookup followed by a label build, the Engineer's call, both species-independent and bounded by section 5.3). The matched choice's `region` object is what the tab holds as the effective region, so memo keys compare by identity within an epoch and the label is the choice's (FR-25).

---

## 3. The persisted setting

### 3.1 Decision: key `lifeListsRegion`, value `RegionRef`, absence for Everywhere (OQ-5, FR-22)

- **Key:** `LIFE_LISTS_REGION_SETTING = 'lifeListsRegion'`, declared once in `lifeListsRegion.ts` with a comment that it is a preference, never derived data (the `COUNTY_SETTING` comment in `Targets.tsx` is the model).
- **Value:** the matched choice's `RegionRef` as is: `{ "level": "county", "code": "US-CA", "county": "Marin" }`, under 200 bytes. By 2.2 every offered region is within the validator's bounds, so what is written always reads back.
- **Everywhere:** `storage.deleteSetting(LIFE_LISTS_REGION_SETTING)`. Absence is then literally absence on both transports (Tauri deletes the key from `settings.json` inside the document's chain; web/Pi's DELETE is an idempotent unlink), so a fresh install and an explicit return to Everywhere are the same document state, not merely the same read. `getSetting` returns `null` for an absent key on both transports (Tauri: `undefined` mapped to `null`; web: 404 read as `null`). Considered and declined: writing JSON `null`, which reads alike but leaves a key behind and makes "absence" a convention rather than a fact.
- **When:** only on a user choice (FR-22, FR-26): the select handler calls the write after `pressed()`; no effect writes it, so a load, an epoch, a switch press or a media press performs no write (QA-22, QA-26). Best-effort: `.catch(() => { /* a preference: best-effort */ })`, the `targetsCounty` form; a rejected write leaves the selection applied and renders nothing.
- **Where it lives in the seam:** `storage.setSetting` and `deleteSetting` are already links on `SETTINGS_PATH`'s `docChains` chain in `TauriStorage` and already spread `APP_REQUEST_HEADERS` in `WebStorage` (NFR-07). The feature builds neither; `storageWriteSerialization.test.ts` needs no new interleaving row because no new read-modify-write is introduced, only a new caller of the existing chained methods. The Engineer confirms that suite does not enumerate setting keys (it matched a grep for `setSetting(`; if it rosters writers, the key joins the roster).
- **Per device, not synced, not purged:** no `ITEM_SUBDIRS` kind, no Rust twin change, no `clearDerived.ts` row, no `cacheInventory.test.ts` pairing (FR-27, QA-26, QA-27). The key is keyed on nothing (a preference is read by its own name), which is the registry's own criterion for staying out.

### 3.2 Version marker: none

The value is written whole on every change and read through one validator. A future shape change is told apart by that validator: an unrecognized shape reads as Everywhere, the safe default, at the cost of one re-pick. That is cheaper and simpler than carrying a `v` field and a migration, and it is the `targetsCounty` precedent. Reversal condition: a later build that must MIGRATE an old shape rather than drop it adds the marker then (CLAUDE.md's "written whole on any change" rule applies at that point, not now).

### 3.3 Read timing (FR-23, FR-24)

The load effect reads the key in the same `Promise.all` as the two file loads, validates it, and puts `remembered: RegionRef | null` into the ready phase. The first ready render therefore already resolves the effective region (section 4.1) and renders that region's rows and selection; no render in between shows the unfiltered sentence (QA-23). A rejected read is `null`. The read repeats at every files epoch, so the stored value is consulted against each new choice set (FR-24) and a deletion by any future path is picked up at the next epoch; it costs one seam read per epoch beside the two file reads.

### 3.4 OQ-6: not removed on Clear, with the one-line reversal recorded

Decision: follow `targetsCounty`; nothing is deleted on Clear (FR-27). If the Security stage rules that a county name out of the user's file must not outlive a Clear of the eBird slot, the fix is one best-effort line in `Settings.tsx`'s clear path beside its `purgeDerivedOnClear(slot)` call (`storage.deleteSetting(LIFE_LISTS_REGION_SETTING).catch(() => {})` when the eBird slot is cleared), no registry row and no privacy sentence (the key holds one place name the user chose, overwritten by the next choice). The hand-back flags the one way this differs from the precedent: `targetsCounty` holds an eBird region code, `lifeListsRegion` may hold a county name as the file spells it.

---

## 4. The tab

### 4.1 State and resolution

```ts
type Phase = ... | {
  tag: 'ready'
  observations: readonly ObservationEntry[]       // the cache's own array (unchanged)
  firsts: Map<string, FirstSighting>              // pass 1 (unchanged)
  index: RegionIndex                              // pass 1R (new)
  ml: MlState                                     // 'ready' now also carries rows: readonly MLExportRow[] and regions: RegionAssetIndex
  remembered: RegionRef | null                    // the validated stored value, re-read each epoch
}

const [sessionRegion, setSessionRegion] = useState<RegionRef | null | undefined>(undefined)
//   undefined: no choice made this session (the remembered value governs)
//   null:      the user chose Everywhere this session
//   RegionRef: the user chose a region this session

const wanted   = sessionRegion !== undefined ? sessionRegion : ready.remembered
const choice   = wanted ? findChoice(ready.index.choices, wanted) : null     // null when absent from the current choices
const region   = choice?.region ?? null                                      // the EFFECTIVE region; null is Everywhere
```

A saved or session region absent from the current choices reads as Everywhere silently, with no write; `sessionRegion` is not cleared, so a region that returns with a later file applies again until the user chooses otherwise (FR-24, QA-24). The session choice is never reset by an epoch (the switches already behave this way).

### 4.2 Unchanged by design: the codes batch, the provenance hook, the status line

- **`/taxonomy/codes`** stays keyed on the WORLD roster (`codeRequest` is built from pass 1's keys in the load effect, as shipped). The regional roster is a subset of the world roster, so `codeFor(name)` resolves every regional row from the world map; a region press therefore issues zero requests (FR-29, QA-28) and the effect, `codesKey` and `taxonMap` are not touched. The Planner's recommendation is adopted; the code already has this shape, so adopting it is a matter of not changing it. Considered and declined: a per-region batch, which would issue a post per press and could not be deduplicated at the transport (the path has no enforcement point there, prior schema 5.4).
- **`useLifeListsProvenance(observations, rosterCodes)`** stays on the world observations and the world codes, so the escapee and exotic sets, `exoticsPublished` and `checkComplete` are what they are today and the status sentence is unchanged (FR-17, QA-17). `selectRows` applies the two sets by name to whichever `firsts` map it is given, which is FR-17's "act on the regional roster by species name".
- **`exoticProvenanceGraph.test.ts`** gains a no-network row for `lib/lifeListsRegion.ts` (it must reach neither `transport` nor `lib/tauri/*Service` nor `useExoticProvenance`), with the positive leg that `LifeListsTab.tsx` reaches it.

### 4.3 The selection memo (FR-05, FR-09, FR-28)

```ts
const regional = useMemo(() => {
  if (!ready || region === null) return null
  const firsts = regionFirsts(ready.index, region, ready.observations)       // never null here: region came from the choices
  const assets = ready.ml.tag === 'ready' ? regionAssets(ready.ml.regions, region, ready.ml.rows) : EMPTY_ASSETS
  return { firsts: firsts ?? EMPTY_FIRSTS, assets }
}, [ready, region])

const worldAssets = ready && ready.ml.tag === 'ready' ? ready.ml.assets : EMPTY_ASSETS
const rows = useMemo(() => {
  if (!ready) return []
  return regional
    ? selectRows(regional.firsts, regional.assets, provenance, controls, worldAssets)
    : selectRows(ready.firsts, worldAssets, provenance, controls)              // byte-for-byte today's call (FR-05)
}, [ready, regional, provenance, includeEscapees, includeExotics, effectiveFormats])
```

A region press calls the existing `pressed()` (paging reset, added-row snapshot, live-region re-key) and then `setSessionRegion(choice.region)` or `setSessionRegion(null)`, followed by the write (3.1). Nothing in the press path reads a row: `regionFirsts` and `regionAssets` walk slots for the one region, pass 3 walks species. Passes 1R and 2R run only in the load effect, so QA-06's call counter reads one build per epoch.

### 4.4 The Region control's data contract (FR-07, FR-08)

The Designer owns the control's shape (OQ-1: the `TargetsCountyPicker` combobox is the precedent; a native `<select>` with three `<optgroup>`s is acceptable). What this schema fixes:

- Props: `choices: RegionChoices`, `selected: RegionRef | null` (the effective region), `onSelect(region: RegionRef | null)`, `disabled` (true when `choices.total === 0`, FR-08: the control then offers Everywhere only and exposes it as selected).
- **Every DOM id and ARIA IDREF it mints is keyed on an index** over the flattened shown list plus a `useId()` prefix (`${uid}-opt-${i}`); a group heading id is `${uid}-grp-${level}` with `level` one of the three literals. No id, IDREF, `key` used as a selector, or URL ever contains a region's text (FR-07, QA-07, security.md v1.0.21).
- Every button-shaped part renders through `Button`; a combobox's input is a native control and is not in `tabOrderCoverage.test.ts`'s population; no `tabIndex` override, so the roster's cardinality is unchanged.
- Keyboard focus stays inside the control after a selection (FR-09): a combobox keeps focus on its input; a select is itself the focused element.
- If the control filters by typed text (the Targets shape), the haystack is `choice.label` per choice, compared once per keystroke over `C` choices with labels bounded by 2.7: declared as S14 in section 5.1. The haystacks are built once per epoch in a memo, never per keystroke.

### 4.5 Copy (`lib/lifeListsCopy.ts`)

`countSentenceParts(n, formats, region: string | null = null, order, copy)`, `countSentence(n, formats, region = null)`, `emptySentence(formats, region = null)`. With `region === null` each returns today's string byte for byte (the existing eight literals and two empties stay in the suite unchanged). With a label, FR-19's templates: `" species in {region}, newest first by the date of your first sighting there."`, `" species with {withNoun} in {region}, newest first by the date of {firstNoun} there."`, `" species with {list} in {region}, newest first by the date each had {both | all three} there."`; FR-20's two empties. New constants for the Designer's words: `REGION_CONTROL_LABEL` ("Region"), `EVERYWHERE_LABEL` ("Everywhere"), `REGION_GROUP_LABELS: Record<RegionLevel, string>`, `REGION_LIST_LABEL`, `REGION_NO_MATCH`, `REGION_PLACEHOLDER`. `lifeListsCopy.test.ts` sweeps the builders over the eight format sets times `{ null, a label }` (sixteen count sentences, four empties), asserts the region label appears exactly once in each regional sentence, and keeps the no-U+2014 sweep. The label is interpolated as text by React, never as markup.

---

## 5. Security declaration: scans, bounds and the measured-cost obligation

### 5.1 Reads over user-file text this feature adds

The prior schema's S1 to S9 stand. This feature adds the rows below, each a read over an already-parsed field, each with its own bound enforced inside the function (security.md v1.0.30), none a regex, none a native search without an end bound.

| # | Read | Where | Input | Bound and linearity argument |
|---|---|---|---|---|
| S10 | `countryOf(sp)`: the position of the first hyphen | `lifeListsRegion.ts` | `ObservationEntry.stateProvince` | Length gate first: a cell over `STATE_CODE_SCAN_CHARS` (16) is rejected in 2.3 step 1 before the scan. Then a hand loop over at most 16 code units and one `slice` of a parent at most 16 characters long (no long-parent retention, testing.md v1.0.13). Memoized per distinct cell within the pass, so it runs at most once per distinct State/Province value, at most `rows` times. This is the hyphen read NFR-03 names; `placeOf` (S5) reads the same cell for the part AFTER the hyphen and is reused for county labels, once per distinct county |
| S11 | The county cell length read | `lifeListsRegion.ts` | `ObservationEntry.county` | `c.length <= COUNTY_CELL_MAX_CHARS` (96), one length read per row; over the bound the row has no county. Not a scan |
| S12 | The Map-key insertions and the join | `lifeListsRegion.ts` | `stateProvince`, `county`, `submissionId`, the normalized name | Exact equality as Map keys: hashing a string of bounded length (16, 96, or a normalized name) per insertion, at most three insertions per row plus one join `has`/`set`. No comparison loop over keys |
| S13 | The choice sort | `lifeListsRegion.ts` | the labels of 2.7 | `C log C` `localeCompare` calls over labels bounded at the longer of 16 and the longest English region name the engine's CLDR data holds (under 64 code units; country), the longer of 16 and the longest offline region name (state), or 96 + 2 + 16 (county); `C <= 3 x` distinct pairs `<= 3 x rows`. The same primitive and the same residual class as S6; its linearity row derives its limit from `C log C` (section 6) |
| S13a | `countryDisplayName(code)` (2.7) | `lifeListsRegion.ts` | the country part of a State/Province cell | A display-time read of a parsed, length-bounded cell (at most 16 code units, gated in 2.3 step 1 before the part is ever cut), handed to the engine's `Intl.DisplayNames.of`, which is linear in that bounded input and throws `RangeError` on anything outside the two-letter or three-digit region grammar; the call sits in a `try/catch` and the result is memoized per distinct code, so it runs at most once per distinct country code per module lifetime, never per row and never per press. Not a new scan over user-file text and no `security.md` glob changes: the module is already inside the `lifeLists*.ts` gate. The no-network form of section 1 is unaffected: the locale data is inside the engine |
| S14 | The control's type-ahead (only if the Designer picks the combobox) | `components/lifeLists/LifeListsRegionPicker.tsx` | the labels | Per keystroke, one substring test per choice over a label bounded as in S13, against a query the user typed. `O(C x label)` per keystroke, `C <= 3 x rows`; the haystacks are built once per epoch. The Targets picker has the identical shape. The picker file, which holds this scan and mints the control's ids, matched no `security.md` glob, so this build added `frontend/src/components/lifeLists/LifeListsRegionPicker*.tsx` to that file's `paths` (security L1, decisions.md D-09) |
| S15 | `parseStoredRegion` | `lifeListsRegion.ts` | the stored value | Three `Object.hasOwn` reads, three `typeof` checks, three length reads against 16 / 16 / 96. No scan over the parts; they are only ever compared by exact Map-key equality |
| S16 | The materializers | `lifeListsRegion.ts` | `obs[slot.i]`, `rows[slot.i]` | `S_region` calls of `firstSightingRecord` (which runs S5 and S8 once each) and at most `3 x S_region` calls of `firstAssetRecord`, per press. Species-scaled; `S_region <= S` |

`regionName(code)` (2.7) calls `split('-')` on a cell already bounded at 16 characters, once per distinct state choice; it is an existing function at a new call site and is listed here so the reviewer sees it rather than finds it.

**Loops driven by a number read from the file: none.** `day` and `minute` are compared, never iterated; every loop is driven by the parsed arrays' lengths, the number of slots in one region, or the number of choices, each bounded below.

### 5.2 Bounded allocation (NFR-02): every region-sized structure and its two bounds

| Structure | Sized by | First bound (content-driven) | Second bound (the content cannot inflate) |
|---|---|---|---|
| `firsts` slot entries (all tiers) | (region, species) pairs with an eligible sighting | at most `(countries + states + counties) x S` | at most `3 x` eligible rows: each row inserts under at most three keys and an insertion either creates one entry or replaces one |
| Inner `Map`s (one per offered region) | distinct regions | at most `3 x` distinct (State/Province, County) pairs | at most `3 x rows` |
| `join` | distinct submission ids | one entry per distinct id | at most `rows` |
| `countryOf` memo | distinct State/Province cells | one entry per distinct cell, each key at most 16 code units | at most `rows` entries, at most `16 x rows` code units |
| asset slot entries (all tiers) | (region, species, format) triples with a joined asset | at most `3 x (regions) x S` | at most `3 x` ML rows whose checklist id resolves in `join`, itself at most the ML row count |
| `choices` | offered regions | three groups | at most `3 x` distinct pairs `<= 3 x rows`; each label bounded as S13 states |
| `countryDisplayName` memo | distinct country codes | one entry per distinct code, each key at most 16 code units and each value a CLDR English name or the code | at most the distinct State/Province cells `<= rows`; module-lifetime, never evicted, because its keys are bounded by the same cap as the `countryOf` memo above |
| Materialized maps per press | regional species | `S_region` records, at most 3 asset records each | `S_region <= S <= rows` |
| The stored value | one region | one object | `code` at most 16 and `county` at most 96 code units, enforced on write by 2.2 and on read by 2.8 |

The row count is bounded by the per-platform upload cap (`EBIRD_MAX_UPLOAD_BYTES_BY_PLATFORM`, about 150,000 rows at the 50 MB platforms), enforced at import by `uploadGuard.ts`; iCloud pulls are deliberately unguarded (CLAUDE.md), the same stated residual every row-sized structure in the tab carries. QA-32's fixture (150,000 observations each with a distinct pair) derives at most 450,000 choices and completes; the scratch figures in 5.4 are that fixture's shape.

### 5.3 `security.md` `paths`: none added, by construction

`lifeListsRegion.ts` and `lifeListsRegion.test.ts` match the existing `"frontend/src/lib/lifeLists*.ts"` glob in `.claude/rules/security.md` (line 41) and in `.claude/rules/bird-names.md`; `LifeListsRegionControl.tsx` matches `ui.md`'s `"frontend/src/components/**"`. The module name was chosen for that (CLAUDE.md, v1.0.32: a rule gated off the file it governs silently stops loading). If the Engineer adds a JSON fixture, it is named `lifeListsRegion.fixture.json` and `testing.md` gains `"frontend/src/lib/lifeLists*.fixture.json"` in the same change (the prior schema's conditional, still unexercised).

### 5.4 Measured-cost obligation, with the Architect's scratch figures

The Engineer measures and records in `pipeline/life-list-region-filter/decisions.md`, in the D-20 table shape (CPU time through `src/test/cpuTiming.ts`, first call and best, Node version, nothing else compiling):

- **(a) per LOAD (once per files epoch):** `deriveRegionIndex` and `deriveRegionAssets` on the tracked demo export (`website/demo/`, 7,869 rows, 515 ML rows) and on the generated 150,000-row backup with a 50,000-row ML export the prior build used (3,000 species, now with 50 states and 300 counties spread over them), plus the every-row-distinct worst case (every row its own species AND its own (state, county) pair); beside each, the slot entry count, the inner-Map count and a heap delta read after a forced collection with the index held (an annotation; the structural bound in 5.2 is the guarantee, testing.md v0.5.85).
- **(b) per RE-DRAW (one region press):** `regionFirsts` + `regionAssets` + `selectRows` for a county, a state, a country and Everywhere on the same inputs.

Scratch measurement by the Architect of a pass-1R-shaped loop (the three tiers, the join, slot replacement, an unmemoized `countryOf`; WITHOUT the two species-name scans, which the real pass makes as memo hits after pass 1 has warmed them), V8 on Node 24.18, this Mac, CPU time, first call / best of 5:

| Input | first / best | slot entries | join entries | heap delta |
|---|---|---|---|---|
| Demo-shaped: 7,869 rows, 149 species, 12 counties in 3 states | 11.6 ms / 2.3 ms | 2,384 | 7,869 | 1.0 MB |
| Realistic cap: 150,000 rows, 3,000 species, 300 counties in 50 states | 86.6 ms / 46.0 ms | 9,000 | 20,000 | 3.0 MB |
| Worst: 150,000 rows, every row its own species and county | 210.4 ms / 186.2 ms | 450,000 | 20,000 | 67.1 MB |

Expected real figures: pass 1R about 70 to 130 ms first call at the realistic cap (the scratch loop plus warm memo lookups for the two name scans), pass 2R under 10 ms, so the tab's whole load at the cap rises from the prior build's 110 to 125 ms to roughly 200 to 250 ms of main-thread CPU on this Mac, all inside the load effect after the awaited parse, never in a render body. A re-draw is `S_region` record builds plus pass 3: about 1 to 3 ms at 3,000 species, under 0.1 ms on the demo. A tenfold slower engine (a Pi's browser, an older phone) then sits near 2 to 2.5 s per load at the 150k cap behind the loading indicator; the realistic backup (tens of thousands of rows) is an order of magnitude below.

**Reversal, in order:** if the measured pass 1R exceeds about 150 ms first call at the realistic cap on this Mac, fold its gates into pass 1 (one loop over the rows producing both the world map and the index; FR-05 then rests on the golden rather than on an untouched function) before reaching for a worker; the worker line itself (about a second per load on the slowest shipped engine for a realistic backup) is the prior schema's and is unchanged.

---

## 6. The linearity guard (NFR-01, QA-31)

`lifeListsLinearity.test.ts` gains rows through the same `quotient` procedure, the same `testTimeout`, the same capped replica first:

- **Pass 1R** at 5k / 50k rows, limit 20, in FOUR shapes: the two species shapes crossed with two region shapes (every row its own (state, county) pair, so the per-key path and the per-region inner-Map creation run at volume; and 20 counties in 4 states, the realistic shape). The fixture's `stateProvince` and `county` generators are the only additions to `backup()`.
- **Pass 2R** at 5k / 50k ML rows, limit 20, in the same four shapes, fed the join from a backup whose submission ids the ML rows cite (the shipped fixture's `checklistId: 'S1'` must become a spread, or every asset joins one checklist and the per-key path never runs).
- **The materializers plus pass 3** at 500 / 5,000 regional species (the D-28 legs), limit derived as pass 3's row derives it from the rows each leg sorts, with the small leg's per-call time checked against the quotient floor (testing.md v1.0.63).
- **The choice build** at 500 / 5,000 choices, limit derived from `C log C` as the pass-3 row derives it.
- **Non-vacuity:** a mutant of pass 1R in the test file that replaces the inner `Map` with a linear search over an array of slots must exceed 20 on the distinct leg; a structural row asserts the module's absence list (section 2).
- The residual is the one D-19 names (the live-set effect on the distinct legs); the limit stays 20 and the legs stay 5k / 50k; if the four-shape distinct legs read above 20 under load the legs move, never the limit.

---

## 7. Guards and rosters the build owes

- `lifeListsRegion.test.ts`: QA-01 to QA-04, QA-10, QA-11, QA-13 to QA-16 as pure rows over the module; the "every offered region validates" corpus row (2.2); the validator's malformed table (2.8); the cell-bound rows (a 17-character state cell, a 97-character county cell, a 40,000-character cell of each, all contributing nothing); the join's first-row-governs row; a species-name and a state cell spelled `__proto__`.
- `lifeListsRegion.test.ts`, the country-name rows (2.7): "US" labels "United States" and "CA" labels "Canada" under Node's ICU; an unnameable but well-formed code (one `Intl.DisplayNames` returns as itself under `fallback: 'code'`) labels as itself; a malformed code that makes `.of` throw (`"U"`, `"USA1"`, a 16-character cell with no hyphen) labels as itself with no throw; with `Intl.DisplayNames` stubbed to a throwing constructor every country labels as its code and the tab mounts; the memo answers a repeated code without a second `.of` call (a spy on the instance); and the Everywhere path, a state choice and a county choice never call it (the same spy reads zero across `regionLabel` for those levels, a load, and a switch or media press). The memo lives in `lib/lifeListsRegion.ts`, inside the existing `lifeLists*.ts` glob.
- `lifeLists.test.ts`: the extracted constructors are pinned byte-identical to the previous inline records over the existing fixture; `selectRows` with and without `presence` over the same inputs.
- `LifeListsTab.test.tsx`: QA-05 (the golden against `selectRows` as shipped, under Everywhere, over all eight media states and four switch states), QA-06 (one build per epoch), QA-08, QA-09 (focus by element identity), QA-21, QA-22 (a seam spy: one `setSetting` with the key and the `RegionRef`, one `deleteSetting` for Everywhere, zero writes for switches and media), QA-23, QA-24, QA-25 (a stored region whose text differs from every choice never appears in the DOM: a text scan of the rendered tree for the stored string), QA-28 (zero requests on a region press, on both transports).
- `lifeListsCopy.test.ts`: section 4.5.
- `exoticProvenanceGraph.test.ts`: section 4.2. `entryChunk.test.ts`: a negative that `App.tsx`'s static graph does not reach `lib/lifeListsRegion.ts`, with the positive leg that the tab's closure does. `tabOrderCoverage.test.ts`: passes with the roster's cardinality unchanged. `androidReadings.test.ts`, `androidInsetsCss.test.ts`: pass unchanged (NFR-06; a `.sr-ios-app` rule, if the Designer adds one, ships with its `.sr-android-app` twin).
- `lifeListsPublishedClaims.test.ts`: the Help claims of FR-30; `lifeListsSurfacesPublishedClaims.test.ts`: the held copy stays held (QA-30).
- `cacheInventory.test.ts`, `clearDerived.test.ts`, `settingsRouteBudget.test.ts`, `tauriCsp.test.ts`, `tauriHttpScope.test.ts`: unchanged, verified by `git diff --stat` (QA-26 to QA-28).

---

## 8. Migration plan (ordered steps for the Engineer)

1. **`lib/lifeLists.ts`:** extract `firstSightingRecord(o, name, day, minute)` and `firstAssetRecord(row, day, minute)` from the two passes; add the defaulted `presence` parameter to `selectRows`. Run `lifeLists.test.ts` and `lifeListsLinearity.test.ts` unchanged: green is the proof the extraction changed nothing. Own commit.
2. **`lib/lifeListsRegion.ts` + `lifeListsRegion.test.ts`:** sections 2 and 7, the absence guard first so every hand loop is written against it.
3. **`lifeListsLinearity.test.ts`:** section 6 rows; record the measured quotients in `decisions.md`.
4. **`lib/lifeListsCopy.ts` + its suite:** section 4.5.
5. **`LifeListsTab.tsx`:** the load effect (the third concurrent read, passes 1R and 2R, the ready phase's new fields), the region state and resolution (4.1), the memos (4.3), the press handler and the write (3.1). The codes effect, the provenance hook and the status line are not touched; `git diff` on those blocks is empty.
6. **`LifeListsRegionControl.tsx`** to the Designer's spec within 4.4's contract; `LifeListsControls.tsx` hosts it.
7. **Guards and rosters** of section 7; `exoticProvenanceGraph.test.ts` and `entryChunk.test.ts` rows.
8. **Measurements** of 5.4 into `decisions.md`.
9. **`docs/HELP.md`** (FR-30) and **`held-copy.md`** (FR-31); the six-file version set (section 9).
10. Full suite, `npm run build`, `eslint`; grep the changed files for a literal U+2014 and for any literal control character (testing.md v1.0.52).

No data migration: no existing document changes shape, no stored value is rewritten, and a user who never opens the control never gains the key.

---

## 9. Help, held copy, version set

- `docs/HELP.md` "## Life Lists": the Region control and its three levels, that choices come from the backup, the in-region first-date meaning, the media-by-checklist rule and that an unlinked item counts only under Everywhere, that the region is remembered on this device while the switches and media buttons stay per-session. House register, no U+2014, American spelling, serial comma. Written in the build without a stop.
- `pipeline/life-list-region-filter/held-copy.md`: at most one proposed sentence each for `README.md`, `website/index.html` and `appstore/LISTING.md`, plus the "What's New" and Fastlane changelog line, each as before and after. Nothing is written to those surfaces, to `PRIVACY_POLICY.md` or to `fastlane/metadata/` before the user's explicit yes. The privacy policy needs no change (section 1's request statement; no new stored document, no registry row).
- Version: 1.0.69 to 1.0.70 (read off `main` at ship time). The six-file set: `frontend/package.json`; `src-tauri/tauri.conf.json` (`version`, `bundle.android.versionCode = 1000070`); `CHANGELOG.md`; `website/index.html` (the `version-pill` text and its `aria-label`, and the `footer-version` line); the three Fastlane changelogs `10000701.txt`, `10000702.txt`, `10000704.txt` (after the user's yes, present at the tag); `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` (`CurrentVersion: 1.0.70`, `CurrentVersionCode: 10000704`, the three per-ABI `Builds` entries). Then the all-platforms rhythm through the `snowraven-release` skill.

---

## 10. Design decisions

1. **Incremental, not Frontend Only:** a new validated key is persisted and read back (sections 3, 4.1). Reversal: none; FR-22 requires it.
2. **The region index is three Map tiers keyed by the parsed cells, holding slots (row indexes with a cached instant), built once per epoch** (2.1, 2.3). Composite string keys were declined (a delimiter argument for nothing); full records were declined on the worst-case heap figure (2.5, 5.4). Reversal: a measured re-draw cost above a few milliseconds at the realistic cap would move the slot back to a full record for the firsts tier only.
3. **Choices come from the index's key sets**, so "offered" and "holds a first sighting" are the same fact (2.3). Reversal: a per-choice count (OQ-4, Designer) is a `size` read on the same maps, no new pass.
4. **The offered cells are bounded at the stored bounds (16 / 96)**, a declared deviation from FR-02's wording (2.2). Reversal: the Planner widening NFR-04 would widen both together; they never diverge.
5. **A county requires a hyphenated State/Province cell**, following QA-02 over FR-02's first sentence (2.2).
6. **`selectRows` is reused with one defaulted `presence` parameter**, so pass 3, the order, the positions and the combined-date rule are provably the shipped ones under a region, and the unfiltered call is byte-identical (2.6).
7. **The codes batch, the provenance hook and the status line are untouched** (4.2): the regional roster is a subset of the world roster, so the world code map and the world classification serve every region with zero extra requests.
8. **`lifeListsRegion`, a `RegionRef` written whole, absence for Everywhere by `deleteSetting`, no version marker, best-effort, per device, not purged** (section 3), following `targetsCounty` with the one difference (a possible county name) flagged.
9. **The stored value is re-read at every epoch** inside the load effect's `Promise.all` (3.3), so FR-23 holds without a flash and FR-24's "consulted again at every epoch" is literal.
10. **Main thread, measured, ratio-guarded**, with the fold-into-pass-1 step named before any worker (5.4).
11. **The module name sits inside the existing `lifeLists*.ts` globs** rather than extending them (5.3).
12. **A country is labelled by its English name through `Intl.DisplayNames`, display only** (2.7; the user's direction at the design review, replacing OQ-2's code-as-label default). The stored value and the choice identity never carry the name, so a locale-data difference between engines can change a label but never which region is selected or saved; a code the engine cannot name, or an engine without the API, shows the code. Considered and declined: a bundled country table (a new asset on a list surface for 250 strings the engine already holds) and extending `regionNames.ts` (the entry-chunk module would grow for every tab). Reversal: an engine at or above the shipped floors that measurably lacks the region names would move the label to a bundled table, loaded lazily with the tab.
