# Change Brief — Map iOS Fullscreen Tier Single Source

## What is changing
Hoist `isIOS() && !!isFullscreen` into one render-safe `iosFullscreen` value in `MapExplorer`. Use that value both to add `sr-map-ios-fullscreen` through `mapContentClass` and to decide whether the sidebar is an overlay. Repoint `mapIosFullscreen.test.ts` from the call's literal spelling to the definition and both consumers.

## Why now
The current safety argument depends on two character-identical expressions remaining synchronized, while the guard freezes one call shape and actively blocks the safer consolidation. The prior focus-trap build recorded this as the remaining way layout and containment could drift.

## User-facing impact
None. iOS fullscreen, phone-tier sidebar behavior, desktop fullscreen, focus containment, and rendered classes remain unchanged.

## Design pass
Not needed — logic/test single-sourcing with no visual change.

## Decisions touched
The existing iOS fullscreen composition decision is preserved, not modified: iOS fullscreen mirrors the phone-tier sidebar at every width. Only the enforcement moves from duplicated expression spelling to one named value with two guarded consumers.

## What done looks like
Executable `MapExplorer` source contains the iOS/fullscreen conjunction exactly once. `mapContentClass` and `sidebarIsOverlay` both consume the named value, the updated guard fails if the definition or either consumer drifts, and the iOS fullscreen, sidebar trap, typecheck, lint, and production build checks pass without CSS changes.
