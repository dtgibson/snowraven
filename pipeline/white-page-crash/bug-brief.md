# Bug Brief — white-page-crash

## What was broken

SnowRaven loaded briefly then turned completely white with no content or error
message visible. The crash was reproducible on every page load for users who had
an eBird file stored in Settings, or any time a file was loaded into the
Breeding Codes tab.

## Root cause

In `frontend/src/components/BreedingCodeList.tsx`, three `useMemo` hooks
(`counties`, `filteredRows`, `displayData`) were placed **after** conditional
early returns for the `loading-saved` and `idle`/`error` phases (lines 278,
286, 298 in the original file).

React requires hooks to be called in the same order on every render. On the
initial render with `phase = 'loading-saved'`, the component returned early
before reaching those hooks — hook count N. When the auto-load effect resolved
and set `phase = 'ready'`, the early returns did not fire and React tried to
call three additional hooks — hook count N+3. React detected the mismatch,
threw "Rendered more hooks than during the previous render," and unmounted the
entire component tree, producing a white page.

All other components (`LifeList`, `SpeciesDetail`) placed their equivalent
memos correctly before any early return. `BreedingCodeList` was the only
affected component.

## Fix applied

- Added `phaseData = phase.tag === 'ready' ? phase.data : null` before the
  early returns
- Moved `counties`, `filteredRows`, and `displayData` useMemos to before the
  early returns, with null-safe guards (`if (!phaseData) return []` / `null`)
- After the early returns, destructured from `displayData!` and used
  `phaseData!.entries.length` for `totalSpecies` (both are provably non-null
  when `phase.tag === 'ready'`)
- Added `BreedingCodeRow` to the type import (needed for the explicit return
  type annotation on `filteredRows`)

## Files changed

- `frontend/src/components/BreedingCodeList.tsx`
