# QA Report — Mobile App (iOS + iPadOS)

**Date:** 2026-07-05
**Test Runner:** vitest (frontend) · cargo check (Rust, both targets) · production build · iOS Simulator (iPhone 17 Pro + iPad Air 11-inch M4, iOS 26.5)
**Result:** PASSED (with device/TestFlight-phase items explicitly deferred — see below)

## Test Suite Results (independent ground truth)

- `npx vitest run` — **119 files, 1468 tests, all passing** (+22 tests from the QA fix round).
- `npm run typecheck` / `npm run lint` — clean.
- `npm run build` — clean; entry-chunk discipline holds (maplibre/taxonomy/counties off first paint; mobile plugin JS dynamic-only, guarded by the extended `entryChunk.test.ts`).
- `cargo check` (desktop) and `cargo check --target aarch64-apple-ios` — both green; `cargo tree` confirms updater/process absent from the iOS graph and geolocation/dialog absent from the desktop graph.
- iOS simulator bundle builds (`tauri ios build --debug --target aarch64-sim --no-sign`), installs, launches, and renders on both device families — screenshots in `sim-verify/`.

## QA loop (one round, per the 3-attempt protocol)

A 9-lens adversarial verification (with per-finding refutation) confirmed **10
defects** against 124 clean checks. All 10 were fixed in one Engineer round and
**independently re-verified by 9 skeptics: 10/10 fixed, 0 regressions**.
Highlights: the iOS-stranded "Rebuild caches & restart" button now branches via
`supportsAppRelaunch()` (cache clear + close-and-reopen guidance on iOS; desktop
hardened with try/catch); the safe-area CSS is gated under `.sr-ios-app` so the
web build is byte-identical again; the geolocation error mapping now matches the
installed plugin's real reject strings; four test-guards were strengthened
(mutation-proven).

## Acceptance criteria (PRD QA-01…36) — honest status

**Verified now (automated + simulator + user-interactive):**
- QA-01 (universal target: one bundle launches on iPhone + iPad sims), QA-04/05-partial (native iPad canvas, no letterboxing — launch surface), QA-07 basis (tier behavior per shipped responsive system).
- QA-08/11 (import via native picker): **user-verified interactively** on the iPhone sim — the native document sheet presents from the existing input (Mechanism A confirmed; V2 closed). Import copy, metadata display, persistence/replace semantics ride the existing storage seam (unit-covered).
- QA-13 (no updater on iOS: plugin absent from the binary + UI gated — cargo tree + both-ways tests), QA-14 (desktop-only Settings hidden — tests), QA-16 wiring (clipboard seam unchanged), QA-18/19/20 basis (keys/settings through the unchanged storage seam; key scoping untouched).
- QA-22 (no Tier B UI on iOS — gated, tested), QA-27 (public silence grep-verified; privacy text only in the package material), QA-33 (chunk discipline — build inspection + guard test).
- Map composition + fullscreen-hides-sidebar + compact header: **user-verified interactively** on both sims.
- QA-03-partial (Split View narrow pane = phone tier): by construction (window-size-driven tiers) + mockup contract; interactive Split View drag deferred to device/TestFlight phase.

**Deferred — require a signed device build / TestFlight phase (Deployer):**
- QA-02/03 full (physical rotation + Split View interaction), QA-06 full-sweep across all ten tabs on both families, QA-09/10/12 (import persistence/replace/error on device with real Files app), QA-15 (real permission prompt — simulator prompts differ), QA-17 (outbound-traffic observation), QA-21/23 (airplane-mode offline tiers on device), QA-24 (TestFlight install on the user's own devices — the v1 milestone itself), QA-25/26 (submission package + synthetic screenshots — Deployer deliverables), QA-28-32/34-36 (device performance, touch-target/zoom/VoiceOver/safe-area/Split-View-stability/text-scale passes on hardware).

These deferrals are inherent to the phase, not gaps: the PRD's TestFlight-first
milestone puts them in the Deployer's device-verification step, and the user's
simulator preview (standing directive) covers the interactive half before ship.

## Known Limitations
- `dialog:allow-open` mobile grant deliberately dormant (Mechanism B fallback insurance; Auditor assesses).
- The 112px chrome budget in `.sr-map-panel-ios` is px-fixed vs rem-scaling chrome at 200% text scale — convention-consistent with shipped desktop offsets; on the device-phase checklist.
- Simulator ≠ device: picker behavior confirmed in sim; device confirmation lands in the TestFlight round.

## Convention Flags
- Parse-the-source guards claiming "top-level only" must strip @media first; negative source guards quote-agnostic + positive guards structural; gate-render assertions anchored to the guarded element's content; component-test platform mocks are flippable vi.fn()s; plugin-error-mapping tests quote the installed plugin's real strings (re-verify on version bumps).
- Platform-conditional visibility via named predicates in `lib/platformGates.ts`; `isIOS()` for capability branching only; mobile plugin JS dynamic-import-only; iOS plist customization in committed `Info.ios.plist`.
