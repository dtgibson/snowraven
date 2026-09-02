# SnowRaven

Self-hosted birding tools and data explorer for your eBird workflow: a native Mac or Windows app, or self-hosted on a Raspberry Pi (or any computer on your network).

SnowRaven turns the eBird and Macaulay Library exports you already have into a personal birding dashboard: weather and tides for your checklists, per-species history, life-list analytics, media-coverage tracking, breeding-code history, a calendar of your birding, and an interactive map. Everything runs on your own device, from your own data.

**See it in action:** the [SnowRaven website](https://snowraven.dtgibson.com/) walks through every feature with screenshots. Full per-feature documentation lives in [docs/HELP.md](docs/HELP.md) and in-app from the Help link on every tab.

## What it does

- **Weather & Tide Lookup**: paste a checklist ID and get a paste-ready historical weather summary plus the tide from the nearest NOAA station. Current and forecast lookups work too, and a backlog lists your recent checklists still missing a weather block.
- **Species Detail**: your complete history with any species: stats, top locations, field notes, subspecies breakdowns, a sightings map with county shading, and embedded Macaulay Library media.
- **Statistics**: life-list totals and growth, milestones, temporal and geographic patterns, effort, data quality, breeding and media stats, escapee accounting per eBird's life-list rule, and which eBird projects your checklists were submitted to (checked on demand with your own key). Its Geographic Stats map shades counties with numbers that match the county tables beside it, and the Map Explorer's too while Count all forms is off (the Map Explorer always applies the countable-species rule).
- **Calendar**: your birding year as twelve month grids, each day shaded by how busy it was. Entirely offline.
- **Map Explorer**: your sightings with heatmap and filters, nearby hotspots, nearby lifers, media targets, a breeding-atlas overlay, county lines and coverage shading, and a share-a-spot pin that copies coordinates and map links as plain text.
- **Multimedia**: photo, audio, and video coverage for every species on your life list, with sex and age filters, to see what you still need to capture.
- **Breeding Codes**: every species you've recorded breeding evidence for, as a color-coded code-by-species matrix.
- **Named Birds**: track individual birds you've named in species comments with a `[name:…]` tag: each one's history, its own map, and its own media.
- **Checklists**: search everything you've ever written in a comment, and filter your checklists by comments, media, breeding codes, protocol, county, and dates.
- **List Comparer**: compare two life lists, or two individual checklists side by side.
- **Settings**: keys, files, appearance (light/dark, text size to 200%, date format), sharing preferences, tab layout, and (on Mac, iPhone and iPad) iCloud Sync, plus an Acknowledgments section crediting The Cornell Lab of Ornithology and the Macaulay Library, and Deven Simonson.
- **Offline**: every analytical tab and map keeps working without a connection once it has loaded online at least once; genuinely live lookups (weather and tide, place search, nearby-bird overlays, app updates) need the network and say so plainly.
- **Desktop window**: on Mac and Windows the app reopens at the size, position and maximized state you left it in, and is brought back onto a visible screen if the display it was saved on is gone. Per-machine, never synced.

**iCloud Sync (Mac, iPhone and iPad):** an opt-in switch in Settings, off by default, keeps your eBird backup and Macaulay Library export the same on every Apple device signed in to your own iCloud account, so a fresh export uploaded once is used everywhere. Only the two files and their upload details are synced by that switch, into your own account. A second off-by-default **Sync API keys** switch in the same section can share your eBird and OpenWeather keys the same way, with its own plain-language note first, so a key entered once on any device is used by every device that also turns it on. Settings and caches stay on each device, and the developer never sees any of it.

A companion browser extension, [SnowRaven Mini](https://github.com/dtgibson/snowraven-mini), runs the same weather and tide lookup right on the eBird checklist page. It's separate from SnowRaven and not required by it.

## Privacy

Local-first, and it collects nothing: no accounts, no analytics, no telemetry, no developer-operated server. Your exports and settings stay on your device, and so do your API keys unless you turn on the optional iCloud key sync on a Mac, iPhone or iPad, which copies them only into your own iCloud account. Network requests go directly from your device to the services the app draws from, with your own keys where keys are needed. Details: [Privacy Policy](PRIVACY_POLICY.md) · [Accessibility statement](ACCESSIBILITY.md).

## Requirements

Two free API keys, entered once in Settings:

- **eBird API key**, from [ebird.org/api/keygen](https://ebird.org/api/keygen).
- **OpenWeather API key**, from [openweathermap.org](https://openweathermap.org), subscribed to the free **One Call by Call** plan (activating it requires a payment card on file even though the free tier is free; set a usage cap to avoid charges).

Most tabs also use your own data files: your **eBird backup** (`MyEBirdData.csv`, from [ebird.org/downloadMyData](https://ebird.org/downloadMyData)) and, optionally, your **Macaulay Library export** for the media features.

## Installation

- **Mac**: download `SnowRaven_x.x.x_universal.dmg` from the [latest release](https://github.com/dtgibson/snowraven/releases/latest) (one universal build for Apple Silicon and Intel), drag SnowRaven to Applications, and right-click the app and choose **Open** on first launch.
- **Windows**: download `SnowRaven_x.x.x_x64-setup.exe` from the [latest release](https://github.com/dtgibson/snowraven/releases/latest) and run it. The app isn't code-signed yet, so SmartScreen may warn "unknown publisher": click **More info → Run anyway**. (In-app updates are cryptographically verified regardless.)
- **Raspberry Pi / Linux**: one command on your Pi (or any Debian/Ubuntu machine) handles packages, the build, API keys, and an optional auto-start service:

  ```bash
  curl -fsSL https://raw.githubusercontent.com/dtgibson/snowraven/main/install.sh | bash
  ```

**Updating**: desktop apps update in place from **Check For Updates** in the footer; self-hosted installs run `./update.sh`. (The `npm` security summary that update prints comes from build-only tooling that never ships; a production-scoped `npm audit --omit=dev` reports zero.)

## Build from source

Clone the repo, then `cd frontend && npm install && npm run dev` (with `cd backend && uvicorn main:app --reload --port 1620` for the server), or, from the repo root, `npm install && npm run desktop:dev` for the Tauri desktop app. Requires Node.js, Python 3.10+, and (for the desktop build) [Rust](https://rustup.rs/).

## Attribution

Weather: [OpenWeather](https://openweathermap.org/) · Checklist & media data: [eBird](https://ebird.org/) / [Macaulay Library](https://www.macaulaylibrary.org/).

The Weather lookup mirrors the output format of [raincrow.app](https://raincrow.app/), the original idea and inspiration. SnowRaven exists to self-host your *own* checklist lookups, please don't circumvent that free service's rate limits. If you find this useful, consider [buying raincrow.app's creator a coffee](https://ko-fi.com/parkerdavisaz).
