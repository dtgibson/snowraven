# QA Report — desktop-persistence-and-readme

**Date:** 2026-05-28
**Test Runner:** vitest
**Result:** PASSED (with one item deferred to user-side desktop verification)

## Test Suite Results
243 tests passing, 0 failing (13 files). TypeScript build (`tsc -b`) clean, ESLint clean.

## Bug Verification

| Item | Result | Notes |
|---|---|---|
| Persistence — web/Pi no regression | ✓ Pass | Verified live: reorder/hide a tab, reload → layout persists (localStorage path unchanged). |
| Persistence — desktop relaunch | ⏸ Deferred | Cannot be exercised in this environment (Tauri-only path, no observable window). Routed through the same `storage` seam that API keys / map center / default location already persist with on desktop; serialize/parse roundtrip unit-tested. User will confirm on next desktop launch. |
| Docs — Keychain references corrected | ✓ Pass | All four references (README ×3, HELP.md ×1) updated; grep confirms zero remaining "keychain"/"credential manager" mentions. |

## Regression Checks
- Web tab reorder/hide persistence: works (verified live).
- Responsive tab navigation (`TabNav`) unaffected — reads the same `tabLayout` state.
- New pure helpers (`parseLayout`, `serializeLayout`) covered by tests, including malformed-input fallback and Set round-trip.
- Types, lint, and production build all clean.

## Known Limitations
- Desktop end-to-end persistence verified by architecture + unit tests, not by a live relaunch in this environment (see deferred item above).
- On a desktop relaunch there may be a brief first-paint frame at the default layout before the seam hydrates (file read); minor, occurs only at launch.

## Convention Flags
- Persisted UI settings should go through the `storage` seam, never `localStorage` directly. (For Stage 6 to weigh into CLAUDE.md.)
