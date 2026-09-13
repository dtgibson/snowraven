# PRD — Weather/tide Planner
**Feature:** tide-weather-planner
**Date:** 2026-09-12
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
A second action inside the Weather tab's Predict form that, for the place already picked, produces a plan from now to the end of the available forecast: every sunrise and sunset still ahead, each with the predicted tide height and trend, the high and low on either side, and the weather in force, rendered as one readable per-event list and one chart on the location's own time axis. It exists so a coastal birder can see how first light, last light, low water and weather line up across the coming days in one view instead of up to sixteen separate Predict lookups.

## User Stories
> **US-01** — As a coastal birder planning the days ahead, I want one action from the Predict place picker to show every sunrise and sunset still to come with the tide at each, so that I can see which mornings put low water at first light without running a lookup per event.

> **US-02** — As a birder reading the plan on a phone, I want a per-event list that carries every figure the chart draws, so that I can read the plan even where the chart is too dense to read.

> **US-03** — As a screen-reader user, I want the list to be the plan's accessible form and the chart to carry a name that says what it shows, so that nothing in the plan is lost to me.

> **US-04** — As a birder at an inland or non-US place, I want the plan to still show sunrise, sunset and weather, tell me why the tide is missing, and let me show the nearest station anyway, so that a missing tide never costs me the rest of the plan.

> **US-05** — As a birder with no connection, I want the last plan I loaded for this place to re-show with a note of when it was fetched, so that I know exactly how old it is.

> **US-06** — As a birder who reads tide tables, I want the plan to present the provider's forecast and NOAA's predictions with no judgement laid over them, so that the pattern is mine to read.

## Functional Requirements

*Entry and the result region*

> **FR-01** — The Predict form shall offer a second action, beside the existing single-moment "Get forecast" action, that produces the plan for the place currently picked. The place picker (name search, draggable map pin, latitude and longitude fields) is shared as it stands; the date and time fields shall continue to govern only the single-moment lookup and shall have no effect on the plan.

> **FR-02** — The plan action shall apply the same place validation as the single-moment action: with no place picked it shall show Predict's existing "Pick a place first" message, and with out-of-range coordinates Predict's existing out-of-range message, and shall make no request in either case.

> **FR-03** — While the plan is being fetched the app shall show a loading status in the same place and manner Predict shows its loading status, announced through the existing status region; when the plan is ready it shall announce that through the existing live region, naming the place.

> **FR-04** — The plan shall render in the same result region a single-moment result occupies, replacing whatever that region held. The region's accessible name shall identify it as a plan rather than a single-moment result, and only one result (a plan or a single moment) shall be on screen at a time.

> **FR-05** — The plan's header shall state the place label as Predict states it; the window's start and end (FR-07) as dates and times in the location's timezone; and, when tide is present, the station name, its id, its distance, the word Predicted, and the MLLW reference, once for the whole plan rather than per event.

> **FR-06** — Reopening Predict, running Current, or running a single-moment lookup shall replace the plan in the result region exactly as those actions replace a single-moment result today; the plan is not retained on screen and is fetched again (or replayed, FR-43) on the next plan action. A response from an earlier plan fetch, or an earlier override, shall never overwrite a result the user has since replaced, using the same identity guard Predict's override already uses.

*The window*

> **FR-07** — The plan window shall begin at now, the moment of the fetch expressed in the location's timezone, and shall end at the end of the last calendar day (23:59 in the location's timezone) that the forecast's daily entries cover, about eight days ahead. The chart axis (FR-21) shall begin at the start of the current hour in the location's timezone.

> **FR-08** — The plan shall list every sunrise and sunset whose time is later than now, taken from the forecast's daily entries, and shall omit any sunrise or sunset that has already passed today. The app shall never compute a sunrise or sunset itself.

> **FR-09** — Where the forecast covers fewer days than usual, the window shall end with the last day it does cover. Where the forecast carries no daily entries at all, the plan cannot be built and the app shall report Predict's provider-error words (FR-39).

> **FR-10** — A day whose forecast entry carries no sunrise or no sunset (polar day or polar night) shall contribute no event for the missing one, and the list shall say for that day that there is no sunrise (or no sunset) rather than show a time.

> **FR-11** — Past the window nothing shall be drawn or listed. The plan shall close with a note stating two facts: that tide predictions exist further ahead, and that Predict can look up any specific later moment. The words are the Designer's (OQ-08); both facts are required.

*The per-event list*

> **FR-12** — The list shall present every event in the window (FR-08) in chronological order, each as one item carrying the day and date, whether it is a sunrise or a sunset, and its local time in the location's timezone.

> **FR-13** — Each item shall carry the predicted tide height at that time, in feet relative to MLLW to one decimal place, and whether the tide is rising or falling at that time, in words.

> **FR-14** — Rising and falling shall be defined by the next turning point: rising when the next high or low at or after the event is a high, falling when it is a low.

> **FR-15** — Each item shall carry the bracketing high and low: the latest turning point strictly before the event and the earliest turning point at or after it, each with its kind (high or low), its height to one decimal place, and its local time. A turning point at the event's own minute is the next bracket and shares the event's time. Where the data holds no turning point on one side, the item shall say so in words rather than leave a blank.

> **FR-16** — Each item shall carry the weather in force at that time using the fields Predict's summary shows: condition (icon and description), temperature (and, for a daily reading, the day's high and low), wind (strength word and direction), humidity, dew point and cloud cover, in the units Predict uses.

> **FR-17** — Each item's weather shall carry a label saying whether it is an hourly reading or a daily summary. Within the forecast's hourly coverage (about 48 hours) the reading shall be the entry chosen by the same rule Predict applies to a single moment (an event within the hour of now uses the reading Predict uses for that moment and carries the hourly label); beyond the hourly coverage the reading shall be that day's entry, and the daily label shall use Predict's existing daily-summary wording so the two surfaces label a daily reading identically. The label shall be text, never color alone.

> **FR-18** — The weather shown for an event shall be exactly the reading Predict returns for the same place at that event's time, so that every weather figure in the plan matches Predict for the same moment.

> **FR-19** — The plan's tide figures shall derive from the same station, the same predictions, and the same interpolation rule Predict uses, so that the height at an event lies within the range Predict shows for a single-moment lookup at that time, and the turning points are the same turning points. (The plan reads a point; Predict reads a one-hour window. See the flags.)

> **FR-20** — The plan shall not show Predict's night moon glyph on any event; a sunrise or sunset is itself the day/night boundary, and moon phase is out of scope.

> **FR-21** — When tide is absent for the plan (FR-33, FR-35), items shall omit the tide figures rather than show placeholders; the reason shall appear once, at the top of the plan.

*The chart*

> **FR-22** — The plan shall include one chart across the window on a single time axis rendered in the location's timezone, with real elapsed time as the axis: a day that gains or loses an hour at a DST change is drawn at its true length, with no hour lost or duplicated, and a far station's predictions land at their true instants.

> **FR-23** — The chart shall draw the predicted tide height as a curve across the whole window, from the station's continuous predictions where it provides them and from the high/low interpolation (FR-32) where it does not.

> **FR-24** — The chart shall shade the night hours (each sunset to the following sunrise) visibly distinct from the day hours. The segment before the first event shall be shaded night when now falls before today's sunrise or at or after today's sunset, and day otherwise.

> **FR-25** — The chart shall mark each sunrise and each sunset on the curve, and each high and each low turning point within the window, with sunrise distinguishable from sunset and high from low by shape or label as well as by color.

> **FR-26** — The chart shall carry a weather strip along the axis: one cell per hourly entry across the forecast's hourly coverage, then one cell per daily entry to the end of the window, with the transition from hourly cells to daily cells visibly labeled. Each cell shall show at least the condition.

> **FR-27** — The chart is never the only representation. The list (FR-12 to FR-21) shall carry every figure the chart draws, including every figure in the weather strip, and is the form assistive technology receives.

> **FR-28** — The chart shall carry an image role and a concise accessible name saying what it shows (the place, the window, and that the details are in the list), following the sightings-over-time charts; its internals shall be hidden from assistive technology. When no tide is drawn, the name shall say so.

> **FR-29** — On narrow screens the chart shall sit inside its own scroll container if it needs more width than the viewport, and the page shall never scroll sideways at 320px or at 200% in-app text scale. Whether the chart scrolls horizontally or compresses is the Designer's (OQ-03); the list never scrolls sideways.

> **FR-30** — When tide is absent the chart shall still render its day/night shading, its sunrise and sunset markers, and its weather strip, with no tide curve and no high/low markers.

*Tide handling*

> **FR-31** — The plan shall use the nearest NOAA station to the picked place, chosen and classified exactly as Predict chooses and classifies it: the same station list, the same too-far distance, and the same US coverage test.

> **FR-32** — Tide data for the whole window shall come from at most two requests to that station: one for continuous predictions across the window and one for high and low predictions across the window, widened enough that every event has a bracket on both sides (FR-15). No per-event and no per-day requests. For a subordinate station (high/low predictions only), the height at each event and the drawn curve shall be interpolated on the high/low curve the way the app already interpolates for Predict, and the absence of continuous predictions shall not be treated as an error.

> **FR-33** — Where the nearest station is farther than the too-far distance, or the place is outside the US, the plan shall still render with sunrise, sunset and weather, show Predict's existing notice words at the top of the plan, and offer Predict's existing one-tap override with its existing label. The override shall fetch the tide from that station (at most two requests, FR-32) and fill it into the same plan without fetching the weather again; while it runs the plan stays on screen and the override control shows Predict's existing busy state.

> **FR-34** — An overridden plan shall place the far station's predictions on the location's time axis and label every tide time in the location's timezone; a far station's own clock may differ, and the plan shows the place's clock.

> **FR-35** — Where both NOAA requests fail, return error bodies, or return no usable level, the plan shall render with sunrise, sunset and weather and say once, in Predict's existing words, that tide is unavailable for this spot.

> **FR-36** — Where the continuous predictions have a gap at an event, that event's height shall be interpolated on the high/low curve; where the high/low predictions are missing on one side of an event, FR-15's wording applies. A partial NOAA response shall never block the plan.

> **FR-37** — A missing, refused, or failed tide shall never block the plan. Only the weather blocks it (FR-39).

> **FR-38** — The plan's tide shall always be labeled Predicted (astronomical predictions), never Observed; the plan makes no observed-water-level request.

*Weather handling*

> **FR-39** — The plan requires the forecast response. With no OpenWeather key, no connection (and no replayable plan, FR-43), or a provider failure, the plan shall not render; the app shall say which applied, in Predict's existing words and treatment for each: the no-key message, the offline message (including the web/Pi "can't reach the SnowRaven server" variant Predict already distinguishes), or Predict's provider-error words. No partial plan (a tide curve with no events) shall be shown.

> **FR-40** — A provider response that cannot be used (a 429, a 5xx, a malformed body, or no daily entries) shall be treated as a provider error, shown in Predict's existing words, and shall never be stored for replay.

> **FR-41** — The app should make no NOAA request when the plan cannot be built for want of an OpenWeather key.

> **FR-42** — Sunrise and sunset times shall come from the forecast's daily entries as present in the response; no additional call and no local calculation.

*Offline replay*

> **FR-43** — A plan fetched online once shall re-show offline for the same place, with the app's existing staleness cue naming when it was fetched, in preference to the offline message. The replayed plan is the plan as fetched: its window, its events (including any that have since passed), and its figures, unchanged.

> **FR-44** — A fresh fetch shall re-anchor the plan to the new now; replay never re-anchors. A plan is served from replay only when a live fetch fails for lack of a connection, never while online.

> **FR-45** — Offline with no replayable plan for that place, the app shall show Predict's offline message. A tide override is always a fresh read and is never replayed.

> **FR-46** — The plan shall not change the replay store's existing rules: a failure is never stored, and a stored plan follows the same eviction and clear behaviour as a stored single-moment result.

*Request budget and transports*

> **FR-47** — One plan fetch shall make exactly one OpenWeather request and at most two NOAA requests; an override adds at most two NOAA requests and no OpenWeather request. There shall be no request per event or per day.

> **FR-48** — Both transports (the desktop TypeScript services and the web/Pi FastAPI backend) shall produce the plan from the same inputs with identical output over identical fixtures; whether through new range routes or extended `/at` routes is the Architect's (OQ-05). Any new backend route shall be reachable from the web dev server's proxy and shall not be captured by the checklist-id routes.

> **FR-49** — Any new route shall accept only range-validated coordinates and the existing force flag. The window shall be derived by the app from now and the forecast, never supplied by the caller, and no caller-supplied value shall reach a provider URL.

*No inference*

> **FR-50** — The plan shall present the provider's forecast and NOAA's predictions, each labeled as such, and shall infer nothing from them: no best morning, no score or rank, no threshold, no recommended window, and no event highlighted, colored, ordered, or worded as better than another. Every event shall receive the same treatment.

*Consistency*

> **FR-51** — Dates in the plan shall honor the user's date-format preference and times shall use the app's existing clock style, all in the location's timezone.

> **FR-52** — Units shall match Predict: degrees Fahrenheit, the Beaufort strength word for wind, percent for humidity and cloud cover, and feet relative to MLLW.

> **FR-53** — Current, the checklist lookup, the copy-ready block, and the single-moment Predict result shall be unchanged in behaviour and words.

*Documentation and records*

> **FR-54** — The same change shall describe the planner, under one name (Weather/tide Planner), in `docs/HELP.md` (a passage under Current and Predict), `README.md` (the Weather bullet), and `website/index.html` (the Weather paragraph), in the same words, and never by a component or file name. There shall be no em dash character in any of it.

> **FR-55** — A published-claims guard of the existing shape shall hold those three passages to the code: scoped to each file's own passage, asserting each passage exists before checking it, and comparing the three files against each other, stating properties rather than counts. At minimum it shall hold these claims: the window ends where the forecast ends; every sunrise and sunset in the window is listed with its tide and weather; the plan ranks and recommends nothing; a plan loaded once re-shows offline with a cue.

> **FR-56** — The version shall be bumped by one patch in the four-file set (`frontend/package.json`, `src-tauri/tauri.conf.json`, the `website/index.html` version pill and footer, and `CHANGELOG.md`), with a changelog entry describing the planner.

> **FR-57** — `PRIVACY_POLICY.md` shall be read against the plan. The OpenWeather request is the same request Predict makes, so its sentence stays as it is. The NOAA sentence ("the current or predicted tide for a location and time you choose") shall gain one clause so that it also covers the predicted tide across the days ahead for a place you choose; the paragraph shall be swept at paragraph scope per the docs rule, and the file shall otherwise be unchanged.

## Non-Functional Requirements

> **NFR-01 — Accessibility:** WCAG 2.1 AA holds at 320px and at 200% in-app text scale, in both themes. The list is the screen-reader form of the plan (real list or table semantics, one item per event, every figure as text); the chart carries an image role and a name (FR-28); the new action and the override render through the app's `Button` primitive so they hold a place in the tab order on WebKit, and every new control has an accessible name and visible focus; loading and completion are announced (FR-03); every state is conveyed by icon or text as well as color.

> **NFR-02 — Color and contrast:** Every color is a `var(--sr-*)` token in both themes, with no hardcoded values in components. The day/night shading and the tide curve clear 3:1 against the chart ground in both themes; the sunrise, sunset, high and low markers are distinguishable by shape or label as well as by hue; any new token is checked the way the calendar and county ramps are.

> **NFR-03 — Performance:** The chart component and the chart library ship as a lazy chunk, exactly as `PredictMap` does; `entryChunk.test.ts`'s existing "no chart library is reachable from App.tsx" assertion stays green and is paired with a positive assertion that the new chart module is reachable only through a dynamic import and does itself reach the chart library, so the guard cannot pass vacuously. The drawn curve is bounded to at most one point per 30 minutes across the window regardless of the provider's resolution. The list renders as soon as the plan arrives; a chart chunk still loading never delays the figures.

> **NFR-04 — Parity:** The desktop TypeScript and FastAPI plan builders are twins with parity tests over identical fixtures, byte-identical in output, covering at minimum: a reference station with continuous predictions; a subordinate station with high/low only; a window that crosses a DST change; a far-station override whose station clock differs from the location's; a NOAA response with gaps; a forecast with no hourly entries; a forecast with fewer daily entries than usual; and a polar day.

> **NFR-05 — Security posture:** Per `.claude/rules/security.md`: no new outbound destination; only the picked coordinates (and a range the app computes) leave the device; any new route range-validates its parameters and interpolates no caller-supplied value into a provider URL (FR-49); any scan over provider text either reuses the existing linear parsers or is declared in the schema with its linearity argument attached before the build.

> **NFR-06 — Privacy:** No new provider, no new key, no personal data, no eBird call and no read of a user file. The plan sends the same coordinates to the same two disclosed providers Predict already uses; `PRIVACY_POLICY.md` changes only as FR-57 states.

> **NFR-07 — Resilience:** Weather and tide are fetched concurrently with the existing timeouts; a provider 429 or 5xx is shown as a provider error and never cached or replayed; there is no retry storm, and the request budget (FR-47) holds on every path including failure and override.

> **NFR-08 — Replay footprint:** A stored plan is the computed plan document, not the raw provider bodies, and its serialized size stays under 300,000 code units (a tenth of the replay store's payload budget) so a plan replays reliably and does not distort the store's FIFO for the single-moment results beside it.

> **NFR-09 — Documentation parity:** `docs/HELP.md`, `README.md` and `website/` describe the planner in the same words and the guard in FR-55 holds them to the code; no em dash character appears in user-facing copy or the published prose.

> **NFR-10 — No regression:** Predict, Current and the checklist lookup are byte-unchanged in output; the existing frontend and backend suites stay green; `npm run build` passes before push.

## Out of Scope
Carried forward from the strategic brief:
- Extending the timeline past the weather horizon. The window ends where the forecast ends; the plan notes that tide predictions exist further out and that Predict can look up any specific later moment (FR-11).
- eBird hotspot search by name as the place input.
- Any judgement about the data: no good mornings, no ranking or scoring of days, no recommended windows, no thresholds, no highlighting of one event over another (FR-50).
- A copy-ready block for the plan.
- Moon phase on the timeline, and Predict's night moon glyph on any event (FR-20).
- A tide-only plan when the weather call fails (FR-39).
- A local astronomical sunrise/sunset calculation (FR-42).
- Any One Call field the existing weather summary does not already show (precipitation probability, UV, pressure, alerts).
- Saving, naming or comparing plans; more than one place at a time; reminders or notifications.
- Changes to Current, to the checklist lookup, to the copy block, or to the Predict single-moment result (FR-53).

Added while writing this PRD:
- A user-chosen window, start date, or number of days; the window is always now through the forecast's end.
- Observed water levels in the plan; the plan is predictions only (FR-38).
- A station picker or a second station; the plan uses the nearest station and Predict's override only.
- Per-event copy or share actions.
- Re-anchoring or refreshing a plan while it sits on screen; a plan changes only on a fresh action.
- Keeping the plan on screen while the pin is being moved; the form and the result alternate exactly as they do for Predict today (FR-06).
- Reuse of the Predict date and time fields as a plan start; they stay single-moment controls (FR-01).
- Metric units or a units toggle.

## Open Questions
> **OQ-01 — The visible label and the two actions' relative weight (Designer).** Default if unanswered: a full-width secondary (outline) button beneath the primary "Get forecast", labeled "Plan sunrises and sunsets", so the single-moment lookup keeps primary weight and the new action reads as the same form's second output.

> **OQ-02 — Chart density (Designer).** Default: one curve point per 30 minutes (NFR-03); one weather cell per hourly entry then per daily entry (FR-26) with each cell at least 16px wide, which on a phone means the chart is wider than the viewport and OQ-03 applies.

> **OQ-03 — Whether the chart scrolls horizontally on phones (Designer).** Default: yes, inside its own scroll container with a visible affordance and keyboard-reachable scrolling, the page and the list never scrolling sideways (FR-29).

> **OQ-04 — Whether `ChartViewTip` mounts above the chart (Designer).** Default: no. Its dismissal map is keyed to the Statistics and Species Detail pages, and the planner's chart scrolls (OQ-03) rather than asking the user to rotate the device.

> **OQ-05 — New range routes versus extended `/at` routes (Architect).** Default: two new range-shaped routes, one under `/weather/` and one under `/tide/`, declared before the `{checklist_id}` routes and matched before the prefix checks in `transport.ts`, with the existing `/at` routes byte-unchanged; the Vite proxy already forwards both prefixes.

> **OQ-06 — NOAA time-zone handling for the range calls (Architect).** Default: request the two range calls in GMT and convert to the location's timezone for placement and display, so a far station and a DST crossing land on one axis (FR-22, FR-34); the existing single-moment calls keep the station-local clock unchanged.

> **OQ-07 — Whether the list is grouped by day or flat (Designer).** Default: a flat chronological list, each item carrying its own date; day headings are a Designer option provided every item still carries its date so a screen reader hears the day with the event (FR-12).

> **OQ-08 — The closing note and the loading and ready announcement words (Designer).** Defaults: "Tide predictions run further ahead than the weather forecast. Use Predict for any specific later moment." for the note (FR-11); "Building the plan for {place}..." for the loading status and "Plan ready for {place}." for the live-region announcement (FR-03).

## Success Metrics
| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Entry action (FR-01) | The Predict form shows the plan action beside "Get forecast"; changing the date or time fields changes nothing in the plan produced. |
| QA-02 | Place validation (FR-02) | With no place picked, the plan action shows Predict's "Pick a place first" message; with latitude 91, its out-of-range message; in both cases zero network requests are made. |
| QA-03 | Loading and ready announcements (FR-03) | During the fetch a loading status renders where Predict's does and the status region announces it; on completion the live region announces the plan is ready and names the place. |
| QA-04 | Result region (FR-04) | The plan renders inside the same result region as a single-moment result, replacing it; the region's accessible name says it is a plan; no single-moment result remains on screen. |
| QA-05 | Header (FR-05) | The header shows the place label, the window's start and end in the location's timezone, and (with tide) the station name, id, distance, "Predicted" and "MLLW" exactly once. |
| QA-06 | Replacement and stale-response guard (FR-06) | Tapping Predict, Current, or "Get forecast" after a plan replaces the plan; a plan response that resolves after the user has replaced it never appears. |
| QA-07 | Window bounds (FR-07) | With a fixture whose last daily entry is day D, the plan's end is D 23:59 in the location's timezone; the start is the fetch moment; the chart axis begins at the start of the current hour. |
| QA-08 | Only events ahead (FR-08) | With now set between today's sunrise and sunset, today's sunrise is absent and today's sunset is the first event; every later sunrise and sunset through the window is present, none duplicated. |
| QA-09 | Short and empty forecasts (FR-09) | A fixture with five daily entries yields a five-day window; a fixture with no daily entries yields Predict's provider-error words and no plan. |
| QA-10 | Polar day (FR-10) | A fixture whose daily entry lacks a sunset yields no sunset event for that day and an item stating there is no sunset that day. |
| QA-11 | Closing note (FR-11) | The plan ends with a note that states tide predictions exist further ahead and that Predict looks up a specific later moment. |
| QA-12 | List items (FR-12) | Items are in chronological order; each carries the date, "Sunrise" or "Sunset", and the local time. |
| QA-13 | Height and trend (FR-13, FR-14) | An event between a low and the following high reads "Rising" with the height to one decimal place in ft; an event between a high and the following low reads "Falling". |
| QA-14 | Brackets (FR-15) | For an event, the previous bracket is the latest turning point strictly before it and the next is the earliest at or after it, with kind, height and time; an event coinciding with a high shows that high as its next bracket at the same time; a fixture with no earlier turning point shows the one-sided wording. |
| QA-15 | Weather fields (FR-16) | Each item shows condition (icon and description), temperature (with high and low on a daily item), wind word and direction, humidity, dew point and cloud cover. |
| QA-16 | Hourly and daily labels (FR-17) | Events inside the hourly coverage carry the hourly label; the first event beyond the last hourly point (the last day's sunset in an eight-day fixture) carries the daily label in Predict's daily-summary words; an event within the hour of now carries the hourly label. |
| QA-17 | Weather parity with Predict (FR-18) | For three events (hourly, boundary, daily), a single-moment Predict lookup at that time over the same fixture returns identical condition, temperature, wind, humidity, dew point and cloud values. |
| QA-18 | Tide parity with Predict (FR-19) | For each event over the same fixture, the plan's height lies within the range Predict's one-hour reading shows at that time, and the plan's turning points appear in Predict's high/low series. |
| QA-19 | No moon glyph (FR-20) | No event item and no chart cell renders the moon-phase glyph, including for events whose nearest hourly reading falls before sunrise. |
| QA-20 | Tide-absent items (FR-21) | With tide absent, items carry no tide figures and no placeholders; the reason appears once at the top. |
| QA-21 | Axis and DST (FR-22) | Over a window crossing a US DST change, the day with 25 (or 23) hours is drawn at that length and every event and turning point lands at its correct instant in the location's timezone. |
| QA-22 | Tide curve (FR-23, FR-32) | For a reference-station fixture the curve follows the continuous predictions; for a subordinate-station fixture the curve is the interpolation on the high/low curve and no error is shown. |
| QA-23 | Night shading (FR-24) | Each sunset-to-sunrise span is shaded; with now before today's sunrise, the leading segment is night; with now after today's sunset, night; with now mid-day, day. |
| QA-24 | Markers (FR-25) | Every sunrise, sunset, high and low in the window is marked; sunrise and sunset differ in shape or label; high and low differ in shape or label. |
| QA-25 | Weather strip (FR-26) | The strip shows one cell per hourly entry then one per daily entry with a visible label at the transition; each cell shows the condition. |
| QA-26 | List carries the chart (FR-27) | Every figure drawn on the chart (each event, each turning point, each strip cell's condition) is present as text in the list. |
| QA-27 | Chart accessibility (FR-28, FR-30) | The chart has role img and a name that includes the place and window and points to the list; its internals are hidden from assistive technology; with tide absent the name says no tide is shown and the chart still renders shading, markers and strip. |
| QA-28 | No sideways page scroll (FR-29) | At 320px and at 200% in-app text scale, `document.documentElement.scrollWidth` equals the viewport width with a plan on screen; the chart, if wider, sits in its own scroll container; the list wraps. |
| QA-29 | Station selection (FR-31) | The plan's station, distance and classification equal Predict's for the same coordinates, including a place just over the too-far distance and a non-US place. |
| QA-30 | Request budget (FR-32, FR-47) | One plan fetch makes exactly one OpenWeather request and at most two NOAA requests (continuous and high/low); an override makes at most two NOAA requests and zero OpenWeather requests; no observed-water-level request is ever made. |
| QA-31 | Too-far and outside-US (FR-33) | Each case shows Predict's notice words and override label at the top of the plan with events and weather rendered; tapping the override fills tide into the same plan, the weather figures are unchanged, and the override shows its busy state while running. |
| QA-32 | Far-station clock (FR-34) | With an override to a station in a different timezone, every tide time in the list and on the chart is rendered in the location's timezone and the curve aligns with the location's sunrise and sunset. |
| QA-33 | NOAA failure (FR-35, FR-37) | With both NOAA requests failing (or returning error bodies), the plan renders events and weather and says once that tide is unavailable for this spot. |
| QA-34 | NOAA gaps (FR-36) | With a continuous series missing an hour around an event, that event's height is interpolated from the high/low curve and the plan renders in full. |
| QA-35 | Predicted label (FR-38) | The plan is labeled Predicted, never Observed. |
| QA-36 | Weather blocks the plan (FR-39) | No key shows Predict's no-key message; offline with no replay shows Predict's offline message (and the web/Pi server-down variant when the device is online); a 5xx shows Predict's provider-error words; in all three no plan and no tide curve render. |
| QA-37 | Provider errors never replay (FR-40, NFR-07) | After a 429, going offline and repeating the plan action shows the offline message, not a replayed plan built from the failure. |
| QA-38 | No NOAA without a key (FR-41) | With no OpenWeather key, the plan action makes zero NOAA requests. |
| QA-39 | Sunrise source (FR-42) | Event times equal the fixture's daily sunrise and sunset values; no request beyond FR-47's budget is made. |
| QA-40 | Offline replay (FR-43) | A plan fetched online re-shows offline for the same place with the staleness cue naming the fetch time; its window, events (including ones now past) and figures are unchanged. |
| QA-41 | Re-anchoring (FR-44) | A fresh online fetch yields a plan starting at the new now; while online, the plan is never served from replay. |
| QA-42 | Offline without replay, override never replayed (FR-45) | Offline with a different pin and no stored plan shows the offline message; offline, the override shows an offline result rather than a replayed tide. |
| QA-43 | Replay rules and footprint (FR-46, NFR-08) | The stored plan document serializes under 300,000 code units and is the computed plan, not raw provider bodies; failures are not stored; the store's eviction and clear tests stay green. |
| QA-44 | Transport parity (FR-48, NFR-04) | The TypeScript and Python builders produce byte-identical plans over the eight fixture families in NFR-04; any new route is proxied by the Vite dev server and not captured by the checklist-id routes. |
| QA-45 | Route validation (FR-49, NFR-05) | A new route rejects latitude or longitude out of range with a 4xx and accepts no window parameter; no caller-supplied value appears in an outbound URL. |
| QA-46 | No inference (FR-50) | Every event item and chart marker uses identical treatment regardless of its values; the plan's copy contains no "best", "good", "recommended", or ranking language; no event is emphasized over another. |
| QA-47 | Dates, times, units (FR-51, FR-52) | Switching the date-format preference changes the plan's dates; times use the app's clock style; units read °F, a Beaufort word, percent, and ft MLLW. |
| QA-48 | No regression (FR-53, NFR-10) | Current, the checklist lookup, the copy block and the single-moment Predict result produce byte-identical output to the previous release over the existing tests; `npm run build` passes. |
| QA-49 | Three surfaces, same words (FR-54, NFR-09) | `docs/HELP.md`, `README.md` and `website/index.html` each carry the planner passage under the name Weather/tide Planner, in the same words, with no component or file name and no em dash character. |
| QA-50 | Published-claims guard (FR-55) | The guard goes red when any of the four claims is deleted from one file, when one file diverges from the other two, and when a claim is re-worded to contradict the code; it is restored byte-identical after each mutation. |
| QA-51 | Version set (FR-56) | All four files carry the same new patch version, `CHANGELOG.md` has an entry for it, and the release-parity guard is green. |
| QA-52 | Privacy sentence (FR-57) | The NOAA sentence in `PRIVACY_POLICY.md` covers the predicted tide across the days ahead for a place you choose; the OpenWeather sentence is unchanged; nothing else in the file changed. |
| QA-53 | Accessibility and color (NFR-01, NFR-02) | The new action and the override are `Button` primitives reachable by Tab; every new control has an accessible name and visible focus; all colors are `var(--sr-*)` tokens; the shading and curve meet 3:1 against the chart ground in both themes. |
| QA-54 | Lazy chart chunk (NFR-03) | The build emits the chart as its own chunk; `entryChunk.test.ts` shows no chart library on the App.tsx graph and a positive assertion that the new chart module reaches it; the curve series has at most one point per 30 minutes; the list is visible before the chart chunk resolves. |
