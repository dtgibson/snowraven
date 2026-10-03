# Android toolchain on the developer Mac (Hephaestus)

Installed 2026-10-03 by The Engineer under the user's account, with the user's approval, with no `sudo`. Every version below is what was installed and what the release builds used. The build pins live in `scripts/android/toolchain.env` (read by `.github/workflows/android-build.yml` and mirrored in the F-Droid recipe); where this log and that file disagree, the file wins.

## What was installed, and where

| Tool | Version | How | Path |
|---|---|---|---|
| OpenJDK | 17.0.20.1 (Homebrew build) | `brew install openjdk@17` (keg-only formula, so no `sudo`; the Temurin cask's `.pkg` would have needed one) | `/opt/homebrew/opt/openjdk@17` |
| Android command-line tools (bootstrap) | Homebrew cask `android-commandlinetools` 15859902 | `brew install --cask android-commandlinetools` | `/opt/homebrew/share/android-commandlinetools` (used once, to install the SDK's own copy below) |
| Android command-line tools (SDK copy) | 23.0 | `sdkmanager "cmdline-tools;latest"` | `~/Library/Android/sdk/cmdline-tools/latest` |
| Platform tools (`adb`) | 37.0.1 | `sdkmanager "platform-tools"` | `~/Library/Android/sdk/platform-tools` |
| SDK platform | `platforms;android-36` revision 2 | `sdkmanager` | `~/Library/Android/sdk/platforms/android-36` |
| Build tools (`aapt2`, `apksigner`, `zipalign`) | `build-tools;36.0.0` | `sdkmanager` | `~/Library/Android/sdk/build-tools/36.0.0` |
| NDK | `ndk;27.2.12479018` (r27c) | `sdkmanager` | `~/Library/Android/sdk/ndk/27.2.12479018` |
| Emulator | 37.2.12 | `sdkmanager "emulator"` | `~/Library/Android/sdk/emulator` |
| System image, current API | `system-images;android-36;google_apis;arm64-v8a` revision 7 | `sdkmanager` | `~/Library/Android/sdk/system-images/android-36/google_apis` |
| System image, de-Googled reading | `system-images;android-36;default;arm64-v8a` (AOSP, no Google APIs) | `sdkmanager` (schema 4.6's second location reading) | `~/Library/Android/sdk/system-images/android-36/default` |
| System image, the floor | `system-images;android-26;google_apis;arm64-v8a` | `sdkmanager` (minSdk 26, the user's decision of 2026-10-03; its stock WebView is Chromium 58.0.3029.125, far below the WebView floor, so the floor message is verified here too) | `~/Library/Android/sdk/system-images/android-26` |
| System image, API 30 | `system-images;android-30;google_apis;arm64-v8a` revision 16 | `sdkmanager` (its stock WebView, Chromium 91, is below the WebView floor; the floor message is verified here and on API 26) | `~/Library/Android/sdk/system-images/android-30` |
| System image, API 24 (no longer a target) | `system-images;android-24;google_apis;arm64-v8a` revision 29 | `sdkmanager`; kept only as the evidence image for the API 24/25 launch crash that set minSdk 26 | `~/Library/Android/sdk/system-images/android-24` |
| Rust Android targets | rustc 1.96.1; `aarch64-linux-android`, `armv7-linux-androideabi`, `x86_64-linux-android` (the three the build uses), plus `i686-linux-android` (installed, unused) | `rustup target add ...` | `~/.rustup/toolchains/stable-aarch64-apple-darwin/lib/rustlib/` |
| Tauri CLI (Android builds) | `tauri-cli` 2.11.2, built from crates.io | `cargo install tauri-cli --version 2.11.2 --locked` | `~/.cargo/bin/cargo-tauri` |
| Gradle | 8.14.3, the official distribution, SHA-256 `bd71102213493060956ec229d946beee57158dbd89d0e62b91bca0fa2c5f3531` checked against Gradle's published `.sha256` | downloaded from `services.gradle.org` and unzipped (Homebrew's `gradle@8` is 8.14.5, not the pin) | `~/.tauri/gradle-8.14.3` |
| Android Gradle plugin, Kotlin | AGP 8.11.0, Kotlin 1.9.25 (pinned by the generated project) | automatic | `~/.gradle/caches` |
| fdroidserver (F-Droid's tools, for the local recipe check) | 2.4.5 from PyPI, Python 3.11.5, ruamel.yaml 0.17.21 | `python3 -m venv` plus `pip install fdroidserver`, in this session's scratchpad, not kept (the release skill names `~/.fdroid-venv` for the release Mac) | the session scratchpad, about 267 MB |

All SDK licenses were accepted non-interactively with `yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses`.

Emulator definitions (AVDs, in `~/.android/avd`): `sr-api36-phone` (Pixel 7, API 36, Google APIs), `sr-api36-aosp` (Pixel 7, API 36, AOSP), `sr-api36-tablet` (Pixel Tablet, API 36), `sr-api30-phone` (Pixel 4, API 30), `sr-api26-phone` (Pixel 2, API 26), `sr-api24-phone` (Pixel, API 24, evidence only). Run them with `-gpu host`: under `-gpu swiftshader_indirect` the software rasterizer drew a false band of stale tiles after the keyboard closed, which the host GPU did not reproduce.

Leftovers found and left alone: `~/.gradle` (caches dated 2026-08-12) and `~/.android/debug.keystore` predate this run; neither is used by a release build.

## Disk used

About 21 GB in all: the SDK about 18 GB (system images about 13 GB, NDK 2.4 GB, emulator 1.2 GB, the rest under 1 GB), the AVDs about 2.5 GB, the JDK 305 MB, Gradle 8.14.3 about 140 MB, the Homebrew command-line tools 173 MB, the Rust targets about 510 MB, `cargo-tauri` about 30 MB, plus Gradle's caches (`~/.gradle` is 2.6 GB including the August leftovers).

## Environment variables a build needs

Not added to `~/.zprofile` by this run; add them there (or export them in the build shell) on any machine that builds the Android app:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
export PATH="$HOME/.tauri/gradle-8.14.3/bin:$HOME/.cargo/bin:/opt/homebrew/opt/openjdk@17/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

## Reproducing it on another Mac

```sh
brew install openjdk@17
brew install --cask android-commandlinetools
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses
sdkmanager --sdk_root="$ANDROID_HOME" "cmdline-tools;latest" "platform-tools" "platforms;android-36" \
  "build-tools;36.0.0" "ndk;27.2.12479018" "emulator" \
  "system-images;android-36;google_apis;arm64-v8a" "system-images;android-36;default;arm64-v8a" \
  "system-images;android-26;google_apis;arm64-v8a"
rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
cargo install tauri-cli --version 2.11.2 --locked
# Gradle 8.14.3: the official zip, checked against https://services.gradle.org/distributions/gradle-8.14.3-bin.zip.sha256
curl -fsSLO https://services.gradle.org/distributions/gradle-8.14.3-bin.zip && unzip -q gradle-8.14.3-bin.zip -d ~/.tauri/
```

Then the environment variables above.

## Building

Exactly what CI and the F-Droid recipe run:

```sh
npm --prefix frontend ci && npm --prefix frontend run build
sh scripts/android/build-apk.sh            # unsigned universal APK
```

and, for a signed build on the release machine, the same two lines with `SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES=~/.tauri/snowraven-android-keystore.properties` exported. Output: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk` when signed, `app-universal-release-unsigned.apk` when not. No App Bundle is built.

## The signing keystore: a user-performed step

No production keystore exists and no agent creates one. When the user decides to sign Android releases (the GitHub-release APK), they run this once on the release machine, in their own terminal (schema 6.2), and keep a backup of the file and its password somewhere safe (a lost keystore means a later APK cannot install over an earlier one):

```sh
keytool -genkeypair -v -storetype PKCS12 -keystore ~/.tauri/snowraven-android.p12 -alias snowraven \
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=SnowRaven, O=Dave Gibson"
```

then writes `~/.tauri/snowraven-android-keystore.properties` beside it (a PKCS12 store has one password, so the two password lines carry the same value), and runs `chmod 600` on both:

```properties
storeFile=/Users/<you>/.tauri/snowraven-android.p12
storePassword=<the password>
keyAlias=snowraven
keyPassword=<the password>
```

F-Droid signs its own build with F-Droid's key; its APK and the GitHub APK do not update each other.

## The throwaway key used for this run's emulator checks

`/private/tmp/claude-502/.../scratchpad/throwaway-keystore/THROWAWAY-snowraven-emulator-only.jks` (PKCS12, alias `throwaway-emulator`, 30-day validity, subject `CN=THROWAWAY emulator verification only, O=not for release`), in the session scratchpad, never under the repository or `~/.tauri`. Its certificate SHA-256 is `e953b8edd83734f0e9a9ba988d212087f6f9ad46990860e38eef6e2d43e645a4`. Nothing signed with it may be distributed.
