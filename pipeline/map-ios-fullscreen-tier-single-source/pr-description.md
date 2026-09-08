## Map iOS Fullscreen Tier Single Source

### What this does

Defines the iOS-fullscreen map tier once in `MapExplorer` and feeds that value to both the map layout class and the sidebar overlay decision. This removes the possibility that those two consumers drift while preserving all existing iOS, phone-width, desktop, and web behavior.

### How to test

1. From `frontend`, run `npx vitest run src/lib/mapIosFullscreen.test.ts`.
2. Confirm all 24 focused tests pass, including the one-definition/two-consumer wiring guard.
3. Run the adjacent fullscreen, sidebar-trap, tab-stop, hook, safe-entry, and entry-chunk tests.
4. Run `npm run typecheck`, `npm run lint`, and `npm run build`.

### Notes for reviewer

This is intentionally a behavior-neutral consolidation. Executable `MapExplorer` source contains `isIOS() && !!isFullscreen` exactly once; `sidebarIsOverlay` and `mapContentClass` consume the resulting `iosFullscreen` value. No CSS, dependency, version, or changelog files change.
