# Design Spec — Weather/tide Planner

**Feature:** tide-weather-planner
**Stage:** 4 -- The Designer (revised 2026-09-12 after the built app's review: one-to-one drag, and a wide-tier chart with a Days in view control; D4-12 to D4-18)
**Mockup:** `pipeline/tide-weather-planner/design.html` (self-contained; theme, width (Desktop 1200 / Tablet 768 / Phone 390 / Phone 320), text-size and state switchers in the top bar; deep links `?theme=dark&w=tablet-768&text=2&state=toofar&days=3&scroll=900&open=1`)
**Design system:** `pipeline/design-system.md` applies in full. Nothing here evolves the look; the feature extends the Weather tab's Predict form and result region with six additive `--sr-plan-*` tokens.

## Visual Direction
The plan is the Weather tab's existing Predict result, grown into a timeline: the same accent-surface result region, the same place heading and mono window line, the same pills, notices and words. Its one focal point is the chart, a single time axis in the location's clock with the tide curve, a dusk band for every night, sunrise and sunset marked on the curve, highs and lows marked, and a weather strip beneath. Below it the per-event list carries every figure in words: it is the plan on a phone and the plan to a screen reader. Quiet utility throughout: the green stays on the actions and the disclosures, nothing is ranked, scored or highlighted, and every event gets identical treatment. On a wide window the chart becomes the page's focal point: the Weather card opens out to 1080px while a plan is on screen, the plot doubles in height with day headers along the top, and a Days in view control fits one, three, seven or all the days into the box; on a phone the approved design is unchanged.

## Screens / Views

### The Predict form, with two actions
Unchanged place picker (search, map pin, latitude/longitude) and the date and time fields. At the bottom, two full-width actions, one above the other:
- **Get forecast** (primary, filled `--sr-accent`, the existing button) stays the primary weight.
- **Plan sunrises and sunsets** (secondary, the outline register: `--sr-accent-bg` fill, 1.5px `--sr-accent-border`, `--sr-accent` text, 44px, `CalendarDays` lucide icon, 8px beneath the primary).
- One muted caption (0.6875rem, the map-hint style) under the plan button: "The plan runs from now to the end of the forecast, about eight days, for the place above. The date and time apply only to Get forecast."
- Both actions apply the same place validation; the plan action never reads the date or time fields (FR-01, FR-02).

Key decisions: the label names what you get, in the form's own register (verb + the things); the plan action is the same form's second output, so it takes the secondary weight and sits beneath, never beside, so the row still fits at 320px.

### Loading
The existing status row shape (spinner + muted text, `role="status"`), 16px under the buttons: "Building the plan for {place}…". On completion the persistent live region announces "Plan ready for {place}."

### The plan result region
`role="region" aria-label="Weather and tide plan"`, the same container as a single-moment result (`--sr-accent-surface`, 1px `--sr-accent-border`, radius 10, padding 16/18, `.sr-pad-x-trim`), replacing whatever the region held. Order, top to bottom:

1. **Header.** `h3` place label (1.0625rem/700, ellipsis on desktop, wraps on phones) with a `Plan · 8 days` pill (the FORECAST pill register, `--sr-accent-bg`/`--sr-accent`). A mono muted window line: "Sat, Sep 12, 2026, 3:41 PM → Sat, Sep 19, 2026, 11:59 PM" (both through `formatDate(..., { withWeekday: true, withTime: true })`). A second muted line: "Local time at this spot · 36.603, −121.876 · fetched 3:41 PM". The station line once, with a `Waves` glyph in `--sr-plan-tide`: "Tide: MONTEREY, MONTEREY BAY (9413450) · 0.9 mi · **Predicted** · relative to MLLW", plus " · heights between highs and lows are interpolated" when the station serves no continuous predictions (`continuous: false`).
2. **Replay cue** (offline replay only): the shared `StalenessCue`, unchanged: "Offline: showing the last loaded result, from Sep 12, 2026, 3:41 PM."
3. **Tide notice** (one of, at most): the amber too-far / outside-US notice with the override button in the same box (`tideTooFarNotice`, `tideOverrideLabel`, the shipped words and button); or the muted line "Tide is unavailable for this spot."
4. **The chart** (below).
5. **Legend + scroll hint.** Day and Night swatches, the four marker shapes with their words (High/Low only when tide is drawn), and "Scroll sideways for later days" with a `ChevronsLeftRight`-style glyph at the right.
6. **The list** (below).
7. **Closing note** (dashed top rule, 0.75rem muted): "The plan stops where the weather forecast stops. Tide predictions reach further ahead: for any later moment, use Get forecast with a date and time."

### The chart
Two tiers share one component, one time axis and one document. **Phone tier (viewport ≤640px): exactly the approved design.** **Wide tier (641px and up): the layout below.**

- **Box:** 1px `--sr-border`, radius 9, `--sr-surface`, `overflow: hidden`, `min-width: 0; max-width: 100%`, with a 28px right-edge fade to `--sr-surface` that disappears at the end of the scroll. Inside it the **scroll container** (`overflow-x: auto`) is the element that carries `role="img"`, the accessible name and `tabIndex={0}` (so arrow keys scroll it and there is exactly one tab stop). The global 3px focus ring, inset (`outline-offset: -3px`). Everything inside is `aria-hidden` and `inert`. **No `scroll-snap-type`, no snap markers, no `scroll-padding` anywhere** (D4-12).
- **Scale.** One uniform real-elapsed-time axis, `t` in seconds, domain `[window.axisStartTs, window.endTs]`, a 40px left gutter for the sticky tide scale, and a DST day drawn at its true length. Pixels per hour:
  - phone: the constant `PLAN_HOUR_PX = 16` (a day is 384px; the chart scrolls);
  - wide: `hpx = max(4, (boxWidth − 40 − 2) / hours)` where `hours` is `24 × days` for the 1 / 3 / 7 choices and `(endTs − axisStartTs) / 3600` for All; measured from the box with a `ResizeObserver` and recomputed on resize and on every Days in view change. At All the track fits the box exactly and nothing scrolls; at 1 / 3 / 7 it scrolls.
- **Lanes, px, top to bottom.** Phone (unchanged): 28 event-label lane, 128 plot (40 without tide), 38 axis lane (hour ticks over day labels), 48 strip = 242 (154). Wide: 22 **day-header lane** (a `--sr-surface-subtle` band under a `--sr-border` rule, "Sun, Sep 13" in 11px/600 ink at each local midnight, the midnight hairline running the full height from this band to the strip), 28 event-label lane, **220 plot** (56 without tide), 22 axis lane (hour ticks only), 48 strip = 340 (176). `planChartHeight(withTide, wide)` sizes the `Suspense` fallback.
- **Density rules (wide), all derived from `hpx`:** day label = full "Sun, Sep 13" when the day's visible width ≥ 84px, "Sun 13" when ≥ 44px, "Sun" when ≥ 22px, else none; event label = "Sunrise 6:48 AM" when `hpx ≥ 8`, else the time alone (the marker shape says which); hour ticks = 6 AM / Noon / 6 PM when `6 × hpx ≥ 34`, else Noon only; high/low labels always. Nothing else changes with density: the ground, the night bands, the curve (the document's 30-minute samples, never resampled), the markers, the Now hairline and the gutter are identical at every scale.
- **Ground and night:** the plot ground is `--sr-plan-day`; one opaque rect per `nightSpans[]` entry in `--sr-plan-night`, full plot height. On light the night band is the shaded one; on dark the DAY is the lit band and night is the deep ground. Both always drawn, both in the legend.
- **Scale and grid:** y from `floor(min) − 0.6` to `ceil(max) + 1.2` ft; gridlines every 2 ft at `rgba(var(--sr-plan-grid-rgb), 0.16)`; the sticky gutter (an HTML overlay on the box's left edge, starting below the day-header lane, `--sr-surface` fading to transparent, `pointer-events: none`) carries "6 ft, 4, 2, 0, −2" in 10px muted and "MLLW" in 9px uppercase just under the 0 line. The axis line at the plot bottom is `--sr-border-medium`.
- **Now:** a 1px dashed ink hairline at `fetchedAt` with a "Now" label.
- **Tide curve:** `tide.curve` as one 2px `--sr-plan-tide` line, round joins; `hilo: true` samples draw identically.
- **Turning points:** high = 4.5px filled `--sr-plan-tide` circle with a 1.5px `--sr-plan-halo` ring, label "H 5.4" 8px above; low = 4.5px `--sr-plan-halo` circle with a 2px `--sr-plan-tide` ring, label "L −1.2" 15px below. Labels 10px/600 ink with a 3px halo stroke.
- **Sunrise and sunset:** on the curve at `heightFt` (on the axis line when tide is absent). Sunrise = hollow upward triangle (12px, 2px `--sr-plan-sun` stroke, halo fill); sunset = filled downward triangle. A 1px dashed leader up to the label lane. Shape and label distinguish them; hue is reinforcement.
- **Weather strip (48px, a tag lane at the top, glyphs bottom-aligned):**
  - **hourly cells, `hpx ≥ 16`:** one cell per hourly entry, width proportional to its span, the condition emoji (13px), a `--sr-border-subtle` hairline between cells; at **`hpx ≥ 32`** the cell adds the temperature ("☀️ 66°", 10px muted) when it is at least 30px wide; a cell narrower than 12px (the clipped first cell at the axis start) shows nothing;
  - **hourly cells, `hpx < 16`:** the hourly entries collapse into **one cell per N-hour block**, N = 3 when `3 × hpx ≥ 16`, else 6, blocks aligned to the clock (12 AM, 3 AM, … or 12 AM, 6 AM, …), each block showing the reading at its first hour; the tag names the cadence;
  - **daily cells:** `--sr-surface-subtle` fill, a 1.5px dashed `--sr-border-medium` left edge; content by width: ≥ 200px "☁️ **Overcast clouds** · H 63° L 54°", ≥ 90px "☁️ H 63° L 54°", else the emoji alone;
  - **tags:** at the strip's start "FORECAST · HOURLY", or at low density "FORECAST · HOURLY · A GLYPH EVERY 3 HOURS" / "… 6 HOURS" when the hourly span is ≥ 250px wide, "HOURLY · EVERY 6 H" when ≥ 120px, else "HOURLY"; on the first daily cell "FORECAST · DAILY FROM HERE" when that cell is ≥ 120px wide, else "DAILY" (the amber daily register).
- **Accessible name:** unchanged (with tide, "Chart of the predicted tide with sunrise, sunset, high and low markers and a weather strip for {place}, {start} to {end}. Details are in the list below."; without tide, "Chart of sunrise, sunset and weather for {place}, {start} to {end}; no tide is shown. Details are in the list below."). Density changes nothing the list does not already carry.
- **No `ChartViewTip`.**
- **Mockup note:** the mockup draws the chart as inline SVG; the build uses Recharts in the lazy `PlanChart` chunk with the same geometry (`XAxis type="number"` on `t`, `ReferenceArea` per night span, `Line` for the curve, `ReferenceDot` with custom shapes, the day-header lane, the axis lane, the strip and the gutter as HTML siblings positioned by the same `x(t)`).

### Days in view (wide tier only)
A toolbar row directly above the chart box, 14px under the station line: the label **DAYS IN VIEW** (the section-label register, 0.6875rem/700 uppercase muted) and a segmented control in the house `SegControl` register (Calendar / Map sidebar): a `--sr-surface-subtle` pill (radius 6, 2px padding, 2px gaps) holding one `Button` per option, 0.71875rem, `padding: 0.35rem 12px`, radius 5, muted text and transparent border at rest, `--sr-surface` fill + 1px `--sr-border` + 600 weight + `--sr-text` when pressed, hover lifts the text to `--sr-text`. `role="group" aria-label="Days in view"`, each option `aria-pressed`, one tab stop per option, the global focus ring.
- **Options:** **1 day · 3 days · 7 days · All {n} days**, where n is `plan.days.length`; an option whose day count is not less than n is omitted (a five-day plan offers 1 day, 3 days, All 5 days).
- **Default: All.** The whole window at a glance is the view the feature exists for; the closer views are for reading one morning.
- **Persisted** through the storage seam as the setting `planDaysInView` (`'1' | '3' | '7' | 'all'`, validated on read, anything else reads as `'all'`), device-local exactly like `chartTipDismissed`; read once when the panel mounts, written on every change. Never synced.
- **On change:** the chart re-lays out at the new `hpx` instantly (no transition) and keeps the instant that was at the box's left edge at the left edge (`scrollLeft = (tLeft − axisStartTs) / 3600 × hpx`), so choosing a closer view zooms into where the reader was looking, and All shows everything.
- **Not on phones:** the phone chart stays at 16px per hour with no control (the list is the phone's reading form); iPads in landscape and desktop windows 641px and up get the control.

### Moving along the axis (both tiers)
- **Mouse drag, one to one (D4-12).** On `pointerdown` with `pointerType === 'mouse'` and `button === 0` on the scroll container: `setPointerCapture(pointerId)`, record `startX = clientX` and `startLeft = scrollLeft`, add `is-dragging` (`cursor: grabbing`, `user-select: none`, `scroll-behavior: auto`). On every `pointermove` while captured: `scrollLeft = startLeft − (clientX − startX)`, no throttle, no easing, no threshold. On `pointerup`, `pointercancel` or `lostpointercapture`: remove the class and stop; the chart stays exactly where it was released. There is no snapping, no inertia and no post-release motion of any kind. The cursor is `grab` at rest.
- **Touch and pen:** native scrolling, untouched (a flick keeps the platform's own momentum; nothing intercepts it).
- **Wheel and trackpad:** native.
- **Keyboard:** the focused scroll container takes the arrow keys, Home and End natively; the day buttons are Tab stops.
- **Day buttons (new, both tiers):** two 28px quiet icon buttons at the right end of the legend row (`ChevronLeft` / `ChevronRight`, `aria-label` "Earlier day" / "Later day", 1.5px `--sr-border`, `--sr-surface`, radius 6, hover `--sr-border-medium` + `--sr-surface-subtle`), each scrolling by one day's width (`24 × hpx`) with `behavior: 'smooth'`, or `'auto'` under reduced motion. "Earlier day" is disabled at the start of the track, "Later day" at its end, and both are disabled (and the "Scroll sideways for later days" hint is hidden) whenever the track fits the box. Disabled uses `--sr-text-disabled` on the glyph and `--sr-border-subtle`.

### The list
`<ol class="sr-plan-days" aria-label="Sunrises and sunsets ahead">`, one `<li>` per day in `days[]`, each holding:
- an `<h4>` day label in the section-label register (0.6875rem/700, uppercase, muted): "SUN, SEP 13" (`formatDate(day.date, { withWeekday: true })`, the user's date preference);
- **the tides line** (Stage 5, D5-15): "Tides: high 4.7 ft (12:06 AM) · low −1.2 ft (6:31 AM) · high 5.4 ft (1:02 PM) · low 0.3 ft (7:15 PM)", every turning point the chart draws on that day, muted 0.75rem, wrapping anywhere; omitted when tide is absent;
- **the sky line**, which is how every strip cell reaches the list as text: on a day with hourly cells, a `<details>` (summary "Sky hour by hour, 24 readings" in the accent disclosure register, chevron rotates open) whose body is one wrapped run of "🌫️ 7 AM Mist · ☁️ 9 AM Overcast clouds · …", ending with the boundary day's partial daily cell as "⛅ from 2:30 PM Scattered clouds (daily)"; on a daily-only day, one muted line "☁️ Overcast clouds all day, H 63° L 54° FORECAST · DAILY"; (Stage 5, D5-16: within a reading only the glyph and its clock are unbreakable; the description wraps like any other text);
- a note in place of a missing event (polar day or night): "No sunrise this day." / "No sunset this day." (0.8125rem muted italic);
- a nested `<ol>` of the day's events, one `<li>` per event.

Each event item (`grid: 30px minmax(0,1fr)`, 10px gap):
- a 30px icon tile (`--sr-surface-subtle`, 1px `--sr-border`, radius 8) holding the lucide `Sunrise` or `Sunset` glyph in `--sr-plan-sun`;
- top row: kind (0.8125rem/600) and time (1.0625rem/700, tabular), an sr-only ", Sun, Sep 13" so a screen reader hears the day with the event, and the resolution micro-label right-aligned (0.625rem/700 uppercase muted): "FORECAST · HOURLY" or "FORECAST · DAILY" (on phones it drops under the time and may wrap);
- tide line (omitted entirely when tide is absent, no placeholder): "Tide **0.7 ft**, rising · between low −1.2 ft (4:48 PM) and high 5.4 ft (12:06 AM Sun)"; the bracket's time adds the weekday when it falls on another day;
- weather line: "☀️ Clear sky, **62°F** (H 67° · L 56°) · Wind **Gentle breeze, W** · Humidity **78%** · Dew pt **55°F** · Cloud **4%**"; the H/L pair only on a daily reading.

Every item gets the same treatment regardless of its values (FR-50). The list never scrolls sideways: `overflow-wrap: anywhere` on the two figure lines, no positive `min-width` anywhere.

**Wide plan regions flow the list into two columns.** The plan region is a container (`container-type: inline-size; container-name: plan`, the `.sr-cal-minimonth` / `.sr-wx-pair` precedent) and at `@container plan (min-width: 760px)` the day list takes `columns: 2; column-gap: 36px` with `break-inside: avoid` on each day, so a week reads down the left column then down the right in DOM order and each line keeps the measure it was designed at. Nothing about the items changes.

### The Weather card on a wide window (641px and up)
While a plan is on screen the Weather card grows from 540px to **1080px**; everything in it other than the plan region keeps its 476px measure, centered (the checklist lookup and its results, the "Now, or any time ahead" heading, the Current / Predict buttons, the Predict form, the loading rows, the single-moment result and the blocking messages). Mechanism, precisely:
- App.tsx: the card's inline `maxWidth: 540` moves to a class (`.sr-weather-card { max-width: 540px }`, layout lifted to a class per the ui rule) plus `@media (min-width: 641px) { .sr-weather-card--plan { max-width: 1080px } }`; the card's children rendered before `<WeatherForecastPanel>` are wrapped in one `<div className="sr-weather-narrow">`; the panel receives `onPlanVisible={setPlanOnScreen}` and the card takes `sr-weather-card--plan` while that state is true. `.sr-weather-narrow` is `max-width: 476px; margin-inline: auto` only inside `.sr-weather-card--plan` at 641px and up, so with no plan on screen nothing moves.
- The panel calls `onPlanVisible(phase.kind === 'plan')` from an effect on the phase kind, and wraps everything it renders except the plan branch in its own `.sr-weather-narrow`.
- The width change is a 220ms ease-out `max-width` transition on the card (none under reduced motion); the plan region's own 180ms entrance runs at the same time.
- Phone tier: nothing changes; `.sr-pad-x-trim` and the 20px card padding apply as before.

### Honest states (all reachable in the mockup's state switcher)
| State | Treatment |
|---|---|
| Loading | Status row: "Building the plan for {place}…" |
| Plan ready | Live region: "Plan ready for {place}." |
| No OpenWeather key | `OfflineMessage kind="no-key"` with `NO_KEY_MESSAGE`; no region |
| Offline, no stored plan | `OfflineMessage kind="offline"` with `OFFLINE_MESSAGE` (web/Pi: `BACKEND_DOWN_MESSAGE` when the device is online); no region |
| Offline, replayed plan | The plan as fetched, `StalenessCue` under the header; passed events unchanged |
| Provider error | Predict's muted line "Weather is unavailable right now."; no region |
| Tide too far / outside US | Header without the station line; the amber notice + override button; chart with shading, event markers on the axis line and the strip, no curve, no H/L; items without tide lines; legend without High/Low; the accessible name says no tide is shown |
| Override running | The plan stays; the button shows the spinner and `aria-busy="true"` at 0.7 opacity; on success the station line, curve, markers and tide lines fill in with no other change |
| Station unavailable | "Tide is unavailable for this spot." once, above the chart; otherwise as too-far without the notice |
| High/low-only station | Full plan; the curve is the straight-segment interpolation; the station line adds "· heights between highs and lows are interpolated" |
| Polar day / night | The day's note(s); no marker for the missing event; the leading segment unshaded when both are absent |
| No later turning point | Tide line reads "Tide 2.1 ft, trend unknown (no later high or low in the data)" and the bracket wording below |

## Component Usage
- `Button` primitive for the plan action and the override (tab order on WebKit); the existing inline button registers (`primaryBtn`, `outlineBtn`, the 30px override button) as classes if the Engineer prefers, with the hover states above.
- `OfflineMessage`, `StalenessCue`, `tideTooFarNotice`, `tideOverrideLabel`, `formatDate`, `ft`: unchanged.
- `PlanResult.tsx` (static): header, notices, legend, list, closing note. `PlanChart.tsx` (lazy, Recharts): the chart. The strip and gutter live in `PlanChart`.
- The Days in view control: `Button` primitives in the `SegControl` register (`role="group"` + `aria-pressed`, the Calendar / Map sidebar pattern), rendered by `PlanResult` above the chart slot only on the wide tier; its value lives in the panel (read from and written to the storage seam) and is passed to `PlanChart` as `daysInView`. The wide/phone tier comes from the app's phone-tier hook (`lib/useIsPhone.ts`) or an equivalent `matchMedia('(max-width: 640px)')` subscription, never a device check.
- The two day buttons: `Button` primitives with `aria-label`, rendered in the legend row by `PlanResult`, driving the chart through a small imperative handle (`scrollByDay(dir)`) plus a `fits` / `atStart` / `atEnd` state the chart reports on scroll and layout.
- Lucide: `CalendarDays` (plan action), `Sunrise`, `Sunset` (event tiles), `Waves` (station line), `ChevronDown` (disclosure), `ChevronsLeftRight` (scroll hint), `ChevronLeft` / `ChevronRight` (day buttons), `Loader2`, `AlertCircle`, `WifiOff`, `KeyRound`, `Clock` (existing states).
- No new library. No shadcn component is introduced; the Weather tab is hand-styled and the plan follows it.

## Design Tokens Applied
Existing: `--sr-accent-surface` / `--sr-accent-border` (region), `--sr-accent` / `--sr-accent-bg` / `--sr-on-accent` (actions, pill, disclosures), `--sr-warning*` (notice, the daily tag), `--sr-surface` / `--sr-surface-subtle` / `--sr-surface-faint`, `--sr-text` / `--sr-text-muted`, `--sr-border` / `--sr-border-subtle` / `--sr-border-medium`. Type is the app's Inter / system-ui stack in the three established roles (headline 1.0625rem/700, body 0.8125rem, label 0.6875rem/700 uppercase), plus the event time at 1.0625rem/700 as the list's display figure.

New, in BOTH theme blocks of `globals.css` (contrast measured with the WCAG formula):

| Token | Light | Dark | Role |
|---|---|---|---|
| `--sr-plan-day` | `#FFFFFF` | `#56607A` | plot ground during daylight (the lit band on dark) |
| `--sr-plan-night` | `#8790A5` | `#05070D` | sunset-to-sunrise band |
| `--sr-plan-tide` | `#1E3A8A` | `#93C5FD` | curve, high/low marks, station glyph |
| `--sr-plan-sun` | `#B45309` | `#FCD34D` | sunrise/sunset marks, leaders, event tiles |
| `--sr-plan-halo` | `#FFFFFF` | `#05070D` | ring behind every mark; stroke behind chart labels |
| `--sr-plan-grid-rgb` | `15,17,23` | `244,244,245` | gridlines at alpha 0.16 over both bands |

No token changes in the revision: the day-header band is `--sr-surface-subtle`, the control and the day buttons use the existing surface, border and text tokens, and disabled glyphs use `--sr-text-disabled` (a control, so WCAG-exempt).

Ratios: night vs day **3.20:1** light, **3.21:1** dark. Tide vs day **10.36** / vs night **3.24** (light); **3.48** / **11.17** (dark). Sun vs day **5.02** (light), **4.35** (dark); over the night band the sun mark is separated by its halo (halo vs night 3.20 light, 3.21 dark) and by shape and label. Chart label ink vs day **18.87** / vs night **5.90** (light); **5.70** / **18.32** (dark). `--sr-plan-sun` as the tile glyph on `--sr-surface-subtle`: 4.7 light, 11 dark. Guard with a `calendarContrast.test.ts`-shaped test asserting night/day, tide/day, tide/night and sun/day ≥ 3:1 in both themes.

## Interaction Notes
- **Journey:** Predict → form → "Plan sunrises and sunsets" → loading row (the form is gone, as for Get forecast) → the plan region. Predict, Current or Get forecast replace it exactly as they replace a single-moment result; a late plan response never overwrites a replaced result (request token) and a late override never overwrites a different place (coord identity guard).
- **Override:** in place, plan on screen, `aria-busy` + spinner on the button, disabled while running; failure shows the offline / no-key / unavailable words in the tide slot and the plan stays.
- **Chart scrolling:** see *Moving along the axis*: one-to-one mouse drag with pointer capture, native touch and wheel, arrow keys on the focused scroller, and the Earlier / Later day buttons; no snapping anywhere; the right-edge fade hides at the end of the scroll. The chart never traps focus and is one tab stop.
- **Days in view:** wide tier only; default All; persisted device-local as `planDaysInView`; a change re-lays out instantly and keeps the left-edge instant; options above the plan's day count are omitted.
- **Sky disclosures:** native `<details>`, closed by default, keyboard-operable; open state is per day and not persisted.
- **Announcements:** loading through the status row; completion through the panel's existing persistent live region (sequence-keyed child so a repeated message still announces).
- **Text scale:** all list and header sizes in rem; chart geometry and chart text in px (deliberate: a chart is a fixed-px track and every figure is repeated in the list at rem sizes). At 200% and 320px the header wraps, the legend wraps, the micro-label wraps under the time, and `document.documentElement.scrollWidth === clientWidth`.
- **Phone tier (≤640):** the two mode buttons stack (existing), the notice stacks its button full-width, the region uses `.sr-pad-x-trim`, the chart box is full-bleed within the region padding, 16px per hour, no Days in view control, the legend gains the two day buttons.
- **Wide tier (≥641):** the card widens while a plan is on screen, the chart takes the wide lanes and the Days in view control, the list flows into two columns above 760px of region width; at 200% text scale the toolbar wraps (label over the control) and the two-column list falls back to one column when the region is narrower than 760px.
- **Reduced motion:** every entrance, transition and the spinner are removed by the global rule.

## Motion Spec
- Result region entrance (plan, single-moment, and every message that takes the region's place): opacity 0→1 with `translateY(4px)→0`, `cubic-bezier(0.2, 0, 0, 1)`, 180ms, transform-origin top center, reduced-motion none, lib: CSS.
- Primary / outline button hover: background and border-color 120ms ease-out, no transform, reduced-motion none, lib: CSS.
- Override button busy: opacity 0.7 (no animation beyond the `.spin` loader, which the global reduced-motion rule freezes), lib: CSS.
- Sky disclosure chevron: rotate 0→180deg, 160ms `cubic-bezier(0.2, 0, 0, 1)`, origin center, reduced-motion none; the content itself opens instantly (native details), lib: CSS.
- Chart drag: none. The scroll position follows the pointer one to one while the mouse button is down and stops where it is released; no snap, no inertia, no easing at any point, lib: none.
- Day buttons: `scrollBy` by one day's width, `behavior: 'smooth'` (the platform's own curve, well under 300ms for a day's width), reduced-motion `'auto'`, lib: DOM.
- Days in view change: instant re-layout, no transition (the whole chart changes; animating a re-scale would misstate the data mid-flight), lib: none.
- Weather card width (wide tier, plan appears or leaves): `max-width` 220ms `cubic-bezier(0.2, 0, 0, 1)`, reduced-motion none, lib: CSS.
- Segmented control and day buttons hover/pressed: background, border-color and color 120ms ease-out, no transform, reduced-motion none, lib: CSS.
- Nothing pulses, blurs, staggers or scales on hover.

## Content Notes
Voice: Predict's, short and factual; every sentence states a fact the app has, never a judgement. No em dash character anywhere; ranges use "→" in the mono window line and "·" as the separator everywhere else; negative heights use the minus sign "−".

Exact strings:
- Action label: **Plan sunrises and sunsets**
- Caption under it: **The plan runs from now to the end of the forecast, about eight days, for the place above. The date and time apply only to Get forecast.**
- Loading status: **Building the plan for {place}…**
- Ready announcement: **Plan ready for {place}.**
- Region name: **Weather and tide plan**
- Pill: **Plan · {n} days**
- Window line: **{start, weekday, date, year, time} → {end weekday, date, year}, 11:59 PM**
- Second line: **Local time at this spot · {lat}, {lng} · fetched {time}**
- Station line: **Tide: {name} ({id}) · {distance} mi · Predicted · relative to MLLW** [+ **· heights between highs and lows are interpolated**]
- Resolution labels: **FORECAST · HOURLY** and **FORECAST · DAILY** (the daily words are Predict's pill text, extracted to `lib/forecastLabels.ts` and shared; the hourly label is new)
- Strip tags: **FORECAST · HOURLY**, **FORECAST · DAILY FROM HERE**
- Day sky line (daily days): **{emoji} {description} all day, H {high}° L {low}°**
- Disclosure summary: **Sky hour by hour, {n} readings**; body items **{emoji} {hour} {description}**, boundary cell **{emoji} from {time} {description} (daily)**
- Event kinds: **Sunrise** / **Sunset**
- Tide line: **Tide {h} ft, rising** / **falling** / **trend unknown (no later high or low in the data)**
- Brackets: **between {kind} {h} ft ({time}) and {kind} {h} ft ({time})**; one-sided **after {kind} {h} ft ({time}); no later high or low in the data** / **before {kind} {h} ft ({time}); no earlier high or low in the data**; none: **no high or low in the data on either side**
- Day tides line (Stage 5, D5-15): **Tides: {kind} {h} ft ({time}) · {kind} {h} ft ({time}) · ...**, one per day beneath the day heading, carrying every high and low the chart draws on that day in the location's clock, in the bracket vocabulary, so the set of turning points in the list equals the set drawn; omitted when tide is absent or the day holds none
- Weather line: **{emoji} {description}, {temp}°F (H {high}° · L {low}°) · Wind {word}, {dir} · Humidity {n}% · Dew pt {n}°F · Cloud {n}%**
- Polar: **No sunrise this day.** / **No sunset this day.**
- Tide unavailable: **Tide is unavailable for this spot.** (Predict's)
- Too-far / outside-US notice and override labels: Predict's (`tideTooFarNotice`, `tideOverrideLabel`)
- Chart names: see *The chart*
- Legend: **Day · Night · Sunrise · Sunset · High · Low · Scroll sideways for later days** (the hint is hidden when the whole track fits)
- Days in view: label and group name **Days in view**; options **1 day**, **3 days**, **7 days**, **All {n} days** (`All 8 days`; the count follows the plan)
- Day buttons (accessible names): **Earlier day**, **Later day**
- Strip tags at low density: **FORECAST · HOURLY · A GLYPH EVERY 3 HOURS** / **… EVERY 6 HOURS**; short forms **HOURLY · EVERY 6 H**, **HOURLY**, **DAILY**
- Setting key: `planDaysInView`
- Closing note: **The plan stops where the weather forecast stops. Tide predictions reach further ahead: for any later moment, use Get forecast with a date and time.**
