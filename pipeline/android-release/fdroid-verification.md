# F-Droid verification: the recipe, its guards, and the local fdroidserver run

Run 2026-10-03 on the developer Mac (macOS 27.0.1, Apple silicon, 8 cores), for android-release schema 6.4, 6.5 and 8.4 (FR-57 to FR-63, QA-65, QA-67, QA-70). Every command ran in a scratch directory outside the repository; no file in the worktree was edited by the run, and no device was touched. A run that could not happen is written below as not run, with the reason.

## Status: the committed recipe is now variant C, in canonical form (The Engineer, 2026-10-03)

The run below was made on the recipe as schema 6.5 wrote it, which F-Droid's scan refuses. The Engineer then replaced the committed recipe with the form this run verified: rewritemeta's canonical layout, `Changelog` on `/blob/HEAD/`, `rm -rf frontend/node_modules` as the prebuild's last line, and `scandelete` reduced to `src-tauri/dmg/dmg-DS_Store`. On a byte copy of that file (sha256 `7494542565503717aa91125c6e68a9e135f8384c6e9c0831669baa9e4b0f5c18`), `fdroid lint -f --force-yamllint` reports nothing (exit 0) and `fdroid rewritemeta -l` lists nothing. Its build entry is variant C exactly, which is what step 12 built. `fdroidRecipe.test.ts` changed with it (the prebuild, scandelete and Changelog rows), and each changed row was seen red against the schema's form (the two `node_modules` entries back, the removal line dropped, `/blob/main/`). Where the sections below say "the committed recipe" or "the recipe as written", they mean the schema's form this run started from.

**QA-70, run afterward by The Engineer:** a copy of the F-Droid-built APK (sha256 `ddbc4c82...b4e`) was zipaligned and signed with the THROWAWAY emulator key (certificate SHA-256 `e953b8ed...45a4`), which leaves the bytes F-Droid built unchanged apart from the signature, and installed over the throwaway-signed build on the API 36 phone emulator. It launched to its first usable screen, the Weather tab with Plan and no Current, with no fatal exception in the log (`screenshots/fdroid-build-launch-api36.png`; that folder is gitignored). The source it was built from is the commit before the launch-frame fix, which changes nothing at or above the WebView floor.

## Verdicts

| Check | Result |
|---|---|
| `fdroidRecipe.test.ts`, `androidLicense.test.ts` | 35 of 35 pass (30 and 5) |
| `fdroid lint` on the committed recipe (byte-identical copy) | **1 finding**, exit 1: the `Changelog` URL should use `/blob/HEAD/` |
| `fdroid lint -f` and `fdroid rewritemeta -l` on the committed recipe | **not in canonical format** (fdroiddata's CI fails a merge request on this) |
| `fdroid lint -f` and `rewritemeta -l` on the canonical form with `/blob/HEAD/` | no finding, exit 0; nothing to reformat |
| `fdroid scanner` on the recipe as written | **fails**: `Some glob paths did not match any files/dirs: node_modules` |
| `fdroid scanner` with only the root `node_modules` line removed | **1 error**: `Unused scandelete path: frontend/node_modules` |
| `fdroid scanner` with variant C (below) | 0 problems |
| `fdroid checkupdates` before any tag carries `bundle.android.versionCode` | `Couldn't find any version information` (expected for every existing tag) |
| `fdroid checkupdates` after a scratch `v1.0.49` tag | found `1.0.49 (1000049)` |
| `fdroid checkupdates --auto` | appends a 1.0.49 Builds entry; its `commit:` is the tag's commit hash |
| `fdroid build -v -l` on the recipe as written | stops at the scan with the same `node_modules` error |
| `fdroid build -v -l` on variant C | **built**: `Successfully built version 1.0.48 of com.dtgibson.snowraven`, passing fdroidserver's scan, debuggable and version checks |
| `fdroid build --server` | **not run**: not feasible on this Mac (below) |
| The recipe's `sudo:` block | **not run**: local mode skips it by design (below) |
| Launch of the F-Droid-built APK on the API 36 emulator (QA-70) | not run in this run (below); **run afterward by The Engineer: launched** (Status above) |

## Versions

| Tool | Version |
|---|---|
| fdroidserver | 2.4.5 (PyPI, in a scratch venv; Python 3.11.5, ruamel.yaml 0.17.21) |
| fdroiddata | `d48d617adb0a6637c48258afe3a70df417f18410` (2026-10-03), a shallow sparse clone of `config/`; its production `config.yml` replaced in scratch by one naming `sdk_path`, `ndk_paths: {r27c: .../ndk/27.2.12479018}` and `java_paths: {17: ...}` |
| JDK | OpenJDK 17.0.20.1 (`JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home`) |
| Android SDK | `ANDROID_HOME=/Users/developer/Library/Android/sdk`, build-tools 36.0.0, NDK 27.2.12479018 |
| Gradle | 8.14.3 (`~/.tauri/gradle-8.14.3/bin` put first on `PATH` for the build) |
| Rust, Tauri CLI | rustc 1.96.1; `cargo tauri` 2.11.2 |
| Node, npm | 24.18.0, 11.16.0 |
| git | 2.54.0 |

## The source the run used

`git clone` of the worktree at The Engineer's commit `458127c` into scratch, plus the four uncommitted files of this task (the recipe, the two guards and `frontend/src/test/fdroidRecipe.ts`), committed in the scratch clone as `1e68dec`. A second scratch commit `9015fe6` moved `tauri.conf.json` and `frontend/package.json` to 1.0.49 / 1000049 and was tagged `v1.0.49` in the scratch clone only. Nothing was pushed, and the worktree's own refs were not touched.

`fdroid lint` read a byte-identical copy of the committed recipe (sha256 `0087069d68aeb133330c5e886d40c21a41306df8c93efb5058aafae5eacb285f`). The scanner, checkupdates and build read copies that differ only in `Repo` (the scratch clone's path, since the public repository has no tag carrying the Android project yet) and, for the scanner and build, `commit` (the full hash of `1e68dec`).

## What ran

All from the scratch fdroiddata directory, with `ANDROID_HOME` and `JAVA_HOME` set as above.

1. `fdroid lint -v com.dtgibson.snowraven`: exit 1, one finding:
   `Changelog 'https://github.com/dtgibson/snowraven/blob/main/CHANGELOG.md': Use /HEAD instead of /master or /main to point at a file in the default branch`.
2. `fdroid lint -f --force-yamllint com.dtgibson.snowraven`: the same finding plus `Run rewritemeta to fix formatting`. `fdroid rewritemeta -l` lists the file.
3. `fdroid rewritemeta` on a separate copy shows the canonical form: `AntiFeatures` moves to the top; values longer than about 80 columns fold onto indented continuation lines (the `NonFreeNet` reason, the `apt-get install` line, the `rustup toolchain install` line); within the build entry the keys reorder to `versionName, versionCode, commit, timeout, sudo, output, prebuild, scandelete, build, ndk`; and the one-line `build:` list is written as a plain string, `build: sh scripts/android/build-apk.sh`. With the `Changelog` changed to `/blob/HEAD/`, that copy passes `fdroid lint -f` with no finding and `rewritemeta -l` lists nothing. It is kept at `<scratch>/canonical-recipe.yml` for The Engineer.
4. `fdroid scanner -v com.dtgibson.snowraven` (the recipe as written): the prebuild ran in full (`npm --prefix frontend ci`, 344 packages; the Vite build), F-Droid removed the `signingConfigs { }` block from `app/build.gradle.kts` (`Cleaned build.gradle.kts of keysigning configs`), and then the scan stopped:
   `FDroidException: Some glob paths did not match any files/dirs: node_modules`. Exit 0 with `1 problems found` (`fdroid scanner` exits non-zero only with `-e`).
5. The same scan on a copy with only the root `node_modules` line removed: `Removing gradlew at src-tauri/gen/android/gradlew`, `Removing binary at src-tauri/dmg/dmg-DS_Store`, a warning `Found executable binary, possibly code at frontend/node_modules/fsevents/fsevents.node`, and `ERROR: Unused scandelete path: frontend/node_modules` (1 problem).
6. F-Droid installs the Linux tree, so that tree was checked too: `npm ci --os=linux --cpu=x64 --libc=glibc --ignore-scripts` from the snapshot's `frontend/package-lock.json`, then fdroidserver's own `scanner.scan_source` over it. The tree holds three native addons (`@rolldown/binding-linux-x64-gnu`, `lightningcss-linux-x64-gnu`, `@tailwindcss/oxide-linux-x64-gnu`, all `.node`) and no esbuild, `.so`, `.a`, `.jar`, `.zip`, `.gz` or `.wasm`. With `frontend/node_modules` in `scandelete` the count is 1 (`Unused scandelete path`); without it, 0.
7. Variant C on the real scanner (prebuild ends with `rm -rf frontend/node_modules`; `scandelete` is only `src-tauri/dmg/dmg-DS_Store`): `Removing gradlew`, `Removing binary at src-tauri/dmg/dmg-DS_Store`, `0 problems found`, exit 0 with `-e`.
8. `fdroid checkupdates -v --allow-dirty com.dtgibson.snowraven` before the scratch tag: tag pattern `^v[0-9.]+$` matched every release tag; fdroidserver examines only the five newest (`v1.0.48` to `v1.0.44`), and each logged `UpdateCheckData regex "versionCode":\s*(\d+) for version code has no match`, ending in `Couldn't find any version information` (exit 1). This is the true state until a tag carries `bundle.android.versionCode`.
9. The same after tagging `v1.0.49` in the scratch clone: `UpdateCheckData found version 1.0.49 (1000049)` and `...updating to version 1.0.49 (1000049)`. Even without `--auto`, checkupdates rewrote the copy in canonical form, set `CurrentVersion: 1.0.49` and `CurrentVersionCode: 1000049`, and added `AutoName: SnowRaven` (read from the app's resources).
10. `fdroid checkupdates -v --auto --allow-dirty` on a fresh copy: `...auto-generating build for 1.0.49`; the new entry is a copy of the 1.0.48 entry with `versionName: 1.0.49`, `versionCode: 1000049` and `commit: 9015fe63e3c03aa9734951d8f83d60845dd6207d`.
11. `fdroid build -v -l com.dtgibson.snowraven` on the recipe as written: `runs this on the buildserver with sudo ... These commands were skipped because fdroid build is not running on a dedicated build server`, the prebuild, then `Could not build app com.dtgibson.snowraven: Some glob paths did not match any files/dirs: node_modules` and `1 build failed`. Exit 0 all the same, so the log is the evidence, not the exit code.
12. `fdroid build -v -l com.dtgibson.snowraven` on variant C (`<scratch>/run-build.sh`: `PATH` led by Gradle 8.14.3, a private `TMPDIR` so the Tauri CLI's `com.dtgibson.snowraven-server-addr` file could not meet any other build on this Mac, `GRADLE_OPTS=-Dorg.gradle.daemon=false -Dorg.gradle.workers.max=3`, `CARGO_BUILD_JOBS=4`), 09:57 to 10:03:
   - `sudo:` skipped (as in step 11); prebuild ran, including `rm -rf frontend/node_modules`; `Cleaned build.gradle.kts of keysigning configs`; `gradlew` deleted before the scan; the scan removed `src-tauri/dmg/dmg-DS_Store` and found nothing else; the source tarball was written (42.6 MB).
   - `sh scripts/android/build-apk.sh` wrote the `gradlew` shim back and ran `cargo tauri android build --ci --apk --target aarch64 armv7 x86_64`, ending `Finished 1 APK at: .../apk/universal/release/app-universal-release-unsigned.apk`.
   - fdroidserver then logged `Successfully built version 1.0.48 of com.dtgibson.snowraven from 1e68dec89c252f4a4cb31a1bd2303ea6bb73a7f0`, checked the APK for debuggable or testOnly flags and for its version against the Builds entry (both passed, no exception), and moved it to `unsigned/com.dtgibson.snowraven_1000048.apk` (78.6 MB, sha256 `ddbc4c82033f853d09867ca87625f5ce10d227553abf40b43287adeedec92b4e`).
   - `aapt2 dump badging` on it: `package: name='com.dtgibson.snowraven' versionCode='1000048' versionName='1.0.48'`, `minSdkVersion:'26'`, `targetSdkVersion:'36'`, `native-code: 'arm64-v8a' 'armeabi-v7a' 'x86_64'`, and two permissions: `android.permission.INTERNET` and androidx's library-defined `com.dtgibson.snowraven.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. `apksigner verify` reports it unsigned (`Missing META-INF/MANIFEST.MF`), which is what F-Droid signs with its own key.

## Where the schema did not hold

1. **`scandelete: node_modules` (the root) fails the scan, on every machine.** The prebuild installs only `frontend/node_modules`; nothing creates a root `node_modules` (the root `package.json` holds only `@tauri-apps/cli`, which the Android build does not use), and fdroidserver 2.4.5's `getpaths_map` raises on a `scandelete` path that matches nothing. Schema 6.5's "Each path must exist at scan time ... which `node_modules` do after `prebuild`" is true of `frontend/node_modules` only.
2. **`scandelete: frontend/node_modules` is reported unused, which is also an error.** The scanner deletes only files it flags, and counts a `scandelete` entry that removed nothing as `Unused scandelete path`. Vite 8 builds with rolldown, not esbuild, so the tree holds `.node` addons, which the scanner at most warns about; schema 6.5's "`esbuild`'s extensionless binary is an error" no longer describes this lockfile. Measured on the macOS tree and on the Linux x64 tree.
   - **Variant C, verified:** add `rm -rf frontend/node_modules` as the last prebuild line and keep `scandelete` to `src-tauri/dmg/dmg-DS_Store`. The scanner then never sees the toolchain, whatever a future dependency ships, reports 0 problems, and the local `fdroid build` completes (step 12). The build step needs nothing from `node_modules` (`build-apk.sh` removes the `beforeBuildCommand`). Dropping both lines without the `rm` also scans clean today, but would fail the scan the day a dependency ships an extensionless binary.
   - Either way, `fdroidRecipe.test.ts`'s scandelete row and its prebuild row change with the recipe; they pin the schema's text as instructed.
3. **The `Changelog` URL fails `fdroid lint`.** fdroiddata's CI runs `fdroid lint` on every new or changed recipe, so `/blob/main/CHANGELOG.md` must become `/blob/HEAD/CHANGELOG.md`. The guard already accepts either (main is the default branch, so both name the same file).
4. **The recipe text is not in `rewritemeta`'s canonical form, and fdroiddata's CI requires it.** Its `fdroid rewritemeta` job (`.gitlab-ci.yml` at the fdroiddata commit above) rewrites every changed recipe and fails on any diff. For the committed copy to be byte-identical to what lands in fdroiddata (schema 6.5, `merge-request.md`), it should be the canonical text from step 3. The guards hold on both layouts (below).
5. **`-l` is `--latest`, not "local".** fdroidserver 2.4.5 builds locally whenever `--server` is absent; `-l` picks the newest Builds entry. The command in 6.5 is right; its gloss is not.
6. **`--auto` sets `commit:` to the tag's commit hash, not the tag name** (`checkupdates.check_tags` returns `vcs.getref(tag)`).
7. **checkupdates adds `AutoName: SnowRaven`.** Not required by lint; the seed recipe may carry it so the bot's first update does not add a field. `fdroidRecipe.test.ts`'s field set would need it added if so.
8. **fdroiddata's CI builds with JDK 21** (its build job runs `update-alternatives --set java .../java-21-openjdk-amd64/bin/java`), not the 17 in `toolchain.env`. AGP 8.11 accepts 17 or later, so this is a note, not a defect.
9. **An fdroidserver 2.4.5 local-mode bug, not the recipe's:** on a fresh fdroiddata directory, `fdroid build` sets `SOURCE_DATE_EPOCH` from `build/<appid>` before cloning it and dies with `TypeError: str expected, not NoneType`. Cloning the source into `build/com.dtgibson.snowraven` first (or running `fdroid scanner` first) avoids it. The server path fetches sources before it builds.
10. What did hold: `Science & Education` is in fdroiddata's current `config/categories.yml` (which also lists `Navigation` and `Weather`, for the category choice in schema 9); `NonFreeNet` is a valid anti-feature; `ndk: r27c` resolves through `ndk_paths`; F-Droid's `remove_signing_keys` strips the whole `signingConfigs { }` block from `app/build.gradle.kts` and leaves `signingConfigs.findByName("release")?.let { ... }` in place, and that file still builds an unsigned release (step 12); the scanner deletes the `gradlew` shim by name without counting it; and the `UpdateCheckData` regexes read exactly the committed pair.

## The guards

`frontend/src/lib/fdroidRecipe.test.ts` (30 tests) and `frontend/src/lib/androidLicense.test.ts` (5 tests) read the committed files in pure JS through `frontend/src/test/fdroidRecipe.ts` (a flat YAML reader, an env-file reader, and `UpdateCheckData` split and matched as fdroidserver does). They also pass `eslint` and `tsc -b`.

- **The reader against ruamel.yaml:** on both the committed text and the canonical form, the reader's output equals ruamel.yaml's (YAML 1.2, safe) reading byte for byte as canonical JSON, and the only scalars YAML types as non-strings are `timeout`, `versionCode` and `CurrentVersionCode` (integers), so `CurrentVersion` and `versionName` stay text.
- **Mutations**, each applied to an in-memory copy through a scratch harness that mocks `readRepo` and imports the real guard file (the committed files were never edited; a marker file confirmed each substitution was applied):

| Mutation | Rows that went red |
|---|---|
| none (identity) | 0 of 30, 0 of 5 |
| Rust 1.96.1 to 1.95.0 on the recipe's `rustup` line | "the sudo provisioning and the ndk carry exactly the pinned versions" (and three guard-the-guard rows whose scratch text no longer matches) |
| `CurrentVersionCode` 1000048 to 1000049 alone | "CurrentVersion, CurrentVersionCode and the Builds entry agree with tauri.conf.json and the formula" (and one guard-the-guard row) |
| name regex widened to `"[A-Za-z]*[vV]ersion"`, which also matches `minimumSystemVersion` | the `UpdateCheckData` literal row and "each regex matches the committed tauri.conf.json exactly once" |
| `src-tauri/dmg/dmg-DS_Store` dropped from `scandelete` | the scandelete row |
| the workflow's build line reverted to `npm --prefix frontend ci` alone | "the workflow runs the same frontend build and then the same script" |
| recipe `License` to `AGPL-3.0-or-later` | `androidLicense.test.ts`: "every manifest, both lockfile roots and the F-Droid recipe read AGPL-3.0-only" |
| the whole recipe replaced by the canonical form with `/blob/HEAD/` (must stay green) | none: 30 of 30 and 5 of 5 pass |

- **No bundle change:** Tailwind scans test files under `frontend/` for class names, so the frontend was built in the scratch clone without the three new files twice (identical) and once with them: `index-CgW_uraH.css` and `vendor-maplibre-CKRTiAqP.css` byte-identical (sha256 `b91d961e...` and `a44e9c85...`).

## Honest limits

- **`fdroid build --server` was not run.** The buildserver box is `debian/trixie64` for VirtualBox or libvirt on x86_64, and fdroiddata's CI uses `registry.gitlab.com/fdroid/fdroidserver:buildserver-trixie` on `saas-linux-medium-amd64` runners; neither runs on an Apple-silicon Mac without emulation this run did not attempt.
- **The `sudo:` block was not run.** Local mode skips it by design (`build.py` runs it only with `--on-server`, step 11 shows the skip). So the Debian package names, `rustup toolchain install`, `cargo install tauri-cli --root /opt/cargo`, the symlinks into `/usr/local/bin` and the `chmod` are verified only by the fdroiddata merge request's own `fdroid build` job. The local build used this Mac's toolchain (rustc 1.96.1, `cargo tauri` 2.11.2, Gradle 8.14.3, NDK r27c), which are the same versions the block installs.
- **The Linux node_modules check** used `--ignore-scripts`. The only dependency with an install script is `fsevents`, which is macOS-only and absent from the Linux tree, so no script would have run there.
- **checkupdates ran against a scratch tag**, not the public repository; after the first real tag that carries `bundle.android.versionCode`, it must be run against GitHub (schema 8.4 item 7).
- **The local build proves variant C, not the recipe as committed.** The recipe as written stops at the scan (step 11); variant C differs from it only in the prebuild's last line and the `scandelete` list, and built from source with the same commands CI runs.
- **QA-70's launch screenshot was not taken in this run** (The Engineer took it afterward; see Status). The F-Droid output is unsigned and cannot be installed as it is; installing it means re-signing a copy and replacing the app on the API 36 emulator The Engineer was using for its own checks at the time, which this run did not do. The APK is kept at `<scratch>/fdroiddata-local-c/unsigned/com.dtgibson.snowraven_1000048.apk` for that step.

`<scratch>` is `/private/tmp/claude-502/-Users-developer-devwork-snowraven/1890b5dd-4eff-4f7c-a0b4-9ae2413dac4b/scratchpad/fdroid/`; its logs (`lint-*.log`, `scanner-*.log`, `checkupdates-*.log`, `build-*.log`) hold the full output of every step above.
