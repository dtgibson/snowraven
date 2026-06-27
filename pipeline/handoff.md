## What We Accomplished

Fixed the blocker that kept **v0.5.45 from releasing**. The macOS release had failed
repeatedly on the Mac because the Mac had drifted to a bleeding-edge Node (v25.9.0),
whose npm crashes on `npm ci` with the internal error "Exit handler never called!"
(npm/cli#8766). The build VM (Node 24) and Windows CI (Node 20) ran the identical
lockfile fine — the problem was the Mac's environment, not the project.

`release.sh` is now **one self-healing command**: it installs both the root and
frontend dependencies itself (the old instructions only installed `frontend`,
omitting the root install that provides the `tauri` CLI), and it preflights the
required tools, the pinned Node version, network reachability, GitHub auth, and a
clean working tree before the slow build — each failure naming its exact remedy.
The repo now pins Node (`.nvmrc` = 24) so the release machine can't drift again.
Release tooling only — the v0.5.45 app is unchanged and the tag stayed put.

## What Has Been Saved

- **`release.sh`** — self-healing rewrite (root + frontend `npm ci`, loud preflights,
  `CHECK_ONLY`/`SKIP_NPM_INSTALL`/`ALLOW_*` knobs); build/sign/notarize tail unchanged.
- **`.nvmrc`** (24) and **`frontend/package.json`** (`engines.node >= 20.19`).
- **`pipeline/offline-support/release-runbook.md`** + **`glyph-bundle-handoff.md`** —
  corrected to the one-command flow (drop the standalone `cd frontend && npm ci`).
- **`CLAUDE.md`** (release convention) + **`DECISIONS.md`** (post-mortem entry).
- **`pipeline/mac-release-build-blocked/`** — bug-brief, qa-report, security-report.
- Commits: `bcd27c0` (the fix) + `92ce173` (records), both pushed to `main`.

## Where We Are

Fix complete and pushed to `main`. VM verification all green (lint, typecheck, 1094
vitest, build, 157 pytest; release.sh guards fire; security passed with notes, no
Critical/High). **The v0.5.45 binary release itself has NOT run yet — that's the
Mac's next step.**

## Resume Prompt

**Next action (the Mac): release v0.5.45.** It's now unblocked. On the Mac:

1. `git checkout main && git pull --ff-only origin main`  (gets release.sh @ `92ce173`)
2. `nvm install 24 && nvm use 24`  (the repo pins Node via `.nvmrc`; a non-LTS Node
   like 25 crashes `npm ci`)
3. `zsh -lc ./release.sh`  (self-installs deps, preflights, builds + notarizes the
   universal DMG, fetches + re-signs the Windows installer from CI run 27993478562 @
   tag `ac2ba49`, and publishes the v0.5.45 GitHub release + `latest.json`)
4. Verify: `gh release view v0.5.45` carries the DMG, the macOS updater bundle
   (`.app.tar.gz` + `.sig`), the Windows `-setup.exe` (+ `.sig`), and `latest.json`
   with `darwin-aarch64`, `darwin-x86_64`, `windows-x86_64`.

The `v0.5.45` tag stays at `ac2ba49` (do not move it). To start unrelated new work,
run `/weft` — it picks up from the current (idle) state.
