# eBird cooldown extension + new app icon (v0.5.93)

### What this does

Two improvements in one release. (1) The v0.5.92 eBird pacing contract now
governs every eBird lookup the Map Explorer makes: a new shared key-global
gate (`lib/ebirdGate.ts`) holds the cooldown/spacing state the activity
controller previously kept in per-instance refs, and the transport chokepoint
routes `/map/hotspots`, `/map/recent-obs`, `/map/hotspot-region`, and
`/map/county-species` through it (below the short-TTL cache, so a cache hit
never waits). Both transports now surface an upstream 429 AS a 429 with the
shared detail and a re-serialized bounded Retry-After on all governed routes
(one shared helper per transport: `_raise_ebird_http_error` ↔
`throwEbirdHttpError`). A 429 on a single-shot lookup opens the same cooldown
the activity pass honors, and vice versa; single-shot lookups get the same
bounded retries (3 requests total). (2) The app icon is replaced with the new
SR mark across every surface: desktop PNGs + a macOS .icns rebuilt on the
Apple icon grid (tile at 824/1024), the provided 7-size .ico + Windows Square
logos, all 36 iOS PNGs flattened opaque (both committed homes), the dormant
Android set, the web favicon, and the website's favicon + logo (all three
SVGs built from the traced vector master on the rounded #2D8653 tile).

### How to test

1. `cd frontend && npm run dev`, open the Map Explorer → Hotspots, run a
   search; behavior is unchanged at normal volumes.
2. Rate limit path: mock a 429 (or run the vitest suites) — see
   `ebirdGate.test.ts`, the transport gate suite, the per-function
   `mapService.rateLimit.test.ts`, and the per-route backend tests.
3. Icons: `npm run desktop:build` → the .app carries the new icns; check the
   Dock size against a native app. Browser tab shows the new favicon.
4. iOS opacity: every PNG under `src-tauri/icons/ios/` and the appiconset
   reports `hasAlpha: no` via sips (the altool 90717 rule).

### Notes for reviewer

- One enforcement point per request: `/map/hotspot-activity` is deliberately
  NOT transport-gated — the activity controller enforces for it over the same
  shared state. Its pump logic is unchanged; only the three pacing refs moved
  to the shared module.
- Accepted, documented cost: a transport-cache miss that an inner cache would
  have served (backend recent-obs single-flight, desktop raw-fetch dedupe)
  still waits for its start slot — bounded at 150 ms spacing, conservative in
  the right direction during a cooldown.
- The gate state is module-scoped by design (the cooldown survives pass
  restarts and remounts); suites that exercise pacing reset it via
  `_resetEbirdGateForTests()`.
- The provided .icns was full-canvas; it was rebuilt on the Apple grid per
  the approved design decision. The provided .ico ships as-is.
- Android icons are dormant (no gen/android project) but regenerated so a
  future Android bring-up cannot ship the old mark; the adaptive background
  color moved from #fff to the brand green.

### Convention flags

- Every eBird-backed browser-reachable lookup added in the future should join
  `EBIRD_GATED_PATHS` (transport.ts) unless it owns its own enforcement over
  the shared gate state, as the activity controller does.
