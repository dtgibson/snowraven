# PRD — Checklist Weather Lookup
**Feature:** checklist-weather-lookup
**Session:** 001
**Date:** 2026-05-05
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview
A single-screen web app that accepts an eBird checklist identifier, fetches the checklist's time and location via the eBird API, retrieves historical weather data via the OpenWeather One Call API, and returns a formatted plain-text block the user can copy and paste directly into an eBird checklist comment field.

---

## User Stories

**US-01** — As a birder, I want to paste my eBird checklist URL or ID into a field and click a button, so that I get a formatted weather block without any manual data entry.

**US-02** — As a birder, I want the weather output to match the raincrow.app format I'm used to, so that I can paste it into eBird without reformatting anything.

**US-03** — As a birder, I want to copy the weather output to my clipboard with one click, so that I can move to eBird immediately without selecting text.

**US-04** — As a birder, I want a clear error message when something goes wrong (bad checklist ID, API failure), so that I know what to do next rather than seeing a broken state.

**US-05** — As a self-hoster, I want the app to run with just a `.env` file containing two API keys, so that setup on a Raspberry Pi or localhost is straightforward.

---

## Functional Requirements

### Input
**FR-01** — The app shall accept input in two formats: a bare checklist ID (e.g. `S12345678`) and a full eBird checklist URL (e.g. `https://ebird.org/checklist/S12345678`). Both shall produce the same result.

**FR-02** — The app shall extract the checklist ID from a URL by parsing the final path segment. Any query parameters or trailing slashes shall be stripped.

**FR-03** — The app shall validate that the extracted ID begins with the letter `S` followed by digits before making any API call. If the format is invalid, it shall display an inline error: "That doesn't look like a valid eBird checklist ID."

### eBird API
**FR-04** — The backend shall call `GET https://api.ebird.org/v2/product/checklist/view/{subId}` using the `EBIRD_API_KEY` from the environment, passed as the `X-eBirdApiToken` request header.

**FR-05** — From the eBird response the backend shall extract: `obsDt` (observation date and local start time), `loc.lat` and `loc.lng` (coordinates), and `durationHrs` (checklist duration in hours). If `durationHrs` is absent, default to `1`.

**FR-06** — If the eBird API returns a 404, the backend shall return an error response: "Checklist not found. Check the ID and try again."

### OpenWeather API
**FR-07** — The backend shall call the OpenWeather One Call API 3.0 timemachine endpoint: `GET https://api.openweathermap.org/data/3.0/onecall/timemachine` using `OPENWEATHER_API_KEY` from the environment.

**FR-08** — The backend shall make one API call per hour of checklist duration, using Unix timestamps for each hour starting at the checklist start time. For checklists under one hour, one call shall be made at the start time.

**FR-09** — Parameters for each OpenWeather call: `lat`, `lon`, `dt` (Unix timestamp), `appid`, `units=imperial`.

**FR-10** — From the hourly OpenWeather responses the backend shall derive:
- Temperature range: min and max `temp` across all hours, rounded to the nearest integer, in °F
- Humidity range: min and max `humidity` across all hours, as a percentage
- Dew point range: min and max `dew_point` across all hours, rounded to nearest integer, in °F
- Wind speed: the reading at the start time, converted to a plain-English Beaufort description (see FR-12)
- Wind direction: the cardinal direction at start time (N, NE, E, SE, S, SW, W, NW) derived from `wind_deg`
- Cloud cover: `clouds` percentage at start time
- Weather condition: `weather[0].description` at start time, title-cased
- Weather emoji: mapped from `weather[0].id` at start time (see FR-13)
- Sunrise: `sunrise` Unix timestamp, formatted as `h:mma` in the checklist's local timezone
- Sunset: `sunset` Unix timestamp, formatted as `h:mma` in the checklist's local timezone

**FR-11** — Local timezone shall be derived from the checklist's latitude and longitude using a timezone lookup. The backend shall not assume UTC.

**FR-12** — Wind speed (mph) shall be converted to plain-English descriptions using the Beaufort scale:

| mph | Description |
|---|---|
| 0–1 | Calm |
| 1–3 | Light air |
| 4–7 | Light breeze |
| 8–12 | Gentle breeze |
| 13–18 | Moderate breeze |
| 19–24 | Fresh breeze |
| 25–31 | Strong breeze |
| 32–38 | Near gale |
| 39+ | Gale |

If wind speed varies across hours, show the range of descriptions (e.g. "Light breeze - gentle breeze"). If all hours have the same description, show it once.

**FR-13** — Weather condition ID shall map to emoji as follows:

| OWM ID range | Emoji |
|---|---|
| 200–232 (Thunderstorm) | ⛈️ |
| 300–321 (Drizzle) | 🌦️ |
| 500–531 (Rain) | 🌧️ |
| 600–622 (Snow) | ❄️ |
| 700–781 (Atmosphere) | 🌫️ |
| 800 (Clear) | ☀️ |
| 801 (Few clouds) | 🌤️ |
| 802 (Scattered clouds) | ⛅ |
| 803 (Broken clouds) | 🌥️ |
| 804 (Overcast) | ☁️ |

### Output Format
**FR-14** — The formatted output shall match this exact structure, with a blank line between the emoji and the condition name:

```
[emoji]
[Condition, title-cased]
Temperature: [min] - [max]°F
Wind: [description]
Wind Direction: [cardinal]
Cloud Cover: [percent]%
Humidity: [min] - [max]%
Dew point: [min] - [max]°F
Sunrise: [time]
Sunset: [time]
Weather generated by SnowRaven
```

If min and max are equal for any range field, display the single value without a dash (e.g. `Temperature: 54°F`).

**FR-15** — The output shall be displayed in a monospace text area or pre-formatted block on the page.

### Copy to Clipboard
**FR-16** — A "Copy" button shall appear alongside the output. Clicking it shall copy the full formatted text to the clipboard using the Clipboard API.

**FR-17** — After a successful copy, the button label shall change to "Copied!" for 2 seconds, then revert to "Copy".

### Error Handling
**FR-18** — If `EBIRD_API_KEY` or `OPENWEATHER_API_KEY` is missing from the environment, the backend shall return a 500 with message: "API key not configured. Check your .env file."

**FR-19** — If any OpenWeather call fails, the backend shall return an error: "Weather data unavailable for this checklist's time and location."

**FR-20** — All errors shall be displayed inline on the page, below the input field. No alert dialogs.

---

## Non-Functional Requirements

**NFR-01 — Performance:** The full lookup (eBird call + OpenWeather calls) shall complete in under 10 seconds on a residential internet connection. The frontend shall show a loading indicator while the request is in flight.

**NFR-02 — Compatibility:** The app shall run without modification on Python 3.10+ and Node 20+ on both x86 and ARM (Raspberry Pi 4/5) hardware.

**NFR-03 — Security:** API keys shall never be exposed to the frontend. All external API calls shall be made server-side from the FastAPI backend.

**NFR-04 — Accessibility:** The input field shall have a visible label. Error messages shall be associated with the input via `aria-describedby`. The copy button shall have an accessible label.

---

## Out of Scope
- Checklist history or saved lookups
- User accounts or authentication
- Any output format other than the defined text block
- Multiple checklists in one request
- Weather providers other than OpenWeather
- Temperature units other than Fahrenheit
- A mobile app

---

## Open Questions

**OQ-01 — OpenWeather plan requirement:** The One Call API 3.0 timemachine endpoint requires a paid subscription (though usage up to 1,000 calls/day is free after adding a payment method). The user must activate One Call 3.0 at openweathermap.org/api. *Default assumption: user has or will activate One Call 3.0 before running the app. A setup note will be included in the README.*

**OQ-02 — Timezone library:** Deriving local timezone from lat/lng requires a timezone database. *Default assumption: use the `timezonefinder` Python library, which works offline and is Raspberry Pi compatible.*

**OQ-03 — eBird API rate limits:** The eBird API is free but rate-limited. *Default assumption: one request per lookup is well within limits for personal/small-group use.*

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | URL input parsing | Entering `https://ebird.org/checklist/S12345678` produces the same result as entering `S12345678` |
| QA-02 | Invalid ID validation | Entering `abc123` displays "That doesn't look like a valid eBird checklist ID" without making any API call |
| QA-03 | Successful lookup | Entering a real checklist ID returns a formatted weather block matching the FR-14 structure |
| QA-04 | Temperature range | A checklist spanning 2+ hours shows a temperature range (e.g. `54 - 56°F`); a one-reading checklist shows a single value |
| QA-05 | Wind description | Wind output uses plain-English Beaufort descriptions, not raw mph values |
| QA-06 | Copy button | Clicking "Copy" puts the exact text block on the clipboard; button reads "Copied!" for 2 seconds |
| QA-07 | Missing API key | Starting the backend with no `.env` and making a request returns the "API key not configured" error message on the page |
| QA-08 | Checklist not found | A non-existent checklist ID returns "Checklist not found. Check the ID and try again." |
| QA-09 | Loading state | A spinner or loading indicator is visible between submission and result |
| QA-10 | Attribution | The output always ends with "Weather generated by SnowRaven" |
