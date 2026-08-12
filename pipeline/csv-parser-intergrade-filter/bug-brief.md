# Bug Brief — csv-parser-intergrade-filter

## What is broken

`parseEbird`, `parseLifeList`, `parseMLExport`, and both `parseBreedingCodes` paths test raw names for `" x "`; unlike `isNonCountableObservedName`, this mistakes a trailing-parenthetical intergrade for a hybrid. The bundled taxonomy confirms 36 wrongly dropped names (26 base species) and 0 newly dropped under the shared rule. Real-parser probes return 0 entries/rows for all 36 today.

## Steps to reproduce

1. Build one valid fixture per parser containing `Yellow-rumped Warbler (Myrtle x Audubon's)` (and a valid ML ID/format or breeding code where required).
2. Run `parseEbirdCSV`, `parseLifeList`, `parseMLExport`, `parseBreedingCodes`, and `deriveBreedingRows`; each returns no species/row.
3. Sweep the 17,891 unique `ebird-taxonomy.json` `byCode` names: raw `isExcluded` drops 2,647, while `isNonCountableObservedName` drops 2,611—36 rescued, 0 newly excluded.

## Expected behavior

The four parser modules use the shared raw-observation predicate: countable intergrades survive and normalize to their parent species; true base-name hybrids, spuhs, and raw-name slashes remain excluded. Across the snapshot fixture, outputs become 26 distinct parent entries; ML and breeding retain all 36 valid source rows.

## Blast radius

Direct code scope is the four parser modules plus their tests; `parseBreedingCodes` has direct and derived paths that must stay equivalent. User-visible effects include List/Checklist Comparer backbones, ML-backed Life List and every `loadMLExport` row consumer (media statistics, maps, details, checklists, named birds), and Breeding Codes entries/filters/counts. Observation-driven Statistics/Calendar already use the correct predicate and must not move; keep `truncateAtFirstParen` and the raw slash rule unchanged.

## What done looks like

All parser paths delegate exclusion to `isNonCountableObservedName`; discriminating intergrade tests fail if raw `name.includes(' x ')` returns, while true hybrid/spuh/slash guards remain green. A live snapshot guard pins 36 rescued / 0 newly excluded and 26 normalized entries, plus 36 ML and breeding rows; direct and derived breeding output stays equal. Parser suites and the full frontend build pass.
