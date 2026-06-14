## Weather & Tide: Current & Predict

### What this does
Adds two buttons at the bottom of the Weather tab. **Current** returns live weather and tide for the user's device location in one tap. **Predict** lets the user pick a place (name search or a draggable map pin) plus a date and time and returns the forecast weather and predicted tide for that single moment. Weather reaches about 8 days out (hour-by-hour for ~48h, then a clearly-labeled daily summary); tide runs much further because it's astronomical, so a date past the weather window still shows the tide with an honest "no forecast this far out" note. Each result reads at a glance, with the existing copy-ready block one tap away. Reuses the existing OpenWeather / NOAA / Nominatim / device-location seams — no new providers, privacy posture unchanged. The existing paste-a-checklist lookup is untouched.

### How to test
1. Open the Weather tab; scroll to the bottom of the weather card to find **Current** and **Predict**.
2. Click **Current**, allow location → live weather + current tide for where you are.
3. Click **Predict**, search a coastal place (e.g. "Pillar Point Harbor") or tap/drag the map pin, pick a date a few days out + a time → forecast weather + predicted tide. Pick a date >8 days out → tide only, with the no-forecast note.
4. Expand "Copy-ready block" → Copy → the familiar formatted block.

### Notes for reviewer
- New routes `GET /weather/at?lat&lng&dt?` and `GET /tide/at?lat&lng&dt&force?` bypass the eBird checklist and take lat/lng/time directly; declared **before** the `{checklist_id}` routes (and mirrored exactly in the TS transport, before the `/weather/` and `/tide/` prefix branches) so "at" isn't captured as a checklist id.
- One base OpenWeather One Call 3.0 call returns current + hourly(48h) + daily(8d); a pure tier helper (`pick_forecast_slice`) + a daily→hourly adapter reuse the **existing** formatter for the copy block. Tier helper + adapter are duplicated TS↔Python with parity tests (same fixtures both sides).
- Tide reuses the whole existing pipeline (nearest_station / classify / fetch_tides / compute_tide_reading / format_tide); future dates already work, labeled "Predicted"; the too-far(>25mi)/outside-us notices + force override apply to any coordinate.
- **Live-verified** against the real APIs: the "One Call by Call" subscription serves the base onecall (not just timemachine); NOAA future-tide predictions return unchanged.
- Tests: backend 130 (forecast tiers/adapter, both new routes, route-shadow guards), frontend 889 (forecast-slice TS↔Python parity + the component state machine incl. location-failure fallback and beyond-range). Lint, typecheck, build, ruff all clean.
- An adversarial multi-agent review (10 confirmed findings) was folded in before this gate: coordinate-input validation (no silent 0,0 / NaN), tide-override race guard + surfaced error + loading state, and a11y (result live-region announcement, lat/lng min/max bounds, heading + group roles).
- **Known minor:** the copy block reuses the shared tide formatter, so a tide that turns inside the 1-hour Current/Predict window still reads "(turned during your checklist)" even though there's no checklist here. Cosmetic; kept deliberately so the copy block stays byte-identical with the checklist lookup (one formatter). The readable summary uses neutral "(turning)" wording.
