# PR — Mobile Chart Tip + Escapee-Count Fix (v1.0.1)

## Escapee-count fix (scope amendment, user-directed)

### What this does
Repairs the Statistics escapee check for species recorded only as
"(Domestic type)" forms, which resolved no species code, never entered the
escapee cover, and silently counted (the tab read "zero escapees"). The
taxonomy batch now also carries each form's normalized parent name
(`BirdingStats.tsx`), and a store poisoned by a broken pass heals itself: a
consulted checklist standing for a recordless cover species is re-consulted
once (`carriersNeedingRefetch` in `exoticProvenance.ts`, explicit `refetch`
intent through `dedupedFetchChecklist`). Red-first tested (two repair tests
fail on the unfixed sources), full suite 3029 green, and verified live
end-to-end: one Statistics visit took the real store from zero to the three
correct escapees with their X evidence, ledger 76 → 79.

## Mobile Chart Tip

### What this does
Adds a small, dismissible, phone-only tip above the charts on the Statistics
and Species Detail tabs: charts get more room in landscape, so rotate the
device for a wider view, or open the desktop app if you have it. Neutral and
informational by design. Each tab shows it once; dismissal persists per page
through the storage seam and never returns. Tablets and desktops never mount
it.

### How to test
1. `cd backend && uvicorn main:app --port 1620` (serves the built frontend)
2. Open the app on a phone (or a ≤640px viewport) and visit Statistics: the
   tip sits above the Life List Totals card. Visit Species Detail with a
   species selected: the tip sits above the Sightings Over Time graph (it does
   not render when the graphs don't).
3. Dismiss on one tab: it collapses (220ms; instant under reduced motion) and
   the other tab still shows its own. Relaunch/reload: neither dismissed tip
   returns.
4. Widen past 640px: the tip never renders at all.

### Notes for reviewer
- New shared component `frontend/src/components/ChartViewTip.tsx` +
  `.sr-chart-tip*` classes in `globals.css`; wired into `BirdingStats.tsx`
  (above the first chart card) and `SpeciesDetail.tsx` (gated on
  `hasGraphData`).
- Phone detection is the sanctioned `useIsPhone` render-branch; persistence is
  a `chartTipDismissed` per-page map via `storage.getSetting`/`setSetting`
  (WelcomeScreen `welcomeSeen` precedent), merge-written so pages never
  clobber each other; closed-until-hydrated so a dismissed install never
  flashes it.
- 8 new tests in `ChartViewTip.test.tsx` (render/hide by width, hydration
  flash guard, per-page isolation, merge persistence, animated and
  reduced-motion dismissal, corrupt-value tolerance). `npm run build`,
  targeted vitest (incl. `helpToc` + `entryChunk` guards), and eslint all
  green.
- Docs in the same change: HELP.md (both tab sections), README, CHANGELOG,
  website version pill/footer to v1.0.1 (no site feature-copy change: the tip
  is a hint, not a capability — flagged for the record keeper).
- Versions bumped in BOTH `frontend/package.json` and
  `src-tauri/tauri.conf.json` (1.0.1).

## Seeing Mobile Chart Tip locally

1. Open a terminal in your project folder
2. Start the app: `cd backend && uvicorn main:app --port 1620`
3. On your phone (same tailnet), open the served URL
4. Open the Statistics tab: the tip is above the first card's chart
5. Open Species Detail and pick a species: the tip is above the graphs
6. Dismiss each once: they collapse and stay gone, including after a reload

## Convention Flags
- None new. Follows existing conventions (storage-seam persistence,
  `useIsPhone` render-branch, lifted-to-class styling, no-em-dash copy).
