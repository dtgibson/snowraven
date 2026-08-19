# PRD — Search This Area
**Feature:** search-this-area
**Date:** 2026-08-16
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A labelled "Search this area" control on the Map Explorer's map surface, active
on the three centre-based views (Hotspots, Nearby Lifers, Media Targets). It
derives a search centre and radius from the current map viewport, adopts the
centre as the view's shared search centre (leaving the user's radius setting
alone), and re-runs that view's existing eBird search over the derived area in
one press without opening the Filters panel. It appears only when
a press would search ground the last search did not already cover, and the area
the search actually covered is drawn on the map.

---

## User Stories

> **US-01** — As a birder on Hotspots, I want to pan the map twenty miles up the
> coast and search there in one press, so that I do not have to leave the map to
> re-express a location I can already see.

> **US-02** — As a birder on a phone with the map fullscreen and the Filters
> overlay closed, I want that same one-press re-search on the map itself, so that
> the trip to the coordinate boxes never hides the view that prompted it.

> **US-03** — As a birder, I want to see what area a search covered, so that I
> can tell whether the pins on screen are the answer for what I am looking at.

> **US-04** — As a birder who has not moved the map, I want no control offering a
> search that would return the same answer, so that I do not spend eBird lookups
> on nothing.

> **US-05** — As a keyboard or screen-reader user, I want to reach the control,
> press it, and hear what the search found, without losing my place on the map.

> **US-06** — As a birder on Nearby Lifers or Media Targets, I want the same
> control in the same place to re-run *that* view's search, so that there is one
> thing to learn rather than three.

> **US-07** — As a birder whose search fails or finds nothing, I want to be told
> plainly which of the two happened, and to be able to try again.

---

## Revisions

> **R-01 — the press leaves the sidebar's Radius control alone.**
> *Raised and decided after the live preview, and after the QA and security
> passes had both completed against the original wording.*
>
> As originally written, FR-10 adopted **both** derived values into the sidebar:
> the coordinate boxes took the centre and the radius `SegControl` took the
> derived rung. Shown the built feature, the user was asked directly whether a
> press should also move their Radius setting, and chose to leave it alone. The
> Radius control is a setting they set deliberately, and a button on the map
> quietly overwriting it was not wanted.
>
> **What changed:** FR-10 now adopts the centre only. Nothing else moved. FR-11
> is unchanged in substance and the press still **sends** the derived covering
> radius; the derivation (FR-07 to FR-09), the record (FR-12), the suppression
> predicate (FR-13), and the drawn indicator (FR-17) are all untouched.
>
> **The named consequence, stated to the user and accepted in these terms:** the
> button searches the area you are looking at, but your Radius control keeps
> whatever you set, so the map and the sidebar can then disagree about what was
> last searched. Two concrete forms of that disagreement:
>
> - After a press, the drawn circle and the `SegControl` show different sizes.
>   The circle is the one reporting what was actually searched.
> - Leaving a centre view and returning re-runs that view's search from the
>   sidebar (shipped FR-15 behaviour, older than this feature), so the search is
>   re-issued at the **sidebar's** radius and the drawn circle follows it to that
>   smaller area. This is truthful rather than a defect — the ring reports the
>   most recent search — but it means a press is not sticky across a view
>   round-trip. It is pinned by a test so it stays a decision rather than a
>   surprise.
>
> **Requirements affected:** FR-10 (rewritten), FR-11 (rationale restated, no
> behaviour change), QA-14 (rewritten). Ids are unchanged. No other requirement,
> QA row, or open question is affected.

---

## Functional Requirements

Terminology used throughout:

- **Active view** — the current `ViewMode`, restricted here to `hotspots`,
  `targets`, or `lifers`.
- **Runnable** — the per-view precondition `applyCenter` already applies before
  it dispatches a search (`MapExplorer.tsx:1031-1041`): for `hotspots`,
  `hasEbirdKey !== false`; for `targets` and `lifers`, `hasEbirdKey !== false &&
  phase.tag === 'ready'`. The in-flight half of that condition is stated
  separately as FR-14.
- **Derived area** — everything a press derives from the viewport (FR-07 to
  FR-09): the centre, the radius, and the `capped` flag. The centre and the
  radius are what the press sends; `capped` describes the derivation only.
- **Search record** — the per-view `{ lat, lng, radiusMi }` triple defined by
  FR-12.
- **RUNGS** — the existing radius options, `[5, 10, 25, 50]` miles.

### A. The control

> **FR-01** — The app shall render a "Search this area" control on the Map
> Explorer's map surface when, and only when, all of the following hold: the
> active view is one of the three centre views; the map is mounted (`mapMounted`);
> the phone Filters overlay is closed (`!sidebarOpen`); the active view is
> runnable; no fetch for the active view is in flight; and the offer predicate
> (FR-13) is true. When any condition fails the control shall not be rendered,
> subject to the focus exception in FR-24.

> **FR-02** — There shall be exactly one such control. Activating it shall
> re-run the active view's existing search by the same code path a dropped centre
> pin uses (`applyCenter`), so that the three views can never diverge in what the
> press does. No second or per-view copy shall be introduced.

> **FR-03** — The control shall carry the visible text "Search this area" and an
> accessible name that names the search that will run:
> `hotspots` → "Search this area for hotspots";
> `targets` → "Search this area for recent sightings";
> `lifers` → "Search this area for nearby lifers".
> Each accessible name shall contain the visible text verbatim (WCAG 2.5.3), and
> all three shall be pairwise distinct from every other map control name in
> scope: "Center the map on my location", "Finding your location", "Copy the
> search center location", "Close the location popup", "Set a search center to
> copy its location", "Drop a pin at the map center", "Move the pin to the map
> center", "Enter fullscreen", "Exit fullscreen", "Open map filters".

> **FR-04** — The control shall be hidden while the phone Filters overlay is
> open, on the same gate the FAB cluster's interactive contents already use
> (`!sidebarOpen`), so that no map chrome floats over the overlay.

> **FR-05** — The search shall fire only from an explicit activation of the
> control (pointer, Enter, or Space). No pan, zoom, `moveend`, timer, debounce,
> or effect shall fire it. Moving the map shall issue no request to
> `/map/hotspots` or `/map/recent-obs` on either transport.

### B. Derivation

> **FR-06** — The viewport shall be read from the bounds the map already
> reports: `unpadBounds(mapBounds)` from `lib/markersInView.ts`, applied to the
> padded `MarkerBounds` that `BoundsTracker` pushes up on load and every
> `moveend`. The feature shall not add a second reading of `map.getBounds()` and
> shall not add a second `moveend` listener.

> **FR-07** — The derived centre shall be the arithmetic midpoint of the
> unpadded bounds: `lat = (minLat + maxLat) / 2`, `lng = (minLng + maxLng) / 2`.
> Both values shall be rounded to 5 decimal places before any further use, and
> the longitude shall be normalized into `[-180, 180]` so that a viewport
> straddling the antimeridian cannot produce a value the backend rejects
> (`/map/recent-obs` declares `lng: ge=-180, le=180`).

> **FR-08** — The derived radius shall **cover** the viewport rather than fit
> inside it. It shall be computed as the **maximum** great-circle distance in
> miles from the derived centre to the four corners of the unpadded bounds — the
> corners rather than the edge midpoints, because on a lat/lng rectangle the
> farthest point from the midpoint is always a corner — and then snapped **up**
> to the smallest member of RUNGS that holds it. It shall be measured from the
> **rounded** centre of FR-07, the one the request will actually carry, so that
> the covering claim is an exact statement about the request rather than one that
> holds to within a rounding error. Subject only to the cap in FR-09, every point
> in the viewport shall then lie within the searched radius of the searched
> centre. Because the radius is measured centre-to-corner, the **shape** of the
> viewport matters and not only its width: a wide desktop map and a tall phone
> one reach any given rung at different widths. Snapping onto RUNGS rather than
> sending a free number is what keeps the sidebar able to display what was sent
> (FR-10), so RUNGS shall be a single source of truth shared by the derivation
> and the sidebar's radius control rather than a second copy of the same ladder.

> **FR-09** — The derived radius shall be capped at a single named constant,
> `DERIVED_MAX_MI`, whose value is **25 miles** pending OQ-01. The cap shall be
> applied by **narrowing the ladder** to the rungs at or below it, not by clamping
> the snapped answer, so that the result is a member of RUNGS by construction
> rather than by coincidence: snapping and then clamping gives the identical
> number for today's constants and would silently start returning a non-rung the
> moment either changed — a size the sidebar has no name for, which would break
> this requirement's own promise that a press only ever sends a distance the user
> could have picked themselves. The derived path can therefore only ever send
> `dist` ∈ {8, 16, 40} km, whatever the viewport. Where the covering radius
> exceeds the cap the circle deliberately **under-covers** the viewport, and the
> derivation shall carry a `capped` flag saying so. That flag shall drive **no
> copy**: the case is carried entirely by the geometry FR-17 draws, and the flag
> exists so that a test can assert the cap fired (QA-19) without reaching for a
> sentence that does not exist. RUNGS itself shall not change, and the sidebar's
> radius control shall continue to offer all four options including 50 mi — the
> cap applies to the derived path alone.

> **FR-10** *(revised — see Revision R-01)* — On activation the derived
> **centre** shall be adopted as the view's shared search centre: the latitude
> and longitude fields shall show the rounded centre (5 decimal places, the
> format `applyCenter` already writes). The derived **radius shall NOT be written
> into the radius `SegControl`.** That control is the user's own setting and only
> the user shall change it; a press shall leave it exactly as it found it, on
> every view and however many times it is pressed.
>
> The consequence is deliberate and accepted: the radius a press **sends**
> (FR-11) and the radius the sidebar **shows** may differ, so the map and the
> sidebar can disagree about what was last searched. What resolves that for the
> user is FR-17's drawn circle, which reports the area actually covered. This is
> also why FR-08's snap onto RUNGS still matters: the derived radius is never
> displayed as a rung, but keeping it on the ladder means a press can only send a
> distance the user could have picked themselves, so the circle on the map is
> always a size the app has a name for.

> **FR-11** — The request issued by the press shall carry exactly the derived
> values: `lat` and `lng` rounded to 5 decimal places, and `dist` from the
> existing `Math.round(radius * 1.60934)` applied to the **derived** radius. The
> derived radius shall be passed to the fetch handler **explicitly**, as an
> optional `overrideRadius` parameter each handler prefers over the `radius` it
> closes over, selected by an explicit `!== undefined` test rather than a
> truthiness one. The explicit argument is **load-bearing, and more so under the
> revised FR-10**: the sidebar's `radius` now holds the user's own setting for
> the whole session, so it and the derived radius differ on essentially every
> press rather than for one tick. A handler reading `radius` off its own closure
> would therefore send the wrong distance *every* time, and the result would look
> entirely self-consistent from the sidebar. Passing it makes the value sent, the
> value recorded, and the value **drawn** provably one number. Every place the handler reads a radius shall read that same
> value, including the client-side personal-location filter, so that one circle
> is described throughout. Every existing caller shall omit the parameter and get
> the state value exactly as before (FR-27).

### C. Suppression

> **FR-12** — The app shall keep a per-view **search record** holding exactly
> the values that were sent: `{ lat, lng, radiusMi }`, where `lat` and `lng` are
> the rounded coordinates and `radiusMi` is the radius in miles that the request
> carried. `capped` shall **not** be part of it: that flag describes the
> derivation, not the request, and keeping it would make two searches that sent
> the same three values compare unequal on a field neither of them ever sent. The
> same shape shall also describe a press that has not happened yet — the derived
> centre carrying the derived radius — so that FR-13 compares whole payloads
> rather than a proxy for part of one. The record shall be session-only state and
> shall start empty for every view.

> **FR-13** — The **offer predicate** for the active view shall be the
> conjunction of two tests, taken over the record a press would write (`next`,
> per FR-12) and the record the view already holds (`record`):
>
> > **(a) The press would send something different.** True when the view has no
> > record; or when `next.radiusMi !== record.radiusMi` — **any** change of rung,
> > widening or narrowing, with no tolerance, since the derived radius is a rung
> > and a whole step is never noise; or else when
> > `distanceMiles(next, record) > record.radiusMi * MOVE_THRESHOLD_FRAC`, where
> > `MOVE_THRESHOLD_FRAC` is a single named constant whose value is **0.25**
> > pending OQ-02. The rung term is what makes **zooming** work: the centre can
> > sit still through a zoom while the covering radius crosses a rung boundary,
> > and that press really would fetch something the last one did not. The distance
> > term is what stops a metre of drift, a trackpad nudge, or a hand resting on a
> > phone from re-offering the control on a map the user considers stationary; its
> > tolerance shall scale by the **recorded** radius, and the two radii can differ
> > only when the rung term has already answered true, so this comparison is never
> > reached with a mismatched pair. The rung test shall be an **equality**, not
> > "is it bigger": the derived radius is not a preference the press inherits but
> > a fresh reading of the viewport, so a smaller one means the user zoomed *in*,
> > and whether that narrower search is worth offering is settled by (b) rather
> > than decided a second time here on less information.
>
> > **(b) Something on screen is unsearched.** True when the viewport is not
> > already inside the recorded circle: if every corner of the live viewport lies
> > within `record.radiusMi` of the recorded centre, the offer is withdrawn. This
> > is asked against the **record**, never the live midpoint, so it answers
> > whether the coverage the last search bought still holds over what is on screen
> > now. It shall reuse the same covering-radius computation FR-08 uses, so that
> > the radius a press sends and the coverage test that later withdraws the offer
> > can never disagree about what "covered" means.
>
> **Both conjuncts are load-bearing, and each covers a case the other gets
> wrong.** (a) is what keeps the **capped** case (FR-09) correct: past
> `DERIVED_MAX_MI` the circle is deliberately smaller than the viewport, so (b) is
> false and stays false however long the map sits still — the coverage test alone
> would offer the control permanently, on a map nobody has moved, with every press
> sending the identical centre and the identical capped radius for the identical
> answer. (b) is what gets the zoomed-**in** case right: zooming in drops a rung,
> so (a) answers true on its rung term, but the smaller circle a press would send
> is entirely inside the one already fetched and every pin on screen came back
> with it, so offering would spend a lookup to be told strictly less.
>
> Their **order is not load-bearing** and nothing shall be built on it: both are
> pure and total, so the conjunction agrees on every input either way, and the
> only thing order decides is which one short-circuiting skips. What is
> load-bearing is that both are **present**. Being a conjunction, (b) can only
> ever withdraw an offer (a) would make and can never create one, so FR-05's "no
> search without an explicit press" and the no-record case are untouched.

> **FR-14** — The control shall be suppressed while a fetch for the active view
> is in flight (`hotspotsLoading` / `targetsLoading` / `lifersLoading`), so that
> a second press cannot stack a second lookup on the first.

> **FR-15** — The search record shall be written by **every** successful search
> on a centre view, whatever route ran it: this control, the sidebar's Find
> button, the place-name search, "Use my location", a dropped or dragged centre
> pin, and the search a view-mode change fires. Otherwise the control would
> appear immediately after a sidebar search of the very area on screen.

> **FR-16** — A search that fails shall not write the search record. The control
> therefore returns as soon as the failed fetch settles, and retry is the same
> single press.

### D. The searched area

> **FR-17** — Whenever the active view holds a search record, the app shall draw
> the searched area on the map as a circle centred on `record.lat` /`record.lng`
> with radius `record.radiusMi`. It shall be legible on a phone with the sidebar
> closed. Its visual form (outline, shaded disc, dashed edge, label) is the
> Designer's decision; that it is present, correctly sized, and on the map rather
> than only in the sidebar is a requirement.

> **FR-18** — The indicator shall be drawn from the search record, never from
> the live viewport, so that panning after a search moves the map under a
> stationary circle. It shall not be interactive: it shall not become a click
> target and shall not change what `queryRenderedFeatures` returns for the
> sighting, hotspot, atlas, or county layers. (A MapLibre `fill` layer with
> `fill-opacity: 0` is still hit-tested, so a fill, if used, must be excluded
> from the existing click handlers.)

> **FR-19** — The indicator shall be per-view. Switching views shall show the
> incoming view's record or, if it has none, nothing. Switching to My Sightings
> shall show no indicator.

### E. Outcomes

> **FR-20** — A successful search shall announce its outcome through the live
> region defined in FR-25, naming the number of results the view will display:
> `hotspots` → "{N} hotspots found in this area." (singular "1 hotspot ...");
> `targets` → "{N} recent sightings found in this area.";
> `lifers` → "{N} locations with nearby lifers found in this area."

> **FR-21** — A search that succeeds with zero results shall write the search
> record (the area *was* searched), draw the indicator, and announce
> "No hotspots found in this area." / "No recent sightings of your target species
> found in this area." / "No nearby lifers found in this area." It shall not be
> presented as a failure.

> **FR-22** — A search that fails shall leave the existing per-view error
> surfaces exactly as they are today (`setHotspotsError` / `setTargetsError` /
> `setLifersError` rendering in the sidebar), and shall additionally announce
> that message through the FR-25 region, because on a phone the sidebar is not on
> screen. No press of this control shall write into the existing
> `.sr-map-geo-error` region, which is the location-failure announcer and whose
> container must hold nothing but its own message.

> **FR-23** — If the user pans or zooms while a fetch is in flight, the fetch
> shall not be cancelled and no re-search shall be triggered. Its result shall be
> applied normally and the search record shall be written with the values that
> were *sent*. The control shall then reappear if, and only if, FR-13 is true for
> the new viewport against that record.

### F. Focus and announcement

> **FR-24** — Activating the control shall not move focus off the map. Where the
> press causes FR-01's conditions to stop holding (the ordinary success case,
> since the record then matches the viewport) and the control holds DOM focus at
> that moment, the control shall remain in the DOM with `aria-disabled="true"`
> and an accessible name stating the state, for example "Search this area for
> hotspots. This area has already been searched." A press in that state shall be
> a no-op. It shall be removed once focus leaves it. A pointer press that never
> focused the control (the WKWebView case) may remove it immediately. The control
> shall never use the `disabled` attribute for this, which drops focus to
> `<body>`.

> **FR-25** — Search outcomes shall be announced through a live region that
> follows the house contract: `role="status"` with `aria-live="polite"`, rendered
> at all times and never hidden while idle, carrying a single child keyed by a
> sequence number that advances on every announcement including an identical
> repeat, and containing nothing but that message node so its `textContent` is
> exactly what is read. The sequence semantics shall live in their own pure,
> unit-testable module, on the pattern of `lib/geoErrorState.ts`.

### G. Parity and non-regression

> **FR-26** — Behaviour shall be identical on the desktop (Tauri) path and the
> web/Pi (FastAPI) path. The same viewport shall produce the same `lat`, `lng`,
> and `dist` on both. No new backend route, no new Tauri service function, and no
> new Tauri capability shall be added.

> **FR-27** — The sidebar's coordinate fields, radius control, place-name search,
> "Use my location", the centre pin drop and drag, and the search a view-mode
> change fires shall continue to behave exactly as they do today, apart from
> writing the search record (FR-15) and, for the radius control, showing the
> derived rung after a press of this control (FR-10). `handleFindHotspots`,
> `handleFindSightings`, and `handleFindLifers` shall keep their current
> behaviour for every existing caller. Where the three handlers and `applyCenter`
> gain the explicit derived radius (FR-11) and a `fromViewport` flag, both shall
> be optional and falsy or absent by default, and shall occupy the **third and
> fourth** parameter positions, so that the centre pin drop and drag — typed
> `(lat: number, lng: number) => void` and invoked with exactly two arguments —
> cannot reach either one, and keep both their existing radius and their existing
> results fit. Only this control's press shall pass them.

> **FR-28** — Nothing this feature derives shall be persisted. The search
> centre, radius, and search record are session-only, exactly like "Use my
> location" and the centre pin, and the saved map default shall not be written.

---

## Non-Functional Requirements

> **NFR-01 — Responsive:** The control and the indicator's legend or label, if
> any, shall hold at 320px viewport width and 200% in-app text scale with no
> horizontal page overflow and no clipped text. Verification shall measure the
> element's ink and box against its container's content box in a real browser;
> `document.scrollWidth` is not admissible evidence, and a co-located larger
> overflower can mask the element entirely.

> **NFR-02 — iOS safe area:** In fullscreen on iOS the control shall clear the
> status bar, Dynamic Island, and sensor housing in both rotations. The
> implementation shall name and assert the positioned ancestor its offsets
> resolve against. Note that the map area container
> (`<div style={{ flex: 1, position: 'relative' }}>` inside `.sr-map-content`) is
> an in-flow descendant of `.sr-map-fullscreen-panel`, so the panel's
> `.sr-ios-app` top/left/right padding already insets it; an absolutely
> positioned child anchored to the **top** therefore inherits that protection and
> must not add its own inset (which would double-inset), while one anchored to
> the **bottom** needs its own `.sr-ios-app`-gated inset the way
> `.sr-map-fab-cluster` does, because the panel deliberately omits
> `padding-bottom`. Any such rule shall be gated on `.sr-ios-app`, never a bare
> `env()`.

> **NFR-03 — Touch target:** The control shall meet the ~44px minimum in the
> ≤640 tier, via `.sr-touch-target` or an equivalent rule, and shall not shrink
> desktop density.

> **NFR-04 — Render purity:** No impure call (`Date.now()`, `new Date()`, or
> similar) shall appear in a render body, `useMemo`, or `useCallback`, per the
> enforced `react-hooks/purity` rule. The derivation is pure and needs no clock.

> **NFR-05 — Tokens and contrast:** Every colour shall come from a `var(--sr-*)`
> token. Any text on the control shall clear WCAG AA (4.5:1) in both themes
> against its own fill. If the indicator is a GL layer, its paint shall resolve
> tokens at runtime and re-resolve on a `data-theme` change via the existing
> `MutationObserver` contract, or use the sanctioned basemap-anchored literal
> exception for a boundary line and say so.

> **NFR-06 — Layout by class:** Positioning, display, wrapping, and gap shall
> live in `globals.css` classes, not React inline styles, so media queries and
> the `.sr-ios-app` gate can reach them. Colours, padding, and borders may stay
> inline as tokens.

> **NFR-07 — GL layer ordering:** If the indicator is a GL layer it shall be
> inserted below the marker layers (`beforeId`) so that pins stay on top,
> matching `AtlasLayer` and `CountyLayer`.

> **NFR-08 — No new surface area:** No new dependency, tile or data provider,
> endpoint, telemetry, account, or persisted setting. `PRIVACY_POLICY.md` is
> unchanged, and the feature stays device-to-provider on the user's own key.

> **NFR-09 — Bundle:** Nothing added here shall become statically reachable from
> `App.tsx`'s import graph; the Map Explorer and its map dependencies remain
> lazy. `entryChunk.test.ts` shall stay green.

> **NFR-10 — Pure derivation module:** Bounds to centre, the covering-radius
> computation, the snap up the RUNGS ladder and its cap, and both conjuncts of
> the offer predicate (FR-13) shall live in a pure module with no map instance and
> no React, so each is unit-testable in isolation.

> **NFR-11 — No viewport JS:** No `window.innerWidth`, `resize` listener, or
> width arithmetic. The CSS tiers and the existing bounds reporting are
> sufficient.

> **NFR-12 — Live-region guard:** A stylesheet test shall assert that no rule
> whose subject is the new live region sets `display`, `visibility`, or
> `content-visibility` to a hiding value, and shall assert a positive `display`
> so it cannot pass vacuously if the rule is deleted. This mirrors the guard that
> already protects `.sr-map-geo-error`.

> **NFR-13 — Performance:** The derivation shall be O(1) and synchronous, adding
> no work to `moveend` beyond reading bounds the app already reports. Panning and
> zooming shall not become measurably slower.

---

## Out of Scope

Carried from the strategic brief:

- **My Sightings.** It renders loaded data with no live search and no centre.
- **A drawn or freehand region.** The endpoints take a point and a radius only.
- **Automatic search on pan or zoom, in any form, including a debounced one.**
- **Any change to the county, atlas, or shading overlays.**
- **Persisting the derived centre or radius as the saved map default.**
- **A new tile provider, endpoint, or third party.**
- **Widening the radius rungs or changing what the sidebar radius control
  offers.** RUNGS stays `[5, 10, 25, 50]`.

Added while writing this PRD:

- **Changing the miles-to-kilometres conversion, or adding a clamp to
  `/map/hotspots`, `/map/recent-obs`, or `lib/tauri/mapService.ts`.** Nothing
  clamps the radius anywhere; FR-09 bounds the value this feature can derive
  before it ever reaches the conversion, and every other route to a search sends
  exactly what it sends today.
- **Fixing `applyCenter`'s unrounded pass-through.** It writes the rounded centre
  to state (`latNum.toFixed(5)`) but passes the *unrounded* number to the
  handler, so a pin drop currently misses the backend's `(lat, lng, dist)` cache
  key while the desktop path coalesces it in `getRecentObs`. Observed, flagged,
  not changed here.
- **Reconciling the Media Targets gate inconsistency.** The view-mode switch
  guards on `targetsFetchDisabled` while `applyCenter` guards on a weaker
  condition. This feature adopts `applyCenter`'s condition so its behaviour
  matches the pin drop exactly, and leaves the discrepancy alone.
- **Cancelling an in-flight fetch.** No `AbortController`; FR-23 specifies
  let-it-finish.
- **A fourth FAB, or any change to the FAB cluster's contents, geometry, or
  measured slack.**
- **Any change to the loading chip or to the `.sr-map-geo-error` region.**
- **An indicator for searches that ran before this feature existed in a session.**
  A view with no search record shows nothing.

---

## Open Questions

**OQ-01 — Does eBird honour `dist` above its documented 50 km ceiling?**
The app converts miles to kilometres, so the existing 50 mi rung already sends
`dist=80`. eBird documents 50 km as the maximum for `ref/hotspot/geo` and
`data/obs/geo/recent`. Nothing clamps it: `backend/routers/map.py` allows
`le=200` and `lib/tauri/mapService.ts` interpolates the value directly. Whether
eBird clamps, errors, or silently truncates is not established anywhere in this
repo. It matters here because a zoomed-out viewport can derive a large rung, and
a derived 50 mi rung would be a value the user never chose, on a circle FR-17
draws claiming coverage.

*Default assumption:* cap the **derived** radius at `DERIVED_MAX_MI = 25` mi,
which is 40 km and comfortably inside the documented ceiling, and leave the
sidebar's own 50 mi rung exactly as it ships. That is what FR-09 specifies, and
it is why the derived path can only ever send `dist` ∈ {8, 16, 40}. The reasoning
is honesty rather than exposure: a user who picks 50 mi in the sidebar is making
their own request, unchanged by this feature, while a user who presses this
control is handed a number they never chose, so it has to be one this feature can
vouch for.

*Conditions for lifting it:* measure eBird's actual behaviour above 50 km. If it
honours the request, `DERIVED_MAX_MI` becomes 50 and the derived path gains the
top rung; if it clamps, the app-wide 50 mi rung is the thing to revisit rather
than this constant. Either way it is a one-constant change. The question about
the sidebar's own 50 mi rung — which sends `dist=80` today and did so before this
feature — is pre-existing and out of scope here.

**OQ-02 — Is 0.25 the right value for `MOVE_THRESHOLD_FRAC`?**
FR-13(a) needs a number for "far enough to matter". It is a threshold on the bare
distance the **centre** has moved, scaled by the **recorded** radius: 1.25 miles
after a 5 mile search, 6.25 miles after a 25 mile one. Nothing about the size of
the circle a press would send enters it — whenever the two radii differ, the rung
term of FR-13(a) has already answered true and this comparison is never reached.

*Default assumption:* ship 0.25 as a single named constant. It is trivially
tunable, and QA-11/QA-12 pin the behaviour on both sides of whatever value ships
rather than the value itself. Scaling by the searched radius rather than using a
fixed distance is deliberate: a fixed 2.5 mile threshold would be half of a 5
mile search and a rounding error in a 25 mile one, and the same pan cannot mean
the same thing at both ends.

**OQ-03 — Where on the map does the control sit, and what shape does the
indicator take?**
Both are the Designer's calls. One input worth carrying: the "Finding hotspots…"
loading chip occupies the top-centre of the map area, and FR-14 suppresses this
control exactly while that chip is on screen, so the two are mutually exclusive
by construction and could share that position.

*Default assumption:* top-centre of the map area, in the chip's slot, as a
labelled pill; indicator drawn as a non-interactive outlined circle.

**OQ-04 — Should the retained, already-searched state (FR-24) be visible to
pointer users too, rather than only to a keyboard user who happens to hold
focus?**
FR-24 as written is the minimum that satisfies "pressing it does not move focus
off the map". A permanently mounted control that merely disables itself would be
simpler and more predictable, but contradicts the brief's "an idle map offers
nothing to press".

*Default assumption:* hide by default, retain only while focused, as FR-24
specifies.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01 presence gate | On each of the three centre views, with the map mounted, Filters closed, the view runnable, no fetch in flight, and FR-13's offer predicate true, the control is in the DOM. Setting each of those six conditions false in turn removes it (subject to QA-24). |
| QA-02 | FR-01 / FR-19 view scope | On My Sightings the control is never rendered, at any viewport, in any state. |
| QA-03 | FR-02 one control, correct dispatch | Exactly one matching control exists in the DOM at any time. Pressing it on Hotspots calls the hotspots fetch and neither other; likewise for Media Targets and Nearby Lifers. |
| QA-04 | FR-03 accessible name | `getByRole('button', { name })` resolves each of the three per-view names; each contains the string "Search this area"; the set of all map control accessible names in scope contains no duplicates. |
| QA-05 | FR-04 Filters overlay gate | With `sidebarOpen` true the control is absent; closing the overlay returns it. |
| QA-06 | FR-05 no automatic search | Panning and zooming the map 20 times with the control rendered issues zero calls to `/map/hotspots` and `/map/recent-obs` on both transports. No timer or debounce is armed. |
| QA-07 | FR-06 viewport source | The derivation consumes `unpadBounds(mapBounds)`. The component registers no additional `moveend` listener and makes no direct `map.getBounds()` call beyond `BoundsTracker`'s. |
| QA-08 | FR-07 centre + FR-08 covering radius | For a table of bounds fixtures spanning shapes rather than sizes alone — tall, wide, equatorial, high-latitude, southern, antimeridian — the derived centre equals the midpoint rounded to 5 dp, the derived radius is the smallest rung at or above the maximum corner distance, and all four corners lie within the derived radius of the derived centre for every uncapped fixture. A derivation that always returned the top rung passes the corner loop and fails the smallest-rung assertion. Zooming about an unmoved centre returns the same centre every time while the radius steps up the ladder. |
| QA-09 | FR-07 antimeridian | For bounds straddling ±180 (for example `minLng = 179.0`, `maxLng = 181.0`) the derived longitude is inside `[-180, 180]`, and the request is accepted by the backend's `lng` constraint rather than returning 422. |
| QA-10 | FR-09 cap | A viewport whose covering radius exceeds `DERIVED_MAX_MI` derives exactly 25 mi and sets `capped`; the value returned is a member of RUNGS at every input, and the ladder is narrowed rather than the answer clamped. A press on a viewport spanning most of a state sends `dist=40` and never `dist=80`. The sidebar's radius control still offers all four rungs, and the 50 mi option still works from the sidebar. |
| QA-11 | FR-13 suppression, unmoved | Immediately after a successful press the control is not offered. Panning by 1.0 mi after a 5 mi search leaves it not offered (1.0 ≤ 0.25 × 5), and the boundary sits exactly at `MOVE_THRESHOLD_FRAC` × the recorded radius. |
| QA-12 | FR-13 suppression, moved | Panning by 1.5 mi after a 5 mi search offers the control (1.5 > 0.25 × 5). A rung change from 5 to 10 offers it with the centre unmoved, since zooming out crosses a rung; a zoom that crosses no rung does not. A zoom **in** that drops a rung while the viewport stays inside the searched circle does **not** offer it, the second conjunct withdrawing what the first would have made. A capped view left untouched is not offered forever — the cap's headline hazard. Panning away and back to the original centre withdraws it again. |
| QA-13 | FR-14 in-flight suppression, and the one-lookup budget | While a fetch for the active view is in flight the control is absent. Attempting to activate it five times without moving the map issues exactly one call to the view's endpoint. |
| QA-14 | FR-10 / FR-11 centre adoption, radius sent but not adopted | After a press the latitude and longitude fields show the rounded centre, and the radius `SegControl` still shows **the rung the user had selected** — checked from a rung moved off both the derived value and the shipped default first, so "unchanged" cannot pass by landing on a value that was already there, and read as the whole pressed set so a press that selected two rungs would also fail. The request carries `lat`/`lng` at 5 dp and `dist = Math.round(derivedRadius * 1.60934)`: a derivation of 25 mi sends `dist=40`. Both halves are asserted on the **same press**, in both directions: sending the sidebar's radius fails, and writing the derived radius into the control fails. Swept with the sidebar's rung both **below** and **above** the derived one, so neither result is an artefact of the derived value always being the larger. The client-side personal-location filter uses the sent radius, proved on a fixture where the two candidate radii give different pin counts. |
| QA-15 | FR-12 record contents | The stored record equals the values sent, not the values displayed or the live viewport. |
| QA-16 | FR-15 record written by every route | After a search run from the sidebar Find button, the place-name search, "Use my location", a centre-pin drop, a centre-pin drag, and a view-mode change, the record for that view is set, and the control is not offered when that search's centre matches the viewport within FR-13. |
| QA-17 | FR-16 failure leaves the record | A search that rejects leaves the record unchanged, and the control is offered again as soon as the fetch settles. |
| QA-18 | FR-17 indicator drawn | After a successful search the map shows a circle at the record's centre with the record's radius. It is present on a phone with the sidebar closed. |
| QA-19 | FR-09 / FR-17 honesty at the cap | On a view whose covering radius exceeds `DERIVED_MAX_MI`, the drawn circle is visibly smaller than the viewport rather than matching it, and the indicator claims no coverage it does not have. No copy changes for this case: it is carried by geometry alone, and `capped` exists so that a test can assert the cap fired without reaching for a sentence that does not exist. |
| QA-20 | FR-18 indicator is stationary and inert | Panning after a search leaves the circle at its recorded position. Clicking inside the circle over a sighting pin, an atlas block, and a county still selects those features; `queryRenderedFeatures` results for the existing layers are unchanged with the indicator present. |
| QA-21 | FR-19 per-view | Switching from a searched view to an unsearched one removes the indicator; switching back restores that view's circle. |
| QA-22 | FR-20 success announcement | After a search returning N results the live region's `textContent` is exactly the view's success sentence with N interpolated, and the singular form is used at N = 1. |
| QA-23 | FR-21 empty result | A search returning zero results writes the record, draws the indicator, announces the view's "none found" sentence, and produces no error state. |
| QA-24 | FR-22 failure surfaces | A failed search leaves the existing sidebar error text unchanged from today's rendering, announces that message through the new region, and writes nothing into `.sr-map-geo-error`. |
| QA-25 | FR-23 pan during flight | Panning while a fetch is in flight neither cancels it nor starts another. The settled result is applied, the record holds the sent values, and no request beyond the original one is made. |
| QA-26 | FR-24 focus retention | Focusing the control and activating it with Enter leaves `document.activeElement` as that control, with `aria-disabled="true"` and the already-searched accessible name. A further Enter issues no request. Moving focus away removes the control. The `disabled` attribute is never used for this state. |
| QA-27 | FR-25 live region contract | The region is present in the DOM before any announcement and in every state; it is never `display: none`; announcing the same string twice produces two DOM mutations of the keyed child; the region's `textContent` is exactly the message. `ariaSnapshot` against a real render shows the region while idle. |
| QA-28 | FR-26 dual-transport parity | Given the same viewport fixture, the Tauri path and the FastAPI path both issue `lat`, `lng`, and `dist` with identical values. No new backend route, Tauri service function, or capability appears in the diff. |
| QA-29 | FR-27 non-regression | The existing Map Explorer suite passes unchanged. Existing callers of `handleFindHotspots`, `handleFindSightings`, and `handleFindLifers` behave identically, including the pin-drop path (`CenterPinDropper.test.tsx`, `CenterPin.test.tsx`), which invokes with exactly two arguments and so can reach neither the derived radius in the third position nor the `fromViewport` flag in the fourth. A pin drop therefore still searches at the radius already in the sidebar and still frames its results. |
| QA-30 | FR-28 no persistence | After a press, nothing new is written through the storage seam; the saved map default is unchanged; relaunching restores the pre-press centre and radius. |
| QA-31 | NFR-01 responsive | At 320px and 200% text scale, on all three views, in windowed and fullscreen, the control's text ink and box sit inside its container's content box, measured in a real browser at both text scales. |
| QA-32 | NFR-02 iOS safe area | In fullscreen with `.sr-ios-app` set, the control clears the top inset in portrait and the side inset in both landscape rotations, with no double inset. The positioned ancestor is named in the code and asserted by a test. |
| QA-33 | NFR-03 touch target | At ≤640px the control's hit rectangle is at least 44px in its constrained dimension; desktop metrics are unchanged. |
| QA-34 | NFR-04 render purity | `npm run lint` passes with `react-hooks/purity` enforced; no impure call appears in a render body or memo in the changed files. |
| QA-35 | NFR-05 tokens and contrast | No hardcoded hex or rgb value in the changed component files. Any text on the control clears 4.5:1 against its fill in both themes, asserted from the parsed tokens. If a GL layer is used, changing `data-theme` re-resolves its paint. |
| QA-36 | NFR-06 / NFR-11 layout | Positioning, display, wrap, and gap for the control are declared in `globals.css`, not inline. No `window.innerWidth` or `resize` listener is added. |
| QA-37 | NFR-07 layer order | With the indicator present, sighting, hotspot, target, and lifer markers still render above it. |
| QA-38 | NFR-08 / NFR-09 surface area and bundle | `package.json` and `PRIVACY_POLICY.md` are unchanged; `entryChunk.test.ts` passes; a fresh `npm run build` shows `vendor-maplibre` absent from `dist/index.html`'s modulepreload. |
| QA-39 | NFR-10 pure module | The centre derivation, the covering-radius computation, the rung snap and its cap, and both conjuncts of the offer predicate are exercised directly by unit tests with no map instance and no React render. |
| QA-40 | NFR-12 live-region stylesheet guard | A stylesheet test rejects a `display: none` (or `visibility: hidden` / `content-visibility: hidden`) rule whose subject is the new region, and asserts a positive `display` so deleting the rule fails the test rather than passing it. |
| QA-41 | NFR-13 performance | The derivation is synchronous and allocation-light; a `moveend` with the control mounted performs no network work and no measurable additional layout beyond the shipped bounds report. |
| QA-42 | Build gate | `npm run build` (`tsc -b && vite build`) succeeds, and the backend suite passes, before the change is pushed. |
