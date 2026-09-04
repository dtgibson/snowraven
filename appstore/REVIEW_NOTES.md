# App Review notes: SnowRaven

This file is the committed source for the App Store Connect **App Review
Information** notes field. The text under "Notes for the reviewer" is pasted
into that field verbatim at submission time and fits the field's 4,000
character limit as committed. No API key of any kind is committed to this
repository or supplied to Apple: the review posture is key-free (user
decision, 2026-08-25; eBird keys are personally linked, and the app's value
is fully demonstrable without one).

---

## Notes for the reviewer (paste into App Store Connect)

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
9. Weather tab, Predict mode: choose a coastal spot and a time to see a NOAA
   tide prediction. Tides need no key at all.

ABOUT THE OPTIONAL KEYED LOOKUPS

A few live lookups (nearby eBird hotspots and sightings, current weather and
forecasts) use the user's own free eBird or OpenWeather key, entered once in
Settings. We supply no review key: those keys are personal, and the app's
no-key states are first-class designed behavior, not errors. Opening a keyed
feature without a key shows a clear message naming the free key it needs and
where it goes. SnowRaven treats missing keys, offline, and provider failures
as designed states with honest messages; everything above shows the app's
full value without any credential.

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

- **Keyless throughout (FR-15):** the imported demo data plus the keyless
  tide and base maps demonstrate the app's full value with no credential at
  all, and they are the answer to the minimum-functionality question: the
  app is full, not thin, the moment data is imported.
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
    keys are the user's own, and there is no login to demo. No review key of
    any kind is supplied (user decision, 2026-08-25, superseding the earlier
    plan to supply a dedicated eBird review key): the keys are personal, and
    the honest no-key states are deliberate evidence of the app's designed
    degraded states.
- **Demo dataset (FR-17):** generated by `website/tools/gen-demo-data.mjs`
  (deterministic, fictional birder, public hotspots only), committed under
  `website/demo/`, and served by the existing GitHub Pages deploy at the
  stable URLs above. Regenerate and recommit the pair in the same edit
  whenever the generator changes.
