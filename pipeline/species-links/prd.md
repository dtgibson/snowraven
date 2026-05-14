# Product Requirements Document — Species Links

## Overview

Species Links adds two small favicon icons after every species common name in SnowRaven. Each icon is a clickable link that opens that species' page on eBird or Birds of the World in a new browser tab. The feature appears in two locations: the Media Life List table (`LifeListTable.tsx`) and the three result panels in the Life List Comparer (`SpeciesPanel.tsx`). Both locations already resolve species names; the Media Life List already has taxon codes available via `taxonMap`. The Comparer needs a new post-comparison taxonomy fetch to get codes for the species in its results.

---

## User Stories

**US-01** — As a birder reviewing my Media Life List, I want to tap the eBird icon next to a species name to open that species' eBird account page, so I can see range maps, photos, and recent sightings.

**US-02** — As a birder reviewing my Media Life List, I want to tap the Birds of the World icon next to a species name to open the full ornithological account for that species.

**US-03** — As a birder comparing two eBird lists, I want the same eBird and BOW icons available next to species names in the Both, A Only, and B Only panels, so I can look up any species without leaving the comparison.

**US-04** — As a user, I want broken or missing icons to be invisible rather than showing broken-image placeholders, so the UI stays clean even when network requests fail.

---

## Functional Requirements

### FR-01 — `SpeciesLinks` Component

Create `frontend/src/components/SpeciesLinks.tsx`. This is a small inline component used wherever a species name is rendered.

**Props:**
```typescript
interface SpeciesLinksProps {
  speciesCode: string | undefined
}
```

**Behavior:**
- When `speciesCode` is falsy (undefined, empty string): renders nothing (`null`).
- When `speciesCode` is present: renders two favicon links in an inline wrapper.
- Each link: `<a>` with `target="_blank"` and `rel="noreferrer"` wrapping an `<img>` favicon.
- `onError` on each `<img>` sets `display: none` to hide failed loads.
- Links open in a new tab; no tooltip or label text is needed.

**Link targets:**
- eBird: `https://ebird.org/species/{speciesCode}`
- BOW: `https://birdsoftheworld.org/bow/species/{speciesCode}/cur/introduction`

**Favicon sources:**
- eBird: `https://ebird.org/favicon.ico`
- BOW: `https://birdsoftheworld.org/favicon.ico`

**Sizing and layout:**
- Icons: 14×14px
- Wrapper: `inline-flex`, `align-items: center`, `gap: 5px`, `margin-left: 6px`, `vertical-align: middle`
- No additional border, background, or hover state on the icons themselves

---

### FR-02 — Media Life List Table Integration

In `LifeListTable.tsx`, add `<SpeciesLinks>` after the common name span in the name cell.

The `taxonMap` prop already exists on this component. Pass `taxonMap[entry.commonName]` as `speciesCode`.

The name cell currently renders:
```tsx
<span style={{ fontSize: 13.5, fontWeight: 500, color: '#0F1117' }}>
  {entry.commonName}
</span>
```

Change to:
```tsx
<div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
  <span style={{ fontSize: 13.5, fontWeight: 500, color: '#0F1117' }}>
    {entry.commonName}
  </span>
  <SpeciesLinks speciesCode={taxonMap[entry.commonName]} />
</div>
```

No other changes to `LifeListTable.tsx`.

---

### FR-03 — Species Panel Integration

In `SpeciesPanel.tsx`, add an optional `taxonMap` prop and render `<SpeciesLinks>` after each species name.

**Prop change:**
```typescript
interface SpeciesPanelProps {
  title: string
  species: string[]
  expanded?: boolean
  taxonMap?: Record<string, string>
}
```

Default `taxonMap` to `{}` if not provided.

In the `<li>` render, change from:
```tsx
<li key={name} ...>{name}</li>
```
to:
```tsx
<li key={name} style={{ ...existing, display: 'flex', alignItems: 'center' }}>
  {name}
  <SpeciesLinks speciesCode={taxonMap[name]} />
</li>
```

---

### FR-04 — ResultsView Prop Threading

`ResultsView.tsx` passes species arrays to `SpeciesPanel`. Add `taxonMap` prop threading.

**Prop change:**
```typescript
interface ResultsViewProps {
  // ... existing props unchanged ...
  taxonMap: Record<string, string>
}
```

Pass `taxonMap` through to all three `<SpeciesPanel>` instances:
```tsx
<SpeciesPanel title="In Both" species={displayBoth} expanded={expanded} taxonMap={taxonMap} />
<SpeciesPanel title={`${nameA} only`} species={displayAOnly} expanded={expanded} taxonMap={taxonMap} />
<SpeciesPanel title={`${nameB} only`} species={displayBOnly} expanded={expanded} taxonMap={taxonMap} />
```

---

### FR-05 — ListComparer Taxonomy Fetch

`ListComparer.tsx` needs to fetch taxon codes after each comparison.

**State addition:**
```typescript
const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
```

**After `handleCompare` runs `compareSpecies`**, fire an async taxonomy fetch:
```typescript
const handleCompare = async () => {
  if (!fileA || !fileB) return
  const compResult = compareSpecies(fileA, fileB)
  setResult(compResult)
  // fire-and-forget taxonomy fetch
  fetchTaxonCodes([...compResult.both, ...compResult.aOnly, ...compResult.bOnly])
}

async function fetchTaxonCodes(names: string[]) {
  try {
    const res = await fetch('/taxonomy/codes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ species: names.map(n => ({ commonName: n, scientificName: '' })) }),
    })
    if (!res.ok) return
    const data = await res.json()
    setTaxonMap(data.codes ?? {})
  } catch {
    // silently fail; icons simply won't appear
  }
}
```

The taxonomy endpoint already accepts `scientificName: ''` and falls back to common name matching — no backend changes needed.

**On reset:** clear `taxonMap` back to `{}`.

**Pass `taxonMap` to `ResultsView`:**
```tsx
<ResultsView
  ...
  taxonMap={taxonMap}
/>
```

---

### FR-06 — No Backend Changes

No new backend endpoints, routes, or schema changes are required. The existing `POST /taxonomy/codes` endpoint handles all lookup needs.

---

### FR-07 — Graceful Degradation

- If `taxonMap` is empty (fetch pending or failed): no icons render. Names display as before.
- If a species name has no entry in `taxonMap`: no icons for that row.
- If a favicon image fails to load: `onError` sets `display: none` on that `<img>`. The other icon (if it loaded) continues to show.
- Soundscape entries in the Media Life List have no taxon code by definition: no icons shown.

---

## Out of Scope

- Tooltip text on favicons
- Any icon other than the site's own favicon
- Scientific name links
- Any third-party favicon proxy
- Prefetching or caching favicons
- Backend changes

---

## Acceptance Criteria

**QA-01** — In the Media Life List, each species row shows two small favicon icons to the right of the common name after taxon codes load.

**QA-02** — Clicking the eBird icon opens `https://ebird.org/species/{speciesCode}` in a new tab.

**QA-03** — Clicking the BOW icon opens `https://birdsoftheworld.org/bow/species/{speciesCode}/cur/introduction` in a new tab.

**QA-04** — Soundscape entries in the Media Life List (no species code) show no icons.

**QA-05** — Before the taxonomy fetch completes, species names in both components display without icons and without any visible loading state.

**QA-06** — After running a comparison in the Life List Comparer, species names in all three panels (Both, A Only, B Only) show eBird and BOW icons once the taxonomy fetch completes.

**QA-07** — If the `/taxonomy/codes` fetch fails in the Comparer, comparison results display normally with no icons and no error message.

**QA-08** — Resetting the Comparer (→ Compare new files) clears the taxon map so stale codes from the previous comparison are not shown.

**QA-09** — A broken favicon does not show a broken-image placeholder; the `<img>` is hidden via `onError`.

**QA-10** — Links open in a new tab (`target="_blank"`); middle-clicking or cmd-clicking also opens in a new tab.

**QA-11** — No TypeScript errors introduced. CI passes.
