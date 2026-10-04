# Held copy: Android release (the F-Droid leg)

**Status: HELD. Nothing here is published.** Each surface below is written only after the user reads the exact text and says yes (CLAUDE.md, "Published copy needs the user's approval first"). The staged Fastlane files are under `pipeline/android-release/fdroid/fastlane-proposal/en-US/` and hold exactly the listing text in section (a) and the screenshots in section (b); on the yes they move to `fastlane/metadata/android/en-US/` in the same commit that adds `fastlaneMetadata.test.ts`, before the tag (schema 6.5).

**Location branch: B, decided by the measurement (2026-10-03).** The FR-55 measurement is recorded in `decisions.md` ("FR-55 measurement ... branch B stands") and `pipeline/android-release/measurements/`: its step 9 failed (during a fix the app's own UID held a connection to a Google address). So Android has no location controls and a place is typed or searched for. Every location-dependent passage below is still given in both forms, labeled **Branch A** and **Branch B**, because the decision has a reversal condition; **only the Branch B forms apply**, and the staged files carry them. (The branch-A edit seen in the working tree while this was drafted was the measurement build's scratch edit, reverted after the run.)

## Decisions for you

1. **Location branch:** set by the measurement, not by you: Branch B. Nothing to choose; the Branch A forms are kept only for the recorded reversal.
2. **The `NonFreeNet` reason sentence:** a revised sentence (proposed) or the schema's original. Section (a), "NonFreeNet".
3. **F-Droid category:** `Science & Education` (the schema's default), with `Navigation` the schema's named alternative. F-Droid's current list also has `Weather`, which the schema did not consider.
4. **Website and README timing:** the APK-only form at the first ship, then the F-Droid form once the listing is live; or hold both sentences until the listing is live. Section (c).
5. **Optional companion edits:** other places on the website and README that list platforms would omit Android once it ships. Each is shown exactly; say yes or no to each. Section (c).
6. **Privacy policy:** a new `## Android App` section placed after `## iCloud Sync`. Section (d).

Two sentences are **gated on a record, not on you**: the "no Google services" sentence in the listing (a) and in the policy (d5) is written only once the FR-54 record exists in `decisions.md` (the merged release dependency tree and a clean `fdroid scanner` run, after the geolocation plugin's move to iOS-only). **The record now exists** (2026-10-03): `decisions.md`, "Nothing from Google's proprietary families is in the Android build", with the trees under `measurements/dependency-tree/` (no Play services, Firebase, Play, billing, ads or ML Kit coordinate; the three `com.google.*` libraries present are Apache-2.0 open source, not services), and `fdroid-verification.md` (the scanner found 0 problems on the committed recipe's build entry). One caution for the wording: Material Components' Maven group is `com.google.android.material`, so the sentence should say "no Google services", never "nothing from Google". **A second caution from QA-52 (2026-10-03):** "no Google services" is about what is IN the app and stands; "makes no request to Google" was about the network and is withdrawn, because the Android System WebView makes one from inside the app's process at every launch (`measurements/safe-browsing/README.md`). Both blocks now say so in the same words, (a) and (d5).

---

## (a) The F-Droid listing (Fastlane metadata)

### Title (`title.txt`)

```text
SnowRaven
```

9 characters (F-Droid allows 50). `fastlaneMetadata.test.ts` pins this value.

### Short description (`short_description.txt`)

```text
Birding tools and data explorer for your eBird and Macaulay Library exports
```

**75 characters** (limit 80), counted without the trailing newline; no trailing period, and it does not repeat the app name. It echoes the README's opening line ("birding tools and data explorer for your eBird workflow") with "self-hosted" dropped, since the Android app is not self-hosted.

### Full description (`full_description.txt`)

Plain text. F-Droid converts each line break to `<br>`, so a blank line separates blocks and each tab name stands on its own line above its sentences. The tab blocks are the README's approved tab sentences, word for word, in `DEFAULT_TAB_ORDER` named from `TAB_LABELS`; the Privacy block is the README's posture sentence with the iCloud clause dropped (iCloud is not on Android) plus the gated no-Google sentence; "What you'll need" is the README's and website's requirement text; the last line is the website footer's attribution. 3,996 characters as staged, 4,034 with the Branch A Weather line (F-Droid's limit is 4,000, so the Branch A form would need a trim of 34 characters elsewhere; it is not the form in force).

Staged text (Branch B):

```text
SnowRaven reads your eBird and Macaulay Library exports and gives you weather and tides for your checklists, your history with every species, life-list statistics and an interactive map, on your own phone or tablet. It is free and open source, built by one birder for their own data, and it works alongside eBird and the Macaulay Library.

Weather
Paste a checklist ID and get a weather and tide summary ready to drop into the checklist comment, or look up the forecast for any place and time ahead. The Weather/tide Planner lays out the coming sunrises and sunsets, each with its tide and forecast weather.

Statistics
A dashboard built from your eBird backup: life-list totals and growth, milestones, and when and where you bird. A weather section reads back the weather blocks SnowRaven and RainCrow write into checklist comments: the conditions on the outings you wrote a block for.

Map Explorer
Your sightings on an interactive map, with nearby eBird hotspots and where species new to you were reported recently. Counties shade by your counts or by how complete your county list is, with a California Breeding Bird Atlas overlay.

Species Detail
Your whole history with one bird: sightings, field notes, breeding codes, a map of every observation and any splits or lumps along the way. A weather card shows the skies and temperatures you found it in, from SnowRaven and RainCrow weather blocks.

Calendar
A year of your birding as twelve month grids, each day shaded by how many species you saw. Fold the years together, or narrow it to a single species.

Targets
A county's targets over your own record: the lifers there, the birds you have yet to photograph, record or film, and the ones you have never given a breeding code. Rank them by eBird's frequencies or by what has been reported lately.

Multimedia
Your life list as a media checklist: which species you have photographed, recorded and filmed, and which you still need. Narrow it by sex and age.

Breeding Codes
Every species you have recorded breeding evidence for, as a matrix against eBird's breeding codes, colored by evidence tier.

Checklists
Your checklists as whole outings: search every comment you have written, and filter by what an outing has.

List Comparer
Two life lists side by side, or any two public checklists: what they share and what only one has.

Named Birds
Tag an individual bird by name in a species comment and SnowRaven gathers everything you have on it: sightings, places, a timeline, its own media. With several named birds, one strip puts them all on a shared time axis.

Privacy
Private by default, and in your control: no account, no analytics, no telemetry, no server we run. Your eBird backup, Macaulay Library export and API keys stay on your device, and in your phone's own backup if you use one. The Android app has no Google services, no Firebase and no crash reporting; its own code makes no request to Google, and a font request by one of its libraries is removed. The Android System WebView, which draws its screens, contacts Google on its own: SnowRaven turns off its Safe Browsing and usage statistics; its font lookup at launch and autofill query when form fields first appear have no setting that stops them. Privacy policy: https://snowraven.dtgibson.com/privacy.html

What you'll need
A free eBird API key and a free OpenWeather API key subscribed to its One Call by Call plan (activating it needs a payment card on file; set a usage cap to avoid charges), entered once in Settings. Most tabs also read your eBird backup and, for the media features, an optional Macaulay Library export.

Network services
SnowRaven relies on network services that are not free software, chiefly eBird for checklist details, hotspots and recent sightings, and OpenWeather for weather, each used with your own API key; the Android System WebView also contacts Google on its own.

Weather by OpenWeather. Checklist and media data from eBird and the Macaulay Library. Tides from NOAA Tides & Currents.
```

**Branch A swap (the Weather block's first sentence, which is the README's sentence unchanged):**

```text
Paste a checklist ID and get a weather and tide summary ready to drop into the checklist comment, or look up the conditions where you are now, or the forecast for any place and time ahead.
```

Under Branch B the Current lookup is absent from the Weather tab (design spec section 7), so "the conditions where you are now" is dropped; the place-and-time forecast is Plan, which stays. No other block depends on the branch. **The Google sentences, revised after QA-52 (2026-10-03):** the earlier line "it makes no request to Google" is withdrawn. The measurement in `measurements/safe-browsing/README.md` shows the app's own process opening one TLS connection to `content-autofill.googleapis.com` at every cold launch on both API 36 images, with the WebView's Safe Browsing on and off: it is the Android System WebView's autofill query for the page's form fields, which no manifest key or setting turns off. What the record supports, and what the block now says: no Google services, Firebase or analytics library in the app (the FR-54 dependency tree and `fdroid scanner`); the app's own code makes no request to Google (the bundle names no Google host that is fetched); the WebView, a system component, makes requests of its own to Google from inside the app, named by example; SnowRaven turns off its Safe Browsing check (the manifest meta-data, pinned by `androidProjectPins.test.ts`) and has no setting for the rest. The same sentences go into the policy (d5), so the listing claims nothing the policy does not. **Revised again after the security review (M3, L1, 2026-10-03):** "cannot turn off the rest" was a universal negative the record did not support, and two switches it covered were unused. The block now states what is switched off and what was measured: Safe Browsing (`EnableSafeBrowsing=false`), the WebView's per-app usage statistics (`MetricsOptOut=true`, added at M3) and the font request AndroidX's emoji initializer made to Play services' font provider at every launch (removed from the merged manifest at M2; `measurements/emoji-initializer/README.md`), all three pinned by `androidProjectPins.test.ts`. What remains, both measured on the API 36 Google APIs image after the fixes, is the WebView's own: the autofill query to `content-autofill.googleapis.com` and its downloadable-font lookup (Chromium's `AndroidFontLookupImpl`, five font queries to Play services' font provider from the app's process), neither of which has an app-level setting; the block says "have no setting that stops them", a statement about the settings that exist, not a claim that none can. The word "measured" and "Google Play services" were cut for the 4,000-character cap and live in d5. The L1 clause ("and in your phone's own backup if you use one") qualifies "on your device" with the backup fact d5 already states. "no analytics" is said once, in the posture sentence, so the Android sentence names Google services, Firebase and crash reporting. The `NonFreeNet` sentence lost "that draws its screens" for the same cap; the WebView is introduced in the Privacy block above it. **Reworded after the Tester's delta re-check (2026-10-03; `decisions.md`, "Held copy wording after the delta re-check"):** the autofill query is no longer "at launch" (it was measured when a screen with form fields first opens, and once not at all on a cold start with a warm cache), so the block says "its font lookup at launch and autofill query when form fields first appear"; the removed font request is attributed to "one of its libraries" in the app sentence, so it no longer reads as the WebView's. The tab blocks and the posture sentence are approved word for word and could not give up characters, so the two Google sentences paid for their own growth: "contains ... crash-reporting library" became "has ... crash reporting", "The phone's" and "from inside the app" were dropped ("which draws its screens" carries that the contact is from inside the app; d5 keeps both), and the font clause's "to Google" is carried by the clause before it.

### NonFreeNet: the one-sentence reason (schema 6.5)

F-Droid asks that the reason be in the description; the staged description carries it under "Network services", and the same sentence becomes the recipe's `AntiFeatures: NonFreeNet: en-US:` value.

**Proposed:**

```text
SnowRaven relies on network services that are not free software, chiefly eBird for checklist details, hotspots and recent sightings, and OpenWeather for weather, each used with your own API key; the Android System WebView also contacts Google on its own.
```

**The schema's original, for comparison:**

```text
Bird records, weather and tide data come from eBird, OpenWeather and NOAA, which are not free services; the app is unusable without an eBird key.
```

Why the revision: (1) "not free services" reads to a birder as "costs money", and all three are free to use; F-Droid's sense is "not free software". (2) NOAA's tide data is a keyless, public-domain U.S. government service, so naming it as non-free invites a correction. (3) "unusable without an eBird key" is not true: Statistics, Calendar, Species Detail, Multimedia, Breeding Codes, Checklists and Named Birds read only your own exports, and Help's offline section says so. "Chiefly" keeps the sentence honest about the smaller ones (Esri's satellite tiles, the Macaulay Library embeds) without listing them. If you prefer to leave the tag for F-Droid's reviewer to add, the "Network services" block is still worth keeping as plain description.

### Changelog for versionCode 1000051 (`changelogs/1000051.txt`)

Staged as `1000049.txt` while 1.0.49 was the expected version; renamed at the release bump (2026-10-04), when 1.0.49 and 1.0.50 had shipped from other builds and this release became 1.0.51. The text is unchanged.

Staged text (Branch B), 357 characters (limit 500):

```text
First release for Android phones and tablets: every tab, with your own eBird backup and Macaulay Library export opened through the phone's file picker and kept in the app's private storage, and your own eBird and OpenWeather keys. If the phone's Android System WebView is too old to run SnowRaven, the opening screen says so instead of showing a blank page.
```

**Branch A:** the same text with this sentence appended (462 characters in all):

```text
Location controls use the phone's own location service, and Android asks your permission the first time.
```

Drawn from the CHANGELOG's Android entry (drafted under 1.0.49, released as 1.0.51) with the Apple-only lines dropped (iCloud Sync, widgets and Alerts) and the "Finding your location is not available" sentence left out, so nothing in the listing names location as unavailable. The Appearance line ("System now follows a light or dark change...") is also left out: for a first Android release it describes no change an Android user could have noticed. This departs from the brief's "the same sentences as What's New", because the App Store text cannot name Android at all (section e).

### Categories (the recipe's `Categories:`)

| | Value |
|---|---|
| **Default (schema 6.5)** | `Science & Education` |
| **The schema's alternative** | `Navigation` (as a second category, for Map Explorer, or in place of the first) |
| **Also available, not in the schema** | `Weather`, present in fdroiddata's current `config/categories.yml` (read 2026-10-03), alongside the two above |

### Listing icon (`images/icon.png`)

Copied byte for byte from `pipeline/ebird-cooldown-and-app-icon/icon-source/SnowRaven_SR_AppIcon_FullBleed_512.png` (SHA-256 `41431dbf0135b7c912d232c9dc5525017b51cdef11757ba14d5bf6ff32164623` on both): 512 by 512, RGB, no alpha channel, the SR monogram full bleed on `#2D8653`, the same mark the adaptive launcher icon's foreground draws.

---

## (b) Screenshots: captured and staged (2026-10-03)

Twelve screenshots are staged under `pipeline/android-release/fdroid/fastlane-proposal/en-US/images/`, with F-Droid's names, and move to `fastlane/metadata/android/en-US/images/` with the rest of the folder on your yes. Nothing is published. Each caption below is for you, not listing copy; F-Droid shows the images without captions.

**Phone** (`images/phoneScreenshots/`, API 36 Pixel 7 emulator, portrait, 1080 by 2400):

| File | What it shows |
|---|---|
| `1.png` | Map Explorer, My Sightings: the demo birder's ten hotspots from New York to Cape May, the layer chooser, and the share, fullscreen and Filters discs (no locate disc, branch B). |
| `2.png` | Statistics: the Life List Accumulation chart and the Top Species list. |
| `3.png` | Calendar, 2025: the year heading and shade key over the January and February grids. |
| `4.png` | Species Detail for Scarlet Tanager: the species card and its sightings figures. |
| `5.png` | Breeding Codes: the species-by-code matrix with its counts. |
| `6.png` | Multimedia: the filter pills over the media checklist, photo and audio counts per species. |

**Ten-inch tablet** (`images/tenInchScreenshots/`, API 36 Pixel Tablet emulator, landscape, 2560 by 1600, with the labeled navigation sidebar):

| File | What it shows |
|---|---|
| `1.png` | Map Explorer, My Sightings, with the filters panel beside the map and the 10 locations, 149 species, 7.9k observations summary. |
| `2.png` | Statistics: Life List Totals, the first and latest checklists and the start of the accumulation chart. |
| `3.png` | Calendar, 2025: eight month grids shaded by species per day. |
| `4.png` | Species Detail for American Goldfinch: the species card, sightings and media counts. |
| `5.png` | Breeding Codes: the code filter pills and the matrix across every code. |
| `6.png` | Multimedia: the filters and the media table with photo, audio, video and total columns. |

How they were made, none of it copy:

- **Data:** the synthetic demo dataset the website and App Store screenshots use (`node website/tools/gen-demo-data.mjs`, a fictional birder at public northeast-US hotspots), never real data. All 7,869 rows' submission ids were checked to be in the synthetic `S9` range before the first frame (the `capture-lib.mjs` guard, applied by hand), and the app showed 149 species and 368 checklists, the dataset's own figures. The two files, their metadata and a settings file (the demo map center, Welcome marked seen) were written into the app's private storage on the emulator with root, since a release build cannot be reached through `run-as`; no keys were entered, so no Settings or key screen appears.
- **Build:** the CI-shaped unsigned universal APK of this branch (with the branch-B Weather sentence), signed by `scripts/android/sign.sh` with the THROWAWAY emulator key; nothing signed with that key is distributed.
- **Emulator:** `-gpu host`, Android's status-bar demo mode (9:00, full Wi-Fi and battery, no notifications), light theme.
- **Scrolled shots** were positioned so the status bar sits over a gap between blocks rather than over text; content scrolling under the translucent status bar is the shipped behavior, as on iPhone.

**Gaps, named:**

- **No Weather shot.** The App Store set's third screen is the checklist weather lookup, and the planned stand-in was the Weather/tide Planner for a public place. Both need an OpenWeather key in the app (the lookup also needs eBird, which answers nothing for the synthetic ids), and this capture put no API key on the emulator, so the Weather tab shows only its two "key not configured" notices above the forms. Multimedia, which reads only the demo export, takes the sixth slot instead. A Planner shot needs a capture with a key entered, then the image added as `7.png` (or swapped in) before your yes.
- Statistics carries the line "No eBird key, so exotic status cannot be checked. Every species counts." in the tablet shot, for the same reason. It is true of a keyless install and reads as a setup note; recapturing with a key removes it.

---

## (c) Website and README: one sentence each

Register: one or two sentences, what it is and where a birder gets it, no operating detail, no reassurance. Neither sentence says "weather".

**Timing, which is the decision here.** On the day of the first ship the only Android download is the APK on the GitHub release; the F-Droid listing arrives weeks later, when F-Droid's review and build cycle allows (FR-59). A sentence naming F-Droid on day one would be false, and an F-Droid link would point at a page that does not exist yet. So each sentence has two forms: **day one** (APK only) and **once the F-Droid listing is live**. Suggested: approve both now, write the day-one form at the ship and the F-Droid form when the listing appears (each still shown to you before it is written); or hold both until the listing is live.

### `website/index.html`: the Platforms paragraph ("One app, everywhere you bird")

Placement: a new sentence after "...and opened from any browser.", before "One universal Mac build...".

**Before:**

```html
          <p>
            A native app on a Mac or Windows PC, on the <a href="https://apps.apple.com/app/id6787719977" target="_blank" rel="noopener">App Store</a>
            for iPhone and iPad, or self-hosted on a Raspberry Pi (or any computer on your
            network) and opened from any browser. One universal Mac build covers Apple Silicon
            and Intel, and the self-hosted version works in a phone or tablet browser too.
          </p>
```

**After (once the F-Droid listing is live):**

```html
          <p>
            A native app on a Mac or Windows PC, on the <a href="https://apps.apple.com/app/id6787719977" target="_blank" rel="noopener">App Store</a>
            for iPhone and iPad, or self-hosted on a Raspberry Pi (or any computer on your
            network) and opened from any browser. On Android phones and tablets it comes from
            <a href="https://f-droid.org/packages/com.dtgibson.snowraven/" target="_blank" rel="noopener">F-Droid</a>,
            or as an APK with each <a href="https://github.com/dtgibson/snowraven/releases/latest" target="_blank" rel="noopener">release on GitHub</a>.
            One universal Mac build covers Apple Silicon
            and Intel, and the self-hosted version works in a phone or tablet browser too.
          </p>
```

**After (day one, APK only):** the same, with the new sentence reading:

```html
            network) and opened from any browser. On Android phones and tablets it comes as an
            APK with each <a href="https://github.com/dtgibson/snowraven/releases/latest" target="_blank" rel="noopener">release on GitHub</a>.
```

As a reader sees it (F-Droid form): "A native app on a Mac or Windows PC, on the App Store for iPhone and iPad, or self-hosted on a Raspberry Pi (or any computer on your network) and opened from any browser. On Android phones and tablets it comes from F-Droid, or as an APK with each release on GitHub. One universal Mac build covers Apple Silicon and Intel, and the self-hosted version works in a phone or tablet browser too."

### `README.md`: the Installation list

Placement: a new bullet after the iPhone / iPad bullet, before Windows. It follows the house shape of the neighboring bullets (where to get it, one step).

**Before:**

```markdown
- **iPhone / iPad**: get SnowRaven from the [App Store](https://apps.apple.com/app/id6787719977). Free, iOS 16 or later. Updates arrive through the App Store like any other app.
- **Windows**: download `SnowRaven_x.x.x_x64-setup.exe` from the [latest release](https://github.com/dtgibson/snowraven/releases/latest) and run it. The app isn't code-signed yet, so SmartScreen may warn "unknown publisher": click **More info**, then **Run anyway**. In-app updates are cryptographically verified regardless.
```

**After (once the F-Droid listing is live):**

```markdown
- **iPhone / iPad**: get SnowRaven from the [App Store](https://apps.apple.com/app/id6787719977). Free, iOS 16 or later. Updates arrive through the App Store like any other app.
- **Android** (8.0 or later): get SnowRaven from [F-Droid](https://f-droid.org/packages/com.dtgibson.snowraven/), or download `SnowRaven_x.x.x_android_universal.apk` from the [latest release](https://github.com/dtgibson/snowraven/releases/latest) and open it on your phone.
- **Windows**: download `SnowRaven_x.x.x_x64-setup.exe` from the [latest release](https://github.com/dtgibson/snowraven/releases/latest) and run it. The app isn't code-signed yet, so SmartScreen may warn "unknown publisher": click **More info**, then **Run anyway**. In-app updates are cryptographically verified regardless.
```

**After (day one, APK only):** the new bullet reads:

```markdown
- **Android** (8.0 or later): download `SnowRaven_x.x.x_android_universal.apk` from the [latest release](https://github.com/dtgibson/snowraven/releases/latest) and open it on your phone.
```

The file name is the one schema 6.2's `attach.sh` uploads (`SnowRaven_<version>_android_universal.apk`). The one-time "allow installs from this source" step and the two-signers fact stay in Help, where the rule puts operating detail.

### Also out of date once Android ships (not proposed; yes or no to each)

Each of these lists platforms and would omit Android. The rule allows a feature build to propose one sentence, so these are shown for your decision rather than proposed; where a line names F-Droid, it has the same day-one caveat as above.

| # | Where | Before | After |
|---|---|---|---|
| C1 | `README.md` line 3 | `a native Mac, Windows, iPhone or iPad app, or self-hosted on a Raspberry Pi` | `a native Mac, Windows, iPhone, iPad or Android app, or self-hosted on a Raspberry Pi` |
| C2 | `README.md` "Updating" line | `iPhone and iPad update through the [App Store](https://apps.apple.com/app/id6787719977); self-hosted installs run` | `iPhone and iPad update through the [App Store](https://apps.apple.com/app/id6787719977); Android updates through F-Droid, or by installing the next release's APK over the old one; self-hosted installs run` |
| C3 | `website/index.html` meta description | `Free and open, for macOS, Windows, iPhone, iPad, and Raspberry Pi.` | `Free and open, for macOS, Windows, iPhone, iPad, Android, and Raspberry Pi.` |
| C4 | `website/index.html` hero line | `macOS · Windows · iPhone · iPad · Raspberry Pi` | `macOS · Windows · iPhone · iPad · Android · Raspberry Pi` |
| C5 | `website/index.html` platform list | (no Android item) | a new item after "iPhone and iPad", reusing the phone icon: `<span>Android: <a href="https://f-droid.org/packages/com.dtgibson.snowraven/" target="_blank" rel="noopener">F-Droid</a> or <a href="https://github.com/dtgibson/snowraven/releases/latest" target="_blank" rel="noopener">.apk</a></span>` (day one: `<span>Android: <a href="https://github.com/dtgibson/snowraven/releases/latest" target="_blank" rel="noopener">.apk</a></span>`) |
| C6 | `website/index.html` install cards | (no Android card) | a new card after "iPhone / iPad": heading `Android`, text `Get SnowRaven from F-Droid, or download the universal .apk from the latest release and open it on your phone. It runs on Android 8.0 or later, and updates arrive through F-Droid or by installing a newer release's APK over the old one.` (day one: `Download the universal .apk from the latest release and open it on your phone. It runs on Android 8.0 or later, and updates arrive by installing a newer release's APK over the old one.`), button `Download for Android` to the latest release |
| C7 | `website/index.html` footer links | `App Store` link only | an `F-Droid` link after it, once the listing is live |

C5 to C7 are structure changes (a new list item, card and link), shown as text so you can judge the wording; the markup follows the neighboring items exactly.

---

## (d) `PRIVACY_POLICY.md` (the identical text goes to `website/privacy.html`)

Six passages. d1 to d3 and d6 change existing text; d4 adds a paragraph; d5 adds a section. Facts are from schema 7.1 to 7.5.

### d1. Effective date

```text
Before: **Effective date:** October 2, 2026
After:  **Effective date:** <the date the edit is published>
```

"Changes to This Policy" promises a revised effective date. `website/privacy.html`'s `pp-date` line moves with it.

### d2. Overview

**Before:**

```markdown
SnowRaven is a self-hosted birding tools app. It runs as a standalone desktop app (macOS and Windows), as an app on iPhone and iPad, or on your own machine such as a Raspberry Pi. This policy describes what happens to your data. The short version: it stays with you.
```

**After:**

```markdown
SnowRaven is a self-hosted birding tools app. It runs as a standalone desktop app (macOS and Windows), as an app on iPhone, iPad and Android, or on your own machine such as a Raspberry Pi. This policy describes what happens to your data. The short version: it stays with you.
```

"as an app on iPhone, iPad and Android" is the phrase `ACCESSIBILITY.md` already uses, so the two statements agree.

### d3. Your Data Stays on Your Device, first bullet (one clause)

Not one of the four passages the brief named, but the paragraph-scope sweep requires it: this bullet lists where each app stores your data as a complete list, and without this clause it would leave the Android app out. Only this clause of the bullet changes; the rest is unchanged.

**Before (clause):**

```markdown
are stored only on your device (in the desktop app's local data directory, or in the iOS app's on-device sandbox on iPhone and iPad, together with the small copy its home-screen widgets read and, if you turn on Alerts, the alert settings and inbox, all described in the iOS App section below), or on your own machine
```

**After (clause):**

```markdown
are stored only on your device (in the desktop app's local data directory, in the iOS app's on-device sandbox on iPhone and iPad, together with the small copy its home-screen widgets read and, if you turn on Alerts, the alert settings and inbox, all described in the iOS App section below, or in the Android app's private storage, described in the Android App section below), or on your own machine
```

### d4. Your Location: a new last paragraph, after the iPhone and iPad paragraph

Placement: after the paragraph ending "Denying it leaves everything else working: you can always type coordinates or search for a place by name." and before `## Map Tiles`.

**Before:** (nothing; the section ends with the iPhone and iPad paragraph)

**After, Branch A:**

```markdown
On Android, the first time SnowRaven asks for your location (for example when you tap "Use my location", use the "Current" lookup, or press "Plan" with no place chosen) Android shows its own location permission prompt. SnowRaven contains no location library of its own: it asks for a position through the phone's Android System WebView, which gets it from the phone's own location service, and how that service works out where you are (by satellite, or on many phones with help from a network location service run by the phone's maker or by Google) belongs to the operating system, as it does on iPhone. The Android app uses your location only while you're using it and never asks for background location access. You can allow or deny location, and change your choice at any time in Settings → Apps → SnowRaven → Permissions → Location. Denying it leaves everything else working: you can always type coordinates or search for a place by name.
```

**After, Branch B:**

```markdown
On Android, SnowRaven never asks for your location and requests no location permission. The Android app has none of the location controls described above, and pressing "Plan" with no place chosen leaves the place empty for you to search or tap. You choose a place by typing its coordinates or searching for it by name.
```

Branch A names Google as one possible source of the phone's own network fix because schema 7.1 asks the policy to say so plainly; the app itself sends nothing there. The Branch A paragraph avoids the phrase `widgetsPublishedClaims.test.ts` forbids anywhere in the policy (it once described the iOS app before widgets read location while closed).

### d5. A new section, `## Android App`, after `## iCloud Sync`

Placement: after the iCloud Sync section and before `## Embedded Bird Media and Link Icons`. Not directly after `## iOS App`, for two reasons: `privacyPageParity.test.ts` keeps iCloud Sync immediately after iOS App on purpose (iCloud Sync explains how it differs from "the iOS device backup described above"), and `widgetCopy.test.ts` reads the iOS App passage as everything up to `## iCloud Sync`, so a section between them would widen what it scans.

**Before:** (no such section)

**After:**

```markdown
## Android App

The Android app is the same local-first application, built from the same published source. Your files, keys, and settings live in the app's private storage on your phone or tablet, which other apps cannot read and which needs no storage permission, and they are removed when you uninstall the app. They are included in Android's own backup under Android's default settings, whether your phone backs up to a cloud account or transfers directly to a new phone. Android's documented limit for a cloud backup is 25 MB per app, and an app holding more than that is left out of the cloud backup entirely, which a large eBird backup can bring about; on Android 12 and later, a direct transfer to a new phone has no such limit. The Android app contains no Google services, no Firebase, and no analytics, advertising, or crash-reporting library, and its own code makes no request to Google and adds no service connections beyond those listed above. Its screens are drawn by your phone's Android System WebView, a system component outside the app that contacts Google on its own from inside the app's process. SnowRaven turns off two WebView settings: its Safe Browsing check, which would otherwise check the addresses the app loads with Google, and its usage statistics, which it would otherwise upload for this app on a phone whose owner has turned on usage and diagnostics reporting. SnowRaven has also removed a font request that one of the app's own libraries made to Google Play services at every launch. Two contacts remain, both measured on a phone with Google Play services and both the WebView's own: when a screen with form fields first opens, its form autofill asks Google about those fields, and at launch it asks Google Play services for a small set of fonts it may use to draw web content. Neither has a setting that SnowRaven can turn off; on a phone without Google Play services the font request has nothing to answer it. The home-screen widgets, Alerts, and iCloud Sync described in this policy are iPhone, iPad, and Mac features and are not part of the Android app.
```

In `website/privacy.html` the heading is `<h2 id="android-app">Android App</h2>`, the id the page's slug convention gives. **The Google sentences, revised after QA-52 (2026-10-03):** the FR-54 record carries "no Google services, no Firebase, no analytics library"; "it makes no request to Google" is withdrawn, because the measurement in `measurements/safe-browsing/README.md` shows the Android System WebView's autofill query to `content-autofill.googleapis.com` from the app's own process at every cold launch, on both API 36 images, with Safe Browsing on and off. The paragraph now separates the app's own code (no request to Google, measured: the bundle fetches from no Google host) from the WebView (a system component that contacts Google on its own, named by its measured examples, with no setting that stops them), and states what the app disables (Safe Browsing, the manifest meta-data). **Revised after the security review (M2, M3, 2026-10-03):** "has no setting that stops it" was written when only Safe Browsing had been switched off; the paragraph now names the three switches the app uses (Safe Browsing, `MetricsOptOut`, the emoji initializer's font request removed from the merged manifest, each pinned by `androidProjectPins.test.ts`) and the two measured contacts that remain after them, the autofill query (`measurements/safe-browsing/README.md`) and the WebView's downloadable-font lookup (`measurements/emoji-initializer/README.md`: Chromium 133's `AndroidFontLookupImpl` asks Play services' font provider for Google Sans in three weights, Google Sans Flex and Noto Color Emoji Compat, from the app's process, with no app-level switch). "Google Play services" is named here, where the fact needs it; the listing says "Google". The sentence about Android's own network position fix stays out, because branch B ships no location path. The backup facts are Android's documentation, not a measurement (schema 7.4). The schema's note that a birder "typically" has nothing in a cloud backup is not used: CLAUDE.md's own measurements were taken on a 13.2 MB raw eBird export, under the limit, so the honest sentence is the conditional one. "no Play" (FR-50's wording) is not written, by your rule that no copy names that store; "no Google services" carries it. **Reworded after the Tester's delta re-check (2026-10-03; `decisions.md`, "Held copy wording after the delta re-check"):** "turns off every documented switch it has for that" was a universal (the one autofill switch tried, `importantForAutofill`, is not set, because it was measured not to stop the query), so the paragraph names the two WebView settings it turns off and the library font request it removed, with no "every"; and the autofill query is no longer "at launch", because the re-check saw it when screens with form fields first opened mid-session and saw one cold start with a warm WebView cache make no autofill contact, so it now reads "when a screen with form fields first opens", while "at launch" stays on the font lookup, which was measured there (a provider connection 1 to 5 s after a cold launch).

### d6. Software Updates: a new last paragraph, after the iPhone and iPad paragraph

**Before (the section's last paragraph, unchanged):**

```markdown
On iPhone and iPad, updates are delivered through the App Store (or TestFlight for pre-release builds). The iOS app contains no self-update mechanism of its own and does not make the GitHub update check described above.
```

**After (that paragraph unchanged, then):**

```markdown
On Android, SnowRaven installed from F-Droid is updated through the F-Droid client. F-Droid builds each release from SnowRaven's published source on its own servers and signs it with F-Droid's own key. SnowRaven installed from the APK attached to a GitHub release is signed with the developer's key and is updated by downloading a newer release's APK from GitHub and installing it over the old one. The two are signed by different keys, so neither installs over the other: switching from one to the other means uninstalling first, which removes the files and keys stored in the app. The Android app contains no self-update mechanism of its own and does not make the GitHub update check described above.
```

### For whoever applies the policy patch (not copy)

- `privacyPageParity.test.ts` row "covers all 13 sections" counts the sections on purpose; it becomes 14 with `Android App` named, plus an order row placing it after iCloud Sync. Its adjacency rows stay as they are.
- `.claude/rules/docs-and-website.md` asks that a change adding sentences to `PRIVACY_POLICY.md` carry a published-claims guard in the same change, in a file the run does not otherwise edit, applied in a scratch copy until the yes: the Android App section's claims held to the code (no geolocation plugin in the Android cfg, the manifest's permission set, `showUpdaterFooter()` false on Android) and to `website/privacy.html`.
- `website/privacy.html`'s lead band ("App Store privacy label", "no third-party SDKs") is presentation outside the policy text and is not changed here; it stays true for Android in the privacy sense (no analytics or advertising SDK).

---

## (e) The App Store "What's New" line for this release

```text
Choosing System under Appearance now follows a light or dark change you make on your device while SnowRaven is open.
```

This is the only change in 1.0.51 that reaches the iPhone and iPad app (the CHANGELOG's "In every app" line; 1.0.49 and 1.0.50, merged in at the release bump, shipped from other builds with What's New text of their own). It does not mention Android: App Review Guideline 2.3.10 bars naming other mobile platforms in an app's metadata. If 1.0.50 is still in review at the gate (record `99e3f9ff`, which already carries 1.0.48 and 1.0.49 by rollup) and the user rolls it into this release, its approved four paragraphs (`pipeline/stats-badges-uniform/whats-new.md`) come first, word for word, then this line. If it has reached `READY_FOR_SALE`, this line stands alone on a new record.

---

## Conflicts found, and what was not decided here

1. **The schema's `NonFreeNet` sentence over-claims** (section a). The committed recipe `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` carries the schema's original sentence as its `AntiFeatures.NonFreeNet.en-US` value (folded over two lines, as `fdroid rewritemeta` writes it); it takes whichever sentence you approve, so the listing and the recipe agree. Its `Categories:` reads the default, `Science & Education`.
2. **App Store risk in the iOS bundle, outside this file's scope.** Guideline 2.3.10 covers the app as well as its metadata, and the in-app Help bundled into the iOS app now names Android (`docs/HELP.md`'s opening, the data-files passage, Settings' API Keys and Default Files, and Troubleshooting). That is the Engineer's and the user's call; flagged because it could draw a review question on the 1.0.49 submission.
3. **`CHANGELOG.md`'s 1.0.49 entry disagreed with the revised plan in two places; both are resolved** by The Engineer: the Internal line now names the one build script and the unsigned universal APK (no App Bundle), and the Added line now reads "On Android the app does not offer to find your location: you move the map by searching for a place or by setting a Default Location.", which is the Branch B fact.
4. **The Weather screenshot** cannot repeat the App Store set's checklist lookup on the emulator, and the Planner stand-in needs an OpenWeather key the capture did not enter; the staged sets carry Multimedia in its place (section b).
5. **Schema 7.4's "typically nothing in a cloud backup"** is not adopted (d5).
6. **Not decided here:** the category, the `NonFreeNet` wording, the website and README timing, and each of C1 to C7. (The location branch is decided: B.)
7. **The Google sentences were revised on 2026-10-03 after QA-52**, in (a), the `NonFreeNet` reason and (d5), and in the staged `fdroid/fastlane-proposal/en-US/full_description.txt` (3,996 characters; 3,993 after the security M3 and L1 revision of 2026-10-03), to say what `measurements/safe-browsing/README.md` supports; the committed recipe still carries the schema's original `NonFreeNet` sentence and takes whichever you approve.
