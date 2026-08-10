# Strategic Brief — Map Location Buttons

## What We're Building

A location button on the Map Explorer's map surface that centers the map on the
user's current position, and a corrected icon on the existing share-pin button so
the two round map controls are distinguishable at a glance. The location detection
itself is already built and shipped on every platform; this puts it where people
look for it, and stops the pin button from impersonating it.

## Why Now

The user reported a specific confusion: the round button on the map "seems like it
should center on the user's location." Reading the code, that confusion is not a
misunderstanding, it is a correct read of a real mismatch, and it has three
compounding causes that are cheap to fix together and awkward to fix separately.

**First, the button's glyph and its artifact disagree.** The share drop button
renders lucide's `MapPin` (`components/map/SharePin.tsx`) — a teardrop location
marker, the exact glyph every consumer maps app uses for "a place" and the nearest
neighbour of the "locate me" idiom. What it plants is a flag sprite. That was a
deliberate v0.5.80 decision, recorded in the component: "A planted flag, not a
teardrop: every hue in the app's map palette is already spoken for on at least one
in-scope surface, so SHAPE carries the distinction." The sprite followed that
reasoning. The button glyph never did. So the control announces itself as a
location pin and produces a flag.

**Second, on the one view where that button appears, there is genuinely no
location control at all.** `<SharePin>` mounts on Map Explorer only when
`viewMode === 'sightings'`. The "Use my location" button lives in
`CenterPointControl`, which is rendered into the Hotspots, Nearby Lifers and Media
Targets sidebars and **not** into the My Sightings sidebar. My Sightings is the
default view. So on the view the user is most likely looking at, the pin-glyph FAB
is the only thing on screen resembling a location control, and the actual one is
not merely hidden, it is absent. The user reached the only conclusion the interface
supports.

**Third, where the real control does exist, it is behind a door on a phone.** On
the center views "Use my location" sits in the sidebar, which on mobile is the
Filters overlay. Centering on yourself — the single most common thing a birder
standing in a field wants from a map — costs a button press, a panel scan and a
dismiss.

The capability is not the gap. `getCurrentLocation()` (`lib/location.ts`) is fully
built and platform-proven: native `CLLocationManager` on macOS, the Windows
Geolocation API, `tauri-plugin-geolocation` on iOS, `navigator.geolocation` with a
secure-context guard on web, all funnelling into one `LocationError` shape with
platform-specific remediation text in `describeLocationError()`. `handleUseMyLocation()`
in `MapExplorer.tsx` already detects, fills the coordinate fields, pans the map via
`setPanTarget`, and drops a blue `DetectedLocationPin` at the detected point. Every
piece of the behaviour the user is asking for exists and works. It is reachable from
the wrong place, on three views out of four, and something else is wearing its face.

That makes this a discoverability and iconography fix over shipped machinery, not
new capability — which is why it is honest work for a single build at the end of a
bundled release. The platform risk that would normally make "add GPS" a large
feature (four platforms, three different permission models, a shipped
`windows-geolocation` fix in the history) is already paid.

**Where the user's framing needs correcting.** They asked to "make the buttons
uniform sized." The two round FABs are already identical: `.sr-map-fullscreen-btn`
and `.sr-share-drop-btn` are both 36×36 circles with the same border, radius and
shadow. Uniformity is not the defect and was never the problem — the problem is
that two controls of identical size and shape, one of which does not exist yet, need
to be told apart by something. Sizing is already solved; distinguishing is the work.

## The User Problem

A birder in the field wants to see where they are on the map. On the default Map
Explorer view they cannot, from the map, at all. On the other three views they can,
but only by opening a panel. And the one round button that looks like it would do it
plants a flag instead — so the first attempt produces an unexpected marker and a
popup, which teaches the user that the control they wanted is not there.

## Success Criteria

- From any Map Explorer view, on any platform, a birder can center the map on their
  current position without opening the Filters panel.
- The two round map buttons are told apart at a glance by silhouette, not by reading
  a tooltip, and not by color alone.
- The share button's glyph matches the marker it plants.
- Pressing the location button when permission is denied, unavailable, or the
  context is insecure produces a visible and screen-reader-announced message on the
  map, carrying the existing platform-specific remediation wording rather than a
  generic failure.
- Nothing about the existing right-click / long-press gesture, the sidebar "Use my
  location" button, the Settings default-location flow, or the share pin's behaviour
  changes.

## Scope

- A location button in the Map Explorer FAB cluster (`.sr-map-fab-cluster`), on all
  four view modes, calling the existing `handleUseMyLocation` unchanged. Same 36×36
  circular treatment as the two shipped FABs.
- A distinct, shape-carried icon pairing: a crosshair/locate glyph for the location
  button, and a flag glyph for the share drop button, replacing `MapPin`. Different
  silhouettes, so the distinction survives grayscale and the app's colorblind
  posture.
- The share button icon change applies on **all five** share-pin surfaces, since it
  is one shared component and the glyph/artifact mismatch is identical everywhere.
- An on-map home for the location error, announced to assistive tech. The existing
  `.sr-map-loading-chip` (`role="status"`, over the canvas) is the precedent to
  follow; the FAB itself has no room for a message.
- A busy/locating state on the button while detection is in flight, matching the
  sidebar button's existing "Locating…" affordance.
- Documentation sync in the same change: `docs/HELP.md` (line ~287 already claims
  "Click **Use my location** in the map controls," which is currently not true on My
  Sightings and not true of the map surface anywhere — it becomes true, and line ~297
  describes the pin button), plus `README.md`, `website/index.html` and `ROADMAP.md`
  per the repo's hand-maintained-restatement rule.

## Out of Scope

- **A location button on the Species Detail, Statistics, and Named Birds maps.**
  Those maps are bounded to the user's own sighting data by `MapBoundsFitter`, and
  they answer "where have I seen this," not "where am I going." Recentering one of
  them could fly the view somewhere with no data, and would fight the bounds fitter.
  They still get the corrected share icon, since that is a shared component. Revisit
  only if the user asks.
- **Continuous location tracking / a follow-me mode.** `watchPosition` is a
  materially different privacy, battery and permission story than a one-shot fix,
  and nothing in the request asks for it.
- **Any persistence.** The detected location stays session state, exactly as today.
  The saved Default Location remains a deliberate Settings choice — the standing
  decision recorded for the search-center pin.
- Changing the sidebar "Use my location" control, its auto-search-when-empty
  behaviour, or the Settings default-location flow.
- Changing the right-click / long-press drop gesture, the share pin sprite, the
  popup, or the blue detected-location dot.
- Any new provider, backend route, dependency, permission grant, or change to how or
  when permission is requested.
- Resizing the existing FABs or changing the Filters button.

## Key Decisions

- **Reuse the shipped location seam verbatim.** `getCurrentLocation()`,
  `describeLocationError()` and `handleUseMyLocation()` are called unchanged. No new
  location plumbing, no new platform branches. If this feature needs to modify
  `lib/location.ts`, something has gone wrong.
- **Distinguish by shape, not hue.** This extends the v0.5.80 reasoning that already
  governs the sprite ("every hue in the app's map palette is already spoken for, so
  SHAPE carries the distinction") to the button glyph, which was the one place that
  decision was never applied. Framing matters for the record: this **completes** the
  v0.5.80 decision rather than reversing it.
- **DOM order is focus order in the FAB cluster.** `.sr-map-fab-slot` is
  `display: contents` specifically so DOM order and visual order agree (the recorded
  WCAG 2.4.3 decision — `order` was rejected for this reason). Where the new button
  sits in the cluster is therefore a focus-order decision, not just a visual one.
- **Privacy policy is expected to need no change, and that must be verified rather
  than assumed.** `PRIVACY_POLICY.md` already covers `When you tap "Use my location"
  (on the map, ...)`, and this changes neither the mechanism, the destination, nor
  what leaves the device — on My Sightings it is a pure recenter that transmits
  nothing. The policy's existing sentence that coordinates "are only sent outward if
  you then run a search" must remain true after the change; on the center views the
  reused handler can auto-run a search when the coordinate fields were empty, so
  confirm that sentence still holds.
- **One button, four views, possibly two meanings.** On My Sightings the handler is a
  pure recenter. On the center views the same handler also sets the search center and
  may fire a network lookup. Recommendation is one control calling one handler, with
  the accessible name reflecting what it does in the current view; the exact wording
  is the Designer's call.
- **The 36px FABs do not currently meet the ~44px touch posture** and do not carry
  `.sr-touch-target`. Not this feature's defect to fix, but the new button must not be
  worse than its neighbours, and the question should be raised rather than silently
  inherited.

## Flags for the User

- **Part of this is already built, and the brief scopes accordingly.** Location
  detection works on all four platforms today; it is reachable only from the sidebar,
  and only on three of the four Map Explorer views. This build moves and re-dresses
  it rather than adding it.
- **The share pin button's icon changes on all five maps**, including four surfaces
  the request did not mention. It is one shared component, and leaving four maps with
  a teardrop glyph over a flag sprite would preserve the exact confusion being fixed.
- **No location button is proposed for Species Detail, Statistics, or Named Birds.**
  Those maps are bounded to your own data and recentering them is speculative. Say so
  if you want it there anyway.
