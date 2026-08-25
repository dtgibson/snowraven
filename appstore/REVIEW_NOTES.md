# App Review notes: SnowRaven

This file is the committed source for the App Store Connect **App Review
Information** notes field. The text under "Notes for the reviewer" is pasted
into that field at submission time, with the one bracketed placeholder filled
in there and only there. No API key of any kind is ever committed to this
repository.

**Placeholder rule:** `[REVIEW EBIRD API KEY]` below is filled in by the
account holder inside App Store Connect at submission time, with a dedicated
free eBird API key created for review. If that key is ever rotated, only the
App Store Connect field changes; this file does not.

---

## Notes for the reviewer (paste into App Store Connect)

SnowRaven is a bring-your-own-data tool for birders: it analyzes the eBird
and Macaulay Library CSV exports a user downloads from their own accounts,
entirely on device. There is no account, no login, no server we operate, and
the app collects nothing (the privacy label "Data Not Collected" is the
literal truth: no analytics, no telemetry, no third-party SDKs).

Because the app is built around the user's own exported data, we host a
synthetic demo dataset (a fictional birder at public northeast-US hotspots)
so you can exercise every feature without an eBird account:

- Demo eBird backup:
  https://snowraven.dtgibson.com/demo/snowraven-demo-ebird-backup.csv
- Demo Macaulay Library export:
  https://snowraven.dtgibson.com/demo/snowraven-demo-ml-export.csv

STEP 1: IMPORT THE DEMO DATA (no key needed)

1. In Safari on the test device, download both CSV files above (long-press
   each link and choose Download Linked File, or open and tap the share/
   download control). They land in the Files app.
2. Open SnowRaven, go to the Settings tab, and under Default Files choose
   "Import file..." for the eBird backup; pick
   snowraven-demo-ebird-backup.csv from Files. Repeat for the ML export with
   snowraven-demo-ml-export.csv.
3. Every analysis tab now works from the imported files alone, fully
   offline.

STEP 2: THE KEYLESS FEATURES (most of the app)

4. Statistics: life list totals and growth, milestones, patterns, media
   coverage, and the playful lists at the bottom. All computed on device.
5. Calendar: a year of birding as twelve shaded month grids; tap any day for
   its checklists. Deliberately zero-network.
6. Species Detail: pick a species (for example Northern Cardinal) for its
   full history, graphs, and a map of every observation.
7. Map Explorer: the demo birder's sightings on an interactive map; tap a
   location in "Sightings in view" (in Filters) to open its popup.
8. Breeding Codes, Multimedia, Named Birds, Checklists: each reads only the
   imported files.
9. Weather tab, Predict mode: choose a coastal spot and a time to see a NOAA
   tide prediction. Tides need no key at all.

STEP 3: THE KEYED FEATURES (with the review key below)

10. In Settings, paste this eBird API key (a dedicated free review key tied
    to a developer-controlled eBird account, supplied for review only):
    [REVIEW EBIRD API KEY]
11. Map Explorer, Hotspots view: Find Hotspots shows nearby public eBird
    hotspots; Nearby Lifers maps recently reported species the demo birder
    has not recorded.
12. Weather tab: paste any public eBird checklist ID (for example S354229002)
    to look up its location and the historical tide.

We have deliberately NOT supplied an OpenWeather key. The weather half of a
lookup then shows the app's honest "no key configured" state, which is
first-class product behavior, not an error: SnowRaven treats missing keys,
offline, and provider failures as designed states with clear messages. Every
feature above works without it.

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

ABOUT ACCOUNTS AND KEYS

There is no account and no login to demo: that is the design, not a gap. The
app is a client for services the user already uses; live lookups use the
user's own free API keys, entered once in Settings and stored only on the
device. Nothing is transmitted to the developer, and there is no developer
infrastructure capable of receiving anything.

---

## Why the script is ordered this way (repo-side record, not pasted)

- **Keyless first (FR-15):** the imported demo data plus the keyless tide
  demonstrate the app's value before any credential enters the picture, and
  they are the answer to the minimum-functionality question: the app is full,
  not thin, the moment data is imported.
- **The three risk areas are answered in advance (FR-16):**
  - *Minimum functionality / external-data dependence:* answered by the
    hosted demo dataset, the import walkthrough, and the first-class
    no-key/offline/failure states. Nothing a reviewer hits without
    credentials looks broken.
  - *Macaulay embeds:* answered honestly in the notes. The embeds show the
    user's own media, a Settings toggle disables them entirely, and the
    bot-check placeholder (v0.5.76) means a blocked player is never a broken
    frame. SnowRaven works alongside Cornell's services, never around their
    protection.
  - *User-supplied keys / sign-in-less design:* no account exists by design,
    keys are the user's own, and there is no login to demo. A dedicated free
    review key is supplied in the notes field only.
- **No OpenWeather review key (PRD open question 3 default):** the honest
  no-key state is shown deliberately as evidence of the app's designed
  degraded states, and it keeps a card-backed credential out of the review
  package.
- **Demo dataset (FR-17):** generated by `website/tools/gen-demo-data.mjs`
  (deterministic, fictional birder, public hotspots only), committed under
  `website/demo/`, and served by the existing GitHub Pages deploy at the
  stable URLs above. Regenerate and recommit the pair in the same edit
  whenever the generator changes.
