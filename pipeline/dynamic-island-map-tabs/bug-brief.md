# Bug Brief — Dynamic Island blocks the map sub-tabs in fullscreen

## What is broken
On the iOS app, entering fullscreen map mode pins the Map Explorer panel to the physical top of the screen with no top safe-area inset, so the four map view-mode pills (My Sightings / Hotspots / Nearby Lifers / Media Targets) render underneath the status bar and Dynamic Island. In the screenshot the clock, silent-mode bell, and battery sit directly on the "My Sightings" pill, making it unreadable.
Root cause is one inline style: `frontend/src/App.tsx:1266` applies `{ position: 'fixed', inset: 0, height: '100dvh', zIndex: 1200, background: 'var(--sr-bg)' }` when `mapFullscreen` is true. `position: fixed` is viewport-relative, so it escapes `.sr-ios-app body { padding-top: env(safe-area-inset-top, 0px) }` (`frontend/src/globals.css:649-653`) — the rule that protects every other in-flow surface — and nothing re-applies the inset.
The first child of that panel is the pill row, `frontend/src/components/MapExplorer.tsx:2055` (`<div role="group" aria-label="Map view mode">`, inline `padding: '10px 16px'`), so the pills land ~10px from the physical top, squarely inside the ~59px Dynamic Island band.

## Steps to reproduce
1. Run the SnowRaven iOS app (TestFlight or simulator) on a Dynamic Island device, iPhone 14 Pro class or newer.
2. Open the Map Explorer tab.
3. Tap the fullscreen toggle, the circular diagonal-arrows button in the bottom-right FAB cluster.
4. Look at the top of the screen: the pill row is flush with the physical top edge and the status bar paints over "My Sightings" / "Hotspots".
5. Tap the fullscreen toggle again to exit; the pills sit correctly below the status bar, confirming the defect is specific to the fullscreen branch.

## Expected behavior
The pill row starts below the status bar and Dynamic Island, fully readable and tappable, the same as it is outside fullscreen. Exiting fullscreen is unchanged.
This is genuinely broken, not intended: the non-fullscreen path already budgets the inset (`.sr-map-explorer-panel.sr-map-panel-ios { height: calc(100dvh - 112px - env(safe-area-inset-top, 0px)) }`, `globals.css:963-966`), and `globals.css:1766-1772` already documents that "the fullscreen panel is position:fixed inset:0 (bypasses the body's safe-area padding)" — a QA round-1 finding that was patched for the sidebar's left inset only. The panel's own top edge was never covered, so this is a known-mechanism gap.
Desktop and web must render byte-identically after the fix.

## Blast radius
- **Fix shape is constrained.** The fullscreen positioning is an inline style (specificity 1,0,0), so a class rule cannot override `top` from `inset: 0` — the positioning has to be lifted into a `globals.css` class per the repo's standing convention. Tailwind v4 preflight sets `box-sizing: border-box` globally, so `height: 100dvh` plus a top pad keeps total height at 100dvh.
- **Must be `.sr-ios-app`-gated** (or ride `isIOS()` / `compactChrome()`), never a bare `env()`. The web build also ships `viewport-fit=cover`, so `env()` is non-zero in iOS Safari on the web build — the documented QA round-1 finding at `globals.css:643-648`. On desktop `env()` is 0 either way, so the desktop overlay is untouched.
- **Bottom edge is already correct, leave it alone.** `.sr-ios-app .sr-map-fab-cluster` (`globals.css:1098-1101`) already adds `env(safe-area-inset-bottom)` and `env(safe-area-inset-right)`, and its comment names the fullscreen overlay explicitly. The Filters button and the two circular tools clear the home indicator in the screenshot.
- **Landscape left/right is the same root cause.** The sidebar overlay is patched (`globals.css:1760-1772`) but the pill row is not, so in landscape the leftmost pill can run under the sensor housing. A panel-level inset covers both axes at once; verify landscape as part of this fix.
- **Sibling defect, out of scope:** `frontend/src/components/HelpDocs.tsx:322` is also `position: fixed; inset: 0` with a 52px header row and shares the mechanism. `WelcomeScreen.tsx:56`, `Calendar.tsx:585`, and `RootErrorBoundary.tsx:19` all center their content vertically, so they are low risk. Flag HelpDocs, do not fix it here.

## What done looks like
On a Dynamic Island iPhone in fullscreen map mode, all four pills sit fully clear of the status bar and are readable and tappable, and landscape clears the sensor housing on both sides.
The FAB cluster, the sidebar overlay, and non-fullscreen map layout are visually unchanged, and desktop plus web fullscreen render byte-identically.
The layout holds at 200% in-app text scale with no clipping, sized in rem (the inset itself stays an `env()` calc).
Guarded by a test: `frontend/src/lib/iosChrome.test.ts` and `frontend/src/lib/mapIosFullscreen.test.ts` already parse `globals.css` and `App.tsx` for exactly this class of rule — extend one of them rather than adding a parallel file.
