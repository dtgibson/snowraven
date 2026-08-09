## Dynamic Island blocks the map sub-tabs in fullscreen

### What this does
On the iOS app, entering fullscreen map mode pinned the Map Explorer panel to the physical top of the screen, so the four map view-mode pills (My Sightings / Hotspots / Nearby Lifers / Media Targets) rendered underneath the status bar and Dynamic Island. The panel's `position: fixed; inset: 0` was an inline style in `App.tsx`, which is viewport-relative and therefore escapes the `.sr-ios-app body` safe-area padding that protects every other surface in the app.

The positioning is now a class, `.sr-map-fullscreen-panel` in `globals.css` (values byte-identical to the old inline ones), which gives the safe-area inset somewhere to hang. An `.sr-ios-app`-gated companion rule pads the panel clear of the status bar, the Dynamic Island, and the landscape sensor housing. The sidebar overlay's own `padding-left` is removed, since the panel-level inset now covers it and keeping both would double-inset the sidebar in landscape.

### How to test
1. Build and run the iOS app on a Dynamic Island device (iPhone 14 Pro class or newer), TestFlight or the simulator.
2. Open the Map Explorer tab and tap the fullscreen toggle (the diagonal-arrows button in the bottom-right FAB cluster).
3. The pill row now starts below the status bar. All four pills are fully readable and tappable, and nothing sits under the clock, bell, or battery.
4. Rotate to landscape in both directions. The leftmost pill clears the sensor housing in either rotation, and the sidebar overlay's filter content is inset once, not twice.
5. Exit fullscreen. The non-fullscreen layout is unchanged.
6. Raise the in-app Text Size to 200% and repeat step 2. The pills wrap onto extra lines as before, with no clipping at the top.
7. On desktop or web, enter and exit fullscreen. Rendering is unchanged.

### Notes for reviewer
- **The inset is `.sr-ios-app`-gated, not a bare `env()`.** `index.html` ships `viewport-fit=cover` to browsers too, so `env(safe-area-inset-*)` is non-zero in iOS Safari on the **web** build. An ungated rule would have fixed the app and silently changed shipped web rendering on every notched phone. This repeats the QA round-1 finding already documented at `globals.css:643-648`. `.sr-ios-app` is set on `<html>` by `main.tsx` only when `isIOS()`, so desktop and web never carry the class and both stay byte-identical. The test has an explicit assertion for this.
- **Padding, not a smaller box.** Tailwind preflight sets `box-sizing: border-box` globally, so the panel still measures exactly `100dvh` and only its content box moves inward. The inner flex column's `height: 100%` resolves against the content box, so the map fills the remaining space with nothing clipped.
- **Why removing the sidebar's `padding-left` is safe, precisely.** An absolutely positioned box resolves against its containing block's **padding box**, not its content box. If the fixed panel were the sidebar overlay's containing block, its `left: 0` would land back at the physical viewport edge and this removal would have *under*-inset the sidebar in landscape. It does not, because the containing block is `.sr-map-content` (`position: relative`), an in-flow descendant that the panel's padding has already displaced inward and which carries no padding of its own — so `left: 0` lands on the padded edge. That makes `.sr-map-content`'s `position: relative` load-bearing for the landscape inset, and the test now asserts it so a future cleanup cannot silently remove it.
- **The bottom edge is untouched.** `.sr-ios-app .sr-map-fab-cluster` already handles `env(safe-area-inset-bottom)`, and the map canvas is meant to bleed to the home indicator, so no `padding-bottom` was added. This mirrors the `.sr-ios-app body` rule, which is also top/left/right only.
- **Known interaction, deliberate:** the FAB cluster is absolutely positioned inside the panel's content box, so on iOS in landscape its `right: calc(16px + env(safe-area-inset-right))` now composes with the panel's `padding-right`. That is exactly how the same cluster already behaves on every non-fullscreen iOS screen, where `.sr-ios-app body`'s `padding-right` composes with it identically, so fullscreen now matches the rest of the app rather than diverging from it. `.sr-ios-app .sr-map-fab-cluster` was not modified.
- **Sibling defect, deliberately not fixed here:** `HelpDocs.tsx:322` is also `position: fixed; inset: 0` with a 52px header row and shares this exact mechanism, so the Help overlay's header will have the same problem on a Dynamic Island phone. It is tracked separately and is out of scope for this fix.
- No version bump or changelog entry: this is one build of a bundled Spool release, and the single bump plus combined entry happen once at the end of the bundle.
