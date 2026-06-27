# QA Report — mac-release-build-blocked

**Date:** 2026-06-27 · **Lane:** Fix · **Stage 3 (The Tester)** · **Result: PASSED**

## Test suite results

| Suite | Command | Result |
|---|---|---|
| Frontend lint | `npm run lint` (eslint) | ✓ pass (exit 0) |
| Frontend typecheck | `npm run typecheck` (tsc --noEmit) | ✓ pass (exit 0) |
| Frontend tests | `npm run test` (vitest) | ✓ **1094 passed** (91 files) |
| Frontend build | `npm run build` (tsc -b && vite build) | ✓ pass (exit 0) |
| Backend tests | `pytest tests/ -q` | ✓ **157 passed** |

Full CI mirror, in CI order (lint first). No regressions from the fix — expected,
since the only change touching the app surface is `frontend/package.json`'s new
`engines` field (metadata; the build/tests don't read it).

## Bug-brief verification

The bug is a Mac-only npm runtime crash (`Exit handler never called!` on Node 25),
which **cannot be reproduced on this Linux VM** (Node 24 — npm installs fine). So
verification targets the *fix's behavior* and the *guard that prevents the class of
failure*, plus a no-regression pass on the existing release mechanics:

| What the fix must do | How verified | Result |
|---|---|---|
| Reject a Node the project isn't pinned to (would have caught Node 25) | Temp `.nvmrc=99`, ran release.sh → dies naming `nvm install 99 && nvm use 99` | ✓ guard fires |
| Allow a deliberate override | Same, with `ALLOW_NODE_MISMATCH=1` → passes the node check, reaches CHECK_ONLY exit | ✓ override works |
| Install BOTH root + frontend deps (fixes the missing-`tauri` trap) | `install_deps "root"` + `install_deps "frontend" --prefix frontend`; root `package-lock.json` is tracked and provides `tauri` | ✓ by logic + dry-run flow |
| Preflight loudly before the slow build | Dirty-tree guard fires without `ALLOW_DIRTY`; tool/Node/network checks run first | ✓ guards fire with exact remedies |
| Not break the working release mechanics | `bash -n` clean; the 166-line build/sign/notarize/`latest.json` tail is byte-for-byte unchanged | ✓ tail identical |
| Be dry-runnable off-Mac | `CHECK_ONLY=1 SKIP_NPM_INSTALL=1 ALLOW_DIRTY=1` → full preflight, clean exit 0 before build | ✓ |

## Edge cases tested

- `CHECK_ONLY=1` dry-run stops cleanly before the macOS build (exit 0).
- `SKIP_NPM_INSTALL=1` short-circuits the dependency restore.
- `ALLOW_DIRTY=1` / `ALLOW_NODE_MISMATCH=1` overrides behave as designed.
- Dirty-tree guard lists the offending files and aborts.
- HEAD-vs-tag info line reports `tag=ac2ba49 HEAD=bab74fe` (warn-only, not a gate).

## Known limitations (not blockers — owned by the Deployer / operator)

- The **real `npm ci` on the Mac** and the **notarized universal build + signing**
  can only be exercised on macOS. The VM cannot reproduce the Mac npm crash or run
  `xcrun notarytool`. The true end-to-end proof is the operator running
  `zsh -lc ./release.sh` on the Mac (Stage 5, The Deployer) after switching to the
  pinned Node.
- `shellcheck` is not installed on this VM, so static-lint of `release.sh` was via
  `bash -n` (syntax) only. Optional follow-up: add shellcheck to the VM/CI.

## Convention Flags
- `release.sh` is now self-healing and dry-runnable (`CHECK_ONLY=1`); the Mac's
  release job is one command on the pinned Node (`.nvmrc`). Worth recording in
  `CLAUDE.md`'s release section — flagged for The Chronicler.
