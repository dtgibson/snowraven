# Design Spec — Map Explorer
**Feature:** map-explorer
**Session:** 001
**Date:** 2026-05-22
**Stage:** 4 — The Designer
**Source:** prd.md + brand.md (approved)

---

## Visual Direction

Map Explorer follows the established SnowRaven brand: quiet utility, Irish clover green (#2D8653) as the primary accent, Inter/system-ui at clean weights, and restrained color use. The map is the hero — controls live in a fixed 268px left sidebar so the map always occupies the dominant viewport space. New pin-color tokens (map-visited, map-unvisited, map-personal, map-target) extend the existing palette without disrupting it.

---

## Screens / Views

### Mode Bar

A full-width bar beneath the tab row holds three pill-style mode buttons: My Sightings, Hotspots, and Media Targets. Only one is active at a time. Active state: green accent background, green text, green border (`--sr-accent-bg`, `--sr-accent`, `--sr-accent-border`), font-weight 600. Each button carries a 14×14 Lucide icon to the left of the label (Map Pin, Binoculars, Camera). Inactive buttons use `--sr-surface-subtle` background and `--sr-text-muted` text.

### Map Area

Leaflet map fills all horizontal space to the right of the sidebar. The map instance is created once; mode switches add and remove layer groups without destroying the map. OpenStreetMap tiles. Leaflet attribution retained. `zoomControl` rendered at default position.

### My Sightings Mode

**Sidebar:**
- Collapsible filter panel with a chevron toggle. When collapsed, `max-height: 0` hides filter fields via CSS transition.
- Filter fields (in order): Species (single-select `<select>`), Date Range (two `<input type="text">` side by side), County (single-select), Breeding Code (4-segment control: All / Possible / Probable / Confirmed), Media (single-select).
- Map View section: 2-segment control — Pins / Heatmap.
- Stats bar pinned to the sidebar bottom: Locations / Species / Obs. — three equal columns with `--sr-accent` numerals and uppercase muted labels.

**Map:**
- One circle pin per unique location. Pin radius scales with observation count: ≥200 obs → 22px, ≥100 → 18px, ≥50 → 15px, <50 → 12px. Opacity scales similarly (0.95 → 0.78).
- All pins use `--sr-map-visited` (#2D8653) fill with 2px white border and drop shadow.
- On click: Leaflet popup showing location name (bold), observation count (green), last visit date, and a "Species seen here" list (up to 5 species; "+N more" if exceeded).
- On mode entry: `map.fitBounds()` auto-fits all loaded markers.

### Hotspot Overview Mode

**Sidebar:**
- "Use my location" outline button at top (never triggers geolocation on render — only on click).
- Latitude and Longitude number inputs below the button, always visible.
- Radius segmented control: 5 mi / 10 mi / 25 mi (default active) / 50 mi.
- "Find Hotspots" primary green button. On click: button disables, shows spinner + "Finding…" label, simulates 1.3s network call, then loads pins.
- Legend section appears below the button only after hotspots have been loaded. Each legend row: 22×28px SVG pin + name (bold) + count (muted).

**Map — three pin types (color + SVG icon shape):**
- **Visited** — teardrop SVG, `--sr-map-visited` (#2D8653) fill, white checkmark (✓) polyline glyph. Popup: name, species count (green), last visit date, "View on eBird →" link.
- **Unvisited** — teardrop SVG, `--sr-map-unvisited` (#5B7FA6) fill, two white circles side-by-side (binoculars). Popup: name, "View on eBird →" link.
- **Personal** — teardrop SVG, `--sr-map-personal` (#C9842A) fill, white star polygon. Popup: name, amber "Personal Location" badge, observation count, last visit date.
- On "Find Hotspots" resolve: `map.fitBounds()` across all three pin categories.

### Media Targets Mode

**Sidebar:**
- Identical "Use my location" + lat/lng inputs as Hotspot mode (center point persists across mode switches).
- Radius segmented control: same options, same default (25 mi).
- Target Species chip: rounded card with a purple dot, bold "47 target species" text, muted sub-label "from ML export · no media recorded".
- "Find Recent Sightings" primary button. On click: disables, spinner + "Finding…", 1.5s simulated load, then loads target pins.

**Map:**
- Each (species, location) pair rendered as an inline purple label pill: `--sr-map-target` (#7C3AED) background, white text, 10px border-radius, `font-size: 11px`, `font-weight: 600`.
- On click: popup showing species name (purple), location name, most recent date, checklist count (purple).
- On resolve: `map.fitBounds()` across all target pins.

---

## Component Usage

| Component | Usage |
|-----------|-------|
| `<select>` (styled) | Species, County, Media filters — custom chevron via `background-image` SVG |
| `<input type="number">` | Lat/Lng center point inputs |
| `<input type="text">` | Date range from/to |
| Segmented control (custom) | Breeding code tier, Pins/Heatmap, radius selector |
| Outline button | "Use my location" — never auto-invokes geolocation |
| Primary button | Find Hotspots, Find Recent Sightings — disables during fetch |
| Leaflet `L.divIcon` | All custom pins (teardrop SVG + glyph) and target label pills |
| Leaflet `L.layerGroup` | One group per mode; added/removed on switch |
| `SetupRequired` | Rendered in My Sightings when no eBird backup stored |

---

## Design Tokens Applied

| Token | Value | Where used |
|-------|-------|------------|
| `--sr-accent` | #2D8653 | Active mode button, primary buttons, sighting pins, visited pin fill, stat values |
| `--sr-accent-bg` | #E8F5EE | Active mode button background, input focus ring |
| `--sr-accent-border` | rgba(45,134,83,0.22) | Active mode button border |
| `--sr-map-visited` | #2D8653 | Visited hotspot pin fill, legend |
| `--sr-map-unvisited` | #5B7FA6 | Unvisited hotspot pin fill, legend |
| `--sr-map-personal` | #C9842A | Personal location pin fill, legend |
| `--sr-map-target` | #7C3AED | Media target label pills, target popup species name |
| `--sr-surface-subtle` | #F4F4F5 | Segmented control track, inactive mode buttons, target chip background |
| `--sr-text-muted` | #71717A | Labels, secondary text, section titles |
| `--sr-border` | #E4E4E7 | Sidebar border-right, input borders, popup wrapper border |
| `--sr-card-shadow` | 0 1px 4px … | Popup wrapper |

---

## Interaction Notes

- **Filter collapse**: CSS `max-height` transition on `.filter-body` div. Toggle driven by clicking the section header (chevron rotates -90° when collapsed).
- **Segmented control activation**: clicking a `.segbtn` removes `.active` from siblings within the same `.seg` container, adds to clicked button.
- **Map instance reuse**: `L.layerGroup` objects are created once. `switchMode()` calls `layer.addTo(map)` or `map.removeLayer(layer)` — the `MapContainer` is never unmounted.
- **Geolocation consent**: "Use my location" button only populates lat/lng inputs. In production, it calls `navigator.geolocation.getCurrentPosition()` inside the `onClick` handler — never on mount or mode switch.
- **Fetch simulation**: primary buttons disable themselves, show spinner + text label during the simulated delay, then restore.
- **Auto-fit bounds**: every mode that loads pins calls `map.fitBounds(coords, { padding: [50, 50] })` after load. Mode switch back to My Sightings also re-fits.
- **Legend visibility**: hotspot legend section is `display:none` on initial render; set to `display:block` after first successful "Find Hotspots" call.

---

## Content Notes

- Stats (847 locations, 312 species, 4.2k obs) are realistic for a well-traveled Pacific NW birder — not placeholder data.
- Target chip copy: "47 target species · from ML export · no media recorded" — specific, not generic.
- "Use my location" button label is explicit about what it will do (not "Detect location" or just an icon).
- eBird popup links open in `_blank` with the standard `ebird.org/hotspot/{locId}` URL pattern.
- Error state (geolocation denied): inline text below button — "Location unavailable — enter coordinates manually." Manual inputs remain visible and usable regardless.
