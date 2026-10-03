# The Android build's merged dependency tree (2026-10-03)

Evidence for the revised direction "nothing from Google compiles, links or is requested on Android". Read from the committed project after `tauri-plugin-geolocation` became iOS-only, with the branch-B manifest.

- **Command:** `gradle -q :app:dependencies --configuration universalReleaseRuntimeClasspath` (and `...CompileClasspath`) in `src-tauri/gen/android`, Gradle 8.14.3, after a full `scripts/android/build-apk.sh` build. The two outputs are kept beside this file.
- **Gradle projects in the build:** `:app`, `:tauri-android`, `:tauri-plugin-clipboard-manager`, `:tauri-plugin-dialog`, `:tauri-plugin-fs`, `:tauri-plugin-opener`. No geolocation module.
- **Proprietary families, none:** no coordinate in `com.google.android.gms`, `com.google.firebase`, `com.google.android.play`, `com.android.billingclient`, `com.google.android.ads`, `com.google.mlkit` or `com.google.android.libraries` appears in the runtime tree.
- **Every `com.google.*` coordinate that does appear**, each an open-source library under Apache-2.0 and none a Google service:
  - `com.google.android.material:material` (requested at 1.7.0 and 1.12.0, resolved to 1.12.0): Material Components, from the Tauri template and every plugin.
  - `com.google.errorprone:error_prone_annotations:2.15.0`: compile-time annotations, pulled in by androidx.
  - `com.google.guava:listenablefuture:1.0`: the one-interface stub androidx depends on.
- **Jackson** stays at 2.15.3 (core, annotations, databind), as Tauri pins it; this is the version whose `ExceptionUtil.isFatal` sets the API 26 floor (decisions.md, BLOCKER).
- **The merged manifest** of the same build (`aapt2 dump badging`): permissions `INTERNET` and androidx.core's signature-level `com.dtgibson.snowraven.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` only; one activity; native code `arm64-v8a`, `armeabi-v7a`, `x86_64`.
- **Independent check:** F-Droid's own `fdroid scanner` (fdroidserver 2.4.5) reported 0 problems on the recipe with the verified `scandelete` fix (`pipeline/android-release/fdroid-verification.md`).
