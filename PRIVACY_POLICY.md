# Privacy Policy — SnowRaven

**Effective date:** June 18, 2026

## Overview

SnowRaven is a self-hosted birding tools app. It runs as a standalone desktop app (macOS and Windows) or on your own machine such as a Raspberry Pi. This policy describes what happens to your data. The short version: it stays with you.

## Your Data Stays on Your Device

SnowRaven keeps your data on your own device by choice and design. You keep it, and you control it.

- Your API keys, app settings, and the files you upload — your eBird backup and Macaulay Library export — are stored only on your device (in the desktop app's local data directory), or on your own machine when you self-host the web/Pi version. They are never uploaded to the developer or to any service the developer runs.
- All processing of your eBird and media files happens locally, on your own device, while you use the app.
- There is no SnowRaven account, no login, and no SnowRaven-operated server sitting between you and your data.
- You can delete your stored files and keys at any time from the Settings tab, or by removing the app's data directory.

## No Data Collection

SnowRaven collects nothing about you.

- No analytics, usage tracking, or telemetry of any kind.
- No crash-reporting services.
- No advertising networks.
- No accounts, profiles, or identifiers.

## Connections to Bird and Weather Services

SnowRaven's job is to fetch birding and weather information for you, so the app does make requests to a few outside services — using your own API keys, and only to get the data you ask for. These requests go directly from your device (or your own self-hosted server) to the provider. There is no SnowRaven server in the middle, and nothing is logged or retained by the developer.

- **eBird** — to look up checklist details, hotspots, recent nearby sightings, region info, and species taxonomy. Uses your own eBird API key. See [eBird's terms](https://www.birds.cornell.edu/home/ebird-api-terms-of-use/).
- **OpenWeather** — to fetch weather: the historical weather for a checklist, or the current and forecast weather for a location and time you choose. Uses your own OpenWeather API key. See [OpenWeather's privacy policy](https://openweather.co.uk/privacy-policy).
- **Nominatim (OpenStreetMap)** — to turn a place name you type into map coordinates, and to look up the county for a set of coordinates. See the [OSM privacy policy](https://wiki.osmfoundation.org/wiki/Privacy_Policy).
- **NOAA Tides & Currents (CO-OPS)** — to fetch the tide for a checklist's location and time, or the current or predicted tide for a location and time you choose. No key or account; a U.S. government service. See [NOAA's privacy policy](https://www.noaa.gov/protecting-your-privacy).

What you send to these services (a checklist ID, a location, a search term) is governed by each provider's own privacy policy. SnowRaven only relays the request you initiated; it does not add tracking and does not keep a copy.

## Your Location

When you tap "Use my location" — on the map, when setting a default location in Settings, or with the "Current" weather and tide lookup — SnowRaven asks your device or browser for your current coordinates, with your permission. Those coordinates stay on your device: they set the map's center and can be saved as your default location locally. They are only sent outward if you then run a search (for hotspots or nearby sightings) or use the "Current" lookup, which sends your coordinates to OpenWeather and NOAA to fetch the weather and tide where you are — the same as coordinates you type in by hand. You can deny or revoke the permission at any time through your operating system or browser settings.

## Map Tiles

The maps in SnowRaven are drawn using map tiles served by third-party providers. As you pan and zoom, your device requests the tiles for the area you are viewing directly from these providers — so, like any website that displays a map, they receive your IP address and which part of the map you are looking at. No SnowRaven server is involved, no API key or account is used, and the developer adds no tracking and keeps no copy. You choose which base map is active with the layer switcher, and only the active layers' tiles are requested. Tiles come from:

- **OpenFreeMap** (`tiles.openfreemap.org`) — the default "Map" base map, served as vector tiles. The map's style, label fonts (glyphs), and icon sheet (sprite) are also fetched from OpenFreeMap. A free, keyless, community-run service; see [openfreemap.org](https://openfreemap.org/).
- **Esri** (`server.arcgisonline.com`) — the "Satellite" base map. See [Esri's privacy statement](https://www.esri.com/en-us/privacy/overview).
- **USGS — The National Map** (`basemap.nationalmap.gov`) — the "Topo (US)" base map (United States only); a U.S. government service.
- **Waymarked Trails** (`tile.waymarkedtrails.org`) — the optional "Trails" overlay. See [waymarkedtrails.org](https://hiking.waymarkedtrails.org/).
- **GitHub** (`github.com`) — when, and only when, you turn on offline maps and choose to download a map region (desktop app), that region's map data is fetched from SnowRaven's release files hosted on GitHub. See [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

### Offline maps

Offline map regions are entirely opt-in and off by default. Nothing about them touches the network until you turn on "Enable offline maps" in Settings and pick a region to download. When you download a region, your device fetches that region's map data from GitHub (above), so GitHub receives your IP address and which region you downloaded at that moment. Once a region is downloaded, it is stored on your device and drawn with no further network request — you can pan and zoom it fully offline. Downloaded regions stay on your device, are never sent anywhere, and can be removed at any time in Settings. Region downloads are a desktop-app feature.

## Embedded Bird Media and Link Icons

A few things in the app load directly from the Cornell Lab of Ornithology's websites, the same way any web page loads an embedded image — so, like the map tiles above, those sites receive your IP address and the specific item requested:

- **Macaulay Library embeds** — the Species Detail tab can show your photos, audio, and video embedded from **macaulaylibrary.org**; loading one tells the Macaulay Library which asset was viewed.
- **Site icons next to bird names** — the small link icons shown beside bird names throughout the app load from **ebird.org** and **birdsoftheworld.org**.

No key or account is used for these loads, no SnowRaven server is involved, and the developer adds no tracking and keeps no copy. These are Cornell Lab of Ornithology services; see [Cornell's privacy statement](https://privacy.cornell.edu/).

## Software Updates

SnowRaven checks whether a newer version is available by requesting the latest release information from GitHub (`api.github.com`). In the desktop apps, choosing **Check For Updates** then downloads the new version directly from GitHub's release assets and installs it in place. As with any request to a website, GitHub receives your IP address when these checks and downloads happen. No API key or account is used, no SnowRaven server is involved, and the developer adds no tracking and keeps no copy. Downloaded updates are cryptographically verified before they are installed. See [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

## Children

SnowRaven does not collect data from anyone, including children under 13.

## Changes to This Policy

If this policy ever changes, the updated version will be posted here with a revised effective date.

## Contact

Questions about privacy? Reach out at [developer@dtgibson.com](mailto:developer@dtgibson.com).
