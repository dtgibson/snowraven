# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

67 versions shipped. Last shipped: **Accessibility follow-ups — the shared checklist-link rollout finished, a new-tab cue on every external link, and the records corrected (v0.5.32)** -- closed the three cross-cutting Known Exceptions 0.5.31 had left: every "open on eBird" checklist link now flows through one shared `ChecklistLink` (gaining a compact icon-only mode and a Voice-Control-friendly accessible name that leads with the visible date), every external link announces it opens in a new tab via a new shared `OutboundLink` (with the wording unified app-wide), and the stale records were truthed up — the Southern-Hemisphere moon phase turned out to have already shipped in v0.5.28. Accessibility and records only; no user-facing feature change.

Previously: **Accessibility, clarity & honesty — a WCAG 2.1 AA pass across the whole app (v0.5.31)** -- a comprehensive accessibility pass driven by a multi-phase audit (107 confirmed findings against 288 verified passes, all fixed). Every filter control, date input, and search box now has a real accessible name; a full contrast retune in both light and dark themes (with a typed token system for text on tints, fills, pins, and chart bars) brings text and interface colors to AA; the keyboard path was rebuilt where it was broken — a skip link, map markers as real buttons, Move up/down for tab reordering, a focus trap and full focus-restore on the mobile filter panel, Escape out of map fullscreen, and a keyboard route to the atlas blocks; result counts, loading states, and errors are announced; and `ACCESSIBILITY.md` was rewritten to match the shipped code, with the remaining gaps listed honestly. This release also carries the previously-unreleased test-suite determinism work (the last rare frontend flake is gone, fixed in the tests, plus the 0.5.29 record corrections).
Earlier: **Map fixes — missing hotspot pins + heatmap toggle crash (v0.5.30)** -- two Map Explorer bugs fixed, both proven with deterministic repros. Hotspot teardrops (and atlas hatch textures) could silently fail to appear whenever the map was busy loading tiles — a base-layer switch, a pan, or a slow network at the wrong moment meant the pin sprites never registered (latent since 0.5.16); sprites now register unconditionally with a safety net that re-bakes them on demand. And switching Pins → Heatmap crashed the entire app (shipped broken since 0.5.18, including 0.5.29) — caught by this fix's own regression walk and folded in with approval; the map source now remounts cleanly, locked by a regression test proven to fail on the old code.

Earlier: **Reliable test suite + SnowRaven Mini mentions (v0.5.29)** -- the main cause of the full frontend test suite's intermittent failures (~11% of runs) is gone: a stray fallback timer from a charting dependency could outlive its test file and crash a later one, now covered by baseline animation-frame shims in shared test setup — proven both ways (8/8 clean with the fix, the exact failure reproduced without it) (a separate, rarer timing flake remained and was fixed separately). And the Weather tab, README, and in-app Help now mention **SnowRaven Mini**, the author's separate Chrome/Firefox extension that runs the same weather and tide lookup right on the eBird page — informational only, GitHub link only; the website deliberately stays silent about it.

Earlier: **Moon phase on night weather blocks (v0.5.28)** -- SnowRaven's generated weather blocks now match raincrow on night checklists: a moon-phase emoji joins the condition emoji on the header line (mirrored for the Southern Hemisphere), computed locally from the checklist's start — no new API calls, no settings, day blocks unchanged. The same investigation verified dew point was already at parity, so nothing changed there.

Earlier: **Checklists tab (v0.5.27)** -- a new top-level tab that makes your checklists searchable and browsable as whole outings: search every **checklist comment** and every **species comment** you've ever written (last 10 shown, expandable, with eBird links), and browse a filterable list of **all checklists** — combinable has/doesn't-have filters for comments, media (by type with the ML export), breeding codes, weather/tide blocks, completeness, protocol, county, and date range. A tab-wide toggle (off by default) hides pasted SnowRaven/RainCrow weather and tide blocks from display *and* search — "search matches what you see."

Earlier: **Named Birds tab upgrade (v0.5.26)** -- the **Named Birds** tab is now far more legible and gives each individual its own map: a four-option sort (Name · Alphabetical · Taxonomic · Last Seen), each report's location shown between the date and checklist link, each comment in its own quoted block, lifted contrast, and a per-individual **sightings map** showing where that bird has turned up. Built on a shared `SightingsMap` component that Species Detail's pins map now also uses.

Earlier: **Richer media statistics + date-format unification (v0.5.20, batched with 0.5.19)** -- the **Statistics → Media card** now goes far beyond the most-photographed lists: documentation coverage, age/sex and behavior breakdowns, format combinations, time-of-day, and community ratings (each gated on what your export carries). Also (0.5.19): the Weather-tab date now follows your date-format preference, a Multimedia **"Jump to comments"** hint, and reduced-motion-honoring jump scrolls. Shipped from the Mac as one batched 0.5.20 release.

Earlier: **Quality & accessibility sweep + Media Comments (v0.5.18)** -- a Multimedia **Media Comments** section (searchable ML captions/notes/details with Macaulay links); Checklist Comparer **weather/tide + badges** (side-by-side weather and tide per checklist); a **Statistics → Data Quality** weather/tide-block coverage stat; a Settings **date-format picker**; **keyboard-operable map markers** (focusable in-view sidebar lists); and behaviour-preserving component splits.

Earlier: **Tides on the Weather tab (v0.5.17)** -- a checklist lookup now also shows the historical tide below the weather, from the nearest NOAA station (keyless): the water-level range over the checklist, Observed (gauge) or Predicted (interpolated from the high/low curve for prediction-only stations), rising/falling, the surrounding high/low, and the station + distance. Two notices (too-far / outside-US) with a one-tap override, and a "Copy Weather and Tide Together" button.

Earlier: **Performance sweep + Settings location & 5-mile default (v0.5.16)** -- app-wide loading/waiting reduction (defer-mount all tabs but Weather, parse-once shared caches, GL map markers + atlas viewport cap, network timeouts, idle-prefetched chunks) plus a boot skeleton, root error boundary, and progress indicators; "Use my location" in Settings and a 5-mile default map radius.

Earlier (v0.5.9–v0.5.15): the **List Comparer** (life-list + checklist compare — counts, breeding codes, media, effort metadata, comments), in-app **Text Size** with WCAG resize support, chart accessibility + tested stats logic, and the Map Explorer media-filter fix.

Earlier: **Standardized clickable bird-name format (v0.5.8)** -- every bird name app-wide now renders through a shared `<BirdName>`: common name links to its Species Detail entry, followed by eBird + Birds of the World favicons, with the scientific name where there's room. Clicking any name (Statistics, Map Explorer, Media List, Breeding Codes, List Comparer) jumps to that species' detail; where the name used to carry a link, the count/element takes it over. Birds not in your data show name + favicons without a dead link.

Earlier: **Keyless basemap upgrade + layer switcher (v0.5.7)** -- maps now use a clean CARTO Positron base by default (off the OSMF-policy-fragile default OSM tiles), with a brand-styled switcher on Map Explorer + Species Detail for Map / Satellite (Esri) / Topo-US (USGS) bases and a Waymarked Trails overlay; choice persists; all keyless. (v0.5.5 universal Mac binary noted below was the prior release.)

Earlier: **Documentation accuracy & completeness pass (v0.5.6)** -- audited the in-app Help and README against the current app: added Windows to the platform list, removed a non-existent breeding "Observed" level, made storage wording platform-neutral, documented the My Sightings County/Media/Radius controls, the desktop "Rebuild caches" button, and the in-app update flow, and scoped the README security note to the self-hosted install.

Previously: **Intel Mac support — universal macOS binary (v0.5.5)** -- the macOS app now ships as a single universal DMG that runs natively on both Apple Silicon and Intel Macs; `latest.json` maps both `darwin-aarch64` and `darwin-x86_64` to the universal updater bundle, so Intel Mac users can run the app and receive in-app updates.

Earlier: **Map Explorer mobile fullscreen + ocean-tone backdrop (v0.5.4)** -- on small screens a fullscreen button next to Filters expands the map to fill the whole viewport (header, tab selector, and mode tabs hidden); and the empty area around the world map now uses an ocean tone instead of grey.

Previously: **Heatmap intensity parity + desktop clipboard auto-copy (v0.5.3)** -- the Species Detail map's Heatmap mode gained the same 1–10 intensity slider as the Map Explorer (shared `lib/heat.ts` model), and weather now auto-copies to the clipboard in the macOS/Windows desktop apps (native Tauri clipboard via a new clipboard seam), matching the web app.

Previously: **Map Explorer — shade atlas blocks by your highest breeding code (v0.5.2)** -- with the atlas overlay on, a "Shade by My Highest Breeding Code" toggle tints each block by the strongest breeding code the user has personally entered there (client-side spatial join over the loaded eBird backup), and a separate "Use Textures" toggle (off by default) adds a per-tier hatch pattern for colorblind-friendly, color-independent reading. The overlay now appears in all three map views and draws from higher zoom levels.

Previously: **Map Explorer heatmap improvement (v0.5.1)** -- the My Sightings heatmap now spreads into a readable density gradient with a Heatmap Intensity slider that scales coverage, saturation, and per-point weight so even sparse areas stand out.

Earlier: **Map Explorer — California atlas blocks + nearest unvisited hotspots (v0.5.0)** -- a toggle overlays official California Breeding Bird Atlas block boundaries (generated at runtime from a compact bundled gazetteer), and the Hotspots panel auto-lists the ten closest unvisited hotspots as eBird links.

---

## Up Next

1. **Mobile app** — A native mobile app for iOS App Store distribution, with an Android release to follow. Designed for the full feature set on a phone-sized screen. Inherits the responsive navigation and the platform seams hardened during the Windows release.

2. **Windows code signing** — Add Authenticode signing to the Windows build to remove the first-launch SmartScreen "unknown publisher" warning. (Native Windows geolocation, the other half of this item, shipped in v0.4.1.)
