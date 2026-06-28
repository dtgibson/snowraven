# Seeing the Map Explorer shading polish locally

These three changes are all on the **Map Explorer** tab. You need your eBird backup
loaded (Settings) to see the shading, since it's drawn from your own data.

1. Start the app (I can do this for you and hand you a link). Manually:
   `cd frontend && npm run dev`, then open `http://localhost:5173`.

2. Go to **Map Explorer**.

### imp-1 — the "in view" list is at the bottom
3. In the **My Sightings** view, scroll the left panel. The **"Sightings in view"**
   list is now the *last* section, below the Map Overlays controls. Check the
   **Hotspots** view too — "Hotspots in view" now sits below "Nearest Unvisited
   Hotspots." (Targets and Lifers already had their in-view list last.)

### imp-2 — only one shading at a time
4. Turn on **County lines**, then **Shade by species seen** (green).
5. Turn on **California atlas blocks**, then **Shade by My Highest Breeding Code**
   (purple). The green county shading switches **off** automatically — and vice-versa.
   Hover either shade toggle for the tooltip; the caption notes the switch when the
   other shading is on. The boundary *lines* can still both show.

### imp-3 — the basemap mutes while shading is on
6. With either shading on, the basemap's **green land goes grey** so the ramp pops.
   Water stays blue, roads/labels stay as-is. Turn the shading off — the land
   colors come back.
7. Switch the base to **Satellite** or **Topo** with shading on: the imagery
   desaturates too. The **Trails** overlay stays colored (it's your overlay).
8. In **Heatmap** mode with county shading on, the heatmap dims and sits under the
   county ramp so the tiers stay readable — same as it already did for the atlas ramp.
