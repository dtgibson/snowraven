# Design Spec — Search This Area

**Feature:** search-this-area
**Date:** 2026-08-16
**Stage:** 4 — The Designer
**Source:** design.html (approved by the user), prd.md, schema.md, strategic-brief.md
**Design system:** `pipeline/design-system.md` — this feature stays inside it. Two
deliberate extensions are noted at the end for the Chronicler.

The approved mockup is `pipeline/search-this-area/design.html`. It is fully
interactive with switchable states and is the visual source of truth. Where this
spec and the mockup differ, the difference is called out in-line with its reason;
there are exactly three, all of them cases the mockup could not render.

---

## Visual Direction

The map already knows how to speak: floating white chrome with a soft shadow, the
green reserved for "actionable or active", and nothing coloured that does not need
to be. This feature adds one labelled action to that vocabulary and one honest
statement about what was covered, and it borrows every surface treatment from
controls already on the canvas rather than inventing a new one.

The register is quiet and factual. The control looks pressable without shouting;
the searched area is communicated by dimming what was *not* searched rather than
by drawing attention to what was, so the map is unchanged in the ordinary case and
speaks only when there is something to say. Red-orange appears exactly once, on the
circle's edge, because it is the one hue this canvas has not already spent.

---

## Decisions

Eight calls, each with the reasoning that produced it, so a later change is
deliberate rather than drift.

### D-01 — The map answers three questions in three places, split by interactivity

The top-centre anchor holds only transient `pointer-events: none` statements: the
shipped loading chip, and the new search-outcome line. The action itself is not
top-centre.

**Reasoning.** The split is by *interactivity*, not by feature. On a 320px phone at
200% text scale anything in the top-centre anchor passes over the top-right layers
switcher. That is acceptable only while the switcher stays fully operable
underneath, which is true of a `pointer-events: none` statement and false of a
control. No interactive control may take this anchor.

### D-02 — The control is its own full-width row in the bottom FAB cluster

This **reverses OQ-03's top-centre default** and reverses the schema's §7 placement.

**Reasoning.** The top-centre pill was built first, because that is the idiom and
what the PRD assumed. Measured in Chromium at 320px it puts a persistent, tappable
control over the layers switcher: 206 x 31px at 100% text scale and 294 x 148px at
200%, where it buries the switcher completely. That disqualifies it. In the FAB
cluster the control goes where this map's other actions already live, and three
properties follow at no cost:

- The cluster grows **upward** (it is bottom-anchored), so no shipped button moves.
- A full-width row consumes **none** of the FAB row's measured 4.00px of horizontal
  slack at 320px / 200%.
- It inherits `.sr-ios-app .sr-map-fab-cluster`'s bottom safe-area inset (NFR-02)
  rather than needing a new rule.

Measured overlap with the layers switcher in the approved placement is **zero at
every scale**, clearing it by 365px at 100% and 91px at 200%.

**Consequence for the schema.** The schema's Designer flag #1 ("the top-centre slot
is viable for the control and probably not for a visible outcome card") is inverted
by this design, and the inversion is the point: the 96px free-band figure it cites
was measured against the *location-failure* strings, which are long instructions
rendering 227px tall. The longest canonical message *this* feature produces is 73
characters and wraps to four lines. See D-05 and the caveat in Content Notes.

### D-03 — The searched area is communicated primarily by dimming the ground outside it

An 18% scrim over everything outside the searched circle, not a ring.

**Reasoning.** A covering radius (FR-08) circumscribes the viewport, so immediately
after a press the circle's edge is **off screen** and a ring alone would be
invisible at exactly the moment the feature is working. Dimming inverts that:
nothing dims while the search covers what is on screen, and the moment the user pans
or zooms out, the uncovered ground greys. This also makes the capped case (FR-09,
QA-19) self-explanatory without a word of copy: the circle is visibly smaller than
the screen and the scrim says which pins are outside the answer.

### D-04 — The circle's edge, when on screen, is a dashed red-orange ring over a soft halo

**Reasoning.** Dashed because it is the one line idiom this map does not already use
for a real boundary (county lines and atlas grids are solid), so shape carries the
meaning before colour does. Red-orange because it is the only genuinely free hue on
this canvas: green is sighting pins and the search-centre pin, amber is personal
locations, violet is target pins, blue is rank, purple is the breeding ramp, green
again is the county ramp, and slate is every boundary line. The halo is a wide, soft
underlay so the edge reads over pale streets **and** over dark satellite imagery
without needing a fill.

### D-05 — A failure is the same outcome element re-tokenized plus an icon

Not a second card in a second place. The outcome region is one element that is a
pill when the text is short and a block when it is long; a failure changes only its
colour tokens and adds an `AlertCircle`.

**Reasoning.** FR-22's stated reason for announcing failures is that the sidebar is
off screen on a phone, which argues the failure text should be *visible*, not only
announced. When it is visible, the visible node and the announced node must be the
**same** node (the `.sr-map-geo-error` precedent) — never a duplicate `.sr-only`
announcer, which would put the same sentence into the reading order twice. The retry
affordance is the control itself, back in the corner it never left: a failed search
writes no record (FR-16), so the control returns as soon as the fetch settles, and
the cluster never moves a button.

### D-06 — One curve, arrive only

190ms `cubic-bezier(0.16, 1, 0.3, 1)`, the app's shipped `sr-map-geo-in`. The
control grows upward out of its cluster (`transform-origin: bottom center`); the
top-anchored outcome line does the opposite. No exit animation on the control.

**Reasoning.** The control has no exit because the loading chip appearing **is** the
feedback, and a fade would only delay it. The searched area fades up over 220ms with
the dashed edge landing 60ms behind the halo, so the ground settles and then the
edge sharpens. Full detail in Motion Spec.

### D-07 — The result line auto-dismisses after six seconds; failures persist

**Reasoning.** The dimmed area is the durable answer; the count is a confirmation. A
confirmation has no reason to become permanent furniture over the layers switcher. A
failure is an unresolved state and stays until the next search clears it.

### D-08 — The control uses the app's shipped active treatment, not an accent-filled slab

Accent ink on `--sr-accent-bg` inside the strong accent border — the treatment
`.sr-share-drop-btn[aria-pressed="true"]` already ships.

**Reasoning.** A solid accent fill on this canvas means *sighting pin*. An
accent-filled slab would read as data, not as chrome. The tinted treatment also
keeps the control distinguishable from the `.sr-map-filters-btn` pill sitting in the
same cluster on a phone, which **is** accent-filled — two labelled pills, two
different jobs, two different weights.

---

## Screens / Views

There is one screen (the Map Explorer map surface) in five states across three
views. The control's label and treatment are identical on all three views; only the
accessible name and the outcome sentence name the search.

### Layout anatomy

```
map area  (the positioned ancestor: MapExplorer.tsx's
           <div style={{ flex: 1, position: 'relative' }}>)
│
├─ top-centre, z 1050, pointer-events: none  ── THE STATEMENT SLOT
│   ├─ .sr-map-loading-chip          (shipped, unchanged)
│   └─ .sr-map-search-status         (new live region)
│       └─ .sr-map-search-status-msg (new, keyed child)
│
├─ top-right ── layers switcher (shipped, must stay fully operable)
│
└─ bottom-right, z 1050 ── .sr-map-fab-cluster (shipped)
    ├─ .sr-map-geo-error             (shipped, full-width row)
    ├─ .sr-map-search-area-row       (NEW, full-width row)
    │   └─ .sr-map-search-area-btn   (NEW, the control)
    ├─ share slot / centre-share disc, locate, fullscreen  (shipped discs)
    └─ .sr-map-filters-btn           (shipped, phone only)
```

The two top-centre occupants are **mutually exclusive in time**: each handler clears
the outcome before its fetch, so the chip always has the slot to itself (FR-14 makes
this structural, not remembered).

### State 1 — Just searched

The derived radius covers the viewport, so the circle circumscribes the screen and
its edge is off the map. **Nothing is dimmed**, which is the honest reading:
everything visible was searched. The control is absent because the record now
matches the viewport (FR-13). The outcome line is the confirmation and clears itself
after six seconds.

### State 2 — Panned away

The circle stayed put while the map moved under it (FR-18), so its edge is now on
screen and the ground beyond it has greyed. The control has arrived in the FAB
cluster, above the discs, in the position it occupies every time. The pins on screen
are visibly the answer to a different question.

### State 3 — In flight

The control is suppressed so a second press cannot stack a second lookup (FR-14).
The outcome line was cleared before the fetch, which is what leaves the top-centre
slot to the chip alone. Existing pins dim slightly while the fetch runs (a shipped
behaviour, unchanged; the mockup reproduces it at 0.45 opacity for context only).

### State 4 — Capped at 25 miles

The viewport wanted more than `DERIVED_MAX_MI` allows, so the circle is visibly
smaller than the screen and the scrim says which pins are outside the answer. This
is the case the indicator exists for and the reason the circle is never allowed to
claim the whole view. **No copy changes** — see Content Notes.

### State 5 — Failed

The same outcome element in error tokens with an `AlertCircle`, carrying the real
message the sidebar also shows. The record was not written, so the control is
already back. Retry is one press, in the corner the thumb was already resting in,
with no trip to the sidebar.

### Responsive behaviour

| Configuration | Behaviour |
|---|---|
| Desktop | Control is a compact pill; cluster and switcher never interact. |
| 320px / 100% text | Control's touch box 44px; clears the switcher by 365px. |
| 320px / 200% text | Control's touch box 88px, discs 88px, Filters pill wraps beneath; cluster clears the switcher by 91px. Only the outcome line passes over the switcher, and only while it is on screen. |
| Phone Filters overlay open | Control absent (FR-04), by position — see Engineer note E-02. |
| iOS fullscreen | Control inherits the cluster's bottom inset; status region inherits the panel's top padding. Neither adds its own inset. |

---

## Component Usage

Nothing new is introduced into the component library. Every treatment below is
lifted from a shipped rule.

| Element | Built from | Notes |
|---|---|---|
| The control | `<button type="button">` styled as the loading chip's 20px pill (same shadow, same padding rhythm) escalated to the `.sr-share-drop-btn[aria-pressed="true"]` active treatment | Plus `.sr-touch-target` for NFR-03, following `.sr-map-filters-btn` |
| Control icon | Lucide `Search`, 14px, `stroke-width` 2.2 | Design-system icon rule (11–15px, purposeful only) |
| Control row | `flex: 0 0 100%` inside the cluster, exactly `.sr-map-geo-error`'s shape | Cluster's own `row-gap` is the gap, `justify-content` the alignment, `max-width` the cap |
| Outcome region | `role="status" aria-live="polite"` with a sequence-keyed single child | The `.sr-map-geo-error` / `SharePopup.tsx` house contract, verbatim |
| Outcome message (result) | `--sr-surface` on `--sr-border`, 14px radius, chip's shadow | Reads as a pill when short, a block when long |
| Outcome message (failure) | `--sr-error` on `--sr-error-bg` inside `--sr-error-border`, plus Lucide `AlertCircle` 14px | The already-audited pair (4.82:1 light, 7.07:1 dark) — no new contrast guard needed |
| Searched area | Three MapLibre GL layers under the marker layers | Scrim fill, halo line, dashed line |
| Search centre | The **shipped** search-centre pin, unchanged | An accent dot inside a red-orange ring reads as centre-and-extent with no explanation. No new mark is minted. |

### The three GL layers

| Layer id | Type | Paint |
|---|---|---|
| `sr-search-area-scrim` | `fill` | `fill-color` from `--sr-search-area-scrim-rgb`, `fill-opacity` 0.18 |
| `sr-search-area-halo` | `line` | `line-color` from `--sr-search-area-rgb` at `line-opacity` 0.20, `line-width` 9 |
| `sr-search-area-line` | `line` | `line-color` from `--sr-search-area-rgb` at `line-opacity` 0.95, `line-width` 2.5, `line-dasharray` [3.6, 2.8], `line-cap` round |

`line-dasharray` is expressed in **line-widths**, not pixels: the mockup's SVG
`stroke-dasharray: 9 7` at `stroke-width: 2.5` is `[3.6, 2.8]` in MapLibre units.

The scrim geometry is a single Polygon with **two rings** — outer ring a world
rectangle, inner ring the search circle — so the hole needs no mask and no second
source. The schema specifies `areaCirclePolygon`; this design needs a companion
`areaScrimPolygon(record, steps)` producing that two-ring Polygon. Build the outer
ring **relative to the record centre** (`lng ± 180`, `lat ± 89.9`) so the hole is
always strictly interior and the schema's deliberate antimeridian-continuous vertex
longitudes are preserved rather than torn.

---

## Design Tokens Applied

Every colour is a `var(--sr-*)` token. Two are new.

### The two new tokens

Declared in **both** `:root` and `[data-theme="dark"]` of
`frontend/src/globals.css`, with **identical values in both blocks**:

```css
/* Searched-area indicator (search-this-area). Map-anchored: only ever drawn on
   the always-light Positron basemap, so declared IDENTICALLY in :root and
   [data-theme="dark"] — the same posture as --sr-share-pin, --sr-map-pin-* and
   the county ramp. This duplication is the design, not an oversight;
   theme-flipping would wash the ring out over a light base and would invert the
   scrim into a lightening wash in dark mode, which is not what it means.
   No text is ever painted on either fill, so no on-fill text pair is minted. */
--sr-search-area-rgb: 180, 52, 31;
--sr-search-area-scrim-rgb: 15, 17, 23;
```

| Token | Value | Hex | Role |
|---|---|---|---|
| `--sr-search-area-rgb` | `180, 52, 31` | `#B4341F` | The dashed edge and its halo |
| `--sr-search-area-scrim-rgb` | `15, 17, 23` | `#0F1117` | The dim over unsearched ground, at 0.18 |

Both are `-rgb` triplets rather than hex, because both are consumed at an alpha
(0.95 / 0.20 / 0.18) — the repo's established `rgba(var(--sr-*-rgb), a)` pattern.

**On `#B4341F`.** It is the same value as `--sr-share-pin`, already measured at
**5.38:1 on Positron land (`#F2F1EC`)**, comfortably past the 3:1 WCAG 1.4.11 bar
for a non-text graphic and with the margin that keeps it legible over satellite.
Reusing the measured value rather than minting a near-neighbour is deliberate: the
two never co-occur as a data class (the share pin is a planted flag, this is a
boundary line), and one red-orange in the palette is one fewer to keep audited.

**On `#0F1117`.** It is `--sr-text`'s light value — the app's own ink, never pure
black, which is the house rule for every shadow and overlay in this codebase.

### Shipped tokens used unchanged

| Token | Applied to |
|---|---|
| `--sr-accent` | Control ink. 5.09:1 on `--sr-accent-bg` light, 7.75:1 dark. Both clear AA. |
| `--sr-accent-bg` | Control fill |
| `--sr-accent-border-strong` | Control border |
| `--sr-surface` | Control hover fill; outcome message (result) fill |
| `--sr-border` | Outcome message (result) border |
| `--sr-text-muted` | Outcome message (result) text; control text in the retained state |
| `--sr-error`, `--sr-error-bg`, `--sr-error-border` | Outcome message (failure) |

No hardcoded hex or rgb value appears in any changed component file. The GL paint
resolves the `--sr-*` tokens at runtime and re-resolves on a `data-theme` change via
the `MutationObserver` contract `CountyLayer` uses — **not** the basemap-anchored
literal exception, even though the values are theme-identical, because the token
route keeps the values in the one place a future audit will look.

---

## Interaction Notes

### The control

- **Visible text** is exactly `Search this area` on all three views, with the Lucide
  `Search` glyph at 14px preceding it.
- **Appearance** is governed entirely by FR-01's six conditions. It arrives with the
  D-06 motion; it leaves instantly.
- **Hover** is a 120ms background and border-colour shift to `--sr-surface` /
  `--sr-accent`. No scale, no pulse, no lift.
- **Focus** uses the app's global focus ring (2px `--sr-accent`, 2px offset).
- **Retained already-searched state (FR-24)** keeps the same box in muted tokens
  (`--sr-text-muted` on `--sr-surface`, `--sr-border`), sets `aria-disabled="true"`,
  suppresses the arrive animation, and takes `cursor: default`. It uses
  `aria-disabled`, **never** the `disabled` attribute, which drops focus to `<body>`.
- **Touch** reaches `2.75rem` min-height in the ≤640 tier via `.sr-touch-target` and
  scales with in-app text, matching the FAB row.
- On a phone the control's label may wrap; give it `white-space: normal` and
  `text-align: center` in the ≤640 tier rather than letting it push the row.

### The outcome region

- Rendered **at all times**, in every state, never hidden while idle. `display: none`
  removes an element from the accessibility tree and is the documented way to make a
  live region fail to announce.
- Contains **nothing but** the keyed message node, so its `textContent` is exactly
  what is read.
- **Cleared at the top of each handler, before the fetch.** That is what makes single
  occupancy of the top-centre slot structural rather than remembered.
- **Every route announces**, not only this control — the sidebar Find button, the
  place-name search, "Use my location", a dropped or dragged centre pin, and the
  search a view-mode change fires. On a phone the sidebar is not on screen, so this
  is a strict accessibility gain on the shipped routes. This confirms the schema's
  deliberate reading.
- A **result** clears itself after **6000ms**; a **failure** does not and persists
  until the next search. Implement the dismissal as a timer that is cleared on any
  new announcement, and never as a render-time clock read (NFR-04).
- The region is `pointer-events: none`, and so is its message node. Every tap passes
  through to the layers switcher underneath, which is the entire justification for
  the top-centre anchor (D-01).

### The searched area

- **Always on once a record exists.** Nothing hides it in the "just searched" state:
  the circle simply circumscribes the viewport, its edge is off screen, and no ground
  is dimmed. Geometry does the work, so there is no visibility state to get wrong.
- **Inert by construction.** The component registers **no `map.on(...)` of any kind**,
  and none of the three layer ids appears in `MARKER_LAYERS` or
  `INTERACTIVE_MAP_LAYERS`. This matters more here than the schema anticipated: the
  scrim is a world-covering `fill`, which is the maximum possible hit surface, and a
  `fill` is hit-tested at any opacity. See Engineer note E-04.
- **Per-view (FR-19).** Switching views shows the incoming view's record or nothing.
  Records are not cleared on a view switch, so switching back restores that view's
  circle.

---

## Motion Spec

One curve throughout: `cubic-bezier(0.16, 1, 0.3, 1)`, the app's shipped
`sr-map-geo-in` easing. Every duration is under 300ms. Every animation's **end state
is its resting state**, which is what makes the global reduced-motion collapse
lossless.

| Interaction | Easing | Duration | Transform origin | Reduced motion | Mechanism |
|---|---|---|---|---|---|
| Control arrives | `cubic-bezier(0.16, 1, 0.3, 1)` | 190ms | `bottom center` — it grows up out of the bottom-anchored cluster | Inherited global collapse to 0.001ms | New CSS `@keyframes sr-search-area-arrive` (`opacity 0 → 1`, `translateY(8px) scale(0.965) → none`) |
| Control leaves | none | 0ms | n/a | n/a | Unmount. The loading chip appearing is the feedback. |
| Control hover | `cubic-bezier(0.16, 1, 0.3, 1)` | 120ms | n/a | Inherited global collapse | CSS `transition` on `background`, `border-color` |
| Outcome line arrives | `cubic-bezier(0.16, 1, 0.3, 1)` | 190ms | top-anchored: `translateY(-6px) → 0`, the mirror of the control | Inherited global collapse | Reuse the **shipped** `@keyframes sr-map-geo-in`. Replays for free on a repeat because the sequence-keyed child remounts, so the visual cue and the announcement stay in lockstep by construction. |
| Outcome line leaves | none | 0ms | n/a | n/a | Unmount at the 6s timer or on the next announcement |
| Scrim fades up | MapLibre's internal transition curve | 220ms, delay 0 | n/a | **Duration 0** — see below | `fill-opacity-transition: { duration, delay }` |
| Halo fades up | MapLibre's internal transition curve | 220ms, delay 0 | n/a | **Duration 0** | `line-opacity-transition` |
| Dashed edge fades up | MapLibre's internal transition curve | 220ms, **delay 60ms** | n/a | **Duration 0, delay 0** | `line-opacity-transition`. The ground settles, then the edge sharpens. |
| Loading chip spinner | linear | 0.7s infinite | n/a | Frozen by the global block; the chip's *shape* carries the state | Shipped `.spin`, untouched |

### Reduced motion — the one thing that is not free

**The DOM pieces inherit the app's global reduced-motion collapse for free.**
`globals.css`'s `@media (prefers-reduced-motion: reduce)` block sets
`animation-duration: 0.001ms !important` and `transition-duration: 0.001ms
!important` on `*, *::before, *::after`. Because every animation in this feature ends
in its resting state, collapsing them loses nothing. **No per-component
reduced-motion query may be added for the DOM pieces**, per the standing note beside
`sr-map-geo-in`.

**The GL paint transitions are NOT reached by that block.** MapLibre paint-property
transitions are configured in JavaScript and rendered on the canvas; no CSS rule
touches them. `SearchedAreaLayer` must therefore **read `matchMedia` in its effect
and pass duration 0**:

```ts
// lib/scroll.ts already exports the shipped, non-DOM-guarded predicate. Reuse it —
// do not re-inline matchMedia here.
import { prefersReducedMotion } from '../../lib/scroll'

const t = prefersReducedMotion() ? 0 : 220
const ringDelay = prefersReducedMotion() ? 0 : 60
```

Two further notes the mockup could not express:

- **MapLibre's transition easing is not configurable.** `-transition` accepts
  `{ duration, delay }` only. The `cubic-bezier(0.16, 1, 0.3, 1)` the mockup writes
  on its SVG classes cannot be carried across to the GL layers, so the area's curve
  matches the DOM's approximately rather than exactly. This is accepted: the two
  never animate side by side at a distance where the difference is readable.
- **Read the media query at effect time, not in render** (NFR-04). It is a live
  environment read; treat it exactly as the repo treats `navigator.onLine`.

---

## Content Notes

Every string this feature renders, verbatim. The repo's **no em dash** rule applies
to all of it; none uses one, and none needs one.

### The control label

| Element | Copy |
|---|---|
| Visible text, all three views | `Search this area` |

### The control's accessible name, per view

Each contains the visible text **verbatim** (WCAG 2.5.3) and all six are pairwise
distinct from the ten existing map-control names FR-03 enumerates.

| View | Accessible name | Retained (FR-24) state |
|---|---|---|
| `hotspots` | `Search this area for hotspots` | `Search this area for hotspots. This area has already been searched.` |
| `targets` | `Search this area for recent sightings` | `Search this area for recent sightings. This area has already been searched.` |
| `lifers` | `Search this area for nearby lifers` | `Search this area for nearby lifers. This area has already been searched.` |

### The success outcome sentence, per view

| View | n = 0 | n = 1 | n > 1 |
|---|---|---|---|
| `hotspots` | `No hotspots found in this area.` | `1 hotspot found in this area.` | `{n} hotspots found in this area.` |
| `targets` | `No recent sightings of your target species found in this area.` | `1 recent sighting found in this area.` | `{n} recent sightings found in this area.` |
| `lifers` | `No nearby lifers found in this area.` | `1 location with nearby lifers found in this area.` | `{n} locations with nearby lifers found in this area.` |

The `targets` zero-form is deliberately **not** the plural form's noun phrase. It is
the longer sentence that distinguishes an empty result from a broken search, which is
the whole point of FR-21. Do not regularize it.

### The capped case

**The wording does not differ.** A capped search announces the ordinary sentence for
its view with its own count. The capped case is carried entirely by **geometry** —
the circle is visibly smaller than the viewport and the scrim greys the ground
outside it — not by copy.

Reasoning: a sentence such as "searched a 25 mile radius, which covers part of this
view" is a caption on a picture the user is already looking at, it would need three
per-view variants and a plural form each, and it would put an apology in the one
place the feature has good news to deliver. The `capped` flag on `DerivedArea` stays
available on the derivation for a test to assert against (QA-19) and drives no copy.

### The failure message

**This feature mints no failure copy.** The outcome region announces and displays
the *existing* message the sidebar already shows — `classifyOverlayError(...).message`
from `MapExplorer.tsx:121` — verbatim, so the two surfaces can never disagree. The
canonical set reachable through this path:

| Source | String |
|---|---|
| `BACKEND_DOWN_MESSAGE` | `Can't reach the SnowRaven server. Make sure it's running, then try again.` |
| `OFFLINE_MESSAGE_SHORT` | `You're offline. This needs a connection.` |
| 401 branch | `eBird API key not configured. Add it in Settings.` |
| `NO_KEY_MESSAGE` | `API key not configured. Add it in Settings.` |
| Fallbacks | `Failed to fetch hotspots.` / `Failed to fetch recent sightings.` / `Failed to fetch nearby lifers.` |

**A caveat that corrects the mockup.** The mockup states "the longest message this
feature can produce is 73 characters". That is true of the canonical set above
(`BACKEND_DOWN_MESSAGE` is exactly 73), and it is what the 320px / 200% failure
frame was drawn against — but it is **not a bound**. `classifyOverlayError`'s final
branch returns `detail ?? fallback`, where `detail` is a server-supplied
`TransportError.detail` of unbounded length. The design is already robust to this
(the region wraps, has no truncation, and grows from pill to block), so nothing
changes — but:

- Do **not** size the region to 73 characters.
- Do **not** write a test asserting a maximum message length.
- Do **not** truncate. A truncated failure message is a failure message that cannot
  be acted on, and the announced node is the visible node.

### Validation errors are out of scope for announcement

The `validationError(...)` early returns ("Enter a valid latitude and longitude",
"No target species to search for", and the taxonomy-codes failure) are searches that
never ran. They keep today's sidebar-only behaviour and are not announced here. This
confirms the schema's reading.

---

## For The Engineer and The Tester

### Two named open items — measured against a reproduction, not the real app

These are carried forward explicitly rather than buried, because both were measured
against the mockup's frames and **neither has been measured against the running
app**. Each needs settling during the build.

> **OI-01 — The FAB cluster's height at 200% text scale on the shortest supported
> phone, with a simultaneous location-failure row present.**
>
> The mockup never rendered `.sr-map-geo-error` and the new control row together. The
> cluster is documented as growing from 134px to 371px tall once a location-failure
> message is in it; adding an 88px control row plus a 10px `row-gap` on top of that,
> at 200% text scale on a short phone, may push the cluster's top edge into or past
> the layers switcher — or off the top of the map area entirely.
>
> **Measure both rows present, at 320px and 200%, on the shortest supported phone
> viewport**, element box and text ink against the map area's content box.
> `document.scrollWidth` is not admissible evidence and can certify a broken build.
> If it does not fit, the design's preference is to let the **location-failure** row
> yield (it is the rarer state and already has a documented shortening path via
> `BACKEND_DOWN_MESSAGE_SHORT`), not the control.
>
> **This item is also why the row's DOM order is specified as it is — see E-01.**

> **OI-02 — How the 18% scrim survives satellite imagery and an active county or
> atlas shading ramp.**
>
> The scrim was designed and measured over the light Positron basemap. Two
> configurations were not measured and both eat it from opposite directions: the
> **satellite** raster base is dark and busy, where an 18% dark wash may be
> imperceptible; and an **active county or atlas shading ramp** is a saturated tinted
> overlay that the scrim sits on top of, where the wash may either vanish into the
> tint or muddy the ramp's own tier legibility (the county ramp's adjacent steps are
> guarded at only ~1.21:1, so a wash over them is not free).
>
> Note that this is a direct consequence of the layer order: `beforeId` places the
> scrim just below the marker layers, which is **above** the atlas and county fills.
> That is the correct reading — the scrim dims "the ground", overlays included — but
> it means the interaction is live, not hypothetical.
>
> Measure the scrim over: Positron, Satellite, Topo, county shading on, county
> textures on, and atlas breeding shading on. If 0.18 does not hold across all six,
> the sanctioned fix is a **basemap-conditional alpha** (the `BasemapDesaturation`
> precedent already reads the active base), not a change to the token's colour.

### Things not to miss

**E-01 — The control row goes AFTER `.sr-map-geo-error` and BEFORE the discs.**
The mockup's comment reads "above the location-failure row", which is true of the
mockup **as drawn** — it renders no geo-error row. Resolved here in the other
direction, deliberately, because the cluster is bottom-anchored: with the control row
below the geo-error row, the control's offset from the bottom is **invariant to the
presence of a location-failure message**. That is precisely the property the
geo-error row's own comment exists to protect ("the retry button never moves under
the user's finger") and precisely the property D-02 and D-05 claim. Placing the
control row first would move it whenever a location failure appeared or cleared.

Resulting visual order, top to bottom:
`[location-failure message] [Search this area] [share, locate, fullscreen] [Filters]`

**E-02 — Put the row inside the shipped `{!sidebarOpen && (<>…</>)}` fragment.**
It becomes the fragment's **first** child, immediately before `.sr-map-fab-slot`.
This satisfies **FR-04 by position** — no duplicated `!sidebarOpen` condition to
write, and none that can drift from the one the shipped discs use. It also keeps DOM
order equal to visual order equal to tab order, with no CSS `order` anywhere
(WCAG 2.4.3).

**E-03 — The row needs no `pointer-events: auto` of its own.** The shipped
`.sr-map-fab-cluster button { pointer-events: auto; }` is a descendant selector and
already re-enables a `<button>` nested one level deeper. Declare
`pointer-events: none` on the row (matching `.sr-map-geo-error`) and stop there.

**E-04 — The scrim is a world-covering `fill`, and a `fill` is hit-tested at any
opacity.** The schema anticipated only a line; this design adds the largest possible
hit surface to the map. Its id must appear in **neither** `MARKER_LAYERS` nor
`INTERACTIVE_MAP_LAYERS`, the component must register **no `map.on(...)`**, and a
comment must say so — that sentence is what makes FR-18 structural. QA-20 must go red
if `sr-search-area-scrim` is added to either list; run that mutation.

**E-05 — The status region is anchored `left: 12px; right: 12px` and centres its
child.** It is **not** `left: 50%; transform: translateX(-50%)`, the way the shipped
loading chip is. An absolutely positioned box with only `left` set shrink-to-fits
against the space from that edge, so the 50% form gives a wrapping message **half**
the map width — measured in the mockup as 8 lines where 4 were expected. The chip
gets away with it because it is effectively single-line; this region is not.

**E-06 — Neither new element gets its own safe-area rule, for two different
reasons.** The control inherits `.sr-ios-app .sr-map-fab-cluster`'s bottom inset by
living inside the cluster. The status region is top-anchored inside the map-area div,
which the fullscreen panel's `.sr-ios-app` top padding has already displaced inward —
adding an inset there would **double-inset**. The schema's stylesheet assertion (no
safe-area rule on the control, via `findUngatedSafeAreaRules`) therefore still holds,
and now holds for both elements. Assert it for both, and record in the test *why*
each one needs none, since the two reasons are different and a future reader will
otherwise assume one covers both.

**E-07 — `line-dasharray` is in line-widths, not pixels.** `[3.6, 2.8]` at
`line-width: 2.5` reproduces the mockup's `stroke-dasharray: 9 7`. Getting this wrong
is invisible in code review and obvious on screen.

**E-08 — The scrim needs a second pure geometry function.** `areaScrimPolygon`, a
two-ring Polygon (world outer, circle inner). Build the outer ring relative to the
record centre so the hole is always strictly interior and the schema's deliberately
non-normalized, antimeridian-continuous circle vertices are preserved. Unit-test it
beside `areaCirclePolygon`: two rings, the second identical to the circle ring, and
a point just outside the circle falling inside the filled area.

**E-09 — Reuse `prefersReducedMotion()` from `lib/scroll.ts`.** It is the shipped
predicate, already guarded for non-DOM and test environments. Do not re-inline
`matchMedia`. (Its home in `scroll.ts` under-describes it; that is a pre-existing
naming mismatch, not a reason to duplicate it.)

**E-10 — The mockup's swatch label reads "scrim at 13%".** The value is **0.18**,
which is what the mockup's own CSS declares and what D-03 approves. The swatch label
is a demo-rendering artifact; ignore it.

### For the Tester specifically

- **QA-19** is satisfied geometrically, not by copy. Assert the drawn circle is
  visibly smaller than the viewport in the capped case; do **not** look for a capped
  sentence, because there is not one.
- **QA-27**'s double-mutation test needs the same-message-twice case. Note the
  standing repo caveat: mutation-counting only discriminates against an unkeyed child
  when the message node stays **permanently mounted**. Here the node unmounts (on the
  6s timer and between searches), so a remount is already a real DOM addition and an
  unkeyed child would pass. Write the keyed child regardless, and say in the test's
  own comment that it cannot reject an unkeyed child, naming the assertion that
  carries the real `aria-live` guarantee.
- **NFR-01 / QA-31** must be measured at **both** text scales, and against the map
  area's content box. The map area has a co-located overflower (the top-right layers
  switcher) that can mask the element entirely.
- The **no-overlap** claim is the load-bearing one for D-01 and D-02: measure the
  control's rectangle against the layers switcher's rectangle at 320px, 100% and
  200%, on all three views, windowed and fullscreen. Expected: zero overlap in every
  configuration. The outcome region **is** expected to overlap the switcher and must
  pass every tap through — assert `document.elementFromPoint` inside the region
  returns the switcher, not the region.

---

## Deliberate extensions to the design system

Two, for the Chronicler to fold into `pipeline/design-system.md` at closeout. Both
are extensions of existing entries, not new patterns.

1. **The map-anchored theme-identical token family gains a third member.**
   `--sr-search-area-rgb` / `--sr-search-area-scrim-rgb` join `--sr-share-pin`,
   `--sr-map-pin-*`, `--sr-rank-pin-*` and the county ramp. Worth recording alongside
   them: red-orange `#B4341F` is now used by **two** map graphics (the planted share
   pin and the searched-area edge), deliberately sharing one audited value because
   they never co-occur as a data class and shape distinguishes them. Also worth
   recording is the palette-exhaustion note that produced the hue: on the Map Explorer
   canvas green, amber, violet, blue, purple and slate are all spent, which is what
   the design system's own "check it is free on EVERY surface" rule asks for and what
   makes red-orange the last free hue rather than a preference.

2. **The FAB cluster's full-width row is now a pattern, not a one-off.**
   `design-system.md`'s *Map tools & transient pins* entry records the cluster as the
   home for corner icon buttons and (via `map-location-buttons`) a full-width
   **message** row. This feature establishes the full-width **action** row on the same
   mechanism (`flex: 0 0 100%`, cluster's own `row-gap` / `justify-content` /
   `max-width` doing the work, bottom-anchored so it grows upward and no shipped
   button moves). The transferable rule is the ordering one from E-01: **a row whose
   position must be stable under a neighbouring row's appearance goes below that
   neighbour**, because the cluster grows upward. Also transferable: a labelled action
   in this cluster takes the accent-**tinted** active treatment, not the accent-filled
   slab, both because a solid accent blob on the map canvas means sighting pin and
   because the accent-filled `.sr-map-filters-btn` already sits in the same cluster.

Nothing else in this feature departs from the design system. The type roles, the icon
sizing, the live-region contract, the touch-target posture, the safe-area posture and
the reduced-motion posture are all applied as written.
