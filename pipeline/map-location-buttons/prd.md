# PRD — Map Location Buttons

**Feature:** map-location-buttons
**Date:** 2026-08-10
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

A location button in the Map Explorer's floating control cluster, present on all
four view modes, that centers the map on the user's current position by calling
the already-shipped `handleUseMyLocation` handler; a corrected icon pairing so
that button and the share-pin button are told apart by silhouette; and an
on-map, screen-reader-announced home for the location-failure message, which a
36px round button has no room to carry.

## User Stories

> **US-01** — As a birder standing in the field with My Sightings open, I want to
> press one button on the map to center it on where I am, so that I can see my
> own records around my current position without opening the Filters panel.

> **US-02** — As a birder on the Hotspots, Nearby Lifers, or Media Targets view
> on a phone, I want the same button on the map surface, so that centering on
> myself does not cost a panel open, a scan, and a dismiss.

> **US-03** — As a birder looking at the two round buttons in the map's corner, I
> want to tell them apart at a glance by their shape, so that I do not press the
> share pin expecting it to find me.

> **US-04** — As a screen-reader user whose location permission is off, I want
> the reason and the fix announced when I press the button, so that a press that
> does nothing visible is not a silent dead end.

> **US-05** — As a birder on any map that offers a share pin, I want the button's
> glyph to match the marker it plants, so that the control does not advertise
> itself as something it is not.

## Functional Requirements

### The location control

> **FR-01** — The Map Explorer shall render a location button inside the existing
> `.sr-map-fab-cluster` on all four view modes (`sightings`, `hotspots`,
> `targets`, `lifers`), whenever that cluster renders.

> **FR-02** — The button shall be available independently of loaded eBird data,
> a stored API key, and the `isSetupRequired` state. It centers the map; it does
> not depend on the user's data being present. (The share pin, by contrast, is
> gated on `viewMode === 'sightings' && !isSetupRequired`; the location button
> shall not inherit that gate.)

> **FR-03** — Pressing the button shall invoke the existing
> `handleUseMyLocation` in `MapExplorer.tsx` with no change to that handler, and
> no change to `getCurrentLocation` or `describeLocationError` in
> `lib/location.ts`. All four resulting behaviors are inherited unchanged: the
> coordinate fields fill, the map pans to the detected point, the blue
> `DetectedLocationPin` drops, and a search auto-fires only on the three center
> views and only when both coordinate fields were empty.

> **FR-04** — The button shall be visually a circular map FAB matching the
> shipped `.sr-share-drop-btn` treatment: 36px at base width, and at least
> `2.75rem` in the `≤640` tier so it meets the ~44px touch posture on a phone.
> It shall not alter `.sr-map-fullscreen-btn` or `.sr-share-drop-btn`.

> **FR-05** — While a location request is in flight, the button shall show a busy
> state matching the sidebar control's existing affordance (a spinning
> `Loader2` glyph and a "Locating" accessible name), and a second press during
> that window shall not start a second request.

> **FR-06** — Focus shall remain on the location button across a full press-to-
> result cycle, including the busy window and the failure result. The button
> shall not be removed from the tab order while locating.

> **FR-07** — The button shall carry an explicit accessible name describing what
> it does. Its name shall be distinct from the share-pin button's shipped names
> ("Drop a pin at the map center" / "Move the pin to the map center") and from
> the fullscreen toggle's ("Enter fullscreen" / "Exit fullscreen").

> **FR-08** — The feature shall introduce no permission request of its own. When
> location permission was previously denied, pressing the button shall not raise
> a system permission prompt; it shall surface the platform's remediation message
> instead. This preserves the shipped behavior of `getCurrentLocationIOS`, which
> calls `requestPermissions` only when `checkPermissions()` reports `prompt` or
> `prompt-with-rationale`, and throws `permission-denied` directly otherwise.

> **FR-09** — The feature shall issue no network request of its own. Pressing the
> button on the My Sightings view while offline shall still attempt detection and
> shall still center the map on a successful fix.

### The control cluster

> **FR-10** — The relative order of the three shipped cluster items (share-pin
> slot, fullscreen toggle, Filters button) shall be preserved in the DOM, and DOM
> order shall remain visual order. The CSS `order` property shall not be used to
> position any cluster item. Where a new slot element is needed, it shall use
> `display: contents`, following `.sr-map-fab-slot`.

> **FR-11** — With every cluster control present, the cluster shall not overflow
> the viewport at 320px width at 200% in-app text scale, and shall not extend
> `document.scrollWidth` beyond the viewport width.

> **FR-12** — When the mobile Filters overlay is open the cluster is unmounted and
> the location button is therefore absent, matching the shipped fullscreen and
> share-pin controls. No new behavior is required for that state.

### The failure message

> **FR-13** — A location failure shall produce a message on the map surface,
> visible on all four view modes, carrying the exact text
> `describeLocationError()` returns for that `LocationError` code, unmodified. The
> five reachable codes are `permission-denied`, `unavailable`, `timeout`,
> `dev-mode`, and `insecure-context`.

> **FR-14** — The message shall be rendered inside a live region that is present
> in the DOM from first render, and the message text shall sit in a child node
> keyed by a sequence value that advances on every announcement. Pressing the
> button twice and failing twice with the identical message string shall produce
> two announcements, not one.

> **FR-15** — A single location failure shall announce exactly once. The sidebar's
> existing `role="alert"` failure block and the new on-map region shall not both
> announce the same failure on the three center views, where both can be present
> at once on desktop.

> **FR-16** — The message shall be positioned so it does not obscure the control
> cluster or the map's layer switcher, and shall not block pointer interaction
> with the map beneath it. `.sr-map-loading-chip` is the shipped precedent for
> placement, z-index (1050), and `pointer-events: none`.

> **FR-17** — The message shall clear on a subsequent successful detection, and
> shall not persist across a view-mode change.

### The icons

> **FR-18** — The location button's glyph shall be a locate or crosshair
> silhouette, distinct from a flag and from the fullscreen chevrons. It should
> match the glyph on the shipped sidebar "Use my location" control (currently
> lucide `Navigation`) so the two controls that do the same thing read as the same
> thing.

> **FR-19** — The share-pin button's glyph shall change from lucide `MapPin` to a
> flag silhouette matching the planted-flag sprite it produces. This applies to
> the single shared `SharePin` component and therefore to all five surfaces that
> mount it: Map Explorer My Sightings, Species Detail pins mode (via
> `SightingsMap`), Species Detail heatmap mode (inline), the Statistics
> geographic map, and the Named Birds card maps (via `SightingsMap`).

> **FR-20** — The share-pin button's accessible names, `aria-pressed` behavior,
> `title`, `compact` sizing, popup, drop gesture, drag behavior, and the pin
> sprite itself shall be unchanged. Only the button's glyph changes.

> **FR-21** — The location and share glyphs shall remain distinguishable when
> rendered without color (grayscale, and under the app's colorblind posture),
> since shape carries the distinction.

### Documentation and privacy

> **FR-22** — `docs/HELP.md` shall be updated in the same change so its Map
> Explorer section describes the location button truthfully. Its current sentence
> "Click **Use my location** in the map controls to center the map on your current
> position" is not true of the map surface anywhere today and not true at all on
> My Sightings; it becomes true and shall be rewritten to say where the control
> is. The share-pin paragraph describing the "round pin button" shall be checked
> against the new glyph.

> **FR-23** — `README.md`, `website/index.html`, `ROADMAP.md`, and
> `ACCESSIBILITY.md` shall be updated in the same change wherever they restate
> this behavior. `ACCESSIBILITY.md` currently enumerates the keyboard-operable
> map controls as "zoom, base-layer switcher, filters, fullscreen"; that list
> shall include the location control.

> **FR-24** — No user-facing copy added or changed by this feature shall contain
> an em dash (U+2014), in the app, `docs/HELP.md`, `README.md`,
> `website/index.html`, `PRIVACY_POLICY.md`, or `ACCESSIBILITY.md`.

> **FR-25** — On the My Sightings view, pressing the location button shall
> transmit no coordinate to any provider: no eBird, Nominatim, OpenWeather, or
> NOAA request shall be issued as a result of the press. The auto-search branch in
> `handleUseMyLocation` is reachable only on the three center views.

> **FR-26** — `PRIVACY_POLICY.md` shall be verified against the shipped behavior
> before release, specifically the "Your Location" sentence that coordinates "are
> only sent outward if you then run a search (for hotspots or nearby sightings) or
> use the 'Current' lookup." The verification shall cover two things: that the
> sentence remains true on My Sightings (FR-25), and that it is not misleading
> given that centering the map on the user causes basemap tiles for the area
> around them to be requested from the tile provider. The policy shall be edited
> if either check fails.

## Non-Functional Requirements

> **NFR-01 — Dependencies:** No new npm or Rust dependency, no new provider, no
> new backend route, no new Tauri capability grant or permission, and no change to
> `lib/location.ts` or `src-tauri/src/location.rs`.

> **NFR-02 — Persistence:** No new persisted state. The detected location remains
> session state. Nothing is written through the `storage` seam, and the saved
> Default Location is untouched.

> **NFR-03 — Theming:** All new color values shall come from `var(--sr-*)` tokens
> and shall render legibly in both themes. The failure message's text shall meet
> WCAG AA (4.5:1) against its own surface in both themes.

> **NFR-04 — Bundle:** No component reachable from `App.tsx`'s static import graph
> may gain a static import of `SharePin`, `SightingsMap`, `SnowMap`, or
> `react-map-gl/maplibre`. The `entryChunk.test.ts` guard shall stay green.

> **NFR-05 — Rendering:** No impure call (`Date.now()`, `new Date()`) in a render
> body, `useMemo`, or `useCallback`, per the build-blocking `react-hooks/purity`
> rule. The glyph change shall not remount the marker set or re-run the map's
> bounds fitter on any of the five share-pin surfaces.

> **NFR-06 — Responsive:** Layout shall be expressed through classes in
> `globals.css`, not new inline `display` / `flex-wrap` / `gap` values, and shall
> hold from 320px to desktop at 200% in-app text scale.

## Out of Scope

Carried from the strategic brief:

- A location button on the Species Detail, Statistics, or Named Birds maps. Those
  maps are bounded to the user's own data by `MapBoundsFitter` and recentering
  would fight it. They still receive the corrected share glyph, because it is one
  shared component.
- Continuous location tracking, `watchPosition`, or a follow-me mode.
- Any persistence of the detected location, and any change to the saved Default
  Location flow in Settings.
- Changing the sidebar "Use my location" button, its auto-search-when-empty
  behavior, the right-click / long-press drop gesture, the share pin sprite, the
  share popup, or the blue detected-location dot.
- Resizing the existing FABs, changing the Filters button, or changing how or when
  location permission is requested.

Added during PRD writing:

- Raising `.sr-map-fullscreen-btn` to the 44px phone posture. It is the one
  cluster control still at 36px on a phone (the share pin already reaches
  `2.75rem` at `≤640`). Correcting it is a separate, pre-existing defect; this
  feature must not make the cluster worse, and FR-04 holds the new button to the
  better of the two shipped precedents.
- A location button on the Weather tab's Predict picker map.
- Any change to the `role="alert"` treatment of the Settings tab's own location
  failure message.

## Open Questions

**Q1 — How is the single announcement achieved on the center views (FR-15)?**
Both the sidebar's `role="alert"` block and the new on-map region can be present
at once on a desktop center view, so one failure would announce twice and read
twice on screen. *Default if undecided before Stage 5:* the on-map region becomes
the single announcer on all four views, and the sidebar's existing block keeps its
visible text but drops `role="alert"`. This is the one place the brief's "the
sidebar control does not change" is touched, and it is a display change only, not
a behavior change. The alternative is to render the on-map region only where the
sidebar copy is absent.

**Q2 — Where in the cluster does the location button sit?** This is a focus-order
decision, not only a visual one, because `.sr-map-fab-slot` is `display: contents`
precisely so DOM order is tab order. Note the share-pin slot is populated only on
My Sightings, so the cluster's first item differs by view. *Default if undecided:*
immediately after the share-pin slot and before the fullscreen toggle, preserving
the shipped controls' relative order per FR-10.

**Q3 — Does the busy state use `disabled` or `aria-disabled`?** The sidebar
control uses `disabled`, but disabling a focused button moves focus to the
document body in most browsers, which would violate FR-06 for a button the user
just pressed. *Default if undecided:* `aria-disabled` plus a guard in the handler,
so the control stays focused and in the tab order while locating.

**Q4 — Does `PRIVACY_POLICY.md` need a cross-reference (FR-26)?** The "Your
Location" and "Map Tiles" sections are each individually true, but read alone the
first implies the coordinate has no outward consequence, while centering the map
on the user causes a tile request for the area around them. *Default if
undecided:* add a short cross-reference from "Your Location" to "Map Tiles"; do
not weaken either existing statement.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Button present on all four views | With the FAB cluster rendered, a location button is present on `sightings`, `hotspots`, `targets`, and `lifers` (FR-01) |
| QA-02 | Not gated on data or key | **AMENDED at Stage 5, per the Designer's flagged deviation.** On the three centre views (`hotspots`, `targets`, `lifers`), the button renders and is pressable with no eBird backup loaded, no API key stored, and `isSetupRequired` true (FR-02). On `sightings` with `isSetupRequired` true the button is deliberately ABSENT, because `<SetupRequired>` replaces the map there and a press could raise an OS location prompt for a result nothing can show. FR-02's intent is preserved: the gate is "is there a map", never "is there data". The original wording tested only that one combination and would fail by design. |
| QA-03 | Handler reused unchanged | `git diff` shows no change to `handleUseMyLocation`, `getCurrentLocation`, or `describeLocationError` (FR-03) |
| QA-04 | Permission granted | Pressing the button with permission granted fills both coordinate fields, pans the map to the detected point, and drops the blue detected-location pin (FR-03) |
| QA-05 | My Sightings fires no search | Pressing on `sightings` with both coordinate fields empty issues no hotspot, sightings, or lifer search (FR-03, FR-25) |
| QA-06 | Center views retain auto-search | Pressing on `hotspots` with both fields empty runs the hotspot search, exactly as the sidebar control does today (FR-03) |
| QA-07 | Touch posture | The button computes to at least 2.75rem in both dimensions at ≤640px, and 36px above it (FR-04) |
| QA-08 | Busy state | While the request is in flight the button shows the spinner, its accessible name reports locating, and a second press starts no second request (FR-05) |
| QA-09 | Focus retained | `document.activeElement` is still the location button after a press resolves to a failure (FR-06) |
| QA-10 | Distinct accessible names | The location button, the share-pin button, and the fullscreen toggle each have a non-empty accessible name, and no two are equal (FR-07) |
| QA-11 | Previously denied does not re-prompt | With permission already denied, a press raises no system prompt and shows the platform remediation text (FR-08) |
| QA-12 | No network of its own | A press on `sightings` produces zero outbound requests other than basemap tiles for the panned viewport (FR-09, FR-25) |
| QA-13 | Offline | With the network down, a press on `sightings` still detects and still centers the map (FR-09) |
| QA-14 | Shipped controls keep relative order | In cluster DOM order, the share-pin slot precedes the fullscreen toggle, which precedes the Filters button (FR-10) |
| QA-15 | No `order` property | No CSS `order` declaration appears on `.sr-map-fab-cluster` or any of its children in `globals.css` (FR-10) |
| QA-16 | Cluster fits 320px at 200% | At a 320px viewport and 200% in-app text scale, every cluster control is fully within the viewport and `document.scrollWidth` does not exceed it (FR-11) |
| QA-17 | Denial message text | A `permission-denied` failure renders the exact string `describeLocationError` returns for the running platform, character for character (FR-13) |
| QA-18 | Unavailable, timeout, insecure-context | Each of `unavailable`, `timeout`, and `insecure-context` renders its own `describeLocationError` string on the map surface (FR-13) |
| QA-19 | Repeat announcement | Pressing the button twice, failing both times with the identical message, produces two DOM mutations inside the live region and the region's `textContent` equals the message after each (FR-14) |
| QA-20 | Region present from first render | The live region element exists in the DOM before any failure has occurred (FR-14) |
| QA-21 | Announced once | A single failure on a center view with the sidebar visible produces exactly one live-region announcement (FR-15) |
| QA-22 | Message does not block the map | A pointer event at the message's coordinates reaches the map canvas beneath it, and the message does not overlap the FAB cluster or the layer switcher (FR-16) |
| QA-23 | Message clears | A failure followed by a successful detection leaves no failure message on screen; switching view mode after a failure leaves none either (FR-17) |
| QA-24 | Glyph pairing | The location button renders a locate/crosshair silhouette and the share button renders a flag silhouette; neither renders lucide `MapPin` (FR-18, FR-19) |
| QA-25 | Share glyph on all five surfaces | The flag glyph appears on Map Explorer My Sightings, Species Detail pins mode, Species Detail heatmap mode, the Statistics map, and a Named Birds card map (FR-19) |
| QA-26 | Share pin otherwise unchanged | The share button's accessible names, `aria-pressed`, `title`, compact sizing, drop gesture, drag, popup, and sprite are unchanged from the previous revision (FR-20) |
| QA-27 | Distinguishable without color | Rendered in grayscale, the location and share glyphs are different silhouettes (FR-21) |
| QA-28 | HELP.md true | `docs/HELP.md` names where the location control is, and no sentence in it claims a map-controls location button that does not exist (FR-22) |
| QA-29 | Published docs synced | `README.md`, `website/index.html`, `ROADMAP.md`, and `ACCESSIBILITY.md` reflect the shipped behavior; `ACCESSIBILITY.md`'s map-controls list includes the location control (FR-23) |
| QA-30 | No em dashes | `grep -n '—'` over the changed user-facing strings, `docs/HELP.md`, `README.md`, `website/index.html`, `PRIVACY_POLICY.md`, and `ACCESSIBILITY.md` returns no new hits (FR-24) |
| QA-31 | Privacy verified | The "Your Location" section is checked against shipped behavior and either confirmed accurate or edited; the check is recorded (FR-26) |
| QA-32 | No new dependency or route | No new npm/Rust dependency, provider, backend route, or Tauri capability grant appears in the diff (NFR-01) |
| QA-33 | No new persistence | No new `storage` seam key is written, and the saved Default Location is unchanged after a press (NFR-02) |
| QA-34 | Tokens and contrast | Every new color value is a `var(--sr-*)` token, and the failure message's text meets 4.5:1 against its surface in both themes (NFR-03) |
| QA-35 | Entry chunk intact | `entryChunk.test.ts` passes and a fresh `npm run build` shows no maplibre entry in `dist/index.html`'s modulepreload (NFR-04) |
| QA-36 | No map reframe on glyph change | Opening a Species Detail map before and after the change shows the same initial framing; no marker set remounts (NFR-05) |
| QA-37 | Layout in classes | No new inline `display`, `flexWrap`, `gap`, or `gridTemplateColumns` value is introduced on the cluster or the message; layout lives in `globals.css` (NFR-06) |
| QA-38 | Build gates | `tsc -b`, eslint (including `react-hooks/purity`), vitest, and `npm run build` all pass (NFR-05) |
