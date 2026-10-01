# Held proposal (i): trimming the App Review notes so the Alerts block fits

NOT APPLIED. The App Review notes are pasted into App Store Connect, so they change only on the user's express yes (CLAUDE.md, published copy). `appstore/REVIEW_NOTES.md` is unchanged. On a yes, the "Notes for the reviewer" section of that file is replaced with the AFTER text below, and that text is what gets pasted at the 1.0.42 submission.

**Why this is needed.** With the approved Alerts block (h) added, the pasted notes are too long for App Store Connect's App Review notes field, which takes 4,000 characters. Without the block they were already 3,953, so the block cannot fit unless older text is cut. This proposal cuts repetition and detail from the older blocks and leaves the approved Alerts block word for word.

**How it is measured.** The text between the "## Notes for the reviewer (paste into App Store Connect)" heading and the closing `---`, with leading and trailing blank lines removed, as committed: hard line breaks included, one character per line break. This is the measure the file's own header uses ("fits the field's 4,000 character limit as committed") and the one used at the 1.0.42 preparation. The figure with each paragraph unwrapped onto one line is given too; it is always slightly lower.

| Version | As committed | Unwrapped |
|---|---|---|
| Current committed notes, no Alerts block | 3,953 | 3,910 |
| BEFORE: current notes plus the approved Alerts block (h) | 4,792 | 4,749 |
| AFTER: this proposal, Alerts block unchanged | 3,898 | 3,867 |

AFTER is 102 characters under App Store Connect's 4,000 and 2 under the 3,900 target set for a margin. The approved Alerts block is 837 characters, unchanged.

**Still stated after the trim.** Each of these is something App Review needs for this build:
- The declared background mode is fetch (a BGAppRefreshTask), not location, and why: a check measures from a fixed place, or from a position the app or a placed widget recorded. (Alerts block, unchanged.)
- No Always: the check never reads location in the background or asks for Always. (Alerts block, unchanged.)
- Notifications are local, with no push. (Alerts block, unchanged.)
- Each check is the same eBird request Nearby Lifers makes, with the user's own key. (Alerts block, unchanged.)
- What happens with no key, as in review: Alerts, the widgets and the keyed lookups each say which key they need and make no request.
- The widgets use location only under When In Use and never prompt. (Widgets block, kept.)
- How to load the demo data and find each tab, the key-free review posture, and the Macaulay Library embeds' toggle and placeholder.

## Block by block

The opening paragraph and every block it changes are shown before and after. Unchanged: the two demo links, both STEP headings and every ABOUT heading; the Alerts block, already approved, is under "Unchanged" below.

### Opening paragraph (363 to 300 characters)

**Before**

```text
SnowRaven is a bring-your-own-data tool for birders: it analyzes the eBird
and Macaulay Library CSV exports a user downloads from their own accounts,
entirely on device. There is no account, no login, no server we operate, and
the app collects nothing (the privacy label "Data Not Collected" is the
literal truth: no analytics, no telemetry, no third-party SDKs).
```

**After**

```text
SnowRaven is a bring-your-own-data tool for birders: it analyzes the eBird
and Macaulay Library CSV exports a user downloads from their own accounts,
entirely on device. There is no account, no login and no server we operate,
and the app collects nothing: no analytics, telemetry or third-party SDKs.
```

**Why each cut is safe**

- Dropped the parenthetical saying the "Data Not Collected" label "is the literal truth". The label itself says it, and the sentence keeps the facts (no analytics, telemetry or third-party SDKs).

### Demo dataset sentence (209 to 109 characters)

**Before**

```text
Because the app is built around the user's own exported data, we host a
synthetic demo dataset (a fictional birder at public northeast-US hotspots)
so you can exercise every feature without any account or key:
```

**After**

```text
We host a synthetic demo dataset (a fictional birder) so you can try every
feature without an account or key:
```

**Why each cut is safe**

- Dropped "Because the app is built around the user's own exported data". The opening paragraph already says so.
- Dropped "at public northeast-US hotspots". Where the fictional birder birds tells App Review nothing it needs.

### Where to find the tabs (196 to 178 characters)

**Before**

```text
Where to find the tabs: on iPad, a list down the left in landscape and
icons in portrait (hold one for its name); on iPhone, a bottom bar of the
first four, with the rest and Settings behind More.
```

**After**

```text
Tabs: on iPad, a list down the left in landscape and icons in portrait (hold
one for its name); on iPhone, a bottom bar of the first four, with the rest
and Settings behind More.
```

**Why each cut is safe**

- "Where to find the tabs:" became "Tabs:". The directions themselves are unchanged.

### STEP 1 (539 to 357 characters)

**Before**

```text
STEP 1: IMPORT THE DEMO DATA

1. In Safari on the test device, download both CSV files above (long-press
   each link and choose Download Linked File, or open and tap the share/
   download control). They land in the Files app.
2. Open SnowRaven, go to the Settings tab, and under Default Files choose
   "Import file..." for the eBird backup; pick
   snowraven-demo-ebird-backup.csv from Files. Repeat for the ML export with
   snowraven-demo-ml-export.csv.
3. Every analysis tab now works from the imported files alone, fully
   offline.
```

**After**

```text
STEP 1: IMPORT THE DEMO DATA

1. In Safari, download both CSV files above (long-press each link, then
   Download Linked File). They land in the Files app.
2. In SnowRaven's Settings, under Default Files, choose "Import file..." for
   the eBird backup and pick snowraven-demo-ebird-backup.csv. Repeat for the
   ML export with snowraven-demo-ml-export.csv.
```

**Why each cut is safe**

- Dropped "on the test device" and the second download route ("or open and tap the share/download control"). One route is enough, and long-press then Download Linked File is Safari's standard one.
- Merged "Open SnowRaven, go to the Settings tab" into "In SnowRaven's Settings" and dropped the repeated "from Files". Every UI label is kept as shipped ("Default Files", "Import file...").
- Dropped item 3 ("Every analysis tab now works from the imported files alone, fully offline"). The STEP 2 heading and its items already show it.

### STEP 2 (849 to 641 characters)

**Before**

```text
STEP 2: THE FULL EXPERIENCE, NO KEY NEEDED

4. Statistics: life list totals and growth, milestones, patterns, media
   coverage, and the playful lists at the bottom. All computed on device.
5. Calendar: a year of birding as twelve shaded month grids; tap any day for
   its checklists. Deliberately zero-network.
6. Species Detail: pick a species (for example Northern Cardinal) for its
   full history, graphs, and a map of every observation.
7. Map Explorer: the demo birder's sightings on an interactive map with
   keyless base maps; tap a location in "Sightings in view" (in Filters) to
   open its popup.
8. Breeding Codes, Multimedia, Named Birds, Checklists: each reads only the
   imported files.
9. Weather tab, Plan: choose a coastal spot and a time, then Get specific
   forecast, to see a NOAA tide prediction. Tides need no key at all.
```

**After**

```text
STEP 2: THE FULL EXPERIENCE, NO KEY NEEDED

3. Statistics: life list totals, growth, milestones and patterns, computed
   on device.
4. Calendar: a year of birding as shaded month grids; tap a day for its
   checklists.
5. Species Detail: pick a species (for example Northern Cardinal) for its
   full history, graphs and a map of every observation.
6. Map Explorer: the demo birder's sightings on a map with keyless base
   maps; tap a location in "Sightings in view" (in Filters) to open its
   popup.
7. Weather tab, Plan: choose a coastal spot and a time, then Get specific
   forecast, to see a NOAA tide prediction, which needs no key.
```

**Why each cut is safe**

- Statistics: dropped "media coverage, and the playful lists at the bottom". These are detail, not something review needs to find.
- Calendar: dropped "twelve" and "Deliberately zero-network". The opening paragraph already covers the privacy posture.
- Map Explorer: dropped "interactive". Nothing a reviewer would act on.
- Dropped the old item 8 ("Breeding Codes, Multimedia, Named Birds, Checklists: each reads only the imported files"). Those tabs are in the navigation the Tabs line describes, and the opening paragraph says everything is analyzed from the user's exports on device.
- Weather: "Tides need no key at all" became "which needs no key". Same statement.
- Items renumbered 3 to 7 after STEP 1's item 3 was dropped. None of this lists the Targets tab (new in 1.0.39), before or after. Adding it would cost characters for nothing review needs.

### ABOUT THE OPTIONAL KEYED LOOKUPS (498 to 412 characters)

**Before**

```text
ABOUT THE OPTIONAL KEYED LOOKUPS

A few live lookups (nearby eBird hotspots and sightings, current weather and
forecasts) use the user's own free eBird or OpenWeather key, entered once in
Settings. We supply no review key: those keys are personal, and the app's
no-key states are first-class designed behavior, not errors. Opening a keyed
feature without a key shows a clear message naming the free key it needs and
where it goes. Everything above shows the app's full value without any
credential.
```

**After**

```text
ABOUT THE OPTIONAL KEYED LOOKUPS

A few live lookups (nearby eBird hotspots and sightings, current weather and
forecasts) use the user's own free eBird or OpenWeather key, entered once in
Settings. We supply no review key: those keys are personal, and the app's
no-key states are designed behavior, not errors. Opening a keyed feature
without a key shows a message naming the free key it needs and where it
goes.
```

**Why each cut is safe**

- Dropped the closing "Everything above shows the app's full value without any credential". It restates the STEP 2 heading ("NO KEY NEEDED").
- Dropped "first-class" and "clear" as emphasis. The no-key posture, the no-review-key decision and the message naming the key are all kept.

### ABOUT THE MACAULAY LIBRARY EMBEDS (646 to 420 characters)

**Before**

```text
ABOUT THE MACAULAY LIBRARY EMBEDS

Species Detail and Named Birds can show the user's own photos, audio, and
video embedded from macaulaylibrary.org, exactly as any web page embeds
them; they show the user's own uploads, never other people's media. A
Settings toggle (Disable embedded media) turns all embeds off. When the
Cornell Lab's bot check blocks embedded players, the app detects it and
shows its own honest placeholder with a link out rather than a broken frame.
Note: the demo ML export uses synthetic catalog numbers, so demo embeds
resolve to that placeholder state by design; with a real user's export they
play the user's own media.
```

**After**

```text
ABOUT THE MACAULAY LIBRARY EMBEDS

Species Detail and Named Birds can embed the user's own photos, audio and
video from macaulaylibrary.org, never other people's media. A Settings
toggle (Disable embedded media) turns all embeds off. When the Cornell Lab's
bot check blocks a player, the app shows its own placeholder with a link
out. The demo ML export's synthetic catalog numbers resolve to that
placeholder by design.
```

**Why each cut is safe**

- Dropped "exactly as any web page embeds them" (rhetorical) and folded "they show the user's own uploads" into "the user's own ... never other people's media", which says it once.
- Dropped "the app detects it", "honest" and "rather than a broken frame". The placeholder with a link out is the behavior, and the sentence still states it.
- Dropped "with a real user's export they play the user's own media". The block's first sentence already says the embeds are the user's own media.

### ABOUT THE HOME-SCREEN WIDGETS (448 to 437 characters)

**Before**

```text
ABOUT THE HOME-SCREEN WIDGETS

On iOS and iPadOS 17 or later, optional Nearby Lifers and Media Targets
widgets list the nearest recent eBird reports of birds the user still
needs, and a tap opens Map Explorer. They use location only under the
app's When In Use permission, never prompt on their own, and send
coordinates only to eBird, with the user's own key. With no key, as in
review, a placed widget names the key it needs and makes no request.
```

**After**

```text
ABOUT THE HOME-SCREEN WIDGETS

On iOS and iPadOS 17 or later, optional Nearby Lifers and Media Targets
widgets list the nearest recent eBird reports of birds the user still needs;
a tap opens Map Explorer. They use location only under the app's When In Use
permission, never prompt on their own, and send coordinates only to eBird,
with the user's own key. With no key, as in review, a widget names the key
it needs and makes no request.
```

**Why each cut is safe**

- ", and a tap" became "; a tap" and "a placed widget" became "a widget". Every statement is kept: iOS 17, the two widgets, When In Use only, never prompting, coordinates only to eBird with the user's key, the no-key behavior in review.

### Unchanged

The two demo links, and the approved Alerts block (h), word for word:

```text
ABOUT ALERTS AND THE BACKGROUND MODE

On iPhone and iPad, Settings has an Alerts section, off by default. When the
user turns it on, SnowRaven checks about hourly or about daily for species
the user has never recorded near a place they choose, and posts one local
notification per check. The declared background mode is fetch (a
BGAppRefreshTask), not location: a check measures from a fixed place, or
under My location from the most recent position the app recorded while in
use or a placed widget read from the device on its own refresh. The check
itself never reads location in the background or asks for Always. Each check
is the same eBird request the app's Nearby Lifers view makes, with the
user's own key; notifications are local, with no push. With no key, as in
review, the section says which key it needs and makes no request.
```

## BEFORE, in full (current notes plus the approved Alerts block)

```text
SnowRaven is a bring-your-own-data tool for birders: it analyzes the eBird
and Macaulay Library CSV exports a user downloads from their own accounts,
entirely on device. There is no account, no login, no server we operate, and
the app collects nothing (the privacy label "Data Not Collected" is the
literal truth: no analytics, no telemetry, no third-party SDKs).

Because the app is built around the user's own exported data, we host a
synthetic demo dataset (a fictional birder at public northeast-US hotspots)
so you can exercise every feature without any account or key:

- Demo eBird backup:
  https://snowraven.dtgibson.com/demo/snowraven-demo-ebird-backup.csv
- Demo Macaulay Library export:
  https://snowraven.dtgibson.com/demo/snowraven-demo-ml-export.csv

Where to find the tabs: on iPad, a list down the left in landscape and
icons in portrait (hold one for its name); on iPhone, a bottom bar of the
first four, with the rest and Settings behind More.

STEP 1: IMPORT THE DEMO DATA

1. In Safari on the test device, download both CSV files above (long-press
   each link and choose Download Linked File, or open and tap the share/
   download control). They land in the Files app.
2. Open SnowRaven, go to the Settings tab, and under Default Files choose
   "Import file..." for the eBird backup; pick
   snowraven-demo-ebird-backup.csv from Files. Repeat for the ML export with
   snowraven-demo-ml-export.csv.
3. Every analysis tab now works from the imported files alone, fully
   offline.

STEP 2: THE FULL EXPERIENCE, NO KEY NEEDED

4. Statistics: life list totals and growth, milestones, patterns, media
   coverage, and the playful lists at the bottom. All computed on device.
5. Calendar: a year of birding as twelve shaded month grids; tap any day for
   its checklists. Deliberately zero-network.
6. Species Detail: pick a species (for example Northern Cardinal) for its
   full history, graphs, and a map of every observation.
7. Map Explorer: the demo birder's sightings on an interactive map with
   keyless base maps; tap a location in "Sightings in view" (in Filters) to
   open its popup.
8. Breeding Codes, Multimedia, Named Birds, Checklists: each reads only the
   imported files.
9. Weather tab, Plan: choose a coastal spot and a time, then Get specific
   forecast, to see a NOAA tide prediction. Tides need no key at all.

ABOUT THE OPTIONAL KEYED LOOKUPS

A few live lookups (nearby eBird hotspots and sightings, current weather and
forecasts) use the user's own free eBird or OpenWeather key, entered once in
Settings. We supply no review key: those keys are personal, and the app's
no-key states are first-class designed behavior, not errors. Opening a keyed
feature without a key shows a clear message naming the free key it needs and
where it goes. Everything above shows the app's full value without any
credential.

ABOUT THE MACAULAY LIBRARY EMBEDS

Species Detail and Named Birds can show the user's own photos, audio, and
video embedded from macaulaylibrary.org, exactly as any web page embeds
them; they show the user's own uploads, never other people's media. A
Settings toggle (Disable embedded media) turns all embeds off. When the
Cornell Lab's bot check blocks embedded players, the app detects it and
shows its own honest placeholder with a link out rather than a broken frame.
Note: the demo ML export uses synthetic catalog numbers, so demo embeds
resolve to that placeholder state by design; with a real user's export they
play the user's own media.

ABOUT THE HOME-SCREEN WIDGETS

On iOS and iPadOS 17 or later, optional Nearby Lifers and Media Targets
widgets list the nearest recent eBird reports of birds the user still
needs, and a tap opens Map Explorer. They use location only under the
app's When In Use permission, never prompt on their own, and send
coordinates only to eBird, with the user's own key. With no key, as in
review, a placed widget names the key it needs and makes no request.

ABOUT ALERTS AND THE BACKGROUND MODE

On iPhone and iPad, Settings has an Alerts section, off by default. When the
user turns it on, SnowRaven checks about hourly or about daily for species
the user has never recorded near a place they choose, and posts one local
notification per check. The declared background mode is fetch (a
BGAppRefreshTask), not location: a check measures from a fixed place, or
under My location from the most recent position the app recorded while in
use or a placed widget read from the device on its own refresh. The check
itself never reads location in the background or asks for Always. Each check
is the same eBird request the app's Nearby Lifers view makes, with the
user's own key; notifications are local, with no push. With no key, as in
review, the section says which key it needs and makes no request.
```

## AFTER, in full (what would be committed and pasted)

```text
SnowRaven is a bring-your-own-data tool for birders: it analyzes the eBird
and Macaulay Library CSV exports a user downloads from their own accounts,
entirely on device. There is no account, no login and no server we operate,
and the app collects nothing: no analytics, telemetry or third-party SDKs.

We host a synthetic demo dataset (a fictional birder) so you can try every
feature without an account or key:

- Demo eBird backup:
  https://snowraven.dtgibson.com/demo/snowraven-demo-ebird-backup.csv
- Demo Macaulay Library export:
  https://snowraven.dtgibson.com/demo/snowraven-demo-ml-export.csv

Tabs: on iPad, a list down the left in landscape and icons in portrait (hold
one for its name); on iPhone, a bottom bar of the first four, with the rest
and Settings behind More.

STEP 1: IMPORT THE DEMO DATA

1. In Safari, download both CSV files above (long-press each link, then
   Download Linked File). They land in the Files app.
2. In SnowRaven's Settings, under Default Files, choose "Import file..." for
   the eBird backup and pick snowraven-demo-ebird-backup.csv. Repeat for the
   ML export with snowraven-demo-ml-export.csv.

STEP 2: THE FULL EXPERIENCE, NO KEY NEEDED

3. Statistics: life list totals, growth, milestones and patterns, computed
   on device.
4. Calendar: a year of birding as shaded month grids; tap a day for its
   checklists.
5. Species Detail: pick a species (for example Northern Cardinal) for its
   full history, graphs and a map of every observation.
6. Map Explorer: the demo birder's sightings on a map with keyless base
   maps; tap a location in "Sightings in view" (in Filters) to open its
   popup.
7. Weather tab, Plan: choose a coastal spot and a time, then Get specific
   forecast, to see a NOAA tide prediction, which needs no key.

ABOUT THE OPTIONAL KEYED LOOKUPS

A few live lookups (nearby eBird hotspots and sightings, current weather and
forecasts) use the user's own free eBird or OpenWeather key, entered once in
Settings. We supply no review key: those keys are personal, and the app's
no-key states are designed behavior, not errors. Opening a keyed feature
without a key shows a message naming the free key it needs and where it
goes.

ABOUT THE MACAULAY LIBRARY EMBEDS

Species Detail and Named Birds can embed the user's own photos, audio and
video from macaulaylibrary.org, never other people's media. A Settings
toggle (Disable embedded media) turns all embeds off. When the Cornell Lab's
bot check blocks a player, the app shows its own placeholder with a link
out. The demo ML export's synthetic catalog numbers resolve to that
placeholder by design.

ABOUT THE HOME-SCREEN WIDGETS

On iOS and iPadOS 17 or later, optional Nearby Lifers and Media Targets
widgets list the nearest recent eBird reports of birds the user still needs;
a tap opens Map Explorer. They use location only under the app's When In Use
permission, never prompt on their own, and send coordinates only to eBird,
with the user's own key. With no key, as in review, a widget names the key
it needs and makes no request.

ABOUT ALERTS AND THE BACKGROUND MODE

On iPhone and iPad, Settings has an Alerts section, off by default. When the
user turns it on, SnowRaven checks about hourly or about daily for species
the user has never recorded near a place they choose, and posts one local
notification per check. The declared background mode is fetch (a
BGAppRefreshTask), not location: a check measures from a fixed place, or
under My location from the most recent position the app recorded while in
use or a placed widget read from the device on its own refresh. The check
itself never reads location in the background or asks for Always. Each check
is the same eBird request the app's Nearby Lifers view makes, with the
user's own key; notifications are local, with no push. With no key, as in
review, the section says which key it needs and makes no request.
```
