# BirdingStats species-name lookup hardening

## What this does

Statistics now treats taxon-code tables keyed by species names from the user's
CSV as own-property maps. `normTaxon` is a null-prototype accumulator, and the
raw map, normalized map, and cover-index callback all use `Object.hasOwn` before
reading a code.

That closes two manifestations of the same pre-existing defect:

- missing prototype-chain names such as `__proto__`, `constructor`, and
  `toString` no longer masquerade as taxon codes and suppress species-link icons;
- a hostile name in a Media ranking can no longer become a malformed Macaulay
  Library `taxonCode` filter such as `%5Bobject%20Object%5D`.

Raw-name resolution still takes precedence over normalized-name fallback, and
the raw-name-plus-normalized-parent taxonomy batch is unchanged.

## Regression coverage

`BirdingStatsPrototypeNames.test.tsx` now drives the real component through:

- missing `__proto__`, `constructor`, and `toString` codes, including all three
  Media ranking link paths;
- a genuine own `__proto__` code created with `JSON.parse`, with a guard proving
  the fixture owns that property;
- a raw form key that normalizes to `__proto__`, proving the real accumulator
  retains the key;
- a parsed object-valued `__proto__` pollution probe;
- source pins for the null-prototype accumulator and all three own-property reads.

The existing `sciByNorm` hostile-name coverage remains intact.

## Verification

- Focused Vitest sweep: 6 files, 96 tests passed. It includes
  `BirdingStatsPrototypeNames`, `BirdingStatsTaxonomyBatch`, `BirdingStats`,
  `SpeciesLinks`, `exoticProvenance`, and `useExoticProvenance`.
- `npm run typecheck`: passed.
- ESLint on the two changed frontend files: passed.
- `npm run build`: passed; only Vite's existing large-chunk advisory was emitted.

## Scope and release note

This does not change `normTaxonOrder`, Species Detail, Named Birds, Checklists,
Life List, Map Explorer, Breeding Codes, List Comparer, or other consumer-side
taxonomy maps. That broader lookup sweep remains tracked separately.

This is a Spool checkpoint. It deliberately does not bump a version, edit the
changelog or website, deploy, commit, or change durable roadmap/rule files. The
consolidated Spool flush applies one shared patch stamp and release for the whole
bundle.
