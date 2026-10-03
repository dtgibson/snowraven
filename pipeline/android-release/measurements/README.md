# FR-55 measurement: Android location, branch A or B (2026-10-03)

The recording schema 4.6 asks for, run by The Engineer before any location-path commit. Result: **branch B stands** (step 9 failed on the Google APIs image).

## Setup

- **Image:** `system-images;android-36;google_apis;arm64-v8a` (AVD `sr-api36-phone`, Pixel 7 profile), emulator run with `-gpu host`.
- **WebView:** `com.google.android.webview` 133.0.6943.137 (`dumpsys webviewupdate`: current and preferred provider).
- **Build:** a release-profile build through the committed entry (`npm --prefix frontend run build`, then `sh scripts/android/build-apk.sh`) with the branch-A plumbing applied in the working tree only (`ANDROID_LOCATION_BRANCH = 'A'` and the two location permissions in the manifest), never committed. `aapt2`: package `com.dtgibson.snowraven`, versionName 1.0.48, versionCode 1000048, native code arm64-v8a, armeabi-v7a, x86_64; permissions INTERNET, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION (plus androidx.core's signature-level DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION); one activity.
- **Signer:** the THROWAWAY key, certificate SHA-256 `e953b8edd83734f0e9a9ba988d212087f6f9ad46990860e38eef6e2d43e645a4` (`apksigner verify --print-certs`).
- **Fixed position:** `adb emu geo fix -76.5019 42.4440` (Ithaca, NY).
- **Network attribution:** the app's own TCP peers, read from `/proc/net/tcp` and `/proc/net/tcp6` filtered by the app's UID (10214) every 2 seconds, owners from `whois`. A whole-emulator packet capture was not used because the image's own Google services traffic would be indistinguishable from the app's.

## Steps (sdk_gphone64_arm64/)

| Step | Reading | Result |
|---|---|---|
| 0 | `isSecureContext` and `'geolocation' in navigator` were not read directly (a release WebView has no remote debugging); steps 1 to 3 working implies both true | inferred pass |
| 1 | Fresh install, Map Explorer, Hotspots view, press the locate disc: Android's own dialog, "Allow SnowRaven to access this device's location?", Precise and Approximate, While using the app / Only this time / Don't allow; nothing of ours before it (`step1-system-permission-dialog.png`) | pass |
| 2 | Precise, While using the app: the disc spins at 3 s (`step2-after-3s.png`); by 7 s the map is centered on the fixed point with the device pin and no location error (`step2-after-7s.png`; the red note is the expected missing-eBird-key line from the Hotspots search) | pass, under 7 s |
| 3 | Press again: no dialog; the position returns within about 3 s (`step3-second-press-after-3s.png`) | pass |
| 9 | **The app's UID holds a TLS connection to a Google LLC address, `172.217.118.4:443`, in every 2-second sample across 30 seconds after a locate press** (`conns-during-locate.log`, and the same peer in `conns.log` during step 3). Controls: a cold start idling on the first tab, and the Map Explorer open without a locate press, each sampled the same way for 30 seconds, show **no** connection at all (`conns-control-no-location.log`, `conns-control-map-no-locate.log`). So the Google connection follows the location request. | **fail** |
| 4 to 8 | not run: step 9 is a deciding step and failed, so the branch was already decided | not run |

**Not attributed:** which component in the app's process opens the connection (the WebView's geolocation path or something it triggers) was not established; the address has no reverse DNS name. Whatever it is, it runs under SnowRaven's UID when a position is asked for, which is what FR-54 and step 9 forbid.

**The AOSP image reading** (`sr-api36-aosp`, the de-Googled reading) was not run: under schema 4.6 it can only add a Help sentence or a flag to branch A, and branch A did not pass. It would be the place to attribute the connection (if the same Google connection appears on an image with no Google services, it comes from the WebView itself).

## Decision

Branch B stands: `ANDROID_LOCATION_BRANCH = 'B'`, the manifest declares INTERNET only, and the five location controls are absent on Android. The scratch branch-A edits were reverted and the working tree matches the committed branch B. Reversal: a re-run of this table in which step 9 shows no connection to a Google address during a fix (for example on a later WebView, or with the connection attributed and removed), then the branch-A edits of schema 5.3.
