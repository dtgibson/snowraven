# QA Report — Windows Desktop App

**Date:** 2026-05-28
**Test Runner:** vitest
**Result:** PASSED (pre-deploy scope) — runtime/deploy items tracked for the deploy stage and the Windows 11 smoke test

## Test Suite Results
246 tests passing, 0 failing (13 files). TypeScript build (`tsc -b`) clean. ESLint clean for changed files (2 pre-existing warnings elsewhere, unrelated). `bash -n release.sh` OK. `windows-build.yml` is valid YAML.

## Acceptance Criteria Verification

| ID | Result | Notes |
|---|---|---|
| QA-01 — CI builds Windows | ⏸ At deploy | Workflow authored + YAML-valid; confirmed when the first `v*` tag triggers the run. |
| QA-02 — Updater signed locally | ⏸ At deploy | `release.sh` signs the archive with the local key; verified when the first release is assembled (and end-to-end by QA-07). |
| QA-03 — CI artifacts retrievable + published | ⏸ At deploy | `release.sh` uses `gh run download`; confirmed at first release. |
| QA-04 — Combined latest.json | ⏸ At deploy | `release.sh` writes both `darwin-aarch64` + `windows-x86_64`; inspect the first multi-platform release's `latest.json`. |
| QA-05 — Standalone runtime | ⏸ Windows smoke test | App is parity-by-seams; confirmed on the Windows 11 machine. |
| QA-06 — Persistence | ⏸ Windows smoke test | Uses the same `AppLocalData` seam as macOS; confirmed on Windows. |
| QA-07 — In-app update | ⏸ Windows smoke test (the key one) | Validates the throwaway-key → local re-sign approach. Dave's planned real-world test. |
| QA-08 — Geolocation degraded | ✓ Pass (logic) / ⏸ visual on Windows | Code gates the note to `isTauri() && isWindows()`; matches the approved mockup. Visual confirm on Windows. |
| QA-09 — Location fallbacks | ✓ Pass | Address search, manual lat/lng, radius, and default location are untouched (verified web/Mac; logic unchanged on Windows). |
| QA-10 — Unsigned documented | ⏸ Stage 9 | SmartScreen note to be added to README/HELP by The Chronicler. |
| QA-11 — No macOS regression | ✓ Pass | macOS `release.sh` path intact (notarize/staple/darwin entry/mac updater present); web/Mac Map Explorer unchanged (confirmed live). |
| QA-12 — Secrets hygiene | ✓ Pass | No `secrets.` usage and no embedded key in the workflow; the only key is the runtime-generated throwaway. Real key stays local. |
| QA-13 — Theming | ✓ Pass | The Windows note uses `var(--sr-*)` tokens; correct in light/dark (verified in the mockup). |

## Regression Checks
- Full suite green (246), incl. 3 new `isWindows` tests.
- Web/Mac Map Explorer unchanged: "Use my location" button + radius + address search all present (confirmed live).
- No Rust changes; macOS-only location code remains `cfg`-gated.

## Known Limitations / Deferred
- Everything requiring real Windows runtime (QA-05–09) is confirmed on the Windows 11 machine, not in this environment.
- CI build + release assembly (QA-01–04) are confirmed at the deploy stage on the first tag.
- The throwaway-key/local-re-sign approach is the main risk; QA-07 is its definitive check.

## Convention Flags
- Document the multi-platform release rhythm (push tag → wait for Windows CI → run `release.sh`) and the two-platform `latest.json` in CLAUDE.md (Stage 9).
