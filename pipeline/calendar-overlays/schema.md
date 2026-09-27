# Schema: Calendar Overlays

**Feature:** calendar-overlays
**Date:** 2026-09-26 (amended the same day, post-design)
**Stage:** 3, The Architect (hands-off: the path is declared here and proceeded on)
**Source:** strategic-brief.md, prd.md (both approved; every open question taken at its stated default, section 11 records each); design-spec.md (approved at Stage 4, whose "Data-layer implications" section this amendment folds in)
**Extends:** `pipeline/calendar-tab/` and its follow-ons (the `DayCell` derivation), `pipeline/desktop-persistence-and-readme/` and `pipeline/settings-write-clobber/` (the settings document and its chain), `pipeline/ml-export-hardening/` (`loadMLExport`)
**Ships as:** one patch bump across the four-file set and every platform leg (brief, "Release, noted not planned")

## Amendment (post-design)

The user approved a richer design at Stage 4 (decisions.md D4-09, the counted per-format and per-code tile, and D4-10, the persisted "Every code / By category" control). This document is amended in place to match; section numbering is kept. What changed at the data layer:

- The settings value gains a third field, `codes: 'every' | 'category'` (section 1); the hook gains `setCodes`; every write carries all three fields.
- `DayCell` now holds the day's distinct catalog ids (`mediaIds`) rather than only their count, and every distinct breeding code that day with its species count (`codes`), at day level and per checklist; `breeding` is derived from `codes` (section 2). The day-level per-category species counts the "By category" rendering needs are computed at output (section 2.3), the one addition beyond the design's own list.
- `breedingCodes.ts` exports a rank comparator the sort needs (section 3); `mediaFormatCounts` gains an `unknown` bucket and is also joined at DAY level (section 4).
- `OVERLAY_MARK_SPECS` has seven keys; a pure `tileRows` derivation, a bounded `codeText`, and the new suffix formats live in `lib/calendarOverlays.ts` (section 6).
- The declared scans (7.1), the allocation bound (decision 7), the entry-chunk picture (7.4), the test seams (9) and the build order (10) are re-argued below for the new shapes. The QA-22 byte-identical-off fixture is now step 0 of the build order.

The PRD text the design lists for amendment (FR-17, FR-20, FR-22, FR-24, FR-26, FR-29, FR-30, FR-01/03/04 and the QA rows) is amended by The PM's pass; this document names the data facts those rows assert against.

## Path

Incremental (extending the existing data layer).

## Architect assessment

> **Architect assessment: Incremental**
>
> SnowRaven has no database; its data layer is the set of stored documents under `AppLocalData/data/` (and their web/Pi twins under `data/settings/`), the storage seam that reads and writes them, and the pure `lib/` derivations the tabs render from. Prior `schema.md` files document all of that. This feature adds one persisted key to the settings document (two booleans and one two-valued string, written through the seam), the overlay fields on the Calendar's `DayCell` (section 2.1 is the roster, at day level and per checklist), and one new consumer of the parsed ML export. A persisted preference is data being created and updated, so the conservative rule in the Architect brief takes Frontend Only off the table even though nothing new is read on the default path. No backend change, no migration, no change to any existing stored document's shape. Proceeding on this assessment per the hands-off run.

The one modification to an existing structure is additive: `DayCell` and its `checklists[]` rows gain required fields. That breaks nothing at runtime (the map is built and consumed inside one module) and breaks exactly one thing at typecheck: the hand-built `DayCell` literals in `frontend/src/lib/calendar.test.ts` (section 9.1 names the fix). No shipped document changes shape.

## Existing data model used by this feature (unchanged)

| Existing structure | Where | How this feature uses it |
|---|---|---|
| `ObservationEntry.catalogIds: string[]` | `frontend/src/types.ts:76`; produced at `lib/parseEbirdObservations.ts:163` (split on `[\s,]+`, `ML` prefix stripped, filtered to `^\d+$`) | The ONLY source of media presence. Already numeric-only; de-duplicated per row is NOT guaranteed (a cell `"ML123, 123"` yields `["123","123"]`), which is why the derivation de-duplicates with a `Set` (section 2.3) |
| `ObservationEntry.breedingCode: string \| null` | `types.ts:74`; produced at `parseEbirdObservations.ts:156` (first whitespace token of the trimmed cell, `null` when empty) | The ONLY source of breeding evidence. A DISPLAY code as eBird writes it in the backup; never passed through `API_BREEDING_TO_DISPLAY` (FR-12). Its length is bounded only by the cell, which is why section 6.4 bounds what is rendered from it |
| `ObservationEntry.commonName` via `normalizeSpeciesName` | `lib/calendar.ts:191` computes `norm` once per row | The species identity the per-code species counts use (section 2.3). The same string reference the existing `withForms` Set already retains |
| `BREEDING_CODES`, `BREEDING_CODE_MAP`, the private `BREEDING_RANK`, `resolveApiBreedingCode`, `strongerBreeding`, `CATEGORY_CODES`, `BreedingCategory` | `lib/breedingCodes.ts` | The classification table and its strongest-first rank. Section 3 lifts the display-code half of `resolveApiBreedingCode` and the rank comparison into exported functions; nothing about the table changes |
| `buildDayCells`, `DayCell`, `DayCellMap`, `metricCount`, `nonZeroMetricCounts` | `lib/calendar.ts` | The single pass gains the overlay accumulators (section 2); `metricCount` and the tiering are untouched |
| `observationMediaFormats`, `MediaFormat` | `lib/observationMedia.ts` | The catalog-id-to-format join. Section 4 adds a counting sibling that shares its format-acceptance predicate |
| `loadMLExport()` / `MLExportResult.mediaMap: Record<string, string>` | `lib/mlExportCache.ts`, `lib/parseMLExport.ts:34` | Read only while the Media overlay is on (section 5). Settles `null` on every failure and never rejects (its docstring, v1.0.15) |
| `storage.getSetting` / `storage.setSetting` | `lib/storage.ts:122`; Tauri at `:714` and `:726` (links on the `SETTINGS_PATH` chain), web/Pi at `:299` and `:305` (`GET/POST /settings/{key}`) | The persistence path for the one new key (section 1) |
| `backend/routers/settingskv.py` | the web/Pi generic kv store: one file per key under `data/settings/<key>.json`, `_KEY_RE = ^[A-Za-z0-9._-]{1,128}$`, reserved `keys` / `files` / `map-defaults` | Accepts the new key as-is (section 1.4). No change |
| `useFilesEpoch` / the `filesVersion` prop | `App.tsx:192`, threaded to `Calendar` at `App.tsx:1440`; Calendar's load effect at `Calendar.tsx:803` keys on it | The ML export re-read (FR-33) keys on the same prop (section 5.2) |
| `clearMLExportCache` | called from `Settings.tsx:1951` / `:1998` and `icloudSync.ts:1533` before the epoch bump | Why a re-read after an epoch bump sees the new file rather than the memo (section 5.2) |
| `Camera`, `Mic`, `Video` from `lucide-react` | `components/LifeList.tsx:4` (the Multimedia tab, a STATIC import in `App.tsx:31`) | The three format glyphs. Already on the entry chunk, so the Calendar importing them adds no module to any chunk (section 7.4) |
| `SegControl` and `Switch` (local to `Calendar.tsx`) | `Calendar.tsx:78`, `:134` | `Switch` already carries `disabled` / `describedBy` (aria-disabled, onClick guard, and `pointer-events: none`); `SegControl` gains the first two of those, NOT the third (section 6.5) |
| `.sr-cal-minimonth` container + `.sr-cal-mininum .sr-cal-daynum` at `@container (min-width: 152px)` | `frontend/src/globals.css:1222` to `:1234` | The Large-view legibility floor the corner marks share (design-spec, Large view). One more selector under the same query, never a second threshold |
| The accessible-name strings | `Calendar.tsx:237` / `:264` (Compact), `:462` / `:482` (Large) | Section 6 gives them one pure builder so the metric noun and the overlay suffix cannot drift between the two views |
| The Calendar zero-network closure guard | `lib/exoticProvenanceGraph.test.ts:116` (`NETWORK_MODULES`), `:158` | Section 7 argues the new imports against that exact pattern |
| `lib/calendarContrast.test.ts` | parses `:root` and `[data-theme="dark"]` from `globals.css` | The mark-contrast guard (NFR-03, QA-24) extends this file's token parser |

## Changes in this feature

### Added

1. **One settings key, `calendarOverlays`**, value `{ media: boolean, breeding: boolean, codes: 'every' | 'category' }`, in `data/settings.json` on desktop and `data/settings/calendarOverlays.json` on web/Pi (section 1).
2. **`frontend/src/lib/calendarOverlays.ts`**, a pure, React-free, lucide-free, network-free module: the key constant, the frozen default, `normalizeCalendarOverlays`, the seven-key mark-spec table, `tileRows`, `codeText`, `mediaFormatPhrases`, `dayNameSuffix`, `breedingMarkKey` (sections 1.2, 4.2, 6).
3. **`frontend/src/lib/useCalendarOverlays.ts`**, the hydrate-and-persist hook with `toggle` and `setCodes` (section 1.3).
4. **Fields on `DayCell`**: `mediaPresent`, `mediaIds`, `mediaIdCount`, `mediaChecklistCount`, `codes`, `codeCategoryCounts`, `breeding` at day level; `catalogIds`, `codes`, `breeding` on each `checklists[]` row (section 2).
5. **Exports on `lib/breedingCodes.ts`**: `resolveDisplayBreedingCode`, `compareBreedingDefs`, `strongerBreedingDef`, `breedingCategoryForTier`, `BREEDING_CATEGORY_LABELS`, `BREEDING_CATEGORY_ORDER` (section 3).
6. **`mediaFormatCounts` (with `unknown`) and `asMediaFormat` on `lib/observationMedia.ts`** (section 4.1).
7. **`metricNoun` on `lib/calendar.ts`** (section 6.1).
8. **`SegControl` props `disabled` and `describedBy`** in `Calendar.tsx` (section 6.5).
9. **Guards and fixtures** listed in section 9, and `paths` extensions in `.claude/rules/security.md` and `.claude/rules/testing.md` (section 9.4).

### Modified

- `lib/calendar.ts`: `buildDayCells` accumulates the overlay facts inside its existing loop and sorts each bucket's codes in its existing output walk (section 2.3); `DayCell` and its checklist row type gain the fields above. No existing field, count or ordering changes.
- `lib/breedingCodes.ts`: `resolveApiBreedingCode` becomes `resolveDisplayBreedingCode(apiBreedingToDisplay(apiCode))` and `strongerBreeding` becomes `strongerBreedingDef(...)` over the two resolved defs, itself defined on `compareBreedingDefs`. Behavior-identical by construction; the existing tests are the proof and must stay green untouched.
- `lib/observationMedia.ts`: `observationMediaFormats` calls the extracted `asMediaFormat` predicate. Behavior-identical.
- `components/Calendar.tsx`: reads the hook, holds `mediaMap` state, threads `overlays` and `mediaMap` to the cells, the legend and the popup; renders `tileRows` output; owns the glyph lookup (section 6.3). Owned by The Designer (visual) and The Engineer (wiring); the seams are in sections 5 and 6.
- `lib/calendar.test.ts`: the `obs()` factory honors `breedingCode` and `catalogIds` from its partial; the hand-built `DayCell` literals gain the new fields (section 9.1).

### Unchanged (used, not modified)

`storage.ts` (no new document, no new chain, no new method), `settingskv.py` and every other backend file, `parseEbirdObservations.ts` (no new scan over raw text, FR-11 / NFR-05), `mlExportCache.ts`, `parseMLExport.ts`, `clearDerived.ts` (section 1.5 says why), `filesChanged.ts`, `PRIVACY_POLICY.md`, the iCloud scope, `tabLayout.ts`, `calendarTextures.ts`, `countyShading.ts`, the `CATEGORY_CODES` sets, `API_BREEDING_TO_DISPLAY`, `LifeList.tsx`, the `Switch` helper.

---

## 1. The persisted preference

### 1.1 Key, shape, location

- **Key:** `calendarOverlays`. camelCase, matching the app's other UI preferences (`dateFormat`, `welcomeSeen`, `hotspotTierRings`, `shareCopyMode`, `disableEmbeddedMedia`). Exported once as `CALENDAR_OVERLAYS_SETTING_KEY` from `lib/calendarOverlays.ts`; no literal anywhere else.
- **Stored value:**

```
export type CodesMode = 'every' | 'category'

interface CalendarOverlays {
  media: boolean     // the Media overlay switch
  breeding: boolean  // the Breeding overlay switch
  codes: CodesMode   // how breeding rows are drawn on the tile (D4-10)
}
```

- **Default:** `DEFAULT_CALENDAR_OVERLAYS = Object.freeze({ media: false, breeding: false, codes: 'every' })`. Frozen because it is also what every failed or invalid read resolves to, and a shared default that a caller could mutate is how one tab's flip becomes every tab's default.
- **Desktop:** `data/settings.json["calendarOverlays"]`, written by `TauriStorage.setSetting`, which is a link on the `SETTINGS_PATH` `docChains` chain (`storage.ts:726`). The read is a chained link too (`:714`). Nothing new joins the chain; this is exactly the shape the chain was built for (a whole-document read-modify-write on a shared document), so the v1.0.9 lost-update class cannot reach it.
- **web/Pi:** `POST /settings/calendarOverlays` with the JSON object as the body; stored verbatim as `data/settings/calendarOverlays.json`; `GET` returns it, or 404 when absent, which `WebStorage.getSetting` maps to `null` (`storage.ts:301`). Own file per key, so no shared-document race exists on this transport.
- **Device-local.** iCloud Sync copies the two data files only; the settings document is never synced (CLAUDE.md, desktop storage table). `PRIVACY_POLICY.md` is unchanged: two booleans and a two-valued string join a document the policy already describes.

### 1.2 Validation on read (`normalizeCalendarOverlays`)

```
export function normalizeCalendarOverlays(raw: unknown): CalendarOverlays
```

Rules, in order, each its own test row (QA-04):

1. `raw` is not an object, or is `null`, or is an array: return `DEFAULT_CALENDAR_OVERLAYS`. (Arrays are objects to `typeof`; the check is `typeof raw === 'object' && raw !== null && !Array.isArray(raw)`.)
2. Otherwise read the three fields independently. `media` and `breeding` are honored only when `=== true` or `=== false`; anything else (missing, `1`, `"true"`, `null`) reads as `false`. `codes` is honored only when `=== 'every'` or `=== 'category'` (strict string equality, no case-folding, no trimming); anything else (missing, `'Category'`, `1`, `null`) reads as `'every'`. So `{ media: 1, breeding: true, codes: 'CATEGORY' }` is Media off, Breeding on, Every code.
3. Unknown fields are ignored, never copied forward. The returned object carries exactly the three known fields, so a pre-amendment document `{ media, breeding }` reads as `codes: 'every'` and a future fourth field can be read by old builds (OQ-4 default: tolerant per field).
4. Return a fresh plain object except when all three fields equal the default, in which case return the frozen default (a stable reference is what lets the hook skip a no-op state update on hydrate).

The hook wraps the seam call so a rejecting `getSetting` also resolves to the default (`.catch(() => DEFAULT)`), with no error surface (FR-04, last sentence).

### 1.3 The hook (`useCalendarOverlays`)

The precedent is the component-local hydrate pattern (`SnowMap.tsx:128`, `Settings.tsx:1180`), with the `userChose` guard lifted from `shareCopyPreference.ts:104` and the serialized write queue lifted from `useEmbeddedMediaPreference.ts:71`. Not the `useSyncExternalStore` module store: the Calendar is the only reader, it is mounted once for the session (tabs hide with `display:none`), and a module-level singleton would need a `_resetForTests` seam that the per-mount shape does not.

```
export function useCalendarOverlays(): {
  overlays: CalendarOverlays
  toggle: (layer: 'media' | 'breeding') => void
  setCodes: (mode: CodesMode) => void
}
```

Contract:

- **State starts at the default** on the first render (FR-02). No `null` hydration phase: unlike the embedded-media preference there is no unsafe pre-hydration state, because "off" issues no request and reads no file (the same argument `shareCopyPreference.ts` makes for itself).
- **Hydration effect (mount only):** `storage.getSetting<unknown>(KEY).then(normalize).catch(() => DEFAULT)`; on resolve, if `cancelled` or `userChoseRef.current` is true, do nothing (FR-05); else `setState(next)` only when a field differs. Hydration writes nothing back (FR-03).
- **`toggle(layer)` and `setCodes(mode)`** share one private `commit(next)`: `next` is computed synchronously from a ref mirror of the state (so two changes in one tick compose rather than clobber), `stateRef.current = next`, `userChoseRef.current = true`, `setState(next)`, then `storage.setSetting(KEY, next)` is enqueued on a per-hook promise chain whose every link swallows its own rejection (`.catch(() => {})`). `toggle` flips one boolean; `setCodes` sets `codes` and is a no-op (no state update, no write) when the value is unchanged, so re-pressing the pressed segment writes nothing. The chain gives last-change-wins ordering on web/Pi, where two overlapping `POST`s of a whole file have no other ordering guarantee; on desktop `docChains` already orders them and the hook chain is harmless. A failed write changes nothing in-session and the next change enqueues a fresh write (FR-06, OQ-5 default).
- **Exactly one `setSetting` per change, carrying all three fields** (QA-03). Never a partial object, never a second key. `setCodes` while Breeding is off still persists (the control is gated in the component, section 6.5, not in the hook; the hook has no opinion about which control is enabled).
- **Never `localStorage`**, on either transport.
- The hook imports `storage` and `calendarOverlays.ts` only. It joins the Calendar's lazy closure (`App.tsx:66`), not the entry chunk.

### 1.4 The web/Pi backend needs no change (confirmed)

`calendarOverlays` matches `_KEY_RE` (`^[A-Za-z0-9._-]{1,128}$`, checked with `fullmatch`), is not in `_RESERVED_KEYS`, and the body is a JSON object of about 50 bytes, far under `_MAX_BYTES`. The generic route stores any JSON value verbatim (its docstring says so and `shareCopyMode` already stores an object through it). The Vite dev proxy already forwards `/settings` (CLAUDE.md, Ports), so `npm run dev` reaches it too.

### 1.5 Why this key is NOT in `clearDerived.ts`

The registry holds derived documents keyed on user-file content (CLAUDE.md, v1.0.14). This key is a preference the user set with a switch and a segmented control; it is keyed on nothing in either data file and survives a Clear exactly as `dateFormat` and the tab layout do. Adding a row would turn `cacheInventory.test.ts` red for a purge that has no store to purge.

---

## 2. The derivation: `DayCell` gains its overlay facts

### 2.1 New fields (exact types)

```
/** One breeding code recorded in a bucket, with how many distinct species
 *  carried it. `def` is the resolved DISPLAY code (section 3). */
export interface DayCodeFact {
  def: BreedingCodeDef
  /** Distinct normalized species names (the same `norm` the withForms Set
   *  holds) that carried this code in this bucket. Under a species filter it
   *  is 1 for every entry. */
  speciesCount: number
}

export interface DayCell {
  // ... every existing field, unchanged ...

  /** (a) Any row in this bucket carried >= 1 catalog id. Equivalent to
   *  mediaIds.length > 0; carried as its own boolean because it is the field
   *  the cell and the accessible name read, and a boolean cannot be misread
   *  as a count. */
  mediaPresent: boolean
  /** (b) DISTINCT catalog ids across every row in this bucket, first-seen
   *  order, string REFERENCES into the parsed rows. Combined view: the union
   *  across years (ids are globally unique). The tile, the popup header and the
   *  accessible name join these against mediaMap at render (section 4). */
  mediaIds: string[]
  /** (c) mediaIds.length. Kept as its own field because it is what the
   *  condensed tile and the no-export suffix print. */
  mediaIdCount: number
  /** (d) Checklists (distinct submissionIds) in this bucket with >= 1 catalog
   *  id. Combined view: across years (globally unique submission ids, so the
   *  per-bucket count IS the cross-year sum, same mechanism as checklistCount). */
  mediaChecklistCount: number
  /** (e) Every DISTINCT display code recorded in this bucket, strongest first
   *  by the table's rank, unknown codes last, first-seen order among equals
   *  (a stable sort over a Map's insertion order). Empty when no row carried
   *  a code. Combined view: per-code species sets are unions across years. */
  codes: DayCodeFact[]
  /** (f) Distinct species at each CATEGORY (the union of the species sets of
   *  every code in that category, so a species carrying NY and FY counts once
   *  under Confirmed). Zero for an absent category. What the "By category"
   *  tile rows print; the popup never reads it. */
  codeCategoryCounts: Readonly<Record<BreedingCategory, number>>
  /** (g) codes[0]?.def ?? null: the STRONGEST code in this bucket. One field,
   *  derived, so it cannot disagree with codes. What the Large-view corner
   *  mark and the condensed tile row read. */
  breeding: BreedingCodeDef | null

  checklists: {
    // ... submissionId, date, time, location, speciesCount, speciesCountWithForms, unchanged ...
    /** This ONE checklist's DISTINCT catalog ids, first-seen order, string
     *  references. The popup row joins these against mediaMap at render. */
    catalogIds: string[]
    /** This one checklist's codes, same shape and order rule as the day field,
     *  over this checklist's rows only. */
    codes: DayCodeFact[]
    /** codes[0]?.def ?? null, as at day level. */
    breeding: BreedingCodeDef | null
  }[]
}
```

`BreedingCodeDef` and `BreedingCategory` are imported as types from `./breedingCodes`; `calendar.ts` also imports the value functions in section 3, which are pure table lookups. `breedingCodes.ts` imports nothing, so `calendar.ts` stays React-free and network-free.

### 2.2 Placement of the accumulation (the one rule that decides every FR in section B)

Inside `buildDayCells`, the new accumulation sits **after the species-filter `continue` and outside the `if (countable)` block**, and its checklist half sits **inside the existing `if (o.submissionId)` block**. That placement is the whole design:

| Requirement | Why the placement satisfies it |
|---|---|
| FR-14, species filter | The filter `continue` runs first, so only matching rows reach the accumulators; every per-code species set then holds exactly one name, so every `speciesCount` is 1 (design-spec, "Species filter") |
| FR-14, countability and escapees ignored | The accumulators are outside `if (countable)`, so a spuh, a hybrid and an escapee-excluded species all contribute (QA-14). The species identity is `norm`, the all-forms name, never the countable predicate |
| FR-16, zero-count days | A `Work` entry exists for every row that passes the filter, countable or not, so a day whose only rows are non-countable still gets a `DayCell` with its facts (QA-18) |
| FR-15, All years | The bucket key is `MM-DD` in combined view and the accumulators are per bucket, so distinct ids and per-code species sets fold across years for free, exactly as `checklists` already does (QA-16, QA-17) |
| FR-09, single pass | No second loop over rows; each row is touched once for the existing counts and the same once for the overlay facts. The per-bucket sort and category union run in the output walk that already exists (NFR-01, section 7.1 bounds them) |
| FR-08, flip never rebuilds | Neither switch nor the codes mode is an input of `buildDayCells` or a dep of the `cells` memo (`Calendar.tsx:872`); all three are read at render only. `codes === 'category'` is a RENDERING of `codes` and `codeCategoryCounts`, both computed regardless of the mode |

### 2.3 The accumulation, exactly

`Work` gains `mediaIds: Set<string>` and `codes: Map<string, { def: BreedingCodeDef; species: Set<string> }>` (keyed by display code, insertion order = first-seen); `ChecklistInfo` gains `catalogIds: Set<string>` and the same `codes` Map. Per row, after the filter guard (where `norm` already exists):

```
// Media: de-duplicate at both levels. The parser guarantees each id is ^\d+$
// but NOT that a row's ids are distinct ("ML123, 123" yields two "123"s), and
// the same asset can appear on two rows of one checklist. A Set is the whole
// de-duplication; nothing is scanned twice.
for (const id of o.catalogIds) w.mediaIds.add(id)

// Breeding: resolve ONCE per row (a Map lookup), then record the species under
// that code. No rank comparison in the loop; order is settled at output.
const code = o.breedingCode
if (code !== null) addCode(w.codes, code, norm)

// ... inside the existing `if (o.submissionId)` block, after `ci` exists:
for (const id of o.catalogIds) ci.catalogIds.add(id)
if (code !== null) addCode(ci.codes, code, norm)

function addCode(map, code, norm) {
  let e = map.get(code)
  if (!e) { e = { def: resolveDisplayBreedingCode(code), species: new Set() }; map.set(code, e) }
  e.species.add(norm)
}
```

At output, inside the existing `for (const [key, w] of work)` walk, one private `finishCodes(map): DayCodeFact[]`:

```
// [...map.values()] is first-seen order; Array.prototype.sort is stable
// (ES2019), so equal ranks keep first-seen order. Unknown codes rank Infinity
// and therefore sort last, among themselves first-seen.
const facts = [...map.values()].sort((a, b) => compareBreedingDefs(a.def, b.def))
return facts.map(e => ({ def: e.def, speciesCount: e.species.size }))
```

and, at day level only, `codeCategoryCounts` from the same sorted entries BEFORE the species sets are dropped: one temporary `Set<string>` per category present, each entry's `species` folded into its category's set (`breedingCategoryForTier(def.tier)`), sizes taken, temporaries discarded. Then: `mediaPresent: w.mediaIds.size > 0`, `mediaIds: [...w.mediaIds]`, `mediaIdCount: w.mediaIds.size`, `mediaChecklistCount:` the count of `ChecklistInfo` entries with `catalogIds.size > 0` (one counter inside the existing `[...w.checklists.entries()].map(...)` walk, no second pass), `codes`, `codeCategoryCounts`, `breeding: codes[0]?.def ?? null`; per checklist `catalogIds: [...info.catalogIds]`, `codes: finishCodes(info.codes)`, `breeding: codes[0]?.def ?? null`.

A row with no `submissionId` (the parser leaves it `''` for a malformed row) contributes to the day-level facts and to no checklist, matching how such a row already contributes to the day-level species sets and to no checklist row.

**Why `breeding` is derived from the sort rather than folded with `strongerBreedingDef` in the loop:** the two agree by construction (the comparator keeps `a` on a tie and the stable sort keeps first-seen among equals, so `codes[0]` is exactly what the fold would have produced), and one derivation is one fewer thing to keep in agreement. FR-13's tie rule (first-seen unknown wins among unknowns) therefore holds through the sort's stability, and section 9.1 keeps its unknown-versus-unknown row.

### 2.4 What the derivation does NOT do

- No case-folding, trimming or translation of `breedingCode` (FR-12: display codes are looked up directly; the parser already trimmed the cell). `FY` therefore resolves to Feeding Young, tier 4, never to Carrying Food (QA-11). Two spellings that differ only in case are two distinct codes, both unknown unless the table names them.
- No parsing of `catalogIds` beyond iteration; no regex, no `split`, no `includes`, no `indexOf` (FR-11, NFR-05, QA-43). The parser's `^\d+$` filter is the only shape rule and it is unchanged.
- No reading of the ML export. The pass never sees `mediaMap` (section 4.3 explains why the join happens at render).
- No truncation or rendering decision. `codeText` (section 6.4) bounds an unknown code's text at the render boundary; the pass keeps the raw token so the popup's escaped label and the Tester's rows see what the parser produced.

---

## 3. Breeding classification: additive exports on `breedingCodes.ts`

```
/** Resolve a DISPLAY code (the backup's Breeding Code column) to its def.
 *  Unknown codes fall back to a tier-1 def whose label is the raw code, exactly
 *  as resolveApiBreedingCode treats an unknown code after translation. */
export function resolveDisplayBreedingCode(display: string): BreedingCodeDef {
  return BREEDING_CODE_MAP.get(display) ?? { code: display, label: display, tier: 1 }
}

/** Strongest-first order by the table's rank; unknown codes rank below every
 *  known code (Infinity) and compare equal to each other, so a stable sort
 *  keeps them in first-seen order. Negative when `a` is stronger. */
export function compareBreedingDefs(a: BreedingCodeDef, b: BreedingCodeDef): number {
  const ra = BREEDING_RANK.get(a.code) ?? Infinity
  const rb = BREEDING_RANK.get(b.code) ?? Infinity
  return ra === rb ? 0 : ra < rb ? -1 : 1   // never ra - rb: Infinity - Infinity is NaN
}

/** The stronger of two resolved defs; ties keep `a`. Defined on the comparator
 *  so the fold and the sort cannot disagree. */
export function strongerBreedingDef(a: BreedingCodeDef | null, b: BreedingCodeDef | null): BreedingCodeDef | null {
  if (!a) return b
  if (!b) return a
  return compareBreedingDefs(a, b) <= 0 ? a : b
}

export function breedingCategoryForTier(tier: 1 | 2 | 3 | 4): BreedingCategory {
  return tier >= 3 ? 'confirmed' : tier === 2 ? 'probable' : 'possible'
}

/** Strongest first: the order the tile's By-category rows and the legend use. */
export const BREEDING_CATEGORY_ORDER: readonly BreedingCategory[] = ['confirmed', 'probable', 'possible']

export const BREEDING_CATEGORY_LABELS: Record<BreedingCategory, string> = {
  confirmed: 'Confirmed', probable: 'Probable', possible: 'Possible',
}
```

Then `resolveApiBreedingCode(apiCode)` becomes `resolveDisplayBreedingCode(apiBreedingToDisplay(apiCode))` and `strongerBreeding(a, b)` becomes `strongerBreedingDef(a ? resolveApiBreedingCode(a) : null, b ? resolveApiBreedingCode(b) : null)`. Both are the same expressions the functions contain today, factored; `breedingCodes.test.ts` (or whichever suite covers them) must stay green with no edit, and that green is the proof the refactor is behavior-identical. The `NaN` note on the comparator is load-bearing: the existing `strongerBreeding` compares with `<=`, which is well-defined on `Infinity`, and the comparator must be too.

`breedingCategoryForTier` lifts the ternary that `BreedingCodeTable.tsx:347` and `BreedingCodeList.tsx:37` each carry inline. Those call sites are out of scope and stay as they are; the new function exists so the Calendar does not become a fourth copy. `BREEDING_CATEGORY_LABELS` is the accessible-name and popup vocabulary (FR-26, FR-29); it is a data contract, not copy The Designer restyles, because QA-30 and QA-33 assert the literal strings.

`breedingCodes.ts` is not in the Calendar's closure today (its importers are the Breeding Codes, Map Explorer, Species Detail, Comparer and Statistics graphs); it joins via `calendar.ts`. It is a pure module with no imports of its own, so the closure guards in section 7 are unaffected.

---

## 4. The ML export enrichment join

### 4.1 Counting sibling of `observationMediaFormats` (`lib/observationMedia.ts`)

```
/** The one acceptance rule for a mediaMap value. Extracted so the presence
 *  join (observationMediaFormats) and the counting join below cannot drift. */
export function asMediaFormat(v: unknown): MediaFormat | null {
  return v === 'Photo' || v === 'Audio' || v === 'Video' ? v : null
}

export interface MediaFormatCounts {
  total: number    // every id
  photo: number
  audio: number
  video: number
  /** Ids the loaded map does not name, or names under an unrecognised format.
   *  Always 0 when mediaMap is null: "unknown" means the export was consulted
   *  and had no answer, which is a different fact from "no export". */
  unknown: number
}

/** Per-format counts of a set of DISTINCT catalog ids. With a null map this is
 *  O(1): { total: ids.length, 0, 0, 0, unknown: 0 }. */
export function mediaFormatCounts(catalogIds: readonly string[], mediaMap: Record<string, string> | null): MediaFormatCounts
```

`total === photo + audio + video + unknown` whenever the map is non-null; a test row pins that identity. `observationMediaFormats` is rewritten to call `asMediaFormat`, which is behavior-identical (its existing tests stay green untouched).

The plain index `mediaMap[id]` is safe here for the same reason it is safe in `observationMediaFormats` today: every lookup key is `^\d+$` by the parser's filter, so no prototype key (`constructor`, `__proto__`) can ever be looked up, whatever the ML side put in the map. State that in the function's docstring; do not add `Object.hasOwn` "for safety" on one side and not the other, since the two joins are meant to be twins.

### 4.2 The phrases (`lib/calendarOverlays.ts`)

```
/** ['2 photos', '1 audio', '3 media'] in the fixed order photo, audio, video,
 *  then the unknown bucket as 'N media' when unknown > 0; zeros omitted. Nouns:
 *  photo/photos, audio (invariant), video/videos, media (invariant) (QA-29).
 *  Empty when no format resolved and unknown is 0 (the null-map case). */
export function mediaFormatPhrases(counts: MediaFormatCounts): string[]
```

The Designer may set the line's layout and the joining punctuation; the nouns, the agreement and the order are fixed here because QA-28 and QA-29 assert them. The popup's plain form ("5 media" without the export) is the caller's fallback when the array is empty and `total > 0` (FR-25, FR-32); the accessible-name form of the same fallback is in section 6.2.

### 4.3 Why the join is at render, not in the pass

Three reasons, any one sufficient: the map is read only while Media is on (FR-31), so it may not exist when the pass runs; it can land after the popup opened (FR-32, QA-37) and the popup, the tile and the accessible name must gain the breakdown without a rebuild; and a switch flip must not rebuild cells (FR-08). So the pass holds the ids (section 2.1) at both levels, and:

- each rendered day cell computes `mediaFormatCounts(cell.mediaIds, mediaMap)` (through `tileRows` and `dayNameSuffix`), O(ids on that day);
- the popup header computes the same for the open day, and each popup row `mediaFormatCounts(row.catalogIds, mediaMap)`, O(ids on that checklist).

A grid render is therefore O(distinct ids across the rendered buckets), at most the backup's whole catalog column, once per Calendar render while Media is on; with Media off or the map null the per-cell cost is O(1). It is a plain index per id with no allocation beyond the counts object, and it is inside the linearity declaration in section 7.1. **No memo is prescribed.** If the Engineer's measurement (section 7.1) shows a grid render exceeding a frame at a media-heavy fixture, the permitted fix is one `useMemo` producing `Map<bucketKey, MediaFormatCounts>` keyed on `[cells, mediaMap]` (never on `overlays`, which would put the switches into a memo's deps), stated in the run record with the figure that required it.

---

## 5. The ML export: when it is read, and the files epoch

### 5.1 State and effect in `Calendar.tsx`

```
const [mediaMap, setMediaMap] = useState<Record<string, string> | null>(null)

useEffect(() => {
  if (!overlays.media) { setMediaMap(null); return }
  let cancelled = false
  void loadMLExport().catch(() => null).then(r => {
    if (!cancelled) setMediaMap(r?.mediaMap ?? null)
  })
  return () => { cancelled = true }
}, [overlays.media, filesVersion])
```

- **Default path reads nothing:** with Media off through mount, metric changes, a codes-mode change and a popup open, the effect's first branch runs and `loadMLExport` is never called (QA-35). Hydrating to on runs it once; flipping on runs it once. `overlays.breeding` and `overlays.codes` are deliberately NOT deps.
- **Off drops the map** rather than holding it. The next flip on calls `loadMLExport` again, which is a memo hit inside `mlExportCache.ts` (cheap) and keeps one rule: the map exists in Calendar state exactly while the overlay is on.
- **`.catch(() => null)` is belt-and-braces:** `loadMLExport` promises never to reject (its docstring), and the Checklists tab (`Checklists.tsx:438`) already wears the same belt. A `null` map is "no formats", never an error state (FR-32, QA-36).
- **`cancelled`** covers a flip to off, or an epoch bump, while a load is in flight, so a late resolution cannot repopulate a map the user turned off.

### 5.2 The files epoch (FR-33, QA-38)

`filesVersion` is already a prop (`App.tsx:1440`) and already the dep of the observations load effect. Putting it in this effect's deps means: Media on plus an epoch bump calls `loadMLExport` again; Media off plus a bump does not (first branch). The re-read sees the new file because every path that saves, replaces or removes the ML file calls `clearMLExportCache()` before it bumps the epoch (`Settings.tsx:1951`, `:1998`; `icloudSync.ts:1533`), so the memo is already empty when the effect fires. That ordering is a property of those call sites, not of this feature; it is stated here so the Tester knows what QA-38 is really exercising.

### 5.3 Loading then landing (QA-37)

The tile, the legend, the popup and the accessible names all receive `mediaMap` as a prop or closure value and read it on every render (FR-27). While the load is in flight they show the plain totals (the frame row, `, media: N`, "media" alone in the legend); when `setMediaMap` fires they re-render with the breakdown. No snapshot is taken at popup open.

---

## 6. Rendering contracts owned by the data layer

### 6.1 `metricNoun` (`lib/calendar.ts`)

```
/** The noun the day's number belongs to (FR-28). `withForms` is the flag
 *  metricCount was called with (effectiveForms in the tab). */
export function metricNoun(metric: CalendarMetric, withForms: boolean): 'checklists' | 'individuals' | 'species' | 'countable species'
```

`checklists` -> `'checklists'`; `total` -> `'individuals'`; `species` -> `withForms ? 'species' : 'countable species'`.

The zero-cell names keep their literal strings (`Calendar.tsx:237`, `:462`) or call `metricNoun(metric, false)`, either of which is byte-identical to today: a zero day under the Species metric is only reachable with forms off (with forms on, every row adds a with-forms name, so the count is at least 1; under a species filter the same holds). QA-32's last clause ("zero-day names are unchanged") is what pins that.

### 6.2 `dayNameSuffix` (`lib/calendarOverlays.ts`)

```
/** The overlay clauses of a day's accessible name, in the order media then
 *  breeding, each present only while its overlay is on, or '' (FR-29).
 *  Media:    ', media: 3 photos, 1 audio'  (map loaded, >= 1 format resolved;
 *            the phrases from mediaFormatPhrases joined with ', ', so an
 *            unknown bucket reads ', media: 3 photos, 2 media')
 *            ', media: 5'                  (map null, or no format resolved)
 *  Breeding: ', breeding: NY 1 (Confirmed), S 2 (Possible)'  (EVERY code in
 *            cell.codes order, `${codeText(def)} ${speciesCount} (${label})`;
 *            the codes mode never shortens it)
 *  Nothing is appended for a day with no facts under an on overlay. */
export function dayNameSuffix(
  cell: Pick<DayCell, 'mediaPresent' | 'mediaIds' | 'mediaIdCount' | 'codes'>,
  overlays: CalendarOverlays,
  mediaMap: Record<string, string> | null,
): string
```

Data day name: `${dateLabel}: ${count} ${metricNoun(metric, withForms)}${dayNameSuffix(cell, overlays, mediaMap)}. Open day details`. Zero day name: `${dateLabel}: birded, 0 ${noun}${dayNameSuffix(...)}. Open day details` (QA-18's exact string). Both views build from the same two functions, so Compact and Large cannot drift.

The category word comes from `BREEDING_CATEGORY_LABELS`, never from the raw code. The code text comes from `codeText` (section 6.4), so an unknown code contributes at most nine characters to an accessible name. This narrows the earlier OQ-6 default ("raw text never in an accessible name") to "raw text never UNBOUNDED in an accessible name", because the approved design reads every code aloud (D4-09); decision 15 records it.

### 6.3 The mark spec table (`lib/calendarOverlays.ts`)

```
export type OverlayMarkKey = 'photo' | 'audio' | 'video' | 'media' | 'confirmed' | 'probable' | 'possible'

/** How a mark is drawn. A lucide glyph is named, never imported here: this
 *  module is React-free and lucide-free so tileRows and the suffix builders run
 *  in node with no DOM. Calendar.tsx owns the one lookup from `icon` to the
 *  Camera / Mic / Video components the Multimedia tab already ships. */
export type OverlayGlyph =
  | { kind: 'lucide'; icon: 'camera' | 'mic' | 'video' }
  | { kind: 'path'; viewBox: string; paths: readonly { d: string; filled: boolean }[] }

export interface OverlayMarkSpec {
  key: OverlayMarkKey
  /** The legend entry's visible text: photos, audio, videos, media, Confirmed, Probable, Possible. */
  label: string
  glyph: OverlayGlyph
  /** The ink token as a var() reference: 'var(--sr-cal-fg)' for all seven keys (D4-02). */
  token: string
}

export const OVERLAY_MARK_SPECS: Readonly<Record<OverlayMarkKey, OverlayMarkSpec>>
export function breedingMarkKey(def: BreedingCodeDef): 'confirmed' | 'probable' | 'possible'  // = breedingCategoryForTier(def.tier)
```

The data-layer contract is that there is ONE table, the cells, the popup and the legend read `OVERLAY_MARK_SPECS[key]` and the legend iterates it, so QA-34's source assertion has a single symbol to find. `Calendar.tsx` renders a spec through one small `MarkGlyph` component: `kind: 'lucide'` resolves through a module-level `const LUCIDE_GLYPHS = { camera: Camera, mic: Mic, video: Video }`; `kind: 'path'` renders an inline `<svg viewBox>` with one `<path>` per entry, `fill` `currentColor` or `none`, `stroke` `currentColor`. The frame and the three circles (open, half, solid) are `path` specs. `token` is what `calendarContrast.test.ts` parses; the guard reads the table, not the glyphs.

### 6.4 `codeText` and `tileRows` (`lib/calendarOverlays.ts`)

```
/** The code as printed on a tile, in a suffix, and as a popup chip's code.
 *  A known code is its own text. An unknown code is the parser's raw first
 *  token, which is bounded only by the cell, so it is cut to its first 8 code
 *  points plus U+2026 when longer. O(1): at most 16 UTF-16 units are read. */
export function codeText(def: BreedingCodeDef): string

export type TileRow =
  | { kind: 'media'; key: 'photo' | 'audio' | 'video' | 'media'; count: number }
  | { kind: 'code'; key: 'confirmed' | 'probable' | 'possible'; code: string; count: number | null }
  | { kind: 'more'; count: number }

export interface TileRows { rich: TileRow[]; condensed: TileRow[] }

/** The two fact blocks of one cell, from the cell's facts and the render-time
 *  inputs only. Pure; the cell renders both lists and the stylesheet shows one. */
export function tileRows(
  cell: Pick<DayCell, 'mediaIds' | 'mediaIdCount' | 'codes' | 'codeCategoryCounts'>,
  overlays: CalendarOverlays,
  mediaMap: Record<string, string> | null,
): TileRows

export const TILE_CODE_ROW_CAP = 3
```

**Amended per D4-11 (the user's live look):** under `codes === 'category'` the tile names the CATEGORIES, never a code. `tileRows` emits `{ kind: 'category', key, label, count }`: one row per category with `codeCategoryCounts[c] > 0`, in `BREEDING_CATEGORY_ORDER`, `label` = `BREEDING_CATEGORY_SHORT[c]` (`Conf` / `Prob` / `Poss`, lib/breedingCodes.ts) on a rich row and `null` on a condensed one, `count` = `codeCategoryCounts[c]`; the condensed block carries the same category rows (circle and count) in place of the strongest code and `+N`. The "Code rows (rich), `codes === 'category'`" and the by-mode "Condensed" rules below are superseded by this paragraph. A category label is wider than any code, so such a tile turns compact at a width set by its widest count's digits: `categoryCountDigits(rich)` (pure, same module) returns 0 to 3 and the cell's blocks carry `sr-cal-facts--cat` / `--cat-2d` / `--cat-3d`, each with its own measured container query (decisions.md E5-12); an Every-code tile carries none. The popup and the accessible-name suffix are unchanged.

**Amended at QA retry 1 (decisions.md E5-09):** the TILE prints `tileCodeText`, not `codeText`, in both the rich and the condensed rows: a known code is its own text, an unknown code is shown whole up to `TILE_CODE_MAX_CODE_POINTS` (2) code points and otherwise as its first code point and U+2026, because `codeText`'s 8 code points, a bound chosen for safety, cannot fit a tile at 0.5625rem. `codeText` remains the form in the accessible-name suffix and the popup chip. Read "`codeText`" in the tile rules below as `tileCodeText`.

Rules, each a test row (section 9.1):

- **Media rows (rich), Media on and `mediaIdCount > 0`:** with the map loaded, one row per format with a non-zero count in the order photo, audio, video, then `{ key: 'media', count: unknown }` when `unknown > 0`; with the map null, one row `{ key: 'media', count: mediaIdCount }`. Media off, or no ids: none.
- **Code rows (rich), Breeding on and `codes.length > 0`, `codes === 'every'`:** the first `TILE_CODE_ROW_CAP` entries of `cell.codes` as `{ key: breedingMarkKey(def), code: codeText(def), count: speciesCount }`, then `{ kind: 'more', count: codes.length - TILE_CODE_ROW_CAP }` when more remain.
- **Code rows (rich), `codes === 'category'`:** one row per category with `codeCategoryCounts[c] > 0`, in `BREEDING_CATEGORY_ORDER`, `code` = `codeText` of the first entry in `cell.codes` whose category is `c` (the strongest at that category, which the sort guarantees is the first), `count` = `codeCategoryCounts[c]`. At most three rows, never a `more` row.
- **Condensed:** with Media on and ids, one `{ key: 'media', count: mediaIdCount }` (never per format); with Breeding on and codes, one `{ key: breedingMarkKey(codes[0].def), code: codeText(codes[0].def), count: null }`, then `{ kind: 'more', count: codes.length - 1 }` when `codes.length > 1`, whatever the codes mode.
- Both lists are empty when both overlays are off, which is what lets the cell render no fact block at all in that state (FR-19's byte-identical requirement).

The popup does NOT go through `tileRows`; it lists every code from `cell.codes` and `row.codes` directly (D4-10, "the popup always lists every code") and every format from `mediaFormatPhrases`.

### 6.5 `SegControl` gains `disabled` and `describedBy` (`Calendar.tsx`)

Two optional props, the same names `Switch` uses. When `disabled` is true each option `Button` gets `aria-disabled="true"` and `aria-describedby={describedBy}`, and the option's `onClick` guard does not call `onChange`; the `aria-pressed` state still renders. **Unlike `Switch`, `SegControl` does NOT set `pointer-events: none` when disabled** (D4-10: the focus ring and cursor change stay reachable for a pointer user; the handler is the guard). No `tabIndex` override, so both options stay tab stops through the `Button` primitive's `tabIndex={0}` default, and `tabOrderCoverage.test.ts` sees ordinary call sites. The wrapper `.sr-cal-codes` carries `aria-disabled="true"` and the dim; the reason sentence is an `.sr-only` element whose `id` is keyed on a literal, never on data (CLAUDE.md, ui: ids are never built from user file content).

---

## 7. Security declarations

### 7.1 New scans over user-file content (declared per CLAUDE.md, `.claude/rules/security.md` v1.0.23)

| Scan | Where | Input | Shape and bound |
|---|---|---|---|
| Catalog-id de-duplication | `buildDayCells`, section 2.3 | every `o.catalogIds` element of every row passing the filter | Two `Set.add` per id (day set, checklist set). Linear in the total number of ids in the backup; each id visited exactly once per set; no nested scan |
| Breeding-code resolution and per-code species insertion | `buildDayCells`, section 2.3 | `o.breedingCode` and `norm` per row | Per row with a code: one `Map.get` on the bucket's `codes` Map, one `Map.get` in `resolveDisplayBreedingCode` on first sight of the code in that bucket, one `Set.add` of `norm`; the same again for the checklist. Constant per row. The Map key is the raw token; a Map keyed by an arbitrary string is a hash lookup, not a prototype walk, so `__proto__` as a code is just a code |
| Per-bucket code sort | output walk, section 2.3 | the bucket's distinct codes, k per bucket | One stable sort of k entries with an O(1) comparator (two `Map.get`), so O(k log k) per bucket. k is at most the rows in that bucket, so the sum over buckets is O(R log R) in the worst case (every row a distinct unknown code) and O(R) in practice (k bounded by the table plus a handful of unknowns). Two sorts per checklist-carrying bucket (day and checklist), same bound |
| Category union | output walk, day level only | the bucket's per-code species sets | One temporary Set per category present, each species-set entry folded once: linear in the entries, which are at most the rows with a code in that bucket |
| Media-checklist count | output walk, section 2.3 | per checklist | `size > 0`, constant per checklist, inside the walk that already exists |
| Format counting at render | `mediaFormatCounts` via `tileRows` / `dayNameSuffix` per cell, and per popup row | that bucket's or checklist's distinct ids | One plain index per id; linear in the ids of one bucket; a grid render sums to the ids across rendered buckets (at most the catalog column), once per Calendar render while Media is on; O(1) with a null map (section 4.3) |
| `tileRows` per cell render | section 6.4 | `cell.codes` | Linear in that day's distinct codes (the category grouping walks all of them once); the `every` branch reads at most `TILE_CODE_ROW_CAP + 1` entries |
| `codeText` | section 6.4 | an unknown code's raw token | Reads at most 16 UTF-16 units whatever the token's length; O(1) |
| `tileCodeText` (added at QA retry 1, decisions.md E5-09) | section 6.4, amended | an unknown code's raw token, printed on the tile | Walks at most `TILE_CODE_MAX_CODE_POINTS + 1` = 3 code points, so reads at most 6 UTF-16 units (a surrogate pair is 2) whatever the token's length; returns the whole code when it has at most 2 code points, otherwise the first code point and U+2026, never splitting an astral character; O(1). Measured by the security review: 2.2 ms for 10,000 calls on a 5,000,000-character token |

No regex, no `split`, no `includes` / `indexOf` / `find` inside any loop, no scan over raw CSV text (FR-11, NFR-05, QA-43). One `sort` with a comparator that does no string comparison (ranks only), so no comparison cost scales with a token's length.

**Memory (NFR-01, decision 7, restated for the new shapes).** Every new retained slot is a REFERENCE to a string the pass already retains: a catalog id is a reference into the parsed row's `catalogIds`, and `norm` is the very string the existing `withForms` Set already holds. So the widening is bounded by rows already held, with these constants: at most two references per catalog-id occurrence (day array and checklist array, fewer after de-duplication), at most two Set entries per row carrying a code (day and checklist species sets, dropped at output and replaced by one number each), and one small `DayCodeFact` per distinct (bucket, code) and (checklist, code) pair, each at most the rows carrying a code. The per-code species Sets live only between the pass and the output walk; what `DayCell` retains is the id arrays and the fact arrays. The derivation's retained size therefore grows by a constant factor of the retention `buildDayCells` already had (which was itself at least two Set entries per row), never by anything super-linear, and never by a copy of any string. Section 4.3 is why the ids cannot be replaced by a count.

The Engineer measures the real exported entry point (`buildDayCells`) at doubling input sizes with three fixtures, media-heavy, code-heavy (every row a distinct unknown code, the sort's worst case) and a realistic mix, and requires roughly 2x growth (the measurement method `security.md` v1.0.21 prescribes), stating the figures in the run record. A timing-ratio row is judged only from a quiet machine and states its own `testTimeout` (CLAUDE.md, testing).

### 7.2 Rendering user-file content

The only new user-file text rendered is an unknown breeding code, in three forms (corrected at QA retry 1; the earlier sentence here said the code was "never in an attribute", which contradicted section 6.2):

- **On the tile:** `tileCodeText` (section 6.4, amended), as escaped React children: the whole code up to 2 code points, otherwise its first code point and U+2026.
- **In the day's accessible name and as the popup chip's code:** `codeText`, at most 8 code points plus U+2026, never splitting an astral character. The accessible name is an ATTRIBUTE (`aria-label`), deliberately: section 6.2 reads every code aloud, and decision 15 bounds what that attribute can carry rather than keeping the code out of it.
- **As the popup chip's label:** the raw, unbounded token, as escaped React children, CSS-truncated per the design. This is the only place the raw token appears, and it is never in an attribute.

Every `id` and IDREF the feature adds is a literal or index-keyed string (section 6.5).

### 7.3 The Calendar's closure stays network-free

New static edges from `Calendar.tsx`: `lib/useCalendarOverlays.ts` -> `lib/storage.ts` (already in the closure) and `lib/calendarOverlays.ts` (-> `lib/breedingCodes.ts`, `lib/observationMedia.ts`, `lib/calendar.ts` types); `lib/mlExportCache.ts` -> `lib/storage.ts`, `lib/parseMLExportOffThread.ts` -> `lib/parseMLExport.ts` -> `lib/speciesUtils.ts` (already in), `lib/parseLifeList.ts` (type-only plus `speciesUtils`); `lib/calendar.ts` -> `lib/breedingCodes.ts` (no imports). None matches `NETWORK_MODULES` (`transport.ts`, `tauri/*Service.ts`, `tauri/http.ts`, `networkCache.ts`, `replayStore.ts`), so `networkReach('components/Calendar.tsx')` stays `[]` and both rows at `exoticProvenanceGraph.test.ts:158` stay green. The worker file `mlExportWorker.ts` is reached by a `new URL(..., import.meta.url)` expression, not an import specifier, so the static walkers do not follow it; it is already a shipped asset for the Multimedia, Statistics, Map Explorer and Checklists tabs.

### 7.4 Entry chunk (re-checked for the glyph imports)

- `Calendar` is `React.lazy` (`App.tsx:66`, `:81`) and `entryChunk.test.ts:304` asserts it stays off `App.tsx`'s static closure. Every module in section 7.3 joins the Calendar's lazy chunk. Nothing new reaches `App.tsx`.
- `lucide-react` is already an external of the entry graph (`App.tsx:4` imports `Search`, `Loader2`, ...), and `Camera`, `Mic`, `Video` specifically are already ON the entry chunk because `LifeList.tsx` (the Multimedia tab) is a STATIC import at `App.tsx:31` and imports all three at its line 4. `Calendar.tsx` already imports seven lucide icons. So adding `Camera`, `Mic`, `Video` to `Calendar.tsx`'s existing `lucide-react` import adds no module to the entry chunk, no module to the Calendar chunk (Rollup resolves them to the already-emitted entry modules), and no new external to any closure walk. `vite.config.ts`'s `manualChunks` has no lucide rule, so no chunk boundary changes.
- `lib/calendarOverlays.ts` imports no lucide symbol (section 6.3), so the pure module stays importable in node without React.
- The map-free row at `entryChunk.test.ts:310` is unaffected (no map module is touched); the `dist/`-reading rows at `:778` onward name the county geometry, MapLibre, its worker and the chart library, none of which this feature touches. The Engineer runs the whole `entryChunk.test.ts` after `npm run build`, since those rows read the built `dist/`.

---

## 8. Module boundaries (what lives where)

| Module | Owns | Must not |
|---|---|---|
| `lib/calendar.ts` | the pass, its new fields, the per-bucket sort and category union; `metricNoun` | import React, `storage`, or any component; read `mediaMap` or the switches |
| `lib/breedingCodes.ts` | the table, the rank, the comparator, the resolvers, the category function, order and labels | change the table or the API translation |
| `lib/observationMedia.ts` | `asMediaFormat`, `observationMediaFormats`, `mediaFormatCounts` | know about checklists or days |
| `lib/calendarOverlays.ts` | the key, the default, `normalizeCalendarOverlays`, `OVERLAY_MARK_SPECS`, `breedingMarkKey`, `codeText`, `tileRows`, `mediaFormatPhrases`, `dayNameSuffix` | import React, lucide or `storage` (it is the module the unit tests hit without a DOM) |
| `lib/useCalendarOverlays.ts` | hydrate, `toggle`, `setCodes`, the write chain | render anything, read the files epoch, or know which control is gated |
| `components/Calendar.tsx` | the `mediaMap` effect (section 5.1); `MarkGlyph` and the lucide lookup; threading `overlays` and `mediaMap` to `DayCellButton`, `MiniDayCell`, `CalendarLegend`, `DayPopup`, `PopupChecklistRow`; the two switches and the codes `SegControl` in the Overlays group OUTSIDE the `.sr-cal-forms` cluster (FR-07, D4-05); the `--rich` classes | put the switches or the codes mode in the `cells` memo deps; snapshot `overlays` or `mediaMap` at popup open; re-derive tile rows inline instead of calling `tileRows`; add any new import that section 7.3 does not list |

The visual (tile geometry, the `2.4em` container query, the Large-view rule under the existing 152px query, the legend blocks, the popup lines, the motion) belongs to The Designer's spec. Every color is a `var(--sr-*)` token in both themes (NFR-03); the design adds no token, and `calendarContrast.test.ts` parses whatever `OVERLAY_MARK_SPECS` names (section 9.2).

---

## 9. Guards, tests and seams the Engineer and Tester need

### 9.1 Unit (red-first, NFR-07 / QA-44)

- **`lib/calendar.test.ts`:** the `obs()` factory reads `partial.breedingCode ?? null` and `partial.catalogIds ?? []` instead of the hardcoded `null` / `[]`; the hand-built `DayCell` literals (the ones carrying `speciesCountWithForms:`) gain `mediaPresent: false, mediaIds: [], mediaIdCount: 0, mediaChecklistCount: 0, codes: [], codeCategoryCounts: { confirmed: 0, probable: 0, possible: 0 }, breeding: null` and `catalogIds: [], codes: [], breeding: null` per row, so the file typechecks. Then one `describe` per FR-09 to FR-16 row (QA-09 to QA-18), plus: two unknown codes keep first-seen order and the first is `breeding` (FR-13); a known code after an unknown one sorts first; `speciesCount` counts a species once across two rows carrying the same code and counts a spuh; `codeCategoryCounts.confirmed` is 1 for one species carrying NY and FY; `mediaIds` is first-seen order and de-duplicated within one cell (`["123","123"]` -> `["123"]`) and across rows; a row with no `submissionId` contributes day-level facts and no checklist; All-years unions ids and species sets across years; a species filter makes every `speciesCount` 1. QA-10's fixture goes through `parseEbirdObservations` on a CSV string so the empty/blank/`"ML"`/`"abc, ML12x"`/`"ML123, 456"` cells are exercised end to end.
- **`lib/calendarOverlays.test.ts`:** every QA-04 shape through `normalizeCalendarOverlays`, including `codes` as `'category'`, `'Category'`, missing, `null`, and a pre-amendment two-field document; the frozen default returned only when all three match; `dayNameSuffix` for media on/off x map null/loaded x unknown bucket, breeding on/off, and both; `mediaFormatPhrases` for counts 0, 1, 2 of each format and the unknown bucket (QA-29); `codeText` on a known code, an 8-code-point unknown, a 9-code-point unknown (ellipsis), and a token whose ninth code point is an astral character (never split); `tileRows`: every rule in section 6.4 as its own row, the cap at 3 with `more: 2` for five codes, category grouping picking the strongest code per category with the union count, condensed `more: codes.length - 1` under both modes, and both lists empty with both overlays off; `OVERLAY_MARK_SPECS` has exactly the seven keys, every `token` is `var(--sr-cal-fg)`, and every `kind: 'lucide'` icon is one of the three names.
- **`lib/breedingCodes.test.ts`** (or the existing suite): `resolveDisplayBreedingCode('FY').label === 'Feeding Young'` (the no-translation proof, QA-11), `('ZZ')` is tier 1 with label `ZZ`; `compareBreedingDefs` known-before-unknown, two unknowns equal (0, never NaN), a known pair by rank; `strongerBreedingDef` tie-keeps-a; `breedingCategoryForTier` for all four tiers; `BREEDING_CATEGORY_ORDER` strongest first. The existing `resolveApiBreedingCode` / `strongerBreeding` rows are not edited.
- **`lib/observationMedia.test.ts`:** `mediaFormatCounts` on QA-28's map and ids (`total 4, photo 2, audio 1, video 0, unknown 1`), on `null` (`unknown 0`, O(1) path), on an id whose value is an unrecognised string (counted in `unknown`), and the identity `total === photo + audio + video + unknown` with a loaded map.
- **`lib/useCalendarOverlays.test.tsx`** (renderHook with a mocked `storage`): QA-03 (one `setSetting` per change, all three fields, no write on hydrate), `setCodes` writes all three and is a no-op on the same value, QA-05 (change before a slow `getSetting` resolves; the resolved value loses), QA-06 (rejecting `setSetting`; state stays; next change calls again), rejecting `getSetting` hydrates to default with nothing thrown.

### 9.2 Component and guard

- **`components/Calendar.test.tsx`:** add `vi.mock('../lib/mlExportCache', () => ({ loadMLExport }))` beside the existing `storage` and `observationsCache` mocks (`:67`, `:74`; the storage mock already exposes `getSetting` and `setSetting`). QA-35 to QA-38 drive `loadMLExport` as a `vi.fn()` (pending, resolving `null`, resolving a map) and rerender with a bumped `filesVersion` prop. QA-08 spies on `buildDayCells` via `vi.spyOn` on the `../lib/calendar` module namespace and asserts the call count is unchanged across a switch flip AND a codes-mode change. The codes control's gated state: with Breeding off both options carry `aria-disabled="true"` and `aria-describedby` resolving to the reason text, are in the tab order, and click / Enter / Space call no `setSetting`; with Breeding on the attributes are absent and a press writes all three fields. **QA-22's pre-change capture (step 0 of section 10):** the Engineer runs the capture test ONCE at the branch's base commit (`a9c9042`, before ANY file in this feature is edited, because `metricNoun` and the `DayCell` literals change files the Calendar imports) and commits the result as `frontend/src/components/calendarOverlaysOff.fixture.json`; the assertion substitutes the metric noun into the captured names. This fixture is a committed file, never a gitignored per-run one (CLAUDE.md, v1.0.12), and it is a one-build guard by nature: a later deliberate Calendar restyle regenerates it, which the fixture's header comment says. No `git stash` is used to reach the base state; the capture is simply the first commit of the build.
- **`lib/calendarContrast.test.ts`:** the mark rows (QA-24) reuse this file's `block` / `hexOf` / `contrast` helpers: every token `OVERLAY_MARK_SPECS` names (all `var(--sr-cal-fg)` today) clears 4.5:1 against `--sr-cal-1` to `--sr-cal-5` in both blocks, the text floor rather than the shape floor because the tile rows carry text at 0.5625rem. If The Designer ever adds a token, the row parses it from both blocks and fails when either is missing (NFR-03).
- **Source assertions:** QA-34 (legend, cells and popup all reference `OVERLAY_MARK_SPECS`; `Calendar.tsx` calls `tileRows` and defines no second row derivation), QA-43 (no new regex or `split` in `calendar.ts` beyond `DATE_RE`, which the Tester can pin by counting; no `sort` whose comparator touches a string), the `lib/calendarOverlays.ts` import list contains neither `react` nor `lucide-react`, QA-35's "no network module" (already `exoticProvenanceGraph.test.ts:158`, stays as is).

### 9.3 What must stay green untouched

`breedingCodes`' existing tests, `observationMedia`'s existing tests, `exoticProvenanceGraph.test.ts` (both Calendar rows), `entryChunk.test.ts` (all rows, including the ones that read `dist/`), `cacheInventory.test.ts` (no new store, no new row), `tabOrderCoverage.test.ts` (the switches and the seg options go through the local helpers, which render the `Button` primitive with its default `tabIndex`).

### 9.4 Rule `paths` extensions (same change, CLAUDE.md v1.0.32)

- `.claude/rules/security.md`: add `frontend/src/lib/calendar.ts`, `frontend/src/lib/calendarOverlays*.ts`, `frontend/src/lib/observationMedia*.ts` (each now hosts or twins a declared scan over user-file content).
- `.claude/rules/testing.md`: add `frontend/src/components/calendarOverlaysOff.fixture.json` (a committed fixture the suite reads).

### 9.5 Records

- `ROADMAP.md:244` ("Name the metric in the Calendar's day accessible name") is folded into this build (FR-28) and is removed in the same change.
- `docs/HELP.md` Calendar section (FR-34, the design's Content Notes list what it covers); README / website at most one proposed sentence shown to the user first (FR-35); `appstore/LISTING.md` untouched. Not data layer; listed so the Engineer's checklist is complete.

---

## 10. Migration plan (what the Engineer applies, in order)

0. **Capture the QA-22 fixture at the base commit (`a9c9042`) before editing anything**, and commit it (section 9.2). This is first because steps 1 to 3 change modules the Calendar renders from.
1. `lib/breedingCodes.ts`: add the six exports; refactor the two existing functions onto them; existing tests green.
2. `lib/observationMedia.ts`: add `asMediaFormat` and `mediaFormatCounts` (with `unknown`); refactor `observationMediaFormats` onto the predicate; existing tests green.
3. `lib/calendar.ts`: extend `DayCell` and the checklist row; add the accumulators, the output sort and category union (section 2.3); add `metricNoun`. Fix the `calendar.test.ts` factory and literals; write the red-first rows.
4. `lib/calendarOverlays.ts` (key, default, normalize, the seven-key table, `codeText`, `tileRows`, `mediaFormatPhrases`, `dayNameSuffix`) and its test; `lib/useCalendarOverlays.ts` (with `setCodes`) and its test.
5. `components/Calendar.tsx`: `SegControl` props (section 6.5); the hook; the `mediaMap` effect; `MarkGlyph`; the props threading; the Overlays group (two switches, the codes control, the `.sr-only` reason); the accessible names via `metricNoun` + `dayNameSuffix`; the tile from `tileRows`; the legend from `OVERLAY_MARK_SPECS`; the popup lines. `globals.css`: the class inventory in the design spec, responsive by class, no new token. The Designer's spec governs the visual.
6. `calendarContrast.test.ts` mark rows; `Calendar.test.tsx` rows; source assertions.
7. Rule `paths` extensions; `ROADMAP.md` line removal; `docs/HELP.md`.
8. Linearity measurement (section 7.1, three fixtures) recorded in the run record; `npm run build` then the whole `entryChunk.test.ts`.

No stored document is migrated. A pre-feature install reads no `calendarOverlays` key and hydrates to both-off, Every code; a document written by a pre-amendment build (two fields) reads `codes: 'every'` and is rewritten with three fields on the next change. Nothing is written until a control is used.

---

## 11. Design decisions

1. **Path: Incremental, not Frontend Only.** The persisted key is the deciding fact. Everything else in this feature would be Frontend Only on its own.
2. **Key name `calendarOverlays`, one object, three fields.** One key so the controls are one write and one read (FR-03), an object so the codes mode was a field, not a second key (the shareCopyMode precedent: "one key to migrate from rather than two to keep in sync"), which is exactly what D4-10 cashed in.
3. **OQ-4 tolerant per field, as written.** `{ media: 1, breeding: true, codes: 'CATEGORY' }` is Media off, Breeding on, Every code. An all-or-nothing shape check would throw away a valid Breeding preference over a corrupt Media field.
4. **OQ-5 silent persist failure, as written.** No revert, no toast. The embedded-media preference reverts on failure because a failed opt-out there has a privacy cost; a failed overlay write costs the next session a control change.
5. **Component-local hook, not a module store.** One reader, mounted once; `useSyncExternalStore` would buy sideways propagation nobody needs and cost a test-reset seam. `setCodes` shares `toggle`'s commit path so there is one write shape.
6. **Off drops `mediaMap`.** One rule ("the map exists while Media is on") beats two; the re-read on the next on-flip is a memo hit.
7. **Ids are held, not counted, at both levels; codes are held with species counts at both levels.** Required by FR-10, FR-25, FR-27, FR-32, FR-08 and D4-09 together (section 4.3). Stated as the one widening of NFR-01's allocation clause, with its bound: every retained slot is a reference to a string the pass already held, at a constant per row (section 7.1, memory paragraph).
8. **`breeding` is derived from `codes[0]`**, not folded separately. One derivation; the sort's stability carries FR-13's tie rule.
9. **The rank comparison is exported from `breedingCodes.ts` rather than re-implemented.** "No new code list, no re-litigating where `F` sits" (the brief) means the rank must have exactly one home; `BREEDING_RANK` stays private and the comparator that reads it is exported, with `strongerBreedingDef` defined on it so the API fold and the calendar sort cannot diverge.
10. **The join happens at render, the pass never sees the ML export.** Section 4.3. No memo prescribed; the permitted memo and its trigger are stated there so it is a decision, not an improvisation.
11. **`mediaFormatCounts` is a sibling of `observationMediaFormats` sharing one acceptance predicate**, and its `unknown` bucket is 0 with a null map, so "the export said nothing" and "no export" stay different facts.
12. **No `clearDerived.ts` row** (section 1.5). Preference, not derivation.
13. **`codeCategoryCounts` is computed in the pass's output walk, not summed at render.** The design asks for distinct species at a category; summing per-code counts would double-count a species carrying two codes of one category. A union at output costs one temporary Set per category per bucket and retains three numbers; summing would have been wrong.
14. **`OVERLAY_MARK_SPECS` names lucide glyphs, never imports them.** Keeps `lib/calendarOverlays.ts` React-free and lucide-free so `tileRows` runs under node, and keeps the one glyph lookup in the component that applies it (the same split CLAUDE.md prescribes for a lazy chart's geometry).
15. **An unknown code's text is bounded at the render boundary (`codeText`), not in the parser or the pass.** The design reads every code in the accessible name (D4-09), which replaces the earlier "raw text never in an accessible name" with "never unbounded": eight code points and an ellipsis. The parser and `DayCell` keep the raw token so the popup's label and the tests see what was written.
16. **`security.md` gains `calendar.ts` and `calendarOverlays*.ts`.** The pass already scanned normalized names into Sets before this feature; declaring the new scans is what makes the widened trigger a verification instead of a hunt (v1.0.23), and the rule that governs the file must load when the file is edited (v1.0.32).
17. **The Open Question defaults not already named above** (OQ-2 the group label and switch labels, now fixed by the design's Content Notes; OQ-3 all three breeding categories in the legend; OQ-7 one proposed README/website sentence) are taken as written; none has a data-layer consequence beyond what sections 6.2 and 6.3 already carry. OQ-1 (mark form) is settled by D4-01 and D4-09.

## Data layer summary

One new settings key (`calendarOverlays`, `{ media, breeding, codes }`, device-local, validated per field on read, written whole on each change through the seam on both transports, no backend change). The overlay fields on `DayCell` (distinct ids, every code with its species count, per-category species counts, the strongest code, at day level and per checklist) computed in the existing single pass plus its existing output walk, independent of countability and the escapee rule, folded by the species filter and across years by the existing bucket mechanism. Breeding resolved by direct display-code lookup and ordered by the table's own rank; media presence from parsed `catalogIds` only; the ML export read only while Media is on and joined at render into the tile, the popup and the accessible name. No new scan over raw text; the scans over parsed content are declared in section 7.1 with their bounds, and the retained allocation is a constant factor of what the pass already held. A pure `tileRows` is the one derivation of what a cell shows. Nothing new on the entry chunk (the three lucide glyphs already ship with the Multimedia tab), nothing reaching a network module, nothing in the clear registry, nothing synced.
