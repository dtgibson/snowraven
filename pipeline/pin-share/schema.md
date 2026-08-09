# Schema — Pin Share

**Feature:** pin-share
**Date:** 2026-08-08
**Stage:** 3 — The Architect
**Source:** `pipeline/pin-share/prd.md` (approved)

---

## Path

**Frontend Only — no data layer changes required.**

## Confirmation

Assessed against every user story and functional requirement in the PRD. None
of them create, read-new, update, delete, or relate persistent records:

- SnowRaven has **no database and no ORM**. The backend is a FastAPI layer over
  the user's local eBird CSV export plus proxied third-party APIs. There is no
  schema to extend and no migration mechanism to invoke.
- **FR-11 forbids persisting the pin at all.** "The app shall write nothing to
  disk or to any storage for the share pin." The dropped pin is session-scoped
  React state by requirement, not by convenience.
- **FR-24 / NFR-02 forbid any network request**, and **NFR-04** forbids a new
  backend route, npm package, third-party service, or bundled data asset. So
  there is no new transport path, no dual-transport twin, and no
  `CACHED_GET_PATHS` entry.
- The **only** persisted state the feature adds is a single UI preference
  (FR-31 to FR-37). This project persists UI preferences through the existing
  `storage` seam (`frontend/src/lib/storage.ts`), which on desktop writes
  `AppLocalData/data/settings.json` via `tauri-plugin-fs` and on web/Pi goes
  through the existing `/settings/*` backend route. That is an established
  mechanism reused unchanged — a new key in an existing key-value store, not a
  schema change.

The classification holds. No migrations, no models, no data-layer work.

---

## Existing Data Used by This Feature

The feature reads **no user data at all**. FR-12 is explicit: the coordinate is
not validated against the user's data and no data lookup is performed. A pin
works identically over open ocean and over a heavily birded county.

The only inputs are:

| Input | Source | How used |
|---|---|---|
| `lngLat` of the gesture | MapLibre event (`e.lngLat`) | Becomes the pin coordinate. Never stored. |
| Map center | `map.getCenter()` | The keyboard route's coordinate source (FR-38). Never stored. |
| Center pin lat/lng | `MapExplorer` `lat` / `lng` string state | Surface B only. Already exists; unchanged. |

### Existing storage keys touched

| Key | Seam | Read/Write | Note |
|---|---|---|---|
| `shareCopyMode` | `storage.getSetting` / `storage.setSetting` | new key, read + write | The only persistence this feature adds. Values `'coords-and-links'` \| `'coords-only'`. |

No existing key is read or modified.

---

## No Data Layer Work Required

The Engineer proceeds directly to UI implementation. No migrations to write, none
to run, no backend change of any kind.

---

# Structural Design

The rest of this document is the structural design the Engineer needs. The PRD is
unusually implementation-shaped, and the real cost of this feature is not data —
it is **six mount points, one shared gesture, and one shared popup body**.

## 1. Integration-point map

Six map mounts across four files, plus the shared `SightingsMap` serving two of
them. Verified against the current code.

| # | Surface | File and mount | Treatment |
|---|---|---|---|
| **A** | Map Explorer, My Sightings | `components/MapExplorer.tsx` — the single `<SnowMap>` at ~L2164, gated `viewMode === 'sightings'` | mount `<SharePin>` |
| **B** | Map Explorer, Hotspots / Nearby Lifers / Media Targets | same `<SnowMap>`, the `isCenterView` branch at **L2203-2208** (`<CenterPinDropper onDrop={applyCenter} />` + `<CenterPin …>`) | **do not add a pin.** Make the existing `CenterPin` activatable and hang `<SharePopup>` off it |
| **C** | Species Detail, Sighting Locations, **Pins** mode | `components/SightingsMap.tsx` — the shared component's own `<SnowMap>`; called from `SpeciesDetail.tsx` **L1150** | mount `<SharePin>` inside `SightingsMap` |
| **D** | Species Detail, Sighting Locations, **Heatmap** mode | `components/SpeciesDetail.tsx` — the **inline** `<SnowMap>` at **L1152-1164** (a separate mount from C) | mount `<SharePin>` |
| **E** | Statistics, Geographic Stats | `components/BirdingStats.tsx` — the `<SnowMap>` at **L838-864**, behind the idle-deferred `mapReady` gate | mount `<SharePin>` |
| **F** | Named Birds, per-individual | `components/NamedBirdRow.tsx` **L153** → the lazy `SightingsMap` | **inherited from C**, zero new code |
| — | Weather, Predict picker | `components/PredictMap.tsx` | **excluded. Do not touch this file.** |

Two things the file layout hides and the Engineer must not miss:

- **C and D are two different `<SnowMap>` instances**, not one map with a toggle.
  Species Detail's `mapMode` picks between `<SightingsMap>` and an inline
  `<SnowMap>`. Adding the gesture to `SightingsMap` alone silently loses it in
  Heatmap mode (FR-01's explicit warning, QA-01).
- **C and F are one code change.** `SightingsMap` has exactly two consumers
  (`SpeciesDetail.tsx`, `NamedBirdRow.tsx`), so mounting `<SharePin>` inside it
  serves both. `SightingsMap` is not used anywhere else — verified by grep.

### Seams this feature must use

| Seam | Module | Why |
|---|---|---|
| Clipboard | `copyText()` from `lib/clipboard.ts` | FR-26. Never `navigator.clipboard`. Returns `boolean`; a `false` is a real, handled outcome (FR-28). |
| Storage | `storage.getSetting` / `setSetting` from `lib/storage.ts` | FR-33. Never `localStorage`. |
| Transport | **none** | NFR-02. The feature must not touch `lib/transport.ts` at all. |

---

## 2. Module boundary — what is pure library, what is component

This repo's convention is to push logic into `frontend/src/lib/*.ts` with
colocated vitest tests, and to keep components presentational. NFR-12 makes that
mandatory here: the payload must be verifiable "in isolation from any map, DOM,
or clipboard."

### New pure modules (`lib/`, no map imports, no DOM)

**`frontend/src/lib/shareLocation.ts`** — the whole payload, as pure functions.

```
export type ShareCopyMode = 'coords-and-links' | 'coords-only'

normalizeLongitude(lng: number): number          // FR-20
formatCoordinate(lat: number, lng: number): string   // FR-19
googleMapsUrl(lat: number, lng: number): string      // FR-23
appleMapsUrl(lat: number, lng: number): string       // FR-23
buildSharePayload(lat, lng, mode: ShareCopyMode): string  // FR-21 / FR-22
```

**One rounding site, not four.** `formatCoordinate` and both URL builders must
derive from a single internal helper returning the pair of five-decimal strings:

```
function fixed5(lat: number, lng: number): { lat: string; lng: string }
```

FR-23 requires the URLs to carry *the same five-decimal values* as the coordinate
line. If the formatter normalizes longitude and a URL builder does not (or vice
versa), the copied coordinate and the copied link point at different places, and
no test that checks them separately will catch it. Single-source it, and assert
in a test that the URL substring is built from the same strings the coordinate
line contains. This is the repo's parity-lock convention applied at the smallest
possible scale.

**`frontend/src/lib/shareCopyPreference.ts`** — the preference (see §5).

### New map-coupled modules (`components/map/`)

| File | Contents |
|---|---|
| `components/map/useMapLongPressDrop.ts` | The extracted gesture hook + its exported constants. See §3. |
| `components/map/SharePopup.tsx` | The share popup **body** — the one implementation, used by both pin hosts. |
| `components/map/SharePin.tsx` | The drop-gesture + draggable share pin + its `SharePopup`. Mounts as a `<SnowMap>` child on A, C, D, E, F. |

`components/map/` is the deliberate home for anything that imports
`react-map-gl/maplibre` — it keeps the entry-chunk boundary visible in the
directory structure (see §8). Do **not** put the gesture hook in `lib/`, even
though it is a hook; `lib/` is where map-free code lives and a stray import from
there is exactly how the maplibre chunk leaks onto first paint.

**`react-refresh/only-export-components`:** component files export only
components. Constants (`LONG_PRESS_HOLD_MS`, `LONG_PRESS_SLOP`,
`CONTEXTMENU_DEDUP_MS`) live in `useMapLongPressDrop.ts`, never in
`SharePin.tsx`. Same split as `lib/mediaEmbed.ts` ↔ `components/MediaEmbed.tsx`.

---

## 3. The gesture-sharing decision — extract, do not duplicate

**Decision: extract `CenterPinDropper`'s effect body into a shared hook. Both
consumers become thin wrappers. Zero behavior change to the center views.**

`CenterPinDropper` (`components/map/MapControls.tsx` L74-144) already implements
exactly the FR-02 / FR-04 / FR-05 contract: `HOLD_MS = 550`, `SLOP = 10`, an
800 ms `lastTouchFire` dedup against a touch-synthesized `contextmenu`, cancel on
`touchmove` past slop / `touchend` / `touchcancel` / `movestart` / `zoomstart` /
`dragstart`, a pinch guard (`touches.length !== 1`), an `onDrop` ref so listeners
bind once, and no `preventDefault` anywhere. Read that effect: **nothing in it is
center-specific.** Only the component's name is.

```
components/map/useMapLongPressDrop.ts
  export const LONG_PRESS_HOLD_MS = 550
  export const LONG_PRESS_SLOP = 10
  export const CONTEXTMENU_DEDUP_MS = 800
  export function useMapLongPressDrop(onDrop: (lat: number, lng: number) => void): void
      // ← verbatim move of the existing effect body

components/map/MapControls.tsx
  export function CenterPinDropper({ onDrop }) { useMapLongPressDrop(onDrop); return null }

components/map/SharePin.tsx
  useMapLongPressDrop(handleDrop)   // same hook, different handler
```

Why extraction rather than duplication or parameterization:

- **NFR-09 states it directly**: "The v0.5.43 center-pin gesture semantics shall
  be reused, not re-implemented in parallel."
- This repo has been bitten repeatedly by parallel implementations drifting
  (the `codes`/`formCodes` parity twins, `mapPins.ts`'s stop-table
  single-sourcing, the `namedBirdKey` parity test). A second copy of a
  seven-cancel-case gesture is the highest-drift-risk code in this feature.
- **It makes NFR-09 self-proving.** `components/map/CenterPinDropper.test.tsx`
  must pass **byte-unchanged** after the extraction. The component's props,
  render output, and bound-handler set are identical, so an unchanged green suite
  *is* the QA-54 evidence that the center-view path did not move. Do not edit
  that test file.
- `LONG_PRESS_SLOP` becomes the single source for OQ-05's activation guard too,
  which the PRD's default assumption asks for in words ("mirroring the slop
  tolerance the long-press gesture already uses"). Reuse the constant, do not
  retype `10`.

Rejected: parameterizing `CenterPinDropper` with a variant prop (the name would
lie on five of six surfaces, and Map Explorer would mount the same component
twice meaning two different things), and a second null-rendering
`<ShareDropper>` component (the share pin needs state anyway, so a hook composes
into it without a redundant child).

---

## 4. State ownership, and "one pin at a time"

**`<SharePin>` owns its own coordinate.** One `useState<{lat, lng} | null>`
inside the component, one instance per `<SnowMap>`.

```
const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null)
```

This gives four requirements structurally, with no coordination code:

- **FR-06 (one pin per map).** A single state slot cannot hold two pins. A second
  drop is `setPin(next)` — a move, not an addition. There is nothing to
  de-duplicate.
- **FR-11 (nothing persisted).** Component state is unreachable from the storage
  seam by construction.
- **FR-10 (fullscreen survives).** Map Explorer's fullscreen is a CSS class swap
  on an ancestor (`mapContentClass`), not a remount — the `<SnowMap>` keeps its
  JSX position, so React preserves the subtree and the pin survives. **This is
  the reason not to lift pin state up into `MapExplorer`**: lifting works too,
  but component-local state gets FR-10 for free and keeps five call sites at one
  line each.
- **FR-09 (leaving the map clears it).** Unmount destroys the state. Tab switch,
  Named Birds row collapse (the `singleOpen` accordion unmounts the row's map),
  and Map Explorer view-mode change (the `viewMode === 'sightings'` guard
  unmounts `<SharePin>`) all clear the pin with no extra code.

### The one case unmount does *not* cover

**Species Detail species change.** The map lives under `{selectedSpecies && …}`
in the same JSX position, so switching species re-renders with new data and does
**not** unmount. The pin would survive, violating FR-09 and QA-16.

Do **not** fix this by keying `<SightingsMap>` — that remounts the whole map,
churning the WebGL context and re-running the bounds fit on every species change.

Fix it at the smallest scope:

- `SightingsMap` takes an optional `sharePinResetKey?: string | number` and
  forwards it as `<SharePin key={sharePinResetKey} … />`. Only the tiny SharePin
  remounts; the map is untouched.
- `SpeciesDetail` passes `selectedSpecies` on **both** branches — the
  `<SightingsMap>` call at L1150 *and* the inline `<SharePin key={selectedSpecies}>`
  in the heatmap branch. Two branches, two fixes, and **a test for each**. This
  repo's standing lesson applies exactly: a caller that reaches the same child
  down two independent paths must be fixed at both, and a single combined test
  passes on a half-fix.
- `BirdingStats` and `NamedBirdRow` need no key (no entity change / unmount on
  collapse).

### FR-18 on Map Explorer

Sightings → center view unmounts `<SharePin>` (the pin is gone). Center →
sightings mounts a fresh one with `null` state. Structural, both directions. The
center views' own `<SharePopup>` open-state must be cleared on `viewMode` change
— see §7.

---

## 5. The preference: shape, key, and how it reaches an open popup

```
frontend/src/lib/shareCopyPreference.ts

export const SHARE_COPY_SETTING_KEY = 'shareCopyMode'
export const DEFAULT_SHARE_COPY_MODE: ShareCopyMode = 'coords-and-links'

export function normalizeShareCopyMode(raw: unknown): ShareCopyMode {
  return raw === 'coords-only' ? 'coords-only' : DEFAULT_SHARE_COPY_MODE
}

export function useShareCopyMode(): ShareCopyMode
export function setShareCopyMode(next: ShareCopyMode): void
```

| Property | Value | Requirement |
|---|---|---|
| Key | `'shareCopyMode'` | FR-33. camelCase, matching `'dateFormat'` / `'disableEmbeddedMedia'`. |
| Values | `'coords-and-links'` \| `'coords-only'` | FR-33 — semantic and label-agnostic, so a future label rewording touches only the option copy. |
| Default | `'coords-and-links'` | FR-32 |
| Malformed | anything not exactly `'coords-only'` → default, no error | FR-35. Same "only the exact literal wins" shape as `normalizeDisableEmbeddedMedia`. |
| Gating | **none** | FR-34 |

### Explicitly NOT the `useEmbeddedMediaPreference` pattern

FR-34 forbids it, and the reason is worth keeping next to the rule.
`useEmbeddedMediaPreference` holds `null` during hydration and derives
`embedAllowed === false` from it, because a pre-hydration flash there would fire
a **third-party iframe request** the user opted out of. Pin Share has no unsafe
pre-hydration state: the default mode is a strict superset of the other, builds
locally, and issues no request. So it hydrates **to the default** and gates
nothing — the control renders immediately, the feature is fully usable before
and even if the read never resolves (QA-40).

### FR-36 is the part that needs an architectural choice

FR-36 requires a preference change to take effect immediately across the app,
**including for a share popup that is already open**. Settings and the map tabs
are separate component subtrees, so the `DateFormatRow` shape (per-component
`useState` + effect) is the right *hydration* model but cannot propagate a change
sideways.

**Use a module-level store read through `useSyncExternalStore`** — this repo's
blessed external-store pattern (`lib/useIsPhone.ts`), and render-pure by
construction:

```
let current: ShareCopyMode = DEFAULT_SHARE_COPY_MODE   // module-level
const listeners = new Set<() => void>()

subscribe(fn)      → adds fn; on the FIRST subscriber, kicks off the one-time
                     storage.getSetting hydrate (effect-time, never during render)
getSnapshot()      → current                     // pure, stable identity
getServerSnapshot()→ DEFAULT_SHARE_COPY_MODE

useShareCopyMode() = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

setShareCopyMode(next):
  current = next; listeners.forEach(fn => fn())        // immediate, app-wide
  void storage.setSetting(SHARE_COPY_SETTING_KEY, next).catch(() => {})
```

This satisfies FR-36 (Settings and every open popup re-render off one value),
FR-34 (the snapshot is the default from the very first render — never `null`,
never a spinner), FR-29 (the popup's payload memo depends on `mode`, so the press
uses the mode in effect at press time), and NFR-11 (`getSnapshot` returns a
stable module value; hydration starts inside `subscribe`, which React calls in a
passive effect).

Hydration must run **once per session**, guarded by a module flag — not once per
subscriber. Five maps plus Settings can subscribe simultaneously.

### Settings UI

`Settings.tsx` reuses the existing `RadioGroup` (L40-86: `role="radiogroup"`,
`role="radio"` children, roving tabindex, Arrow/Home/End) — FR-31, and **not** a
switch, since a switch cannot name both states. `DateFormatRow` (L637-698) is the
row-shape reference: heading, one-line description, `RadioGroup`. The new row
differs in one way — it reads `useShareCopyMode()` instead of holding local
state, and calls `setShareCopyMode` instead of writing storage inline.

**OQ-04 (placement):** the Designer's call. A copy-format preference is not an
appearance setting, so the PRD's default assumption (its own section with an
accurate header, not under "Appearance") stands unless the Designer says
otherwise. No architectural consequence either way.

---

## 6. `SharePopup` — the one popup body, two hosts

```
components/map/SharePopup.tsx
  props: { lat: number; lng: number; onClose: () => void; compact: boolean }
```

This is the reuse boundary that keeps surface B from growing its own copy UI.
`SharePin` renders it under a dropped pin; `MapExplorer`'s center views render it
under the existing `CenterPin`. One implementation, one accessible-name formula,
one failure state.

Internals:

- `const mode = useShareCopyMode()`
- `const payload = useMemo(() => buildSharePayload(lat, lng, mode), [lat, lng, mode])`
  — pure, no impure call (NFR-11).
- The coordinate line renders as **selectable text** via `formatCoordinate` (FR-08).
- The copy button's label **names the active mode** (FR-30) — it must read
  differently in the two modes so a coordinates-only copy is never a surprise.
  Exact wording is the Designer's.
- `onClick`: `const ok = await copyText(payload)` (FR-25/26 — only on explicit
  activation; drop, move, and drag never write). `ok === true` → visible
  confirmation cleared after ~2 s (FR-27, the `WeatherForecastPanel.doCopy`
  shape at L317-323). `ok === false` → honest failure message **plus the full
  payload revealed as selectable text** (FR-28). Never claim success.
- **The live region must pre-exist its own text change.** Render an
  always-present `<span role="status" className="sr-only">` and change its
  *content*; do not conditionally mount the region at copy time. This repo has
  already been burned by a live region that mounted together with its message
  (the `TabLoading` / App-level live-region note) — such an announcement is
  delivered inconsistently.
- Clear the 2 s timer on unmount (the popup can close mid-timeout).
- `.sr-map-popup-body` on the body div (NFR-06) so it cannot run off a short
  phone viewport.
- Escaped JSX only. No `dangerouslySetInnerHTML` (NFR-08).
- `compact` is a **required** prop, not defaulted — the Named Birds card map
  (`.sr-named-map`, `switcher={false}`) is far smaller than the Species Detail
  and Map Explorer maps and wants a denser body. Required rather than defaulted
  per this repo's `MediaFrame` precedent: a default that encodes a display
  decision is invisible at the call site and silently hands the next caller a
  choice they did not make.

### FR-40 — one close path, focus restored

Route the popup's close button, Escape, and any backdrop dismissal through a
single `close()`. Do not rely on maplibre's own Escape handling.

The complication: FR-09 removes **the pin and the popup together**, so the pin
button — the natural focus-restore target for a keyboard user — unmounts as part
of closing. Two consequences:

1. Record the **opener** at open time in a ref: the keyboard-route button's
   element for a keyboard open, or `null` for a pointer drop (fall back to the
   map's canvas container, `map.getCanvasContainer()`, which is focusable and
   keeps the user on the map).
2. Restore focus **after the close render commits**, via the flag-ref-in-effect
   pattern already used by `closeSidebar` / `restoreFiltersFocusRef` in
   `MapExplorer.tsx`. Restoring at `close()` time targets an element that is
   about to unmount.

---

## 7. Surface B — making `CenterPin` activatable without disturbing the search

`applyCenter` (`MapExplorer.tsx` L945-955) is the drop-to-search path. **Do not
edit it, and do not edit the `<CenterPinDropper onDrop={applyCenter} />` line.**
QA-54 asks a reviewer to confirm the center-view drop path is *the same code
path as before*; the cheapest way to make that true is for it to be literally
untouched.

Changes confined to `CenterPin` (`MapControls.tsx` L150-166) and one new sibling
in `MapExplorer`:

- Wrap the existing teardrop SVG in a real `<button type="button">`, keeping
  `neutralizeMarkerWrapper` on the `<Marker>` ref — the app's DOM-marker
  convention, and exactly the shape `SightingsMap`'s pins already use (L69-71).
  FR-17 / FR-39.
- `aria-label` **leads with the coordinates as displayed, then names the action**
  (FR-17, WCAG 2.5.3 Label in Name). The displayed coordinates are the lat/lng
  inputs, which `applyCenter` writes with `toFixed(5)` — the same precision
  `formatCoordinate` produces, so build the name from `formatCoordinate` and the
  two agree by construction.
- `draggable` + `onDragEnd={onMove}` stay exactly as they are (FR-14, QA-22).
- **FR-16 — no auto-open on drop.** The popup's open state is new state in
  `MapExplorer` (`centerShareOpen`), set **only** by the button's click handler.
  `applyCenter` never touches it, so a drop-to-search is visually identical to
  today.
- Clear `centerShareOpen` when `viewMode` changes (FR-18) and when the center
  becomes invalid.
- On a center **drag**, `applyCenter` updates `lat`/`lng`, the `<SharePopup>`
  reads those same values, so an already-open popup follows the pin and its next
  copy carries the new coordinates. No extra wiring.

### OQ-05 — activation vs. drag (take a position)

**Position: guard with a drag-suppression ref, not a timestamp.** A maplibre
marker drag can end with a synthesized `click` on the marker element, which would
open the copy affordance and fail QA-22.

```
onDragEnd      → suppressClickRef.current = true   (plus the existing onMove)
onPointerDown  → suppressClickRef.current = false
onKeyDown      → suppressClickRef.current = false
onClick        → if (suppressClickRef.current) { suppressClickRef.current = false; return }
                 openCenterShare()
```

Why this shape rather than the PRD's default assumption (a pointer-movement slop
comparison):

- It is **deterministic and unit-testable** — no wall clock, so it needs no
  `Date.now()` and cannot flake under test load. NFR-11 stays trivially satisfied.
- A pure slop check has a hole the suppression ref does not: keyboard `Enter`
  and `Space` fire `click` with **no preceding `pointerdown`**, so a naive
  "did the pointer move?" guard must special-case them or it swallows every
  keyboard activation.
- Clearing on `pointerdown` closes the mirror-image hole: if maplibre does *not*
  synthesize a click after a given drag, a latched `suppress = true` would
  otherwise swallow the user's next genuine click.

Residual edge: a keyboard `Enter` issued as the very first input after a drag,
with no intervening pointer or key event, is swallowed once. `onKeyDown` clearing
the ref covers it. If live testing shows maplibre's drag click arrives on a path
this misses, fall back to *adding* the slop check using `LONG_PRESS_SLOP` from
`useMapLongPressDrop` — do not retype the constant.

Test it the way the repo tests the gesture: extend the drag/click cases into a
`CenterPin` test, asserting (a) drag-then-synthesized-click does **not** open,
(b) keyboard Enter **does** open, (c) a normal click after a pointerdown **does**
open.

---

## 8. Entry chunk — the constraint that shapes the file layout

`frontend/src/lib/entryChunk.test.ts` walks `App.tsx`'s static import graph and
asserts no statically-reachable file imports `maplibre-gl` or `react-map-gl/*`
(NFR-10, QA-55). **`Settings.tsx` is statically imported by `App.tsx` (L25).**

That makes one rule load-bearing:

> **`lib/shareLocation.ts` and `lib/shareCopyPreference.ts` must be map-free.**
> Settings imports the preference module, which puts it on the entry graph. If
> either ever imports a map type or a map component — even a `import type` that
> a later refactor turns into a value import — the ~1 MB maplibre vendor chunk
> lands on first paint.

Keep `ShareCopyMode` declared in `lib/shareLocation.ts` (map-free by contract)
and re-exported from `lib/shareCopyPreference.ts`. Both stay importable from a
bare unit test with no map in sight, which NFR-12 wants anyway.

Reachability of the new map-coupled files, all lazy-only and therefore safe:

| File | Reached from | Status |
|---|---|---|
| `components/map/useMapLongPressDrop.ts` | MapExplorer (lazy), SharePin | off entry |
| `components/map/SharePin.tsx` | MapExplorer / SpeciesDetail / BirdingStats (all `lazy()`), SightingsMap (lazy via App's `importSightingsMap` and NamedBirdRow's own `lazy()`) | off entry |
| `components/map/SharePopup.tsx` | SharePin, MapExplorer | off entry |

The existing "no statically-reachable file imports maplibre" assertion already
covers the Settings hazard automatically once `shareCopyPreference` joins the
graph — which is a nice property, but **extend `entryChunk.test.ts`** with
explicit absence assertions for `components/map/SharePin.tsx`,
`components/map/SharePopup.tsx`, and `components/map/useMapLongPressDrop.ts`, per
the standing instruction to extend that test rather than rely on manual build
inspection.

---

## 9. The keyboard route (FR-38) — the Architect's call

FR-38 leaves the mechanism to the Designer and Architect but makes the
requirement non-optional. Surfaces A, C, D, E, F have no lat/lng inputs.

**Mechanism: `SharePin` renders its own real `<button>` that drops the pin at the
current map center.**

- Activation reads `map.getCenter()`, sets `pin`, opens the popup, moves focus
  into the popup, and records the button as the FR-40 opener.
- MapLibre's keyboard handler already pans with arrow keys and zooms with `+`/`-`
  from the focused canvas (and `SnowMap.handleLoad` disables only *rotation*,
  L146-150 — plain arrow panning is intact). So a keyboard user pans to the spot,
  activates the button, and Tabs to Copy. No pointer gesture at any step.
- **One mechanism serves all five surfaces at once**, because it lives inside the
  component every one of them already mounts. Surface B needs nothing new — FR-38
  accepts its existing lat/lng inputs as the location-setting half.

**Flag for the Designer — the map corners are already occupied.** Every corner of
a SnowMap has a tenant: `NavigationControl` top-left, the base switcher
(`.sr-map-layers`) top-right, `AttributionControl` bottom-left, and on Map
Explorer the FAB cluster (`.sr-map-fab-cluster`, fullscreen + Filters) bottom-
right. Surface A is the tight one. Placement, and whether the control is a
persistent affordance or a visually-subtle one, is the Designer's decision; the
architecture only requires that it be a real focusable `<button>` inside the map
container with a z-index above the map controls (the repo's floating-overlay
convention is `z-index: 1200`).

`compact` (§6) also governs this control's density on the Named Birds card map.

---

## 10. Risks and edge cases the Engineer must handle

### OQ-03 — long-press under `cooperativeGestures` (surfaces C, D, F)

`SightingsMap` (L58) and Species Detail's heatmap `SnowMap` (L1160) both set
`cooperativeGestures`, which disables one-finger drag-pan and shows an overlay
screen over the canvas. A **stationary** long-press should be unaffected — no
`touchmove`, so nothing triggers the overlay — but the overlay element's stacking
could in principle keep `touchstart` from reaching the canvas.

**Position: proceed as designed, verify on a real touch device, and note the
failure is a graceful degradation rather than a redesign.** If the map-level
`touchstart` does not fire on those three surfaces:

- Desktop right-click is unaffected, and the §9 keyboard route already gives
  those exact surfaces a pointer-free path — so they still ship complete, with
  the touch limitation documented in `docs/HELP.md` (the PRD's stated fallback).
- **Pre-approved technical fallback**, so this is not re-architecture: bind the
  touch listeners on `map.getCanvasContainer()` instead of via `map.on(...)`,
  with `{ passive: true }`. The listeners must stay passive — FR-05 forbids any
  `preventDefault` before the timer fires, and a passive listener makes that
  structurally impossible. Everything else (timings, cancels, dedup) stays inside
  `useMapLongPressDrop`, so the change is confined to one file and both consumers
  inherit it.

### FR-13 / QA-58 — right-click landing on a DOM marker

On C/D/E/F the pins are DOM `<Marker>` elements with real `<button>` children
above the canvas. A right-click on one never reaches maplibre's `contextmenu`
map event, so no share pin drops — which FR-13 explicitly accepts. But maplibre
suppresses the native browser context menu only *over the canvas*, so a
right-click on a marker button may pop the OS context menu.

**Recommendation: add `onContextMenu={e => e.preventDefault()}` to the DOM marker
buttons on the in-scope surfaces.** It changes no left-click, tap, drag, or
keyboard behavior, and it makes the right-click gesture feel uniform across the
map instead of sometimes summoning a browser menu. Verify against QA-58's exact
wording during QA; if the Auditor reads QA-58 as only governing the canvas, this
is optional polish rather than a requirement.

### Formatting edges in `shareLocation.ts`

Both are exact-string requirements (QA-24, QA-26), so both need a test:

- **Negative zero.** `(-0.000001).toFixed(5)` is `"-0.00000"`. FR-19 wants no
  decoration a reader would not expect; strip the sign when the rounded magnitude
  is all zeros, so a coordinate just west of the prime meridian formats `0.00000`,
  not `-0.00000`. (Plain `(-0).toFixed(5)` is already `"0.00000"` — it is the
  *rounds-to-zero* case that leaks the minus.)
- **Exactly ±180.** The FR-20 wrap `((lng + 180) % 360 + 360) % 360 - 180` maps
  `180` to `-180`. Both name the antimeridian and both resolve correctly in
  Google and Apple Maps, so accept it — but assert it in a test so the behavior
  is a decision on the record rather than a surprise.

### OQ-01 / OQ-02 — the maps URL forms

Unchanged from the PRD: ship `https://maps.google.com/?q=<lat>,<lng>` and
`https://maps.apple.com/?q=<lat>,<lng>`, verify both live during the build, and
fall back to `https://maps.apple.com/?ll=<lat>,<lng>&q=<lat>,<lng>` if the Apple
form does not reliably resolve to the coordinate. Because both URLs come out of
`shareLocation.ts`, a change to the Apple form is a one-line edit plus a test
update — no component touches a URL string.

### NFR-02 — the zero-request claim must stay verifiable

Nothing in this design imports `lib/transport.ts`, adds a backend route, or
resolves a name. That is what makes QA-30 and QA-47 checkable from the diff and
`PRIVACY_POLICY.md` provably unchanged. If any implementation path starts to want
a request (a place name, a link check, a shortener), it is out of scope and must
be raised, not shipped.

---

## 11. Expected test surface

Named here so the Tester and Engineer agree up front:

| Test | Covers | Note |
|---|---|---|
| `lib/shareLocation.test.ts` | QA-24, 26, 27, 28, FR-19-23, NFR-12 | Exact strings, both modes. Plus `-0`, ±180, antimeridian unwrap, and a URL-vs-coordinate-line consistency assertion. No map, DOM, or clipboard. |
| `lib/shareCopyPreference.test.ts` | QA-38, 40, 41, FR-34/35 | Malformed values → default; the snapshot is the default before hydration resolves and if it rejects. |
| `components/map/CenterPinDropper.test.tsx` | QA-54, NFR-09 | **Unchanged.** Green after extraction = the proof. |
| new `SharePin` gesture test | QA-05-09 | Reuse the fake-MapLibre harness at the top of `CenterPinDropper.test.tsx` (it records bound handlers, no live map). |
| new `CenterPin` activation test | QA-21, 22, OQ-05 | Drag-then-click does not open; keyboard Enter does; ordinary click does. |
| `SharePopup` test | QA-33, 34, 35 | Success confirmation, `copyText → false` failure state with the payload revealed, and a mode change reaching an open popup. |
| `lib/entryChunk.test.ts` | QA-55, NFR-10 | Extend with the three new `components/map/` files. |

---

## Summary for the Engineer

No migrations. No backend. No transport. Six mount points, and the whole feature
reduces to:

1. Two map-free `lib/` modules — the payload and the preference.
2. One extracted gesture hook that `CenterPinDropper` and `SharePin` both call.
3. One `<SharePopup>` body used by two different pin hosts.
4. One `<SharePin>` mounted as a one-line child on five surfaces.
5. `CenterPin` promoted to a real activatable button, with `applyCenter`
   untouched.
6. One `RadioGroup` row in Settings.
