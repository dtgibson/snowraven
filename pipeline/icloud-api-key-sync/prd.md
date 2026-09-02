# PRD: iCloud API Key Sync
**Feature:** icloud-api-key-sync
**Date:** 2026-09-01
**Stage:** 2, The Planner
**Source:** strategic-brief.md (approved)

## Amendments to the iCloud Sync PRD

This feature extends the iCloud Sync feature shipped in 1.0.11 (`pipeline/icloud-sync/prd.md`). Three places in that PRD are amended here so the two documents do not contradict each other. Where they differ, this document governs.

- **FR-12 (what never syncs).** `api-keys.json` leaves the never-write list. It is written to iCloud only while the key switch defined here is on, as the single shared key record of FR-17 below, and is removed from iCloud when the key switch goes off (FR-32). App settings (`settings.json`, including map defaults and tab layout), the map style documents, the replay store and every derived cache (county completeness, hotspot activity, checklist projects, escapee provenance, taxonomy) stay on the never-write list, unchanged.
- **QA-11 (container contents).** With the key switch off on every device, the container holds exactly what 1.0.11 holds: the two data files and their records. With the key switch on on at least one device, it holds exactly one additional key record and nothing else. The test that asserts the excluded paths are never written keeps every path except `api-keys.json`, which moves to the test in QA-09 below (written only while the key switch is on, removed when it goes off).
- **Out of Scope, "Syncing API keys".** Superseded by this feature. The rest of that list stands.

Everything else in the 1.0.11 PRD stands as shipped: the file switch, the eight file states, the file reconciliation rules, "Remove synced files from iCloud", the platform gate, the availability states, and the packaging and release requirements.

## Feature Overview

A second, off-by-default switch inside the iCloud Sync section of Settings on macOS and iOS that shares the user's eBird and OpenWeather API keys across the user's own Mac, iPhone and iPad through the user's own iCloud account, so a key entered once on any device is used by every other device that has also turned the key switch on. It is available only while file sync is on, rides the container, record discipline, check cycle, states and Settings surface that file sync already has, and adds exactly one small record to the container.

Terms used below. **Key slot:** one of the two keys, `ebird` or `openweather`. **Local key:** the key in this device's own key store, which remains the only thing the app's networked features read. **Key entry:** what is held for one key slot, locally or in iCloud: either a key (its value, its change time and its origin) or a cleared marker (its clear time and its origin). **Origin:** the device label, the platform (Mac, iPhone or iPad) and the random device id that file sync already mints on first enable. **Shared key record:** the one record in iCloud that holds a key entry, or nothing, for each key slot. **Untimed key:** a local key saved before this version, which carries no change time and no origin. **Key check:** one pass that compares the shared key record with the local keys for both key slots and applies the rules in section B; it runs as part of the existing check. **File switch / key switch:** the existing iCloud Sync switch and the new one.

## User Stories

> **US-01** As a birder with a Mac, an iPhone and an iPad, I want to enter my eBird and OpenWeather keys once on any one device, so that a new or reset device gets them without my finding them again on the provider sites.

> **US-02** As that birder, I want each device's key rows to say where its current key came from and when, and to say when a key was replaced or cleared from another device, so that I can tell at a glance why a device is or is not working.

> **US-03** As a privacy-minded user, I want key sharing to be a separate switch that stays off until I turn it on, and to be told plainly what leaves the device, whose account it goes to, how Apple protects it, and how to take it back, so that a secret never leaves my device without my own explicit act.

> **US-04** As a user who presses Update on one device, I want every other device sharing keys to use the new key at its next check, and a Clear on any device to remove the key everywhere, so that my control over a secret is complete from any device.

> **US-05** As a user who changes their mind, I want turning the key switch off to keep this device's keys working and to remove the copy from iCloud, and a separate control to remove the copy at any time, so that I am sure what lives in my account.

> **US-06** As a user on a plane, or one who is signed out of iCloud, I want each device to keep working with the keys it has and to say what state key sharing is in, so that nothing hangs or empties.

> **US-07** As a Windows, web or Pi user, I want Settings unchanged, so that I never see a control that does nothing on my platform.

## Functional Requirements

### A. The key switch and its gating

> **FR-01** The app shall show a key switch inside the iCloud Sync section, directly below the file switch, with its own label and its own note, only where the iCloud Sync section renders (macOS and iOS, decided by the existing platform gate). The key switch shall never be folded into the file switch.

> **FR-02** The key switch shall default to off on every install and shall be operable only when the file switch is on and iCloud availability is Available. Otherwise it shall be visible, off, not operable, with a one-line reason associated with the switch. When availability is Not signed in, iCloud Drive off, or Build cannot use iCloud, the reason shall be the same reason the file switch shows for that state. When iCloud is Available and the file switch is off, the reason shall say that iCloud Sync must be turned on first.

> **FR-03** With the key switch off, the app shall write nothing about keys to iCloud and shall read no key value from iCloud. It may learn only whether a key record exists (FR-36) and shall keep the last-known answer per device.

> **FR-04** Turning the key switch on shall first show an enable note with an explicit "Turn on" action and a "Cancel" action. The note shall state, in plain language: (a) what goes to iCloud: the eBird and OpenWeather keys as entered, and for each when it was last changed and which device changed it (the device's name and kind); (b) whose account: the user's own iCloud account, on Apple's servers, in the same private SnowRaven container as the files, with no SnowRaven server in the path and nothing the developer can see; (c) how Apple protects it: encrypted in transit and at rest by Apple, and end-to-end encrypted only if the user has Advanced Data Protection turned on for their account; (d) which devices: every Mac, iPhone and iPad signed in to this iCloud account that also turns key sync on; (e) what happens next: a device with no key takes the shared one, the most recently changed key wins, and a Clear reaches every sharing device; (f) how to stop: turning the switch off removes the copy from iCloud, and "Remove synced keys from iCloud" is available at any time. Cancel shall leave the switch off and write nothing. Nothing about keys shall be written to iCloud before Turn on. The note shall never show a key value.

> **FR-05** The enable note shall be the only confirmation on enable. A local key replaced during the first key check shall not prompt again; the key row shall report it (FR-41).

> **FR-06** The key switch preference shall persist per device through the storage seam, as part of the same per-device iCloud Sync preference the file switch uses, and shall not itself sync. A persisted preference that says the key switch is on while the file switch is off shall be treated as off.

> **FR-07** Turning the file switch off shall turn the key switch off in the same action, with every effect of FR-32 and FR-33. Turning the file switch back on shall leave the key switch off until the user turns it on again through FR-04.

> **FR-08** Rapid toggling. After any sequence of changes to either switch, the app shall settle on the state of the last change: at most one check shall be in flight with at most one queued; an upload that began under "on" and completes after "off" shall be followed by the removal of FR-32, so that once the switches have settled off, iCloud holds no key record written by this device; and one gesture shall never show the enable note or a confirmation twice.

### B. What syncs and precedence

> **FR-09** With the key switch on, the app shall sync exactly two key slots, `ebird` and `openweather`, under the one switch, each as its own key entry with its own change time and origin.

> **FR-10** Per key slot, the latest change shall win, whole: the key entry with the later change time replaces the other side's entry in full, whether either entry is a key or a cleared marker. A set and a clear are both changes. Change times shall be compared at millisecond precision in UTC. Nothing shall be merged or partially applied.

> **FR-11** When two key entries carry the same change time and different origins, the app shall apply the same deterministic tiebreaker file sync uses (origin ids ordered by UTF-16 code units, the greater id wins), so every device converges on the same entry.

> **FR-12** From this version, every key save through the storage seam on macOS and iOS shall record a change time and this device's origin for that key slot in the device-local key store, whether or not either switch is on. A Clear with the key switch on shall record a cleared marker (clear time, this device's origin) in the local key store (FR-28). A Clear with the key switch off shall remove the key and its entry entirely and record nothing (FR-31). A stored change time shall never be defaulted on read: a key with no recorded change time shall read as untimed.

> **FR-13** An untimed local key shall count as older than any shared key entry, key or cleared marker. When the shared key record holds no entry for a slot and this device holds an untimed key, the key check shall upload it as the seed, with the time of that upload as its change time and this device as origin, and shall stamp the local key with the same time and origin in the same save, so the local and shared entries agree.

> **FR-14** On every key check the app shall apply this table per key slot, and nothing else:
> - Local key, no shared entry: upload the local key (per FR-13 when untimed); row reads "Up to date", "From this device".
> - Shared key, no local key: apply the shared key locally (FR-23); row names the origin and time.
> - Shared cleared marker, no local key: transfer nothing; row keeps today's empty state.
> - Both keys, different values: the newer wins per FR-10 and FR-11. If the shared key wins it replaces the local key and the row reads as in FR-41; if the local key wins it replaces the shared entry.
> - Both keys, same value: transfer nothing; when the local key is untimed or older, its entry adopts the shared entry's change time and origin (OQ-3); row reads "Up to date".
> - Shared cleared marker newer than the local key (or the local key untimed): remove the local key (FR-24); the marker stays.
> - Local key newer than the shared cleared marker: upload the local key, replacing the marker.
> - Local cleared marker against a shared key: the newer wins. If the marker is newer, the shared entry becomes the marker; otherwise the shared key is applied locally.
> - Neither present: nothing.

> **FR-15** Two devices that change the same key slot within the same minute (a set on one and a Clear on the other, or two different sets) shall converge: after each has completed one key check with iCloud reachable, both hold the outcome of the later event (the same key with the same origin and time, or no key on either), and both rows show the same origin and time.

> **FR-16** A device with the key switch off shall receive nothing: a key set, changed or cleared elsewhere shall not change its local keys, and its key rows shall show no other device's provenance.

### C. The key record

> **FR-17** The app shall keep exactly one shared key record in the same container as the files, holding for each key slot a key entry, a cleared marker, or nothing. Its name shall be a fixed constant, never derived from any content. No other key-related item shall be written to the container.

> **FR-18** A key entry shall hold the key value, the change time and the origin (device label, platform, device id). A cleared marker shall hold the clear time and the origin. Times shall be ISO 8601 instants in UTC with millisecond precision. The record shall carry a version.

> **FR-19** The app shall validate the shared key record on every read and shall sanitize its own record to the same bounds before every write, in both TypeScript and Rust. Bounds: record text of at most 4,096 UTF-16 code units; the known version value; slot names from the fixed set; a key value of 1 to 128 characters, every character printable ASCII from 0x21 through 0x7E (no whitespace, no control characters, no non-ASCII); a plausible time, not before 2000-01-01 and not more than one day in the future, of at most 64 characters; a device label of 1 to 64 UTF-16 code units with no control characters; a platform from the fixed set; a device id of the fixed form file sync uses. The bounds are set from real key shapes (eBird keys are short alphanumeric tokens, OpenWeather keys are 32 hex characters) with generous headroom so a legitimate key is never rejected; anything outside them is malformed.

> **FR-20** A key entry that fails any bound shall be treated as absent for that slot; a record whose envelope fails shall be treated as absent for both slots. Neither shall throw, crash launch, delete a local key, or be logged with any value. An entry treated as absent shall be overwritten at the same key check by this device's entry when this device holds a key entry for that slot, so a malformed record heals.

> **FR-21** A key value shall be used only as the key. It shall never appear in the record's name, in any state string, reason, error message, log line, test name, enable note, confirmation or other copy, on either side (TypeScript and Rust), and the sync path shall never place it in a path or URL. Device labels from a shared record are display only and shall never form part of a path.

> **FR-22** A shared key record that is not a regular file, or that exceeds the size bound on disk, shall be refused before it is read and treated as absent, as file records are.

### D. Receiving and applying a key

> **FR-23** A received key that passes validation shall land in the same device-local key store the user's own entry lands in, through the storage seam and its per-document write chain, with the shared entry's change time and origin, in one serialized write. Every networked feature shall use it on its next request without a relaunch, and the API Keys rows shall show it without leaving the tab.

> **FR-24** A received cleared marker that wins shall remove the local key through the same seam and chain. Every networked feature shall then behave exactly as it does today when that key is missing (the existing missing-key guidance), without a relaunch, and the row shall say the key was cleared from another device (FR-42).

> **FR-25** A received key whose value is identical to the local key shall transfer nothing, shall not mark the row as replaced, and shall read "Up to date".

> **FR-26** A user's Update or Clear on a key row that lands while a key check is applying a received entry shall win, because it carries the later change time, and shall be pushed at the next key check. No write shall be lost.

> **FR-27** A received key shall be masked by default in its row exactly as a typed key is; Show reveals it and Hide re-masks it, unchanged from today. A key typed or updated with the key switch on shall be saved locally and usable at once, before any iCloud write; the upload shall never delay the local result. While the upload has not reached iCloud for lack of a connection the row shall read "Waiting to upload"; while iCloud is unavailable (signed out, iCloud Drive off) the row shall read "iCloud unavailable", and the key shall go up at the next key check with iCloud available.

### E. Clear

> **FR-28** With the key switch on, Clear on a key row shall ask first. The confirmation shall say the key will be removed from this device, from iCloud, and from every device sharing keys at its next check; shall name the key by its service (eBird or OpenWeather); and shall never show the value. Confirm shall remove the local key, record a cleared marker locally (clear time, this device as origin), and write the same marker to the shared key record for that slot. Cancel shall change nothing.

> **FR-29** A device whose local key has a change time later than a shared cleared marker shall keep its key and upload it, replacing the marker (latest event wins). A device whose key is older, or untimed, shall remove it.

> **FR-30** If the cleared marker cannot reach iCloud at the moment of the Clear (iCloud unavailable), the local key shall still be removed at once, the row shall say the clear has not reached iCloud yet, and the marker shall be written at the next key check with iCloud available, carrying the original clear time.

> **FR-31** With the key switch off, Clear shall be the same instant local action it is today: no confirmation, no marker, no write to iCloud, and the slot's local entry removed entirely, so that a later enable treats the slot as holding no local key and takes the shared key if one exists.

### F. Turning off and Remove

> **FR-32** Turning the key switch off shall need no confirmation (OQ-5), shall leave this device's local keys and their change times intact and working, shall stop all key checks and key uploads, and shall remove the shared key record from iCloud when iCloud is reachable.

> **FR-33** If iCloud cannot be reached when the key switch is turned off, the switch shall still go off, the local keys shall stay, and the removal shall be pending: "Remove synced keys from iCloud" shall stay visible until the copy is gone, and the app shall retry the removal without user action at the next launch, foreground or check with iCloud reachable, while the copy is known to exist (OQ-1). The control shall remain the manual path throughout.

> **FR-34** The iCloud Sync section shall offer "Remove synced keys from iCloud" whenever iCloud is known to hold a key record, whether the key switch is on or off, as a control separate from "Remove synced files from iCloud". It shall require a confirmation that names the two keys by service and never by value, shall delete the shared key record, shall not touch any device's local keys, and shall write no cleared marker. A device with the key switch on shall upload its keys again at its next key check, and the confirmation shall say so, as the files' confirmation does.

> **FR-35** "Remove synced files from iCloud" shall never touch the key record, and "Remove synced keys from iCloud" shall never touch the files or their records. Each confirmation shall name only what it removes.

> **FR-36** With the key switch off on this device, the app shall know whether iCloud holds a key record only as far as FR-34 needs: from the last check while file sync is on, or from the last-known state persisted on this device, never by reading a key value.

> **FR-37** When the file switch is turned off while the key switch is on, FR-32 and FR-33 apply to the keys in the same action, and the files behave exactly as in 1.0.11: local files intact, shared file records untouched.

### G. States and provenance on key rows

> **FR-38** The API Keys rows shall keep their current presentation on every platform (masked value, Show or Hide, Update, Clear). On macOS and iOS with the key switch on, each key row that holds a key shall additionally show provenance as plain text: "From this device" or "From <device label> (<platform>)", plus the change time in the date format the Settings rows already use. A row that holds no key shall show no provenance.

> **FR-39** With the key switch on, each key row shall show exactly one sync state from this subset of the file feature's vocabulary, as text, never by color alone: **Up to date**; **Syncing**; **Waiting to upload**; **iCloud unavailable**; **Could not sync** (with a one-line reason and a "Retry" action). The file states "Syncing, uploading" and "Syncing, downloading" collapse to "Syncing" for keys, and "In iCloud, not downloaded here" and "Download now" do not apply to keys (OQ-2). A row that holds no key and has no shared entry shall show no state line.

> **FR-40** With the key switch off, a key row shall read "Sync off" only when the key switch has been on on this device at least once or iCloud is known to hold a key record. A device where the key switch has never been on and iCloud holds no key record shall render its key rows exactly as today, with no sync line.

> **FR-41** After a key check that replaced the local key, the row shall read "Replaced by the key from <device label> (<platform>), changed <time>" until the next user action on that row or the next replacement.

> **FR-42** After a key check that removed the local key through a cleared marker, the row shall read "Cleared from <device label> (<platform>), <time>" until the next user action on that row or the next arrival; the row otherwise shows today's empty state.

> **FR-43** The iCloud Sync section's last-check time and its "Check now" action shall cover the key check: one check runs both the file pass and the key pass, and "Check now" runs both.

> **FR-44** Every state, provenance, replacement and cleared string shall be built from a closed set of labels plus the origin label, the platform and the formatted time only; none shall ever include a key value (FR-21).

### H. Platform scope

> **FR-45** Windows, web and Pi builds shall render no key switch, no note, no key-row provenance or state, and no "Remove synced keys from iCloud" control, and shall run no key sync code. The FastAPI backend's keys in `backend/.env` are untouched.

> **FR-46** Availability for keys shall be the same four-state availability file sync computes. A Mac build without the iCloud entitlements or the embedded profile shall show "This build cannot use iCloud" for the key switch exactly as for the file switch, shall never crash, and shall write nothing.

> **FR-47** Nothing in the key check shall run on the launch path: first paint, tab load and every networked feature's use of the local key shall never wait on iCloud.

### I. Documentation and published statements

> **FR-48** `PRIVACY_POLICY.md` and `website/privacy.html` shall be updated in the same change, keeping the parity test green. The general storage bullet ("Your API keys, app settings, and the files you upload ... are stored only on your device") shall be qualified for the two Apple builds with key sync on. The iCloud Sync section's sentence "Nothing else is written: your API keys, app settings, map preferences and cached lookups stay on each device and are never synced" shall be replaced by a statement that keys are written only while the separate key switch is on, and that settings, map preferences and caches are never synced. The section shall add: what is stored for keys (the two key values, each with its change time and origin); how it is protected, saying exactly what iCloud provides (encrypted in transit and at rest by Apple, in the user's own account, invisible to the developer, end-to-end encrypted only with Advanced Data Protection); and how to remove it, naming the switch and "Remove synced keys from iCloud". The website page's meta description ("... settings, and API keys stay on your own device") shall be made true as well.

> **FR-49** `docs/HELP.md` shall be updated in the same change. The API Keys section shall describe the key switch, the provenance and states on key rows, Clear's reach with the key switch on, and that a received key arrives masked. The iCloud Sync section shall describe the key switch, its note, the "turn on iCloud Sync first" gating, that turning file sync off turns key sync off, "Remove synced keys from iCloud", and shall replace the sentence "Your API keys, settings and caches are never synced." The offline section shall say that each device keeps working with the keys it has. The Help TOC parity test shall pass.

> **FR-50** `README.md` (the iCloud Sync paragraph's "Only the two files and their upload details" sentence) and the `website/` feature prose shall describe the key switch in the same change.

> **FR-51** `appstore/LISTING.md` shall be re-read in the same change: the iCloud Sync bullet's "API keys, settings and caches are never written to it" shall be corrected; the "Data Not Collected" reasoning shall record why it still holds (device-to-Apple, the user's own account, opt-in, the developer has no access); and the store description sentence "Your files, settings, and API keys stay on your device" shall be made true.

> **FR-52** `ACCESSIBILITY.md` shall be re-read and changed only if a statement in it is made false by the new controls. No document touched by FR-48 to FR-52, and no user-facing copy, shall contain an em dash.

### J. Versioning and release

> **FR-53** `frontend/package.json` and `src-tauri/tauri.conf.json` shall be bumped to the same patch version (1.0.12), with a `CHANGELOG.md` entry describing the feature in plain language.

> **FR-54** The release shall go to all platforms in the standing rhythm as the `snowraven-release` skill directs: macOS through `release.sh`, Windows through CI at the tag (behavior unchanged, still built and published), `latest.json`, the iOS TestFlight build of the same version, and the App Store submission under the standing replacement rule.

## Non-Functional Requirements

> **NFR-01 Security:** The shared key record is untrusted on read and on write, on both sides. The native layer shall check that the record is a regular file within the size bound before reading it. Both writers shall sanitize to the validator's exact bounds at one write chokepoint per language, proven by a round trip (sanitize, serialize, validate) plus an idempotence check, and a parity test shall pin the TypeScript and Rust bounds equal, so a self-authored record is never rejected and re-pushed forever. A key value shall never leave its slot (FR-21). No new network destination shall be added: traffic stays device-to-Apple. The standing checks in `.claude/rules/security.md` apply to every changed file under `lib/icloud/` and `icloud.rs`, and the security review shall read that file.

> **NFR-02 Privacy honesty:** Every published statement shall say exactly what iCloud provides and no more: encrypted in transit and at rest by Apple, in the user's own account, invisible to the developer, and end-to-end encrypted only when the user has Advanced Data Protection on. The words "end-to-end" shall appear in the published statements only with that qualifier. No sentence shall claim that keys never leave the device without naming the key switch as the exception. The developer collects nothing and runs no server, unchanged.

> **NFR-03 Accessibility:** The key switch shall be a real switch with an accessible name; its disabled reason shall be programmatically associated with it; key-row state text shall be exposed through the existing live status region, which shall never contain a key value; every action ("Retry", "Remove synced keys from iCloud", the confirmations' buttons) shall be a real button reachable and operable by keyboard with a visible focus ring; the enable note and both confirmations shall trap focus and close on Escape, restoring focus to the opener. All of it shall meet WCAG 2.1 AA.

> **NFR-04 Layout and theming:** The new controls and the key-row provenance and state lines shall hold together at 320px width and at 200% in-app text scale, measured in a real browser at the longest label any state can produce (the v1.0.11 sync-state label lesson), with responsive layout in classes, not inline styles, and every color through `var(--sr-*)` tokens in both themes.

> **NFR-05 Copy:** User-facing copy, docs and policy text shall contain no em dash (U+2014) and shall read in plain language; the enable note's six required elements (FR-04) are content requirements with example wording the Engineer may tighten but not drop.

> **NFR-06 Offline and resilience:** With the key switch on and no network, or with iCloud unavailable, each device shall keep working with the keys it has, the key rows shall show an honest state, no key shall be emptied, and nothing shall hang or show a spinner in place of data. A key check that cannot reach iCloud shall give up within the existing check deadline and leave the app fully usable throughout.

> **NFR-07 Performance:** The key pass shall add at most one record read and at most one record write to a check. A check with iCloud reachable and nothing to transfer shall still finish within 2 seconds; a check with iCloud unreachable shall give up within 10 seconds. First paint and tab load times shall be unchanged from 1.0.11 with both switches on and iCloud unreachable.

> **NFR-08 Entry chunk:** No native key sync code shall ride the entry chunk. The entry graph may carry only the store, the platform gate and the copy; the controller and native wrapper changes emit as lazy chunks, and `entryChunk.test.ts` shall police both halves.

> **NFR-09 Tests and guards:** The change shall add tests for: the platform gate (no key switch, note, control or key-row sync markup when the gate is false); the key reconciliation table (FR-10, FR-11, FR-13, FR-14, FR-29); the key record validator and sanitizer (FR-19, FR-20) including real-shaped eBird and OpenWeather keys; the TypeScript-to-Rust bound parity and round trip (NFR-01); the storage seam's change-time stamping (FR-12); the write-chain interleaving (FR-26, shaped like `storageWriteSerialization.test.ts`); the never-leaks property (FR-21, FR-44: a sentinel key value never appears in any state, reason, error or thrown message); the switch settling rule (FR-08); the Remove and pending-removal paths (FR-33, FR-34, FR-35); the published-claims greps (FR-48, FR-49, FR-51, NFR-02); and the entry-chunk guard (NFR-08).

> **NFR-10 No regression for file sync:** Every 1.0.11 iCloud Sync test shall keep passing unchanged, except the amended QA-11 assertion, and the file rows, file reconciliation and file Remove path shall behave exactly as shipped.

## Out of Scope

- Windows, web/Pi and Android: no switch, no copy, no behavior change; `backend/.env` untouched.
- Syncing settings, map style, the replay store, or any derived eBird cache (county completeness, hotspot activity, checklist projects, escapee provenance, taxonomy).
- Per-key switches. One switch covers both keys.
- Any encryption layer of SnowRaven's own on top of iCloud (a passphrase, a device-shared secret). The keys travel exactly as the files do.
- Validating a received key against eBird or OpenWeather on arrival. A received key is applied as entered, as a typed key is.
- Any SnowRaven server, relay, CloudKit database, key-value store, or non-Apple cloud.
- Sharing between different people or Apple IDs, including Family Sharing.
- Showing the container in Finder or the Files app (its own roadmap item).
- Any change to how keys are entered, shown, masked or stored on a device today, beyond the change time and origin the sync needs.
- Migrating a device's existing keys into iCloud without the user turning the key switch on.
- Notifications outside the Settings tab when a synced key is applied or cleared.
- A confirmation on turning the key switch off (OQ-5).

## Open Questions

1. **Automatic retry of a pending removal (FR-33).** Default: yes. A removal that could not run because iCloud was unreachable is retried without user action at the next launch, foreground or check with iCloud reachable, while the copy is known to exist; "Remove synced keys from iCloud" stays visible as the manual path until the copy is gone.
2. **"In iCloud, not downloaded here" for keys (FR-39).** Default: not shown for keys. The record is small and is read whole within the check; if the native layer reports the record present but not yet downloaded, the row reads "Syncing" until it arrives within the check's deadline, then "Could not sync" with Retry. The Architect confirms whether the native layer can ever report that state for the key record.
3. **Provenance after an identical key is received (FR-14, FR-25).** Default: when the local key is untimed or older and the values match, the local entry adopts the shared entry's change time and origin, and the row shows the shared origin ("From <device> (<platform>)") with "Up to date". This keeps every later comparison deterministic.
4. **One record with two slots, or two records (FR-17).** Default: one record. Every requirement holds either way; only the container-contents count in QA-09 changes. The Architect finalizes.
5. **Confirmation on turning the key switch off (FR-32).** Default: none, matching the file switch. Local keys stay, and another sharing device restores the copy in seconds, so there is nothing irreversible to confirm.
6. **Key switch label and note wording (FR-01, FR-04).** Default: "Sync API keys" as the switch label; the six note elements are required content with example wording the Engineer may tighten without dropping any element.
7. **Device clock skew.** Change times come from each device's own clock. Default: accept, as file sync does; devices on one Apple ID keep network time.
8. **Lifetime of the local cleared marker (FR-12, FR-28).** Default: the marker persists in the local key store until the slot changes again (a set on any device applied here, or a Clear with the key switch off), so an offline Clear is never lost and a later shared set still wins.
9. **Key value bounds (FR-19).** Default: 1 to 128 printable ASCII characters. If the Architect finds a legitimate provider key shape outside this bound, widen it before build; never narrow it.

## Success Metrics

"Where" says how each row is verified. **Local:** on the build machine, with unit tests, a faked native layer, a real browser at 320px and 200% text scale, or the dev binary (which is in the "This build cannot use iCloud" state). **Device:** on the user's own Mac, iPhone and iPad after ship, because the build machine is not signed in to iCloud. **Both:** local proof plus a device confirmation.

| ID | What's Being Verified | Pass Condition | Where |
|---|---|---|---|
| QA-01 | FR-01, FR-45, US-07 | A gate test asserts no key switch, note, control or key-row sync markup when the platform gate is false; the web build in a browser renders none of it; the Windows build renders none of it. | Local (web, gate test); Device (Windows) |
| QA-02 | FR-02 | With the file switch off and iCloud available, the key switch is visible, off, not operable, and its reason says to turn on iCloud Sync first; with iCloud not signed in, iCloud Drive off, or a build that cannot use iCloud, the key switch's reason matches the file switch's reason for that state. | Both |
| QA-03 | FR-03, FR-36 | With the key switch off, the faked native layer records no key record write and no read of key record content across launch, foreground, a file check and Remove synced files; only an existence answer is consulted. | Local |
| QA-04 | FR-04 | Tapping the key switch on shows the enable note containing all six elements (what, whose account, how Apple protects it, which devices, what happens next, how to stop); a sentinel key value placed in the store never appears in the note; Cancel leaves the switch off and the faked layer records no write. | Local |
| QA-05 | FR-05, FR-41 | Enable on a device whose key is older than iCloud's: no second prompt; the row reads "Replaced by the key from <device> (<platform>), changed <time>" until the next action on that row. | Both |
| QA-06 | FR-06 | Turn the key switch on, relaunch: still on; a persisted preference with the key switch on and the file switch off reads as off; the preference never appears in the key record. | Local |
| QA-07 | FR-07, FR-37 | With both switches on, turn the file switch off: the key switch goes off in the same action, the key record is removed (or pending), local keys and files stay, shared file records are untouched; turning the file switch back on leaves the key switch off. | Both |
| QA-08 | FR-08 | Ten rapid toggles of each switch produce at most one check in flight and one queued, exactly one enable note per on-gesture, and a settled-off state with no key record left by this device even when an upload completed after the switch went off. | Local |
| QA-09 | FR-09, FR-17, amended QA-11 | With the key switch off on both devices the faked container holds only the two files and their records; with it on, exactly one additional key record and nothing else (no settings, cache, map style or replay document); a test asserts `api-keys.json` content is written only while the key switch is on and removed when it goes off. | Local |
| QA-10 | FR-10, FR-11, FR-14 | A reconciliation unit test covers every row of the FR-14 table, including newer local, newer shared, equal time same origin, equal time different origin (tiebreaker), each cleared-marker case, and asserts millisecond UTC comparison. | Local |
| QA-11 | FR-12 | A storage seam test on the Apple path: a key save stamps change time and this device's origin whether or not a switch is on; a Clear with the key switch on records a cleared marker; a Clear with it off removes the entry; a read of a pre-existing untimed key returns untimed, never "now". | Local |
| QA-12 | FR-13 | Untimed local key and no shared entry: uploaded as the seed with the upload time and this device as origin, and the local key stamped identically in the same save; untimed local key against any shared entry: the shared entry wins. On the user's devices, with pre-existing keys on both, the first device to enable seeds and the second adopts. | Both |
| QA-13 | FR-15 | Two simulated devices over one faked container: a set on A and a Clear on B within one minute, and two different sets within one minute, each converge after one check per device to the later event with the same origin and time on both. On the user's devices, the iPad Update reaches the Mac and iPhone at their next check. | Both |
| QA-14 | FR-16 | A device with the key switch off: keys set, changed or cleared elsewhere leave its local keys unchanged and its rows show no other device's provenance. | Both |
| QA-15 | FR-18, FR-19, FR-20 | Validator tests feed each bound's edge, a value with whitespace, a control character, non-ASCII, a 129-character value, an out-of-range time, a path-bearing label, an unknown version and an unparseable envelope: each is treated as absent (per slot or whole), none throws, no local key is deleted, launch completes, and the absent slot is overwritten at the same check when this device holds an entry; a real-shaped 12-character alphanumeric eBird key and a 32-hex OpenWeather key both pass. | Local |
| QA-16 | FR-21, FR-44 | With a sentinel key value in the store, every state string, reason, thrown message, log line and confirmation text over a full simulated cycle (upload, receive, replace, clear, error, remove) is asserted not to contain it; the Rust error strings are checked the same way; the record's name is a constant. | Local |
| QA-17 | FR-22 | The native layer refuses a directory, a symlink and an oversized file at the key record's name before reading, and the check treats it as absent. | Local |
| QA-18 | FR-23 | A received key is applied through the storage seam's write chain with the shared change time and origin; the next weather and map request uses it with no relaunch; the API Keys row shows it without leaving the tab. On the user's iPhone with no keys, both rows fill in and Weather and Map Explorer work at once. | Both |
| QA-19 | FR-24, FR-42 | A received newer cleared marker removes the local key; the missing-key guidance appears in Weather and Map Explorer without a relaunch; the row reads "Cleared from <device> (<platform>), <time>". | Both |
| QA-20 | FR-25 | A received key equal to the local key: no transfer, the row reads "Up to date", never "Replaced"; the local entry adopts the shared time and origin per OQ-3. | Local |
| QA-21 | FR-26 | Interleaving test: a user Update landing while a check applies a received entry persists, is the local value after both settle, and is pushed at the next check; no write is lost. | Local |
| QA-22 | FR-27 | A received key renders masked; Show reveals it and Hide re-masks it; a key typed with the key switch on is usable before the faked upload resolves; offline the row reads "Waiting to upload"; with iCloud unavailable it reads "iCloud unavailable" and goes up at the next available check. | Both |
| QA-23 | FR-28 | Key switch on, Clear eBird: the confirmation names eBird, this device, iCloud and the other sharing devices, and shows no value; confirm removes the local key, records the marker locally and in the shared record; cancel changes nothing. On the user's devices, the other device removes its key at its next check. | Both |
| QA-24 | FR-29 | Device B sets a key after A's Clear but before seeing it: B keeps its key, iCloud holds B's key, A adopts it. | Local |
| QA-25 | FR-30 | Clear with iCloud unavailable: the local key is removed at once, the row says the clear has not reached iCloud, and the marker is written at the next available check with the original clear time. | Local |
| QA-26 | FR-31 | Key switch off, Clear: no prompt, no marker, no write, the entry gone; a later enable adopts the shared key for that slot. | Both |
| QA-27 | FR-32 | Key switch off: no prompt; local keys intact and used by the next request; no further key reads or writes; the faked container's key record is gone. | Both |
| QA-28 | FR-33, OQ-1 | Key switch off with iCloud unreachable: the switch is off, keys stay, "Remove synced keys from iCloud" stays visible, the removal is retried at the next launch, foreground or reachable check, and the control disappears once the copy is gone. | Both |
| QA-29 | FR-34, FR-35 | "Remove synced keys from iCloud" appears whenever a key record exists (switch on or off), its confirmation names both services and no value, confirm deletes only the key record, writes no marker, and leaves every local key; "Remove synced files from iCloud" leaves the key record; a sharing device uploads its keys again at its next check and the confirmation says so. | Both |
| QA-30 | FR-38 | With the key switch on, a key row shows "From this device" or "From <label> (<platform>)" with the change time in the existing date format; an empty row shows no provenance. | Local |
| QA-31 | FR-39 | Each of the five key states renders as text with its exact label; "In iCloud, not downloaded here" and "Download now" never render on a key row; no state is conveyed by color alone; an empty slot with no shared entry shows no state line. | Local |
| QA-32 | FR-40 | With the key switch off: a device that has had it on, or knows iCloud holds a key record, reads "Sync off"; a device that never had it on and knows of no record renders the rows exactly as 1.0.11. | Local |
| QA-33 | FR-43 | "Check now" runs the file pass and the key pass in one check and updates the last-check time once. | Local |
| QA-34 | FR-46 | The dev binary (no entitlement, no profile) shows "This build cannot use iCloud" for the key switch as for the file switch, does not crash, and the faked layer records no write. | Local |
| QA-35 | FR-47, NFR-07 | With both switches on and iCloud unreachable, first paint and the Breeding Codes ready time are within measurement noise of 1.0.11; a check with nothing to transfer finishes within 2 s; an unreachable check gives up within 10 s; the key pass adds at most one record read and one record write per check. | Both |
| QA-36 | FR-48 | The privacy parity test passes; both policy pages contain the key storage, protection and removal statements; the sentences "are never synced" and "stay on your own device" no longer appear unqualified; the meta description is true. | Local |
| QA-37 | FR-49 | HELP describes the key switch in the API Keys and iCloud Sync sections and the offline section; the sentence "Your API keys, settings and caches are never synced." is gone; the Help TOC parity test passes. | Local |
| QA-38 | FR-50, FR-51, FR-52 | README, website prose, LISTING (the corrected bullet, the recorded reasoning, the corrected description sentence) and ACCESSIBILITY are re-read and updated in the same commit as the code. | Local |
| QA-39 | FR-53 | Both version files carry 1.0.12 and CHANGELOG has the entry. | Local |
| QA-40 | FR-54 | macOS, Windows, `latest.json`, TestFlight and the App Store submission all ship at 1.0.12. | Device (after ship) |
| QA-41 | NFR-01 | The round-trip, idempotence and TypeScript-to-Rust parity tests pass; the security review reads `.claude/rules/security.md` and finds no key value outside its slot; a network capture during a full cycle shows traffic only to Apple iCloud endpoints. | Both |
| QA-42 | NFR-02 | A grep over the published statements finds "end-to-end" only next to the Advanced Data Protection qualifier, and no sentence claiming keys never leave the device without naming the key switch. | Local |
| QA-43 | NFR-03 | Keyboard-only pass: the key switch, "Retry", "Remove synced keys from iCloud", the enable note and both confirmations are reachable and operable; the disabled reason is announced with the switch; the live region announces each state change and never contains the sentinel value; axe reports no AA violations. | Local |
| QA-44 | NFR-04 | At 320px and 200% text scale, with the longest provenance, replaced and cleared strings, no control overflows or overlaps; both themes render with no hardcoded colors (grep for hex or rgb in the changed components is empty). | Local |
| QA-45 | NFR-05 | Grep for U+2014 across the diff's copy, docs and policy files returns nothing. | Local |
| QA-46 | NFR-06 | With the key switch on and network off, launch: keys work for the next request, rows show an honest state, nothing hangs; with iCloud signed out: same, rows read "iCloud unavailable". | Both |
| QA-47 | NFR-08 | `entryChunk.test.ts` passes: no native key sync code on the entry chunk. | Local |
| QA-48 | NFR-09 | Every listed test file exists and passes. | Local |
| QA-49 | NFR-10 | The 1.0.11 iCloud Sync suites pass with only the amended QA-11 assertion changed; the file rows and Remove synced files behave as shipped on the user's devices. | Both |
