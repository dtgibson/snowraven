# Design Spec — Weather & Tide: Current & Predict

## Visual Direction
Native to SnowRaven's established look — the `--sr-*` token system and the existing Weather-tab card. Nothing new is invented; the two buttons and their results read as if they were always part of the tab. Calm and glance-first, with the familiar monospace copy block kept one tap away. Both light and dark themes are first-class (every surface, edge, and text color is a token).

## Screens / Views

### Entry — bottom of the Weather card
Below the existing checklist lookup and a divider: a short heading ("Now, or any time ahead"), one line of context, then two buttons in a 2-up row — **Current** (filled `--sr-accent`, navigation/locate icon) and **Predict** (outlined `--sr-accent-bg` / `--sr-accent-border`, calendar-clock icon). Inside the same `.sr-card`, 540px max-width.
- Current is the primary (filled) action; Predict is secondary (outline). Both 44px tall, matching the existing "Get weather" button.

### Current — live result
A soft-accent summary card (`--sr-accent-surface` / `--sr-accent-border`): location + a green "NOW · time" pill; a large temperature (display role) with condition emoji and description; a wrapping row of stat chips (wind + direction, humidity, dew point, cloud, sunset); then a dashed-divided tide block (level range, rising/falling, next high/low, station + distance + Observed/Predicted + MLLW). A "Copy-ready block" disclosure reveals the exact existing monospace `<pre>` + Copy button.
- Summary visible by default; copy block collapsed (OQ-03). Tide separated by a dashed rule (not a full `<hr>`) so the result stays one cohesive card.

### Predict — input panel
A faint-surface panel (`--sr-surface-faint`): a place-search input (search icon, Nominatim), a map with a draggable pin + a live coordinate chip + a "Tap to drop a pin · drag to fine-tune" hint, then Date and Time fields side by side, and a full-width "Get forecast" primary button.
- Place search and map pin both present (FR-07); current location seeds the pin when available (FR-08). Date/time are explicit labeled fields.

### Predict — daily summary (days 3–8)
Same summary card, but the pill is amber ("FORECAST · SAT JUN 21 (DAILY)") and the description spells out "forecast for that day, not an exact-hour reading." Temperature shows the day's value with H/L. Tide is the full predicted block.
- The daily-resolution tier is signalled by both the amber pill and the inline qualifier — never mistakable for an exact-hour reading (FR-13).

### Predict — beyond the forecast window
Summary card with a "TIDE ONLY" pill and an amber gap note ("No weather forecast reaches Jul 30 — beyond the ~8-day window. The tide below is an astronomical prediction, so it's still solid this far out."), then the predicted tide block. No weather values, no fabrication (FR-12 / FR-14).

## Component Usage
shadcn/ui plus the app's existing inline-styled primitives (the Weather tab is hand-styled, not shadcn-component-heavy). Buttons reuse the existing accent / accent-bg button patterns; inputs reuse the 44px bordered input; the copy block is the exact existing `<pre>`; notices reuse the warning-toned box. The map is the shared `SnowMap` (MapLibre via react-map-gl) with a draggable `<Marker>`. Lucide icons throughout (navigation, calendar-clock, search, map-pin, sun/sunrise/sunset, wind, droplet, copy, chevron, alert-circle).

## Design Tokens Applied
- Surfaces: `--sr-surface` (card), `--sr-surface-faint` (Predict panel), `--sr-accent-surface` (result summary), `--sr-surface-subtle` (mono block).
- Accent: `--sr-accent` / `--sr-on-accent` (Current button, NOW pill, links), `--sr-accent-bg` / `--sr-accent-border` (Predict/outline + copy buttons).
- Forecast-gap + daily tier: `--sr-warning` / `--sr-warning-bg` / `--sr-warning-subtle`.
- Text: `--sr-text`, `--sr-text-muted` (chips, captions), `--sr-text-footer`.
- Borders/inputs: `--sr-border`, `--sr-border-input` (map outline). Radius 12 (card) / 8–10 (panels, inputs) / 6 (copy buttons). **No new tokens introduced.**

## Interaction Notes
- **Current**: one tap → request device location → on success fetch + render; on failure show the friendly location error and reveal the Predict place-entry preset to "now" (FR-05).
- **Predict map pin**: tap the map to place the pin; drag to fine-tune; the coordinate chip and the nearest tide station update live (station/distance change with the pin — FR-06 / QA-06).
- **Copy disclosure**: collapsed by default; expanding shows the byte-identical formatted block with the standard Copy → "Copied!" 2s confirm.
- **Theme**: every surface/edge/text is a token, so light and dark both work with no extra styling.
- **A11y**: buttons and inputs get explicit accessible names; the map pin is reachable and adjustable by keyboard (coordinate entry is the keyboard route); loading and error states are announced; focus uses the global token ring.

## Content Notes
Plain, calm, honest copy. The forecast gap is stated as a helpful fact ("beyond the ~8-day window… still solid"), never an error. Labels are short ("Place", "Date", "Time", "Get forecast", "Current", "Predict"). The daily tier always says it's a daily summary. The mock uses realistic content (Berkeley Marina, Pillar Point Harbor, real NOAA station ids); the app shows real data.

## Design-system note
SnowRaven's design system is already canonical in `frontend/src/globals.css` (the `--sr-*` tokens, both themes) and the conventions in `CLAUDE.md`. This feature was designed entirely within it — no new tokens, no new patterns. No separate `pipeline/design-system.md` was created so the single source of truth stays `globals.css` (a parallel copy would risk drift).
