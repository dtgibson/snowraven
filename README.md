# SnowRaven

Birding analytics and tools for your eBird workflow — as a standalone Mac or Windows app, or self-hosted on a Raspberry Pi (or any computer on your network).

SnowRaven turns your own eBird and Macaulay Library exports into a personal birding dashboard: weather for your checklists, deep per-species history, life-list analytics, media-coverage tracking, breeding-code history, and an interactive map — all running on your own device, with your own data.

**See it in action:** the [SnowRaven website](https://snowraven.dtgibson.com/) walks through every feature with screenshots.

## What it does

- **Weather Lookup** — paste an eBird checklist ID and get a formatted historical weather summary (temperature, wind, humidity, dew point, sunrise/sunset, and the moon phase on night checklists) ready to paste into your checklist comment. The same lookup also shows the historical **tide** from the nearest NOAA station (observed or predicted, with the surrounding high/low tides), and can copy weather and tide together. You can also look up weather and tide **directly**, without a checklist: **Current** for where you are right now, or **Predict** for a place and time you choose (a name search or a map pin) — forecast weather up to about a week out, plus the predicted tide, which reaches much further ahead.
- **Species Detail** — your complete history with any species: sighting stats, breeding codes, co-occurring species, field notes, top locations, a map of every observation, and embedded Macaulay Library media.
- **Statistics** — a multi-section analytics dashboard: life-list totals and growth, top species, firsts and milestones, temporal and geographic patterns, effort and outings, data quality, highlights and records, breeding stats, and deep media stats (documentation coverage, age/gender and behavior breakdowns, and time-of-day).
- **Map Explorer** — an interactive map of your sightings (with heatmap), nearby eBird hotspots colored by whether you've visited them, media targets, and an optional California Breeding Bird Atlas overlay. A **Nearby Lifers** section maps *where* species you've never recorded were reported recently near a chosen point — each spot is a labeled pin (the species, or "{n} species" where several were reported together) colored by how recently it was seen, and clicking it shows the lifers with dates and eBird checklist links. Pick a point with your location, a place-name search, or a radius, and filter by a **Time Range** (last day / week / 30 days). Switchable street / satellite / topo basemaps plus a hiking-trails overlay.
- **Multimedia** — your life list with photo/audio/video coverage per species, with **sex and age filters** (pull up just your juveniles, or the males of a sexually dimorphic species) and links straight to the matching Macaulay Library media — to find what you still need to capture.
- **Breeding Codes** — every species you've recorded a breeding code for, as a color-coded matrix across all eBird codes.
- **Named Birds** — track individual birds you've named in your eBird species comments with a `[name:…]` tag (e.g. `[name:Winky]`): each individual's species, first/last-seen, sighting count, and every checklist it appears on (with its location and a map of where that bird has been seen). Sort by name, alphabetical, taxonomic, or last seen. Also surfaces per-species on Species Detail.
- **Checklists** — your checklists as whole outings: search every checklist comment and every species comment you've ever written (last 10 shown, expandable, with eBird links), and browse a filterable list of all your checklists — combine has/doesn't-have filters for comments, media (by type with the ML export), breeding codes, weather/tide blocks, complete/incomplete, protocol, county, and date range. A toggle (off by default) hides pasted SnowRaven weather/tide blocks from display *and* search.
- **List Comparer** — compare two life lists (your backup vs. another birder's) to see shared and unique species, or compare two individual eBird checklists by ID/URL with side-by-side counts (higher-count emphasis), breeding codes, photo/audio/video indicators, effort details (type, distance, duration, observers, app), and checklist + species comments (with a side-by-side comments table). Each checklist card also shows at-a-glance badges (media, breeding, and whether the comment already has a weather/tide block), and a **Weather & Tide** section can pull a fresh weather and tide reading for each checklist to compare conditions side by side (on demand, with per-side copy buttons — nothing is copied automatically).

Full per-feature documentation lives in **[docs/HELP.md](docs/HELP.md)**.

A companion project, [SnowRaven Mini](https://github.com/dtgibson/snowraven-mini), is a small Chrome and Firefox extension that runs the same weather and tide lookup right on the eBird checklist page. It's separate from SnowRaven and not required by it.

## Privacy

SnowRaven is local-first and **collects nothing** — no accounts, no analytics, no telemetry, and no developer-operated server. Your eBird backup, Macaulay Library export, settings, and API keys stay on your own device (or your own self-hosted machine). Network requests go directly from your device to the services the app draws from — eBird, OpenWeather, OpenStreetMap/Nominatim, and NOAA Tides & Currents with *your* API keys where keys are needed, plus the keyless map-tile hosts and the Cornell Lab sites that embedded Macaulay media and bird-link icons load from. The full provider list is in the [Privacy Policy](PRIVACY_POLICY.md); see also the [Accessibility statement](ACCESSIBILITY.md).

## Requirements

Two free API keys, entered once in the app's Settings:

- **eBird API key** — free, from [ebird.org/api/keygen](https://ebird.org/api/keygen). Powers weather lookups and nearby-sighting features.
- **OpenWeather API key** — free, from [openweathermap.org](https://openweathermap.org). You must subscribe to the **One Call by Call** plan (free for the first 1,000 calls/day) or weather lookups return an error.

Most analytics tabs also use your own data files (optional, but they unlock most features):

- **eBird backup** (`MyEBirdData.csv`) from [ebird.org/downloadMyData](https://ebird.org/downloadMyData) — powers Species Detail, Statistics, Map Explorer, Breeding Codes, Multimedia, Named Birds, Checklists, and List Comparer.
- **Macaulay Library export** (optional) — adds media coverage and trends.

## Installation

### Mac

Download `SnowRaven_x.x.x_universal.dmg` from the [latest release](https://github.com/dtgibson/snowraven/releases/latest) — one universal build runs natively on both Apple Silicon and Intel Macs. Open the DMG, drag SnowRaven to Applications, and launch it. On first launch, right-click the app and choose **Open** to clear the macOS security prompt.

### Windows

Download `SnowRaven_x.x.x_x64-setup.exe` from the [latest release](https://github.com/dtgibson/snowraven/releases/latest) and run it. The app isn't code-signed yet, so SmartScreen may warn "unknown publisher" — click **More info → Run anyway**. (In-app updates are cryptographically verified regardless.)

### Raspberry Pi / Linux

Run one command on your Pi (or any Debian/Ubuntu machine):

```bash
curl -fsSL https://raw.githubusercontent.com/dtgibson/snowraven/main/install.sh | bash
```

It handles everything — system packages, Node.js, the build, the Python environment, API keys, and an optional auto-start service. Then open the app in your browser on your local network.

**Updating:** desktop apps update from **Check For Updates** in the footer; self-hosted installs run `./update.sh`.

## Build from source

For development or building your own bundle: clone the repo, then `cd frontend && npm install && npm run dev` (with `cd backend && uvicorn main:app --reload --port 1620` for the server), or `npm run desktop:dev` for the Tauri desktop app. Requires Node.js, Python 3.10+, and (for the desktop build) [Rust](https://rustup.rs/).

## Attribution

Weather: [OpenWeather](https://openweathermap.org/) · Checklist & media data: [eBird](https://ebird.org/) / [Macaulay Library](https://www.macaulaylibrary.org/).

The Weather lookup mirrors the output format of [raincrow.app](https://raincrow.app/) — the original idea and inspiration. SnowRaven exists to self-host your *own* checklist lookups, please don't circumvent that free service's rate limits. If you find this useful, consider [buying raincrow.app's creator a coffee](https://ko-fi.com/parkerdavisaz).
