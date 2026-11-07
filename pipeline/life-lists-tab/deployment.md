# Deployment record: life-lists-tab (1.0.63)

## Release prep (2026-11-06), hands-off, stopped before the production sign-off

Run by The Deployer (Stage 8, feature lane) as a prep-only invocation. Nothing was pushed, tagged, released or uploaded: the production sign-off is the next gate, and the ship steps run in a follow-up on its recorded answer. Decisions taken here are D-33 to D-38 in `decisions.md`.

### Preconditions

- The Tester PASSED (`qa-report.md`, attempt 2 plus the post-security delta: 55 of 56 criteria pass; QA-47 is Partial until the deploy-gate live look). The Auditor PASSED (`security-report.md`, gitignored, on disk): no Critical or High; both Lows and the three Informational notes fixed in this build.
- `deploymentTarget` is null in `pipeline.config.json`, as at every SnowRaven ship: the target is the project's own release machinery (the `snowraven-release` skill). There is no staging environment, so the production sign-off is the one gate, and the feature needs no new key, environment variable, host or provider setting (D-38).
- The shared desktop build directory `~/.snowraven-build` is free: the 1.0.62 session reports its ship complete (release.sh, TestFlight 1.0.62.1, App Store submission), so the follow-up's `release.sh` has no wait.

### User direction mid-prep (2026-11-06, relayed by the coordinator)

1. Do not write the README section or the `appstore/LISTING.md` bullet in the release commit; hold them for an express re-approval, in the plainer What's New sentence. The App Store What's New and the three F-Droid changelogs stay approved verbatim.
2. The website gains a Life Lists feature row this release, with a figure from the demo data, pending the user's yes, built in a scratch copy and shown on the tailnet.
3. Every screenshot set is regenerated this ship, because the new tab changes the navigation: the website shots and the three App Store sets, in scratch, nothing uploaded, shown as a gallery.
4. After 1.0.62 finished, rebase once more onto the new tip.

The gate therefore needs the user's yes on the held copy and the screenshots before the ship.

### Reconciliation with the 1.0.62 ship

Local `main` held 14 unpushed commits on `a1823622`. It was rebased (never merged, never force-pushed) onto `origin/main` at `1e4d824a`, then again onto `3360f38c` (1.0.62's ledger and records). Both rebases applied all 14 commits without a conflict. The overlap with 1.0.62 was nine files (`.claude/rules/security.md`, `.claude/rules/ui.md`, `docs/HELP.md`, `honestLoadFailures.test.tsx`, `TabLoadErrorAlert.test.tsx`, `globals.css`, `clearDerived.test.ts`, `entryChunk.test.ts`, `settingsRouteBudget.test.ts`); for each, both sides' added and removed lines are identical before and after the rebase, so nothing was dropped and nothing needed hand resolution (D-33). The 14 commits are now `5ac4c4ce` to `2477b9e4` (on `3360f38c`).

### Verification

| Tree | Result |
|---|---|
| Rebased on `1e4d824a` | `npm run typecheck` 0, `npm run lint` 0, `npm run build` 0; full vitest 487 files passed, 5 skipped; 10,644 tests passed, 6 skipped, **1 failed** (`speciesUtilsMemoBound.test.ts`, a wall-clock ratio row, at load 294 from the run itself); that file alone passed 25 of 25 twice and is untouched by either side (D-34) |
| Rebased on `3360f38c`, bumped, with the new guard | full vitest **exit 0**: 489 files passed, 5 skipped; **10,653 tests passed, 6 skipped, 0 failed** (93.8 s); typecheck 0; lint 0; build 0 (the usual over-1,100 kB chunk warning); built CSS byte-identical to the pre-bump build |

### The version bump (the six-file set)

Written by script with exact-once replacements: `frontend/package.json` and its lockfile's two version lines 1.0.63; `src-tauri/tauri.conf.json` version 1.0.63 and `bundle.android.versionCode` 1000063; `CHANGELOG.md` `## [1.0.63] - 2026-11-06` (Added: the Life Lists tab; Internal: the exotic list publication, the Help heading ids, the U+0000 escape, the new modules and guard, the F-Droid files); `website/index.html` pill text, `aria-label` and footer line only; `fastlane/metadata/android/en-US/changelogs/10000631.txt`, `10000632.txt`, `10000634.txt`, the approved What's New and a newline, 224 bytes each, ASCII, SHA-256 `4d7fdd868b5c7d64e550518c058ef59b25a690c7858ea9f972760b0ff40dc3d2`, no `1000063.txt`; the in-repo F-Droid recipe's three `versionName`/`versionCode` pairs (10000631/2/4), `CurrentVersion` 1.0.63 and `CurrentVersionCode` 10000634. **The recipe's three `commit:` lines still name 1.0.62's `c16526a7`**: a commit cannot carry its own hash, so they are written after the tag exists (plan step 5).

### Published copy

- **Approved and written:** the F-Droid changelog (above). **Approved, written in the follow-up:** the App Store What's New, on the 1.0.63 record:

  > A new Life Lists tab, after Checklists, lists every species you have recorded newest first by your first sighting, with its checklist and place, and turns into a photo, audio, or video life list, or any combination of them.

- **Held:** the README section, the website row (sentence, figure, alt text) and the listing bullet, each in the plainer sentence; ten website images; the iPad and iPhone Duo App Store sets. All in `held-copy.md`, with the patch `held/held-copy.patch` and its guard (D-36).
- **Guard in the release commit:** `frontend/src/lib/lifeListsPublishedClaims.test.ts` holds Help's Life Lists section and the F-Droid files to `TAB_LABELS`, `DEFAULT_TAB_ORDER`, `MEDIA_FORMATS` and `SWITCH_LABELS`; 8 rows, mutation-checked eight ways (D-35).

### Review pages (tailnet only; loopback servers detached so they outlive this session's turn)

| Page | URL | Serves |
|---|---|---|
| Website | https://hephaestus-developer.giraffe-chuckwalla.ts.net:18951/ | the scratch site (bumped pill, the Life Lists row, every regenerated shot), loopback 18951 |
| README | https://hephaestus-developer.giraffe-chuckwalla.ts.net:18952/ | `README.md` rendered through GitHub's own Markdown endpoint, the new section highlighted, loopback 18952 |
| App Store sets | https://hephaestus-developer.giraffe-chuckwalla.ts.net:18953/ | for each device, the current set above the regenerated one, in upload order, each frame linked to its full PNG, loopback 18953 |

All three answered HTTP 200 over the tailnet (`curl -sk`). No existing `tailscale serve` mapping was changed and the :443 root was not used. To take them down after the review: `tailscale serve --https=<port> off` for 18951, 18952 and 18953, and stop the three `python3 -m http.server` processes.

### Screenshots (held), and how they were taken

Captured from the synthetic demo data (a scratch copy of `website/tools/demo-data`, served at `http://127.0.0.1:1620` by a backend started for this with `SR_DATA_DIR` on that copy; both capture scripts' demo-dataset guards passed: 368 synthetic checklists) with scratch copies of the committed tools; every change to those copies is in `held/capture-tools.diff`. This Mac's `backend/.env` carries no eBird key, so key presence was mocked in the browser on the frames that need it, and the App Store Weather frames were served from the demo store's replay entries with the offline line trimmed (D-37). Each output was checked by eye on contact sheets and measured against the committed image (`held-copy.md` sections 5 and 6).

- **Website** (`<scratch>/site/assets/shots/`; also inside `held/held-copy.patch`): nine regenerated, `life-lists.webp` new; `statistics-mobile.webp` and `weather.webp` kept.
- **App Store** (`<scratch>/out/appstore-sets/` composed, `<scratch>/out/appstore-raw/` raw; `<scratch>` is this session's scratchpad, `/private/tmp/claude-502/-Users-developer-devwork-snowraven/82ec1f99-3f97-43b3-aa99-49558e1ed073/scratchpad`): replace `ipad-13` and `iphone-duo` whole; keep `iphone-6.9`. SHA-256 prefixes of the frames to upload, composed then raw:

| Frame | iPad 13-inch | iPhone Duo |
|---|---|---|
| 01-map-explorer | `f169ebd26c4178a2` / `358763b48a12baa1` | `9ac2e021815bf674` / `c0efb809635193a1` |
| 02-statistics | `18b4ef89060acd85` / `c514ca1593d2ecc3` | `b52cbc4c3d308ea2` / `a98251ed1d417dd3` |
| 04-calendar | `8342e6a72611fd80` / `7692df98465d40d7` | `5d98ef275a5fa9c9` / `053b518ea8e2b262` |
| 05-species-detail | `50ff86cb57d30fac` / `bdc61b001ee5a3b1` | `797c27e291b6fe29` / `3dbd832a73ff117f` |
| 03-weather-tide | `e928801c606560c3` / `dba3429691a5374e` | `f57dcc87e5413984` / `1e57d5f2b96d485a` |
| 06-breeding-codes | `c50ec806e4acf29b` / `d7fdb288c7b18b5c` | `1b2817797bb55753` / `5c8318e10f9d6179` |

If the scratch output is lost before the follow-up, regenerate with the committed tools plus `held/capture-tools.diff` (`FAMILY=ipad`, `FAMILY=duo`, `WEATHER_REPLAY=1`) and show the user the new frames again before uploading anything.

### The release commit

One commit on the rebased `main`, `chore(release): 1.0.63, Life Lists`: the six-file bump, `lifeListsPublishedClaims.test.ts`, this record, `held-copy.md`, `decisions.md` (D-33 to D-38), `held/held-copy.patch` and `held/capture-tools.diff`. It carries no README, LISTING or website content change beyond the version pill. The untracked `pipeline/life-lists-tab/evidence/` folder that appeared during the prep is not this stage's and is left out.

### Cargo for the production gate

`git log origin/main..main` after the commit is this build's 14 commits plus the release commit, all this build's own: the feature (`a6e4aead` the exotic list publication, `800e2ce4`, `a7d30186`), its fixes (`5ac4c4ce` the U+0000 escape, `23a8bcd7`, `27bc41c6` the Help heading ids, `a3a23a71`, `b105e1a3`), its tests (`516582fa`, `ec3d7769`), a provenance comment (`102b1481`), the pipeline records (`24591093`, `53ba60eb`, `2477b9e4`) and the release commit. No other build's app-behavior commit rides along.

### Plan for the ship follow-up (after the gate; not done here)

0. **The held copy and screenshots, on the user's yes, before anything is pushed.** `git apply pipeline/life-lists-tab/held/held-copy.patch` (or only the approved hunks; the guard file asserts all three surfaces, so on a partial yes drop or narrow it to what was approved). Copy the approved App Store frames into `appstore/screenshots/{ipad-13,iphone-duo}/` and `appstore/screenshots/raw/{ipad-13,iphone-duo}/`, checking them against the hashes above, and refresh `pipeline/app-store-listing-polish/asc/composed-frames-checksums.{txt,json}` for the replaced families. Run the full vitest suite, `npm run build`, and `npm test` in `website/tools` (`compose-appstore.test.mjs` holds the committed frames to the composer's rules), then commit (`docs: Life Lists published copy and regenerated screenshots`). Delete nothing from scratch until the upload is read back.
1. `security show-keychain-info` (the login keychain locks after a reboot; the user unlocks it in their own terminal). `git fetch`; if `origin/main` moved, rebase and re-run the suite.
2. Push `main` (fast-forward).
3. Annotated tag `v1.0.63` on that tip ("SnowRaven 1.0.63"), pushed alone. It starts Windows Build and Android Build; F-Droid builds from it, and it carries the three changelogs.
4. CI checked pinned to the tag commit (`gh run list --workflow windows-build.yml --commit <sha>`, the same for `android-build.yml`).
5. The recipe's three `commit:` lines set to `git rev-parse v1.0.63^{commit}`; `fdroidRecipe`, `fastlaneMetadata` and `androidVersionSource` green; commit `fix(fdroid): the recipe names v1.0.63's commit`; push. Nothing goes to fdroiddata (no toolchain pin or recipe build step changed).
6. iOS during the CI wait: move the existing `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` aside (1.0.62's; certain to be there); recreate the three `/tmp/xcshim` shims (`xcodebuild`, `xcrun`, `swift`) unconditionally; `xcrun --sdk iphoneos --show-sdk-version` is 27.1; the widget Swift tests; `tauri ios build --export-method app-store-connect --build-number 1` outside the Bash sandbox with `APPLE_API_KEY`, `APPLE_API_ISSUER`, `APPLE_API_KEY_PATH` mapped (Tauri's own export refusal is expected); confirm the fresh archive by its stamped 1.0.63 (1.0.63.1); ad-hoc sign the archived appex with `snowraven_widgets.entitlements`; manual `xcodebuild -exportArchive` with `~/.tauri/snowraven-ios-export-options.plist`; check `DistributionSummary.plist` (App Group on both, iCloud keys on the app) and opaque icons; `altool --validate-app`, then `--upload-app` as 1.0.63 build 1; commit and push `chore(ios): stamp iOS 1.0.63 build 1`.
7. `CI=true zsh -lc ./release.sh` (ALLOW_DIRTY only for an untracked record), alone on the machine with no dev watcher running; verify the downloaded DMG (`codesign --verify`, `stapler validate`, `spctl` primary-signature accepted, `hdiutil verify`), `latest.json` (both darwin keys and windows-x86_64), and the installer against the pinned CI run.
8. Android: `scripts/android/preflight.sh`; `sign.sh` with `SNOWRAVEN_ANDROID_SIGNER_SHA256=42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`; the opening check of those exact bytes on the local API 36 emulator only (`-gpu host`, addressed by serial; open Life Lists if the demo import is practical); read the WebView version; `attach.sh` with `ANDROID_DEVICE_CHECK=partial` (the user owns no Android device; standing decision) and `ANDROID_CHECKED_SHA256` of the signed file.
9. TestFlight read back (build 1.0.63.1 VALID). Then **the user's own iPhone check** of that exact build, asked with exact steps (install from TestFlight, open, open Life Lists from More, see the list, press Photo); record what they report.
10. The App Store record. Read 1.0.62's record state first: if it is still in review, rolling 1.0.62 up into 1.0.63 (withdraw and retarget) or deferring 1.0.63 behind it is the user's choice, asked with the iPhone check. Then, on build 1.0.63.1: the approved What's New; the promotional text restored from `LISTING.md` (it has arrived empty on twelve new records); the description PATCHed if the Life Lists bullet was approved (it does not carry over by itself); every listing field read back against `appstore/LISTING.md`; the review notes byte-identical to `REVIEW_NOTES.md`; the age-rating declaration checked on the editable app info; the iPad and Duo sets replaced whole through `pipeline/app-store-listing-polish/asc/asc-screens.mjs` (`plan`, `replace --family ipad-13`, `replace --family iphone-duo`, `readback` ALL MATCH; the iPhone set untouched if kept); then `reviewSubmissions`, its item and `submitted: true`, read back.
11. F-Droid three-read state (fdroiddata recipe, the three build logs, the published list) and `RELEASE_LEDGER.md`: the App Store entry (1.0.62's disposition and 1.0.63's record, submission, What's New, carried and restored fields, screenshots) and the Android entry (APK, signer, Partial on emulator evidence, the F-Droid state, the WebView version).
12. The website: Pages run green, the live site at 1.0.63 with the Life Lists row if approved.

### Notes for the user

- The live look at the built Life Lists tab (QA-47's screenshot clause) is taken by the Orchestrator from the built app on the preview backend before the sign-off.
- Android stays Partial on emulator evidence by standing decision.
