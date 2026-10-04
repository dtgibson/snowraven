# QA-52 measurement: the Google connection at launch, with the WebView's Safe Browsing off (2026-10-03)

The question from the Tester's QA-52: SnowRaven's own process opened a TLS connection to a Google address within a second of every cold launch on the plain (AOSP) API 36 image, and the Google APIs image's logcat showed the WebView binding Google Play services' `SafeBrowsingService`. The fix on trial is the manifest meta-data `android.webkit.WebView.EnableSafeBrowsing = false`, inside `<application>`. Result: **the meta-data is in the built APK and stays, but it is not what opens the connection.** With it in place the app's own process still opens exactly one TLS connection to a Google host at every cold launch on both images, and a packet capture names the host: **`content-autofill.googleapis.com`**, the Android System WebView's autofill server query for the page's form fields. The variations seed and the component updater are ruled out by the same capture.

## Setup

- **Images:** `sr-api36-phone` (`sdk_gphone64_arm64`, `system-images;android-36;google_apis;arm64-v8a`, WebView `com.google.android.webview` 133.0.6943.137) and `sr-api36-aosp` (`sdk_phone64_arm64`, `system-images;android-36;default;arm64-v8a`, no Google Play services, WebView `com.android.webview` 133.0.6943.137). Both run `-gpu host`, both userdebug, so `adb root` works and `ss -tanpe` names the owning process and uid of every socket.
- **Build:** the release-profile APK built at 19:47 from the working tree through the committed entry (`npm --prefix frontend run build`, then `sh scripts/android/build-apk.sh`), signed with the THROWAWAY key. `aapt2 dump xmltree` on it shows the meta-data as a direct child of `<application>` (line 44 of the merged manifest), before the activity and the two providers. The pre-fix comparison APK is the one built at 10:05 the same day (no `EnableSafeBrowsing` meta-data; otherwise the same tree apart from the fix-1 import change).
- **Method (the Tester's, with process attribution added):** three cold launches per image, each `am force-stop`, `pm clear`, `am start -W`, then 15 samples two seconds apart of every TCP socket on the device with its process, pid and uid (`sb-launch.sh`). Owners by `whois`. Then, to name the host, one cold launch per image and per APK under an on-device `tcpdump` of DNS and TLS (`pcap-launch.sh`), because the emulator's own packet capture stops after boot and `/proc/net/tcp` carries no server name.
- **Raw captures:** `sdk_gphone64_arm64/` and `sdk_phone64_arm64/` hold every `ss` sample (`*-launch-N.log`), the launch's WebView-related logcat (`*-logcat-N.log`), the Safe Browsing logcat A/B (`*-safebrowsing-N.log`) and the four packet captures (`*.pcap`). `summary.md` is `summarize.py` over the six launch captures; `pcap-summary.txt` is `pcap-summary.sh` over the four captures.

## Three cold launches per image, Safe Browsing off (`summary.md`)

| Image | Launch | App pid | App uid | Google connection from the app's uid | Process that owns it | Samples |
|---|---|---|---|---|---|---|
| Google APIs | 1 | 12136 | 10242 | `172.217.116.4:443` (GOOGLE) | `com.dtgibson.snowraven` | 14 of 15 |
| Google APIs | 2 | 12399 | 10242 | `172.217.116.4:443` (GOOGLE) | `com.dtgibson.snowraven` | 14 of 15 |
| Google APIs | 3 | 12629 | 10242 | `172.217.116.4:443` (GOOGLE) | `com.dtgibson.snowraven` | 14 of 15 |
| Plain (AOSP) | 1 | 2243 | 10151 | `172.217.115.4:443` (GOOGLE) | `com.dtgibson.snowraven` | 14 of 15 |
| Plain (AOSP) | 2 | 2508 | 10151 | `172.217.115.4:443` (GOOGLE) | `com.dtgibson.snowraven` | 14 of 15 |
| Plain (AOSP) | 3 | 2707 | 10151 | `172.217.115.4:443` (GOOGLE) | `com.dtgibson.snowraven` | 14 of 15 |

The connection is the app's own: `ss` names `com.dtgibson.snowraven` (shown truncated as `ibson.snowraven`) with the app's pid, under the app's uid, `ESTAB`, held for the whole 30 s window from the first sample after launch. No other peer appears under the app's uid in any of the six launches (the first tab makes no provider request without a key).

Other processes seen talking to Google in the same windows, for the record and none of them the app's: on the Google APIs image, Play services (`com.google.android.gms`, `.gms.persistent`, `.gms.unstable`, uid 10144), Messages (uid 10146) and the Google app (uid 10147), all pre-existing `CLOSE-WAIT` or GCM sockets; on the plain image, **the WebView package's own process `com.android.webview:webview_apk` (uid 10103) opened `172.253.115.100:443` for two samples in launch 1**, which is where the WebView's variations seed and component updates run, in that package's process and uid, not the app's.

## Naming the host (`pcap-summary.txt`)

| Image | APK | DNS queries in the launch window | TCP connection from the app's address |
|---|---|---|---|
| Plain (AOSP) | Safe Browsing on (pre-fix) | `AAAA content-autofill.googleapis.com` | `172.217.112.4:443` |
| Plain (AOSP) | Safe Browsing off | `A` and `AAAA content-autofill.googleapis.com` | `172.217.112.4:443` |
| Google APIs | Safe Browsing on (pre-fix) | none (resolver cache; the address is the one below) | `172.217.116.4:443` |
| Google APIs | Safe Browsing off | `A` and `AAAA content-autofill.googleapis.com` | `172.217.116.4:443` |

In every capture the only name asked for between launch and the connection is `content-autofill.googleapis.com`, and the one IPv4 connection follows it (eight IPv6 attempts to `2001:4860:48xx::` precede it and fail, the emulator having no IPv6 route). No `safebrowsing.googleapis.com`, no `clientservices.googleapis.com` (the variations seed), no `update.googleapis.com` (the component updater), on either image, with either APK.

What it is: Chromium's autofill crowdsourcing query. The WebView creates its autofill provider for every WebView unconditionally (`AwContents.initializeAutofillProvider`, gated only by the WebView's own Safe Mode), `AndroidAutofillManager::ShouldParseForms()` returns `true`, and `AutofillManager::OnFormsParsed` sends `AutofillCrowdsourcingManager::StartQueryRequest` for every parsed form with a queryable field (Chromium 133 sources, `components/android_autofill` and `components/autofill`). SnowRaven's first tab has form fields, so the query is sent on every load. There is no manifest key, `WebSettings` call or view attribute that turns the query off; `importantForAutofill` governs the platform autofill service, not this request, and that last clause was measured rather than taken from the source (the next section).

## Not important for autofill: measured, no change (part C, 2026-10-03)

The one thing part B had not tried: `webView.importantForAutofill = View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS` in `onWebViewCreate`, before the two listeners. A release APK with that line (built 20:37 from the working tree, throwaway key; its dex carries `setImportantForAutofill`) was installed on both images and cold-launched three times each under the same DNS-and-TLS capture (`pcap-launch.sh`; captures `*-afoff-pcap-N.pcap` and the run logs `*-afoff-run.log` beside the earlier ones).

| Image | Launch | App pid | App uid | DNS in the window | TCP connection from the app's socket (`ss`) |
|---|---|---|---|---|---|
| Google APIs | 1 | 18599 | 10257 | `A` and `AAAA content-autofill.googleapis.com` | `172.217.115.4:443`, `ESTAB`, `com.dtgibson.snowraven` |
| Google APIs | 2 | 18811 | 10257 | none (resolver cache) | `172.217.115.4:443`, `ESTAB`, `com.dtgibson.snowraven` |
| Google APIs | 3 | 18962 | 10257 | none (resolver cache) | `172.217.115.4:443`, `ESTAB`, `com.dtgibson.snowraven` |
| Plain (AOSP) | 1 | 2234 | 10151 | `A` and `AAAA content-autofill.googleapis.com` | `172.217.119.4:443`, `ESTAB`, `com.dtgibson.snowraven` |
| Plain (AOSP) | 2 | 2389 | 10151 | none (resolver cache) | `172.217.119.4:443`, `ESTAB`, `com.dtgibson.snowraven` |
| Plain (AOSP) | 3 | 2540 | 10151 | none (resolver cache) | `172.217.119.4:443`, `ESTAB`, `com.dtgibson.snowraven` |

Verdict: the query continues, six launches of six, so the line was reverted and nothing in `MainActivity.kt` changed. The only other name in any of the six captures is one `clientservices.googleapis.com` lookup on the Google APIs image a minute before launch 1, from a socket `ss` never attributed to the app (the WebView package's variations seed after the reinstall), the same bystander part B recorded on the plain image. The held copy stays as part B wrote it: the app turns off Safe Browsing, and the WebView it does not control still makes this one query.

## The Safe Browsing half

- On the plain image Safe Browsing never produced a request: with no Play services the WebView's Safe Browsing has nothing to bind, and the pre-fix capture shows the same single autofill connection as the post-fix one. The Tester's AOSP finding (3 of 3 launches) was this autofill query all along.
- On the Google APIs image the pre-fix APK's first launch after install bound Play services' `SafeBrowsingService` (`BoundBrokerSvc: onBind ... com.google.android.gms.safebrowsing.SafeBrowsingService.START`, device clock 20:12:08, in the live logcat), as the Tester recorded. Any lookups that follow run in Play services' process and uid, which the app-uid method never attributed to the app. The two-launch logcat A/B afterwards (`gapis-sbon-safebrowsing-*.log`, `gapis-sboff-safebrowsing-*.log`) shows zero Safe Browsing lines for both APKs, so the binding is logged at most once per Play services process life and is not a per-launch signal; it cannot carry a before/after claim on its own.
- The meta-data stays: it is the documented application-level opt-out, it sits where the WebView reads it, `androidProjectPins.test.ts` pins it, and it removes the Play services `SafeBrowsingService` binding the app's WebView was making. What it does not do is remove the launch connection. (Corrected at security M2, 2026-10-03: it was not "the one" Play services binding. AndroidX's emoji initializer bound Play services' font provider at every launch until its manifest removal, and the WebView's own downloadable-font lookup still does; both are measured in `../emoji-initializer/README.md`.)

## What remains, and whose it is

One TLS connection per cold launch, from SnowRaven's own process and uid, to `content-autofill.googleapis.com`, made by the Android System WebView's autofill component for the page's form fields, on both images, before and after the Safe Browsing change. Nothing in the app's own code names a Google host that is fetched (the bundle names `maps.google.com` only as a link target). Marking the WebView not important for autofill does not remove it (measured above). Open idea, not done here: whether a page shape without a queryable form at load, or a later WebView, removes it.
