# Strategic Brief — Pin Share

## What We're Building

Drop a pin anywhere on a SnowRaven map with a right-click (desktop) or a
long-press (touch), and copy that spot to the clipboard as a share-ready
block: the GPS coordinates, plus Google Maps and Apple Maps links that open
the location. A new Settings preference chooses between copying coordinates
and map links (the default) or coordinates only.

## Why Now

The gesture and the plumbing already exist. `CenterPinDropper` (v0.5.43)
implements exactly the right-click-plus-long-press interaction this feature
needs, proven on touch, with all the cancel cases already handled (pinch,
pan, drag, slop, synthesized-contextmenu dedup). The `copyText()` seam
(v0.5.3) already solves the desktop clipboard pitfall that would otherwise
bite. Nearly all of the cost of this feature is already paid.

It also lands well against the roadmap. The top Up Next item is the mobile
app, and "long-press a map, share a location by text" is a phone-native
behavior that nothing in SnowRaven currently serves. This feature is
adjacent to that roadmap item rather than competing with it: it is most
valuable on exactly the device the roadmap is heading toward.

And it closes a real gap in an app otherwise full of get-this-out-of-here
affordances. SnowRaven already copies weather blocks, weather and tide
together, and checklist links. Location is the one obviously copyable thing
on screen that cannot currently be copied.

## The User Problem

A birder looking at a map in SnowRaven regularly wants to tell someone else
where a spot is. The bird was at the far end of the pond, not at the
hotspot's pin. The parking pullout is a quarter mile before the trailhead.
The stakeout is on the levee road with no address. Today the only way to
get that location out of SnowRaven is to read coordinates off the screen
and retype them, or to leave the app entirely, find the spot again in
Google Maps, and share from there.

The recipient's need matters too. A bare coordinate pair is precise but
inert in most messaging apps. A tappable map link opens the spot and starts
navigation. The birder wants to send one message that works for whoever
receives it, on whatever phone they carry.

## Success Criteria

- On any birding map in the app, a right-click or a long-press drops a
  visible pin and shows that spot's coordinates on screen.
- One press copies a share-ready block. Pasted into a text message it reads
  cleanly, and in the default mode the two links are tappable and open the
  exact spot in Google Maps and Apple Maps respectively.
- The coordinate line on its own, pasted into any maps application's search
  box, finds the spot. The coordinates are useful without the links.
- On Map Explorer's Hotspots, Nearby Lifers, and Media Targets views, the
  same gesture still sets the search center exactly as it does today, and
  that pin now additionally offers a copy action. Nothing a user could do
  before this feature becomes harder or moves.
- The Settings preference persists across an app relaunch on desktop and
  across a reload on web/Pi.
- The whole feature works with no network connection.
- A keyboard user can reach and copy a location without ever using a
  pointer gesture. The pin's popup is Escape-dismissible and returns focus
  to where it came from.
- Running the feature produces no outbound request. Nothing new appears in
  a network log, and `PRIVACY_POLICY.md` needs no new entry.

## Scope

- The drop gesture on the birding maps: Map Explorer (all four views),
  Species Detail's sightings map, the Statistics map, and the Named Birds
  per-individual maps. Species Detail and Named Birds share `SightingsMap`,
  so both are served by one change there.
- On Map Explorer's three search views, where the gesture is already taken
  by the v0.5.43 center pin, the copy action is added to that existing pin
  rather than introducing a second pin or a competing gesture.
- A single share pin at a time per map, draggable to fine-tune, with its
  coordinates and a copy action shown in a popup.
- The clipboard payload in both setting modes, built locally as strings.
- The Settings preference, persisted through the `storage` seam.
- A keyboard-reachable route to the same copy action.
- A copy confirmation, and an honest failure state that keeps the text
  visible and selectable if the clipboard write is refused.
- Documentation updated in the same change: `docs/HELP.md`, `README.md`,
  and `website/`, per the standing convention.

## Out of Scope

- **Any third-party URL shortener.** See Key Decision 2. This is a
  permanent exclusion, not a deferral.
- Saved, named, or listed pins. No pin history, no "my places," no
  persistence of a dropped pin across relaunch.
- Sharing into a specific application: no Web Share API sheet, no SMS or
  email composer, no per-app share targets. The clipboard is the whole
  delivery mechanism.
- An "Open in Maps" button on the pin popup. The links go to the clipboard
  for someone else to tap; opening them locally is a different job.
- Alternate coordinate formats (degrees-minutes-seconds, Plus Codes,
  what3words, MGRS). Decimal degrees only.
- A reverse-geocoded place name in the payload. This is the most likely
  future ask and is deliberately excluded: it would require a Nominatim
  call, which would make the feature network-dependent and put the user's
  coordinate into an outbound request, on a feature that currently needs
  neither.
- The Weather tab's Predict picker map. See Key Decision 1.
- Any change to left-click or tap behavior on any map.
- Elevation, distance-from-me, a shareable link back into SnowRaven, or a
  "share my current location" action.

## Key Decisions

1. **"Any map" resolves to the birding maps, and the gesture collision on
   Map Explorer is resolved by extending the existing center pin rather
   than competing with it.** The app has five map surfaces with three
   different pre-existing gesture semantics. On Map Explorer's My
   Sightings, Species Detail, Statistics, and Named Birds, right-click and
   long-press are free. On Map Explorer's Hotspots, Nearby Lifers, and
   Media Targets views (`isCenterView` in `MapExplorer.tsx`), that gesture
   is already claimed: it drops the search center. The Weather tab's
   Predict map is a location picker whose left-click already sets its pin.
   The resolution: ship the share pin wherever the gesture is free, and on
   the three center-pin views give the *existing* center pin a copy action.
   One gesture, one mental model, no collision, and the user still gets
   what they asked for on every Map Explorer view. Predict is excluded
   entirely, since a second pin concept on a small dedicated picker map
   would confuse rather than help. The accepted consequence: on the search
   views the drop gesture keeps its existing side effect of re-running the
   search. That is not new behavior, and the alternatives (a modifier key,
   which touch cannot express, or a mode toggle, which adds a control to
   every map) are both worse.

2. **"Shortened" is delivered with short canonical map URLs, not a URL
   shortener.** The user asked for shortened links. A third-party
   shortener is rejected, and not merely for convenience. It would send
   the user's exact coordinate to an outside company that logs it and mint
   a permanent public URL resolving to it, which for a birding app means
   nest sites, stakeouts, and suppressed rare-bird locations leaving the
   device. It would require a new entry in `PRIVACY_POLICY.md`, breaking a
   policy that currently asserts nothing is collected. It would make the
   feature's central action fail offline, when everything else about it is
   pure local string work. And it would make every shared link depend on a
   third party staying alive, which is the specific failure mode SnowRaven
   was founded to escape (the raincrow.app origin in `product-brief.md`).
   Note also that Google's own `maps.app.goo.gl` short links can only be
   minted from inside Google's infrastructure, so "use their shortener" is
   not available to us either. Instead: short canonical coordinate URLs on
   `maps.google.com` and `maps.apple.com`, roughly 48 characters each,
   which every messaging app renders as a tappable link.

   **What the user gives up:** the links are short, not tiny, and the
   default payload is three lines rather than one. A birder who wants the
   most compact possible share has the coordinates-only mode for exactly
   that.

3. **The clipboard payload is a labeled, multi-line block.** In the default
   mode: the coordinate line, then a Google Maps line, then an Apple Maps
   line, each link prefixed with the name of the service. Unlabeled URLs in
   a text message are ambiguous about which is which. In coordinates-only
   mode the payload is the single coordinate line.

4. **Coordinates are decimal degrees to five places, comma-separated
   (`38.54321, -121.98765`).** Five decimals is about one metre, matches
   what eBird displays, and is the format both Google Maps and Apple Maps
   accept pasted directly into their search boxes. That last property is
   load-bearing: it means the coordinate line is independently actionable,
   so the coordinates-only mode is genuinely useful rather than a
   degraded fallback.

5. **The setting is a two-option choice, defaulting to coordinates and map
   links.** Proposed option wording: "Copy coordinates and map links" and
   "Copy coordinates only". Two named options rather than a switch, because
   a switch cannot name both states. The default is the richer mode because
   it is a strict superset of the other and matches the stated use case of
   sharing by text. The app's usual off-by-default posture for new
   behavior does not apply here: that posture exists for options with a
   network or privacy implication, and this one has neither, since the
   links are constructed locally and nothing is fetched. It follows that
   the hydration-gating pattern from `useEmbeddedMediaPreference` is *not*
   needed here. There is no unsafe pre-hydration state to guard against,
   so the preference should hydrate to the default and not gate anything.

6. **The dropped pin is transient and session-scoped.** It is a share
   gesture, not a saved place. This follows established precedent: the
   v0.5.43 center pin is session-only and deliberately does not touch the
   saved Default Location, as are Point Size and the shading state.
   Persisting it would require a stored document, a lifecycle, and a
   "places" concept, which is a materially larger feature. One pin at a
   time per map; dropping again moves it. Dismissed by an explicit close on
   the popup, by Escape, and on leaving the map. Nothing is written to disk.

7. **Copy is an explicit press, never automatic on drop.** Silently
   overwriting the clipboard on a gesture the user may have made by
   accident is user-hostile, and on the search views that same gesture also
   re-runs a search. The popup shows the coordinates, which is useful on
   its own, and the user presses to copy. `copyText()` returns a boolean
   and can fail, so a failure must be shown and the text left visible and
   selectable for manual copying.

8. **A keyboard route is required, not optional.** Right-click and
   long-press are both pointer gestures with no keyboard equivalent, and
   the app holds a WCAG 2.1 AA commitment with a published statement
   (`ACCESSIBILITY.md`) that must stay true. The v0.5.43 center pin got its
   keyboard route from the lat/lng inputs that exist on those views; the
   Species Detail, Statistics, and Named Birds maps have no such inputs, so
   a route must be provided. The requirement is stated here; the mechanism
   is the Designer's and Architect's call.

9. **No privacy policy change is required, and that is a deliberate design
   outcome.** The feature adds no outbound request: coordinates are already
   on the device, links are constructed as local strings, and the clipboard
   is local. Per the v0.5.76 standing rule, a change that alters who talks
   to whom is a policy change, and this one does not alter that. This is
   recorded explicitly so the Security stage can verify the claim rather
   than rediscover the question. It is also the direct payoff of Decision 2:
   the shortener is what would have forced a policy change.

10. **Open questions carried into the build.**
    - The exact Apple Maps URL parameter form that reliably drops a labeled
      pin at a coordinate across iOS, macOS, and a non-Apple browser needs
      verification against live behavior during the build. This is an
      implementation detail, not a strategy call, but it must be checked
      rather than assumed.
    - The user referenced an earlier conversation about this feature that
      is not available in this session. Nothing here is attributed to it.
      If it settled anything contrary to these decisions, particularly the
      surface list in Decision 1 or the shortener resolution in Decision 2,
      that prior agreement should override this brief.
    - This feature is not currently an Up Next roadmap item. It was
      requested directly, which supersedes the roadmap; `ROADMAP.md` should
      be updated on ship.
