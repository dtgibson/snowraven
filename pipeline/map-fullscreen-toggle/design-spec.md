# Design Spec — Map Fullscreen Toggle (embedded maps)

**Feature:** map-fullscreen-toggle
**Date:** 2026-09-02
**Stage:** 4 — The Designer
**Source:** prd.md (approved), schema.md (approved), strategic-brief.md
**Mockup:** `pipeline/map-fullscreen-toggle/design.html`

**Design system status: extended, not evolved.** `pipeline/design-system.md`
exists and governs. This feature mints no token, no shadow, no colour value, no
font size and no component. Every declaration it adds is either a `var(--sr-*)`
reference or a geometry value copied from a shipped rule. **No deviation to log
in `decisions.md`.**

---

## Visual Direction

The same map, given the whole window. Nothing appears, nothing disappears,
nothing changes size. The control is the Map Explorer's shipped fullscreen FAB,
in the Map Explorer's shipped corner-row vocabulary, so a user who has expanded
the Map Explorer already knows how to expand a Named Birds card. The expanded
state is the shipped fullscreen panel's geometry, verbatim, so the app has one
fullscreen appearance rather than two.

This is the design system's "quiet utility" register applied to a control whose
whole job is to get out of the way: the button is the only thing added, and the
expanded view adds nothing to it.

---

## Screens / Views

### Collapsed — all four mounts

The map is exactly as shipped, plus one disc in the bottom-right corner row.

- **The row** is `.sr-map-corner-row`, taking `.sr-share-corner`'s shipped
  anchors (`position: absolute; bottom: 20px; right: 16px; z-index: 1050`;
  `--compact` at `12px/12px`) plus `.sr-map-fab-cluster`'s flex block:
  `display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  justify-content: flex-end; row-gap: 10px; max-width: calc(100% - 32px)`
  (`calc(100% - 24px)` on `--compact`, matching its tighter anchors).
- **DOM order is share button, then fullscreen toggle**, left to right, matching
  the Map Explorer. The share button reaches the row by portalling into a
  `display: contents` slot that is physically first, so reading order, tab order
  and visual order are one thing and no `order` property exists.
- **The row paints nothing.** It is a transparent flex wrapper, which is why the
  only colour this feature introduces on any surface is one `background`
  declaration on the expanded panel.
- **`pointer-events: none` on the row, `auto` on its buttons**, copied from the
  cluster. Without it the 10px gap between two discs is a dead strip that
  swallows a map drag. With one button (`.sr-share-corner` today) there is no
  gap and no problem; with two there is, so this is new work, not inherited
  boilerplate.
- **No toggle where there is no map.** A species with no usable coordinates, a
  named bird with no coordinates, and the Statistics section before `mapReady`
  or with no ranked pins each draw no map, so there is nothing to expand. The
  absent map is the reason, not a separate rule: the mockup shows both of these
  boxes.

### Expanded — one shared class, `.sr-map-fs-panel`

**Design decision: one expanded class for all four mounts, not one per base
class.** It makes "the three surfaces are identical when expanded" a property of
the stylesheet rather than of anyone's discipline, and it writes the iOS rule,
the background and the entrance keyframe once each. The hook composes
`${baseClass} sr-map-fs-panel`.

| Declaration | Value | Reason |
|---|---|---|
| `position` / `inset` / `height` / `z-index` | `fixed` / `0` / `100dvh` / `1200` | Byte-identical to the shipped `.sr-map-fullscreen-panel`. One fullscreen geometry in the app. |
| `background` | `var(--sr-bg)` | FR-25. Opaque from frame one; the surface behind is a live page, not a dimmed one. |
| `border` / `border-radius` | `none` / `0` | OQ-07. A full-window map with rounded corners and a hairline shows the page ground in four corners and reads as a rendering fault. Restored exactly on collapse. |
| `overflow` | `hidden`, kept | The clip keeps canvas and controls inside the box; it has no bearing on the corners. |
| iOS padding | top, left, right only | FR-22. Mirrors the shipped panel rule, gated on `.sr-ios-app`, never a bare `env()`. The canvas is meant to bleed to the home indicator. |

**Nothing else changes on expand.** Not the base switcher, not the drop button,
not the toggle's size modifier, not the map's centre, zoom, open popup, dropped
share pin, base layer or county shading. A control that exists only at full
window would be fullscreen-specific chrome, which is out of scope by name.

### The exit affordance

**It is the same button, in the same corner, in its other state.** It does not
move to the top-right, does not become an X, and does not gain a label. Leaving
it under the finger that just pressed it is the whole reason a toggle beats a
pair of buttons, and the Map Explorer has taught this gesture for sixty-odd
versions. `aria-pressed` carries the state; Escape is the second route, and
`ACCESSIBILITY.md` already claims it for the Map Explorer, so this makes that
sentence true of every map rather than adding a claim to it.

**Focus restore scrolls the toggle back into view.** Measured, and correct: a
user who expanded a map far down a long page must land back looking at it.

### Both themes

The map canvas is the always-light basemap whatever the app theme is, so in dark
mode the expanded panel is a light map inside a dark app. This is the shipped
Map Explorer appearance and the controls carry it unchanged: a `--sr-surface`
disc reads near-black on the light canvas in dark theme, and white with a
`--sr-border` hairline plus the family's shadow in light theme. The panel's
`--sr-bg` ground is only ever visible for the moment before a style resolves,
which is exactly what FR-25 buys.

---

## Component Usage

Nothing new. Every element is a shipped component or class.

| Element | Source | Change |
|---|---|---|
| Fullscreen toggle | `.sr-map-fab` + size modifier + `.sr-map-fullscreen-btn` | None. New call site only. |
| Share drop button | `SharePin`, `buttonHost` slot | None. Moves into the new row via the existing portal seam. |
| The slot | `.sr-map-fab-slot` (`display: contents`) | None. Second use of the Map Explorer's mechanism. |
| Base switcher | `.sr-map-layers` | None, and absent on M3 in both states. |
| Zoom / attribution | MapLibre `NavigationControl`, `AttributionControl` | None. |
| The corner row | new `.sr-map-corner-row` | New class, assembled entirely from two shipped rules' values. |
| The expanded panel | new `.sr-map-fs-panel` | New class, values from the shipped `.sr-map-fullscreen-panel`. |

**Glyphs.** lucide `Maximize2` collapsed, `Minimize2` expanded, `size={17}
strokeWidth={2.2}` matching the family. The pixel `size` is the no-CSS fallback
only: `.sr-map-fab svg { width: var(--sr-fab-glyph) }` is what sizes it, in rem,
which is what keeps the glyph-to-disc ratio constant at 200% text scale.

---

## Design Tokens Applied

| Token | Where |
|---|---|
| `--sr-bg` | The expanded panel's opaque ground. **The only colour declaration this feature adds.** |
| `--sr-surface`, `--sr-text`, `--sr-border` | The toggle's disc, inherited from `.sr-map-fab`. |
| `--sr-surface-subtle` | Hover, inherited. |
| `--sr-accent`, `--sr-accent-bg`, `--sr-accent-border-strong` | The share button's pinned state, inherited. |
| `--sr-accent` | Focus ring, inherited from the global focus rule. |

No new token. Nothing to add to `:root` or `[data-theme="dark"]`.

**One reproduction note.** The shipped `.sr-map-fab` base shadow is a legacy
pure-black `rgba(0,0,0,0.18)`, predating the house rule that every shadow is
tinted with the app's own ink. The mockup draws it with the ink value so it
lints clean. **The feature changes neither**: that rule is shared with the Map
Explorer cluster and touching it would move shipped pixels there (NFR-07).

---

## Interaction Notes

Beyond the static layout, the Engineer implements:

1. **Toggle** flips one boolean on the container; the class swap is the whole
   geometry change. No remount, no portal, no DOM move.
2. **Accessible name swaps** with the state: "Enter fullscreen" → "Exit
   fullscreen", with `aria-pressed` false → true. The glyph is driven from the
   same state.
3. **Escape** on a bubble-phase `document` listener armed only while expanded,
   so the share popup's capture-phase listener stays the innermost dismiss
   layer: one Escape closes the popup, a second exits fullscreen.
4. **Focus trap** on the container, re-querying focusables per Tab keydown.
   Focus returns to whichever toggle is registered *now*, not the element
   captured at open, because a Pins-to-Heatmap swap replaces the button.
5. **Body scroll lock**, capturing the previous `overflow` value and restoring
   it rather than assuming `''`.
6. **Explicit `map.resize()`** on every mode change, after layout commit, plus
   one on the next frame for WKWebView's late `100dvh`.
7. **Teardown** on all four exits: explicit toggle, `active` going false,
   `resetKey` changing, and unmount.

### Two findings the design surfaced

**A specificity trap that would break the phone tier.** `globals.css` sets
`.sr-map-container { height: 300px }` inside the `@media (max-width: 640px)`
block at the very end of the file. Both that and `.sr-map-fs-panel` are one
class deep and the media block always comes last, so **at phone width the
expanded map would be 300px tall.** Scope that one declaration
`.sr-map-container:not(.sr-map-fs-panel)`, and leave a note on the other two
container rules that any future phone-tier height override owes the same guard.
Raising the panel rule's specificity artificially would work and would be the
wrong shape.

**The corner row needs its own iOS bottom inset, and only while expanded.** The
panel pads top, left and right deliberately, so the canvas bleeds to the home
indicator. That inset reaches the base switcher and the zoom stack for free,
because the map fills the panel's content box, but it leaves the corner row over
the home indicator. So:

```css
.sr-ios-app .sr-map-fs-panel .sr-map-corner-row          { bottom: calc(20px + env(safe-area-inset-bottom, 0px)); }
.sr-ios-app .sr-map-fs-panel .sr-map-corner-row--compact { bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }
```

Gated on both `.sr-ios-app` and the expanded class. The collapsed in-flow map
already sits inside the body's own safe-area padding, and a bottom inset there
would push two discs up into a 220px card map for nothing. **Right is not
re-inset**, because the panel's own `padding-right` already moved that edge;
double-insetting is the failure the shipped panel's comment warns about.

---

## Motion Spec

**The panel does not fly. The controls settle.**

The instinct is an origin-aware scale from the button that opened it. It is
wrong here for three separate reasons, and naming them is worth more than the
animation would have been:

- **A scaling live canvas tears.** MapLibre renders at the final size while CSS
  scales the element, so tiles stretch and snap, and it fights the explicit
  resize the feature must perform anyway.
- **A transform is the one property this feature is forbidden.** The overlay
  depends on `position: fixed` resolving against the viewport, and QA-27 checks
  the ancestor chain for containing-block creators *while an entrance animation
  is running*. A transform on the panel itself is defensible on paper and costs
  a measurement round to prove; not worth it for a flourish.
- **A fade would show the page through.** The panel must be opaque from frame
  one (FR-25 / QA-31). Fading it in from zero means the page behind is visible
  through a half-transparent map for ~80ms, which is the exact thing that
  requirement exists to prevent.

So the geometry change is instant, and what animates is the one thing that
genuinely travelled: the corner row, arriving in its new corner.

| Element / interaction | Easing | Duration | Origin | Reduced motion | Implemented by |
|---|---|---|---|---|---|
| Panel expand | none | 0ms | n/a | identical | class add |
| Panel collapse | none | 0ms | n/a | identical | class remove |
| Corner row entrance | `cubic-bezier(0.16, 1, 0.3, 1)` | 150ms | `translateY(6px)` to rest, opacity 0 to 1 | collapsed by the global block | CSS keyframe |
| Corner row exit | none | 0ms | n/a | identical | class remove |
| FAB hover / focus | `cubic-bezier(0.16, 1, 0.3, 1)` | 140ms | in place | collapsed by the global block | shipped `.sr-map-fab` |
| Glyph swap | none | 0ms | n/a | identical | `aria-pressed` selector |

```css
@keyframes sr-map-corner-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
}
.sr-map-fs-panel .sr-map-corner-row {
  animation: sr-map-corner-in 150ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

**Entrance only; collapse is instant.** Collapsing puts an in-flow box back
where it was, and animating that means fading the page itself in, which reads as
a flicker. The app already made this call once: `SpeciesCombobox`'s listbox
opens on a 140ms ease-out and closes instantly. This is that rule, not a
shortcut.

**Reduced motion.** Every animation's end state is its resting state, so
`globals.css`'s global `prefers-reduced-motion` block collapses all of it and
nothing is lost. **No per-component media query is added**, per the design
system's explicit instruction and the Pin Share block's precedent.

`cubic-bezier(0.16, 1, 0.3, 1)` is the app's own ease-out, already carried by
`.sr-map-fab`'s transition and `sr-share-pin-plant`. No new easing is minted.

**The transform is safe.** It sits on a *descendant* of the fixed container, not
an ancestor, so it cannot create a containing block for the panel. Nothing
inside the corner row is `position: fixed` (the drop button is a static
inline-flex disc), so it creates one for nothing.

**No MapLibre GL paint transition is added** (NFR-06): GL transitions do not
inherit the reduced-motion rule.

---

## Content Notes

**No new user-facing string except the two accessible names**, which are FR-02
verbatim: "Enter fullscreen" and "Exit fullscreen". No visible label, no
tooltip copy beyond the name, no status message, no announcement.

`docs/HELP.md`, `README.md`, `website/` and `ACCESSIBILITY.md` copy stays in the
app's voice, uses the house phrasing **"per-session, resetting on relaunch"** for
the lifetime (the same wording the share pin's Help paragraph already uses), and
contains **no em dashes** (FR-29). The Map Explorer's "Every map shows the same
row of three round buttons" sentence is corrected to describe the Map Explorer's
row rather than every map in the app.

---

## Open Questions Answered

### OQ-08 — Named Birds card map and the base switcher: **No**

Keep `switcher={false}` in both states.

The strongest argument is not the write path. It is that **the card map does not
participate in the base-map preference at all**: with `switcher` false, `SnowMap`
never *reads* the stored setting either (`SnowMap.tsx:112-117`), so the card is
always Positron regardless of what the user picked on Species Detail or the Map
Explorer. Adding the control while expanded would not reveal a setting already
in effect; it would introduce a second, divergent base-map state on a card, plus
a new `settings.json` write from a surface that has never written one, which
turns QA-29 red and falsifies the Architect's frontend-only classification.

It fails the plainer test too: a control that does not exist collapsed and
appears expanded is fullscreen-specific control chrome, which the PRD puts out
of scope by name. The card answers one question, where this individual has been
seen, and the basemap is not part of it.

### OQ-09 — Named Birds toggle size when expanded: **stays `--compact`**

There is a real argument the other way and it deserves stating: at full window
on a desktop the expanded card map carries 30px discs where the other three
carry 36px, an inconsistency at exactly the moment the surfaces look most alike.

It loses on three counts. A control that grows under the finger that just
pressed it is a second state change the user did not ask for, on the one map
where the button sits closest to the edge. The floors are already met without
it: at the phone tier compact is 2.5rem, which is 40px at normal text and 80px
at 200%, past the 24x24 minimum and at the app's own touch posture. And the gap
is six pixels on desktop, where nothing is being tapped. FR-04 already binds
this ("the size modifier shall not change when the map expands") and QA-04
asserts it; OQ-09 is really asking whether to amend FR-04, and the answer is no.

### Four further design calls, decided rather than deferred

| Question | Decision | Because |
|---|---|---|
| Border and radius when expanded (OQ-07) | Dropped, clip kept | Rounded corners at full window show the page ground and read as a bug. |
| One expanded class or three | One, `.sr-map-fs-panel` | Makes cross-surface identity a stylesheet property; writes the iOS rule once. |
| Where the exit sits | Same corner, same button | A toggle whose exit moves is two controls wearing one name. |
| Scrim or dim behind the panel | Neither | There is nothing behind to dim: the panel is opaque and covers the viewport. A scrim is a modal gesture on something that is not a modal, and `--sr-scrim` belongs to `.sr-dlg-root`. |

---

## Measurements

Measured against `design.html` in **Chromium and WebKit** through Playwright, at
1280px and 320px, at 100% and 200% in-app text scale, in both themes: twelve
runs, **identical in both engines**.

| Register | Disc | Gap | Row | Anchor | From right edge | Glyph ratio |
|---|---|---|---|---|---|---|
| `--std`, phone, 200% | 88.0px | 10px | 186.0px | 16px | **202.0px** | 34.0 / 88.0 = 0.386 |
| `--std`, phone, 100% | 44.0px | 10px | 98.0px | 16px | 114.0px | 17.0 / 44.0 = 0.386 |
| `--std`, desktop | 36.0px | 10px | 82.0px | 16px | 98.0px | 17.0 / 36.0 = 0.472 |
| `--compact`, phone, 200% | 80.0px | 10px | 170.0px | 12px | **182.0px** | 30.0 / 80.0 = 0.375 |
| `--compact`, phone, 100% | 40.0px | 10px | 90.0px | 12px | 102.0px | 15.0 / 40.0 = 0.375 |
| `--compact`, desktop | 30.0px | 10px | 70.0px | 12px | 82.0px | 15.0 / 30.0 = 0.500 |

The glyph ratio is constant across scales **within** a tier, which is the point
of `--sr-fab-glyph`. It differs between tiers because the phone tier grows the
disc and not the glyph, which is the shipped family's posture and not this
feature's to alter.

**The row wraps rather than overflowing.** Without `flex-wrap` + `max-width` it
would overflow to the *left*, off the edge of the map, where page `scrollWidth`
still reads a clean 320 and certifies a broken build (the cluster's own comment
records this exact failure). It wraps only if the container's content width
falls below **218px** standard or **194px** compact. Measured, it does not wrap
at any theme, tier or scale here, but the container widths belong to three
different hosts, so confirming that is the Tester's measurement (NFR-08), not
this document's claim.

Also confirmed on every run with a map expanded: the panel's rect equals the
viewport rect exactly; no ancestor of the panel carries a `transform`, `filter`,
`backdrop-filter`, `perspective`, `contain` or `will-change`; page `scrollWidth`
never exceeds `innerWidth`; no control's box leaves its map; no interactive
target falls under 24x24; Escape collapses and returns focus to the toggle; the
collapsed box measures identical to its pre-expand box; and `document.body`'s
captured `overflow` is restored rather than assumed.

*(These are measurements of the mockup's reproduction of the shipped stylesheet,
not of the built app. They settle the design; NFR-08's verification against the
built stylesheets on the three real hosts remains the Tester's.)*

---

## Pre-flight Self-Audit

`weft-design-lint`: **1 finding, accepted and annotated in the file.**
`banned-font` on `.app { font-family: 'Inter', system-ui, ... }`, which is the
product's own type stack copied byte for byte from `globals.css:809`. The
doctrine's own precedence rule gives `design-system.md` the specifics, and
rendering the app in a face it does not ship would make the mockup lie about the
thing it exists to show. The document layer around it was moved to Newsreader
(display) and IBM Plex Sans (body), both OFL, so it now shares no face with the
product it documents. All other rules pass.

- [x] Display face distinctive: Newsreader for the document layer; the app layer
      is Inter by design-system precedence, annotated.
- [x] Three typographic roles with real size and weight contrast.
- [x] Neutrals tinted; no pure `#000`, no dead gray. Shadows use the app's own
      ink (`rgba(15,17,23,…)` / `rgba(4,4,6,…)`).
- [x] One dominant colour plus a sharp accent; the green appears only on the
      accent tile, the pinned share state and the focus ring.
- [x] Background has depth: layered accent radials over the document ground.
- [x] Enter motion ease-out and under 300ms (150ms / 140ms).
- [x] Origin-aware where motion exists; the panel's *absence* of motion is
      reasoned above rather than skipped.
- [x] `prefers-reduced-motion` fallback present, mirroring `globals.css:2972`.
- [x] No motion anti-slop: no pulse, no blur-in, no hover-scale, no page
      stagger, no motion-on-mount for static content.
- [x] Layout content-driven (editorial split with a sticky rail), no card grid;
      the app frame is a viewport, not a card, so no nested elevation.
- [x] Content realistic: Varied Thrush, Winky the Great Horned Owl, Cape May
      Point, Brigantine, Nisqually. No lorem, no placeholder names.
- [x] Empty and loading states designed and shown (the Statistics placeholder
      twin, the no-coordinate named bird).
- [x] Components customised: nothing is a library default; every value is the
      shipped app's.
