# Decisions: icloud-sync

## Stage 4, The Designer (2026-09-01)

Design approved as the first revision with no changes requested. The four
open items were resolved with the defaults below.

- **"Last checked" is plain text, not a live region.** The contract asked for
  a polite live region on the status line, but the five-minute visible poll
  would then announce a new time every five minutes while Settings is open.
  Only a user-pressed Check now announces its result, once, through an
  always-mounted sr-only `role="status"` announcer beside the text; the
  per-row state lines stay live because a state change is a real event.
- **Peer-device naming collapses when the label is the platform word.** "From
  iPhone", never "From iPhone (iPhone)"; the parenthetical stays wherever it
  adds information ("From Dave's Mac (Mac)"). A deliberate refinement of
  FR-23's literal "<label> (<platform>)" shape: iOS 16+ reports the generic
  device name, so the literal form would say nothing twice on every iPhone
  and iPad. One helper names a device everywhere, including the FR-25 line.
- **Clear with sync off stays today's instant local clear, no confirmation.**
  The contract left this to the Designer; adding a dialog to a path whose
  behavior and copy are unchanged would be a new interruption for the
  Windows, web and Pi users who cannot sync at all. The confirmation exists
  only on the sync-on path, where the action reaches other devices.
- **Confirm-button labels: "Clear from all synced devices" and "Remove from
  iCloud".** Shorter forms ("Clear everywhere") read punchier but overclaim,
  since devices with sync off keep their copy; the chosen labels name exactly
  the consequence, and the 44px phone posture lets them wrap.
- **Section register: header as the switch's label, no row title.** The
  uppercase section header is the switch's accessible name
  (`aria-labelledby`), so "iCloud Sync" is not printed twice and the section
  stays in the tab's quiet register (no icon tile, no title, one sentence
  beside a bare switch), consistent with Troubleshooting and Acknowledgments.
- **Rows are silent until sync has been on once; "Sync off" appears only when
  iCloud holds something.** A never-enabled install shows today's rows
  unchanged, so the feature is not announced on every file row; after turning
  off, "Sync off" tells the user copies remain in iCloud. FR-32's "rows shall
  read Sync off" is satisfied on the path it describes.
- **The FR-25 line replaces the provenance fragment while set** rather than
  sitting beside it: "Replaced by the file from iPhone, uploaded <time>"
  already carries the origin, and "From iPhone · Replaced by the file from
  iPhone" would say it twice.
- **The Remove confirmation says a syncing device re-uploads at its next
  check.** True by FR-14/FR-33, and without it the button reads as a purge it
  is not; the sentence tells the user to turn sync off first if they want
  iCloud empty.
- **One new token, `--sr-scrim`** (ink at alpha, both themes) for the modal
  backdrop, instead of another inline `rgba(0,0,0,...)` literal: the rules
  file wants colors through tokens and the doctrine wants tinted neutrals.

## Stage 5, The Engineer (2026-09-01)

Built to the schema and the approved design; the deviations and choices below
are the ones a reviewer should know about.

- **Change detection shipped as designed: NSMetadataQuery primary, poll as
  fallback.** The query watches only `*.record.json` in the ubiquitous
  documents scope (batching 1 s) and emits `icloud-changed`; a second
  observer emits `icloud-identity-changed`. The controller also checks on
  boot, foreground/focus, a 5-minute visible poll, and a local file save.
  Whether updates arrive inside a Tauri process on a device (V6) is a Tester
  item; correctness never depends on it.
- **No capability entries for the eight commands.** App-defined commands in
  this project are invoked without permission grants (precedent:
  `get_location`, `get_timezone`), so the capability files are untouched and
  the fs scope stays `$APPLOCALDATA/**` as the schema requires.
- **`objc2-ui-kit` lives in its own `cfg(target_os = "ios")` block**, not the
  android|ios mobile block the schema named: it is an Apple-vendor crate with
  no meaning on Android, and the cfg rule is about where a crate is real.
- **The `icloud-sync` settings object carries two extra fields** beyond the
  schema's four (`knownShared`, `pendingClears`), both inside the same object
  and saved by the same single link. `knownShared` is what lets a relaunch
  with sync off render "Sync off" and offer Remove without reading iCloud
  (FR-07 forbids reads while off); `pendingClears` finishes a synced clear
  whose marker could not be pushed, instead of pulling the cleared file back
  down on the next check (a newer shared file supersedes it, FR-31).
- **`sharedExists` counts file records only.** A lone cleared marker does not
  offer "Remove synced files from iCloud" (there is no file to name in the
  confirmation); Remove itself still deletes all four container files.
- **A re-pushed file keeps its original origin.** A file this device pulled
  from a peer and later pushes again (after a Remove) is recorded with the
  peer as origin, so "From <device>" stays true rather than claiming the file
  as this device's.
- **A `download` decision starts the download and waits up to 5 s** before
  leaving the row at "In iCloud, not downloaded here" with Download now
  (which waits up to 90 s). The wait is bounded by attempts, not by a clock,
  so the bound holds under any injected clock.
- **FR-34's "network cache" is not cleared on a synced clear** (schema
  decision 9): sync runs exactly the set Settings runs today.
- **Two touches to the existing rows**, both from the design spec: the
  filename line wraps (class `.sr-file-line`, the Saved span drops nowrap),
  and the existing Upload/Import and Clear buttons take `.sr-touch-target`
  (phone tier only; desktop byte-identical).
- **The release overlay is a committed file** (`src-tauri/tauri.icloud.conf.json`)
  whose `files` source is the gitignored `src-tauri/embedded.provisionprofile`
  that `release.sh` copies in and removes on every exit path, rather than an
  inline JSON overlay carrying an absolute path: the overlay's relative paths
  resolve exactly like the committed `entitlements` do, and the committed
  file is reviewable. `--config` is passed as an absolute path.
- **The privacy parity test now pins 13 sections** and asserts the four
  required statements of the new `## iCloud Sync` section on both sides.
- **`mapFabCascade.test.ts` names `sr-dlg-actions` as a never-a-FAB
  ancestor**, the guard's own sanctioned way to resolve an ancestor-scoped
  competitor; a dialog panel never wraps a map.
- **Calendar's inline scrim was left as is** (the spec marked re-pointing it
  to `--sr-scrim` optional); the new token is used by the shared dialog shell.

## QA round 1 fixes, The Engineer (2026-09-01)

- **Dotted plist keys are read with PlistBuddy, never `plutil -extract`.**
  `plutil` treats every dot in a key path as a separator, so
  `Entitlements.com.apple.application-identifier` resolves to nothing and a
  `|| true` turned that into a false "different App ID" abort on the correct
  profile. Both dotted entitlement keys (the application identifier and the
  container list) now go through `/usr/libexec/PlistBuddy -c 'Print
  :Entitlements:...'`; `ExpirationDate` is top-level and stays on `plutil`,
  with its ISO 8601 UTC output asserted by regex before the string comparison.
  The exact block was run against the real profile before hand-back, which is
  the check that would have caught this the first time.
- **The state label wraps on the phone tier.** `white-space: normal` and
  `align-items: flex-start` on `.sr-sync-state` inside the ≤640 block, the
  glyph nudged 0.2em to the first line and kept at `flex-shrink: 0`; desktop
  keeps nowrap. Re-measured in both engines for every label with the three
  longest detail fragments, not the fixture's.
- **FR-05 is now backed by the ubiquity upload flags.** `uploaded` means both
  the csv AND its record report `NSURLUbiquitousItemIsUploadedKey` (the record
  is the commit point a peer reads); an item without ubiquity metadata reads
  as uploaded so a row can never be trapped in "Waiting to upload" by a
  missing key, and an older native layer that omits the field is read the
  same way. The row settles to "Up to date" on the next trigger's read.
- **The NFR-04 budget covers the reads, deliberately not the transfers.** One
  10 s deadline per check races the status probe, the record reads and the
  in-check download wait; a hanging pull is never cut short, because a raced
  `applySyncedFile` whose native pull finishes later would leave the csv and
  the metadata disagreeing. First read never answered: keep the last state
  (FR-05). Answered once, then out of budget: the undecided rows read "Could
  not sync" with the timeout reason and Retry, and the last check time is
  kept.

## Security round fixes, The Engineer (2026-09-01)

The Auditor passed the build with one Medium and four Low defence-in-depth
gaps in the native layer plus two wording items; all are closed.

- **The container and the local data dir are untrusted at the file-type
  level, not only at the record level.** Every read, status and delete in
  `icloud.rs` goes through `symlink_metadata`: only a regular file is opened,
  a symlink at an item's name is deleted as a link and never followed, a
  directory is refused, and a record file over 16 KB is not read at all. A
  csv's on-disk length is bounded (200 MB, and equal to the record's claim)
  BEFORE the bytes are loaded, on both the pull and the push side, so a
  multi-gigabyte container file can no longer be read into memory (the
  jetsam case on iOS).
- **Both write chokepoints sanitize to the validator's exact bounds.** Rust
  (`sanitize_label` / `sanitize_filename`: C0/C1/DEL and path separators
  stripped, surrogate-safe truncation to 64 / 255 UTF-16 code units, a
  platform-word fallback) and TypeScript (`sanitizeLabel` /
  `sanitizeFilename` in `icloudRecord.ts`, applied in the controller) agree,
  and the parity test pins the bounds. The point is idempotence as much as
  safety: a record a device writes that its own validator would reject would
  be re-pushed on every check.
- **The device id is validated where it becomes a path**, at the Rust command
  boundary (`valid_device_id`, a byte scan, typed `unknown` on a miss), and
  `readMeta` drops a malformed `origin` so the seam never hands one out: the
  v1.0.5 "validate at the chokepoint" rule applied to the read side of a
  document the app does not solely author.
- **Staging is cleaned.** A push clears this device's stale `.tmp/` entries
  before staging; Remove clears the whole staging directory and counts the
  entries, so "deletes the copies in your iCloud account" is exact even after
  a crash between a staging write and its rename.
- **Wording:** the enable note, HELP and both policy pages now name the
  device's name, and the file's size and checksum, among the stored details;
  HELP also notes that sync follows whichever Apple ID the device is signed
  in to (Finding 8, accepted behavior).
- **The release preflight decodes to a mktemp path** removed by the one EXIT
  trap, which now lives in the config section and covers the profile copy
  too.
- **Deploy (2026-09-01, Deployer): iOS export retried once with the metadata-capable ASC key, then the ship was stopped before any leg published.** The `tauri ios build --export-method app-store-connect` export failed because the Xcode-managed profile "iOS Team Store Provisioning Profile: com.dtgibson.snowraven" predates the App ID's iCloud capability, and Xcode's automatic repair was refused (`FORBIDDEN_ERROR` 7495, "You haven't been given access to cloud-managed distribution certificates") with the upload key `BVVLBRRVL6` and again with `QJA25M7XHM`. Neither retry uploaded anything. Per the brief's contingency the release stopped at step 1 (no `release.sh`, no GitHub release, no TestFlight upload); the tag `v1.0.11` stays at `bed6739` and the tree was restored to clean (the build's `Info.plist` stamp reverted, since the next build re-stamps it). Remedy is the account holder's: either grant an API key "Access to Cloud Managed Distribution Certificate" in App Store Connect (Users and Access, Integrations, Keys) so the recipe self-heals, or regenerate the App Store profile for `com.dtgibson.snowraven` with iCloud (Xcode signed in as the account holder, or the portal), then resume the Deployer from step 1.
