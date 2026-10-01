# PRD: iOS Alerts (new lifer nearby)
**Feature:** ios-alerts
**Date:** 2026-09-30
**Stage:** 2 (The Planner)
**Source:** strategic-brief.md (approved)

## Feature Overview

An opt-in, off-by-default **Alerts** section on the Settings tab of the iPhone and iPad app that, about hourly or about daily and outside quiet hours the user sets, checks eBird's recent reports near a place the user chooses and notifies them of species not in their eBird backup, with a device-local inbox of past alerts whose rows open the Map Explorer's Nearby Lifers view on the sighting. The feature makes only the app's existing eBird nearby-sightings request with the user's own key; nothing is sent anywhere else.

Requirements state WHAT the feature does. Where the check runs (native or webview), where the inbox lives, and which notification and scheduling APIs are used are The Architect's decisions; the brief's five questions for The Architect stand.

## User Stories

> **US-01**: As a birder with an eBird backup loaded on my iPhone, I want to turn on alerts in Settings and be told when eBird reports a species I have never recorded near a place I choose, so that I hear about a nearby lifer while the bird is still there, without opening the app.

> **US-02**: As a user who finds interruptions costly, I want to choose about hourly or about daily checks and to set quiet hours, so that alerts arrive at a pace I chose and never in the hours I set aside.

> **US-03**: As a user who birds from home and from where I happen to be, I want to choose between a fixed place and my most recent location as the point alerts measure from, so that the alerts fit how I bird.

> **US-04**: As a user who missed a notification, I want an inbox of past alerts showing the species, the place, the distance, when eBird reported it and when the app alerted me, newest first, so that I can look back at what was reported, and tap a row to see it on the map.

> **US-05**: As a user, I want the same species not to alert me again for a week, and a species I have since recorded to stop alerting as soon as I load a newer backup, so that alerts stay rare enough to mean something.

> **US-06**: As a privacy-conscious user, I want no permission prompt, no notification, no request and no location read caused by this feature until I turn it on, and everything to stop the moment I turn it off, so that the app's privacy posture holds.

> **US-07**: As a user whose setup is incomplete (no eBird key, no backup, no place, a denied permission, no connection), I want the Alerts screen to say plainly which one thing is in the way, so that I know what to fix rather than wondering why nothing arrives.

Seven stories; the feature does not need more than ten.

## Functional Requirements

### A. Platform and default state

> **FR-01**: The app shall show an **Alerts** section on the Settings tab on iPhone and iPad only. On the Mac and Windows desktop apps and on the self-hosted web/Pi version the section, its controls, its status and its inbox shall be absent (not present and disabled, not present and empty).

> **FR-02**: Alerts shall be off by default on every install and after every update. No onboarding step, banner, tab badge, widget entry point or other surface shall turn alerts on or request a permission on the feature's behalf; the only control that turns alerts on is the switch in Settings.

> **FR-03**: While alerts are off, the feature shall cause no system permission prompt, no notification, no scheduled or foreground check, no eBird request and no location read, on every platform.

> **FR-04**: The section shall be placed on the Settings tab with the tab's other sections and shall follow the Settings tab's existing section register (heading, description line, controls) so it reads as part of the tab.

### B. Settings controls

> **FR-05**: The section shall contain, in this order: the on/off switch; **Cadence** (Hourly, Daily); **Quiet hours** (off by default; a start time and an end time when on); **Measure from** (Fixed place, My location); the fixed place controls; **Radius**; a status line; and the **Inbox**.

> **FR-06**: The cadence control shall offer exactly two values, Hourly and Daily, defaulting to Hourly, and the section copy shall state that Hourly means about once an hour, that Daily means about once a day, and that iOS decides exactly when a background check runs. The words "every hour", "exactly" or any fixed clock time shall not appear.

> **FR-07**: The quiet hours control shall be off by default. When turned on it shall show a start time and an end time, each a time of day in the user's local time, with a default of 10:00 PM to 7:00 AM.

> **FR-08**: The location model shall default to **Fixed place**. Choosing **My location** shall be the only place-model choice that reads the device position (see FR-15).

> **FR-09**: The fixed place shall default to the saved Default Location's coordinates when one is saved. The fixed place controls shall be the app's existing coordinate entry, place-name search and **Use my location** controls, behaving as they do elsewhere in Settings. Editing the alert's fixed place shall not change the saved Default Location, and saving a Default Location later shall not overwrite an alert fixed place the user has set by hand.

> **FR-10**: When Fixed place is chosen and no fixed place is set (no Default Location saved and nothing entered), the check shall not run and the status line shall say a place is needed (FR-25).

> **FR-11**: The radius shall be a whole number of miles from 1 to 25, defaulting to 25. Values outside that range shall be refused at entry and the stored value shall never exceed 25.

> **FR-12**: Every setting in the section shall persist across relaunches on the device it was set on and shall not sync to any other device through iCloud Sync.

> **FR-13**: A change to any setting while alerts are on shall take effect from the next check without turning alerts off and on. A change to cadence shall replace the pending schedule with one measured from the last completed check at the new interval (Daily to Hourly with the last check three hours ago makes a check due now; Hourly to Daily with the last check ten minutes ago waits). A change to the place, model or radius shall not itself trigger a check. A change to quiet hours shall not cancel a notification already deferred; that notification shall be delivered at the end of the quiet window in force when it was deferred.

### C. Permissions

> **FR-14**: The system notification permission shall be requested only when the user turns the switch on, and only if it has not already been decided. If the user denies it, alerts shall remain on, checks shall still run and fill the inbox, no notification shall be attempted, and the section shall state that notifications are off for SnowRaven with the path to change it (Settings, Notifications, SnowRaven). The app shall never re-prompt on its own.

> **FR-15**: The system location permission shall be requested only when the user chooses My location or presses Use my location, and only if it has not already been decided, using the app's existing When In Use request and its existing purpose string. The feature shall never request Always authorization, background location updates or significant-location-change monitoring.

> **FR-16**: With My location chosen and location denied or unavailable, a check shall measure from the fixed place if one is set (and the status line shall say so, in the widgets' register: "From your fixed place"), otherwise it shall not run and the section shall state that location is off for SnowRaven with the path to change it (Settings, Privacy & Security, Location Services) or that a fixed place can be set instead.

> **FR-17**: Under My location, a check shall measure from the device's most recent known position under the When In Use grant: a fresh position when the app is open, otherwise the most recent position the app or a widget refresh has already recorded. A position older than the age limit (Open Question OQ-04, default 24 hours) shall count as unavailable and FR-16 applies. No check shall start a location read while the app is not running.

### D. Preconditions and status

> **FR-18**: A check shall require, in this order: alerts on; an eBird API key saved; an eBird backup loaded; a point to measure from (FR-10, FR-16, FR-17). When any is missing the check shall not run, shall send nothing, and the status line shall name the first missing one in the register the widgets use ("Add your eBird API key", "Load your eBird backup", "Set a place to measure from").

> **FR-19**: The status line shall otherwise show the last check's time and outcome: "Last checked 9:41 AM, nothing new", "Last checked 9:41 AM, 2 lifers", "Last checked 9:41 AM, offline", "Last checked 9:41 AM, eBird busy", or "Last checked 9:41 AM, eBird did not accept your key"; and "Not checked yet" before the first check. Times are the user's local time.

> **FR-20**: The section shall carry one sentence, in the widgets' register, stating that a check sends the chosen coordinates to eBird with the user's own key, the same nearby-sightings request Nearby Lifers makes, and nothing to the developer.

### E. The check

> **FR-21**: With alerts on and preconditions met, the app shall ask iOS to run a background check no sooner than the chosen interval after the last completed check, and shall run one check itself when the app is opened or brought to the foreground with alerts on and the interval elapsed since the last completed check. At most one check shall run at a time; a check that is already running shall not be started again by either trigger.

> **FR-22**: A check shall make exactly one eBird request: the app's existing recent nearby sightings request for the chosen point, the chosen radius, and the last one day, with the user's own eBird key. It shall make no other network request of any kind.

> **FR-23**: A check shall subtract the recorded-species set derived from the user's loaded eBird backup (the same derivation the widgets and the Nearby Lifers view use, with subspecies-level forms folded to their species) from the species-level names in eBird's answer, then drop every non-countable form (spuhs, slashes, hybrids, undescribed and domestic forms) through the app's shared countability rule. What remains are the check's candidates.

> **FR-24**: A candidate species that was alerted within the last seven days shall not be alerted again; its existing inbox row shall be updated with the newer sighting (place, distance, coordinates, when eBird reported it) and shall keep its alerted time and position. Seven days is a single named value. A candidate not alerted within the last seven days is a hit.

> **FR-25**: A check with no hits shall produce no notification and no inbox change beyond the status line.

> **FR-26**: A check that cannot reach eBird, receives an error, or receives a 429 shall produce no notification and no inbox change, shall record the outcome for the status line (FR-19), and shall not retry within the same check. After a 429 the app shall record the cooldown eBird asked for (its Retry-After, bounded as the app's pacing contract bounds it) and no check shall start a request before that cooldown has elapsed. A 429 or error result shall never be stored as an answer.

> **FR-27**: A check that finds a species-level report for a species that was already alerted and whose inbox row has since aged out or been cleared shall treat it as a new candidate (the seven-day rule is measured from the last alert time the app still holds).

> **FR-28**: Loading a newer eBird backup that contains a species previously alerted shall, with no other action by the user, remove that species from every later check's candidates, because the recorded set is derived from the file at each check. The species' existing inbox row shall stay as history.

### F. Notification content

> **FR-29**: Every hit from one check shall enter the inbox, and the check shall produce exactly one notification summarizing them, never one per species. Its title shall count the hits and name the place: "1 lifer reported near Davis", "3 lifers reported near Davis"; the place is the fixed place's name when it was chosen by place-name search, "near you" under My location, and "nearby" for a fixed place with no name. Its body shall name up to three species in nearest-first order, and add "and N more" when there are more than three.

> **FR-30**: Species names in the notification and in the inbox shall follow the app's bird-name display rules (in-app rows render through the shared bird-name component; the notification text uses the same display name), with no taxonomic code, no favicon and no link in the notification text.

> **FR-31**: A tap on the notification shall open SnowRaven on the Map Explorer's Nearby Lifers view, searching from the check's point with the check's radius for the session and the Day time range, centered on the sighting of the first-named species, with every lifer shown. The saved Default Location and saved Radius shall stay as they were (the widget tap-through precedent). If the app cannot show the sighting (it is no longer reported), the view shall show every lifer and say so.

> **FR-32**: A find during a foreground check (FR-21) shall enter the inbox and be delivered as a notification in the same way as a background find, subject to quiet hours and the notification permission.

### G. Quiet hours

> **FR-33**: When quiet hours are on, no alert notification shall be delivered between the start time and the end time. A check may still run inside quiet hours and its hits shall still enter the inbox (with their alerted time set when the check ran); its one notification shall be scheduled for delivery at the end of the quiet window, with the same content.

> **FR-34**: A quiet window whose end time is earlier than its start time shall span midnight (10:00 PM to 7:00 AM covers 10:00 PM through 6:59 AM the next day). A window whose start and end are equal shall apply no quiet period, and the section shall say beside the control that the start and end must differ.

> **FR-35**: Several checks inside one quiet window shall produce at most one deferred notification, summarizing all their hits together (the title's count and the body's names cover the combined set) and delivered once at the end of the window.

> **FR-36**: A deferred notification shall be delivered at the end of the window whether or not the app has run in the meantime, and shall not be delivered at all if alerts are turned off before then (FR-38).

### H. Inbox

> **FR-37**: The inbox shall list one row per alerted species per alert, newest alerted first, each showing the species name, the place, the distance in miles from the check's point, when eBird reported it, and when the app alerted; relative day words follow the widgets ("Today", "Yesterday", "3 days ago"). It shall show a plain empty state ("No alerts yet") when empty. A tap on a row shall open the Map Explorer's Nearby Lifers view searching from that alert's point and radius over the Day range, with that species shown alone and centered on its sighting beside the **Show all** pill (the widget row precedent); if the species is no longer reported there, the view shall show every lifer and say so.

> **FR-38**: The inbox shall be device-local, never synced through iCloud Sync, and bounded to 30 days and 200 rows: a row shall be removed 30 days after its alerted time, and when a new row would make more than 200, the oldest by alerted time shall be removed first. The bound shall hold on every write, not only on display.

> **FR-39**: The inbox shall carry a **Clear** control that removes every row after an explicit confirmation, leaves every setting as it was, and leaves alerts on if they were on. After Clear, a species alerted before the Clear may alert again at the next check (FR-27).

> **FR-40**: Clearing the eBird backup (from Settings or by a synced clear) shall clear the inbox through the app's existing derived-data teardown, as the rows exist only relative to that file. Replacing the backup with a newer one shall not clear the inbox (FR-28). Deleting the app removes everything.

> **FR-41**: Turning alerts off shall keep the inbox and every setting.

### I. Turning alerts off

> **FR-42**: Turning the switch off shall, immediately: cancel every scheduled background check, cancel every pending notification including one deferred by quiet hours, and end any check in progress without delivering a notification or writing to the inbox. No further request or location read shall occur until the switch is turned on again. It shall not change any permission.

> **FR-43**: Turning the switch on again shall not re-prompt for a permission already decided and shall schedule the first check as if from a fresh start (the first check is due at once, subject to preconditions).

### J. Help and published copy

> **FR-44**: `docs/HELP.md` shall gain an **Alerts** subsection under Settings, written in the build without a stop, that covers: what alerts, on which devices; the cadence words and that iOS chooses the time; quiet hours deferring rather than hiding; the two location models and that My location is the most recent known position under the same permission as Use my location, never Always; the seven-day rule; what the inbox shows and its 30-day / 200-row bound; Clear and the backup clear; the network sentence (FR-20); and one sentence stating that alerts exclude spuhs, slashes and hybrids while the widgets and the Nearby Lifers view list them. The Widgets subsection shall not change.

> **FR-45**: The build shall prepare, and shall NOT apply, the following HELD proposals in `pipeline/ios-alerts/held-copy/`, each as an exact before-and-after the user can read: (a) the privacy policy change to `PRIVACY_POLICY.md` (Your Location, Connections and iOS App sections) with the identical change to its `website/privacy.html` mirror; (b) the one-sentence update to `product-brief.md`'s network sentences ("What Success Looks Like" and the founding "Network calls" decision) adding the alert check beside the widget refresh; (c) the App Store What's New text; (d) any change to the listing's privacy answers and the compliance record in `appstore/LISTING.md`; (e) at most one proposed sentence for the README and at most one for `website/index.html`. Nothing in this list lands in the repository or in App Store Connect without the user's express yes at the deploy gate.

### K. Accessibility and appearance

> **FR-46**: Every control in the section and every inbox row shall have a screen-reader label that names it and, for the switch, cadence and location model, its current state; the status line shall be announced when it changes; the Clear confirmation shall be reachable and dismissible from VoiceOver.

> **FR-47**: The section and inbox shall lay out without horizontal scrolling or clipped text at 320px width and at the app's 200% text size, on iPhone and iPad, in both the light and dark themes.

## Non-Functional Requirements

> **NFR-01 (Network, durable form)**: This feature adds no third-party request, no new endpoint and no new host. It makes the app's existing eBird nearby-sightings request, with the user's own key, from a check on iPhone and iPad at most once per chosen cadence, and it moves that request into a context where the app's webview may not be running. Nothing is sent to the developer. This sentence, not a bare "no network call", is the form the brief, the help and the held privacy copy use.

> **NFR-02 (Bounded check)**: A check makes exactly one eBird request and finishes within the time iOS grants a background refresh; on a 429 it stops, honors the bounded Retry-After the app's pacing contract defines, and does not start another request before that cooldown has passed. No check retries within itself, and no two checks overlap. The Architect states how a check that does not run through the app's shared JavaScript gate honors the same contract.

> **NFR-03 (Privacy posture)**: Nothing about the feature runs, prompts, reads location or sends a request until the user turns it on, and everything stops when they turn it off (FR-03, FR-42). The published privacy sentence "the app itself uses your location only while you're using it" stays true: no Always authorization, no background location.

> **NFR-04 (Storage)**: Alert settings and the inbox are device-local documents under the app's own data, never synced. The inbox is a bounded durable store: every row is validated on load and at the write path, malformed rows are dropped rather than thrown on, the 200-row / 30-day cap holds on every write, and the store is registered with the app's derived-data teardown so the backup's clear removes it. Any document a second process (the background check, a widget) reads or writes follows the app's ordered-writer and single-webview rules; The Architect places it.

> **NFR-05 (Security)**: Any new file read outside the sealed bundle, and any new reader of the App Group hand-over, gets the same treatment the v1.0.36 review gave the hand-over: regular-file check, size bound, per-field validation, nothing trusted from disk. Species names from eBird are display data, never interpreted.

> **NFR-06 (Entry cost)**: On the platforms where the section is absent, the feature adds nothing to the app's initial load, and the app's existing entry-chunk guard stays green.

> **NFR-07 (Accessibility)**: WCAG 2.1 AA holds for the section and inbox at 320px and 200% text scale; every color comes from the app's theme tokens in both themes; every button and link is the app's shared primitive so it is in the tab order; any DOM identifier is keyed on an index, never on species or place text.

> **NFR-08 (Copy)**: All in-app, help and held copy uses American spelling, no em dashes, and the widgets' register for missing-precondition sentences. Cadence copy is truthful (FR-06).

> **NFR-09 (Compatibility)**: The section is available wherever the iPhone and iPad app runs unless The Architect finds an API floor above the app's own (OQ-05); if a floor is needed, on an older iOS the section is present and says the iOS version it needs rather than being absent.

> **NFR-10 (Verification posture)**: Acceptance is by automated tests plus simulator evidence (a background check triggered from the debugger, notification content, tap-through, quiet-hour scheduling logic). Real background timing, delivery on a locked phone and quiet-hour deferral on hardware are the user's own TestFlight device check under the device-boundary rule, not a QA sweep; those QA rows are marked "user device check".

## Out of Scope

From the brief, restated so no build re-litigates them:
- Any push server, relay or account; therefore no exact interval.
- Always location authorization, significant-location-change monitoring, background location updates, or any location read while the app is not running.
- Mac, Windows and web/Pi notifications or inbox; the section is absent there.
- Escapee exclusion in the alert rule.
- Media-target alerts, hotspot alerts, rarity or ABA-code filtering, per-species mute lists, multiple saved places, a cadence finer than hourly.
- Lock-screen, StandBy or Live Activity surfaces; a new tab; any change to the existing widgets.
- Syncing alert settings or the inbox through iCloud Sync.
- eBird's own rare-bird alert emails.

Added while writing this PRD:
- Marking an inbox row as "now on your list" after a newer backup records the species; the row simply stays as history (FR-28).
- A per-alert "snooze" or a change to the seven-day figure from the UI; it is one named constant.
- Applying `isNonCountableForm` to the widgets or the Nearby Lifers view; the help states the difference.
- Any change to the notification purpose string, the location purpose string beyond what App Review requires (a held item if it is required), or to the existing widgets' hand-over document beyond what the check needs to read.
- Editing or deleting a single inbox row; Clear is whole-inbox.

## Open Questions

> **OQ-01**: Should "My location" ever mean a live position while the phone is in a pocket? **Default:** No. My location is the most recent known position under When In Use (FR-17); Always authorization is a separate, deliberate decision the user makes later, not something this build slides into.

> **OQ-02**: Should the alert rule exclude non-countable forms when the widgets and the Nearby Lifers list do not? **Default:** Yes (FR-23). A list row can carry "gull sp."; a notification that interrupts the user's day cannot. The help states the difference.

> **OQ-03**: `product-brief.md`'s founding network sentences describe the widget refresh but not an alert check. **Default:** The build prepares a HELD one-sentence update to both sentences beside the privacy policy proposal (FR-45b); the user approves the wording at the deploy gate.

> **OQ-04**: How old may the "most recent known position" be under My location before it counts as unavailable? **Default:** 24 hours; older falls back per FR-16. The Architect may choose the source (the widget's stored search area, the app's saved position, or both) and may tighten the limit, but shall not loosen it past 24 hours.

> **OQ-05**: Does the check or the notification need an iOS floor above the app's own (iOS 16)? **Default:** No floor beyond the app's; if The Architect finds one, NFR-09 governs and the floor is stated in the help.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Section absent off iOS (FR-01) | On Mac, Windows and web/Pi builds, the Settings tab renders no Alerts heading, control, status or inbox; no alert copy string is present in the rendered tab. |
| QA-02 | Off by default (FR-02) | A fresh install and an upgraded install both show the switch off; no other surface (onboarding, tab badge, widget, banner) can turn it on. |
| QA-03 | Nothing while off (FR-03) | With the switch off across a simulated app open, foreground, and background-refresh trigger: zero notification permission requests, zero location requests, zero scheduled checks, zero eBird requests at the transport seam. |
| QA-04 | Control set and order (FR-05) | The section renders switch, Cadence, Quiet hours, Measure from, fixed place controls, Radius, status line, Inbox, in that order. |
| QA-05 | Cadence copy (FR-06) | Cadence offers exactly Hourly and Daily, default Hourly; the copy contains "about once an hour", "about once a day" and that iOS decides when; it contains none of "every hour", "exactly", or a clock time. |
| QA-06 | Quiet hours default (FR-07) | Quiet hours default off; turning on shows start 10:00 PM and end 7:00 AM. |
| QA-07 | Location model default (FR-08) | Measure from defaults to Fixed place; choosing Fixed place or pressing nothing performs no location read. |
| QA-08 | Fixed place defaults and independence (FR-09) | With a Default Location saved, the fixed place shows its coordinates; editing the fixed place leaves the Default Location unchanged; saving a new Default Location leaves a hand-set fixed place unchanged. |
| QA-09 | No fixed place (FR-10, FR-18) | Fixed place chosen with nothing saved or entered: no check runs, no request is made, status reads "Set a place to measure from". |
| QA-10 | Radius bounds (FR-11) | Default 25; 0, 26, a decimal and a non-number are refused; the stored value is a whole number 1 to 25. |
| QA-11 | Settings persist locally, never sync (FR-12) | Every setting survives a relaunch; no alert setting or inbox row appears in the iCloud-synced document set. |
| QA-12 | Cadence change reschedules (FR-13) | Daily to Hourly with the last check 3 h ago: a check is due now; Hourly to Daily with the last check 10 min ago: next check is 24 h after the last; a deferred notification is unaffected by a quiet-hours edit. |
| QA-13 | Notification permission timing (FR-14) | The notification prompt is requested only on switch-on and only once; after a denial, checks still fill the inbox, no notification is attempted, and the section shows the denied sentence with the Settings, Notifications, SnowRaven path. |
| QA-14 | Location permission timing (FR-15) | The location prompt is requested only on choosing My location or pressing Use my location; no Always request, background-update or significant-change registration exists in the app. |
| QA-15 | Location denied under My location (FR-16) | With a fixed place set: the check measures from it and the status says "From your fixed place". With none: no check runs, the section shows the location-off sentence with the Location Services path and the fixed-place alternative. |
| QA-16 | Most recent position and age limit (FR-17, OQ-04) | A recorded position 23 h old is used; one 25 h old counts as unavailable and QA-15 behavior follows; no location read starts from a background check. |
| QA-17 | Preconditions and register (FR-18) | No key: status "Add your eBird API key", no request. No backup: "Load your eBird backup", no request. Each checked in that order. |
| QA-18 | Status line outcomes (FR-19) | Before first check "Not checked yet"; after checks with 0 hits, 2 hits, offline, 429 and 401: the five stated sentences with the local time. |
| QA-19 | Network sentence present (FR-20) | The section renders the one-sentence network disclosure in the widgets' register. |
| QA-20 | Scheduling and catch-up (FR-21) | With alerts on and the interval elapsed, an app open or foreground triggers one check; with the interval not elapsed, none; two triggers during a running check start no second check. |
| QA-21 | Exactly one request per check (FR-22, NFR-02) | A check performs one recent-nearby-sightings request with the chosen point, radius and back=1 and the user's key, and zero other requests at the transport seam and at any native request seam. |
| QA-22 | Subtraction and countability (FR-23) | Fixture: recorded set {A, B(subspecies form)}; eBird returns A, B species-level, C, "gull sp.", "X x Y hybrid", D. Candidates are exactly {C, D}. |
| QA-23 | Seven-day dedupe and row update (FR-24) | C alerted at T; C found again at T+6d: no notification, C's row shows the newer place, distance and reported time and keeps its alerted time; found at T+8d: a new alert and a new row. |
| QA-24 | Empty result (FR-25) | eBird returns nothing new: no notification, inbox unchanged, status "nothing new". |
| QA-25 | Offline, error, 429 (FR-26) | Each of network failure, HTTP 500 and HTTP 429: no notification, no inbox write, status set, no retry within the check; after a 429 with Retry-After 30, a check triggered 10 s later makes no request and one at 31 s does; nothing stored as an answer. |
| QA-26 | Aged-out or cleared row re-alerts (FR-27) | C's row aged past 30 days (or Cleared): C found again produces a new alert. |
| QA-27 | Newer backup stops alerts (FR-28) | C alerted; a backup containing C is loaded; the next check with eBird still reporting C produces no notification and no new row; C's old row remains. |
| QA-28 | One summary notification (FR-29) | 1 hit: title "1 lifer reported near Davis", body names it. 3 hits: "3 lifers", three names nearest-first. 5 hits: three names then "and 2 more". Place is the search name, "near you", or "nearby" per the model and how the place was set. Exactly one notification per check. |
| QA-29 | Bird-name rules (FR-30) | Inbox rows render through the shared bird-name component; the notification text carries the display name with no code, favicon or link. |
| QA-30 | Notification tap-through (FR-31) | Tap opens Map Explorer, Nearby Lifers, searching from the check's point and radius, Day range, centered on the first-named species' sighting with all lifers shown; saved Default Location and Radius unchanged; a no-longer-reported sighting shows every lifer with the stated line. Simulator evidence. |
| QA-31 | Foreground find (FR-32) | A hit from a foreground check enters the inbox and produces the notification, deferred if inside quiet hours. |
| QA-32 | Quiet hours defer, do not hide (FR-33) | Check inside the window: hits are in the inbox at once; the notification is scheduled for the window's end with the same content; none is delivered inside the window. |
| QA-33 | Midnight span and equal times (FR-34) | 10:00 PM to 7:00 AM: 11:30 PM and 6:59 AM are quiet, 7:00 AM and 9:00 PM are not. Start equal to end: no quiet period applies and the "must differ" line shows. |
| QA-34 | Several checks in one window (FR-35) | Two checks inside one window with 2 and 3 hits: one deferred notification with count 5 and the combined names. |
| QA-35 | Deferred delivery survives app absence (FR-36) | A notification deferred at 11 PM is delivered at the window end without the app running. User device check. |
| QA-36 | Inbox rows and order (FR-37) | Rows show species, place, distance in miles, reported time (Today / Yesterday / N days ago) and alerted time, newest alerted first; empty state reads "No alerts yet". |
| QA-37 | Inbox row tap-through (FR-37) | Row tap opens Nearby Lifers from the alert's point and radius, Day range, that species alone and centered beside Show all; a no-longer-reported species shows every lifer with the stated line. Simulator evidence. |
| QA-38 | Inbox bound (FR-38) | Row 201 evicts the oldest by alerted time; a row 31 days old is removed on the next write and not shown; both hold at the write path, and a malformed persisted row is dropped on load without an error. |
| QA-39 | Clear (FR-39) | Clear asks for confirmation; on confirm the inbox is empty, every setting and the switch are unchanged. |
| QA-40 | Backup clear tears down the inbox (FR-40) | Clearing the eBird backup from Settings and via a synced clear each empties the inbox through the derived-data teardown; the teardown registry test pairs the store's purge to a row. Replacing the backup leaves the inbox. |
| QA-41 | Off keeps the inbox (FR-41) | Switch off: inbox rows and settings unchanged. |
| QA-42 | Off stops everything at once (FR-42) | Switch off with a check scheduled, a check running and a notification deferred in quiet hours: the schedule is cancelled, the running check ends with no notification and no inbox write, the deferred notification is cancelled and never delivered, no later request or location read occurs. |
| QA-43 | On again (FR-43) | Switch on after off: no permission re-prompt for a decided permission; the first check is due at once subject to preconditions. |
| QA-44 | Help written (FR-44) | `docs/HELP.md` has an Alerts subsection under Settings covering each listed point; the Widgets subsection is byte-identical to before. |
| QA-45 | Held copy prepared, not applied (FR-45) | `pipeline/ios-alerts/held-copy/` holds the privacy policy proposal (both files, identical wording), the product-brief sentence, What's New, listing privacy-answer and compliance-record proposals, and at most one README and one website sentence; `PRIVACY_POLICY.md`, `website/`, `README.md`, `product-brief.md` and `appstore/LISTING.md` are unchanged by the build's commits. |
| QA-46 | Screen-reader labels (FR-46) | Every control and inbox row exposes a label; switch, cadence and model expose state; the status line change is announced; the Clear confirmation is operable from the accessibility tree. |
| QA-47 | 320px and 200% (FR-47, NFR-07) | At 320px width and 200% text scale, in light and dark, the section and inbox have no horizontal scroll and no clipped text; every color resolves to a theme token. |
| QA-48 | Durable network form (NFR-01) | The brief, help, held privacy copy and the section's sentence all use the durable form (no new host or endpoint, no third-party request, eBird with the user's key); none says "no network call". |
| QA-49 | Storage rules (NFR-04) | The inbox store validates per row on load and at write, caps on write, is registered with the derived-data teardown, and any document a second process touches goes through an ordered writer; the existing storage and cache inventory guards stay green. |
| QA-50 | Security treatment (NFR-05) | Any new native file read and any new hand-over reader carry the regular-file and size-bound checks and per-field validation, verified by the security review. |
| QA-51 | Entry cost (NFR-06) | The entry-chunk guard stays green; no alert module is on the entry graph on non-iOS platforms. |
| QA-52 | Copy standards (NFR-08) | No em dash (U+2014) and no British spelling in the new in-app strings, the help subsection or the held copy. |
| QA-53 | Real cadence on hardware (FR-21, NFR-10) | On a TestFlight build with Hourly chosen, checks are observed to run at roughly hourly intervals over a day, and Daily at roughly daily. User device check. |
| QA-54 | Locked-phone delivery (FR-29, NFR-10) | A notification arrives on a locked phone from a background check and a tap opens the map view as QA-30 describes. User device check. |
| QA-55 | Quiet hours on hardware (FR-33, NFR-10) | With quiet hours on, nothing arrives inside the window and the deferred notification arrives at the window's end. User device check. |
