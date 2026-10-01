# Bug Brief — Settings tab hidden on iPhone (settings-tab-hidden-iphone)

## What is broken
On an iPhone the bottom bar holds four tabs plus More, and Settings is always the last row of the More sheet. Since Targets joined the roster (1.0.39, in the store from 1.0.40), the sheet has 8 rows and Settings sits below the sheet's visible area.
On every notched iPhone at the default text size it lies entirely under the home-indicator strip. The sheet does scroll, but iOS shows no scroll cue, so Settings looks gone.
It can still be reached three ways, none of them obvious: scroll the sheet, use Search in the sheet, or tap a "Go to Settings" link where one is shown.

## Steps to reproduce
1. Open SnowRaven on an iPhone 12 or later in portrait, with the default text size and a tab layout that hides no tabs (fresh install, or tabs reordered but none hidden).
2. Tap **More** in the bottom bar.
3. The sheet lists Calendar to Named Birds; Settings is below the bottom edge, under the home indicator.

## Expected behavior
Settings is visible in the More sheet as soon as it opens, at every iPhone width and at every in-app text size, with no scrolling needed. All the other rows stay reachable as they are now.

## Root cause
`.sr-nav-sheet` (`frontend/src/globals.css:7325-7336`) is capped at `max-height: min(70dvh, 460px)`. `box-sizing` is border-box, so the iOS bottom safe-area padding (`globals.css:7363`, 14px + 34px) comes out of that 460px cap, leaving about 404px for content. The sheet content needs about 471px at 1x: the handle, Search (added 1.0.20, `TabNav.tsx:873-885`), the "More" heading, 7 rows, the hairline and Settings.
Targets (`e024b31`, `lib/tabLayout.ts` `DEFAULT_TAB_ORDER`) added the 8th row (+44px) and pushed Settings from 34 of 44px clear of the home indicator to 0. Settings is always appended last (`TabNav.tsx:633-635`, `App.tsx:907-915`), so it is the row that gets cut off. Alerts (1.0.42) and Splits and lumps (1.0.41) do not touch the phone bar or the sheet.

## Evidence
Built frontend (`vite build`), headless WebKit 26 (Playwright), `.sr-ios-app` class applied, safe-area inset modeled at 34px (0 on the SE). Settings row px clear of the home-indicator strip, out of 44:
- 11 tabs (shipped): **0** at 375x812, 393x852, 402x874, 420x912, 430x932 and 440x956; 24 at 375x667 (SE); 0 at 320x568. Still 0 at 1.25x, 1.5x and 2x on every iPhone.
- Targets hidden (the 1.0.38 roster): 34 at all notched widths at 1x (visible). It was already 0 at 1.5x and 2x, so large text was a problem before 1.0.39.
Screenshots in `pipeline/settings-tab-hidden-iphone/evidence/`: `webkit-15-393x852-x1-ios.png` (cut off), `-pre-targets.png` (visible), `-x2-ios.png`, `-scrolled.png` (reachable by scrolling), `webkit-SE3-375x667-x1-ios.png`. The probe scripts are saved beside them.

## Blast radius
Every surface at phone density (640px or narrower): iPhone; iPad in Split View or Slide Over; web or Pi on phones (Settings partly clipped, 34px); a narrow desktop window. Users who hid at least one tab see 7 rows and are mostly unaffected at 1x.
This is related but older: in iPhone landscape (rail or sidebar column, `globals.css:7114`), Settings has been below the fold since 1.0.17. Pinning Settings in the column reverses a nav-rework design call (`pipeline/nav-rework/design-refinement.md:250`), so it is out of scope unless the user asks.
Tests that touch this: `components/TabNav.test.tsx` (sheet row order at 383-390, hairline before Settings at 403, "Settings is never a favourite" at 345), `lib/navCss.test.ts` (iOS sheet padding at 205-245), `lib/tabOrderCoverage.test.ts` (sheet buttons go through `Button`), and the focus-trap note in `TabNav.tsx:771-820`. `docs/HELP.md:816-818` describes Settings as "always last" and says "the rest live under More".

## What done looks like
In WebKit and Chromium, with a 34px inset and 1x, 1.25x, 1.5x and 2x text, the Settings row in a freshly opened More sheet is fully visible above the home-indicator strip at 320, 375, 393, 402, 420, 430 and 440px with all 11 tabs visible. Every other row is still reachable by scrolling, and Tab order and the focus trap are unchanged.
A guard test fails if Settings can again be pushed out of the sheet's visible area by row count or text scale.
