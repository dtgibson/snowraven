# Product Context

This file is maintained by The Chronicler.
It records what has been built and key decisions made during development.

## Features Built

### Checklist Weather Lookup (complete — May 2026)

The core feature of SnowRaven. A single-page web app that accepts an eBird
checklist ID or URL, fetches historical weather for the checklist's time and
location, and returns a copy-and-pasteable formatted text block matching the
raincrow.app output format.

**What it does:**
- Accepts a bare checklist ID (`S12345678`) or full eBird URL — URL parsing strips path/query automatically
- Validates the ID format client-side and server-side before making any API call
- Calls the eBird One Call API to fetch checklist metadata (date, time, location, duration)
- Resolves coordinates using a three-tier fallback: hotspot/info → product/lists → recent obs
- Calls the OpenWeather One Call API 3.0 timemachine endpoint once per hour of checklist duration (concurrent via asyncio.gather)
- Formats output with emoji, Beaufort wind description, cardinal direction, temp/humidity/dew point ranges, sunrise/sunset, and HTML attribution
- Displays output in a monospace pre block with a one-click copy button
- Shows inline errors for invalid IDs, not-found checklists, and API failures

**Key files:**
- `backend/services/ebird.py` — eBird API client with coordinate fallback logic
- `backend/services/openweather.py` — OpenWeather timemachine API client
- `backend/formatters/weather.py` — pure formatting functions (Beaufort, cardinal, emoji, ranges)
- `backend/routers/weather.py` — GET /weather/{checklist_id} endpoint
- `backend/main.py` — FastAPI app, CORS, static file serving for production
- `frontend/src/App.tsx` — full single-page UI
- `start.sh` — production startup script (builds frontend, starts uvicorn on port 1620)
- `deploy/snowraven.service` — systemd unit for Raspberry Pi auto-start

**Running in development:**
```
# Terminal 1 — backend
cd backend && uvicorn main:app --reload --port 1620

# Terminal 2 — frontend
cd frontend && npm run dev
```
Frontend dev server runs on port 5173 and proxies `/weather` and `/health` to port 1620.

**Running in production:**
```
./start.sh
```
Builds the frontend into `frontend/dist/`, then starts uvicorn on port 1620.
FastAPI serves the built frontend as static files — no separate web server needed.

## Key Decisions

**eBird coordinate fallback strategy**
The eBird checklist view API does not return lat/lng. Coordinates are fetched
separately. Public hotspots use `/ref/hotspot/info/{locId}`. Personal/private
locations require `/product/lists/{locId}`, whose response is an array with a
nested `loc` object using `latitude`/`longitude` keys (not `lat`/`lng`).
A third fallback to `/data/obs/{locId}/recent` handles edge cases.

**OpenWeather One Call API 3.0 requires explicit subscription**
The timemachine endpoint is not included in the free API key by default.
Users must subscribe to "One Call by Call" in their OpenWeather account
(first 1,000 calls/day free) before the API key will work on this endpoint.

**Port 1620**
Default port is 1620 (not 8000) because port 8000 was already in use.
Update `frontend/vite.config.ts`, `start.sh`, and `deploy/snowraven.service`
if you need a different port.

**Timezone resolution is offline**
`timezonefinder` resolves lat/lng → IANA timezone name without any API call.
`zoneinfo` (Python 3.9+ built-in) handles the timezone-aware datetime math.

**Production architecture is single-process**
FastAPI serves both the API and the built frontend static files. No nginx or
separate static file server is needed for local/Pi deployment. For
internet-facing installs, add a reverse proxy for HTTPS.
