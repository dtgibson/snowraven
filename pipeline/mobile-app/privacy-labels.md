# App Store privacy material — mobile-app (Phase 1, PACKAGE ONLY)

**Status:** prepared per FR-28. NOT published — the public `PRIVACY_POLICY.md`
stays untouched through the TestFlight phase (phased-announcement decision,
2026-07-05). The "Prepared PRIVACY_POLICY.md additions" section below ships
publicly in Phase 2, at App Store launch.

---

## 1. App Store privacy nutrition label (App Store Connect → App Privacy)

**Top-level answer: "Data Not Collected."**

Apple's definition of "collect" is transmitting data off the device in a way
that is accessible to the developer or the developer's partners. SnowRaven
transmits nothing to the developer: there is no developer server, no
analytics, no crash reporting, no accounts, no telemetry. All network calls
go device-to-provider (eBird, OpenWeather, Nominatim/OSM, NOAA, and the map
tile providers), initiated by the user's own actions with the user's own API
keys. Under Apple's taxonomy those third-party calls are the app functioning
as the user's client, not developer collection — the same posture as a
browser. Every question in the App Store Connect questionnaire is answered
**No** ("Do you or your third-party partners collect data from this app?").

Supporting facts, each verifiable against the shipped binary:

| Claim | Ground truth |
|---|---|
| No developer server | No backend ships; TauriTransport routes to on-device TS services only |
| No analytics/telemetry/crash SDK | No such dependency exists in `frontend/package.json` or `src-tauri/Cargo.toml` |
| No accounts | No sign-in surface exists anywhere in the app |
| Keys local-only, per-provider | eBird key sent only to eBird per call; OpenWeather key only to OpenWeather (per-call auth at each call site, no shared headers) |
| Location never retained off-device | "Use my location" fills coordinates locally; they leave the device only as the user's own weather/tide/hotspot query parameters, identical to hand-typed coordinates |
| All CSV/data processing on device | Storage seam writes to the app sandbox (`AppLocalData/data/`); nothing is uploaded |

**Nuance to hold onto at submission time (schema Risk 3):** if an App Review
conversation pushes back on "Data Not Collected" because location/coordinates
reach OpenWeather/NOAA, the honest framing is: the app is a client for
third-party services the *user* configures with their *own* keys; the
developer receives nothing and has no infrastructure capable of receiving
anything. Do not "defensively" declare Location collection — a declared-but-
uncollected label is as wrong as the reverse (NFR-05 cuts both ways).

## 2. iOS permission strings (already in `src-tauri/Info.ios.plist`)

- `NSLocationWhenInUseUsageDescription`: "SnowRaven uses your location to
  center the map on your current position." — when-in-use only; no Always
  key, no background modes. This is the ONLY usage-description key in the
  app.
- `ITSAppUsesNonExemptEncryption = false` — standard HTTPS only (skips the
  export-compliance question per upload).
- Deliberately ABSENT: `UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace`
  (the sandbox holds `data/api-keys.json`; the Files app must not expose it —
  import is picker-only by design), any ATS exception (every provider is
  HTTPS), camera/mic/photos/contacts/tracking keys.

## 3. Prepared PRIVACY_POLICY.md additions (publish in Phase 2 ONLY)

> These edits go into the public `PRIVACY_POLICY.md` when the App Store
> listing goes live — not before.

**a. "Your Data Stays on Your Device" — extend the storage sentence:**

> …stored only on your device (in the desktop app's local data directory, or
> in the iOS app's on-device sandbox on iPhone and iPad), or on your own
> machine when you self-host the web/Pi version.

**b. "Your Location" — add after the existing paragraph:**

> On iPhone and iPad, the first time you tap "Use my location" iOS shows the
> system location permission prompt ("SnowRaven uses your location to center
> the map on your current position"). SnowRaven requests location only while
> you're using the app, never in the background. You can allow or deny it,
> and change your choice at any time in Settings → Privacy & Security →
> Location Services. Denying it leaves everything else working — you can
> always type coordinates or search for a place by name.

**c. "Software Updates" — add:**

> On iPhone and iPad, updates are delivered through the App Store (or
> TestFlight for pre-release builds). The iOS app contains no self-update
> mechanism of its own.

**d. New short section (after "Map Tiles"):**

> ## iOS App
>
> The iOS/iPadOS app is the same local-first application: your files, keys,
> and settings live in the app's sandbox on your device, are included in
> your device/iCloud backups under the iOS defaults, and are removed when
> you delete the app. The app collects nothing and adds no service
> connections beyond those listed above.

**e. No provider-list change.** The mobile build introduces no new network
destination — verified: the outbound set is identical to desktop
(transport seam unchanged; map providers unchanged; geolocation is an
on-device OS API, not a network service).

## 4. Reviewer-notes privacy blurb (for FR-26's reviewer notes)

> SnowRaven is a bring-your-own-data tool: it analyzes eBird/Macaulay CSV
> exports the user imports via the Files picker, entirely on device. It has
> no server, no account, and collects nothing. To exercise the app, import
> the two attached synthetic demo CSVs (Settings → Default Files → "Import
> file…"); the optional live features (weather/tide lookups) need the
> reviewer-supplied API keys in the notes, or can be skipped — every
> analysis tab works from the imported files alone.
