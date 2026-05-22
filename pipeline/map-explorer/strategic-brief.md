# Strategic Brief — Map Explorer

## What We're Building
A new Map Explorer tab that surfaces the geographic dimension of the user's eBird data in three distinct views: a personal sightings map with species/media/breeding code/time filters and a heatmap toggle; an eBird hotspot overlay showing visited vs. unvisited hotspots (plus personal locations) in the area; and a media targets map that shows where unrecorded species have been reported recently within a given radius.

## Why Now
SnowRaven already parses full location data from the eBird backup — latitude, longitude, location name, and location ID are all in `ObservationEntry`, and Leaflet is already in the dependency tree. The coordinate data exists; it's just not exposed in any browsable, geographic form. Adding a map explorer at this point costs almost nothing in infrastructure while opening up a qualitatively different way to engage with personal data: not just "what have I seen" but "where, and what's near me that I haven't covered yet."

## The User Problem
A birder with hundreds or thousands of logged observations has no way to see their records geographically within SnowRaven — they can filter by species or county on each tab, but there's no bird's-eye view of where their data comes from or what's nearby. Worse, there's no quick way to find out: which hotspots near home have they never visited? And when planning a media session, there's no way to cross-reference "species I still need on camera" with "where that species has been reported recently near me."

## Success Criteria
- The user can open Map Explorer and see all their personal sightings as pins or a heatmap, with no setup beyond having an eBird backup stored in Settings
- Filtering by species, media type, breeding code, or date range visibly reduces the pins on the map in real time
- Hotspot view shows nearby eBird hotspots with clear visited/unvisited distinction (accessible by more than color alone) plus a separate treatment for personal locations
- The media targets view accepts a center point and radius, then shows where unrecorded target species have been recently reported, each pin labeled with the species name

## Scope
- Three view modes switchable within the tab: Personal Sightings, Hotspot Overview, Media Targets
- Personal Sightings: all observations from stored eBird backup on a Leaflet map; filter controls for species, date range, county, media presence (requires ML export), breeding code tier; pins and heatmap toggle (reusing `HeatmapLayer` from Species Detail)
- Hotspot Overview: fetches nearby hotspots via eBird API (`/v2/ref/hotspot/geo`) using a center point and radius; color-coded pins with an accessible secondary signal (icon shape or label) for visited vs. unvisited; personal locations from the eBird backup shown as a third category
- Media Targets: user sets a center point and radius; target species list derived from ML export (species with zero total media, or species entirely absent from ML export but present in eBird backup); recent observations fetched from eBird API (`/v2/data/obs/geo/recent`) filtered to target species; pins labeled with species name
- Center point input shared across Hotspot and Media Targets views (lat/lng or free-text location search via browser geolocation or manual entry)
- All API calls for hotspot and recent obs data go through the backend (proxied through FastAPI) to keep the eBird API key server-side

## Out of Scope
- Real-time or live eBird observation feeds
- Route planning or directions
- Saving or exporting map views
- Weather overlays on the map
- Any map view for data not derived from the stored eBird backup or eBird API

## Key Decisions
- Three named view modes (Personal Sightings / Hotspot Overview / Media Targets) rather than a single map with too many layers — each mode has a clear job and its own controls
- Hotspot and Media Targets modes require an eBird API key; if not configured, show the amber key notice pattern already established in the Weather tab
- Heatmap from Species Detail (`HeatmapLayer` component) is reused directly — no separate implementation
- Personal locations from the eBird backup (location IDs starting with `L` that appear in the user's data but are not eBird hotspots) treated as a third pin category in Hotspot view — no API call needed, derived from the stored backup
- Media target species list: species present in the eBird backup but with zero total media items in the ML export; if no ML export is stored, the user can still use the view but must manually select target species
- eBird API calls routed through new FastAPI endpoints to keep the API key server-side and avoid browser CORS issues
