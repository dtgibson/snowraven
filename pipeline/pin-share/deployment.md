# Deployment Plan — Pin Share (v0.5.80)

**Feature:** pin-share
**Lane:** feature (Stage 8, The Deployer)
**Version:** 0.5.80 (patch bump from 0.5.79)
**Date prepared:** 2026-08-08
**Status at hand-back:** prepared, NOT shipped. Awaiting the user's live preview and explicit ship sign-off.

---

## Gate status

| Gate | Result |
|---|---|
| The Tester (QA) | **PASSED** — 57 of 58 criteria Pass; 1731 tests green across 138 files; `npm run build`, `npm run lint`, `npm run typecheck` all clean, exit 0. QA-46 (automated axe scan) is not verifiable in this environment and is carried as an outstanding check, not a failure. |
| The Auditor (Security) | **PASSED WITH NOTES** — 0 Critical / 0 High / 0 Medium / 0 Low, 2 Informational. Neither Informational finding requires a code change. |

No unresolved Critical or High findings. Deployment is unblocked on the gate criteria.

## Pre-deploy reconciliation

`origin/main` and local `HEAD` are **identical** at `1e66368` — zero commits ahead, zero behind. The base has not moved under this build, so there is no merge, rebase, or re-verification owed before shipping. Recorded here so it is not re-run.

## Release-machine readiness (checked, not fixed)

| Check | Result |
|---|---|
| Login keychain (Hephaestus) | **Unlocked** — `no-timeout`, no "User interaction is not allowed". Signing will proceed. |
| Node vs `.nvmrc` | **Match** — login shell resolves v24.18.0 via nvm, `.nvmrc` pins 24. |
| `gh auth status` | **Authenticated** — account `dtgibson`, scopes include `repo` and `workflow`. |
| Rust targets | **Both present** — `aarch64-apple-darwin` and `x86_64-apple-darwin` (iOS targets also installed). |
| `createUpdaterArtifacts` | **`true`** in `src-tauri/tauri.conf.json:38`. The `.app.tar.gz` updater bundle will be produced. |
| `v0.5.80` tag | **Free** — does not exist locally or on `origin`. No re-push hazard on this release. |

No blockers.

## Files changed in preparation

- `frontend/package.json` — version `0.5.79` → `0.5.80`
- `src-tauri/tauri.conf.json` — version `0.5.79` → `0.5.80` (**both** are mandatory; `tauri.conf.json` is the source of the macOS `CFBundleShortVersionString`, the Windows installer version, and the in-app updater's version check, and it does not read from `package.json`)
- `CHANGELOG.md` — new `[0.5.80]` entry
- `website/index.html` — version pill (line 48) and footer version (line 635) to `v0.5.80`; the feature copy was already added by The Engineer and reads in the site's voice

---

## Ship sequence (ordered, do not reorder)

A release goes to **all available platforms, every time** (standing user direction, v0.5.78): macOS, Windows, the website, and iOS TestFlight. The release is not done until it has shipped to all of them.

### 1. Commit
Commit the version bump, changelog, website version strings, and the full pin-share implementation. Working tree must end clean — `release.sh`'s preflight aborts on a dirty tree.

### 2. Push to `main`
```
git push origin main
```
This also triggers `.github/workflows/pages.yml`, which redeploys the website (the push touches `website/`).

### 3. Push the tag — this starts the Windows CI build
```
git tag v0.5.80
git push origin v0.5.80
```
The tag **must** be pushed before `release.sh` so the CI artifacts exist to fetch. The tag must point at a commit where **both** version files are bumped, because the Windows installer is built by CI from `tauri.conf.json` at the tagged commit.

### 4. Wait for Windows CI, and verify the run's commit
`.github/workflows/windows-build.yml` on `windows-latest`. Wait for it to go **green** before running `release.sh`.

**Trap — stale CI run selection.** `release.sh` picks the Windows installer from the most-recently-*created* successful `windows-build.yml` run, and its only guard checks that the installer *filename* contains the version, which cannot distinguish two runs of the same version. If the tag is ever re-pushed (a false start: tagged at commit A, then re-pointed to commit B), A's run stays successful and `release.sh` can silently ship A's binary. **This release is not currently at risk** (the tag is unused), but if the tag is moved for any reason, run the standing check before `release.sh`:
```
gh run list --workflow windows-build.yml --status success --limit 1 --json databaseId,headSha
git rev-parse v0.5.80^{commit}
```
and confirm `headSha` equals the tag commit. A completed run cannot be cancelled; rely on create-order and wait for the correct run to finish.

### 5. Run the release assembler
```
CI=true zsh -lc ./release.sh
```
Run from a non-GUI/automation context with `CI=true` so Tauri builds the DMG headless (`--skip-jenkins`); `release.sh` then re-applies the install-window layout itself by injecting the committed `.DS_Store` before notarization. `zsh -lc` sources `~/.zprofile` so nvm puts Node 24 on `PATH`. Add `SKIP_NPM_INSTALL=1` only on a fast re-run; a cold run should let `release.sh` do both the root and `frontend` installs (the **root** install provides the `tauri` CLI that `npm run desktop:build` resolves).

This builds the macOS universal binary, notarizes and staples it, downloads the CI Windows installer, signs it locally with the real minisign key, creates the GitHub release, and writes one `latest.json` carrying `darwin-aarch64`, `darwin-x86_64`, and `windows-x86_64`.

Do **not** use `gh release create` directly. `SKIP_WINDOWS=1` exists for emergencies only and leaves Windows users without the update.

**Expected, not a regression:** the shipped DMG *container* reports as unsigned. The `.DS_Store` styling re-converts the image after `tauri build` signed it, which drops the container signature by design. The DMG is still notarized and stapled, the `.app` inside is Developer-ID signed, and the updater verifies the minisign signature on `SnowRaven.app.tar.gz`, never the DMG wrapper.

**Also expected:** `release.sh` runs `touch src-tauri/src/main.rs` to force a Cargo relink, so any running `npm run desktop:dev` watcher will rebuild and relaunch the dev app mid-release. Harmless, and worth quitting the watcher first if a live preview is on screen.

### 6. iOS TestFlight — v0.5.80, build 1
Not part of `release.sh` (that assembler is macOS + Windows only). Full detail in `pipeline/mobile-app/how-to-see.md`.

**Trap 1 — `DEVELOPER_DIR` scrubbing.** `tauri ios build` strips `DEVELOPER_DIR` from the `xcodebuild`/`xcrun` it spawns. Build through the `/tmp/xcshim` wrapper: `printf` the two shim scripts that re-export `DEVELOPER_DIR` and `exec` the real tool, `chmod +x`, then prepend `PATH=/tmp/xcshim:$PATH`, **and** `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` in the parent shell. Do not `sudo xcode-select` (it needs a password).

**Trap 2 — two distinct sets of App Store Connect env vars.** The *build/export* step reads three Tauri-side names; the *upload* step reads two different ones. Map them across before building:
```
export APPLE_API_KEY="$APPLE_API_KEY_ID"
export APPLE_API_ISSUER="$APPLE_API_ISSUER_ID"
export APPLE_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_$APPLE_API_KEY_ID.p8"
```
Without all three, the build dies at export with `APPLE_API_KEY, APPLE_API_ISSUER and APPLE_API_KEY_PATH must be provided for code signing`.

Then:
```
tauri ios build --export-method app-store-connect --build-number 1
xcrun altool --upload-app -f <ipa> -t ios --apiKey $APPLE_API_KEY_ID --apiIssuer $APPLE_API_ISSUER_ID
```

**Trap 3 — the Info.plist stamp.** `tauri ios build` stamps the committed `gen/apple/snowraven_iOS/Info.plist` with the version and build number, leaving the tree dirty. Because the iOS build runs *after* `release.sh` here, the stamp is committed afterward as a one-line `chore(ios): stamp iOS 0.5.80 build 1` (precedent `bb257a1`, `c505f2e`). If the order is ever inverted, that commit must land before `release.sh`, whose clean-tree preflight would otherwise abort.

**Icon constraint (already satisfied, do not regress):** iOS app icons must be fully opaque with no alpha channel, in both `src-tauri/icons/ios/` and the committed `src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/`. Any alpha channel, even a fully-opaque one, triggers App Store Connect rejection 90717.

### 7. Post-deploy verification
- The GitHub release for `v0.5.80` carries the universal DMG, the `.app.tar.gz` updater bundle, the Windows `-setup.exe`, and `latest.json`.
- `latest.json` contains all three arch keys, with `darwin-x86_64` spelled exactly that (not `x64`, which would make Intel users never see the update).
- The website at the Pages URL shows v0.5.80 in the pill and footer, with the pin-share copy present.
- The TestFlight build appears for 0.5.80 (1).

## Rollback

If the health check fails after the release is published, roll back rather than fixing forward:
- **macOS/Windows:** re-point `latest.json` at the previous release's assets, or delete the `v0.5.80` release so the updater stops offering it. Users already updated keep 0.5.80.
- **Website:** revert the `website/` commit and push; Pages redeploys.
- **iOS:** expire the TestFlight build in App Store Connect.

Then write a rollback entry to `pipeline/pin-share/decisions.md` recording what failed and why the rollback was necessary.
