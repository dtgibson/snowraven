# Schema Design — Offline Support (Incremental Data Layer)
**Feature:** offline-support
**Stage:** 3 — The Architect
**Date:** 2026-06-20
**Source:** prd.md (approved) + strategic-brief.md; folds three design slices and all adversarial feasibility verdicts.

---

## Architecture Classification

**Full-stack, dual-runtime, no database.** SnowRaven has no DB — all durable state is files (Tauri `AppLocalData/data/`) or a key/value JSON store served by FastAPI under the repo-root `data/` dir. This feature adds **new files, new keys, one new backend route family, two new bundled assets, and one new build tool** — all **additive**. No existing file/key/route changes shape. `settings.json` is untouched (the large blobs get their own files — FR-42).

Everything routes through the two permanent seams: **storage** (`frontend/src/lib/storage.ts`) and **transport** (`frontend/src/lib/transport.ts`). New backend-served capability gets a TS-service-or-storage twin + a FastAPI route + the `/prefix` in `frontend/vite.config.ts` (NFR-05). `/settings` is **already** proxied (`vite.config.ts:30`) — no proxy change.

---

## Stores Overview Table

| Store | Runtime | Location / Route | Format | Key / id | Lifecycle |
|---|---|---|---|---|---|
| **Persisted style** | Desktop | `AppLocalData/data/map-style/<variant>.json` (own file) | JSON `{variant, style, savedAt}` | dedicated seam method `getStyleBlob/setStyleBlob(variant)` | Written on first successful online style fetch; seeded before any fetch on map mount; background revalidate once/session; unbounded (no TTL). |
| | Web/Pi | `GET/POST/DELETE /settings/map-style-<variant>` → `data/settings/map-style-<variant>.json` (own file) | same | same | same; requires backend reachable (FR-39a). |
| **Replay store** | Desktop | `AppLocalData/data/replay.json` (own file) | JSON `{version, entries{}, order[]}` | dedicated seam method `getReplayStore/setReplayStore` | Append on each successful weather/tide/checklist GET; oldest-loaded-first eviction; **never** written on failure; bounded 300 entries / 3 MB. |
| | Web/Pi | `GET/POST/DELETE /settings/replay-store-v1` → `data/settings/replay-store-v1.json` | same | same | same. |
| **Region files** | Desktop only (FR-20) | `AppLocalData/data/regions/<regionId>.pmtiles` (binary, path-based) | PMTiles v3 archive | `<regionId>` shape-validated `^[a-z]{2}(-[a-z0-9-]{1,40})?$` | User-initiated download (temp `.partial` → atomic rename); read by `srpm://` loader via `open`+`seek`+`read`; removed on user delete; partials swept on manager open. |
| **Regions manifest** | Desktop only | `AppLocalData/data/regions-manifest.json` (own file) | JSON `{version, regions[]}` | dedicated seam method | One entry per completed region; rewritten on download-complete / remove; coalesced one read/session. Empty on web/Pi. |
| **Bundled taxonomy snapshot** | Both (asset) | FE: `frontend/src/assets/ebird-taxonomy.json` · BE: `backend/staticdata/ebird_taxonomy.json` | JSON 5-map bundle `{version, generated, bySci, byCom, byOrder, byCode, reportAs}` | — (versioned by `version` field) | Shipped read-only; loaded **on demand** (dynamic import FE / disk read BE); the offline floor under the live caches. |
| **Backend taxonomy disk twin** | Web/Pi only | `data/taxonomy.json` (repo-root data dir) | same 5-map shape | — | Written when an online fetch advances `version`; read at next `_ensure_loaded`; never blanks favicons across restart. |
| **Desktop taxonomy cache** | Desktop (existing, extended) | IndexedDB `snowraven-taxonomy` / store `cache` / key `taxonomy-v2027` | `TaxonomyCache` | `CACHE_KEY` | Existing 7-day TTL; bundled snapshot becomes the **floor** when empty/expired. |
| **Generic `/settings/{key}` KV** | Web/Pi (new route) | `GET/POST/DELETE /settings/{key}` → `data/settings/<safe_key>.json` (one file per key) | raw JSON value verbatim | `<safe_key>` `^[A-Za-z0-9._-]{1,128}$` | Backs **all** generic seam keys on web/Pi (today they 404 silently); upsert/delete; 404 on unset (matches `WebStorage.getSetting` `!ok→null`). |
| **Bundled glyphs + sprite** | Both (asset) | `frontend/public/mapassets/glyphs/{fontstack}/{range}.pbf` · `frontend/public/mapassets/sprite/ofm.{json,png,@2x.png}` | font PBF + sprite | — | Vite copies `public/` → `dist/mapassets/`; referenced by **absolute** URL injected into the style; served same-origin, no provider fetch. |

> **`mapassets/` NOT `map/`** — the `/map/` URL prefix collides with the FastAPI `map_router` (`/map/hotspots`, `/map/recent-obs`, `/map/hotspot-region`), registered before the static mount, which would shadow a `/map/...` static file on the Pi origin. Use `mapassets/` (free prefix). *(Feasibility caveat adopted.)*

---

## Slice 1 — Persistence stores (generic KV route + persisted style + replay store)

### 1a. Generic `/settings/{key}` backend route family — FR-41, FR-42

The storage seam **already** calls `GET/POST/DELETE /settings/{key}` (`storage.ts:46-62`) but **no generic route exists** — only `/settings/keys*` (`apikeys.py:22,30,43`), `/settings/files*` (`settings.py:63-97`), `/settings/map-defaults` (`mapdefaults.py:40,50,60`). Today every generic-key write on web/Pi falls through to the `html=True` StaticFiles mount (`main.py:48-50`) returning **200 + index.html** (when `dist` exists) — `res.json()` then throws and is swallowed by `.catch(()=>{})`. So existing keys (`map-base-layer`, `tab-layout`, `dateFormat`, `welcomeSeen`) silently never persist on web/Pi. This is a **blocking prerequisite** for Tier-A and replay.

**New file `backend/routers/settingskv.py`** (mirrors `mapdefaults.py`):
- One file per key: `DATA_DIR / "settings" / f"{key}.json"` where `DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"` (repo-root `data/`, the established convention — **not** `backend/data/`). `(DATA_DIR/"settings").mkdir(parents=True, exist_ok=True)` before each write.
- **Key sanitization (NFR-12/QA-39):** `key` must match `^[A-Za-z0-9._-]{1,128}$` → else `422`. Blocks `..`/`/` traversal into the CSVs / `api-keys.json` / `settings.json`.
- **Reserved-key guard (defense-in-depth):** the handlers reject `key in {"keys","files","map-defaults"}` (→ 404). FastAPI won't route them here when order is correct, but a client posting a literal `map-defaults` must keep its typed `MapDefaults` handler, not this free-form store.
- POST reads the **raw JSON body** (`await request.json()` / `body: Any`), NOT a fixed Pydantic model — values range from a bare `true`/`"iso"` string to the multi-MB style object. Stores verbatim (`json.dumps(value)`). **Payload guard:** reject bodies > ~16 MB with `413` (server-side backstop; the client OQ-07 cap bounds replay, the style is one bounded object).
- GET returns the stored JSON value (200) or **404** when no file (the seam treats `!ok` as `null`). DELETE unlinks idempotently → 200.

**Route ordering — LOAD-BEARING (FR-41, verified empirically against the real fastapi 0.115.6 / starlette 0.41.3 stack):** FastAPI/Starlette match in **registration order, first-match-wins**, and a `{key}` path param does **not** span `/`. A generic `/settings/{key}` registered **before** the literal routes **silently shadows** `/settings/keys`, `/settings/files`, `/settings/map-defaults` (proven: `GET /settings/keys` → generic `key=keys`). Therefore:
- In `backend/main.py`, add `from routers.settingskv import router as settingskv_router` and call `app.include_router(settingskv_router)` **as the final `include_router`** — after `apikeys_router` (`:30`), `mapdefaults_router` (`:33`), and `settings_router` (`:39`), and before the `/health` route and the `"/"` StaticFiles mount (`:50`). It stays ahead of the static mount, so an unmatched key still reaches a real handler instead of the SPA fallback.
- Order is **necessary but not sufficient** — keep the in-handler reserved-key guard too (a future reorder can't then clobber api-keys/CSV/map-defaults).
- The two-segment `/settings/files/{ebird|ml}` and `/settings/keys/{name}` are **not** at risk (single-segment `{key}` can't match them).

**Regression test (required):** route-resolution test asserting `/settings/keys`, `/settings/files`, `/settings/files/ebird`, `/settings/map-defaults` still hit their dedicated handlers after `settingskv_router` is added, and `GET /settings/<new-key>` returns 200/404 from the generic store (QA-31/QA-34).

No `vite.config.ts` change (`/settings` proxied at `:30`); no Tauri capability change (route is web/Pi-only; Tauri persists via files).

### 1b. Persisted-style store — FR-01, FR-02, FR-05, FR-06, FR-42

**Dedicated seam methods, NOT a string-prefix allowlist on `setSetting`.** *(Feasibility caveat adopted — a prefix glob silently relocates storage on accidental key match and a typo falls back into `settings.json`, re-introducing the FR-42 corruption it forbids, with no compile-time guard.)* Add to `StorageAdapter`:
```
getStyleBlob(variant: VectorVariant): Promise<PersistedStyle | null>
setStyleBlob(variant: VectorVariant, blob: PersistedStyle): Promise<void>
```
- **Desktop (`TauriStorage`):** own file `data/map-style/<variant>.json` (constant `STYLE_DIR = 'data/map-style'`), `mkdir(STYLE_DIR,{recursive:true})` first (NFR-06). Uses `writeTextFile`/`readTextFile` (JSON is text — the granted `fs:allow-write-text-file`/`read-text-file` cover it; **no new capability**). Never touches `settings.json`.
- **Web/Pi (`WebStorage`):** `setSetting('map-style-<variant>', blob)` → generic route → `data/settings/map-style-<variant>.json` (one file per key → FR-42 satisfied structurally on the backend too).

**Format** (`PersistedStyle`): `{ variant: VectorVariant, style: StyleSpecification, savedAt: number }`. The `style` is the already-tuned, JSON-serializable object from `fetchTunedBaseStyle` (verified pure JSON: it starts from `res.json()` and every mutation assigns strings/numbers/arrays/plain-objects — no functions/Map/Set; round-trips byte-stable). `savedAt` is provenance only (QA-04 observability), **not** a TTL gate (FR-05 unbounded).

**Variant-scoped key** (`map-style-positron` today; `persistedStyleKey(variant)`). A future `liberty` variant gets its own file — can't clobber positron, and a schema/maplibre incompatibility is cleanly reset by bumping the key.

**`persistedStyle.ts` (new module)** owns: `persistedStyleKey`, a coalesced/memoized `readPersistedStyle(variant)` (module `_mem` + `_loading`, same idiom as `taxonomyService.ensureTaxonomy` / `SnowMap.getVectorStyle` — one disk read per key per session, NFR-02/QA-38), `persistStyle(variant, style)`, and a once-per-session background revalidate.

**Seed-before-fetch in `SnowMap` (FR-02 — the QA-01 ordering artifact):** rewrite the style `useEffect` (`SnowMap.tsx:58-65`) so it **awaits** `readPersistedStyle('positron')` FIRST and only calls `getVectorStyle('positron')` (the network path) if the read resolves empty — **sequential, not parallel** (a parallel fetch defeats offline). The existing `'Loading map…'` placeholder covers the one-tick async gap. On first successful network fetch: `setMapStyle(fresh)` + `void persistStyle('positron', styleWithLocalAssetUrls)`. On fetch failure with no persisted copy: the existing `'Map couldn't load' + Retry` (FR-04) — unchanged. `getVectorStyle`'s in-memory `cache`/`inflight` stay as-is (the seed sits above them).

**FR-05 unbounded + online supersede:** after seeding from the persisted copy, fire a **once-per-session, non-blocking, non-render-path** revalidate: `void getVectorStyle(variant).then(s => persistStyle(variant, s)).catch(()=>{})`. It does **not** call `setMapStyle` (no mid-session flicker; new tuning takes effect next relaunch) and leaves the persisted copy untouched on failure. Map-mount-triggered, not app-load-triggered → FR-09's no-auto-network-on-startup holds. `Date.now()` for `savedAt` lives in the effect/handler (never render — eslint purity).

**FR-06:** the style **fetch** stays a bare `fetch()` in `fetchTunedBaseStyle` (same posture as MapLibre tile fetches); only the RESULT persists through the seam. Identical code path in both runtimes.

### 1c. Replay store — FR-32, FR-33, FR-34, OQ-07

**Dedicated seam methods** `getReplayStore()/setReplayStore(store)` (own file `data/replay.json` on desktop; `data/settings/replay-store-v1.json` on web/Pi) — same anti-prefix-glob rationale as the style.

**`replayStore.ts` (new module)** wired into **`CachedTransport.get`** (`transport.ts:156-161`) — the one chokepoint covering BOTH runtimes (Tauri TS services + web/Pi FastAPI), parallel to and never replacing the 90 s in-memory `networkCache` (FR-32). `networkCache.ts` is **not modified**.

**Replay paths:** weather (`/weather/{id}`, `/weather/at`), tide (`/tide/{id}`, `/tide/at`), checklist detail (`/checklists/{id}`). **But the decoration is NOT a transparent path-only pass-through** *(two feasibility caveats adopted):*
1. **Caller-identity exclusion (FR-38):** `/checklists/{id}` is shared by the replay surface AND the **Checklist Comparer, which is a NO-replay surface (FR-38)**. A path-only gate can't tell them apart. So replay is **opt-in per call-site** — the consumer that wants replay passes an option (e.g. `transport.get(path, params, { replay: true })`) or calls a distinct `replayGet`; the Comparer's `/checklists/{id}` call does NOT opt in.
2. **Staleness channel (FR-31/FR-37):** `Promise<T>` carries no metadata, so a replayed result returned transparently would render as fresh. The replayed value surfaces through a **distinct channel** — a `{ data, replayedAt }` envelope on the replay path (or a typed `ReplayedResult` marker the WeatherTide/Checklist consumers read to render the "offline — showing last loaded result, loaded at <time>" cue). The cue UI is the offline-messaging slice's job; this slice provides `replayedAt` (= entry `loadedAt`) and the marker.

**Keying (FR-32):** `networkCacheKey(path, params)` imported from `networkCache.ts` — single source of truth. `/weather/{id}` keys by id (path-verbatim); `/weather/at` keys by rounded lat/lng + dt. **Three normalization constraints the bare key does NOT enforce** *(feasibility caveat adopted; implement in a thin wrapper, leave `networkCacheKey` untouched):*
- **Strip `force` before keying** (both write and offline lookup). `/tide/{id}` and `/tide/at` carry `force:'1'` only on a forced reload (`App.tsx:449`, `WeatherForecastPanel` predict-override) — `networkCacheKey` folds `force` verbatim, so the same reading lands under two keys (`/tide/S123?` vs `/tide/S123?force=1`) and a user who forced a reload online gets an offline replay **miss**. `force` is a cache-bust control, not an identity dimension.
- **`dt` is NOT rounded** — `networkCacheKey` rounds only lat/lng/codes, passing `dt` verbatim. The offline lookup must format `dt` byte-identically to the original call (same source string).
- **First caller of `networkCacheKey` on these path shapes** (`CACHED_GET_PATHS` covers only `/map/*` today) — add a key-derivation test pinning the four shapes + the force-strip rule (like `networkCache.test.ts` pins `/map/*`).

**Format** (whole-document, rewritten atomically per put):
```
{ "version": 1,
  "entries": { "<networkCacheKey>": { "data": <response JSON>, "loadedAt": <ms>, "bytes": <serialized len> } },
  "order": ["<oldest-loaded key>", ..., "<newest-loaded key>"] }
```
`loadedAt` = the FR-31 staleness timestamp; `order` = explicit oldest→newest list (a put moves/appends its key to the tail) → eviction is trivially correct without relying on JS object key order.

**Write/replay logic in `CachedTransport.get`:**
- On inner **success** → `void replayStore.put(key, data)`; return `data`.
- On inner **failure** → if `isOfflineError(err)` (a **connection-level** rejection — fetch `TypeError` / `tauriFetch` network error with no HTTP status, per FR-36; the classifier is OWNED by the offline-messaging slice, consumed here as an injected predicate) AND a replay hit exists → return the replayed envelope. Otherwise **rethrow** — **never `put` on failure** (FR-34/QA-25: a failed live fetch never overwrites/clears the prior entry; HTTP non-OK = server-error/no-key, must rethrow so errors are never cached).

**Bounds + eviction — OQ-07 (committed: 300 entries / 3 MB):**
- `REPLAY_MAX_ENTRIES = 300`, `REPLAY_MAX_BYTES = 3_000_000` (sum of `bytes`); whichever hits first. Both **exported, overridable** so eviction tests lower them (QA-24 needs CAP+1). *(The PRD example was 500/4 MB; committed to 300/3 MB because the entire store JSON is read-modify-written on every put — a smaller cap keeps each whole-file rewrite cheap (NFR-04) and far under the 16 MB route guard. Weather/tide/checklist JSONs are low-KB, so 3 MB is the practical ceiling and 300 entries is generous for a field session.)*
- **Eviction (FR-33):** on put, upsert + move the key to the tail of `order`, then while over either cap evict `order[0]` (oldest-loaded). The just-put key is at the tail → **always survives** (QA-24). If one entry alone exceeds the byte cap, store it as the sole entry (most-recent-survives dominates).

**Coalesced mirror (NFR-02/QA-38):** module `_store` loaded once/session via coalesced `ensureLoaded()`; `get` reads the mirror, `put` mutates the mirror then debounce-writes the whole document via the seam (async, off the blocking path — NFR-04).

---

## Slice 2 — Offline vector basemap, region store, build pipeline (Tier B; FR-10..FR-20)

### 2a. PMTiles mechanism (OQ-01 — **committed PMTiles**)

maplibre-gl **5.24.0** exports module-level `addProtocol(customProtocol, loadFn)` (`maplibre-gl.d.ts:14915`; action `(RequestParameters, AbortController) => Promise<GetResourceResponse>` at `:113`) and react-map-gl **8.1.1** (alias re-export of `@vis.gl/react-maplibre@8.1.1`) wraps the same instance via `useMap().current` (used app-wide, e.g. `AtlasLayer.tsx:72`). PMTiles is a single-file Range-readable tile archive — no blocker. **New npm dependency `pmtiles`** (NOT installed — verified `node_modules/pmtiles` absent, `grep -c pmtiles frontend/package.json == 0`). Its `Source` interface is `getBytes(offset, length, signal?, etag?) => Promise<RangeResponse>` + `getKey() => string`; `RangeResponse = { data: ArrayBuffer }`; `class PMTiles(source, ...)`; `class Protocol` registers `maplibregl.addProtocol("pmtiles", protocol.tile)`.

**New lazy module `frontend/src/lib/mapPmtiles.ts`** — imported **only** inside the lazy map chunk (Map Explorer / Species Detail / Statistics), **never** from `App.tsx`'s static graph (NFR-08/NFR-15). Registers protocols at **module-eval time** (top-level side-effect / module-singleton guard), NOT in a React effect that could run after a `<Source>` already mounted and requested tiles. `removeProtocol` on teardown (or idempotent singleton).
- `pmtiles://` → online HTTP-Range stream of a remote `.pmtiles` on GitHub Releases (the OQ-03 **bonus**, native to the lib, zero extra cost, lazy → no first-paint/privacy cost). Opt-in only.
- `srpm://<regionId>` → **local** region file on desktop (the OQ-09 handoff — see 2d).

**NFR-08 guards:** unconditional registration (no `isStyleLoaded()` gate); the region vector `<Source>` is **keyed** `key="sr-region-<regionId>"` so entering/leaving a region or switching base remounts it cleanly (no `source id changed` crash — the `SightingMarkers.tsx key="sr-sight"/"sr-heat"` pattern); a `styleimagemissing` net (if added) acts only on the component's own hardcoded ids.

**Build-time inspection gate (QA-37):** after wiring, a fresh `npm run build` must show `vendor-maplibre` AND `pmtiles` **absent** from `dist/index.html` modulepreload and no reference from the entry `index-*.js`. The region-manager UI (reachable from App's static graph) imports ONLY plain JSON catalog + types — never `mapPmtiles.ts`.

### 2b. FR-10 — bundled glyphs + sprite, absolute-URL rewrite

**The gap (verified):** the OpenFreeMap style references absolute `glyphs: tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf` and `sprite: tiles.openfreemap.org/sprites/ofm_f384/ofm`; `fetchTunedBaseStyle` rewrites **neither**. Offline → label-less, symbol-less.

**Bundle as `public/` assets (not statically-imported JSON):**
- Sprite: `frontend/public/mapassets/sprite/ofm.json` + `ofm.png` (+ `@2x.png`) (~200–250 KB).
- Glyphs: `frontend/public/mapassets/glyphs/{fontstack}/{range}.pbf`. Vite copies `public/` → `dist/mapassets/` verbatim (verified: `public/favicon.svg`→`dist/favicon.svg`).

**Glyph coverage — NOT a fixed "Latin-only ~15-25 PBF" subset** *(feasibility verdict "unsound" adopted).* Positron's `text-field` renders `name:nonlatin` (CJK in US Chinatowns; **Canadian Aboriginal Syllabics U+1400–167F** for Nunavut/Nunavik — squarely in the "US/CA" target), needs **3 font stacks** (Noto Sans Regular/Bold/Italic), and ranges are requested at runtime by actual tile text. Commit to **ONE of**:
- **(A) Capture-and-bundle:** run a real MapLibre `transformRequest` capture over the downloaded US/CA region(s), bundle exactly the `{fontstack}/{range}` set actually requested (Latin + Punctuation + CJK + Hangul + Syllabics as present), sized as part of the asset budget (megabytes, not a fixed small count); unbundled ranges degrade to `.notdef` (never blank a label, never a network fetch). **Recommended.**
- **(B) Latin-only re-tune:** in `fetchTunedBaseStyle`, rewrite every symbol layer's `text-field` to `coalesce(name:latin, name_en, name)`, dropping the `name:nonlatin` concat branch → genuinely bounds requested ranges to Latin so a small per-stack PBF set suffices. **A recorded localization trade-off** (Nunavut/Chinatown labels show transliterated/Latin only), not assumed.

> **Decision: (A) capture-and-bundle**, to keep map labels faithful to eBird/birder place-names in Canada. The captured set is keyed in the asset manifest; `.notdef` fallback guards any miss.

**URL rewrite — ABSOLUTE, never relative** *(two feasibility verdicts adopted — verified against maplibre 5.24.0 dev+prod):*
- A relative **sprite** URL is a **hard error**: `normalizeSpriteURL` does `new URL(url)` with no base and throws `Invalid sprite URL … must be absolute` **before** any fetch. Glyphs would tolerate a relative template (resolved incidentally in `new Request`) but treat both uniformly.
- maplibre does **not** base-resolve sprite against `document.baseURI`; an inline (URL-less) style has no style base. Build **absolute** URLs at rewrite time from the document origin: `new URL(import.meta.env.BASE_URL + 'mapassets/sprite/ofm', document.baseURI).href` and the glyph template `…BASE_URL + 'mapassets/glyphs/{fontstack}/{range}.pbf'` (keep `{fontstack}`/`{range}` tokens un-encoded). `BASE_URL` is `'/'` (no `base` set in `vite.config.ts`); shipped `dist/index.html` references assets absolutely and works on both origins (FastAPI StaticFiles at `/`; Tauri `tauri://localhost`).
- The rewrite (`rewriteStyleAssetUrls(style)`) runs inside `fetchTunedBaseStyle` / the persist wrapper **before persist and before handing to `<MapGL>`** (so the persisted blob is already offline-correct). Online and offline both then use the bundled assets → host count to `tiles.openfreemap.org` for glyphs+sprite drops to **zero** (QA-02 HAR). Capture the document origin at rewrite time (an effect/handler, not render).

**Note the Tier-A scope boundary (FR-03):** a persisted style + bundled glyphs/sprite makes the map **mount and draw labels/symbols + local data layers** offline; base street **tiles** still come from the network until a region is downloaded (Tier B). Tier A ≠ "full base offline."

### 2c. Region files + manifest (FR-12/13/14/19)

**Region files (desktop, FR-12):** raw binary `.pmtiles` at `AppLocalData/data/regions/<regionId>.pmtiles` — a **new binary path-based slot**, separate from the typed two-slot `writeFile` (ebird/ml) and from `settings.json`. A new **binary** seam pair is required (the current `writeFile`/`readFile` slots are TEXT-only, ebird/ml two-slot):
```
writeRegionFile(regionId, bytes: Uint8Array): Promise<void>   // tauri-plugin-fs writeFile (binary)
readRegionBytes(regionId, offset, length): Promise<ArrayBuffer> // open + seek + read (range)
removeRegionFile(regionId): Promise<void>
```
- `<regionId>` shape-validated `^[a-z]{2}(-[a-z0-9-]{1,40})?$` (e.g. `us-ca-001`, `us-ca`) and `encodeURIComponent`-safe (NFR-12/QA-39); malformed → rejected before any path interpolation.
- `mkdir('data/regions',{baseDir:AppLocalData,recursive:true})` first (NFR-06).
- **Download to a temp name, atomic-rename:** `data/regions/.<regionId>.partial` → `<regionId>.pmtiles` on completion (FR-16/OQ-06 **clean-discard, no resume**). A partial is never manifest-listed and is swept on next manager open. Independent budget (FR-18): a region write never evicts/corrupts the replay store, CSVs, or `settings.json`.

**Regions manifest** — own file `AppLocalData/data/regions-manifest.json` (never merged into `settings.json` — FR-42), shape:
```
{ "version": 1, "regions": [{
  "regionId": "us-ca-001", "name": "Alameda County, CA", "kind": "county",
  "stateCode": "US-CA", "countyName": "Alameda",
  "extent": [-122.37,37.45,-121.46,37.91],   // [w,s,e,n] WGS84 (FR-13 / FR-17 inside-test)
  "minZoom": 0, "maxZoom": 14,                // baked range (OQ-04; FR-17 over-zoom fallback)
  "bytes": 41268221,                          // on-disk size (FR-13 size + total)
  "downloadedAt": 1718841600000,              // ms epoch (FR-19 via session-now seam)
  "sourceVersion": "2026.05"                  // catalog/bake version (FR-19 / FR-25-style supersede)
}]}
```
- FR-13: list renders `name`/`extent`/`bytes` + a `Σ bytes` total straight from the manifest (no per-file `stat` — manifest is the source of truth; bytes recorded at write time).
- FR-14: delete the file + splice the entry + rewrite the manifest → total updates (QA-10).
- FR-19 stale: `sessionNow() - downloadedAt > STALE_MS` OR `sourceVersion !== catalog.currentVersion`. **`STALE_MS = 9 months`** (OQ-05), a single module constant read via the existing session-now seam (the `SESSION_NOW_MS` pattern), so QA-14 crosses it deterministically. Stale regions stay fully usable offline + show an out-of-date badge; never auto-deleted/auto-refreshed.
- Manifest read is coalesced/memoized (one disk read/session, NFR-02).

### 2d. OQ-09 — local PMTiles handoff to MapLibre on desktop

**Decision: a custom `srpm://` maplibre `addProtocol` loader backed by a `pmtiles` custom `Source` whose `getBytes(offset,length,signal?)` does TRUE range reads via `open()` + `FileHandle.seek(offset, SeekMode.Start)` + `read(buffer)` from `@tauri-apps/plugin-fs`. NOT `convertFileSrc`/asset protocol, NOT a blob, NOT `readFile`.**

*Grounded in verified facts:*
- **`readFile` cannot range-read** (feasibility verdict "unsound"): `ReadFileOptions` is only `{baseDir, encoding}` (no offset/length — confirmed at `index.d.ts:537-542`), and it "reads the **entire** contents" — per-tile `readFile` would materialize the whole multi-hundred-MB archive into the webview on every tile, breaking NFR-03/NFR-04. The library's range primitive is `open()` → `FileHandle.seek` → `read` (confirmed exports `index.d.ts:256/289/442/928`).
- **A custom `addProtocol` loader is pure JS** (returns an `ArrayBuffer` in-memory; maplibre never sends those bytes through the WebView URL/`asset://` path), so the Tauri **asset protocol / CSP path does not apply at all**. `tauri.conf.json` CSP is already `null` (`:23`) — **no CSP change, no `assetProtocol.enable`, no `convertFileSrc`** (its `convertFileSrc` URL isn't served by current config anyway, and the asset protocol's Linux webkit2gtk Range reliability is poor).
- **Capabilities need new grants** (today only text-file fs perms — `default.json:24-42`). Add, scoped `$APPLOCALDATA/**`:
  - `fs:allow-open` — open the `FileHandle`
  - `fs:allow-read` — the sized `read()` (the `plugin:fs|read` command)
  - `fs:allow-seek` — `FileHandle.seek`
  - `fs:allow-write-file` — **binary** write of the downloaded `.pmtiles` (only `write-text-file` is granted today; `writeFile(path, Uint8Array)` needs the binary grant)
  - (`exists`/`remove`/`mkdir` already granted)

**Custom Source contract** *(feasibility caveat adopted — the bare `getBytes(offset,length)` is incomplete):* implement the full `pmtiles` `Source`:
- `getBytes(offset, length, signal?, etag?): Promise<RangeResponse>` — open the region `FileHandle` (open **once per region, reuse** across reads; it's a Resource/rid, **close on region switch/unmount**), `seek(offset, Start)`, `read(new Uint8Array(length))`, return `{ data: <the slice's ArrayBuffer> }` (convert from `Uint8Array` — do NOT return a `Uint8Array`/`Buffer`). **Honor the `AbortSignal`** so FR-15 cancel actually aborts in-flight reads.
- `getKey(): string` — a **stable** logical key (the `regionId`); `Protocol.add` keys its registry on it and the style URL `srpm://<regionId>` / `pmtiles://<key>` must match.

The region style source is a vector source with `tiles: ['srpm://<regionId>/{z}/{x}/{y}']` (or `url: 'srpm://<regionId>'`), keyed `<Source key="sr-region-<regionId>">`. Glyphs/sprite stay the bundled local assets from 2b (reused per region, never re-downloaded — FR-12). Source archives must be **clustered** (re-cluster with `pmtiles cluster` at build if not), or `pmtiles extract` fails.

**FR-17 over-zoom fallback:** the region's baked `maxZoom` is set at extract time (2e); above it, maplibre over-zooms the deepest baked tiles (no blank). Outside any region / uncovered location → Tier-A persisted base; local data layers still draw.

### 2e. Build / tooling pipeline + hosting + catalog (OQ-02/04/08)

**Source data:** the **Protomaps planet PMTiles** (`build.protomaps.com`, ODbL, openmaptiles schema — matches Positron's `source-layer` names like `landcover`, native max zoom 15) or self-run planetiler. Licensed for bulk download (the hard constraint).

**New `tools/build-regions/` dir** (mirrors `website/tools/`), a release-time CLI step (NOT in `npm run build`):
1. **`pmtiles extract <planet.pmtiles> <regionId>.pmtiles --region <boundary.geojson> --maxzoom=14`** — **`--region` POLYGON clip, NOT raw `--bbox`** *(feasibility caveat adopted — verified on real extracts).* A naive bbox for an antimeridian-spanning state explodes (Alaska full bbox → **20 GB**, over the 2 GB asset limit; polygon-clipped mainland → **660 MB**). Antimeridian states (AK) use a dateline-split MultiPolygon. (`pmtiles extract` is the **go-pmtiles** CLI, a build step — NOT the npm `pmtiles` runtime dep, not shipped in the app.)
2. **OQ-04 maxzoom = z14** (committed; the dominant size lever; source native max is z15 so z14 has one level of margin).
3. **OQ-02 granularity = county primary, whole-state coarser** (committed). **Real measured sizes (z14, polygon-clipped):** densest US metro county = **LA County 75 MB** (not the over-estimated ~150 MB); largest single state = **Alaska land-only 660 MB** (not ~1.5 GB — no US state reaches 1.5 GB at z14). Both **comfortably under GitHub Releases' 2 GiB/asset** (>3× headroom on the largest state).
4. Region ids/extents/names derived from county/state boundary GeoJSON (US Census counties + Canadian census divisions); the bake emits `extent`, `name`, `kind`, `stateCode`, `countyName`, `minZoom`, `maxZoom`, `bytes` into the **catalog**.

**Bundled glyphs/sprite bake (FR-10):** the capture-and-bundle set (2b) generated from Noto Sans TTFs (a `build-glyphs`/`font-maker` step), keeping the ranges the real US/CA capture requests across all 3 stacks; copy the OpenFreeMap `ofm` sprite into `frontend/public/mapassets/sprite/`. Checked into the repo (small, on-demand) — not a release asset.

**Hosting — GitHub Releases (OQ-08):** a dedicated, non-app tag (e.g. `regions-2026.05`) carries each `<regionId>.pmtiles` as a release asset (≤2 GB/asset, Range-capable CDN for the streaming bonus). **Not** GitHub Pages (≤100 MB/file forbids per-state assets). **Separate from the app `vX.Y.Z` releases** so it doesn't entangle `release.sh`.

**Catalog discovery — bundled, no runtime fetch** (offline-discoverable + privacy-first: no network call just to list regions): `frontend/public/mapassets/regions-catalog.json`:
```
{ "currentVersion": "2026.05",
  "baseUrl": "https://github.com/dtgibson/snowraven/releases/download/regions-2026.05/",
  "regions": [{ "regionId":"us-ca-001","name":"Alameda County, CA","kind":"county",
    "stateCode":"US-CA","countyName":"Alameda","extent":[...],"minZoom":0,"maxZoom":14,"bytes":41268221 }] }
```
Download URL = `baseUrl + encodeURIComponent(regionId) + '.pmtiles'` (NFR-12 shape-validate + encode). Regenerated by the build tool alongside the assets, committed with each app release. `sourceVersion`/`currentVersion` drive FR-19 stale + the FR-25-style supersede. The new GitHub Releases host + the bundled-asset origin are added to the `PRIVACY_POLICY.md` Map Tiles list (FR-43/44).

### 2f. County-first region selection (OQ-10)

Loaded data carries **`county`** free-text (`types.ts:66`) + **`stateProvince`** subnational1 (`types.ts:80`) per sighting, but **no county FIPS**. So selection matches the catalog's `countyName`+`stateCode` against the user's distinct `(county, stateProvince)` pairs — the same region-join `hotspotSet.ts` already does.

**UX (committed):** the region manager surfaces **first the counties the user already birds** ("Counties you bird") — derive `distinct (county, stateProvince)` from the loaded backup (via `observationsCache`, the same source `useHotspotSet` uses), match each to a catalog region by `countyName`+`stateCode` (normalize-insensitive), one-tap downloads. Below: the full curated catalog grouped by state, with whole-state coarse picks. A county with no catalog region (international / not-yet-baked) shows as unavailable, not a broken control. Free-form draw-a-box is **out of scope v1**. The county-name match is the only place loaded-data text drives selection; the actual download keys on the catalog's validated `regionId`, never the raw county string in a URL (NFR-12).

### 2g — Offline-maps opt-in gate (FR-11a)

**All Tier-B tile downloading is gated behind a Settings toggle `offline-maps-enabled` (default `false`).** A scalar boolean persisted via the storage seam like the other UI settings (`getSetting/setSetting('offline-maps-enabled')` -> `settings.json` on desktop, the new generic `/settings/{key}` route on web/Pi). Read once and memoized; UI subscribes via the existing settings-change path. It gates:
- The region manager's **download controls and any fetch-to-store of catalog/region tiles**. With the toggle off, the "Counties you bird" / catalog surface renders a disabled state pointing at the Settings toggle, and **no region tile bytes are ever fetched or written** (QA-40 HAR: zero requests to the regions host during normal map use). The bundled `regions-catalog.json` may still be read to *describe* what is available, but nothing is downloaded.
- It does **NOT** gate the persisted style (1b), the replay store (1c), the bundled taxonomy/glyphs/sprite, or the rendering of *already-downloaded* regions. Tier-A resilience and replay are always on (they store no tiles) -- this is the FR-11a scope boundary.
- Turning the toggle **off** after regions exist stops new downloads but keeps existing region files + manifest; the manager still lists them for use and removal (FR-11a). The control lives beside the existing appearance/location settings in Settings; default-off is the privacy-first stance (no bulk fetch until explicit opt-in).

---

## Slice 3 — Taxonomy offline (FR-21..FR-27)

### 3a. Bundled snapshot — format, shape, size

**Dual-target asset, ONE build script writes both** (the `noaa-tide-stations.json` convention):
- FE: `frontend/src/assets/ebird-taxonomy.json` · BE: `backend/staticdata/ebird_taxonomy.json` (verified committed, not gitignored; the repo-root `data/` is the gitignored mutable upload dir — **not** `backend/data/`).

**Shape — the already-derived 5-map bundle** (NOT the raw 17 891-entry array), mirroring the in-memory `TaxonomyCache` (`taxonomyService.ts:15-22`) + a version stamp:
```
{ "version": "2027", "generated": "2026-06-20",
  "bySci":    { "hirundo rustica": "barswa", ... },   // sciName.lower() -> code (species only)
  "byCom":    { "barn swallow": "barswa", ... },       // comName.lower()  -> code (species only)
  "byOrder":  { "barn swallow": 25670, ... },          // comName.lower()  -> taxonOrder (species only, INTEGER)
  "byCode":   { "barswa": "Barn Swallow", "rocpig1": "Rock Pigeon (Feral Pigeon)", ... }, // ALL categories, original case
  "reportAs": { "rocpig1": "rocpig", ... } }           // sub-form -> parent (ALL categories)
```
**Critical invariant — `byCode` and `reportAs` are built from ALL categories, `bySci`/`byCom`/`byOrder` species-only** *(feasibility verdict "sound" with constraints):* all 4 120 `reportAs` source codes are **non-species** (issf/form/domestic/intergrade), so a species-only `byCode`/`reportAs` drops 100% of sub-form normalization and `rocpig1` resolves to itself (the QA-16 failure). Verified: with the all-category maps, `rocpig1` → `rocpig` → "Rock Pigeon". Self-consistency invariant the build asserts: every `reportAs` value is a `byCode` key (0 dangling today). `byOrder` is coerced to **integer** at build (matching backend `int(order)`) so a straight copy is value-identical in both ports.

**Measured size (live fetch 2026-06-20, real EBIRD_API_KEY):** 17 891 `byCode` / 11 167 each `bySci`/`byCom`/`byOrder` / 4 120 `reportAs` → **~1.74 MB uncompressed / ~0.46 MB gzipped** (byCode is the largest component, 0.61 MB raw). Budget against **~2 MB uncompressed / ~0.5 MB gz with growth headroom** (the issf split grows annually) — well within NFR-16's "few MB compressed" (~10× headroom). The build tool re-measures at build time.

**Build script `scripts/build-ebird-taxonomy.mjs`** (mirrors `build-tide-stations.mjs`): fetches `ref/taxonomy/ebird?fmt=json` (header `x-ebirdapitoken` from env `EBIRD_API_KEY`), runs **the SAME derivation as `taxonomyService.ts:119-133` / `taxonomy.py:38-57`** (single source of truth — keep in lockstep), `JSON.stringify`, writes both targets (`mkdir(dirname,{recursive:true})` + `writeFile`). Run manually at release time (NOT in `npm run build` — a missing key never breaks CI; the snapshot is a committed artifact). **Guard:** length/count check + `process.exit(1)` on a truncated fetch (a truncated bundled floor would silently degrade favicons for ALL users). `version` is the only hand-bumped value (set to the Clements year, aligns with `CACHE_KEY` suffix). A **parity/golden test** asserts the build-script output, `taxonomy.py`, and `taxonomyService.ts` produce byte-identical maps (the weatherFormatter-golden pattern).

### 3b. Desktop — bundled floor under the IndexedDB cache (FR-22/FR-23/FR-25/FR-27)

Modify `loadTaxonomy()` (`taxonomyService.ts:81-138`). New load order (offline-first, returns first available source):
1. **IndexedDB fresh** — existing `readCache()`; if present AND `< 7 days` (`:84`) → return. Unchanged.
2. **Bundled floor** — if empty/expired, `await import('../assets/ebird-taxonomy.json')` (**dynamic import**, the atlas pattern at `MapExplorer.tsx:643` — off the entry chunk; NEVER a static `import x from '…json'`, which inlines into the importer's chunk like the `noaa-tide-stations.json` anti-pattern). Map the five maps into a `TaxonomyCache` with `loadedAt: 0` (sentinel "infinitely stale" so a later online fetch always supersedes — FR-25). Return immediately → favicons/sort/`reportAs` work with no network, including a true first-ever run (FR-22/QA-16).
3. **Online supersede** — a separate fire-and-forget `refreshTaxonomyOnline()`, gated on "the returned source was the floor or an expired cache", attempts the live `tauriFetch` and on success `writeCache()`s the fresh result (real `loadedAt`) → next session reads the fresher copy from step 1. On failure (offline) swallowed.

`_memCache`/`_loading` coalescing (`:68-79`) untouched (FR-27/QA-17 — one shared load across concurrent first-callers). **FR-26 degrade:** if even the bundled import throws AND online fails, `loadTaxonomy` rejects as today → callers' try/catch → empty maps → plain names. **FR-25 annual revision:** bump the asset `version` AND bump `CACHE_KEY` to `taxonomy-v<year>` (a changed key misses the old-year IndexedDB entry → new floor loads → first online fetch repopulates; QA-19). *(Risk: forgetting the `CACHE_KEY` bump strands desktop on the prior-year IndexedDB entry until the 7-day TTL expires — document in CLAUDE.md.)* `loadedAt: 0` is only ever read by the 7-day TTL comparison — confirm no user-facing "loaded N days ago" reads it.

### 3c. Web/Pi — backend-internal disk twin (FR-24)

**Backend-internal — no new transport route, no Vite-proxy entry, no TS twin** (FR-24/NFR-05 exemption; `/taxonomy/codes` already exists and routes correctly: web/Pi `WebTransport.post('/taxonomy/codes')` → FastAPI; the Tauri eBird-touching service is reachable ONLY via `transport.ts:126-129`). Three changes to `taxonomy.py`:
1. **Bundled floor at startup** — `_STATIC = .../staticdata/ebird_taxonomy.json` (the `tide_stations.py:10` path convention) + `_DISK = DATA_DIR / "taxonomy.json"` (repo-root `data/`, the `mapdefaults.py:9` convention). In `_ensure_loaded()`, before any eBird call, populate the module dicts from **disk if present, else the bundled snapshot** — a straight `json.loads(path.read_text())` + dict copy into `_by_sci/_by_com/_by_order/_by_code/_report_as` (the snapshot already carries the exact maps — **no re-derivation, no consume-time `int()`**). Set `_loaded = True` → populated maps with **zero** eBird calls (FR-22/FR-24, QA-16/QA-18).
2. **Persist online refresh (FR-24)** — keep the `httpx` fetch as a *refresh*: after the floor loads, if online AND (`_DISK` absent OR its `version` older than eBird's), fetch + derive (existing loop `:38-57`), write the 5-map shape to `_DISK` via `DATA_DIR.mkdir(parents=True,exist_ok=True)` + `write_text` — **gated on version-advance** (don't rewrite a ~1.7 MB file every load), **write-temp-then-rename** so a partial write can't corrupt the file the next start reads (a corrupt `_DISK` falls back to the `staticdata` floor). Next start reads the fresher disk copy first.
3. **Coalescing (FR-27) + lock** — add a **module-level `_load_lock = asyncio.Lock()`** with a **double-check inside** *(feasibility caveat adopted):*
   ```
   if _loaded: return                       # fast path (keep)
   async with _load_lock:
       if _loaded: return                   # MANDATORY second check (else every waiter re-runs the load)
       <floor load; refresh; write>
       _loaded = True                       # NOT set on failure (preserve empty-degrade retry)
   ```
   Verified safe: single uvicorn process / one event loop (`start.sh`, no `--workers`); no recursion → non-reentrant `asyncio.Lock` can't deadlock; Python 3.12.3 lazily binds the lock to the loop on first acquire (require ≥3.10). The lock is held across the 30 s fetch on a cold online load — concurrent first-callers share one serial wait (desired), and a slow/offline first load blocks consumers up to the timeout before the exception releases it. The FR-26 try/except in `resolve_species`/`get_species_codes` stays → empty maps → plain names.

### 3d. Lifecycle summary

| Event | Desktop | Web/Pi |
|---|---|---|
| First-ever cold start, no network | bundled snapshot floor (dynamic import) → favicons/sort/`reportAs` (FR-22) | bundled `staticdata` floor at `_ensure_loaded` → populated, no eBird call (FR-22/FR-24) |
| Relaunch, no network, prior online load | IndexedDB-fresh (≤7d) or bundled floor (FR-23) | `data/taxonomy.json` from prior fetch (FR-24) |
| Online, fresher eBird | fire-and-forget fetch → `writeCache()` → next session (FR-25) | version-gated refresh → write `data/taxonomy.json` → next restart (FR-25) |
| Genuinely unavailable | `loadTaxonomy` rejects → try/catch → plain names (FR-26) | except → `{codes:{},orders:{}}` → plain names (FR-26) |
| Concurrent first-callers | `_memCache`/`_loading` (FR-27) | `_loaded` + `_load_lock` double-check (FR-27) |

---

## Resolved Decisions (Open Questions)

- **OQ-01 — Basemap mechanism → PMTiles.** New npm dep `pmtiles` in a lazy `mapPmtiles.ts`; registers `pmtiles://` (online range) + `srpm://` (local region) via `maplibre.addProtocol`. Bulk tiles from our own ODbL/Protomaps-sourced bake on GitHub Releases (the hard licensed-to-bulk-download constraint). Materially sets FR-01's variant key (`map-style-positron`), FR-05's fresh-fetch path, and the FR-44 Map Tiles list (adds the Releases host + bundled-asset origin).
- **OQ-02 — Granularity → county primary (z14, real ceiling LA County 75 MB), whole-state coarser (real ceiling Alaska land-only 660 MB).** Both << GitHub's 2 GB/asset. County maps onto eBird county lists + the county carried per sighting.
- **OQ-03 — Download-only required; online HTTP-Range streaming committed as a zero-cost opt-in bonus** (the `pmtiles` lib's native `pmtiles://` over a Range-capable Releases CDN; lazy → no first-paint/privacy cost).
- **OQ-04 — Max zoom → z14** (set at `pmtiles extract` time; FR-17 over-zooms z14 content rather than blanking).
- **OQ-05 — Region freshness → `STALE_MS = 9 months`**, a single constant read via the session-now seam (QA-14-injectable). Never auto-deleted, never auto-refreshed; flagged out-of-date, stays usable offline.
- **OQ-06 — Clean-discard only, no resume.** Download to `.<id>.partial` → atomic-rename to `<id>.pmtiles` on completion; partials never manifest-listed, swept on manager open.
- **OQ-07 — Replay budget → 300 entries AND 3 MB**, whichever first; strict oldest-loaded-first via an explicit append-ordered `order[]`; most-recently-loaded always survives (moved to tail before eviction). Both caps exported/overridable for QA-24. *(Committed below the PRD's 500/4 MB example to keep each whole-file rewrite cheap.)*
- **OQ-08 — Hosting → GitHub Releases** on a dedicated `regions-<ver>` tag (≤2 GB/asset, Range-capable), separate from app `vX.Y.Z` releases.
- **OQ-09 — Local handoff → custom `srpm://` `addProtocol` loader + `pmtiles` custom Source doing TRUE range reads via `open`+`seek`+`read`** (binary), NOT `convertFileSrc`/asset-protocol (would force CSP `null`→string + `assetProtocol.enable`) and NOT `readFile`/blob (whole-file → NFR-04 violation). Adds `fs:allow-open` + `fs:allow-read` + `fs:allow-seek` + `fs:allow-write-file` scoped `$APPLOCALDATA/**`; no CSP change. Web/Pi region download out of scope (FR-20).
- **OQ-10 — County-first selection:** surface "Counties you bird" first (match catalog `countyName`+`stateCode` against distinct `(county, stateProvince)` from the loaded backup), whole-state coarse below; no draw-a-box v1. Download keys on the validated `regionId`, never the raw county string.

---

## Dual-Runtime / Compatibility Notes

- **Tier A (style), replay, taxonomy floor, offline messaging → dual-runtime** (FR-40). The only runtime-conditional differences: region download (desktop-first, FR-20) and the web/Pi backend-down state (FR-39a), both surfaced honestly.
- **Region download is desktop-only (FR-20):** web/Pi cannot durably persist multi-hundred-MB blobs (the only blob path is the 50 MB-capped typed `writeFile`; browser OPFS/IndexedDB GB-scale quota is unreliable). On web/Pi the manager states the limitation and offers **no** download control; the manifest read returns empty.
- **FR-39a (web/Pi backend-down ≠ device-offline):** on web/Pi the storage seam / persisted style / replay all go through FastAPI. If the backend is down while the device is online: a failed seed read resolves `null` → the map falls back to the live network style fetch (which succeeds) → map works; a failed `persistStyle` is fire-and-forget (best-effort); a failed replay read/write degrades to "no replay" — **never a crash**. The distinct "the local server isn't running" *messaging* is the offline-messaging slice; this slice guarantees storage failures degrade silently and safely. On Tauri this state cannot occur (no backend).
- **Seams only:** all persistence through `storage` / `transport`; branching via `isTauri()` (NFR-07); no new `localStorage` for relaunch-critical state (NFR-06); every TauriStorage write `mkdir(...,{recursive:true})` first.

---

## Migration / Back-Compat (no DB)

- **All additive.** New files (`data/map-style/<variant>.json`, `data/replay.json`, `data/regions/*.pmtiles`, `data/regions-manifest.json`), new web/Pi files (`data/settings/<key>.json`, `data/taxonomy.json`), new bundled assets (`ebird-taxonomy.json`, `mapassets/glyphs|sprite|regions-catalog.json`), one new backend route family, one new build tool.
- **`settings.json` is never touched** — the large blobs get their own files (FR-42), so a partial/bad blob write can't corrupt scalar settings. Existing keys (`map-base-layer`, `tab-layout`) keep their current home; on web/Pi they **start** persisting once the generic route ships (a behavior addition, not a break).
- **No schema version bump anywhere needed** — absent files read as "empty/floor" by every consumer (manifest empty, persisted style null → network fetch, replay empty → no replay, taxonomy floor → bundled snapshot). A first run after upgrade is indistinguishable from a fresh install.
- The bundled taxonomy `version` / `CACHE_KEY` is the only versioned identifier; an old IndexedDB `taxonomy-v2027` entry coexists and is superseded normally.
- **Version bump (FR-46):** both `frontend/package.json` AND `src-tauri/tauri.conf.json` to the same value + `CHANGELOG.md`.

---

## Risks

1. **Tauri custom-protocol main-thread cost / `open`+`seek`+`read` per tile.** Verified `readFile` is whole-file (unusable); the `open`+`seek`+`read` range path is correct but runs on the main thread via plugin IPC. If per-tile IPC latency dents the NFR-03 ≥30 fps pan, the fallback is a small Rust-side range-read `invoke` command (a larger `src-tauri` change than the capability grants). Validate fps on a real desktop with a dense county before committing the JS-only path.
2. **Relative→absolute glyph/sprite URL resolution under the Tauri webview origin.** Verified a relative sprite URL hard-throws; the design uses absolute `import.meta.env.BASE_URL`-built URLs against `document.baseURI`. Must be tested on a **real desktop** (`tauri://localhost`), not just web-dev — a wrong origin silently blanks offline labels/symbols.
3. **Glyph coverage is data-dependent, not a fixed Latin subset.** The capture-and-bundle set must come from a real `transformRequest` capture over the downloaded US/CA regions (CJK + Canadian Aboriginal Syllabics present); a miss degrades to `.notdef` (acceptable) but the asset is megabytes, not a small fixed count — size it into the budget and re-verify on each base-style change (Positron `ofm_f384`/fontstack drift).
4. **Per-county size on the densest metros.** Real LA County = 75 MB at z14; safe, but re-measure any new densest target before shipping county defaults, and validate the antimeridian `--region` polygon clip for Alaska (bbox = 20 GB trap).
5. **Replay whole-file rewrite per successful live load.** Even at 3 MB this is a `JSON.stringify` + seam write per weather/tide/checklist load; debounce/async the write and keep the cap small (NFR-04). A future slice could move serialization off-thread.
6. **FR-34 depends on the offline-messaging slice's `isOfflineError` classifier.** If it mis-labels an HTTP 5xx as offline, replay could surface a stale entry on a server error. The put-only-on-success half is independent and safe; the replay-on-offline half consumes the predicate (cross-slice contract).
7. **Bundle creep onto first paint (NFR-15).** A careless static import of `mapPmtiles.ts` (or a static `import x from 'ebird-taxonomy.json'`) drags maplibre/pmtiles or the snapshot onto first paint. The QA-37 build-inspection gate must run after wiring both the region manager and the taxonomy floor.
8. **Annual taxonomy revision is a two-step manual process** (bump asset `version` + rebuild; bump frontend `CACHE_KEY`). Forgetting the `CACHE_KEY` bump strands desktop on the prior-year IndexedDB entry until the 7-day TTL — document in CLAUDE.md beside the `taxonomy-v2027` note.
9. **Build-tool dependency on a valid `EBIRD_API_KEY`.** The snapshot generator must guard with a count check + `process.exit(1)` — a truncated bundled floor silently degrades favicons for all users until the next release.
10. **GitHub Releases region host has no SLA and assets are public.** A region download exposes the user's IP + county extent to GitHub at download time (disclosed by FR-43/44 — the privacy slice MUST write it). The bundled catalog avoids any network call to *list* regions.