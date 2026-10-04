# M2: the emoji initializer's font-provider binding, before and after (2026-10-03)

The security review's M2: AndroidX's `EmojiCompatInitializer`, merged into the manifest by `appcompat` through `androidx.startup.InitializationProvider`, asks the phone's font provider for "Noto Color Emoji Compat" at every launch, and on a phone with Play services that provider is `com.google.android.gms.fonts`, an IPC from this app's process to a Google service. The fix is the `tools:node="remove"` entry in `app/src/main/AndroidManifest.xml`, pinned by `androidProjectPins.test.ts`. This folder holds the before and after readings taken with one script (`measure-emoji.sh`, the review's method), run by The Engineer at 21:50 and 21:51.

## Setup

- **Image:** `sr-api36-phone` (`sdk_gphone64_arm64`, `system-images;android-36;google_apis;arm64-v8a`, build `BE2A.250530.026.F3`, userdebug), `-gpu host`, WebView `com.google.android.webview` 133.0.6943.137. Play services' `FontsProvider` runs in `com.google.android.gms.persistent` (pid 1248 in both runs).
- **Builds:** release-profile universal APKs through the committed entry (`npm --prefix frontend run build`, then `sh scripts/android/build-apk.sh`), both signed with the THROWAWAY emulator key (certificate SHA-256 `e953b8ed...645a4`), installed fresh (uninstall first), emulator only, never distributed.
  - *Before:* the HEAD (`71bb192`) build of 20:53, unsigned SHA-256 `6ac72f07...8ec055`, signed `4c0ddd06...1cea96`. Its merged manifest carries `androidx.emoji2.text.EmojiCompatInitializer` under the startup provider (`aapt2 dump xmltree`).
  - *After:* the same tree with the manifest fix (and the M3 `MetricsOptOut` meta-data), signed `b03fc4e0...ab5b65`. Its merged manifest's startup provider carries only `ProcessLifecycleInitializer` and `ProfileInstallerInitializer`, and `android.webkit.WebView.MetricsOptOut=true` sits beside `EnableSafeBrowsing=false` under `<application>`.
- **Method:** force-stop the app, 20 s idle control window with logcat cleared, then `am start -W` of `.MainActivity`; `dumpsys activity providers` sampled at about 1, 2, 3, 5 and 8 s for the `FontsProvider` record's `Connections:` lines naming the app's process; at 12 s, logcat counted for lines naming `Noto Color Emoji Compat` and for androidx emoji2's own query string `emojicompat-emoji-font` (`DefaultEmojiCompatConfig`). Raw output in `before-measure.log` and `after-measure.log`.

## Readings

| Reading | Before (HEAD) | After (fix) |
|---|---|---|
| Idle control, 20 s, app stopped: `Noto Color Emoji Compat` lines | 0 | 0 |
| Idle control: `FontsProvider` connections from the app | none | none |
| Launch, 12 s: logcat lines naming `Noto Color Emoji Compat` | 6 | 3 |
| Launch: androidx emoji2's query `[emojicompat-emoji-font]` | **1** | **0** |
| Launch: `FontsProvider` `Connections: -> <pid>:com.dtgibson.snowraven` | present at 1, 2, 3 and 5 s, gone by 8 s | present at 1, 2, 3 and 5 s, gone by 8 s |

## What the two halves of the "before" were, and what remains

The six `FontLog` lines of the before run are two different clients:

1. **`Received query Noto Color Emoji Compat` / `Query [emojicompat-emoji-font] resolved to ...`** (3 lines): androidx emoji2's default configuration, run by the `EmojiCompatInitializer` at startup. **Gone after the fix** (0 of the query string in the after run). This is the binding M2 named and the manifest entry removes.
2. **`Received query name=Google Sans&weight=700&besteffort=false`, `name=Noto Color Emoji Compat&weight=400&besteffort=false`, `name=Google Sans Flex&weight=400&...`, `name=Google Sans&weight=400`, `name=Google Sans&weight=500`** (the remaining lines, present in both runs): this is the Android System WebView's own downloadable-font lookup. Chromium 133's `org.chromium.content.browser.font.AndroidFontLookupImpl` builds exactly these five queries (`createFontQuery("Google Sans", 400/500/700)`, `("Noto Color Emoji Compat", 400)`, `("Google Sans Flex", 400)`) against the hard-coded provider `com.google.android.gms.fonts` using the application context, so the request runs under the app's uid and pid, which is the `Connections:` line that survives the fix. That class has no feature flag, preference or app-level switch; a failed fetch is remembered and not retried, and on a phone without Play services no provider answers. The app names no Google font anywhere; the WebView fetches these for web content in general.

So after the fix **the app's own libraries make no request to Google's font provider**, and what remains is the WebView's, the same shape as the autofill query recorded in `../safe-browsing/README.md`: a system component contacting Play services on its own initiative from inside the app's process, with no setting the app can turn off. The held copy and the privacy patch (d5) name both measured WebView contacts (`held-copy.md`, security M3).

## Emoji still render

`after-help-weather-emoji.png` is the fixed build's Help page, Weather section, on the API 36 emulator, with the ☁️🌔 example rendered by the WebView's own emoji font. The initializer served AppCompat's native text views, none of which shows content in this app; the WebView never used it.

## Reversal

The entry comes out only if a native AppCompat text view that shows user content is added to the Android app, in which case the font query it brings back is re-measured and recorded here before it ships.
