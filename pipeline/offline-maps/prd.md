# PRD — Offline maps (v1)

Lane: New feature · Stage 2 (Planner). Strategist brief approved (go).

## Goal
Let users optionally download map data for chosen regions so SnowRaven's maps
render without a connection — completing the "review my birding and see my
sightings on a real map, fully offline" experience for field use, and laying the
foundation the future mobile apps will reuse.

## Who / when
A birder in the field or a remote area with no/poor signal opens Map Explorer
(My Sightings) or a Species Detail map and sees their pins, heatmap, and atlas
overlay on an actual basemap — not a blank/"map unavailable" panel.

## v1 scope
- **Vector base map only** offline (the clean street base). Satellite / Topo /
  Trails stay online-only.
- **Desktop-first** (macOS + Windows, Tauri). Web/Pi deferred but the build stays
  behind the existing storage seam so it can follow.
- **Region download + management:**
  - Pick a region to download.
  - See an **estimated size before** downloading; warn on large (>~500 MB) ones.
  - Download with progress + cancel. User-initiated only (no background downloads).
  - List downloaded regions with sizes; delete; show total storage used.
- **Offline use:** when offline (or the online base can't be fetched), maps use a
  downloaded region that covers the view; online behaviour is unchanged
  (OpenFreeMap). A subtle indicator when offline tiles are in use.
- **Graceful gap:** if no downloaded region covers the current view while offline,
  show the existing "map couldn't load" state — never a broken map.

## Region selection (recommended — confirm at gate)
- **"Download current view"** — the area currently shown plus a small buffer.
  Simple and contextual (you're already looking at your area).
- **Pick a region** — a US state/province from a list, or a drawn bounding box.
- A **detail level** (Overview / Standard / Detailed) maps to a max zoom and
  drives the size; the estimate updates live as you change region/detail.

## Functional requirements
- Size estimate shown before download; clear warning past a threshold.
- Stored via the `storage` seam (AppLocalData on desktop).
- Manager UI (new "Offline maps" area in Settings): list, size, delete, total used.
- Offline detection auto-selects a covering region for the active map view.
- No regression to current online map behaviour on any of the three maps.

## Non-goals (v1)
- Offline satellite / topo / trails (impractical size — many GB per region).
- Offline weather, hotspots, media targets, place search, embedded ML media
  (live external services — out of scope; already degrade gracefully).
- Automatic/background download or refresh; tile freshness/versioning (v1 =
  manual re-download if tiles age).
- Web / Pi storage (deferred; seam keeps it open).

## Platform / future (mobile)
Built on the existing seams + one React frontend, so when the mobile apps arrive:
if **Tauri mobile**, ~90% of this (UI, MapLibre+PMTiles rendering, offline logic)
reuses as-is — only the storage backing differs, already abstracted; if **native**,
the PMTiles approach and the downloaded files port to maplibre-native. Offline is
the strongest use case on phones, so desktop-first v1 is foundation, not throwaway.

## Privacy
Downloading a region fetches a large extract from a tile provider (app → provider),
exposing the requester's IP and the region requested. New disclosure for
`PRIVACY_POLICY.md` (Map Tiles / Offline). User-initiated; no tracking added.

## Open decisions → Architect (stage 3)
- **Tile source + schema (main fork):** off-the-shelf **Protomaps** PMTiles
  (zero hosting, client-side range-extract, slightly different look → a second
  style) **vs** **OpenMapTiles-schema** extracts (matches the current tuned look,
  but needs a generate/host pipeline). Lean Protomaps for v1 zero-ops unless the
  look divergence is unacceptable.
- PMTiles read mechanism in the webview (OPFS vs Tauri-fs-backed source), incl.
  iOS feasibility for the mobile future.
- Size-estimate method (precomputed table vs area×zoom heuristic).

## Success criteria
- With a downloaded region and the network off, Map Explorer (My Sightings) and
  the Species Detail map render a usable basemap under your pins/heatmap/atlas.
- Download, delete, and size reporting work on macOS and Windows.
- Zero regression to online map behaviour.
