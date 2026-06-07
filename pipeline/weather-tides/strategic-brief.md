# Strategic Brief — weather-tides

**Lane:** New Feature · **Stage 1 (Strategist)** · Branch `improve/performance`
(ships in the same batched Mac release as the parked 0.5.16 work).

## The feature

On the Weather tab, below the existing weather box, add a sibling **Tides** box.
When the user looks up a checklist for weather, the tide box populates at the same
time with the historical tide for that checklist's location and time, from the
nearest NOAA tidal station — observed water level if available, predicted if not,
clearly labeled which. Same input, one action, two boxes.

## Why it's worth building

- **Real birder value, focused segment.** Tides drive shorebirding, seawatching,
  and coastal timing — the audience that already cares about checklist *context*
  (which is exactly what the Weather tab is for). It deepens an existing workflow
  rather than adding an unrelated surface.
- **Strong product alignment.** SnowRaven is eBird-workflow tooling; "given this
  checklist, what were the conditions" is the established pattern. Tides are the
  obvious companion to weather.
- **Low cost / low risk.** The NOAA CO-OPS API is **keyless** (no account, no new
  secret, no Settings change), and the feature mirrors the existing weather
  plumbing almost exactly (same checklist resolution → lat/lng + local time).

## Feasibility (verified against the live API)

- **Keyless** REST API at `api.tidesandcurrents.noaa.gov`. No token.
- **Station-based, not lat/lng:** there is no "tide at a coordinate" call. We
  resolve the nearest station from NOAA's station list (small, stable, quarterly
  updates — bundleable as a JSON asset like `ca-atlas-blocks.json`), then query it.
- **Observed vs predicted:** `product=water_level` returns measured levels (with a
  verified/preliminary flag); when absent it returns an error object, and we fall
  back to `product=predictions` (`interval=hilo` for the surrounding high/low
  tides). The box labels which it showed.
- **US-only coverage**, which is what the spec's "outside the US" error reflects.

## Key decisions (recommended resolutions — confirm or adjust)

1. **"Outside the US" is detected by the checklist's country, not distance.**
   NOAA's prediction network includes a few genuinely foreign stations, so a pure
   distance test could mislabel an overseas coast as "in range." The checklist
   already resolves through eBird, which gives us the country. Distance (the 25 mi
   threshold) is used only for the in-US "no station nearby" case.
2. **What the box shows:** the water level at the checklist time (labeled
   *Observed* or *Predicted*), the previous and next high/low tides with local
   times, whether the tide was rising or falling, and the station name + its
   distance from the checklist — in feet relative to MLLW (the US tide-table
   standard), with a NOAA attribution line. Styled to mirror the weather box.
3. **Both override cases show the nearest *US* station however far** (consistent
   with "tide info isn't available outside the US, but here's the closest US
   reading"). The override is a one-tap action on the error, not a setting.
4. **Concurrent, independent lookup:** the tide fetch fires alongside the weather
   fetch from the same action; a tide failure never blocks the weather result and
   vice versa.

## Scope boundaries

- **In:** historical tide for a checklist (matching weather's "for this
  checklist" model), text block + Copy, both error states with override, dual
  runtime (web/Pi FastAPI + Tauri desktop), keyless.
- **Out:** live/current tides, tide graphs/charts, currents, salinity, and any
  non-US data beyond the override's nearest-US-station reach.

## Notes for downstream stages

- **Privacy:** NOAA becomes a new browser→provider service (exposes IP +
  coordinates), so `PRIVACY_POLICY.md` needs a NOAA entry — same disclosure logic
  as the map-tile providers (Auditor/Chronicler).
- **Architecture (for The Architect):** decide the station-list mechanism (bundle
  vs fetch+cache) and whether to use the dense `tidepredictions` list for nearest
  + the `waterlevels` list for observed; reuse the existing checklist resolution
  so the checklist is fetched once, not twice.
- **Version:** this is a feature; it will push the batched release past 0.5.16 —
  reconcile at the Chronicler/deploy step.
