# Data Layer Design — Media Sex & Age Filters

**Feature:** media-sex-age-filters
**Stage:** 3 — The Architect
**Path:** **Frontend Only** — no database, no migrations, no new persisted data.

## Data Layer Changes
**None.** No tables, columns, migrations, or backend changes. The feature reads data already loaded in the browser (the parsed Macaulay Library export, `rawRows: MLExportRow[]` held in `LifeList.tsx`) and re-derives counts/links from it. The Python backend is untouched. This file documents the **client data flow** the Engineer implements.

## What already exists (the substrate)
- `MLExportRow.ageSex` — raw per-asset string, e.g. `"Adult Female – 1; Juvenile Male – 1"` (`lib/parseMLExport.ts`).
- `lib/mediaStats.ts` — `parseAgeSex(s) → AgeSexGroup[]` where `AgeSexGroup = { age: AgeClass; sex: Sex; count }`, `AgeClass = 'Adult'|'Immature'|'Juvenile'|'Unknown'`, `Sex = 'Male'|'Female'|'Unknown'`. Token-equality matching (Female ≠ Male). `'' → []`.
- `LifeList.tsx` (the Multimedia tab) — holds `rawRows` and builds `LifeListEntry[]` (`commonName`, `scientificName`, `catalogIds: string[]`). Per-species media counts come from `entry.catalogIds` + `mediaMap: Record<catalogId, 'Photo'|'Audio'|'Video'>`. Existing filters: media pills (`filter.{photo,audio,video} = 'has'|'no'|null`), Has media, Is Target, county, date range, sort, toggles.
- `LifeListTable.tsx` — renders per-species rows; the photo/audio/video counts and the Macaulay links (`mlCatalogUrl`, currently `mediaType` / `taxonCode|taxaName` / `userId`).

## Core design idea — one substitution point
Apply the sex/age facet by substituting each species' considered asset set with the **facet-matching subset**, then let every existing media computation flow from that subset unchanged. One predicate makes counts, the has/no media pills, Has-media, Is-Target, and species visibility all facet-aware consistently.

```
activeFacet = { sex: Sex|null, age: AgeClass|null }   // null/null when no facet
matchingIds(entry) =
  (!sex && !age) ? entry.catalogIds
                 : entry.catalogIds.filter(id => assetMatchesFacet(groupsFor(id), sex, age))
```
Everything downstream that reads `entry.catalogIds` reads `matchingIds(entry)` instead.

## New pure logic (in `lib/mediaStats.ts`, unit-tested)
- **`assetMatchesFacet(groups: AgeSexGroup[], sex: Sex|null, age: AgeClass|null): boolean`** — exact-combo (FR-05):
  - both null → `true`
  - sex only → `groups.some(g => g.sex === sex)`
  - age only → `groups.some(g => g.age === age)`
  - both → `groups.some(g => g.sex === sex && g.age === age)`
  Dropdown values are only `Male/Female` and `Juvenile/Immature/Adult` (never `Unknown`), so an `Unknown`-tagged or untagged asset never matches an active facet (FR-07).
- **`buildCatalogAgeSex(rows: MLExportRow[]): Map<string, AgeSexGroup[]>`** — `catalogId → parseAgeSex(row.ageSex)`. Built once, **memoized on `rawRows`** in `LifeList` (NFR-01 — no per-render re-parse). `groupsFor(id) = map.get(id) ?? []`.

## Wiring (`LifeList.tsx`)
- New state: `sexFilter: Sex | null`, `ageFilter: AgeClass | null` (session-local, like the existing pills — OQ-03 default).
- Two filter controls in the controls row (accessible names per the `Checklists.tsx` pattern, keyboard operable — NFR-02): Sex (—/Male/Female), Age (—/Juvenile/Immature/Adult). `<select>` matches the existing County control idiom on this tab.
- The **All** reset also clears `sexFilter`/`ageFilter` (FR-04).
- Compute `catalogAgeSex` (memoized) and pass it (or `matchingIds`) + the active facet down. The species-visibility + "X of N species" count (`LifeList` ~442–458) gains the facet: a species shows iff `matchingIds(entry)` is non-empty AND it still satisfies the active media pills evaluated **over `matchingIds`** (FR-09 — zero-match species hidden while a facet is active, Dave-confirmed). When no facet is active, behavior is byte-identical to today.

## Wiring (`LifeListTable.tsx`)
- Receives the active facet + `catalogAgeSex` (or a precomputed `matchingIds` per entry).
- Per-species photo/audio/video counts become `matchingIds(entry).filter(id => mediaMap[id] === type).length` (FR-08).
- The has/no media pills evaluate over `matchingIds` too, so "Has photo + Juvenile" = "has a juvenile photo" (coherent composition).

## Macaulay Library link (`mlCatalogUrl`, `lib/statsFormat.ts`)
- Extend the signature with an optional facet: `mlCatalogUrl(name, type, userId, taxonCode?, facet?: { age?: AgeClass; sex?: Sex })`. When a facet value is present, append the ML query param(s) (FR-10).
- **OQ-01 RESOLVED** (user-confirmed example links). The eBird/ML media catalog accepts `&age=` and `&sex=` with **lowercase** values: `age=adult|immature|juvenile`, `sex=male|female`. Map `AgeClass`/`Sex` via `toLowerCase()`; keep the value map in one small constant. Example: `…&mediaType=photo&age=juvenile&sex=male`. Omit a param only when its facet is unset.
- **ML combines the facets as an exact match** — the confirmed `age=juvenile&sex=male` link shows only media depicting an individual that is BOTH (verified live), the same as the in-app exact-combo rule. So the link and the in-app count agree for single AND combined facets; there is no mismatch.
- **Base URL:** the confirmed examples are on `https://media.ebird.org/catalog`; the helper currently builds `https://search.macaulaylibrary.org/catalog` (the same media search). The Engineer confirms the params on the current base and, if there's any doubt, switches the catalog base to `media.ebird.org/catalog` (one isolated change). `userId` / `mediaType` / `taxonCode|taxaName` stay as today.
- Links keep routing through `OutboundLink` (NFR-04).

## Files touched (no new data files)
- `lib/mediaStats.ts` — add `assetMatchesFacet` + `buildCatalogAgeSex` (+ tests).
- `lib/statsFormat.ts` — extend `mlCatalogUrl` + the ML param mapping constant.
- `components/LifeList.tsx` — facet state, two dropdown controls, memoized `catalogAgeSex`, facet-aware species filter + count.
- `components/LifeListTable.tsx` — facet-aware per-type counts + facet on the ML links.
- `frontend/src/types.ts` — (optional) a small `AgeSexFilterState` type if it tidies the props.
- Tests: `mediaStats` matching/edge cases; a `LifeList`/`LifeListTable` test covering filtered counts, species hiding, and link params.

## Risks & edge cases
- **Parse cost** — parse `ageSex` once into the memoized map; never per render (NFR-01).
- **Key alignment** — `mediaMap` and `catalogAgeSex` are both keyed by `catalogId`, so they compose directly; `catalogAgeSex` is global by id and works regardless of the entry-build path (eBird-backbone vs ML-only, subspecies merge on/off).
- **OQ-01 RESOLVED** — ML params confirmed (`age` / `sex`, lowercase values; a combined age+sex link is an exact-combo match, matching the in-app filter — see the link section). The only residual build check was the catalog base URL (now `media.ebird.org`).
- **No-facet path unchanged** — when both dropdowns are clear, `matchingIds === catalogIds`, so the tab behaves exactly as it does today (regression safety).
