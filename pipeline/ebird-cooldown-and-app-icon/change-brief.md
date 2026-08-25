# Change Brief — eBird cooldown extension + new app icon

## What is changing
Two improvements in one run. (1) The v0.5.92 eBird pacing contract (150 ms
spaced request starts, one key-global Retry-After-honoring cooldown, bounded
retries) governs only the hotspot-activity pass today; it extends to the Map
Explorer's other eBird lookups — hotspot search (`/map/hotspots`), Nearby
Lifers and Media Targets (`/map/recent-obs`), the hotspot-region Set fetch
(`/map/hotspot-region`), and county Completeness (`/map/county-species`) — so
a 429 on any of them waits out the one shared cooldown instead of landing as a
failed lookup. Reuses `lib/rateLimit.ts`; the shared cooldown state is lifted
to one gate module both the activity pass and these lookups consult. (2) The
app icon is replaced with the new SR mark (finished artwork in
`~/Downloads/SnowRaven_SR_AppIcon_Formats`: .icns, .ico, SVG, full-bleed and
rounded PNGs to 2048) across every icon surface: macOS .icns, Windows .ico +
Square logos, the desktop PNG set, both committed iOS AppIcon homes
(flattened opaque), and the web favicon. Website favicon + logo.svg are a
Designer-gate confirmation.

## Why now
The cooldown gap is the top named residual from v0.5.92 (a 429 on an
ungoverned surface during an activity cooldown); the mechanics are already
pure and shared, so the extension is wiring rather than design. The icon
artwork is finished and waiting in Downloads.

## User-facing impact
A rate-limited map lookup now slows briefly and answers instead of failing.
No map surface changes visually. The app icon changes everywhere an icon
shows: macOS Dock/Finder, Windows taskbar/installer, iOS home screen, and
the browser tab.

## Design pass
Needed — the icon half. Surfaces: the app icon as rendered on macOS
(Dock/Finder), Windows (taskbar/installer), iOS (home screen; opaque
full-bleed required), and the web favicon (currently a green #2D8653 rounded
square with a white bird — the new mark shares that exact brand green). What
should feel better: the new SR mark applied per each platform's mask and
shape conventions, legible at 16–32 px. The cooldown half has no visual
change and needs no design.

## Decisions touched
- The v0.5.92 pacing-contract scope clause (CLAUDE.md "Scope today: only the
  hotspot-activity pass is governed"; the DECISIONS.md named residual) — this
  run closes it; the Chronicler updates both.
- iOS icon opacity rule (altool 90717, CLAUDE.md): honored — iOS sets built
  from the FullBleed #2D8653 sources, saved with NO alpha, committed in BOTH
  icon homes (`src-tauri/icons/ios/` and the gen/apple AppIcon.appiconset).
- One caching layer per call: the gate sits below `CACHED_GET_PATHS`, so a
  cache hit never waits, spaces, or opens a cooldown.
- Both transports must surface a 429 AS a 429 on the governed routes (the
  hotspot-activity fixture-locked pattern, extended).

## What done looks like
A forced 429 on any governed map lookup opens the one shared cooldown on both
transports and the lookup answers on retry; the v0.5.92 pacing tests stay
green and the new routes gain their own. The new icon shows in the macOS
Dock, the Windows installer and taskbar, the iOS home screen, and the browser
tab; every iOS PNG is alpha-free so the TestFlight upload passes the opacity
check. Patch version bump, changelog entry, all-platform release.
