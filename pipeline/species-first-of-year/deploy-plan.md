# Deploy plan: First of Year on Species Detail, release 1.0.52

**Feature:** species-first-of-year
**Stage:** 8, The Deployer (Feature lane)
**Date:** 2026-10-04 (prepared 2026-10-03 as 1.0.51; re-stamped 1.0.52)
**Status:** production sign-off given at the gate. The user then chose to wait for a Weft spin that was about to release; it shipped as 1.0.51, so this build ships as 1.0.52, behind it. The outcome of every step is in `deployment-record.md`.

## 1. Preconditions

- `qa-report.md`: Result PASSED (33 of 33 criteria), and its delta re-verification after the security notes: PASSED.
- `security-report.md`: Outcome PASSED. Three Informational notes, all Resolved; no Critical, High, Medium or Low finding.

## 2. Reconciliation

The base moved twice while this build waited.

1. First prepared on 1.0.50 (`5f0f0cb`), merged clean, full checks green, stamped 1.0.51. The coordinator then rebuilt the branch as two commits on 1.0.50 (`26bb27a` feat, `f514240` release) with an identical tree.
2. The spin shipped 1.0.51 (`9e3736c` release, `209fd30` iOS stamp). `git rebase origin/main` replayed the feature commit cleanly (`.claude/rules/security.md` and `frontend/src/globals.css`, changed on both sides, auto-merged). The release commit conflicted in `CHANGELOG.md` only. The other stamp files did not conflict, because both sides had set them to the identical 1.0.51. All were re-stamped 1.0.52: the spin's 1.0.51 changelog entry kept verbatim and this build's entry placed above it as 1.0.52; `frontend/package.json` and both top-level version fields of `frontend/package-lock.json`; `src-tauri/tauri.conf.json`'s version only; `website/index.html`'s pill text, its `aria-label` and the footer only. This branch never touches `src-tauri/gen/apple/snowraven_iOS/Info.plist`, so it keeps the spin's 1.0.51 build 1 stamp until this build's iOS archive stamps it.
3. On the rebased tree, from `frontend/`: `npm run typecheck`, `npm run lint`, `npx vitest run` (full suite, nothing else compiling) and `npm run build`. Any red stops the ship.

## 3. Cargo: what the push to `main` carries

Two commits, both this build's own: the feature commit and the release commit (version set plus this plan). Nothing from another build or from manual work rides along.

## 4. Execution sequence

Every command runs from `/Users/developer/devwork/snowraven/.claude/worktrees/species-first-of-year`, one step at a time, each checked before the next.

1. **Re-check the remote** immediately before pushing: `git fetch origin`; `origin/main` must still be `209fd30`. If it moved (the spin's context update), rebase again, re-run typecheck and the two version-parity tests (`src/lib/icloudKeysPublishedClaims.test.ts`, `src/lib/iosSceneManifest.test.ts`), then push.
2. **Push to `main`:** `git push origin HEAD:main` (or `git -c credential.helper='!gh auth git-credential' push origin HEAD:main` if the keychain refuses). This push deploys the website version stamp through `pages.yml`.
3. **Tag:** `git tag v1.0.52` on the release commit, then `git push origin v1.0.52`. This starts `windows-build.yml`.
4. **Windows CI, pinned to the tag's commit:** `gh run list --workflow windows-build.yml --commit <tag sha>`, polled every 60 s for up to 25 minutes, until `completed` / `success`.
5. **Desktop release:** with no other `release.sh` running (the build directory `~/.snowraven-build` is shared), `zsh -lc ./release.sh` in an unsandboxed shell.
6. **Verify:** download `SnowRaven_1.0.52_universal.dmg` from the release and require `codesign --verify --verbose=2` valid, `xcrun stapler validate` worked, and `spctl -a -t open --context context:primary-signature -vv` accepted as `Notarized Developer ID`. `latest.json` must read 1.0.52 with `darwin-aarch64`, `darwin-x86_64` and `windows-x86_64`. The Pages run must succeed and the live site's pill, `aria-label` and footer must read 1.0.52.
7. **iOS, TestFlight build 1.0.52.1**, per the runbook:
   1. Move any `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` aside.
   2. Recreate `/tmp/xcshim/xcodebuild`, `xcrun` and `swift` unconditionally (`printf` plus `chmod +x`; contents in the runbook).
   3. Widget extension Swift tests (`snowraven_widgetsTests`) on a local iOS 17+ iPhone simulator, timeouts enabled.
   4. `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`, map `APPLE_API_KEY`, `APPLE_API_ISSUER` and `APPLE_API_KEY_PATH` from the login shell's `APPLE_API_KEY_ID` / `APPLE_API_ISSUER_ID`, then `PATH=/tmp/xcshim:$PATH npx tauri ios build --export-method app-store-connect --build-number 1`, unsandboxed. Tauri's own export is expected to refuse at cloud signing.
   5. Confirm the fresh archive by its stamp (`CFBundleVersion` 1.0.52.1, `CFBundleShortVersionString` 1.0.52), `vtool` `platform IOS`, and every swift-rs library platform 2.
   6. Ad-hoc sign the archived `snowraven_widgets.appex` with `snowraven_widgets.entitlements` and confirm the App Group is listed.
   7. `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist`; `DistributionSummary.plist` must list both bundle ids with their entitlements.
   8. `xcrun altool --validate-app`, then `--upload-app`; record the Delivery UUID.
   9. Commit only the two stamped plists as `chore(ios): stamp iOS 1.0.52 build 1` (restore anything else the build rewrote), fetch, rebase onto any new `main`, push.
8. **Poll App Store Connect read-only** until build 1.0.52.1 is `VALID` (up to 15 minutes), then **stop**. No version record is created, retargeted, withdrawn or submitted: the user checks the build on their own device first, then decides against 1.0.49 (in review) and the spin's 1.0.51 (whose store leg another session may be handling).

## 5. Held for the user

- **Screenshots** for approval, never committed or uploaded by this stage: the iPad 13 App Store Species Detail shot and the website's Species Detail shot both show the place where First of Year now sits, so each is regenerated from the synthetic demo data and served as before and after on loopback port 8814.
- **What's New** for whichever record carries 1.0.52 is App Store copy and needs the user's yes before it is written.
- **The App Store decision** is the user's, after their device check, and is written into CLAUDE.md's App Store list in the same ship whatever it is.
