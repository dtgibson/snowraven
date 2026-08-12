# csv-parser-intergrade-filter

## What this does

Four CSV parser modules independently classified a raw exported common name with
`name.includes(' x ')`. That correctly removed a true hybrid such as
`Mallard x American Black Duck (hybrid)`, but it also removed a countable intergrade such
as `Yellow-rumped Warbler (Myrtle x Audubon's)`, where the marker exists only inside the
trailing parenthetical. The row vanished before the parser could fold it into its parent
species.

`parseEbird`, `parseLifeList`, `parseMLExport`, and both direct and observation-derived
paths in `parseBreedingCodes` now delegate to `isNonCountableObservedName`, the existing
canonical predicate for a raw export name. It deliberately tests spuh/slash on the raw
name and tests `" x "` after normalization. Each parser still uses
`truncateAtFirstParen` afterward, so its normalization behavior and malformed-input
contract are unchanged.

The bundled taxonomy measures the exact effect: among 17,891 unique common names, the old
private predicate excluded 2,647 and the canonical predicate excludes 2,611. The 36
rescued forms normalize to 26 parent species; zero names are newly excluded. True hybrids,
spuhs, and raw-name slashes—including a slash inside a parenthetical—remain excluded.

The correction also preserves row-level data. Given all 36 intergrade forms, the ML parser
now returns 26 grouped entries while retaining 36 media rows and catalog-map entries; the
Breeding Codes parser returns 26 grouped entries while retaining 36 breeding rows. The
direct CSV path and the live observation-derived Breeding Codes path remain identical.

## How to test

```sh
cd frontend
npx vitest run src/lib/csvParserIntergradeFilter.test.ts src/lib/parseEbird.test.ts src/lib/parseLifeList.test.ts src/lib/parseMLExport.test.ts src/lib/parseBreedingCodes.test.ts src/lib/deriveBreedingData.test.ts src/lib/speciesUtils.test.ts src/lib/normalizeSpeciesNameParity.test.ts
npm run typecheck
npm run lint
npm run build
```

The focused run passes 111 tests across eight files. Typecheck and lint are clean. The
production build passes with only its existing informational large-chunk warning.

## Notes for reviewer

- The regression suite drives the **real exported parser functions**, not predicate copies.
  Its small fixture covers one discriminating trailing-parenthetical intergrade alongside
  a true hybrid, spuh, and raw parenthetical slash at every entry point.
- Its taxonomy fixture derives the 36 affected forms live, pins 0 newly excluded names and
  26 normalized entries, and verifies all 36 ML/breeding rows survive. Replacing any parser
  call site with the named old predicate makes that parser's assertions fail.
- `parseBreedingCodes` has two shipped filter paths. The suite exercises
  `parseBreedingCodes`, `deriveBreedingRows`, and `deriveBreedingData`, and asserts direct
  versus derived output equality.
- No parser format, tokenizer, ordering, grouping, catalog-ID, breeding-code, or error
  behavior changed. `truncateAtFirstParen` remains separate from `normalizeSpeciesName`;
  only classification delegates to the canonical raw-name predicate.
- No version or changelog edit: this is a hands-off Spool build, versioned once when the
  bundle ships.
