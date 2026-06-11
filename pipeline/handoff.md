# Handoff — 0.5.30 SHIPPED & live; pipeline idle, follow-ups for the VM

## What We Accomplished

The two map fixes are built, shipped, and live as 0.5.30. The hotspot pins that
could silently vanish now register reliably, and the Pins→Heatmap toggle no longer
crashes the app. The release is done and the in-app updater has been verified, so
this fix is closed out. Released version equals what's on `main`.

## What Shipped (live) — 0.5.30

1. **Hotspot pins silently vanishing** (the reported bug). The teardrop sprites (and
   atlas hatch sprites) could fail to register because the old
   `isStyleLoaded()/once('load')` gate waited on MapLibre's once-per-lifetime `load`
   event whenever a search landed during tile churn (latent since 0.5.16). Fixed in
   `HotspotMarkers.tsx` + `AtlasLayer.tsx` with unconditional registration plus
   per-component `styleimagemissing` safety nets (owned ids only, `hasImage`-guarded,
   removed on unmount). Playwright repro proved bug and fix.
2. **Pins→Heatmap toggle crash** (found by QA; pre-existing since 0.5.18, shipped in
   0.5.29). The toggle mutated a `<Source>` id in place, which MapLibre forbids,
   crashing the app to the error boundary. Fixed by keying the two branch Sources in
   `map/SightingMarkers.tsx`; the regression test was proven to fail pre-fix.

## Release (Mac) — verified

`v0.5.30` tag → Windows CI green (run 27361180999; `windows-build` artifact
`SnowRaven_0.5.30_x64-setup.exe` present) → `./release.sh`:

- macOS universal DMG **notarized (Apple: Accepted) + stapled**; bundle-version guard
  passed at `0.5.30`.
- Windows installer signed locally with the real minisign key.
- `latest.json` carries all three platforms: `darwin-aarch64` + `darwin-x86_64` →
  the one universal `SnowRaven-updater.app.tar.gz` (same URL + same signature),
  `windows-x86_64` → `SnowRaven_0.5.30_x64-setup.exe`.
- Every updater + DMG URL verified **HEAD 200**. Release `draft=false, prerelease=false`.
- https://github.com/dtgibson/snowraven/releases/tag/v0.5.30

## Independent Mac audit (pre-ship)

Clean across the board: map-fix correctness + standing-convention review passed (the
`styleimagemissing` net is owned-ids-only / `hasImage`-guarded / unmount-removed; the
keyed Sources don't disturb the `beforeId` heatmap-under-atlas ordering; the
regression test genuinely bites pre-fix). 774 frontend green across **8/8 runs**, 110
backend green, no new tile provider so privacy is unaffected.

## Follow-ups for the VM

1. **BirdingStats idle-callback flake** (still open). `BirdingStats.test.tsx >
   "mounts the SnowMap only after the idle callback fires"` is a ~5.5% `requestIdleCallback`
   timing flake, distinct from the `cancelAnimationFrame` flake 0.5.29 fixed. It did
   NOT surface in the 0.5.30 audit's 8 runs, but it's still latent. Fix it, and narrow
   the "BirdingStats flake FIXED" wording in DECISIONS.md / CHANGELOG to the
   `cancelAnimationFrame` mechanism.
2. **Doc-rot.** `PRODUCT_CONTEXT.md`'s older Species Detail / Map Explorer entries
   still describe Leaflet-era heat internals (stale since 0.5.9).
3. **Cross-repo.** snowraven-mini's formatter lacks the 0.5.28 moon-phase emoji —
   handled in Mini's own Weft session, not here.

## Machine boundary (standing rule)

- **Ubuntu VM — all dev work** (coding, content/assets incl. website + demo
  screenshots, pushing the `vX.Y.Z` tag). Do the follow-ups here.
- **Mac — only signing and shipping** (`./release.sh` needs Xcode + Apple creds).

> The VM keeps pushing while a Mac session is open — re-pull before editing the
> pipeline files, and treat the VM's commits as authoritative on conflict.

## Roadmap — Up Next (pick a lane, build on the VM)

- Mobile app
- Accessibility / clarity / simplification
- Windows code signing (remove the SmartScreen "unknown publisher" prompt)

On the VM: `git pull` to sync this closeout, clear the follow-ups, then pick the next
lane.
