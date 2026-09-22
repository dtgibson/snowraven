# SnowRaven

Self-hosted birding tools and data explorer for your eBird workflow: a native Mac, Windows, iPhone or iPad app, or self-hosted on a Raspberry Pi (or any computer on your network).

SnowRaven reads your eBird and Macaulay Library exports and gives you weather and tides for your checklists, your history with every species, life-list statistics and an interactive map, on your own device.

**See it in action:** the [SnowRaven website](https://snowraven.dtgibson.com/) shows each tab with screenshots. [docs/HELP.md](docs/HELP.md), also the in-app Help on every tab, covers each tab in detail.

The weather lookup also exists as a browser extension, [SnowRaven Mini](https://github.com/dtgibson/snowraven-mini), separate from the app.

## What it does

### Weather

Paste a checklist ID and get a weather and tide summary ready to drop into the checklist comment, or look up the conditions where you are now, or the forecast for any place and time ahead. The Weather/tide Planner lays out the coming sunrises and sunsets, each with its tide and forecast weather.

### Statistics

A dashboard built from your eBird backup: life-list totals and growth, milestones, and when and where you bird. A weather section reads back the weather blocks SnowRaven and RainCrow write into checklist comments: the conditions on the outings you wrote a block for.

### Map Explorer

Your sightings on an interactive map, with nearby eBird hotspots and where species new to you were reported recently. Counties shade by your counts or by how complete your county list is, with a California Breeding Bird Atlas overlay.

### Species Detail

Your whole history with one bird: sightings, field notes, breeding codes and a map of every observation. A weather card shows the skies and temperatures you have found this bird in, drawn from the same SnowRaven and RainCrow weather blocks.

### Calendar

A year of your birding as twelve month grids, each day shaded by how many species you saw. Fold the years together, or narrow it to a single species.

### Multimedia

Your life list as a media checklist: which species you have photographed, recorded and filmed, and which you still need. Narrow it by sex and age.

### Breeding Codes

Every species you have recorded breeding evidence for, as a matrix against eBird's breeding codes, colored by evidence tier.

### Checklists

Your checklists as whole outings: search every comment you have written, and filter by what an outing has.

### List Comparer

Two life lists side by side, or any two public checklists: what they share and what only one has.

### Named Birds

Tag an individual bird by name in a species comment and SnowRaven gathers everything you have on it: sightings, places, a timeline, its own media. With several named birds, one strip puts them all on a shared time axis.

## Privacy

Private by default, and in your control: no account, no analytics, no telemetry, no server we run. Your eBird backup, Macaulay Library export and API keys are stored only on your device unless you turn on iCloud syncing between your devices, and anything you sync goes to your own iCloud account and nowhere else. Details: [Privacy Policy](PRIVACY_POLICY.md) · [Accessibility statement](ACCESSIBILITY.md).

## What you'll need

Two free API keys, entered once in Settings:

- **eBird API key**, from [ebird.org/api/keygen](https://ebird.org/api/keygen).
- **OpenWeather API key**, from [openweathermap.org](https://openweathermap.org), subscribed to the free **One Call by Call** plan (activating it needs a payment card on file; set a usage cap to avoid charges).

Most tabs also read your **eBird backup** (`MyEBirdData.csv`, from [ebird.org/downloadMyData](https://ebird.org/downloadMyData)) and, for the media features, an optional **Macaulay Library export**.

## Installation

- **Mac**: download `SnowRaven_x.x.x_universal.dmg` from the [latest release](https://github.com/dtgibson/snowraven/releases/latest) (one universal build for Apple Silicon and Intel), drag SnowRaven to Applications, and right-click the app and choose **Open** on first launch.
- **iPhone / iPad**: get SnowRaven from the [App Store](https://apps.apple.com/app/id6787719977). Free, iOS 16 or later. Updates arrive through the App Store like any other app.
- **Windows**: download `SnowRaven_x.x.x_x64-setup.exe` from the [latest release](https://github.com/dtgibson/snowraven/releases/latest) and run it. The app isn't code-signed yet, so SmartScreen may warn "unknown publisher": click **More info**, then **Run anyway**. In-app updates are cryptographically verified regardless.
- **Raspberry Pi / Linux**: one command on your Pi (or any Debian/Ubuntu machine) handles packages, the build, API keys, and an optional auto-start service:

  ```bash
  curl -fsSL https://raw.githubusercontent.com/dtgibson/snowraven/main/install.sh | bash
  ```

**Updating**: desktop apps update in place from **Check For Updates** in the footer; iPhone and iPad update through the [App Store](https://apps.apple.com/app/id6787719977); self-hosted installs run `./update.sh`.

## Build from source

Clone the repo, then `cd frontend && npm install && npm run dev` (with `cd backend && uvicorn main:app --reload --port 1620` for the server), or, from the repo root, `npm install && npm run desktop:dev` for the Tauri desktop app. Requires Node.js, Python 3.10+, and (for the desktop build) [Rust](https://rustup.rs/).

## Attribution

Weather: [OpenWeather](https://openweathermap.org/) · Checklist & media data: [eBird](https://ebird.org/) / [Macaulay Library](https://www.macaulaylibrary.org/).

The weather lookup mirrors the output format of [raincrow.app](https://raincrow.app/), the original idea and inspiration. SnowRaven exists to self-host your *own* checklist lookups, please don't circumvent that free service's rate limits. If you find this useful, consider [buying raincrow.app's creator a coffee](https://ko-fi.com/parkerdavisaz).
