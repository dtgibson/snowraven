# PRD — Pin Share

**Feature:** pin-share
**Date:** 2026-08-08
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Pin Share lets a birder drop a transient pin on a SnowRaven birding map with a
right-click (desktop) or a long-press (touch), see that spot's coordinates on
screen, and copy a share-ready text block to the clipboard. A new Settings
preference chooses between copying coordinates plus Google Maps and Apple Maps
links (the default) or coordinates only. Everything is built locally as strings;
the feature makes no network request.

---

## User Stories

> **US-01** — As a birder who found a bird away from the marked hotspot, I want
> to drop a pin at the exact spot and copy it as a message I can text to another
> birder, so that they can tap a link and navigate straight there.

> **US-02** — As a birder sending a location into a maps app or a spreadsheet, I
> want to copy just the coordinate pair, so that I get a compact value with no
> link clutter.

> **US-03** — As a birder in the field on a phone, I want to long-press the map
> to place and copy a location, so that sharing a spot is a phone-native gesture
> and not a retyping exercise.

> **US-04** — As a birder using Map Explorer's Hotspots, Nearby Lifers, or Media
> Targets views, I want to copy the search center I just dropped, so that I get
> the share block without losing the drop-to-search behavior I already rely on.

> **US-05** — As a keyboard-only user, I want to reach a location and copy it
> without ever performing a pointer gesture, so that the feature is usable to me
> at all.

> **US-06** — As a birder with no signal at a remote site, I want the whole
> drop-and-copy flow to work offline, so that I can capture and share a spot
> when I get back to service.

---

## Functional Requirements

### Area A — Surfaces

**FR-01** — The app shall apply this feature to exactly the surfaces in the
table below, with the stated treatment per surface. No other map surface is in
scope.

| # | Surface | Where it lives | Gesture today | This feature adds |
|---|---|---|---|---|
| A | Map Explorer, My Sightings view | `MapExplorer.tsx`, `viewMode === 'sightings'` | free | Share pin |
| B | Map Explorer, Hotspots / Nearby Lifers / Media Targets | `MapExplorer.tsx`, `isCenterView` | Drops the search center (`CenterPinDropper`) | Copy action on the **existing** center pin |
| C | Species Detail, Sighting Locations, Pins mode | shared `components/SightingsMap.tsx` | free | Share pin |
| D | Species Detail, Sighting Locations, Heatmap mode | inline `SnowMap` in `SpeciesDetail.tsx` | free | Share pin |
| E | Statistics, Geographic Stats map | `BirdingStats.tsx` | free | Share pin |
| F | Named Birds, per-individual map | shared `components/SightingsMap.tsx` | free | Share pin (inherited from C) |
| — | Weather, Predict location picker | `PredictMap.tsx` | Left-click sets the picker pin | **Excluded** |

Surfaces C and F are one code change in the shared `SightingsMap`. Surface D is
a separate mount point: the Sighting Locations section has two render branches
(Pins and Heatmap) and the gesture must behave identically in both, so a user
toggling the mode does not silently lose the gesture.

**FR-02** — On surfaces A, C, D, E, and F ("the share-pin surfaces"), the app
shall drop a share pin at the pressed coordinate on a right-click (desktop
`contextmenu`) or a completed touch long-press, using the same gesture contract
already shipped in `CenterPinDropper` (v0.5.43): a hold threshold, a movement
slop tolerance, and a dedup window against a touch-synthesized `contextmenu`.

**FR-03** — The app shall leave left-click and tap behavior unchanged on every
map surface in FR-01, including the Predict picker. Existing pin selection,
popup opening, and layer click handling must behave exactly as they do today.

**FR-04** — The app shall cancel an in-progress long-press, dropping no pin and
changing no state, when any of the following occurs before the hold completes: a
pan, zoom, or drag begins; the touch point moves beyond the slop tolerance; a
second finger touches down (pinch); or the touch ends or is cancelled. A
cancelled gesture shall leave any previously dropped pin untouched and shall not
write to the clipboard.

**FR-05** — The app shall never call `preventDefault` on a touch event before
the long-press timer fires, so that ordinary panning is unaffected.

### Area B — Share pin behavior

**FR-06** — The app shall maintain at most one share pin per mounted map
instance. A second drop shall move the existing pin to the new coordinate rather
than creating a second pin.

**FR-07** — The app shall make the share pin draggable. On drag end, the pin's
displayed coordinates and the payload it would copy shall update to the new
position, and the popup shall stay open and follow the pin.

**FR-08** — On a share-pin surface, the app shall open the pin's popup as part
of the drop, showing at minimum: the coordinates as selectable text, a copy
control, and a keyboard-reachable close control.

**FR-09** — The app shall dismiss the share pin and its popup, together, on any
of: activating the popup's close control; pressing Escape while the popup is
open; or leaving the map (component unmount, tab switch, Species Detail species
change, Named Birds row collapse, Map Explorer view-mode change).

**FR-10** — The app shall treat entering or exiting Map Explorer's fullscreen
overlay as **not** leaving the map. The share pin and its popup shall survive the
fullscreen toggle.

**FR-11** — The app shall write nothing to disk or to any storage for the share
pin. A dropped pin shall not survive a page reload, an app relaunch, or a return
to the tab.

**FR-12** — The app shall allow a pin anywhere the map reports a coordinate,
including locations with no sightings, no hotspot, no county, and no atlas
block. The coordinate is not validated against the user's data and no data
lookup is performed.

**FR-13** — The gesture applies to the map canvas. Where a DOM marker element
sits above the canvas, a right-click landing directly on that marker may not
drop a share pin. This is accepted behavior, not a defect: the user can drop the
pin a few pixels away, and every surface also offers the FR-24 keyboard route.

### Area C — Map Explorer center-pin views (surface B)

**FR-14** — On surfaces B, the app shall leave the existing drop gesture's
behavior unchanged: it sets the search center and re-runs that view's search
exactly as it does today. No behavior a user has today may move, slow, or
require an extra step.

**FR-15** — The app shall add a copy affordance to the **existing** center pin
on surfaces B. It shall not introduce a second pin concept, a competing gesture,
or a mode toggle on those views.

**FR-16** — The app shall open the center pin's copy affordance only on an
explicit activation of that pin (click, tap, or keyboard activation). It shall
**not** auto-open on drop, so a drop-to-search is visually identical to today.

**FR-17** — The app shall make the center pin a real focusable control with an
accessible name that leads with its coordinates as displayed and then names the
action. Dragging the center pin shall continue to work and shall not be
converted into an activation.

**FR-18** — The app shall clear any share pin when the Map Explorer view mode
changes, in either direction between My Sightings and the three center views.

### Area D — Clipboard payload

**FR-19** — The app shall format a coordinate as decimal degrees, latitude then
longitude, each to exactly five decimal places, separated by a comma and a
single space: `38.54321, -121.98765`. No degree symbol, no hemisphere letters,
no leading plus sign, no thousands separators.

**FR-20** — The app shall normalize longitude into the range [-180, 180] before
formatting. MapLibre reports unwrapped longitudes after repeated antimeridian
panning, and an unwrapped value would produce a wrong maps link.

**FR-21** — In the default mode ("Copy coordinates and map links"), the app
shall build the payload as exactly three lines in this order, each separated by
a single newline:

```
38.54321, -121.98765
Google Maps: https://maps.google.com/?q=38.54321,-121.98765
Apple Maps: https://maps.apple.com/?q=38.54321,-121.98765
```

The first line is the FR-19 coordinate string. Each link line is the service
name, a colon, a single space, then the URL. No trailing newline.

**FR-22** — In the "Copy coordinates only" mode, the payload shall be the single
FR-19 coordinate line and nothing else.

**FR-23** — The app shall build the Google Maps link as
`https://maps.google.com/?q=<lat>,<lng>` and the Apple Maps link as
`https://maps.apple.com/?q=<lat>,<lng>`, where `<lat>` and `<lng>` are the same
five-decimal values from FR-19, comma-separated with **no space** inside the URL.
The Apple form is subject to verification per OQ-01.

**FR-24** — The app shall construct the entire payload locally from numeric
coordinates. No request of any kind may be made to build, shorten, resolve, or
validate any part of it.

### Area E — Copy action

**FR-25** — The app shall write to the clipboard only on an explicit user
activation of the copy control. Dropping, moving, or dragging a pin shall never
write to the clipboard.

**FR-26** — The app shall perform every clipboard write through `copyText()`
(`frontend/src/lib/clipboard.ts`). It shall not call `navigator.clipboard`
directly.

**FR-27** — On a successful copy, the app shall show a visible confirmation for
approximately two seconds and announce the result to assistive technology.

**FR-28** — When `copyText()` returns false, the app shall show an honest
failure message and reveal the complete payload as selectable text in the popup,
so the user can select it and copy manually. The app shall not claim a copy
succeeded.

**FR-29** — The copy shall use the preference mode in effect at the moment of
the press.

**FR-30** — The copy control shall make the active mode evident to the user
before they press it, so that a coordinates-only copy is never a surprise.

### Area F — The Settings preference

**FR-31** — The app shall present a two-option preference in the Settings tab
with exactly these option labels: **"Copy coordinates and map links"** and
**"Copy coordinates only"**. It shall use the existing accessible `RadioGroup`
pattern in `Settings.tsx` (`role="radiogroup"`, roving tabindex, Arrow / Home /
End navigation), not a switch.

**FR-32** — The default shall be "Copy coordinates and map links".

**FR-33** — The app shall persist the preference through the `storage` seam
(`storage.getSetting` / `storage.setSetting`), never `localStorage` directly and
never a component-local persistence path. The stored values shall be semantic
and label-agnostic: `'coords-and-links'` and `'coords-only'`.

**FR-34** — The preference shall hydrate to the default and gate nothing. Until
the stored value loads, and if the load fails, the default applies and the whole
feature is fully usable. The app shall **not** use the null-hydration gating
pattern from `useEmbeddedMediaPreference`; the reference pattern is
`DateFormatRow` in `Settings.tsx`.

**FR-35** — An absent, unrecognized, or malformed stored value shall be treated
as the default without error.

**FR-36** — A change to the preference shall take effect immediately across the
app, including for a share popup that is already open.

**FR-37** — The preference shall survive an app relaunch on desktop and a page
reload on web/Pi.

### Area G — Keyboard access

**FR-38** — The app shall provide, on every surface in FR-01, a route by which a
keyboard-only user can select or set a location and reach and activate its copy
control, using no pointer gesture. On surfaces B the existing latitude and
longitude inputs may serve as the location-setting half; on surfaces A, C, D, E,
and F no such input exists and a route must be provided. The mechanism is the
Designer's and Architect's call; the requirement is not optional.

**FR-39** — The share pin shall be a real focusable `<button>` (the app's DOM
map marker convention) whose accessible name leads with the coordinates exactly
as rendered on screen and then names the action.

**FR-40** — The share popup shall route Escape, the close control, and any
backdrop dismissal through one close path that returns focus to the element that
opened the popup. Where the opener unmounts on close, focus restoration shall
run after the close render commits.

---

## Non-Functional Requirements

**NFR-01 — Accessibility:** The feature shall meet WCAG 2.1 AA, consistent with
the published `ACCESSIBILITY.md`. Specifically: a keyboard route on every surface
(FR-38), real focusable button markers (FR-39), Escape-dismissible popups with
focus return (FR-40), an `aria-live`/`role="status"` announcement of the copy
result, an explicit accessible name on every new control, and accessible names
that lead with the visible label (WCAG 2.5.3 Label in Name).

**NFR-02 — Zero outbound requests:** The feature shall issue no network request
of any kind: no shortener, no geocoder, no tile fetch it does not already cause,
no telemetry. A network log during a full drop-drag-copy cycle shall show
nothing attributable to this feature. `PRIVACY_POLICY.md` shall require no new
entry. If any implementation path would introduce a request, it is out of scope
and must be raised rather than shipped.

**NFR-03 — Offline:** The feature shall function completely with no network
connection, on a map that has already loaded.

**NFR-04 — No new dependency or provider:** The feature shall add no npm
package, no backend route, no third-party service, and no bundled data asset.

**NFR-05 — Colors:** All colors shall use `var(--sr-*)` tokens. No hardcoded hex
or RGB values in any component file. Any new token shall be defined in both
`:root` and `[data-theme="dark"]` in `globals.css` before use, and any text
painted on a new fill shall clear 4.5:1 in both themes.

**NFR-06 — Responsive:** Every new surface shall hold at 320px viewport width
and at 200% in-app text scale with no horizontal page scroll. New fixed, dense
controls shall meet the ~44px touch-target posture in the ≤640 tier
(`.sr-touch-target`). No form control shall ship a sub-16px font size on phone
(`.sr-input-16`, applied to the control element itself). The share popup's body
shall use `.sr-map-popup-body` so it cannot run off a short phone viewport.
Layout shall be lifted to classes, not expressed as inline `display` /
`grid-template-columns` / `flex-wrap`.

**NFR-07 — Copy style:** No em dashes (U+2014) in any new user-facing copy. This
covers on-screen text, tooltips, `title`, `placeholder`, and `aria-label` values,
plus the `docs/HELP.md`, `README.md`, and `website/` prose written for this
feature.

**NFR-08 — Security:** The popup shall be built as escaped JSX, never
`dangerouslySetInnerHTML`. The payload and both URLs shall be built exclusively
from numeric, `toFixed(5)`-formatted coordinate values, so no user-supplied or
external text can reach a URL string. No user-supplied value is interpolated
into any outbound URL, so the feature adds no SSRF surface.

**NFR-09 — No regression to existing behavior:** The v0.5.43 center-pin gesture
semantics shall be reused, not re-implemented in parallel. On surfaces B the
drop-to-search path shall be verifiably unchanged. Existing left-click, popup,
marker, shading, heatmap, and layer behavior shall be unchanged on every surface.

**NFR-10 — Entry chunk:** No component reachable from `App.tsx`'s static import
graph may statically import `SightingsMap`, `SnowMap`, or
`react-map-gl/maplibre`. `frontend/src/lib/entryChunk.test.ts` shall stay green.

**NFR-11 — Render purity:** No impure call (`Date.now()`, `new Date()`) in a
component render body, `useMemo`, or `useCallback`. Timers and dedup timestamps
belong in event handlers and effects.

**NFR-12 — Testability:** Payload construction shall be verifiable in isolation
from any map, DOM, or clipboard, as a pure function of latitude, longitude, and
mode. Gesture cancel semantics shall be verifiable without a live map, following
the existing `CenterPinDropper.test.tsx` pattern.

---

## Out of Scope

- **Any third-party URL shortener.** Permanent exclusion, not a deferral (Key
  Decision 2).
- Saved, named, or listed pins. No pin history, no "my places", no persistence
  of a dropped pin across relaunch or tab switch.
- Sharing into a specific application: no Web Share API sheet, no SMS or email
  composer, no per-app share targets. The clipboard is the whole delivery
  mechanism.
- An "Open in Maps" button on the pin popup. The links go to the clipboard for
  someone else to tap.
- Alternate coordinate formats: degrees-minutes-seconds, Plus Codes,
  what3words, MGRS. Decimal degrees only.
- A reverse-geocoded place name in the payload. Deliberately excluded: it would
  require a Nominatim call, making a currently network-free feature
  network-dependent and putting the user's coordinate into an outbound request.
- The Weather tab's Predict picker map (Key Decision 1).
- Any change to left-click or tap behavior on any map.
- Elevation, distance-from-me, a shareable link back into SnowRaven, or a "share
  my current location" action.
- Altitude, accuracy, or timestamp metadata in the payload.
- A share pin on any map surface not listed in FR-01.

**Ship-time obligations (release process, not feature behavior).** These are
standing repo conventions and are required at ship, but they are deliberately not
functional requirements: update `docs/HELP.md` (and its `HelpDocs.tsx` sidebar
TOC, which has a parity test), `README.md`, `website/` (copy, feature list, and
the version pill), `ROADMAP.md`, `CHANGELOG.md`, and bump the version in both
`frontend/package.json` and `src-tauri/tauri.conf.json`. `PRIVACY_POLICY.md`
requires no change, and that is a verifiable claim (NFR-02), not an omission.

---

## Open Questions

**OQ-01 — The exact Apple Maps URL parameter form.**
Which parameter form reliably resolves to the coordinate and drops a pin across
iOS, macOS, and a non-Apple desktop browser needs verification against live
behavior during the build. It is an implementation detail, not a strategy call,
but it must be checked rather than assumed.
*Default assumption if unresolved:* ship
`https://maps.apple.com/?q=<lat>,<lng>` as specified in FR-23. If live testing
shows it does not reliably resolve to the coordinate, fall back to
`https://maps.apple.com/?ll=<lat>,<lng>&q=<lat>,<lng>` and update FR-23.

**OQ-02 — The Google Maps URL form.**
Lower risk than OQ-01 but on the same verification pass.
*Default assumption if unresolved:* ship
`https://maps.google.com/?q=<lat>,<lng>` as specified in FR-23.

**OQ-03 — Long-press under `cooperativeGestures`.**
Surfaces C, D, and F mount `SnowMap` with `cooperativeGestures`, which
intercepts one-finger touch interaction to let a thumb-drag scroll the page. A
stationary long-press should be unaffected, but this has not been proven on a
real touch device.
*Default assumption if unresolved:* the long-press fires normally and no change
is needed. If it does not fire, those surfaces still ship with the desktop
right-click plus the FR-38 keyboard route, and the touch limitation is
documented in `docs/HELP.md` rather than papered over.

**OQ-04 — Where the preference sits in Settings.**
`Settings.tsx` groups preferences under section headers, and the existing
"Appearance" card holds Color scheme, Text size, Date format, and Disable
embedded media. A copy-format preference is not an appearance setting.
*Default assumption if unresolved:* place it in its own section with an
accurate header rather than under "Appearance". The Designer decides the final
placement and header wording.

**OQ-05 — Making the center pin activatable while it stays draggable.**
FR-17 requires the center pin to become a real focusable control without losing
its drag. A click synthesized at the end of a drag must not be treated as an
activation.
*Default assumption if unresolved:* suppress activation when the pointer moved
beyond a small slop between press and release, mirroring the slop tolerance the
long-press gesture already uses.

**OQ-06 — The prior conversation referenced by the user.**
Carried forward from the brief. The user referenced an earlier conversation
about this feature that was not available to The Strategist, and nothing in the
brief or this PRD is attributed to it.
*Default assumption if unresolved:* this PRD governs. If that prior agreement
settled anything contrary to it, particularly the FR-01 surface list or the
shortener exclusion, the prior agreement overrides and this PRD must be amended
before the build proceeds.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01: surface coverage | A share pin can be dropped on Map Explorer My Sightings, Species Detail Pins mode, Species Detail Heatmap mode, the Statistics Geographic Stats map, and a Named Birds per-individual map. No share pin appears on the Weather Predict picker map. |
| QA-02 | FR-02: desktop gesture | A right-click on the canvas of each share-pin surface drops a pin at the clicked coordinate. |
| QA-03 | FR-02: touch gesture | A stationary long-press on the canvas of each share-pin surface drops a pin at the pressed coordinate. |
| QA-04 | FR-03: no left-click regression | On every surface in FR-01, a left-click or tap produces exactly the behavior it produced before this feature: sighting/hotspot/target/lifer pin selection, county and atlas popups, Statistics rank-pin popups, Predict picker pin placement. |
| QA-05 | FR-04: pan cancel | Starting a long-press and then panning before the hold completes drops no pin, opens no popup, and writes nothing to the clipboard. |
| QA-06 | FR-04: slop cancel | Starting a long-press and moving the touch point beyond the slop tolerance drops no pin. |
| QA-07 | FR-04: pinch cancel | Starting a long-press and touching a second finger down drops no pin. |
| QA-08 | FR-04: early release | Releasing the touch before the hold completes drops no pin and leaves any existing pin in place unchanged. |
| QA-09 | FR-04: dedup | A single touch long-press that the platform follows with a synthesized `contextmenu` drops exactly one pin, not two. |
| QA-10 | FR-05: pan unaffected | An ordinary one-finger pan (where the surface allows it) moves the map normally with no dropped pin and no suppressed default. |
| QA-11 | FR-06: one pin per map | With a share pin present, a second drop moves that pin to the new coordinate. Exactly one share pin is visible at all times. |
| QA-12 | FR-07: drag updates | Dragging the share pin and releasing updates the displayed coordinates to the new position, keeps the popup open, and the next copy carries the new coordinates. |
| QA-13 | FR-08: popup contents | The popup that opens on drop shows the coordinates as selectable text, a copy control, and a close control reachable by keyboard. |
| QA-14 | FR-09: close control | Activating the popup's close control removes both the popup and the pin. |
| QA-15 | FR-09: Escape | Pressing Escape while the popup is open removes both the popup and the pin. |
| QA-16 | FR-09 / FR-11: leaving the map | Switching to another tab and returning shows no share pin. Changing the Species Detail species, or collapsing the Named Birds row, clears the pin. |
| QA-17 | FR-10: fullscreen | Entering and exiting Map Explorer fullscreen with a share pin present leaves the pin and popup intact. |
| QA-18 | FR-11: nothing persisted | After dropping a pin, a desktop relaunch and a web reload both show no pin, and no new file or storage key holds pin coordinates. |
| QA-19 | FR-12: no-data location | A pin dropped over open ocean, and a pin dropped where the user has no sightings and no county coverage, both work identically and show correct coordinates. |
| QA-20 | FR-14: center views unchanged | On Hotspots, Nearby Lifers, and Media Targets, a right-click or long-press sets the search center and re-runs that view's search exactly as before, with the same result set and the same number of steps. |
| QA-21 | FR-15 / FR-16: center pin copy | On those three views, exactly one pin exists, no mode toggle appears, no popup opens on drop, and activating the center pin opens the copy affordance. |
| QA-22 | FR-17: center pin still draggable | The center pin can still be dragged to fine-tune, re-running the search on release, and a drag does not open the copy affordance. |
| QA-23 | FR-18: view-mode switch | Dropping a share pin on My Sightings and then switching to Hotspots clears the share pin; switching back shows no pin. |
| QA-24 | FR-19: coordinate format | A pin at 38.543210, -121.987654 copies the first line as exactly `38.54321, -121.98765`. A southern/western coordinate carries a leading minus and no hemisphere letter. |
| QA-25 | FR-19: independently actionable | The copied coordinate line alone, pasted into the Google Maps search box and into the Apple Maps search box, resolves to the intended spot. |
| QA-26 | FR-20: longitude normalization | After panning across the antimeridian so the map reports an unwrapped longitude, a dropped pin still formats a longitude within [-180, 180] and both links resolve to the correct spot. |
| QA-27 | FR-21: default payload | In the default mode the clipboard holds exactly three lines, in order: the coordinate line, `Google Maps: <url>`, `Apple Maps: <url>`, with no trailing newline. |
| QA-28 | FR-22: coordinates-only payload | In "Copy coordinates only" mode the clipboard holds exactly the one coordinate line and nothing else. |
| QA-29 | FR-23: links resolve | Both copied links, pasted into a messaging app, render as tappable links, and each opens the exact pinned spot in its respective maps application. |
| QA-30 | FR-24 / NFR-02: zero requests | A network log across mount, drop, drag, copy in both modes, and preference change shows no request attributable to this feature. |
| QA-31 | FR-25: never automatic | Dropping, moving, and dragging a pin never changes the clipboard. Clipboard contents set before the gesture are still intact after it. |
| QA-32 | FR-26: seam used | Copy works on the desktop app (Tauri) and on web/Pi, and the code contains no direct `navigator.clipboard` call for this feature. |
| QA-33 | FR-27: success feedback | A successful copy shows a visible confirmation that clears after roughly two seconds, and a screen reader announces the result. |
| QA-34 | FR-28: failure state | With `copyText()` forced to return false, the popup shows an honest failure message, reveals the complete payload as selectable text, and does not claim success. The revealed text can be selected and copied manually. |
| QA-35 | FR-29 / FR-36: mode at press time | Changing the preference while a popup is open causes the next press to copy the newly selected mode's payload. |
| QA-36 | FR-30: mode is evident | Before pressing, the user can tell from the copy control which mode is active. |
| QA-37 | FR-31: control shape | Settings shows a two-option radio group with exactly the labels "Copy coordinates and map links" and "Copy coordinates only", operable with Arrow, Home, and End keys, with only the checked option in the tab order. |
| QA-38 | FR-32: default | On a profile with no saved value, the selected option is "Copy coordinates and map links" and a copy produces the three-line payload. |
| QA-39 | FR-33: storage seam | The saved value goes through the storage seam under a single stable key with the values `coords-and-links` / `coords-only`, and no direct `localStorage` write is made for it. |
| QA-40 | FR-34: no gating | With the stored-value read artificially delayed and then made to fail, the control renders, the feature works, and the default payload is produced throughout. No spinner or disabled state blocks use. |
| QA-41 | FR-35: malformed value | A stored value of `""`, `null`, or `"nonsense"` is treated as the default with no error surfaced. |
| QA-42 | FR-37: persistence | Selecting "Copy coordinates only", relaunching the desktop app, and reloading the web app both show that option still selected and produce the one-line payload. |
| QA-43 | FR-38: keyboard route | Using only the keyboard, a user can select or set a location and copy it on each of the five surface groups in FR-01, with no pointer gesture at any step. |
| QA-44 | FR-39: focusable marker | The share pin is reachable by Tab, activates with Enter and Space, and its accessible name leads with the coordinates exactly as rendered on screen. |
| QA-45 | FR-40: focus return | Closing the popup by Escape and by the close control both return focus to the control that opened it, on every surface. |
| QA-46 | NFR-01: axe clean | An axe scan of each surface with a share pin and an open popup reports no new violations, and the copy result is announced via a live region. |
| QA-47 | NFR-02: privacy claim | `PRIVACY_POLICY.md` needs no new entry, and a reviewer can confirm this from the diff (no new host, no new request, no change to which component talks to whom). |
| QA-48 | NFR-03: offline | With the network disabled on an already-loaded map, drop, drag, popup, and copy all work in both modes. |
| QA-49 | NFR-04: no new dependency | `package.json` gains no dependency, no backend route is added, and no bundled data asset is added. |
| QA-50 | NFR-05: tokens | No hardcoded hex or RGB value appears in any file changed by this feature, and new UI renders correctly in both light and dark themes. |
| QA-51 | NFR-06: responsive | At 320px width and 200% text scale, the popup and the Settings control are fully usable with no horizontal page scroll; the popup body scrolls internally rather than running off a short viewport; new dense controls meet the ~44px touch posture at ≤640. |
| QA-52 | NFR-07: no em dashes | `grep -n '—'` over the changed `.tsx`/`.ts` user-facing strings, `docs/HELP.md`, `README.md`, and `website/index.html` returns no new hits. |
| QA-53 | NFR-08: security | The popup renders as escaped JSX with no `dangerouslySetInnerHTML`, and both URLs are assembled solely from numeric five-decimal coordinate strings. |
| QA-54 | NFR-09: no regression | The existing test suites for `CenterPinDropper`, `SightingMarkers`, `SightingsMap`, `CountyLayer`, `AtlasLayer`, and `BirdingStats` pass unchanged, and the center-view drop-to-search path is verifiably the same code path as before. |
| QA-55 | NFR-10: entry chunk | `npm run build` followed by `entryChunk.test.ts` passes, and `vendor-maplibre` remains absent from `dist/index.html`'s modulepreload. |
| QA-56 | NFR-11: render purity | `npm run lint` reports no `react-hooks/purity` violation, and `npm run build` (`tsc -b && vite build`) succeeds. |
| QA-57 | NFR-12: pure payload | A unit test asserts the exact three-line and one-line payload strings for a known coordinate in both modes, with no map, DOM, or clipboard involved. |
| QA-58 | FR-13: right-click over a DOM marker | A right-click landing directly on a DOM marker either drops a share pin or does nothing. It never breaks that marker's own behavior, never opens a browser context menu over the canvas, and never leaves the map in a stuck state. Dropping a few pixels away works normally. |

---
