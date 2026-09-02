# PRD: iCloud Sync
**Feature:** icloud-sync
**Date:** 2026-09-01
**Stage:** 2, The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

An opt-in, off-by-default toggle in Settings on macOS and iOS that keeps the user's two data files (`data/ebird-backup.csv`, `data/ml-export.csv`) and their upload details the same across the user's own Mac, iPhone and iPad through the user's own iCloud account. Upload an export on one device and every other device uses it, with Settings on each device showing where the current file came from and when.

Terms used below. **Slot:** one of the two files, `ebird` or `ml`. **Local copy:** the file in this device's app data directory, which remains the only thing the app reads. **Shared record:** what iCloud holds for a slot: the file itself plus its details (original filename, upload time, origin device label, origin platform, origin device id) or a "cleared" marker (clear time, origin). **Check:** one pass that compares the shared record with the local copy for both slots and applies the rules in FR-14 to FR-21.

## User Stories

> **US-01** As a birder with a Mac, an iPhone and an iPad, I want to upload a fresh eBird or Macaulay export once on any one device, so that the other two use it without my moving the file and uploading again.

> **US-02** As that birder, I want each device's Settings to tell me where its current file came from and when it was uploaded, so that I can tell at a glance whether this device is current.

> **US-03** As a privacy-minded user, I want sync to be off until I turn it on, and to be told plainly what goes to iCloud, whose account it goes to, and how to turn it off, so that nothing leaves my device without my say.

> **US-04** As a user on a plane, or one who is not signed in to iCloud, I want the app to keep working from its local files and to say what state sync is in, so that a missing connection never hangs the app or empties my life list.

> **US-05** As a user who changes their mind, I want to turn sync off and keep my local files, and separately to remove the synced copies from iCloud, so that I stay in control of what lives in my account.

> **US-06** As a Windows, web or Pi user, I want Settings unchanged, so that I never see a control that does nothing on my platform.

## Functional Requirements

### A. Platform gating and iCloud availability

> **FR-01** The app shall show the iCloud Sync section, its toggle, its notes and its actions only on macOS and iOS (iPhone and iPad). On Windows, web and Pi builds none of this markup shall render and no sync behavior shall run.

> **FR-02** The app shall decide FR-01 through one platform gate predicate (the existing platform-gate seam), not through scattered checks.

> **FR-03** On macOS and iOS the app shall distinguish four availability states and behave as follows. **Available:** sync operates normally. **Not signed in to iCloud:** the toggle is shown but not operable, with a note that says the user must sign in to iCloud in the system settings for this device. **iCloud Drive off for SnowRaven:** the toggle is shown but not operable, with a note that says the user must allow SnowRaven under iCloud Drive in the system settings. **Build cannot use iCloud** (entitlement or provisioning missing, see NFR-06): the toggle is shown but not operable, with a note that this build cannot use iCloud.

> **FR-04** If sync is on and iCloud later becomes unavailable (signed out, iCloud Drive turned off), the toggle shall stay on, the state shall read "iCloud unavailable" with the reason, and the app shall keep working from the local copies. When iCloud returns, the next check shall run without user action.

> **FR-05** If sync is on and the device has no network, the app shall keep working from the local copies, shall show the last known sync state with the time of the last successful check, and shall never show a spinner or blank state in place of data because of the missing connection. A file uploaded while offline shall be applied locally at once and shall reach iCloud when the connection returns; until then its row shall read "Waiting to upload".

> **FR-06** Availability detection and every check shall run off the launch path. The app shall render its tabs from the local copies before any iCloud work completes, and shall never block first paint, tab load or file parsing on iCloud.

### B. Opt-in and the enable note

> **FR-07** Sync shall default to off on every install. With sync off, the app shall write nothing to iCloud and shall read nothing from iCloud except the availability probe needed to render FR-03.

> **FR-08** Turning the toggle on shall first show an enable note with an explicit "Turn on" action and a "Cancel" action. The note shall state, in plain language: (a) what goes to iCloud: the eBird backup, the Macaulay Library export, and their upload details (filename, upload time, device name); (b) whose account: the user's own iCloud account, on Apple's servers, never a SnowRaven server, and the developer cannot see it; (c) what happens now: if iCloud already holds a newer copy of a file it replaces this device's copy, and if this device's copy is newer it goes up to iCloud; (d) how to turn it off: switch the toggle off at any time, and use "Remove synced files from iCloud" to delete the copies in iCloud. Cancel shall leave sync off and write nothing.

> **FR-09** The enable note shall be the only confirmation on enable. A local file replaced during the first check (FR-16) shall not prompt again; the Settings row shall show what happened (FR-24, FR-25).

> **FR-10** The sync preference (on or off) shall persist per device through the storage seam and shall not itself sync.

### C. What syncs and what never syncs

> **FR-11** The app shall sync exactly two slots: `ebird` (the eBird backup) and `ml` (the Macaulay Library export), each with its upload details: original filename, upload time, origin device label, origin platform (Mac, iPhone or iPad), and origin device id.

> **FR-12** The app shall never write API keys (`api-keys.json`), app settings (`settings.json`, including map defaults and tab layout), the map style documents, the replay store, or any derived cache (county completeness, hotspot activity, checklist projects, escapee provenance, taxonomy) to iCloud.

> **FR-13** The origin device id shall be a random identifier generated on this device on first enable and stored device-locally. It shall not be derived from hardware identifiers, the Apple ID, or the user's name. The origin device label shall be the user-assigned device name when the platform provides it, otherwise the platform's generic name ("Mac", "iPhone" or "iPad").

### D. First-enable reconciliation

Per slot, on the first check after enable, compare the local copy with the shared record:

> **FR-14** Local copy only, no shared record: the app shall upload the local copy and its details to iCloud, with this device as origin. The row shall read "Up to date, from this device".

> **FR-15** Shared record only, no local copy: the app shall download the shared file and make it the local copy, replacing metadata, and shall invalidate caches per FR-31. The row shall name the origin device and upload time.

> **FR-16** Both present with different upload times: the newer upload time shall win, whole file. If the shared record is newer, it replaces the local copy in full and the row shall read "Replaced by the file from <device>, uploaded <time>". If the local copy is newer, it replaces the shared record in full. Nothing shall be merged or partially applied.

> **FR-17** Both present and identical (same upload time and the same origin device id, or same upload time where the local copy predates sync and carries no origin): the app shall transfer nothing and the row shall read "Up to date".

> **FR-18** Neither present: the app shall do nothing for that slot and the row shall keep today's "No file saved" state.

### E. Steady state

> **FR-19** An upload on any device with sync on shall replace the shared record for that slot with the new file and its details, with the uploading device as origin.

> **FR-20** A check shall run on app launch, each time the app comes to the foreground or its window regains focus, and when iCloud reports a change while the app is running. At most one check shall be in flight at a time; a trigger during a check shall queue one follow-up check, never a pile.

> **FR-21** On each check the newer upload time shall win per slot, whole file, exactly as in FR-16. When the upload times are equal and the origins differ, the local copy shall be kept. Upload times shall be compared at millisecond precision in UTC.

> **FR-22** Two devices that upload different files to the same slot within the same minute shall converge: after each has completed one check with iCloud reachable, both hold the file with the later upload time and show the same origin and time.

### F. Provenance and sync state in Settings

> **FR-23** The Default Files rows shall keep their current filename and "Saved <date>" display on every platform. On macOS and iOS with sync on, each row shall additionally show provenance: "From this device" or "From <device label> (<platform>)", plus the upload time in the same date format the row already uses.

> **FR-24** Each row shall show exactly one sync state from this set, as text, never by color alone: **Up to date**; **Syncing, uploading**; **Syncing, downloading**; **In iCloud, not downloaded here**; **Waiting to upload**; **iCloud unavailable**; **Sync off**; **Could not sync** (with a one-line reason and a "Retry" action).

> **FR-25** After a check that replaced the local copy, the row shall say so ("Replaced by the file from <device>, uploaded <time>") until the next user action on that row or the next replacement, so the user can see what changed.

> **FR-26** The iCloud Sync section shall show the time of the last successful check and, when sync is on and iCloud is available, a "Check now" action that runs one check.

### G. Files in iCloud but not on this device

> **FR-27** When the shared record for a slot is newer than the local copy but the file's contents are not yet on this device (not downloaded, or evicted), the app shall keep using the local copy, the row shall read "In iCloud, not downloaded here" with the origin and upload time, and a "Download now" action shall fetch it. If there is no local copy, the tabs shall show their existing "not configured" guidance, not an empty list presented as data.

> **FR-28** The app shall never present a stale local copy as current without saying so: whenever the shared record is newer than the local copy, the row shall show that a newer file exists in iCloud.

> **FR-29** A shared file that cannot be read in full (download failed, unreadable, truncated, or larger than the size bound in Open Questions) shall not be applied. The local copy and its metadata shall stay untouched and the row shall read "Could not sync" with the reason.

### H. Clear, turn off, and remove from iCloud

> **FR-30** With sync on, the Clear action on a Default Files row shall remove the file from this device and from iCloud, and shall write a "cleared" marker (clear time, origin) to the shared record so that every device with sync on removes its local copy on its next check. The confirmation shall say the file will be removed from this device and from iCloud on all synced devices. With sync off, Clear shall remain local only, as today.

> **FR-31** A device whose local copy has an upload time later than a "cleared" marker shall keep its local copy and upload it, replacing the marker (latest event wins). A device whose local copy is older shall remove it.

> **FR-32** Turning the toggle off shall need no confirmation, shall leave the local copies and their metadata intact, shall stop all checks and uploads, and shall leave the shared records in iCloud untouched. Rows shall read "Sync off".

> **FR-33** The iCloud Sync section shall offer "Remove synced files from iCloud" whenever iCloud is available and a shared record exists for at least one slot, whether the toggle is on or off. The action shall require a confirmation that names the files to be removed, shall delete the shared records and files from iCloud, and shall not touch any device's local copy. Other devices with sync on shall then show "Up to date, from this device" for their local copies, since nothing shared remains. This removal shall write no "cleared" marker.

### I. Cache invalidation and live update

> **FR-34** A synced arrival or removal that changes the local copy shall run the same invalidations a manual upload or clear runs today (the parsed observations cache and hotspot set for `ebird`, the parsed ML export cache for `ml`, and the network cache on clear), through the storage seam.

> **FR-35** Tabs that hold a parsed file (Breeding Codes, Species Detail, Statistics, Multimedia, Map Explorer, Named Birds, List Comparer) shall reflect the new or removed file without a relaunch: the tab re-enters its loading phase and returns to ready with the new data, or to its "not configured" guidance after a clear.

> **FR-36** A local upload in Settings shall be applied and visible in the tabs before its iCloud upload completes; the iCloud upload shall never delay the local result.

### J. Integrity and concurrency

> **FR-37** The app shall validate every shared record it reads: shape, allowed slot names (`ebird`, `ml`), allowed platform values, a parseable upload or clear time within a plausible range (not before 2000-01-01, not more than one day in the future), a device label of at most 64 characters, a filename of at most 255 characters containing no path separators, and a device id of a fixed form. A record that fails validation shall be treated as absent for that slot, shall be logged, and shall never throw, crash launch, or delete a local copy.

> **FR-38** Filename and device label from a shared record shall be used for display only and shall never form part of a file path.

> **FR-39** Every sync-originated write to the local `metadata.json` shall run as a link on the existing per-document write chain, serialized with user uploads and clears, so that no write is lost. A user upload that lands during a download shall win, because it carries the later upload time, and shall be pushed on the next check.

> **FR-40** A check shall be idempotent: running it twice with no change in between shall transfer nothing and change no state.

## Non-Functional Requirements

> **NFR-01 Accessibility:** The toggle shall be a real switch with an accessible name; state text shall be exposed through a live status region; every action shall be a real button reachable and operable by keyboard with a visible focus ring; the enable and remove confirmations shall trap focus and close on Escape. All of it shall meet WCAG 2.1 AA.

> **NFR-02 Layout and theming:** The new controls shall hold together at 320px width and at 200% in-app text scale, with responsive layout in classes, not inline styles, and every color through `var(--sr-*)` tokens in both themes.

> **NFR-03 Copy:** User-facing copy, docs and policy text shall contain no em dash (U+2014) and shall use the iOS "Import" wording where the row already does.

> **NFR-04 Performance:** A check with iCloud reachable and nothing to transfer shall finish within 2 seconds; a check with iCloud unreachable shall give up within 10 seconds and leave the app fully usable throughout. First paint and tab load times shall be unchanged from 1.0.10 with sync on and iCloud unreachable.

> **NFR-05 Security and privacy:** No SnowRaven server, relay or third-party service shall be involved. The shared records shall live only in a container tied to the user's Apple ID. The random device id shall reveal nothing about the hardware or the account. Shared-record strings shall be bounded and validated per FR-37 before any use.

> **NFR-06 Packaging and fail-safe:** The macOS (Developer ID) and iOS builds shall each carry the iCloud entitlements and an embedded provisioning profile that authorizes them, on one shared container. A build that lacks them shall not crash and shall not silently no-op: it shall show the FR-03 "build cannot use iCloud" state. The macOS release preflight shall verify the signed bundle's entitlements and embedded profile and fail the release if they are missing.

> **NFR-07 Release recipe:** The `snowraven-release` skill, `release.sh`, the Windows CI job (unchanged behavior, verified) and the iOS build recipe shall be updated in the same change, including regeneration of the iOS provisioning profile.

> **NFR-08 Documentation and published statements:** `PRIVACY_POLICY.md` and `website/privacy.html` (parity test must pass) shall describe sync on its own terms, separate from the existing iOS backup sentence: what is stored in iCloud, that it is the user's own account, that the developer never sees it, and how to remove it. `docs/HELP.md`, `README.md` and `website/` shall describe the feature. `appstore/LISTING.md` shall record why "Data Not Collected" still holds.

> **NFR-09 Tests and guards:** The change shall add tests for: the platform gate (no iCloud markup on Windows or web), the reconciliation table (FR-14 to FR-18, FR-21, FR-31), shared-record validation (FR-37), the write-chain interleaving (FR-39, shaped like `storageWriteSerialization.test.ts`), and the entry-chunk guard (no native sync code on the entry chunk).

> **NFR-10 Versioning:** `frontend/package.json` and `src-tauri/tauri.conf.json` shall be bumped to the same patch version with a `CHANGELOG.md` entry.

## Out of Scope

- Windows, web/Pi and Android: no toggle, no copy, no behavior change.
- Syncing API keys, `settings.json`, map style, replay store, or any derived cache.
- Merging two exports, three-way conflict resolution, or any rule beyond latest upload wins.
- Sharing between different people or Apple IDs, including Family Sharing.
- Any SnowRaven server, relay, CloudKit public database, or non-Apple cloud.
- Fetching exports from eBird or the Macaulay Library automatically.
- Showing the SnowRaven container as a folder in Finder or the Files app (see Open Questions).
- Migrating existing local files into iCloud without the user turning sync on.
- Notifications outside the Settings tab when a synced file is applied.
- Changing the existing web/Pi upload size validation.

## Open Questions

1. **Row counts in the shared details.** The brief lists row counts; today's metadata holds only filename and upload time, and the tabs derive counts from the parsed file. Default: not added in v1; the shared details are filename, upload time, origin label, platform and device id.
2. **Confirmation when the first check replaces a local file.** Default: no second prompt; the enable note (FR-08 c) covers it and the row reports it (FR-25).
3. **Exact tie in upload time with different origins.** Default: keep the local copy (FR-21). At millisecond precision this is practically unreachable; the Architect may add an origin-id tiebreaker if it costs nothing.
4. **Device clock skew.** Upload times come from each device's own clock. Default: accept; devices on one Apple ID keep network time.
5. **Size bound for a shared file (FR-29).** Default: 200 MB, a corruption guard rather than a product limit, so desktop users above the 50 MB web limit are not regressed.
6. **Placement of the iCloud Sync section.** Default: directly below Default Files on macOS and iOS; no existing section moves.
7. **Container visible in Finder and the Files app.** Default: not visible in v1; in-app "Remove synced files from iCloud" is the user's control. Revisit if users ask to see the files.
8. **Fallback when iCloud change notifications are not delivered while the app runs.** Default: launch, foreground and focus triggers are required; a foreground poll no more often than every 5 minutes is acceptable as a fallback, Architect's call.
9. **Copy of the enable note and state labels.** The strings above are required content with example wording; the Engineer may tighten wording without dropping any required element.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01, FR-02, US-06 | Windows build, web build and Pi build render no iCloud section, toggle, or copy; a gate test asserts no iCloud markup when the platform gate is false. |
| QA-02 | FR-03 | On a Mac signed out of iCloud the toggle is visible, not operable, and the note names signing in; with iCloud Drive off for SnowRaven the note names allowing SnowRaven; each note's text matches its state. |
| QA-03 | FR-03, NFR-06 | A build signed without the iCloud entitlement launches, shows "build cannot use iCloud", and neither crashes nor writes to iCloud. |
| QA-04 | FR-04 | With sync on, sign out of iCloud: toggle stays on, row reads "iCloud unavailable", tabs load from local files; sign back in: next check runs without a tap. |
| QA-05 | FR-05 | With sync on and network off, launch: tabs load with data, no spinner past normal load, row shows last check time; upload a file offline: tabs use it at once, row reads "Waiting to upload"; restore network: iCloud receives it. |
| QA-06 | FR-06, NFR-04 | With iCloud unreachable, first paint and the Breeding Codes ready time are within measurement noise of 1.0.10; a check gives up within 10 s. |
| QA-07 | FR-07 | Fresh install: toggle off; after 5 minutes of use the iCloud container holds no SnowRaven files. |
| QA-08 | FR-08 | Tapping the toggle on shows the enable note containing all four elements (what, whose account, what happens now, how to turn off); Cancel leaves the toggle off and nothing in iCloud. |
| QA-09 | FR-09, FR-25 | Enable on a device whose file is older than iCloud's: no second prompt; row reads "Replaced by the file from <device>, uploaded <time>". |
| QA-10 | FR-10 | Turn sync on on the Mac; the iPhone's toggle stays off; relaunch the Mac: toggle still on. |
| QA-11 | FR-11, FR-12 | After sync on both devices, the container holds exactly the two data files and their details; no keys, settings, map style, replay or cache documents appear; a test asserts the excluded paths are never written. |
| QA-12 | FR-13 | Device id is random per install and stable across relaunch; label is the user-assigned name where the platform gives one, else "Mac", "iPhone" or "iPad". |
| QA-13 | FR-14 | Local only: file appears in iCloud; row reads "Up to date, from this device". |
| QA-14 | FR-15 | iCloud only: local copy created, metadata replaced, caches invalidated, row names origin device and time. |
| QA-15 | FR-16 | Both present, iCloud newer: local replaced whole; both present, local newer: iCloud replaced whole; a byte comparison shows no partial or merged content. |
| QA-16 | FR-17 | Both identical: no transfer (network log shows no file transfer); row reads "Up to date". |
| QA-17 | FR-18 | Neither present: row keeps "No file saved"; nothing written to iCloud for that slot. |
| QA-18 | FR-19, US-01 | Upload on the Mac; open the iPhone: it uses the new file with no upload step; Settings shows "From <Mac name> (Mac)" and the upload time. Reverse from the iPad to the Mac passes the same way. |
| QA-19 | FR-20 | Checks fire on launch, on foreground, and on an iCloud change while running; ten rapid triggers produce at most two checks (one in flight, one queued). |
| QA-20 | FR-21 | Reconciliation unit test covers newer local, newer shared, equal time same origin, equal time different origin (local kept), and asserts millisecond UTC comparison. |
| QA-21 | FR-22 | Two devices upload different files within one minute; after one check each, both show the later file with the same origin and time. |
| QA-22 | FR-23, US-02 | Row shows filename, "Saved <date>", and "From this device" or "From <label> (<platform>)" with the upload time in the existing date format. |
| QA-23 | FR-24 | Each of the eight states renders as text with its exact label; no state is conveyed by color alone. |
| QA-24 | FR-26 | Section shows last successful check time; "Check now" runs one check and updates the time. |
| QA-25 | FR-27 | Evict the file on device B: row reads "In iCloud, not downloaded here" with origin and time, tabs still use the local copy, "Download now" fetches and applies it. With no local copy, tabs show "not configured" guidance. |
| QA-26 | FR-28 | Newer shared file not yet downloaded: row states a newer file exists in iCloud; the old local file is never labeled "Up to date". |
| QA-27 | FR-29 | A truncated or oversized shared file is not applied; local copy and metadata unchanged; row reads "Could not sync" with reason and "Retry". |
| QA-28 | FR-30 | Sync on, Clear eBird on the Mac: confirmation names this device and iCloud; file gone locally and in iCloud; the iPhone removes its copy on next check and shows "No file saved". Sync off: Clear is local only and the confirmation does not mention iCloud. |
| QA-29 | FR-31 | Device B uploads after device A's clear but before seeing it: B keeps its file and iCloud holds B's file; A adopts it. |
| QA-30 | FR-32 | Toggle off: no prompt; local files and tabs unchanged; rows read "Sync off"; iCloud still holds the files; no further iCloud traffic. |
| QA-31 | FR-33, US-05 | "Remove synced files from iCloud" appears when a shared record exists (toggle on or off); confirmation names the files; after confirm the container is empty, this device's local copies remain, and another synced device keeps its copies and reads "Up to date, from this device". |
| QA-32 | FR-34, FR-35 | Synced arrival on the Mac while Breeding Codes, Species Detail and Statistics are open: each reflects the new file without relaunch; a synced clear returns them to "not configured". |
| QA-33 | FR-36 | Upload locally with slow iCloud: tabs show the new file before the iCloud upload finishes. |
| QA-34 | FR-37 | Unit tests feed malformed, oversized, out-of-range and path-bearing records; each is treated as absent, none throws, no local file is deleted, and launch completes. |
| QA-35 | FR-38 | A shared filename of `../x.csv` is displayed verbatim and the local file still lands at the fixed path. |
| QA-36 | FR-39 | Interleaving test: a sync write and a user upload to `metadata.json` in the same tick both persist; neither is lost. |
| QA-37 | FR-40 | Two consecutive checks with no change: second transfers nothing and changes no row. |
| QA-38 | NFR-01 | Keyboard-only pass: toggle, "Check now", "Download now", "Retry", "Remove synced files" and both confirmations are reachable and operable; screen reader announces each state change; axe reports no AA violations. |
| QA-39 | NFR-02 | At 320px and 200% text scale no control overflows or overlaps; both themes render with no hardcoded colors (grep for hex/rgb in the new components is empty). |
| QA-40 | NFR-03 | Grep for U+2014 across the diff's copy, docs and policy files returns nothing. |
| QA-41 | NFR-05 | Network capture during a full sync cycle shows traffic only to Apple iCloud endpoints. |
| QA-42 | NFR-06, NFR-07 | `codesign -d --ent` on the released macOS bundle lists the iCloud entitlements; the embedded profile is present; the iOS build uploads to TestFlight with the regenerated profile; release preflight fails on a bundle without them. |
| QA-43 | NFR-08 | Privacy parity test passes; both policy pages contain a sync paragraph distinct from the backup sentence; HELP, README, website and LISTING updated in the same commit. |
| QA-44 | NFR-09 | The listed test files exist and pass; `entryChunk.test.ts` passes. |
| QA-45 | NFR-10 | Both version files carry the same new patch version and CHANGELOG has the entry. |
