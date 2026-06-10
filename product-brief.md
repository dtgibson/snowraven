# Product Brief — SnowRaven

## What This Is
A personal birding companion for your own eBird and Macaulay Library data. SnowRaven turns your eBird backup and Macaulay export into a local dashboard — weather and tide for your checklists, deep per-species history, life-list and media analytics, breeding-code history, individual-bird tracking, list comparison, and interactive maps. It runs as a standalone Mac or Windows desktop app, or self-hosted on a Raspberry Pi or any computer on your network.

It began as a single-purpose weather-lookup tool (see *Origin* below) and grew into a full eBird/Macaulay workflow companion. This brief reflects what it has become.

## The Problem
Birders accumulate years of observations and media in eBird and the Macaulay Library, but the official tools don't let you explore your *own* data in all the ways you might want — per-species history, coverage gaps, patterns over time, individual birds you've come to recognize, or weather context for a checklist. SnowRaven gives you those views over your own exports, on your own device.

## Who It's For
A birder who logs observations on eBird (and often uploads media to the Macaulay Library) and wants richer ways to look at their own records. Comfortable installing a desktop app, or self-hosting on a Raspberry Pi or local machine. Personal and small-group use — not a public service.

## Why It Should Exist
It works *alongside* eBird and the Macaulay Library, never replacing them, and never sends your data anywhere. Owning the app and your API keys means no rate limits, no dependency on a third-party service staying alive, full control of the output, and a hard privacy guarantee: nothing is collected, no server is operated, your data stays with you. It's a personal project shared as a free public good, with gratitude to the free services it builds on.

## What Success Looks Like
A birder installs SnowRaven, points it at their eBird backup and Macaulay export, and immediately explores their birding life in ways eBird doesn't offer — while still being able to paste a checklist ID and get a ready-to-paste weather + tide block, the original workflow that started it all. Everything runs locally and offline-capable, with the only network calls going directly to eBird, OpenWeather, OpenStreetMap/Nominatim, and NOAA, authenticated with the user's own keys, on demand.

## What It Does (current feature set)
- **Weather & Tide Lookup** — formatted historical weather plus the nearest-station tide for a checklist, ready to paste into the comment.
- **Species Detail** — full per-species history: stats, breeding codes, co-occurring species, notes, top locations, an observation map, and embedded Macaulay media.
- **Statistics** — a multi-section analytics dashboard (life list and growth, milestones, temporal and geographic patterns, effort, data quality, breeding, deep media stats, nearby targets).
- **Map Explorer** — an interactive sightings map with heatmap, nearby hotspots colored by visited state, media targets, and an optional California Breeding Bird Atlas overlay.
- **Multimedia** — photo/audio/video coverage per species, to find capture gaps.
- **Breeding Codes** — a color-coded matrix of every breeding code you've recorded.
- **Named Birds** — track individual birds you've named in eBird comments with a `[name:…]` tag, across every checklist.
- **List Comparer** — compare two life lists, or two individual eBird checklists, side by side.

## Founding Decisions (still in force)
- Local-first and privacy-first — collects nothing, runs no developer-operated server, your data stays on your device.
- Works alongside eBird and the Macaulay Library; never replaces or competes with them.
- No accounts, no authentication — your own API keys, entered once.
- Distributed as a standalone Mac/Windows desktop app and a self-hosted Pi/Linux install.
- Network calls only to eBird, OpenWeather, OpenStreetMap/Nominatim, and NOAA, with the user's keys, on demand.

## Out of Scope
- User accounts or authentication
- Any developer-operated server, cloud backend, analytics, or telemetry
- A public, hosted, multi-tenant service
- Using or transmitting anyone's data off their own device

## Origin (the founding brief, for the record)
SnowRaven started as a lightweight, self-hosted tool that took an eBird checklist number and returned a formatted block of historical weather — ready to paste into a checklist comment. It was conceived as a personal, resilient alternative to raincrow.app: owning the API keys and hosting meant no rate limits and no dependence on a third-party service staying alive. That weather lookup still ships today as one feature among many, now paired with tide data and surrounded by the analytics tools above.
