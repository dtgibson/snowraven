# Pipeline decisions — mobile-app

## 2026-07-05 — Phased public announcement (user directive, mid-run)

**Decision:** No public mention of the mobile apps on the website or README
(or other public surfaces: docs/HELP.md as shipped in desktop builds, the
public PRIVACY_POLICY.md) while the apps are in the testing/TestFlight phase.
The mobile apps are announced as available only once the user makes them live
on the App Store; more TestFlight dev rounds may happen before that.

**Applied:** PRD area H (FR-28/29/30) rewritten into Phase 1 (this run:
prepare privacy/label text inside the submission package only; public
surfaces verified SILENT about mobile) and Phase 2 (deferred to App Store
launch: README/website/HELP/product-brief announcement). QA-27 inverted to
verify absence, not presence. This deliberately overrides the standing
"always update README/website with every feature" convention for the mobile
platform until launch — the Chronicler must log it in DECISIONS.md.

## 2026-07-05 — Simulator preview before ship (user directive, mid-run)

**Decision:** Before the deploy sign-off, the user is shown the app running
in the iOS Simulator as BOTH an iPhone and an iPad (in addition to the
Designer-stage mockup review). Extends the user's standing
live-preview-before-ship preference to the mobile run.

## 2026-07-05 — iOS "Import" wording on the file rows (user-approved, design review)

**Decision:** On iOS/iPadOS the Settings file rows use "Import" language —
**"Import file…"** (empty row), **"Import new…"** (replace), and
**"Importing…"** for the transient state — instead of the desktop's
"Upload file" / "Upload new" / "Uploading…". Desktop and web/Pi keep
"Upload" unchanged. The branch rides the same `isIOS()` seam as the native
document-picker presentation (schema §2.5/2.6), so it is a copy-only
platform adaptation, not a new component. Approved by the user at the
Stage 4 design review; this is the run's one deliberate design-system
copy deviation.

**Also settled at the same review:** map fullscreen hides the sidebar on
iPad too (Filters FAB appears while fullscreen — the shipped phone pattern
extended to fullscreen at any width; see design-spec.md); the iPad TabNav
dropdown (full-width trigger) and Statistics 2-up portrait compositions
were accepted as-is for v1, with a trigger width cap noted as possible
future polish only.

## 2026-07-05 — Preview-driven composition fixes (user-requested, live simulator preview)

Two composition problems surfaced at the Stage-5 live simulator preview
(iPhone 17 Pro + iPad Air 11-inch, iOS 26.5) — both fixed iOS-gated via the
new `compactChrome()` predicate in `lib/platformGates.ts`; desktop and web
are byte-untouched. In-scope mobile polish per design-spec ("polish where a
surface composes poorly"), not a redesign.

**1. Compact top chrome on iOS.** The desktop brand header (48px top
padding, 30px logo, 1.625rem wordmark, tagline, 28px bottom margin) ate a
large slice of both device canvases for no benefit. On iOS the header
collapses to a slim single-line bar — 20px logo + 1.125rem wordmark, no
tagline, 8/6px vertical padding (`.sr-header.sr-header-compact`,
globals.css). The wordmark stays the page's `<h1>` in the banner landmark
(brand presence + a11y semantics kept); the tagline is decorative and is
dropped entirely on iOS.

**2. Map Explorer above the fold on iOS.** With the desktop-tuned panel
offsets (`100dvh − 178/132px`), the map's bottom edge — and the
fullscreen/Filters FAB cluster anchored to it — landed below the fold on
iOS (the safe-area top inset plus the tall header exceeded the offsets'
chrome budget), with no scroll affordance hinting at the FABs. On iOS the
panel now sizes to the visible viewport under the compact chrome:
`height: calc(100dvh − 112px − env(safe-area-inset-top))` (budget = compact
header ~42px + tab nav ~66px, orientation-independent on both device
families), `min-height: 300px` for short landscape-phone viewports
(`.sr-map-explorer-panel.sr-map-panel-ios`). The mode pills above the map
remain reachable and slim inside the panel; nothing was removed.

The two fixes share one predicate deliberately: the panel-height budget
assumes the compact header, so they must switch together.

## 2026-07-05 — QA round: all 10 findings fixed; guard-strength conventions

The Stage-5 QA sweep confirmed 10 findings (2 major / 7 minor / 1 nit); all
are fixed in this round. The behavior fixes: RebuildCaches rides the new
`supportsAppRelaunch()` gate (iOS clears caches + close-and-reopen copy,
never strands; desktop gained a non-stranding try/catch), the safe-area
env() rules are scoped under `.sr-ios-app` (set on `<html>` by main.tsx only
when `isIOS()` — env() is NOT zero in iOS-Safari web with viewport-fit=cover,
so ungated rules broke web byte-parity; comments corrected), the fullscreen
map sidebar overlay gained `padding-left: env(safe-area-inset-left)` (the
fixed panel bypasses the body insets), and location.ts's iOS catch-arm now
matches the strings the installed plugin (2.3.2) actually rejects with —
`"Location services are not enabled."` → permission-denied so the
Settings-app guidance fires; CLError/empty-array stay honest generic.

Durable test conventions established while fixing the guard-strength
findings (worth carrying into future gate/guard tests):

- **A parse-the-source guard that promises "top-level only" must enforce it**
  — `mapIosFullscreen.test.ts` now strips `@media` blocks (brace-depth walk)
  before matching, with a fixture self-test, so consolidating the
  any-width rules into the ≤640 tier fails the suite instead of silently
  killing iPad fullscreen.
- **Negative source guards must be quote-agnostic** (`['"\`]`), and positive
  guards should assert the STRUCTURE (the gate ternary, comment-tolerant),
  not mere string presence — `iosChrome.test.ts`; the original double-quote
  negative was inert against the file's own single-quote style.
- **A "renders only under the gate" assertion must anchor to the guarded
  element's own content**, not the bare guard pattern — the tagline test now
  requires guard+copy adjacency and exactly one occurrence of the copy.
- **Platform mocks in component tests are flippable `vi.fn()`s, never
  hardwired lambdas** — `Settings.test.tsx` now flips `isIOS`/`isTauri` and
  exercises the real component's iOS wirings (Import copy, Mechanism A/B
  dispatch via a `vi.hoisted` mutable mechanism switch, Offline-maps
  absence, the Rebuild-caches iOS flow with a relaunch() spy proving the
  desktop plugin is never touched).
- **Plugin-error mapping tests use the plugin's REAL reject strings**
  (quoted from the installed version's source, cited in the test) — invented
  fixtures would pass while real strings misroute; re-verify on any
  plugin-geolocation version bump.

All fixes verified: full frontend suite 119 files / 1468 tests green,
`typecheck`/`lint`/`build` clean, `cargo check` (desktop) clean;
pr-description.md brought current with the composition fixes, the QA fixes,
and the real test inventory (the second major).

## 2026-07-05 — V2 closed by user at the live preview (Mechanism A confirmed)

**Verified interactively by the user on the iPhone 17 Pro simulator:** the
existing `<input type="file">` presents the native iOS document picker under
wry — Mechanism A works with zero extra code. `IOS_IMPORT_MECHANISM` stays
`'input'`; the plugin-dialog fallback (Mechanism B) remains pre-wired but
dormant (V3 moot). The unused `dialog:allow-open` mobile grant + plugin is
deliberately KEPT for now as the sanctioned fallback against device-vs-
simulator divergence in TestFlight rounds — the Auditor assesses the grant.
The user also confirmed the two preview-driven composition fixes (compact
header; map above the fold) look good on both simulators.

## 2026-07-05 — iOS bundle id is com.dtgibson.snowraven (user-created ASC record)

**Decision:** The user registered the App Store Connect app record under
**com.dtgibson.snowraven** (not the planned com.snowraven / fallback
com.snowraven.ios). iOS therefore gets its own identifier via Tauri's
per-platform overlay (`src-tauri/tauri.ios.conf.json`), and the committed
gen/apple project (project.yml + pbxproj) was updated to match. The DESKTOP
identifier stays com.snowraven (tauri.conf.json untouched) — changing it
would alter the shipped Mac app's identity and updater continuity. Simulator
launch commands now use com.dtgibson.snowraven.

## 2026-07-05 — On-device TestFlight feedback (round 1): two phone-tier issues

Found by the user on their own iPhone via TestFlight build 1. Both are
PHONE-TIER (≤640) issues, not iOS-specific — they affect web/self-hosted
phone users too:

1. **Calendar shows no dates on a phone.** v0.5.63 moved the day-of-month
   numbers off the big month grids (the view phones are FORCED to via
   useIsPhone) and onto the year-overview thumbnails, where the 152px
   container-query floor hides them at phone cell sizes. Net: the phone
   calendar lost dates in the only view it shows. The globals.css ≤640
   comment even documents "Compact cells are count-only … dated thumbnails
   never render on a phone" — an oversight. FIX: render the day-of-month
   dates in the phone's month-grid cells (restore DayCorner on phone +
   the .sr-cal-daynum phone size bump); desktop month grids stay dateless
   (the v0.5.63 decision is preserved for wide viewports).

2. **The "Unbounded" (wideMode) table view is ugly on a phone.** Today
   Unbounded sets the table to width:max-content and the WHOLE PAGE scrolls
   sideways (chrome and all). User directive: **keep an unbounded/wide view
   on phones — the narrow viewport genuinely needs it — but make it
   beautiful.** They value the "wide zoom mode" (pinch to see the whole wide
   table) but not the page-lurch presentation. Design pass in progress.
   Affects BreedingCodeTable, LifeListTable (List Comparer), SpeciesDetail
   (and any other wideMode table).

Scope: fixing at the phone tier (all platforms) → ships as 0.5.64 to
desktop/web too (changelog describes the phone fixes; still NO mobile-app
mention) AND rides into TestFlight build 2. (User redirected the
everywhere-vs-iOS question toward the wide-view design; everywhere/0.5.64 is
the working default — reconfirm at the release gate.)

## 2026-07-05 — Wide-view design pass (Designer stage): three treatments, zero new tokens

Mockup: `pipeline/mobile-app/wide-table-design.html` (iPhone frame, synthetic
Breeding-Codes matrix, chrome shown so "chrome stays put" is visible;
chip-switchable A/B/C, light+dark). Three buildable treatments proposed, all
designed WITHIN the shipped system — **no new `--sr-*` tokens and no new
components required**; each reuses `.sr-scroll-x`, the existing sticky
name-column CSS, and the tier tokens:

- **A · Contained wide frame** — the grid scrolls INSIDE the framed card,
  name column frozen, soft edge-fades (two absolutely-positioned gradient
  nodes toggled by a scroll listener) that appear only where more content
  exists. Page never lurches. Trivial build (essentially "Unbounded made to
  behave like Normal + fades"). Tradeoff: still a scan-through-a-window, no
  single-glance overview of all columns.
- **B · Fit-to-width overview** — `transform: scale()` shrinks the whole
  table to the phone width (every column visible at once), tap → 1:1
  contained scroll. Medium build. Caveat: at small scale, dots/text/tap-
  targets shrink and scaled text can look soft in WKWebView; best as an
  overview companion, not a place to tap links.
- **C · Pinch-zoom in a contained surface (RECOMMENDED)** — framed
  scrollable surface + two-finger pinch to zoom out/in + a −/Fit/+ control
  (keyboard/AA-reachable, works one-handed and on desktop); page never moves.

**Load-bearing constraint discovered / flagged for the Engineer:** iOS
WKWebView gives NO per-element pinch — native pinch zooms the whole visual
viewport (exactly the page-lurch we're removing). True per-surface pinch (C's
gesture) requires a JS two-pointer gesture handler applying `transform: scale`
on the surface (clamp ~0.4–2.5), with `touch-action: none` so the handler owns
the touch (the established `CenterPinDropper` long-press pattern). That gesture
is the materially harder piece; the **−/Fit/+ control alone already delivers
the overview+read value** and can ship first if we want the safe half.

Designer recommendation relayed to the user via the orchestrator gate:
ship **A as the always-on base** (replaces today's page-lurch outright) and
layer **C's zoom control** on top; treat C's pinch gesture as a fast-follow if
build cost is a concern. Awaiting user selection before design-spec closeout.

## 2026-07-05 — Phone wide-view design pick (user, at design review): A + zoom control + pinch NOW

**Decision:** Build the FULL package in one pass — Option **A** (contained wide
frame: table scrolls inside a fixed framed panel, name column frozen, soft
edge-fades, app chrome never moves — the always-on replacement for today's
page-lurch wideMode on phones) PLUS Option **C**'s −/Fit/+ zoom control AND the
custom pinch-to-zoom gesture (not deferred). Applies at the PHONE tier (≤640)
to every wideMode table: BreedingCodeTable, LifeListTable (List Comparer),
SpeciesDetail. Desktop-width wideMode behavior is UNCHANGED (low risk, no
desktop regression). Ship as a reusable zoomable-wide-surface wrapper so the
three tables stay consistent.

**iOS-WKWebView constraint (load-bearing):** no per-element native pinch —
native pinch zooms the whole visual viewport (the very lurch we're removing).
The per-surface pinch must be a JS two-pointer handler applying `transform:
scale` to the surface with `touch-action: none` (clamp ~0.4–2.5), following the
existing `CenterPinDropper` long-press/gesture pattern. The −/Fit/+ buttons are
the keyboard/AA-reachable, desktop-usable equivalent.

Bundled with the calendar-phone-dates fix into **0.5.64** (phone-tier; ships to
desktop/web too — only ≤640 rendering changes — and rides into TestFlight
build 2; changelog describes the phone fixes, NO mobile-app mention).

## 2026-07-05 — 0.5.64 implemented (Engineer): both phone-tier fixes, gates green

Both fixes shipped as **0.5.64** (frontend/package.json + tauri.conf.json both
bumped; changelog + README + docs/HELP + website version pill updated, all
mobile-silent per the phased-announcement decision). Implementation decisions:

**FIX 1 — Calendar phone dates (CSS-gated, desktop byte-unchanged).** The big
`DayCellButton` cells now render the day-of-month `DayCorner` for data/zero/nodata
days, marked with a **phone-only `.sr-cal-bigday` class** — base rule
`display:none` (so DESKTOP big grids stay dateless, the v0.5.63 decision intact),
revealed by `.sr-cal-bigday{display:inline}` in the ≤640 media block, where the
`.sr-cal-daynum` size also bumps to 0.6875rem. No render branch on `isPhone` for
the date itself — it's pure CSS, so desktop-width DOM carries the (hidden) corner
and the phone reveals it. `Calendar.test.tsx` updated: the three v0.5.63
"count-only" tests now assert the corner is present-but-`.sr-cal-bigday`-gated at
desktop width, plus a new matchMedia-≤640 phone-render test proving the big cells
carry the date and no thumbnails mount. `calendarContrast`/`calendarTextures`
untouched.

**FIX 2 — ZoomableWideSurface (new shared wrapper).**
- **Phone wideMode-toggle UX decision:** on the phone tier the "↔ Unbounded/Normal"
  toggle is **hidden** (`!isPhone &&` guard in BreedingCodeList + LifeList) and the
  table ALWAYS mounts inside `ZoomableWideSurface` (`active={isPhone}`); the surface's
  −/Fit/+ zoom control is the phone equivalent (Fit = whole-table overview, +/− =
  read). No dead/no-op control on a phone. Desktop-width keeps the exact toggle +
  wideMode behavior (the surface is a transparent `<>{children}</>` passthrough when
  inactive). Session-only `useState` for wideMode (desktop-only concern now).
- **Table render axes:** rather than a 4th branch tangle, the two real tables gained a
  `frozenNoScroll` prop and single-sourced booleans — `freeze` (sticky name column),
  `maxWidth` (width:max-content), `innerScroll` (owns overflow-x). Phone passes
  `wideMode=false frozenNoScroll` → frozen name column, natural width, NO inner scroll
  (the surface owns the one scroll viewport, so no nested scroll). Desktop paths
  (`wideMode` true/false) compute IDENTICAL axes to before — verified by new
  render-axes tests in both table test files.
- **Pinch anchor approach:** the two-pointer JS handler (pointer events, Map-tracked,
  CenterPinDropper discipline — cancel cleanly, `preventDefault` only once two pointers
  are down so one-finger scroll is untouched, `touch-action:none` on the viewport so
  the gesture owns the touch) applies `transform:scale` about the **top-left origin**
  (`transform-origin: top left`), NOT the pinch midpoint. Rationale: midpoint-anchored
  scale needs a coupled scrollLeft/Top compensation each frame to keep the focus point
  under the fingers; with a top-left origin the surface just scales and the existing
  scroll handles panning — simpler, and no janky scroll-fighting. Acceptable because
  Fit + drag-to-pan already give "see it all / move to the cell." Flagged for on-device
  feel-check.
- **WKWebView caveats to verify on-device (I could not test real multi-touch/layout in
  jsdom):** (1) `position:sticky` frozen name column lives INSIDE the `transform:scale`
  host — per CSS spec sticky sticks to the nearest scroll ancestor (the surface
  viewport) and the transform only establishes a containing block for fixed, not
  sticky's scroll-container — the mockup demonstrates it, but WebKit's sticky-under-
  transform has historically been finicky, so the user should confirm the name column
  actually freezes while scrolling on-device. (2) The custom pinch replaces WKWebView's
  native visual-viewport pinch (which is the page-lurch); confirm one-finger scroll and
  two-finger pinch don't fight. (3) `ResizeObserver` is feature-guarded (absent in
  jsdom) so the surface degrades to Fit-on-activation + manual zoom if unavailable.
- Pure math extracted to `lib/zoomableSurface.ts` (clamp 0.4–2.5, geometric 1.25× step,
  Fit factor capped at 1, reserved height, edge-fade visibility with 1px slop) and
  unit-tested; the component test asserts passthrough-vs-active, the AA-reachable real-
  button zoom control, and that the pinch/scroll handlers wire without throwing.

**Gates (all green on Hephaestus):** vitest 121 files / **1496** tests (was 119/1468 —
+2 new test files, `zoomableSurface.test.ts` + `ZoomableWideSurface.test.tsx`, plus
added Calendar/table cases); `typecheck` (tsc -b) clean; `lint` exit 0 (the strict
react-hooks `set-state-in-effect`/`immutability`/`refs` rules needed care — the pinch
reads current scale via a functional `setScale(s=>{start=s;return s})` no-op instead of
a render-written ref; content-resize re-measures via a `contentRev` counter instead of
a ref the observer mutates); `build` exit 0 (entryChunk.test still green — the new
wrapper pulls in NO maplibre, stays off the entry chunk); `cargo check` exit 0.

**Sim rebuild + relaunch (proven three-piece recipe):** `/tmp/xcshim` xcodebuild+xcrun
shims recreated + parent `DEVELOPER_DIR`/`LANG` exports + `PATH=/tmp/xcshim:$PATH npx
tauri ios build --debug --target aarch64-sim --no-sign` → `SnowRaven.app` at
gen/apple/build/arm64-sim, CFBundleShortVersionString **0.5.64**, id
**com.dtgibson.snowraven**. Reinstalled + relaunched on both booted sims (iPhone
128090F3… PID 79156, iPad 9C2835F3… PID 79173), both alive in launchctl; the physical
device was untouched. A stale `com.snowraven` (old desktop id) process on the iPhone sim
from an earlier build was terminated. **On-device visual/gesture verification is the
user's to do** (jsdom can't exercise pinch/scroll/sticky-under-transform).

## 2026-07-05 — ZoomableWideSurface SLIVER BUG found on-device + fixed (still 0.5.64)

On-device testing (round after the first 0.5.64 sim build) found the surface **collapsed
to a thin horizontal line** — the wide table was invisible on Breeding Codes AND the List
Comparer (its tab is labeled "Multimedia" in this build's tabLayout). Both mount the
surface.

**Root cause (self-referential measurement).** `measure()` read
`scaleHostRef.current.offsetHeight`, but the SAME host element had its `height` SET to
`hostHeight = reservedHeight(naturalHeight, scale) = ceil(naturalHeight × scale)`. After
the first commit, the next measure read the already-*scaled* (smaller) height as if it
were natural, and each layout pass (scale changes on Fit) multiplied by scale AGAIN →
the reserved height shrank geometrically toward 0 → sliver. Setting a `height` on the
element that also carries `transform:scale` and IS the measured element was the mistake.

**Fix — the standard "scale container" pattern (the measured element's size is NEVER
set):**
```
viewport (overflow:auto; the framed panel)
  spacer  (position:relative; width/height = reservedWidth/Height = natural × scale)   // scroll area = SCALED size
    host  (position:absolute; top:0; left:0; width:max-content; transform:scale(s);
           transform-origin:top left)   // NO height/width reservation set — EVER
      {children}   // natural W×H
```
- The SPACER (new relative wrapper) carries the reserved size and DEFINES the scroll area
  at the scaled size; the host is `position:absolute` over it, so the host's box no longer
  drives overflow.
- `measure()` now reads the host's `offsetWidth`/`offsetHeight` while the host has NO
  height/width reservation — with `position:absolute` + transform and no size set, these
  are the stable **pre-transform natural** dims (CSS transforms don't affect offset*),
  never self-referential.
- BOTH dims are reserved on the spacer: `reservedWidth = ceil(naturalW × scale)` (a NEW
  pure fn mirroring `reservedHeight`) + `reservedHeight`. Reserving width (instead of
  letting it ride `max-content`) makes the horizontal scroll area match the scaled content
  exactly — at scale<1 a max-content spacer was too wide (dead scroll space).
- Everything else kept: framed viewport, edge-fades, −/Fit/+ zoom, two-pointer pinch,
  Fit-on-activation, inactive passthrough, purity discipline, `transform-origin:top left`.
- `spacerSize` (`{w,h}|null`) replaced the old `hostHeight` state. The measured host and
  spacer carry `data-sr-zoom-host`/`data-sr-zoom-spacer` attributes for the regression test.

**Regression guard (so it can't silently recur):**
- Pure: `reservedWidth` unit tests (mirror `reservedHeight`); a "reserved dims are PURE of
  natural×scale" block that (a) proves repeated computation from a STABLE natural dim never
  drifts/shrinks and (b) explicitly demonstrates the anti-pattern — feeding a reserved
  height back in as "natural" collapses geometrically — to document what NOT to do.
- Component/DOM (jsdom): stub the host's `offsetWidth/Height` to STABLE 900×600 (+ viewport
  `clientWidth` 400) via prototype getters keyed on the data attributes, then drive
  activation → Fit → zoom-in → zoom-out and assert the SPACER's reserved w/h are exactly
  `ceil(natural × scale)` each pass, GROW on zoom-in, return to the Fit value on zoom-out,
  and NEVER shrink; and assert the measured host's `style.height` stays `''` (unset) across
  every pass — the invariant that kills the bug.

**Gates (all green on Hephaestus, re-run):** vitest **121 files / 1502 tests** (was 1496;
+6 sliver-guard cases); `typecheck` clean; `lint` exit 0; `build` exit 0 (still off the
maplibre entry chunk); `cargo check` exit 0. `calendarContrast`/`calendarTextures`
byte-untouched.

**Sim rebuild + relaunch (same recipe; STAYS 0.5.64):** rebuilt `SnowRaven.app`
(CFBundleShortVersionString 0.5.64, id com.dtgibson.snowraven); the sim now holds the
user's REAL data, so I reinstalled OVER the same bundle id (`simctl install`, NO uninstall
— the data container is preserved) and relaunched on both booted sims (iPhone 128090F3…
PID 90799, iPad 9C2835F3… PID 90813), both alive in launchctl; physical device untouched.
**On-device visual confirmation that the table now renders (and the frozen column /
pinch / Fit feel right) remains the user's to do** — jsdom can't exercise real layout.

## 2026-07-05 — Two ZoomableWideSurface interaction bugs fixed on-device (still 0.5.64)

Collapse fix verified on the iPhone sim with real data — the wide table RENDERS (framed,
frozen Species column, code dots). Two interaction bugs remained, both confirmed by
driving the simulator:

**1. One-finger scroll was dead on the surface.** The viewport had
`touch-action: none` (to let the custom JS pinch own the gesture), but `none` disables ALL
native touch scrolling on the element regardless of `preventDefault` — so a one-finger drag
over the table scrolled nothing (not the table horizontally, not the page vertically). The
earlier "never preventDefault before two pointers so one-finger scroll still works"
reasoning was WRONG: the CSS `touch-action` value, not `preventDefault`, is what killed the
native scroll. **Fix:** `touch-action: pan-x pan-y` (NOT `none`). That re-enables native
one-finger scroll in both axes AND, by OMITTING `pinch-zoom` from the value, still suppresses
native page pinch-zoom (the "lurch") — so our custom two-pointer JS pinch remains the only
zoom path. **Keeping the custom pinch alive alongside pan-x pan-y:** under pan-x pan-y a
native TWO-finger pan can still fire, so while two pointers are down the pointermove handler
`preventDefault()`s to suppress it — which only bites if the listener is registered
**non-passive**, so the pointermove `addEventListener` now passes `{ passive: false }` (and
the handler guards `e.cancelable`). One finger never preventDefaults, so its native scroll is
untouched.

**2. The −/Fit/+ zoom control was unreachable on a long table.** The framed viewport grew to
the full content height (98 species), pushing the absolute bottom-right zoom control past
every row, and the frame wasn't a contained window vertically. **Fix:** bound the viewport
`max-height` to `min(70dvh, ${reservedHeight + 2}px)` when active (bare `70dvh` before the
first measurement). `min()` shrinks the frame to fit when the scaled content is short (the
reserved height wins) and caps at 70dvh with internal scroll when tall (70dvh wins) — the
`+2px` clears the 1px top+bottom border so a short table isn't clipped. The viewport already
had `overflow: auto`, so a bounded height makes it scroll internally on both axes; the spacer
still defines the scroll area (collapse fix intact), and the zoom control — absolute at the
wrapper bottom-right — is now always visible. Edge-fades still read horizontal scroll
position, unaffected by the height bound.

Everything else from the collapse fix is unchanged (spacer/absolute measurement,
reservedWidth/Height, Fit-on-activation, edge-fades) and the calendar dates fix untouched.

**Tests extended:** assert the viewport carries `touch-action: pan-x pan-y` (not `none`, no
`pinch-zoom`); assert the max-height cap — bare `70dvh` with no measurable content, and
`min(70dvh, ${reservedHeight+2}px)` from the STABLE stubbed 900×600 natural dims.

**Gates (all green on Hephaestus):** vitest **121 files / 1505 tests** (was 1502; +3 new);
`typecheck` clean; `lint` exit 0; `build` exit 0; `cargo check` exit 0.
`calendarContrast`/`calendarTextures` byte-untouched.

**Sim rebuild + relaunch (same recipe; STAYS 0.5.64):** rebuilt `SnowRaven.app` (0.5.64,
com.dtgibson.snowraven); reinstalled OVER the same bundle id (`simctl install`, NO uninstall
— user data preserved) and relaunched on both booted sims (iPhone 128090F3… PID 93312, iPad
9C2835F3… PID 93334), both alive in launchctl; physical device untouched. **On-device
confirmation that one-finger scroll now works, two-finger pinch still zooms, native page
pinch-zoom does NOT fire, and the zoom control is always reachable remains the user's to
verify** (jsdom can't exercise real touch/scroll/pinch).

## 2026-07-05 — Frozen name column fixed by switching to CSS `zoom` (still 0.5.64)

On-device: collapse, one-finger scroll, and the reachable −/Fit/+ control all CONFIRMED
working. Last rough edge: the frozen Species/name column did NOT stay pinned when zoomed
in and scrolled horizontally (confirmed on the sim — pan right at 63% and the name column
scrolls away). Root cause: `position: sticky` doesn't work relative to the scroll container
when it lives inside a `transform: scale()` subtree — the transform establishes a
containing block that breaks sticky (WebKit + spec).

**Approach chosen: #1 — replace `transform: scale(s)` with the CSS `zoom` property.** Why:
`zoom` scales AND **reflows** layout, which fixes BOTH prior problems at once and is a real
simplification:
- **Frozen column holds.** `zoom` does NOT establish a containing block that breaks
  `position: sticky`, so the child table's own `position:sticky; left:0` name column keeps
  pinning to the scroll container (the viewport) at any zoom. (No table change — the
  `frozenNoScroll` sticky column just works now that the ancestor is `zoom`, not
  `transform`.)
- **Collapse machinery DELETED.** Because `zoom` reflows, the viewport's native
  `scrollWidth`/`scrollHeight` already equal the scaled size — the "transform doesn't change
  layout" problem (which forced the spacer + `reservedWidth`/`reservedHeight` +
  absolute-host + `spacerSize`/`contentRev` self-referential-measurement model) is gone. All
  of that is removed. The component's state is now just `scale` + `fades`; the DOM is
  `viewport > zoomHost(zoom:s, width:max-content) > {children}`. `reservedWidth`/
  `reservedHeight` are deleted from `lib/zoomableSurface.ts`.
- **Fit against the natural (unzoomed) width.** With `zoom` reflowing, the un-zoomed
  viewport's `scrollWidth` reports the ZOOMED content width, so natural width is recovered as
  `viewport.scrollWidth / currentZoom` (new pure `naturalWidthFromScroll`). This is what
  keeps Fit from ratcheting: re-running Fit at the current zoom yields the identical factor
  (proven by a pure "Fit does NOT ratchet under zoom" test — the anti-collapse guarantee's
  successor). `avail` is the (un-zoomed) viewport `clientWidth`.
- **Height bound is now pure CSS.** No measured reserved height — a plain
  `max-height: 70dvh` on the viewport gives shrink-to-fit-when-short / cap-and-scroll-when-
  tall, because `zoom` makes the host genuinely occupy its zoomed height. The absolute
  −/Fit/+ control stays reachable.
- **Kept:** framed viewport, edge-fades, −/Fit/+ zoom, the two-pointer JS pinch (now just
  sets the `zoom` value), Fit-on-activation, inactive passthrough, `touch-action: pan-x
  pan-y` + non-passive pointermove (one-finger scroll + custom pinch, no native page pinch),
  purity discipline, calendar dates fix.

**Web-build degradation path (0.5.64 ships to web too).** `zoom` is Safari/WKWebView +
Chromium always, Firefox ≥ 126. New pure `supportsCssZoom()` (`CSS.supports('zoom','1.5')`,
guarded for no-DOM → false) gates the mechanism, detected once at module load and threaded
through a `zoomSupported` prop (also lets the jsdom tests exercise both branches — jsdom's
`CSS.supports` lacks `zoom`, so it returns false). Where UNsupported the surface degrades to
a **plain contained scroll frame at zoom 1 with NO zoom control and NO pinch** — the sticky
column and native scroll still work at 100%, so the table is never broken on an old browser;
only the zoom affordance is absent. (Locked by a degrade-path component test + a
"jsdom itself takes the degrade path" test.)

**Tests reworked** (`lib` + component): dropped the `reservedWidth`/`reservedHeight`/spacer-
sizing tests; added `naturalWidthFromScroll` (recover natural = scrollWidth/zoom), a "Fit
does NOT ratchet under zoom" idempotence guard, `supportsCssZoom` (false in jsdom, true when
`CSS.supports` affirms), and component tests asserting the host carries `zoom` (NOT
`transform`), the pan-x pan-y + 70dvh frame contract, and the full degrade branch.

**Gates (all green on Hephaestus):** vitest **121 files / 1505 tests** (net same count —
removed spacer tests, added zoom/degrade tests); `typecheck` clean; `lint` exit 0; `build`
exit 0 (still off the maplibre entry chunk); `cargo check` exit 0.
`calendarContrast`/`calendarTextures` byte-untouched.

**Sim rebuild + relaunch (same recipe; STAYS 0.5.64):** rebuilt `SnowRaven.app` (0.5.64,
com.dtgibson.snowraven); reinstalled OVER the same bundle id (`simctl install`, NO uninstall
— user data preserved) and relaunched on both booted sims (iPhone 128090F3… PID 3518, iPad
9C2835F3… PID 3537), both alive in launchctl; physical device untouched. **On-device
confirmation that the frozen Species column now STAYS pinned when zoomed in + scrolled
horizontally (and that Fit/pinch/one-finger-scroll still behave) remains the user's to
verify** — jsdom can't exercise CSS `zoom` or sticky-during-scroll; the empirical WKWebView
question ("does `zoom` hold sticky?") is answered on the device, not here.

## 2026-07-05 — REVERSE the phone freeze: name column unfrozen (user feedback, still 0.5.64)

The CSS-`zoom` fix worked — the frozen Species column DID stay pinned. But on a narrow phone
the pinned column HOGGED the width and the user "can't see any code because the species stays
in place." User instruction: **let the Species column move over so the code dots are visible.**

**Change: DISABLE the sticky first column on the phone tier** — inside the ZoomableWideSurface
the whole table (name + code columns) now scrolls horizontally as ONE unit, so scrolling right
slides the Species column aside and brings the code columns/dots into view. The surface still
provides the framed contained scroll + −/Fit/+ + pinch + CSS zoom; Fit still shows the whole
matrix at once. Implementation:
- Renamed the tables' `frozenNoScroll` prop → **`phoneSurface`** (the name "frozen" was now
  wrong). In BreedingCodeTable the `freeze` axis changed from `!wideMode || frozenNoScroll` to
  **`!wideMode && !phoneSurface`**, so: default contained DESKTOP form still freezes (true),
  desktop wideMode still doesn't (false), and the PHONE surface no longer freezes (false — the
  reversal). `maxWidth`/`innerScroll` are unchanged (still max-content, still no inner scroll —
  the surface owns scroll). LifeListTable never had a frozen first column, so its rename is
  pure relabelling (max-content/no-inner-scroll/sticky-header axes unchanged). The SpeciesDetail
  co-occurrence table already had no sticky column (flex-div rows), so it was already correct.
- The sticky HEADER ROW (`thBase` position:sticky top:0, vertical) is untouched — only the
  first-COLUMN horizontal freeze was removed. Desktop-width behavior is entirely unchanged.

**Did horizontal scroll need a separate fix? No.** Investigated the coordinator's "couldn't
scroll to the code columns" report: structurally scroll was already correct and NOT broken by
the sticky column — a `position:sticky; left:0` element does not block its scroll container's
horizontal scroll; the container still scrolls and the sticky element just re-pins each frame.
The viewport is `overflow:auto` + `touch-action: pan-x pan-y`, and the zoomHost is
`width:max-content`, so at zoom > Fit the content is wider than the viewport →
`scrollWidth > clientWidth` → one-finger horizontal drag scrolls it. At Fit (zoom ≤ 1 to show
everything) the whole matrix fits so there's nothing to scroll — correct. The user's real
problem was the pinned column eating ~40vw of readable width, which the unfreeze fixes; the
"couldn't scroll" observation was a sim mouse-drag-registered-as-tap artifact, not a code bug.
No separate scroll fix was warranted.

**Tests updated:** the phone-surface render-axes tests now assert the name column is NOT sticky
(`rowHeader.style.position !== 'sticky'`) while keeping width:max-content + no inner overflow-x
(BreedingCodeTable.test); the LifeListTable phone test renamed to `phoneSurface`; all
`frozenNoScroll` references removed repo-wide.

**Gates (all green on Hephaestus):** vitest **121 files / 1505 tests**; `typecheck` clean;
`lint` exit 0; `build` exit 0; `cargo check` exit 0. `calendarContrast`/`calendarTextures`
byte-untouched.

**Sim rebuild + relaunch (same recipe; STAYS 0.5.64):** rebuilt `SnowRaven.app` (0.5.64,
com.dtgibson.snowraven); reinstalled OVER the same bundle id (`simctl install`, NO uninstall —
user data preserved) and relaunched on both booted sims (iPhone 128090F3… PID 7584, iPad
9C2835F3… PID 7617), both alive in launchctl; physical device untouched. **On-device
confirmation that one-finger horizontal drag now scrolls the table sideways and the code-column
headers + dots come into view (Species slides aside), while Fit still shows the whole matrix,
remains the user's to verify** — jsdom can't exercise real touch scroll.

## 2026-07-05 — THE code-dots bug: Fit was clamped to the 0.4 floor (fixed, still 0.5.64)

On-device: on the Breeding Codes matrix (98 species × ~16 code columns) the zoom control sat at
**40% on "Fit", and 0.40 is exactly the manual clamp floor**. Fit was trying to shrink below 0.4
to fit the whole ~1600px matrix into the ~270px frame (true fit ≈ 0.17) but was being CLAMPED UP
to 0.4 — at 0.4 only the Species column filled the frame and ALL code columns were pushed
off-screen. So the overview never showed the codes. THIS was "can't see any code," not the freeze
(which was a real but secondary issue) and not the horizontal scroll (which was fine).

**Fix — two distinct lower bounds so Fit can go below the manual floor:**
- `MIN_SCALE` (0.4) stays the **manual** zoom-out floor (the − button / pinch normally stop here).
- New `MIN_FIT_SCALE` (0.1) is the **absolute hard floor** — the lowest zoom the surface ever
  applies, and the bound `fitFactor` now clamps against (was `MIN_SCALE`). So Fit reaches the true
  fit for a wide matrix (down to 0.1) and shows the WHOLE matrix — Species + every code column +
  the dots — at once (small, as an overview should be).
- New `effectiveMinScale(fit) = min(MIN_SCALE, max(MIN_FIT_SCALE, fit))` is the − button / pinch
  floor: normally 0.4, but LOWERED to the current Fit when Fit is below 0.4, so the user can zoom
  back out BY HAND to the whole-matrix overview instead of bottoming out at 0.4. `clampScale` and
  `stepScale` gained an optional `minScale` param; the component tracks the current Fit in a
  `fitScale` state (updated on activation / Fit / content-resize; it can legitimately be < 0.4),
  derives the effective floor from it for the − button's disabled state + step and for the pinch's
  clamp (captured at gesture start). `+` still stops at MAX_SCALE (2.5).

**Did the natural-width measurement also need correcting? No — checked.** `measure()` recovers
natural width from `viewport.scrollWidth / currentZoom` (naturalWidthFromScroll), and
`viewport.scrollWidth` is the FULL scrollable content extent = the entire unfrozen table (Species
+ all code columns) at `width:max-content`. It was already measuring the full width; the sole bug
was the clamp floor. (Confirmed by a component test that stubs a 1600px-natural / 270px-viewport
and asserts Fit lands at ≈0.17, plus a lib test that fitFactor(1600, 270) ≈ 0.169 < 0.4.)

**Tests updated:** the old "fitFactor clamps to MIN (0.4)" assertion is replaced by "fitFactor
FITS a matrix much wider than the viewport (1600→270 ≈ 0.17, below 0.4, reached not clamped)" and
"clamps only at MIN_FIT_SCALE for a pathological width"; added `effectiveMinScale` tests, a
`stepScale` test proving − can descend below 0.4 to reach Fit, and component tests asserting Fit
snaps to ≈0.17 for a wide matrix and that at Fit − is disabled (lowered floor) while + is enabled.

**Gates (all green on Hephaestus):** vitest **121 files / 1514 tests** (was 1505; +9 clamp/Fit/
effective-floor/wide-matrix cases); `typecheck` clean; `lint` exit 0; `build` exit 0; `cargo
check` exit 0. `calendarContrast`/`calendarTextures` byte-untouched. Kept everything else
(CSS-zoom, −/Fit/+ + pinch, one-finger scroll, unfrozen column, bounded 70dvh frame, edge-fades,
calendar dates, web degrade).

**Sim rebuild + relaunch (same recipe; STAYS 0.5.64):** rebuilt `SnowRaven.app` (0.5.64,
com.dtgibson.snowraven); reinstalled OVER the same bundle id (`simctl install`, NO uninstall —
user data preserved) and relaunched on both booted sims (iPhone 128090F3… PID 10107, iPad
9C2835F3… PID 10121), both alive in launchctl; physical device untouched. **On-device
confirmation that Fit now shows the ENTIRE Breeding Codes matrix — Species + every code column +
the dots — at once (small), and that the − button can reach that whole-matrix overview, remains
the user's to verify** — jsdom can't measure real layout width.

## 2026-07-05 — Wide-table phone zoom: ATTEMPTED then REVERTED (user preference)

After the on-device TestFlight feedback, we tried to make the wide tables
(Breeding Codes, List Comparer) "beautiful" on a phone with a zoomable
contained surface (ZoomableWideSurface: contained frame + −/Fit/+ + custom
pinch). It went through many rounds — collapse fix (spacer→CSS-zoom), dead
one-finger scroll (touch-action), unreachable zoom control (bounded 70dvh),
unfreeze the name column, and lifting the Fit clamp floor — but CSS `zoom`
would not reliably scale the content in the iOS WKWebView (the zoom % updated
but the matrix didn't visibly shrink, so the code columns stayed off-screen /
unreadable). **User decision: revert entirely** — restore the original
"↔ Unbounded / Normal" wideMode toggle on Breeding Codes and List Comparer
(and SpeciesDetail), which the user found preferable to the unreadable zoom
version. The zoom surface (ZoomableWideSurface.tsx, lib/zoomableSurface.ts,
their tests, the wide-table-design.html mockup) is deleted; the tables match
HEAD (the mobile-app commit) exactly. **KEPT:** the calendar phone-dates fix
(day-of-month restored on the phone month grid) — the run's one surviving
0.5.64 change. Lesson: CSS `zoom` is not a dependable scaling primitive in
WKWebView; a wide-table "see it all" zoom on phone needs a different technique
(deferred; not attempted again this run). 0.5.64 now = calendar phone-dates
fix only.

**Revert executed + verified.** `git checkout HEAD --` restored BreedingCodeList,
LifeList, BreedingCodeTable, LifeListTable, SpeciesDetail and the two table test
files to HEAD (20f8e37); the four zoom files + the wide-table-design.html mockup
were deleted; globals.css had ONLY the `.sr-zoom-viewport` hunk removed (the
`.sr-cal-bigday` + `.sr-cal-daynum` phone-date CSS kept). Grep confirms zero
remaining refs to ZoomableWideSurface / zoomableSurface / frozenNoScroll /
phoneSurface in frontend/src. CHANGELOG 0.5.64 now lists ONLY the calendar
phone-dates fix (the wide-table "Changed" bullet removed); README + docs/HELP
reverted the Unbounded/zoom wording to HEAD while keeping the calendar-dates
wording; README/HELP/website stay mobile-silent; version stays 0.5.64 (package.json
+ tauri.conf.json + website pills). Gates all green on Hephaestus: vitest 119 files
/ 1469 tests, typecheck clean, lint exit 0, build exit 0, cargo check exit 0;
calendarContrast/calendarTextures byte-untouched. Sim rebuilt (three-piece recipe,
stays 0.5.64) and reinstalled OVER the same bundle id (data preserved) — iPhone
128090F3… PID 43627, iPad 9C2835F3… PID 43653, both alive in launchctl; physical
device untouched.
