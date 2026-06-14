# Handoff — Current & Predict COMPLETE; v0.5.34 pushed to GitHub (release pending from the Mac)

## What We Accomplished

Added **Current** and **Predict** to the bottom of the Weather tab — the first forward-looking weather/tide lookups, alongside the unchanged checklist tool. Current gives live weather and tide for where you are in one tap (in your local timezone). Predict forecasts both for a place (name search or a draggable map pin), date, and time you choose: weather to about eight days out (hour-by-hour, then a labeled daily summary), and tide much further, with an honest note when a date is past the weather window. Built entirely on the providers already in the app — no new third parties, privacy posture unchanged.

## What Has Been Saved

- **Code:** `backend/services/forecast.py` + `openweather.fetch_forecast`; routes in `backend/routers/weather.py` (`/weather/at`) and `tide.py` (`/tide/at`); `frontend/src/lib/forecastSlice.ts`, `tauri/weatherService.ts` + `tideService.ts` (`getWeatherAt`/`getTideAt`), `tide.ts`, `transport.ts`; `components/WeatherForecastPanel.tsx` + `PredictMap.tsx`; `App.tsx`. `vite.config.ts` (added `/tide` proxy). Tests: `test_forecast.py`, `test_weather_at.py`, `test_tide_at.py`, `forecastSlice.test.ts`, `WeatherForecastPanel.test.tsx`.
- **Version:** `frontend/package.json` + `src-tauri/tauri.conf.json` → 0.5.34; `CHANGELOG.md`.
- **Records:** `PRODUCT_CONTEXT.md`, `DECISIONS.md`, `ROADMAP.md` (Shipped → 69), `CLAUDE.md` (vite-proxy convention), `README.md`, `docs/HELP.md`, `website/index.html`, `PRIVACY_POLICY.md`.
- **Pipeline artifacts:** `pipeline/weather-current-predict/` (strategic-brief, prd, schema, design-spec, design.html, PR, how-to-see, qa-report, security-report).
- **Committed and pushed to `main` from the VM; tag `v0.5.34` pushed** (starts the Windows CI build). The feature commit was rebased onto the Mac's "mark 0.5.33 released" commit, so `main` is linear and the tag points at the commit on `main`.

## Where We Are

Feature complete and verified (frontend 889, backend 131, lint/typecheck/build/ruff clean; live-verified against OpenWeather + NOAA; security pass), committed, and pushed to `main` with the `v0.5.34` tag. Pipeline idle. (0.5.33 is already RELEASED live on both platforms from the Mac.)

## To Release v0.5.34 (your steps from the Mac)

`main` and the `v0.5.34` tag are on GitHub; Windows CI is building. After CI finishes, run `./release.sh` from the Mac (notarized macOS + signed Windows installer + `latest.json`).

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
