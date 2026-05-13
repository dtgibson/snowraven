# Bug Brief — Life List Species Count Inflated

**Date:** 2026-05-12
**Severity:** Medium — incorrect species count and duplicate rows in Life List

## What's broken

The Life List tab shows more species than the List Comparer for the same CSV file.
Species with subspecies parentheticals in the Common Name column (e.g.
"Yellow-rumped Warbler (Myrtle)" and "Yellow-rumped Warbler (Audubon's)") appear
as separate entries in the Life List but are correctly merged into one in the
List Comparer.

## Root cause

`parseEbird.ts` applies `normalizeSpeciesName()` before keying species into its
set, stripping anything from `(` onward:
```
"Yellow-rumped Warbler (Myrtle)" → "Yellow-rumped Warbler"
```

`parseLifeList.ts` uses the raw Common Name as the `speciesMap` key. Two
rows with the same base species but different parentheticals produce two
separate `LifeListEntry` objects.

## Fix scope

- `frontend/src/lib/parseLifeList.ts` — add `normalizeSpeciesName()` and apply
  it to the Common Name before keying the speciesMap
- `frontend/src/lib/parseLifeList.test.ts` — add a test for parenthetical
  normalization
