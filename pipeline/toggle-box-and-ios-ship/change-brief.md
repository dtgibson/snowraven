# Change Brief — Toggle Box and iOS Ship

## What is changing
Two-part improvement. (1) The Settings "Disable embedded media" row renders its
switch inside an empty bordered button. The shared `ToggleSwitch`
(`frontend/src/components/ui/ToggleSwitch.tsx`) always draws a bordered pill
designed to carry a visible label; Settings is the app's only
`labelVisible={false}` call site, so the chrome survives as an orphan box around
a bare switch. The box goes away — the row presents just the switch, like a
standard settings row. (2) v0.5.72 shipped desktop-only; the last TestFlight
build is 0.5.71, so mobile never received the embedded-media preference. This
run ships v0.5.73 to desktop AND iOS 0.5.73 build 1 to TestFlight.

## Why now
User report: the Settings toggle is surrounded by an odd box, and no TestFlight
build carries the embedded-media update.

## User-facing impact
Settings: the embedded media switch loses its surrounding box (visual only —
behavior, accessible name, and keyboard operability unchanged; every other
switch app-wide is pixel-identical). Mobile: TestFlight gains v0.5.72's
features plus this fix.

## Design pass
Needed — the Settings Appearance card's "Disable embedded media" row. The
switch should sit as a clean trailing control without the empty button chrome;
keyboard focus visibility and the phone touch-target posture must be preserved.

## Decisions touched
- Switch-thumb tokenization (v0.5.68, CLAUDE.md convention): untouched — the
  chromeless variant keeps `--sr-switch-thumb`/`--sr-switch-thumb-shadow` and
  the `--sr-gray-400` off-track.
- Disable embedded media (v0.5.72): gate/preference logic untouched; only the
  row's presentation changes.
- iOS release recipe (CLAUDE.md): followed as written. Unlike the iOS-asset-only
  precedent, this run carries a user-facing app fix, so it is a full version
  bump (0.5.73) with the desktop release rhythm plus the iOS TestFlight upload.

## What done looks like
- The Settings toggle renders without the surrounding box in both themes, focus
  ring visible, all other switches unchanged.
- v0.5.73 released (tag → Windows CI → release.sh; latest.json both platforms;
  changelog + website version in lockstep).
- iOS 0.5.73 build 1 uploaded and visible in App Store Connect / TestFlight.
