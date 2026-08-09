# Decisions — Pin Share

Feature-scoped decisions and deliberate deviations from `pipeline/design-system.md`.
Strategy-level decisions live in `strategic-brief.md`; structural ones in `schema.md`.

---

## D-01 — The share pin is a planted flag, not a teardrop (new token pair)

**Deviation from the design system:** mints `--sr-share-pin` and
`--sr-share-pin-ink`, the first new map-anchored pin tokens since the rank pins.

The design system says color is restrained and the accent means "actionable or
active". The share pin cannot use it: `--sr-accent` is already the sighting pin
(surfaces C, D, F), the search-center pin (surface B) and the rank circle
(surface E). The other map hues are equally taken: `--sr-rank-pin-square` blue is
on the Statistics map, `--sr-map-pin-personal` amber and `--sr-map-pin-target`
violet are both on Map Explorer. **There is no existing map color free on every
in-scope surface**, so color cannot carry the distinction.

Resolution: shape carries it. A planted flag is unmistakable next to a teardrop or
a circle at a glance, its base is a precise point rather than a bulb (right for a
"this exact spot" gesture), and it reads as something the user placed a moment ago
rather than as data. The new token keeps the pennant from reading as any existing
data class; it is declared identically in both themes because it is only ever drawn
on the always-light Positron basemap, the same posture as `--sr-map-pin-*`.
Measured 5.38:1 against Positron land, 6.08:1 for the notch on the pennant, both
comfortably over the 3:1 WCAG 1.4.11 bar for a non-text graphic. No text is ever
painted on the fill, so no on-fill text pair is minted.

## D-02 — The keyboard route is a visible map tool, in the bottom-right corner

FR-38 required a pointer-free route on five surfaces with no lat/lng inputs. The
Architect proposed a button inside `SharePin` that drops at `map.getCenter()`;
that mechanism is adopted unchanged.

The design decision is that the control is **visible and permanent** rather than
hidden or visually subtle. A right-click-only feature has near-zero discoverability
in a birding app, and SnowRaven is otherwise full of visible get-this-out-of-here
affordances (Copy weather, checklist links). Making the accessibility route the
primary route serves both audiences with one control.

Placement: bottom right on every surface. On Map Explorer it is the **first item in
the existing `.sr-map-fab-cluster`**, so no new corner is claimed, the shipped
Fullscreen and Filters controls do not move, and the `.sr-ios-app` safe-area
handling is inherited. Every other corner on that surface is occupied
(NavigationControl top-left, the base switcher top-right, attribution bottom-left).
On the other four maps that corner is empty and the same button sits there alone.

Not rendered on surface B: the search views already have lat/lng fields and one
search-center pin, so a second way to move that center is the competing control
FR-15 forbids.

## D-03 — OQ-04 resolved: the preference gets its own "Sharing" section

Not under "Appearance". What a copy action produces is not an appearance setting.
`Sharing` is an accurate header with room to grow, and a single-row section is
already precedented by "Help & Documentation".

The row additionally shows a **live example of the exact payload** for the selected
mode, built by the same `buildSharePayload` the popup uses. This reuses the pattern
the Weather tab already established, where the block you are about to copy is shown
before you copy it. "Copy coordinates and map links" describes a payload; the
example is the payload.

## D-04 — The link formats are settled. Do not revisit.

The user asked directly whether `maps.google.com/?q=` and `maps.apple.com/?q=` are
the shortest formats available. Given the full comparison, they chose to keep the
design exactly as specified: **both links, in the default mode, in both modes as
FR-21 and FR-23 define them.**

Shipping forms, ratified:

- `https://maps.google.com/?q=<lat>,<lng>` — 45 characters
- `https://maps.apple.com/?q=<lat>,<lng>` — 44 characters

Considered and rejected, on the record so this is not re-opened:

| Alternative | Why not |
|---|---|
| Google's `api=1` form | 19 characters longer for no benefit |
| `maps.app.goo.gl` short links | Must be minted by calling Google's servers with the coordinate. Same privacy problem as a third-party shortener, which Key Decision 2 permanently excludes |
| `maps.apple/p` short links | Same: requires calling Apple's servers with the coordinate |
| A bare `geo:` URI | 23 characters, but most messaging apps do not linkify it, which defeats the purpose |
| Dropping the `https://` prefix | Saves 8 characters but linkification becomes fragile and app-dependent |
| Four decimal places | Saves 2 characters, costs roughly 10 metres of precision. Five decimals also matches what eBird shows |
| A single-link default, second link behind the setting | Offered explicitly and declined. The user wants both links in the default payload |

## D-05 — Success is quieter, not louder

The copy button settles from accent-filled to accent-tinted (`--sr-accent-bg` on
`--sr-accent`) with a `Check` icon and the word `Copied`, for about two seconds.

**Minor deliberate deviation:** the label is `Copied`, not the `Copied!` used by
`WeatherForecastPanel`. One word, chosen for the calm register the design system
asks for, and approved by the user. Do not "fix" it for consistency with the older
string.

## D-06 — The failure state includes a "Select all" control

FR-28 requires the payload be revealed as selectable text so the user can copy it
manually. On a phone, dragging a selection across three wrapped lines inside a map
popup is hard enough that the requirement would be satisfied on paper and not in
practice. `Select all` uses the Selection API only, makes no clipboard call (so it
cannot fail the way the copy just did), and turns "select the text below" into
advice the user can actually follow.

The revealed payload wraps (`pre-wrap` plus `overflow-wrap: anywhere`) rather than
scrolling horizontally, so the whole thing is visible and selectable in one gesture.

## D-07 — Compact reduces size, never meaning

The Named Birds card map is 220px tall. Its popup narrows to 224px, tightens its
padding, drops the coordinate to `0.8125rem` and caps its body at `9.5rem`, but
keeps every label, the mode line, the failure text and `Select all`. This follows
the media-embed precedent already recorded in the design system, where the
offline/failed placeholder degrades at full density rather than to an icon-only
reduction.

`compact` stays a **required** prop on both `SharePopup` and the pin button, per the
`MediaFrame` precedent in `CLAUDE.md`: a default that encodes a display decision is
invisible at the call site and silently hands the next caller a choice they did not
make.

---

## Design-system evolution offered and declined

The user was offered the chance to evolve the established look for this feature and
kept the shipped system. Everything above extends existing patterns; the only new
token is D-01's map-anchored pair, and the only new CSS classes are the pin button's
corner wrapper and the compact popup-body cap.

The Weft design doctrine's "no Inter / system-ui display face" rule is **not**
applied here by the doctrine's own precedence rule: `design-system.md` wins on
specifics such as type, and Inter has been the app's face across 111 shipped
versions. Changing the typeface is not a Pin Share decision.
