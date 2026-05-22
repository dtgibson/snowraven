# Design Spec — Map Explorer Enhancements

## Visual Direction
Clean, purposeful additions that stay fully within the SnowRaven brand palette. Recency is expressed through a green intensity scale — vivid brand green for the freshest sightings, fading to a soft sage for older ones — so urgency is conveyed without introducing an alien color. All new controls match the sidebar's existing compact style.

## Screens / Views

### Media Targets Mode (primary view)
- **Address search:** text input + "Search" button stacked above the lat/lng coordinate row; "Search by place name" label; geocode success populates the lat/lng fields, clears the address input, and flashes the lat/lng borders green for ~900ms; inline error appears below on failure ("No location found. Try a different search term." / "Location search failed. Try again or enter coordinates manually.")
- **Last 30 Days / Last Week toggle:** compact two-button segmented control beneath the radius slider; "Last 30 Days" is the default active state; "Last Week" hides all pins with `recentDate` older than 7 days client-side — multiple same-species pins at different locations are all visible if each qualifies
- **Nearest-10 list:** scrollable ranked list below the controls, separated by a muted section header; each row: tier dot (8px circle) + species name (12px 500 weight, truncated) + location name (10px muted, truncated) + right-aligned distance (11px, "X.X mi"); clicking a row opens that pin's popup and highlights the row with a green tint
- **Recency tier pins:** pill-shaped DivIcon labels on the map; three green shades; each pill has a small white circle on the left edge; clicking a pin opens its popup
- **Popup:** white card with shadow; species name (13px bold), location with 📍 prefix (11px muted), date + days-ago (11px muted), recency tier badge (small pill), "View checklist {subId}" link (brand green, external-link icon) separated by a hairline rule at the top; × close button top-right

### Hotspots Mode (legend toggle interaction)
- **Address search:** same component and placement as Media Targets — directly above the lat/lng fields
- **Clickable legend rows:** each row renders a visibility icon (eye/eye-slash SVG) on the right at 40% opacity; hidden categories drop to 38% opacity on both the row and its pins; a short italic hint below the legend reads "Click a legend row to hide or show that pin category."; all categories restore to visible on a new fetch

## Component Usage
- Segmented toggle: two-button `seg-wrap` / `seg-btn` pattern (matches existing segmented controls)
- Address search: `text-input` + `search-btn` inline row
- Tier dot: 8px circle in nearest-10 rows; matching pill swatch in the legend
- Popup: absolutely-positioned `div` with `::after` downward triangle, `border-radius: 8px`, `box-shadow`

## Design Tokens Applied

| Token | Value | Used for |
|---|---|---|
| `--sr-map-target-fresh` | #2D8653 | Pins and tier dots ≤7 days (white text) |
| `--sr-map-target-mid`   | #5EA07C | Pins and tier dots ≤15 days (white text) |
| `--sr-map-target-old`   | #A8D4BB | Pins and tier dots ≤30 days (dark text #1A5C38) |
| `--sr-map-visited`      | #2D8653 | Hotspot visited pin (unchanged) |
| `--sr-map-unvisited`    | #3B82F6 | Hotspot unvisited pin (unchanged) |
| `--sr-map-personal`     | #F97316 | Personal location pin (unchanged) |
| `--primary`             | #2D8653 | Search button, Refresh button, checklist link |

## Interaction Notes
- **Address geocode:** on success, populate lat/lng fields and clear address input; flash lat/lng borders green for ~900ms; trigger the same data fetch as Refresh
- **Geocode failure (no results):** show inline error below the input; do not clear lat/lng fields
- **Geocode failure (network):** show inline network error; do not clear lat/lng fields
- **Legend toggle (Hotspots):** click toggles opacity and pin visibility; state resets to all-visible on each new Hotspots fetch
- **Last Week toggle:** pure client-side filter on `recentDate`; no network call; any open popup for a now-hidden pin closes
- **Nearest-10 click:** `map.panTo()` to that pin's coordinates; open the pin's popup; highlight the clicked row

## Content Notes
- Species names and location names use eBird strings directly; truncate with CSS ellipsis at the list item boundary
- Distance: one decimal place, " mi" suffix (e.g. "3.7 mi")
- Checklist link label: "View checklist {subId}" — subId visible so it can be copied
- Days-ago in popup is informational (e.g. "May 21, 2026 · 2 days ago") — derived client-side from `recentDate`
