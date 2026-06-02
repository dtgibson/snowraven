# SnowRaven

Self-hosted birding tools for your eBird workflow.

## Documentation

[Full documentation](docs/HELP.md) covers every tab, API key setup, and how to download and upload the data files that unlock most features.

See also the [Privacy Policy](PRIVACY_POLICY.md) (your data stays on your device — SnowRaven collects nothing) and the [Accessibility statement](ACCESSIBILITY.md).

## Tools

### Weather Lookup

Paste an eBird checklist ID or URL and get a formatted historical weather summary for that time and location -- temperature, wind, humidity, dew point, sunrise/sunset, and conditions. The result is copied to your clipboard automatically, and a direct link to edit your checklist comment appears so you can paste it in straight away.

Compatible with the output format used by [raincrow.app](https://raincrow.app/). This is a self-hosted solution to retrieve weather data for many eBird checklists without rate limits. I feel it would be unethical to circumvent the rate limits of an online tool that is being generously made available to others for free; if the creator wishes to limit requests to five per day to keep the service broadly available, those wishes should be respected.

If you like this, the idea and inspiration really came from someone else, so [why not buy the creator of raincrow.app a coffee?](https://ko-fi.com/parkerdavisaz)

**How it works:**

1. Paste a checklist ID (`S12345678`) or full URL (`https://ebird.org/checklist/S12345678`)
2. Click **Get weather** -- the result copies to your clipboard automatically
3. Click **Edit on eBird** to open your checklist comment field directly, then paste

Weather data comes from the [OpenWeather One Call API 3.0](https://openweathermap.org/api/one-call-3) timemachine endpoint. Checklist metadata (date, location, duration) comes from the [eBird API](https://documenter.getpostman.com/view/664302/S1ENwy59).

### Species Detail

Explore your complete history with any species -- sighting stats, breeding codes, co-occurring species, field notes, your most-visited locations, a map of all observation coordinates, and embedded media from Macaulay Library. Select any species from the searchable dropdown and every section updates instantly. Requires your eBird backup saved in Settings.

**How it works:**

1. Save your `MyEBirdData.csv` in Settings -- Species Detail loads it automatically
2. Select a species from the dropdown -- type to search by common or scientific name
3. The Summary card shows your media coverage (Photo/Audio/Video) and highest breeding evidence category
4. The Sightings card shows checklist count, total individuals, personal best, and first/last seen dates -- each linked to the original checklist
5. Breeding Codes lists every code you've recorded with tier color, abbreviation, and count
6. Reported With shows the species most frequently appearing on the same checklists, ranked by co-occurrence percentage
7. Top Locations ranks where you've found the species most often, with links to each location on eBird
8. The map plots every observation coordinate -- click any pin to see the checklist dates recorded at that spot
9. Comments archives all your per-species field notes, filterable by keyword and sortable by date
10. Recent Media embeds your most recently uploaded photo, audio recording, and video from Macaulay Library (requires ML export in Settings)

**Toolbar options:**

- Show subspecies: off by default; merges subspecies variants into the parent species. Toggle on to split "Yellow-rumped Warbler (Myrtle)" and "Yellow-rumped Warbler (Audubon's)" into separate entries.
- Show sp./slash: off by default; hides uncertain identifications. Toggle on to include sp. and slash species in the selector.
- County and date-range filters appear when your eBird backup contains county data.

If your ML export is also saved in Settings, media counts in the Summary card become active and the Recent Media section appears automatically.

### Statistics

A comprehensive analytics dashboard built from your eBird backup. Nine cards cover your life list totals and accumulation chart, firsts and milestones, temporal patterns (by year, month, day, and hour), geographic stats with a location map, effort and methodology, data quality, breeding stats, media trends (requires ML export), and Top Local Target Species -- birds seen near your configured home location in the past 30 days that are missing from your life list. Requires your eBird backup saved in Settings.

### Map Explorer

An interactive map with three view modes: My Sightings (your personal recent observations with a heatmap overlay), Hotspots (eBird hotspots near a location, colored by whether you've visited them), and Media Targets (recent sightings of species you're missing media for). Requires an eBird API key. On small/mobile screens, a fullscreen button next to Filters expands the map to fill the whole screen.

In Hotspots mode, the panel lists the ten closest hotspots you haven't visited yet, each linking to its eBird page. An "Atlas blocks" toggle (available in all three view modes) overlays the official California Breeding Bird Atlas block boundaries for the area you're viewing; click any block to open it on the eBird California atlas. With the overlay on, "Shade by My Highest Breeding Code" tints each block by the strongest breeding code you've personally entered there, and a "Use Textures" toggle adds a per-level hatch pattern for colorblind-friendly, color-independent reading.

Click **Use my location** in the map controls to center the map on your current position and drop a blue pin at the detected location. In the desktop app this uses the native OS location service -- CoreLocation on macOS, the Windows Geolocation API on Windows -- and no location data leaves your device. macOS prompts for permission on first use; on Windows, enable location under Settings → Privacy & security → Location if it is off.

### Media List

See your complete life list with media coverage -- which species you've photographed, audio-recorded, and video-recorded. Each species name links directly to its eBird account and Birds of the World page. Filter by missing or present media type to find target species for your next outing.

Save your eBird backup and Macaulay Library export in Settings to unlock the full Comprehensive mode, which shows every life-listed species even if it has no media yet.

**How it works:**

1. Save your files in Settings under Default Files -- eBird backup and/or ML export. When exporting your Macaulay Library media, set the filter to **All** (not just Birds) and leave the downloaded filename unchanged so SnowRaven can read your user ID for personalized media links. See the [documentation](docs/HELP.md) for the full steps.
2. Open Media List -- your life list loads automatically with photo, audio, and video counts per species
3. Click any count to open that species' personal media on the Macaulay Library in a new tab
4. Click the eBird or Birds of the World icon next to a species name to open its species account
5. Use the filter pills to show species missing (or having) a photo, audio recording, or video
6. Click any column header to sort by name, photo count, audio count, video count, or total
7. Use the Is Target pill to quickly find species missing at least one media type

County and date-range filters appear in the toolbar when county data is available.

### Breeding Codes

See every species you've recorded a breeding code for, displayed as a matrix across all 23 eBird breeding codes. Each cell shows how many times you've recorded that code for that species, with colors following eBird's four-tier system -- darkest for Confirmed, lightest for Possible. Requires your eBird backup saved in Settings.

**How it works:**

1. Save your `MyEBirdData.csv` in the Settings tab under Default Files
2. Open Breeding Codes -- your matrix loads automatically
3. Click any column header to sort by that code's count; click the species column to sort alphabetically or by taxonomic order
4. Use the filter pills to focus on a single code or evidence category (Confirmed, Probable, Possible)
5. A legend at the bottom maps tier colors to their categories and codes

Slash species, hybrids, and `sp.` entries are excluded. Subspecies parentheticals (e.g. "Yellow-rumped Warbler (Myrtle)") are merged into the parent species entry.

### Life List Comparer

Compare your life list against another birder's to see which species you share and which are unique to each list. Your list loads automatically from Settings if you've saved your eBird backup. Each species name links directly to its eBird account and Birds of the World page.

**How it works:**

1. Save your `MyEBirdData.csv` in Settings -- it loads as "My List" automatically
2. Drop another birder's eBird backup CSV onto the List B slot
3. Click **Compare Lists** to see three panels: species in both, species only in List A, species only in List B
4. Click the eBird or Birds of the World icon next to a species name to open its species account
5. Use the Taxonomic / A-Z toggle to switch sort order
6. Use **Show all** to expand all panels to full length for printing

### Settings

The Settings tab lets you configure API keys, save default files, set a default location, and customize the tab layout so everything loads automatically each session.

**API keys:** Enter your eBird and OpenWeather API keys directly in the app. In the desktop app, keys are stored in the app's local data directory (`api-keys.json`). In web/Pi mode, keys are saved to the server's `.env` file. Changes take effect immediately -- no restart needed. Saved keys are masked by default with a Show/Hide toggle.

**Default files:** Upload your eBird backup CSV and Macaulay Library export once and they load automatically whenever you open the Breeding Codes, Media List, Species Detail, Statistics, or Life List Comparer tabs.

**Default location:** Set a home location (latitude, longitude, and radius) used by the Map Explorer and the Top Local Target Species card in Statistics.

**Tab layout:** Reorder and show or hide individual tabs. The Settings tab is always last. On narrow screens and mobile browsers the tab bar automatically collapses into a compact dropdown that follows the same order and visibility choices, so all tabs stay reachable without horizontal scrolling.

---

## Prerequisites

You need two free API keys before installation:

### eBird API key
1. Sign in at [ebird.org](https://ebird.org)
2. Go to [ebird.org/api/keygen](https://ebird.org/api/keygen)
3. Copy your key

### OpenWeather API key
1. Create a free account at [openweathermap.org](https://openweathermap.org)
2. Go to **API keys** in your account dashboard and copy your key
3. Go to **Billing plans** and subscribe to **One Call by Call** (free tier: first 1,000 calls/day at no cost -- you must subscribe explicitly or the API returns 401)

---

## Desktop app installation (Mac)

The desktop app is a fully self-contained Mac application -- no Python, no server, no configuration files. Download, open, and enter your API keys.

### 1. Download

Go to the [latest release](https://github.com/dtgibson/snowraven/releases/latest) and download `SnowRaven_x.x.x_aarch64.dmg` (Apple Silicon) or `SnowRaven_x.x.x_x64.dmg` (Intel).

### 2. Install

Open the DMG, drag SnowRaven to Applications, and launch it from there. On first launch, macOS may show a security prompt -- right-click the app and choose Open to bypass it.

### 3. Enter API keys

Open the Settings tab and enter your eBird and OpenWeather API keys. Keys, settings, and the data files you upload (eBird backup, ML export) are all stored in the app's local data directory (`~/Library/Application Support/com.snowraven/data/`).

### Updating

Click **Check For Updates** in the app footer. If an update is available, click **Install update** to download and apply it -- the app will prompt you to relaunch when ready.

---

## Desktop app installation (Windows)

The desktop app is also a fully self-contained Windows application -- no Python, no server. It has the same features as the Mac app.

### 1. Download

Go to the [latest release](https://github.com/dtgibson/snowraven/releases/latest) and download `SnowRaven_x.x.x_x64-setup.exe`.

### 2. Install

Run the installer. Because the app is not yet code-signed, Windows SmartScreen may show an "unknown publisher" warning on first launch -- click **More info**, then **Run anyway**. (The in-app updater is cryptographically verified regardless, so updates are safe.)

### 3. Enter API keys

Open the Settings tab and enter your eBird and OpenWeather API keys. Keys, settings, and uploaded data files are stored in the app's local data directory.

### Updating

Same as macOS -- click **Check For Updates** in the app footer.

---

## Raspberry Pi / Linux installation

Run one command on your Pi (or any Debian/Ubuntu machine):

```bash
curl -fsSL https://raw.githubusercontent.com/dtgibson/snowraven/main/install.sh | bash
```

The installer will ask whether you want a **service install** (auto-starts on boot, recommended for Pi) or a **local install** (you run `./start.sh` manually). It handles everything: system packages, Node.js, the repo, frontend build, Python virtualenv, API key setup, and the systemd unit if you chose service mode.

API keys can be entered during install or skipped and added later in the app's Settings tab.

### Updating to a new version

```bash
cd ~/snowraven
./update.sh
```

This pulls the latest code, rebuilds the frontend, updates backend dependencies, and restarts the service if it's managed by systemd. You can also check for available updates from the app's footer without leaving the browser.

### Managing the service (service installs only)

```bash
# Stop the service
sudo systemctl stop snowraven

# Restart after a config change
sudo systemctl restart snowraven

# View logs
sudo journalctl -u snowraven -f
```

---

## Development setup

```bash
git clone https://github.com/dtgibson/snowraven.git
cd snowraven
cp .env.example .env
# Edit .env and add your API keys

# Terminal 1 - backend with hot reload
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 1620

# Terminal 2 - frontend dev server
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies API calls to the backend on port 1620.

### Running tests

```bash
cd backend
python -m pytest tests/ -v
```

### Desktop app (Tauri)

The repo includes a Tauri v2 project at `src-tauri/` for building the Mac and Windows standalone app. The desktop app is fully self-contained -- no Python backend or server is required. API keys, settings, and data files are all stored in the app's local data directory. All external API calls (eBird, OpenWeather, Nominatim) are made directly from the app. In-app updates are available from the app footer.

Prerequisites: [Rust](https://rustup.rs/) and the Tauri CLI (`npm install -g @tauri-apps/cli`).

```bash
# Run the desktop app in development mode (starts Tauri + Vite dev server)
npm run desktop:dev

# Build a production desktop app bundle
npm run desktop:build
```

---

## Security note

If you expose SnowRaven to the internet (not just your local network), put a reverse proxy such as [Caddy](https://caddyserver.com/) or [nginx](https://nginx.org/) in front of it for HTTPS. For local network use, plain HTTP on port 1620 is fine.

---

## Attribution

Weather data: [OpenWeather](https://openweathermap.org/) · Checklist and media data: [eBird](https://ebird.org/) / [Macaulay Library](https://www.macaulaylibrary.org/) · Inspired by [raincrow.app](https://raincrow.app/)
