# Bug Brief — Dynamic Island covers the Help overlay header

## What is broken
On the iOS app, opening the in-app Help overlay pins it to the physical top of the screen with no top safe-area inset, so its 52px header row renders under the status bar and Dynamic Island. The header's left cell is the book icon plus the "SnowRaven Documentation" title (`frontend/src/components/HelpDocs.tsx:334-342`, inline `padding: '0 20px'`), so the title sits ~0px from the physical top, squarely inside the ~59px Island band.
Root cause is the same mechanism as build 1's map fix, confirmed here rather than inherited: `HelpDocs.tsx:322` applies inline `{ position: 'fixed', inset: 0, zIndex: 1200 }`. `position: fixed` is viewport-relative, so it escapes `.sr-ios-app body { padding-top: env(safe-area-inset-top, 0px) }` (`frontend/src/globals.css:665-669`) and nothing re-applies the inset.
Not a dismissal trap, confirmed: Escape calls `onClose()` at `HelpDocs.tsx:281`, and the Close button (`closeRef`, `HelpDocs.tsx:343-364`) sits at the right end of the header while the Island is centred. The defect is degraded readability of the title, not an unreachable control.
Landscape is the same root cause: at `.sr-pad-x-trim`'s 16px/12px gutters the header content can run under the sensor housing on either side.

## Steps to reproduce
1. Run the SnowRaven iOS app (TestFlight or simulator) on a Dynamic Island device, iPhone 14 Pro class or newer.
2. Tap **Help** in the app footer (or the Help entry in Settings, or the link on the Welcome screen).
3. Look at the top of the overlay: the header row is flush with the physical top edge and the clock, bell, and battery paint over the "SnowRaven Documentation" title.
4. Rotate to landscape in both directions: the book icon and title run under the sensor housing on the leading edge.
5. Close the overlay and compare any in-flow screen, which sits correctly below the status bar, confirming the defect is specific to this fixed overlay.

## Expected behavior
The header row starts below the status bar and Dynamic Island, with the icon and title fully readable, and clears the sensor housing in both landscape rotations. Desktop and web must render byte-identically after the fix.
This is broken, not intended: the same class of gap was already found and fixed on the map fullscreen panel in build 1 of this bundle (`.sr-map-fullscreen-panel`, `globals.css:1123-1154`), and that fix's PR notes flag `HelpDocs.tsx:322` explicitly as the untreated sibling.

## Blast radius
- **Fix shape is constrained, same as build 1.** The positioning is inline at specificity 1,0,0, so a stylesheet cannot reach `top` from `inset: 0`; the positioning must be lifted into a `globals.css` class first, and the iOS inset must be `.sr-ios-app`-gated, never a bare `env()` (the web build also ships `viewport-fit=cover`, the documented QA round-1 finding at `globals.css:660-664`).
- **Give it its own sibling rule, do not generalize.** The two overlays share only the three-line inset block. The map panel additionally needs `height: 100dvh` (its inner column resolves `height: 100%` against it) and carries a landscape coupling where the sidebar overlay reaches the padded edge through `.sr-map-content`; Help has no explicit height and no absolutely-positioned descendant reading the padding box. A shared inset utility would still need a per-overlay positioning class, so it buys one shared declaration block at the cost of a second class name on the element. Revisit generalizing at a third overlay, not at two.
- **`position: sticky` was checked and is clear.** The TOC nav is `position: 'sticky', top: 0` (`HelpDocs.tsx:377`), but it sticks to the scrolling ancestor (`bodyRef`, `HelpDocs.tsx:368`), not the viewport, and `globals.css:1994` forces it `position: static !important` at ≤640, so it never escapes the inset. One real secondary defect though: its `maxHeight: 'calc(100vh - 52px)'` (`HelpDocs.tsx:378`) does not subtract the top inset, so above 640px (iPad, where the inset is typically 24px) the nav over-extends past the scrollport and its last entries become unreachable. Small, same root cause, fix it here.
- **Bottom edge needs nothing; mirror the body rule's top/left/right.** There is no footer or bottom-pinned control, and the content column already carries 80px bottom padding (`HelpDocs.tsx:415`), so text clears the home indicator. On phone the TOC is static and scrolls with the content.
- **The three sibling overlays were re-checked, and build 1's low-risk judgement holds.** `WelcomeScreen.tsx:56`, `Calendar.tsx:591` (moved from 585), and `RootErrorBoundary.tsx:19` all centre their content vertically, so nothing renders at the physical top edge. None belongs in this fix. Separately noted, not this defect and not this fix: WelcomeScreen combines `justifyContent: 'center'` with `overflowY: 'auto'`, the classic flex-centred-overflow shape, which could clip its top at very large text scale.

## What done looks like
On a Dynamic Island iPhone, the Help overlay's icon and title sit fully clear of the status bar and are readable, and both landscape rotations clear the sensor housing.
The focus trap still re-queries focusables per Tab keydown (`HelpDocs.tsx:282-298`), Escape still closes, focus still restores to the opener, and `scrollToSection` still lands sections correctly (it measures against the body container's own rect, so it is inset-agnostic).
The TOC's height cap tracks the real scrollport above 640px, with its last entry reachable; on phone the TOC still stacks static above the content.
Layout holds at 320px and 200% in-app text scale with no clipping, sized in rem, with the `env()` calc as the sanctioned exception; the Close button keeps its ~44px touch target at ≤640.
Guarded by extending `frontend/src/lib/iosChrome.test.ts`, the non-surface-specific iOS chrome guard that already parses the real `globals.css` for exactly this rule class; port build 1's assertion that the ungated base rule carries no `env()`. Do not add a parallel file, and do not extend `mapIosFullscreen.test.ts` or `breedingCodePinnedCss.test.ts`, which are both surface-specific.
