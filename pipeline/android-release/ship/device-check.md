# The device checks this release owes, before anything is published

Two checks by you, on your own devices, because no agent may touch a physical device (CLAUDE.md, device boundary). Agents give these steps and record only what you report, with the time. Relay one step at a time.

1. **Android:** the exact signed APK, sideloaded on your Android phone or tablet, before it is attached to the published GitHub release.
2. **iPhone and iPad:** the exact TestFlight build of 1.0.53, before the App Store version record is submitted.

If you have no Android device, say so: the Android check is then recorded Partial, and whether the APK is attached anyway is your decision, written down with its reason (`attach.sh` takes `ANDROID_DEVICE_CHECK=partial` only after that sentence exists).

---

## A. Android: the signed APK

**Status for 1.0.53: not performed.** The user owns no Android device and chose, in writing, to publish the APK on emulator evidence (`decisions.md`, part 1b); FR-44 is Partial. These steps stay for a future device.

**What you are checking:** the file the Deployer will attach, byte for byte. Its SHA-256 is recorded when it is handed to you, and `attach.sh` refuses to upload any file whose SHA-256 differs.

**How it reaches you:** a link on this Mac's tailnet (`https://hephaestus-developer.giraffe-chuckwalla.ts.net:<port>/SnowRaven_1.0.53_android_universal.apk`), so the phone needs Tailscale on and signed in to your tailnet. If it does not have Tailscale, say so and the Deployer puts the file on a separate draft GitHub release instead (never on the published 1.0.53 release, which is the order the 1.0.31 crash taught).

**The steps** (schema 8.3, verbatim; step 8's location sentence does not apply, because the Android app has no location controls):

1. On your Android phone, open the link we send and download `SnowRaven_1.0.53_android_universal.apk`. When you open the downloaded file, Android will say the phone is not allowed to install unknown apps from this source and offer Settings; allow it for your browser or Files app (a one-time switch), come back, and press Install. Tell us if you saw anything other than that prompt and an Install button.
2. Open SnowRaven. Tell us what you see first: green with the raven mark, then the app; or a message about Android System WebView; or anything else, in your words.
3. Go to Settings, Default Files. Press Import on the eBird row and pick your eBird backup CSV; then Import on the ML row and pick your Macaulay export. Tell us whether each row now shows the filename and date.
4. Enter your eBird and OpenWeather keys in Settings.
5. Open Weather, pick a recent checklist, and tell us whether the weather and tide text appears.
6. Open Species Detail, search for a species, and tell us whether the page fills in.
7. Open Statistics and tell us whether the totals appear.
8. Open Map Explorer and tell us whether the map and hotspots appear.
9. Open Targets and tell us whether a county and its list appear.
10. Reply with the result of each step in one line. If anything looked wrong, a screenshot helps, but your sentence is enough.

**Good to know before you start (not steps):**

- The backup and export files need to be on the phone first (Downloads is easiest; email them to yourself, or copy them over USB).
- On Android, Macaulay Library photos, sounds and videos open in your browser rather than playing inside the app, and there is no "use my location" button anywhere; choose a place by searching or by coordinates. Both are by design.
- This install is the GitHub build, signed with your key. If you later install SnowRaven from F-Droid, Android will refuse to install one over the other; switching means uninstalling first, which deletes the files and keys stored in the app.

**What the Deployer records:** each step's result in your words, the time you reported it, the SHA-256 of the file you were sent and the signer's certificate SHA-256, all before `attach.sh` runs.

---

## B. iPhone and iPad: the TestFlight build

**What you are checking:** TestFlight build 1.0.53 (1), the exact build the App Store record will point at. A green suite, green CI and a simulator screenshot are not evidence that an iOS release build launches (the 1.0.31 crash), so this comes before the submission.

1. When the Deployer says build 1.0.53 (1) is ready in TestFlight, open TestFlight on your iPhone and install SnowRaven 1.0.53 (1).
2. Open it. Tell us whether it opens to the app (not a crash back to the home screen, and not a blank screen).
3. Go to Settings, Appearance, and choose System.
4. With SnowRaven still open, switch your iPhone between light and dark (Control Center, long-press brightness, Dark Mode). Tell us whether SnowRaven follows the change while it stays open. This is the one change in 1.0.53 you can see on iPhone and iPad.
5. Open Statistics and Map Explorer and tell us whether each fills in as usual.
6. In Map Explorer, choose Hotspots and press the locate button (or, on Weather, press Current). Tell us whether it finds where you are. This build moved the iPhone and iPad location permission into its own file so that Android could ship without any location code; no automated check runs it on an iPhone, so this step is the only one that does.
7. Look at one of your home-screen widgets (if you use them) and tap it; tell us whether it opens Map Explorer.
8. If you use SnowRaven on an iPad, repeat steps 1, 2 and 6 there.
9. Reply with one line per step. If something is wrong, the fix ships as build 1.0.53 (2) before any record is submitted.

**What the Deployer records:** your result per step and the time, before the App Store version record is created or repointed.
