## Heatmap coverage + intensity slider

### What this does
Makes the My Sightings heatmap read as a density surface (not isolated dots) and adds a slider to tune its spread live.

### Changes (all in `MapExplorer.tsx`)
- **Bigger, intensity-driven footprint:** `HeatmapLayer` now derives radius/blur from an intensity (1–10): `radius = 15 + intensity*5`, `blur = round(radius*0.6)`. Default intensity 5 → radius 40 / blur 24 (vs. the old fixed radius 25 / blur 15), so neighboring sightings merge into a gradient out of the box. `maxZoom: 17` unchanged.
- **Intensity slider:** a range input under the Map View toggle, shown only in heatmap mode. Scales the spread live (Tighter ↔ Broader), with the current value shown. Lets the user compensate for how the pixel-radius reads at different zoom levels. Keyboard-operable native range input, `aria-label`, accent-themed via `accentColor`.
- Threaded `heatIntensity` state → `SightingMarkers` → `HeatmapLayer` (re-renders the layer on change).

### How to test
- `cd frontend && npm run dev` → Map Explorer → My Sightings → run a search → switch Map View to **Heatmap**. Confirm coverage is broader and clustered sightings blend. Drag the **Heatmap Intensity** slider — the spread updates live. Switch to **Pins** — slider hidden, pins unchanged.

### Notes for reviewer
- Pins mode and all other map modes untouched. No new dependency (`leaflet.heat` already present). The heat-param helpers are trivial pure functions kept local to the component.

### Refinements after review
- **Slider now drives three things** for a stronger broad/intense end: footprint (radius `13.9 + 3.83·i + 0.278·i²` → 1:18, 5:40, 10:80 px; blur 0.5× radius), saturation (`max` eased 1.0→0.75), and **per-point weight** (obs-count divisor 20→2, so at high intensity even a lone sighting burns hot — fixes sparse areas reading pale).
- **Artifact guardrails:** an early attempt (radius 95, blur 0.6×, max 0.5) produced triangular banding from over-amplified far-spread tails. Resolved by bounding radius ~80, blur 0.5×, and flooring `max` at 0.75 — intensity now comes from per-point weight, not from crushing `max`.

## Convention Flags
- None new. (Noted for future: `leaflet.heat` bands faint far-spread tails into triangular artifacts when radius is very large AND `max` is very low — drive intensity via point weights instead.)
