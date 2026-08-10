# Design Spec — Map Location Buttons

**Feature:** map-location-buttons
**Date:** 2026-08-10
**Stage:** 4 — The Designer
**Source:** schema.md (approved), prd.md, strategic-brief.md
**Mockup:** `pipeline/map-location-buttons/design.html`

---

## Visual Direction

Nothing new is invented here. SnowRaven's map chrome is a settled system — white
circular FABs on `--sr-surface` with a 1px `--sr-border` and a soft drop shadow,
one accent-green pill for the primary mobile action, and a shape-carries-meaning
rule for anything that sits on the map. This feature adds one more control to
that row and corrects a glyph that never followed the rule.

The whole design problem reduces to one judgment: **two identical white circles
side by side must be told apart by silhouette alone**, at 17px, in grayscale, by
someone who has never seen the app before. Everything below serves that, plus the
two consequences of adding a fourth control to a row that was already full at
200% text scale, and giving a hundred characters of remediation text somewhere
honest to live.

Everything was measured in the running app in Chromium against the synthetic demo
dataset (`SR_DATA_DIR=website/tools/demo-data`), never the real export. Geometric
claims in this spec are measurements, not arithmetic.

---

## Screens / Views

### Map Explorer — the FAB cluster (all four view modes)

DOM order, unchanged from the Architect's §1.2 except for the message region:

```
.sr-map-fab-cluster
  ├─ div.sr-map-geo-error        ← NEW  (own full-width row, above the buttons)
  ├─ div.sr-map-fab-slot         (display: contents; SharePin portals here)
  ├─ button.sr-map-locate-btn    ← NEW
  ├─ button.sr-map-fullscreen-btn
  └─ button.sr-map-filters-btn   (mobile only, via CSS)
```

The three shipped controls keep their relative DOM order (FR-10, QA-14). The
message region is not focusable, so tab order is unaffected; it precedes the
buttons in reading order, which matches its visual position above them.

**Key design decisions for this view**

1. **The location button is a 36px circle matching `.sr-share-drop-btn`**, rising
   to `2.75rem` in the `≤640` tier. It duplicates that rule's declarations rather
   than extracting a shared base — the house pattern, since `.sr-share-drop-btn`
   was itself written as a deliberate duplicate of `.sr-map-fullscreen-btn`. Per
   the Architect: a *fifth* map FAB should force the extraction.

2. **The cluster wraps at 320px / 200% text scale.** Measured, not calculated:

   | 320px × 200% | share | locate | fullscreen | Filters | cluster width | leftmost edge | `document.scrollWidth` |
   |---|---|---|---|---|---|---|---|
   | shipped, 3 controls | 88 | — | 36 | 124.9 | 268.9 | 35.1 | 320 |
   | 4 controls, no fix | 88 | 88 | 36 | 124.9 | **366.9** | **−62.9** | 320 |
   | 4 controls, wrapped + capped | 88 | 88 | 36 | 124.9 | 288 | 16 | 320 |

   The broken row clips the share button 62.9px off the left edge of the
   viewport, where it is unreachable — **and `document.scrollWidth` still reads a
   clean 320**, because a left overflow on an absolutely positioned element never
   extends the scroll width. See *Verification obligations* below.

3. **The failure message is a full-width row inside the cluster**, not a floating
   overlay at the top of the map. This is a departure from the Architect's §3
   and is argued in full under *The failure message*.

4. **The location button is absent in the one branch with no map.** See
   *The setup-required state*.

### The other four share-pin surfaces

Species Detail (pins and heatmap), Statistics, Named Birds card maps: **glyph
change only**. No location button, no message region, no layout change. The
`compact` sizing, `aria-pressed`, both accessible names, the `title`, the drop
gesture, the drag, the popup and the sprite are all untouched (FR-20, QA-26).

---

## The glyph pair

### Share button: `MapPin` → `FlagTriangleRight`

Confirming the Architect's proposal, on inspection of the real path geometry.

`SharePinSprite` is a vertical staff at `x=6` running from `y=32.4` to `y=3.4`,
a right-pointing triangular pennant `(6.9,2.6) → (22.4,7.1) → (6.9,12.6)`, and a
foot circle at `(6, 31.4)`. `FlagTriangleRight` is
`M6 22V2.8 … l11.38 5.69 … L6 15.5` — the **same staff on the same axis, the
same right-pointing triangular pennant from the top of it**. The proportions
differ (lucide's pennant is a larger share of the staff) but the construction is
identical, which is what a glyph has to get right.

Rejected:
- **`Flag`** — a wavy banner on a short pole. The sprite's pennant is a hard
  triangle; at 17px this one collapses into a filled rectangle and loses the
  feature that identifies it.
- **`FlagTriangleLeft`** — mirrored. It would point the pennant away from the
  coordinate the staff marks.

The sprite's foot circle has no counterpart in the glyph, correctly: it is the
marker's coordinate anchor, not part of the flag's identity.

### Location button: `Navigation` → **`LocateFixed`**

**This is a change from FR-18's stated default, and it carries an obligation.**

FR-18 proposes `Navigation`, matching the shipped sidebar control. Two problems,
both visible in the mockup's pair test:

1. **Silhouette collision.** `Navigation` is a polygon whose dominant mass is a
   **triangle**. `FlagTriangleRight`'s dominant mass is *also* a triangle. Set
   them side by side at 17px and the only thing separating them is a hairline
   staff. FR-21 requires different silhouettes in grayscale; triangle-with-a-stick
   against triangle satisfies that only on a technicality, and reproduces the
   exact failure this feature exists to fix — two controls in the corner of a map
   that you cannot tell apart at a glance.
2. **Wrong meaning.** `Navigation` is the turn-by-turn/heading glyph in every
   mapping app. It says *go there*, not *centre on me*.

`LocateFixed` — a `r=7` ring, a `r=3` centre dot, four cardinal ticks outside the
ring — is radial, symmetric and centred on a point. Against a tall, asymmetric,
top-heavy flag it is the maximum contrast available, and it is the shape a birder
has already learned from every phone map they own (it is also what MapLibre's own
geolocate control draws).

Rejected:
- **`Crosshair`** — its ring is `r=10`, so it runs to the edge of the viewBox and
  reads as a heavy second circle inside a circular button. Semantically it means
  *aim at a point on the map*, which is what the share pin does.
- **`Locate`** — right family, but without the centre dot it is an empty reticle:
  a target, not a position. The dot is the part that says *me*.
- **`Compass`** — orientation, not position.

**Obligation this creates.** FR-18's point is that the two controls doing the same
job read as the same thing, and that is a two-site invariant. Moving the FAB off
`Navigation` therefore means **the sidebar's "Use my location" button changes
glyph in the same edit** (`MapExplorer.tsx:1028`). Glyph only: the label, the
13px size, the `--sr-accent` colour, the `disabled` behaviour and the layout are
all untouched.

**Deliberately out of scope, recorded so it is not read as an oversight.**
`Settings.tsx:1603` (the saved-default-location control) and
`WeatherForecastPanel.tsx:359` (the "Current" lookup) also use `Navigation`. They
stay. FR-18's invariant is about the two controls that centre the Map Explorer
map; Settings sets a persisted default and Weather runs a lookup, both on other
tabs, never on screen beside the FAB. If app-wide consistency for "use my
location" is wanted later, Settings is the one to follow with.

---

## The failure message

### Placement — a departure from schema §3, with the measurements that forced it

The Architect specified a top-centre pill following `.sr-map-loading-chip`, with a
`--below-chip` modifier and a `top` offset for me to choose. Measuring the real
app rules that out:

- **`top: 12px` overlaps the layer switcher at every phone size.** `.sr-map-layers`
  is `top: 8; right: 8; max-width: calc(100vw - 16px)`, so on a phone it spans the
  full width: **75px tall at 100%, 105px at 200%** (measured at 320px).
  `elementFromPoint` at the message's centre returns `DIV.sr-map-layers` —
  the two occupy the same space. FR-16 forbids exactly this.
- **Clearing the switcher does not help.** At 320×760 with 200% text scale the
  map area is only **363px** tall. The switcher takes the top 113px and the
  wrapped four-control cluster the bottom 154px, leaving a free band of **96px**.
  The longest `describeLocationError()` string renders **227px** tall. Nothing
  fits at the top.
- The switcher's height is also not a clean `rem` multiple (75px → 105px for a
  16px → 32px root), so any offset that cleared it would be an unexplained magic
  number fitted to one viewport and one locale.

**Decision: the message is a full-width flex row inside the bottom-anchored
cluster, first in DOM order, above the buttons.**

This is not a workaround; it is better on every axis, and it deletes the magic
number rather than choosing one:

| Property | Why it matters |
|---|---|
| **Proximity** | It appears directly above the button that produced it, where the eye and thumb already are, instead of 300px away at the top of the map. |
| **The buttons never move** | The cluster is bottom-anchored, so a new row extends it *upward*. Measured across empty / short / longest message at three viewports: every button's `top` and `left` is byte-identical. The control the user must press to retry does not shift under their finger. |
| **No offset arithmetic** | `flex: 0 0 100%` claims the row; the cluster's `row-gap` is the gap; its `justify-content: flex-end` is the alignment; its `max-width` is the width cap. One set of declarations doing two jobs. |
| **Safe area for free** | `.sr-ios-app .sr-map-fab-cluster` already insets the cluster, so the message inherits iOS safe-area handling with no new rule. |
| **Live-region contract holds structurally** | The region is a sibling of the button that feeds it, so it is mounted whenever a message can be produced — present from first render (QA-20), and absent only in the mobile-Filters-overlay state where the button cannot be pressed anyway (FR-12). |
| **Never covers a control** | Measured `false` for overlap against every cluster button and against the attribution, at every size and message length. |

Because the message sits inside the cluster, **`--below-chip` is not needed and
should not be built.** The loading chip lives at the top of the map and the
message now lives at the bottom; they cannot collide. `.sr-map-loading-chip` is
untouched, as the Architect required, and `chipVisible` need not be extracted.

### The one residual, named

At 320px with 200% text scale and the longest string, the message is 227px tall
in a 363px map area: it covers the layer switcher and spills roughly 28px above
the map's top edge. **No placement avoids this** — the message alone is 62% of
the available height. It is acceptable because it covers no control, it is
click-through so the switcher underneath stays operable, and it clears on the
next successful detection or view-mode change. FR-16 asks that neither the
cluster nor the switcher be obscured; at this one combination only one can yield,
and the switcher is the item with nothing to do with the failure.

### Appearance

| Property | Value | Reasoning |
|---|---|---|
| fill / border / text | `--sr-error-bg` / `--sr-error-border` / `--sr-error` | The audited pair. **4.82:1** light, **7.07:1** dark. No new token and no new parse-the-tokens contrast test (NFR-03, QA-34). |
| opacity | fully opaque | It sits over live canvas and, in the extreme case, over the switcher. A solid fill stays legible instead of muddling two layers. |
| radius | `12px` | The chip's 20px pill radius is for a single line; on a two-to-six-line block it reads as a lozenge. 12px reads as a card. |
| shadow | `0 2px 8px rgba(0, 0, 0, 0.18)` | Identical to `.sr-map-loading-chip`, so it reads as the same family of map chrome. (Literal rgba shadows are the established convention for this family.) |
| icon | lucide `CircleAlert`, 14px, `aria-hidden`, top-aligned in a gutter | Carries "problem" without relying on red alone. Already imported in `MapExplorer.tsx`; no new import. |
| alignment | left-aligned text, icon in a gutter | Centred is right for the one-line loading chip and wrong for a wrapped instruction. |
| max-width | `28rem` | ≈72 characters at `0.75rem` — the top of a comfortable measure. The longest string lands in 2 lines on desktop. |
| font-size / line-height | `0.75rem` / `1.45` | Matches the chip's size; the looser leading is for multi-line reading. |
| pointer-events | `none` | Verified: a pointer at the message's centre reaches `CANVAS.maplibregl-canvas`. |

---

## Component Usage

| Component | Use |
|---|---|
| lucide `FlagTriangleRight` | Share drop button, all five surfaces. Replaces `MapPin`, size `s.icon` (17/15), `strokeWidth 2.2` — all unchanged. |
| lucide `LocateFixed` | Location FAB (idle) at 17px `strokeWidth 2.2`, **and** the sidebar "Use my location" control at 13px `strokeWidth 2` (replacing `Navigation`). |
| lucide `Loader2` | Location FAB while locating, 17px, `.spin`, `--sr-accent`. Matches the sidebar's existing spinner. |
| lucide `CircleAlert` | 14px, `aria-hidden`, in the message gutter. |
| `.sr-share-drop-btn` | The visual reference `.sr-map-locate-btn` duplicates. Not altered (FR-04). |
| `.sr-map-fab-cluster` | Gains five declarations (below). Its three shipped children are untouched. |

### New CSS

```
.sr-map-locate-btn            /* 36px circle: .sr-share-drop-btn's declarations,
                                 incl. flex: none. @≤640 → 2.75rem (FR-04) */
.sr-map-geo-error             /* flex: 0 0 100%; justify-content: flex-end;
                                 pointer-events: none */
.sr-map-geo-error:empty       /* display: none  — LOAD-BEARING, see below */
.sr-map-geo-error-msg         /* the card: tokens + radius + shadow + entrance */
```

### Added to `.sr-map-fab-cluster`

```css
flex-wrap: wrap;
justify-content: flex-end;
row-gap: 10px;
max-width: calc(100% - 32px);
pointer-events: none;              /* + .sr-map-fab-cluster button { pointer-events: auto } */
```

**What each one actually does** (measured; this refines the Architect's §7.1,
which expected the cap to be what made it fit):

- **`flex-wrap: wrap`** does the load-bearing work. CLAUDE.md's v0.5.82 rule — a
  container that is never narrowed never breaks a line — **does not bite here**:
  the cluster is absolutely positioned, so its shrink-to-fit width is already
  bounded by the map area, and the wrap binds on its own. Alone it stops the
  clipping, but it leaves the cluster flush against the *left* edge with the
  Filters pill orphaned in the bottom-left corner, which reads as a bug.
- **`justify-content: flex-end`** does the visible work: right-aligns both rows so
  the wrap reads as a deliberate two-row cluster rather than a collapse.
- **`max-width: calc(100% - 32px)`** guarantees the 16px left gutter. **At
  today's content widths it changes no rendered position**; it bounds the failure
  for a longer Filters label, another locale, or a fifth control. Stating this
  honestly matters more than restating the arithmetic that motivated it.
- **`row-gap: 10px`** matches the existing column `gap` so the two rows share one
  rhythm.
- **`pointer-events: none` + `auto` on buttons** is new and necessary. The cluster
  box grows from 134px to 371px tall once a message is in it, and an absolutely
  positioned div swallows every gesture inside its box. Verified after the change:
  a pointer at the message's centre and in the gaps between the FABs both reach
  `CANVAS.maplibregl-canvas` — the gaps did not before, so this also fixes a
  pre-existing dead zone.

**`.sr-map-geo-error:empty { display: none }` is load-bearing, not cosmetic.** A
`flex: 0 0 100%` row with no content still claims a full row plus a `row-gap`,
which would push every button down ~10px permanently. Verified: with the rule, the
empty cluster measures byte-identically to no region at all. It also means no
stray text node may be rendered inside the container — `{geoError ? <span/> : null}`
and nothing else. A `{' '}` would silently defeat it.

---

## Design Tokens Applied

All new colour is `var(--sr-*)`; no new token is introduced (NFR-03, QA-34).

| Element | Token |
|---|---|
| Locate button surface / text / border | `--sr-surface` / `--sr-text` / `--sr-border` |
| Locate button hover | `--sr-surface-subtle` |
| Locate button glyph while locating | `--sr-accent` |
| Message fill / border / text | `--sr-error-bg` / `--sr-error-border` / `--sr-error` |
| Message shadow | `0 2px 8px rgba(0, 0, 0, 0.18)` (matches `.sr-map-loading-chip`) |

The `--sr-error` on `--sr-error-bg` pair is already tuned and recorded at
`globals.css:44`: **4.82:1** light (`#D31F1F` on `#FEF2F2`) and **7.07:1** dark
(`#F87171` on `#1C0505`). Both clear AA, so no new contrast guard is required.

---

## Interaction Notes

### Accessible names — the six cluster names, pairwise distinct (FR-07, QA-10)

| Control | State | Accessible name |
|---|---|---|
| Share pin | no pin | `Drop a pin at the map center` |
| Share pin | pin planted | `Move the pin to the map center` |
| **Location** | **idle** | **`Center the map on my location`** |
| **Location** | **locating** | **`Finding your location`** |
| Fullscreen | collapsed | `Enter fullscreen` |
| Fullscreen | expanded | `Exit fullscreen` |

`title` mirrors the accessible name in both states, following `SharePin`.

- **One name on all four views.** The promise is identical everywhere: centre the
  map on me. On the three centre views the same press *may* also run a search,
  but only when both coordinate fields were empty — a condition the user cannot
  see, so a name promising a search would be a lie whenever the fields are already
  filled. A name that changed with the view would also make a screen-reader user
  relearn the control on every mode switch. This resolves the brief's "one button,
  four views, possibly two meanings" in favour of one honest name.
- **"Finding your location"** matches the app's own loading vocabulary ("Finding
  hotspots", "Finding sightings", "Finding nearby lifers"). The sidebar's visible
  "Locating…" is deliberately not reused as a name: a bare gerund reads oddly out
  of context and a trailing ellipsis is announced inconsistently.
- **Label in Name (WCAG 2.5.3) does not constrain this control.** Both states are
  icon-only with no visible text, so the accessible name is the only name and
  Voice Control has nothing else to match against. Both are short enough to speak.

### Busy state

- `aria-disabled={isLocating}`, **not** `disabled` — ratifying the Architect.
  Disabling a focused button drops focus to `<body>` in most browsers, breaking
  FR-06 for the button just pressed. The re-entrancy guard lives in the button's
  own `onClick` (`if (isLocating) return`) so `handleUseMyLocation` stays
  textually unchanged (QA-03).
- `cursor: default` while locating.
- **The busy state must be legible without motion.** The app's global
  `prefers-reduced-motion` block (`globals.css:1985`) sets
  `animation-duration: 0.001ms !important` on `*`, so `.spin` freezes. The state
  therefore cannot rest on rotation: the **glyph itself changes shape** (a closed
  ring with a centre dot becomes an open arc) and takes `--sr-accent`. Shape
  first, colour second, motion third — so the state survives reduced motion and
  colour-blindness alike.
- The button surface is *not* tinted to `--sr-accent-bg` while busy: that is the
  neighbouring share button's "holding a pin" signal, and reusing it one control
  away would collide semantically.

### The setup-required state — the Architect's open question, decided

On My Sightings with no backup loaded, `<SetupRequired>` replaces the map while
the cluster still renders above it. A press there detects successfully, arms
`panTarget`, and — with no `MapEffects` mounted to consume it — does nothing
observable. The Architect accepted this rather than reintroduce a gate FR-02
forbids.

**Decision: the location button renders whenever a map is mounted. It is absent
in the single branch where `<SetupRequired>` replaces the map**
(`viewMode === 'sightings' && isSetupRequired`).

- **A control that produces no observable result teaches the user it is
  unreliable.** That is precisely the lesson today's pin button teaches, and the
  reason this feature exists. Shipping a second control that teaches it again
  would be self-defeating.
- **It can raise an OS location prompt for no benefit.** In an app whose entire
  posture is privacy-first, requesting location it cannot act on is a real cost,
  not a cosmetic one.
- **Disabling it is worse than hiding it.** A dimmed control with no explanation
  is a dead end for everyone, and the house rule already prefers replacing such a
  control with something honest over dimming it. Here the honest replacement is
  already on screen: `<SetupRequired>` *is* the explanation, and it carries its
  own "Go to Settings" action.
- **FR-02's intent is preserved.** FR-02 exists so the button is not gated on the
  user's *data*, and it is not: on Hotspots, Nearby Lifers and Media Targets the
  map renders even when `isSetupRequired` is true, and so does the button. The
  gate here is not "is there data" but "is there a map", and it is the same
  boolean already governing the ternary — no new state, no new coupling.

**This needs ratifying, not absorbing.** QA-02 as written tests the
sightings + setup-required combination and will fail; it should be amended to the
three centre views, where the button's independence from data can actually be
observed. Flagged as a deliberate amendment, not a silent deviation.

### Unchanged

The right-click / long-press drop gesture, the sidebar "Use my location" button's
behaviour and label, the Settings default-location flow, the share pin sprite,
popup and drag, and the blue `DetectedLocationPin` are all untouched.

---

## Motion Spec

All motion uses the house vocabulary already in `globals.css`:
`cubic-bezier(0.16, 1, 0.3, 1)`, under 200ms, with an end state that **is** the
resting state. The global `prefers-reduced-motion` block collapses every animation
to ~1µs, so nothing is lost when it fires — and per the explicit comment at
`globals.css:1458`, **no per-component reduced-motion query may be added.**

- **Message enters**: `cubic-bezier(0.16, 1, 0.3, 1)`, `190ms`, `opacity 0 → 1` +
  `translateY(-6px) → 0` (origin-aware: it drops down from the top edge of the
  row it is anchored to), reduced-motion → global block collapses it and the end
  state is the resting state. Implemented as a CSS `@keyframes` on
  `.sr-map-geo-error-msg`.
- **Message repeats**: same animation, replayed. It replays for free because the
  sequence-keyed child remounts — the *same* mechanism that re-announces it to a
  screen reader, so the visual and the aural cue stay in lockstep. CSS only.
- **Button hover / focus tint**: `cubic-bezier(0.16, 1, 0.3, 1)`, `140ms`,
  `background`/`color`/`border-color`, inherited verbatim from
  `.sr-share-drop-btn`, reduced-motion → global block. CSS only.
- **Locating spinner**: `linear`, `0.7s` loop, existing `.spin` class,
  reduced-motion → stops, and the glyph *shape* change carries the state instead.
  A continuous progress loop is not an enter/exit transition, so the sub-300ms
  rule does not apply to it.

No Motion/Framer dependency is needed or wanted: every one of these is plain CSS,
matching how Pin Share was built (NFR-01 forbids a new dependency anyway).

---

## Content Notes

- Every failure string is `describeLocationError()` output, rendered **verbatim**
  (FR-13, QA-17/18). No prefix, no suffix, no "Sorry", no truncation. All five
  reachable codes and all four platform variants are shown in the mockup.
- No new user-facing copy contains an em dash (FR-24). The two accessible names
  and the `title` values are clean; the error strings use `→`, not `—`.
- Sentence case throughout, matching the shipped names.
- `docs/HELP.md`, `README.md`, `website/index.html`, `ROADMAP.md` and
  `ACCESSIBILITY.md` need the same edit in the same change (FR-22, FR-23).
  Two specifics for the writer:
  - `ACCESSIBILITY.md`'s map-controls list ("zoom, base-layer switcher, filters,
    fullscreen") must gain the location control **and** the share pin, which is
    also missing from it today.
  - Any sentence describing where the location control lives must say the map
    surface *and* the sidebar, since both now exist on the three centre views.

---

## Verification obligations handed to The Engineer

These are in addition to the Architect's §10, and each one exists because the
obvious check passes on a broken build.

1. **QA-16 must not be a `document.scrollWidth` assertion.** Measured: the broken
   4-control cluster leaves the share button 62.9px off the left edge of the
   viewport while `document.scrollWidth` reads exactly 320. The overflow is to the
   *left*, and a left overflow on an absolutely positioned element never extends
   the scroll width. Assert each cluster child's box against the cluster's content
   box, in a browser, at 320px and 200% text scale.
2. **Assert the buttons do not move when a message appears.** Capture every
   cluster button's frame-relative `top` and `left` with the region empty, with a
   short message, and with the longest message; all three must be identical. This
   is the property that makes the in-cluster placement correct, and nothing else
   tests it.
3. **Assert `.sr-map-geo-error:empty` collapses.** Without it every button sits
   ~10px lower forever, which no functional test would notice.
4. **Assert pointer transparency after the `pointer-events` change.**
   `elementFromPoint` at the message's centre must return the maplibre canvas, and
   so must a point in the gap between two FABs.
5. **The glyph swap is a two-site edit.** `SharePin.tsx` (`MapPin` →
   `FlagTriangleRight`) and `MapExplorer.tsx:1028` (`Navigation` → `LocateFixed`).
   Missing the second leaves the two controls that do the same job wearing
   different faces, which is FR-18's whole point. Do **not** touch
   `Settings.tsx:1603` or `WeatherForecastPanel.tsx:359`.
6. **Do not route the glyph through any remount key** (NFR-05, QA-36). It is a
   leaf `<svg>` inside an existing `<button>`; `plantSeq`, `sharePinResetKey` and
   `MapBoundsFitter` must not learn about it.
