# Architecture — Offline maps (v1)

Lane: New feature · Stage 3 (Architect). PRD approved.

## 1. Tile source + schema (the main fork) — resolved
- OpenFreeMap (our online base) uses the **unmodified OpenMapTiles (OMT) schema**;
  the tuned positron style targets OMT source-layers.
- There is **no free, off-the-shelf, per-region OMT PMTiles** to download. Keeping
  the exact look offline would require generating OMT PMTiles per region with
  **Planetiler** + **hosting** the downloads — a tile pipeline + server + bandwidth,
  which breaks the local-first / no-backend model.
- **Protomaps** publishes a free **planet PMTiles**, BUT their docs **discourage
  hotlinking** the build downloads ("copy the tileset to your own Cloud Storage"),
  and the build URLs rotate daily. So "users range-extract directly from the public
  planet, zero hosting" is NOT a sanctioned path.
- **HOSTING REALITY (important):** offline maps need *someone* to serve the tile
  bytes. Whether Protomaps or OMT, the practical options are: (a) **we host** a
  planet PMTiles copy (≈100 GB storage, e.g. Cloudflare R2; egress per region
  download) and users range-extract from *our* copy; (b) **we pre-generate + host
  regional extracts** (states); or (c) **user brings their own** tile source
  (advanced). There is no truly free/zero-ops path — offline maps carry a modest
  but real **infrastructure cost** that the otherwise-serverless app does not.
- **Decision:** v1 uses **Protomaps PMTiles** for the offline base (zero hosting,
  client-side extract). The offline base renders with a **Protomaps "light" style
  tuned toward our positron look** (greens/borders/land tints). The online base
  stays **OpenFreeMap** unchanged. → Two base styles (online OMT, offline Protomaps),
  accepted as the cost of zero-ops + preserving the tuned online look.
  - **Product decision for Dave:** keep online = OpenFreeMap (offline looks *close*,
    not identical) — recommended — **vs** unify the whole app on Protomaps (one style,
    identical online/offline, but re-tunes the online base Dave already dialed in).

## 2. Storage + read mechanism
- **Read: OPFS (Origin Private File System)** — the maintained `maplibre-offline-pmtiles`
  plugin downloads/stores/reads PMTiles in OPFS with near-native range-read perf in
  the webview (in-process, no JS↔Rust IPC per read). Cross-platform (web + Tauri +
  modern mobile webviews).
- **Risk to validate (spike):** OPFS **persistence + performance inside Tauri's
  WKWebView (macOS) / WebView2 (Windows)**. (Note the prior lesson: `localStorage`
  is ephemeral in Tauri WKWebView — OPFS is disk-backed and origin-scoped, so it
  *should* persist, but this MUST be proven first given that history.)
- **Fallback if OPFS is unreliable in Tauri:** store via the existing
  `tauri-plugin-fs` AppLocalData and supply pmtiles.js a **custom Source** whose
  `getBytes(offset,length)` range-reads through the Tauri fs API. Consistent with the
  app's established storage, guaranteed-persistent on desktop, but slower (IPC per
  read) — so OPFS is preferred if it holds up.
- All access goes through (or alongside) the existing **`storage` seam**; the manager
  records each region's metadata (name, bbox, maxzoom, bytes, createdAt).

## 3. Region acquisition
- User picks a region (current view + buffer / state / drawn bbox) and a detail level
  (Overview/Standard/Detailed → maxzoom ~10/13/14).
- The app **range-extracts** that bbox+maxzoom from the **Protomaps planet PMTiles**
  into a local OPFS PMTiles file (the pmtiles "extract" pattern over HTTP range).
- **Validate (spike):** latency/throughput of range-extracting from Protomaps' planet
  CDN for a state-sized bbox (range requests on ~100 GB files can be slow on some
  CDNs; Protomaps' is built for it).

## 4. Size estimate
- Read the **PMTiles directory** for the chosen bbox+maxzoom to sum the covered tile
  bytes → an **accurate** pre-download size (not just a heuristic). Show it live as
  region/detail change; warn past ~500 MB.

## 5. Map integration (SnowMap)
- Register once: `maplibregl.addProtocol('pmtiles', …)`.
- **Online:** unchanged — OpenFreeMap positron + visibility-toggled raster layers
  (current single-persistent-style design).
- **Offline (or base fetch fails) with a covering region:** load the **offline
  Protomaps style** pointing at `pmtiles://<local region>`. The atlas / heatmap /
  marker layers are our own GeoJSON/declarative children → re-attach on style load
  regardless of base.
- The online↔offline base change is a **controlled `setStyle`** (rare; on a network
  transition), saving + restoring the camera (center/zoom/bearing) so pan/zoom is
  preserved — distinct from the disallowed mid-session base-swap.
- **Offline detection:** navigator.onLine + the existing style-fetch-failure path
  (the 0.5.10 "map couldn't load" state) trigger the offline base when a region
  covers the view; if none covers it, keep the graceful "map unavailable" state.
- Subtle "Offline map" indicator when offline tiles are in use.

## 6. UI surface
- **Settings → Offline maps:** download a region (picker + detail + live size),
  list of downloaded regions (name/size/delete), total used. New section.
- Small affordance on the Map Explorer to "download this view" (contextual).

## 7. Privacy
- A region download fetches a large extract from **Protomaps** (app → provider),
  exposing IP + the requested region. New `PRIVACY_POLICY.md` disclosure (Map Tiles /
  Offline), and add Protomaps to the provider list. User-initiated; no tracking.

## 8. Risks / required spike (first Engineer step)
1. OPFS persistence + range-read perf in Tauri WKWebView/WebView2 (else fs fallback).
2. Client-side range-extract from Protomaps planet for a state-sized bbox (latency).
3. Offline Protomaps style render + the controlled online↔offline `setStyle`
   (camera preserved; atlas/heat/markers re-attach).
Build the spike for ONE hardcoded region before the full UI.

## 9. Mobile portability
- All of the above is React + MapLibre-JS + (OPFS or the storage seam) → reuses on
  **Tauri mobile** nearly wholesale; OPFS is supported on iOS 16.4+/Android WebView
  (validate iOS). If a **native** app is chosen later, maplibre-native reads the same
  PMTiles files — the approach and downloaded data port.

## Open decisions → Designer / Engineer
- (Dave) online base: keep OpenFreeMap (recommended) vs unify on Protomaps.
- Detail-level → maxzoom mapping + size-warning threshold (defaults above).
- Exact region-picker interaction (handled by the Designer).
