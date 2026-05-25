# SnowRaven

Self-hosted birding tools for your eBird workflow.

## Documentation

[Full documentation](docs/HELP.md) covers every tab, API key setup, and how to download and upload the data files that unlock most features.

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

### Breeding Codes

See every species you've recorded a breeding code for, displayed as a matrix across all 23 eBird breeding codes. Each cell shows how many times you've recorded that code for that species, with colors following eBird's four-tier system -- darkest for Confirmed, lightest for Possible. Requires your eBird backup saved in Settings.

**How it works:**

1. Save your `MyEBirdData.csv` in the Settings tab under Default Files
2. Open Breeding Codes -- your matrix loads automatically
3. Click any column header to sort by that code's count; click the species column to sort alphabetically or by taxonomic order
4. Use the filter pills to focus on a single code or evidence category (Confirmed, Probable, Possible)
5. A legend at the bottom maps tier colors to their categories and codes

Slash species, hybrids, and `sp.` entries are excluded. Subspecies parentheticals (e.g. "Yellow-rumped Warbler (Myrtle)") are merged into the parent species entry.

### Media List

See your complete life list with media coverage -- which species you've photographed, audio-recorded, and video-recorded. Each species name links directly to its eBird account and Birds of the World page. Filter by missing or present media type to find target species for your next outing.

Save your eBird backup and Macaulay Library export in Settings to unlock the full Comprehensive mode, which shows every life-listed species even if it has no media yet.

**How it works:**

1. Save your files in Settings under Default Files -- eBird backup and/or ML export
2. Open Media List -- your life list loads automatically with photo, audio, and video counts per species
3. Click any count to open that species' personal media on the Macaulay Library in a new tab
4. Click the eBird or Birds of the World icon next to a species name to open its species account
5. Use the filter pills to show species missing (or having) a photo, audio recording, or video
6. Click any column header to sort by name, photo count, audio count, video count, or total
7. Use the Is Target pill to quickly find species missing at least one media type

### Life List Comparer

Compare your life list against another birder's to see which species you share and which are unique to each list. Your list loads automatically from Settings if you've saved your eBird backup. Each species name links directly to its eBird account and Birds of the World page.

**How it works:**

1. Save your `MyEBirdData.csv` in Settings -- it loads as "My List" automatically
2. Drop another birder's eBird backup CSV onto the List B slot
3. Click **Compare Lists** to see three panels: species in both, species only in List A, species only in List B
4. Click the eBird or Birds of the World icon next to a species name to open its species account
5. Use the Taxonomic / A-Z toggle to switch sort order
6. Use **Show all** to expand all panels to full length for printing

### Species Detail

Explore your complete history with any species -- sighting stats, breeding codes, field notes, your most-visited locations, a map of all observation coordinates, and embedded media from Macaulay Library. Select any species from the searchable dropdown and every section updates instantly. Requires your eBird backup saved in Settings.

**How it works:**

1. Save your `MyEBirdData.csv` in Settings -- Species Detail loads it automatically
2. Select a species from the dropdown -- type to search by common or scientific name
3. The Summary card shows your media coverage (Photo/Audio/Video) and highest breeding evidence category
4. The Sightings card shows checklist count, total individuals, personal best, and first/last seen dates -- each linked to the original checklist
5. Breeding Codes lists every code you've recorded with tier color, abbreviation, and count
6. Top Locations ranks where you've found the species most often, with links to each location on eBird
7. The map plots every observation coordinate -- click any pin to see the checklist dates recorded at that spot
8. Comments archives all your per-species field notes, filterable by keyword and sortable by date
9. Recent Media embeds your most recently uploaded photo, audio recording, and video from Macaulay Library (requires ML export in Settings)

**Toolbar options:**

- Show subspecies: off by default; merges subspecies variants into the parent species. Toggle on to split "Yellow-rumped Warbler (Myrtle)" and "Yellow-rumped Warbler (Audubon's)" into separate entries.
- Show sp./slash: off by default; hides uncertain identifications. Toggle on to include sp. and slash species in the selector.

If your ML export is also saved in Settings, media counts in the Summary card become active and the Recent Media section appears automatically.

### Statistics

A comprehensive analytics dashboard built from your eBird backup. Nine cards cover your life list totals and accumulation chart, firsts and milestones, temporal patterns (by year, month, day, and hour), geographic stats with a location map, effort and methodology, data quality, breeding stats, media trends (requires ML export), and Top Local Target Species -- birds seen near your configured home location in the past 30 days that are missing from your life list. Requires your eBird backup saved in Settings.

### Map Explorer

An interactive map with three view modes: My Sightings (your personal recent observations with a heatmap overlay), Hotspots (eBird hotspots near a location, colored by whether you've visited them), and Media Targets (recent sightings of species you're missing media for). Requires an eBird API key.

### Settings

The Settings tab lets you configure API keys, save default files, set a default location, and customize the tab layout so everything loads automatically each session.

**API keys:** Enter your eBird and OpenWeather API keys directly in the app. Keys are saved to the server's `.env` file and take effect immediately -- no restart needed. Saved keys are masked by default with a Show/Hide toggle.

**Default files:** Upload your eBird backup CSV and Macaulay Library export once and they load automatically whenever you open the Breeding Codes, Media List, Species Detail, Statistics, or Life List Comparer tabs.

**Default location:** Set a home location (latitude, longitude, and radius) used by the Map Explorer and the Top Local Target Species card in Statistics.

**Tab layout:** Reorder and show or hide individual tabs. The Settings tab is always last.

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

## Raspberry Pi installation

These instructions are for a Raspberry Pi running Raspberry Pi OS (64-bit recommended). The app will start automatically on boot and be accessible from any device on your local network.

### 1. Install system dependencies

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3 python3-pip python3-venv nodejs npm
```

Verify versions (Node 18+ and Python 3.10+ required):

```bash
node --version
python3 --version
```

### 2. Clone the repository

```bash
cd ~
git clone https://github.com/dtgibson/snowraven.git
cd snowraven
```

### 3. Configure API keys

The easiest way is through the app itself. Once the service is running (step 6), open SnowRaven in your browser, go to the **Settings** tab, and enter your keys there. They save to the server's `.env` file immediately.

If you prefer to set them before first run:

```bash
cp .env.example .env
nano .env
```

Replace the placeholder values with your real keys:

```
EBIRD_API_KEY=your-ebird-api-key-here
OPENWEATHER_API_KEY=your-openweather-api-key-here
```

Save with `Ctrl+O`, exit with `Ctrl+X`.

### 4. Build the frontend

```bash
cd ~/snowraven/frontend
npm ci
npm run build
```

### 5. Set up the Python environment

```bash
cd ~/snowraven/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 6. Test that it works

```bash
cd ~/snowraven/backend
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 1620
```

Open a browser on another device and go to `http://<your-pi-ip>:1620`. You should see the SnowRaven interface. Press `Ctrl+C` to stop.

To find your Pi's IP address: `hostname -I`

### 7. Install the systemd service (auto-start on boot)

```bash
sudo cp ~/snowraven/deploy/snowraven.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable snowraven
sudo systemctl start snowraven
```

Check that it started correctly:

```bash
sudo systemctl status snowraven
```

SnowRaven will now start automatically whenever the Pi boots. It will be available at `http://<your-pi-ip>:1620`.

### Managing the service

```bash
# Stop the service
sudo systemctl stop snowraven

# Restart after a config change
sudo systemctl restart snowraven

# View logs
sudo journalctl -u snowraven -f
```

### Updating to a new version

```bash
cd ~/snowraven
./update.sh
```

This pulls the latest code, rebuilds the frontend, updates backend dependencies, and restarts the service if it's managed by systemd. You can also check for available updates from the app's footer without leaving the browser.

---

## Local installation (Mac/Linux)

```bash
git clone https://github.com/dtgibson/snowraven.git
cd snowraven
./start.sh
```

Open `http://localhost:1620`, then go to the **Settings** tab to enter your API keys. They'll be saved to `backend/.env` automatically.

Alternatively, set the keys before starting:

```bash
cp .env.example .env
# Edit .env and add your API keys
./start.sh
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

The repo includes a Tauri v2 project at `src-tauri/` for building the Mac and Windows standalone app. Phase 0 establishes the Tauri project structure alongside the web app; the desktop app still requires the backend during this phase.

Prerequisites: [Rust](https://rustup.rs/) and the Tauri CLI (`npm install -g @tauri-apps/cli@next`).

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
