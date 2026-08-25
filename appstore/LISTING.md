# SnowRaven App Store Listing Record

This file is the committed source of truth for SnowRaven's App Store Connect
listing. Every field below is entered into App Store Connect from this record,
so the listing is reviewable, diffable, and re-enterable. It carries the same
standing weight as `PRIVACY_POLICY.md`: any future feature that changes a
claim recorded here (most of all the privacy nutrition label) updates this
file in the same release.

Copy conventions: informative, not promotional; SnowRaven works alongside
eBird and the Macaulay Library with gratitude intact; no implied affiliation
with or endorsement by the Cornell Lab of Ornithology. "eBird" and "Macaulay"
appear only in the description and keywords, as compatibility statements,
never in the name or subtitle. No em dashes anywhere in this file (standing
sweep rule; this file is a published-prose surface).

---

## App name (9 / 30)

```
SnowRaven
```

Availability is verified in App Store Connect before any other metadata work.
Only if the bare name is taken is a qualified fallback used ("SnowRaven
Birding Tools"), and that decision is logged in
`pipeline/ios-app-store-release/decisions.md`. As of this record's writing the
name check is an App Store Connect action awaiting the account holder; the
record assumes the bare name per the PRD default.

## Subtitle (27 / 30)

```
Your birding data, explored
```

Alternates considered and available if this one does not sit right:
"Explore your own birding data" (29 / 30), "Your birding records, explored"
(30 / 30). Neither the name nor the subtitle mentions eBird or Macaulay.

## Promotional text (164 / 170)

```
Free and open source, with no account, no ads, and no tracking. Import the exports you already have and see years of your own birding from new angles, even offline.
```

Editable without review, so it can carry release-notes color later. It
deliberately names no third-party service: the strict reading of the voice
rule keeps eBird and Macaulay to the description and keywords only.

## Description (2,706 / 4,000)

```
SnowRaven is a birding data explorer for the records you already keep. Import your own eBird backup and Macaulay Library export, and years of checklists become maps, statistics, and histories you can wander through in the field or at home.

Everything runs on your device. There is no account to create, no server in the middle, and nothing is collected about you.

WHAT'S INSIDE

• Weather & Tide: paste an eBird checklist ID and get a clean, ready-to-paste weather summary, with the historical tide from the nearest NOAA station. Current conditions and forecasts work too.
• Statistics: life list totals and growth, firsts and milestones, temporal and geographic patterns, media documentation coverage, and a few playful lists.
• Map Explorer: your sightings on an interactive map, with an optional heatmap, nearby hotspots, county shading, and a breeding atlas overlay.
• Species Detail: your complete history with any species, including graphs, top locations, field notes, and your own recent photos, audio, and video.
• Calendar: a year of your birding as twelve month grids, each day shaded by how busy it was.
• Multimedia: your life list as a media checklist, showing photo, audio, and video coverage for every species.
• Breeding Codes: every species you have recorded breeding evidence for, laid out as a color-coded matrix.
• Named Birds: tag an individual bird in a species comment and SnowRaven follows it across your checklists.
• Checklists and List Comparer: search every comment you have written, and compare lists or checklists side by side.

Once your data has loaded, the maps and every analytical tab keep working offline.

PRIVACY

SnowRaven collects nothing: no analytics, no telemetry, no crash reporting, no ads, and no accounts. Your files, settings, and API keys stay on your device. When you ask for live data, the app talks directly to the service that has it, using your own free API keys where one is needed. The full privacy policy is at snowraven.dtgibson.com/privacy.html.

WHAT YOU'LL NEED

Most tools read the free data export you can download from your eBird account, plus an optional Macaulay Library export. Live lookups use two free API keys, entered once in Settings: an eBird key, and an OpenWeather key for weather. Tides, maps, and every offline analysis work without any key.

SnowRaven is an independent, free, open source project. It works alongside eBird and the Macaulay Library, building on the exports they let you download, so you can look at your own observations from new angles. It is not affiliated with, or endorsed by, the Cornell Lab of Ornithology. Also available free for Mac and Windows, and as a self-hosted web app, at snowraven.dtgibson.com.
```

Every eBird and Macaulay Library mention above is a compatibility statement
about the user's own data, and the closing paragraph carries the explicit
non-affiliation sentence.

## Keywords (97 / 100)

```
bird,life list,ebird,checklist,tide,weather,hotspot,species,birdwatching,lifer,bird list,macaulay
```

Comma-separated, no spaces after commas. Skips words already indexed from the
name and subtitle (birding, data). "ebird" and "macaulay" ride as
compatibility terms, which the voice rules allow in keywords.

## Categories

- **Primary: Reference.** The app is a reference companion over the user's
  own birding records: life list, species history, breeding codes, taxonomy.
- **Secondary: Weather.** The founding feature is the weather and tide lookup.

Alternatives considered: Lifestyle (too broad, says nothing) and Navigation
(the map serves the data, not routing).

## URLs

| Field | Value |
|---|---|
| Marketing URL | `https://snowraven.dtgibson.com` |
| Support URL | `https://github.com/dtgibson/snowraven` |
| Privacy policy URL | `https://snowraven.dtgibson.com/privacy.html` |

GitHub issues are the real support channel. The privacy policy URL must be
live before submission; the page ships in the same release as this record and
deploys with the website on push to `main`.

## Copyright

```
2026 Dave Gibson
```

## Price and monetization

**Free**, with no monetization of any kind: no in-app purchase, no ads, no
donations, no Paid Applications agreement.

## Version

**1.0.0, build 1**, in lockstep across every platform (`frontend/package.json`
and `src-tauri/tauri.conf.json` bumped together): the App Store debut ships as
a deliberate one-time jump from 0.5.x (user decision, 2026-08-25). The
standing incremental rhythm resumes upward from 1.0.0 afterward (1.0.1,
1.0.2, patch by default). No release ever carries a version lower than one
already shipped: App Store Connect requires each submitted version to
increase, and the desktop updater's latest.json comparison would strand
1.0.0 installs behind any lower number.

---

## Compliance record

### Privacy nutrition label: "Data Not Collected"

Every question in the App Store Connect App Privacy questionnaire ("Do you or
your third-party partners collect data from this app?") is answered **No**,
yielding the top-level label **Data Not Collected**.

Why the claim is true, re-verified against the shipped 1.0.0 behavior (the
original reasoning was prepared 2026-07-05 in
`pipeline/mobile-app/privacy-labels.md`; everything below was re-checked
against the current codebase, including the features shipped since):

Apple's definition of "collect" is transmitting data off the device in a way
that is accessible to the developer or the developer's partners. SnowRaven
transmits nothing to the developer: there is no developer server, no
analytics, no crash reporting, no accounts, no telemetry, and no third-party
SDK with a network presence. All network calls go device-to-provider (eBird,
OpenWeather, Nominatim/OSM, NOAA, the map tile providers, and the Cornell Lab
sites that serve link icons and, while enabled, embedded Macaulay media),
initiated by the user's own actions with the user's own API keys. Under
Apple's taxonomy those third-party calls are the app functioning as the
user's client, not developer collection, the same posture as a browser.

| Claim | Ground truth (verified at 1.0.0) |
|---|---|
| No developer server | No backend ships in the iOS app; TauriTransport routes to on-device TS services only |
| No analytics / telemetry / crash SDK | No such dependency exists in `frontend/package.json` or `src-tauri/Cargo.toml` |
| No accounts | No sign-in surface exists anywhere in the app |
| Keys local-only, per-provider | eBird key sent only to eBird per call; OpenWeather key only to OpenWeather (per-call auth at each call site, no shared headers) |
| Location never retained off-device | "Use my location" fills coordinates locally; they leave the device only as the user's own weather/tide/hotspot query parameters, identical to hand-typed coordinates |
| All CSV/data processing on device | Storage seam writes to the app sandbox (`AppLocalData/data/`); nothing is uploaded |

Features shipped since the original reasoning, each re-checked against the
definition of "collect" and none changing the answer:

- **Exotic escapee provenance (v0.5.87):** the Statistics tab's Count
  escapees rule sends a small covering subset of the user's own checklist IDs
  to eBird, with the user's own key, only when the user turns it on; the
  answer is cached on the device. Device-to-provider, user-initiated, nothing
  reaches the developer.
- **Hotspot Recent activity coloring (v0.5.92):** per-hotspot recent species
  counts fetched from eBird with the user's own key, opt-in, bounded, cached
  on the device for six hours. Same posture.
- **eBird pacing gate (v0.5.92/93):** request spacing and rate-limit
  cooldowns are purely client-side manners; no new destination, no new data.
- **Macaulay embed-status probe (v0.5.76):** one small request per session to
  macaulaylibrary.org to learn whether embedded players will work; it carries
  nothing about the user beyond what any request carries (IP address), goes
  device-to-Cornell in the apps, and is disabled entirely by the Disable
  embedded media setting.

Nuance to hold onto if App Review pushes back on the label because
location/coordinates reach OpenWeather or NOAA: the app is a client for
third-party services the user configures with the user's own keys; the
developer receives nothing and has no infrastructure capable of receiving
anything. Do not defensively declare Location collection: a
declared-but-uncollected label is as wrong as the reverse.

Standing rule: any future feature that would change this label is a listing
change in the same release, exactly as the privacy-policy rule already works.

### Age rating questionnaire (expected outcome: 4+)

Answers, each honest against shipped behavior:

| Question | Answer |
|---|---|
| Cartoon or fantasy violence | None |
| Realistic violence | None |
| Prolonged graphic or sadistic realistic violence | None |
| Profanity or crude humor | None |
| Mature or suggestive themes | None |
| Horror or fear themes | None |
| Medical or treatment information | None |
| Alcohol, tobacco, or drug use or references | None |
| Simulated gambling | None |
| Sexual content or nudity | None |
| Graphic sexual content or nudity | None |
| Contests | None |
| Gambling (real money) | No |
| Unrestricted web access | No (there is no in-app browser; external links open in the system browser) |
| User-generated content shared between users | No (the app displays only the user's own imported data; nothing is shared between users) |
| Made for Kids | No |

### Export compliance

`ITSAppUsesNonExemptEncryption` is `false` (standard HTTPS only) in both
`src-tauri/Info.ios.plist` and the committed
`src-tauri/gen/apple/snowraven_iOS/Info.plist`, so no per-upload compliance
question appears. Verified present in both at 1.0.0.

### Content rights declaration

Answer honestly that the app has the necessary rights to the third-party
content it displays:

- The app displays the **user's own** eBird and Macaulay Library data,
  imported by the user from the exports those services let them download.
- Embedded Macaulay Library media are the **user's own uploads**, served by
  Cornell's own embed endpoint the same way any web page embeds them; a
  Settings toggle disables all embeds.
- Bundled reference datasets are used within their license terms: the eBird
  taxonomy snapshot (regenerated from the eBird API under the user's own
  key, per eBird's API terms), the California Breeding Bird Atlas block
  geometry, and US county boundaries derived from US Census TIGER data (a
  public-domain US government source).
- The app implies no affiliation with or endorsement by the Cornell Lab of
  Ornithology, and the description says so explicitly.

### Review key

A dedicated free eBird API key for App Review is supplied **only** in the App
Store Connect review-notes field at submission time. No API key of any kind is
committed to this repository. See `appstore/REVIEW_NOTES.md`.
