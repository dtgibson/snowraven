# PRD -- iCloud Bar-Chart Sync
**Feature:** icloud-bar-chart-sync
**Date:** 2026-09-27
**Stage:** 2 -- The Planner
**Source:** strategic-brief.md (approved, hands-off; build 1 of the 2026-09-28 Spool spin)

Written hands-off. The brief's three open questions are adopted as
defaults and listed under Open Questions for the user to confirm at the
copy review that follows The Designer. Nothing in this document proposes
final wording for any user-facing string; copy is specified by purpose
and constraint only, per the user direction of 2026-09-27 in CLAUDE.md.

Where this document names a file, a function or a constant, it is naming
the thing whose behavior a requirement is about, not prescribing how the
requirement is met.

---

## Feature Overview

A county's eBird bar-chart file added on the Targets tab of one Mac,
iPhone or iPad joins iCloud Sync as a third synced kind beside the eBird
backup and the Macaulay Library export: added, replaced or removed on
one device with sync on, it is the same on every other device with sync
on, per county, under the existing most-recent-wins rule. A new Settings
control removes every saved bar-chart file at once on every platform,
and with sync on removes them from iCloud and from every synced device.
Separably (Open Question 1), the Targets day-by-day live answers sync as
one merged document so no device re-spends eBird requests another
device already spent.

---

## User Stories

> **US-01** -- As a birder with SnowRaven on a Mac and an iPhone, I want a
> county bar-chart file I add on one device to appear on the other, so
> that I download it from ebird.org once and both Targets tabs show
> eBird's frequencies.

> **US-02** -- As the same birder, I want a newer bar-chart file I add for
> a county on one device to replace the older one on my other devices, so
> that every device shows the same year range and figures.

> **US-03** -- As the same birder, I want removing a county's file on one
> device (after confirming) to remove it from my other synced devices
> too, so that a file I no longer want does not linger anywhere I sync.

> **US-04** -- As a birder who has files for many counties, I want to sync
> all of them without being told there are too many, so that the number
> of counties I bird is never limited by the app.

> **US-05** -- As a birder on any platform, including Windows and web/Pi,
> I want one Settings control that removes every saved bar-chart file at
> once, so that I can clear them without visiting each county.

> **US-06** -- As a birder who turns iCloud Sync on for the first time on
> a device that already holds bar-chart files, I want those files to go
> up and the account's other county files to come down, so that turning
> sync on later costs me nothing I already did.

> **US-07** -- As the same birder, I want the day-by-day live answers a
> county sweep already fetched on one device to be available on my other
> devices, so that the second device does not repeat 30 eBird requests
> per county (Open Question 1; separable).

---

## Functional Requirements

### A. The bar-chart file family as a synced kind

> **FR-01** -- With iCloud Sync on, the app shall keep each county's
> bar-chart file the same across the user's devices under the same rule
> as the two data files: for one county, the most recently uploaded copy
> wins, whole; nothing is merged between two devices' files for the same
> county.

> **FR-02** -- Each synced county file shall be accompanied by a record
> carrying the same information the data-file records carry: the stored
> filename, the upload time, the origin device (its identifier, label and
> platform), the byte length and a checksum of the contents. A removed
> county shall be represented by a cleared marker carrying the clear time
> and origin device, as the data files are.

> **FR-03** -- Reconciliation shall be decided per county using the
> existing data-file reconciliation table (none / push / pull / download
> / delete-local, with the cleared-marker rows and the equal-time
> device-order tiebreak) applied to that county's local file and shared
> record. No county's outcome shall depend on another county's outcome
> or on the outcome for the two data files.

> **FR-04** -- A county file that is present locally and has no shared
> record shall be uploaded at the next check with this device as origin.
> A file that was present on this device before this feature shipped (or
> before sync was turned on) shall be adopted the same way, with the
> upload time taken from the local manifest's saved time; where that
> saved time cannot be written into a record (it fails the writer's time
> check), the record shall carry the time of the adopting check and the
> file shall still be uploaded, never skipped.

> **FR-05** -- A county file that exists in iCloud and not on this device
> shall be downloaded and stored through the existing bar-chart storage
> seam, keeping the shared record's filename and upload time, and the
> local record of where it came from shall be the shared record's origin
> (FR-13). A newer shared file for a county that already has a local file
> shall replace the local file whole, exactly as a newer data file does.

> **FR-06** -- A synced arrival, replacement or removal of a bar-chart
> file shall notify the bar-chart change signal (`barChartFilesChanged`)
> and shall NOT notify the general data-files signal (`filesChanged`), so
> the Targets tab reflects the change without a relaunch and no widget
> hand-over rebuild or additional iCloud check is triggered by it.

> **FR-07** -- The local bar-chart manifest shall carry, per county, what
> the Targets section and the reconciliation need beyond today's filename
> and upload time: the origin device of the current file. A manifest
> entry written before this feature (no origin) shall read as a file from
> this device. A manifest whose new fields are malformed shall be read
> with those fields dropped, never thrown on, matching the manifest's
> existing normalizer posture.

> **FR-08** -- A county whose shared file is present in iCloud but has not
> yet downloaded to this device shall be treated as the data files are in
> the same situation: the device keeps using whatever local file it has
> (or none), the state reads as not yet downloaded here, and the user can
> ask for the download from the Targets section (FR-16).

> **FR-09** -- The set of counties the app will sync shall be bounded only
> by the finite space of valid US county region codes. The app shall
> impose no count quota, payload budget or eviction on synced bar-chart
> files, and no user-facing message shall ever tell a user they have too
> many. (The existing 50 MiB per-file cap at add time and the existing
> iCloud per-file bound are pre-existing and structural; FR-30.)

### B. Removal and its propagation

> **FR-10** -- Removing a county's file from the Targets section with
> sync on shall first ask the user to confirm; the confirmation shall
> name what is removed and from where (this device, iCloud, and every
> device with sync on at its next check) and shall state that devices
> with sync off keep theirs. On confirm the app shall remove the file
> from this device, write the county's cleared marker to iCloud, and the
> Targets section shall reflect the removal without a relaunch. With
> sync off, Remove shall remain the instant local action it is today,
> with no confirmation.

> **FR-11** -- A county's cleared marker that could not reach iCloud at
> removal time (iCloud unreachable) shall be remembered and finished at
> the next check that can reach iCloud, unless a newer shared file for
> that county has appeared meanwhile, in which case the newer file wins
> and the pending clear is dropped; in either case the memo is then
> discarded. This is the data files' pending-clear behavior applied per
> county.

> **FR-12** -- A device with sync on that finds a county's cleared marker
> newer than its local file shall remove its local file at that check and
> reflect it on Targets without a relaunch. A device with sync off shall
> never remove a bar-chart file because of a marker.

> **FR-13** -- Turning iCloud Sync off shall leave every bar-chart file on
> the device and every copy in iCloud in place, as it does for the data
> files. The existing Remove synced files from iCloud control shall also
> delete every bar-chart file copy and county record the account holds,
> and its confirmation shall list or otherwise account for them alongside
> the data files; it shall continue not to touch the key record.

> **FR-14** -- Clearing the eBird backup (with or without sync) shall not
> remove, alter or re-upload any bar-chart file on any device. The
> bar-chart family shall stay out of the derived-store clear registry
> (`clearDerived.ts`), because a bar-chart file is a user file, not a
> derivation of the backup.

### C. The Targets bar chart section

> **FR-15** -- With sync on, the Targets bar chart section shall show, for
> the current file, where it came from (this device, or the other
> device's name and kind) and when it was uploaded, and one sync state
> drawn from the same state vocabulary the Settings data-file rows use
> (up to date; syncing, uploading; syncing, downloading; in iCloud, not
> downloaded here; waiting to upload; iCloud unavailable; could not sync
> with its reason and a retry). With sync off the section shall show no
> sync state and no origin, exactly as today. On platforms without iCloud
> Sync nothing in the section changes.

> **FR-16** -- When the county's state is "in iCloud, not downloaded
> here", the section shall offer the same download action the Settings
> rows offer, and shall keep showing the frequencies from the local file
> it has (if any) until the download lands.

> **FR-17** -- After a check has replaced the county's file with another
> device's, the section shall say so (naming the device and time) until
> the user's next action on that county, matching the Settings rows'
> replaced line.

> **FR-18** -- The existing status line (year range, months covered,
> matched, skipped-form and unmatched counts, and the Show unmatched
> toggle) shall be computed from whichever file is current after a sync
> and shall read identically on every device holding the same file
> bytes.

### D. The Settings clear-all control

> **FR-19** -- Settings shall offer, on every platform (macOS, Windows,
> iOS, iPadOS, web/Pi), one control that removes every saved bar-chart
> file on this device. It shall sit near the bottom of the tab, beside
> the Troubleshooting section where that section renders and at the same
> position where it does not.

> **FR-20** -- The control shall always ask for confirmation before
> removing anything, on every platform and whether sync is on or off
> (Open Question 2). The confirmation shall name what is removed (every
> saved bar-chart file, and how many counties that is) and from where;
> with sync on, it shall additionally say that the copies in iCloud are
> removed and that every device with sync on removes its copies at its
> next check, and that devices with sync off keep theirs.

> **FR-21** -- On confirm, the control shall remove every county's file
> and manifest entry on this device; with sync on it shall additionally
> write a cleared marker for every county it removed (FR-11 applies to
> any marker that cannot reach iCloud). The Targets tab shall reflect the
> removal without a relaunch (FR-06). A device with no saved bar-chart
> files shall show the control in a state that cannot be activated, with
> the reason readable in place, rather than hiding it.

> **FR-22** -- If some but not all files could be removed, the control
> shall say so in place, naming that some files remain, and the manifest
> shall describe exactly the files that are still present; no county
> shall be listed in the manifest with its file gone or present on disk
> with no manifest entry after the operation settles.

> **FR-23** -- The control shall remove bar-chart files only. It shall not
> clear the eBird backup, the Macaulay Library export, any API key, any
> setting, or any derived store, and (Open Question 1) it shall not
> remove the Targets day-by-day answers.

### E. The Targets day-by-day live cache (separable; Open Question 1)

> **FR-24** -- With iCloud Sync on, the app shall keep one shared copy of
> the Targets day-by-day live answers in the same private container, and
> each device shall merge the shared copy into its own on every check:
> union by (county, date) key; for a key present in both, the entry
> marked complete is preferred over one not marked complete; where both
> or neither are complete, the entry with the later fetch time is kept.
> After merging, the device's own entry cap, payload budget and eviction
> order apply locally, unchanged.

> **FR-25** -- A device shall upload its merged copy only when the merge
> changed what it holds relative to what it read from iCloud (by
> checksum), so two devices holding the same answers converge without an
> unbounded exchange of writes. The merge shall be order-independent:
> merging A into B gives the same set of kept entries as merging B into A.

> **FR-26** -- Every entry read from the shared copy shall pass the day
> cache's existing per-entry validation before it is merged (key shape,
> record fields, species-count bound); an entry that fails is dropped and
> the rest are kept. A shared copy that cannot be parsed shall be treated
> as absent, leaving the local copy untouched.

> **FR-27** -- Clearing the eBird backup with sync on, which already
> purges this device's day-by-day answers, shall also remove the shared
> copy from iCloud (Open Question 5), and the Remove synced files from
> iCloud control shall remove it too. No day-cache entry shall ever
> notify `filesChanged`.

> **FR-28** -- The day-cache sync shall have no row of its own in
> Settings and no state text of its own; its only user-visible effects
> are in what the turn-on note says goes to iCloud (FR-36) and in the
> Targets tab showing days as already checked without a fetch. If The
> Architect finds it cannot ride the existing sync machinery without
> endangering the file sync in this build, FR-24 to FR-28 and US-07 move
> to a follow-on with the reason written in `decisions.md`, and every
> copy surface reverts to naming the files only.

### F. Names, bounds and trust

> **FR-29** -- Every name the app writes into the iCloud container for
> this feature shall derive only from a validated US county region code,
> never from the user's filename, and shall be distinct from the two
> data-file names, their records and the key record. A region code that
> fails the shared predicate shall be refused before any filesystem or
> container operation, on both the TypeScript and the native side.

> **FR-30** -- The per-file bound applied in the sync path to a bar-chart
> file shall be no smaller than the existing 50 MiB add-time cap, stated
> as a relationship between the two constants rather than as a repeated
> number, so a file the app accepted at add time can never be refused by
> sync on size alone.

> **FR-31** -- The native side shall treat a county file and record in
> the container exactly as it treats the data files: regular-file check,
> real on-disk size bounded before any read, claimed length and digest
> verified on pull and push, a symlink at an item's name removed as a
> link and never followed, and an oversized or unreadable record read as
> absent.

### G. Platform scope

> **FR-32** -- Windows, web and Pi shall gain the clear-all control
> (FR-19 to FR-23) and nothing else: no iCloud Sync section, no sync
> state on Targets, no change to how bar-chart files are stored there.

> **FR-33** -- A peer device running an app version from before this
> feature, with sync on, shall not be broken by the new container
> contents: it continues to sync the two data files and ignores what it
> does not know. No compatibility behavior is added for it (Open
> Question 6).

### H. Copy and published surfaces

> **FR-34** -- Every new or changed user-facing string this feature
> introduces (labels, buttons, headings, states, confirmation titles,
> bodies and buttons, the turn-on note, screen-reader text, and every
> sentence on the surfaces in "Copy surfaces requiring approval") shall
> appear in the design spec's copy table with its exact before and after,
> and shall be approved by the user before The Engineer writes it. A
> string not in the approved table shall not ship.

> **FR-35** -- Copy shall be specified in this document by purpose only.
> The following purposes are required: the turn-on note shall state that
> bar-chart files are included in what goes to iCloud (and the day
> answers if FR-24 ships) and shall no longer state that nothing else
> goes; the Targets section shall no longer state that the file stays on
> the device or is not synced; each confirmation shall name what is
> removed and from where; a state or reason shall never carry Apple's own
> error text or a raw code.

> **FR-36** -- Every published statement that iCloud Sync copies exactly
> two files, that the bar-chart file stays on the device, that it is not
> part of iCloud Sync, or that cached lookups are never synced (the last
> only if FR-24 ships) shall be made true of what ships, on every surface
> listed below, in the same change, each swept at paragraph scope and the
> files compared against each other.

### I. Guards

> **FR-37** -- The parity guard that today proves the bar-chart family is
> never synced (`icloudPaths.parity.test.ts`, the "provably never synced"
> block) shall be inverted into a parity block for the new kind: record
> field names, native command names and the size bound agree on both
> sides, and the region-code predicate is one predicate in TypeScript
> and Rust with an enforcement test on each side that fails when that
> side's enforcement is deleted. The block asserting the day cache is
> never synced shall be inverted or retired according to Open Question 1.

> **FR-38** -- `targetsPublishedClaims.test.ts` shall be updated so every
> row asserting the retired sentences now asserts the new ones (with a
> non-vacuity leg per file), and its roster of which modules may import
> the bar-chart import and remove functions shall be extended
> deliberately to whatever the clear-all control uses. Any new sentence
> added to `PRIVACY_POLICY.md`, `website/privacy.html`, `docs/HELP.md`,
> `README.md`, `website/index.html` or `ACCESSIBILITY.md` shall be read
> by a published-claims guard of the house shape.

> **FR-39** -- `entryChunk.test.ts` shall stay green: the sync controller,
> the native wrapper, the bar-chart modules and the day cache stay off
> the entry chunk; `barChartFilesChanged.ts` and `regionCode.ts` stay
> dependency-free. `cacheInventory.test.ts`'s rows (the day cache's
> registry row, the bar-chart family's deliberate absence from the
> registry) shall stay true.

---

## Non-Functional Requirements

> **NFR-01 -- Security:** Every native read of a bar-chart file or record
> from the container follows `.claude/rules/security.md`'s
> regular-file-plus-size-bound rule (FR-31); container names derive only
> from the validated region code (FR-29); the region-code predicate is
> twinned with `[0-9]`, matching anchors, and a trailing-newline row in
> the shared fixture; records are sanitized at the write chokepoint to
> the validator's exact bounds in both languages, proven by a round trip.
> The day cache (if FR-24 ships) is a persisted runtime document arriving
> from a shared location, so per-entry validation on load applies in full
> and any new scan over its contents is declared in the schema with its
> linearity argument.

> **NFR-02 -- Performance:** A check with N county files does work
> proportional to N (one record read per county, one transfer per county
> that needs one), with no per-county work that scales with the number of
> other counties; the check never blocks the main thread on file
> contents. Adoption on the first check after turning sync on uploads
> every local county file within the same check without user action. The
> day-cache merge (if it ships) is linear in the total entry count of the
> two copies.

> **NFR-03 -- Accessibility:** The two new confirmations (Targets Remove
> with sync on; Settings clear-all) reuse the shared modal shell: one
> close path for Escape, backdrop and buttons, a focus trap re-queried
> per Tab, focus returned to the opener or to a fallback when the opener
> has gone disabled. The clear-all control in its cannot-activate state
> stays focusable with its reason readable in place (`aria-disabled`,
> never native `disabled`). Every new button and link renders through the
> canonical `Button`/`Link` primitives. New state text on Targets is plain
> text, never color alone. Layout holds at 320px and 200% in-app text
> scale; a `nowrap` label is measured at its longest state.

> **NFR-04 -- Compatibility:** The pre-feature manifest reads correctly
> (FR-07); a pre-feature peer with sync on is not broken (FR-33); the
> web/Pi manifest format (seconds-precision times) is untouched because
> sync does not exist there.

> **NFR-05 -- Copy conventions:** No em dash in any user-facing string or
> published surface; American spelling; no user-facing surface named from
> a component name; user-facing counts stated as properties where a count
> would go stale.

> **NFR-06 -- Privacy statement:** `PRIVACY_POLICY.md` and
> `website/privacy.html` state what is in iCloud after this feature and
> stay identical to each other in the mirrored sentences; the effective
> date moves with the change.

---

## Out of Scope

From the strategic brief, unchanged:
- The county species pool cache (`county-completeness-v1`): move it out of
  `settings.json` first; sync it, if ever, after.
- Any other cache, setting or preference (`targetsCounty`, map
  preferences, taxonomy data) stays per device.
- A Settings listing of which counties hold a bar-chart file; the new
  control counts and clears, it does not enumerate.
- Fetching bar charts for the user from ebird.org.
- Merging two devices' bar-chart files for the same county.
- Any change to API-key sync, the widgets, or Windows/web/Pi storage of
  bar-chart files beyond the clear-all control.
- Raising or lowering the 50 MiB per-file stored-file cap.

Added while writing this PRD:
- Cleaning up cleared markers: the per-county tombstone set is bounded by
  the county space and is not garbage-collected, as today for the data
  files.
- A day-cache row or state in Settings, or a per-device control over
  day-cache sync separate from the iCloud Sync switch.
- Changing the day cache's local entry cap, payload budget or eviction
  order.
- A compatibility path for an older app version reading the new container
  contents (FR-33).
- Closing the web/Pi cross-site simple-request exposure of the bar-chart
  and day-cache routes (ROADMAP, Targets security Informational (1)).
- Any change to the Troubleshooting section's own platform gating or to
  the Rebuild caches control.

---

## Open Questions

For the user, to confirm at the copy review after The Designer:

1. **Should the Targets day-by-day live cache sync too?** Default: yes,
   as one merged document (FR-24 to FR-28), separable from the file sync
   and dropped to a follow-on with a written reason in `decisions.md` if
   The Architect finds it threatens this build. The species pool stays
   out either way. Note for The Architect: a synced *record* is capped at
   4,096 characters and the native side reads no record over 16 KB,
   while the day cache document can reach 10,000,000 code units, so it
   can only sync as content with a record beside it (the data-file shape),
   with the merge performed on the device after download and before any
   upload; it cannot take the key record's one-document shape.
2. **Should the clear-all control confirm when sync is off?** Default:
   yes, always (FR-20), because the bulk control shows no per-file view.
3. **The privacy "delete your stored files ... from the Settings tab"
   sentence** (`PRIVACY_POLICY.md` line 16, mirrored at
   `website/privacy.html` line 124). Its recorded reversal condition is
   met by the clear-all control. Default: it is revisited in this build's
   copy review alongside the other privacy changes, not left standing.

Resolved by default in this document unless the user says otherwise:

4. **Adoption time when the manifest's saved time cannot be written**
   (FR-04). Default: the record carries the time of the adopting check
   and the file is still uploaded.
5. **Clearing the eBird backup with sync on and the shared day-cache
   copy** (FR-27). Default: the shared copy is removed too, so the
   published sentence "clearing your eBird backup also removes ... the
   day-by-day eBird reports" stays true across devices. Moot if FR-24
   does not ship.
6. **A peer running a pre-feature version** (FR-33). Default: it ignores
   the new container contents; no shim.
7. **`ACCESSIBILITY.md`** currently scopes its confirmation sentence to
   the Sync API keys switch. Default: the new confirmations are covered
   by a property statement about the app's confirmations if the sentence
   is touched at all; otherwise no change, confirmed at the copy review.

---

## Success Metrics

Verification boundary: automated tests are the verification path. This
Mac is not signed into iCloud and agents never touch physical devices,
so cross-device behavior is proven through the native-wrapper fakes, the
reconciliation tests, the parity guards and the TypeScript-Rust twin
tests; rows marked **user-verified after TestFlight** are confirmed by
the user on their own devices and are otherwise recorded as Partial,
never inferred.

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01/FR-03: per-county reconciliation | For each row of the existing reconciliation table, a county file and record in that configuration yields the same action as the same configuration yields for a data file; a fixture with two counties in different configurations yields each county's own action, and the two data-file slots' actions are unchanged by the counties' presence. |
| QA-02 | FR-02: record shape | A county record written by the app validates with the shared validator and round-trips byte-identical through the TypeScript and Rust serializers (golden string pinned on both sides); a cleared marker does the same. |
| QA-03 | FR-04: push and adoption | Under the native fake, a local county file with no shared record is pushed at the next check with this device as origin and the manifest's saved time; a pre-feature manifest entry (no origin) is adopted, and a manifest time that fails the writer's time check yields a record carrying the check time and the file still pushed (a mutation dropping the fallback goes red). |
| QA-04 | FR-05/FR-08: pull and download | Under the fake, a shared county file absent locally is written through the bar-chart seam with the shared filename and time and the shared origin recorded; a shared file not yet downloaded yields the not-downloaded state and leaves the local file untouched; a newer shared file replaces an older local one whole. |
| QA-05 | FR-06: change signals | A synced arrival, replacement and removal each bump `barChartFilesChanged` exactly once and never bump `filesChanged` (asserted on both counters, with a control leg showing a data-file arrival still bumps `filesChanged`). |
| QA-06 | FR-07: manifest compatibility | A pre-feature manifest reads with every county intact and each reading as from this device; a manifest with a malformed origin reads with the origin dropped and the county kept; the normalizer never throws on any shape in the corrupted-manifest corpus. |
| QA-07 | FR-09: no quota | A fixture with more counties than any hand-picked number (every code of one state, and a generated set spanning many states) syncs every county with no refusal, no eviction and no "too many" state; a source scan finds no count cap, payload budget or eviction over the bar-chart family in the sync path or the manifest. |
| QA-08 | FR-10: Remove with sync on | Rendering the Targets section with sync on, Remove opens a confirmation whose body names this device, iCloud and other devices' next check (asserted against the approved copy table); confirming removes the file and writes the county's cleared marker under the fake; Cancel and Escape leave the file and write nothing. With sync off, Remove removes at once with no dialog. |
| QA-09 | FR-11: pending clear | With the fake refusing the marker write, the clear is remembered; the next check writes it; a check that finds a newer shared file for that county drops the memo and pulls the file; the memo is gone after either outcome. |
| QA-10 | FR-12: marker on a peer | Under the fake, a cleared marker newer than the local file removes the local file and bumps `barChartFilesChanged`; the same marker with sync off removes nothing. |
| QA-11 | FR-13: turning off and Remove synced files | Turning sync off writes and deletes nothing for any county; the native remove-all fake is asked to remove every county file and record the account holds plus the two data files, and never the key record; the Remove confirmation's listed contents include the county files (against the approved copy table). |
| QA-12 | FR-14: backup clear leaves bar charts alone | Clearing the eBird backup with sync on and with sync off leaves every county file, manifest entry and shared county record untouched; `cacheInventory.test.ts` still asserts the registry matches no bar-chart row. |
| QA-13 | FR-15/FR-17: Targets state and origin | Rendering the section under each of the eight slot states shows the approved state text and origin/time for that state, the replaced line after a replacing check until the next action, and none of it with sync off or on a non-Apple platform. |
| QA-14 | FR-16: Download now on Targets | In the not-downloaded state the section offers the download action, invoking it calls the native start-download fake for that county, and the status line still reflects the local file until the download lands. |
| QA-15 | FR-18: status line parity | The same file bytes produce the same year range, months, matched, skipped and unmatched counts whether stored locally or written by a synced arrival (structural: the section reads one parsed result, and a byte-equal input yields a deep-equal parsed result). |
| QA-16 | FR-19/FR-32: control placement on every platform | Rendering Settings under each platform gate (macOS, Windows, iOS, web) shows the clear-all control at the same position relative to the tab's last sections, with the iCloud Sync section present only on macOS and iOS, and (FR-28) no row, switch or state text for the day cache anywhere in Settings. |
| QA-17 | FR-20: always confirms | With sync off on every platform, and with sync on, activating the control opens the confirmation first; the sync-on body additionally names iCloud and other devices' next check; the count named equals the manifest's county count (asserted against the approved copy table). |
| QA-18 | FR-21: clear-all effect | On confirm, every county's file and manifest entry is removed; with sync on, a cleared marker is written for each removed county under the fake; `barChartFilesChanged` bumps and `filesChanged` does not; with an empty manifest the control is `aria-disabled` with its reason associated, never native `disabled`, and cannot be activated by click or keyboard. |
| QA-19 | FR-22: partial failure | With the seam refusing one county's delete, the control reports that some files remain, the manifest lists exactly the surviving county, and no county is listed with its file gone or present with no entry. |
| QA-20 | FR-23: nothing else cleared | After clear-all, the eBird backup, ML export, both API keys, settings, every derived store and (if FR-24 ships) the day cache are byte-identical to before. |
| QA-21 | FR-24: day-cache merge semantics | Over a generated corpus of local/shared pairs: the result is the union by key; for a shared key, complete beats incomplete, else the later fetch time wins; merging A into B and B into A yield the same kept set (commutativity and idempotence asserted); the local cap, budget and eviction order apply after the merge and the guard's pinned caps are unchanged. Skipped with a written reason if FR-24 is deferred. |
| QA-22 | FR-25: convergence | A merge that changes nothing uploads nothing (checksum equal); a two-device simulation under the fake reaches a fixed point within two checks per device with no further writes. |
| QA-23 | FR-26: shared copy validation | A shared copy with one malformed entry merges the rest and drops that one; an unparseable shared copy leaves the local copy untouched and reads as absent; every `DayRecord` field guard is exercised with a hostile row. |
| QA-24 | FR-27: day-cache removal paths | Clearing the eBird backup with sync on removes the shared day-cache copy under the fake; Remove synced files from iCloud removes it; no day-cache path bumps `filesChanged`. |
| QA-25 | FR-29: names from the region code only | For every county in a fixture (including hostile filenames), each container name equals a deterministic function of the region code and matches none of the data-file, record or key-record names; a region code failing the predicate is refused on both sides before any filesystem call (each side's refusal test goes red when that side's check is deleted). |
| QA-26 | FR-30: bound relationship | A test asserts the sync-path per-file bound is greater than or equal to the add-time cap by comparing the two imported constants, never a literal. |
| QA-27 | FR-31/NFR-01: native read posture | Rust tests: a directory, a symlink, an oversized file and a record over the record byte bound at a county's name are each refused or read as absent without being followed or read into memory; pull and push verify length and digest for a county file exactly as for a data file. |
| QA-28 | FR-33/NFR-04: older peer | A record set containing county records and markers plus the two data-file records is reconciled by the pre-feature record reader with the two data files unchanged and every unknown item ignored, no throw. |
| QA-29 | FR-34/FR-35: copy table coverage | Every user-facing string in the diff (in-app strings, aria text, HELP, privacy, README, website, listing, changelog) appears in the design spec's approved copy table with the user's approval recorded; a string absent from the table fails the row. |
| QA-30 | FR-36/NFR-06: published claims true and mirrored | The published-claims guards assert each retired sentence is gone and each replacement present with a non-vacuity leg per file; `PRIVACY_POLICY.md` and `website/privacy.html` are identical in the mirrored sentences and the effective date moved; the files are compared against each other for the same claim. |
| QA-31 | FR-37: parity block inverted | The former "provably never synced" block is replaced by a parity block; deleting the Rust region-code enforcement turns only the Rust test red, deleting the TypeScript enforcement turns only the TypeScript test red, and the shared fixture carries a trailing-newline, leading-newline, embedded-newline and non-ASCII-digit row. |
| QA-32 | FR-38/FR-39: guards updated and green | `targetsPublishedClaims.test.ts`, `entryChunk.test.ts` and `cacheInventory.test.ts` pass; the import roster names the clear-all control's module deliberately; the sync controller, native wrapper, bar-chart modules and day cache remain off the entry chunk. |
| QA-33 | NFR-02: work bound | Under the fake, a check with N counties performs exactly N record reads and at most N transfers (asserted on the fake's call counts at N = 1, 50 and 500), and the count of reads per county does not grow with N. |
| QA-34 | NFR-03: confirmations and control | Both new dialogs close on Escape, backdrop and Cancel through one path and return focus to the opener (or the fallback when the opener has gone disabled); every new button and link renders through the primitives (`tabOrderCoverage.test.ts` green); new state text is present as text. |
| QA-35 | NFR-05: copy conventions | No U+2014 in any changed user-facing string or published surface; American spelling in the changed copy; no user-facing surface named from a component name in the diff. |
| QA-36 | US-01/US-02/US-03/US-06: real cross-device sync | **User-verified after TestFlight:** on the user's own devices, a file added on one appears on the other with the same status line and no second download; a replacement becomes the newer file; a confirmed Remove removes on the other at its next check; turning sync on with existing files uploads them and receives the others. Recorded as Partial until the user reports. |
| QA-37 | US-07: day answers arrive | **User-verified after TestFlight, only if FR-24 ships:** a county swept on one device shows its days as already checked on the other without a sweep. Recorded as Partial until the user reports. |

---

## Copy surfaces requiring approval

Every item below states or implies that iCloud Sync copies exactly two
files, that the bar-chart file stays on the device, or that caches are
never synced, and so becomes inaccurate when this ships. The Designer
drafts the exact strings and shows before-and-after; the user approves
each before anything is written (FR-34). No wording is proposed here.

In-app strings:
- `frontend/src/lib/icloud/icloudCopy.ts`: the section description
  (`ICS_DESCRIPTION`, names only the two files); the turn-on note's "What
  goes to iCloud" item (names the two files and says nothing else goes);
  the Remove synced files confirmation's listed contents and outro, which
  must account for county files; the new Targets Remove confirmation
  (title, body, confirm button); the clear-all control's label, its
  confirmation (title, body, confirm button, sync-on variant), its
  cannot-activate reason and its partial-failure text.
- `frontend/src/lib/targets/targetsCopy.ts`: `ADD_FILE_DETAIL_TAIL`
  ("The file stays on this device and is not synced."); new origin, state,
  not-yet-downloaded and replaced text for the bar chart section.
- Screen-reader text for the new control, the new dialogs and any new
  state text.

Published surfaces:
- `docs/HELP.md`: line 424 (Targets: "The file stays on this device and is
  not part of iCloud Sync, so add it on each device where you want eBird's
  frequencies"); the iCloud Sync section at lines 739 (the two files), 741
  ("the two files"; "Your settings and caches are never synced"), 745
  (per-file most-recent-wins, to be read for the county case), 747 (the
  rows and states paragraph, which must say where bar-chart state shows),
  749 ("Clearing a file with sync on"), 751 (Remove synced files from
  iCloud); line 820 (offline note on Targets) if FR-24 ships; a sentence
  for the new clear-all control in or beside Troubleshooting.
- `PRIVACY_POLICY.md`: line 13 ("copies the two data files"); line 16
  ("delete your stored files and keys at any time from the Settings tab",
  Open Question 3, and its "day-by-day eBird reports" clause if FR-24
  ships); line 32 (the bar-chart bullet, "is not part of iCloud Sync");
  line 65 ("keep your two data files the same"); line 67 ("writes your
  eBird backup and your Macaulay Library export"; "cached lookups stay on
  each device and are never synced" if FR-24 ships); line 70 (Remove
  synced files from iCloud, which now covers county files).
- `website/privacy.html`: the mirrored lines 121, 124, 141, 170, 172,
  175, and the effective date at line 84.
- `README.md` line 59 and `website/index.html` lines 128-129 (the privacy
  paragraph naming the eBird backup, Macaulay Library export and API keys
  as the things stored on device unless iCloud syncing is on): at most one
  proposed sentence, approved before it lands, shown as rendered pages
  over the tailnet.
- `appstore/LISTING.md`: line 73 (the same privacy paragraph) and lines
  192-202 ("copies the user's two data files"; "Settings and caches are
  never written to it"); `appstore/REVIEW_NOTES.md` to be read for any
  restatement; the TestFlight and App Store release notes for the version.
- `ACCESSIBILITY.md` line 15: confirmations sentence currently scoped to
  the Sync API keys switch (Open Question 7); likely no change.
- `CHANGELOG.md`: the release entry (American spelling, no em dash).
