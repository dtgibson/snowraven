# Roadmap

This is a living document. It reflects the current best thinking
on what to build next — not a contract. Things change as you learn
more about your users and your product. Update it freely.

---

## Shipped

48 versions shipped. Last shipped: **Standardized clickable bird-name format (v0.5.8)** -- every bird name app-wide now renders through a shared `<BirdName>`: common name links to its Species Detail entry, followed by eBird + Birds of the World favicons, with the scientific name where there's room. Clicking any name (Statistics, Map Explorer, Media List, Breeding Codes, Life List Comparer) jumps to that species' detail; where the name used to carry a link, the count/element takes it over. Birds not in your data show name + favicons without a dead link.

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

2. **Accessibility, clarity, and simplification** — Make the app more accessible, cleaner, and easier to use. Audit the UI for complexity that can be removed, streamline the most common workflows, and ensure the app is usable by people who rely on assistive technology.

3. **Windows code signing** — Add Authenticode signing to the Windows build to remove the first-launch SmartScreen "unknown publisher" warning. (Native Windows geolocation, the other half of this item, shipped in v0.4.1.)
