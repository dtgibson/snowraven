# Architecture / Technical Design — Standardized Bird-Name Format

**Lane:** New Feature · **Date:** 2026-06-04 · Builds on prd.md

## Files

**New**
- `frontend/src/components/BirdName.tsx` — the shared component.
- `frontend/src/components/BirdName.test.tsx` — unit tests.

**Changed**
- `frontend/src/App.tsx` — `requestedSpecies` state + `navigateToSpeciesDetail`,
  prop wiring to all bird-name tabs.
- `frontend/src/components/SpeciesDetail.tsx` — `requestedSpecies` /
  `onRequestedSpeciesConsumed` props + consume effect; refactor internal name
  renders (Reported With, Top Locations) to `<BirdName>`.
- `frontend/src/components/BirdingStats.tsx` — all lists → `<BirdName>`; build a
  `backboneNames` set; flip name/number links.
- `frontend/src/components/MapExplorer.tsx` — target popups + nearest-targets →
  `<BirdName>`; move pan off the name.
- `frontend/src/components/LifeListTable.tsx`, `BreedingCodeTable.tsx`,
  `SpeciesPanel.tsx` — replace ad-hoc `SpeciesLinks` usage with `<BirdName>`.

`SpeciesLinks.tsx` stays as-is (BirdName composes it).

## BirdName.tsx (contract)

```tsx
interface BirdNameProps {
  commonName: string
  scientificName?: string
  taxonCode?: string
  hasEntry?: boolean
  onOpenSpecies?: (commonName: string) => void
  showSci?: boolean
  size?: 'sm' | 'md'
}
```
- Common name: if `hasEntry && onOpenSpecies` → `<button class="sr-birdname-link"
  tabIndex={0} onClick={() => onOpenSpecies(commonName)}>` styled as a link;
  else a plain `<span>`.
- Then `<SpeciesLinks speciesCode={taxonCode} />` (no-ops if undefined).
- Then, if `showSci && scientificName`, an italic muted `<span class="sr-birdname-sci">`
  that may wrap/hide (CSS `min-width:0`, `overflow` handled by container).
- Wrapper `<span class="sr-birdname">` is `inline-flex; align-items:center; gap`.
- No data fetching. Pure. Memoizable.

## Navigation

**App.tsx**
```ts
const [requestedSpecies, setRequestedSpecies] = useState<string | undefined>()
const navigateToSpeciesDetail = useCallback((commonName: string) => {
  setActiveTab('species-detail')
  setRequestedSpecies(commonName)
}, [])
const clearRequestedSpecies = useCallback(() => setRequestedSpecies(undefined), [])
```
- Pass `onOpenSpecies={navigateToSpeciesDetail}` to BirdingStats, MapExplorer,
  LifeList, BreedingCodeList, ListComparer.
- Pass `requestedSpecies` + `onRequestedSpeciesConsumed={clearRequestedSpecies}`
  to SpeciesDetail.

**SpeciesDetail.tsx** (consume — single-use, pending-safe)
```ts
useEffect(() => {
  if (phase.tag !== 'ready' || !requestedSpecies) return        // stay pending until ready
  const target = mergeSubspecies ? normalizeSpeciesName(requestedSpecies) : requestedSpecies
  const match = displaySpeciesList.includes(target)
    ? target
    : displaySpeciesList.find(n => normalizeSpeciesName(n) === normalizeSpeciesName(requestedSpecies))
  if (match) { selectSpecies(match); scrollDetailIntoView() }
  onRequestedSpeciesConsumed?.()                                 // consume regardless (avoid re-fire)
}, [phase.tag, requestedSpecies, mergeSubspecies, displaySpeciesList, onRequestedSpeciesConsumed])
```
- For SpeciesDetail's OWN internal names (Reported With, Top Locations), use the
  local `selectSpecies` directly as `onOpenSpecies` (no App round-trip) +
  `scrollDetailIntoView()`.
- `scrollDetailIntoView`: scroll the detail container to top (a `ref` +
  `scrollIntoView`/`window.scrollTo`) so a selection triggered from elsewhere is
  visible.

## Per-tab `hasEntry` + taxon-code sourcing

| Tab / list | hasEntry source | taxonCode source |
|---|---|---|
| **Stats — all lists** | `backboneNames = new Set(rawObs.map(o => normalizeSpeciesName(o.commonName)))`; `hasEntry = backboneNames.has(normalize(name))` | `mlTaxonMap` (backbone/ML) ∪ `nemesisTaxonMap` (targets) |
| **Stats — nemesis/targets** | usually `false` (not in backbone) | `nemesisTaxonMap` |
| **Map — target popups & nearest list** | `backbone set from the loaded backup` (MapExplorer already parses it for visited classification); targets usually `false` | `speciesCodeMap` |
| **Media List** | `true` (list is the backbone) | `taxonMap` (already) |
| **Breeding Codes** | `true` | resolved map (already) |
| **List Comparer** | per-panel: "both"/"My List" → likely true; "Other List only" → not in your data → `false` (it's the other birder's list). Build hasEntry from the user's own list set. | `taxonMap` (already) |
| **Species Detail (Reported With/Top Locations)** | `true` (co-occur in your data) | `taxonMap` (already) |

Notes:
- `normalize` = `normalizeSpeciesName`; build sets with normalized keys so
  subspecies match the Species Detail entry.
- Where a taxon map lacks a name, favicons simply don't render (graceful). The
  Engineer extends a map only if a site has NO code resolution at all.
- **List Comparer nuance:** "Other List only" species belong to the *other*
  birder; by D1 they're plain name + favicons (hasEntry=false). "Both" and "My
  List only" are in the user's data (hasEntry=true).

## Link-relocation specifics (the "move the link to the number" rule)

| Site | Name today | After |
|---|---|---|
| Stats Most Photographed/Audio/Video | name → ML catalog | name → Species Detail; **count → ML catalog** |
| Stats Single-Checklist / One-and-Done | name → checklist | name → Species Detail; **count/date → checklist** |
| Stats Milestones | plain pill | name → Species Detail; **date/“#N” → checklist** |
| Stats Biggest single counts | count already linked | name → Species Detail; count link unchanged |
| Map nearest-targets | row → pan map | name → Species Detail; **distance/locate icon → pan** |
| Map target popup | plain text | name → Species Detail (if entry) + favicons |

## CSS (globals.css)
- `.sr-birdname` (inline-flex, gap, `min-width:0` so it can shrink),
  `.sr-birdname-link` (link-styled button: accent color, underline-on-hover,
  inherits font, focus ring), `.sr-birdname-sci` (italic, muted, `white-space:
  nowrap; overflow:hidden; text-overflow:ellipsis` within flex). Tokens only.

## Testing
- `BirdName.test.tsx`: (1) hasEntry+onOpenSpecies → renders a button, click calls
  with commonName; (2) !hasEntry → plain text, no button; (3) favicons present
  when taxonCode set, absent when not; (4) sci shown only when showSci+name;
  (5) keyboard activation.
- Regression: full suite stays green (266 → 266+new).
- Manual/live: click-through from each tab → correct species selected on Species
  Detail; not-in-backup birds are plain+favicons; counts carry the relocated
  links; mobile widths don't overflow.

## Risks / mitigations
- **Stale `requestedSpecies` re-firing** → consume clears it; effect guarded on
  `phase.tag==='ready'`.
- **Name not found** (spuh hidden, or mismatch) → no-op + consume; no crash.
- **Backup not loaded** when clicking from a tab that has data but Species Detail
  doesn't yet → effect stays pending until `ready`, then selects.
- **Double links nested** (a name button containing favicon anchors) → keep
  favicons as siblings AFTER the name button, never nested, to avoid invalid
  interactive nesting.
