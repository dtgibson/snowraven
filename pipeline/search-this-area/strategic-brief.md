# Strategic Brief — Search This Area

## What We're Building

A "Search this area" control on the Map Explorer's three live-search views
(Hotspots, Nearby Lifers, Media Targets) that re-runs the current view's
eBird search around the map viewport the user is looking at — after they
have panned or zoomed away from the last searched spot — in one press, on
desktop and on a phone.

## Why Now

The three views already search around a point at a radius, and every route
to *changing* that point exists (typing coordinates, place-name search, Use
my location, dropping a centre pin). What does not exist is the one thing a
birder does constantly: pan the map somewhere else and want the same search
there. Today that means opening the Filters panel (on a phone, an overlay
that covers the map they were just reading), finding the coordinate boxes,
and either typing or re-deriving a location — or right-clicking to drop a
pin, which has no keyboard equivalent and is not discoverable.

The timing follows the same thread as the last several releases. Roadmap Up
Next item 1 is the mobile app, and its stated rationale is that real
on-device use surfaces defects desktop-width testing never would; v0.5.83
moved "centre the map on yourself" out of the Filters panel and onto the map
for exactly this reason, and v0.5.84 finished that button family. This is
the next control in the same queue: the map is where the user is looking, so
the action belongs on the map.

It is worth saying plainly that this item is **not** in ROADMAP.md's Up Next
and not in On the Horizon. It arrives from the saved idea inbox. It is
small, it is squarely inside the shipped Map Explorer, and it serves the
mobile item rather than competing with it — but it is an insertion, not a
scheduled item, and the Planner should treat it as one.

## The User Problem

A birder is looking at the Map Explorer on Hotspots. They have found the
hotspots near home. Now they drag the map twenty miles up the coast to where
they are actually going this weekend. Nothing happens — the pins on screen
are still the ones near home, and there is no indication that what they are
looking at has not been searched. To search where they are now looking they
must leave the map: open Filters, scroll to the coordinate boxes, and supply
a location they can see perfectly well but cannot express.

Three things compound it. The searched area is **invisible** — no ring, no
shading, nothing marks the radius that was actually queried, so "these pins
are stale" is something the user has to infer. On a phone the Filters panel
is a full overlay, so the trip to the coordinate boxes hides the very view
that prompted it. And the one gesture that does re-search in place
(right-click or long-press to drop the centre pin) is a hidden gesture with
no keyboard route.

## Success Criteria

- From a panned or zoomed map on Hotspots, Nearby Lifers, or Media Targets,
  a birder can re-run that view's search over what they are looking at in
  one press, without opening the Filters panel.
- The control is the same control in the same place on desktop and on a
  phone, including phone fullscreen with the Filters overlay closed. There
  is no separate mobile design to learn.
- After a search, the user can tell what area was searched — the answer is
  visible on the map, not only in the sidebar. (What form that takes is the
  Designer's call; the requirement is that it is legible on a phone, where
  the sidebar is not on screen.)
- The control appears only when it would do something different from the
  last search, and never re-searches on its own. Panning the map fires no
  network request.
- Reachable and operable by keyboard, with a real button, an accessible name
  that says what will happen, and the search outcome announced. Pressing it
  does not move focus off the map.
- It holds at 320px and 200% text scale, and clears the iOS safe area in
  fullscreen.
- Repeated pressing without moving the map costs at most one eBird lookup.

## Scope

- One shared "Search this area" control, active on the three centre-based
  views (Hotspots, Nearby Lifers, Media Targets). It re-runs whichever of
  the three is currently active.
- Derive the search centre and radius from the current map viewport, adopt
  them as the view's search centre and radius (the same shared `lat` / `lng`
  / `radius` state the sidebar controls already drive), and run that view's
  existing fetch.
- Show the user what area the search covered.
- Present the control on the map surface itself, visible on both desktop and
  phone, hidden while the phone Filters overlay is open.
- Suppress the control when the viewport has not meaningfully moved from the
  last searched area, and while a fetch for that view is in flight.
- Keep the sidebar's coordinate boxes, radius control, place-name search,
  Use my location, and the centre pin working exactly as they do now, and
  keep them in agreement with whatever the new control sets.

## Out of Scope

- My Sightings. It renders the user's own loaded data with no live search
  and no centre; there is nothing to re-run.
- A drawn or freehand region. The eBird endpoints behind these three views
  take a point and a radius only, so a polygon cannot be sent and a control
  that implies one would be dishonest.
- Automatic search on pan or zoom, in any form, including a debounced one.
- Any change to the county, atlas, or shading overlays, which already track
  the viewport on their own and make no network calls.
- Persisting the derived centre or radius as the saved map default. Like Use
  my location and the centre pin, this is session-only.
- A new tile provider, endpoint, or third party. Nothing here changes
  `PRIVACY_POLICY.md`.
- Widening the radius rungs or changing what the existing radius control
  offers.

## Key Decisions

**"The currently selected area" means the map viewport.** Not the centre pin
and not a drawn region. The centre pin is already covered: `applyCenter` in
`MapExplorer.tsx` sets the centre from a dropped or dragged pin *and*
immediately re-runs the active view's search, so building this on the pin
would add a second route to something already shipped. A drawn region cannot
be expressed to `/map/hotspots` or `/map/recent-obs`, which take
`lat`/`lng`/`dist` only. The viewport is the one "area" the user has already
selected — by panning and zooming — and it needs no new gesture, which
matters most on touch, where gestures are scarce and undiscoverable.

**One shared control, not three.** The centre and radius are already single
pieces of shared state across all three views, `ViewMode` is exclusive so
only one view is on screen at a time, and `applyCenter` already carries the
branch that dispatches to the right handler. Three controls would be three
copies of one thing that could never be seen together.

**The control is not a fourth FAB.** The map's FAB cluster is measured at
4.00px of slack at 320px and 200% text scale with its current three discs
plus the Filters pill; a fourth disc does not fit, and the pre-approved
escape hatch (dropping the column gap to 8px) should be spent on something
that has no alternative. A labelled control elsewhere on the map surface is
also the better answer on its own merits: "Search this area" needs words,
not a glyph, and the idiom users already know from other mapping apps is a
labelled pill over the map, not a corner button.

**Mobile is the primary case, not the fallback.** On a phone the map goes
fullscreen and the sidebar becomes an overlay, which is precisely the
configuration in which the current workaround is worst. The control must sit
on the map, gate on the Filters overlay being closed the way the FAB cluster
does, and respect the `.sr-ios-app` safe-area gate in fullscreen. Whatever
reads well there is what ships on desktop too.

**The searched area must be visible.** A control that says "search this
area" while the area it actually searched is a circle the user cannot see is
making a claim it does not keep — the viewport is a rectangle and the query
is a radius, so they can never be the same shape. Showing the covered area
is a requirement of the feature, not a nicety.

**Network posture: one press, one lookup, never automatic.** These are live
eBird calls on the user's own key, and making re-search one press makes it
easy to fire many. Three rules follow. The search fires only on an explicit
press. The control hides when the view has not moved enough to change the
answer, so an idle map offers nothing to press. And the derived centre and
radius are rounded and snapped before they are sent — the backend's
recent-obs cache is keyed on exact `(lat, lng, dist)`, so an unrounded
viewport centre would produce a fresh float on every pan and miss the cache
every time. Rounding the centre to the five decimal places the app already
uses everywhere else, and snapping the radius onto the existing 5 / 10 / 25
/ 50 mi rungs, is what makes the caching real.

**Snap the derived radius to the existing rungs.** The radius control is a
four-option `SegControl`, so a continuous viewport-derived value would have
no honest way to render in it. Snapping keeps the sidebar and the map
telling the same story, and keeps the client-side personal-location filter
in `handleFindHotspots` (which compares against `radius` in miles) correct.

**Deliberate accepted limit: the circle will not equal the rectangle.** A
radius that covers the whole viewport over-fetches past the corners; one
inscribed in it under-covers them. Either is defensible, and the honest
resolution is to show what was covered rather than to pretend the mismatch
away. The Designer picks; the brief requires only that the user can see it.

## Flags for the Planner and Architect

- **`dist` above eBird's documented ceiling is unverified here.** The app
  sends miles converted to km, so the existing 50 mi rung sends `dist=80`.
  eBird's geo endpoints document a 50 km maximum, and nothing in
  `backend/routers/map.py` or `lib/tauri/mapService.ts` clamps it (the
  backend allows `le=200`). Whether eBird clamps, errors, or silently
  truncates is not established in this repo. It matters more once a radius
  can be derived from a zoomed-out viewport, so it should be checked rather
  than assumed — and if eBird does clamp, the visible searched area must
  show what was really covered, not what was asked for.
- Both transports need this: the desktop path calls eBird directly through
  `lib/tauri/mapService.ts`, the web/Pi path through the backend. Nothing
  here should require a new route on either side — the existing handlers
  already accept an override centre.
- The viewport is already tracked. `BoundsTracker` reports padded bounds and
  `unpadBounds` (`lib/markersInView.ts`) exactly inverts the pad; use that
  pair rather than a second reading of `map.getBounds()`.
- Containing-block caution from CLAUDE.md: an absolutely positioned control
  resolves against its nearest *positioned* ancestor's padding box, so the
  safe-area inset on the fullscreen panel only reaches it if that panel is
  the positioned ancestor. Name and assert that ancestor.
- No tension with the founding brief. Map Explorer is a listed feature, this
  adds no provider, no telemetry, no persistence, and no account, and it
  stays device-to-provider on the user's own key.
