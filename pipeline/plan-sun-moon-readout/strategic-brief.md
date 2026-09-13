# Strategic Brief: Plan readout, sun track and moon phase

## What We're Building
The Weather tab's Predict entry becomes Plan, and the Planner's timeline gains three layers read from the plan already in hand: a tap or keyboard pick anywhere on the timeline shows the estimated tide and weather at that moment, a sun-position track sits beside the tide, and each day states its moon phase. No new provider, no new request.

## Why Now
The Planner shipped in 1.0.29 two days ago and the user's first live use produced exactly this list: a real user asking for the next layer on a surface they already use. Every ingredient is on the device already, so this is composition over data the app has paid for.

## The User Problem
The Planner answers "when are sunrise and sunset, and what is the tide doing then." Between those events the birder still guesses: the curve gives no figure at the minute they can actually reach the shore, and nothing says how low the sun sits or what the moon is doing. Reading a curve by eye, or opening Predict for one more moment, is the gap. "Predict" also no longer names what the form mostly does.

## Success Criteria
- The entry button reads Plan and the two actions read "Get specific forecast" and "See all upcoming weather and tide data" (the user's words; the Designer may tighten).
- Pressing anywhere on the timeline shows a fixed readout for that moment: local time, tide height and rising or falling, the weather in force with its hourly or daily label, and the sun's position. The readout says it is read from the plan, not a fresh lookup.
- The same pick works from the keyboard and assistive technology: the timeline is one tab stop, arrow keys step in time, Home and End jump to the ends, Escape clears, and the readout is announced. The Named Birds sightings strip (`NamedBirdTickList`, v1.0.21) is the house pattern; reuse it.
- A sun-position track runs beside the tide across the window and never shows a sunrise or sunset that disagrees with the listed one.
- Every day states its moon phase in the per-day list, in the glyphs the checklist weather blocks already write, hemisphere-mirrored the same way, with a text name a screen reader can read.
- A replayed plan offline behaves identically, including a plan stored by 1.0.29. A plan still costs one OpenWeather and at most two NOAA requests; a tap costs nothing.
- `docs/HELP.md`, `README.md` and `website/` say Plan where the app now does, swept at paragraph scope and held to the code by the published-claims guard.

## Scope
- The rename: entry button, its accessible name, both action labels, and every published sentence naming Predict (HELP four, README one, website two; `PRIVACY_POLICY.md` and `ACCESSIBILITY.md` none). Identifiers and replay keys do not change.
- The tap-anywhere readout, pointer and keyboard, estimated from the plan document: tide interpolated on the drawn curve (or the high/low curve for a subordinate station), trend by the existing next-turning-point rule, weather from the cell containing the moment.
- A sun-altitude track beside the tide, computed locally from latitude, longitude and time.
- Moon phase per day in the list; on the timeline too is the Designer's call.
- Docs, changelog, version bump and guard in the same change.

## Out of Scope
- Sun azimuth or backlight direction. Altitude is what light quality depends on and is what was asked for; direction is a later extension.
- Any new request, including a precise per-moment lookup from the readout. Get specific forecast remains the route to an exact moment.
- Ranking, scoring, recommended windows or highlighted events (carried from 1.0.29).
- Extending past the weather horizon, saving or comparing plans, a copy block, a hotspot-name picker (all still out).
- Changes to Current, the checklist lookup or the single-moment result beyond the two labels.

## Key Decisions
- **Moon phase is scoped back in on the user's direction.** 1.0.29 excluded it as a release-scoping choice, not a product principle; the reversal is conscious.
- **One moon vocabulary, one computation.** The phase comes from the app's existing ported algorithm (byte-golden across both runtimes), never the provider's daily field, so a plan and a checklist comment can never disagree; any text name sits on the same phase bounds.
- **Sunrise and sunset times stay sourced from the forecast.** The sun track is a local altitude curve anchored between them so the chart shows one sunrise and one sunset per day. 1.0.29's "no local sunrise calculation" holds in substance.
- **Estimates are stated as estimates.** A tapped minute reads an interpolated tide and a cell's weather; the readout claims no more than its source supports.
- **No new provider, no request per tap, offline parity.** Strategic constraints, not implementation details: disclosed network behaviour and the Planner's stated cost do not change.
- **Derive, do not store.** Sun altitude and moon phase follow from fields the document already carries, so a 1.0.29 plan gains them on replay and the replay budget is untouched. If the Architect adds fields, both transport twins owe parity.
- **The list stays the complete accessible form.** The readout is an addition; the chart's role moves from plain image to interactive control (Designer and Architect settle the semantics), and a tap must not fight the existing drag-to-scroll.
- **"See all upcoming" overclaims slightly** against an eight-day window; the Designer may tighten, but the entry reads Plan.
- **Alignment: aligned.** Same birder, same local-first posture, no new provider. Not Up Next item 1 (Windows code signing); fine and noted.
