# PRD — weather-tides

**Lane:** New Feature · **Stage 2 (Planner)** · Source: `strategic-brief.md`

## Summary

A **Tides** box on the Weather tab, below the weather box, that populates from the
same checklist lookup with the historical tide at the checklist's location and
time, from the nearest NOAA CO-OPS station. Observed water level when available,
predicted otherwise, labeled. Two error states (too far / outside US), each with a
one-tap override to show the nearest US station anyway.

## User stories

- As a coastal birder, when I look up a checklist's weather, I also see the tide at
  that place and time, so I can interpret shorebird/seawatch activity.
- As a user far from any station, I get a clear "nearest station is N miles away"
  message and can choose to see it anyway.
- As a user outside the US, I'm told tide data isn't available there, and can still
  choose to see the nearest US station.

## Functional requirements

### FR1 — Concurrent lookup from the same action
- The tide lookup fires from the same "Get weather" action / same checklist input,
  concurrently with the weather lookup (e.g. `Promise.allSettled`).
- The two are independent: a tide failure must not block or alter the weather
  result, and vice versa. Each box has its own loading / error / result state.
- No second eBird checklist fetch where avoidable — reuse the resolved
  lat/lng + obs_dt + timezone (shared resolver or the existing region-info memo).

### FR2 — Nearest-station resolution
- Resolve the nearest NOAA station to the checklist's lat/lng by haversine over a
  bundled station list (mechanism is the Architect's call; bundling is preferred
  per feasibility).
- Show the station **name + id** and its **distance** (miles) from the checklist.

### FR3 — Tide data (observed vs predicted)
- Query NOAA CO-OPS (keyless) for the checklist's local date/time window
  (`time_zone=lst_ldt`, `datum=MLLW`, `units=english`).
- Show the **water level at the checklist time**, labeled **Observed** when a
  measured value exists, otherwise **Predicted** (fall back to predictions when
  `water_level` returns NOAA's no-data error object).
- Include the **surrounding high/low tides** (previous + next) with local clock
  times, and the **tide state** (Rising / Falling) derived from them.
- All heights in **feet relative to MLLW**, with the datum stated. The unit/datum
  in the label must match the request params (carry them through — never hardcode a
  label that can drift from the request).

### FR4 — Presentation
- The box mirrors the weather box: a monospace text block in the same `sr-card` /
  `<pre>` styling, with a **Copy** button, and a NOAA attribution line.
- Colors via `var(--sr-*)` tokens only.

### FR5 — Error: more than 25 miles from a station (in US)
- When the nearest station is > 25 mi from the checklist, show an error to that
  effect (state the distance and station), with a one-tap **"Show nearest tide
  anyway"** override that renders the box for that station.

### FR6 — Error: outside the US
- When the checklist is outside the US (determined by the checklist's **country**,
  not distance), show "Tide information is not available outside the US," with a
  one-tap override to show the **nearest US station** anyway (however far).

### FR7 — Dual runtime
- Works in both web/Pi (FastAPI route + service) and Tauri desktop (TS service),
  dispatched through the transport seam (`transport.get('/tide/{id}')`).
- Desktop uses `tauriFetch`; no new key (NOAA is keyless), no Settings change.

### FR8 — Docs & privacy
- `PRIVACY_POLICY.md` gains a NOAA CO-OPS entry (browser→provider, exposes IP +
  coordinates), consistent with the existing service/tile disclosures.
- `docs/HELP.md` documents the tide box; `README.md` reflects it; `CHANGELOG.md`
  + version bump (folds into the batched release).

## Acceptance criteria

1. Entering a US coastal checklist and clicking Get weather renders BOTH a weather
   box and a tide box, from one action.
2. The tide box shows: level + Observed/Predicted label, previous & next high/low
   with local times, Rising/Falling, station name + id + distance, datum (MLLW),
   feet, NOAA attribution, and a working Copy button.
3. When observed data is absent, the box shows Predicted (not an error), sourced
   from NOAA predictions.
4. A checklist > 25 mi from any station shows the distance error + a working
   "show anyway" override that then renders the box.
5. A non-US checklist shows the outside-US error + a working override to the
   nearest US station.
6. A tide-service failure shows a tide error without affecting the weather box.
7. Works in both runtimes; no new API key required.
8. Full vitest + backend pytest green (incl. new tide router + formatter tests);
   build + lint clean. Privacy policy, HELP, README, CHANGELOG, and both version
   files updated.

## Out of scope

Live/current tides, tide graphs, currents/salinity, metric display, and any non-US
data beyond the override's nearest-US-station reach.

## Open items for The Architect

- Station-list mechanism (bundle vs fetch+cache) and which NOAA list(s) back
  "nearest" (dense `tidepredictions`) vs observed (`waterlevels`).
- How the checklist **country** is obtained for the outside-US test (eBird region
  info / locId country code) without a second expensive fetch.
- Whether to share one checklist resolver across weather + tide.
