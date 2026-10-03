# Android toolchain on the developer Mac (Hephaestus)

Installed 2026-10-03 by The Engineer under the user's account, with the user's approval, with no `sudo`. Every version below is what was installed and what the first successful release build used. The same pins are in `.github/workflows/android-build.yml` and the `snowraven-release` skill's Android section; change all three together, deliberately.

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
| System image, current API | `system-images;android-36;google_apis;arm64-v8a` revision 7 | `sdkmanager` | `~/Library/Android/sdk/system-images/android-36` |
| System image, API 30 | `system-images;android-30;google_apis;arm64-v8a` revision 16 | `sdkmanager` (for the bar-glyph measurement on API 30) | `~/Library/Android/sdk/system-images/android-30` |
| System image, the floor | `system-images;android-24;google_apis;arm64-v8a` revision 29 | `sdkmanager` | `~/Library/Android/sdk/system-images/android-24` |
| Rust Android targets | rustc 1.96.1; `aarch64-linux-android`, `armv7-linux-androideabi`, `i686-linux-android`, `x86_64-linux-android` | `rustup target add ...` | `~/.rustup/toolchains/stable-aarch64-apple-darwin/lib/rustlib/` |
| Gradle | 8.14.3 (the committed wrapper downloads it on first build) | automatic | `~/.gradle/wrapper/dists` |
| Android Gradle plugin, Kotlin | AGP 8.11.0, Kotlin 1.9.25 (pinned by the generated project) | automatic | `~/.gradle/caches` |
| Tauri CLI | `@tauri-apps/cli` 2.11.2 (the repository's own lockfile) | `npm ci` at the repository root | `node_modules/.bin/tauri` |

All SDK licenses were accepted non-interactively with `yes | sdkmanager --sdk_root="$ANDROID_HOME" --licenses`.

Emulator definitions (AVDs, in `~/.android/avd`): `sr-api36-phone` (Pixel 7, API 36), `sr-api30-phone` (Pixel 4, API 30), `sr-api24-phone` (Pixel, API 24), `sr-api36-tablet` (Pixel Tablet, API 36), each created with `avdmanager create avd -n <name> -k <image> -d <device>`.

Leftovers found and left alone: `~/.gradle` (caches dated 2026-08-12) and `~/.android/debug.keystore` predate this run; neither is used by a release build.

## Disk used

About 18 GB in all: the SDK 15 GB (system images 10 GB, NDK 2.4 GB, emulator 1.2 GB, build tools, platforms, command-line tools and platform tools about 0.7 GB), the AVDs about 2.2 GB, the JDK 305 MB, the Homebrew command-line tools 173 MB, the four Rust targets about 510 MB, plus Gradle's caches (`~/.gradle` is 2.6 GB including the August leftovers).

## Environment variables a build needs

Not added to `~/.zprofile` by this run; add them there (or export them in the build shell) on any machine that builds the Android app:

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME="$HOME/Library/Android/sdk"
export NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
export PATH="/opt/homebrew/opt/openjdk@17/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
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
  "system-images;android-36;google_apis;arm64-v8a" "system-images;android-24;google_apis;arm64-v8a"
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

Then the environment variables above, and `npm ci && npm --prefix frontend ci` in the repository.

## Building

```sh
# unsigned release (what CI produces)
npx tauri android build --ci --aab --apk --target aarch64 armv7 i686 x86_64
# signed release on the release machine: point at the keystore's properties file
SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES=~/.tauri/snowraven-android-keystore.properties \
  npx tauri android build --ci --aab --apk --target aarch64 armv7 i686 x86_64
```

Outputs: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk` and `.../bundle/universalRelease/app-universal-release.aab`. The first build on a clean machine downloads Gradle 8.14.3 and the Maven dependencies, then compiles the Rust library twice (once by the CLI, once by Gradle's Rust task); about six minutes for one target on an M1 Pro.

## The upload keystore: a user-performed step

No production keystore exists and no agent creates one. When the user decides to sign Android releases (the GitHub-release APK at least), they run this once on the release machine, in their own terminal, and keep a backup of the file and both passwords somewhere safe (a lost keystore means a later APK cannot update an installed one):

```sh
keytool -genkeypair -v -keystore ~/.tauri/snowraven-upload.jks -storetype PKCS12 \
  -alias snowraven-upload -keyalg RSA -keysize 4096 -validity 10000
```

then writes `~/.tauri/snowraven-android-keystore.properties` (mode 0600):

```properties
storeFile=/Users/<you>/.tauri/snowraven-upload.jks
storePassword=<the store password>
keyAlias=snowraven-upload
keyPassword=<the key password>
```

How that key is used by a store (Play App Signing was the original plan; the 2026-10-03 direction moves the store leg to F-Droid, which builds and signs from source itself) is for the revised release leg to state.

## The throwaway key used for this run's emulator checks

`/private/tmp/claude-502/.../scratchpad/throwaway-keystore/THROWAWAY-snowraven-emulator-only.jks` (PKCS12, alias `throwaway-emulator`, 30-day validity, subject `CN=THROWAWAY emulator verification only, O=not for release`), in the session scratchpad, never under the repository or `~/.tauri`. Its certificate SHA-256 is `e953b8edd83734f0e9a9ba988d212087f6f9ad46990860e38eef6e2d43e645a4`. Nothing signed with it may be distributed.
