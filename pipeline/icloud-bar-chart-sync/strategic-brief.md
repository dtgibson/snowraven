# Strategic Brief -- iCloud Bar-Chart Sync

Feature name: `icloud-bar-chart-sync`. Feature lane, build 1 of the
2026-09-28 Spool spin. Written hands-off from the saved idea, the 1.0.39
Targets-tab records, the iCloud Sync code, and the standing rules; no
user interview. Open questions are at the end with recommended answers.

## What We're Building

A county's eBird bar-chart file, added on the Targets tab of one Mac,
iPhone or iPad, reaches every other device the user has iCloud Sync on,
exactly as the eBird backup and the Macaulay Library export do today;
removing or replacing it on any device does the same on the others. A
new Settings control near the bottom of the tab clears every saved
bar-chart file at once, on this device and, with sync on, everywhere.

## Why Now

This is the build the user chose at the 1.0.39 deploy gate ("ship now,
sync next"; DECISIONS.md, ROADMAP.md "Bar-chart files in iCloud Sync,
the user's chosen NEXT build"). The Targets tab shipped with the file
deliberately device-local so that the published privacy sentence was
true of what shipped, and the follow-on was captured to the idea inbox
in the user's words: "If a user has icloud sync on, lets keep all their
apps in sync." It is the first item the user asked for after using the
tab, and the exclusion is pinned in code by a guard that was written
expecting to be inverted (`icloudPaths.parity.test.ts`, "the eBird
bar-chart files are provably never synced"). The direction is settled;
this build carries it out.

## The User Problem

A birder who uses SnowRaven on a Mac and an iPhone downloads a county's
bar chart from ebird.org (a signed-in step SnowRaven cannot do for them),
adds it on one device, and then finds the other device's Targets tab
without eBird's frequencies until they repeat the download and the add
there. The help text says so in as many words ("add it on each device
where you want eBird's frequencies"). With sync on for the two data
files, the bar-chart file is the one Targets input that still has to be
carried by hand, and the same is true in reverse: a file removed on one
device lingers on the others. The saved idea also asks that other
Targets data that costs eBird API calls to rebuild not be rebuilt on
every device; the day-by-day live sweep is the one that costs real work
(30 requests per county per device).

## Success Criteria

- A bar-chart file added on one synced device appears in that county's
  eBird bar chart section on every other synced device after its next
  check, with the same status line (year range, matched, skipped and
  unmatched counts), with no second download from ebird.org and no
  relaunch.
- Replace on one device becomes the newer file on the others; the most
  recently uploaded copy wins whole, per county, exactly as for the two
  data files.
- Remove on one device, with sync on, asks the user to confirm first,
  then removes the file from this device, from iCloud, and from every
  other synced device at its next check; devices with sync off keep
  theirs. With sync off, Remove is the same instant local action it is
  today.
- Turning iCloud Sync on for the first time on a device that already
  holds bar-chart files uploads them; a device that turns sync on later
  receives every county file the account holds.
- A user with bar-chart files for many counties is never told they have
  too many: the number of counties that can be synced is bounded only by
  the finite set of US county codes, never by a quota this app chose.
- The new Settings control removes every saved bar-chart file on this
  device (all platforms, including Windows and web/Pi where there is no
  iCloud), and with sync on removes them from iCloud and from every
  synced device at its next check, after one confirmation; the Targets
  tab reflects it without a relaunch.
- The existing Remove synced files from iCloud control also removes the
  account's bar-chart copies, and the existing clear of the eBird backup
  still leaves bar-chart files alone on every device (a bar-chart file is
  a user file, not a derivation of the backup).
- Nothing about sync changes on Windows, web or Pi beyond the new
  clear-all control; the iCloud Sync section still does not exist there.
- Every published statement about what iCloud Sync copies is true of
  what ships (see "Copy that will need the user's approval").
- The Targets day-by-day answers, if synced (see Scope and Open
  question 1), arrive as a union: no device's saved days are lost to
  another device's copy, and a county swept on one device is not swept
  again on another within the same window.

## Scope

- The bar-chart file family joins iCloud Sync as a third synced kind
  beside the two data files: per-county file plus a per-county record
  carrying the same fields the data-file records carry (filename,
  uploaded time, origin device, byte length, sha256), so the existing
  "most recent wins, whole" reconciliation table applies per county
  unchanged.
- Deletions propagate through the same cleared-marker mechanism the data
  files use (tombstone record per county, pending clears finished at the
  next check when iCloud was unreachable).
- Adoption of pre-existing local files on the first check after the
  feature ships or after sync is turned on: they are uploaded with this
  device as origin and their manifest `uploadedAt` as the upload time.
- The local manifest (`data/barcharts.json`) gains what a record needs
  (origin, byte length, checksum) computed at add time; a synced arrival
  writes through the existing bar-chart seam methods and bumps
  `barChartFilesChanged`, never `filesChanged`, so the Targets tab
  updates and no widget hand-over or extra iCloud check is triggered.
- The bar chart section on Targets shows where the current file came
  from and its sync state, using the state vocabulary the Settings rows
  already use, with Remove confirming when sync is on.
- Settings: a clear-all-saved-bar-charts control near the bottom of the
  tab, beside Troubleshooting where that section exists and at the same
  position on platforms where it does not (the Rebuild caches control is
  Tauri-only). One confirmation on every platform (it is a bulk removal
  with no per-file view in front of the user, unlike a row Clear); the
  body says what happens with sync on. Also makes the Settings-side
  inventory question moot in the narrow sense the roadmap raised: the
  control counts and clears, it does not list.
- Remove synced files from iCloud extends to the bar-chart copies.
- The Targets day-by-day live cache (`data/county-day-obs.json`,
  `county-day-obs-v2` on web/Pi) syncs as a merged document: union by
  `(county, date)` key, a `complete` entry preferred over an incomplete
  one, the newer fetch otherwise, then the receiving device's own budget
  and eviction applied locally. This is the "sync any data possible"
  part of the idea and it is separable; see Open question 1 and Key
  Decisions for the fallback.
- Guards: invert `icloudPaths.parity.test.ts`'s exclusion block into a
  parity block for the new kind (record field names, native command
  names, the size bound, the region-code name predicate on both sides);
  update `targetsPublishedClaims.test.ts` rows that assert the
  "not part of iCloud Sync" sentences; keep `entryChunk.test.ts` green
  (the controller and native wrapper stay off the entry chunk).
- Documentation and published-copy changes listed under "Copy that will
  need the user's approval", each shown to the user before it lands.

## Out of Scope

- The county species pool cache (`county-completeness-v1`): one eBird
  call per county, a 30-day TTL, shared with the Map Explorer, and it
  lives inside `settings.json`, which the roadmap already wants moved on
  the day cache's precedent. Move it first; sync it, if ever, after.
- Any other cache, setting or preference: the `targetsCounty` selection,
  map preferences, taxonomy data and the rest stay per device.
- A Settings listing of which counties hold a bar-chart file (roadmap
  item, still deferred); the new control clears, it does not enumerate.
- Fetching bar charts for the user: eBird's histogram download still
  requires a signed-in browser session, so the add step on the first
  device is unchanged.
- Merging two devices' bar-chart files for the same county: most recent
  upload wins whole, as for the data files.
- Any change to the API-key sync, the widgets, or the Windows/web/Pi
  storage of bar-chart files beyond the clear-all control.
- Raising or lowering the existing 50 MB per-file stored-file cap.

## Key Decisions

- **Per-county records, not one manifest record, for the files.** This
  reuses the existing reconciliation table, tombstones and pending-clear
  bookkeeping verbatim per county; the change watcher's `*.record.json`
  predicate already picks them up. The key-sync record (one document,
  several slots) is the precedent for the day cache instead, because a
  cache needs a merge and a file set does not.
- **"No arbitrary size limit" reconciled with the bounded-store rules.**
  The user's wish is honored where it applies: this app imposes no count
  quota on synced bar-chart files. The bounds that remain are structural
  or pre-existing, and each is stated as such rather than as a limit:
  the county space itself (`REGION_CODE_RE` `^US-[A-Z]{2}-[0-9]{3}$`,
  a finite key set that also bounds the manifest, the record count and
  the tombstone count); the existing 50 MB per-file stored-file cap,
  which applies at add on every platform whether or not sync is on and
  is not new here; and the security rule that a native read of any file
  in the iCloud container checks it is a regular file, bounds its real
  on-disk size before reading, and verifies the record's claimed length
  and digest (`.claude/rules/security.md`, `icloud.rs`). The bar-chart
  family is a set of user files, like the two data files, not a cache,
  so the caching-layer caps, payload budgets and eviction rules in
  CLAUDE.md do not apply to it and none is added. Total container size
  is bounded by Apple's iCloud quota, not by SnowRaven.
- **Names in the container derive only from the validated region code,
  never from the user's filename.** The native side accepts a county
  key matching the region-code predicate and builds the file and record
  names from it; a name that fails the predicate is refused before any
  filesystem call. The predicate is single-sourced across TypeScript and
  Rust with a test on each side that fails when that side's enforcement
  is deleted (the twinned-limit rule).
- **Deletion semantics follow the data files exactly.** Remove with sync
  on confirms and tombstones; Replace uploads; Clear of the eBird backup
  does not touch bar-chart files (unchanged: no `clearDerived.ts` row).
  The tombstone-per-county set is bounded by the county space and is not
  cleaned up, as today.
- **Turning sync off leaves files on the device and copies in iCloud**,
  as for the data files; Remove synced files from iCloud is the way to
  empty the container, and it now covers bar charts.
- **The clear-all control confirms on every platform.** A row Clear
  with sync off is instant because the row shows exactly what goes; the
  bulk control shows nothing per file, so it confirms even locally.
- **The day cache syncs as a merged document, with a stated fallback.**
  It is included because the idea asks for it and the cost it saves is
  real (30 eBird requests per county per device). It reverses the
  Orchestrator's 1.0.39 note that the day answers "sync in neither
  build", which recorded scope at that gate rather than a user
  preference against syncing them; the later saved idea is the user's
  own words. If the Architect finds the merge cannot ride the existing
  sync machinery without endangering the file sync in this build, it is
  split off as its own follow-on with the reason written in
  `decisions.md`, and the files ship alone. The species pool is out
  either way.
- **The privacy "delete your stored files" sentence is reopened.** Its
  recorded reversal condition (DECISIONS.md, Targets tab: "a change that
  ... moves where one is removed") is met by the clear-all control in
  Settings, so the sentence is revisited with the user in this build's
  copy review rather than left standing.
- **Verification boundary.** This Mac is not signed into iCloud and
  agents never touch physical devices, so the build proves the feature
  through the existing native-wrapper fakes, the reconciliation tests,
  the parity guards and the TypeScript-Rust twin tests; real cross-device
  behavior is confirmed by the user on their own devices after the
  TestFlight build, as it was for the two data files.

## Copy that will need the user's approval

No wording is proposed here; The Designer drafts exact strings and shows
before-and-after to the user before anything is written. Each surface
below is affected because it states or implies that iCloud Sync copies
exactly two files, or that the bar-chart file stays on the device.

- **In-app iCloud turn-on note** (`icloudCopy.ts`): says what goes to
  iCloud as "the two files" and "Nothing else: your settings and caches
  stay on..."; both halves change (files, and the day cache if it ships).
- **In-app Targets bar chart section**: new origin and state text, a
  Remove confirmation when sync is on (title, body, button), and any
  state text for a file in iCloud not yet downloaded here.
- **In-app Settings**: the new clear-all control's label, its
  confirmation dialog (title, body, confirm button, with a sync-on
  variant), and the Remove synced files from iCloud description if it
  now names bar charts.
- **Screen-reader text** for the new control and any new rows.
- **docs/HELP.md**: the Targets section sentence "The file stays on this
  device and is not part of iCloud Sync, so add it on each device where
  you want eBird's frequencies"; the iCloud Sync section's "your eBird
  backup and your Macaulay Library export are kept the same", "the two
  files", "Your settings and caches are never synced", the rows and
  states paragraph, "Clearing a file with sync on", and the Remove
  synced files paragraph; the Troubleshooting or nearby section for the
  new control.
- **PRIVACY_POLICY.md** (mirrored in `website/privacy.html`): line 13
  ("copies the two data files"); line 32 (the bar-chart file "is not part
  of iCloud Sync"); the iCloud section ("keep your two data files the
  same", "writes your eBird backup and your Macaulay Library export",
  "cached lookups stay on each device and are never synced"); and the
  "delete your stored files ... from the Settings tab" sentence, whose
  reversal condition this build meets.
- **README.md** and **website/index.html**: the privacy paragraph
  ("Your eBird backup, Macaulay Library export and API keys are stored
  only on your device unless you turn on iCloud syncing"), which is
  incomplete once a third file kind syncs.
- **appstore/LISTING.md** and App Store Connect: the same privacy
  paragraph, and the review-notes sentence "copies the user's two data
  files"; TestFlight and App Store release notes for the version.
- **ACCESSIBILITY.md**: only if the new control or rows add a documented
  interaction; likely no change, to be confirmed.
- **CHANGELOG.md**: the release entry.

## Open questions for the user

1. **Should the Targets day-by-day live cache sync too?** The saved idea
   says "sync any data possible to avoid re-doing work and ebird api
   downloads"; the 1.0.39 record says those answers "sync in neither
   build". Recommended: yes, as a merged document (union by county and
   day), separable from the file sync and dropped to a follow-on with a
   written reason if it threatens this build. The species pool stays out.
2. **Should the clear-all control confirm when sync is off?** House
   pattern makes a row Clear instant with sync off. Recommended: confirm
   always, because the bulk control shows no per-file view.
3. **The privacy "delete your stored files ... from the Settings tab"
   sentence.** Its recorded reversal condition is met. Recommended:
   revisit it in this build's copy review alongside the other privacy
   changes rather than leave it.
