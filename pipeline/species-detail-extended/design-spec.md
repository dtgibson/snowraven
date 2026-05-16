# Design Spec — Species Detail Extended
**Feature:** species-detail-extended
**Session:** 001
**Stage:** 4 — The Designer
**Source:** prd.md + strategic-brief.md (approved)

---

## Layout Overview

All four new sections are inserted into `SpeciesDetail.tsx` within the existing ready-state render. No new tabs, routes, or modals. The card stack order (top to bottom) after this feature:

1. Summary card (existing)
2. Sightings + Media grid — `.sr-two-col` (existing)
3. **Recent Media card** (new — only when `hasML === true` and species has media)
4. Breeding Codes card (existing)
5. **Top Locations card** (new — always when species is selected)
6. **Sighting Locations Map card** (new — always when species is selected)
7. Comments card (existing)

---

## Subspecies Toggle

### Placement
Toolbar, between the "Load different file" link and the expand/collapse button. Renders only in the `ready` phase.

### Visual States
- **Show subspecies** (default): button styled as active/filled — `background: var(--sr-accent)`, white label text. Label: `"Show subspecies"`.
- **Merge subspecies**: button styled as outline/inactive — transparent background, `border: 1px solid var(--sr-border)`, muted label text. Label: `"Merge subspecies"`.

### Behavior
- Single click toggles between the two modes.
- The toolbar button text and fill update immediately on click.
- In merge mode:
  - Species selector shows only normalized (parenthetical-stripped) names
  - All stats recalculate: checklist count, individual count, personal best, first/last seen, media counts, breeding codes, comments, locations, map pins
  - The selected species name in the summary card shows the normalized name; scientific name shows the parent taxon scientific name from `sciNameMap` (best-effort — use the first matching entry)
- In show-subspecies mode: behavior identical to current implementation.
- Toggle resets to show-subspecies on file reload or "Load different file."

---

## Recent Media Card

### Visibility
- Appears only when `hasML === true` AND the selected species has ≥1 catalog item for any media type.
- Hidden entirely (not an empty state) when `hasML === false`.

### Card Header
Label: `"Recent Media"`. No badge or icon required in production.

### Layout
- Each present media type (Photo, Audio, Video) renders one iframe, stacked vertically.
- Types with zero items for the selected species are omitted.
- Order: Photo → Audio → Video (matching the existing Media Statistics card order).

### Iframe Spec
```html
<iframe
  src="https://macaulaylibrary.org/asset/{highestCatalogId}/embed"
  title="Most recent {Photo|Audio|Video} of {speciesName}"
  width="100%"
  style="max-width: 640px; height: 480px; border: 0; display: block;"
  loading="lazy"
  allowFullScreen
/>
```
- `catalogId` must match `/^\d+$/` before use; invalid IDs are skipped.
- Highest numeric catalog ID among the type's records = most recently uploaded.

### Spacing
- Each iframe block has a label above it: `"Photo"`, `"Audio"`, or `"Video"` in small muted text.
- 16px gap between iframe blocks.

---

## Top Locations Card

### Card Header
Label: `"Top Locations"`.

### Layout
Single column at all breakpoints (never two-column). Each row:

```
[rank]  [location name]          [count] sightings
```

- Rank: `1.`, `2.`, etc. in small muted text.
- Location name: plain text or `<a>` link (see validation below).
- Count: right-aligned; suffix `"sighting"` / `"sightings"`.

### Default State
Top 10 locations visible. If total unique locations ≤ 10, no button appears.

### Expand / Collapse
- When total > 10: `"Show all {N} locations"` button below the list. Clicking expands to full list + shows `"Show top 10"` button.
- Chevron icon on the button rotates 180° when expanded.

### Location Link Validation
- If `locationId` matches `/^L\d+$/`: render as `<a href="https://ebird.org/hotspot/{locationId}" target="_blank" rel="noreferrer">`.
- Otherwise: plain text.

### Sort
Descending by observation count. Ties broken alphabetically by location name.

---

## Sighting Locations Map Card

### Card Header
Label: `"Sighting Locations"`.

### Map Library
Leaflet.js via `react-leaflet`. Tiles: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` with OSM attribution.

### Map Height
- `300px` on viewports ≤ 640px.
- `380px` on wider viewports.
- Implemented via CSS class or responsive inline style; `width: 100%`.

### Markers
- One marker per unique `(latitude, longitude)` pair.
- Default Leaflet blue circular marker — patched for Vite via CDN icon URL on `L.Icon.Default`.
- No popup, no click interaction (v1).

### Bounds / Initial View
- On species selection (or subspecies toggle change): call `map.fitBounds(uniqueCoordinates)`.
- If only one unique coordinate: `map.setView(coord, 12)`.

### Visibility
- Renders only when the selected species has ≥1 observation with non-null `latitude` + `longitude`.
- Does not render in the "no species selected" state.

### Required Setup
```
npm install leaflet react-leaflet
npm install -D @types/leaflet
```
Import `leaflet/dist/leaflet.css` in `SpeciesDetail.tsx`.

Vite marker patch (once, at module level or in a setup file):
```typescript
import L from 'leaflet'
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})
```

---

## Color Tokens

All new elements use existing `var(--sr-*)` tokens only. No new tokens required.

| Element | Token |
|---|---|
| Toggle button active bg | `var(--sr-accent)` |
| Toggle button active text | `var(--sr-text-on-accent)` or white |
| Toggle button inactive border | `var(--sr-border)` |
| Toggle button inactive text | `var(--sr-text-muted)` |
| Location rank number | `var(--sr-text-muted)` |
| Location count text | `var(--sr-text-muted)` |
| Iframe label text | `var(--sr-text-muted)` |
| Card backgrounds | `var(--sr-card-bg)` |
| Card borders | `var(--sr-border)` |

---

## Mobile Constraints (≤640px)

- Iframe: `width: 100%; max-width: 640px` — never fixed pixel width.
- Map: `height: 300px; width: 100%`.
- Locations list: single column, no horizontal overflow.
- Toolbar toggle button: wraps gracefully if viewport is narrow; no fixed widths.
- All new cards use the standard `sr-card` padding.
