# Change Brief — mobile-simplification

## Track
Maintain (no new user-facing behavior — removal of existing functionality)

## Summary
Two independent removals that simplify the UI for mobile use:
1. Remove all expand/collapse functionality across every tab — natural page scroll replaces bounded panels
2. Remove the eBird backup path from the Media List tab — ML export becomes the sole input method

---

## Change 1 — Remove Expand/Collapse

### Problem
The expand/collapse toggle creates a height-bounded scrollable panel inside the viewport. On mobile, this results in a scroll-within-scroll experience where the inner panel is nearly impossible to navigate. The "expanded" state (natural page scroll) is the correct default for all screen sizes.

### Files to Change

**`frontend/src/App.tsx`**
- Remove `isExpanded` state (line 35)
- Remove `onExpandedChange={setIsExpanded}` prop from all four tab components
- Always use `minHeight: '100vh'` layout; remove the conditional `height: '100vh', overflow: 'hidden'` branch
- Remove conditional `flex: 1, minHeight: 0, overflowY: 'auto'` from tab panel wrappers

**`frontend/src/components/LifeList.tsx`**
- Remove `expanded` prop and type
- Remove `onExpandedChange` prop and `handleToggleExpanded` callback
- Remove "Show all / Collapse" toggle button JSX
- Remove conditional flex/minHeight logic tied to `expanded`

**`frontend/src/components/BreedingCodeList.tsx`**
- Same removals as LifeList.tsx

**`frontend/src/components/SpeciesDetail.tsx`**
- Same removals as LifeList.tsx

**`frontend/src/components/ListComparer.tsx`**
- Remove `expanded` state and `onExpandedChange` prop

**`frontend/src/components/ResultsView.tsx`**
- Remove `expanded` prop
- Remove conditional `flex: expanded ? 'none' : 1` and `minHeight: expanded ? 'auto' : 0`
- Remove "Show all / Collapse" button

**`frontend/src/components/SpeciesPanel.tsx`**
- Remove `expanded?: boolean` prop
- Remove conditional `overflow: expanded ? 'visible' : 'hidden'`, `overflowY`, `flex`, `minHeight` logic

---

## Change 2 — Remove eBird Path from Media List

### Problem
The Media List tab accepts both ML export files and eBird observation CSVs. The eBird path requires a batch of HEAD requests to the Cornell CDN to determine media types, adding complexity and latency. ML export is the canonical input and includes media-type data directly. The eBird path is redundant and adds surface area.

### Files to Change

**`frontend/src/components/LifeList.tsx`**
- Remove `BATCH_SIZE` constant
- Remove `Source` type (`'ml-export' | 'ebird'`)
- Remove `loading` phase from the `Phase` union type (keep `idle`, `error`, `ready`)
- Remove `obsToLifeListEntries()` helper function
- Remove `startMediaLookup()` async function
- Remove secondary eBird drop zone JSX (the second `<DropZone>` block)
- Remove `mlError` and `source` fields from the `ready` phase
- Simplify `processFile` to ML-export-only path
- Simplify `displayEntries` useMemo (no longer needs to branch on source)
- Remove `rawRows` and `countyResolution` state (if still used only for eBird path)
- Update `phaseEntries` useMemo accordingly

**`backend/routers/ml.py`**
- Delete file entirely

**`backend/tests/test_ml_router.py`**
- Delete file entirely

**`backend/main.py`**
- Remove `from routers.ml import router as ml_router`
- Remove `app.include_router(ml_router)`

**`frontend/vite.config.ts`**
- Remove `'/ml': 'http://localhost:1620'` proxy entry

---

## Out of Scope
- No changes to filters, county resolution, Nominatim, or any other tab behavior
- No new UI surfaces
- No changes to backend data shape or API contracts (the nominatim router remains)
- No changes to SpeciesDetail, BreedingCodeList, or ListComparer data logic

---

## Risks
- Low. Both changes are subtractive — removing code paths that will no longer exist. The remaining ML-only path in LifeList is already the primary, tested path. The expand/collapse removal simplifies layout logic in each component.
- The `rawRows` and `countyResolution` state in LifeList was added for the county resolution feature and feeds the Nominatim lookup — confirm these remain untouched; only remove state/logic exclusive to the eBird media lookup path.

---

## Version
Will bump `frontend/package.json` from `0.0.35` → `0.0.36`
