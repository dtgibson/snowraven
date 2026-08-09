# Product Context

This file is maintained by The Chronicler.
It records what has been built and key decisions made during development.

## Features Built

### Three-fix Spool bundle: the phone repairs (complete — August 2026, v0.5.82)

Three queued fixes shipped as one release, each repair of something already meant to work. Frontend and CSS only: no new data, providers, network calls, backend routes, settings, or accessible-name changes, and nothing above 640px changes on any of them.

- **The Map Explorer's filter controls no longer trigger iOS focus zoom.** Its nine form controls (place-name search, latitude, longitude, the Species / County / Media filters, both Date Range fields, and the target species search) now carry the app-wide `.sr-input-16` guard on the element itself, the one place the v0.5.61 sweep had missed. The Date Range pair stacks through the whole phone tier, scoped to the map sidebar, because at 16px the two native date inputs no longer fit side by side in a 282px sidebar.
- **The count-and-view cluster on Multimedia and Breeding Codes wraps instead of leaking page horizontal scroll.** At the narrowest width with the largest text size it had held its full width and pushed the page sideways; on Breeding Codes that had put `↔ Unbounded` entirely off-screen and unreachable. Breeding Codes also wraps its cluster to two lines at 320px at normal text size, a deliberate visible change.
- **The "Skip to main content" link clears the Dynamic Island.** As the app's first tab stop it revealed 16px from the physical top, behind the status bar and camera housing; it now takes the iOS safe-area inset on focus (and clears the sensor housing in landscape), completing the `position: fixed` safe-area family.

The in-app Help's phone-behavior note now says a few dense spots can still scroll sideways at the narrowest width with the largest text size, rather than claiming everything wraps.

### Five-improvement Spool bundle: phone comfort, a pinnable matrix header, and per-part sharing (complete — August 2026, v0.5.81)

Five queued builds shipped as one release, four of them about the app being comfortable on a phone.

- **Pin code labels on the Breeding Codes matrix.** An opt-in toggle beside `↔ Unbounded` keeps the code header row visible while a long species list scrolls, so a circle's column stays identifiable. Off by default, session-only, and offered **only in the Unbounded view**, where the scrollport is the page and a sticky `<th>` costs nothing; Normal view keeps the natural full-height table v0.5.69 settled on. Invariant: pinned implies Unbounded, reached and left in one press either way. One new token, `--sr-sticky-shadow`.
- **Sharing becomes three independent switches** (Coordinates, Google Maps, Apple Maps), all eight combinations including all-off. Detailed under Pin Share below.
- **The Dynamic Island no longer covers the map sub-tabs or the Help header.** Both surfaces were `position: fixed; inset: 0` inline styles, which escape `.sr-ios-app body`'s safe-area padding; each had its positioning lifted to a class (`.sr-map-fullscreen-panel`, `.sr-help-panel`) with an `.sr-ios-app`-gated top/left/right inset, so landscape clears the sensor housing too. The Help table of contents also stopped over-extending past the scrollport on iPad, where its `calc(100vh - 52px)` cap had never subtracted the inset and its last entries were unreachable.
- **One text size across every phone filter row.** `.sr-input-16`'s flat 16px iOS focus-zoom guard sat beside 12px pills and *inverted* at 200% text scale (pills 24px, controls still 16px). One shared `max(16px, 0.75rem)` formula in the ≤640 tier, plus a new `.sr-ctl-row` container hook, puts both sides on the same size at every scale across Life List, Multimedia, Checklists, Breeding Codes, Species Detail, and Calendar.

Frontend-only throughout: no new data, providers, network calls, backend routes, or persisted settings beyond the widened share-format value. Two published Help statements were corrected in the same release, both claiming a session-only choice resets on leaving its tab, which tabs staying mounted makes false.

### Pin Share — copy a map location as a share-ready block (complete — August 2026, v0.5.80)

Right-click (desktop) or long-press (touch) anywhere on a birding map drops a transient share pin and opens a popup showing that spot's coordinates, with one press to copy a share-ready block to the clipboard: a labeled coordinate line (decimal degrees to five places, `38.54321, -121.98765`) plus short canonical `maps.google.com/?q=` and `maps.apple.com/?q=` links, in that fixed order, with each of the three independently switchable in Settings. The coordinate line is independently actionable — pasted into any maps search box it finds the spot — which is what makes a coordinates-only selection a real choice rather than a degraded one. Live on the Map Explorer's My Sightings view, Species Detail (both the pins and heatmap branches), the Statistics map, and the Named Birds card maps; on the Map Explorer's Hotspots, Nearby Lifers, and Media Targets views the drop gesture is already the v0.5.43 search-center pin, so **that existing pin gains the copy action** rather than a second pin or a competing gesture being introduced. The pin is draggable to fine-tune, session-scoped (one per map, nothing written to disk, cleared on leaving the map), and dismissed by an explicit close, Escape, or unmount. Copy is always an explicit press, never automatic on drop; a refused clipboard write reveals the payload as selectable text with a **Select all** control rather than failing silently.

- A **Sharing** section in Settings carries three independent switches (Coordinates, Google Maps link, Apple Maps link, all on by default), so all eight combinations are reachable, with a live example of the exact payload built by the same builder the popup uses. All three off is permitted and is a structural state, not a ninth string: in both Settings and the popup the control is replaced by a sentence rather than left disabled, because no control that looks pressable may put an empty string on the clipboard. Every label is generated from one ordered `SHARE_PARTS` manifest, so a fourth destination is one row and no new copy. Persisted through the `storage` seam under the `shareCopyMode` key, so it survives a desktop relaunch and a web/Pi reload; both v0.5.80 literals migrate explicitly, so a user who chose coordinates only still gets exactly that.
- **No URL shortener, permanently excluded** — a third-party shortener would send the user's exact coordinate (nest sites, stakeouts, suppressed rarities) to an outside company, mint a permanent public URL resolving to it, require a `PRIVACY_POLICY.md` entry, and break offline. Short canonical map URLs deliver the same "tappable in a text message" outcome locally.
- The share action itself issues no request on either transport: coordinates are already on the device and both links are built as local strings. Only the preference touches the storage seam, carrying the user's own share-format choice and never a coordinate. `PRIVACY_POLICY.md` needs no change. A reverse-geocoded street-address option was scoped and declined, keeping the no-lookup promise unqualified.
- A corner **map tool** plants the pin at the view center, making the whole feature reachable without a pointer gesture (right-click and long-press have no keyboard equivalent, and four of the five surfaces have no coordinate inputs). It is the primary route, not a hidden accessibility fallback: on the Map Explorer it is the first item of the existing FAB cluster, so no shipped control moves.
- One new map-anchored token pair (`--sr-share-pin` / `--sr-share-pin-ink`) — shape, a planted flag, carries the distinction from every existing pin, because no existing map color is free on all five surfaces.
- Excluded by design: saved or named pins, a Web Share API sheet, an "Open in Maps" button, alternate coordinate formats, a reverse-geocoded place name (it would make a zero-network feature network-dependent), and the Weather tab's Predict picker map.

### Five-improvement Spool bundle: positioning, richer statistics, a rename, and a docs sweep (complete — August 2026, v0.5.78)

Five queued improvements shipped as one release. The app's tagline now reads **"Self-hosted birding tools and data explorer"**, with the same formulation on the README description, the website title/og:title, and the website footer. On the Statistics tab, "Lists by observer count" shows every distinct observer count as its own bar, legend row, and donut slice (the old "5+" rollup is gone; the categorical axis renders only counts present in the data), and Temporal Stats gains a **Checklist duration** histogram — 15-minute bins for the first three hours, hourly bins after, with an average caption and an honest "N of M checklists have a usable duration" coverage note. The Frivolous Lists' rainbow collection is retitled **"Rainbow Connection"** (matching behavior unchanged). And the published docs caught up: HELP.md documents the new stats, the README's Multimedia entry names the "↔ Unbounded" toggle (closing the last v0.5.75 sweep gap), and em dashes were swept to zero across README, PRIVACY_POLICY.md, ACCESSIBILITY.md, and the website.

- Duration binning is the pure `computeDurationBins` (`lib/birdingStats.ts`): range-guarded to [0, 1440] minutes with a structural 33-bin clamp, so one corrupt CSV cell can no longer build an unbounded bin ladder (security-reviewed, remediated, re-verified to PASSED). The Effort tile's average is deliberately untouched; the two averages can differ only when a corrupt out-of-range cell exists.
- The observer-count change is locked by a regression test proven to fail on the old `>= 5` clamp.
- No new data, providers, network calls, or settings anywhere in the bundle; everything outside the two stats is copy-only.

### Disable Embedded Media (complete — July 2026, v0.5.72)

Settings now has an off-by-default **Disable embedded media** preference for
people who do not want unreliable Macaulay Library players to load. The choice
persists through SnowRaven's existing cross-platform settings storage and
applies immediately. When enabled, Species Detail Recent Media and expanded
Named Birds media areas replace their players with “Embedded media is disabled
in Settings.” while keeping local formats, dates, checklist links, direct
Macaulay Library links, counts, comments, and analytics available.

Embed eligibility stays closed until the saved preference hydrates, so a
disabled installation never flashes or requests an iframe at startup.
`MediaFrame` remains the app's sole iframe constructor and requires the shared
App-root eligibility gate; future embedded-media surfaces inherit that same
contract. The release also moved the audited backend runtime to exact pins for
FastAPI 0.141.1, Starlette 1.3.1, python-multipart 0.0.32, and python-dotenv
1.2.2, resolving the reachable dependency advisories without adding a backend
feature or data-model change.

### Weather Backlog (complete — July 2026, v0.5.67)

A "List checklists with no weather blocks" section at the bottom of the Weather tab (below the unchanged single-checklist lookup and Current/Predict panel) that turns the one-at-a-time weather lookup into a work-down-my-backlog workflow: it lists the user's most-recent checklists whose comment carries no recognized weather block (SnowRaven's or RainCrow's, via the shipped `hasWeatherBlock` detector) — newest first, built entirely from the already-loaded backup with no lookups needed to build the list. Each row shows date, location, species count, protocol, effort, and completeness, and offers three actions: open the checklist on eBird, open its comment/edit page, and "Copy weather & go" — which looks up that checklist's weather, copies it (weather only) to the clipboard, and opens the comment page ready to paste; on a failed lookup the row says why (offline / missing-or-invalid key with a Settings nudge / generic error) and the comment page is never opened, so the user never lands on eBird with nothing on their clipboard. The default list shows only complete, non-incidental checklists; a toggle widens it to also include incomplete and incidental ones (chip-marked so a wider list is unambiguous), and the list pages in 100s.

### Named Birds Media (complete — July 2026, v0.5.66)

On the Named Birds tab, each named individual's expanded row shows that individual's own Macaulay Library media (photo/audio/video) below its sightings map, each item labeled with its capture date and a link to the checklist it came from. A named bird's media is matched from the `[name:…]` tag by a per-asset precedence: the asset's OWN comment (`caption` + `mediaNotes`) decides when it carries a tag, and only an untagged asset falls back to the eBird observation comment for that species on that checklist — so a birder who names an individual in the species comment (the ordinary way) still gets their media, while captioning one asset overrides the broader tag for that asset alone. Deliberately NOT the checklist comment or the checklist the asset came from — those name the bird but don't point at any particular asset. The join is keyed by the same name-plus-species key the tab uses for named birds, so it never cross-attributes. Items render as on-demand Macaulay Library inline embeds (`macaulaylibrary.org/asset/<id>/embed`, identical for all three media types) in a bounded initial batch of 6 with a keyboard-accessible "Show more"; when offline, when an embed can't load, or while Cornell's Anubis bot gate in front of `macaulaylibrary.org` is up (detected out-of-band, since the gate's interstitial is a 200 that a cross-origin frame cannot report as a failure — no frame is mounted at all while it is up), each item degrades to a placeholder plus a "View on Macaulay Library" link-out while always keeping its date and checklist link — never a broken frame. Matching, dates, and checklist links are fully offline (computed from the already-loaded ML export); only the embed player needs the network. This is the first inline third-party media fetch on the Named Birds tab (previously the tab only linked out), disclosed in `PRIVACY_POLICY.md`.

### Calendar (complete — July 2026, v0.5.68)

A Calendar tab that renders the birder's own eBird export as a heatmap of their birding year — each day shaded by one of three metrics (species seen, checklists, or total individuals recorded that day), per year or all years combined (the all-years grid aligns its weekday columns to the current year, with Feb 29 always present) — with a Compact / Large view toggle that governs at every width including on a phone (Compact shows the twelve full month grids as clean count-only cells; Large shows the whole year as month thumbnails whose day cells carry a small day-of-month number; a day tap opens the same day popup from either), a per-day popup that lists that day's checklists with each row's start time, location (plain text), species count, and eBird link, a colorblind crosshatch texture mode, an optional include-spuh/slash/hybrid refinement, and a searchable type-to-find species filter that narrows the whole calendar to one species (by normalized name, folding forms). Frontend-only, offline, and zero-network — computed entirely from the already-loaded backup.

### County Completeness — a third county-shading metric on the Map Explorer (complete — July 2026, v0.5.54)

Alongside Species and Checklists, the county overlay's shade control (relabeled **"Shade counties"**, D-401) gains **Completeness**: each US county the user has birded is shaded by their countable species recorded there (spuh/slash/hybrid excluded, subspecies folded to species) divided by everything ever reported to eBird for that county, all-time, on ten FIXED 0–100% bands over the existing green ramp — the same shade always means the same completeness, so the legend reads as an absolute scale ("1–10%" … "91–100%"). The county popup gains a progress bar ("X of Y species · Z%" with the countable-species caption, count row retained per D-402), the user's five newest new-in-county species (backup-derived — works offline in every popup state), and a five-species targets list (the county's eBird list minus the user's, taxonomic-order floor — no public frequency API); never-birded counties stay plain outlines with a one-click **Load completeness** scout fetch, and a fetched 0% county stays unshaded. This is the first county-shading mode that needs a network connection and the user's eBird key — disclosed at the point of use and degrading through the standard offline / no-key / server-error states; per-county results persist 30 days on-device, so cached counties still shade offline and pan-backs make no new eBird calls. Eager fetching is bounded to birded, region-resolvable counties in view through a pool of four — never a bulk sweep. Use Textures, atlas mutual exclusion, basemap desaturation, and the keyboard "Counties in view" list (showing "X/Y · Z%" or an honest status) all work with it; the Species/Checklists quantile path is byte-identical.

- **New route `GET /map/county-species`** (eBird `product/spplist`) with dual-transport parity (`backend/routers/map.py` ↔ `lib/tauri/mapService.ts` `getCountySpecies`); the denominator's taxonomy collapse (reportAs → species parent, non-countables dropped, first-seen dedupe) runs on each transport's taxonomy home (`routers/taxonomy.py` `collapse_to_species_list` ↔ `taxonomyService.collapseToSpeciesList`, kept in lockstep). Deliberately NOT in `CACHED_GET_PATHS` — the 30-day `lib/countyCompletenessCache.ts` (storage-seam document, TTL-gated reads, per-entry shape validation, size caps, in-flight dedupe, errors never cached, offline stale-reads) is the single caching layer.
- **Math/policy split:** pure band/percent/targets logic in `lib/countyCompleteness.ts` (fixed (lo, hi] bands parallel to the untouched quantile `countyShading.ts`; ratio clamped ≤100%, rounds-to-100 displays 99 unless truly complete); fetch policy in the `lib/useCountyCompleteness.ts` controller hook, handed to `CountyLayer` as a render-safe view object. Zero new tokens; all names render through `<BirdName>`.
- **Verification:** frontend 1238 / backend 163 tests, QA 36/36 criteria passed with zero fixes, security PASSED WITH NOTES (both Low findings closed before ship: the pydantic `[0-9]` twin-parity fix + cache load-path validation); entry-chunk guard extended and green; `PRIVACY_POLICY.md`'s eBird bullet now names the county species-list call; HELP/README/website updated. Shipped as v0.5.54 (notarized universal macOS DMG + signed Windows installer, headless `CI=true` release from Hephaestus).

### Colorblind-accessible county shading — a "Use Textures" mode (complete — June 2026, v0.5.51)

When the Map Explorer county overlay is shaded, an opt-in **Use Textures** toggle (under the Species / Checklists switch) paints each county's count tier as a crosshatch whose DENSITY rises with the tier — an open lattice for the lightest counties through a tight crosshatch for the most-recorded — instead of relying on the single-hue green ramp alone, so the map reads for colorblind / low-vision users without depending on hue or brightness. It brings the county overlay to parity with the breeding-atlas overlay's existing Use Textures mode (v0.5.2). Off by default (the normal color view is unchanged until opt-in), session-only (resets on relaunch), and theme-aware; the legend and the keyboard "Counties in view" list show the same density steps, and the patterns keep working across the Species ⇄ Checklists metric switch. Frontend-only; no new network calls, providers, bundled data, or telemetry; privacy unchanged.

- **One density-coded crosshatch, not ten motifs.** `lib/countyTextures.ts` (the county analogue of `lib/atlasTextures.ts`) bakes canvas `ImageData` sprites `sr-county-hatch-1..10` from one 45°/135° crosshatch: line SPACING carries tiers 1–6, line WEIGHT takes over 7–10 where the gap can't shrink further (`HATCH` table {gapPx 20→5, lineWidthPx 0.75→1.30}; tier 10 ~60% ink — never solid, tier 1 ~10% open-lattice floor). A faint 0.12 tint underlay + 0.80 strokes both read `--sr-county-N-rgb` at generation, so the texture mode keeps a residual color cue.
- **`CountyLayer.tsx`** gained a `useTextures` prop + a sprite-registration effect extending the existing `themeRev` MutationObserver (all 10 sprites registered unconditionally — no `isStyleLoaded` gate; `styleimagemissing` net scoped to its own ids via `countyHatchTierForImage`); `useHatch = useTextures && shadeOn` switches the paint to `fill-pattern` else the unchanged `fill-color`. The fill layer id stays `sr-county-fill` in both branches (load-bearing for the heatmap z-order + `BasemapDesaturation`).
- **Legend + "Counties in view" swatch** swap to a new `CountyDensitySwatch` (`map/MapSidebarUI.tsx`), its geometry imported from `countyHatchSpec` so the legend can't drift from the map.
- **Guard:** new `lib/countyTextures.test.ts` (strict-monotonic + adjacency ≥1.12 on the pure `countyHatchDensity(tier)=lineWidthPx/gapPx` proxy) — the density analogue of the unchanged `countyContrast.test.ts` (the color-ramp guard). Full CI mirror green (1173/1173 vitest); QA PASSED all 24 criteria; security CLEAN PASS. Source shipped as v0.5.51; the binary release runs on the Mac.

### County Lines & Shading on the Map Explorer (complete — June 2026, v0.5.46)

A Map Explorer overlay that draws US county boundaries over the current view and, optionally, shades each county by how many species (or how many records) the user has recorded there — a "county life list" choropleth built entirely from the already-loaded eBird backup. A two-level control mirrors the breeding-atlas overlay: "County lines" draws the boundaries and county names, and a "Shade by species seen" sub-toggle adds a data-driven green choropleth (quantile breaks over the user's own non-zero county counts) with a legend and a Species/Records metric switch. Clicking a county opens a popup with its name, state, the user's species and checklist counts, and a contextual top-3 (top species in Species mode, top locations in Records mode), with the county name linking to its eBird region page when a valid code is available; counties with no records render as plain outlines. The overlay makes zero network calls once its bundled, public-domain US Census boundary geometry loads (an on-demand chunk, off the entry chunk), works fully offline, and renders legibly in both themes with a keyboard-accessible "counties in view" route. US-only for v1. Only one shading ramp is active at a time — turning on county shading clears the atlas breeding shading and vice-versa (the boundary lines may still both show) — and while a ramp is active the basemap's land mutes to grey (raster bases desaturate, the heatmap dims beneath the ramp) so the active choropleth stands out. The "… in view" list is the last section in every Map Explorer panel.

### Offline support (complete — June 2026, v0.5.45)

SnowRaven works with a weak connection or none. **Maps:** once a map has loaded online once, it mounts offline with the base map's place labels and draws the user's own data layers (sightings, heatmap, atlas blocks, county lines and shading) — the tuned vector style is persisted via the storage seam and seeded *before* any network fetch (`persistedStyle.ts` + `SnowMap` seed-before-fetch; coalesced one-read-per-key). An area already panned over often redraws from the WebView's own tile cache; street-level detail somewhere new waits for a connection. There is no region download and no tile pre-caching — SnowRaven never downloads map tiles in the background. **Replay:** a checklist's weather/tide loaded online once re-shows offline with an "last loaded result" cue (`replayStore.ts`, opt-in per call-site via `transport.getReplayable`, separate from the 90s `networkCache`). **Taxonomy offline:** a bundled eBird taxonomy snapshot (`src/assets/ebird-taxonomy.json` + `backend/staticdata/ebird_taxonomy.json`) is the floor so favicons/sort/`reportAs` resolve on a first-ever cold start in both runtimes. **Messaging:** three honest, distinct states — offline / no-key / server-error — everywhere a live feature runs, plus a web/Pi "local server isn't running" distinction (FR-39a) and the update check no longer falsely reports "up to date" when it can't reach the server. **Foundation:** a new generic `GET/POST/DELETE /settings/{key}` store (web/Pi) with a key-shape guard + reserved-key guard, mirrored on the storage seam. Release-time map assets (glyph/sprite capture) are generated on the Mac — see `pipeline/offline-support/release-runbook.md`.

### Drop a pin on the map to set the search center (complete — June 2026, v0.5.43)

The Map Explorer's Hotspots, Nearby Lifers, and Media Targets views gained a draggable
center pin. Right-click (desktop) or long-press (touch) anywhere on the map drops a center
pin there and re-runs that view's search for the spot; dragging the pin fine-tunes (re-running
on release). It works alongside the existing place-name search, "Use my location", and
coordinate entry — all drive the same shared center — and is session-only (it doesn't change
the saved Default Location). Its popup also carries the Pin Share copy action, so the one pin
both sets the search center and shares the spot. New `CenterPinDropper` (binds `map.on('contextmenu')` + a
hand-rolled touch long-press timer, cancelled on any pan/zoom and deduped against a
synthesized post-long-press `contextmenu`) and `CenterPin` (a draggable DOM `<Marker>` that
replaces the detected-location dot while shown) in `components/map/MapControls.tsx`; an
`applyCenter` helper in `MapExplorer.tsx`. The gestures are distinct from left-click, so
opening a result pin's popup is unchanged. 8 new `CenterPinDropper` tests.

### Initial-load optimization, Checklists tab-order tweak, and a clearer self-host audit notice (complete — June 2026, v0.5.42)

A bundled Improve run. The default tab order now places Checklists between Breeding Codes and List Comparer (`DEFAULT_TAB_ORDER`, `lib/tabLayout.ts`; defaults-only, saved layouts preserved). Initial load is lighter: the maplibre map library (~273 KB gzip) no longer loads on first paint — `NamedBirdRow`'s per-row `SightingsMap` is now `React.lazy` + `Suspense` (it was the sole static edge pulling maplibre into the entry chunk), and the List Comparer and Checklists tabs are lazy too, all warmed via App's `requestIdleCallback` warmer; the entry chunk dropped 331→218 KB (84.5→54 KB gz) and `vite`'s `chunkSizeWarningLimit` was raised to 1100. No behavior change to any map or tab. Separately, `npm audit fix` cleared two dev-only advisories (production dependency tree unchanged) and `README.md`/`update.sh` now explain that the install-time `npm` audit counts dev/build tooling that never ships.

### Updated default order for tabs, the List Comparer, and the Map Explorer modes (complete — June 2026, v0.5.41)

The out-of-the-box ordering defaults were refreshed to match day-to-day use. Default tab order is now Weather, Statistics, Species Detail, Map Explorer, Checklists, Multimedia, Breeding Codes, List Comparer, Named Birds, with Settings pinned last (`DEFAULT_TAB_ORDER`, `lib/tabLayout.ts`). The List Comparer opens on checklist comparison by default (Checklists on the left of its mode selector, `components/ListComparer.tsx`). The Map Explorer mode buttons show Nearby Lifers before Media Targets (`lib/mapViewModes.ts` + `MapExplorer.tsx`). Defaults/normalization only — persistence is unchanged (the `storage` seam), saved custom layouts are preserved, and `parseLayout` still appends any missing default tab to an existing layout. Frontend-only; no new capability.

### Public-hotspot links — a location name links to eBird when (and only when) it is a public hotspot (complete — June 2026, v0.5.40)

A location NAME becomes a link to `ebird.org/hotspot/{locId}` only when the location is a PUBLIC eBird hotspot; personal locations stay plain text. Applied app-wide wherever a location name appears: Species Detail (top locations + comments), Statistics (geo top-locations, notable-outings, biggest-counts, first/most-recent cards), Checklists (the list + both comment-search boxes), Named Birds reports, and Frivolous Rainbow first-sightings. Built on eBird data the app already uses; no new providers; privacy unchanged. Also fixes a latent bug where a few spots linked personal locations to dead (404) eBird hotspot pages (id-format-only gating).

- **Determination:** the CSV carries no hotspot flag, so classify by membership in a region-scoped Set (`lib/hotspotSet.ts`) built from eBird's `ref/hotspot/{regionCode}` — one cached fetch per distinct `stateProvince` region (typically 1–3), unioned → O(1) `isPublicHotspot`. New backend route `GET /map/hotspot-region` + `lib/tauri/mapService.ts` `getHotspotRegion` (dual-transport parity); `/map/hotspot-region` is in `CACHED_GET_PATHS`. No key / a failed fetch → empty Set → plain text (graceful).
- **Component + hook:** `components/HotspotLink.tsx` (wraps `OutboundLink`, reuses the `Open {name} on eBird (opens in a new tab)` name formula, `compact` + `truncate` modes, link color forced `--sr-accent`, `LOCATION_ID_RE` shape guard so a junk/personal id is plain — never a 404 link). Parameterless `useHotspotSet()` loads the backup via `observationsCache` and builds through the region-keyed `getHotspotSet` cache; lists call it once in the parent and pass `isHotspot` down. MapExplorer keeps its own `pin.kind` (authoritative from `ref/hotspot/geo`), not the Set.
- **Staleness fix (two HIGH review findings):** a Set built empty (no key yet / transient outage) or a backup swap to a new region wouldn't refresh on a persistent tab. Fixed with a module-level invalidation signal — `invalidateHotspotSet()` (drops cache, bumps an epoch, notifies subscribers) fired from Settings' four eBird file/key save/delete points; `useHotspotSet` subscribes via `useSyncExternalStore`. No per-tab version threading.
- **Verification:** frontend 967 / backend 133 tests (new: `hotspotSet.test.ts` incl. invalidation/refetch, `HotspotLink.test.tsx`, `useHotspotSet.test.tsx`, transport cache, backend route). A 4-dimension adversarial review (security / correctness / a11y / parity-tests) ran; 10 findings confirmed, 2 HIGH fixed, the rest low/nit (one — `computeLocationsSorted` name-keying — deferred as a Set-gated, never-404 known minor; see DECISIONS).

### Five more Frivolous Lists, incl. grouped (sub-category) collections (complete — June 2026, v0.5.39)

Five new self-completing collections at the bottom of the Statistics tab, extending v0.5.36: three flat — **Phoebe Phanatic** (3), **Scrub Jay All Day** (4), **Crow Pro / Raven Maven** (6) — checked off like Avian American, and two **grouped** lists that show the user's sub-categories as labeled sub-groups within the card: **Heron is Carin' (and Egrets too)** (12 species across True Herons / Egrets / Night-Herons / Bitterns) and **Best of the Crest** (38 species across 16 "crested & crowned" sub-groups). Frontend-only; no new providers; privacy unchanged.

- **`lib/frivolousLists.ts`:** new flat arrays + `ListGroup[]` grouped consts (`HERON_IS_CARIN`, `BEST_OF_THE_CREST`); new `GroupedListResult` + `groupedList()` (whole-list recorded/total/complete aggregated across the sub-groups). Names are current canonical eBird, verified via the live `/taxonomy/codes`; 3 renames applied (Western Cattle-Egret; Black-crowned / Yellow-crowned Night Heron).
- **`components/FrivolousListsSections.tsx`:** shared `NameItems` + `ListHead`; new `GroupedNameList` (a sub-group label over each check-off grid, one whole-list badge). **`BirdingStats.tsx`** taxonomy-codes batch extended (flat + grouped flattened) so unseen rows get favicons.
- 6 new unit tests (flat + grouped compute, the corrected names, the shared-species case).

### Statistics media-card behavior links + corrected coverage count (complete — June 2026, v0.5.38)

On the Statistics → Media card, each behavior in the "Behaviors documented" list now links to the Macaulay Library catalog filtered to that behavior across the user's own media (`media.ebird.org/catalog?userId=<id>&tag=<slug>`), and each breeding behavior (feeding young, carrying food, nest building, courtship/display, song) is listed and linked on its own below the breeding tier tiles. The tab's most-photographed / most-recorded / most-filmed links were consolidated onto the same `media.ebird.org/catalog` host. Frontend-only; no new providers; privacy unchanged.

- **Tag-slug map** in `lib/mediaStats.ts` (`BEHAVIOR_TAG_SLUG` + `behaviorTagSlug`): a fixed, live-verified label→catalog-tag lookup (slugs are not derivable from labels — `Flying`→`flying_flight`, `Mechanical Sound`→`non_vocal`); unmapped behaviors render plain. URL builder `mlBehaviorCatalogUrl` in `lib/statsFormat.ts` (now also home to the shared `ML_CATALOG_BASE`); links render through `BarRow`'s new `href`/`linkLabel` (the count carries the link; the accessible name leads with the count) and the shared `OutboundLink`.
- **Breeding links + dedup** in `components/MediaStatsSections.tsx`: breeding behaviors (via the now-exported `BREEDING_BEHAVIOR_TIER`) get their own linked group; gated on a userId, and removed from the top behaviors list when shown so each appears once.
- **Coverage fix:** the "X of N life-list species documented with media" denominator now excludes spuh/slash/hybrid via the new shared `isNonCountableSpecies` (`lib/speciesUtils.ts`), correcting an overcount (it had counted every distinct observed name). Isolated to `computeMediaStats`; `backboneNames` (Species-Detail linking) untouched.

### Frivolous Lists — three self-completing collections on the Statistics page (complete — June 2026, v0.5.36)

A new section at the bottom of the Statistics tab, just for fun: three collections that fill in from the user's own life list, computed entirely from the already-loaded eBird backup (no backend, no new providers, privacy unchanged). **Avian American** (22 "American …" species) and **California Dreamer** (7 "California …" species) check off each recorded species with a `recorded / total` count and a completion badge; **Rainbow Warrior** shows, for each rainbow color (red→violet), the earliest-first-seen bird whose name contains that color, with that sighting's date + location and a checklist link, a blank for colors not yet found, and a badge at 7/7.

- **Pure logic in `frontend/src/lib/frivolousLists.ts`** (`computeFrivolousLists`, + 21-case vitest): hardcoded name lists; whole-word color matching (`/\bCOLOR\b/i`, non-global so `.test()` is stateless); first-seen per normalized species (date, then submissionId); spuh/slash/" x " hybrids excluded. Computed from the **all-time** observation set, independent of the tab's "include spuh" toggle.
- **Rainbow assignment is a lexicographically-greedy maximum bipartite matching** (colors ↔ species): a distinct bird per color wherever possible (avoid doubles); among max-distinct assignments the higher-priority (spectrum-order) color keeps its earliest bird; a bird fills two colors only when unavoidable, and then it shows that color's earliest. Verified by a brute-force oracle (see DECISIONS).
- **Component `frontend/src/components/FrivolousListsSections.tsx`** (mirrors `MediaStatsSections`), rendered as the final `SectionCard` in `BirdingStats.tsx` + appended to the section jump-nav. Names via `<BirdName>`, Rainbow dates via `<ChecklistLink>`; checkmarks/badges reuse the milestone tokens; seven new `--sr-rainbow-*` swatch tokens (both themes).
- **Favicons on not-yet-seen birds:** the 29 hardcoded names are added to the existing `/taxonomy/codes` batch in `BirdingStats.tsx` (resolved by common name in both transports, reading the live taxonomy so recent splits like American Goshawk resolve), so unseen rows show the eBird/BoW favicons — still no Species Detail link.

### Weather & Tide: Current & Predict (complete — June 2026, v0.5.34)

Two buttons at the bottom of the Weather tab that look *forward* instead of back, alongside the unchanged checklist lookup. **Current** returns live weather and tide for the user's device location in one tap; **Predict** takes a place (name search or a draggable map pin) plus a date and time and returns the forecast weather and predicted tide for that single moment. Weather reaches ~8 days (hour-by-hour ≤48h, then a clearly-labeled daily summary); tide runs much further (astronomical predictions), so a moment past the weather window still shows tide with an honest "no forecast this far out" note. Each result is a readable at-a-glance summary with the existing copy-ready block behind a disclosure. No new providers — reuses OpenWeather (the base One Call 3.0 endpoint also serves current + forecast, confirmed live), NOAA CO-OPS (future predictions work unchanged), Nominatim, and the device-location seam.

- **One base OpenWeather call → tiered slice.** `backend/services/forecast.py` ↔ `frontend/src/lib/forecastSlice.ts` (duplicated TS/Python with parity tests over identical fixtures, like the moon-phase port): `pick_forecast_slice` chooses current / hourly (≤48h) / daily (48h–8d) / out-of-range (>8d); the chosen slice is adapted into the timemachine `{data:[hour]}` shape so the EXISTING `format_weather`/`formatWeather` builds the copy block (byte-consistent). Daily passes two synthetic temp points (min,max) so the block reads as a low–high range.
- **New routes bypass the checklist:** `GET /weather/at?lat&lng&dt?` and `GET /tide/at?lat&lng&dt?&force?`, declared BEFORE the `{checklist_id}` routes (and matched first in `lib/transport.ts`) so "at" isn't captured as an id. Tide reuses the whole existing pipeline (nearest_station/classify/NOAA/compute/format); responses carry a structured `summary`/`reading` for the readable view alongside `formatted`. The existing checklist routes/formatters are byte-unchanged.
- **Current uses the LOCATION's timezone**, not the device's: `/tide/at`'s `dt` is optional (defaults to location-tz now, server-side) and the label is formatted from the tz the weather response returns. UI in `components/WeatherForecastPanel.tsx` (+ lazy `PredictMap.tsx` so maplibre stays out of first paint). Frontend 889 / backend 131 tests; a 4-dimension adversarial review (10 findings) folded in (coordinate-input validation, tide-override race guard + loading/error, a11y live-region/roles/bounds). PRIVACY_POLICY updated (OpenWeather/NOAA now also live/forecast; "Current" sends device coords to them).

### Nearby Lifers Map (complete — June 2026, v0.5.35)

A new Map Explorer section that maps *where* species the user has never recorded were reported recently near a chosen point — not just which ones. The old flat **Nearby Lifers** list (the "Other Statistics → Nemesis Birds" block on the Statistics tab) was removed and rebuilt here as a fourth map view alongside My Sightings, Hotspots, and Media Targets. Each spot is a labeled pin — the species name, or "{n} species" where several lifers were reported at one place — colored by how recently it was seen, with an always-on locator dot at its exact coordinate and a per-panel **Marker style: Labels | Dots** toggle (shared with Media Targets) that collapses the chips to bare dots for a clean where-are-they overview; clicking a pin (or a row in the panel list) shows the lifers at that spot with their dates and eBird checklist links. It opens on the saved default location and offers the same controls as the other sections (use my location, place-name search, radius) plus a new **Time Range** filter (last day / last week / last 30 days). Lifer names render plain + favicons — no Species Detail link, since they are not in the user's recorded data.

- **Built entirely on data the app already uses — no new providers, no privacy change.** The recent-observations endpoint is reused via `/map/recent-obs` with its species-code filter made optional, so a single call returns recent obs across all species near the point; the client filters that set against the user's life list to keep only true lifers (the personal backbone from the loaded backup), then groups them by location for the labeled pins. The now-dead `/stats/nemesis` route was removed.
- **The Time Range filter is shared with Media Targets.** The same last day / last week / last 30 days control was added to the existing Media Targets section so the two panels behave the same way.
- **Key files:** `frontend/src/components/map/NearbyLiferMarkers.tsx` (the labeled pins + popup), `frontend/src/lib/nearbyLifers.ts` (the life-list filter + per-location grouping), `frontend/src/components/MapExplorer.tsx` (the new view mode, sidebar list, and shared Time Range control), `backend/routers/map.py` (codes-optional `/map/recent-obs`; `/stats/nemesis` retired).

### Multimedia sex & age filters (complete — June 2026, v0.5.33)

The Multimedia tab gained two dropdown filters — Sex (Male/Female) and Age (Juvenile/Immature/Adult) — that slice the per-species media by life stage and sex, built on the per-asset Age/Sex data already parsed for the media stats (`lib/mediaStats.ts`). They compose with the existing media and county/date filters; each species' photo/audio/video counts and the "X of N species" total reflect the active facet, zero-match species drop out, and the Macaulay Library links carry the filter. Matching is exact-combo: a single facet is broad (any female, any juvenile); both together require one individual that is both (a juvenile female), which the ML link also honors. Implemented as one "substitution point" — project each species' catalog ids to the facet-matching subset and every downstream count/filter flows from it; no facet = unchanged. Frontend-only; the Multimedia ML catalog links moved to `media.ebird.org/catalog` (the base that accepts `&age`/`&sex`).

### Accessibility — a WCAG 2.1 AA pass across the whole app (complete — June 2026, v0.5.31)

A comprehensive accessibility pass that makes the existing app perceivable,
operable, and honestly documented for keyboard and assistive-technology users. No
new user-facing capability — every change makes a function that already existed
work for more people. Driven by a four-phase, ~160-agent audit (inventory →
12-dimension parallel audit including *computed* contrast over every `--sr-*`
token pair used together in both themes and an axe-core runtime scan →
adversarial verification → completeness sweep): 107 confirmed findings against
288 verified passes, all fixed, with the published statement made true.

What it covers:

- **Accessible names.** Every filter `<select>`, date input, and search box that
  relied on a placeholder or nearby caption now carries an explicit `aria-label`
  (the `Checklists.tsx` pattern, propagated app-wide). The Settings segmented
  choices (theme, text size, date format) are real keyboard-operable radio groups.
- **Contrast.** A full `--sr-*` retune in both themes plus a typed token system —
  `--sr-tier-N-fg` (text on a tier tint), `--sr-tier-N-text` (text on a solid
  tier fill), `--sr-map-target-*-text`, `--sr-border-input`, `--sr-milestone-*`,
  `--sr-rank-pin-*`, and the theme-aware `--sr-on-chart-blue-dark`. Text, buttons,
  links, popups, map pins, milestone/rank markers, and breeding badges/pills now
  meet AA (4.5:1 text, 3:1 non-text) in light and dark. Chart figures read from a
  label beside the bar; the one remaining in-bar percentage (the
  complete-checklists meter) uses a per-theme text color that passes on its fill.
- **Keyboard & focus.** A "Skip to main content" link leads the tab order; DOM map
  markers became real `<button>`s (`neutralizeMarkerWrapper`); the Settings tab
  reorder list gained Move up / Move down buttons as a drag alternative; the Map
  Explorer mobile filter panel traps focus and restores it to the Filters button
  on every close path (Escape, Close, backdrop) via one `closeSidebar`, and
  Escape also exits map fullscreen to the toggle; in-page "jump to" links move
  focus to the destination; bird-name links show the focus ring again.
- **Announcements.** Result counts, loading states, and inline errors are polite
  live regions or alerts; the over-announcing Weather panel was quieted; the
  updater shows a progressbar; charts keep their image-role text summaries and
  decorative flourishes stay hidden.
- **Maps.** `SegControl` carries `aria-pressed`; the Media Targets "Nearest
  Targets" list became a viewport-scoped **Targets in view** keyboard list; and
  the atlas overlay gained a self-contained "Atlas blocks in view" disclosure
  panel in `AtlasLayer.tsx` (so the keyboard route works on every map that mounts
  the atlas, not just the Map Explorer).
- **Structure.** Landmarks and a heading outline; marker-mirroring lists use real
  list semantics; collapsed filter panels are made `inert`.
- The "open checklist on eBird" affordance was unified into one shared
  `components/ChecklistLink.tsx` (consistent identification, `SUBMISSION_ID_RE`
  guard kept), adopted app-wide in v0.5.32 with a `compact` icon-only mode and a
  label-aware accessible name; a companion `components/OutboundLink.tsx` gives every
  other external link an "(opens in a new tab)" cue. `ACCESSIBILITY.md` was
  rewritten to match the shipped code; the cross-cutting Known Exceptions it
  carried (uniform checklist links, the new-tab announcement, the
  Southern-Hemisphere moon phase) were all closed by v0.5.32 — the moon phase had
  in fact already shipped in v0.5.28. See DECISIONS.md for the token-naming
  contract, the single-close-path focus-restore rule, and the two false published
  claims the verification loop caught.

### Checklists — search-and-browse home for whole outings (complete — June 2026, v0.5.27)

A new top-level **Checklists** tab with three sections. **Checklist Comments**:
a searchable box of every checklist-level comment (one entry per checklist,
10-first with "Show all", Newest/Oldest, case-insensitive substring filter,
date → eBird checklist link gated on `SUBMISSION_ID_RE`). **Species Comments**:
the same box across ALL species' observation notes at once, each entry led by
`<BirdName>` (opens Species Detail). **All Checklists**: every outing with
date/time/location/protocol-name/effort/species+individual counts, badge
indicators (species comments, media by type, breeding codes), and the checklist
comment in the quoted-block style — under composable AND filters: cycling
tri-state pills (one pill cycles any → has → doesn't-have) for checklist
comment / species comments / media / breeding codes / weather block / tide
block, a Complete/Incomplete tri-state, Photo/Audio/Video pills (only with the
ML export; "has media" works from the backup's catalog ids alone), protocol +
county selects, and a date range. House count label / All-reset / accent
filter-strip conventions throughout.

A tab-wide **"Show weather & tide blocks"** ToggleSwitch (default hidden)
governs all three sections: hidden blocks are stripped from display AND
excluded from search ("search matches what you see"), and a comment that is
empty after stripping counts as having no comment (boxes and filters alike);
the has-weather/has-tide *filter pills* read the raw comment regardless.
Stripping is `stripWeatherTideBlocks()` in `lib/commentBlocks.ts` — SPAN-based,
emoji header → end of attribution link, never line-based (eBird's CSV export
collapses a pasted block's newlines into spaces, so prose shares the block's
line and can continue after the attribution). Handles real export shapes:
moon-phase-emoji night blocks (RainCrow), bare-name attributions,
attribution-less blocks (span ends after the last labeled value), and
emoji-less condition segments (absorbed only when short and not a finished
sentence). Pinned by real-formatter-fixture regression tests and verified
against the user's full backup (308 block-bearing comments, 0 residue).

Pure logic in `lib/checklistsTab.ts` (row building, flags, filters, sort —
tested like `mediaComments.ts`); tab in `components/Checklists.tsx`; the
comparer's safe comment renderer lifted to shared `components/CommentText.tsx`
(`raw` = entity-encoded input, `decoded` prop for pre-decoded input — never
double-decode). Registered as `checklists` in `lib/tabLayout.ts` (auto-appended
visibly to saved layouts by `parseLayout`). Security review (4-lens,
adversarially verified) led to three in-stage fixes: quadratic strip made
linear (precomputed match positions + bounded `<a>` arms; 414KB hostile spam
4.1s → ~5ms), a stale shared-regex `lastIndex` leak in the strip fallback
(matchAll clones lastIndex), and the double entity-decode; plus
`PRIVACY_POLICY.md` now discloses the Cornell Lab asset loads (Macaulay
embeds + eBird/Birds-of-the-World link icons — pre-existing app-wide
behavior). Entirely from the parse-once caches; no backend changes.

### Named Birds — track individual birds over time (complete — June 2026, v0.5.23)

Tracks individual birds the user names in eBird species comments via `[name:…]`
tags (e.g. `[name:Winky]`, `[name:one-leg-pete]`). A new **Named Birds** tab
lists each named individual (name, species, first/last seen with the elapsed span
between them — e.g. "1 yr. 2 mos." — and sighting count),
sortable by name/species/last-seen, each expanding to its checklists (date, eBird
checklist link, the species comment). The same per-species view appears as a
**Named Individuals** section on Species Detail. Keyed by name + species (same
name on two species = two birds); name match is case-insensitive; subspecies fold
to the parent; one sighting per checklist (deduped by submission id). Pure logic
in `lib/namedBirds.ts`; shared `components/NamedBirdsTable.tsx`; tab in
`components/NamedBirds.tsx`; wired via `lib/tabLayout.ts` (`named-birds`, which
`parseLayout` auto-appends to existing saved layouts) + `App.tsx`. Computed
offline from the eBird backup. The `[name:…]` parser is length-bounded (ReDoS-safe).
- **(v0.5.26)** Legibility + map upgrade. Sort is now four options — Name
  (Individual) / Alphabetical / Taxonomic / Last Seen (taxonomic order reuses the
  `/taxonomy/codes` `orders` already fetched for favicons; Species Detail's
  "Named Individuals" section keeps its reduced Name + Last Seen set); each report
  now shows its location between the date and the checklist link; each sighting's
  comment sits in its own quoted block (new `--sr-quote-bg`/`--sr-quote-border`
  tokens, both themes); and each expanded individual gets a **per-individual
  sightings map**. The map is a new shared `components/SightingsMap.tsx` (pins +
  popup + bounds-fit) that Species Detail's pins map now also uses;
  `location`/`latitude`/`longitude` were threaded onto `NamedSighting` (no parser
  change). Contrast lifted off the weakest tokens.
- **(v0.5.66)** Each expanded individual now also shows its own Macaulay Library
  media below the map — see the **Named Birds Media** entry at the top of this file.

### Richer media statistics — Statistics → Media card (complete — June 2026, v0.5.20)

The Media card now reads far more of the ML export and breaks the archive down
several ways, each section gated on whether the export carries the relevant
annotations (computed offline):

- **At a glance** — totals, photo/audio/video split, species documented, busiest
  media day, longest streak, collection span.
- **Documentation coverage** — % of the life list captured with any media / photo
  / audio / video.
- **Photos Tagged With Age or Sex** — age-class and sex mixes (per
  individual, Unknown shown honestly), age coverage by species, only-adults count.
- **Behaviors** — distinct count + top behaviors + media-backed breeding tiers.
- **When captured** — time-of-day distribution by format.
- New `lib/mediaStats.ts` (parse/aggregate) + `components/MediaStatsSections.tsx`;
  `parseMLExport` extended (Age/Sex, Behaviors, Time, Year/Month, ratings —
  additive + guarded). Demo-data generator extended so the showcase reflects it.
- **(v0.5.22)** Removed the Format-coverage breakdown (redundant with Documentation
  coverage) and the Community-ratings section (still computed in `mediaStats`, just
  not rendered); renamed Age & sex → **Photos Tagged With Age or Sex** (donuts
  "Age"/"Sex"); added a separator above the Top-N rankings.
- **(v0.5.24)** Fixed **At a glance** alignment by moving the busiest-day, longest-
  streak, and span facts out of the StatCell grid (a `sub`-line tile is a line
  taller than a plain one, and in the `auto-fit` grid that knocked the row out of
  alignment) into a centered caption (`atAGlanceFacts`). Reworked **Age coverage by
  species**: filtered to species with a juvenile/immature documented
  (`speciesWithYoung`), first 10 + Show all/fewer toggle, sortable by name or
  taxonomic order (`sortSpeciesAgeCoverage`, unknown-order last, name tiebreak);
  taxonomic order threaded from `/taxonomy/codes` `orders` via `BirdingStats`'
  `orderFor` (mirrors `codeFor` normalization). The only-adults note renders on
  `youngSpecies.length > 0 || onlyAdults.length > 0` so the all-adults case (no
  young birds) still surfaces it — a regression caught in adversarial review.
- **(v0.5.25)** Brought the **At a glance** facts back into uniform tiles (reversing
  the v0.5.24 caption) — busiest day, longest streak (with the dates it ran), and a
  new archive-span tile now sit in the grid with the count tiles, kept the same
  height by a `reserveSub` slot on every `StatCell` so mixed sub/no-sub tiles align
  at any width. The busiest-day date links to that day's dominant eBird checklist
  (id shape-validated `^S\d+$`, `encodeURIComponent`-wrapped). Out-of-range export
  dates are now excluded from the date stats instead of rolling onto a neighboring day.

### Date-format unification + Multimedia discoverability (complete — June 2026, v0.5.19)

- The Weather tab's checklist-line date (the last stray raw eBird date) now flows
  through the canonical pref-aware `formatObsDate` — every user-facing date honors
  the Settings date-format choice.
- A **"Jump to comments"** hint + anchor on the Multimedia tab (gated on comment
  count) makes the Media Comments section discoverable.
- Reduced-motion now honored for programmatic jump scrolls (shared
  `lib/scroll.ts` `smoothScrollIntoView`).

### Media Comments on the Multimedia tab (complete — June 2026, v0.5.18)

Surfaces the per-asset Caption / Media notes from your ML export as a searchable
list (keyword filter + Newest/Oldest + recent-10/show-all), each row with
species/type/date and a Macaulay asset link — mirroring the Species Detail
comments box. New `lib/mediaComments.ts` + `MediaCommentsSection.tsx`;
`parseMLExport` now reads the comment fields + Locality and is record-aware.
**(v0.5.21)** The eBird Observation Details comment is excluded — the ML export
copies it onto every media item from an observation, so it duplicated across the
list; only the comment on the media itself is shown, counted, and searched.

### Checklist Comparer: weather, tide & badges (complete — June 2026, v0.5.18)

The checklist-compare mode gained media/breeding/weather/tide **badges** per
species and a **side-by-side fresh weather & tide section** for the two
checklists (no auto-copy).

### Quality & accessibility sweep (complete — June 2026, v0.5.18)

- **Date-format picker** — canonical `lib/formatDate.ts` + a Settings control
  (month-first default / day-first / ISO), applied app-wide.
- **Keyboard-operable map markers** — in-view, focusable sidebar lists
  (Sightings / Hotspots in view) wired to the same popup, so the map is usable
  without a mouse.
- **Statistics → Data Quality: weather/tide block coverage** — count + % of
  checklists carrying any / Raincrow / SnowRaven weather, SnowRaven tide, and
  SnowRaven weather+tide blocks (new block detectors).
- **Internal:** BirdingStats / SpeciesDetail / MapExplorer split into smaller
  files (behavior-preserving) — see DECISIONS.

### Tides on the Weather tab (complete — June 2026, v0.5.17)

Looking up a checklist on the Weather tab now also shows the historical tide
below the weather, from the nearest NOAA station. Keyless (NOAA CO-OPS), dual
runtime, concurrent + independent of the weather lookup.

- Nearest NOAA station from a bundled US station list (3,241 stations:
  `scripts/build-tide-stations.mjs` → `frontend/src/assets/noaa-tide-stations.json`
  + `backend/staticdata/noaa_tide_stations.json`).
- Water-level **range** over the checklist duration, labeled **Observed** (gauge)
  else **Predicted** — continuous for reference stations, else high/low
  **interpolation** for subordinate stations (the common coastal case); rising/
  falling; surrounding hi/lo with local times; "turned during your checklist";
  station name + id + distance; ft / MLLW.
- Two notices with one-tap override: nearest station >25 mi, or checklist outside
  US (coarse US bounding boxes). **"Copy Weather and Tide Together"** (one
  SnowRaven attribution, NOAA credit inline).
- Files: backend `routers/tide.py` + `services/{noaa,tide,tide_stations}.py` +
  `formatters/tide.py`; desktop `lib/tauri/tideService.ts` via transport `/tide/`;
  frontend `lib/tide.ts` / `lib/tideStations.ts` / `lib/tideFormatter.ts`;
  `weatherFormatter` split into body/attribution. PRIVACY_POLICY updated (NOAA).

### Settings: use-my-location + 5-mile default (complete — June 2026, v0.5.16)

"Use my location" button in Settings (native CLLocationManager on desktop — see
DECISIONS), default Map Explorer radius changed 25 → 5 miles, and the privacy
label "Your Location". Reviewed, tested, audited.

### Performance sweep (complete — June 2026, v0.5.16)

App-wide loading/waiting reduction from an 8-way audit, plus progress indicators
where waiting is unavoidable.

- **Startup:** only the Weather tab mounts at first paint; all other tabs (and
  their CSV/breeding/taxonomy/files work) defer to first open. Static `#root`
  boot skeleton replaces the blank screen; root `ErrorBoundary`.
- **Network:** every desktop service call times out (`lib/tauri/http.ts`) instead
  of hanging; short-TTL caches for repeat eBird calls; map/updater loading
  indicators.
- **Parse-once + cache:** the ~20k-row backup is parsed once and shared
  (`observationsCache` fast-path with explicit invalidation); a shared
  `mlExportCache`; Breeding Codes derives from the shared parse
  (`deriveBreedingData`, equivalence-tested); taxonomy downloads coalesce.
- **Render:** Statistics progressive render; Map Explorer sighting pins → a
  MapLibre GL circle layer + atlas viewport cap; heatmap slider repaints via a
  paint expression; Life List table + name-normalization memoized.
- **Bundle:** Help split out, heavy chunks idle-prefetched; labeled tab loaders.

### Standardized Bird-Name Format (complete — June 2026, v0.5.8)

Every user-facing bird name renders through one shared component so the format
is consistent app-wide, and any name is a launch point into Species Detail.

- **`frontend/src/components/BirdName.tsx`** (NEW, + `BirdName.test.tsx`):
  common name (links to Species Detail when the user has an entry; plain text
  otherwise) + eBird/Birds of the World favicons (composes `SpeciesLinks`) +
  optional stacked scientific name. Quiet link affordance (text at rest, accent
  + underline on hover/focus). Sizes `sm`/`md`/`lg`.
- **Click-any-bird → Species Detail:** `App.requestedSpecies` +
  `navigateToSpeciesDetail`; `SpeciesDetail` consumes it single-use (pending
  until ready, subspecies-normalized, scroll-into-view). Mirrors the
  `requestedFilter` cross-tab pattern.
- **Converted sites:** all Statistics lists (Most Photographed/Audio/Video with
  name→detail + count→ML; milestones; nemesis/targets as plain+favicons;
  single-checklist & one-and-done with checklist link → ↗ icon; biggest counts;
  first species); Map Explorer target popups + nearest-targets (pan → locate
  icon); and a refactor of the already-compliant Media List, Breeding Codes,
  Life List Comparer, and Species Detail "Reported With" onto `<BirdName>`.
- **`hasEntry`** is sourced from a normalized backbone set per tab (birds not in
  the user's data get name + favicons, no Species-Detail link — D1). Stats now
  resolves taxon codes for ALL observed species so favicons are consistent.
- **Excluded:** form controls (Map filter dropdown, manual target checkboxes)
  and the Species Detail entry header (stays as its own heading).
- See DECISIONS.md (the rules) and CLAUDE.md (the convention). First DOM/
  component test in the project (jsdom via a per-file docblock).

### Checklist Weather Lookup (complete — May 2026)

The core feature of SnowRaven. A single-page web app that accepts an eBird
checklist ID or URL, fetches historical weather for the checklist's time and
location, and returns a copy-and-pasteable formatted text block matching the
raincrow.app output format.

**What it does:**
- Accepts a bare checklist ID (`S12345678`) or full eBird URL — URL parsing strips path/query automatically
- Validates the ID format client-side and server-side before making any API call
- Calls the eBird One Call API to fetch checklist metadata (date, time, location, duration)
- Resolves coordinates using a three-tier fallback: hotspot/info → product/lists → recent obs
- Calls the OpenWeather One Call API 3.0 timemachine endpoint once per hour of checklist duration (concurrent via asyncio.gather)
- Formats output with emoji, Beaufort wind description, cardinal direction, temp/humidity/dew point ranges, sunrise/sunset, and HTML attribution
- Displays output in a monospace pre block with a one-click copy button
- Shows inline errors for invalid IDs, not-found checklists, and API failures
- **(v0.5.28)** Night checklists append a moon-phase emoji to the condition
  emoji on the header line (unspaced, e.g. `☁️🌗`; mirrored emoji set when
  lat < 0) — parity with raincrow. Night = any sampled hour with `dt` outside
  its sunrise–sunset window; phase from the checklist's first sampled hour,
  computed locally (hand-ported lunarphase-js 2.0.3, pure-UTC Julian Day — no
  new API calls, no dependency). Identical in the TS and Python formatters,
  locked by the golden-oracle chain; day blocks byte-unchanged.
- **(v0.5.29)** A footer note under the weather card (and matching paragraphs
  in README + in-app Help) points to **SnowRaven Mini** — the author's
  separate Chrome/Firefox extension running the same weather and tide lookup
  on the eBird page — as a plain informational GitHub link (no fetch until
  clicked; the website deliberately omits it).

**Key files:**
- `backend/services/ebird.py` — eBird API client with coordinate fallback logic
- `backend/services/openweather.py` — OpenWeather timemachine API client
- `backend/formatters/weather.py` — pure formatting functions (Beaufort, cardinal, emoji, ranges)
- `backend/routers/weather.py` — GET /weather/{checklist_id} endpoint
- `backend/main.py` — FastAPI app, CORS, static file serving for production
- `frontend/src/App.tsx` — full single-page UI
- `start.sh` — production startup script (builds frontend, starts uvicorn on port 1620)
- `deploy/snowraven.service` — systemd unit for Raspberry Pi auto-start

**Running in development:**
```
# Terminal 1 — backend
cd backend && uvicorn main:app --reload --port 1620

# Terminal 2 — frontend
cd frontend && npm run dev
```
Frontend dev server runs on port 5173 and proxies `/weather`, `/health`, `/version`, `/taxonomy`, `/settings`, and `/nominatim` to port 1620.

**Running in production:**
```
./start.sh
```
Builds the frontend into `frontend/dist/`, then starts uvicorn on port 1620.
FastAPI serves the built frontend as static files — no separate web server needed.

### Checklist Confirmation Header (complete — May 2026)

A one-line confirmation displayed after a successful weather lookup, showing the resolved checklist ID, location name, and observation time — matching the raincrow.app format (e.g. `S334315671 / Berkeley Community Garden / 2026-05-07 17:26`).

**What it does:**
- Appears between the `<hr>` divider and the "Weather output" label on successful lookup
- Displays `{checklist_id} / {loc_name} / {obs_dt}` in monospace, muted type
- Location name sourced from `ref/region/info` response (`result` field), falling back to `product/lists` loc object `name`, then to `locId`
- Not part of the copyable weather text block — display only

**Key files changed:**
- `backend/services/ebird.py` — added `loc_name` extraction with three-tier fallback
- `backend/routers/weather.py` — added `checklist_id`, `loc_name`, `obs_dt` to response
- `frontend/src/App.tsx` — extended `AppState` success type, added confirmation line to results UI
- `backend/tests/test_weather_router.py` — updated mock, added assertions, added date-only test case

### List Comparer (complete — May 2026)

A second tool added as a tab alongside the Weather lookup. Accepts two eBird
backup CSV files and computes which species appear in both lists and which are
unique to each. All logic is client-side — no network requests are made after
the initial page load.

**What it does:**
- Persistent tab bar switches between "Weather" and "List Comparer" without page reload or state loss
- Two drop zones accept eBird backup CSV files via drag-and-drop or click-to-browse
- Parses the "Common Name" column; rejects files missing that column with a clear error
- Excludes spuh entries (ending in " sp."), slash species (containing "/"), and hybrids (containing " x "); soundscape entries are included
- Strips subspecies parentheticals so "Yellow-rumped Warbler (Myrtle)" and "Yellow-rumped Warbler (Audubon's)" count as the same species
- Produces three alphabetically-sorted lists: in both, File A only, File B only
- Summary bar shows five counts: total A, total B, both, A only, B only
- "Compare new files" button resets to the upload state

**Key files:**
- `frontend/src/components/ListComparer.tsx` — top-level state manager (files, result, expanded)
- `frontend/src/components/DropZone.tsx` — drag-and-drop + file picker with hover/error/loaded states
- `frontend/src/components/ResultsView.tsx` — stats bar, three panels, toggle and reset buttons
- `frontend/src/components/SpeciesPanel.tsx` — scrollable species list panel (collapses/expands via prop)
- `frontend/src/lib/parseEbird.ts` — CSV parser (quoted fields, CRLF, exclusions, normalization)
- `frontend/src/lib/compare.ts` — `compareSpecies(a, b)` pure function
- `frontend/src/types.ts` — `FileData` and `ComparisonResult` types

### eBird Edit Link (complete — May 2026)

After a successful weather lookup, an "Edit on eBird" link appears flush-right on the confirmation row (`S… / location / date`). Clicking it opens `https://ebird.org/edit/effort?subID={checklistId}` in a new tab, landing the user directly on the eBird edit page where they can paste the copied weather into the comment field.

**What it does:**
- Renders only in the success state — not visible during idle, loading, or error
- Link is constructed from `state.checklistId`, which is server-validated as `/^S\d+$/` before the success state is ever reached
- Opens in a new tab (`target="_blank"` + `rel="noreferrer"`) so the SnowRaven session is preserved
- Uses `ExternalLink` icon from lucide-react (11px) to signal outbound navigation
- Confirmation text truncates with ellipsis on narrow widths; link stays pinned right with `flexShrink: 0`

**Key files changed:**
- `frontend/src/App.tsx` — `ExternalLink` added to lucide import; confirmation `<div>` converted to flex row with link

### Media Life List (complete — May 2026)

A third tab that generates a full life list showing per-species media coverage
— which species have been photographed, audio-recorded, and video-recorded.
Accepts a Macaulay Library export CSV as primary input; optionally uses a stored
eBird backup CSV (from Settings) to enable **Comprehensive mode**, which builds
the species list from eBird observations rather than ML catalog entries alone.

**Input format:**
- **Macaulay Library export:** Sign in to Macaulay Library → My Media → Save Spreadsheet. Columns: `Catalog Number` (or `ML Catalog Number`), `Common Name`, `Scientific Name`, `Format`. Media types are read directly from the CSV — no backend lookup required.
- **eBird backup (optional, from Settings):** When a stored eBird backup is present, it is auto-loaded in parallel with the ML export on mount. Its `ObservationEntry[]` becomes the backbone list, ensuring every life-listed bird appears even if it has no ML media. Entries not recognized from the eBird backbone are classified as non-bird (`isNonBird: true`).

**What it does:**
- Upload screen shows a single drop zone for ML export (with download instructions)
- Parses one entry per unique species; normalizes subspecies parentheticals (e.g. "Yellow-rumped Warbler (Myrtle)" → "Yellow-rumped Warbler")
- Excludes spuh (` sp.`), slash species (`/`), and hybrids (` x `); soundscape entries are included as first-class rows
- Strips the `ML` prefix from catalog numbers and deduplicates
- Media types come from the `Format` column (Photo/Audio/Video) — client-side only, no network request
- Renders a table with five columns: Entries, Photo, Audio, Video, Total; all count cells show a dash for zero
- Non-zero counts are clickable links — open the Macaulay Library catalog (`media.ebird.org/catalog`) filtered by taxon code, media type, and personal userId in a new tab; the code follows the "Show subspecies" (merge) toggle (merged → the species code, un-merged → the selected form's code; v0.5.57), so a subspecies/form entry links correctly instead of falling back to `taxaName`
- `SpeciesLinks` favicon icons appear after each common name linking to eBird and Birds of the World species pages
- User ID parsed from ML export filename (`ML__DATE_USERID.csv`) and appended to all catalog links; warning shown if filename was renamed and no ML data is loaded
- Taxon codes and taxon order numbers fetched via `POST /taxonomy/codes` after file load; ML links use `taxonCode=acowoo` parameter for accurate personal filtering; taxon orders power the Taxonomic sort
- All five column headers are clickable sort controls; clicking sorts by that column, clicking again reverses; count columns default to descending (highest first)
- **Filter pills (8 total):** All · Has media · No photo · No audio · No video · Has photo · Has audio · Has video — multi-select with AND logic; "Has media" hides all species with no media of any type; "All" resets all pills including "Has media"
- A–Z / Taxonomic sort toggle in the filter bar
- **Three toolbar toggles:**
  - **Merge subspecies** (default ON) — collapses subspecies variants to the parent name; same behavior as Species Detail tab
  - **Show sp./slash** (default OFF) — hides spuh and slash entries when off
  - **Show non-bird** (default OFF, only visible in Comprehensive mode) — hides non-bird ML entries (soundscapes, etc.) when off; in Taxonomic mode, non-bird entries use a three-tier sort: birds first → non-bird animals (any non-empty scientificName) → non-animals (empty scientificName, e.g. Habitat/Soundscape/Experience) alphabetically at the very end
- **↔ Unbounded / ↔ Normal toggle** — removes the `overflowX` constraint from the table wrapper (sets it to `width: max-content`) so the whole page scrolls horizontally on mobile; Normal restores the bounded scroll box
- Species count label: "312 of 456 species" in Comprehensive mode, or "312 species" in ML-only mode; denominator always uses `displayEntries.length` (post-toggle, pre-media-filter count)
- "Load new file" button resets to the upload state

**Comprehensive mode internals:**
- `buildComprehensiveEntries(ebirdObs, mlRows, mergeSubspecies)` — pure function outside the component; five-step algorithm: (1) build eBird species map (name → obs array), (2) build eBird normalized name set for non-bird detection, (3) build ML catalog map (name → catalogIds), (4) add all eBird backbone entries with ML catalog IDs merged in, (5) add ML-only entries not in the eBird backbone as non-bird (`isNonBird: true`)
- Non-bird classification uses a set built from `normalizeSpeciesName(ebirdObs[].commonName)` — always normalized regardless of the mergeSubspecies toggle — so subspecies variants in eBird still protect ML entries from false-positive non-bird classification
- `Phase.ready` carries `hasEbirdBackbone: boolean`; the non-bird toggle and non-bird separator are hidden in ML-only mode
- Auto-load runs ML and eBird fetches in `Promise.all` (parallel, not sequential)

**Key files:**
- `frontend/src/lib/speciesUtils.ts` — shared module: `normalizeSpeciesName(name)` (strips trailing parentheticals) and `isSpuhOrSlash(name)` (spuh/slash detection); used by `LifeList.tsx` and `SpeciesDetail.tsx`
- `frontend/src/lib/speciesUtils.test.ts` — 11 tests
- `frontend/src/lib/parseMLExport.ts` — ML export CSV parser: returns `{ entries, mediaMap, rows }` from Macaulay Library export; client-side only; throws `INVALID_ML_EXPORT` on bad input
- `frontend/src/lib/parseMLExport.test.ts` — 15 parser tests
- `frontend/src/lib/parseLifeList.ts` — eBird backup CSV parser producing `LifeListEntry[]`; `LifeListEntry` now includes `isNonBird?: boolean`
- `frontend/src/lib/parseLifeList.test.ts` — 13 parser tests
- `frontend/src/components/LifeList.tsx` — top-level component: comprehensive/ML-only/eBird-only mode state machine; `buildComprehensiveEntries` outside component; `filterHasMedia` boolean state; three toolbar toggles; parallel auto-load; `resolveMLCounties` accepts optional `preloadedEbirdObs` to skip re-fetch
- `frontend/src/components/LifeListTable.tsx` — filtered/sorted species table; non-bird sort partition (taxonomic mode only); Total column shows `<Minus>` for zero-count; `wideMode` prop controls wrapper overflow behavior
- `frontend/src/types.ts` — `MediaType`, `MediaFilter` (includes positive filters), `SortState` types
- `frontend/src/App.tsx` — Life List tab added (display-toggle pattern)

### Species Links (complete — May 2026)

Inline eBird and Birds of the World favicon icons appear after every species common name in the
Media Life List and all three Life List Comparer panels. Clicking either icon opens that species'
page on the respective site in a new tab. Icons appear once taxon codes are resolved; rows with
no code (soundscapes, pre-fetch) show nothing.

**What it does:**
- `SpeciesLinks` component renders two 14×14 favicon `<img>` elements inside `<a target="_blank" rel="noreferrer">` tags
- eBird link: `https://ebird.org/species/{speciesCode}` — opens species account page with maps, photos, recent sightings
- BOW link: `https://birdsoftheworld.org/bow/species/{speciesCode}/cur/introduction` — opens full ornithological account
- Favicons loaded from `ebird.org/favicon.ico` and `birdsoftheworld.org/favicon.ico`; `onError` hides failed loads; carry `className="sr-favicon"` for dark-mode CSS filter treatment
- Icons at 75% opacity at rest, full opacity on hover
- In `LifeListTable`: `taxonMap` already available — codes passed directly to `SpeciesLinks` per row
- In `SpeciesPanel` (used by List Comparer): `taxonMap?: Record<string, string>` prop added; `ResultsView` threads it to all three panels
- In `ListComparer`: `taxonMap` state added; `fetchTaxonCodes` called fire-and-forget after `compareSpecies()` completes

**Key files:**
- `frontend/src/components/SpeciesLinks.tsx` — new shared inline component
- `frontend/src/components/LifeListTable.tsx` — `SpeciesLinks` added after common name
- `frontend/src/components/SpeciesPanel.tsx` — `taxonMap` prop added; `SpeciesLinks` per row
- `frontend/src/components/ResultsView.tsx` — `taxonMap` prop threaded to all three `SpeciesPanel` instances
- `frontend/src/components/ListComparer.tsx` — `taxonMap` state, `fetchTaxonCodes`, cleared on reset
- `backend/routers/taxonomy.py` — `POST /taxonomy/codes`; eBird taxonomy fetch + in-memory cache
- `frontend/vite.config.ts` — `/taxonomy` proxy added for dev server

### Breeding Code List (complete — May 2026)

A fourth tab that parses an eBird backup CSV and renders a species-by-breeding-code
matrix. Each cell shows a count of how many times that species was observed with that
code, rendered as a tier-colored circle. Entirely client-side — no backend changes.
On a phone the matrix reads well: the code columns narrow to compact dot-width columns,
thin vertical rules separate them, the species-name column stays fixed while the codes
scroll sideways, and you pinch the viewport to magnify (a natural full-height table that
scrolls with the page, not a boxed data-grid).

**What it does:**
- Drop zone accepts `MyEBirdData.csv` (eBird backup); drag-and-drop or click-to-browse
- Parser extracts the `Breeding Code` column; specific error if the column is absent from the CSV
- Empty state (column present but no rows with valid codes) shows a non-error message
- 23 eBird breeding codes across four tiers: Confirmed highest (NY NE FS FY CF FL ON UN DD), Confirmed also (NB CN), Probable (PE B A N C T P M S9 S7), Possible (S H F)
- Only codes present in the loaded data appear as columns and filter pills (canonical order: confirmed → possible, left to right)
- Per-cell count circle: 28px, tier background color (4=`#3B0764` → 1=`#C084FC`), white 11px bold text; empty cells are truly blank — no dash or placeholder
- Species name column: sticky-left (`position: sticky; left: 0`), 190px, with a right-edge shadow separator
- Table wrapper `overflow-x: auto` allows horizontal scroll when many codes are present
- All columns sortable: species name defaults asc (A–Z); code columns default desc (highest count first); ties broken by the active name sort mode (A–Z or Taxonomic)
- Active sort column shows ↑/↓ indicator in `#2D8653`; inactive columns muted
- A–Z / Taxonomic toggle: defaults to A–Z; Taxonomic orders species by eBird taxon number (fetched from `POST /taxonomy/codes`); unranked species sort last; toggle preserved as tiebreaker when sorting by any code column
- Filter pills row: "All" pill + one pill per code present, each with a 14px tier-colored dot — multi-select with AND logic; multiple code pills can be active simultaneously; the table shows only species that have ≥1 recorded observation for every active code; clicking an active pill removes it from the filter; "All" resets to unfiltered
- Species count label: "8 species" (all) or "3 of 8 species" (filtered)
- Legend at the bottom of the table card maps tier colors to categories and codes
- **↔ Unbounded / ↔ Normal toggle** — removes `overflowX` and unfreezes the sticky species column so the whole page scrolls horizontally on mobile; species column stickiness is re-enabled in Normal mode
- "Load new file" button resets to the upload state
- Spuh (` sp.`), slash species, and hybrids (` x `) excluded; subspecies parentheticals normalized to parent species name

**Key files:**
- `frontend/src/lib/breedingCodes.ts` — 23 code definitions (`code`, `label`, `tier`), `BREEDING_CODE_MAP`, `TIER_COLORS`
- `frontend/src/lib/parseBreedingCodes.ts` — CSV parser returning `{ entries, codesPresent, hasBreedingCodeColumn }`
- `frontend/src/lib/parseBreedingCodes.test.ts` — 15 tests covering parsing, exclusions, normalization, and error cases
- `frontend/src/components/BreedingCodeList.tsx` — top-level component: drop zone, phase state machine (idle/error/ready), filter pills, controls row
- `frontend/src/components/BreedingCodeTable.tsx` — species-by-code matrix with sticky column, sortable headers, circles, legend
- `frontend/src/types.ts` — `BreedingSortColumn`, `BreedingSortState`, `BreedingFilter` added

### Settings Tab (complete — May 2026)

A Settings tab (rightmost in the tab bar) where users upload and persistently store their eBird backup CSV and ML export on the server filesystem. Stored files auto-load in the Breeding Codes, Media List, and Species Detail tabs on every page visit, eliminating repeated uploads between sessions.

**What it does:**
- Two file management sections: eBird Backup and ML Export — each shows stored filename + upload date, or an empty "No file saved" state
- Upload sends `multipart/form-data` POST; validated server-side (`.csv` extension only, 50 MB limit)
- Clear button removes the stored file from disk and clears metadata; disabled when no file is stored
- On app mount, Breeding Codes, Media List, and Species Detail tabs start in `loading-saved` phase (spinner), auto-fetch their stored file, parse it, and enter the ready state automatically
- `onKeysSaved` callback prop on `<Settings>` triggers a re-fetch of key status in App.tsx when a key is saved or deleted
- **Rebuild Caches (Tauri only):** A "Troubleshooting" section (visible only when `isTauri()` is true) contains a "Rebuild Caches" button that deletes the `snowraven-taxonomy` IndexedDB database (key: `taxonomy-v2025`) and calls `relaunch()` to restart the app with a fresh taxonomy fetch on next load

**Key files:**
- `backend/routers/settings.py` — 7 endpoints: `GET /settings/files`, `POST/GET/DELETE /settings/files/ebird`, `POST/GET/DELETE /settings/files/ml`; writes to fixed paths in `data/`
- `backend/tests/test_settings_router.py` — 9 tests using `monkeypatch` + `tmp_path` to isolate filesystem
- `frontend/src/components/Settings.tsx` — Settings tab component with `FileRow`, `KeyRow`, `AppearanceRow` sub-components; `onKeysSaved?: () => void` prop
- `frontend/src/components/BreedingCodeList.tsx` — `loading-saved` phase, auto-load `useEffect`
- `frontend/src/components/LifeList.tsx` — same pattern; `userId` parsed from stored metadata filename field

### Update Script + In-App Update Check (complete — May 2026)

Two small additions that make keeping SnowRaven current easy: a shell script for one-command updates, and a footer link that checks GitHub for a newer release on explicit user request only.

**What it does:**
- `update.sh` at the repo root: runs `git pull`, rebuilds the frontend, reinstalls backend deps, and restarts the systemd service if present — all in one command
- If no systemd service exists (local Mac/Linux install), the script skips the restart step and prints a manual note instead; exits 0
- `GET /version/check` backend endpoint: reads the current version from `frontend/package.json`, calls the GitHub releases API, and returns `{current, latest, up_to_date}`
- Footer displays "SnowRaven · Self-hosted Birding Tools · Check For Updates" — clicking the link triggers one `/version/check` call and shows inline state (checking → up-to-date/available/error), which reverts automatically after a timeout
- No passive network requests — the check fires only on explicit click; no `useEffect`, no polling

**Key files:**
- `update.sh` — one-command update script (chmod +x, fail-fast with `set -e` + `trap ERR`)
- `backend/routers/version.py` — `/version/check` endpoint with 5s GitHub API timeout
- `backend/tests/test_version_router.py` — 5 tests covering up-to-date, update-available, v-prefix stripping, missing file, unreachable GitHub
- `frontend/src/App.tsx` — `UpdateStatus` discriminated union, `handleUpdateCheck` callback, footer JSX with five states
- `frontend/vite.config.ts` — `/version` proxy added for dev server

### API Key Settings (complete — May 2026)

An "API Keys" section added above "Default Files" on the Settings tab. Users can enter, save, and manage their eBird and OpenWeather API keys directly in the UI, without editing `.env` files by hand.

**What it does:**
- Two rows — eBird API Key and OpenWeather API Key — each with "Add key" / "Update", "Clear", and Show/Hide controls
- Keys are written to `backend/.env` via `python-dotenv` and applied to `os.environ` immediately — no server restart required
- Saved keys display as `••••••••••••••••` by default; "Show" reveals the value, "Hide" re-masks it
- "Add key" / "Update" expands an inline edit area with a monospace text input; Save is disabled until the field has content; Enter key submits
- "Clear" removes the key from `.env`, `os.environ`, and the UI
- Keys load on Settings tab mount alongside file status via a parallel fetch to `/settings/keys`
- Error messages shown inline below the row on save or delete failure

**Key files:**
- `backend/routers/apikeys.py` — `GET/POST/DELETE /settings/keys/{ebird|openweather}`; `KEY_MAP` allowlist; `python-dotenv` `get_key`/`set_key`/`unset_key`; writes to `backend/.env`
- `backend/tests/test_apikeys_router.py` — 11 tests using `monkeypatch` + `tmp_path` to isolate `.env`
- `backend/main.py` — apikeys router registered
- `frontend/src/components/Settings.tsx` — `KeyRow` component, `ApiKeyStatus` interface, per-slot state (visible/editing/input/saving/error), handlers

### Dark Mode (complete — May 2026)

Full dark theme with automatic OS preference detection, no flash of the wrong theme on load, and a consent-gated localStorage preference stored only after explicit user approval.

**What it does:**
- Settings → Appearance section (above API Keys) has a three-option toggle: System / Light / Dark. Default is System — follows OS preference, writes nothing to the browser.
- Anti-flash inline `<script>` in `index.html` reads `sr-theme` from localStorage (or falls back to `prefers-color-scheme`) and sets `data-theme` on `<html>` synchronously before first paint — no white flash for dark-mode users.
- Consent flow: selecting Light or Dark applies the theme immediately, then shows an inline prompt ("Save preference" writes to localStorage; "This session only" dismisses without writing). Once consent has been given for this browser, future Light/Dark changes are silent. Selecting System removes `sr-theme` from localStorage and shows no prompt.
- All component colors use `var(--sr-*)` CSS custom properties — no hardcoded hex in any component file. `:root` defines the light palette; `[data-theme="dark"]` overrides all tokens for dark.
- Dark palette: zinc-based backgrounds (`#09090B` page, `#18181B` surface), `#34D399` emerald accent (better contrast than the light-mode green on dark surfaces), lightened purple tier colors for breeding code badges.
- `--sr-tier-N-rgb` variables hold RGB triplets for use in `rgba(var(--sr-tier-N-rgb), alpha)` inline styles where dynamic alpha is needed.
- External favicons in `SpeciesLinks` carry `className="sr-favicon"`; `globals.css` applies `filter: brightness(0) invert(1); opacity: 0.65` in dark mode to keep them visible.

**Key files:**
- `frontend/index.html` — anti-flash inline script
- `frontend/src/globals.css` — complete `--sr-*` token system for both themes, plus `.sr-favicon` dark mode rule
- `frontend/src/lib/theme.ts` — `applyTheme(pref)` and `readStoredPreference()` with private-browsing-safe localStorage access
- `frontend/src/components/Settings.tsx` — `AppearanceRow` component with consent flow
- All other component files — colors migrated to `var(--sr-*)` tokens

### Species Detail (complete — May 2026)

A fifth data tab that shows a complete per-species view from the user's eBird backup. Select any species from a taxonomically-sorted dropdown to see sighting history, media coverage, breeding code breakdown, field notes, top locations, a sighting map, and embedded media. Entirely frontend — no new backend endpoints.

**What it does:**
- Auto-loads from the stored eBird backup in Settings on mount; shows an upload drop zone as fallback when no file is stored (`loading-saved` pattern)
- If an ML export is also stored, loads it in parallel for media data
- Searchable species selector: type to filter by common or scientific name; list sorts taxonomically after a fire-and-forget `POST /taxonomy/codes` fetch (immediately usable A–Z while fetch is pending)
- **Subspecies toggle** — toolbar `ToggleSwitch` ("Show subspecies") defaults to OFF (merged). In merge mode all subspecies variants (e.g. "Yellow-rumped Warbler (Myrtle)" + "(Audubon's)") are collapsed to the parent name; all statistics, codes, locations, comments, and map pins aggregate across every matching subspecies. Toggling ON switches to exact-name mode; selection resets when switching from merge→show since the normalized name may not exist as an exact entry.
- **Spuh/slash toggle** — second `ToggleSwitch` ("Show sp./slash") defaults to OFF (hidden). Hides entries where `name.endsWith(' sp.')` or `name.includes('/')`.
- **Summary card:** species common name (large heading), scientific name (italic) with inline eBird + Birds of the World favicon links (via `SpeciesLinks`), three media indicator buttons (Photo/Audio/Video — filled when ML export is loaded and that type has catalog items, grey when absent, "unavailable" when no ML loaded), and a breeding category pill (Confirmed/Probable/Possible based on highest-tier code recorded — absent when no codes)
- **Sightings section:** two totals — Checklists (count of eBird entries) and Individuals (sum of numeric counts; "—" when all counts are X/presence-only); first seen (link to checklist), last seen (link), personal best count (link); Sightings and Media cards sit in a `.sr-two-col` responsive grid (2-column on desktop, 1-column at ≤640px)
- **Media statistics:** Photo/Audio/Video counts as links to the Macaulay Library catalog (`media.ebird.org/catalog`) filtered by taxon code + media type + userId; the code follows the "Show subspecies" toggle (OFF → the species, ON → the selected form; v0.5.57), so a subspecies/form bird links correctly rather than falling back to all media; "Load ML export in Settings" message when no ML loaded
- **Breeding codes:** each unique code recorded for the species, with tier-colored dot, abbreviation, full label, and count; sorted tier 4→1 then canonical order; "No breeding codes recorded" empty state
- **Top locations:** ranked list (by observation count) of every unique location; top 10 shown by default with "Show all N locations" / "Show top 10" expand-collapse; locations with a valid `/^L\d+$/` ID link to `ebird.org/loc/{id}` (works for both public hotspots and personal locations); invalid or missing IDs render as plain text
- **Sighting locations map:** interactive MapLibre GL map — the shared `SightingsMap` component (`components/SightingsMap.tsx`, also used by the Named Birds tab) rendered through the `SnowMap` wrapper; one teardrop marker per unique lat/lng pair among the selected species' observations (aggregated by `lib/sightingMarkers.ts`); bounds auto-fit on species change via `MapBoundsFitter` (single coordinate → `flyTo` zoom 12, multiple → `fitBounds` with 30px padding); clicking a marker opens the map's single state-driven Popup listing up to 6 dated checklist links ("+N more" overflow label); map hidden when no coordinates are available; 380px tall on desktop, 300px on ≤640px
- **Comments archive:** all non-empty per-species field notes from the eBird backup; sortable (newest/oldest); filterable by keyword (case-insensitive); first 10 shown with "Show all N comments" expand button; each date is a link to the corresponding checklist
- **Embedded recent media:** when ML export is loaded and the species has catalog items, the most recently uploaded Photo, Audio, and/or Video (numerically highest catalog ID = most recently uploaded) is embedded via `macaulaylibrary.org/asset/{id}/embed` iframe; responsive 3-column CSS grid (`repeat(3, minmax(0, 1fr))`), 280px tall on desktop, full-width 360px on mobile; `scrolling="no"` + `overflow: hidden` suppress iframe scrollbars; section appears at the very bottom of the detail view. While Cornell's Anubis bot gate is up no iframe is mounted and each tile shows SnowRaven's own fallback (date, checklist link, Macaulay link-out) instead of Cornell's error card
- All sections render in natural page flow — no expand/collapse toggle
- Switching species instantly replaces all sections (all data already parsed client-side)
- `submissionId` values validated against `/^S\d+$/` before use in any `href` attribute; catalog IDs validated against `/^\d+$/`; location IDs validated against `/^L\d+$/`

**Key files:**
- `frontend/src/lib/parseEbirdObservations.ts` — character-level CSV parser; one `ObservationEntry` per CSV row; reads Location ID, Latitude, Longitude columns in addition to all prior fields; throws `INVALID_EBIRD` if required columns missing
- `frontend/src/lib/parseEbirdObservations.test.ts` — 24 tests
- `frontend/src/components/SpeciesDetail.tsx` — full tab component; `Phase` discriminated union (`loading-saved | setup-required | error | ready`); UI sub-components `SectionCard`, `SectionHead`, `StatLabel`, `StatValueLink` live in `components/speciesDetail/ui.tsx`, `ToggleSwitch` in `components/ui/ToggleSwitch.tsx`, and `MapBoundsFitter` in `components/speciesDetail/MapBoundsFitter.tsx`; per-coordinate marker grouping is the `SightingMarker` type from `lib/sightingMarkers.ts` (consumed by the shared `SightingsMap`)
- `frontend/src/types.ts` — `ObservationEntry` now includes `locationId`, `latitude`, `longitude`
- `frontend/src/globals.css` — `.sr-map-container`, `.sr-media-grid` (CSS grid 3-col), `.sr-media-item`, `.sr-media-iframe` with responsive overrides
- `frontend/src/App.tsx` — `'species-detail'` tab (unchanged structure)

### Birding Statistics Tab (complete — May 2026)

A Statistics tab (between Map Explorer and Settings in the tab bar) that derives comprehensive birding analytics from the stored eBird backup CSV and ML export. All computation is client-side. (At launch one backend endpoint, `/stats/nemesis`, supplied the Nemesis Birds list; that list moved to the Nearby Lifers Map on Map Explorer in v0.5.35 and the endpoint was retired — see below.)

**What it does:**

**Life List Totals** — Headline counts (species, checklists, locations, years active, states/provinces, countries). First and last observation cards show date (linked to eBird checklist when submissionId matches `/^S\d+$/`) and location name. First species ever recorded. Life list accumulation chart with four-mode toggle: Weekly · Monthly · Yearly · Total. Total mode plots one step-line point per new lifer in chronological order; tooltip shows species name at each point.

**Firsts & Milestones** — Biggest single day (species count links to eBird checklist); longest consecutive streak; longest dry spell; Shannon diversity index (H′ from numeric counts). Milestone pills at 43 thresholds (every 10 below 100, every 25 from 100–475, every 50 from 500–950, sparse from 1,000–3,000) show the species that hit the threshold and link to the checklist. Four color tiers: sage green (10–90), medium green (100–475), deep green (500–950), amber/gold (1,000+).

**Temporal Stats** — Checklists by year (bar + species count + best single-day species count [linked to checklist]); checklists by month (bar + donut pie with percentage labels); checklists by day-of-week (bars then pie chart + legend below, grouped Sat/Sun/Weekdays, percentage labels); checklists by start hour (bar, excludes no-time checklists, percentage labels). All bar rows show both count and percentage of total.

**Geographic Stats** — MapLibre map (the shared `SnowMap` wrapper) at the top showing numbered green circle markers (top by checklists) and blue square markers (top by species); fits bounds to all pins on map load (`fitToPins`); the map's mount is deferred to `requestIdleCallback` behind a fixed-size "Loading map…" placeholder so it causes zero layout shift; hidden when no locations have lat/lng data. Two ranked location text lists below the map. Counties split into two side-by-side bar charts: by checklists (green bars, with show-all expand) and by species (blue bars, top 8). States/provinces same split. County and state entries link to `ebird.org/region/{stateProvince}` when stateProvince is non-empty and contains a hyphen; plain text otherwise.

**Effort & Methodology** — At the top: complete-checklist rate as a two-segment bar (blue = complete, grey = incomplete) with "N of M complete" count label; Traveling and Stationary sub-bars (lighter blue) show per-protocol completion rates with per-protocol counts. Below: Protocol distribution segmented bar + legend. Key metrics grid (avg duration min, avg distance mi, spp/hour, spp/mi). Average-by-protocol table. Observer count: vertical bar chart + donut pie. All bars show percentage labels inside segments when the segment is ≥8% wide. Complete-checklist section only appears when "All Obs Reported" column is present in the CSV.

**Data Quality** — Count method: proportional bar (numeric % vs. X/presence-only %) with "N numeric · M X / total observations" count label. Checklist comments: proportional bar (% of checklists with a checklist-level note) with count label. Species notes: proportional bar (% of individual observation rows with a species-level annotation) with count label. Top 10 biggest single-species counts table. Single-Checklist Birds (species seen on exactly one checklist). One-and-Done Birds (species where total individual count is exactly 1). All three bars follow the same label+count-above-bar pattern.

**Breeding Stats** — Confirmed/Probable/Possible species totals. Breeding activity by month: stacked color-coded bars (dark purple = confirmed, medium = probable, light = possible species per month). Filter buttons (All / Confirmed / Probable / Possible) switch the chart to show only that tier.

**Other Statistics** — Originally a flat **Nemesis Birds** ("Nearby Lifers") list powered by `GET /stats/nemesis`. *Superseded in v0.5.35:* this list was removed from the Statistics tab and rebuilt as the **Nearby Lifers Map** section of Map Explorer (which maps where each lifer was reported, not just the names); `/stats/nemesis` was retired in favor of the codes-optional `/map/recent-obs`. See the Nearby Lifers Map entry near the top. Most Photographed / Most Recorded / Most Filmed had earlier moved to the Media card.

**Mobile layout:** `SectionCard` padding uses `clamp(14px, 4vw, 24px)`; two-column grids (Geographic counties/states, Temporal day-of-week/start-hour) use `repeat(auto-fit, minmax(..., 1fr))` to stack on narrow viewports; Effort metrics grid uses `repeat(auto-fill, minmax(80px, 1fr))`; Breeding filter and Media control rows have `flexWrap: 'wrap'`.

**Key files:**
- `frontend/src/components/BirdingStats.tsx` — full tab component; ~1,940 lines; all stat sections as `useMemo` hooks declared before any early return; `SESSION_NOW_MS` module-level constant; `mlCatalogUrl()` helper builds `media.ebird.org/catalog` URLs (shared `ML_CATALOG_BASE`) using the taxonCode resolved from the normalized name (species-level here — Statistics has no subspecies toggle); the `?taxaName=` fallback was retired in v0.5.57; `ML_USER_RE` extracts userId from ML export filename; `mlTaxonMap` state populated via `POST /taxonomy/codes` (the `nemesisTaxonMap` state was removed in v0.5.35 along with the Nemesis Birds block — see the Nearby Lifers Map entry); geographic map renders through the shared `SnowMap` with DOM `<Marker>` pins (`RankIcon` circle/square sprites), one state-driven `<Popup>`, and a `fitToPins` bounds fit on map load
- `frontend/src/lib/parseEbirdObservations.ts` — extended with 9 optional checklist-level fields: `time`, `duration`, `distance`, `protocol`, `numObservers`, `allObsReported`, `checklistComments`, `stateProvince`
- `backend/routers/stats.py` — originally hosted `GET /stats/nemesis?lat&lng&dist` (validated params; called eBird geo/recent; returned `{species: [{commonName, recentDate, subId}]}`). **Retired in v0.5.35** — the Nearby Lifers Map now uses the codes-optional `/map/recent-obs` in `backend/routers/map.py` instead.
- `backend/tests/test_stats_router.py` — 13 tests
- `backend/main.py` — stats router registered
- `frontend/vite.config.ts` — `/stats` proxy added

### Tab Filters — County, Date Range, and Total Media (complete — May 2026)

County and date-range filters added to the Breeding Codes, Media List, and Species Detail tabs. Total media column added to the Media List. County resolution for ML exports via a 3-tier chain.

**What it does:**
- County dropdown and date-range inputs appear in each tab's toolbar — only when the loaded file contains county data (the controls are hidden otherwise)
- Active filter strip below the toolbar shows the current county/date selection and (in Species Detail) how many checklists match the filter out of the unfiltered total
- **Breeding Codes:** county and date filters applied to `BreedingCodeRow[]` before re-aggregating species/code matrix
- **Media List (eBird path):** county and date filters applied to `ObservationEntry[]` (eBird path now uses `parseEbirdObservations` instead of `parseLifeList` for row-level county/date access)
- **Media List (ML export path):** county resolved via a 3-tier chain — (1) `County` column in the ML CSV if present; (2) eBird backup cross-reference by location name; (3) `POST /nominatim/counties` reverse geocoding using OpenStreetMap/Nominatim — then county/date filters applied to `MLExportRow[]`
- **Species Detail:** county and date filters applied to `ObservationEntry[]` before all downstream derivations (sightings stats, media, codes, locations, map, comments)
- **Total column (Media List):** `photoCount + audioCount + videoCount`; sortable, defaults descending; column header styled green with 1px left border like the other media columns
- County controls show a "Resolving counties…" spinner while the Nominatim pass is running in the background

**Key files:**
- `backend/routers/nominatim.py` — `POST /nominatim/counties` endpoint; accepts `[{lat, lng}]`; in-process `_cache` dict; `asyncio.Lock()` enforces ≤1 req/sec to OSM; `User-Agent: SnowRaven/1.0`
- `frontend/src/lib/parseBreedingCodes.ts` — added `BreedingCodeRow`, `rows` field in `BreedingData`, `aggregateBreedingRows()`
- `frontend/src/lib/parseMLExport.ts` — added `MLExportRow`, `rows` field in `MLExportResult`, `aggregateMLRows()`
- `frontend/src/lib/parseEbirdObservations.ts` — added `county` column read
- `frontend/src/types.ts` — added `DateRangeState`, `DATE_RANGE_CLEAR`, `county: string | null` to `ObservationEntry`, `'total'` to `SortColumn`
- `frontend/src/components/BreedingCodeList.tsx`, `LifeList.tsx`, `SpeciesDetail.tsx` — filter state, county/date controls, filter strip
- `frontend/src/components/LifeListTable.tsx` — Total column header and cell; `'total'` sort case

### Species Detail Visualizations (complete — May 2026)

Two new visualization sections added to the Species Detail tab.

**Sightings Over Time graph:**
- Recharts `LineChart` with `ResponsiveContainer` renders a full-width time-series graph below the Graph Options card and above the Breeding Codes section
- Shows individuals per year (or per month) on its own y-axis — no media lines on this chart
- Interval is controlled by the Graph Options card (explicit `interval` parameter — no auto-detection)
- Per Period / Cumulative view: cumulative view computes a running sum in a `displayData` useMemo; shared with the Media Over Time graph
- Graph returns `null` (section absent) when fewer than 2 distinct time periods exist
- All colors via `var(--sr-graph-*)` tokens (added to both `:root` and `[data-theme="dark"]`)
- Fully filter-reactive: uses `speciesObs` (already county/date filtered) and `speciesMlRows` (filtered by species + date range)

**Media Over Time graph:**
- A second `LineChart` below "Sightings Over Time" with its own independent y-axis
- Shows Photo / Audio / Video item counts per period as separate lines
- Appears only when ML is loaded and the species has at least one media item; suppressed when all counts are zero
- Shares `viewMode` state and `displayData` with the sightings graph

**Map heatmap toggle:**
- Pins / Heatmap segmented toggle in the Sighting Locations map section header
- Heatmap mode: MapLibre's native `heatmap` layer via `HeatmapLayer` (`components/speciesDetail/HeatmapLayer.tsx`) — a GeoJSON `Source` of points whose weights already fold in observation count × intensity (`heatWeight`), with paint driven by the shared intensity model in `lib/heat.ts` (`heatRadiusPx` / `heatIntensityFactor`)
- Each coordinate weighted by observation count at that location (from `coordMarkers[].sightings.length`)
- Individual markers hidden in heatmap mode (`mapMode === 'pins'` guard)
- Resets to Pins on species change (via `setMapMode('pins')` in `selectSpecies()`)
- Toggle and heatmap absent when no coordinate data (entire map section guarded by `coordMarkers.length > 0`)

**Key files:**
- `frontend/src/lib/sightingsGraph.ts` — `buildGraphData(obs, mlRows, interval)` pure function; `GraphPoint` type (includes `checklists` field); `GraphInterval = 'weekly' | 'monthly' | 'yearly'`; ISO week helpers `isoWeekKey()` and `mondayOfISOWeek()`; returns `{ data: GraphPoint[]; interval: GraphInterval }`
- `frontend/src/lib/sightingsGraph.test.ts` — 18 unit tests (includes weekly bucketing, gap-fill, checklists field)
- `frontend/src/components/SpeciesDetail.tsx` — `mapMode` state; `speciesMlRows` and `heatPoints` useMemos; `Phase.ready` includes `mlRows: MLExportRow[]`; the map sub-components live in `components/speciesDetail/` (`HeatmapLayer.tsx`, `MapBoundsFitter.tsx`) and the graph components in `components/speciesDetail/SightingsGraph.tsx` (`SightingsGraph` — controlled component receiving `data`, `interval`, `viewMode`, `hasML` props — plus `GraphTooltip`; `formatPeriodLabel` lives in `lib/sightingsGraph.ts`)
- `frontend/src/globals.css` — `--sr-graph-individuals`, `--sr-graph-photo`, `--sr-graph-audio`, `--sr-graph-video` tokens in both themes

### Species Detail — Graph Options and Reported With (complete — May 2026)

Two enhancements to the Species Detail tab.

**Graph Options card:**
- A dedicated `SectionCard` above both graphs that unifies interval and view-mode control
- Replaces the auto-detect interval logic in `buildGraphData` (which previously switched to monthly when `years.size <= 1`) with an explicit user-controlled `interval` state
- Weekly / Monthly / Yearly segmented toggle (left to right): sets `graphInterval` state (`'weekly' | 'monthly' | 'yearly'`); drives `buildGraphData` via the `graphResult` useMemo; Monthly is the default on load and on species change
- Per Period / Cumulative segmented toggle: sets `viewMode` state; all three graphs respond simultaneously
- Card only renders when `hasGraphData` is true (≥2 distinct periods exist)
- `graphInterval` resets to `'monthly'` and `viewMode` resets to `'per-period'` on species change via `selectSpecies()`
- `graphResult` is computed once in the parent via `useMemo` and passed down as props; `SightingsGraph` is a controlled component — no longer owns its own interval state

**Reported With section:**
- A `SectionCard` between Breeding Codes and Top Locations
- Lists species most frequently appearing on the same eBird checklists as the selected species
- Co-occurrence coefficient: `shared_checklists ÷ target_checklists × 100`, rounded to the nearest integer and shown as a percentage
- `coOccurrence` useMemo builds a `Set<string>` of filtered `submissionId`s for O(1) checklist lookup; iterates `phase.observations` once to count shared checklists per co-occurring species
- `normalizeSpeciesName()` applied when `mergeSubspecies` is true; target species excluded from results
- Minimum 2 shared checklists required before a species appears
- Top 10 shown by default; expand/collapse for the full list via `showAllCoOccurrence` state
- Relative bar widths use `(r.pct / maxPct) * 100` scaling so the top result is always full-width; `maxPct ?? 1` prevents division by zero
- Two discriminated union outcomes: `{ type: 'no-data' }` (no valid submissionIds in filtered observations) and `{ type: 'results', results, totalChecklists }` (ranked list)
- Empty results state ("No species met the minimum co-occurrence threshold.") is distinct from no-data state
- Section fully respects active county and date-range filters — `speciesObs` is the source for `targetIds`
- `showAllCoOccurrence` resets on species change via `selectSpecies()`

**Key files:**
- `frontend/src/components/SpeciesDetail.tsx` — `graphInterval`, `viewMode`, `showAllCoOccurrence` state; `graphResult` and `coOccurrence` useMemos; GraphOptions card and Reported With card render blocks; `SlidersHorizontal` and `Share2` icons from lucide-react
- `frontend/src/lib/sightingsGraph.ts` — `interval` parameter replaces auto-detect
- `frontend/src/lib/sightingsGraph.test.ts` — all call sites updated to pass explicit interval

### Settings-First File Model (complete — May 2026)

Removes per-tab file upload from Breeding Codes, Media List, and Species Detail. Settings becomes the sole source of data for all three tabs. Life List Comparer gains a "My List" mode. Weather tab gains key-status notices.

**What it does:**
- **SetupRequired shared component** — when a required file is not configured in Settings, all three data tabs show the same styled guidance screen: an icon ring, a title, a body, a numbered steps card ("How to set this up"), and a "Go to Settings" button that calls `onGoToSettings` to navigate to the Settings tab. All colors via `var(--sr-*)` tokens; icon, card, button style consistent across all three.
- **`setup-required` phase** — replaces `idle` as the "no file configured" state in `BreedingCodeList`, `LifeList`, and `SpeciesDetail`. The distinction from `error`: `setup-required` means no file is stored in Settings; `error` means a file exists but the fetch or parse failed. The `idle` tag is gone from all three tabs.
- **Per-tab upload removed** — `BreedingCodeList`, `LifeList`, and `SpeciesDetail` no longer have drop zones, file input refs, `processFile`, `handleDrop`, `handleFileInput`, or "Load different file" / "Load new file" buttons. Data comes from Settings only.
- **Life List Comparer — My List mode** — on mount, fetches `GET /settings/files` to check for a stored eBird backup. When available, a "My List / Upload a file" tab selector appears above the List A slot. My List mode replaces the drop zone with a styled "Loaded from Settings" card. On Compare, fetches `GET /settings/files/ebird` fresh and passes parsed data as List A. Results use "My List" / "Other List" as labels instead of filenames. `storedEbirdStatus: 'loading' | 'available' | 'unavailable'` state controls the selector visibility.
- **ResultsView label threading** — `listALabel: string` and `listBLabel: string` replace `fileA.filename` / `fileB.filename` throughout the stats bar and panels. `fileA` and `fileB` props removed from `ResultsView`.
- **Weather tab key notices** — App.tsx fetches `GET /settings/keys` on mount and stores `keyStatus: { ebird: string | null; openweather: string | null } | null`. When either key is null, an amber warning card appears above the checklist input card with a "Go to Settings →" link. `onKeysSaved` callback re-fetches key status when settings change.

**Key files:**
- `frontend/src/components/SetupRequired.tsx` — new shared setup guidance component
- `frontend/src/components/BreedingCodeList.tsx` — upload removed; `setup-required` phase; `onGoToSettings` prop
- `frontend/src/components/LifeList.tsx` — upload removed; `setup-required` phase; `onGoToSettings` prop
- `frontend/src/components/SpeciesDetail.tsx` — upload removed; `setup-required` phase; `onGoToSettings` prop
- `frontend/src/components/ListComparer.tsx` — My List mode; `storedEbirdStatus` state; async `handleCompare`
- `frontend/src/components/ResultsView.tsx` — `listALabel`/`listBLabel` props replace `fileA`/`fileB`
- `frontend/src/components/Settings.tsx` — `onKeysSaved?: () => void` prop
- `frontend/src/App.tsx` — `keyStatus` state + fetch; key notices in Weather panel; `onGoToSettings` passed to three tabs; `onKeysSaved` passed to Settings

### Breeding Code Category Filters (complete — May 2026)

Three category filter pills — Confirmed, Probable, and Possible — added to the Breeding Codes tab filter row. Each pill selects all codes in that eBird evidence category with one click. Individual code pills remain fully functional alongside them.

**What it does:**
- "Confirmed" pill selects all tier 3 + 4 codes (NY NE FS FY CF FL ON UN DD NB CN) — any species with at least one of these qualifies
- "Probable" pill selects all tier 2 codes (PE B A N C T P M S7)
- "Possible" pill selects all tier 1 codes (S H F)
- Filter logic: OR within each active category, AND across active categories and individual code pills
- Multiple categories can be active simultaneously
- "All" clears both category filters and individual code filters
- A category pill is hidden when none of its member codes appear in the loaded data
- Category pills are text-only (no tier dot) and appear between "All" and the individual code pills

**Key files:**
- `frontend/src/lib/breedingCodes.ts` — `BreedingCategory` type and `CATEGORY_CODES` constant added (derived programmatically from `BREEDING_CODES` tier field)
- `frontend/src/lib/breedingCodes.test.ts` — 8 tests covering category membership, disjointness, and full coverage
- `frontend/src/components/BreedingCodeList.tsx` — `categoryFilter` state, `categoryPillStyle`, `CATEGORY_META`, updated filter predicate, `categoryFilteredEntries` passed to `BreedingCodeTable`

### Is Target Filter and Map Icons (complete — May 2026)

Two coordinated changes that make the "Is Target" concept first-class across the Media List and Map Explorer tabs.

**Expanded targeting model:**
- A species is now a "target" if it is missing at least one of Photo, Audio, or Video (previously: zero ML entries of any type)
- Partial-coverage species (e.g. has Photos but no Audio) now qualify as targets everywhere in the app
- The `mediaTypes: Map<string, Set<'Photo'|'Audio'|'Video'>>` useMemo (built from `phase.mlRows`) is the single source of truth for what each species HAS; `!hasAll` (missing all three) is the target condition

**Media List — "Is Target" filter pill:**
- New pill immediately after "Has media," before the first `pillSep`
- Amber styling: `var(--sr-is-target-bg)` / `var(--sr-is-target-text)` / `var(--sr-is-target-border)` — tokens added to both `:root` and `[data-theme="dark"]` in `globals.css`
- Filter logic: `!photo || !audio || !video` on per-species catalogIds against `mediaMap`
- Combines with all other pills using AND logic; "All" resets it alongside all others
- State: separate `filterIsTarget: boolean` (not part of `MediaFilterState`), following the same pattern as `filterHasMedia`

**Map Explorer — per-species missing-type icons on target pins:**
- `DisplayTargetPin = TargetPin & { missingTypes: ('Photo'|'Audio'|'Video')[] }` — client-side computed in `displayedTargetPins` useMemo
- `MEDIA_ICONS` record: hardcoded 10px SVG strings (camera, mic, video camera) using `stroke="currentColor"` — no user data
- `TargetMarkers` groups pins by `locId` to prevent overlapping labels; single-species: name + icons; multi-species: "N species" with a popup listing all species and their missing types
- Icon gap: 3px between icons, 5px margin-left from species name; `display: inline-flex; align-items: center`
- Sidebar sub-label updated: "from ML export · missing ≥1 media type"

**Cross-tab navigation:**
- "N target species" button in Map Explorer sidebar calls `onNavigateToMediaList: () => void` prop
- `App.tsx` holds `mediaListFilter: 'is-target' | undefined` — `navigateToMediaList` sets tab + filter simultaneously
- `LifeList` receives `requestedFilter?: 'is-target'` and `onRequestedFilterConsumed?: () => void` — a `useEffect` watching `requestedFilter` activates the pill then calls the callback to reset App's filter to `undefined` (single-use delivery)
- LifeList uses display toggling (never unmounts), so the `useEffect` fires immediately on prop change

**Key files changed:**
- `frontend/src/App.tsx` — `mediaListFilter` state, `navigateToMediaList` and `resetMediaListFilter` callbacks, prop threading to LifeList and MapExplorer
- `frontend/src/components/LifeList.tsx` — `filterIsTarget` state, `useEffect` for `requestedFilter`, "Is Target" pill, `isTargetFilteredEntries` filter pipeline
- `frontend/src/components/MapExplorer.tsx` — `DisplayTargetPin` type, `MEDIA_ICONS` constant, updated `targetSpecies` useMemo, updated `fetchTargetCodes` callback, updated `displayedTargetPins` useMemo, `TargetMarkers` location grouping, clickable target count button, updated sub-label
- `frontend/src/globals.css` — `--sr-is-target-bg/text/border` tokens in both `:root` and `[data-theme="dark"]`

### Map Explorer (complete — May 2026)

An interactive map tab with three view modes for exploring birding locations: sightings heatmap, eBird hotspot discovery, and media target hunting. (A fourth mode, the **Nearby Lifers Map**, was added in v0.5.35 — see the Nearby Lifers Map entry near the top.) All map data comes from eBird API calls made at query time; the stored eBird backup is used client-side to classify which hotspots have been visited and to supply personal locations.

**Three view modes:**
- **My Sightings** — fetches recent personal observations via `GET /map/recent-obs`, plots circle markers colored green, and overlays a heatmap. Requires eBird API key (a missing key shows the in-sidebar `KeyNotice` warning); a missing eBird backup shows the `SetupRequired` panel in place of the map. Supports species code filter (All, any species from the backup's distinct codes), breeding status filter (All/Confirmed/Probable/Possible/None), and date range filter. Distance filter for personal locations in radius miles. **Heatmap intensity slider (v0.5.1):** a 1–10 slider (heatmap mode only) scales the MapLibre `heatmap` layer's kernel radius (18→72 px), global intensity factor (0.06→0.60), and per-point weight (obs divisor 20→2) together, so high intensity makes even sparse low-count sightings burn hot; the shared model lives in `lib/heat.ts` (`heatRadiusPx` / `heatIntensityFactor` / `heatWeightDivisor` / `heatWeight`), applied as paint properties/expressions in `components/map/SightingMarkers.tsx`. **Point Size control (v0.5.53):** a Normal / Small / Off `SegControl` under the Pins/Heatmap toggle (Pins mode only, session-only) — Small shrinks the sighting points, Off hides them and their click/popup target so a shaded breeding-block or county choropleth reads through; it composes with the shade auto-dim, sizing is single-sourced in `lib/mapPins.ts` (`POINT_SIZE_RADIUS_FACTOR` + a `factor` arg), and the heatmap is unaffected.
- **Hotspots** — fetches regional hotspots via `GET /map/hotspots` (lat/lng/dist parameters). Classifies each as visited (green teardrop), unvisited (blue teardrop), or personal (orange star) using `visitedLocIds` derived from the stored backup. Address search above lat/lng fields. Legend rows are clickable to hide/show each pin category; opacity drops to 40% when hidden; state resets on each new fetch. Clicking the Hotspots tab button re-centers the map to the saved default location and auto-triggers a fetch if coordinates are set.
- **Media Targets** — fetches recent sightings (`back=30`) for target species. Pins are color-coded green by recency tier (≤7 days / 8–15 days / 16–30 days). Address search above lat/lng. Last 30 Days / Last Week toggle filters pins client-side. Nearest-10 sidebar list ranked by haversine distance from center. Each popup shows a "View checklist {subId}" link when a valid subId is available. Clicking the Media Targets tab button re-centers the map and auto-triggers a fetch (when `phase.tag === 'ready'` and fetch is not disabled).

**Address geocoding (both Hotspots and Media Targets):**
- `AddressSearch` sub-component renders a text input + search icon button above the lat/lng fields
- Calls `GET /nominatim/search?q={q}` on Enter or button click
- On success: populates lat/lng state and immediately triggers the mode's data fetch (override params bypass stale state)
- On no results: "No location found. Try a different search term." inline
- On network error: "Location search failed. Try again or enter coordinates manually." inline

**Recency tiers (Media Targets):**
- Three CSS tokens: `--sr-map-target-fresh` (≤7d), `--sr-map-target-mid` (8–15d), `--sr-map-target-old` (16–30d), `--sr-map-target-old-text` (text on old-tier pills)
- `recencyTier(recentDate)` pure helper; `tierColors(tier)` returns `{bg, text}` CSS-var strings
- Popup: species name, 📍 location, date + days-ago label, tier badge, checklist link (when `subId` matches `/^S\d+$/`)

**Nearest-10 list:**
- `nearest10` useMemo sorts `displayedTargetPins` by `distanceMiles()` (already in file), slices to 10
- Each row: tier dot + species name + location + distance (1 decimal, " mi")
- Clicking sets `panTarget` state; the `MapEffects` child inside `SnowMap` (`components/map/MapControls.tsx`) calls `map.flyTo()`

**Mobile layout (≤640px):**
- The 268px sidebar is hidden from the flex flow by default; map fills 100% width
- A green "Filters" pill button (`sr-map-filters-btn`) floats at `bottom: 20px; right: 16px; z-index: 1050` over the map
- Tapping Filters sets `sidebarOpen: true`; sidebar gains class `sr-map-sidebar-overlay` (absolute, `width: min(282px, 90vw)`, `z-index: 1200`)
- A dark backdrop (`sr-map-backdrop`, `rgba(0,0,0,0.42)`, `z-index: 1100`) appears behind the sidebar; tapping it calls `setSidebarOpen(false)`
- Sidebar header shows "Map Filters" title + circular close button (`sr-map-sidebar-close`); close button calls `setSidebarOpen(false)` with `aria-label="Close filters"`
- Filters button has `aria-label="Open map filters"` and is only rendered (not just hidden) when `!sidebarOpen`; z-index 1050
- All breakpoint logic is CSS-only (`@media (max-width: 640px)` in globals.css); no JS window-width checks
- `display: flex`, `flex-direction: column`, and `overflow: hidden` live in the `.sr-map-sidebar-overlay` CSS base class — NOT as inline styles. This is critical: inline styles override CSS class `display: none`, which would prevent the hidden state from working
- Desktop (>640px): `sr-map-sidebar-overlay` has no absolute positioning; sidebar stays in the flex row at 268px; Filters button is `display: none`; `sidebarOpen` is never true (no button to trigger it)

**Default Location (Settings):**
- `GET /settings/map-defaults` on MapExplorer mount; on 200, sets `lat`, `lng`, and `radius` state (shared by all three modes) AND sets `defaultCenter` state to trigger a map pan; on 404/error, no-op
- Default-center handling lives in `MapEffects` (`components/map/MapControls.tsx`) — a null-rendering child inside `SnowMap`; calls `map.flyTo({ center, zoom, duration: 0 })` once when `defaultCenter` is set, then clears it via `onDefaultDone`; zoom derived from radius via `radiusToZoom()` (≤5 mi → 12, ≤10 → 11, ≤25 → 10, >25 → 9); also triggered when the user clicks the Hotspots or Media Targets tab button (re-sets `defaultCenter` from the current lat/lng/radius state)
- Settings → Default Location section: lat/lng/dist inputs + Save + Clear + "✓ Saved" chip (2500ms auto-hide)
- Save: `POST /settings/map-defaults {lat, lng, dist}`; validates in-range before calling API
- Clear: `DELETE /settings/map-defaults`; resets inputs to blank; button disabled when no defaults are stored
- Settings also fetches `GET /settings/map-defaults` on mount to pre-fill inputs if saved
- Data stored in `data/map-defaults.json` (fixed filename, follows established `data/` pattern)

**Sidebar (all modes):**
- 268px fixed-width panel; tab-specific controls and a scrollable list of results
- Legend section in Hotspots shows the three pin types with clickable toggle buttons

**Backend:**
- `GET /map/hotspots` — proxies `api.ebird.org/v2/ref/hotspot/geo`; returns eBird JSON directly; requires `EBIRD_API_KEY`; 10s httpx timeout
- `GET /map/recent-obs` — proxies `api.ebird.org/v2/data/obs/geo/recent` with `back=30`; groups by `(speciesCode, locId)`; response includes `subId` from the most recent observation in each group; requires `EBIRD_API_KEY`
- `GET /nominatim/search` — forward geocodes a place name via Nominatim OSM; shares `_rate_lock` (≤1 req/sec) and `User-Agent: SnowRaven/1.0` with the existing reverse geocoding endpoint

**Layout:**
- Tab panel uses `height: calc(100vh - 178px)` (not `flex: 1`) and `overflow: hidden` — see the corresponding decision entry
- No `sr-panel` wrapper or padding; the map area (`SnowMap`) fills the right side with `flex: 1`
- In My Sightings mode with no eBird backup stored (`setup-required`), a `SetupRequired` panel replaces the map area itself; Hotspots and Media Targets still render the map (the personal-sightings markers are simply gated off while `setup-required`)

**Location access ("Use my location" button — v0.3.22, fixed v0.3.23):**
- `CenterPointControl` sidebar section contains a "Use my location" button; clicking it calls `handleUseMyLocation`
- `handleUseMyLocation` calls `getCurrentLocation()` from `frontend/src/lib/location.ts`; on success sets `lat`/`lng` state, calls `setPanTarget` to re-center the map, sets `detectedLocation` to show a blue dot at the detected position (`DetectedLocationPin`, a DOM `<Marker>` in `components/map/MapControls.tsx`), and auto-triggers the active view's fetch if coords were previously empty; editing the lat/lng inputs manually clears `detectedLocation`
- `isLocating` state drives loading UI: spinner (`Loader2`) + "Locating…" label while request is in flight; button disabled during request
- Error codes: `permission-denied` (platform-specific message), `timeout`, `dev-mode` (Tauri dev mode), `insecure-context` (HTTP origin on web), `unavailable` (fallback)
- **Tauri desktop path:** calls `invoke('get_location')` — a native Rust command in `src-tauri/src/location.rs` that uses `CLLocationManager` directly via `objc2-core-location`. `navigator.geolocation` cannot work in Tauri because wry's `WKWebView` UIDelegate does not implement `webView:requestGeolocationPermissionFor:`, the method macOS 12+ requires to show the system permission dialog. `com.apple.security.personal-information.location` entitlement is required under hardened runtime and is embedded via `src-tauri/entitlements.plist`.
- **Tauri dev mode:** `invoke` is skipped; `dev-mode` error shown immediately (CLLocationManager requires a signed production build with the entitlement embedded).
- **Web path:** checks `!window.isSecureContext` first — on HTTP origins (e.g. Pi on LAN), browsers silently deny geolocation without prompting; shows "requires HTTPS" message. On secure origins, uses `navigator.geolocation`.
- `tauri-plugin-geolocation` remains registered for future iOS/Android use; its macOS desktop implementation is a no-op stub and is not used.
- `src-tauri/Info.plist` contains `NSLocationWhenInUseUsageDescription` — required for the macOS system permission dialog.

**Key files:**
- `frontend/src/components/MapExplorer.tsx` — full tab component; `sidebarOpen` state; `Filter`, `X` icons; defaults fetch on mount; mobile overlay layout in JSX
- `frontend/src/lib/location.ts` — `getCurrentLocation()` async function; `Location` and `LocationError` types; four error codes
- `frontend/src/components/Settings.tsx` — `MapDefaultsRow` state + handlers + Default Location section at bottom of return
- `backend/routers/mapdefaults.py` — three `/settings/map-defaults` endpoints with Pydantic validation
- `backend/routers/map.py` — two eBird proxy endpoints; `back=30` and `subId` capture
- `backend/routers/nominatim.py` — `GET /nominatim/search` forward geocoding endpoint
- `backend/tests/test_mapdefaults_router.py` — 11 tests covering GET/POST/DELETE, validation, overwrite, boundaries
- `frontend/src/globals.css` — `.sr-map-content`, `.sr-map-sidebar-overlay`, `.sr-map-filters-btn`, `.sr-map-sidebar-close`, `.sr-map-backdrop` + mobile media query overrides; eight map color tokens
- `data/map-defaults.json` — written by POST, deleted by DELETE; absent = no defaults saved
- `frontend/vite.config.ts` — `/map` and `/nominatim` proxies; `/settings` already proxied, covers `/settings/map-defaults`
- `frontend/src/App.tsx` — `'map-explorer'` tab
- `src-tauri/src/location.rs` — `get_location` Tauri command; `CLLocationManager` + `LocationDelegate` via `objc2-core-location`; `thread_local` `LOCATION_SESSION` keeps manager/delegate alive during async callback
- `src-tauri/entitlements.plist` — `com.apple.security.personal-information.location` for hardened runtime
- `src-tauri/Info.plist` — `NSLocationWhenInUseUsageDescription` for macOS location permission dialog
- `src-tauri/capabilities/default.json` — `geolocation:allow-check-permissions`, `geolocation:allow-request-permissions`, `geolocation:allow-get-current-position` (for future iOS/Android)

### Map Explorer — Atlas Blocks + Nearest Unvisited Hotspots (complete — June 2026, v0.5.0)

Two additions to the Map Explorer Hotspots mode.

**California atlas blocks overlay:**
- An "Atlas blocks" toggle (in the Hotspots panel, between the legend and the nearest list) overlays official California Breeding Bird Atlas block boundaries. Default off; data lazy-loads on first enable.
- **Geometry is generated at runtime, not bundled.** The blocks are a regular grid (USGS 7.5' quad / 6, 2 cols × 3 rows). The bundled asset `frontend/src/assets/ca-atlas-blocks.json` is a compact gazetteer — one record per quad `{ sw:[lat,lng], name, id, pos? }` (2,878 quads, ~160 KB raw / 34 KB gz, lazy chunk). `generateBlocks()` expands each quad into its 6 named block rectangles; `pos` lists present positions for the 232 partial edge quads. Verified an exact 1:1 match with the 16,527 official blocks.
- Generated from the official KML by `scripts/convert-atlas-blocks.mjs` (dependency-free, one-off). Block code (quad `id` + position, e.g. `32117F2CE`) drives the eBird link `https://ebird.org/atlascalifornia/block/<code>`.
- `AtlasBlockLayer.tsx` (react-leaflet child) renders only viewport-intersecting blocks via `blocksInBounds`; a ~400-feature cap shows a "Zoom in to see atlas blocks" hint; outside California nothing draws. Outline style via `.sr-atlas-block` + `--sr-map-atlas` token; **transparent fill (`fillOpacity:0`) makes block interiors clickable** (a name→eBird-link popup). Offline-capable, no runtime third-party fetch.

**Nearest unvisited hotspots:**
- `nearestUnvisited` memo lists the 10 closest `kind:'unvisited'` hotspots by distance (reusing `distanceMiles`); rendered below the legend as links to `https://ebird.org/hotspot/{locId}`.

**Key files:**
- `frontend/src/lib/atlasBlocks.ts` (+ `.test.ts`, 11 cases) — `generateBlocks`, `blocksInBounds`, types
- `frontend/src/components/AtlasBlockLayer.tsx`, `MapExplorer.tsx` (toggle + state + nearest list)
- `frontend/src/assets/ca-atlas-blocks.json`, `scripts/convert-atlas-blocks.mjs`, `globals.css` (`--sr-map-atlas`, `.sr-atlas-block`)

*Superseded by the v0.5.9 MapLibre migration — the overlay now renders as GL `fill`/`line` layers in `AtlasLayer.tsx` (`AtlasBlockLayer.tsx` is gone), viewport-capped at 9,000 blocks via `blocksInBounds` + `padBounds(0.15)` recomputed on `moveend`. The gazetteer asset, `generateBlocks` geometry, block-code → eBird-link scheme, and clickable transparent interiors (a `fill-opacity: 0` MapLibre fill is still hit-tested) all carry over. See the v0.5.9 entry below and CLAUDE.md → "Overlays and stacking".*

### Map Explorer — Shade Atlas Blocks by Your Highest Breeding Code (complete — June 2026, v0.5.2)

Extends the atlas overlay so it can be tinted by the user's own breeding evidence, and surfaces the whole overlay in every map view.

**Shade by My Highest Breeding Code:**
- When the atlas blocks overlay is on, a "Shade by My Highest Breeding Code" toggle (default off) tints each block by the strongest breeding code the *user* has personally entered there — never a community aggregate. Disabled with a "Load your eBird backup in Settings" hint when no backup is loaded.
- **Client-side spatial join.** `buildBreedingByBlock(data, observations)` (in `atlasBreeding.ts`) does one pass over the loaded eBird observations: each obs with a recognized breeding code + coords is assigned to its atlas block via `pointToBlockCode` (quad-grid arithmetic in `atlasBlocks.ts`: snap to quad SW corner through `buildQuadIndex`, compute col/row, return `quad.id` + position code). Each block keeps the strongest code (lowest rank in `BREEDING_CODES`) and a total count of the user's breeding records there. Only blocks with ≥1 personal breeding record are returned. No backend, no network.
- Shaded blocks render with a real fill (so interiors stay clickable); the popup adds "Highest breeding code: {label} ({code})" and "{N} of your breeding records (any level) in this block". Tier colors reuse `--sr-tier-1..4` purples (Confirmed darkest → Observed lightest), light/dark via tokens.

**Use Textures (colorblind accessibility):**
- A separate "Use Textures" toggle (default off) overlays a distinct hatch pattern per breeding tier so levels are distinguishable in grayscale, without relying on color. Off by default because hatches reduce base-map legibility; opt in for color-independent reading.
- `AtlasTierPatterns.tsx` injects a hidden SVG `<defs>` with four `<pattern>`s (`sr-atlas-tier-1..4`): sparse dots (tier 1) → single diagonal (tier 2) → spaced cross-hatch (tiers 3, 4). Pattern colors use `rgba(var(--sr-tier-N-rgb), α)` so they track the theme. Spacing/alpha tuned over several live iterations to keep map labels readable. `globals.css`: `.sr-atlas-tier-N { fill: url(#sr-atlas-tier-N) }` (textured) and `.sr-atlas-fill-N` (flat translucent color) — Leaflet writes `fill` as an attribute where `var()` won't resolve, so the CSS class carries the `url(#…)`/rgba.

**Overlay in all three map views + wider zoom reach:**
- The atlas controls (blocks toggle + shade toggle + Use Textures toggle + legend) were extracted into one shared `atlasOverlayControls` block in `MapExplorer.tsx` and rendered in My Sightings (bottom of panel, below Map View), Hotspots (mid-panel), and Media Targets (above Nearest Targets). State (`shadeByBreeding`, `useTextures`) is shared across modes; `breedingByBlock` is a `useMemo` over the loaded observations.
- `AtlasBlockLayer.tsx` per-feature `style` switches between textured class, flat-fill class, and outline-only (`fillOpacity:0`); the feature `cap` was raised 400 → 5000 so blocks are visible from higher zoom levels.

**Key files:**
- `frontend/src/lib/atlasBreeding.ts` (+ `.test.ts`) — `buildBreedingByBlock`, `BlockBreeding`, `BreedingObs`
- `frontend/src/lib/atlasBlocks.ts` — `buildQuadIndex`, `pointToBlockCode`, `gridSnap` (+ tests)
- `frontend/src/components/AtlasTierPatterns.tsx` — per-tier SVG pattern `<defs>`
- `frontend/src/components/AtlasBlockLayer.tsx` — shaded/flat/outline styles, breeding popup fields, cap 5000
- `frontend/src/components/MapExplorer.tsx` — shared `atlasOverlayControls` in all three sidebars, shade/texture state
- `frontend/src/globals.css` — `.sr-atlas-tier-1..4` (pattern fills), `.sr-atlas-fill-1..4` (flat fills)

*Superseded by the v0.5.9 MapLibre migration — the SVG `<pattern>` hatches (`AtlasTierPatterns.tsx`, removed) became canvas-baked raster sprites (`lib/atlasTextures.ts`) registered via `map.addImage` and referenced from `fill-pattern`, regenerated on theme change. The shade-by-breeding data model (`atlasBreeding.ts`, `pointToBlockCode`) is unchanged. See the v0.5.9 entry below and CLAUDE.md → "Overlays and stacking".*

### Heatmap Intensity Parity + Desktop Clipboard Auto-Copy (complete — June 2026, v0.5.3)

Two parity improvements (Improve lane).

**Heatmap intensity on Species Detail:**
- The Species Detail Sighting Locations map's Heatmap mode gained the same 1–10 "Heatmap Intensity" slider as the Map Explorer's My Sightings map (shown only in Heatmap mode, in the map section header). Default 5; resets to 5 on species change.
- The heat math is now shared in `frontend/src/lib/heat.ts` (`heatRadius`, `heatBlur`, `heatMax`, `heatWeight`, `HEAT_INTENSITY_DEFAULT`) — single source of truth for both maps, so they behave identically. `MapExplorer.tsx` was refactored to import it (no behavior change).

**Desktop clipboard auto-copy:**
- On a successful weather lookup, the formatted text auto-copies to the clipboard in the macOS and Windows desktop apps, matching the web/Pi client. Previously this silently failed on desktop: the auto-copy runs after the weather `fetch` await, losing the user-activation WKWebView/WebView2 require for the async Clipboard API, so `navigator.clipboard.writeText` threw `NotAllowedError` and was swallowed (the manual Copy button worked because it runs inside a click).
- Fix: a clipboard seam `frontend/src/lib/clipboard.ts` (`copyText()`) using the native `@tauri-apps/plugin-clipboard-manager` on desktop (no gesture requirement) and `navigator.clipboard` + `execCommand` fallback on web. `App.tsx` routes both the auto-copy and the Copy button through it.
- Tauri wiring: `tauri-plugin-clipboard-manager` in Cargo `[dependencies]` (cross-platform), registered in `lib.rs`, capability `clipboard-manager:allow-write-text` (write only — no clipboard read). No permission button needed (no runtime OS prompt for clipboard write).
- Also cleaned the two pre-existing `BirdingStats.tsx` lint warnings (dead `eslint-disable` removed; intentional `exhaustive-deps` omission documented to prevent a nemesis-refetch loop).

**Key files:**
- `frontend/src/lib/heat.ts` (NEW) — shared heatmap intensity model
- `frontend/src/lib/clipboard.ts` (NEW) — clipboard seam (`copyText`)
- `frontend/src/components/SpeciesDetail.tsx` — intensity slider + state; `HeatmapLayer` takes `intensity`
- `frontend/src/components/MapExplorer.tsx` — imports shared `lib/heat.ts`
- `frontend/src/App.tsx` — `handleLookup`/`handleCopy` use `copyText`
- `src-tauri/` — `Cargo.toml`, `src/lib.rs`, `capabilities/default.json` (clipboard plugin)

*The heatmap half is superseded by the v0.5.9 MapLibre migration — both maps now use MapLibre's native `heatmap` layer, and `lib/heat.ts` (still the single shared model) now exports `heatRadiusPx` / `heatIntensityFactor` / `heatWeightDivisor` / `heatWeight`. The clipboard-seam half of this entry is still current. See the v0.5.9 entry below.*

### macOS Universal Binary — Intel Mac Support (complete — June 2026, v0.5.5)

The macOS desktop app now ships as a single **universal** binary that runs
natively on both Apple Silicon and Intel Macs, replacing the previous
Apple-Silicon-only build (Intel users could not run the app or get updates).

- `release.sh` builds `--target universal-apple-darwin` → one
  `SnowRaven_<ver>_universal.dmg` and one updater bundle.
- `latest.json` maps both `darwin-aarch64` and `darwin-x86_64` to that
  universal updater bundle, so the in-app updater serves Intel Macs too.
- Build requires both Rust targets (`aarch64-apple-darwin`,
  `x86_64-apple-darwin`); `release.sh` preflights and aborts if missing.
- See DECISIONS.md (universal-vs-separate) and CLAUDE.md (build/`latest.json`
  specifics, incl. the `darwin-x86_64` key requirement).

### Documentation Accuracy & Completeness Pass (complete — June 2026, v0.5.6)

Audited `docs/HELP.md` (the in-app Help) and `README.md` against the
v0.5.5 app and fixed all drift: Help intro now includes Windows; the
atlas-shading copy no longer references a non-existent "Observed" tier
(levels are Confirmed/Probable/Possible per `breedingCodes.ts`); file-
storage wording is platform-neutral; My Sightings documents its County/
Media/Radius controls; added the desktop "Rebuild caches" troubleshooting
and "Updating SnowRaven" sections; and the README security note is scoped
to the Raspberry Pi / self-hosted install. Shipped as a patch so the
bundled in-app Help reaches desktop users (see DECISIONS.md — bundled Help).

### Maps — Keyless Basemap Upgrade + Layer Switcher (complete — June 2026, v0.5.7)

Replaced the default OpenStreetMap tiles (against OSMF policy for self-hosted
apps) with a clean **CARTO Positron** base across all maps, and added a
brand-styled, keyless layer switcher.

- **Shared module** `frontend/src/lib/basemaps.ts` — every keyless tile provider
  (CARTO Positron, Esri World Imagery, USGS National Map, Waymarked Trails) in
  one place, with per-provider attribution, tile-coordinate order, maxZoom, and
  a backdrop `voidColor`.
- **`MapBaseLayers.tsx`** — shared component used by all three maps. `switcher`
  prop renders a portal-based Leaflet control (so the React UI is genuinely
  brand-styled, not Leaflet's stock box) with a segmented base selector
  (Map / Satellite / Topo (US)) + a Trails overlay toggle. The selection
  persists via the storage seam, and the map's `--sr-map-void` backdrop is set
  to match the active base (light for Positron/Topo, dark for Satellite).
- **Placement:** switcher on Map Explorer + Species Detail; Statistics map uses
  Positron only (overview, keeps numbered markers legible).
- **Positron rendering:** @2x source displayed at 256 px → native scale, crisp
  on high-DPI. (Tried a 2× label-scaling trick and CARTO Voyager during review;
  Dave preferred Positron's minimal native look.)
- **Privacy:** `PRIVACY_POLICY.md` gained a "Map Tiles" section disclosing the
  providers (closed a pre-existing gap that never listed even the OSM tiles).
- All keyless — no accounts, keys, or billing. Honest limits: keyless ≠
  contractually unlimited (CARTO/Esri); USGS Topo is US-only; vector basemap
  (MapLibre + OpenFreeMap) deferred. See DECISIONS.md + CLAUDE.md.

**Key files:**
- `frontend/src/lib/basemaps.ts` (NEW), `frontend/src/components/MapBaseLayers.tsx` (NEW)
- `MapExplorer.tsx`, `SpeciesDetail.tsx`, `BirdingStats.tsx` (use `<MapBaseLayers>`)
- `frontend/src/globals.css` (`.sr-map-layers*` switcher styles; `--sr-map-void` default)
- `PRIVACY_POLICY.md`, `docs/HELP.md`, `README.md`

*Superseded by the v0.5.9 MapLibre migration — `lib/basemaps.ts` and `MapBaseLayers.tsx` were replaced by `lib/mapStyle.ts` + the `SnowMap` wrapper; the default base is now the OpenFreeMap vector style (positron, tuned in `fetchTunedBaseStyle`), with Satellite (Esri) / Topo-US (USGS) / Trails (Waymarked) as raster layers toggled by `visibility` inside the one persistent style. The keyless stance, the persisted base/overlay choice, and the PRIVACY_POLICY.md "Map Tiles" disclosure rule all still stand. See the v0.5.9 entry below.*

### Maps — MapLibre Vector Migration (complete — June 2026, v0.5.9)

All three maps (Map Explorer, Species Detail, Statistics) moved from Leaflet + raster tiles to **MapLibre GL** via `react-map-gl` (entry `react-map-gl/maplibre`); Leaflet, react-leaflet, and leaflet.heat were removed entirely. The default base is the **OpenFreeMap** vector style (positron); Satellite/Topo/Trails remain as raster layers toggled by `visibility` within the one persistent style. Everything carried over: the layer switcher, the atlas overlay (GL fill/line layers + canvas-baked hatch sprites in `lib/atlasTextures.ts`), heatmaps (native `heatmap` layer driven by the shared `lib/heat.ts` model), and the popups (a single state-driven `<Popup>` per map, escaped JSX). The shared wrapper is `components/SnowMap.tsx`, with styles/providers in `lib/mapStyle.ts` (including the `VOID_COLOR` placeholder shown while the style loads); the Map Explorer fullscreen toggle shows at all widths since this release.

This is the anchor for the "*Superseded by the v0.5.9 MapLibre migration*" notes on the earlier map entries in this file. **CLAUDE.md → "Overlays and stacking" is the canonical, current description of the map stack** (GL marker layers, atlas viewport cap, heat model, popup/security contracts); DECISIONS.md "Vector basemap: Leaflet → MapLibre GL + OpenFreeMap — 2026-06-04 (v0.5.9)" records the rationale.

### Map Explorer — Mobile Fullscreen + Ocean-Tone Backdrop (complete — June 2026, v0.5.4)

Improve-lane mobile usability pass on the Map Explorer.

**Mobile fullscreen toggle:**
- On screens ≤640px, a circular fullscreen (maximize) button appears next to the floating Filters button in all three Map Explorer modes. Tapping it expands the map to fill the entire viewport — the app header, tab dropdown, and mode tabs are hidden — for maximum map area on a phone. Tapping the minimize icon restores the normal layout.
- Implemented as a CSS overlay (not the browser Fullscreen API, which is unreliable in iOS Safari/WKWebView): `mapFullscreen` state in `App.tsx` switches the Map Explorer `tabpanel` to `position: fixed; inset: 0; width: 100vw; height: 100dvh; z-index: 1200; background: var(--sr-bg)`. `100dvh` accommodates the mobile browser toolbar.
- The toggle and Filters button share a mobile-only flex cluster (`.sr-map-fab-cluster`, shown only ≤640px) so they sit side-by-side without overlap regardless of label width.
- Edge handling: background scroll locked while fullscreen (cleared on exit/tab-leave); the in-map "Go to Settings" and "target species" navigations clear fullscreen so no other tab inherits the overlay. Button is keyboard-focusable with `aria-pressed`.

**Ocean-tone map backdrop:**
- Leaflet's default container background is a flat grey (`#ddd`) that shows as bands around the world map when zoomed out or before tiles load. Now tinted to the OSM ocean tone via a new `--sr-map-void` token so uncovered areas read as sea.
- The override uses a doubled-class selector `.leaflet-container.leaflet-container` to outrank Leaflet's own rule, which bundles after `globals.css` and ties on specificity.

**Key files:**
- `frontend/src/App.tsx` — `mapFullscreen` state, fixed-overlay panel style, scroll-lock effect, props to MapExplorer, fullscreen-clearing nav callbacks
- `frontend/src/components/MapExplorer.tsx` — `isFullscreen`/`onToggleFullscreen` props; fullscreen button in the `.sr-map-fab-cluster`
- `frontend/src/globals.css` — `.sr-map-fab-cluster`, `.sr-map-fullscreen-btn`, `.leaflet-container.leaflet-container` backdrop, `--sr-map-void` token (both themes)

*The backdrop half is superseded by the v0.5.9 MapLibre migration (entry above) — the `.leaflet-container` override is gone; the backdrop now comes from the MapLibre style's own `background` layer, with a `VOID_COLOR` placeholder (`lib/mapStyle.ts`) only while the style loads. The fullscreen CSS-overlay mechanism is still current, and since v0.5.9 the toggle shows at ALL widths, not just ≤640px.*

### Species Detail Enhancements — Weekly Interval, Checklists Graph, Frequency Stat (complete — May 2026)

Three additions to the Species Detail tab shipped in v0.1.11.

**Weekly graph interval:**
- "Weekly" is now the first option in the Graph Options toggle (Weekly · Monthly · Yearly); Monthly is the default on every species selection
- `buildGraphData` accepts `'weekly'` as a `GraphInterval` value; ISO week bucketing via `isoWeekKey()` (Thursday determines ISO year; format `YYYY-Www`)
- Gap-fill iterates Monday-by-Monday via `mondayOfISOWeek()` between first and last observed week
- X-axis and tooltip: `2024-W03` → `Wk 3 '24` via updated `formatPeriodLabel(key, interval)`

**Checklists Over Time graph:**
- New `SectionCard` rendered between "Sightings Over Time" and "Media Over Time"
- Plots `GraphPoint.checklists` — count of observation rows (checklist entries) whose date falls in that period
- Same `displayData` / cumulative logic as Sightings; accumulates a running checklist count alongside individuals and media
- Uses `var(--sr-graph-individuals)` at `opacity={0.6}` to visually subordinate it to the individuals line without a new token
- Only renders when `hasGraphData` is true (same guard as Sightings Over Time)

**Frequency statistic:**
- New "Frequency" cell in the Sightings section of the Summary card
- Shows `X%` (rounded) or `<1%` in `var(--sr-accent)` green with a 3px fill bar below
- Sub-label: "of your checklists"
- Denominator: `totalFilteredChecklists` useMemo — unique non-empty `submissionId` values across all observations that pass the active county and date-range filters (filter-aware, same logic as `speciesObs`)
- Numerator: `sightingsStats.total` (species checklist count)
- Hidden when `totalFilteredChecklists` is 0 (no valid submission IDs in scope)

**Key files changed:**
- `frontend/src/lib/sightingsGraph.ts` — `GraphInterval` type exported; `GraphPoint.checklists` added; `isoWeekKey()`, `mondayOfISOWeek()` helpers; weekly gap-fill; returns `{ data, interval }` (breaking change — `useMonthly` removed)
- `frontend/src/lib/sightingsGraph.test.ts` — updated to new API; weekly bucketing, gap-fill, and checklists tests added (18 total)
- `frontend/src/components/SpeciesDetail.tsx` — `graphInterval` state type widened to include `'weekly'`, default changed to `'monthly'`; `totalFilteredChecklists` useMemo; Frequency cell; Graph Options updated; `SightingsGraph` receives `interval` prop (was `useMonthly`)

### Tab Order & Visibility Settings (complete — May 2026)

A section at the bottom of the Settings tab lets users reorder and hide tabs from the tab bar. Preferences are stored per install: on web/Pi in the browser's `localStorage` (each user on a shared install gets an independent layout), and in the desktop app through the `storage` seam (app data directory) so they survive relaunch — WKWebView wipes `localStorage` on every relaunch, so the desktop path must use the seam.

**What it does:**
- Drag to reorder tabs using a six-dot grip handle; the tab bar updates immediately
- Eye / EyeOff button hides or shows each tab; changes take effect instantly with no save button
- Settings tab is always fixed last and cannot be moved or hidden
- At least one tab must remain visible at all times — the eye button disables on the last remaining visible tab
- Hiding the currently active tab auto-switches to the next visible tab (FR-08)
- Preferences survive page reloads and (on desktop) relaunches: web/Pi via `localStorage` key `sr-tab-layout`, desktop via the `storage` seam (`tabLayout` setting), hydrated on mount
- "Restore defaults" button resets order and visibility to the original arrangement; shows "✓ Restored" for 1.5s
- Unknown tab IDs in stored data are silently ignored; tabs added after preferences were saved are appended to the end of the stored order (FR-13)
- Falls back to defaults on malformed JSON or missing keys; all localStorage access is wrapped in try/catch for private browsing compatibility (NFR-02)
- No first-paint flash — initial tab bar order is derived synchronously before React's first render using a lazy `useState` initializer (NFR-04)

**Key files:**
- `frontend/src/lib/tabLayout.ts` — `ConfigurableTab`/`Tab` types, `DEFAULT_TAB_ORDER`, `TAB_LABELS`, `TabLayoutState`, `visibleTabs()`, `loadTabLayout()`/`saveTabLayout()`/`clearTabLayout()` (localStorage), and `parseLayout()`/`serializeLayout()` (validation/serialization shared by the localStorage and storage-seam paths)
- `frontend/src/lib/tabLayout.test.ts` — unit tests covering defaults, custom order, hidden tabs, malformed JSON, unknown IDs, missing tab append, roundtrip, clear, localStorage unavailable, `visibleTabs`, and `parseLayout`/`serializeLayout`
- `frontend/src/components/Settings.tsx` — `TabLayoutSection` sub-component with drag-and-drop rows, eye toggles, locked Settings row, and restore button
- `frontend/src/App.tsx` — `tabLayout` and `activeTab` state (both lazy-initialized from `loadTabLayout`); `handleReorder`, `handleToggleVisibility`, `handleRestoreDefaults` callbacks; dynamic tab bar rendering and `<Settings>` prop threading

### Media Card on the Statistics Tab (complete — May 2026)

A new card between Breeding Stats and Other Statistics on the Statistics tab. Visible only when an ML export is loaded. Consolidates media-centric analytics — previously scattered across Other Statistics — into a dedicated card with a portfolio-level chart.

**What it does:**
- Four-series line chart (Photo, Audio, Video, Total) driven by `buildMediaGraphData()` — aggregates all ML rows by period across all species (unlike `buildGraphData`, which is per-species)
- Interval controls: Weekly · Monthly · Yearly · Total; Monthly is the default on every tab load
- Per Period / Cumulative toggle; hidden when Total interval is selected (Total always implies the full cumulative arc as a step-line)
- Total interval: one data point per calendar date with any media, no gap-fill; other intervals gap-fill empty periods with zeros
- Chart suppressed when data spans fewer than 2 distinct periods; rankings still appear
- Three rankings below the chart: Most Photographed, Most Recorded (Audio), Most Filmed (Video) — top 10 each with ML catalog links via `mlCatalogUrl()`
- Entirely absent when no ML export is loaded — no empty state or placeholder

**What changed in Other Statistics:** Most Photographed, Most Recorded, and Most Filmed removed. Other Statistics then contained only Nemesis Birds. *(Superseded in v0.5.35: the Nemesis Birds list was itself removed from the Statistics tab and rebuilt as the Nearby Lifers Map on Map Explorer — see the Nearby Lifers Map entry near the top.)*

**Key files:**
- `frontend/src/lib/sightingsGraph.ts` — `MediaGraphInterval`, `MediaGraphPoint` types, and `buildMediaGraphData(mlRows, interval)` function added; reuses existing `isoWeekKey()` and `mondayOfISOWeek()` helpers
- `frontend/src/lib/sightingsGraph.test.ts` — 9 new tests for `buildMediaGraphData` (170 total)
- `frontend/src/components/BirdingStats.tsx` — `mediaInterval`/`mediaViewMode` useState hooks; `mediaGraphResult`/`mediaDisplayData` useMemos; Media SectionCard JSX
- `frontend/src/globals.css` — `--sr-graph-media-total` token in both `:root` (#64748b) and `[data-theme="dark"]` (#94a3b8)

### Map Explorer Improvements (complete — May 2026)

Two targeted improvements to the Map Explorer tab shipped in v0.1.8.

**Media Target Type Filter:**
- Filter pills (All / Photo / Audio / Video) appear in the Media Targets sidebar after results are fetched, between the target-species count and the Time Range toggle
- Selecting one or more type pills narrows map pins and the nearest-10 list to species missing those specific types — AND logic (`every(t => pin.missingTypes.includes(t))`)
- "All" is the default (empty Set); selecting any type pill deselects All; selecting All resets all type pills
- Species count label next to "Filter by Type" shows `displayedTargetPins.length` (post-filter)
- Empty state: "No targets match this filter."
- Filter resets to All (`setTargetTypeFilter(new Set())`) at the start of `handleFindSightings`
- Active pills use `var(--sr-is-target-bg/text/border)` amber tokens; inactive pills use `var(--sr-surface-subtle)` / `var(--sr-border)` — consistent with the "Is Target" pill in the Media List tab
- `targetTypeFilter: Set<'Photo'|'Audio'|'Video'>` state; empty set = All; no persistence

**Hotspot radius unit fix:**
- `handleFindHotspots` and `handleFindSightings` now compute `const distKm = Math.round(radius * 1.60934)` and pass `dist=${distKm}` to the eBird API. Both calls previously passed `dist=${radius}` (miles), causing public hotspots to be clipped to ~60% of the intended area while personal pins (which use `distanceMiles() <= radius`, already correct in miles) appeared farther out.
- The personal pin haversine comparison at `distanceMiles(latNum, lngNum, loc.lat, loc.lng) <= radius` is unchanged — it was already comparing miles to miles correctly.

**Key files changed:**
- `frontend/src/components/MapExplorer.tsx` — `targetTypeFilter` state; modified `displayedTargetPins` useMemo (two-pass: recency then type); `distKm` conversion in both fetch calls; filter pills JSX; count label; reset on fetch; empty state text updated

### Desktop App Foundation — Phase 0 (complete — May 2026)

The architectural foundation for a signed, distributable Mac and Windows desktop app built with Tauri v2. Phase 0 establishes two permanent seams and the Tauri project structure. The backend is still required in Phase 0 — no user-visible behavior changes in the web app.

**Two permanent seams:**
- **Transport** (`frontend/src/lib/transport.ts`) — `TransportAdapter` interface; `WebTransport` uses `fetch`; `TauriTransport` delegates to `WebTransport` in Phase 0, will call external APIs directly in Phase 3. Singleton: `export const transport = isTauri() ? new TauriTransport() : new WebTransport()`.
- **Storage** (`frontend/src/lib/storage.ts`) — `StorageAdapter` interface; `WebStorage` calls the FastAPI `/settings/*` endpoints; `TauriStorage` delegates to `WebStorage` in Phase 0. Phase 2 target: OS keychain. Phase 4 target: app data directory. Singleton: `export const storage`.
- **Platform detection** (`frontend/src/lib/platform.ts`) — `isTauri()` checks `window.__TAURI_INTERNALS__`; single source of truth for platform branching.

**Migration phases (future pipeline sessions):**
- Phase 1: Weather formatter golden tests — TypeScript formatter that matches Python output
- Phase 2: `TauriStorage` → OS keychain (Mac Keychain / Windows Credential Manager via stronghold plugin) — **abandoned**: keychain requires `com.apple.security.keychain-access-groups` macOS entitlement (not configured) and fails silently; API keys moved to `tauri-plugin-fs` + `AppLocalData` in Phase 4
- Phase 3: `TauriTransport` → direct external API calls (eBird, OpenWeather, Nominatim); API keys travel as HTTP headers, not URL params; CSP must be explicitly set before this ships
- Phase 4: `TauriStorage` → app data directory via `tauri-plugin-fs` + `AppLocalData`; all persistent data (API keys, settings, file metadata, CSV files) stored in `AppLocalData/data/`; `mkdir` must be called before every write (directory may not pre-exist on fresh install)
- Phase 5: Tauri updater plugin; in-app auto-update replaces the current GitHub releases check
- Phase 6: backend decommission; fully standalone distribution

**Tauri project files:**
- `src-tauri/Cargo.toml` — package name "snowraven", identifier `com.snowraven.app`, Rust 1.77.2+
- `src-tauri/tauri.conf.json` — window 1100×720 (min 800×600); `csp: null` (Phase 0 only — must be set before Phase 3); `devUrl: http://localhost:5173`
- `src-tauri/capabilities/default.json` — minimal permissions: `core:default` + `opener:default`
- `package.json` (repo root) — `desktop:dev` and `desktop:build` scripts via `@tauri-apps/cli`
- `frontend/vite.config.ts` — `clearScreen: false` for Tauri terminal compatibility

### Desktop App Foundation — Phase 1 (complete — May 2026)

A pure TypeScript port of `backend/formatters/weather.py` with a golden test suite proving byte-for-byte equivalence with Python output. This is the first milestone toward a fully standalone Tauri app — when Phase 6 ships, the backend will be decommissioned and the TypeScript formatter will serve as the production implementation.

**What it does:**
- `weatherFormatter.ts` implements all six formatting functions in TypeScript with zero new npm packages (browser-native `Intl` APIs only)
- A 61-test golden suite in `weatherFormatter.test.ts` verifies exact match against the Python formatter — any future drift between the two implementations will fail CI
- `weatherFormatter.golden.py` inlines the Python formatter functions (minus the `timezonefinder` dependency) and prints labeled test fixture outputs for comparison; run from the repo root with no venv required

**Behavioral rules enforced by the test suite:**
- `bankersRound()` implements Python's round-half-to-even: `22.5°` → `"N"` (index 0, even), not `"NE"`
- 8 cardinal directions: `["N","NE","E","SE","S","SW","W","NW"]`
- Beaufort descriptions: deduplicated + sorted by ascending Beaufort order (calm → gale), joined `" - "`
- Wind directions: deduplicated preserving insertion order (NOT sorted), joined `" - "`
- `capitalize()` semantics: lowercase all, uppercase first character — matches Python's `str.capitalize()`
- `formatLocalTime` uses `Intl.DateTimeFormat` (browser-native, no leading zero on hour): `"5:08am"` not `"05:08am"`

**Key files:**
- `frontend/src/lib/weatherFormatter.ts` — TypeScript formatter (`HourlyResponse` interface + all six exported functions)
- `frontend/src/lib/weatherFormatter.test.ts` — 61 golden tests (runs as part of `npm run test`)
- `frontend/src/lib/weatherFormatter.golden.py` — inlined Python reference for generating fixture expectations

**NFR constraints (remain in effect through all future phases):**
- NFR-01: No Node.js-only imports — `weatherFormatter.ts` must run in the browser and in Tauri (uses only `Intl` APIs)
- NFR-02: No new npm packages — zero dependencies added

**Phase 3 note:** The `ATTRIBUTION` constant in `weatherFormatter.ts` contains HTML. When Phase 3 (TauriTransport direct API calls) ships, the Tauri `csp: null` placeholder must be replaced with an explicit CSP before the attribution HTML is injected into the DOM.

### In-App Help Documentation (complete -- May 2026)

A full-screen documentation overlay accessible from the top of the Settings tab. `docs/HELP.md` at the repo root is the single source of truth -- imported at build time via Vite's `?raw` loader and bundled as a string literal, making documentation always available offline with no runtime network call. The same file is rendered by GitHub at a predictable URL.

**What it does:**
- "Help & Documentation" section at the very top of Settings (above Appearance), with an "Open documentation" button
- Full-screen overlay (`z-index: 1200`, `position: fixed; inset: 0`) with a sticky 200px sidebar TOC and a max-width 680px content area
- 15-entry TOC with sub-item indentation; clicking any entry scrolls to the corresponding section using `getBoundingClientRect()` arithmetic against the scrollable body ref
- Focus trap cycles Tab/Shift+Tab among focusable elements inside the overlay; Escape closes; close button (`aria-label="Close documentation"`) auto-focuses on mount
- Custom lightweight markdown renderer: `parseBlocks()` (line-by-line block parser) + `renderInline()` (regex-based inline renderer for bold, code, links) -- zero new npm dependencies
- Supported block types: H1, H2, H3, paragraphs, unordered lists, ordered lists, fenced code blocks, horizontal rules, inline code, bold, hyperlinks
- All links rendered with `target="_blank" rel="noreferrer"`; all colors use `var(--sr-*)` tokens only
- `docs/HELP.md` covers: Getting Started, API Keys (eBird + OpenWeather with One Call by Call warning), Default Files (eBird backup + ML export), Weather, Species Detail, Statistics (all 9 cards including Top Local Target Species with dot color explanation), Map Explorer, Media List, Breeding Codes, Life List Comparer, Settings
- `README.md` updated with a "Documentation" section linking to `docs/HELP.md` and full descriptions of all tabs

**Key files:**
- `docs/HELP.md` -- single source of truth for all help content; update when adding or changing features
- `frontend/src/components/HelpDocs.tsx` -- overlay component with custom markdown renderer
- `frontend/src/components/Settings.tsx` -- Help & Documentation section (first section), `helpOpen` state, `HelpDocs` mount
- `frontend/vite.config.ts` -- `server.fs.allow: ['..']` enables dev server to resolve the `?raw` import outside `frontend/`

### Accessibility Pass (complete — May 2026, v0.3.28)

A best-efforts assistive technology accessibility pass across all eight tabs, covering screen reader support, keyboard navigation, and color contrast. No WCAG certification — scoped to meaningful, verifiable improvements.

**What it does:**
- **Keyboard navigation — app-wide:** All 82+ `<button>` elements now carry explicit `tabIndex={0}`. This is required in Tauri's WKWebView (which follows Safari's macOS default of skipping buttons in Tab navigation unless `tabIndex` is explicitly set). New buttons must always include `tabIndex={0}`.
- **Tab bar — roving tabindex:** The `<nav role="tablist">` uses roving tabindex: the active tab has `tabIndex={0}`, all others have `tabIndex={-1}`. Left/Right arrow keys cycle between tabs and move focus programmatically. This is the correct ARIA tablist pattern — Tab exits the tab bar entirely.
- **Species combobox — full keyboard nav:** ArrowDown/ArrowUp moves a visible highlight through the filtered list (auto-scrolls into view). Enter selects the highlighted option (or the first when nothing is highlighted). Escape closes the dropdown. Tab closes without selecting and lets focus move on. `aria-activedescendant` points to the active option; each option has `id="species-option-{idx}"`.
- **ARIA attributes:**
  - Tab bar: `role="tablist"` on nav; `role="tab"`, `aria-selected`, `aria-controls` on each button; `role="tabpanel"`, `aria-labelledby`, `id` on each panel
  - Filter pills: `aria-pressed` on all pill buttons (BreedingCodeList, LifeList, SpeciesDetail)
  - Toggles: `role="switch"` and `aria-checked` on all ToggleSwitch instances
  - Table headers: `scope="col"` + `aria-sort` on all sortable columns in BreedingCodeTable and LifeListTable; `scope="row"` on species name cells
  - Species combobox: `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-controls`, `aria-haspopup="listbox"`, `aria-activedescendant`; listbox has `role="listbox"`, each option has `role="option"` and `aria-selected`
  - Settings theme selector: `role="radiogroup"` on the group; `role="radio"` and `aria-checked` on each option
- **Focus rings:** Explicit `:focus-visible` rules in `globals.css` using element/role selectors (`button:focus-visible`, `[role="tab"]:focus-visible`, etc.) to win over Tailwind's base reset. 3px green outline + 6px glow shadow. Inputs use a border-hugging 2px ring.
- **Focus trap — Map Explorer mobile sidebar:** On open, focus moves to first focusable element inside the sidebar. Tab/Shift-Tab cycle within. Escape closes and returns focus to the "Filters" trigger button.
- **Live regions:** `aria-live="polite" aria-atomic="true"` on the weather output container; `aria-live="polite"` on species count labels and footer update-check status.
- **Visually-hidden labels:** `.sr-only` utility class in `globals.css`. Used for tier badge category names ("Possible", "Probable", etc.) and map recency dot labels in MapExplorer.
- **Tier-1 badge contrast:** `#C084FC` background + white text = 2.7:1 (fails AA). Changed to `var(--sr-tier-1-text)` = `#3B0764` = 6.8:1 (passes AA). New token in both `:root` and `[data-theme="dark"]`.

**Key files changed:**
- `frontend/src/globals.css` — `:focus-visible` rules, `.sr-only`, `--sr-tier-1-text` token
- `frontend/src/App.tsx` — tab bar roving tabindex + arrow key navigation, tabpanel ARIA, `<main>` wrapper, `role="contentinfo"` on footer, live regions
- `frontend/src/components/SpeciesDetail.tsx` — combobox ARIA + keyboard nav (ArrowDown/Up/Enter/activeOptionIdx), `tabIndex={0}` on all buttons
- `frontend/src/components/BreedingCodeList.tsx` — `aria-pressed` on pills, `role="group"` on sort toggle, `aria-live` on count, `tabIndex={0}` on buttons
- `frontend/src/components/LifeList.tsx` — same as BreedingCodeList
- `frontend/src/components/BreedingCodeTable.tsx` — `scope="col"` + `aria-sort` on headers, `scope="row"` on species cells, `var(--sr-tier-1-text)` for tier-1 badge, `.sr-only` tier category
- `frontend/src/components/LifeListTable.tsx` — `scope="col"` + `aria-sort` on all five column headers
- `frontend/src/components/MapExplorer.tsx` — focus trap (sidebarRef + filtersButtonRef + useEffect), `aria-label` on MapContainer, recency `.sr-only` labels, `tabIndex={0}` on all buttons
- `frontend/src/components/Settings.tsx` — `role="radiogroup"` + `role="radio"` on theme selector, `tabIndex={0}` on all buttons
- `frontend/src/components/BirdingStats.tsx`, `HelpDocs.tsx`, `ListComparer.tsx`, `ResultsView.tsx`, `SetupRequired.tsx` — `tabIndex={0}` on all buttons

### Linux Installer (`install.sh`) (complete — May 2026)

A single shell script at the repo root that installs SnowRaven on Raspberry Pi or any Debian/Ubuntu system in one command. Two modes: service install (systemd, auto-starts on boot) and local install (dependencies + build, user starts manually).

**What it does:**
- Curl-pipe safe: all logic inside `main()` called at the end — a partial download via `curl | bash` cannot execute an incomplete script
- Pre-flight: reads `/etc/os-release` to confirm Debian/Ubuntu/Raspberry Pi OS; checks for `sudo`; exits before modifying anything on failure
- Numbered mode prompt (1 = service, 2 = local); re-prompts once on invalid input then exits
- Installs system packages via `apt`: `git`, `python3`, `python3-pip`, `python3-venv`; installs Node.js 20 LTS via NodeSource if `node` is absent or < v18
- Clones repo or runs `git pull` on an existing install; detects existing install via `start.sh` presence and offers abort or update
- Runs `npm ci && npm run build` in `frontend/`; creates `backend/.venv` and installs `backend/requirements.txt`
- Prompts for API keys with explicit skip note ("press Enter to skip — add later in Settings"); writes `backend/.env` with `chmod 600`; preserves an existing `.env` untouched
- Service mode: `sed` substitutes `User=pi` → `$USER` and hardcoded paths → install dir in `deploy/snowraven.service`; installs to `/etc/systemd/system/`; runs `daemon-reload`, `enable`, `start`; on failure prints last 20 `journalctl` lines
- Success block prints both `hostname.local` and LAN IP URLs; local mode also prints the exact start command
- Interactive prompts work in `curl | bash` mode by reading from `/dev/tty` when stdin is not a TTY

**Key files:**
- `install.sh` — one-command installer at repo root; chmod +x; `set -euo pipefail` + `trap ERR`

### Responsive Tab Navigation (complete — May 2026, v0.3.29)

The main tab navigation adapts to available width. On desktop it is the existing horizontal bar; when the tabs would overflow (narrow windows, mobile browsers viewing the Pi install) it collapses into a compact dropdown showing the current tab that opens to the full list. Solves the overflow that previously made the bar unusable on phones, and establishes the navigation pattern the planned native mobile app will inherit.

**What it does:**
- Collapse is driven by **measured overflow**, not a fixed breakpoint: a hidden probe measures the bar's natural width against available width via `ResizeObserver`, decided in `useLayoutEffect` (pre-paint, no flash). Holds at any tab count or zoom.
- The dropdown lists configurable tabs in the user's saved order with hidden tabs omitted (reusing the same `tabLayout` state as the bar), Settings pinned below a divider, active row highlighted with a checkmark.
- Preserves the desktop bar's `tablist` semantics and roving arrow-key navigation; the dropdown is a custom accessible listbox (aria-haspopup/expanded/selected, arrow/Home/End/Escape, outside-click and focus-return).
- Menu sits at `z-index: 1200` so it layers above the MapLibre map and its controls on the Map Explorer tab (the CLAUDE.md floating-overlay rule).

**Key files:**
- `frontend/src/components/TabNav.tsx` — responsive navigation (bar + dropdown); the single source of nav rendering
- `frontend/src/lib/tabLayout.ts` — `visibleTabs(layout)` helper and `Tab` type, shared by App and TabNav
- `frontend/src/App.tsx` — builds `navItems`, renders `<TabNav>`

### Windows Desktop App (complete — May 2026, v0.4.0)

A native Windows build of the Tauri app at full parity with the macOS and Pi/web clients. Desktop clients now ship in parallel (Pi/web, macOS, Windows). The app was ~90% portable already (transport/storage/platform seams, `AppLocalData`); this closed the Windows-specific gaps.

**How it ships:**
- `.github/workflows/windows-build.yml` (`windows-latest`, on `v*` tag) builds the NSIS installer; `release.sh` fetches it, signs it locally with the real minisign key, and publishes it to the same GitHub release as macOS, with one `latest.json` carrying both `darwin-aarch64` and `windows-x86_64`. See CLAUDE.md → Versioning → "Windows desktop release" for the full mechanism and gotchas.
- Distributed unsigned (SmartScreen prompt on first launch); in-app updater unaffected.

**Platform divergence:** None as of v0.4.1 — Windows reached full parity when native geolocation shipped (see below). At v0.4.0 launch, "Use my location" was degraded on Windows with a "coming later" note; that was resolved in v0.4.1.

### Windows Geolocation (complete — May 2026, v0.4.1)

Native "Use my location" on Windows, completing parity with macOS and Pi/web.
- `src-tauri/src/location_windows.rs` (`#[cfg(target_os = "windows")]`) — a `get_location` command using the `windows` crate's `Geolocator` (WinRT calls via `spawn_blocking`); returns the same `Coords { lat, lng }` and `"permission-denied"` convention as the macOS module, so the frontend uses one `invoke('get_location')` path on both desktop OSes. Registered for Windows in `lib.rs`; `windows` crate under `[target.'cfg(target_os = "windows")'.dependencies]`.
- Frontend: the v0.4.0 degrade (note + `unsupported-platform` guard) was removed; the button always renders. A Windows-specific denied message points to Settings → Privacy & security → Location (unpackaged `.exe` has no per-app prompt — `RequestAccessAsync` reflects the global location setting).
- `isWindows()` (`platform.ts`) is retained solely to select that Windows denied message.

**Key files:**
- `.github/workflows/windows-build.yml`, `release.sh` (multi-platform assembler)
- `frontend/src/lib/platform.ts` (`isWindows`), `frontend/src/lib/location.ts`, `frontend/src/components/MapExplorer.tsx`

## Considered and Rejected

### Recent Arrivals (Map Explorer)
Reached Stage 1 (strategy only). Abandoned because the eBird API can't support it: nearby (geo) observation lookups cap at 30 days back, and there's no radius-scoped historical endpoint, so detecting a 3–9 month absence within X miles of a point isn't feasible without coarse county-level sampling or accumulating history over time. See DECISIONS.md (2026-05-28) for the full rationale.

## Key Decisions

**WKWebView (Tauri) requires explicit `tabIndex={0}` on all `<button>` elements**
Safari/WKWebView follows macOS's default Tab behavior: Tab focuses form controls (`input`, `select`, `textarea`) and links (`a[href]`), but skips `<button>` elements unless `tabIndex` is explicitly set. This means every new `<button>` added to any component must include `tabIndex={0}`. The one exception is the tab bar's roving tabindex pattern — those buttons have `tabIndex={activeTab === tab ? 0 : -1}` intentionally and must NOT get `tabIndex={0}`. `<Button>` (capitalized) from shadcn/ui handles tabIndex internally. This was discovered during the v0.3.28 accessibility pass and fixed globally across all 11 component files.

**eBird coordinate fallback strategy**
The eBird checklist view API does not return lat/lng. Coordinates are fetched
separately. Public hotspots use `/ref/hotspot/info/{locId}`. Personal/private
locations require `/product/lists/{locId}`, whose response is an array with a
nested `loc` object using `latitude`/`longitude` keys (not `lat`/`lng`).
A third fallback to `/data/obs/{locId}/recent` handles edge cases.

**OpenWeather One Call API 3.0 requires explicit subscription**
The timemachine endpoint is not included in the free API key by default.
Users must subscribe to "One Call by Call" in their OpenWeather account
(first 1,000 calls/day free) before the API key will work on this endpoint.

**Port 1620**
Default port is 1620 (not 8000) because port 8000 was already in use.
Update `frontend/vite.config.ts`, `start.sh`, and `deploy/snowraven.service`
if you need a different port.

**Timezone resolution is offline**
`timezonefinder` resolves lat/lng → IANA timezone name without any API call.
`zoneinfo` (Python 3.9+ built-in) handles the timezone-aware datetime math.

**Production architecture is single-process**
FastAPI serves both the API and the built frontend static files. No nginx or
separate static file server is needed for local/Pi deployment. For
internet-facing installs, add a reverse proxy for HTTPS.

**Location name is not in the eBird checklist view response**
The `/v2/product/checklist/view/{id}` endpoint does not return `locName` as a top-level field. Location name is sourced from the `result` field of the `ref/region/info` response (primary coordinate path), or from `loc.name` in the `product/lists` response (fallback path), or falls back to `locId`. Use `.get()` with fallbacks — never `data["locName"]` directly.

**Tab switching uses display toggling, not conditional rendering**
The Weather and List Comparer tabs are both always mounted. Switching tabs
sets `display: none / flex` on each panel rather than unmounting the inactive
component. This preserves state (loaded files, comparison result, weather
output) when the user switches tabs and back.

**List Comparer is entirely client-side**
No backend changes were made for this feature. All CSV parsing, species
normalization, and comparison logic runs in the browser. This keeps the
backend simple and means the feature works even if the backend is unreachable.

**Version check is server-side by design**
The `/version/check` endpoint calls GitHub from the backend, not the browser.
This keeps the user's IP off GitHub's logs. The frontend just calls its own
backend — no cross-origin requests. This also means the check works on
local network installs where CORS would otherwise block a direct GitHub call.

**Media type lookup uses Cornell CDN HEAD requests, not the ML search API**
The Macaulay Library search API (`search.macaulaylibrary.org/api/v1/search`) does
not support catalog ID lookup — the `q` parameter performs general text search and
returns unrelated results. Media type is instead determined by probing the Cornell
CDN directly with HEAD requests:
- Photo:  `cdn.download.ams.birds.cornell.edu/api/v2/asset/{id}/1200`     → 200
- Audio:  `cdn.download.ams.birds.cornell.edu/api/v2/asset/{id}/mp3`      → 200
- Video:  `cdn.download.ams.birds.cornell.edu/api/v2/asset/{id}/mp4/1280` → 200

Probing is Photo-first and sequential per ID (avoids 3× fan-out). All IDs in a batch
are gathered via `asyncio.gather` but capped to 8 concurrent connections by a module-level
`asyncio.Semaphore`. No API key required. No response body is parsed — only HTTP status
codes are checked.

**Frontend controls batching; backend caps CDN concurrency with a semaphore**
The frontend sends catalog IDs in batches of 10 per POST request (with a 500ms delay
between batches). This gives the progress indicator accurate "batch X of Y" feedback
after each response and keeps cumulative CDN request rate below rate-limit thresholds.
Within each batch, the backend gathers all IDs concurrently but caps to 8 simultaneous
CDN connections via `asyncio.Semaphore(8)`.

**ML catalog numbers in CSV may carry an "ML" prefix**
eBird's backup CSV stores catalog numbers as e.g. `ML204818731`. The parser strips
the `ML` prefix with `replace(/^ML/i, '')` before storing or sending IDs. The backend
normalizes IDs in API responses with `_normalize_id()` (strips non-digits) before
comparing, so string/numeric/prefixed catalogId values all match correctly.

**Life List drop zone is implemented inline, not via the DropZone component**
The existing `DropZone` component is coupled to the `FileData` type (which contains
a `species: Set<string>` field). Rather than retrofitting DropZone with generics,
`LifeList.tsx` implements its own minimal drop zone inline. The patterns are similar
but kept separate to avoid coupling unrelated features.

**Expand/collapse removed — app always uses natural page flow (changed 2026-05-21)**
`App.tsx` always uses `minHeight: 100vh` (no overflow clip). All tabs render in natural
page flow. The `onExpandedChange` callback pattern and `isExpanded` state are gone.
Do not re-add expand/collapse — use the **Unbounded / Normal** toggle pattern instead
for tables that need mobile horizontal panning: set the table wrapper to `width: max-content`
in unbounded mode (removes the `overflowX: auto` clip without overflowing the wrapper border).

**Update script uses .venv/bin/pip explicitly**
`update.sh` calls `.venv/bin/pip` rather than relying on a `pip` in PATH.
This ensures the correct virtualenv is used regardless of the shell environment,
which matters on Raspberry Pi where system Python is separate from the venv.

**ML export is the only input for Media Life List (eBird path removed 2026-05-21)**
`LifeList.tsx` accepts only Macaulay Library export CSV. The eBird backup secondary
path, `POST /ml/media-types` backend endpoint, and auto-detection logic are gone.
All media types come directly from the `Format` column — no backend call required.

**Sort architecture: column-header sort + A–Z / Taxonomic name toggle**
Column headers (Entries, Photo, Audio, Video; breeding code columns) are clickable sort controls. An A–Z / Taxonomic toggle button on each tab controls how the name column sorts. The two are independent: clicking a count column header preserves the active nameSortMode as a tiebreaker via `{ ...sort, column, dir }` spread in `handleHeaderClick`. `SortState` has three fields: `column`, `dir`, and `nameSortMode: 'az' | 'taxonomic'`. Always spread `{ ...sort }` when changing column or dir — never replace the whole object, or the nameSortMode preference is lost.

**Soundscape entries are included in ML export parsing**
Macaulay Library exports include non-species entries like "Soundscape" with no
scientific name. These pass through `parseMLExport.ts` as first-class entries — the
`isExcluded()` function only excludes spuh (` sp.`), slash species (`/`), and hybrids (` x `).
Soundscape entries appear in the table with an empty scientific name cell and respond
to the standard filter pills (e.g. "Has audio") like any other entry.

**ML media links use taxon code + userId parameters for personal filtering (consolidated in v0.5.57)**
ML catalog links are formed as `media.ebird.org/catalog?mediaType=photo&taxonCode=acowoo&userId=USER1234567`
— one host (`media.ebird.org/catalog`, the shared `ML_CATALOG_BASE`) and one `taxonCode` pattern across every
surface (Species Detail, Multimedia, Statistics). The legacy `search.macaulaylibrary.org` host and the
`?taxaName=<name>` fallback are both retired: a link never emits `?taxaName=` and, for a resolvable species,
never goes out bare (filter-less). The taxon code is resolved by **normalizing the name first**, so a bird
recorded under a subspecies/form name (a trailing parenthetical, e.g. "Scaly-breasted Munia (Scaled)") still
resolves its species code. On the two surfaces with a "Show subspecies" toggle (Species Detail + Multimedia)
the link follows it — OFF → the species code (all the bird's media), ON → the form's own subspecies-group code
(just that form) — via the shared `resolveMediaLinkTaxonCode` in `lib/mlCatalog.ts`; Statistics has no toggle
so it is always the species code, which is also the universal fallback when a form code can't be resolved. The
form codes come from `/taxonomy/codes`' additive `formCodes` map (all-category name→code, inverted from the
bundled taxonomy snapshot's `byCode`); the species-only `codes`/`orders` maps (favicons + taxonomic sort) are
byte-identical and unaffected. The `userId` is parsed from the ML export filename via regex
`^ML__.*_([A-Za-z0-9]+)\.csv$` — the default ML filename format encodes the user's ID. If the filename was
renamed, userId cannot be parsed and a warning banner is shown; links then omit userId (still a well-formed,
taxonCode-filtered catalog link, never `taxaName`).

**Taxon codes are fetched from eBird taxonomy API and cached in process memory**
`POST /taxonomy/codes` accepts `[{commonName, scientificName}]` and returns `{codes: {commonName: speciesCode}}`.
On first call, the backend fetches the full eBird taxonomy (`api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&cat=species`)
and builds two in-memory dicts: `_by_sci` (sciName → code) and `_by_com` (comName → code). Subsequent calls are
instant. Scientific name is tried first; common name is the fallback. Pass `scientificName: ''` to force common-name
lookup (used by `ListComparer` which has names but no sci names). Graceful degradation: any error returns `{codes: {}}`.

**`SpeciesLinks` is a shared inline component; renders null for soundscapes**
`SpeciesLinks` accepts `speciesCode: string | undefined` and renders two favicon links (eBird + BOW) when the code
is truthy, or `null` when falsy. This means soundscape entries, pre-fetch rows, and species not found in taxonomy
all silently show no icons — no broken state. Favicons are loaded from the live sites; `onError` hides any that
fail to load. Both `<a>` elements carry `rel="noreferrer"` to prevent tab-napping.

**Breeding code sort column is typed as `string`, not a discriminated union**
`BreedingSortColumn` is `string` rather than `'name' | BreedingCodeDef['code']` because the set of
active code columns is dynamic — determined at parse time from the CSV. Using `string` is correct here;
the valid values are enforced at the call sites where headers are rendered.

**`hasBreedingCodeColumn` flag distinguishes two empty states**
`parseBreedingCodes` returns `{ hasBreedingCodeColumn: boolean }` to distinguish "file has no Breeding Code
column at all" (user probably uploaded the wrong file) from "file has the column but no rows with valid codes"
(user hasn't entered breeding codes yet). These produce different UI messages: the former is an error banner;
the latter is a neutral empty state. Without this flag both cases would look like generic parse failures.

**Breeding code parser utilities are not shared with other parsers**
`parseCSVLine`, `isExcluded`, and `normalizeSpeciesName` exist in both `parseLifeList.ts` / `parseMLExport.ts`
and `parseBreedingCodes.ts`. Extracting them to a shared module was considered and rejected — it would create
a dependency between unrelated features on a utility whose behavior may need to diverge. Each parser owns its
own copy, matching the pattern established by the Life List drop zone being implemented inline rather than via
the shared DropZone component.

**ListComparer taxonomy fetch is fire-and-forget after comparison**
After `compareSpecies()` runs, `ListComparer` calls `fetchTaxonCodes` with the union of all species names from
`both`, `aOnly`, and `bOnly`. The comparison result is shown immediately; icons appear a moment later. On reset,
`taxonMap` is cleared to `{}` so stale codes do not bleed into the next comparison.

**`/taxonomy/codes` returns taxon orders alongside species codes — no new endpoint**
The `POST /taxonomy/codes` response was extended to include `orders: {commonName: taxonOrder}` alongside `codes`. The backend builds a third in-memory dict `_by_order` (comName.lower() → int taxonOrder) from the eBird taxonomy fetch. No new endpoint or additional network call is needed. Codes and sort orders arrive in a single response, keeping the fetch atomic. Graceful degradation: any fetch error returns `{codes: {}, orders: {}}`.

**Subspecies merge defaults to ON; toggling to show-subspecies resets the species selection**
In the Species Detail tab, merged view is the default (`mergeSubspecies: true`). This is consistent with how all other tabs (Life List, List Comparer, Breeding Codes) normalize parentheticals. When switching from merge→show, the selection is cleared because the merged parent name (e.g. "Yellow-rumped Warbler") may not exist as an exact entry in show-subspecies mode. When switching from show→merge, the current selected name is normalized and kept selected. Both toggles reset to their defaults when a new file is loaded or "Load different file" is clicked.

**Top Locations renders all location names as plain text — no links**
Private eBird locations have no public-facing page; `ebird.org/loc/{id}` and `ebird.org/hotspot/{id}` both fail for personal locations. The eBird CSV export uses the same `L\d+` ID format for public hotspots and personal locations, so they cannot be distinguished without an API call. Location names are rendered as plain text throughout. Do not add location hyperlinks without a reliable way to distinguish public hotspots from private locations at parse time.

**Leaflet map marker icons require a CDN patch in Vite builds** *(Historical — superseded by the v0.5.9 MapLibre migration)*
Vite's asset hashing breaks Leaflet's default mechanism for resolving marker icon URLs (it walks `_getIconUrl` which relies on a `data-url` import trick that Vite doesn't replicate). Fix: delete `_getIconUrl` from `L.Icon.Default.prototype` (requires `// eslint-disable-next-line @typescript-eslint/no-explicit-any`) then call `L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })` pointing to the unpkg CDN for the matching Leaflet version. This must run at module level, not inside a component or effect. *Leaflet is gone; no icon patch exists in the codebase anymore.*

**Leaflet popup inline styles use hardcoded hex for link colors** *(Historical — superseded by the v0.5.9 MapLibre migration)*
CSS variables (`var(--sr-*)`) are not reliably inherited inside Leaflet popup DOM, which is rendered outside the React tree by Leaflet itself. Popup link colors use `#2D8653` (the light-mode accent) directly. This is a known limitation — acceptable given the popup is a small secondary UI element and the app's threat model doesn't require dark-mode support inside popups. *No longer true: MapLibre popups render as JSX inside the React tree, where `var(--sr-*)` tokens resolve normally — new popup code MUST use the tokens, per CLAUDE.md's color rule.*

**Media grid uses CSS grid `repeat(3, minmax(0, 1fr))` instead of flex**
Flexbox `flex: 1` on media items causes a single item to stretch to full width, making a lone photo embed look awkward (wide + constrained height). CSS grid with three equal fixed columns means one item takes 1/3 width, two items take 2/3, three items fill all columns — proportional regardless of item count. Mobile overrides to `grid-template-columns: 1fr` (single column, taller iframes). `scrolling="no"` + `overflow: hidden` on the iframe suppress any scrollbars the embedded content would otherwise produce.

**Server-side file storage uses fixed on-disk filenames; client filename in metadata only**
`data/ebird-backup.csv` and `data/ml-export.csv` are the fixed on-disk paths regardless of what the user uploads. The original filename is stored in `data/metadata.json` (`{"ebird": {"filename": "...", "uploadedAt": "..."}, "ml": ...}`) for display only — never used to construct a file path. This eliminates path traversal risk entirely. `data/` is gitignored. `DATA_DIR` is resolved from `__file__` in `settings.py` (three `.parent` hops) so the path is correct regardless of CWD when uvicorn starts. Any future stored file type should follow the same fixed-filename + metadata sidecar pattern.

**`loading-saved` → `setup-required` → `ready` | `error` phase progression for stored-file tabs**
`BreedingCodeList`, `LifeList`, and `SpeciesDetail` initialize to `{ tag: 'loading-saved' }`. On auto-load: success → `ready`; no file configured in Settings → `setup-required` (shows the SetupRequired guidance screen with "Go to Settings"); fetch/parse failure → `error` (shows an inline error message). The `idle` tag does not exist in these components — there is no state where the tab is waiting for the user to upload something. Any future tab that checks for a stored default on mount must use `loading-saved` as the initial phase and distinguish `setup-required` (no file) from `error` (file exists but failed) rather than using a single `idle` catch-all.

**Taxonomic sort for ML export uses the taxonomy fetch fallback**
ML export entries have `taxonomicOrder: Infinity` (no order field in the CSV). `getOrder()` in `LifeListTable` returns `entry.taxonomicOrder` if finite (eBird CSV path), otherwise falls back to `taxonOrders[commonName] ?? taxonOrders[normalizeSpeciesName(commonName)] ?? Infinity` from the taxonomy fetch. The normalizeSpeciesName fallback handles subspecies/domestic entries (e.g. "Mallard (Domestic type)") whose parenthetical names don't appear in the taxon-order map — they normalize to the parent name ("Mallard") which does. This makes taxonomic sort available for both input formats and correctly handles the "Show subspecies" toggle. Species absent from the taxonomy sort last on both paths.

**`speciesUtils.ts` is a shared component-layer utility; parser-layer utilities remain separate**
`normalizeSpeciesName` and `isSpuhOrSlash` are now exported from `frontend/src/lib/speciesUtils.ts`
and imported by `LifeList.tsx` and `SpeciesDetail.tsx`. This is a component-layer extraction — the
same two functions used to be duplicated inline in `SpeciesDetail.tsx`. Parser files
(`parseMLExport.ts`, `parseBreedingCodes.ts`) continue to own their own copies, consistent with the
earlier decision to keep parser-layer utilities separate. Do not merge those copies into `speciesUtils.ts`
without re-evaluating the divergence risk.

**Non-bird classification uses the always-normalized eBird backbone, not the toggle state**
In Comprehensive mode, the set of eBird-known species names that protects ML entries from non-bird
misclassification is built from `normalizeSpeciesName(ebirdObs[].commonName)` regardless of the
Merge subspecies toggle. This means "Yellow-rumped Warbler (Myrtle)" in the eBird backbone will
normalize to "Yellow-rumped Warbler" and correctly prevent an ML entry with that name from being
classified as non-bird, even when `mergeSubspecies` is false. The alternative — building the set
from toggled entry names — would cause false positives when subspecies are shown unmerged.

**`filterHasMedia` is separate boolean state, not an addition to `MediaFilterState`**
The "Has media" pill state is kept as a standalone `filterHasMedia: boolean` in `LifeList.tsx` rather
than adding a fourth field to the `MediaFilterState` type in `types.ts`. It is applied as a pre-filter
producing `mediaFilteredEntries` before passing to `LifeListTable`, so the table never sees entries that
fail the has-media check. This avoided touching the shared type, kept the filter logic co-located with
the component that understands media context, and made it easy for "All" to reset both `filter` and
`filterHasMedia` together.

**`totalSpecies` denominator is `displayEntries.length`, not `phaseEntries.length`**
In ML-only mode `phaseEntries.length` was the correct total. In Comprehensive mode it would show the
ML-only count (wrong — the backbone adds eBird species with no ML entries). `totalSpecies` was changed
to use `displayEntries.length` (the post-toggle, pre-media-filter count) so the "N of M species" label
reflects the correct denominator in both modes.

**Non-bird sort partition fires only in Taxonomic nameSortMode (FR-13)**
In `LifeListTable`, the partition that forces non-bird entries after all bird entries is guarded by
`sort.nameSortMode === 'taxonomic'`. In A–Z sort, non-bird entries appear in their natural alphabetical
position. Do not lift this guard — applying the partition in A–Z mode would prevent users from scanning
non-bird entries alphabetically alongside birds, which is the expected behavior when sort is alphabetical.

**Three-tier taxonomic sort: birds → non-bird animals → non-animals**
Within taxonomic sort, `LifeListTable` assigns a priority tier to each entry: tier 0 = birds (not `isNonBird`),
tier 1 = non-bird animals (`isNonBird && scientificName.trim().length > 0`), tier 2 = non-animals (`isNonBird &&
scientificName.trim().length === 0`). Tier 2 entries (Habitat, Soundscape, Experience, etc.) always sort
alphabetically at the very end, regardless of the user's sort direction. The boundary is whether any scientific
name is present — not whether it contains a space. Single-word scientific names (genus-only entries) correctly
land in tier 1 alongside binomial-named non-bird animals.

**`buildGraphData` returns `{ data, interval }` — `useMonthly` boolean removed**
The return type was changed from `{ data, useMonthly: boolean }` to `{ data, interval: GraphInterval }` when weekly support was added. Callers should use `graphResult.interval` everywhere a format decision is needed (axis labels, tooltip titles). Do not re-introduce `useMonthly` — the explicit interval string is more expressive and handles three values without conditionals.

**Weekly x-axis format is `Wk N 'YY` — ISO week number without zero-padding**
`formatPeriodLabel` strips the leading zero from the week number (`parseInt(wStr, 10)`) so `2024-W03` displays as `Wk 3 '24`, not `Wk 03 '24`. The internal key always uses zero-padded week numbers (`YYYY-Www`) for correct string sorting; display removes the pad.

**Frequency denominator counts unique submissionIds across all species, not just the selected one**
`totalFilteredChecklists` iterates `phase.observations` (all species) applying the same county and date filters as `speciesObs`, and counts unique non-empty `submissionId` values. Using `speciesObs.length` as both numerator and denominator would always give 100%. The denominator represents the user's total checklist activity in the filtered scope — a species with 5 checklists out of 200 total shows 2.5% (rounded to 3%).

**`<1%` display guard prevents misleading `0%` for rare species**
When `frequencyPct` is non-null but less than 1 (species appears on at least one checklist but rounds to 0%), the display shows `<1%` rather than `0%`. This matters for very rare or occasional species — `0%` would incorrectly imply the species was never seen.
