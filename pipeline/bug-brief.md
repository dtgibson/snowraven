# Bug Brief — mobile-map-and-defaults-fix

## Bug 1: Sidebar never hides on mobile (map gets pushed, not covered)

**Symptom:** On mobile, pressing Filters pushes the map to the right instead of overlaying it. The sidebar can't be dismissed.

**Root cause:** The sidebar `<div>` has `display: 'flex'` as an inline style (MapExplorer.tsx line 1336). Inline styles have CSS specificity 1,0,0. The `.sr-map-sidebar-hidden` class sets `display: none` with specificity 0,2,0. Inline always wins — the sidebar is never actually hidden, so it permanently occupies 268px in the flex row and pushes the map off to the right. Same issue with `overflow: 'hidden'` inline overriding the CSS class's `overflow-y: auto` on mobile.

**Fix:** Remove `display` and `overflow` from the sidebar's inline style. Add them to the base `.sr-map-sidebar-overlay` CSS class so the media query can override them correctly.

---

## Bug 2: Filters button and sidebar hidden under Leaflet layers

**Symptom:** On mobile, the Filters button is invisible — the map covers it entirely.

**Root cause:** Leaflet internal z-indices: tile pane = 200, overlay pane = 400, marker pane = 600, popup pane = 700, controls = 1000. Our elements sit at: Filters button = 30, backdrop = 40, sidebar = 50. Every Leaflet layer is on top.

**Fix:** Raise z-indices above Leaflet's maximum (1000): Filters button → 1050, backdrop → 1100, sidebar overlay → 1200.

---

## Bug 3: Map doesn't pan to default location on mount

**Symptom:** Saving a default location in Settings pre-fills the lat/lng/radius fields in Map Explorer correctly, but the map stays centered on North America (zoom 4) until the user fetches results.

**Root cause:** `MapContainer center={[45, -100]} zoom={4}` are initial values only — changing `lat`/`lng` state does not move the map. There is no mechanism to programmatically pan the map when defaults are loaded.

**Fix:** Add `defaultCenter: { lat, lng, zoom } | null` state. When the defaults fetch resolves on mount, set it with a zoom derived from radius (dist ≤ 5 mi → zoom 12, ≤ 10 → zoom 11, ≤ 25 → zoom 10, > 25 → zoom 9). Add a `DefaultCenterSetter` null-rendering child inside `MapContainer` — same pattern as the existing `MapPanner` — that calls `map.setView()` once, then clears the state.

---

## Files affected
- `frontend/src/globals.css` — z-index corrections, move `display` and `overflow` to base CSS class
- `frontend/src/components/MapExplorer.tsx` — remove inline `display`/`overflow` from sidebar div; add `DefaultCenterSetter` component and `defaultCenter` state; set it in the defaults fetch effect
