# SnowRaven

Self-hosted birding tools for your eBird workflow.

## Tools

### Weather Lookup

Paste an eBird checklist ID or URL and get a copy-and-pasteable historical weather summary for that time and location — temperature, wind, humidity, dew point, sunrise/sunset, and conditions.

Compatible with the output format used by [raincrow.app](https://raincrow.app/). This is a self-hosted solution to retrieve weather data for many eBird checklists without rate limits. I feel it would be unethical to circumvent the rate limits of an online tool that is being generously made available to others for free; if the creator wishes to limit requests to five per day to keep the service broadly available, those wishes should be respected.

If you like this, the idea and inspiration really came from someone else, so [why not buy the creator of raincrow.app a coffee?](https://ko-fi.com/parkerdavisaz)

**How it works:**

1. Paste a checklist ID (`S12345678`) or full URL (`https://ebird.org/checklist/S12345678`)
2. Click **Get weather**
3. Copy the formatted result and paste it into your checklist notes

Weather data comes from the [OpenWeather One Call API 3.0](https://openweathermap.org/api/one-call-3) timemachine endpoint. Checklist metadata (date, location, duration) comes from the [eBird API](https://documenter.getpostman.com/view/664302/S1ENwy59).

### List Comparer

Upload two eBird backup CSV files to see which species you share with another birder and which are unique to each list. All processing happens in the browser — no data leaves your machine.

**How it works:**

1. Export your eBird data from [ebird.org/downloadMyData](https://ebird.org/downloadMyData)
2. Drop both CSV files onto the List Comparer tab
3. Click **Compare Lists** to see three sorted panels: species in both, species only in the first list, species only in the second
4. Use **Show all** to expand all panels to full length for printing

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
3. Go to **Billing plans** and subscribe to **One Call by Call** (free tier: first 1,000 calls/day at no cost — you must subscribe explicitly or the API returns 401)

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
git pull

# Rebuild the frontend
cd frontend && npm ci && npm run build && cd ..

# Reinstall backend dependencies (if requirements.txt changed)
cd backend && .venv/bin/pip install -r requirements.txt && cd ..

# Restart the service
sudo systemctl restart snowraven
```

---

## Local installation (Mac/Linux)

```bash
git clone https://github.com/dtgibson/snowraven.git
cd snowraven
cp .env.example .env
# Edit .env and add your API keys
./start.sh
```

Open `http://localhost:1620`.

---

## Development setup

```bash
git clone https://github.com/dtgibson/snowraven.git
cd snowraven
cp .env.example .env
# Edit .env and add your API keys

# Terminal 1 — backend with hot reload
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 1620

# Terminal 2 — frontend dev server
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

---

## Security note

If you expose SnowRaven to the internet (not just your local network), put a reverse proxy such as [Caddy](https://caddyserver.com/) or [nginx](https://nginx.org/) in front of it for HTTPS. For local network use, plain HTTP on port 1620 is fine.

---

## Attribution

Weather data: [OpenWeather](https://openweathermap.org/) · Checklist data: [eBird](https://ebird.org/) · Inspired by [raincrow.app](https://raincrow.app/)
