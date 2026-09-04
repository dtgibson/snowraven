# Design Refinement — Nav Rework

Improve lane, Stage 2 design pass. Refines an existing surface: the app's main
navigation, and only the navigation. Extends `pipeline/design-system.md`; every
deviation is named in **Deviations logged** at the end.

## Visual Direction

Quiet utility, unchanged. The navigation stops being a band across the top of
the page and becomes a column beside it — the same eleven destinations, the same
restrained accent, the same hairline-and-surface depth model the app has used
for sixty-one versions. Nothing about the register changes; what changes is that
the nav now has room to be a list instead of a queue, and the app gets back the
vertical space the strip was spending on every tab.

Three densities, one design. The sidebar, the rail and the phone bar share one
row anatomy (icon, label, accent-tinted active fill, a leading accent bar), so
they read as the same component at three sizes rather than three components.

## Screens / Views

### Density 1 — Sidebar (wide windows: macOS, Windows, web, Pi, iPad landscape)

A `13.5rem` (216 px at 1x) column on the leading edge, `--sr-surface` with a 1 px
`--sr-border` right edge, full window height, its own vertical scroll.

Top to bottom:

1. **Brand block.** `RavenGlyph` at 22 px in `--sr-accent`, beside the wordmark
   `Snow` + accent `Raven` as the page's `<h1>` at `1.0625rem` / 700 / −0.4 px.
   Under it the shipped tagline, "Self-hosted birding tools and data explorer",
   at `0.6875rem` `--sr-text-muted`, wrapping to two lines.
   **This is the composition win:** the brand moves out of the page header and
   into the nav, so `<main>` starts at the top of the window. Measured against
   the shipped chrome that is roughly 150 px returned to every tab, on every
   wide window — the map gets a taller canvas, Statistics comes above the fold,
   the Breeding Codes matrix shows more rows.
2. **The destination list**, the user's saved visible order, flat, top to
   bottom. `role="tablist"` with `aria-orientation="vertical"`.
3. **One hairline**, then **Settings**.
4. **Empty space.** Deliberate. It is the reclaimed space, and the design
   system's feel is "no clutter"; nothing is invented to fill it.
5. **Collapse control**, pinned to the foot of the column.

**Row anatomy.** 34 px min-height, `7px 10px`, radius 8, 10 px gap, 15 px icon at
stroke 2.25, label at `0.84375rem` / 500. Idle `--sr-text-muted` on transparent;
hover `--sr-surface-subtle` + `--sr-text`; active `--sr-accent-bg` fill,
`--sr-accent` icon and label, weight 600, **plus a 3 px `--sr-accent` bar on the
leading edge** — the strip's 2 px bottom border, rotated. Three cues carry the
active state (fill, colour, weight) and one of them is a shape, because
`--sr-accent-bg` against `--sr-surface` is a deliberately quiet tint.

**Label fit is scale-invariant by construction.** The column is sized in `rem`
and the labels are sized in `rem`, so their ratio is fixed at every in-app text
scale and at every browser/OS default font size. Labels are `nowrap` with
ellipsis as a backstop only; the ellipsis is never expected to fire for any
member of `TAB_LABELS`.

### Density 2 — Icon rail (iPad portrait, small laptop windows, half-screen desktop windows, and any window where the Map Explorer's own sidebar leaves too little content)

A `3.75rem` (60 px) column, same surface and border, items centred.

- **Brand:** the glyph alone at 22 px. The wordmark stays in the DOM as
  `<h1 class="sr-only">SnowRaven</h1>` so the page never loses its `h1`.
- **Items:** 40×40 buttons, radius 8, 18 px icon at stroke 2, no label.
- **Active:** `--sr-accent-bg` filled square, `--sr-accent` icon, and the same
  3 px leading accent bar sitting just outside the button.
- **Hairline** above Settings, 28 px wide, centred.

**CORRECTED AT BUILD (QA attempt 1).** This section originally opened on a layer
that does not exist. It asserted that "every tab already draws the house page
header (20 px accent icon + `1.375rem`/700 name + one muted line)", and used that
as the load-bearing answer for *where you are* — the justification for an
icon-only rail being legible at all. **There is no such component.** Measured at
rail density, zero of the eleven destinations name themselves in a page heading
and five render no heading whatsoever. The claim reached `docs/HELP.md` and
`README.md` before it was caught, which is exactly the cost of a design premise
nobody grepped. Building eleven page headings to make it true would be scope
growth into every tab; the layer is struck instead, and the rail's identification
rests on the three layers below, all of which ship and all of which were verified
in Chromium and WebKit.

**Identifying a destination without its label — three layers, in order of how
often they actually do the work:**

1. **`aria-label` on every rail button**, always present, so VoiceOver and every
   screen reader get the full name at this density.
2. **Tooltip** on hover and on `:focus-visible`, 8–10 px to the trailing side of
   the rail, `--sr-surface` on `--sr-border` with `--sr-card-shadow`,
   `0.75rem`/600, `aria-hidden` (the `aria-label` is the accessible name, so the
   tooltip must not be announced twice). The keyboard half matters more here than
   it first appears: with the page-header layer gone, `:focus-visible` is the only
   thing that names a destination for a sighted keyboard user.
3. **Touch hold**: a `pointerdown` of `pointerType === "touch"` that lasts 350 ms
   without moving shows the same tooltip; `pointerup`, pointer-cancel, leave and
   Escape dismiss it. Nice-to-have, specified so it is not improvised.

**Where you are** is carried by the active treatment itself, which the rail keeps
in full: the `--sr-accent-bg` fill, the accent glyph, and the 3 px leading accent
bar sitting just outside the button. That is a property of the nav rather than of
the page beside it, which is what makes it true at this density.

**Stated limit, honestly:** a user who only ever runs iPad portrait meets the
icons cold. They are the same eleven glyphs the labelled densities use, and on
touch — where there is no hover and no focus ring — the first tap is genuinely
exploratory, with the active treatment confirming afterwards which one was
chosen. The touch hold above is what keeps that from being the only route. This
limit is REAL and is larger than the original text admitted, because the page
header it leaned on was never there.

### Density 3 — Phone bottom bar (iPhone, and any browser at or below 640 px)

The top strip is gone; the brand header stays at the top (compact on iOS, as it
already is). A five-cell grid pinned to the bottom of the shell:
`--sr-surface`, 1 px `--sr-border` top edge, `--sr-nav-bar-shadow` above it.

- **Four favourites** = the first four of the saved *visible* order. The
  existing reorder-and-hide setting already chooses them; nothing new is stored.
- **Fifth cell: More**, `lucide MoreHorizontal`.
- **Cell anatomy:** 52 px min-height (clears the ~44 px touch posture), 20 px
  icon inside a 40×26 pill that fills `--sr-accent-bg` when active, label under
  it at `0.625rem`/600, two lines maximum, `overflow-wrap: break-word`, never
  `nowrap`.
- **Active:** `--sr-accent` icon and label at weight 700 plus the tinted pill.
  When the active destination lives in the overflow, **the More cell carries the
  active treatment** so the bar is never showing nothing selected; its label
  stays "More".
- **iOS only:** `.sr-ios-app .sr-navbar { padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px)); }`
  Gated on the class, never a bare `env()` — iOS Safari reports a non-zero inset
  on the web build too, and the browser's own chrome already occupies it there.

**Labels appear only while they fit, decided by a container query, not by JS.**
The bar carries `container-type: inline-size`; five equal cells make 17 rem of
bar equal 3.4 rem of cell, which is where the longest unbreakable favourite word
("Statistics") stops fitting. `rem` inside a container query resolves against the
root font size, which `--sr-text-scale` multiplies, so the labels **drop out** at
large text scale instead of clipping. This is the sanctioned house pattern
(`.claude/rules/ui.md`, container-query-for-cell-legibility).

Measured in Chromium and WebKit at 1x, 150% and 200%, at 320 / 390 / 430 px:

| Width / scale | Labels | Bar height | Longest ink vs box |
|---|---|---|---|
| 320 / 1x | on | 57–68 px | Statistics 48 / 48 — no overflow |
| 320 / 200% | off | 53 px | — |
| 390 / 1x | on | 57–68 px | Species Detail 72 / 72 — no overflow |
| 390 / 150% | off | 53 px | — |
| 430 / 1x | on | 57 px | no overflow |
| 430 / 150% | on | 79.5 px | no overflow |

**The bar-height figures above were INCOMPLETE, not wrong (QA attempt 1).** They
were read as a 57–68 px range, which is the height where the labels are on at 1x.
The bar is text, so a configuration with the labels still on at a raised text
scale is taller than any of them: 430 px at 150 % measures **79.5 px**. Nothing
depends on the range being small — the height is published as `--sr-navbar-h`
from a live measurement precisely so no constant has to be right — but a quoted
range that stops at the widths someone happened to sample is the shape that later
gets treated as a bound.

Re-measure before shipping: this is a layout claim, and jsdom cannot see it.

### The More sheet

A bottom sheet, not the shared `ModalDialog` (that shell is centred and is for
confirmations; this is a navigation surface that must read as rising from the
bar it was opened from). It borrows every behaviour the shell already proves:

- `--sr-scrim` backdrop over the whole shell; panel `--sr-surface`, radius
  `16px 16px 0 0`, 1 px `--sr-border` top, `--sr-card-shadow`,
  `max-height: min(70dvh, 460px)` with internal scroll.
- A 36×4 `--sr-border-medium` grab handle (decorative, `aria-hidden`), then an
  `<h2>` "More".
- Rows are the **sidebar row at phone scale**: 44 px min-height, `0.9375rem`,
  same icon, same active treatment. The same single hairline above Settings.
- `role="dialog" aria-modal="true" aria-label="More destinations"`. Focus trap
  that re-queries its focusables on every Tab (the `HelpDocs` / `ModalDialog`
  pattern). Escape, the backdrop and choosing a destination all close through
  one path; focus returns to the More button.

## The thresholds

Derived from measured available width, in the same spirit as today's collapse —
never a device check.

```
available = the app shell's own width (ResizeObserver on the shell, never on the nav)
reserve   = --sr-nav-reserve, published in px by a tab that holds its own in-flow
            sidebar (Map Explorer: clamp(240px, 28vw, 300px)); 0 for every other tab
navW      = 13.5rem, resolved live from the root font size so it tracks text scale
FLOOR     = 640  (the app's own phone boundary)

density =
  phone    when the (max-width: 640px) media query matches   [useIsPhone, unchanged]
  sidebar  when available − navW − reserve ≥ FLOOR  and not manually collapsed
  rail     otherwise
```

**Why the floor is 640 and not a number of taste:** the sidebar may never squeeze
the content column into the tier below it. That makes the threshold an
expression of a rule the app already holds, rather than a new constant.

Worked, at 1x:

| Window | reserve | content left | density |
|---|---|---|---|
| 1512 (MacBook 14") | 0 | 1296 | sidebar |
| 1512, Map Explorer | 300 | 996 | sidebar |
| 1024 (small laptop window) | 0 | 808 | sidebar |
| 1024, Map Explorer | 287 | 521 | **rail** |
| 834 (iPad portrait) | 0 | 618 | **rail** |
| 720 (half-screen on a 1440 display) | 0 | 504 | **rail** |
| ≤ 640 | — | — | **phone bar** |

Note the Map Explorer case is resolved by the arithmetic, not by a rule that says
"the map always gets the rail": a 2560 px monitor keeps its sidebar with the map
sidebar open, and a 1024 px window does not. That is a deliberate sharpening of
the change brief's wording, flagged below.

**Feedback-free.** `available` is the shell's width, which does not change when
the nav changes density. `navW` is computed from the live root font size, not
from a hidden probe — which also retires the off-screen measurement node in
today's `TabNav`, the one that leaked page horizontal scroll on phones in
v0.5.37 and is a standing hazard.

**Hysteresis.** Collapse to the rail at `< FLOOR`; restore the sidebar only at
`≥ FLOOR + 48`. A bare equality flips on every pixel of a window drag, and a
density change is a visible layout change.

## The collapse control

**Kept, session-only, and it narrows only.**

- It appears **only when the derived density is sidebar**. In a
  derived rail there is no room, so there is no control and no state to explain.
- Pressing it steps the sidebar down to the rail; pressing again restores it.
  It can never force a sidebar the measurement says will not fit, so the derived
  density is a ceiling and the toggle is one manual step below it. **The toggle
  and the derivation cannot contradict each other.**
- **Session-only, not persisted.** A persisted density can be restored into a
  window where it is wrong, and the user then has to find a control to undo a
  state they do not remember setting. The tab-layout document is about *which*
  destinations and *in what order*; a density is a different kind of fact.
  Nothing new is stored, and the existing document, key, shape, seam and
  normalizer are untouched — exactly as the brief asks.
- Shape: a row at the foot of the column, `margin-top: auto`, 16 px
  `PanelLeftClose` / `PanelLeftOpen`, label "Collapse" at sidebar density,
  icon-only in the rail. `aria-expanded`, and `aria-label` "Collapse
  navigation" / "Expand navigation". Never carries an active state — it is a
  control, not a twelfth destination, which is also why pinning *it* to the
  bottom is right where pinning Settings would have been wrong.

## Grouping — the judgment call, answered

**Visual grouping does not earn its place, and one structural separator does.**

The user reorders freely, so any named group ("Explore", "Analyse") becomes
false the first time they move a tab into it — a label the app cannot keep
honest. Rule-based grouping without labels is the same problem with the
explanation removed.

The one line that is always true sits **above Settings**: Settings is appended
after the saved order and is never part of it, so its position is structural
rather than chosen. The shipped dropdown already draws exactly that hairline;
the sidebar, the rail and the More sheet all inherit it. Every other destination
is peer to every other, which is precisely what the saved order asserts.

## Component Usage

| Piece | Component |
|---|---|
| Brand mark | shared `RavenGlyph` (never a lucide bird, never a re-inlined path) |
| Icons | lucide, existing `TAB_ICONS` glyphs, at three nav-scale sizes |
| Rail tooltip | new, styled from `--sr-surface` / `--sr-border` / `--sr-card-shadow`; entrance idiom lifted verbatim from `SpeciesCombobox`'s listbox |
| More sheet | new; scrim, focus-trap, Escape and focus-return behaviours taken from `ModalDialog` / `HelpDocs` |
| Separators | `--sr-border` hairline, the shipped dropdown's own device |
| Layout | classes in `globals.css` only — no inline layout styles anywhere in the nav |

Recommended file shape (Engineer's call, but it has a cost attached): keep
`TabNav.tsx` as the single entry with `NavSidebar` / `NavRail` / `NavBottomBar` /
`NavMoreSheet` beside it. `tabOrderCoverage.test.ts` binds its exception rows to
an exact **file**, attribute text and count, so every extra file is another row
to keep in sync.

## Design Tokens Applied

Every colour is an existing `--sr-*` token.

| Use | Token |
|---|---|
| Nav column / bar / sheet surface | `--sr-surface` |
| Edges (right border, bar top, hairlines) | `--sr-border` |
| Idle label and icon | `--sr-text-muted` |
| Hover fill / hover label | `--sr-surface-subtle` / `--sr-text` |
| Active fill | `--sr-accent-bg` |
| Active label, icon, leading bar | `--sr-accent` |
| Brand glyph and wordmark accent | `--sr-accent` |
| Sheet backdrop | `--sr-scrim` |
| Sheet elevation | `--sr-card-shadow` |
| Sheet grab handle | `--sr-border-medium` |
| Focus ring | the global `outline: 3px solid var(--sr-accent)` — untouched |

**One new token, defined in BOTH themes before use:**

```css
:root                { --sr-nav-bar-shadow: 0 -3px 6px -2px rgba(15,17,23,0.12); }
[data-theme="dark"]  { --sr-nav-bar-shadow: 0 -3px 8px -2px rgba(2,2,4,0.60); }
```

The upward twin of `--sr-sticky-shadow`, for the phone bottom bar sitting over
scrolling content. Same convention: a full-value shadow token, tinted with the
app's own ink, never pure black, and dark gets its own deeper value because a
light 12% haze is invisible against `--sr-bg` `#09090B`.

**Contrast, against the documented values in `globals.css`:**

- `--sr-accent` on `--sr-accent-bg`: 5.09:1 light; the audited pair in dark. AA.
- `--sr-text-muted` on `--sr-bg` / `--sr-surface`: ≥4.5:1 in both themes. AA.
- The 3 px accent bar is a non-text graphic: `--sr-accent` vs `--sr-bg` is
  5.46:1 light, well past 3:1.
- Hover fill is decorative only — it never carries state that colour alone must
  convey, so it is not held to 3:1.

## Interaction Notes

**Keyboard and tab order — this is the part that must not be got wrong.**

- **Sidebar and rail** are today's tablist, rotated: `role="tablist"` with
  `aria-orientation="vertical"`, `role="tab"` children keeping their
  `id="tab-{id}"` and `aria-controls="panel-{id}"`, roving tabindex (active `0`,
  rest `-1`). Arrow keys become **Up/Down**; Home/End unchanged. This stays the
  single declared roving group and its `tabOrderCoverage.test.ts` exception row
  survives — with a new `why` string naming the vertical orientation, and the
  file/attribute/count updated to the new markup.
- **The phone bar is NOT a roving group.** Four plain `<button>`s each carrying a
  literal `tabIndex={0}`, `aria-current="true"` on the active one, plus the More
  button (`tabIndex={0}`, `aria-haspopup="dialog"`, `aria-expanded`). Roving buys
  nothing across four items, plain stops are the app's default posture, and a
  tablist cannot legally contain a non-tab button.
- **The More sheet rows are NOT a roving group either** — plain buttons at
  `tabIndex={0}` inside the focus trap. **This retires today's second exception
  row** (the collapsed dropdown's `role="option"` listbox): the roster goes from
  five entries to four, which is a checkable outcome, not a hope.
- At phone density no control carries a `tab-{id}` id, so the panels'
  `aria-labelledby` falls back to their own `aria-label` — exactly what the
  shipped dropdown already does, and the reason it uses `tabopt-` ids (F062).
- Every `<button>` and `<a href>` the nav draws carries a **literal
  `tabIndex={0}`** apart from the declared roving group. WebKit — the shipped
  Mac, iPhone and iPad apps — gives plain buttons no place in the tab order
  without it.
- The skip link stays first in the DOM, before the nav. The `inert` wrapper for
  the fullscreen map still wraps the nav; it can now be a real box rather than
  `display: contents`, which is a bonus for `chromeBoxes` (see below).

**Two standing checks, both directly on this path:**

- The off-screen measurement probe is **gone** (the threshold reads the root
  font size instead), so the v0.5.37 page-horizontal-scroll hazard cannot recur.
  If any probe is reintroduced, it must sit under a clipped ancestor.
- `App` wraps the nav in a `display: contents` element today, which has no box
  and so can never be observed by a `ResizeObserver` — `chromeBoxes` in
  `mapPanelChrome.ts` descends one level for exactly that reason. Keep that
  descent working whatever the new wrapper is.

**Three things the Engineer must not get wrong:**

1. **`mapPanelChrome.ts` still measures the right thing, but its inputs move.**
   At sidebar/rail density the shell becomes a row: `main.parentElement` is the
   content column, and the brand header has moved into the nav column, so
   `above` collapses to ~0 and `below` is the footer alone. The arithmetic is
   unchanged and correct; the module's prose, which names "a tab strip above the
   map", is not. **At phone density the fixed bottom bar is not in `<main>`'s
   sibling flow at all** — its measured height must be added to the chrome, or
   the map panel and the footer will sit under it.
2. **The footer stays in the content column**, below `<main>`. Moving it into the
   nav would break `mapPanelChrome`'s `below` term.
3. **The width transition runs on the manual toggle only.** A derived density
   change during a window drag is already continuous and must be instant —
   animating it would reflow the content column every frame, which on the Map
   Explorer tab is a MapLibre resize storm.

**States.** No new loading, empty or error state exists: the nav is always
populated. The one degenerate case is a user who hides every configurable tab —
the list is then Settings alone above its hairline, which is correct and needs
no special copy.

## Motion Spec

Every entrance is ease-out, every duration is under 300 ms, and every one has a
`prefers-reduced-motion: reduce` fallback that removes it entirely.

| Interaction | Easing | Duration | Origin | Reduced motion | Implemented with |
|---|---|---|---|---|---|
| Row hover (fill + label colour) | ease-out | 120 ms | n/a | none | CSS transition |
| Active-state fill and colour change | ease-out | 120 ms | n/a | none | CSS transition |
| Active leading accent bar appearing | `cubic-bezier(0.2, 0, 0, 1)` | 140 ms | `transform-origin: center`, `scaleY(0.35) → 1` | none | CSS keyframe |
| Sidebar ↔ rail width, **manual toggle only** | `cubic-bezier(0.2, 0, 0, 1)` | 200 ms | n/a | instant | CSS transition on `width` |
| Sidebar labels appearing after the widen | ease-out | 160 ms, 40 ms delay | `translateX(-4px) → 0` | instant | CSS transition |
| Sidebar ↔ rail, **derived** (window drag) | — | 0 | — | 0 | no transition, by design |
| Rail tooltip in | `cubic-bezier(0.2, 0, 0, 1)` | 140 ms | `transform-origin: left center`, `scale(0.96) → 1` | instant | CSS transition |
| Rail tooltip out | — | instant | — | instant | class removal |
| More sheet backdrop | ease-out | 160 ms | opacity only | instant | CSS transition |
| More sheet panel in | `cubic-bezier(0.2, 0, 0, 1)` | 220 ms | `translateY(100%) → 0` — its origin *is* the bar it rises from | instant | CSS transition |
| More sheet close (both) | ease-out | 140 ms | as above | instant | CSS transition |
| Bottom-bar cell press | ease-out | 120 ms | n/a | none | CSS transition |

Web/desktop uses CSS transitions throughout; nothing here needs a motion
library, and none is added. No hover-scale, no bounce, no springs on utility
controls, no staggered fades, no motion on mount for static content.

## Content Notes

- **No destination is added, removed, renamed or hidden.** `TAB_LABELS` stays
  authoritative and `life-list` remains **Multimedia**.
- **The tagline survives** — it moves from under the page wordmark to under the
  sidebar wordmark, unedited, and is dropped in the rail (no room) and left at
  the top of the phone header as it is today.
- **The collapse control's copy** is "Collapse" visible, with the accessible
  names "Collapse navigation" / "Expand navigation".
- **The More sheet is titled "More"**, matching its cell, with
  `aria-label="More destinations"` on the dialog.
- **Settings reorder UI gains one sentence** explaining the phone favourites,
  which the brief allows: *"On phones the first four shown here become the
  bottom bar; the rest live under More."* No em dashes; no other copy changes.
- Published surfaces that describe today's behaviour and must be rewritten in
  the same run: `docs/HELP.md` (the strip-collapsing-into-a-dropdown passage),
  `ACCESSIBILITY.md` (the keyboard paragraph naming the tab bar and its
  collapsed dropdown as the two roving-focus exceptions — there is now **one**
  roving group, not two), `README.md`, `website/` and its 1,600 px capture
  justification.

## Deviations logged

1. **Type face.** The design doctrine says never default to Inter for the
   display face. `pipeline/design-system.md` pins Inter / system-ui, and the
   doctrine defers to `design-system.md` on specifics. Changing the app's type
   family inside a nav rework would be exactly the silent drift the pass is
   meant to avoid. **Inter stays.** (The mockup's own annotation layer uses a
   serif display face, so the presentation is never confused with the app.)
2. **Depth.** The doctrine asks for atmosphere over flat slabs. This app's depth
   model is surface-over-background plus hairlines plus `--sr-card-shadow`, and
   it is sixty-one versions old. The nav uses that model — column surface above
   page background, an upward shadow under the bottom bar, `--sr-card-shadow`
   under the sheet — and adds no gradients or texture.
3. **Icon scale.** `design-system.md` records lucide icons at 11–15 px. The rail
   uses 18 px and the phone bar 20 px, because at those densities the icon is
   doing identification work rather than decorating a label. Recorded as a
   nav-scale extension of the range, not a change to in-content icons.
4. **One icon change — APPROVED by the user at the design gate.** Multimedia
   currently uses lucide `List`, which at 18 px is indistinguishable from
   Checklists' `ClipboardList` — the rail cannot work with two identical glyphs.
   **Multimedia's icon becomes lucide `Images`.** The Engineer ships it: update
   the `TAB_ICONS` entry for `life-list` in `frontend/src/lib/tabLayout.ts`, so
   the change reaches every density and the Settings reorder list from the one
   authoritative table. `TAB_LABELS` is untouched — the destination is still
   named **Multimedia**; only its glyph changes.
5. **A sharpening of the change brief.** The brief says the global nav drops to
   the rail "where the global sidebar and the Map Explorer's own 240–300 px
   sidebar would both be expanded". The design makes that a consequence of the
   arithmetic rather than a rule: a very wide window keeps both. Same intent,
   fewer surprises.

## Design-system updates to write on approval

Add to `pipeline/design-system.md` → Patterns:

> **Main navigation** — one responsive nav over the eleven destinations at three
> densities (sidebar `13.5rem`, icon rail `3.75rem`, phone bottom bar of four
> favourites + a More sheet), chosen from measured available width against a
> 640 px content floor, never a device check. The saved order is flat and
> authoritative; the only separator is the structural hairline above Settings.
> Active state is `--sr-accent-bg` + `--sr-accent` + weight + a 3 px leading
> accent bar. Nav-scale lucide icons run 15–20 px. `--sr-nav-bar-shadow` is the
> upward twin of `--sr-sticky-shadow`.
