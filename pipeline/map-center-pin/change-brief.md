# Change Brief — map-center-pin

## What is changing

Add a draggable **center pin** to the Map Explorer's three center-using views —
Hotspots, Nearby Lifers, and Media Targets — so the user can set the map's search
center by dropping a pin, the way the Predict weather/tide tab already lets you pin
a location. Placement gestures: **right-click** on desktop and **long-hold** on
touch (both net-new, deliberately distinct from left-click so they don't collide
with the existing hotspot/sighting/atlas popup selection). The pin is **draggable**
to fine-tune. The 4th view (My Sightings) is unaffected — it doesn't use a center.

Scoped on the Improve track (re-scope from the New-Feature boundary): it reuses the
Predict pin pattern and the existing shared center model, adds no new data, schema,
or design-system work.

## Why now

User request: selecting the map center today means "Use my location", a place-name
search, manual lat/lng, or the saved default. A drop-a-pin gesture is a faster, more
direct way to point the three nearby-search views at a spot.

## Agreed behavior (product decisions)

- **Auto-run:** dropping or moving the pin sets the shared center AND re-runs the
  active view's search (re-running on the drop and on drag-**end**, so dragging to
  fine-tune doesn't fire a request per pixel). "Drop a pin, see what's there."
- **Session-only:** a dropped pin updates the in-session center only — it does NOT
  overwrite the saved default (`map-defaults`), exactly like "Use my location"
  today. The saved default stays a deliberate Settings choice.

## User-facing impact

A new way to set the search center on the Hotspots / Nearby Lifers / Media Targets
maps. No change to what those views show or to any existing control (search box,
Use-my-location, manual coords, radius all keep working and feed the same center).

## Scope / files (from investigation)

- **`frontend/src/components/MapExplorer.tsx`** — the center is one shared
  `lat`/`lng` (strings, `toFixed(5)`) + `radius` state driving all three query
  handlers (`handleFindHotspots` / `handleFindSightings` / `handleFindLifers`),
  which fire imperatively (no reactive refetch). Add an `applyCenter(lat,lng)`
  helper that mirrors `handleUseMyLocation` (set lat/lng, position the pin, dispatch
  the active view's find handler) and call it from the new gesture + the pin drag.
- **New map child `CenterPinDropper`** (rendered inside `<SnowMap>` alongside
  `MapEffects`/`BoundsTracker`): binds `map.on('contextmenu', …)` for desktop
  right-click and a hand-rolled long-press timer for touch (`touchstart` → ~550ms,
  cancel on `movestart`/`zoomstart`/`touchmove` past a ~10px slop / `touchend` /
  second touch; no `preventDefault` until the long-press actually fires, so panning
  is never hijacked — the one real piece of engineering care).
- **Draggable center marker** — a single DOM `<Marker draggable>` mirroring
  `DetectedLocationPin` (`components/map/MapControls.tsx`) plus `onDragEnd → applyCenter`;
  keyboard-operable via `neutralizeMarkerWrapper` + a real `<button>` (per the DOM-marker
  a11y convention). DOM (not a GL layer) per CLAUDE.md — one draggable instance, and it
  sidesteps the base-switch / `source id changed` GL pitfalls. Shown only in the three
  center-using views. The Engineer reconciles it with the existing detected-location dot
  (simplest: the center pin is the canonical search-center marker).
- **Discoverability** — right-click / long-hold are invisible; add a short hint by the
  center controls (e.g. "Right-click or long-press the map to set the center") and
  document it in `docs/HELP.md`.
- **Release chores** (per CLAUDE.md): version bump `frontend/package.json` +
  `src-tauri/tauri.conf.json`, `CHANGELOG.md`, `README.md`/`docs/HELP.md`, and
  `website/` if the feature list is touched.

## Decisions touched

None reversed. Adds a new input method to the existing Map Explorer center-selection
capability. The Chronicler records the new gesture/affordance at closeout.

## What done looks like

- Right-click (desktop) and long-hold (touch) on a Hotspots / Nearby Lifers / Media
  Targets map drops a center pin there; the center updates and the active view
  re-runs for that spot.
- The pin drags to fine-tune; drag-end re-runs the search. Existing left-click pin
  and popup selection still works (no collision); panning is never hijacked by the
  long-press.
- Session-only — the saved default in Settings is untouched.
- Works in map fullscreen; the marker is keyboard-accessible; a discoverability hint
  is present.
- Full CI mirror green (lint + typecheck + vitest + build).
