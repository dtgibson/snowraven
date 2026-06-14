# Technical Design — Weather & Tide: Current & Predict
**Feature:** weather-current-predict
**Stage:** 3 — The Architect
**Path:** Frontend Only (no data layer)
**Source:** prd.md (approved)

## No Data Layer
SnowRaven has no database, ORM, schema, or migrations — it works off the user's local CSV exports and live API calls. This feature persists nothing new (no saved locations, by design). It reads the existing default-location setting where convenient and writes nothing. **No tables, no columns, no migrations.**

What follows is the *integration* design: how the two new lookups are built across the backend, the desktop services, and the UI, reusing the existing weather/tide machinery.

---

## Architecture at a glance
Two lookups that **bypass the eBird checklist** and take `(lat, lng, time)` directly. Three layers, each mirroring the existing weather/tide pattern:

1. **Backend (FastAPI)** — new geo+time routes.
2. **Desktop (Tauri TS services)** — mirrored functions, routed through the existing transport seam.
3. **Frontend UI** — two buttons + a Predict input panel + result rendering, in a new component at the bottom of the Weather tab.

The existing checklist routes (`/weather/{id}`, `/tide/{id}`) and their services are untouched.

---

## Backend / service design

### Weather
- **New OpenWeather fetch — `fetch_forecast(lat, lng)`** calling the BASE One Call 3.0 endpoint (`/data/3.0/onecall?lat=&lon=&appid=&units=imperial`, no `timemachine` segment, no `dt`). One response returns `current` + `hourly` (48h) + `daily` (8d) together. Same key/subscription as the existing `timemachine` call. `fetch_historical` stays for the checklist path.
- **New route — `GET /weather/at?lat=&lng=&dt=`** (`dt` optional, epoch seconds; omitted/≈now ⇒ current):
  - no `dt` or `dt` ≈ now → `current` block — resolution `current`.
  - `dt` within ~48h → nearest `hourly` entry — resolution `hourly`.
  - `dt` within ~8d → that day's `daily` entry — resolution `daily`.
  - `dt` beyond ~8d → no weather — resolution `out-of-range`.
- **Tier selection** lives in a small pure helper `pick_forecast_slice(onecall, dt) -> (slice, resolution)` (testable; tier boundaries 48h / 8d). Duplicated TS↔Python with parity tests, like the moon-phase port.
- **Daily adapter** maps a `daily` entry into the shape the existing formatter consumes (`temp` ← `temp.day`; carries `dew_point`, `humidity`, `wind_speed`, `wind_deg`, `clouds`, `weather`, `sunrise`, `sunset`). So `format_weather` is reused for current/hourly/daily; the `resolution` flag drives the "daily summary" label in the UI (FR-13). Daily high/low (`temp.min`/`temp.max`) are surfaced in the structured summary.
- **Response shape:**
  ```
  { resolution: 'current'|'hourly'|'daily'|'out-of-range',
    formatted: string | null,      // the copy-ready block (null when out-of-range)
    summary:  WeatherSummary | null, // structured fields for the readable view
    tz: string }
  ```
  `WeatherSummary` = `{ emoji, description, tempF | {highF, lowF}, windBeaufort, windDir, cloudsPct, humidityPct, dewPointF, sunriseLocal, sunsetLocal, isNight, moonEmoji? }` — computed from the *same* values `format_weather` uses (factor the extraction so the block and the summary share one source; NFR-05).

### Tide
- **New route — `GET /tide/at?lat=&lng=&start=&end=&force=`** — the existing checklist tide pipeline minus the eBird resolution: `nearest_station` → `classify` (too-far / outside-us) → NOAA fetch (`water_level` + `predictions` interval 6 + `predictions` interval hilo) → `compute_tide_reading` → `format_tide`. Future dates already return "Predicted" with no code change.
- For a single chosen moment, build a small `[start, end]` window around it (enough to compute trend + bracket the nearest high/low). The window builder is a pure helper, tested.
- **Response shape:** the existing tide response **plus** a serialized `TideReading` for the summary: `{ status, formatted, body, source, levelMinFt, levelMaxFt, trend, turnedDuring, prevHL, nextHL, station, distanceMi }`. The `too-far` / `outside-us` soft notices + `force` override behave exactly as today (FR-18, geometric checks apply to any lat/lng).

### Timezone
- Resolve the location's tz from `(lat, lng)` via the existing `get_timezone` (Tauri command) / tzf-rs (backend) — used both to format sunrise/sunset and to interpret the user's chosen *local* date/time into an epoch for the weather/tide calls.

---

## Desktop (Tauri) mirror
- `lib/tauri/weatherService.ts`: add `getWeatherAt(lat, lng, dt?)` mirroring the backend tiering (same `pick_forecast_slice` + daily adapter ported to TS).
- `lib/tauri/tideService.ts`: add `getTideAt(lat, lng, start, end, force)` reusing the existing offline station selection + NOAA calls + compute/format.
- `lib/transport.ts`: route `/weather/at` and `/tide/at` to the new Tauri service functions in desktop mode (web/Pi falls through to the FastAPI routes). Identical `{ resolution, formatted, summary }` / tide contract on both paths (NFR-02).

---

## Frontend UI
- **New component** (e.g. `components/WeatherForecastPanel.tsx`) mounted at the bottom of the Weather tab card in `App.tsx` (after the "Copy Weather and Tide Together" button, inside `.sr-card`).
- **Two buttons:** Current, Predict.
- **Current:** `location.ts` get-current-location → `getWeatherAt(now)` + `getTideAt(window(now))` in parallel → render. On location failure: show `describeLocationError(...)` and reveal the Predict place-entry preset to "now" (OQ-02 default) — no dead end (FR-05).
- **Predict input panel:**
  - **Location:** place-name search (Nominatim `forwardGeocode`, like MapExplorer's `AddressSearch`) **plus** a small `<SnowMap>` with a draggable `<Marker>` pin. New interaction: `map.on('click')` → `e.lngLat` places the pin; the pin is draggable to fine-tune (FR-07). Default center = current location when available (FR-08).
  - **Date + time:** native date and time inputs with explicit `aria-label`s; default to a sensible near-future value; accept present-or-future (FR-09, OQ-01 = no past).
  - **Submit** → `getWeatherAt(dt)` + `getTideAt(window(dt))` → render. Beyond ~8d ⇒ weather omitted + a clear gap note, tide still shown (FR-12/FR-14).
- **Result rendering** — a shared `WeatherTideResult` presentational piece:
  - readable at-a-glance **summary** (weather rows + tide rows, tokenized colors + emoji) with a resolution label ("Live" / "Forecast — 3:00 PM" / "Forecast — Sat (daily summary)") (FR-15).
  - the copy-ready **block** available via a copy action (`copyText`), optionally behind a show/hide (OQ-03 default) (FR-16).
- **State:** per-lookup state machine (idle / locating / loading / success / error) with a tide sub-state mirroring the existing `TideState` (incl. `too-far` / `outside-us` / override). Weather and tide independent (FR-16/FR-17).

---

## Reuse map
**Reused unchanged:** the OpenWeather client base + key, `format_weather`/`formatWeather` + tide `compute_tide_reading`/`format_tide`, `nearest_station`/`classify`, the NOAA fetch, `get_timezone`/tzf-rs, `location.ts` (+ `describeLocationError`), Nominatim `forwardGeocode` + `/nominatim/search`, `SnowMap`/`Marker`/`useMap`/`Popup`, `copyText`, `formatObsDate`/`formatDate`, the transport seam, the error-copy + WCAG conventions.

**New (small, additive):** `fetch_forecast` (base onecall) + `pick_forecast_slice` tier helper + daily→hourly adapter, the geo+time routes (`/weather/at`, `/tide/at`) + Tauri mirrors, the structured `summary` serialization (weather + tide), the tide single-moment window builder, the Predict input UI incl. the click/drag map pin, the readable-summary renderer, and the new top-level panel component.

---

## Testing seams (for The Engineer / The Tester)
- **Pure helpers unit-tested:** `pick_forecast_slice` (48h / 8d boundaries, out-of-range), daily→hourly adapter, summary-extraction parity (block vs summary from the same data), tide window builder. Where logic is duplicated TS↔Python (tier helper + daily adapter), keep byte/behavior parity like the formatter, with parity tests.
- **Backend route tests** with mocked OpenWeather base response + mocked NOAA.
- **Frontend component tests** for the state machine, the location-failure → place-entry fallback, and the beyond-range note.

---

## Risks / flags
- **OpenWeather subscription:** the "One Call by Call" plan must permit the base `onecall` (current + forecast) call, not only `timemachine`. It does — same One Call 3.0 product and key — but worth a live smoke test during build.
- **Daily coarseness:** days 3–8 are a daily summary; the UI must clearly label it (FR-13) so it isn't read as an exact-hour forecast.
- **Single-instant tide:** `compute_tide_reading` expects a `[start, end]` window; choose a sensible window around the chosen moment so trend / next-high-low compute (Engineer detail).
- **Payload:** responses now carry structured summary + formatted block — marginally larger, negligible.
- **No regression:** the existing checklist `/weather/{id}` and `/tide/{id}` paths and their formatters stay byte-identical (NFR-06).
