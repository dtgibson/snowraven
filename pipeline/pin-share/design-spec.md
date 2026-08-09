# Design Spec — Pin Share

**Feature:** pin-share
**Date:** 2026-08-08
**Stage:** 4 — The Designer
**Source:** `pipeline/pin-share/prd.md`, `pipeline/pin-share/schema.md`, `pipeline/design-system.md`
**Approved mockup:** `pipeline/pin-share/design.html` (the mockup is normative where this
document and it disagree on a pixel value; this document is normative on intent and copy)

---

## Visual Direction

Quiet utility, extended rather than reinvented. The share pin is the only new mark
on the map and it is deliberately not another accent-green teardrop: every hue in
the app's map palette is already spoken for on at least one in-scope surface, so
the distinction is carried by **shape**. Everything else is existing SnowRaven
furniture at existing sizes: the popup is the already-themed MapLibre popup body,
the drop control is the already-shipped 36px round map tool, and the Settings row
is the existing `RadioGroup` in an existing card.

Restraint is the point. The accent green appears on exactly two things in this
feature: the copy button, which is the primary action, and the active state of the
pin button. Nothing else is colored.

---

## Screens / Views

### 1. The share pin (surfaces A, C, D, E, F)

A **planted flag**, not a teardrop. Sprite is `26 × 33` (compact `22 × 28`), drawn
as inline SVG inside a real `<button>` on a react-map-gl `<Marker>` with
`neutralizeMarkerWrapper` on the marker ref, per the app's DOM-marker convention.

| Part | Treatment |
|---|---|
| Staff | `var(--sr-map-pin-stroke)`, `stroke-width 3.1`, round cap, full height of the sprite |
| Pennant | `var(--sr-share-pin)` fill, `var(--sr-map-pin-stroke)` 1.5px stroke, round join |
| Notch | `var(--sr-share-pin-ink)` circle, `r 1.7`, inside the pennant |
| Foot | `var(--sr-share-pin)` circle `r 2.9` with the same 1.4px stroke, at the staff base |
| Shadow | `drop-shadow(0 2px 2px rgba(0,0,0,0.32))` |
| Cursor | `grab`, `grabbing` while dragging |

**Anchor: the staff foot is the coordinate, not the sprite center.** The marker
offset must shift the sprite right by the distance from its horizontal center to
the staff (7px at normal size, 6px compact). Getting this wrong puts the pin half a
sprite-width off the pressed point, which is the whole promise of the feature.

**Touch target.** A transparent `::after` pseudo-element, `44 × 44`, centered on the
sprite. The visual stays 26px; only the hit area grows. Do not scale the sprite to
reach 44px.

**Key decisions for this screen**
- Shape, not color, separates the share pin from sighting pins, the search-center
  pin, hotspot teardrops, rank pins, and the GL circle layers.
- A flag reads as something the user planted a moment ago. A teardrop reads as data.
- The base is a point rather than a bulb, which suits a "this exact spot" gesture.

### 2. The share popup (all share-pin surfaces, and surface B)

One implementation, two densities, two hosts. Chrome is the existing
`.maplibregl-popup-content` styling already in `globals.css`; the body is new.

| | Normal | Compact |
|---|---|---|
| Width | 268px, `max-width: calc(100% - 24px)` | 224px |
| Padding | `11px 13px 12px` | `9px 10px 10px` |
| Body cap | `.sr-map-popup-body` (`min(60dvh, 26rem)`) | `9.5rem` |
| Coordinate | mono `0.875rem` / 600 | mono `0.8125rem` / 600 |
| Copy button | 32px tall, `0.75rem` | 30px tall, `0.71875rem` |
| Revealed payload | `max-height 7.5rem`, `0.6875rem` | `max-height 4.75rem`, `0.625rem` |

Stacking order, top to bottom:

1. **Header row.** Lucide `MapPin` at 11px plus the label `Share location`.
   `0.625rem`, weight 600, uppercase, `letter-spacing 0.05em`,
   `var(--sr-text-muted)`. Right margin 26px so it clears the close button.
2. **Coordinate.** `var(--font-mono)`, weight 600, `letter-spacing -0.01em`,
   `font-variant-numeric: tabular-nums`, `var(--sr-text)`, `user-select: text`,
   `cursor: text`. This is the datum, so it leads and it is the largest thing in
   the popup.
3. **Copy button.** Full width. Accent filled (`var(--sr-accent)` on
   `var(--sr-on-accent)`, 1.5px `var(--sr-accent)` border, radius 6). Lucide `Copy`
   at 13px, 6px gap. Label names the active mode.
4. **Mode line.** One centered muted line, `0.625rem`, restating the payload
   contents.
5. **Failure block**, only after a refused copy. See §Interaction Notes.
6. **Close.** MapLibre's own `.maplibregl-popup-close-button`, already themed and
   already 44px under `@media (pointer: coarse)`. No new visual. Its `aria-label`
   becomes `Close and remove the pin`.

The compact density **reduces size, never meaning**. Every label, the mode line,
the failure text and the Select all control are present at both densities, per the
media-embed precedent already recorded in the design system.

### 3. The pin button (the keyboard route, surfaces A, C, D, E, F)

A 36px round map tool, visually identical to the shipped `.sr-map-fullscreen-btn`:
`var(--sr-surface)` on a 1px `var(--sr-border)`, `border-radius: 50%`,
`box-shadow: 0 4px 12px rgba(0,0,0,0.18)`, Lucide `MapPin` at 17px, stroke 2.2, in
`var(--sr-text)`. Compact is 30px with a 15px icon.

**Active state** (a pin exists on this map): background `var(--sr-accent-bg)`,
icon `var(--sr-accent)`, border `var(--sr-accent-border-strong)`, and
`aria-pressed="true"`. This is the app's existing "active" convention and it
doubles as a persistent signal that this map is holding a pin.

**Placement, one corner on every surface: bottom right.**

- **Map Explorer (surface A):** the **first item** in the existing
  `.sr-map-fab-cluster` row, so the order is `Pin` · `Fullscreen` · `Filters`.
  No new corner is claimed, the existing 10px gap and the `.sr-ios-app`
  safe-area handling are inherited, and the two shipped controls do not move.
- **Species Detail, Statistics, Named Birds (C, D, E, F):** the same button in its
  own wrapper, `position: absolute; bottom: 20px; right: 16px; z-index: 1050`
  (compact: `bottom: 12px; right: 12px`). `z-index: 1050` matches the FAB cluster,
  because this is peer map furniture rather than a floating overlay.
- **Not rendered on surface B.** The three search views already have latitude and
  longitude fields and a single search-center pin. A second way to move that center
  would be the competing control FR-15 forbids.

At `≤640` the button is 44px (40px compact), via `.sr-touch-target` or an
equivalent rule on the element itself.

**Label changes with state**, because "drop a pin" is a small lie once one exists:

| State | `aria-label` and `title` |
|---|---|
| No pin | `Drop a pin at the map center` |
| Pin present | `Move the pin to the map center` |

The label names the mechanism on purpose. A keyboard user needs to learn that the
map pans under the pin, and this is where they learn it.

### 4. The search-center pin (surface B)

The existing 30×30 accent teardrop, unchanged in fill, stroke, size and drag
behavior. It is wrapped in a real `<button type="button">`, gains
`border-radius: 8px` so the global focus ring reads correctly around it, and gains
the same transparent `44 × 44` `::after` touch target.

Accessible name leads with the coordinates exactly as the latitude and longitude
fields display them, then names the action:

> `38.54321, -121.98765. Copy this location`

Activating it opens the same `SharePopup`. Dragging it must not.

### 5. Settings

New section, placed after **Appearance** and before **API Keys**.

- **Section header:** `Sharing` (existing `SectionHeader`).
- **Card:** existing shape, 1px `var(--sr-border)`, radius 10, `var(--sr-surface)`.
- **Row title:** `Copying a location`, `0.84375rem`, weight 600.
- **Row description:** `0.75rem`, `var(--sr-text-muted)`:
  > What gets copied when you copy a location from a map pin. Coordinates are
  > decimal degrees to five places, latitude first.
- **RadioGroup**, `label="Copying a location"`, two options with a sub-line each,
  styled on the `DateFormatRow` button shape (`flex: 1 1 190px`, `min-height 48`,
  1.5px border, radius 6, `var(--sr-accent-bg)` when checked):

  | Visible label (exact, FR-31) | Sub-line |
  |---|---|
  | `Copy coordinates and map links` | `Three lines, with Google Maps and Apple Maps` |
  | `Copy coordinates only` | `One line, nothing else` |

  Sub-line is `0.6875rem`, weight 400, `margin-top: 2px`. Each option's `ariaLabel`
  is the visible label followed by the sub-line, so the accessible name leads with
  what is on screen (WCAG 2.5.3).

- **Live example.** Below the radios, a micro-label (Lucide `Copy` at 11px plus
  `Example`, `0.625rem`, uppercase, muted) and a monospace block showing **the exact
  payload for the currently selected mode**, built by the same
  `buildSharePayload` the popup uses, from the fixed sample coordinate
  `38.54321, -121.98765`. No `max-height`.

This resolves **OQ-04**: its own section, not Appearance. What a copy action
produces is not an appearance setting, and `Sharing` is an accurate header with
room to grow. It reuses the pattern the Weather tab already established, where the
block you are about to copy is shown before you copy it.

---

## Component Usage

| Component | Source | Use |
|---|---|---|
| `RadioGroup` | existing, `Settings.tsx` L40-86 | The preference. Unmodified. |
| `SectionHeader` | existing, `Settings.tsx` | The `Sharing` header. Unmodified. |
| `Marker` | `react-map-gl/maplibre` | Share pin and center pin, both with `neutralizeMarkerWrapper` on the ref. |
| `Popup` | `react-map-gl/maplibre` | The share popup. Existing themed chrome, new body. |
| `.sr-map-popup-body` | existing, `globals.css` | The popup body scroll cap. Compact needs one override. |
| `.sr-map-fab-cluster` | existing, `globals.css` | Hosts the pin button on Map Explorer. Unmodified. |
| `.sr-map-fullscreen-btn` | existing, `globals.css` | The pin button's visual. Factor a shared class or duplicate the rule, either is fine. |
| `.sr-touch-target` | existing, `globals.css` | Copy button and pin button at `≤640`. |
| Lucide `MapPin` | existing dependency | Popup header (11px), pin button (17px / 15px). |
| Lucide `Copy` | existing dependency | Copy button (13px), Settings example micro-label (11px). |
| Lucide `Check` | existing dependency | Copied state (13px). |
| Lucide `AlertTriangle` | existing dependency | Failure message (12px). |

**No new dependency, no new component library, no motion library.** All motion in
this feature is plain CSS, which satisfies NFR-04 without argument.

---

## Design Tokens Applied

Existing tokens, used as-is: `--sr-surface`, `--sr-surface-subtle`,
`--sr-surface-faint`, `--sr-text`, `--sr-text-muted`, `--sr-border`,
`--sr-accent`, `--sr-accent-bg`, `--sr-accent-border`,
`--sr-accent-border-strong`, `--sr-on-accent`, `--sr-error`, `--sr-error-bg`,
`--sr-error-border`, `--sr-card-shadow`, `--sr-map-pin-stroke`, `--font-mono`.

### One new token pair (define in BOTH themes before use)

```css
/* Share pin (Pin Share). Map-anchored: only ever drawn on the always-light
   Positron basemap, so declared IDENTICALLY in :root and [data-theme="dark"],
   the same posture as --sr-map-pin-* and --sr-rank-pin-*. Theme-flipping would
   wash the pennant out over a light base.
   Measured: #B4341F on Positron land (#F2F1EC) is 5.38:1; the white notch on
   the pennant is 6.08:1. Both clear the 3:1 WCAG 1.4.11 bar for a non-text
   graphic with margin, which is what keeps the pin legible over satellite too.
   No text is ever painted on this fill, so no on-fill text pair is minted. */
--sr-share-pin: #B4341F;
--sr-share-pin-ink: #FFFFFF;
```

Rationale for a new token rather than reuse: `--sr-accent` is the sighting pin, the
search-center pin and the rank circle; `--sr-rank-pin-square` blue is on the
Statistics map (surface E); `--sr-map-pin-personal` amber and
`--sr-map-pin-target` violet are both on Map Explorer (surface A). There is no
existing map color free on every in-scope surface. Shape carries the primary
distinction; this token keeps the pennant from reading as any existing data class.

**No text is ever painted on a new fill in this feature**, so NFR-05's on-fill
contrast clause has nothing to check beyond the two graphic ratios above.

---

## Interaction Notes

**Drop.** Right-click or a completed long-press plants the pin and opens the popup
in one step. The pin animates in; the popup animates out of the pin tip.

**Drag.** The pin drags to fine-tune. The popup stays open and follows, the
coordinate re-renders live, and the next copy carries the new position. The plant
animation must be suppressed during a drag or the pin jumps on every pointermove.

**Popup flip.** Anchored above the pin by default with
`transform-origin: bottom center`. When there is not enough room above (roughly
148px normal, 118px compact, which is a real case on the 220px Named Birds map),
it anchors below and **the transform origin must flip to `top center`**, or the
popup grows out of thin air instead of out of the pin. MapLibre picks the anchor;
the origin must follow it.

**Copy result.** On success the button swaps to a `Check` icon and `Copied`, and
settles from accent-filled to accent-tinted (`--sr-accent-bg` on `--sr-accent`,
`--sr-accent-border`) for about two seconds, then returns. Quieter on success, not
louder. Clear the timer on unmount; the popup can close mid-timeout.

**Copy failure.** The button returns to its normal label and a failure block
appears below it:

1. A message on `--sr-error-bg` with a 1px `--sr-error-border`, `--sr-error` text,
   radius 6, padding `7px 8px`, `0.6875rem`, with a 12px `AlertTriangle`.
2. A bar with the micro-label `Text to copy` and a text button `Select all`.
3. The **complete payload** in a monospace block on `--sr-surface-subtle`,
   `white-space: pre-wrap`, `overflow-wrap: anywhere`, `user-select: text`,
   internal vertical scroll. Wrapping rather than horizontal scroll, so the whole
   payload is visible and can be dragged over in one gesture.

`Select all` runs `Range.selectNodeContents` on the block through the Selection
API. **It makes no clipboard call**, so it cannot fail the same way the copy just
did. It earns its place because on a phone, dragging a selection across three
wrapped lines inside a map popup is genuinely hard, and without it "select the text
below" is advice the user cannot easily follow.

**Announcements.** One `<span role="status" aria-live="polite" class="sr-only">`
that is **rendered from the start** and only has its text changed. Do not mount the
region together with its message.

| Event | Announcement |
|---|---|
| Copy succeeded | `Location copied to the clipboard.` |
| Copy refused | `Could not copy. The text is shown so you can copy it manually.` |
| Select all pressed | `Text selected. Copy it with your device's copy command.` |

**Close and focus.** Escape, the close control and any backdrop dismissal all route
through one `close()`, which removes the pin and the popup together and restores
focus **after the close render commits**. Record the opener at open time: the pin
button for a keyboard open, the pin itself for a click on an existing pin, and the
map canvas container for a pointer drop.

**Mode changes reach an open popup.** The copy button's label, the mode line and
the payload all re-read the preference at render, so changing the setting while a
popup is open relabels it immediately and the next press copies the new mode.

**Dragging is never activating.** On surface B, a pointer drag that ends in a
synthesized click must not open the popup. Keyboard `Enter` and `Space` must.

**Responsive.** Copy button and pin button reach 44px at `≤640`. Nothing in this
feature is a form control, so `.sr-input-16` does not apply. The popup's own
`max-width: calc(100% - 24px)` keeps it inside a 320px viewport, and the body cap
keeps it inside a short one. Everything is sized in rem except the sprite geometry,
so it holds at 200% text scale.

---

## Motion Spec

All plain CSS. All ease-out. All under 200ms. The global
`@media (prefers-reduced-motion: reduce)` rule already in `globals.css` collapses
every one of these to about 1 microsecond, and because each animation's end state
is its resting state, nothing is lost when it does. No per-component
reduced-motion media query is needed, and none should be added.

Shared easing token: `cubic-bezier(0.16, 1, 0.3, 1)`.

| Interaction | Easing | Duration | Origin / transform | Reduced motion | Implemented with |
|---|---|---|---|---|---|
| Pin plants | `cubic-bezier(0.16,1,0.3,1)` | 190ms | Rises 7px into place with a fade. No bounce, no overshoot. | Instant, final position | CSS `@keyframes` |
| Popup opens | `cubic-bezier(0.16,1,0.3,1)` | 170ms | `scale(0.94) translateY(4px)` to rest, `transform-origin: bottom center` at the pin tip, flipping to `top center` when the popup anchors below | Instant, full size | CSS `@keyframes` |
| Copy result settles | `cubic-bezier(0.16,1,0.3,1)` | 140ms | `background`, `color`, `border-color` only. No scale, no pulse, no flash | Instant color swap | CSS `transition` |
| Failure block reveals | `cubic-bezier(0.16,1,0.3,1)` | 190ms | `translateY(-4px)` to rest with a fade | Instant | CSS `@keyframes` |
| Pin button active state | `cubic-bezier(0.16,1,0.3,1)` | 140ms | `background`, `color`, `border-color` | Instant | CSS `transition` |
| Pin button hover | ease-out | 140ms | `background` to `--sr-surface-subtle` | Instant | CSS `transition` |
| Settings radio check | ease-out | 120ms | `background`, `color`, `border-color`, matching the existing `DateFormatRow` 0.12s | Instant | CSS `transition` |

**Explicitly not used:** hover-scale on the pin or the button, a pulsing "copied"
indicator, a staggered reveal of the payload lines, elastic or overshoot easing on
any control, and motion on mount for anything static.

---

## Content Notes

Voice is the app's: informative, calm, specific, never promotional. **No em dashes
in any of it**, per the standing repo rule, which covers on-screen text, `title`,
`placeholder` and `aria-label` values alike.

### Exact strings

| Where | String |
|---|---|
| Popup header | `Share location` |
| Copy button, `coords-and-links` | `Copy coordinates and links` |
| Copy button, `coords-only` | `Copy coordinates` |
| Copy button, succeeded | `Copied` |
| Mode line, `coords-and-links` | `With Google Maps and Apple Maps links.` |
| Mode line, `coords-only` | `Coordinates only.` |
| Failure message | `Could not copy automatically. Select the text below and copy it.` |
| Failure block label | `Text to copy` |
| Failure block action | `Select all` |
| Popup close, `aria-label` | `Close and remove the pin` |
| Share pin, `aria-label` | `{coordinates}. Share this location` |
| Center pin, `aria-label` | `{coordinates}. Copy this location` |
| Pin button, no pin | `Drop a pin at the map center` |
| Pin button, pin present | `Move the pin to the map center` |
| Settings section header | `Sharing` |
| Settings row title | `Copying a location` |
| Settings row description | `What gets copied when you copy a location from a map pin. Coordinates are decimal degrees to five places, latitude first.` |
| Settings option 1 | `Copy coordinates and map links` |
| Settings option 1 sub-line | `Three lines, with Google Maps and Apple Maps` |
| Settings option 2 | `Copy coordinates only` |
| Settings option 2 sub-line | `One line, nothing else` |
| Settings example micro-label | `Example` |

Two wording notes:

- The popup button says **"and links"** where Settings says **"and map links"**.
  This is a deliberate shortening for a 268px popup, not a drift. The Settings
  labels are fixed by FR-31 and must not change; the popup label may.
- The success label is **`Copied`**, not the `Copied!` used by
  `WeatherForecastPanel`. A one-word deliberate deviation toward the calm register
  the design system asks for. Approved by the user; do not "fix" it for
  consistency with the older string.

### Copy the user will never see in this feature

No place name, no elevation, no distance, no "Open in Maps" action, and no
alternate coordinate format. All four are out of scope in the PRD, and a place name
in particular is excluded because it would require an outbound Nominatim call and
put the user's coordinate into a request. This feature makes none.

---

## Decisions Ratified in This Stage

**D-01 — The share pin is a planted flag, not a teardrop.** Shape carries the
distinction because no map color is free on every in-scope surface. One new
map-anchored token pair.

**D-02 — The keyboard route is a visible map tool, not a hidden mechanism.** It
satisfies FR-38 on all five share-pin surfaces from a single control inside the
component every one of them mounts, and it fixes a discoverability problem that a
right-click-only feature would otherwise ship with. Bottom right on every surface;
inside the existing FAB cluster on Map Explorer.

**D-03 — OQ-04 resolved: the preference gets its own `Sharing` section**, with a
live example of the exact payload for the selected mode.

**D-04 — The link formats are settled. Do not revisit them.** The user asked
directly whether these are the shortest available formats and, given the full
comparison, chose to keep both links in the default mode exactly as designed:
`https://maps.google.com/?q=<lat>,<lng>` (45 characters) and
`https://maps.apple.com/?q=<lat>,<lng>` (44 characters). Rejected in that
conversation, on the record: Google's `api=1` form (19 characters longer);
`maps.app.goo.gl` and `maps.apple/p` short links (both require sending the
coordinate to Google's or Apple's servers to mint, which is the exact privacy
problem Key Decision 2 exists to avoid); a bare `geo:` URI (23 characters, but most
messaging apps do not linkify it); dropping the `https://` prefix (fragile
linkification); and four decimal places (saves 2 characters, costs about 10 metres
of precision). A single-link default with the second link behind the setting was
offered and declined. **Both links, both modes, as specified in FR-21 and FR-23.**

**D-05 — Success is quieter, not louder.** The copy button settles from
accent-filled to accent-tinted with a `Check` and the word `Copied`.

**D-06 — The failure state includes `Select all`.** Without it, FR-28's promise
that the user can copy the text manually does not survive contact with a phone.

---

## Flags for The Engineer

1. **Define `--sr-share-pin` and `--sr-share-pin-ink` in BOTH `:root` and
   `[data-theme="dark"]` in `globals.css`, with identical values in each**, and
   keep the rationale comment. This is the map-anchored posture, not an oversight.
2. **The marker anchor is the staff foot, not the sprite center.** Offset the
   marker right by 7px (normal) / 6px (compact). This is the single easiest thing
   to get wrong and it silently breaks the feature's core promise.
3. **`transform-origin` must follow MapLibre's chosen popup anchor.** Bottom center
   above the pin, top center below it. The below case is real on the 220px Named
   Birds map.
4. **The compact body cap (`9.5rem`) is load-bearing.** `.maplibregl-map` has
   `overflow: hidden`, so a revealed payload on a 220px map will be clipped
   without it. `.sr-map-popup-body`'s `min(60dvh, 26rem)` is far too generous there.
5. **`compact` stays required, never defaulted**, on both `SharePopup` and the pin
   button, per the `MediaFrame` precedent already in `CLAUDE.md`.
6. **The pin button on Map Explorer belongs inside `.sr-map-fab-cluster`**, which
   is rendered outside `<SnowMap>`. Either portal the button there or position
   `SharePin`'s own wrapper to match; the visual result is identical and I have no
   preference between them. Do not move or restyle the two shipped controls.
7. **Suppress the plant animation during a drag**, or the pin re-animates on every
   `pointermove`.
8. **`Select all` uses the Selection API only.** No clipboard call, so it cannot
   fail the way the copy just did.
9. **The live region must already be on the page before its text changes.** One
   `role="status"` span, three possible messages.
10. **The copy button label, the mode line and the payload all re-read the
    preference at render**, so FR-36 is satisfied by the store rather than by any
    imperative update.
11. **Nothing here needs a motion library.** Six CSS transitions and three
    keyframe blocks. The existing global reduced-motion rule covers all of it.
12. **A verification carried into the build (OQ-01 and OQ-02 are unchanged), plus
    one of mine:** confirm on a real touch device that the popup, at compact
    density with the failure block revealed, does not clip on the 220px Named Birds
    map. It fits by the arithmetic above, but the arithmetic has not met a phone.
