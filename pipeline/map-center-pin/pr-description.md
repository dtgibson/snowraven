## map-center-pin (0.5.43)

### What this does
Adds a draggable center pin to the Map Explorer's Hotspots, Nearby Lifers, and
Media Targets views. Right-click (desktop) or long-press (touch) anywhere on the
map drops a center pin there; dragging it fine-tunes. Each placement sets the
shared search center and re-runs the active view's search. Session-only — it does
not change the saved Default Location.

### How it works
- New map children in `components/map/MapControls.tsx`: `CenterPinDropper` (binds
  `map.on('contextmenu')` for right-click and a hand-rolled long-press timer for
  touch — cancelled on pan/zoom/move/second-touch, and never `preventDefault`
  before it fires, so a normal pan is untouched) and `CenterPin` (a draggable DOM
  `<Marker>`, wrapper demoted via `neutralizeMarkerWrapper`, `onDragEnd` →
  re-center).
- `MapExplorer.tsx`: a new `applyCenter(lat,lng)` helper sets lat/lng (toFixed 5)
  and dispatches the active view's existing find handler (auto-run). The dropper +
  pin render only in the three center-using views; the center pin replaces the
  detected-location dot while shown (`!centerPinShown` guard) so the two never
  overlap. A discoverability hint sits under the lat/lng inputs.
- The gestures are `contextmenu` / long-press — distinct from the left-click/tap
  that opens pin popups — so there's no collision with the existing
  hotspot/sighting/atlas selection. The center pin is a DOM marker (one draggable
  instance), leaving maplibre's GL layers untouched.

### How to test
- `cd frontend && npm run dev`, open http://localhost:5173 → Map Explorer →
  Hotspots (or Nearby Lifers / Media Targets). Right-click the map: a center pin
  drops and the search re-runs for that spot. Drag the pin to move it; the search
  re-runs on release. Left-clicking a result pin still opens its popup (unchanged).
- `npm run test` (977 pass, incl. `CenterPinDropper.test.tsx`), `npm run build`
  (no chunk-size warning; the change lives in the lazy MapExplorer chunk, entry
  unchanged at 218 KB).

### Notes for reviewer
- Session-only by design (the saved Default Location is set in Settings).
- Long-press is touch-only and hard to verify on a desktop; the timer/cancel logic
  is unit-tested. The mobile OS long-press callout is a possible future refinement.
- Improve-lane, re-scoped from the New-Feature boundary: a new interaction, but it
  reuses the Predict pin pattern and the existing shared center model — no new
  data, schema, or design-system work.
