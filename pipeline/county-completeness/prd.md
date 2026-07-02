# PRD — County Completeness
**Feature:** county-completeness
**Date:** 2026-07-02
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

### Feature Overview
A third county-shading metric — Completeness — on the Map Explorer's existing county overlay: each US county is shaded by the user's countable species recorded there divided by the total species eBird reports for that county all-time, with the county popup extended to show a progress bar with counts and percentage, the user's most recent new-in-county species, and the top target species they haven't recorded there yet.

### User Stories

> **US-01** — As a county-listing birder, I want to switch the county shading to a Completeness metric, so that I can see at a glance which of my counties are near-complete and which are barely started.

> **US-02** — As a county-listing birder, I want to click a shaded county and see "X of Y species (Z%)" with a progress bar, so that I know exactly how my county list stacks up against everything ever reported there.

> **US-03** — As a birder planning where to bird next, I want each county popup to list top target species I haven't recorded there, so that I have a chase list one click from the map I already use.

> **US-04** — As a birder reviewing my own progress, I want the popup to show the last few species I newly added in that county, so that I can see my recent county-list momentum — even offline, since it comes from my own backup.

> **US-05** — As a birder visiting somewhere new, I want to click a county I've never birded and have its completeness and targets fetched on demand, so that I can scout an unfamiliar county without it costing a bulk fetch of the whole map.

> **US-06** — As a privacy-conscious offline user, I want the Completeness mode to say plainly when it needs my eBird key or a network connection — while counties I already fetched keep their shading from cache — so that the map never goes blank or lies about why data is missing.

### Functional Requirements

#### A. Shade control & metric integration

> **FR-01** — The app shall offer Completeness as a third option, alongside the existing Species and Checklists options, in the Map Explorer county shading metric switch. Map Explorer only; US counties only.

> **FR-02** — Completeness shading and metric selection shall be session-only state (reset on relaunch), matching the existing county-shade convention. No persistence of the shading choice.

> **FR-03** — Completeness shall participate in the existing shading mutual exclusion as county shading: enabling it clears atlas breeding shading and vice-versa, via the existing single cross-clearing rule (`nextShadingState`). Boundary lines may still coexist.

> **FR-04** — The Use Textures mode shall work unchanged with Completeness: the ten crosshatch density steps map to the ten Completeness bands exactly as they map to the ten count-metric tiers, and the legend swatches match the map.

> **FR-05** — While Completeness shading is active, the existing active-shade behaviors shall apply identically to the other county metrics: the heatmap re-orders under the county fill and dims, sighting pins fade, and the basemap desaturates; all restore when shading turns off. The county fill layer identity relied on by these behaviors shall not change.

> **FR-06** — Switching among Species, Checklists, and Completeness shall re-shade in place without a map reload, and the Species/Checklists behaviors (quantile shading, popups, legend) shall remain byte-for-byte unchanged from the shipped v0.5.53 behavior. The 10-class structure is reused, not changed — no class-count change is in scope.

#### B. Completeness computation

> **FR-07** — The numerator for a county shall be the count of distinct countable species from the loaded eBird backup recorded in that county: species-level normalized names with spuh, slash, and hybrid taxa excluded per the app's countable-species convention (`isNonCountableSpecies`).

> **FR-08** — The denominator for a county shall be the total number of species ever reported to eBird for that county's eBird region (subnational2), all-time, fetched device-to-provider with the user's own eBird key.

> **FR-09** — Numerator and denominator shall be taxonomically comparable: both sides shall count species-level taxa the same way, with spuh, slash, hybrid, and subspecies-level entries excluded or collapsed to species on the eBird side as well. A user species that does not match any species on the eBird county list shall still count in the displayed X (the user recorded it), but shall never push the displayed percentage above 100%.

> **FR-10** — Percentage display rules: the displayed percentage shall be 0% only when X = 0; 100% only when the county is fully complete (X ≥ Y with Y > 0); values between shall round to the nearest integer, except that a value that would round to 100% while incomplete displays 99% and a non-zero value that would round to 0% displays 1%. A computed ratio above 100% (data anomaly) displays as 100%, never more.

> **FR-11** — Completeness shading shall use ten fixed, equal-width percentage bands over 0–100% — (0,10] through (90,100] — not quantiles. Band assignment uses the true ratio, not the rounded display value. Any county with a non-zero completeness falls in band 1 at minimum (a 1%-complete county is visibly shaded); a 0% or unfetched county is unshaded.

> **FR-12** — All per-county completeness data shall be keyed by the app's existing (state, county) composite key; a name-only key shall never be used (same-named counties across states must not merge).

#### C. Data fetching & caching

> **FR-13** — Eager fetching shall be bounded to birded counties in the current viewport: while county shading is on with the Completeness metric selected, the app fetches eBird county data only for in-view counties where the user has at least one countable species. It shall never eagerly fetch for un-birded counties, for the full viewport-cap county set, or when a different metric is selected.

> **FR-14** — Un-birded counties shall keep rendering as plain outlines under Completeness. Clicking an un-birded county (while the Completeness metric is active) shall fetch that one county on demand and show its completeness ("0 of Y species (0%)") and targets in the popup. A fetched 0% county remains unshaded, preserving the "plain outline = never birded" read.

> **FR-15** — Per-county eBird results shall be cached with a generous staleness bound (default 30 days — see Open Questions) and reused across pans and for the rest of the session: revisiting a county whose cached result is within the bound shall make no new eBird call.

> **FR-16** — Concurrent or repeated requests for the same county shall be deduplicated into a single in-flight eBird call.

> **FR-17** — The app shall never bulk-prefetch county completeness data (no all-US, all-state, or full-viewport-cap sweeps) under any circumstances.

> **FR-18** — A county without a resolvable eBird region code (via the existing county→eBird-region derivation) shall render without completeness: it is excluded from fetching, never shaded by the Completeness metric, and its popup states plainly that eBird data is unavailable for this county — no guessed code, no broken link.

> **FR-19** — Every new backend route shall have full dual-transport parity: a Tauri TypeScript service twin with identical behavior, and its path prefix registered in the Vite dev proxy so the web-dev path reaches the backend.

#### D. Popup

> **FR-20** — While the Completeness metric is active, the county popup shall show a completeness block: a progress bar plus the text "X of Y species (Z%)", where X is the numerator (FR-07), Y the denominator (FR-08), and Z% follows FR-10. The X shown is the countable count and shall be labeled so it cannot be confused with the raw Species-metric count when the two differ.

> **FR-21** — The popup shall list the user's most recent new-in-county species: species whose first record in that county is most recent, newest first, up to the configured count (default 5 — see Open Questions), each with the date of that first county record. This list derives entirely from the loaded backup and shall work offline and without an eBird key.

> **FR-22** — The popup shall list top target species: countable species reported to eBird for the county but absent from the user's county list, up to the configured count (default 5 — see Open Questions). The intended ranking is by findability (frequency/recency of reports); an unranked slice of the county species list is the acceptable floor (see Open Questions). Spuh/slash/hybrid taxa shall never appear as targets.

> **FR-23** — Target and recent-species names shall render per the app's bird-name conventions: through the shared bird-name component with favicons (taxon codes resolved for the displayed set), with a Species Detail link only when the species is in the user's loaded backbone — targets not in the backbone render as plain name plus favicons, never a link.

> **FR-24** — When the local numerator exists but eBird data is unavailable (offline, no key, or fetch error), the popup shall still show the local X count and the recent-new-species list, with the denominator/percentage/targets area replaced by the appropriate honest state message (per FR-29–FR-31) — never a blank or missing section.

> **FR-25** — When eBird returns an empty species list for a county, or the list is unfetchable after retry, the popup shall show the available counts with an explanatory note and no percentage; the county is not shaded by Completeness (a cached prior result, if present and within the staleness bound, may still shade it). A subsequent click may retry a failed fetch.

> **FR-26** — In Completeness mode the popup keeps the existing county name, state, and shape-guarded eBird region link, and the completeness content replaces the metric-contextual top-3 list. In Species and Checklists modes the popup shall be unchanged from current behavior, with no completeness content and no completeness fetches.

#### E. Legend & counties-in-view

> **FR-27** — While Completeness is active, the legend shall read as a 0–100% scale: the ten band swatches (color, or density when Use Textures is on) labeled as percentage ranges, a metric title identifying Completeness, and an unshaded entry explaining that plain counties are never-birded or not yet fetched.

> **FR-28** — The keyboard-accessible "Counties in view" disclosure shall have full parity with the map under Completeness: for each listed county it presents the completeness value ("X of Y, Z%") when known, or its honest state ("not fetched", "no eBird data", or the applicable degraded state) when not.

#### F. Degraded states

> **FR-29** — With no eBird API key configured, selecting Completeness shall show the app's standard no-key state (distinct from offline and server-error), make no fetch attempts, and keep the map fully functional: counties with cached results still shade; uncached counties render as plain outlines.

> **FR-30** — While offline, Completeness shall show the app's standard offline state; cached counties still shade from cache; the popup's recent-new-species list still works; clicking an uncached county shows the offline state in the popup — never an indefinite spinner or a blank popup.

> **FR-31** — An eBird API error mid-view shall surface as the app's server-error state, distinct from offline and no-key. A failed county renders unshaded with an error state in its popup; already-shaded counties keep their shading; the failure is retryable (at minimum on a subsequent click) without a page or map reload.

> **FR-32** — For a user whose loaded backup contains zero US county records, Completeness shall remain selectable: all counties render as plain outlines and click-to-fetch works normally, so the mode is still usable for scouting.

> **FR-33** — Fetch-in-progress shall be visible: a pending indication in the popup while its county is being fetched, and counties shall shade progressively as eager-fetch results arrive. No permanently blank UI while a fetch is in flight.

> **FR-34** — The app shall disclose, at the point of use (in or adjacent to the county shade control when Completeness is selected), that this metric — unlike Species and Checklists — needs a network connection and an eBird API key.

#### G. Documentation & disclosure

> **FR-35** — `docs/HELP.md`, `README.md`, and the `website/` copy shall be updated in the same change to describe the Completeness metric, including its online/key requirement and the offline-from-cache behavior.

> **FR-36** — `PRIVACY_POLICY.md` shall be verified to already cover eBird region-level species-list calls (device-to-provider, user's own key); if it does not, it shall be updated in the same change. No new third-party provider may be introduced.

### Non-Functional Requirements

> **NFR-01 — Performance (fetch volume):** Total eager fetch volume shall be proportional to the user's birded counties in view, with a bounded number of concurrent eBird requests (exact bound is an Architect decision; never an unbounded burst). Panning within already-fetched counties shall trigger zero refetches within the staleness bound.

> **NFR-02 — Performance (entry chunk):** The entry chunk shall not grow: maplibre, the county boundary geometry, and all new Completeness code reachable only from the map stay off first paint (lazy/on-demand chunks). The existing entry-chunk guard test shall be extended to cover any new off-entry-chunk asset this feature adds.

> **NFR-03 — Performance (interactivity):** Completeness re-shading on pan/zoom shall come from in-memory/cached data and shall not degrade map pan/zoom responsiveness; per-move work is bounded by the existing viewport windowing.

> **NFR-04 — Accessibility (WCAG 2.1 AA):** All new controls carry explicit accessible names (`aria-label`; `aria-pressed` on segmented toggles); the progress bar exposes its value accessibly (an accessible role/value or an equivalent text rendering); the keyboard "Counties in view" route has full information parity (FR-28); popup content remains reachable per the existing overlay conventions.

> **NFR-05 — Accessibility (legend legibility):** Completeness band rendering satisfies the existing county color-ramp and texture-density guards in both themes (AA-checked tokens; monotonic, distinguishable density steps). Any new token goes into both `:root` and `[data-theme="dark"]` with AA verification.

> **NFR-06 — Privacy:** All new network calls are device-to-provider (eBird only), authenticated with the user's own key, on demand. No telemetry, no new providers, no developer-operated server. Verified against `PRIVACY_POLICY.md` (FR-36).

> **NFR-07 — Dual-transport parity:** Behavior is identical on desktop (Tauri) and web/Pi (FastAPI): same fetch semantics, same caching contract, same degraded states, with the backend route and TypeScript service twin kept in lockstep (FR-19).

> **NFR-08 — Offline honesty:** The three degraded states — offline, no-key, server-error — are distinct, honest, and use the app's standard messaging everywhere Completeness surfaces (control, popup, counties-in-view list). The mode never presents "no data" when the true cause is one of the three states.

> **NFR-09 — Security:** Every eBird region code or id is shape-validated before interpolation into any URL (and `encodeURIComponent`-wrapped in query strings); an unresolvable or malformed code renders plain text, never a styled broken link. All popup content, including eBird-sourced species names, renders as escaped JSX — no HTML-string popups.

> **NFR-10 — Theming:** All new colors use `var(--sr-*)` tokens in both themes; Completeness reuses the existing county fill tokens and texture sprites — no hardcoded fills.

### Out of Scope

- Non-US counties (the overlay is US-only; separate roadmap item).
- The per-species county choropleth ("where have I seen Acorn Woodpecker") — separate feature.
- County shading on the Species Detail and Statistics maps.
- Any new third-party provider or new API key (eBird only, already disclosed).
- Completeness for regions other than counties (states, hotspots).
- Historical/time-sliced completeness (year lists, month lists) — all-time only for v1.
- Persisting the shading choice across relaunch (session-only, matching convention).
- Changing the 10-class ramp structure, tokens, or texture sprites (reused as-is; no class-count change).
- A user-facing cache-management UI for completeness data (clear/refresh controls beyond natural staleness).
- Any background or scheduled refresh of cached county data.
- Exporting or sharing the targets list outside the popup.
- Changes to the Statistics tab's county/geo sections.

### Open Questions

> **OQ-01 — Targets ranking source.** Which eBird endpoint(s) best support ranking targets by findability (frequency/recency) is an Architect decision. **Default if unresolved before Stage 5:** an unranked slice of the county species list — species not on the user's county list, in the list's native (taxonomic) order — which the brief accepts as the floor.

> **OQ-02 — Recent-new-species count.** **Default: 5** most recent first-county-records.

> **OQ-03 — Targets count.** **Default: 5** target species per popup.

> **OQ-04 — Cache staleness bound.** County species lists change slowly. **Default: 30 days.**

> **OQ-05 — Cache persistence layer.** Transport cache vs. storage seam is the Architect's call. **Default:** persisted via the storage seam so offline-from-cache shading survives a relaunch; session-lifetime caching is the acceptable floor if persistence proves disproportionate, since the brief's offline criterion says previously fetched counties *may* still shade.

> **OQ-06 — Legend band display.** All ten percentage bands or a condensed set. **Default:** all ten, as equal 10-point ranges, matching the count-metric legend's ten rows.

> **OQ-07 — Eager-fetch concurrency bound.** **Default:** a small fixed bound (~4 concurrent requests); the Architect picks the exact number and mechanism.

### Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Metric switch offers Completeness (FR-01) | The Map Explorer county shading metric switch shows Species, Checklists, and Completeness; selecting Completeness re-shades the in-view counties by percentage bands. |
| QA-02 | Session-only state (FR-02) | After relaunch, county shading is off and the metric is at its default; no Completeness state persisted. |
| QA-03 | Atlas mutual exclusion (FR-03) | With Completeness shading on, enabling atlas breeding shading clears the county shading (and vice-versa); both boundary line sets can still show together. |
| QA-04 | Use Textures composition (FR-04) | With Use Textures on and Completeness active, crosshatch density follows the percentage bands and the legend swatches match the map rendering. |
| QA-05 | Active-shade behaviors (FR-05) | While Completeness shading is on: heatmap renders below the county fill and dims, sighting pins fade, basemap land desaturates; all restore when shading is turned off. |
| QA-06 | Metric round-trip (FR-06) | Switching Completeness → Species → Completeness re-shades in place with no map reload or crash; Species and Checklists shading, popups, and legend behave identically to v0.5.53. |
| QA-07 | Numerator correctness (FR-07, FR-12) | For a county with known backup contents, X equals the distinct countable species there; spuh/slash/hybrid rows do not count; two same-named counties in different states show independent values. |
| QA-08 | Denominator comparability (FR-08, FR-09) | Y equals the species-level count for the county's eBird region; subspecies/spuh/slash/hybrid entries on the eBird side do not inflate Y. |
| QA-09 | Percentage clamp (FR-09, FR-10) | A constructed X > Y case displays 100%, never more; an incomplete county rounding toward 100% shows 99%; a non-zero county rounding toward 0% shows 1%. |
| QA-10 | Fixed bands (FR-11) | A ~5%-complete county renders in band 1 and a ~95% county in band 10; a county with 1 of 300 species is visibly shaded, not plain. |
| QA-11 | Bounded eager fetch (FR-13, FR-17, NFR-01) | With N birded counties in view, at most N county fetches are issued; un-birded in-view counties trigger none; no fetch occurs in Species/Checklists mode; no all-US/bulk request ever appears in the network log. |
| QA-12 | Click-to-fetch (FR-14) | Clicking an un-birded county in Completeness mode issues exactly one fetch; the popup shows a pending state, then "0 of Y species (0%)" plus targets; the county remains a plain outline. |
| QA-13 | Cache reuse (FR-15, FR-16) | Panning away and back to a fetched county issues zero new eBird calls; two rapid clicks on the same county collapse to one in-flight request; a revisit within the staleness bound stays network-silent. |
| QA-14 | Unresolvable region code (FR-18) | A county with no derivable eBird region code is never fetched, never Completeness-shaded, shows an honest "no eBird data for this county" popup note, and renders no broken link. |
| QA-15 | Dual-transport parity (FR-19, NFR-07) | The same scenario (shade, click, degrade) behaves identically in the Tauri desktop app and the web dev path; the new route's prefix is proxied in `vite.config.ts` and a TypeScript service twin exists. |
| QA-16 | Popup completeness block (FR-20) | A fetched, birded county's popup shows a progress bar and "X of Y species (Z%)" with X labeled as the countable count. |
| QA-17 | Recent new species (FR-21) | The popup lists up to 5 species whose first county record is most recent, newest first, each with that first-record date — and this list renders offline with no eBird key. |
| QA-18 | Targets list (FR-22) | The popup lists up to 5 countable species on the eBird county list and absent from the user's county list; no spuh/slash/hybrid appears; no already-recorded species appears. |
| QA-19 | BirdName conventions (FR-23) | Target and recent names show favicons (taxon codes resolved); a target in the user's backbone links to Species Detail; a target not in the backbone renders plain name + favicons with no link. |
| QA-20 | Partial popup (FR-24) | Offline with local data, the popup still shows X and the recent-new-species list, with the honest offline message where Y/percentage/targets would be — no blank section. |
| QA-21 | Empty/unfetchable denominator (FR-25) | A county whose eBird list is empty or unfetchable shows counts plus an explanatory note, no percentage, and no Completeness shading; clicking again retries a failed fetch. |
| QA-22 | Other metrics untouched (FR-26) | In Species and Checklists modes the popup contains no completeness content and triggers no completeness fetches; in Completeness mode the name/state/region link remain and the contextual top-3 is replaced. |
| QA-23 | Percent legend (FR-27) | With Completeness active the legend shows ten band swatches labeled as percentage ranges with a Completeness title and an unshaded-entry explanation; in textures mode the swatches show the density steps. |
| QA-24 | Keyboard parity (FR-28, NFR-04) | The "Counties in view" disclosure is keyboard-reachable and shows per-county "X of Y, Z%" or the honest state ("not fetched" / "no eBird data" / degraded state) matching the map. |
| QA-25 | No-key state (FR-29) | With no eBird key, selecting Completeness shows the standard no-key message, issues zero fetches, keeps the map functional, and still shades cached counties. |
| QA-26 | Offline state (FR-30) | Offline, the standard offline message shows; cached counties shade; clicking an uncached county yields the offline state in the popup — no indefinite spinner, no blank popup. |
| QA-27 | Server-error state (FR-31) | A simulated eBird 5xx yields the server-error state, visibly distinct from offline and no-key; already-shaded counties keep shading; a retry (subsequent click) succeeds without reload. |
| QA-28 | Zero-county user (FR-32) | With a backup containing no US county records, Completeness is selectable, all counties render plain, and click-to-fetch works. |
| QA-29 | Pending visibility (FR-33) | During fetches, the clicked county's popup shows a pending indication and eagerly fetched counties shade progressively as results arrive. |
| QA-30 | Point-of-use disclosure (FR-34) | With Completeness selected, a cue in/adjacent to the shade control states the metric needs a network connection and an eBird API key. |
| QA-31 | Docs updated (FR-35, FR-36) | `docs/HELP.md`, `README.md`, and `website/` describe Completeness including the online/key requirement; `PRIVACY_POLICY.md` demonstrably covers eBird region species-list calls (updated in the same change if it did not). |
| QA-32 | Entry chunk unchanged (NFR-02) | A fresh `npm run build` shows no maplibre/county/completeness asset in the entry chunk or `dist/index.html` modulepreload; the extended entry-chunk guard test passes. |
| QA-33 | Map responsiveness (NFR-03) | Pan/zoom with Completeness shading active stays smooth; re-shading on move comes from cache with no synchronous refetch stalls. |
| QA-34 | AA + aria (NFR-04, NFR-05) | New controls have accessible names (`aria-pressed` where toggling); the progress bar's value is exposed accessibly; legend/popup text passes AA in both themes; the county contrast/texture guard tests pass. |
| QA-35 | Security (NFR-09) | A malformed region code renders plain text with no href; the eBird link is `encodeURIComponent`-wrapped; a hostile species/county name in popup content renders inert (escaped JSX, no markup execution). |
| QA-36 | Privacy (NFR-06) | Network inspection during a full Completeness session shows only eBird calls (plus existing disclosed providers), authenticated with the user's own key, device-to-provider — no new hosts, no telemetry. |
