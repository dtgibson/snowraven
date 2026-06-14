# Strategic Brief — Weather & Tide: Current & Predict

## What We're Building
Two buttons at the bottom of the Weather tab. **Current** fetches live weather and tide for the user's present time and location in one tap. **Predict** lets the user choose a place, date, and time and returns the forecast weather and tide for that single moment. Both show a readable at-a-glance summary, with the familiar copy-ready block still available.

## Why Now
SnowRaven's weather and tide lookup has only ever looked backward — historical conditions for a checklist already filed. But birders make forward decisions too: whether to head out now, when to plan a weekend trip, when a tide will expose a mudflat. Every data source needed (OpenWeather, NOAA tide stations, Nominatim geocoding, device location) is already wired into the app, so this answers those forward questions with no new providers and no change to the privacy promise. It's a small, natural extension of the feature that started SnowRaven.

## The User Problem
Deciding where and when to go birding, a user has no quick way inside SnowRaven to check current conditions where they are, or forecast conditions for a specific spot and time. They leave for a separate weather or tide service, or guess. *Current* answers "what's it like right now, here?" *Predict* answers "what will it be like at this place, at this time?"

## Success Criteria
- One tap on **Current** returns accurate live weather and tide for the user's actual location and the present moment, no manual entry.
- **Predict** returns weather and tide for a place and time the user chooses — a place-name search to get close, a map pin to fine-tune the exact spot.
- Tide is available as far ahead as the user picks; weather appears only within forecast range, with a clear, honest note when the chosen time is beyond it.
- The result reads at a glance and can still be copied as the familiar formatted block.
- A precise spot yields the nearest tide station *for that spot*, not a distant default.

## Scope
- A **Current** button: device-location, present-time weather and tide, one tap.
- A **Predict** button: place + date + time for a single chosen moment, returning forecast weather and tide.
- Location entry for Predict: place-name search plus a map pin to fine-tune, defaulting to the user's current location.
- Output: a readable on-screen summary plus the existing copy-ready weather/tide block.
- Horizon handling: tide as far as chosen; weather within range only, with a beyond-range note.
- Both buttons live at the bottom of the existing Weather tab.

## Out of Scope (v1)
- A multi-hour or multi-day forecast window or comparison view — single moment only, the likely next step.
- Saved or favorite locations.
- Alerts, notifications, or "good conditions" monitoring.
- Any "best time to go" ranking or recommendation.
- Changing the existing checklist-based historical lookup; this sits alongside it.

## Key Decisions
- Forward-looking, not backward — SnowRaven's first live/forecast feature. The existing lookup stays historical and checklist-based.
- The weather/tide forecast asymmetry is handled honestly: tide runs ahead freely, weather shows only where a real forecast exists, never faked or extrapolated past its range.
- Reuse existing seams and providers (OpenWeather, NOAA, Nominatim, device geolocation) — no new third parties, privacy posture unchanged.
- Dual output: glanceable summary first, copy-ready block retained.
- Predict targets a single moment in v1; a window/comparison view is explicitly deferred.
- Location precision is first-class, because the nearest tide station depends on the exact spot.
