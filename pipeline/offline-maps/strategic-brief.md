# Strategic brief — Offline maps (feasibility exploration)

Status: Strategist / exploration. Decision pending (proceed to PRD or shelve).

## The ask
Let users optionally download map data so the maps work without a connection.
Explore: how it works, storage cost, and how usable the app is fully offline.

## How it would work
- **Format: PMTiles.** A single-file vector-tile archive read directly by MapLibre
  via `addProtocol('pmtiles', …)` (pmtiles.js) using byte-range reads — no tile
  server. This fits SnowRaven's local-first, no-backend model exactly.
- **Pick a region → get a file.** The user chooses their birding area(s) (a
  drawn box, a state, or "current view"). Two ways to produce the file:
  1. **Range-extract** the chosen bbox straight from a public planet PMTiles over
     HTTP (`pmtiles extract` semantics) into a local file — nothing for us to host.
  2. **Pre-hosted extracts** we generate and the app downloads — more control,
     but we host/maintain them.
- **Store locally.** Desktop: `tauri-plugin-fs` AppLocalData (disk-backed, fine
  for hundreds of MB). Web: OPFS. A manager lists/sizes/deletes regions.
- **Use it.** When a region file covers the view (or we're offline), MapLibre
  reads the local PMTiles; online, it keeps using OpenFreeMap. Glyphs + sprites
  (a few MB) are bundled so labels render offline too.
- **Schema caveat (key design fork).** Our tuned base uses OpenFreeMap =
  **OpenMapTiles schema**. Off-the-shelf planet PMTiles (Protomaps) uses a
  **different schema**, so the existing tuned style wouldn't apply directly. Either
  (a) use an OpenMapTiles-schema extract to keep the exact look (we generate via
  Planetiler / find an OMT source), or (b) adopt Protomaps' style for the offline
  base (off-the-shelf, but a slightly different look + a second style to maintain).
- **Desktop-first.** Filesystem + local-first make this natural on the desktop
  app; web/Pi can follow with OPFS / server storage.

## Storage
Vector tiles are small; size scales with area × zoom (**each extra zoom level
~doubles the file**). Reference points: planet z0–15 ≈ 120 GB; US + Mexico
z0–15 ≈ 17 GB; a city at full zoom ≈ 68 MB; the whole world z0–6 ≈ 0.8 MB.

Birding only needs ~street level (z13–14), not building level (z16), so capping
max zoom keeps files modest:
- **County / metro:** ~tens of MB.
- **A US state:** ~100 MB – ~1 GB (size of state × detail; lower the zoom cap to shrink).
- **Whole CONUS:** multiple GB (power-user territory).

We'd show the estimated size before download and let the user cap detail.
**Raster offline (satellite / topo) is impractical** (a single state runs to many
GB at high zoom), so offline = the **vector base only**; satellite/topo/trails
stay online.

## How usable is the app fully offline?
SnowRaven is already local-first for *your* data — the only thing missing offline
on the maps is the **basemap image** itself. With offline maps:

**Works fully offline** (all from your uploaded eBird/ML files):
- Life List, Breeding Codes, Statistics, Species Detail (history, charts, breeding,
  co-occurrence), Life List Comparer, Settings.
- **Map Explorer → My Sightings** and the **Species Detail map** — your pins,
  heatmap, and the atlas overlay already render from local data; the offline base
  gives them a real map to sit on.

**Still needs a connection** (live external services, by nature):
- **Weather** (OpenWeather), **Map Explorer → Hotspots & Media Targets** (eBird
  API), **place/address search** (Nominatim), **embedded Macaulay media** on
  Species Detail, **Satellite / Topo / Trails** layers, external "↗" links
  (eBird / Birds of the World / ML pages), and the in-app update check.
  These already degrade gracefully (e.g. the new "map couldn't load — Retry").

Net: the **core "review my birding, and see my sightings on a real map"
experience becomes fully offline** — genuinely useful in the field/remote areas.
The "discovery" features (what's nearby, weather, others' media) inherently need
the network.

## Options / recommendation
- **A. Passive tile cache** — cache tiles as you browse; previously-viewed areas
  work offline. Zero setup, but partial/unpredictable coverage. (Small.)
- **B. Region download (PMTiles)** — deliberate "download this area," complete
  offline coverage of chosen regions. (The real feature; medium build.)
- **C. Both** — B with a passive cache fallback.

Recommendation: **B**, desktop-first, using the range-extract approach (no hosting),
with the schema fork resolved up front (lean toward an OpenMapTiles-schema extract
to preserve the current look). Scope a v1 to: pick a region (box/state) → size
estimate → download → manage/delete → auto-use offline, vector base only.

## Open questions for the PRD
1. Region selection UX: draw a box, pick from a list (states), or "download
   current view + N miles"?
2. Schema fork: regenerate OMT-schema extracts (keep exact look) vs adopt
   Protomaps base (off-the-shelf)?
3. Desktop-only v1, or include web (OPFS) / Pi (server) from the start?
4. Hosting: pure client-side range-extract vs we host curated extracts?
