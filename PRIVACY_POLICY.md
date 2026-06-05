# Privacy Policy — SnowRaven

**Effective date:** June 3, 2026

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

- **eBird** — to look up checklist details, hotspots, and recent nearby sightings. Uses your own eBird API key. See [eBird's terms](https://www.birds.cornell.edu/home/ebird-api-terms-of-use/).
- **OpenWeather** — to fetch historical weather for a checklist. Uses your own OpenWeather API key. See [OpenWeather's privacy policy](https://openweather.co.uk/privacy-policy).
- **Nominatim (OpenStreetMap)** — to turn a place name you type into map coordinates. See the [OSM privacy policy](https://wiki.osmfoundation.org/wiki/Privacy_Policy).

What you send to these services (a checklist ID, a location, a search term) is governed by each provider's own privacy policy. SnowRaven only relays the request you initiated; it does not add tracking and does not keep a copy.

## Map Tiles

The maps in SnowRaven are drawn using map tiles served by third-party providers. As you pan and zoom, your device requests the tiles for the area you are viewing directly from these providers — so, like any website that displays a map, they receive your IP address and which part of the map you are looking at. No SnowRaven server is involved, no API key or account is used, and the developer adds no tracking and keeps no copy. You choose which base map is active with the layer switcher, and only the active layers' tiles are requested. Tiles come from:

- **OpenFreeMap** — the default "Map" base map, served as vector tiles. A free, keyless, community-run service; see [openfreemap.org](https://openfreemap.org/).
- **Esri** — the "Satellite" base map. See [Esri's privacy statement](https://www.esri.com/en-us/privacy/overview).
- **USGS — The National Map** — the "Topo (US)" base map (United States only); a U.S. government service.
- **Waymarked Trails** — the optional "Trails" overlay. See [waymarkedtrails.org](https://hiking.waymarkedtrails.org/).

## Children

SnowRaven does not collect data from anyone, including children under 13.

## Changes to This Policy

If this policy ever changes, the updated version will be posted here with a revised effective date.

## Contact

Questions about privacy? Reach out at [developer@dtgibson.com](mailto:developer@dtgibson.com).
