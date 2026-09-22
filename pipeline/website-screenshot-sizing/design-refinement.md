# Design Refinement: website-screenshot-sizing (features section figures)

Improve-lane design pass, Stage 2. The surface is the features section of
`website/index.html` and its rules in `website/styles.css`, plus the Statistics phone
figure in the Platforms section. **Not one word of the copy changes**, on the website or
the README. What changes is how big each figure is, which column it lands in, and the
shape of one asset.

Companion mockup: `pipeline/website-screenshot-sizing/design.html`. It links the shipped
stylesheet, so its *Before* view is the live page; its *After* view is the delta below,
scoped under `body[data-view="after"]`. It measures itself live and prints a table, which
is where every number in this document came from (Chromium via
`website/tools/node_modules/playwright`, `loading` forced to `eager`,
`getBoundingClientRect()`, at 1440 / 1280 / 1024 / 921 / 920 / 768 / 640 / 440 / 375 /
320px). The Before numbers match the Evaluator's Stage 1 table to the pixel.

---

## Visual Direction

Unchanged. Same tokens, same type, same card shadow and hairlines, same alternation
(odd rows media right, even rows `reverse`), same dividers. The refinement is entirely
about size and placement: **every figure in the section shares one height at any given
width**, the two grid columns are equal so the alternation cannot change a figure's
size, the Weather asset is reframed to the shape the other screenshots already have, and
below 920px the row becomes the same centred 640px column the section head already uses.
No new colour, no new token, no new class, no new dependency, no new motion.

---

## The rule: media to copy, stated so it can be measured

**Two-column tier (921px and up).** Every `.feature-media` is a 16:9 box of its grid
track, and the two tracks are equal: `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)`,
`aspect-ratio: 16 / 9`. So the media height is one number for the whole section at any
width, set by the track, never by the asset:

| Viewport | Content width | Gap | Track | Media box (w x h) |
|---|---|---|---|---|
| 1440 | 1068 (container capped at 1140) | 64 | 502 | **502 x 282** |
| 1280 | 1068 | 64 | 502 | **502 x 282** |
| 1024 | 952 | 51 | 450 | **450 x 253** |
| 921 | 847 | 46 | 401 | **401 x 226** |

The locked copy gives text columns from 150px (Checklists, List Comparer) to 269px
(Statistics) at the 460px measure, so at 1280 the media/text ratio runs **1.05 to 1.88**
across all ten rows, against 0.94 to 2.99 today. The measurable rule is: **at 1280px every
row's figure is exactly 282px tall, and no row's media/text ratio is below 1.0 or above
1.9.** Row 1 goes from 887px tall (2.1x the next tallest) to 385px, the same as every other
row (386px).

**Single-column tier (920px and under).** Nothing sits beside anything, so a ratio is not
the measure. The row becomes a centred 640px column (`.feature-row { max-width: 640px;
margin-inline: auto; }`, the width `.section-head` already uses), the figure is 16:9 of
that column, and the paragraph's measure is at most 640px instead of 848px:

| Viewport | Column | Screenshot box (w x h) |
|---|---|---|
| 920 | 640 | **640 x 360** |
| 768 | 640 | **640 x 360** |
| 640 | 589 | 589 x 331 |
| 440 | 404 | 404 x 227 |
| 375 | 339 | **339 x 191** |
| 320 | 284 | **284 x 160** |

The two mocks drop the aspect box in this tier (`aspect-ratio: auto`) and take their
content height, so there is no half-empty frame around a 204px mock at 920.

**Weather loses its special rules** at both tiers: the 420px cap and its 360px counterpart
under 920 are deleted. The figure is an ordinary 16:9 screenshot now.

---

## Screens / Views, per surface

Ten rows, `TAB_LABELS` names, `DEFAULT_TAB_ORDER`, parity unchanged. "Before" and "After"
are rendered figure sizes at 1280px; ratio is media height over text-column height.

| # | Surface | Asset before → after | Before (1280) | After (1280) | Ratio before → after |
|---|---|---|---|---|---|
| 1 | Weather | `weather.webp` 1080x2021 → **1080x608**, recaptured and reframed | 420 x 784 | 502 x 282 | 2.99 → 1.08 |
| 2 | Statistics (reverse) | `statistics-dark.webp` 1600x900, unchanged | 446 x 252 | 502 x 282 | 0.94 → 1.05 |
| 3 | Map Explorer | `map.webp` 1600x860 → **1600x900**; `map-dark.webp` 1500x806 → **1500x844** | 558 x 301 | 502 x 282 | 1.28 → 1.21 |
| 4 | Species Detail (reverse) | `species.webp` 1600x900, unchanged | 446 x 252 | 502 x 282 | 1.08 → 1.21 |
| 5 | Calendar | `calendar.webp` 1600x900, unchanged | 558 x 315 | 502 x 282 | 1.77 → 1.59 |
| 6 | Multimedia (reverse) | `multimedia.webp` 1600x900, unchanged | 446 x 252 | 502 x 282 | 1.42 → 1.59 |
| 7 | Breeding Codes | `breeding.webp` 1600x900, unchanged | 558 x 315 | 502 x 282 | 1.77 → 1.59 |
| 8 | Checklists (reverse) | `.ck` mock, content unchanged | 446 x 242 | 502 x 282 (content 204, centred) | 1.61 → 1.88 |
| 9 | List Comparer | `.cmp` mock, content unchanged, rows tightened | 558 x 309 | 502 x 282 (content 243, centred) | 2.06 → 1.88 |
| 10 | Named Birds (reverse) | `named-birds.webp` 1600x800 → **1600x900**, recaptured | 446 x 224 | 502 x 282 | 1.09 → 1.37 |

**Platforms, Statistics phone figure.** `statistics-mobile.webp` is 560x1226 and the
markup declares `height="1198"`. The declaration becomes **`width="560" height="1226"`**.
No CSS change: `.phone-frame` stays 260px wide (230px at and under 920), rendering 260 x 550
at 1280 and 230 x 485 at 375, exactly as today once the reservation stops being 12px short.

### The reverse-row inversion, and why the fix is equal tracks

Today's `1fr 1.25fr` is swapped by `order`, not by track size, so a reverse row's figure
lands in the narrow 446px track and its text in the wide one. The brief allows swapping
the track sizes on reverse rows; this design goes one step simpler: **make the tracks
equal, so there is nothing to invert.** A swap is a second rule that must stay in sync with
the first; equal tracks remove the asymmetry that the inversion was made of. Parity is
untouched: odd rows still carry no `reverse`, even rows still do, and `order` still does
the swap.

One line completes it. `.feature-text` keeps its 460px measure, so in a 502px track it
leaves 42px unused; **`justify-self: end` on the reverse row's text** puts that slack
beside the media on both parities. Measured at 1280: an odd row's text starts at the
container's left edge and an even row's text ends at the container's right edge, with a
106px gutter (64 gap + 42 slack) between text and figure either way. Today's even rows
leave a 98px hole at the container's right edge that odd rows do not, which is a fourth
asymmetry the measurement turned up and this closes.

### The Weather asset

**Decision: recapture from the built 1.0.32 app and frame it 16:9 around the weather
output.** Not a re-crop of the committed file: that is a 1.0.30 capture, two releases
stale, and "never ship stale screenshots" applies. The stand-in in the mockup is cut from
the stale file only to show the framing.

Why not keep it portrait and bound its height: at the section's 282px height a 0.534
aspect image is 150px wide, a postage stamp of the one screenshot whose whole point is
text. Why the frame is the output rather than the whole panel: the tab is a 476px-wide
card, so any full-panel frame is portrait; the identity line plus the weather block is the
tab's payload, is what `54f5a57` (v1.0.27) existed to restore, and happens to fit 16:9 of
the panel width with 13 CSS px to spare.

The frame, for `website/tools/capture.mjs` (the website script; `capture-appstore.mjs` is
untouched):

- **Horizontal:** the `#panel-weather` bounding box, exactly as today. The card's own
  gutters are load-bearing: the content span is 291 CSS px, 16:9 of the 540px panel is
  304px and fits, 16:9 of the 421px card is 237px and does not. Do not clip to the card.
- **Vertical:** bottom edge = the bottom of the Weather Output block's outer border
  + 6 CSS px; top edge = bottom − (panel width x 9/16). Located by DOM (the block that
  follows the "Weather output" heading, and the monospace identity line carrying the
  checklist id), never by pixel offsets.
- **Assertions, each of which fails the capture rather than publishing:** the identity
  line's box is fully inside the frame with at least 2px above it; the "Edit checklist
  comment on eBird" link is fully above the frame; the block's bottom border is inside;
  `requireWeatherCaptureReady` still passes on the final frame (both outputs present, no
  error state). On the 1.0.30 asset this frame clears the identity line by 7px and the
  link by 11px, so 1.0.32 has about 5px of growth headroom; if the assertion fails, stop
  and bring the frame back to design rather than loosening it.
- **Output:** 1080 x 608 at the script's 2x scale; `process-img.mjs` keeps `width: 1080`
  and does not enlarge, so the file is 1080x608. The markup declares **the produced
  file's dimensions**, read from the file, expected `width="1080" height="608"`; the
  asset and its declaration land in one commit (v1.0.27's rule).
- **Data:** the synthetic demo dataset via `SR_DATA_DIR` (v1.0.4), the public coastal
  checklist `S354229002` as today, the built 1.0.32 frontend. A **live** OpenWeather key
  is the intended route (the README: the committed weather shot was captured live). A
  `WEATHER_REPLAY=1` capture is acceptable only if the "Offline: showing the last loaded
  result" cue renders outside this frame, checked by eye on the produced image.
- **Alt text must change**, because the frame changes (the brief: alt stays where the frame
  does not). The tide block is no longer in the picture. Proposed, for the user's approval
  at the gate under the website copy rule, since it is the only text this pass touches:
  *"The Weather tab's output for a checklist at Jamaica Bay: sky, temperature, wind, cloud
  cover, humidity, dew point, sunrise and sunset, ready to paste into the checklist
  comment."* No em dash.

What the reader gains: at 1280 the frame renders at 502px for a 540px-wide panel, 0.93x
of its 1x size, so the monospace output is about 12px on screen. It is the one screenshot
in the section a reader can actually read, which is right for the tab whose product is
text.

### Two more assets are reshaped to 16:9, so the box never crops

With a 16:9 box and `object-fit: cover`, an asset that is not 16:9 gets cropped. Two are
not: `named-birds.webp` is 2:1 (11% of its width would go, and the right edge is where the
"5 sightings" counts and the strip's end label sit) and the two map shots are 1.86:1 (4%,
the layer switcher). **Rule: an asset whose aspect differs from 16:9 by more than 1% is
reshaped at capture, never cropped by CSS.** `cover` + `object-position: left top` exists
only to absorb sub-1% rounding.

- **Named Birds:** `clipH: 800` becomes `900` in `capture.mjs`; the comment that says the
  list is short and to clip close is updated to say the box is 16:9 and the empty page
  below the strip card is deliberate. Asset 1600x900, declaration `height="900"`. The frame
  gains 100px of empty app page (measured tone rgb 249, 251, 252) under the card; nothing
  in it changes, so the alt is untouched.
- **Map Explorer:** `clipH: 860` becomes `900` for both map shots. The frame gains 40px
  of map at the bottom and loses nothing. `map.webp` 1600x900; `map-dark.webp` is resized
  to 1500 wide by `process-img.mjs`, expected 1500x844 (900 x 1500 / 1600 = 843.75), and
  as with Weather the declaration is read from the produced file. Alt untouched.
- **The other seven** (`statistics`, `statistics-dark`, `species`, `calendar`,
  `multimedia`, `breeding`, `statistics-mobile`) keep their committed files. The capture
  run regenerates all of them; whether to also commit those refreshed 1.0.32 captures is a
  separate decision for the user at the gate, because each is a visible change to review.
  This design needs only the four reshaped files.

### The phone tier

At 375 and 320 the shipped page inverts: screenshots shrink to 192 and 161px while the two
hand-built mocks stay at 242 and 309px (333 at 320). **Decision: the screenshots stay whole
and the mocks come down toward them.**

- **Screenshots are not cropped and not hidden.** A crop would show a fragment of an app
  the reader has never seen and would put the alt text out of step with the picture; hiding
  would leave two rows with a figure and eight without. A 16:9 desktop capture at column
  width is the standard phone treatment and is what every other tier already does. At 375
  every screenshot is **339 x 191**; at 320, **284 x 160**.
- **Mocks tighten at the existing 440px breakpoint**, type and padding only, content
  untouched (v1.0.20): figure padding 18 to 14px, `.cmp` and `.ck` type .9rem to .8rem,
  row padding 6px 8px, `.ck-search` 6px 9px at .78rem. Measured: Checklists **210px**
  (from 242), List Comparer **248px** (from 309; 333 at 320). Mock over screenshot goes from
  1.26 / 1.61 to 1.10 / 1.30 at 375 and from 1.50 / 2.07 to 1.31 / 1.55 at 320. List
  Comparer stays the tallest figure on a phone, by 57px at 375, because it is five rows of
  content and that content is the claim; it is no longer 1.9x its own paragraph.
- **No horizontal overflow** at 440, 375 or 320 (`scrollWidth` equals the viewport at each,
  both views). Nothing in the delta sets a positive `min-width`.

---

## Component Usage

No component library; hand-authored HTML and CSS, as shipped. **No class is added and
none is removed.** Every change is a declaration on an existing selector:

- `.feature-row`: equal tracks; `max-width` + `margin-inline` at the single-column tier
- `.feature-row.reverse .feature-text`: `justify-self: end`, reset at the single-column tier
- `.feature-media`: `aspect-ratio: 16 / 9`
- `.feature-media img`: `height: 100%; object-fit: cover; object-position: left top`
- `.feature-media[data-shot="weather"]`: both rules deleted
- `.feature-mock`: `overflow: visible`; `aspect-ratio: auto` and tighter padding at the narrow tiers
- `.cmp-row`, `.cmp-row + .cmp-row`, `.cmp-head`, `.cmp`, `.ck`, `.ck-row`, `.ck-search`: spacing and type only
- `.phone-frame`: untouched; only its `<img>` `height` attribute changes

Mock internals (`.ck-*`, `.cmp-*`, `.win`, `.only`), the icons, `.feature-tag`,
`.shot-swap`, `.section-head` and `app.js` are untouched.

**Markup constraints the guards depend on, unchanged from the copy pass:** every body
`<p>` in a feature row stays a bare `<p>`; `<h3>Named Birds</h3>` stays byte-exact;
`Weather/tide Planner` occurs exactly once; no article is deleted, added or reordered;
the version pill and footer version stay `v1.0.32` and `SnowRaven v1.0.32`. Attribute
changes on four `<img>` elements and the stylesheet edits are the whole HTML/CSS delta.

---

## Design Tokens Applied

Nothing new. The section reads the same tokens it does today: `--border` (hairlines,
figure edges), `--surface` (figure ground, which now also backs the mocks' slack inside
the 16:9 box), `--surface-subtle` (mock zebra rows), `--text` / `--text-muted`,
`--accent-bg` / `--accent-strong` / `rgba(var(--accent-rgb), .2)` (icon tile, tag, mock
accents), `--card-shadow`, `--radius` / `--radius-sm`. No hex, `rgb()` or colour literal
is introduced.

---

## Interaction Notes

The section has no interactive controls, before or after. Preserved:

- **Theme swap** on row 3 (`.shot-swap`); row 2 keeps `.feature-tag`.
- **Scroll reveal**: every `<article>` keeps `feature-row`; `app.js` is untouched.
- **Accessibility tree**: mocks keep `aria-hidden="true"`; screenshots keep their alt
  (Weather's changes with its frame, above); one `<h2>`, ten `<h3>`.
- **Loading**: `loading="lazy"` stays on every shot. The figure's `aspect-ratio` now
  reserves the box before the image arrives, so layout does not shift on load; the
  `width` / `height` attributes stay as the intrinsic-size declaration and are updated
  for the four reshaped assets.
- **Browsers without `aspect-ratio`** (Safari 14 and older) fall back to today's
  behaviour, an image-sized figure. Accepted; nothing breaks, the box is just not shared.
- The mockup's Before / After control and its measurement table are review chrome and are
  not shipped.

---

## Motion Spec

**No new motion.** The page's motion is CSS-only and stays CSS-only; this refinement adds
no transition, animation or scroll effect. A change of image size on load is not an
entrance and does not animate.

| Element / interaction | Easing | Duration | Origin | Reduced motion | Implemented by |
|---|---|---|---|---|---|
| Feature row entrance (`.reveal` to `.reveal.in`) | `ease` | 600ms | rises from `translateY(16px)` | `app.js` never adds `.reveal`; CSS forces `opacity: 1; transform: none` | existing CSS + existing `app.js`, untouched |
| Theme swap on row 3's figure | none (instant) | 0 | n/a | unaffected | existing `display` swap |
| Figure box reservation (`aspect-ratio`) | none | 0 | n/a | n/a | new CSS, no motion |
| Mockup Before / After control (review chrome only) | `ease-out` | 120ms colour/background | n/a | `transition: none` | mockup only, not shipped |

---

## Content Notes

The copy is locked and is not the deliverable. Every paragraph, heading, tag and section
head is the shipped file verbatim; the mockup renders the real words so the row heights
are true. The single text change is the Weather alt, proposed above and approved at the
gate. No em dashes anywhere in the delta. Surfaces are named from `TAB_LABELS`.

---

## Before vs after, for The Tester

Rendered `.feature-media` height and media/text ratio. Before is the shipped page; After
is the mockup's After view with the stand-in Weather and Named Birds frames, which have the
exact dimensions the recaptured assets will have.

**At 1280px** (two columns, tracks 502px):

| Row | Text h | Before media h | Before ratio | After media h | After ratio | Row h before → after |
|---|---|---|---|---|---|---|
| Weather | 262 | 784 | 2.99 | **282** | 1.08 | 887 → 385 |
| Statistics | 269 | 252 | 0.94 | **282** | 1.05 | 372 → 386 |
| Map Explorer | 234 | 301 | 1.28 | **282** | 1.21 | 404 → 386 |
| Species Detail | 234 | 252 | 1.08 | **282** | 1.21 | 355 → 386 |
| Calendar | 178 | 315 | 1.77 | **282** | 1.59 | 418 → 386 |
| Multimedia | 178 | 252 | 1.42 | **282** | 1.59 | 355 → 386 |
| Breeding Codes | 178 | 315 | 1.77 | **282** | 1.59 | 418 → 386 |
| Checklists | 150 | 242 | 1.61 | **282** | 1.88 | 345 → 386 |
| List Comparer | 150 | 309 | 2.06 | **282** | 1.88 | 412 → 386 |
| Named Birds | 206 | 224 | 1.09 | **282** | 1.37 | 327 → 386 |

Every After figure is 502 x 282; the section is 434px shorter; the tallest row is 386px
(was 887). Text heights are unchanged because the 460px measure is unchanged.

**At 375px** (one column, 339px):

| Row | Text h | Before media h | Before ratio | After media h | After ratio |
|---|---|---|---|---|---|
| Weather | 318 | 633 | 1.99 | **191** | 0.60 |
| Statistics | 325 | 192 | 0.59 | **191** | 0.59 |
| Map Explorer | 262 | 183 | 0.70 | **191** | 0.73 |
| Species Detail | 262 | 192 | 0.73 | **191** | 0.73 |
| Calendar | 206 | 192 | 0.93 | **191** | 0.93 |
| Multimedia | 206 | 192 | 0.93 | **191** | 0.93 |
| Breeding Codes | 178 | 192 | 1.08 | **191** | 1.07 |
| Checklists | 178 | 242 | 1.36 | **210** | 1.18 |
| List Comparer | 178 | 309 | 1.74 | **248** | 1.39 |
| Named Birds | 262 | 171 | 0.65 | **191** | 0.73 |

At 320px the same shape: every screenshot 284 x 160, Checklists 210, List Comparer 248
(from 530 for Weather, 143 to 161 for the shots, 242 and 333 for the mocks).

Other checks: `scrollWidth` equals the viewport at 440, 375 and 320; at 1024 every
screenshot is 450 x 253 and List Comparer is 282 (its content does not fit a 253 box and
the mock grows rather than clips, by design); at 921 every screenshot is 401 x 226; at 920
and 768 every screenshot is 640 x 360 in a centred 640px column and the mocks are 242 and
281; `.phone-frame` is 260 x 550 at 1280 and 230 x 485 at 375.

---

## Deltas The Engineer applies, in one list

1. **`website/styles.css`**, the shippable delta (the mockup carries the same
   declarations under `body[data-view="after"]`):

   ```css
   /* ---------- Features ---------- */
   .feature-row {
     display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(28px, 5vw, 64px);
     align-items: center; padding: clamp(28px, 4vw, 52px) 0;
   }
   .feature-row.reverse .feature-text { order: 2; justify-self: end; }
   .feature-media {
     margin: 0; border-radius: var(--radius); overflow: hidden; aspect-ratio: 16 / 9;
     border: 1px solid var(--border); background: var(--surface); box-shadow: var(--card-shadow);
   }
   .feature-media img { width: 100%; height: 100%; object-fit: cover; object-position: left top; }
   /* DELETE: .feature-media[data-shot="weather"] { max-width: 420px; margin-inline: auto; } */

   /* List Comparer mock */
   .feature-mock { padding: 18px; display: flex; align-items: center; overflow: visible; }
   .cmp-row { padding: 7px 10px; border-radius: 8px; }
   .cmp-row + .cmp-row { margin-top: 2px; }

   @media (max-width: 920px) {
     /* existing lines stay; add: */
     .feature-row { max-width: 640px; margin-inline: auto; }
     .feature-row.reverse .feature-text { justify-self: initial; }
     .feature-mock { aspect-ratio: auto; }
     /* DELETE: .feature-media[data-shot="weather"] { max-width: 360px; } */
   }
   @media (max-width: 440px) {
     /* .version-pill line stays; add: */
     .feature-mock { padding: 14px; }
     .cmp, .ck { font-size: .8rem; }
     .cmp-row, .ck-row { padding: 6px 8px; }
     .cmp-head { padding: 0 8px 6px; }
     .ck-search { padding: 6px 9px; font-size: .78rem; }
   }
   ```

2. **`website/tools/capture.mjs`**: the Weather frame (anchored 16:9 clip with the three
   assertions, above); `clipH: 900` for Named Birds and both map shots; the Named Birds
   comment updated. `process-img.mjs` needs no change.
3. **Recapture** from the built 1.0.32 app against the demo dataset; commit the four
   reshaped assets (`weather.webp`, `named-birds.webp`, `map.webp`, `map-dark.webp`) with
   their `<img>` `width` / `height` read from the produced files, in the same commit.
4. **`website/index.html`**: the four declarations above, `statistics-mobile.webp`'s
   `height="1226"`, and the Weather alt once approved. Nothing else.
5. **No change** to `app.js`, `privacy.html`, the README, `docs/HELP.md`, or any
   `frontend/` file. The six `*PublishedClaims` suites and the four-file version parity
   guard are untouched and must stay green.
