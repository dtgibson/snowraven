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
