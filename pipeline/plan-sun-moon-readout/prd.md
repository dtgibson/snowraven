# PRD: Plan readout, sun track and moon phase
**Feature:** plan-sun-moon-readout
**Date:** 2026-09-12
**Stage:** 2, The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
The Weather tab's Predict entry becomes Plan, and the Weather/tide Planner's timeline (shipped in 1.0.29) gains three layers derived from the plan document already on the device: a pointer or keyboard pick at any moment that fills a fixed readout with that moment's estimated local time, tide, weather and sun altitude; a sun-altitude track beside the tide, anchored to the forecast's listed sunrise and sunset; and each day's moon phase in the per-day list, from the same computation the checklist weather blocks already use. No new provider, no new request, and a plan stored by 1.0.29 gains all three on replay.

This PRD sits on top of `pipeline/tide-weather-planner/prd.md` and `design-spec.md`. Where a 1.0.29 behaviour is unchanged it is cited by that PRD's ID (as "1.0.29 FR-nn") rather than re-specified. Everything the 1.0.29 documents fix and this document does not name ships as it stands.

## User Stories
> **US-01** As a coastal birder who can only reach the shore at one particular time, I want to tap that moment on the plan's timeline and read the tide height, whether it is rising or falling, the weather and how high the sun sits, so that I stop guessing between the listed sunrises and sunsets or running one more lookup.

> **US-02** As a keyboard or screen-reader user, I want the timeline to be one tab stop where the arrow keys move me through time and each moment's figures are announced, so that the readout is mine too and not only a pointer feature.

> **US-03** As a birder who cares about light, I want to see the sun's altitude drawn across the window beside the tide, with sunrise and sunset exactly where the plan already lists them, so that I can see when the sun is low over a low tide without a second source.

> **US-04** As a birder who goes out at night, I want each day in the plan to state its moon phase in the same glyph and words a checklist comment would carry, so that the plan and my checklist comments never disagree.

> **US-05** As a birder with no connection, I want the plan I loaded earlier, including one loaded before this version, to show the readout, the sun track and the moon phase exactly as a fresh plan does, so that being offline costs me nothing.

> **US-06** As a first-time user of the Weather tab, I want the entry button to say Plan and the two actions inside to say which gives one exact moment and which gives the whole window, so that the names match what the form does.

## Functional Requirements

*The rename*

> **FR-01** The Weather tab's entry button that opens the place-and-time form shall read Plan, and its accessible name shall begin with the visible word Plan and describe what the form offers (default: "Plan weather and tide for a place"). The Current button, its label and its accessible name shall be unchanged.

> **FR-02** Inside the form, the single-moment action shall read "Get specific forecast" and the plan action shall read "See all upcoming weather and tide data". The Designer may tighten the second label (OQ-04) provided it still says the action covers weather and tide across the whole forecast window; the entry reading Plan is not negotiable. The caption under the plan action and the plan's closing note shall name the single-moment action by its new label wherever they named "Get forecast". The order and relative weight of the two actions are the Designer's (OQ-03).

> **FR-03** No other in-app words shall change. The single-moment loading status, result, pills, notices and error words, the Current flow, the checklist lookup and the copy-ready block shall be byte-identical to 1.0.29 (1.0.29 FR-53). The tide label Predicted is not the entry and stays. The form's field labels, placeholders and accessible names stay.

> **FR-04** Identifiers shall not change for the rename: no component, function, route, DOM id, CSS class, storage or settings key (including `planDaysInView`), replay-store key or stored document shape changes. A plan or a single-moment result stored by 1.0.29 shall replay under this version unchanged.

> **FR-05** `docs/HELP.md`, `README.md` and `website/index.html` shall name the entry Plan and the single-moment action Get specific forecast everywhere they named Predict and Get forecast, including HELP's subsection heading for the two lookups and HELP's sentence about the location-picker map in the Map Explorer section. The property that holds after the change: no published sentence in those three files names the Weather tab's entry or its form as Predict; the word Predicted as the tide label stays. The sweep is at paragraph scope and compares the three files against each other. Past `CHANGELOG.md` entries are history and are not rewritten. `PRIVACY_POLICY.md` and `ACCESSIBILITY.md` name neither label and need no rename edit. No em dash character in any of it.

> **FR-06** The existing Planner published-claims guard shall follow the rename (its HELP anchor is the renamed subsection heading) and shall hold the rename as a claim: each of the three passages names the entry Plan and none names it Predict, asserted non-vacuously per file.

*The pick and the readout (pointer)*

> **FR-07** On the plan timeline, a pick at any instant from the chart's axis start (the start of the current hour, 1.0.29 FR-07) through the window's end shall fill one readout for that instant with: (a) the local day and clock time in the location's timezone, in the user's date preference and the app's clock style; (b) the predicted tide height in feet relative to MLLW to one decimal place, and whether the tide is rising or falling; (c) the weather in force with its hourly or daily label; (d) the sun's altitude; and (e) a statement that the figures are read from the plan, not a fresh lookup. Instants are minute-resolved: a pointer pick rounds to the nearest minute, and every figure is computed for that minute.

> **FR-08** The tide at the picked instant shall follow the same rule as an event's tide (1.0.29 FR-13, FR-14, FR-19): linear between the two continuous samples around the instant where the station provides them and they are no more than 30 minutes apart, otherwise on the high/low curve between the bracketing turning points (a subordinate station, or a gap). Rising when the next turning point at or after the instant is a high, falling when it is a low; with no later turning point in the data, the existing "trend unknown" wording. A pick at the minute of a listed sunrise or sunset shall read exactly that event's listed height and trend. The high and low on either side are not required in the readout (the list carries them); the Designer may add them.

> **FR-09** The weather at the picked instant shall be the reading of the weather cell whose span contains the instant (the document's own cells, 1.0.29 FR-26), labeled with the shared hourly or daily words and, for a daily reading, the day's high and low. The strip's collapsed block cells at low density do not change which reading the readout shows: it is always the document's own cell. Where no cell contains the instant, the readout shall say the plan holds no weather reading for that moment (Designer's words) and still show the other parts. The readout shall carry at least the condition (glyph and description), the temperature, the wind (strength word and direction) and the label; humidity, dew point and cloud cover per OQ-05.

> **FR-10** For an instant after the forecast's hourly coverage ends, the weather part shall show that day's reading with the daily label; the tide and sun parts are unaffected, because the tide curve and the sun track cover the whole window at the same resolution throughout.

> **FR-11** When the plan has no tide (too far, outside the US, station unavailable, or the tide half failed at the transport), the readout shall omit the tide figures and say in one short phrase that no tide is in the plan (Designer's words), and shall still show the time, weather and sun. After the one-tap override fills the tide into the same plan, the same pick shall show the tide without being re-made. When tide is present but the instant has no height (no turning point in the data on either side), the tide part shall show the existing one-sided or no-bracket wording rather than a blank.

> **FR-12** The sun part shall state the altitude in whole degrees and whether the sun is above or below the horizon (at zero, on the horizon), read from the same anchored curve the track draws (FR-27), so a pick at a listed sunrise or sunset reads zero degrees.

> **FR-13** The estimate statement: on every pick the readout shall state that its figures are read from the plan and are estimates, not a fresh lookup. The Designer chooses the words; both facts are required. It may point to Get specific forecast as the route to an exact moment.

> **FR-14** A pick shall draw a visible marker at the picked instant on the chart across the plot's full height, distinguishable from the Now hairline and from every sunrise, sunset, high and low marker by shape or style as well as by color. The marker shall stay at its instant across scrolling, a Days in view change, a resize and a tier change, and shall survive the tide override; it shall be removed by Escape, by a new plan, and by anything that replaces the result. The pick is never persisted.

> **FR-15** Pointer rule. Mouse: a press and release on the timeline between which the pointer moved less than 5 CSS pixels (OQ-09) shall pick the instant under the press point; a press whose pointer moved that far or farther is a drag and shall scroll exactly as shipped in 1.0.29 (one to one from the first pixel, no threshold, no snapping, no post-release motion) and shall neither pick nor clear an existing pick. Touch and pen: a tap shall pick; a swipe or flick shall scroll natively and shall not pick; a pointer the platform cancels never picks. A press left of the axis start (the gutter) shall pick the axis start; every instant is clamped to the window.

> **FR-16** No pick, step, clear, marker, readout, sun-track render or moon computation shall make a network request of any kind or read a stored file. A plan's cost is unchanged (FR-43).

> **FR-17** The readout shall be one fixed block outside the chart's fixed-pixel box, at rem sizes so it follows the in-app text scale. Its height shall not change between its rest state and any pick (full, no tide, no weather); it is sized for the longest case at the current width and text scale. It shall render at rest together with the list before the chart chunk lands, and a pick shall never reflow the list, the legend or the chart box. At rest it shall state how to pick (Designer's words; default: "Tap or press the timeline, or focus it and use the arrow keys, to read the tide, weather and sun at any moment.").

> **FR-18** The per-day list shall be unchanged by a pick: no row is highlighted, selected, scrolled to or restyled, and no pick changes any list text. A pick can land between events; a highlighted row would misstate the pick as an event and read as emphasis of one moment over another.

*Keyboard and assistive technology*

> **FR-19** The timeline shall be exactly one tab stop however many days the plan holds; the readout and the pick marker add none; the Earlier day and Later day buttons and the Days in view control keep their own tab stops as shipped.

> **FR-20** While the timeline has focus: Left and Right shall move the pick 15 minutes earlier or later; Shift+Left and Shift+Right one hour; Page Down one day earlier and Page Up one day later (24 hours of real time, the ARIA slider convention for decrease and increase, so on a day that changes its clock the landing clock time differs by the hour gained or lost); Home shall pick the axis start and End the window's end; Escape shall clear the pick and is consumed only while a pick exists, so with nothing picked the press reaches any outer Escape layer; Enter and Space are unbound; every step clamps at the window's ends. The arrow keys therefore no longer scroll the box natively: they step the pick and the box follows (FR-22); drag, wheel, touch and the day buttons remain the routes to scroll without picking.

> **FR-21** With no pick, the first Right press (and Shift+Right, Page Up) shall pick the first 15-minute clock mark (hour mark, or 24 hours) at or after the plan's Now, its fetch instant; Left and its variants the last such mark at or before Now. Steps land on 15-minute clock marks in the location's clock: from a pointer pick at an unaligned minute the first step moves to the next mark in that direction (a pick at 6:07 steps Right to 6:15 and Left to 6:00). On a replayed plan Now is the stored fetch instant, and the same rule applies.

> **FR-22** A keyboard step that moves the marker outside the box's visible span shall scroll the box only as far as needed to show the marker, instantly under reduced motion; a pointer pick shall never scroll the box; no scroll shall be initiated after a drag; nothing snaps. (The 1.0.29 live look found a drag that re-snapped after every programmatic scroll; the keyboard step is the only programmatic scroll this feature adds and it never runs from a pointer path.)

> **FR-23** On every pick and step, assistive technology shall receive the readout's four figures (time, tide, weather, sun) exactly once, through the timeline control's own accessible name, value or active descendant rather than a live region, so nothing double-speaks; the estimate statement (FR-13) may be carried once in the control's name or description rather than on every change. The control's accessible name shall state the place, the window, that the arrow keys read any moment, and that the details are in the list, with the no-tide variant saying no tide is shown. The visible readout is hidden from assistive technology for the same reason the Named Birds readout is. The control's role is OQ-01.

> **FR-24** A pointer pick shall also focus the timeline (the global focus ring applies), so a screen reader hears the picked moment. A hover, if the Designer adds one (OQ-02), shall only preview: it never commits a pick, never moves the assistive-technology cursor, and never scrolls.

*The sun-altitude track*

> **FR-25** The chart shall draw a sun-altitude track across the whole window on the same time axis, present with and without tide, in both tiers, at every Days in view choice.

> **FR-26** The altitude shall be computed locally from the plan's latitude, longitude and instants by a standard solar-position calculation, with no request and no provider field. Whether the calculation is a small in-repo function or a dependency is the Architect's; a dependency is not required.

> **FR-27** Anchoring. On each day for which the forecast lists both a sunrise and a sunset, the track shall cross zero exactly at those listed instants, to the minute, shall be above zero between them and below zero from that sunset to the next listed sunrise; between the anchors its shape follows the computed altitude, and the day's peak is the computed maximum for that day within one degree. The track shall never show a sunrise or sunset that disagrees with the listed one. The forecast remains the sole source of sunrise and sunset times (1.0.29 FR-42 holds in substance); the readout's altitude (FR-12) reads from this anchored curve.

> **FR-28** Missing events. A day for which the forecast lists neither sunrise nor sunset shall draw the computed altitude unanchored (a polar day entirely above zero, a polar night entirely below). A day listing exactly one shall anchor that crossing and shall not cross zero elsewhere that day: the computed curve is held on the side the listed event implies, at zero where it would otherwise cross. The list's existing "No sunrise this day." and "No sunset this day." notes are unchanged. A day whose entry is malformed in a replayed document is treated as listing neither.

> **FR-29** The night bands stay exactly as 1.0.29 draws them. The track's zero crossings coincide with the band edges by construction, so the band and the track never disagree; the leading segment before the first event follows the same rule (above zero in a day segment, below in a night segment).

> **FR-30** The track shall be distinguishable from the tide curve by stroke style or fill, not by color alone; it shall be drawn beneath the tide curve and every marker so that no sunrise, sunset, high or low mark or label is obscured; the legend shall gain a Sun entry with the track's own swatch; and the gutter's tide scale is unchanged. A sun scale is the Designer's option; where none is drawn the track's zero is a stated reference in the legend or the readout.

> **FR-31** Every color of the track shall be a `--sr-*` token defined in both themes, at least 3:1 against both the day and the night band in both themes, and guarded in the existing plan contrast test.

> **FR-32** Any change to the chart's lanes or plot height for the track shall go through the geometry module's height derivation, so the fallback reserves the exact final height and nothing shifts when the lazy chunk lands, in both tiers, with and without tide. The without-tide plot may grow to hold the track.

> **FR-33** The track shall be bounded to at most one sample per 15 minutes across the window plus the anchor instants, never resampled with density, and drawn from the document only (its instants, latitude, longitude and days).

> **FR-34** The list shall carry the track's one figure that nothing else lists: each day states the sun's highest altitude that day in whole degrees with its local time, from the same anchored curve, so the list remains the complete form (1.0.29 FR-27). The Designer chooses the words and placement within the day's entry.

*Moon phase*

> **FR-35** Each day in the per-day list shall state its moon phase as a glyph and a text name.

> **FR-36** The phase shall come from the app's existing ported moon-phase algorithm, the one the checklist weather blocks use, with the glyph hemisphere-mirrored by the sign of the plan's latitude exactly as those blocks mirror it. It shall never come from OpenWeather's daily moon field: the plan document carries no provider moon value, and one present in a response is ignored.

> **FR-37** The moment the phase is computed for shall be local noon of that day in the location's clock (12:00; on a day that changes its clock, the instant the local clock reads 12:00), derived from the day's boundaries the document already carries.

> **FR-38** The text names shall sit on the same eight phase bounds as the glyphs: New moon, Waxing crescent, First quarter, Waxing gibbous, Full moon, Waning gibbous, Last quarter, Waning crescent. The name follows the phase and does not mirror; only the glyph mirrors by hemisphere. A screen reader shall hear the name; the glyph is presentational beside it.

> **FR-39** For every instant and latitude, the plan's glyph shall equal the glyph a checklist weather block computed for the same instant and latitude would carry: the same function, never a copy. A test shall sweep a lunar month in both hemispheres asserting the glyph and the name change at the same bounds, and shall check the fixture days' noon instants against the Python twin's moon function in the existing golden-oracle shape.

> **FR-40** Whether the timeline also shows the moon is the Designer's (OQ-06). If drawn, it uses the same computation and moment with identical treatment for every day; the list is the requirement. The readout need not carry the moon.

> **FR-41** The single-moment result's night moon glyph and the checklist weather blocks shall be byte-identical to 1.0.29.

*Offline replay, documents and request budget*

> **FR-42** A replayed plan shall behave identically to a fresh one for the readout, the track and the moon phase, including a plan stored by 1.0.29: all three derive from fields the document already carries (window, days with their sunrise and sunset, latitude, longitude, tide curve and turning points, weather cells) and nothing new is stored by default. If the Architect adds a field, both transport twins shall produce it identically over identical fixtures, a 1.0.29 document lacking it shall still render all three layers by deriving, and the stored plan shall stay under 300,000 code units (1.0.29 NFR-08).

> **FR-43** One plan fetch shall still make exactly one OpenWeather request and at most two NOAA requests; an override at most two NOAA requests; an interaction zero (FR-16). There is no request per pick, per day, per moment or per moon phase.

*No inference*

> **FR-44** The readout, the track and the moon phase shall present figures and shall infer nothing: no light-quality words (no golden hour, good light or best), no ranking, scoring, threshold, recommended window or highlighted moment; every instant and every day receives identical treatment, and the pick marker is the same for every instant (1.0.29 FR-50 extended).

*Documentation and records*

> **FR-45** `docs/HELP.md`, `README.md` and `website/index.html` shall describe the three additions in the same words inside the existing Weather/tide Planner passage, and carry the rename (FR-05). Each passage shall state these properties: that a tap or the arrow keys read the estimated tide, weather and sun at any moment, from the plan rather than a fresh lookup; that the sun's altitude is drawn across the window with sunrise and sunset where the plan lists them; that each day states its moon phase from the same computation as the checklist weather blocks; and that nothing is ranked or recommended. No component or file name, no count, no em dash character.

> **FR-46** The Planner published-claims guard shall gain a row per claim in FR-45, scoped to each file's own passage, asserting the passage exists before checking it, comparing the three files against each other, and mutation-verified in three directions (deletion, one file diverging, a re-wording that contradicts the code), restored byte-identical after each.

> **FR-47** The version shall be bumped by one patch in the four-file set (`frontend/package.json`, `src-tauri/tauri.conf.json`, the `website/index.html` version pill and footer, `CHANGELOG.md`) with a changelog entry naming the rename and the three additions.

> **FR-48** `PRIVACY_POLICY.md` shall be read against the change and left unchanged: no new request, no new provider, no new data leaves the device. `ACCESSIBILITY.md` per OQ-07; a sentence added there owes a guard row in the same change.

> **FR-49** `docs/HELP.md` remains the single source of in-app help, so the in-app help shows the renamed and extended text without a separate edit.

## Non-Functional Requirements

> **NFR-01, Accessibility:** WCAG 2.1 AA holds at 320px and at 200% in-app text scale in both themes. The timeline is one tab stop with a visible focus ring; the readout is text at rem sizes and wraps; every new button renders through the app's native Button primitive; every new state is conveyed by text or shape as well as color; the pick marker clears 3:1 against both bands; the page never scrolls sideways with a pick on screen; no DOM id, IDREF or selector target introduced here is keyed on data, only on an index.

> **NFR-02, Color and contrast:** every new color is a `--sr-*` token in both themes; the sun track and the pick marker each clear 3:1 against the day and the night band in both themes; the existing parse-the-tokens plan contrast test is extended to assert it.

> **NFR-03, Performance:** the chart and the chart library stay a lazy chunk; the existing entry-chunk assertions stay green, and the Architect states which new modules, if any, join the entry graph (the moon algorithm already rides it; the tide-at-instant rule lives in the entry-safe merge); the readout for one pick is a pure computation over the document that completes in under 16 ms for an eight-day plan on the reference desktop and re-renders neither the list nor the strip; the sun track is bounded per FR-33.

> **NFR-04, Parity:** the moon glyph at the fixture days' noon instants matches the Python twin (FR-39). If any field is added to the plan document, the desktop TypeScript and FastAPI builders remain byte-identical twins over the eight 1.0.29 fixture families.

> **NFR-05, Security posture:** per `.claude/rules/security.md`, no new outbound destination, no new route unless a field is added (and then range-validated with no caller value in a provider URL), no scan over untrusted text; the pointer's coordinates and the picked instant never leave the device.

> **NFR-06, Privacy:** nothing new is collected, sent or stored; `PRIVACY_POLICY.md` is unchanged (FR-48).

> **NFR-07, Resilience:** a replayed document with a malformed or missing day, sunrise, sunset, cell or curve degrades per part (the track skips or unanchors that day, the moon line is omitted for a day without boundaries, the readout says what is missing) and never throws or blanks the plan.

> **NFR-08, No regression:** the single-moment result, Current and the checklist lookup are byte-identical to 1.0.29 apart from the two labels; every existing frontend and backend suite stays green; the phone render golden is regenerated deliberately with its diff reviewed; `npm run build` passes before push.

> **NFR-09, Documentation parity:** the three published surfaces describe the Planner in the same words and the guard holds them to the code; no em dash appears in user-facing copy or the published prose; the rename sweep is recorded (what was checked against what).

> **NFR-10, Motion:** the keyboard scroll-into-view is instant under reduced motion; the pick marker and the readout have no animation; nothing about the 1.0.29 drag, wheel, touch or day-button motion changes.

## Out of Scope
Carried from the strategic brief:
- Sun azimuth, direction or backlight; altitude only.
- Any new request, including a precise per-moment lookup from the readout; Get specific forecast remains the route to an exact moment.
- Ranking, scoring, recommended windows, highlighted events or light-quality judgements.
- Extending past the weather horizon; saving, naming or comparing plans; a copy block; a hotspot-name picker.
- Changes to Current, the checklist lookup or the single-moment result beyond the two labels.

Added while writing this PRD:
- Renaming any identifier, route, storage key, replay key, DOM id or component for the rename (FR-04).
- Rewriting past changelog entries or the pipeline records for the rename.
- The moon phase in the readout, or a per-hour moon; one phase per day in the list is the requirement.
- Moonrise, moonset or the moon's altitude.
- Civil, nautical or astronomical twilight lines or words.
- A hover-driven readout as a requirement (OQ-02 leaves it to the Designer as a preview only).
- Highlighting or scrolling the per-day list on a pick (FR-18).
- Persisting a pick across plans, sessions or devices.
- A units toggle or metric altitude; degrees are unitless.
- Using OpenWeather's daily moon field for anything.
- Changing the Days in view control, the day buttons, the night bands, the strip or the tide curve beyond what the track needs to sit beside them.

## Open Questions
> **OQ-01, The timeline control's semantics (Designer and Architect).** The Named Birds strip is a listbox of discrete marks; the plan's axis is continuous and a pointer can pick any minute, so its role is not a one-to-one reuse. Default: the existing scroll container carries a horizontal slider role whose minimum and maximum are the window's ends, whose current value is the picked instant (or Now at rest) and whose value text is the readout's four figures, with the keyboard map of FR-20; the interaction contract (one tab stop, arrows, Home, End, Escape, a fixed aria-hidden readout, no live region) is the Named Birds contract reused as the brief asks.

> **OQ-02, Mouse hover preview (Designer).** Default: none; the pointer picks on press-and-release only. If added, it previews without committing (FR-24).

> **OQ-03, Order and weight of the two actions (Designer).** Default: unchanged, Get specific forecast primary above and the plan action secondary beneath, so the rename changes words and nothing else in the form's layout.

> **OQ-04, The second action's label (Designer).** Default: the user's words, "See all upcoming weather and tide data". A tightened form must still say the action covers weather and tide across the forecast window; the entry stays Plan.

> **OQ-05, Weather fields in the readout beyond condition, temperature, wind and the label (Designer).** Default: all six of the list's weather fields, wrapping inside the fixed block, with the block sized for that case.

> **OQ-06, Moon on the timeline (Designer).** Default: not drawn; the list is the requirement (FR-35).

> **OQ-07, A sentence in `ACCESSIBILITY.md` (Designer).** Default: yes, one sentence under the assistive-technology paragraph stating that the plan timeline is a single keyboard-operable control whose picked moment is announced and that the per-day list carries every figure, with a guard row in the Planner published-claims test in the same change.

> **OQ-08, Where the track sits (Designer).** Default: inside the existing plot on its own scale, its zero line at a fixed height the Designer chooses, the daylight portion above it, drawn beneath the tide and the markers, with the legend naming it; a lane of its own is acceptable provided FR-32 holds.

> **OQ-09, The pick-versus-drag threshold (Designer or Architect).** Default: 5 CSS pixels, measured as the pointer's total movement between press and release. Anything from 4 to 8 is acceptable; the drag itself keeps no threshold.

> **OQ-10, The readout's exact words (Designer).** Defaults: rest line as in FR-17; sun line "Sun {n}° above the horizon" / "below the horizon" / "on the horizon"; no-tide phrase "No tide in this plan"; no-weather phrase "No weather reading in the plan for this moment"; estimate line "Estimated from the plan, not a fresh lookup; for an exact moment use Get specific forecast."; moon line "{glyph} {Name}"; sun peak line "Sun highest at {time}, {n}° above the horizon".

## Success Metrics
| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Entry button (FR-01) | The Weather tab's entry button's visible text is "Plan"; its accessible name begins with "Plan"; the Current button's text and accessible name are byte-identical to 1.0.29. |
| QA-02 | Action labels and dependent copy (FR-02) | Inside the form the single-moment button reads "Get specific forecast" and the plan button reads the approved second label; the caption and the closing note contain "Get specific forecast" and not "Get forecast" as a label. |
| QA-03 | Nothing else changes in-app (FR-03, NFR-08) | Over the existing tests, the single-moment result, Current, the checklist lookup and the copy block produce output byte-identical to 1.0.29; the word Predicted still labels the tide. |
| QA-04 | Identifiers and stored documents (FR-04) | No test referencing a 1.0.29 identifier, route, DOM id, setting key or replay key needs renaming; a plan document and a single-moment result stored by 1.0.29 replay unchanged. |
| QA-05 | Published rename (FR-05) | In `docs/HELP.md`, `README.md` and `website/index.html`, no sentence names the entry or the form "Predict" and none says "Get forecast" as the action's label; HELP's subsection heading and its Map Explorer sentence say Plan; "Predicted" remains; past changelog entries are unchanged; no em dash in any touched paragraph. |
| QA-06 | Guard follows the rename (FR-06, FR-46) | The Planner published-claims guard is green after the rename; deleting the word Plan from any one passage, or re-inserting "Predict" as the entry's name in any one file, turns it red; each mutation is restored byte-identical. |
| QA-07 | Readout contents (FR-07) | A pointer pick at a fixture instant shows the local day and clock time in the location's timezone, the tide height to one decimal in ft with rising or falling, the weather with its label, the sun's altitude in whole degrees with above or below the horizon, and the estimate statement. |
| QA-08 | Tide rule at an instant (FR-08) | Over the reference-station fixture, a pick between two continuous samples reads their linear interpolation; over the subordinate-station fixture, a pick reads the high/low interpolation; a pick at a listed sunrise's minute reads exactly that item's height and trend; a pick past the last turning point reads the "trend unknown" wording. |
| QA-09 | Weather rule at an instant (FR-09) | A pick inside an hourly cell shows that cell's reading with the hourly label; a pick inside a daily cell shows that day's reading with the daily label and its high and low; with the strip collapsed to 3-hour blocks on the wide tier, a pick at 7:20 shows the 7 AM cell, not the block's 6 AM cell; a fixture with a cell gap shows the no-weather phrase and the other three parts. |
| QA-10 | Daily tail (FR-10) | A pick after the hourly coverage ends shows the daily-labeled reading while the tide and sun parts are populated exactly as for an earlier pick. |
| QA-11 | No-tide readout (FR-11) | With tide too far, outside the US or unavailable, a pick shows time, weather and sun and the no-tide phrase with no tide figures; after the override completes, the same pick (not re-made) shows the tide; with tide present and no bracketing turning points, the existing wording shows rather than a blank. |
| QA-12 | Sun in the readout (FR-12, FR-27) | A pick at a listed sunrise reads 0 degrees; a pick at that day's listed sunset reads 0 degrees; a pick at local noon reads a positive whole number equal to the track's peak within one degree; a pick at 2 AM reads a negative whole number "below the horizon". |
| QA-13 | Estimate statement (FR-13) | Every pick's readout contains the estimate statement; a fresh pick never triggers a network request. |
| QA-14 | Pick marker (FR-14) | A pick draws a full-plot-height marker at the instant; it differs from the Now hairline and from every other marker by shape or style; it stays at its instant after scrolling, after changing Days in view, after a resize and across the tier boundary; it survives the override; Escape, a new plan and replacing the result remove it; nothing is written to storage. |
| QA-15 | Pick versus drag (FR-15) | A mouse press and release with 2 px of movement picks the instant under the press point; a press with 12 px of movement scrolls the box by 12 px, picks nothing and leaves an earlier pick in place; a simulated tap picks and a simulated swipe (pointer cancelled) does not; a press in the gutter picks the axis start. |
| QA-16 | Zero requests per interaction (FR-16, FR-43) | With a request spy armed after the plan renders, 50 pointer picks, 50 keyboard steps, three Days in view changes and one Escape make zero network requests and zero storage reads; one plan still makes exactly one OpenWeather and at most two NOAA requests. |
| QA-17 | Fixed readout (FR-17) | The readout's rendered height is identical at rest, on a full pick, on a no-tide pick and on a no-weather pick at 320px, 390px and 1200px and at 100% and 200% text scale; the readout is present with the list before the chart chunk resolves; the list's and the chart box's bounding rects are unchanged by a pick. |
| QA-18 | List untouched by a pick (FR-18) | After any pick, the per-day list's DOM, classes and text are byte-identical to before the pick, and its scroll position is unchanged. |
| QA-19 | One tab stop (FR-19) | With an eight-day plan on screen, tabbing from the Days in view control reaches the timeline once and then the first day button; the readout and the marker are never focused; the tab-order coverage guard stays green. |
| QA-20 | Key map (FR-20) | From a pick at 6:15 AM: Right reads 6:30, Left reads 6:00, Shift+Right 7:15, Shift+Left 5:15, Page Up the same clock time next day (one hour off across a DST fixture), Page Down the previous day, Home the axis start, End the window's end; Escape clears and a second Escape is not consumed; Enter and Space change nothing; a step at the window's end stays at the end. |
| QA-21 | First step and alignment (FR-21) | With no pick and Now at 3:41 PM, Right reads 3:45 PM and Left reads 3:30 PM; from a pointer pick at 6:07 AM, Right reads 6:15 and Left 6:00; on a replayed plan the first step is taken from the stored fetch instant. |
| QA-22 | Scroll follows the keyboard only (FR-22) | A Right step whose marker leaves the visible span scrolls the box by the minimum needed and no further; a pointer pick never changes scrollLeft; after a drag no scroll is initiated; under reduced motion the scroll is instant; no snapping occurs. |
| QA-23 | Announcement (FR-23) | On each pick and step the control's accessible value text (or active descendant's name) contains the time, the tide figure and trend, the condition and temperature, and the sun altitude; there is no live region in the plan region; the control's name contains the place, the window and that details are in the list, and says no tide is shown when none is. |
| QA-24 | Pointer pick focuses (FR-24) | After a pointer pick the timeline is `document.activeElement` with the focus ring visible; with a hover preview present, hovering changes no committed pick and no accessible value. |
| QA-25 | Track present everywhere (FR-25) | The track renders with and without tide, on the phone tier and the wide tier, at each Days in view option. |
| QA-26 | Local computation (FR-26, FR-16) | Rendering the track makes zero requests; the computation reads only latitude, longitude and instants from the document. |
| QA-27 | Anchoring (FR-27) | For each fixture day with both events, the track's sampled sign changes from negative to positive at the listed sunrise minute and from positive to negative at the listed sunset minute, and at no other minute in the day; the day's maximum sample is within one degree of the locally computed maximum; the crossing minutes equal the listed event times exactly. |
| QA-28 | Missing events (FR-28) | Over the polar fixture, a day listing neither event has samples all on one side of zero; a day listing only a sunrise crosses zero exactly once, at that sunrise, and no sample later that day is below zero; a malformed day is treated as listing neither and the plan renders. |
| QA-29 | Bands and track agree (FR-29) | Every night band edge coincides with a track zero crossing; the leading segment's sign matches its band. |
| QA-30 | Track distinct and beneath (FR-30) | The track's stroke style or fill differs from the tide curve's; in the SVG order the track precedes the tide line and every marker; the legend contains a Sun entry with the track's swatch; the gutter's tide scale text is unchanged. |
| QA-31 | Track tokens and contrast (FR-31, NFR-02) | The track's colors are `--sr-*` tokens present in both theme blocks; the parse-the-tokens plan contrast test asserts at least 3:1 against day and night in both themes and is green; the same holds for the pick marker. |
| QA-32 | No layout shift (FR-32) | With the chart chunk withheld, the fallback's height equals the chart's rendered height in both tiers, with and without tide; the list's top edge does not move when the chunk resolves. |
| QA-33 | Bounded samples (FR-33) | The track's sample count over an eight-day window is at most the window's hours times four plus the number of anchor instants, and does not change with Days in view. |
| QA-34 | Sun peak in the list (FR-34) | Every day's list entry carries the sun's highest altitude in whole degrees and its local time; the figure equals the track's peak for that day and the time is within one sample of the track's maximum. |
| QA-35 | Moon in the list (FR-35, FR-38) | Every day's list entry carries one moon glyph from the eight-glyph set and one of the eight names; the name is exposed to assistive technology and the glyph is not read separately. |
| QA-36 | Moon source and moment (FR-36, FR-37, FR-39) | For each fixture day, the glyph equals the checklist block's moon function called with that day's local-noon instant and the plan's latitude; a southern-latitude fixture yields the mirrored glyph and the same name; the provider's daily moon field, set to a contradictory value in the fixture, changes nothing; the Python twin's moon function at the same instants returns the same glyphs. |
| QA-37 | Bounds sweep (FR-39) | A sweep at one-hour steps across one lunar month in both hemispheres shows the glyph and the name changing at the same instants, with exactly eight distinct pairs. |
| QA-38 | Single-moment moon unchanged (FR-41) | The single-moment result's night glyph and the checklist block outputs are byte-identical to 1.0.29 over the existing goldens. |
| QA-39 | Offline replay incl. 1.0.29 documents (FR-42) | A plan document captured from 1.0.29 replays offline with the readout, the track and the moon phase all functioning identically to a fresh plan; if a field was added, a document lacking it still renders all three, the twins are byte-identical over the fixtures, and the stored size stays under 300,000 code units. |
| QA-40 | No inference (FR-44) | The readout, legend, list and help copy contain none of "best", "good", "golden", "recommended" or ranking language; every pick marker is identical regardless of instant; every day's moon and sun lines use identical treatment. |
| QA-41 | Published claims (FR-45, FR-46, NFR-09) | Each of the three passages states the four properties in FR-45 in the same words; the extended guard goes red on deleting any one claim from one file, on one file diverging, and on a contradicting re-wording, and is restored byte-identical each time; no em dash in the passages. |
| QA-42 | Version set (FR-47) | All four files carry the same new patch version; the changelog entry names the rename, the readout, the sun track and the moon phase; the release-parity guard is green. |
| QA-43 | Privacy and accessibility statements (FR-48) | `PRIVACY_POLICY.md` is byte-identical to before the change; if `ACCESSIBILITY.md` gained a sentence, a guard row reads it and goes red when it is deleted. |
| QA-44 | In-app help (FR-49) | The in-app help renders the renamed subsection and the extended Planner paragraph from `docs/HELP.md` with no separate edit. |
| QA-45 | AA at 320px and 200% (NFR-01) | With a pick on screen at 320px and at 200% in-app text scale, `document.documentElement.scrollWidth` equals the viewport width, the readout wraps inside the region, the focus ring is visible on the timeline, and no id or IDREF added by the feature contains user data. |
| QA-46 | Performance of a pick (NFR-03) | Computing one readout over an eight-day fixture completes in under 16 ms on the reference desktop with no other build running; the entry-chunk guard is green with the modules the Architect named. |
| QA-47 | Resilience (NFR-07) | Rendering over the corrupted-shape fixtures (malformed day, missing sunrise, missing cells, empty curve) never throws, the plan renders, and each degraded part shows its stated fallback. |
| QA-48 | Reduced motion (NFR-10) | Under `prefers-reduced-motion: reduce` the keyboard scroll-into-view is instant and the marker and readout have no transition or animation. |
| QA-49 | Timeline moon, either way (FR-40) | If the Designer draws the moon on the timeline, each day carries exactly one glyph there equal to that day's list glyph, with identical treatment per day; if not, the chart contains no moon glyph. In both cases the readout carries no moon and the list carries every day's phase. |
