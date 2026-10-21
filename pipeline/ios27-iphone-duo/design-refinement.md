# Design Refinement: iOS 27.1 and iPhone Duo

Improve lane, Stage 2 design pass. Refines three shipped surfaces and settles
one open call; it designs nothing new. Extends `pipeline/design-system.md`
(the Alerts inbox and phone-bar patterns, the safe-area rule in `ui.md`); no
deviation from the design system, so nothing is logged to `decisions.md` from
this stage. The mockup is `design.html` beside this file.

## Visual Direction

Quiet utility, unchanged. On the iPhone Duo the app should look exactly as it
does on every other iPhone and iPad, with one difference the user never has
to think about: nothing sits under a camera or the Dynamic Island on either
display, and tapping a filter on the inner screen does not zoom the page.
Every rule below pads a surface in place; nothing moves, shrinks or re-flows,
and on every shipped iPhone in portrait the result is byte-identical to
today because both side insets are 0 there.

## Screens / Views

### 1. The three fixed bottom surfaces, beside a side cutout

`.sr-navbar`, `.sr-nav-sheet` and `.sr-inbox-sheet` are `position: fixed`,
full width, and escape `.sr-ios-app body`'s side padding (ui.md, v0.5.81).
Today each pads only the bottom inset, so a side inset reported by the OS
would put the bar's end cell, the More sheet's first rows and search field,
and the inbox's rows under the cutout. They gain left and right padding.

**Which inset each edge reads.** Each edge reads its own side's variable and
nothing else: `padding-left` reads `safe-area-inset-left`, `padding-right`
reads `safe-area-inset-right`, the existing `padding-bottom` keeps
`safe-area-inset-bottom`. No edge reads the opposite side and no shorthand
applies one value to both, which `safeAreaPerSide.test.ts` enforces: every
rule that insets one horizontal edge must inset the other, and a declaration
may only ever read its own side. Android twins read `var(--sr-inset-left,
0px)` and `var(--sr-inset-right, 0px)` (the Android WebView reports 0 for
`env()` below Chromium 140, so `MainActivity.kt` injects the insets);
`androidInsetsCss.test.ts` derives the twins from the iOS rules and goes red
until the bar's and the sheet's twins carry the same two declarations.

**How the end cells behave.** The bar keeps `left: 0; right: 0`, so its
`--sr-surface` fill, its top hairline and its `--sr-nav-bar-shadow` still run
edge to edge under the camera, exactly as the fill runs under the home
indicator today. Under preflight's `border-box` the padding comes out of the
content box, so the grid's five `minmax(0, 1fr)` cells divide the width that
is left and the end cells start at the inset. The cell hover and active fills
stop at the inset. `--sr-navbar-h` is published from a live
`getBoundingClientRect()`, which side padding does not change. The bar is the
`@container (max-width: 17rem)` query container and a container query reads
the content box, so labels drop out when the cells really can no longer hold
them: at 466 pt with two 34 pt insets the bar still measures 398 pt, well
over the 272 pt threshold, so the Duo's outer screen keeps its labels.

**How the sheets' scroll content behaves.** The More sheet pads at the sheet,
the same element that carries the bottom rule, so `.sr-nav-sheet-body`'s
scrollport and `.sr-nav-sheet-foot` both sit inside the inset: rows, the
Search field, the handle, the heading, the focus rings and the overlay
scroll indicator all start at inset + 10 px. The sheet's `max-height:
min(70dvh, 528px)` cap is a height and is untouched (More sheet cap,
v1.0.45). The inbox sheet pads the same way at the phone tier, so
`.sr-inbox-head`, `.sr-inbox-body`'s scrollport and `.sr-inbox-foot` are all
inside the inset; the 16 px row padding becomes inset + 16 px. Both sheets'
rounded top corners stay at the physical edges, under the cutout if the
cutout is that low, which is surface, not content.

**At 641 px and up the inbox is a centred panel**, so there the ROOT pads and
the sheet's side padding resets to 0: a centred 520 px panel does not touch
the edge, and padding it would narrow its content for no reason. The root's
24 px breathing room gains the inset on both sides, matching the top-inset
rule already there. The More sheet never renders at 641 px and up.

**Where the side insets are 0, nothing moves.** Every shipped iPhone reports
0 for both side insets in portrait, and 0 px of padding is no padding. The
rules are gated on `.sr-ios-app` and `.sr-android-app`, so Mac, Windows, web
and Pi never carry them. The two cases that can shift are deliberate: an
Android phone narrow enough to show the bar in landscape (640 dp or less),
whose end cells move clear of a display cutout, and a Duo window narrow
enough to sit beside the camera, whichever inset the OS reports for it.

**What the OS will report is an open measurement.** The simulator's screen
masks do not place the inner camera, and the 27.1 reserved-region APIs exist
because the safe area does not necessarily describe a hole in the display.
The webview can read only `env()`; these rules read whatever it reports, and
if the inner camera arrives as no inset at all, the rules are inert there and
the no-fold-detection stance (apple-platform-readiness, 2026-09-15) stands.

**The exact CSS.** In the "iOS safe areas" block of `globals.css` the two
existing one-line rules become:

```css
.sr-ios-app .sr-navbar {
  padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}
.sr-ios-app .sr-nav-sheet {
  padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}
```

The Android twins directly after them (the bar's twin keeps its existing
`transition`, which the twin guard allows as an added declaration):

```css
.sr-android-app .sr-navbar {
  padding-bottom: calc(6px + var(--sr-inset-bottom, 0px));
  padding-left: var(--sr-inset-left, 0px);
  padding-right: var(--sr-inset-right, 0px);
  transition: transform 160ms ease-out;
}
.sr-android-app .sr-nav-sheet {
  padding-bottom: calc(14px + var(--sr-inset-bottom, 0px));
  padding-left: var(--sr-inset-left, 0px);
  padding-right: var(--sr-inset-right, 0px);
}
```

The inbox, in the same block beside its existing foot and root rules (no
Android twin: the inbox never renders on Android, and the twin guard asserts
that no `.sr-android-app` rule names `sr-inbox-`):

```css
.sr-ios-app .sr-inbox-sheet {
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}
@media (min-width: 641px) {
  .sr-ios-app .sr-inbox-root {
    padding-top: calc(24px + env(safe-area-inset-top, 0px));
    padding-left: calc(24px + env(safe-area-inset-left, 0px));
    padding-right: calc(24px + env(safe-area-inset-right, 0px));
  }
  .sr-ios-app .sr-inbox-foot { padding-bottom: 18px; }
  .sr-ios-app .sr-inbox-sheet { padding-left: 0; padding-right: 0; }
}
```

**The comment above them is rewritten.** The paragraph in the "iOS safe
areas" block that ends "Top/left/right are not touched on either: neither
declares them in a way an inset would help" is stale once these land. Replace
that paragraph with:

> The bar and the two sheets are full-width boxes at the BOTTOM edge, so they
> PAD rather than move, on the bottom and on both sides (ios27-iphone-duo:
> a side inset, the iPhone Duo's camera or an Android cutout in landscape,
> would otherwise cover the bar's end cell and the sheets' first rows).
> `box-sizing: border-box` is global here, so the sheet's cap is unchanged
> and only its content box moves inward; the bar is the label container
> query's subject, and a container query reads the content box, so labels
> drop out only when the cells really cannot hold them. Each edge reads its
> OWN side's inset, never the opposite one (safeAreaPerSide.test.ts). Top is
> not touched: neither surface declares it.

**Guards.** A new `bottomSurfaceSideInsets.test.ts` (shape:
`androidInsetsCss.test.ts`, reading `globals.css` through
`parseRulesAtAnyDepth`) asserts, red first: that `.sr-ios-app .sr-navbar`,
`.sr-ios-app .sr-nav-sheet` and `.sr-ios-app .sr-inbox-sheet` each declare
`padding-left` reading `safe-area-inset-left` and `padding-right` reading
`safe-area-inset-right`, at top level; that the `(min-width: 641px)`
`.sr-ios-app .sr-inbox-root` rule carries both sides; that the 641-and-up
`.sr-ios-app .sr-inbox-sheet` reset exists; and that the ungated base rules
for all three contain no `env(`. `androidInsetsCss.test.ts` supplies the
twins' rows by derivation, and `safeAreaPerSide.test.ts` and
`TabNav.test.tsx`'s 528 cap stay green unchanged.

### 2. Where the four Duo sizes land

Density is derived from measured shell width (`lib/navDensity.ts`: the
sidebar may never squeeze the content column under the 640 px phone
boundary; the phone tier is the `(max-width: 640px)` query). None of it
consults the device, so every Duo size lands in a tier that ships today.
Nothing is changed for any of them; this is the arithmetic written down.

| Display, orientation | Points | Tier | Why, and what it feels like |
| --- | --- | --- | --- |
| Outer, portrait | 466 x 678 | Phone bar, compact header | The only Duo size that shows the bar and the More sheet. Five cells of 93 pt, labels stay (container query threshold 17 rem = 272 pt). `70dvh` of 678 is 475 pt, under the 528 pt cap, so the More sheet scrolls with Settings pinned in its foot: expected, not a defect (v1.0.45). The Alerts inbox is the bottom sheet. |
| Outer, landscape | 678 x 466 | Icon rail, compact header | 678 minus the 216 pt sidebar leaves 462, under 640, so the derivation refuses the sidebar; 618 pt of content. Every iPhone in landscape gets this today (an iPhone 17 Pro is 874 x 402). The rail column scrolls on a short screen, as it does there. The inbox is the centred panel. |
| Inner, portrait | 669 x 951 | Icon rail, compact header | Above the phone tier by 29 pt, so no bar, no More sheet, and the phone-tier focus-zoom guard does not apply (section 3). 669 minus 216 is 453, so the rail; 609 pt of content, a band every 641 to 700 px window already produces. The inbox is the centred panel. |
| Inner, landscape | 951 x 669 | Sidebar, compact header | 951 minus 216 is 735, over 640 with 48 px of hysteresis to spare, so the first iPhone screen that earns the sidebar. The Map Explorer reserves its own `clamp(240px, 28vw, 300px)` sidebar, 266 pt here, and drops to the rail, exactly as a landscape iPad does. |

A fold or unfold while running is a window resize to the derivation and a
media-query change to the phone hook; both are the paths a window drag and a
rotation already take, with no animation on a derived density change by
design (`.sr-nav-col--anim` is opt-in for the manual toggle only).

### 3. The open call: the 16 px focus-zoom guard above 640 px

**Recommendation: extend it, to iPhones only, gated on the screen's shortest
side, and only once the measurement confirms the zoom.**

**Why it zooms there.** WebKit zooms the page to make a focused field at
least 16 px, and it allows that zoom only on the phone idiom (iPad never
zooms, which is why the shipped guard was written at the phone tier with
"desktop sizing untouched", v0.5.81). The idiom follows the device, not the
width, so an iPhone in landscape (every one of them is wider than 640 px
there) and the Duo's inner screen in both orientations tap a 13 px filter and
get a 1.23x zoom they have to pinch back out of. This has been true of iPhone
landscape since the guard shipped; the Duo makes it a portrait experience.

**Why not `isIOS()`.** It is true on iPad, where the floor would enlarge every
filter control for no benefit. The house rule also keeps user-agent and
platform sniffing out of the app, so `navigator.platform` is not the gate.

**The gate: the shortest side of the screen.** Every iPhone's shortest side
is at most 669 pt (the Duo's inner screen; the 17 Pro Max is 440); every
iPad's is at least 744 pt (iPad mini). 700 sits 31 pt from each. The gate
tests both device dimensions so it holds whichever one WebKit reports in
landscape (historically `device-width` is the portrait width regardless of
orientation; the pair makes that assumption unnecessary).

```css
/* iPhone only, above the phone tier (ios27-iphone-duo). WebKit zooms a focused
   field under 16px on the PHONE idiom at any width, so an iPhone in landscape
   and the Duo's inner screen need the same floor the phone tier carries; iPad
   never zooms and is excluded by its shortest side (744pt on the smallest
   iPad, against 669pt on the widest iPhone screen). Both device dimensions are
   tested so the gate holds whichever one is reported in landscape. The
   declarations are the phone tier's, verbatim, and must stay identical to it. */
@media (min-width: 641px) and (max-device-width: 700px),
       (min-width: 641px) and (max-device-height: 700px) {
  .sr-ios-app .sr-input-16,
  .sr-ios-app .sr-ctl-row :is(button, select, input) {
    font-size: max(var(--sr-ctl-floor), var(--sr-ctl-rem, 0.75rem)) !important;
  }
  .sr-ios-app .sr-ctl-label {
    font-size: max(calc(var(--sr-ctl-floor)        * var(--sr-label-ratio, 1)),
                   calc(var(--sr-ctl-rem, 0.75rem) * var(--sr-label-ratio, 1))) !important;
  }
}
```

The label rule travels with the control rule, or the pairing breaks the way
v1.0.33 recorded (a floored control beside an unfloored label). The phone
tier's companion layout rules (`.sr-chk-row-label { width: auto; min-width:
72px }` and the Breeding Codes pill allowance) are phone-width repairs; at
609 pt and wider the rows have room, so they are not copied, and the Engineer
measures the Checklists label column at 669 and 951 with the floor on before
shipping, adding the companion only if a label stops fitting.

**Cost, stated.** In the iOS app above 640 px on an iPhone, filter controls
render at 16 px instead of 12 to 13 px: iPhone landscape and both Duo inner
orientations. The phone-tier measurement was +1 row at 402 px and +0 at
320 px; at 609 pt and up it is expected to be +0 rows on every filter block,
which the Engineer confirms. iPad, desktop, web and Android are untouched by
construction (the class gate and the device gate).

**Guards.** `filterControlSizeCss.test.ts` collects rules whose leading
compound is `.sr-ctl-row`; the new selectors lead with `.sr-ios-app`, so they
are outside its sweep. The new block gets its own rows in that file: the
media context is exactly the two-list query above, the control declaration
is byte-identical to the phone tier's, the label declaration is byte-identical
to the phone tier's, and the 700 figure is pinned beside a table of the two
device short sides it sits between (669 and 744) so a future device moves the
number and the table together.

**Reversal conditions, in writing.** (1) If the measurement reads
`visualViewport.scale` 1.000 after a real tap on a 14 px field on the inner
screen, the block is not added and the null result is recorded in
`decisions.md`; the Duo then changes nothing about the guard. (2) If a future
iPhone's shortest side reaches 700 pt or an iPad's falls below it, the
threshold moves to the measured gap and the pinned table with it. (3) If a
future WebKit stops zooming on the phone idiom, the block is dead weight and
comes out with the phone-tier guard.

**The measurement, as far as it got.** The 27.1 runtime landed during this
stage and an iPhone Duo simulator was booted. A probe page served from the
Mac was opened in its Safari and reported, on the outer display: `screen
466 x 678`, `devicePixelRatio 3`, `navigator.platform iPhone`,
`(max-device-width: 700px)` true, `(pointer: coarse)` and `(hover: none)`
true, and all four `env(safe-area-inset-*)` at 0 px because Safari's own
chrome occupies them (Safari laid the page out 382 pt wide with its toolbar
and the status bar in an 84 pt column at the right edge of that screen, which
is Safari's layout and says nothing about the app's). The inner display stayed
dark: the simulator boots folded, and this Xcode 27.1 install has no
Simulator app (`Contents/Developer/Applications` does not exist and
`Contents/Applications` holds six other apps), so there is no fold, rotate or
tap on this machine. The inner screen's insets and the focus-zoom scale are
therefore the Engineer's first step, and the release skill should say that
the Simulator app is needed for the Duo check.

**The Engineer's recipe.** With the Simulator app available: boot the Duo
(`D0CBEB76-7F70-4CDC-AB71-2A1F989317B7` on runtime
`com.apple.CoreSimulator.SimRuntime.iOS-27-1`), unfold it, serve
`pipeline/ios27-iphone-duo/`-adjacent probe or any page that prints
`env(safe-area-inset-*)`, `screen.width`, `screen.height` and
`visualViewport.scale` and logs them to its server (the stage's probe logged
each reading as a GET so nothing has to be read off a screenshot), open it
with `xcrun simctl openurl`, tap a 14 px input, and read the scale in
portrait and landscape on both displays. Then do the same in the built app
(the brief's screenshots, never a process check), where the `env()` values
are the ones the rules consume. `xcrun simctl io <udid> screenshot
--display=<n>` takes the display by index; the outer is 1398 x 2034 px and
the inner 2007 x 2853 px.

### 4. What should feel better

- Nothing sits under the camera or the Dynamic Island on either display:
  the page already padded its edges, and now the three fixed bottom surfaces
  do too.
- Tapping a filter field on the inner screen does not zoom the page, if the
  measurement shows it does today.
- Nothing changes on any other device: every shipped iPhone in portrait is
  byte-identical, iPad and desktop never match the gates, web and Pi never
  carry the classes.
- On the Duo itself the app looks like SnowRaven at four sizes it already
  knows how to be: the phone bar on the closed phone, the rail or the sidebar
  on the open one.

## Component Usage

No new component and no new pattern. `TabNav.tsx`'s phone bar and More
sheet, and `AlertsInboxSheet.tsx`, are untouched as markup; every change is a
stylesheet rule on a class they already carry. The shared `Button` and
`Link` primitives, the focus trap and the sheet behaviours are unchanged.

## Design Tokens Applied

No new token and no new colour. The surfaces keep `--sr-surface`,
`--sr-border`, `--sr-nav-bar-shadow`, `--sr-card-shadow` and `--sr-scrim` in
both themes; `--sr-ctl-floor` (16 px, absolute by design) and `--sr-ctl-rem`
feed the extended floor exactly as they feed the phone tier. The mockup
copies the shipped values of these tokens for both themes.

## Interaction Notes

- The bar's cells, the sheets' rows and the inbox's rows keep their hover,
  active and focus treatments; only their origin moves inward by the inset.
- `--sr-navbar-h` and the Map Explorer chrome budget are unaffected (height
  only).
- The More sheet's cap and the Settings foot are unaffected (v1.0.45 holds).
- The Android keyboard rule (`.sr-android-app.sr-ime-open .sr-navbar`) is
  unaffected; the bar still slides out while the keyboard is up.
- No new state, no new copy, no new focus order.

## Motion Spec

No motion is added or changed. For the record, what the touched surfaces
already carry, which the mockup reproduces:

- More sheet rise: `transform 220ms cubic-bezier(0.2, 0, 0, 1)`, origin the
  bar it rises from (`translateY(100%)` to `0`), scrim `opacity 160ms
  ease-out`; reduced motion: the global block collapses both; CSS.
- Alerts inbox rise (phone tier): the same 220 ms rise and 160 ms scrim; at
  641 px and up `scale(0.96)` to `1` over 160 ms from the opener; reduced
  motion: collapsed by the global block; CSS.
- Bar cell and row hover: `background-color 120ms ease-out`; reduced motion:
  collapsed; CSS.
- Density change on fold or unfold: instant by design (`.sr-nav-col--anim`
  is opt-in for the manual toggle only).

## Content Notes

No user-facing copy changes. `docs/HELP.md` needs no new sentence: the Duo
is not a feature and the app describes no device. The stylesheet comment
rewrite above is the only prose in the change. `website/`, `README.md`,
`appstore/` and `PRIVACY_POLICY.md` are out of scope by the brief, and iPhone
Duo App Store screenshots are a separate follow-up that needs the user's yes.

## Decisions touched, restated from the brief

- apple-platform-readiness (2026-09-15): item 3's "per-side correct
  everywhere" is extended to the three full-width bottom surfaces; the
  no-fold-detection stance is kept.
- Nav rework (v1.0.17) and the `globals.css` note: "top/left/right are not
  touched on either" becomes "bottom and both sides pad; top is not
  declared".
- Safe-area overlays (v0.5.81), "pad, don't shrink": applied as written.
- Mobile-prep sweep (v0.5.55) and filter text size (v0.5.81, v1.0.33): the
  phone-tier floor is unchanged; a second, iPhone-only block above 640 px is
  added only if the measurement shows the zoom.
- More sheet cap (v1.0.45): unchanged; the outer screen scrolls with Settings
  pinned, as the brief expects.
- tao vendoring (v1.0.31): unchanged.

## Open calls for the user

1. The focus-zoom extension and its gate (section 3). Recommended: extend,
   iPhone-only by shortest side, conditional on the measurement.
2. Nothing else; the side insets are the brief's own ask and the tier map
   changes nothing.
