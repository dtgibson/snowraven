# Schema — Map Explorer Improvements
**Feature:** map-explorer-improvements
**Session:** 001
**Date:** 2026-05-23
**Stage:** 3 — The Architect

---

## Root Cause — Personal Hotspot Radius Bug

`radius` state is in miles (UI options: "5 mi / 10 mi / 25 mi / 50 mi"). The eBird API expects `dist` in km. Both fetch calls pass `dist=${radius}` directly, so:
- Public hotspots: bounded to `radius` km (~60% of intended area)
- Personal pins: comparison `distanceMiles() <= radius` is correct (miles)
- Result: personal pins appear farther out than public hotspots

**Fix:** Convert in both fetch calls before the URL is constructed:
```typescript
const distKm = Math.round(radius * 1.60934)
// use distKm in fetch URL
```

The personal pin comparison at line 910 is already correct — no change needed there.

---

## New State

```typescript
const [targetTypeFilter, setTargetTypeFilter] = useState<Set<'Photo' | 'Audio' | 'Video'>>(new Set())
```

Empty set = "All" selected. No new exported types needed.

---

## Modified useMemo — displayedTargetPins

Replace the current implementation (lines 836–849) with a two-pass version:
1. Recency filter (unchanged logic)
2. Type filter: `[...targetTypeFilter].every(t => pin.missingTypes.includes(t))`

Add `targetTypeFilter` to the dependency array.

`nearest10` and `TargetMarkers` both derive from `displayedTargetPins` automatically.

---

## Reset in handleFindSightings

Add `setTargetTypeFilter(new Set())` at the start of `handleFindSightings`.

---

## New JSX — Filter Pills

Inserted inside `{targetPins !== null && ...}` block, before the existing "Time Range" section. Uses `SidebarLabel`, pill buttons with `var(--sr-is-target-*)` amber tokens for active state.

Pills: All (mutually exclusive), Photo / Audio / Video (multi-select AND logic).

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/components/MapExplorer.tsx` | `targetTypeFilter` state; modified `displayedTargetPins`; `distKm` conversion in both fetch calls; filter pills JSX; reset on fetch; empty state update |
