## Nearby Lifers Map

### What this does
Adds a fourth **Nearby Lifers** section to the Map Explorer that plots, as count-badged pins, the places near a chosen point where species you've never recorded were reported in the last 30 days. A matching in-view list mirrors the map, a **Time Range** filter (Day / Week / 30 days) narrows by recency, and the standard center controls (saved default, use-my-location, place search) + radius apply — just like the other sections. The old Nearby Lifers list is removed from the Statistics tab, and the existing **Media Targets** panel gains the same three-window Time Range control so the two panels are consistent.

### How to test
1. Start the app (backend on 1620, frontend dev on 5173).
2. Open **Map Explorer** → click **Nearby Lifers** in the mode bar.
3. With a default location saved in Settings and an eBird backup + API key configured, it auto-loads pins for nearby spots with recent lifers; each pin shows the lifer count, and clicking it (or a panel row) lists the lifers — name + favicons (no Species Detail link), recency dot, date, and an eBird checklist link.
4. Switch **Time Range** (Day / Week / 30 days) — pins, count, and list re-filter with no refetch.
5. **Use my location** / place search re-center and refetch; change the radius.
6. Confirm the **Statistics** tab no longer shows a Nearby Lifers block, and **Media Targets** → Time Range now offers Day / Week / 30 days.

### Notes for reviewer
- **Data path:** reuses `GET /map/recent-obs` with `codes` made optional (empty ⇒ all species in radius) in **both** transports (FastAPI + Tauri `mapService`); the life-list subtraction + location grouping is client-side (`lib/nearbyLifers.ts`, pure + tested). The dead `/stats/nemesis` route and its Tauri service were removed.
- eBird `/data/obs/geo/recent` returns one most-recent record per species, so each lifer appears at its single most-recent location/checklist (documented in `schema.md`).
- Radius applied in **true miles** (mi→km), correcting the kilometres mismatch the old Statistics card had.
- Lifer names render plain + favicons via `<BirdName hasEntry={false}>`; favicons use the `speciesCode` already in the records, so no extra taxonomy call.
- Shared `Time Range` control + `isWithinWindow` predicate drive both Nearby Lifers and Media Targets — one implementation.
- **Verified:** frontend typecheck + eslint clean, 911 vitest tests pass, production build OK; backend 126 pytest pass + ruff clean.
