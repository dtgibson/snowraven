# Change Brief — Widget measure-from choice

## Lane check
**Decided 2026-10-01: the user chose to re-scope and stay on Improve, with the narrow shape below.** The full Alerts shape (a hand-set place per widget) stays out of scope.

This tripped a branch rule, so the lane was the user's call. A "Measure from" row in the Edit Widget sheet is a control the user can use that they couldn't before (Promote rule 1). It also reverses the widgets PRD's Out of Scope line, "a per-widget custom center".
- **The full Alerts shape is a feature.** A hand-set place per widget is new persisted data (rule 4). A place search in the edit sheet would also send a request to Apple's geocoder, which the privacy policy does not name.
- **The narrow shape is the Improve re-scope this brief is written for.** It offers two values, **My location** and **Default Location**, reusing the Default Location the widgets already read from the hand-over. The user's own words support it: "current location in addition to the default location". It adds one row to an existing sheet, no new screen, no app data model and no new request. WidgetKit stores the value per widget, as it stores Time range.

## What is changing
- Both widget kinds gain a **Measure from** parameter. **My location** is the default and is exactly today's behavior: the device position at refresh, else the Default Location with "From your default location", else S6.
- **Default Location** measures from the hand-over's Default Location on every refresh. It never calls the locator, so it reads no location.
- With no Default Location saved, it shows its own sentence asking for one and makes no request.
- "Fixed place" means the existing Default Location. That mirrors Alerts, whose Fixed place follows the Default Location until a place is hand-set.
- It does not mean Alerts' own place, because the widgets would then move whenever Alerts changes. It does not mean a new per-widget place either (new data and a new search flow).
- **A tap matches the list.** When a widget's rows came from the Default Location, whether chosen or as the fallback, the link says so. Map Explorer then searches from its saved Default Location with no location read, so the listed bird is on the map. Today every tap runs Use my location (FR-36).

## Why now
The user asked on 2026-10-01 to "allow ios widgets to measure distance from the user's current location in addition to the default location (like the iOS alerts do)". Given the choice, they picked "a per-widget choice like Alerts".
Alerts (v1.0.42) offers Measure from: Fixed place / My location. The widgets (v1.0.36) offer no choice: they always try the device first, and a user cannot pin a widget to home.

## User-facing impact
- **Edit Widget sheet:** a new Measure from row on Nearby Lifers (its second row) and Media Targets (its third).
- **Widgets already placed:** unchanged. They pick up the parameter's default, My location, which is today's behavior. Confirm this in the simulator.
- **A Default Location widget:** reads no location, shows the caption (the Designer decides), and has its own no-place sentence.
- **Tapping a Default Location list:** the landing line drops "near you", reusing the alert link's `fromPoint` wording.
- **eBird requests:** a home screen that mixes both choices searches two areas. "At most one eBird request per 15 minutes" (NFR-03, HELP) becomes one per area, so at most two. HELP's sentence is updated to match.
- **Alerts' My location:** still never treats a Default Location area as "near you". A refresh measured from a chosen Default Location writes `cellSource: default-location` (security L7).
- **Mac, Windows, web/Pi:** no change. The usage string is unchanged and still true.

## Design pass
**Needed.** The surfaces:
- The Edit Widget sheet: the parameter title, the two value names and any subtitles. Alerts says "My location" / "Fixed place", but the widget's second value *is* the Default Location, so its name should say so.
- Whether the "From your default location" caption shows when Default Location was chosen.
- The new no-Default-Location sentence.
- The gallery and intent descriptions, which say "within 25 miles of where you are".
- The Map Explorer landing line for a Default Location tap.

It should read as the same choice Alerts offers, in the widget's own words.

## Decisions touched
- **DECISIONS.md, ios-lifer-widgets (v1.0.36).** "Measured from the device's position ... (the saved Default Location when location is off)" and "a search from where the user is". Modified.
- **Widgets PRD.** FR-10 ("center not configurable in v1") and Out of Scope "a per-widget custom center" are reversed. FR-17, FR-18 and FR-36 (the reference point and the tap) are modified. FR-24 and NFR-03 (one request per 15 minutes per device) are restated as one per area. The Chronicler logs each.
- **DECISIONS.md, iOS Alerts (v1.0.42).** My location accepts only a `device` cell. This is preserved and must not regress.
- **The deep-link allowlist (`deepLink.ts`, security.md).** Its grammar grows by one bounded marker. Older and newer builds of the widget and the app must still degrade to the view link (no marker means today's landing).

## Scope
- **Changes, widgets** (`snowraven_widgets/Sources`): `Widget/Intents.swift`, `Providers.swift`, `Logic/RefreshEngine.swift`, `WidgetCopy.swift`, `DeepLink.swift`, and `WidgetState`/`WidgetPresentation`/`WidgetCache` as needed, with tests in `snowraven_widgetsTests`.
- **Changes, app:** `frontend/src/lib/links/deepLink.ts`, `linkFocus.ts` and `MapExplorer.tsx` (the landing), with their tests and the link parity fixture.
- **Changes, docs:** `docs/HELP.md` (Widgets, and the Default Location paragraph) and `widgetsPublishedClaims.test.ts`.
- **For The Engineer:** keep a second cache area, or accept a refetch when the two points alternate. Either way, state the request bound in HELP. If the cache keeps two areas, the held privacy patch covers "the area it searched".
- **Must not change:** the hand-over (schema v1), Alerts code and settings, `WidgetLocation.swift`'s permission posture, and the usage string.
- **Must not touch `project.yml`:** never point xcodegen at it. Edit existing Swift files rather than add new ones, because the committed pbxproj lists widget sources file by file.
- **Out of scope:** a hand-set place per widget, a configurable radius, and the Mac.

## Held published copy (needs the user's express yes; prepare as a held patch, do not write)
- **`PRIVACY_POLICY.md` + `website/privacy.html`, Your Location.** "The widget also reads your location each time iOS refreshes it" needs a clause saying a widget set to measure from the Default Location reads no location.
- **`appstore/LISTING.md`, App Review notes, the widgets bullet.** "Sends the device's coordinates (or, with location off, the saved Default Location)".
- **The What's New line at ship.** README and `website/index.html` have no widget sentence and stay untouched.

## What done looks like
- **Simulator:** the Edit Widget sheet offers Measure from, and a widget placed on the previous build still measures from the device after the update.
- **Swift tests:** Default Location never calls the locator, measures from the hand-over point, writes `default-location`, and shows the new sentence when none is saved. My location rows are byte-identical to today's.
- **The tap:** a Default Location widget's tap lands on Map Explorer searched from the Default Location with no location read. The parser fixture, vitest, HELP and the claims guard all agree.
- **At ship:** the version bump is the four-file set. 1.0.42 is in App Review, so whether this defers behind it or rolls it up is decided at the deploy gate. Any device check is the user's to perform.
