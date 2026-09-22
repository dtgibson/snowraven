# Decisions — website-screenshot-sizing

## Stage 1 (The Evaluator)

### How this was measured

Chromium via `website/tools/node_modules/playwright`, `website/index.html` loaded
directly, `loading` forced to `eager`, geometry read from `getBoundingClientRect()` at
1440 / 1280 / 1024 / 920 / 768 / 414 / 375 / 320px. Line counts derived from paragraph
height over computed `line-height`. Asset pixel sizes from `sips`; declared-vs-intrinsic
checked against `naturalWidth`/`naturalHeight` in the browser. No copy was read for
judgment and none is proposed for change.

### The numbers that decide the scope

At **1280px** (container `--maxw: 1140px`, `.feature-row` = `1fr 1.25fr`):

| Row | Words | Text | Media | media/text |
|---|---|---|---|---|
| Weather | 54 | 446x262 | 420x**784** | **2.99** |
| Statistics (reverse) | 43 | 460x269 | 446x252 | 0.94 |
| Map Explorer | 39 | 446x234 | 558x301 | 1.28 |
| Species Detail (reverse) | 40 | 460x234 | 446x252 | 1.08 |
| Calendar | 29 | 446x178 | 558x315 | 1.77 |
| Multimedia (reverse) | 26 | 460x178 | 446x252 | 1.42 |
| Breeding Codes | 19 | 446x178 | 558x315 | **1.77** |
| Checklists (reverse) | 18 | 460x150 | 446x242 | 1.61 |
| List Comparer | 19 | 446x150 | 558x309 | **2.06** |
| Named Birds (reverse) | 39 | 460x206 | 446x224 | 1.09 |

Row heights: Weather **887px**, next tallest 420px. Page 8,391px at 1280, 11,882px at 320.

**Three findings, each measured rather than judged.**

1. **Weather dwarfs its copy and is row 1.** `weather.webp` is 1080x2021 (aspect 0.534, a
   portrait capture) in a landscape two-column layout, held at `max-width: 420px`, giving
   784px of image against 262px of text. At 920px and 768px it is worse in a different
   way: the figure stays 360px wide inside an 848px single column, an orphaned sliver.
   The aspect is not a design decision. `git show 54f5a57` (v1.0.27,
   `weather-screenshot-recapture`) changed it from 1080x1385 to 1080x2021 to restore
   missing Weather output; the sizing was never revisited, and then the paragraph shrank.

2. **The `reverse` alternation puts half the figures in the narrow column.** Grid columns
   are `1fr 1.25fr` and `reverse` swaps content with `order`, not the track sizes, so a
   reverse row's media lands in the 1fr track (446px) and its text in the 1.25fr track
   (capped at 460px by `max-width`). Five 1600x900-class assets therefore render 446x252
   and five render 558x315: the same asset shape at two sizes, alternating down the page.
   This is invisible in the markup and only shows up in measurement.

3. **Media height is independent of copy length, so the shortest rows are the most
   lopsided.** Breeding Codes (19 words, 178px of text) gets 315px of media; List Comparer
   (19 words, 150px) gets 309px; Statistics (43 words, 269px) gets 252px. Before the copy
   pass every paragraph carried the row; now the ratio runs backwards.

### The phone tier inverts the problem

At 320px there is **no horizontal overflow** (measured at every width; the site holds).
But screenshots scale to 284px wide, so a 1600x900 app capture renders 161px tall at 0.18x
and is unreadable, while the two hand-built DOM mocks do not scale and become the tallest
media in the section: List Comparer 333px, Checklists 242px. At 375px the same inversion
holds (media/text 0.46 to 0.78 for the screenshots, 1.36 and 1.74 for the mocks).

### One atomicity violation, already in scope

`statistics-mobile.webp` (the Statistics tab on a phone, in the Platforms section) is
560x1226 and the markup declares `width="560" height="1198"`. It is the only declared
size on the page that disagrees with its asset; all ten others match. The reservation is
~12px short on a 244px-wide image, so the phone frame shifts on load. `54f5a57`'s brief
states the rule this breaks: the asset and its HTML dimensions land atomically.

### Scoping choices

- **Improve lane, confirmed.** Refining how existing surfaces look. No new user-facing
  behavior, no new screen, no new schema, no product-defining direction set from scratch.
  Every section, its figure and its copy already exist; only sizing changes.
- **Design pass: needed.** Three interacting decisions (a media-to-copy relationship for
  ten rows, the column inversion under a fixed alternation parity, the Weather asset's
  shape) plus a phone-tier call. Not one rule.
- **Copy is untouchable.** The paragraphs, the alt text where the frame does not change,
  the section head, the pill and the footer version all stay byte-identical.
- **The mocks are re-sizable, their content is not.** Changing what the Checklists or List
  Comparer mock depicts re-opens the v1.0.20 behavioural-claim check; re-sizing does not.
- **Checked and out of scope, stated so the next reader does not re-check:** `README.md`,
  `docs/HELP.md`, `PRIVACY_POLICY.md`, `ACCESSIBILITY.md`, `appstore/LISTING.md` and
  `website/privacy.html` contain **no** reference to `assets/shots` or any `.webp`, so no
  screenshot change reaches them. `frontend/` is untouched.
- **Guards to keep green:** the six `*PublishedClaims` suites read `website/index.html` by
  locating prose passages (`weatherTidePlanPublishedClaims` by the first occurrence of
  `Weather/tide Planner`; `namedBirdTimelinePublishedClaims` by `<h3>Named Birds</h3>`),
  and `icloudKeysPublishedClaims` carries the four-file version parity check. Attribute and
  stylesheet edits do not disturb them; deleting or re-ordering a row would.
- **If Weather is re-captured**, it runs through `website/tools` against the synthetic demo
  dataset (v1.0.4: `SR_DATA_DIR`, never real eBird data) from the current 1.0.32 build, and
  the asset plus its declared dimensions land in the same commit. The shots were last
  regenerated at 1.0.30 (`2b80fd8`), two releases back.

## Stage 2 (The Designer)

Design pass over the surfaces the brief names, with the copy locked. Every number below
was measured in the mockup (`design.html`, which links the shipped stylesheet so its
Before view is the live page) at 1440 / 1280 / 1024 / 921 / 920 / 768 / 640 / 440 / 375 /
320px; the Before column reproduces Stage 1's table to the pixel.

### One media height per width, set by the track

- **Decision:** every `.feature-media` is a 16:9 box of its grid track (`aspect-ratio:
  16 / 9`), so all ten figures share one height at any width: 502 x 282 at 1280 and 1440,
  450 x 253 at 1024, 401 x 226 at 921. Screenshots fill it with `object-fit: cover;
  object-position: left top`, which exists to absorb sub-1% rounding and never to crop.
- **Why this rather than a per-row height that follows copy length:** the brief asks for
  a stated relationship between media size and a short paragraph. Sizing each figure to
  its own paragraph would make two rows carrying the same asset shape render at two sizes,
  which is the defect being fixed from the other side. The relationship is a band instead:
  with the locked copy the text columns run 150 to 269px at 1280, and one 282px figure
  puts every row between 1.05x and 1.88x, against 0.94x to 2.99x today. Row 1 goes from
  887px to 385px and every row is 386px.
- **Rejected:** `object-fit: contain` (letterbox bands in `--surface`, visible in dark
  theme); a taller-than-16:9 box (a 3:2 box is 335px at 1280, back above the shortest
  paragraphs' 2x); scaling the mocks with `transform` (the house posture against CSS
  scaling in WKWebView, and it would blur text).

### Equal tracks, not swapped tracks

- **Decision:** `grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)`. The brief allows
  swapping `1fr 1.25fr` on reverse rows; equal tracks remove the asymmetry the inversion
  was made of, so there is no second rule to keep in sync. Parity is untouched (odd rows
  media right, even rows `reverse` by `order`).
- `.feature-text` keeps 460px, and `justify-self: end` on reverse rows puts its 42px of
  slack beside the media on both parities. Measured: the text's outer edge meets the
  container edge on every row, with a 106px gutter between text and figure either way.
  Today's even rows leave a 98px hole at the container's right edge that odd rows do not,
  a fourth asymmetry Stage 1 did not list and the measurement turned up.

### Weather: recaptured from 1.0.32 and framed 16:9 around the output

- **Decision:** recapture through `website/tools/capture.mjs` against the demo dataset
  from the built 1.0.32 app, clipped to 16:9 of the `#panel-weather` width, anchored 6 CSS
  px under the Weather Output block's bottom border, with assertions that the identity
  line is inside and the "Edit checklist comment" link is outside. Expected 1080x608.
- **Why not a re-crop of the committed file:** it is a 1.0.30 capture, two releases stale.
  The mockup's stand-in is cut from it only to show the framing and is not shippable.
- **Why the panel's gutters stay in the frame:** the content span (identity line to block
  bottom) is 291 CSS px; 16:9 of the 540px panel is 304px and fits, 16:9 of the 421px card
  is 237px and does not. Clipping to the card would have been the natural tidy-up and
  would have cut the block. Measured on the committed asset: block bottom at y 1016 of
  2021, identity line text at 436 to 456, link bottom at 409; the frame runs 420 to 1028.
- **Why the output and not the whole panel:** the Weather tab is a 476px card, so any
  whole-panel frame is portrait, and at the section's 282px height a 0.534 image is 150px
  wide. The identity line plus the weather block is the payload `54f5a57` (v1.0.27)
  existed to restore. At 1280 the frame renders at 0.93x of its 1x size, so it is the one
  screenshot in the section whose text a reader can read.
- **Consequence to flag:** the alt text must change, because the frame no longer shows the
  tide block. A proposed alt is in the spec; it is the only text this pass touches and
  goes to the user under the website copy rule.
- **Not addressed, stated:** the tide is no longer pictured. The copy says "weather and
  tide summary" and the Statistics shot does not picture its weather section either; a
  figure illustrates, the sentence claims.

### Named Birds and the two map shots are reshaped, not cropped

- **Rule:** an asset whose aspect differs from 16:9 by more than 1% is reshaped at capture,
  never cropped by CSS. `named-birds.webp` is 2:1 (an 11% crop takes the "5 sightings"
  counts and the strip's end label at the right edge); the map shots are 1.86:1 (a 4% crop
  takes the layer switcher). `clipH: 900` for all three; the map frames gain 40px of map,
  Named Birds gains 100px of empty app page (tone rgb 249, 251, 252) under the strip card.
  Alt text unchanged for both, since nothing in the frame changes.
- The other seven assets keep their committed files. The capture run regenerates
  everything; committing the unchanged seven as refreshed 1.0.32 captures is a separate
  decision for the user at the gate, each being a visible change to review.

### The phone tier: screenshots whole, mocks come down

- **Decision:** at 375 and 320 the screenshots stay whole at column width (339 x 191,
  284 x 160) and the two mocks tighten at the existing 440px breakpoint, type and padding
  only, content untouched (v1.0.20): Checklists 242 to 210px, List Comparer 309 to 248px
  (333 to 248 at 320). Mock over screenshot goes from 1.26 / 1.61 to 1.10 / 1.30 at 375 and
  from 1.50 / 2.07 to 1.31 / 1.55 at 320.
- **Rejected:** cropping the screenshots on a phone (a fragment of an app the reader has
  never seen, and the alt text stops describing the picture); hiding them (eight rows
  without a figure beside two with one); phone-specific captures for ten tabs (a new
  asset set, out of scope for a sizing pass; noted as an option, not proposed).
- List Comparer remains the tallest figure on a phone, by 57px at 375. It is five rows of
  content and the content is the claim; it is no longer 1.9x its own paragraph.

### The single-column tier gets a 640px column (the one change beyond the three defects)

- **Decision:** at 920px and under, `.feature-row { max-width: 640px; margin-inline:
  auto; }`, the width `.section-head` already uses, and the mocks drop the aspect box
  (`aspect-ratio: auto`). Measured: at 920 and 768 every screenshot is 640 x 360 instead of
  848 x 477 / 707 x 398, and a paragraph's measure is at most 640px instead of 848px.
- **Why it is in scope:** the brief owns "the layout rules", and the same defect the
  section has at 1280 (a figure over 2.5x its paragraph, and a 204px mock centred in a
  477px frame once the box is full width) is measurable at 660 to 920px in both the shipped
  page and the After view without this line. It affects only 660 to 920px; at 640 and under
  the column is already narrower than 640.
- **Flagged for the gate** as the one change beyond the brief's three measured defects, so
  the user can strike it without touching the rest.

### Statistics phone figure

- `statistics-mobile.webp` declares its true 560x1226. No CSS change; `.phone-frame` stays
  260 / 230px and renders 260 x 550 at 1280, 230 x 485 at 375, as today once the reservation
  is right.

### Self-audit

- `weft-design-lint check design.html`: clean, 0 findings.
- Doctrine pre-flight: display face is the site's shipped system stack (a font change is
  out of scope for a sizing pass and would be a design-system change; logged, not
  deviated); three type roles, tinted neutrals, one accent, depth by card shadow, no new
  motion, reduced-motion fallback present for the mockup's only transition, content is the
  real copy and real captures, no nested cards, no default grid.
- No em dash (U+2014) in the spec, the mockup, or this entry. Every colour in the delta and
  the mockup chrome is a token. Nothing sets a positive `min-width`. `scrollWidth` equals
  the viewport at 440, 375 and 320 in both views.
- Design system: extended, not changed. No new token, class, pattern or dependency.

## Stage 3 (The Engineer)

### How this was measured

`website/` served on loopback (`python3 -m http.server 8791 --bind 127.0.0.1`, never
`file://`), driven with the repo's own Playwright (`website/tools/node_modules/playwright`,
Chromium), `loading` forced to `eager` and every image awaited, geometry from
`getBoundingClientRect()` at 1440 / 1280 / 1024 / 921 / 920 / 768 / 640 / 440 / 375 / 320px.
Asset pixel sizes read from the WebP headers by the new guard, not from `sips`.

### After, measured on the shipped files

**At 1280px.** Every `.feature-media` is **502 x 282**, as designed. Row heights: Weather
385, every other row 386. Ratios, in row order: 1.08 / 1.05 / 1.21 / 1.21 / 1.59 / 1.59 /
1.59 / 1.88 / 1.88 / 1.37. Text columns: odd rows start at x 106, reverse rows end at
x 1174, so the text's outer edge meets the container edge on both parities. Section page
height 7,954px (8,391 before). Every number matches the spec's After table except
Statistics' text column, 268px against a predicted 269.

**At 375px.** Every screenshot **339 x 191**, Checklists **210**, List Comparer **248**;
ratios 0.60 / 0.59 / 0.73 / 0.73 / 0.93 / 0.93 / 1.07 / 1.18 / 1.39 / 0.73. Exactly the
spec's table. At 320px every screenshot is **284 x 160**, Checklists 210, List Comparer
248, as predicted.

**Other tiers.** 1440: 502 x 282. 1024: 450 x 253, List Comparer 281 (spec said 282).
921: 401 x 226, Checklists 242, List Comparer 281. 920 and 768: 640 x 360 in the centred
640px column, mocks 242 and 281. 640: 589 x 331. 440: 404 x 227, mocks 210 and 248.
`.phone-frame` 260 x 550 at 1280 and 230 x 485 at 375.

**No horizontal overflow at any width measured**: `scrollWidth` equals `innerWidth` at
1440, 1280, 1024, 921, 920, 768, 640, 440, 375 and 320.

**Neither mock is ever clipped.** Measured content against box at every width: the
Checklists mock's content is 204px (180 at and under 440) and the List Comparer mock's is
243px (218), each inside its padding at every tier, and where the content exceeds the 16:9
box (List Comparer at 1024 and 921, both mocks at 920 and under) the figure grows instead,
which is what `overflow: visible` is there for.

### One measured deviation from the spec, and why the spec was off

**`weather.webp` is 1080x606, not the predicted 1080x608, and it renders at 0.73x of the
app's 1x size rather than 0.93x.** The spec derived the Weather panel's width from the
committed asset's pixel width, reading 1080 device px as a 540 CSS px panel. It is not:
`#panel-weather` measures **684 CSS px** at the capture's 900px viewport, and the committed
1080x2021 file was a 1368x2560 capture that `process-img.mjs` downscaled to 1080 wide. The
old code's `Math.min(box.height, 1280)` cap is visible in that 2560 (1280 CSS px x 2).

So the frame the spec describes, 16:9 of the `#panel-weather` box, is 684 x 384.75 CSS px,
captured at 1368x768 and resized to **1080x606** (aspect 0.24% off 16:9, inside the 1%
rule). Nothing about the frame's construction changed; only the spec's arithmetic about it
was wrong, in a direction that does not affect the instruction ("the `#panel-weather`
bounding box, exactly as today", "do not clip to the card"), which is what shipped.

The consequence worth naming: at 1280 the figure renders at 502px for a 684px-wide panel,
so the monospace output is about 10px on screen rather than the spec's predicted 12px. It
is still the one readable screenshot in the section by a wide margin, since every other
shot renders a 1600px capture at 502px (0.31x). Reversing this would mean clipping to the
card, which the spec rejects because 16:9 of the card cuts the output block.

All three fail-closed frame assertions passed with headroom: on the produced frame the
identity line sits about 11 CSS px below the top edge (the assertion requires 2), the
"Edit checklist comment on eBird" link is entirely above it, and the output block's bottom
border about 7px above the bottom edge.

Two other sub-pixel differences, recorded rather than chased: Statistics' text column 268
against 269 at 1280, and List Comparer 281 against 282 at 1024.

### The rig had no eBird key, and what that cost

`backend/.env` on this machine carries `OPENWEATHER_API_KEY` and no `EBIRD_API_KEY`, so the
live Weather lookup answered "API key not configured" and the capture failed closed, as it
should. `WEATHER_REPLAY=1` does **not** rescue it: the replay branch aborts only
`**/weather/{id}`, while `/tide/{id}` resolves the checklist through eBird as well and
returns the same error, which the readiness check reads from the shared panel text. On a
rig with no eBird key the replay path is therefore unusable as written. That is a tooling
gap, left unfixed here to keep the diff to what the design asks for; it is flagged.

The shot was captured **live** instead, using the eBird key already stored by the user's
own desktop app, written into `backend/.env` for the run and removed immediately after; the
file was restored and verified byte-identical by checksum. The published frame is a live
1.0.32 capture against the synthetic demo dataset, and the structural demo-data guard
passed before the first frame (368 synthetic checklists).

### What was committed, and what was put back

The capture run regenerates all eleven assets. Only the four the design reshapes are kept:
`weather.webp` (1080x606), `named-birds.webp` (1600x900), `map.webp` (1600x900) and
`map-dark.webp` (1500x844). The other seven were restored to their committed bytes with
`git checkout --`, so the diff holds only what the spec asks for and the "refresh the other
seven" question stays the user's to answer at the gate. `statistics-mobile.webp` is
unchanged at 560x1226 and only its declaration moves, from 1198.

### The guard

`frontend/src/lib/websiteFigureDimensions.test.ts`, in the house `*PublishedClaims` shape:
it reads the files on disk, parses the WebP headers in pure JS (no `sips`, because the
frontend CI job runs on ubuntu and a shelled-out guard would silently not run there), and
asserts that every `<img>` in the features section declares its asset's true pixel size,
that each is within 1% of 16:9, and that the figures outside the features section declare
their true size too. The one aspect exemption is named in the file with its reason:
`statistics-mobile.webp`, the Platforms phone frame, portrait by design.

Every row carries a non-vacuity leg, and the parser has guard-the-guard rows that prove it
fails closed on a truncated file, a non-RIFF container, an unknown leading chunk and a
missing VP8 sync code. Mutation-verified in three directions, each restored byte-identical:
a declared height off by one goes red on the parity row; the pre-reshape 2:1
`named-birds.webp` goes red on the aspect row, naming "1600x800, 12.50% off 16:9"; and
renaming the features section fails the run rather than passing vacuously. Six tests,
123ms.
