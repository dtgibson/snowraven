# Design Refinement — Uniform Map FABs

Improve lane, Stage 2. Refines surfaces that already ship: the Map
Explorer FAB cluster on all four views. No new screen, no new flow, no
new capability. If any part of this starts requiring a screen or an
action the user could not already reach, stop and surface it as a scope
change.

---

## Visual Direction

The bottom-right cluster should read as **one row of map furniture**:
three identical discs of the same diameter, gap, surface, border and
shadow, each carrying a glyph of the same optical weight, followed (on
a phone) by the Filters pill. Nothing about the row should tell you
which view you are on except the glyph in the third disc.

The unifying idea, and the rule the whole refinement hangs off:

> **Each FAB's glyph names the map object it acts on.**

`LocateFixed` is a crosshair on you. `FlagTriangleRight` is the planted
share flag. `MapPin` is the teardrop search centre. Three shapes, three
objects, and each button's glyph is a small picture of the thing that
will respond to it. This is the v0.5.83 "shape carries the distinction"
decision extended to a third meaning rather than blurred: the glyph in
the share slot *changes by view* precisely because the pin it commands
changes by view.

Everything else stays exactly as shipped. This is a sizing and
consistency pass with one new control, not a redesign of the map.

---

## What changes vs today

### My Sightings (`viewMode === 'sightings'`)

| | Today | After |
|---|---|---|
| Share slot | `FlagTriangleRight`, `.sr-share-drop-btn`, 36px / 44px phone | Identical behaviour and glyph. Class becomes `sr-map-fab sr-map-fab--std sr-share-drop-btn`; box becomes `2.25rem` / `2.75rem` phone |
| Locate | `LocateFixed`, 36px / 44px phone | Same, base class applied, box in rem |
| Fullscreen | `Maximize2` at **16px / strokeWidth 2.5**, box **36px at every width** | `Maximize2` at the family's glyph size / strokeWidth **2.2**, box `2.25rem` / **`2.75rem` phone** |
| Filters pill | fixed `height: 36px` on phone | gains `.sr-touch-target` (see *Secondary*) |

Net visible change on this view: the fullscreen disc grows on a phone
and its glyph gets very slightly larger and lighter in stroke. Nothing
moves position; the cluster is bottom-anchored, so it grows upward.

### Hotspots, Nearby Lifers, Media Targets (`isCenterView`)

| | Today | After |
|---|---|---|
| Share slot | **empty** (`.sr-map-fab-slot` renders nothing) | **new**: the centre-share FAB, `MapPin` glyph, opens the existing centre pin's `SharePopup` |
| Locate | as My Sightings | as My Sightings |
| Fullscreen | as My Sightings | as My Sightings |

Net visible change: a two-button row becomes a three-button row, and
the tab order gains one stop at the front of the cluster. **No second
pin is ever created on these views.** The existing search-centre pin
stays the only pin, and the FAB is a second route to the popup that pin
already opens (v0.5.80 sub-decision 3, extended, not reversed).

---

## Screens / Views

### 1. The cluster, all four views

Layout, order and geometry are unchanged from v0.5.83 and must stay so:

- DOM order, top to bottom / left to right:
  `.sr-map-geo-error` (full-width message row, first) → **share-family
  button** → **locate** → **fullscreen** → **Filters**.
- The cluster wrapper stays mounted unconditionally; the `!sidebarOpen`
  gate stays *inside* it. The new button goes inside that gate with the
  other three.
- `.sr-map-fab-slot` keeps `display: contents`. **No `order` anywhere.**
  DOM order is visual order is tab order.
- The new centre-share button is a **direct child** in the slot's DOM
  position, not a second `display: contents` slot and not a portal: it
  lives in `MapExplorer`, which already owns `centerShareOpen`, so it has
  no `<SnowMap>` boundary to cross. This is the locate button's own
  recorded reasoning, applied again.
- `.sr-map-geo-error` keeps its always-rendered `role="status"`
  contract. **No `:empty` rule, no `display`/`visibility`/
  `content-visibility` hiding value may be added to it or to any rule
  whose subject is that region.**

### 2. The new centre-share FAB

**Glyph.** Lucide `MapPin` — the same teardrop-with-a-dot that
`CenterPin` draws on the map. The button is a picture of the pin whose
popup it opens.

**Three states, each designed.**

| State | Condition | Visual | Accessible name |
|---|---|---|---|
| Ready | `hasValidCenter`, popup closed | Standard FAB: `--sr-surface`, 1px solid `--sr-border`, glyph `--sr-text` | `Copy the search center location` |
| Open | `hasValidCenter`, popup open | Accent tint: `--sr-accent-bg` fill, `--sr-accent` glyph, `--sr-accent-border-strong` border, `aria-expanded="true"` | `Close the location popup` |
| No centre | `!hasValidCenter` | Same box, **dashed** border, glyph `--sr-text-disabled`, no hover, `cursor: default`, `aria-disabled="true"` | `Set a search center to copy its location` |

**Why `aria-expanded`, not `aria-pressed`.** The neighbouring share
button's `aria-pressed` means "this map is holding a pin" — a property
of the map. This button holds nothing; it discloses a popup. The
correct property is `aria-expanded`, and using it is what keeps the two
buttons from making the same promise with the same green tint. The
*visual* tint is deliberately identical (one app, one active
convention); the *carrier and the meaning* differ. The two can never be
on screen together — `viewMode === 'sightings'` and `isCenterView` are
mutually exclusive — so a user never sees one green disc meaning two
things.

**Why the button toggles.** `aria-expanded` on a button that can only
expand is a lie. Pressing it while open closes the popup, which also
gives the user a way back from a press they did not mean. It must route
through the **one** close path (`closeCenterShare`), per the repo's
overlay rule.

**Why the no-centre state is present and disabled, not absent.**
Uniformity is the point of this change; a button that vanishes on some
centre views at some times rebuilds exactly the ragged row being fixed.
`aria-disabled`, not `disabled`, follows the locate button's
focus-preserving precedent (disabling a focused button drops focus to
`<body>`), and keeps it reachable so a keyboard user can read the
tooltip that tells them how to enable it. The **dashed border** carries
the state as *shape*, not colour alone — the same "shape first, colour
second, motion third" ordering the locate button's busy state uses, and
it reads as "this slot is not filled yet" rather than as "this control
is broken". Geometry is byte-identical to the ready state (same 1px
border box), so the row never shifts when a centre is set.

**Pan-to-pin.** If the centre coordinate is outside
`map.getBounds()`, pressing the FAB must first bring the camera to it,
or the user presses a button and sees nothing (the popup opens
off-screen). Reuse the shipped path: arm `panTarget`, let `MapEffects`
consume it (`flyTo`, 600ms). This is a **camera move only** — it does
not touch `lat`/`lng`, does not re-run the search, and does not move the
pin. If the centre is already inside the bounds, do not pan; gratuitous
motion on an unchanged view is exactly what the doctrine forbids.

**Focus restoration.** The popup now has two possible openers (the pin
and the FAB). Track the opener in a ref and restore to it after the
close render commits, falling back to the map canvas if it has
unmounted. This is `SharePin`'s `openerRef` shape; today's
`restoreCenterPinFocusRef` unconditionally focuses the pin, which would
send focus to the wrong control after a FAB-opened popup closes.

**Label distinctness (v0.5.83 FR-07).** All names in the cluster stay
pairwise distinct across every state:
`Drop a pin at the map center` · `Move the pin to the map center` ·
`Copy the search center location` · `Close the location popup` ·
`Set a search center to copy its location` ·
`Center the map on my location` · `Finding your location` ·
`Enter fullscreen` · `Exit fullscreen` · `Open map filters`.

### 3. The shared circular-FAB base class

Three hand-duplicated copies become one base plus size modifiers. The
semantic classes survive as **state hooks only**.

```css
/* 1. Base — every shared, size-independent declaration. */
.sr-map-fab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex: none;
  background: var(--sr-surface);
  color: var(--sr-text);
  border: 1px solid var(--sr-border);
  border-radius: 50%;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
  transition: background 140ms cubic-bezier(0.16, 1, 0.3, 1),
              color 140ms cubic-bezier(0.16, 1, 0.3, 1),
              border-color 140ms cubic-bezier(0.16, 1, 0.3, 1);
}
/* 2. The glyph follows the box. See "the unit rule" below. */
.sr-map-fab svg { width: var(--sr-fab-glyph); height: var(--sr-fab-glyph); }
/* 3. Hover — before the state rules, see the cascade note. */
.sr-map-fab:hover { background: var(--sr-surface-subtle); }
/* 4. Size modifiers. */
.sr-map-fab--std     { --sr-fab-glyph: 1.0625rem; width: 2.25rem;  height: 2.25rem; }
.sr-map-fab--compact { --sr-fab-glyph: 0.9375rem; width: 1.875rem; height: 1.875rem; }
/* 5. Per-control state rules keep their existing selectors and values. */
.sr-share-drop-btn[aria-pressed="true"] { /* unchanged */ }
.sr-map-locate-btn[aria-disabled="true"] { /* unchanged */ }
.sr-map-center-share-btn[aria-expanded="true"] { /* new, same three values */ }
.sr-map-center-share-btn[aria-disabled="true"] { border-style: dashed; cursor: default; }
.sr-map-center-share-btn[aria-disabled="true"] svg { color: var(--sr-text-disabled); }
```

Phone tier (`@media (max-width: 640px)`), replacing the three
hand-written entries:

```css
.sr-map-fab--std     { width: 2.75rem; height: 2.75rem; }
.sr-map-fab--compact { width: 2.5rem;  height: 2.5rem;  }
```

Element classes:

| Element | Classes |
|---|---|
| Share drop button (non-compact) | `sr-map-fab sr-map-fab--std sr-share-drop-btn` |
| Share drop button (compact) | `sr-map-fab sr-map-fab--compact sr-share-drop-btn sr-share-drop-btn--compact` |
| Locate | `sr-map-fab sr-map-fab--std sr-map-locate-btn` |
| Fullscreen | `sr-map-fab sr-map-fab--std sr-map-fullscreen-btn` |
| Centre-share (new) | `sr-map-fab sr-map-fab--std sr-map-center-share-btn` |

**The unit rule, stated because it is the reason the glyph rule exists.**
The lucide `size={17}` prop renders a **px** `width`/`height` attribute,
so today a phone FAB grows from 44px to 88px at 200% text scale while
its glyph stays 17px — a big empty disc at exactly the condition this
refinement is judged at. The fix is not a bigger literal:

> **A glyph's unit must match its box's unit, or the ratio breaks at
> scale.**

Both go to rem, and the ratio is scale-invariant by construction rather
than correct at the one scale someone sampled. Keep the `size={}` props
in the TSX (they are the no-CSS fallback and the SSR-free default); CSS
wins over presentational attributes, so the rem rule governs.

**Consequence to flag: desktop FABs now grow with text scale.** Today
the base is a fixed `36px` at every scale; `2.25rem` is 36px at 1x and
72px at 200%. That is the correct behaviour by this repo's own
conventions (size in rem so it holds at 200%; rem also tracks a browser
default the user has lowered), and the phone tier already behaved this
way. The alternative — keep 36px fixed on desktop — was rejected
because it forces a px glyph, which re-opens the ratio bug on the
desktop side and leaves two sizing idioms inside one family. Named so
the Engineer can raise it rather than discover it.

#### Horizontal fit at 320px and 200% text scale — measured

Measured in Chromium against a real render of `design.html`, element box
against container content box (never `document.scrollWidth`, which
cannot see a left overflow on an absolutely positioned element and will
certify a broken build):

| | Today | After |
|---|---|---|
| Disc row (3 discs + 2 × 10px gap) | 232.00px | **284.00px** |
| Filters pill row | 139.14px | 139.14px |
| Binding row | discs | **discs** |

The cap is `max-width: calc(100% - 32px)`, and `100%` resolves against
the **padding box** of `.sr-map-content` (the cluster's positioned
ancestor; it declares only `position: relative`, so its padding box is
its border box today). At a full 320px content box the cap is 288px and
the slack is **4px**. Anything that narrows that box — page padding, a
border, a scrollbar — reduces the slack one-for-one. In `design.html`'s
own specimen, which carries a 1px border, the cap computes to 286px and
the slack is 2px. That 2px difference is why this is a measurement and
not a sum.

**So this change consumes almost all the horizontal slack in the
cluster, and the Engineer must re-measure it in the running app**, at
320px and 200% text scale, on a centre view (three discs plus the pill).

The failure mode is **bounded, not broken**: `flex-wrap` and
`justify-content: flex-end` already handle it, so a row that does not fit
wraps the fullscreen disc onto its own line and nothing leaves the
viewport. **Pre-approved escape hatch if the app measures short:** drop
the cluster's column `gap` to `8px` in the ≤640 tier while keeping
`row-gap: 10px`, which buys 4px. Do **not** cap the disc below
`2.75rem` — that is the touch-target posture, and it is the requirement,
not the thing that yields.

**Values at 1x are unchanged everywhere except the fullscreen button.**
`--std` 36px / 44px phone, `--compact` 30px / 40px phone, glyphs 17px /
15px. The extraction is therefore provable as a **byte-identical
render** on every surface it touches except the one control this change
intends to move, which is the claim to test.

#### Cascade note — required before this ships

**A shared base plus a modifier puts two same-specificity rules on one
element, so source order decides.** `.sr-map-fab` and
`.sr-map-fab--std` are both (0,1,0). Required source order, and it is
not optional:

1. `.sr-map-fab` (base)
2. `.sr-map-fab svg` (glyph)
3. `.sr-map-fab:hover`
4. `.sr-map-fab--std` / `--compact` (size)
5. per-control state rules (`[aria-pressed]`, `[aria-expanded]`,
   `[aria-disabled]`)
6. the `@media (max-width: 640px)` tier

Step 3 before step 5 is the concrete regression this extraction can
introduce: `.sr-map-fab:hover` and
`.sr-share-drop-btn[aria-pressed="true"]` are **both (0,2,0)** and both
set `background`. Today the pressed rule sits immediately after the
hover rule and wins on a hovered, pinned button. Move the state rules
above the base block and a hovered pinned button silently loses its
green tint — a defect no value diff would catch.

**Per the repo's v0.5.81 convention, this extraction needs a
cascade-competitor scan at build time**, and three properties of that
scan are load-bearing:

- It covers **every stylesheet the bundle emits**, not just
  `globals.css`. SnowRaven also ships `vendor-maplibre-*.css` (imported
  by `SnowMap.tsx`, and it stays in the document once any map tab has
  mounted), and these buttons live inside a map container.
- It tests the **rightmost compound** of each selector, since an
  ancestor part of a descendant combinator can always be satisfied.
- It records the **`@layer`**, not only the specificity. `globals.css`
  is unlayered and Tailwind preflight sits in `@layer base`; unlayered
  beats layered regardless of specificity, and preflight's
  `* { padding: 0 }` and `button { border: ... }` compete directly with
  the base's `padding` and `border`. Verify the layer mechanically
  (brace depth at the rule in the built CSS), not by eye.

Note this is a **class-to-class** move, not the inline-to-class move
that convention was written for: specificity is unchanged at (0,1,0), so
the scan is proving the new shared rule cannot be outranked, not
repairing a specificity drop. Say so in the test's comment, or the guard
will be read as answering a question it does not answer.

**Test-name hazard.** A substring grep for `.sr-map-fab` also matches
`.sr-map-fab-cluster` and `.sr-map-fab-slot`. `mapFabClusterCss.test.ts`
already reads exact top-level selector keys via `parseTopLevelRules`;
keep it that way and extend that file rather than adding a parallel one.

### 4. Secondary: the Filters pill

Not one of the change brief's two named non-uniformities, so flagged
rather than assumed. At 320px and 200% text scale the pill is a fixed
`height: 36px` box carrying `0.8125rem` text that has grown to 26px,
sitting beside three 88px discs. It is the last thing in the row that
does not read as part of the family, and the repo already has the
mechanism: **add `.sr-touch-target` to the Filters button.** One
existing class, no new CSS, `min-height: 2.75rem` in the ≤640 tier only,
and `min-height` beats the rule's own `height: 36px` in the used-value
computation so the box grows instead of clipping. Recommended; safe to
defer without affecting anything else in this spec.

---

## Component Usage

- **Lucide** `MapPin` (new, centre-share FAB), `FlagTriangleRight`,
  `LocateFixed`, `Maximize2`, `Filter` — all already in the bundle.
- **`SharePopup`** — reused unchanged. Same component, same props, same
  coordinates, same `compact={false}`, same `offset={32}` the centre pin
  already passes. The FAB opens the *same* popup instance the pin opens;
  there is no second popup and no second copy UI.
- **`CenterPin`** — untouched. It keeps its own click handler, its own
  accessible name and its drag behaviour.
- **`SharePin`** — untouched except for the class list on its drop
  button.
- No new component, no new library, no new dependency.

---

## Design Tokens Applied

Every value below is an existing token in `frontend/src/globals.css`.
**No new token is introduced by this refinement.**

| Role | Token | Light | Dark |
|---|---|---|---|
| FAB surface | `--sr-surface` | `#FFFFFF` | `#18181B` |
| FAB hover surface | `--sr-surface-subtle` | `#F4F4F5` | `#27272A` |
| FAB glyph | `--sr-text` | `#0F1117` | `#F4F4F5` |
| FAB border | `--sr-border` | `#E4E4E7` | `#27272A` |
| Active fill (pressed / expanded) | `--sr-accent-bg` | `#E8F5EE` | `#052E16` |
| Active glyph | `--sr-accent` | `#277448` | `#34D399` |
| Active border | `--sr-accent-border-strong` | `rgba(39,116,72,0.7)` | `rgba(52,211,153,0.5)` |
| Disabled glyph | `--sr-text-disabled` | `#A1A1AA` | `#52525B` |
| Focus ring | `--sr-accent` via the global `:focus-visible` rule | 3px, offset 3px | same |
| Shadow | literal `0 4px 12px rgba(0,0,0,0.18)` | basemap-anchored, unchanged | same |

`--sr-text-disabled` is correct here and not a violation of the repo's
"disabled is for controls only" rule: this is a genuinely disabled
control, and the state's primary carrier is the dashed border, not the
colour.

---

## Interaction Notes

1. **Press the centre-share FAB, centre set, popup closed** — if the
   centre is outside the current bounds, arm `panTarget`; open
   `SharePopup` at the centre coordinate; set `aria-expanded="true"`;
   record the FAB as the opener.
2. **Press it again while open** — call `closeCenterShare`; focus
   returns to the FAB.
3. **Open from the pin, then press the FAB** — the FAB already reads
   `aria-expanded="true"` (both read the one `centerShareOpen` state),
   so pressing it closes, and focus returns to the FAB. This is
   deliberate and useful: the tint tells you the popup is open even when
   the pin is off-screen.
4. **Press with no centre set** — nothing happens. The control is
   `aria-disabled` and reachable; its name says what to do instead.
   It must not set a centre, because that would re-run the search.
5. **Close via the popup's own close control or Escape** — unchanged,
   one close path, focus returns to whichever control opened it.
6. **Switch view mode while the popup is open** — unchanged: the
   existing render-time adjustment closes it. The FAB simply unmounts on
   `sightings` and the share pin's button takes the slot.
7. **Hover** — `--sr-surface-subtle`, on every FAB, from the base class.
   Suppressed in the disabled state.
8. **Focus** — the global `button:focus-visible` ring (3px
   `--sr-accent`, 3px offset). Nothing per-control; the discs are round
   and the ring follows the border-radius.
9. **`sidebarOpen`** — the whole button group is gated as shipped; the
   wrapper and the message row stay mounted.

---

## Motion Spec

All of it is existing app motion. No new keyframes, no new library, no
per-component reduced-motion query (the global block at
`globals.css:2166` collapses every transition and animation to ~1ms, and
each end state here *is* the resting state, so nothing is lost).

| Element / interaction | Easing | Duration | Origin | Reduced motion | Implementation |
|---|---|---|---|---|---|
| FAB hover (background) | `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out) | 140ms | n/a | global block → ~1ms | CSS `transition` on `.sr-map-fab` |
| FAB active tint on/off (`aria-expanded`, `aria-pressed`) | same | 140ms | n/a | global block → ~1ms | same transition, `background`/`color`/`border-color` |
| Focus ring | none (instant) | 0 | n/a | unaffected | global `:focus-visible` |
| `SharePopup` entrance | unchanged from v0.5.80 | unchanged | anchored at the pin coordinate, so it already scales from the object it belongs to | global block | existing |
| Camera pan to an off-screen centre | maplibre `flyTo` default | 600ms | n/a | **not** collapsed by the CSS block | existing `panTarget` → `MapEffects` |
| `.sr-map-geo-error-msg` entrance | `cubic-bezier(0.16, 1, 0.3, 1)` | 190ms | translateY(-6px) | global block | existing `@keyframes sr-map-geo-in` |

Two notes the Engineer should not have to rediscover:

- The 600ms `flyTo` is over the doctrine's 300ms UI-motion ceiling on
  purpose: it is a **map camera** move (spatial navigation), not UI
  chrome, and it is the exact shipped behaviour of the locate button.
  Reuse `panTarget` rather than inventing a second pan duration, so
  there stays one answer to "how does this map travel".
- That the CSS reduced-motion block does not reach `flyTo` is
  pre-existing and shared with the locate button. Do not fix it here;
  it is a separate, whole-map question.
- The fullscreen button gains a transition it never had (it is in the
  base). This is a small, intended improvement, not a side effect.

---

## Content Notes

- Voice: the existing map-control voice. Short, mechanical, names the
  object. No exclamation, no encouragement, no filler.
- **No em dashes** in any new user-facing string, per the standing sweep.
  None of the proposed names contains one.
- "Center" stays the app's existing spelling in these strings
  (`Center the map on my location`, `Drop a pin at the map center`), so
  the new names read as part of the same row.
- **Three documents restate this behaviour and must be corrected in the
  same change**: `docs/HELP.md`, `README.md` and `website/index.html`.
  Any sentence saying the copy tool appears only on My Sightings, or
  describing the map corner as two buttons, is now false. Write the
  precise formulation once and propagate it verbatim.
- `ACCESSIBILITY.md` names the cluster's controls. If it enumerates
  them, it gains one; check the names it quotes against what the
  components actually emit rather than against this spec.
