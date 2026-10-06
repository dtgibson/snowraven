# Held copy: Android release (the F-Droid leg)

**Status: APPROVED and WRITTEN (2026-10-05), in the day-one forms.** The user approved the copy page as it stood after three rounds, with two standing requirements for the README and website: the serial (Oxford) comma in every list, and American spelling. Written: `website/index.html` and `README.md` (section (c), day-one forms), `PRIVACY_POLICY.md` and `website/privacy.html` (section (d)), `ACCESSIBILITY.md`, the Fastlane folder at `fastlane/metadata/android/en-US/` (sections (a) and (b); it was staged under `pipeline/android-release/fdroid/fastlane-proposal/en-US/`), and the recipe's `NonFreeNet` reason and category. Still held: the after-inclusion forms of section (c), shown to the user again when the F-Droid listing is live, and the App Store What's New (section (e)), written at the App Store step. The history below is kept as written; the original status line read "HELD. Nothing here is published."

**Location branch: B, decided by the measurement (2026-10-03).** The FR-55 measurement is recorded in `decisions.md` ("FR-55 measurement ... branch B stands") and `pipeline/android-release/measurements/`: its step 9 failed (during a fix the app's own UID held a connection to a Google address). So Android has no location controls and a place is typed or searched for. Every location-dependent passage below is still given in both forms, labeled **Branch A** and **Branch B**, because the decision has a reversal condition; **only the Branch B forms apply**, and the staged files carry them. (The branch-A edit seen in the working tree while this was drafted was the measurement build's scratch edit, reverted after the run.)

## Decisions for you

1. **Location branch:** set by the measurement, not by you: Branch B. Nothing to choose; the Branch A forms are kept only for the recorded reversal.
2. **The `NonFreeNet` reason sentence:** a revised sentence (proposed) or the schema's original. Section (a), "NonFreeNet".
3. **F-Droid category:** `Science & Education` (the schema's default), with `Navigation` the schema's named alternative. F-Droid's current list also has `Weather`, which the schema did not consider.
4. **Website and README: a plain platform sentence and Android in each per-platform item (revised twice, 2026-10-05).** Two forms only where a link differs. Recommended: the day-one forms (the GitHub `.apk`) at this ship, the after-inclusion forms (F-Droid first) as a follow-up when the listing is live. Section (c).
5. **Companion edits:** withdrawn as a separate table; the hero line, the meta description, README line 3 and the Updating line are items of the one revision, and the footer link is dropped. Section (c).
6. **Privacy policy:** a new `## Android App` section placed after `## iCloud Sync`. Section (d).
7. **NFR-01, the system WebView carve-out: decided by the user (2026-10-04), ACCEPTED on a shorter basis.** The published Google-contacts wording is two sentences everywhere it appears (the listing's Privacy block and policy d5): "SnowRaven's own code makes no request to Google. Its screens are drawn by your phone's Android System WebView, a system component that may contact Google on its own; SnowRaven turns off the WebView's Safe Browsing and usage statistics, and has no setting for the rest." The measured detail (the autofill query, the font lookup, the WebView's crash reports, the emoji initializer's removed font request) stays in `decisions.md`, `measurements/` and the notes below, not in published copy. The long forms quoted in the notes under (a) and (d5) are the history of the wording, superseded by this decision.

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

Plain text. F-Droid converts each line break to `<br>`, so a blank line separates blocks and each tab name stands on its own line above its sentences. The tab blocks are the README's approved tab sentences, word for word, in `DEFAULT_TAB_ORDER` named from `TAB_LABELS`; the Privacy block is the README's posture sentence with the iCloud clause dropped (iCloud is not on Android) plus the gated no-Google sentence; "What you'll need" is the README's and website's requirement text; the last line is the website footer's attribution. 3,858 characters as staged after the user's two-sentence trim of 2026-10-04 (3,859 with the final newline; F-Droid's limit is 4,000), so the Branch A Weather line, 38 characters longer, would now also fit.

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
Private by default, and in your control: no account, no analytics, no telemetry, no server we run. Your eBird backup, Macaulay Library export and API keys stay on your device, and in your phone's own backup if you use one. The Android app has no Google services, no Firebase and no crash reporter. SnowRaven's own code makes no request to Google. Its screens are drawn by your phone's Android System WebView, a system component that may contact Google on its own; SnowRaven turns off the WebView's Safe Browsing and usage statistics, and has no setting for the rest. Privacy policy: https://snowraven.dtgibson.com/privacy.html

What you'll need
A free eBird API key and a free OpenWeather API key subscribed to its One Call by Call plan (activating it needs a payment card on file; set a usage cap to avoid charges), entered once in Settings. Most tabs also read your eBird backup and, for the media features, an optional Macaulay Library export.

Network services
SnowRaven relies on network services that are not free software, chiefly eBird for checklist details, hotspots and recent sightings, and OpenWeather for weather, each used with your own API key.

Weather by OpenWeather. Checklist and media data from eBird and the Macaulay Library. Tides from NOAA Tides & Currents.
```

**Branch A swap (the Weather block's first sentence, which is the README's sentence unchanged):**

```text
Paste a checklist ID and get a weather and tide summary ready to drop into the checklist comment, or look up the conditions where you are now, or the forecast for any place and time ahead.
```

Under Branch B the Current lookup is absent from the Weather tab (design spec section 7), so "the conditions where you are now" is dropped; the place-and-time forecast is Plan, which stays. No other block depends on the branch. **The Google sentences, revised after QA-52 (2026-10-03):** the earlier line "it makes no request to Google" is withdrawn. The measurement in `measurements/safe-browsing/README.md` shows the app's own process opening one TLS connection to `content-autofill.googleapis.com` at every cold launch on both API 36 images, with the WebView's Safe Browsing on and off: it is the Android System WebView's autofill query for the page's form fields, which no manifest key or setting turns off. What the record supports, and what the block now says: no Google services, Firebase or analytics library in the app (the FR-54 dependency tree and `fdroid scanner`); the app's own code makes no request to Google (the bundle names no Google host that is fetched); the WebView, a system component, makes requests of its own to Google from inside the app, named by example; SnowRaven turns off its Safe Browsing check (the manifest meta-data, pinned by `androidProjectPins.test.ts`) and has no setting for the rest. The same sentences go into the policy (d5), so the listing claims nothing the policy does not. **Revised again after the security review (M3, L1, 2026-10-03):** "cannot turn off the rest" was a universal negative the record did not support, and two switches it covered were unused. The block now states what is switched off and what was measured: Safe Browsing (`EnableSafeBrowsing=false`), the WebView's per-app usage statistics (`MetricsOptOut=true`, added at M3) and the font request AndroidX's emoji initializer made to Play services' font provider at every launch (removed from the merged manifest at M2; `measurements/emoji-initializer/README.md`), all three pinned by `androidProjectPins.test.ts`. What remains, both measured on the API 36 Google APIs image after the fixes, is the WebView's own: the autofill query to `content-autofill.googleapis.com` and its downloadable-font lookup (Chromium's `AndroidFontLookupImpl`, five font queries to Play services' font provider from the app's process), neither of which has an app-level setting; the block says "have no setting that stops them", a statement about the settings that exist, not a claim that none can. The word "measured" and "Google Play services" were cut for the 4,000-character cap and live in d5. The L1 clause ("and in your phone's own backup if you use one") qualifies "on your device" with the backup fact d5 already states. "no analytics" is said once, in the posture sentence, so the Android sentence names Google services, Firebase and crash reporting. The `NonFreeNet` sentence lost "that draws its screens" for the same cap; the WebView is introduced in the Privacy block above it. **Reworded after the Tester's delta re-check (2026-10-03; `decisions.md`, "Held copy wording after the delta re-check"):** the autofill query is no longer "at launch" (it was measured when a screen with form fields first opens, and once not at all on a cold start with a warm cache), so the block says "its font lookup at launch and autofill query when form fields first appear"; the removed font request is attributed to "one of its libraries" in the app sentence, so it no longer reads as the WebView's. The tab blocks and the posture sentence are approved word for word and could not give up characters, so the two Google sentences paid for their own growth: "contains ... crash-reporting library" became "has ... crash reporting", "The phone's" and "from inside the app" were dropped ("which draws its screens" carries that the contact is from inside the app; d5 keeps both), and the font clause's "to Google" is carried by the clause before it. **Applied at the Deployer's part 1 (2026-10-04), from the security delta re-review's N1:** "no crash reporting" now reads "no crash reporter", because the shorter form claimed nothing happens in the app, where the record supports only that the app contains no crash reporter (the Android System WebView sends Google a crash report on a phone whose owner shares usage and diagnostics, which d5 now says). The staged file is 3,994 characters, 3,995 with its final newline, and still byte-identical to the block above. **Trimmed at the user's direction (2026-10-04), superseding the wording history above and the N1 note:** the Privacy block's Google sentences are now "The Android app has no Google services, no Firebase and no crash reporter." followed by the user's two sentences word for word, and the `NonFreeNet` reason no longer ends with "; the Android System WebView also contacts Google on its own" (dropped for brevity, and because the Privacy block now says it in the user's words, with "may"). 3,858 characters.

### NonFreeNet: the one-sentence reason (schema 6.5)

F-Droid asks that the reason be in the description; the staged description carries it under "Network services", and the same sentence becomes the recipe's `AntiFeatures: NonFreeNet: en-US:` value.

**Proposed:**

```text
SnowRaven relies on network services that are not free software, chiefly eBird for checklist details, hotspots and recent sightings, and OpenWeather for weather, each used with your own API key.
```

**The schema's original, for comparison:**

```text
Bird records, weather and tide data come from eBird, OpenWeather and NOAA, which are not free services; the app is unusable without an eBird key.
```

Why the revision: (1) "not free services" reads to a birder as "costs money", and all three are free to use; F-Droid's sense is "not free software". (2) NOAA's tide data is a keyless, public-domain U.S. government service, so naming it as non-free invites a correction. (3) "unusable without an eBird key" is not true: Statistics, Calendar, Species Detail, Multimedia, Breeding Codes, Checklists and Named Birds read only your own exports, and Help's offline section says so. "Chiefly" keeps the sentence honest about the smaller ones (Esri's satellite tiles, the Macaulay Library embeds) without listing them. If you prefer to leave the tag for F-Droid's reviewer to add, the "Network services" block is still worth keeping as plain description.

### Changelog for versionCode 1000053 (`changelogs/1000053.txt`)

Staged as `1000049.txt` while 1.0.49 was the expected version; renamed `1000051.txt` at the first release bump (2026-10-04), when 1.0.49 and 1.0.50 had shipped from other builds, and `1000053.txt` at the second, when 1.0.51 and 1.0.52 had too. The text is unchanged.

Staged text (Branch B), 357 characters (limit 500):

```text
First release for Android phones and tablets: every tab, with your own eBird backup and Macaulay Library export opened through the phone's file picker and kept in the app's private storage, and your own eBird and OpenWeather keys. If the phone's Android System WebView is too old to run SnowRaven, the opening screen says so instead of showing a blank page.
```

**Branch A:** the same text with this sentence appended (462 characters in all):

```text
Location controls use the phone's own location service, and Android asks your permission the first time.
```

Drawn from the CHANGELOG's Android entry (drafted under 1.0.49, released as 1.0.53) with the Apple-only lines dropped (iCloud Sync, widgets and Alerts) and the "Finding your location is not available" sentence left out, so nothing in the listing names location as unavailable. The Appearance line ("System now follows a light or dark change...") is also left out: for a first Android release it describes no change an Android user could have noticed. This departs from the brief's "the same sentences as What's New", because the App Store text cannot name Android at all (section e).

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

## (c) Website and README: Android woven into the existing sentences and lists

**Revised at the user's direction (2026-10-05, two rounds).** The first proposal added a separate Android sentence after the other platforms, which read as bolted on; the second still gave Android its own store clause inside the platform sentence. Simple is better: the website and README are short and informative and the details live in Help. So the platform sentence is now a plain statement of the platforms with no store-by-store clauses, and the per-platform items (the platform list, the install cards, the hero line, the meta description, the README's list, install bullets and Updating line) each gain Android in its natural place, mirroring its iPhone and iPad neighbor and varying only where Android differs (the store, the version floor, how updates arrive), the principle the user approved in the listing and the policy. No separate sentence, no emphasis, no "now also", and nothing else on either surface. The earlier standalone sentence, the C1 to C7 table and the footer link are withdrawn.

**Two forms only where a link differs.** On the day of the first ship the only Android download is the APK on the GitHub release; the F-Droid listing appears weeks later, after F-Droid's review and first build, so an F-Droid link on day one would point at a page that does not exist. Items c2, c3, c8 and c9 therefore have a **day-one** form (the GitHub `.apk`) and an **after-inclusion** form (F-Droid first, the `.apk` second where the item carries two links); c1, c4, c5 and c7 are the same in both. **Recommended:** write the day-one forms at this ship, and the after-inclusion swap as a small follow-up edit when `https://f-droid.org/packages/com.dtgibson.snowraven/` is live, shown to the user again before it is written.

### `website/index.html`

**c1. The platforms paragraph ("One app, everywhere you bird"), first sentence** (the same in both forms). A plain statement of the platforms: the App Store link leaves this sentence, because the platform list and the cards below carry every link. The second sentence is unchanged.

Before:

```html
            A native app on a Mac or Windows PC, on the <a href="https://apps.apple.com/app/id6787719977" target="_blank" rel="noopener">App Store</a>
            for iPhone and iPad, or self-hosted on a Raspberry Pi (or any computer on your
            network) and opened from any browser. One universal Mac build covers Apple Silicon
```

After:

```html
            A native app for Mac, Windows, iPhone, iPad, and Android, or self-hosted on a Raspberry Pi
            (or any computer on your network) and opened from any browser. One universal Mac build covers Apple Silicon
```

As a reader sees it: "A native app for Mac, Windows, iPhone, iPad, and Android, or self-hosted on a Raspberry Pi (or any computer on your network) and opened from any browser. One universal Mac build covers Apple Silicon and Intel, and the self-hosted version works in a phone or tablet browser too."

**c2. The platform list.** A new item after "iPhone and iPad", in the same form as its neighbors (an icon, the platform, then the link), reusing the phone icon.

Before (the neighbor it follows):

```html
              <span>iPhone and iPad: <a href="https://apps.apple.com/app/id6787719977" target="_blank" rel="noopener">App Store</a></span>
```

Day one (the new item's text):

```html
              <span>Android: <a href="https://github.com/dtgibson/snowraven/releases/latest" target="_blank" rel="noopener">.apk</a></span>
```

After inclusion:

```html
              <span>Android: <a href="https://f-droid.org/packages/com.dtgibson.snowraven/" target="_blank" rel="noopener">F-Droid</a> or <a href="https://github.com/dtgibson/snowraven/releases/latest" target="_blank" rel="noopener">.apk</a></span>
```

**c3. The install cards.** A new "Android" card after "iPhone / iPad", in that card's shape and length: three short sentences (where it comes from; free and the version floor; how updates arrive) and one button.

The card it mirrors (unchanged):

```html
              <p>Get SnowRaven from the <a href="https://apps.apple.com/app/id6787719977" target="_blank" rel="noopener">App Store</a>. It is free and runs on iOS 16 or later. Updates arrive through the App Store like any other app.</p>
```

Day one (heading `Android`, button `Download for Android` to the latest release):

```html
              <p>Get SnowRaven as an <a href="https://github.com/dtgibson/snowraven/releases/latest" target="_blank" rel="noopener"><code>.apk</code></a> from the latest release. It is free and runs on Android 8.0 or later. Updates arrive as a new <code>.apk</code> with each release.</p>
```

After inclusion (heading `Android`, button `Download for Android` to the F-Droid page):

```html
              <p>Get SnowRaven from <a href="https://f-droid.org/packages/com.dtgibson.snowraven/" target="_blank" rel="noopener">F-Droid</a>. It is free and runs on Android 8.0 or later. Updates arrive through F-Droid like any other app.</p>
```

**c4. The hero line** (both forms):

```text
Before: macOS · Windows · iPhone · iPad · Raspberry Pi
After:  macOS · Windows · iPhone · iPad · Android · Raspberry Pi
```

**c5. The meta description's last sentence** (both forms):

```text
Before: Free and open, for macOS, Windows, iPhone, iPad, and Raspberry Pi.
After:  Free and open, for macOS, Windows, iPhone, iPad, Android, and Raspberry Pi.
```

### `README.md`

**c7. Line 3, the platform list** (both forms):

```text
Before: a native Mac, Windows, iPhone or iPad app, or self-hosted on a Raspberry Pi (or any computer on your network).
After:  a native Mac, Windows, iPhone, iPad, or Android app, or self-hosted on a Raspberry Pi (or any computer on your network).
```

**c8. The Installation list.** A new bullet after iPhone / iPad, short and in its neighbors' cadence: where it comes from, free, the version floor, on one line (how Android updates is c9's clause).

The bullet it mirrors (unchanged):

```markdown
- **iPhone / iPad**: get SnowRaven from the [App Store](https://apps.apple.com/app/id6787719977). Free, iOS 16 or later. Updates arrive through the App Store like any other app.
```

Day one:

```markdown
- **Android**: download the `.apk` from the [latest release](https://github.com/dtgibson/snowraven/releases/latest). Free, Android 8.0 or later.
```

After inclusion:

```markdown
- **Android**: get SnowRaven from [F-Droid](https://f-droid.org/packages/com.dtgibson.snowraven/). Free, Android 8.0 or later.
```

**c9. The Updating line.** One clause inside the existing sentence, after the iPhone and iPad clause.

Before:

```markdown
**Updating**: desktop apps update in place from **Check For Updates** in the footer; iPhone and iPad update through the [App Store](https://apps.apple.com/app/id6787719977); self-hosted installs run `./update.sh`.
```

Day one:

```markdown
**Updating**: desktop apps update in place from **Check For Updates** in the footer; iPhone and iPad update through the [App Store](https://apps.apple.com/app/id6787719977); Android installs the next release's `.apk` over the old one; self-hosted installs run `./update.sh`.
```

After inclusion:

```markdown
**Updating**: desktop apps update in place from **Check For Updates** in the footer; iPhone and iPad update through the [App Store](https://apps.apple.com/app/id6787719977); Android updates through F-Droid; self-hosted installs run `./update.sh`.
```

Notes, none of them copy: the one-time "allow installs from this source" step, the file name and the two-signers fact stay in Help, where the rule puts operating detail. After inclusion the website's platform list still carries the `.apk` as its second link, and every GitHub release still carries the file, so a reader who prefers the APK is never left without it. The after-inclusion Updating clause is written as the user gave it, without a link (the iPhone and iPad clause beside it links the App Store).

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
SnowRaven is a self-hosted birding tools app. It runs as a standalone desktop app (macOS and Windows), as an app on iPhone, iPad, and Android, or on your own machine such as a Raspberry Pi. This policy describes what happens to your data. The short version: it stays with you.
```

"as an app on iPhone, iPad, and Android" is the phrase `ACCESSIBILITY.md` uses (both with the serial comma the user asked for on 2026-10-05), so the two statements agree.

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

The Android app is the same local-first application, built from the same published source. Your files, keys, and settings live in the app's private storage on your phone or tablet, which other apps cannot read and which needs no storage permission, and they are removed when you uninstall the app. They are included in Android's own backup under Android's default settings, whether your phone backs up to a cloud account or transfers directly to a new phone. Android's documented limit for a cloud backup is 25 MB per app, and an app holding more than that is left out of the cloud backup entirely, which a large eBird backup can bring about; on Android 12 and later, a direct transfer to a new phone has no such limit. The Android app contains no Google services, no Firebase, and no analytics, advertising, or crash-reporting library, and adds no service connections beyond those listed above. SnowRaven's own code makes no request to Google. Its screens are drawn by your phone's Android System WebView, a system component that may contact Google on its own; SnowRaven turns off the WebView's Safe Browsing and usage statistics, and has no setting for the rest. The home-screen widgets, Alerts, and iCloud Sync described in this policy are iPhone, iPad, and Mac features and are not part of the Android app.
```

In `website/privacy.html` the heading is `<h2 id="android-app">Android App</h2>`, the id the page's slug convention gives. **The Google sentences, revised after QA-52 (2026-10-03):** the FR-54 record carries "no Google services, no Firebase, no analytics library"; "it makes no request to Google" is withdrawn, because the measurement in `measurements/safe-browsing/README.md` shows the Android System WebView's autofill query to `content-autofill.googleapis.com` from the app's own process at every cold launch, on both API 36 images, with Safe Browsing on and off. The paragraph now separates the app's own code (no request to Google, measured: the bundle fetches from no Google host) from the WebView (a system component that contacts Google on its own, named by its measured examples, with no setting that stops them), and states what the app disables (Safe Browsing, the manifest meta-data). **Revised after the security review (M2, M3, 2026-10-03):** "has no setting that stops it" was written when only Safe Browsing had been switched off; the paragraph now names the three switches the app uses (Safe Browsing, `MetricsOptOut`, the emoji initializer's font request removed from the merged manifest, each pinned by `androidProjectPins.test.ts`) and the two measured contacts that remain after them, the autofill query (`measurements/safe-browsing/README.md`) and the WebView's downloadable-font lookup (`measurements/emoji-initializer/README.md`: Chromium 133's `AndroidFontLookupImpl` asks Play services' font provider for Google Sans in three weights, Google Sans Flex and Noto Color Emoji Compat, from the app's process, with no app-level switch). "Google Play services" is named here, where the fact needs it; the listing says "Google". The sentence about Android's own network position fix stays out, because branch B ships no location path. The backup facts are Android's documentation, not a measurement (schema 7.4). The schema's note that a birder "typically" has nothing in a cloud backup is not used: CLAUDE.md's own measurements were taken on a 13.2 MB raw eBird export, under the limit, so the honest sentence is the conditional one. "no Play" (FR-50's wording) is not written, by your rule that no copy names that store; "no Google services" carries it. **Reworded after the Tester's delta re-check (2026-10-03; `decisions.md`, "Held copy wording after the delta re-check"):** "turns off every documented switch it has for that" was a universal (the one autofill switch tried, `importantForAutofill`, is not set, because it was measured not to stop the query), so the paragraph names the two WebView settings it turns off and the library font request it removed, with no "every"; and the autofill query is no longer "at launch", because the re-check saw it when screens with form fields first opened mid-session and saw one cold start with a warm WebView cache make no autofill contact, so it now reads "when a screen with form fields first opens", while "at launch" stays on the font lookup, which was measured there (a provider connection 1 to 5 s after a cold launch). **Applied at the Deployer's part 1 (2026-10-04), from the security delta re-review's N1:** the sentence beginning "On a phone whose owner shares usage and diagnostics with Google" follows "Neither has a setting that SnowRaven can turn off", in the Auditor's words, because Android's own WebView privacy page says the WebView sends crash reports for such owners and that `MetricsOptOut` does not cover them; "both measured" stays on the two measured contacts, and this third path is stated from the documentation, not measured (an emulator has no usage-and-diagnostics consent). **Trimmed at the user's direction (2026-10-04), superseding the wording history above and the N1 note:** the WebView passage is now the user's two sentences word for word, after "The Android app contains no Google services, no Firebase, and no analytics, advertising, or crash-reporting library, and adds no service connections beyond those listed above." (that sentence lost "its own code makes no request to Google and", which the user's first sentence now says). The named switches' reasons, the removed library font request, the two measured contacts and the crash-report sentence (N1) are no longer in the published text; the general "may contact Google on its own" covers them, and the detail is kept in `decisions.md` and `measurements/`.

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

This is the only change in 1.0.53 that reaches the iPhone and iPad app (the CHANGELOG's "In every app" line; 1.0.49 to 1.0.52, merged in at the release bumps, shipped from other builds with What's New text of their own). It does not mention Android: App Review Guideline 2.3.10 bars naming other mobile platforms in an app's metadata. **What comes before this line depends on the live App Store query at the ship** (state at the 1.0.52 ship: 1.0.51's record `c98d6dc5` `WAITING_FOR_REVIEW` as submission `ba562487`; 1.0.52 deferred behind it, VALID build 1.0.52.1, no record). If `c98d6dc5` is still in review and the user rolls 1.0.51 and 1.0.52 into this release, the text is 1.0.51's approved three paragraphs (`pipeline/spool-bundle-20261004/whats-new.md`, text (a)), then 1.0.52's approved sentence (`pipeline/species-first-of-year/whats-new.md`), then this line, each word for word. If it is `READY_FOR_SALE` and the user rolls the deferred 1.0.52 into this release, the text is 1.0.52's sentence, then this line. If the user defers 1.0.53 behind a record still in review, this line waits for its own record.

---

## Conflicts found, and what was not decided here

1. **The schema's `NonFreeNet` sentence over-claims** (section a). The committed recipe `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` carries the schema's original sentence as its `AntiFeatures.NonFreeNet.en-US` value (folded over two lines, as `fdroid rewritemeta` writes it); it takes whichever sentence you approve, so the listing and the recipe agree. Its `Categories:` reads the default, `Science & Education`.
2. **App Store risk in the iOS bundle, outside this file's scope.** Guideline 2.3.10 covers the app as well as its metadata, and the in-app Help bundled into the iOS app now names Android (`docs/HELP.md`'s opening, the data-files passage, Settings' API Keys and Default Files, and Troubleshooting). That is the Engineer's and the user's call; flagged because it could draw a review question on the 1.0.49 submission.
3. **`CHANGELOG.md`'s 1.0.49 entry disagreed with the revised plan in two places; both are resolved** by The Engineer: the Internal line now names the one build script and the unsigned universal APK (no App Bundle), and the Added line now reads "On Android the app does not offer to find your location: you move the map by searching for a place or by setting a Default Location.", which is the Branch B fact.
4. **The Weather screenshot** cannot repeat the App Store set's checklist lookup on the emulator, and the Planner stand-in needs an OpenWeather key the capture did not enter; the staged sets carry Multimedia in its place (section b).
5. **Schema 7.4's "typically nothing in a cloud backup"** is not adopted (d5).
6. **Not decided here:** the category, the `NonFreeNet` wording, and the website and README revision of section (c) with its timing. (The location branch is decided: B; NFR-01 is decided: the carve-out, accepted.)
7. **The Google sentences were revised on 2026-10-03 after QA-52**, in (a), the `NonFreeNet` reason and (d5), and in the staged `fdroid/fastlane-proposal/en-US/full_description.txt` (3,996 characters; 3,993 after the security M3 and L1 revision of 2026-10-03), to say what `measurements/safe-browsing/README.md` supports; the committed recipe still carries the schema's original `NonFreeNet` sentence and takes whichever you approve.
