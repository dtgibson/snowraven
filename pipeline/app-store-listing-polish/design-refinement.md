# Design Refinement: app-store-listing-polish

The two App Store screenshot sets (iPhone 6.9-inch, iPad 13-inch) go from
bare captures to composed frames. This is the spec The Engineer builds the
composer from. Every measurement is in output pixels at the family's real
canvas size. The mockup (`design.html`, beside this file) draws the same
geometry in CSS over the committed PNGs; the `.fr` block there is this spec
written as stylesheet, and the two must not drift.

No app, icon, website or listing text field changes. No listing sentence is
proposed: the captions are the only new words.

Revision after the first review (2026-10-30): the user approved the
direction, order, band, captions, mark and the Weather recapture, and asked
for an iPhone Duo set in the same look so the product page is "Made for
iPhone Duo". It is the third family below.

## Visual Direction

Quiet utility, carried into the store. Each frame is the app's own light
screenshot set as a rounded card on SnowRaven's dark green band (the
website's band, so a visitor arriving from the site recognizes it), under
the tab's exact name in white, one muted line saying what the frame shows,
and the raven mark in the band's accent at the top right. Nothing sells;
the frame names what it shows and gets out of the way. The six frames read
as one family in any order and on both the white and the near-black store
page, because the light app inside a dark band separates from either.

Direction A (dark band) is the recommendation. Direction B (the app's
accent tint `#E8F5EE` with the app's ink and accent) is kept in the mockup
as the one alternate: calm on the white page, but its edge all but vanishes
there and it is a bright slab on the black page. Only A is specified in
full below; B's values are listed once at the end for completeness.

## Open questions, answered

1. **Tabs and order.** Keep the six committed captures; add none now. New
   order: Map Explorer, Statistics, Calendar, Species Detail, Weather,
   Breeding Codes. The search result shows three frames, and the first
   three should be three different shapes (a map, a dashboard, a year
   grid); Weather's phone capture is a monospace text block that reads
   under its caption at page scale but not at thumbnail, so it moves to
   fifth. Nothing is recaptured for the order. Not adding: every extra
   frame is a capture (Targets a keyed one), and six strong frames beat ten
   uneven ones. If the user wants more later, Multimedia and Named Birds
   are the two to add first (both visual), and the composer's frame table
   makes each a one-row change.
2. **Background.** Dark green band, `#0c1f17`, lifted to `#132c20` at the
   top edge. It holds on both store pages; a light frame does not.
3. **Dark-theme captures.** None. The light app on the dark band is the
   contrast that makes the set work; a dark screenshot on a dark band loses
   its card edge on the black page.
4. **Mark placement.** The RavenGlyph on every frame, small, same place.
   Search results can show frames 1 to 3 only, so "first only" means two
   of the three visible frames carry no mark; a fixed small stamp is what
   ties the family together without shouting. Three iPhone captures also
   show the app's own lockup inside the card; the stamp is in the band,
   not the card, so it reads as the frame's signature rather than a second
   header.
5. **Caption wording.** Fresh lines, not trimmed description sentences (a
   trimmed sentence reads as a cut). The tab name is the display line,
   exactly as `TAB_LABELS` spells it; the second line uses the approved
   description's own nouns. Full table below.
6. **iPhone Weather frame.** Recapture, phone family only, at the page top
   (`window.scrollTo(0, 0)` in place of the "Edit checklist comment"
   anchor `capture-appstore.mjs` uses for both families today): the lockup,
   the tab header, the checklist field with its id, the whole weather block
   in frame, the tide block opening at the bottom edge, and the two long
   tide lines (`Station:` and `Tide data from`) below the fold. The iPad
   frame keeps its current anchor; nothing clips there and the sidebar
   names the tab. The horizontal clip itself is an app behavior at 440pt
   (the tide block does not wrap) and is flagged as a follow-up, not fixed
   here. If the user declines the recapture, the frame ships as is under
   its caption; the composer does not depend on it.
7. **Statistics key state (ROADMAP v1.0.17).** Leave it this run, on
   purpose. This run composes committed captures and does not re-run the
   capture (the v1.0.52 posture); the website's shots are out of scope. The
   state to standardize on is the keyed, checked one (it shows what the tab
   does), so `LISTING.md`'s new Screenshots section records that the store
   shows the keyed state, which gives the next website regeneration a
   stated target. If the user approves the Weather recapture, the rig is
   warm and the website's Statistics shot could be brought into line in the
   same session, but that is a website change and waits for its own yes.

## Screens / Views

Three frame families, six frames each, same recipe: iPhone 6.9-inch and
iPad 13-inch from the committed captures, and iPhone Duo (inner display)
from six new captures taken at build (added at the user's request after
the first review; `decisions.md` D6). Output file names keep the committed
capture names; the order is the composer's frame table and the upload
order, not the file name's number.

### Family: iPhone 6.9-inch, canvas 1320 x 2868, portrait

| Element | Value |
|---|---|
| Canvas | 1320 x 2868, opaque RGB |
| Background | vertical gradient: `#132c20` at y=0 to `#0c1f17` at y=1577 (55%), flat `#0c1f17` to the bottom |
| Horizontal inset | 120 (inner width 1080, x 120 to 1200) |
| Tab name | SF Pro, weight 700, 96px, line box 112px, letter-spacing -0.02em (-1.92px), `#FFFFFF`, left x=120, line box top y=128 (baseline about y=218), one line, no wrap, never wider than 936 (inner width less the mark and a 40px gap) |
| Second line | SF Pro, weight 500, 44px, line box 58px, no tracking, `#9fb3a7`, left x=120, line box top y=252 (baseline about y=297), one line, no wrap, never wider than 1080 |
| Raven mark | `snowraven-bird-glyph.svg` path, single flat fill `#59d499`, 104 x 104 box at x 1096 to 1200, y 134 to 238 (6px below the tab name's line-box top, so it sits on the cap height) |
| Card hairline | rounded rectangle fill `#293A33`, x 118, y 380, w 1084, h 2351, radius 38, drawn under the card |
| Card | the raw capture resized to width 1080 (height 2347 as the resize yields; 2346 is acceptable), corners clipped at radius 36, placed at x 120, y 382 |
| Bottom margin | 2868 - 382 - 2347 = 139 |

Vertical stack, top to bottom: 128 top margin, 112 tab-name line box, 12
gap, 58 second-line box, 72 gap, card. The caption area reads as one block
above the card; the card's bottom margin is a hair larger than the top
margin so the frame does not look bottom-heavy.

### Family: iPad 13-inch, canvas 2064 x 2752, portrait

| Element | Value |
|---|---|
| Canvas | 2064 x 2752, opaque RGB |
| Background | vertical gradient: `#132c20` at y=0 to `#0c1f17` at y=1514 (55%), flat `#0c1f17` to the bottom |
| Horizontal inset | 192 (inner width 1680, x 192 to 1872) |
| Tab name | SF Pro, weight 700, 104px, line box 120px, letter-spacing -0.02em (-2.08px), `#FFFFFF`, left x=192, line box top y=124 (baseline about y=221), one line, never wider than 1528 |
| Second line | SF Pro, weight 500, 48px, line box 62px, `#9fb3a7`, left x=192, line box top y=256 (baseline about y=304), one line, never wider than 1680 |
| Raven mark | same path, fill `#59d499`, 112 x 112 box at x 1760 to 1872, y 130 to 242 |
| Card hairline | rounded rectangle fill `#293A33`, x 190, y 384, w 1684, h 2244, radius 42 |
| Card | the raw capture resized to width 1680 (height 2240 exactly), corners clipped at radius 40, placed at x 192, y 386 |
| Bottom margin | 2752 - 386 - 2240 = 126 |

Vertical stack: 124, 120, 12, 62, 68, card.

### Family: iPhone Duo, inner display, canvas 2007 x 2853, portrait

**Inner, not outer.** App Store Connect has one iPhone Duo slot and takes
either display; nothing scales into it from another size. The inner
display is the device's signature screen, and at 669pt the app shows its
icon-rail navigation, so each frame shows more of its tab (the map beside
its view pills, the full matrix, the calendar grids) than the 6.9-inch set
does; the outer display at 466pt would photograph the same phone-bar layout
the 6.9-inch set already shows, which makes the badge promise nothing new.
The frame is nearly 7:10, so the recipe is re-derived below rather than
scaled from the phone: the card takes a slightly smaller share of the width
(80.9%) and the type steps up, because a squarer frame shows larger in a
height-constrained search result and a 96px name would read small beside
the wider card.

| Element | Value |
|---|---|
| Canvas | 2007 x 2853, opaque RGB |
| Background | vertical gradient: `#132c20` at y=0 to `#0c1f17` at y=1569 (55%), flat `#0c1f17` to the bottom |
| Horizontal inset | 192 (inner width 1623, x 192 to 1815) |
| Tab name | SF Pro, weight 700, 120px, line box 136px, letter-spacing -0.02em (-2.4px), `#FFFFFF`, left x=192, line box top y=128 (baseline about y=239), one line, never wider than 1459 (inner width less the mark and a 40px gap) |
| Second line | SF Pro, weight 500, 50px, line box 64px, `#9fb3a7`, left x=192, line box top y=276 (baseline about y=326), one line, never wider than 1623 |
| Raven mark | same path, fill `#59d499`, 124 x 124 box at x 1691 to 1815, y 134 to 258 |
| Card hairline | rounded rectangle fill `#293A33`, x 190, y 410, w 1627, h 2311, radius 42 |
| Card | the raw capture resized to width 1623 (height 2307 as the resize yields), corners clipped at radius 40, placed at x 192, y 412 |
| Bottom margin | 2853 - 412 - 2307 = 134 |

Vertical stack: 128, 136, 12, 64, 72, card. Width guards hold with room:
"Breeding Codes" at 120px bold is about 925px against 1459; the longest
second line (the Calendar line, 51 characters) at 50px measured 1108px
against 1623 in the composer.

**Capture row for `capture-appstore.mjs`'s `FAMILIES` table** (from
DECISIONS.md v1.0.59, the inner screen upright is 669 x 951 pt and gets
the icon-rail tier):

```
{ key: 'duo', dir: 'iphone-duo', vp: { width: 669, height: 951 }, dsf: 3, px: { w: 2007, h: 2853 }, phone: false }
```

669 x 951 at 3x is 2007 x 2853 exactly. `phone: false` because the tier
photographed is the icon rail, not the bottom bar; `selectTab` already
reads a control's `aria-label` in the rail. Any per-shot step that branches
on `phone` (the Weather scroll anchor, the Map Explorer framing) is
checked against this tier rather than assumed: the Duo Weather frame keeps
the committed "Edit checklist comment" anchor unless the rail layout clips
the tide block too, in which case it takes the page-top position recommended
for the 6.9-inch frame. The same six tabs, in the same order, with the same
captions apply; the frame table below is shared by all three families.
These are new captures, so Weather and Statistics go through the keyed
capture path, as the 6.9-inch Weather recapture does. No simulator is
involved; it is a Playwright viewport row.

**Mockup note.** `design.html` shows the Duo family's geometry over the
6.9-inch captures (letterboxed inside the card by `object-fit: contain`,
never stretched), labelled once on the page as a geometry preview. The Duo
captures come back for approval before upload, like every other frame.

### The frames, in upload order

Each row: position, raw capture (both families share the name), tab name
(display line), second line.

| # | Raw capture | Display line | Second line |
|---|---|---|---|
| 1 | `01-map-explorer.png` | Map Explorer | Your sightings and nearby hotspots on a map |
| 2 | `02-statistics.png` | Statistics | Life list totals, growth, and milestones |
| 3 | `04-calendar.png` | Calendar | Each day shaded by species, checklists, media, etc. |
| 4 | `05-species-detail.png` | Species Detail | Your whole history with one bird |
| 5 | `03-weather-tide.png` | Weather | A weather and tide summary for a checklist |
| 6 | `06-breeding-codes.png` | Breeding Codes | Breeding evidence by species and code |

Per-frame notes:

- **1 Map Explorer.** The iPhone capture opens on the lockup and the view
  pills with the Jamaica Bay popup open; the iPad capture is the rail
  density with the filter sidebar. Both as committed.
- **2 Statistics.** iPhone shows the header, the switches, the section
  pills and Life List Totals; iPad shows the keyed, checked state with the
  exotic-status line. As committed; the key state is recorded, not changed
  (question 7).
- **3 Calendar.** 2025, Large view, January and February shaded. As
  committed. The green grid is the frame that reads best at thumbnail,
  which is why it is third.
- **4 Species Detail.** iPhone shows Northern Cardinal; iPad shows the
  approved Wood Thrush frame (v1.0.52: not reproducible by the committed
  tools, so the composer must work from the committed file, never a
  re-capture). As committed.
- **5 Weather.** iPad as committed. iPhone: recapture recommended at page
  top (question 6); if declined, as committed.
- **6 Breeding Codes.** The matrix with Pin code labels and Unbounded. As
  committed.

## Component Usage (the composition recipe)

The composer builds one frame from four layers, in this order, then
flattens:

1. **Background.** A full-canvas rectangle with the vertical gradient
   above (one SVG `linearGradient`, two stops, `y2` at 55%).
2. **Hairline.** The rounded rectangle in `#293A33` from the family table.
   This is the website's `--band-border` (12% white) pre-flattened over
   the band so the composer uses only flat fills.
3. **Card.** The raw capture, resized to the inner width with `fit:
   'inside'` (never upscaled: the raws are already the family size, so the
   resize is a reduction to 81.8% on iPhone and 81.4% on iPad), corners
   clipped by a rounded-rectangle mask at the family radius, composited at
   the card origin.
4. **Caption and mark.** One SVG the size of the canvas holding the two
   text lines and the raven path at the boxes above. The path is the
   committed `frontend/src/assets/snowraven-bird-glyph.svg` `d` attribute
   as is, in a `viewBox="0 0 512 512"` group scaled to the mark box, with a
   single `fill`. Never redrawn, never a second fill, no wordmark beside it
   (the app's own lockup already appears inside several captures).

**Renderer.** Two acceptable routes; the first is recommended.

- *Playwright Chromium (recommended).* The toolchain is already beside
  `capture-appstore.mjs` and resolves `-apple-system` to SF Pro on the
  build Mac. Render a minimal HTML page per frame at viewport = canvas,
  `deviceScaleFactor: 1`, using the `.fr` CSS from `design.html` verbatim
  (the `--fw/--fh/--inset/...` custom properties and the `calc()` scaling
  by `--u`), with the raw PNG as the card `<img>`, and `page.screenshot`
  it. Then sharp verifies and flattens. The CSS box model then IS the
  spec, and the mockup the user approved is the thing that ships.
- *sharp only.* Build layers 1, 2 and 4 as one SVG and composite the card
  with a mask. SVG text needs the baselines from the tables (approximate
  to within 2px; SF Pro's ascent is 0.952em) and a font that librsvg's
  fontconfig can find on the Mac; verify by rendering one frame and
  measuring the glyph bounding box before trusting it.

**Flattening and verification (either route).** Output
`sharp(buffer).flatten({ background: '#0c1f17' }).removeAlpha().png({ compressionLevel: 9, palette: false })`.
The `node --test` row asserts for every output: `width` and `height`
equal the family canvas; `channels === 3` and `hasAlpha === false`; the
count per family is between 1 and 10 and equals the frame table; the
upload order equals the table; and each caption's rendered width fits its
box (measure in the renderer and fail loudly on overflow, because the one
thing a thumbnail cannot survive is a cut-off tab name).

**Determinism.** Same machine, same fonts, same inputs give identical
bytes, which is what "the same output on every run" means here. Across
macOS versions SF Pro's metrics can move by a pixel, so the test pins
geometry, size and opacity, not a byte hash. The raw captures stay
committed (the brief proposes `appstore/screenshots/raw/{family}/`) so a
recapture regenerates the set.

**Font.** SF Pro, the system font the app itself renders in on iPhone and
iPad (`system-ui` in `pipeline/design-system.md`), weights 700 and 500.
No font file is added to the repo and nothing is fetched. Fallback stack
for the HTML route: `-apple-system, BlinkMacSystemFont, "SF Pro Display",
"SF Pro Text", "Helvetica Neue", Helvetica, sans-serif`. The choice is
logged in `decisions.md`.

## Design Tokens Applied

Frame (direction A):

| Role | Value | Source |
|---|---|---|
| Band | `#0c1f17` | `website/styles.css` `--band-bg` |
| Band, top edge | `#132c20` | the band lifted one step for the gradient; derived, logged in decisions.md |
| Tab name | `#FFFFFF` | `website/styles.css` `.band h2` |
| Second line | `#9fb3a7` | `website/styles.css` `--band-muted` |
| Raven mark | `#59d499` | `website/styles.css` `--band-accent` |
| Card hairline | `#293A33` | `--band-border` (`rgba(255,255,255,.12)`) flattened over `#0c1f17` |
| Card fill under the capture | `#F9FAFB` | `--sr-bg` (light); only visible if a capture were ever shorter than the card, which none is |

Type at output resolution: iPhone 96/112 (700, -0.02em) and 44/58 (500);
iPhone Duo 120/136 (700, -0.02em) and 50/64 (500); iPad 104/120 (700,
-0.02em) and 48/62 (500). Radii: iPhone card 36, hairline 38; Duo card 40,
hairline 42; iPad card 40, hairline 42. Hairline 2px on all three.

Measured contrast (WCAG 2.1): `#FFFFFF` on `#0c1f17` 17.0:1 and on
`#132c20` 15.1:1; `#9fb3a7` on `#0c1f17` 7.7:1 and on `#132c20` 6.8:1;
`#59d499` on `#0c1f17` 9.2:1 (non-text, 3:1 required). All AA with room.
At the three-up search result on an iPhone a frame renders about 115pt
wide, a 0.26 scale, so the 96px tab name is about 8.4pt of bold white on
dark green and reads; the 44px second line is about 3.8pt there and is not
meant to read until the product page (about 0.6 scale, 8.7pt). This is by
design: the name is the thumbnail's job, the line is the page's.

Icon consistency (checked, not changed): the shipped icon is white on
`#2D8653`; the frame's mark is the website's brightened `#59d499` because
`#2D8653` on `#0c1f17` is 2.8:1 and fails the 3:1 non-text bar. Side by
side in the mockup they read as one green.

Direction B (the alternate, not recommended), if chosen instead: band
`#E8F5EE` (`--sr-accent-bg`) flat, no gradient; tab name `#0F1117`
(`--sr-text`, 17:1); second line `#6B6B74` (`--sr-text-muted`, 4.70:1 per
`globals.css`); mark `#277448` (`--sr-accent`, 5.09:1); hairline `#C4C4CE`
(`--sr-border-medium`). Geometry identical.

## Interaction Notes

The store images are static. The mockup page has two interactions, both
for review only: the A/B direction toggle (a `SegControl` in the app's
register, `aria-pressed`, keyboard operable) and tap-any-frame-to-enlarge
(each strip frame is `role="button"`, Enter and Space work, focus ring is
the app's 3px accent outline). The store surfaces on the page are
simulations: white `#FFFFFF` and near-black `#050506`; iOS's dark store
page is `#000000`, which the page does not use as a color of its own.

## Motion Spec

- Composed PNGs: none, static output.
- Mockup page, direction toggle: background and text color, 120ms,
  `cubic-bezier(0.2, 0, 0, 1)`, no transform, reduced motion instant, CSS.
- Mockup page, large-frame swap: opacity 160ms ease-out, no transform
  (nothing scales; a substitution is not an entrance), reduced motion
  instant, CSS plus a 0ms swap under `prefers-reduced-motion`.
- No hover scale, no entrance stagger, no motion on static content.

## Store facts (for The Engineer and The Deployer)

Verified against App Store Connect's screenshot specifications and Apple's
October 2026 guidance on 2026-10-30:

- App Store Connect has **one iPhone Duo display slot** per language. It
  accepts either the outer display (1398 x 2034 portrait, 2034 x 1398
  landscape) or the inner display (2007 x 2853 portrait, 2853 x 2007
  landscape). **Nothing scales into this slot from other sizes.** 1 to 10
  images, PNG or JPEG, no alpha. This design uses the inner display,
  portrait.
- Submitting an iPhone Duo set is what makes the product page show the
  **"Made for iPhone Duo"** badge for an app built with the iOS 27.1 SDK
  or later (SnowRaven has been since 1.0.58).
- From **April 2027** the Duo set is required for every submission.
- The other two slots are unchanged: iPhone 6.9-inch 1320 x 2868 (Apple
  scales it for smaller iPhones) and iPad 13-inch 2064 x 2752.
- Every set is replaced whole and in order (v1.0.4), read back by
  checksum, and the version's disposition goes in `RELEASE_LEDGER.md`.

## Content Notes

- Register: informative, not promotional. No superlatives, no calls to
  action, nothing addressed to the reader as a push. No em dashes.
  American spelling. Serial comma ("totals, growth, and milestones").
  "weather" lowercase in prose. No "eBird" or "Macaulay" in any caption.
- Tab names exactly as `TAB_LABELS` in `frontend/src/lib/tabLayout.ts`:
  Map Explorer, Statistics, Calendar, Species Detail, Weather, Breeding
  Codes. Never a component name; the Multimedia tab, if ever added, is
  "Multimedia".
- Second lines are at most 51 characters (the Calendar line, the user's
  final wording) so the longest fits the iPhone inner width at 44px with
  margin (978px against 1080); the composer measures and fails on overflow
  rather than trusting the count.
- For `appstore/LISTING.md`'s new Screenshots section (The Engineer
  writes it; it is published copy and waits for the user's yes): the
  table above (order, raw file, display line, second line), the one-line
  composition statement ("each frame is the committed capture on
  SnowRaven's dark green band with the raven mark, the tab's name and one
  line saying what it shows; composed by `<script path>` from
  `appstore/screenshots/raw/`"), and the sentence that the Statistics
  frames show the keyed, checked state (question 7).
- Follow-ups surfaced, not in scope: the Weather tab's tide block does
  not wrap at 440pt (two lines run off the right edge in the phone
  capture); ROADMAP v1.0.17 stays open with the store's state now stated.

## Self-audit

- `weft-design-lint check pipeline/app-store-listing-polish/design.html`:
  clean, 0 findings.
- Doctrine pre-flight: display face is the system font by a named,
  logged decision (the caption sits beside a screenshot set in the same
  face; the design system names Inter / system-ui; no font asset may be
  added and no CDN used). Three roles with real contrast: 96/700 display,
  44/500 line, plus the page's 11px uppercase labels. Neutrals tinted (the
  band is a green-black, the page uses the app's zinc tokens; no pure
  black, no dead gray). One dominant color (the band) and one accent (the
  mark). Background has a gradient lift rather than a flat slab. Motion is
  ease-out, under 300ms, reduced-motion honored, no anti-slop patterns. Not
  a card grid: the page is an editorial sequence (today, toggle, store
  simulations, large, icon check, captions); the frame is not a card inside
  a card, the hairline is an edge treatment on the one card. Content is
  real: the committed captures, the real icon, the real captions.
