# PRD — Color-Coded Hotspots
**Feature:** color-coded-hotspots
**Date:** 2026-08-24
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

Three opt-in color modes for the hotspot pins on the Map Explorer's Hotspots view: color each public hotspot by the user's own species count there, the user's own checklist count there, or recent community activity (species reported by anyone in the last week or last 30 days). The shipped visited / unvisited / personal coloring remains the default; the legend, popup, and "Hotspots in view" list carry the number driving each pin's color.

## User Stories

> **US-01** — As a birder deciding where to go next, I want hotspot pins colored by recent community activity over a last-week or last-30-days window, so the hotspots where birds are actually being seen stand out on the map without clicking through them one at a time.

> **US-02** — As a birder looking for my own coverage gaps, I want hotspot pins colored by how many species I have personally reported at each one, so thin and deep coverage read at a glance, entirely offline.

> **US-03** — As a birder tracking my effort, I want hotspot pins colored by how many checklists I have submitted at each one, so I can see where I bird often versus rarely, entirely offline.

> **US-04** — As an existing user who likes the current map, I want the visited / unvisited / personal coloring to remain the default with nothing changed until I opt in, so my current workflow is untouched.

> **US-05** — As a colorblind or low-vision user, I want the active mode's reading to be available without depending on hue alone — through a luminance-graded ramp, the legend, the popup, and the keyboard "Hotspots in view" list — so the coloring is not information I am locked out of.

> **US-06** — As a user who is offline, has no eBird key, or hits an eBird failure, I want the activity mode to say exactly what is wrong and still show previously fetched values where it honestly can, so I never mistake "couldn't ask" for "nothing happening."

## Functional Requirements

### Mode selection and default

> **FR-01** — The Hotspots panel shall offer a color-mode selector with exactly four options: the default visited-state coloring, "my species count" (mode 1), "my checklist count" (mode 2), and "recent community activity" (mode 3). Option labels and control form are the Designer's; the four meanings are fixed here.

> **FR-02** — The selector shall default to the visited-state coloring on every app launch. The selected mode (and mode 3's window) shall be session-only state: it survives switching tabs and returning within a session (tabs stay mounted) and resets on relaunch. It shall not be persisted through the storage seam.

> **FR-03** — With the default selected, all existing Hotspots-view behavior shall be unchanged: pin colors, glyphs, the visited / unvisited / personal legend and its hide/show filters, popups, click and keyboard interactions, and the hotspot fetch itself, exactly as shipped.

> **FR-04** — Color modes shall apply to the Hotspots view only. The selector shall not appear on My Sightings, Nearby Lifers, or Media Targets, and switching to another view shall render that view exactly as shipped.

### Modes 1 and 2 — personal counts (offline)

> **FR-05** — Mode 1's value for a hotspot shall be the number of distinct countable species the user has reported at that hotspot, computed offline from the already-loaded eBird backup, joined on the hotspot's eBird location id (`L\d+`). Countability follows the app's single form rule (`reportAs`-based, subspecies folded to species) — the same rule as the Map Explorer's county Species metric. The escapee provenance rule shall not apply (this surface does not headline a life-list count).

> **FR-06** — Mode 2's value for a hotspot shall be the number of distinct checklists (submission ids) the user has reported at that hotspot, computed offline from the loaded backup, joined on location id. All checklist types count (incidental and incomplete included).

> **FR-07** — Modes 1 and 2 (and the default) shall make no network calls beyond the existing hotspot fetch itself. Selecting, switching among, or leaving these modes shall trigger no request in any form.

> **FR-08** — In modes 1 and 2, a hotspot with no backup rows for its location id ("never birded by me" — by construction, the unvisited kind) shall render in an off-ramp no-data state, and a hotspot whose value is zero (visited, but zero species in mode 1) shall also render off-ramp; neither shall occupy the ramp's lowest band or be confusable with a low nonzero value. The pin-level distinction between "never birded" and "birded, value zero" may ride the existing kind glyph; the popup shall state which applies in words.

### Mode 3 — recent community activity (live)

> **FR-09** — Mode 3's value for a hotspot shall be the number of species reported by the eBird community at that hotspot within the selected time window, obtained from live eBird data using the user's own key, device-to-provider. The exact eBird product and call shape are the Architect's decision (Stage 3) within the bounds of FR-11 and FR-19.

> **FR-10** — Mode 3 shall offer exactly two time windows, labeled with the Map Explorer's shared Time Range vocabulary: "Week" (7 days) and "30 days". The "Day" rung of the shared vocabulary is deliberately not offered (a single day of community data is too sparse to be a stable basis for coloring, and the brief scopes the feature to week / 30 days). The window control shall be visible only while mode 3 is active, and shall default to "Week".

> **FR-11** — Mode 3 shall fetch activity data only for hotspots in the current result set. Fetching shall be bounded (a few requests at a time), deduplicated in flight, and cached; it shall never issue a regional bulk sweep, shall never be triggered by pan or zoom alone, and shall issue zero requests when the result set is empty or when a mode other than 3 is active. This follows the County Completeness (v0.5.54) bounded-fetch precedent.

> **FR-12** — Mode 3 coloring shall be progressive: each pin shall take its ramp class as its answer arrives; a pin whose answer has not yet arrived shall render in an "unanswered" state that cannot be read as a value; and while any pin in the result set is unanswered and requests are still running, the Hotspots panel shall show a visible loading indication. Cached answers shall render immediately, before any network activity.

> **FR-13** — In mode 3, a hotspot whose fetch succeeded with zero species in the window ("quiet") shall render in an off-ramp answered-zero state, distinct from the ramp's lowest band and distinct from the unanswered state. "No recent reports" is an answer; "not asked / couldn't ask" is not, and the two shall never share a reading.

> **FR-14** — When mode 3 cannot fetch, the panel shall show one of the app's three distinct honest states — offline, missing/invalid eBird key, or lookup error — using the Map Explorer's existing classified-error treatment. Pins whose answers already arrived (or are validly cached) shall keep their coloring; the rest shall remain unanswered. A retry affordance shall be available on every failure state without requiring the user to re-run the hotspot search.

> **FR-15** — Mode 3 results shall be cached so that: (a) re-selecting mode 3, re-running the same search, or revisiting the tab within the cache's freshness window recolors from cache with no refetch; (b) when offline or after a failure, previously fetched values still render, accompanied by an honest indication that they are cached rather than current; (c) errors are never cached; (d) exactly one caching layer owns these results (per the repo's one-caching-layer rule). Freshness TTL per Open Questions (default 6 hours).

> **FR-16** — Switching the mode 3 window (Week ↔ 30 days) shall recolor the pins for the new window and shall reuse cached or already-fetched data wherever it validly answers the new window; any additional fetching required shall follow the same bounds as FR-11 and FR-19. Reclassification of already-held data shall not require re-asking eBird when the mechanism's data can serve both windows.

> **FR-17** — Switching away from mode 3 while fetches are in flight shall stop further requests from being started; responses already in flight may complete into the cache but shall not alter the coloring of the now-active mode. Switching back shall reuse everything cached and resume only what is missing. A late response for a superseded window or an outdated result set shall never overwrite a newer answer or recolor a pin under a different mode.

> **FR-18** — Re-running the hotspot search (Search this area, Find, place-name search, Use my location, a dropped or dragged center pin, or a view-mode return) while a color mode is active shall keep the mode active and color the new result set by the same rules: modes 1 and 2 immediately, mode 3 from cache first and then by bounded fetch for the rest. The search itself shall behave exactly as shipped (including v0.5.91's no-reframe rule for Search this area).

> **FR-19** — Mode 3's total network cost per result set shall be capped. If the Architect's mechanism requires per-hotspot requests, at most a defined cap of hotspots shall be fetched per result set (default cap per Open Questions), prioritized by the hotspots currently in view and then by proximity to the search center; hotspots beyond the cap shall remain in the unanswered state and the panel shall say so in words. A mechanism that answers many hotspots per call is preferred and may make the cap unreachable in practice.

### Classification and the ramp

> **FR-20** — In every color mode, nonzero values shall be classed onto a data-driven quantile ramp computed over the nonzero values of the current result set in the active mode (the county-shading `computeCountyTiers` precedent), recomputed whenever the result set, the mode, or the mode 3 window changes. With fewer distinct nonzero values than classes, fewer classes shall render. The class count is settled by the Designer/Architect within NFR-01's constraints (default per Open Questions).

> **FR-21** — Personal-location pins shall keep their existing personal treatment in every mode and shall never join the ramp: mode 3 has no community data for a personal location, and keeping modes 1 and 2 consistent with it means one rule everywhere — color modes color public hotspots only. While a mode is active, the legend shall still carry the personal entry so the orange-star meaning stays explained. (Deliberate sharpening of the brief's flagged open point; visual treatment remains the Designer's.)

> **FR-22** — While a color mode is active, each pin's visited / unvisited distinction shall remain available through a non-color channel on the pin itself (the existing kind glyphs satisfy this; final treatment is the Designer's) and shall be stated in the popup. "An active hotspot I have never visited" must remain a readable combination in mode 3.

> **FR-23** — The legend's existing hide/show kind filters (visited, unvisited, personal) shall keep working while a color mode is active, hiding and revealing the same pins they do today.

### Legend, popup, and the in-view list

> **FR-24** — While a color mode is active, the legend content shall include: the active mode's name (and window, in mode 3), the ramp's classes with the value range each class covers (quantile break labels, as the county legend does), every off-ramp state in effect for that mode (no-data / zero / quiet / unanswered, as applicable) with its meaning in words, and the personal-pin entry. This content shall be reachable through the existing legend affordance at most one interaction away; whether activating a mode auto-reveals it is the Designer's call.

> **FR-25** — The hotspot popup shall surface the number driving the pin's color while a mode is active: the mode's label, the value, the window (mode 3), and the value's status in words where it is anything but current (cached with its as-of time, unanswered, failed, quiet, never birded, or zero). All existing popup content (name, visited state, hotspot link, coordinates actions) shall be retained.

> **FR-26** — The "Hotspots in view" list shall show each listed hotspot's active-mode value or off-ramp state alongside its name while a mode is active, so the full reading is available from the keyboard and without perceiving color. With the default selected, the list is unchanged.

### Coexistence with other map layers

> **FR-27** — The county and atlas overlays, including their mutual-exclusion rules, shall be untouched. A hotspot color mode may be active at the same time as either shading ramp; the hotspot ramp shall use a hue family distinct from the county green and atlas purple so pins remain distinguishable over either choropleth, and the hotspot color mode shall not participate in, or alter, the shading mutual exclusion or the basemap desaturation behavior.

## Non-Functional Requirements

> **NFR-01 — Accessibility (contrast):** The ramp and the off-ramp states get their own `--sr-*` token family, defined in both `:root` and `[data-theme="dark"]` before use, meeting the repo's non-text contrast posture for map pins (≥3:1 against the basemap land, matching the documented practice on the existing `--sr-map-pin-*` tokens) with adjacent ramp steps ≥1.2:1 apart (the county-ramp floor), guarded by a parse-the-tokens test in both themes (the `countyContrast.test.ts` pattern). No text rides the pin fill, so the stricter text-on-fill rule does not apply; if the Designer later puts a number on a pin, the ≥4.5:1 on-fill rule (Calendar precedent) applies instead.

> **NFR-02 — Accessibility (color-independence):** The ramp shall be monotonic in luminance so it reads in grayscale; the off-ramp states (no-data, zero/quiet, unanswered) shall be distinguishable from the ramp and from each other by more than hue; and every pin's value or state shall be readable without color via the popup (FR-25) and the "Hotspots in view" list (FR-26). This is the hotspot analogue of the Use Textures precedent; whether the pins themselves also carry a texture/shape cue is the Designer's.

> **NFR-03 — Theming:** GL pin colors read the `--sr-*` tokens at runtime and re-resolve on a `data-theme` change (the existing MutationObserver contract); a theme switch recolors mode pins without a reload. Sprite/image registration follows the repo's no-`isStyleLoaded`-gate contract.

> **NFR-04 — Performance:** Switching among the default, modes 1 and 2, and a fully-cached mode 3 recolors the pins with no network activity, no map remount, and no reframe of the viewport. Hotspot rendering stays on the GL layer path (no per-pin DOM) at real result-set sizes (hundreds of hotspots), with no perceptible new pan/zoom jank while a mode is active.

> **NFR-05 — Network etiquette (mode 3):** Bounded concurrency (the county pool-of-4 precedent), in-flight dedupe, errors never cached, no periodic or background refresh, and one caching layer owning the results (kept out of `CACHED_GET_PATHS` if a durable cache owns them). Requests carry only what eBird needs — never any personal data.

> **NFR-06 — Privacy:** eBird only, the user's own key, device-to-provider; no new providers, no telemetry, nothing collected. The release leg re-checks whether `PRIVACY_POLICY.md`'s eBird bullet must name the new call class (the brief's stated check).

> **NFR-07 — Phone tier:** The mode selector, window control, and retry affordance meet the ≤640 conventions: ~44px touch-target posture (`.sr-touch-target`), no sub-16px control font (`.sr-input-16` / `.sr-ctl-row`), layout responsive via lifted classes (never inline breakpoint styles), holding at 320px width and 200% in-app text scale.

> **NFR-08 — State model:** Mode and window are plain session-only `useState` (the repo's map view-toggle convention: Point Size, marker style, Use Textures). Any published prose about their lifetime uses the house phrasing "per-session, resetting on relaunch."

> **NFR-09 — Dual-transport parity:** Any new endpoint mode 3 requires ships on both transports (FastAPI route ↔ Tauri service) in lockstep, with parity tests on a shared fixture, twinned validation patterns per the repo's `[0-9]`/anchor rules, and SSRF-safe interpolation of any id into the outbound URL.

> **NFR-10 — Verification guards:** The token contrast test (NFR-01), a legend-cannot-drift-from-map parity (legend classes derive from the same classification source the layer paints from, per the county/calendar precedent), and a regression asserting the default mode's pin layer output is unchanged from the shipped behavior, all land with the feature.

## Out of Scope

- The other Map Explorer views (My Sightings, Nearby Lifers, Media Targets) and the Species Detail / Statistics / Named Birds maps.
- The county and atlas overlays — unchanged, including their mutual-exclusion rules and basemap desaturation.
- Any new data provider. Mode 3 is eBird only, with the user's own key.
- Ranking, recommendations, or any composite "best hotspot" score — the pins carry the numbers; the user makes the call.
- Per-species activity ("where is species X being seen") — Nearby Lifers / Media Targets territory.
- Bulk pre-fetching, background sweeps, or periodic auto-refresh of hotspots not in (or beyond) the current result set.
- Persisting the mode or window choice through the storage seam (session-only by decision, FR-02/NFR-08).
- Coloring personal-location pins by any mode (decided against, FR-21).
- Notable/rarity flagging, checklist-count or observer-count variants of mode 3 (species count only in v1).
- Changes to the hotspot fetch itself (`/map/hotspots` radius, caps, or result shape) beyond what the Architect needs for mode 3.

## Open Questions

1. **Mode 3 cache freshness TTL.** How long is a fetched activity value "fresh" (no refetch on revisit)?
   *Default if unanswered before Stage 5:* 6 hours fresh; stale values still render offline or on failure with an honest cached/as-of indication; the Architect may tune within 1–24 hours, never longer (activity data is time-sensitive; the county 30-day TTL is the wrong precedent here).

2. **Ramp class count.** How many quantile classes?
   *Default:* 5. Teardrop pins are far smaller than county polygons, so fewer, farther-apart classes beat the county overlay's 10; the Designer/Architect may adjust within NFR-01's adjacency and contrast floors.

3. **Per-result-set fetch cap for mode 3 (FR-19).** What is the cap if the mechanism is per-hotspot calls?
   *Default:* 200 hotspots per result set per window, in-view first, then nearest the search center; the remainder stay unanswered with the panel saying so. Moot if the Architect's mechanism answers many hotspots per call.

4. **One fetch serving both windows.** May a single 30-day fetch be filtered client-side to answer the Week window?
   *Default:* yes, if the mechanism returns per-species observation dates; otherwise per-window fetches under the same bounds.

5. **Escapee provenance in mode 1.** Confirmed excluded (FR-05)?
   *Default:* stands as written — the form-countability rule only, matching the county Species metric on the same map; applying the escapee rule here would extend its documented scope ("surfaces that headline a life-list count") without cause.

6. **Personal pins outside the ramps (FR-21).** Confirmed?
   *Default:* stands as written. If the user wants modes 1/2 to color personal locations too, that decision must arrive before Stage 5 and accepts mode 3 becoming inconsistent with them.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Mode selector exists (FR-01) | The Hotspots panel shows a selector with exactly four options matching FR-01's meanings; no other view shows it (FR-04). |
| QA-02 | Default and session lifetime (FR-02) | A fresh launch starts on visited-state coloring; a selected mode survives switching to another tab and back; a relaunch resets to the default; nothing mode-related is written through the storage seam. |
| QA-03 | Default is untouched (FR-03, NFR-10) | With the default selected, pin colors, glyphs, legend rows, kind filters, popups, and interactions are identical to the shipped build; the regression guard for the default layer output passes. |
| QA-04 | Mode 1 values (FR-05) | For a hotspot with known backup data, the popup's mode 1 value equals the distinct countable-species count for that location id (subspecies folded, non-countable forms excluded, escapees included), and matches a hand-computed value from the CSV. |
| QA-05 | Mode 2 values (FR-06) | For the same hotspot, the mode 2 value equals the distinct checklist count at that location id from the backup, incidental/incomplete included. |
| QA-06 | Modes 1/2 offline (FR-07) | With the network disabled after the hotspot fetch, selecting and switching among default, mode 1, and mode 2 issues zero requests (verified at the transport seam) and colors correctly. |
| QA-07 | No-data vs zero vs low (FR-08) | An unvisited hotspot renders off-ramp and visually distinct from the lowest nonzero band; its popup says the user has not birded it; a synthetic visited-zero-species case renders off-ramp with the popup stating a zero value. |
| QA-08 | Mode 3 value (FR-09) | For a hotspot with known recent eBird activity, the popup's mode 3 value equals the community species count for the selected window per the chosen eBird product, and the pin's class matches that value's quantile band. |
| QA-09 | Window control (FR-10) | Mode 3 shows exactly two window options labeled Week and 30 days, defaulting to Week; the control is absent in every other mode; no "Day" rung exists. |
| QA-10 | Bounded fetch scope (FR-11) | Requests go only to hotspots in the current result set; concurrent requests never exceed the bound; pan/zoom alone triggers zero requests; an empty result set triggers zero requests; no regional bulk call is ever issued. |
| QA-11 | Progressive coloring (FR-12) | With a throttled network, pins color one by one as answers arrive; unanswered pins show the unanswered state; the panel shows a loading indication until the last outstanding request resolves. |
| QA-12 | Quiet state (FR-13) | A hotspot fetched with zero species in the window renders in the answered-zero state, distinct from both the lowest ramp band and the unanswered state; its popup says no species were reported in the window. |
| QA-13 | Failure honesty (FR-14) | Offline, no-key, and server-error each produce their distinct classified message; already-answered pins keep their colors; a retry control appears and, on retry with the fault cleared, completes the remaining pins without re-running the hotspot search. |
| QA-14 | Mid-set failure (FR-14) | Killing the network mid-pass leaves arrived answers colored, the rest unanswered, an honest error state shown, and no cached error entries (a retry re-asks the failed hotspots). |
| QA-15 | Cache behavior (FR-15) | Within the TTL, re-selecting mode 3 or re-running the same search recolors with zero new requests; past the TTL online, values refetch; offline, cached values render with a visible cached/as-of indication. |
| QA-16 | Offline with cache (FR-15) | Going offline after a successful mode 3 pass and reloading the same result set shows the cached coloring plus the honest offline state for anything unanswered — never a blank or silently stale-as-fresh display. |
| QA-17 | Window switch (FR-16) | Switching Week ↔ 30 days recolors; where held data can answer the new window, zero new requests are issued; otherwise requests stay within FR-11/FR-19 bounds. |
| QA-18 | Mid-flight mode switch (FR-17) | Switching to mode 1 during a mode 3 pass starts no further requests and recolors instantly to mode 1; switching back reuses arrived answers and fetches only the remainder; a deliberately delayed stale response never recolors a pin under the wrong mode or window. |
| QA-19 | Re-search with mode active (FR-18) | Pressing Search this area with mode 3 active keeps the mode, colors cached hotspots immediately, fetches the rest within bounds, and does not reframe the map; modes 1/2 recolor the new set instantly. |
| QA-20 | Fetch cap (FR-19) | With a result set larger than the cap (if per-hotspot calls are the mechanism), requests stop at the cap, in-view hotspots were prioritized, the rest stay unanswered, and the panel states the limit in words. |
| QA-21 | Quantile classing (FR-20) | The class breaks equal `computeCountyTiers`-style quantiles over the current result set's nonzero values; changing mode or window recomputes them; a result set with two distinct nonzero values renders two classes without error. |
| QA-22 | Personal pins (FR-21) | Personal-location pins render their shipped treatment in all four modes, never a ramp class; the active-mode legend still contains the personal entry. |
| QA-23 | Visited distinction retained (FR-22) | In mode 3, a visited and an unvisited hotspot in the same ramp class are distinguishable on the pin without color perception, and each popup states its visited state. |
| QA-24 | Kind filters (FR-23) | Hiding a kind from the legend removes those pins while a color mode is active, and revealing restores them, identically to the default mode's behavior. |
| QA-25 | Legend content (FR-24) | With each mode active, the legend (at most one interaction away) shows the mode name, window where applicable, every rendered class with its value range, every off-ramp state in effect with wording, and the personal entry. |
| QA-26 | Popup content (FR-25) | In each mode, the popup shows mode label, value, window (mode 3), and status wording for cached/unanswered/failed/quiet/never-birded/zero cases, with all shipped popup content retained. |
| QA-27 | In-view list (FR-26) | The "Hotspots in view" list shows each row's active-mode value or state, operable entirely from the keyboard; with the default selected it is unchanged. |
| QA-28 | Overlay coexistence (FR-27) | County shading plus an active hotspot mode renders both; the shading mutual exclusion and basemap desaturation behave exactly as shipped; hotspot ramp pins remain distinguishable over the county green and atlas purple fills. |
| QA-29 | Token contrast guard (NFR-01) | The parse-the-tokens test asserts every ramp and state token exists in both theme blocks, meets ≥3:1 against the basemap land, and adjacent steps meet ≥1.2:1 — and fails when a token is weakened. |
| QA-30 | Color-independence (NFR-02) | The ramp is luminance-monotonic (verified in the token guard); a grayscale screenshot of the map still orders the classes; off-ramp states are distinguishable in grayscale; the popup and in-view list carry every value. |
| QA-31 | Theme re-resolve (NFR-03) | Toggling dark mode with a color mode active recolors the pins to the dark-theme tokens without a reload. |
| QA-32 | Performance (NFR-04) | Mode switches among default/1/2/cached-3 complete without network, remount, or reframe; a several-hundred-hotspot result set pans and zooms with a mode active without perceptible added jank; no per-pin DOM markers exist. |
| QA-33 | Phone tier (NFR-07) | At 320px and 200% text scale, the new controls meet touch-target and 16px-input posture, wrap without leaking page horizontal scroll, and remain operable. |
| QA-34 | Transport parity (NFR-09) | Any new endpoint's FastAPI and Tauri implementations pass a shared-fixture parity test, including malformed-id and non-ASCII-digit rejection rows. |

Every FR maps to at least one QA row: FR-01→QA-01, FR-02→QA-02, FR-03→QA-03, FR-04→QA-01, FR-05→QA-04, FR-06→QA-05, FR-07→QA-06, FR-08→QA-07, FR-09→QA-08, FR-10→QA-09, FR-11→QA-10, FR-12→QA-11, FR-13→QA-12, FR-14→QA-13/14, FR-15→QA-15/16, FR-16→QA-17, FR-17→QA-18, FR-18→QA-19, FR-19→QA-20, FR-20→QA-21, FR-21→QA-22, FR-22→QA-23, FR-23→QA-24, FR-24→QA-25, FR-25→QA-26, FR-26→QA-27, FR-27→QA-28.
