# SnowRaven Privacy Policy

**Effective date:** August 25, 2026

## Overview

SnowRaven is a self-hosted birding tools app. It runs as a standalone desktop app (macOS and Windows), as an app on iPhone and iPad, or on your own machine such as a Raspberry Pi. This policy describes what happens to your data. The short version: it stays with you.

## Your Data Stays on Your Device

SnowRaven keeps your data on your own device by choice and design. You keep it, and you control it.

- Your API keys, app settings, and the files you upload (your eBird backup and Macaulay Library export) are stored only on your device (in the desktop app's local data directory, or in the iOS app's on-device sandbox on iPhone and iPad), or on your own machine when you self-host the web/Pi version. They are never uploaded to the developer or to any service the developer runs.
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

SnowRaven's job is to fetch birding and weather information for you, so the app does make requests to a few outside services, using your own API keys, and only to get the data you ask for. These requests go directly from your device (or your own self-hosted server) to the provider. There is no SnowRaven server in the middle, and nothing is logged or retained by the developer.

- **eBird**: to look up checklist details, hotspots, recent nearby sightings (including, when you turn on the map's Recent activity hotspot coloring, the recent community sightings at each public hotspot in your current search, one request per hotspot, bounded and cached on your device for six hours), region info (including the species list ever reported for a county region, used by the map's county Completeness shading), and species taxonomy. Uses your own eBird API key. See [eBird's terms](https://www.birds.cornell.edu/home/ebird-api-terms-of-use/).
  - The Statistics tab also asks eBird about a set of your own checklists, in order to find out which of your birds eBird tags as exotic escapees. It sends only your own checklist IDs, and only a small covering subset of them (73 on a 21,000-observation export, worked out on your device before anything is sent), not your whole history. The answer is stored on your device for 30 days, so returning to the tab does not repeat the requests. If you have no eBird key or no connection, nothing is sent and the tab says so. What is new here is that a figure summarizing your own history now depends on a lookup: the Statistics tab's displayed numbers were previously worked out on your device. The tab itself has always made requests, which is a different thing, and worth stating plainly on this page: it matches your species names against the bird taxonomy, and it asks eBird which locations in the regions you have birded are public hotspots. The name matching happens against a copy of the taxonomy the app already holds, so your species list is not sent to eBird. Other parts of the app already show numbers that come from eBird, such as a county's completeness percentage on the map and a hotspot's species count.
- **OpenWeather**: to fetch weather, either the historical weather for a checklist, or the current and forecast weather for a location and time you choose. Uses your own OpenWeather API key. See [OpenWeather's privacy policy](https://openweather.co.uk/privacy-policy).
- **Nominatim (OpenStreetMap)**: to turn a place name you type into map coordinates, and to look up the county for a set of coordinates. See the [OSM privacy policy](https://wiki.osmfoundation.org/wiki/Privacy_Policy).
- **NOAA Tides & Currents (CO-OPS)**: to fetch the tide for a checklist's location and time, or the current or predicted tide for a location and time you choose. No key or account; a U.S. government service. See [NOAA's privacy policy](https://www.noaa.gov/protecting-your-privacy).

What you send to these services (a checklist ID, a location, a search term) is governed by each provider's own privacy policy. SnowRaven only relays the request you initiated; it does not add tracking and does not keep a copy.

## Your Location

When you use a location control (the location button on the map, "Use my location" in the map's filters or when setting a default location in Settings, or the "Current" weather and tide lookup), SnowRaven asks your device or browser for your current coordinates, with your permission. Those coordinates stay on your device: they set the map's center and can be saved as your default location locally. They are only sent outward if you then run a search (for hotspots or nearby sightings) or use the "Current" lookup, which sends your coordinates to OpenWeather and NOAA to fetch the weather and tide where you are, the same as coordinates you type in by hand. You can deny or revoke the permission at any time through your operating system or browser settings.

One thing worth saying plainly, because the paragraph above is easy to read as more than it claims: centering the map on you moves the map to where you are, and the map then draws that area, which means it requests map tiles for it. Your coordinates are not sent to the tile provider, but the tiles you request are for the area around you, and the provider sees your IP address and which part of the map you are looking at, exactly as described in "Map Tiles" below. That is true of panning the map there by hand as well. It is the normal behavior of any map, and it is the one outward consequence of centering on yourself.

On iPhone and iPad, the first time you tap "Use my location" iOS shows the system location permission prompt ("SnowRaven uses your location to center the map on your current position"). SnowRaven requests location only while you're using the app, never in the background. You can allow or deny it, and change your choice at any time in Settings → Privacy & Security → Location Services. Denying it leaves everything else working: you can always type coordinates or search for a place by name.

## Map Tiles

The maps in SnowRaven are drawn using map tiles served by third-party providers. As you pan and zoom, your device requests the tiles for the area you are viewing directly from these providers, so, like any website that displays a map, they receive your IP address and which part of the map you are looking at. No SnowRaven server is involved, no API key or account is used, and the developer adds no tracking and keeps no copy. You choose which base map is active with the layer switcher, and only the active layers' tiles are requested. Tiles come from:

- **OpenFreeMap** (`tiles.openfreemap.org`): the default "Map" base map, served as vector tiles. The map's style definition is fetched from OpenFreeMap as well. The label fonts (glyphs) and icon sheet (sprite) are **not**: they ship inside the app and load from it directly, so no request for them leaves your device. A free, keyless, community-run service; see [openfreemap.org](https://openfreemap.org/).
- **Esri** (`server.arcgisonline.com`): the "Satellite" base map. See [Esri's privacy statement](https://www.esri.com/en-us/privacy/overview).
- **USGS: The National Map** (`basemap.nationalmap.gov`): the "Topo (US)" base map (United States only); a U.S. government service.
- **Waymarked Trails** (`tile.waymarkedtrails.org`): the optional "Trails" overlay. See [waymarkedtrails.org](https://hiking.waymarkedtrails.org/).

## iOS App

The iOS/iPadOS app is the same local-first application: your files, keys, and settings live in the app's sandbox on your device, are included in your device/iCloud backups under the iOS defaults, and are removed when you delete the app. The app collects nothing and adds no service connections beyond those listed above.

## Embedded Bird Media and Link Icons

A few things in the app load directly from the Cornell Lab of Ornithology's websites, the same way any web page loads an embedded image, so, like the map tiles above, those sites receive your IP address and the specific item requested:

- **Macaulay Library embeds**: while embedded media is enabled, the Species Detail tab and the Named Birds tab can show your photos, audio, and video embedded from **macaulaylibrary.org**; loading one tells the Macaulay Library which asset was viewed. Because the Cornell Lab now runs a bot check that an embedded player cannot pass, SnowRaven also makes one small status request to **macaulaylibrary.org** per session, to find out whether players will work at all and show its own placeholder instead of a broken one. That request carries no information about you beyond what any request carries (your IP address) and the catalog number of an item already about to be shown. In the web/Pi version it is made by your own self-hosted SnowRaven server rather than by your browser; in the desktop and mobile apps the app makes it directly. The **Disable embedded media** option in Settings is off by default. Turning it on prevents all of those players, their asset requests, and that status check from happening at all; direct Macaulay Library links remain available and contact the site only when you choose to open one.
- **Site icons next to bird names**: the small link icons shown beside bird names throughout the app load from **ebird.org** and **birdsoftheworld.org**.

No key or account is used for these loads, no developer-operated server is involved, and the developer adds no tracking and keeps no copy. These are Cornell Lab of Ornithology services; see [Cornell's privacy statement](https://privacy.cornell.edu/).

## Software Updates

In the desktop and web/Pi versions, SnowRaven checks whether a newer version is available by requesting the latest release information from GitHub (`api.github.com`). In the desktop apps, choosing **Check For Updates** then downloads the new version directly from GitHub's release assets and installs it in place. As with any request to a website, GitHub receives your IP address when these checks and downloads happen. No API key or account is used, no SnowRaven server is involved, and the developer adds no tracking and keeps no copy. Downloaded updates are cryptographically verified before they are installed. See [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement).

On iPhone and iPad, updates are delivered through the App Store (or TestFlight for pre-release builds). The iOS app contains no self-update mechanism of its own and does not make the GitHub update check described above.

## Children

SnowRaven does not collect data from anyone, including children under 13.

## Changes to This Policy

If this policy ever changes, the updated version will be posted here with a revised effective date.

## Contact

Questions about privacy? Reach out at [developer@dtgibson.com](mailto:developer@dtgibson.com).
