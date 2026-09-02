# Design Spec: iCloud Sync

**Status: Approved** (2026-09-01), first revision, no changes requested
("This all sounds good. Lets build it"). Mockup: `pipeline/icloud-sync/design.html`
(state strip, Mac / iPhone 390 / 320px, both themes, 200% text). Contract:
`schema.md`, section "Settings UI contract (for The Designer)". Requirements:
`prd.md` FR-08, FR-23 to FR-33, NFR-01 to NFR-03.

## Visual Direction

Quiet utility in the Settings tab's quiet register: the feature reads as two
small additions to what is already there, never as an announcement. The
Default Files rows keep their exact markup and gain one muted line each; the
new iCloud Sync section below them is a header, a one-sentence explanation
beside a bare switch, a status row, and a Remove row that exists only when
iCloud holds something. No icon tile, no illustration, no marketing tone. The
accent appears in the section exactly where it already means "active or
actionable" elsewhere: the switch's on state and the enable note's Turn on
button. State is always text; a small Lucide glyph and, for the one failure
state, `--sr-error`, are reinforcement only.

## Screens / Views

### Settings tab, Default Files rows (macOS and iOS, only while `showICloudSync()`)

Existing `FileRow` markup is unchanged: icon tile, title, filename + "Saved
<formatUploadDate>" line, trailing Upload/Import + Clear buttons, the
`role="alert"` error box. `FileRow` gains `sync?: SlotView`, `onDownloadNow`,
`onRetry`.

**Sync line** (new, rendered inside the row's text column directly under the
filename line; on rows with no local copy, directly under the sublabel):

- Element: `<div role="status">` (polite by default), ALWAYS rendered when the
  gate is true, empty when `sync` is undefined or the slot has no view. Its
  children are replaced on change; the element itself never unmounts and is
  never `display: none` (house live-region posture; see Interaction Notes).
- Layout: `display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px;
  margin-top: 5px` (margin 0 when empty); `font-size: 0.75rem; line-height:
  1.45; color: var(--sr-text-muted)`. Lift the flex/gap/wrap to a class
  (`.sr-sync-line`), colors and margins may stay inline per `.claude/rules/ui.md`.
- Content, in order:
  1. State label: `<span>` inline-flex, gap 5, `font-weight: 600`,
     `color: var(--sr-text-muted)` (`var(--sr-error)` for Could not sync),
     `white-space: nowrap`, containing a 13px Lucide glyph (`strokeWidth 2.2`,
     `aria-hidden`) then the label text.
  2. A visually hidden full stop `<span class="sr-only">. </span>` so a screen
     reader gets a pause between label and provenance.
  3. Provenance / detail: `<span>` beginning with an `aria-hidden` middot
     (`·`, `color: var(--sr-text-disabled)`) followed by a space and the text.
     The middot lives INSIDE this span so a wrapped line never ends on a
     dangling dot.
  4. Action button (two states only): the quiet bordered register at inline
     size (`height 26px; padding 0 9px; font-size 0.71875rem`), a real
     `<button tabIndex={0}>`.

**The eight states** (`SlotView.state` to row content). Labels are the
contract's exact words:

| state | label | glyph (lucide) | detail fragment | action |
|---|---|---|---|---|
| `up-to-date` | Up to date | CloudCheck (cloud + check) | provenance, or the FR-25 line while `replacedAt` is set | none |
| `uploading` | Syncing, uploading | CloudUpload | provenance | none |
| `downloading` | Syncing, downloading | CloudDownload | provenance with time | none |
| `in-icloud-not-downloaded` | In iCloud, not downloaded here | CloudDownload | provenance with time | **Download now** |
| `waiting-to-upload` | Waiting to upload | CloudUpload | provenance | none |
| `unavailable` | iCloud unavailable | CloudOff | provenance | none |
| `off` | Sync off | CloudOff | none | none |
| `error` | Could not sync | CircleAlert (label in `--sr-error`) | `reason` (one sentence) | **Retry** |

If the installed lucide-react lacks `CloudCheck`, draw the cloud path with an
inline check as the mockup does; do not substitute a plain check.

**Provenance rule** (one helper, used everywhere a device is named):

- `devName(origin)` = `label`, plus ` (Mac)` / ` (iPhone)` / ` (iPad)` from
  `platform`, EXCEPT when `label` already equals that platform word (iOS 16+
  reports the generic "iPhone"/"iPad"), in which case the parenthetical is
  dropped: "Dave's Mac (Mac)", "Kestrel (Mac)", "iPhone", "iPad".
- Provenance: `From this device` when `fromThisDevice`, else `From <devName>`.
- Provenance with time (downloading, not downloaded): `From <devName>,
  uploaded <formatUploadDate(uploadedAt)>`; the time is the SHARED file's
  upload time, which differs from the row's "Saved" time.
- FR-25 line (`replacedAt` set): `Replaced by the file from <devName>,
  uploaded <formatUploadDate(replacedAt)>`. It TAKES THE PLACE of the
  provenance fragment while set (same origin plus the event; never both).
  Cleared by the next user action on that row or the next replacement.
- Label and filename strings from a shared record render as React children
  only (auto-escaped), never in a path or href (FR-38).

**Rows with no sync view** (sync never enabled on this install, or a
non-Apple platform): byte-identical to today; no empty line, no extra margin.

**No local copy but a file in iCloud** (FR-27 second clause): the row keeps
today's "No file saved" pill, sublabel, neutral tile and disabled Clear, and
the sync line reads `In iCloud, not downloaded here · From <devName>, uploaded
<time>` with Download now. After the download the row becomes a normal
populated row with the FR-25 line.

**File-meta wrap note for `FileRow`:** today's "· Saved <date>" span is
`white-space: nowrap` inside a non-wrapping flex line; at 320px and 200% text
scale it clips under the card's `overflow: hidden`. While in `FileRow`, let
the filename line wrap (`flex-wrap: wrap; gap: 2px 6px`, keep the filename's
200px `max-width` + ellipsis, drop `nowrap` from the Saved span). The mockup
does this and the sync line relies on the same column being allowed to wrap.

### Settings tab, iCloud Sync section (only while `showICloudSync()`)

Placement: after the Default Files card and its "Files are stored in this
app's local data directory..." note (which keeps `marginBottom: 24`), before
Default Location. Gated markup, not hidden markup (QA-01). No section below
moves.

- `<SectionHeader label="iCloud Sync" />`, with the label `<span>` given an id
  (`useId`) because it is the switch's accessible name. Extend `SectionHeader`
  with an optional `id` prop rather than duplicating it.
- Card: `1px solid var(--sr-border)`, radius 10, `var(--sr-surface)`,
  `overflow: hidden`, `marginBottom: 24`. Rows `padding: 14px 16px`,
  separated by `1px solid var(--sr-border-subtle)`.

**Toggle row** (`display: flex; align-items: center; justify-content:
space-between; gap: 12px`; the switch stays trailing at every width):

- Text column (`flex: 1; min-width: 0`):
  - Description `<p>`: `0.8125rem`, `var(--sr-text-muted)`, line-height 1.5,
    margin 0: "Keeps your eBird backup and ML export the same on every Mac,
    iPhone and iPad signed in to your iCloud account."
  - Availability note `<p>` (only when `availability !== 'available'`):
    `0.75rem`, `var(--sr-text)` (the instruction outranks the muted
    description), line-height 1.5, `margin: 6px 0 0`. Text per
    `availability` (exact contract strings):
    - `not-signed-in`: "Sign in to iCloud in System Settings (or Settings on iPhone and iPad) to use sync."
    - `drive-off-or-unauthorized`: "Allow SnowRaven under iCloud Drive in the system settings. If it is already allowed, this build cannot use iCloud."
    - `build-cannot-use-icloud`: "This build cannot use iCloud."
    - `unknown` (before the controller loads): no note, switch disabled.
- Switch: the shared `ToggleSwitch` with `bare`, `labelVisible={false}`,
  `label="iCloud Sync"`; additionally `aria-labelledby={headerId}` and
  `aria-describedby="{descId} {noteId}"` (if `ToggleSwitch` cannot take these,
  add optional `labelledBy` / `describedBy` props; do not fork the component).
  `checked = syncEnabled`; `disabled = availability !== 'available'`. When
  disabled it stays visible and keeps its checked state (the "iCloud
  unavailable" case shows an ON switch that cannot be operated, with the note).

**Status row** (`display: flex; align-items: center; justify-content:
space-between; flex-wrap: wrap; gap: 8px 12px`):

- Rendered with content only when `syncEnabled || lastCheckAt !== null`.
  When neither holds, the row collapses (`padding: 0; border-top: 0`) but its
  elements remain mounted so the announcer region below is stable.
- Status text `<span>` (`0.75rem`, `var(--sr-text-muted)`, line-height 1.45),
  PLAIN TEXT, not a live region: `Last checked <formatUploadDate(lastCheckAt)>`,
  or `Never checked` when `lastCheckAt` is null.
- Announcer: an always-mounted `<span className="sr-only" role="status">`
  beside the status text, written ONLY after a user-pressed Check now (see
  Interaction Notes).
- Check now: quiet bordered button (32px register), shown only when
  `syncEnabled && availability === 'available'`. While a user-pressed check is
  in flight: label `Checking…`, `disabled`, `aria-busy="true"`, opacity 0.65.

**Remove row**: shown only when `availability === 'available' && sharedExists`,
regardless of the toggle. One quiet bordered button, "Remove synced files
from iCloud". No note in the row; the confirmation carries the detail.

No footnote below the card (the description and the enable note already say
whose account it is).

### Enable note (dialog, opens on switching the toggle on)

- Title: "Turn on iCloud Sync".
- Body: four items, each a lead-in line (`0.8125rem/600`, `var(--sr-text)`,
  margin-bottom 2) over one paragraph (`0.8125rem`, `var(--sr-text-muted)`,
  line-height 1.55), items 12px apart. `<here>` is "this Mac" / "this iPhone"
  / "this iPad" from the state's `platform`.
  1. **What goes to iCloud.** "Your eBird backup and your Macaulay Library export, along with each file's name, when it was uploaded, which device it came from (its name), its size and a checksum. Nothing else: your API keys, settings and caches stay on <here>." (Security round wording: "(its name), its size and a checksum" added so the stored details are complete.)
  2. **Whose account.** "Your own iCloud account, on Apple's servers. SnowRaven has no server of its own, so the files never pass through one, and the developer cannot see them."
  3. **What happens now.** "If iCloud already holds a newer copy of a file, it replaces the copy on <here>. If the copy here is newer, it goes up to iCloud."
  4. **Turning it off.** "Switch iCloud Sync off at any time; the files on <here> stay put. To delete the copies in iCloud, use Remove synced files from iCloud."
- Actions, right-aligned: **Cancel** (quiet bordered) then **Turn on**
  (accent-filled: `var(--sr-accent)` fill, `var(--sr-on-accent)` text,
  `0.75rem/600`, radius 6, the Default Location Save register). Initial focus:
  Turn on. Cancel, Escape and backdrop leave sync off and write nothing.

### Remove synced files from iCloud (confirmation)

- Title: "Remove synced files from iCloud?"
- Body: "These files will be deleted from your iCloud account:" then a
  bulleted list of the filenames from the shared records present
  (`0.8125rem`, `var(--sr-text)`, `overflow-wrap: anywhere`), then "The
  copies on <here> and on your other devices are not touched. To keep iCloud
  empty, turn iCloud Sync off on each device first: a device with sync on
  uploads its copy again at its next check."
- Actions: **Cancel** (quiet, initial focus) then **Remove from iCloud**
  (destructive: the row's Clear register, `var(--sr-error-border)` border,
  `var(--sr-error)` text, `var(--sr-surface)` fill, hover `var(--sr-error-bg)`).

### Clear with sync on (confirmation, opens from a row's Clear)

- Title: "Clear eBird Backup?" / "Clear ML Export?" (the row's title).
- Body: "<filename> will be removed from <here> and from iCloud. Every Mac,
  iPhone and iPad with iCloud Sync on removes its copy at its next check.
  Devices with sync off keep theirs." (filename in `var(--sr-text)`, 600.)
- Actions: **Cancel** (quiet, initial focus) then **Clear from all synced
  devices** (destructive register as above).
- With sync off, Clear is today's instant local clear, no dialog.

### Dialog shell (all three)

The Calendar day-details shape: a `position: fixed; inset: 0` overlay
(`role="presentation"`, z-index above the tab, scrim `var(--sr-scrim)`, see
Tokens) centering a panel `width: calc(100% - 32px); max-width: 420px;
max-height: 80vh; overflow: auto`, `var(--sr-surface)`, `1px solid
var(--sr-border)`, radius 14, `var(--sr-card-shadow)`. Header `padding: 16px
18px 12px` with a `1rem/700, letter-spacing -0.01em` title and a
`var(--sr-border-subtle)` bottom rule; body `padding: 14px 18px 4px`; actions
`padding: 8px 18px 16px`, flex, gap 8, right-aligned, each button `min-width:
96px`. On the phone tiers the buttons stack full width (`flex: 1 1 100%`,
44px posture) and the panel is `calc(100% - 24px)` wide. The panel's
`transform-origin` is set from the triggering control (Motion Spec).

### Phone tiers (iPhone 390, 320px) and 200% text scale

- Rows stack via the shipped `.sr-action-row-stack` (<=480) and buttons take
  `.sr-touch-target` (<=640, `min-height: 2.75rem`, `height: auto`,
  `white-space: normal`); this covers Upload/Import, Clear, Check now, Remove,
  the dialog buttons, and the inline Download now / Retry, which at <=640 also
  take `flex: 1 1 100%` so they drop to their own full-width line under the
  state text.
- Check now takes `flex: 1 1 100%` at <=640 (full width under the status
  text); Remove is `width: 100%` at <=640.
- The switch stays trailing beside the wrapped description at every width.
- iOS keeps the "Import" wording through `fileRowButtonLabel` (unchanged).
- Verified in the mockup in Chromium and WebKit: no horizontal overflow at
  320px and 390px, 100% and 200%, across all sixteen states, both themes.

## Component Usage

- `SectionHeader` (Settings.tsx, add optional `id` prop for the label span).
- `FileRow` (Settings.tsx): new `sync`, `onDownloadNow`, `onRetry` props; the
  sync line; the filename-line wrap fix above.
- `ToggleSwitch` (`components/ui/ToggleSwitch.tsx`) `bare`, label hidden,
  plus `aria-labelledby` / `aria-describedby` wiring.
- Quiet bordered button (Rebuild caches / Replace register): Check now, Remove
  synced files from iCloud, Cancel, and the inline-size Download now / Retry.
- Accent-filled button (Default Location Save register): Turn on only.
- Destructive button (the row's Clear register): Remove from iCloud, Clear
  from all synced devices.
- Dialog: the Calendar `DayDetails` overlay shape (focus trap, Escape,
  backdrop). Extract its trap/Escape effect into a small shared hook if it is
  reused three times here; do not add a dialog library.
- Lucide: `CloudCheck` (or cloud + check), `CloudDownload`, `CloudUpload`,
  `CloudOff`, `CircleAlert`, 13px, strokeWidth 2.2, `aria-hidden`.
- Reads `useICloudState()` (entry-safe) and calls `actions.*`; nothing in
  Settings.tsx imports the controller or `@tauri-apps/api` (entry-chunk rule).

## Design Tokens Applied

All existing, both themes: `--sr-surface`, `--sr-surface-subtle`,
`--sr-border`, `--sr-border-subtle`, `--sr-border-medium`, `--sr-text`,
`--sr-text-muted`, `--sr-text-disabled`, `--sr-accent`, `--sr-accent-strong`,
`--sr-accent-bg`, `--sr-accent-bg-hover`, `--sr-accent-border`,
`--sr-on-accent`, `--sr-error`, `--sr-error-bg`, `--sr-error-border`,
`--sr-gray-400`, `--sr-switch-thumb`, `--sr-switch-thumb-shadow`,
`--sr-card-shadow`, and the global focus ring.

**One new token: `--sr-scrim`**, the modal backdrop, the app's own ink at an
alpha and never pure black: light `rgba(15,17,23,0.36)`, dark
`rgba(9,9,11,0.6)`. Add to both theme blocks in `globals.css` before use and
record it in `pipeline/design-system.md` (Calendar's inline `rgba(0,0,0,0.32)`
overlay may be re-pointed to it in the same change; optional).

No new type sizes: 0.84375/600 row titles, 0.8125 descriptions and dialog
body, 0.75 status and sync lines, 0.71875 inline buttons, 0.6875 header, 1rem/700
dialog titles.

## Interaction Notes

- **Gate:** the section and every row addition render only when
  `showICloudSync()`; no hidden markup elsewhere.
- **Switch:** on click while off and available, open the enable note; the
  switch stays `aria-checked="false"` until Turn on. On click while on, turn
  off immediately (FR-32): no confirmation, local files untouched, rows read
  "Sync off" if `sharedExists`, otherwise the rows show no sync line, Check
  now hides, Remove stays if iCloud still holds files.
- **Rows before sync has ever been on:** no sync line at all. "Sync off"
  appears only when shared records exist (turned off here, or another device
  syncs); a never-enabled install is byte-identical to today.
- **Row status regions (live):** each row's sync line is `role="status"`,
  mounted whenever the gate is true, children replaced on change. A state
  change (downloading, up to date, could not sync, replaced) is therefore
  announced once. Do not add `aria-live` anywhere else in the rows.
- **Last checked (resolved open item 1):** the "Last checked" text is PLAIN
  TEXT, not a live region; the five-minute poll would otherwise announce a new
  time every five minutes while Settings is open. Only a user-pressed Check
  now announces, once, through the always-mounted sr-only `role="status"`
  announcer beside it: `Checked <time>. Nothing to transfer.` when the check
  changed nothing; `Checked <time>.` when it transferred (the row regions
  announce what changed); `Could not reach iCloud.` on offline/timeout. On
  that failure also append " Could not reach iCloud." to the visible status
  text (same muted span) until the next successful check, so the press is
  never silent. The announcer text includes the time so repeated presses
  re-announce.
- **Peer-device naming (resolved open item 2):** keep the collapse: "From
  iPhone", never "From iPhone (iPhone)"; the parenthetical appears only when
  the label is not already the platform word. A deliberate refinement of
  FR-23's literal "<label> (<platform>)"; the platform is still shown wherever
  it adds information.
- **Clear with sync off (resolved open item 3):** today's instant local
  clear, no confirmation, unchanged copy. The confirmation exists only on the
  sync-on path, which routes through `actions.clearWithSync(slot)`.
- **Confirm-button labels (resolved open item 4):** "Clear from all synced
  devices" and "Remove from iCloud" as written; shorter forms ("Clear
  everywhere") overclaim, since devices with sync off keep their copy.
- **Dialogs:** `role="dialog" aria-modal="true" aria-labelledby={titleId}`;
  Tab and Shift+Tab wrap inside the panel (re-query focusables per keydown, as
  Calendar does); Escape and a backdrop mousedown cancel; on close, focus
  returns to the control that opened the dialog. After a confirmed Clear the
  row's Clear is disabled, so focus goes to that row's Upload/Import button
  instead. After a confirmed Remove, focus returns to the Remove button if it
  is still rendered, else to the switch.
- **Download now / Retry:** set the row to `downloading` immediately (the line
  cross-fades), then on success the row shows `up-to-date` with the FR-25 line
  and the "Saved" time becomes the shared file's upload time; on failure the
  row shows `error` with the mapped reason and Retry.
- **Reason copy for Could not sync** (map the closed `ICloudError` union; one
  sentence, no Apple error text): `mismatch` "The file in iCloud did not
  download completely."; `timeout` "iCloud did not respond in time.";
  `absent` "The file is no longer in iCloud."; size bound exceeded "The file
  in iCloud is larger than 200 MB."; `local-missing` "The file on this device
  could not be read."; anything else "iCloud could not be read."
- **Keyboard:** every control is a real `<button>` with `tabIndex={0}`
  (house rule) and the global focus ring; the disabled switch is not
  focusable, and its note sits next in reading order and is wired through
  `aria-describedby`.
- **Idempotence of rendering:** the sync-line element, the status text span
  and the announcer are stable elements whose text changes; never remount them
  per state (WKWebView live-region reliability).

## Motion Spec

- Enable note / confirmations open: panel opacity 0 to 1 (160ms ease-out) +
  scale 0.94 to 1 (180ms, `cubic-bezier(0.2, 0, 0, 1)`), `transform-origin`
  set to the center of the triggering control (switch, Remove button, or the
  row's Clear) in the panel's coordinate space; scrim opacity 0 to 1 (160ms
  ease-out). Reduced motion: 0.01s. Lib: CSS.
- Dialog close: the reverse at 120ms ease-out; unmount after `transitionend`
  (or a 130ms fallback timer). Reduced motion: immediate. Lib: CSS.
- Sync-line state change: cross-fade, opacity 1 to 0 (120ms ease-out), swap
  children, 0 to 1 (160ms ease-out); no transform. The first fill and the
  clear to empty are instant. Reduced motion: instant swap. Lib: CSS.
- Switch: the shipped `ToggleSwitch` 180ms ease-out track/knob transitions,
  unchanged; disabled state opacity 150ms ease-out.
- Buttons: border/background/color 120ms ease-out (the tab's shipped
  treatment). Icon tile background/color 160ms ease-out when a row gains or
  loses a file.
- Nothing animates on mount; no pulse on "Syncing" states (the label carries
  it); no stagger; no hover scale.

## Content Notes

Voice: plain, warm, specific; the section says as little as it can. No em
dash (U+2014) anywhere. Exact strings (the complete set):

- Section header: `iCloud Sync`
- Description: `Keeps your eBird backup and ML export the same on every Mac, iPhone and iPad signed in to your iCloud account.`
- Availability notes: the three contract strings quoted under Toggle row.
- Status: `Last checked <time>` / `Never checked`; failure suffix `Could not reach iCloud.`
- Announcer: `Checked <time>. Nothing to transfer.` / `Checked <time>.` / `Could not reach iCloud.`
- Buttons: `Check now`, `Checking…`, `Remove synced files from iCloud`,
  `Download now`, `Retry`, `Cancel`, `Turn on`, `Remove from iCloud`,
  `Clear from all synced devices`, `Clear` (row, unchanged),
  Upload/Import labels unchanged via `fileRowButtonLabel`.
- Row state labels: `Up to date`, `Syncing, uploading`, `Syncing, downloading`,
  `In iCloud, not downloaded here`, `Waiting to upload`, `iCloud unavailable`,
  `Sync off`, `Could not sync`.
- Provenance: `From this device`, `From <devName>`, `From <devName>, uploaded <time>`,
  `Replaced by the file from <devName>, uploaded <time>`.
- Dialog titles and bodies: as quoted in their sections above.
- Times: always `formatUploadDate` (the row's existing month-first + local
  time form, honoring the user's date-format preference).
- Fixture content used in the mockup (for tests and screenshots):
  `MyEBirdData.csv` saved Aug 24, 2026 at 3:12 PM; `ML_2026-08-24_dave.csv`
  saved Aug 24, 2026 at 3:20 PM; devices "Dave's Mac" (mac), "iPhone",
  "iPad"; last checked Sep 1, 2026 at 9:14 AM; newer shared file uploaded
  Sep 1, 2026 at 8:02 AM.
