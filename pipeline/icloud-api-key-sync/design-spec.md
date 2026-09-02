# Design Spec: iCloud API Key Sync

**Status: Draft, first design direction** (2026-09-01). Mockup:
`pipeline/icloud-api-key-sync/design.html` (state strip of sixteen states,
Mac / 641px / 320px widths, both themes, 100% and 200% text). Contract:
`schema.md`, sections "Settings contract (for The Designer, Stage 4)" and
"In-memory store and actions". Requirements: `prd.md` FR-01 to FR-08, FR-28
to FR-47, NFR-02 to NFR-05. Extends the shipped 1.0.11 design
(`pipeline/icloud-sync/design-spec.md`); everything not named here is
unchanged from it. Designed within `pipeline/design-system.md`; no deviation,
so there is no `decisions.md` for this stage.

Measured in headless Chromium at 320px and 641px, 200% text, across all
sixteen states, both themes: no element leaves the frame, and every dialog
fits its panel with internal scroll. The longest line (state 16, a 64-code-unit
device label with no spaces, in the FR-41 sentence) wraps inside the row.

## Visual Direction

The shipped iCloud Sync section grown by one switch, never a new section.
Same quiet register: the uppercase header, one card, muted description beside
a bare switch, plain-text state. The key switch is a sub-option of that card,
with a short bold label so it has a name of its own, off by default, and while
it cannot be operated it says why in one line. The API Keys rows keep their
exact presentation and gain the same one muted line the Default Files rows
gained in 1.0.11: a small glyph, the state as text, then where the key came
from and when. The accent appears only where it already means "active or
actionable": the switch's on state and the note's Turn on. The one failure
state uses `--sr-error`, as reinforcement of text, never alone.

The note before turn-on is the focal moment. It is the shipped dialog shell
carrying six short leads in the app's plain voice, saying exactly what iCloud
provides and no more, and closing with one quiet promise: nothing is written
until Turn on.

Windows, web and Pi builds render none of this: no switch, no note, no key-row
line, no Remove control (FR-45). Gated markup, never hidden markup.

## Screens / Views

### Settings tab, iCloud Sync section (macOS and iOS, only while `showICloudSync()`)

Card as shipped: `1px solid var(--sr-border)`, radius 10, `var(--sr-surface)`,
`overflow: hidden`, `marginBottom: 24`. Rows `.sr-ics-row` (`padding: 14px
16px`, `--sr-border-subtle` separators). Row order:

1. **File switch row**: byte-identical to 1.0.11 (description, availability
   note, bare `ToggleSwitch` named by the header).
2. **Key switch row** (NEW, `.sr-ics-row .sr-ics-toggle-row`):
   - Text column (`flex: 1; min-width: 0`):
     - Label `<div class="sr-ics-key-label" id={keyLabelId}>`: "Sync API
       keys". Register: `0.8125rem/600`, `var(--sr-text)`, line-height 1.4,
       `margin: 0 0 2px`. This is the dialog-lead register, deliberately not
       the `0.84375rem` row-title register, so the section header stays the
       loudest thing in the card and the row reads as a sub-option.
     - Helper `<p class="sr-ics-desc" id={keyDescId}>`: "Keeps your eBird and
       OpenWeather keys the same on every Mac, iPhone and iPad that also turns
       this on." (the shipped `.sr-ics-desc` register: `0.8125rem`,
       `var(--sr-text-muted)`, line-height 1.5).
     - Reason `<p class="sr-ics-note" id={keyNoteId}>`, rendered ONLY when
       iCloud is available and the file switch is off: "Turn on iCloud Sync
       first." (the shipped `.sr-ics-note` register: `0.75rem`,
       `var(--sr-text)`, `margin: 6px 0 0`). When availability is not
       `available`, no second note is rendered: the file switch's availability
       note already sits directly above and is wired to the key switch by
       `aria-describedby` (FR-02: the same reason, said once).
   - Switch: the shared `ToggleSwitch` with `bare`, `labelVisible={false}`,
     `label="Sync API keys"`, `labelledBy={keyLabelId}`, `describedBy` =
     `"{keyDescId} {keyNoteId}"` while the reason renders, `"{keyDescId}
     {icsNoteId}"` while the availability note renders, else `keyDescId`.
     `checked = keySyncEnabled`. Operable only while `syncEnabled &&
     availability === 'available'`; otherwise **`aria-disabled="true"`**
     (still focusable, so the reason is read in place; contract wording),
     visibly at the shipped disabled treatment (`opacity: 0.72`, `cursor:
     not-allowed`), and a click is a no-op. It keeps its checked state while
     unavailable, exactly as the file switch does (state 7 shows two ON
     switches that cannot be operated, with the one note).
3. **Status row**: as shipped. "Last checked <time>" and Check now now cover
   both passes (FR-43); no copy change.
4. **Remove row** (`.sr-ics-row .sr-ics-remove-row`), rendered when
   `availability === 'available' && (sharedExists || keyRecordExists ||
   keyRemovalPending)`:
   - `<div class="sr-ics-remove-actions">` (`display: flex; flex-wrap: wrap;
     gap: 8px`) holding, each only when its condition holds:
     - "Remove synced files from iCloud" (shipped; `sharedExists`).
     - "Remove synced keys from iCloud" (NEW; `keyRecordExists ||
       keyRemovalPending`, regardless of either switch, FR-34). Quiet
       bordered register, `aria-describedby={keyPendingId}` while the pending
       line renders.
   - Pending line `<p class="sr-ics-pending" id={keyPendingId}>`, only while
     `keyRemovalPending` (FR-33): "Waiting to remove the key copy from iCloud.
     SnowRaven will try again when iCloud is reachable." Register `0.75rem`,
     `var(--sr-text-muted)`, line-height 1.5, `margin: 8px 0 0`.
   - Phone tier: the shipped `.sr-ics-remove-row .sr-btn-quiet { width: 100% }`
     rule stacks both buttons full width; no new tier rule is needed.

No footnote below the card.

### Enable note for keys (dialog, opens on switching the key switch on)

Shared `ModalDialog` shell, `trigger` = the key switch, `initialFocus="last"`
(Turn on), Escape / backdrop / Cancel leave the switch off and write nothing.

- Title: "Turn on API key sync".
- Body: six `.sr-dlg-item` blocks (lead `0.8125rem/600` over one paragraph
  `0.8125rem` muted, 12px apart), then one closing line. `<here>` is "this
  Mac" / "this iPhone" / "this iPad" from `hereWord(platform)`.
  1. **What goes to iCloud.** "Your eBird key and your OpenWeather key,
     exactly as you entered them, and for each one when it was last changed
     and which device changed it (its name and kind). Settings and caches stay
     on <here>."
  2. **Whose account.** "Your own iCloud account, on Apple's servers, in the
     same private SnowRaven folder as your synced files. SnowRaven has no
     server of its own, so the keys never pass through one, and the developer
     cannot see them."
  3. **How Apple protects it.** "Apple encrypts the keys in transit and at
     rest. They are end-to-end encrypted only if Advanced Data Protection is
     turned on for your iCloud account; without it, Apple's standard iCloud
     protection applies, the same as for your synced files."
  4. **Which devices.** "Every Mac, iPhone and iPad signed in to this iCloud
     account that also turns on Sync API keys. A device with the switch off
     keeps its own keys and receives nothing."
  5. **What happens next.** "A device with no key takes the shared one. When
     two devices hold different keys, the most recently changed key wins.
     Clearing a key on any sharing device clears it on the others at their
     next check."
  6. **How to stop.** "Switch Sync API keys off at any time: the keys on
     <here> stay put and the copy in iCloud is removed. Remove synced keys
     from iCloud is also available whenever iCloud holds a copy."
  - Closing line `<p class="sr-dlg-fine">`: "Nothing is written to iCloud
    until you choose Turn on." Register `0.75rem`, `var(--sr-text-muted)`,
    line-height 1.5, `margin: 2px 0 8px`, `padding-top: 10px`, `border-top:
    1px solid var(--sr-border-subtle)`. New class in the `.sr-dlg-*` family;
    no new token or size.
- Actions, right-aligned: **Cancel** (quiet) then **Turn on** (accent-filled,
  the only accent fill on the surface).
- The note never shows a key value (FR-04). On the phone tier at 200% it
  scrolls inside the panel (`max-height: 80vh`), with the actions stacked full
  width; this is the shipped shell's behavior, verified in the mockup.

### Enable note for files (shipped 1.0.11 dialog, one sentence amended)

NFR-02: no sentence may claim that keys never leave the device without naming
the key switch as the exception. The shipped "What goes to iCloud" item ends
"Nothing else: your API keys, settings and caches stay on <here>." That
sentence becomes:

> "Nothing else: your settings and caches stay on <here>, and so do your API
> keys unless you also turn on Sync API keys."

The rest of the file note (title, the other three items, actions) is
unchanged. Update `enableNoteItems` in `icloudCopy.ts` and its test fixture.

### Settings tab, API Keys rows (macOS and iOS, only while `showICloudSync()`)

Existing `KeyRow` markup is unchanged: lock tile, title, masked value + Show
/ Hide (or "Not configured" + "No key saved" pill), trailing Update / Add key
+ Clear. `KeyRow` gains `sync?: KeySlotView | null` and `onRetry`.

**Sync line** (NEW, the shipped `SyncLine` / `.sr-sync-line` reused as is,
rendered inside the row's text column directly under the value line; on an
empty row, under the "Not configured" sublabel): a `role="status"` element,
ALWAYS rendered while the gate is true, empty when `sync` is null, children
replaced on change, never unmounted, never `display: none`. Content in order:
state label (glyph + text, `600`, `nowrap`), the sr-only full stop, then the
detail span whose middot lives inside it, then the action button.

**The states** (`KeySlotView.state` to row content; labels are the contract's
exact words; glyphs are lucide at 13px, `strokeWidth 2.2`, `aria-hidden`):

| state | label | glyph | detail fragment | action |
|---|---|---|---|---|
| `up-to-date` | Up to date | CloudCheck | provenance; the FR-41 line while `replacedAt` is set; the FR-42 line while `clearedAt` is set | none |
| `syncing` | Syncing | Cloud (plain outline: not yet confirmed, no direction) | provenance | none |
| `waiting-to-upload` | Waiting to upload | CloudUpload | provenance; the FR-30 sentence while `clearPending` | none |
| `unavailable` | iCloud unavailable | CloudOff | provenance | none |
| `off` | Sync off | CloudOff | none | none |
| `error` | Could not sync | CircleAlert (label in `--sr-error`) | `reason` (one sentence) | **Retry** |

There is no "In iCloud, not downloaded here" and no Download now for keys
(FR-39, OQ-2).

**Provenance rule** (the shipped `devName` / `fromText` helpers, plus
"changed"):

- Provenance: `From this device, changed <formatUploadDate(changedAt)>` when
  `fromThisDevice`, else `From <devName(origin)>, changed <time>`. `devName`
  is the shipped collapse: "Dave's MacBook Pro (Mac)", "iPad", "iPhone".
- FR-41 line (`replacedAt` set): `Replaced by the key from <devName>, changed
  <formatUploadDate(replacedAt)>`. Takes the place of the provenance while
  set; cleared by the next user action on that row or the next replacement.
- FR-42 line (`clearedAt` set, row holds no key): `Cleared from <devName>,
  <formatUploadDate(clearedAt)>`. Rendered under the **Up to date** label,
  the same way the Replaced line rides under it: the row agrees with iCloud
  (nothing on either side) and the detail explains why it is empty. The
  Engineer builds this view as `{ state: 'up-to-date', clearedAt, origin,
  fromThisDevice: false }`. Cleared by the next user action on that row or
  the next arrival; otherwise the row is today's empty state.
- FR-30 sentence (`clearPending`, row holds no key): `This clear has not
  reached iCloud yet.` under **Waiting to upload**; takes the place of the
  provenance. After the marker reaches iCloud the row shows today's empty
  state with no sync line (the row holds no key and its own marker is not
  "news").
- After the user's own Clear with key sync on and iCloud reachable: the row
  reads **Syncing** (no detail) while the marker uploads, then today's empty
  state, no sync line.
- Label strings from a shared record render as React children only, never in
  a path or href (FR-21).

**Rows with no sync view** (key switch never on and no key record known, or a
non-Apple platform): byte-identical to today; no empty line, no extra margin
(FR-40).

**Value-line wrap note for `KeyRow`:** today's value line is a non-wrapping
inline flex (`display: flex; gap: 8`). Lift it to a class (`.sr-key-line`:
`display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px;
margin-top: 2px; min-width: 0`) so Show / Hide can drop under the masked
value at 320px and 200% text instead of being squeezed; the value keeps its
220px `max-width` + ellipsis + `nowrap`. Same fix, same reason as the 1.0.11
file-line wrap note.

The footnote under the card ("Keys are stored in this app's local data
directory and take effect immediately; no restart needed.") is unchanged: it
stays true (the local store is still where a key lives), and the row's own
line says the rest.

### Clear with key sync on (confirmation, opens from a key row's Clear)

Shared `ModalDialog`, `trigger` = that row's Clear, `initialFocus="first"`
(Cancel). Because a confirmed Clear disables the row's Clear, `fallbackFocus`
= that row's Update / Add key button.

- Title: "Clear eBird API Key?" / "Clear OpenWeather API Key?" (the row's
  title).
- Body (`.sr-dlg-text`): "Your eBird key will be removed from <here>, from
  iCloud, and from every device sharing keys at its next check. Devices with
  Sync API keys off keep theirs." (service word "eBird" / "OpenWeather"; never
  the value, FR-28.)
- Actions: **Cancel** (quiet) then **Clear from all synced devices**
  (destructive register: `--sr-error-border`, `--sr-error` text,
  `--sr-surface` fill, hover `--sr-error-bg`).
- With key sync off, Clear is today's instant local clear, no dialog (FR-31).

### Remove synced keys from iCloud (confirmation)

Shared `ModalDialog`, `trigger` = the keys Remove button, `fallbackFocus` =
the key switch, `initialFocus="first"` (Cancel).

- Title: "Remove synced keys from iCloud?"
- Body, two paragraphs: "Your eBird key and your OpenWeather key will be
  deleted from your iCloud account. The keys on <here> and on your other
  devices are not touched." then "To keep iCloud empty, turn Sync API keys off
  on each device first: a device with key sync on uploads its keys again at
  its next check."
- Actions: **Cancel** (quiet) then **Remove from iCloud** (destructive).
- Names the two keys by service, never by value; touches no device's local
  keys; writes no cleared marker (FR-34). "Remove synced files from iCloud"
  is unchanged and names only the files (FR-35).

### Widths and 200% text scale

- Mac: the section and rows as shipped; the two Remove buttons sit side by
  side.
- 641px (the desktop tier at its narrowest): no stacking; the key row's state
  label and provenance wrap onto two lines inside the text column; the Remove
  buttons wrap when they must. Verified: nothing leaves the frame at 200%.
- 320px (phone tier): rows stack via the shipped `.sr-action-row-stack`;
  every button takes `.sr-touch-target`; Retry takes `flex: 1 1 100%` under
  the state text (the shipped `.sr-sync-line .sr-btn-inline` rule); both
  Remove buttons are full width; dialog actions stack. The 64-code-unit
  label with no spaces wraps mid-word through the shipped `.sr-sync-more {
  overflow-wrap: anywhere }`. Verified at 200% in all sixteen states, both
  themes, no horizontal overflow.
- iOS keeps the "Import" wording on the file rows (unchanged).

## Component Usage

- `ICloudSyncSection` (Settings.tsx): the key switch row, the second Remove
  button and its pending line, the three new dialogs' state.
- `SectionHeader` unchanged (the key switch is named by its own label, not the
  header).
- `KeyRow` (Settings.tsx): `sync`, `onRetry`; renders the shipped `SyncLine`
  with a key-flavored `SyncContent` (or a `KeySyncContent` sibling that maps
  the five key states; do not fork `SyncLine` itself). The value-line wrap
  fix above. Save passes `origin` and calls `icloudActions.keySaved(slot)`
  when key sync is on; Clear routes through the confirmation then
  `icloudActions.clearKeyWithSync(slot)` when key sync is on.
- `ToggleSwitch` (`components/ui/ToggleSwitch.tsx`) `bare`, label hidden,
  `labelledBy` / `describedBy` as shipped, plus an **`ariaDisabled`** mode
  (renders `aria-disabled="true"`, keeps the element focusable, ignores
  activation, applies the disabled look). If the team prefers not to extend
  the component, `disabled` is the acceptable fallback (then the reason sits
  next in reading order, as the file switch's note does); the mockup shows
  the contract's `aria-disabled` form.
- Quiet bordered button: Remove synced keys from iCloud, Cancel, Retry
  (inline size).
- Accent-filled button: Turn on only.
- Destructive button (the row's Clear register): Clear from all synced
  devices, Remove from iCloud.
- `ModalDialog` (`components/ui/ModalDialog.tsx`), three instances; no new
  dialog code. New class `.sr-dlg-fine` in globals.css beside the other
  `.sr-dlg-*` rules.
- Lucide: `CloudCheck` (or cloud + check as shipped), `Cloud`, `CloudUpload`,
  `CloudOff`, `CircleAlert`, 13px, strokeWidth 2.2, `aria-hidden`.
- Reads `useICloudState()` (entry-safe) and calls `icloudActions.*`; nothing
  in Settings.tsx imports the controller or `@tauri-apps/api` (NFR-08).
- All copy from `icloudCopy.ts` builders (FR-44): the closed label set plus
  origin label, platform word and formatted time; never a value.

## Design Tokens Applied

All existing, both themes, no new token: `--sr-surface`,
`--sr-surface-subtle`, `--sr-border`, `--sr-border-subtle`,
`--sr-border-medium`, `--sr-text`, `--sr-text-muted`, `--sr-text-disabled`,
`--sr-accent`, `--sr-accent-strong`, `--sr-accent-bg`, `--sr-accent-bg-hover`,
`--sr-accent-border`, `--sr-on-accent`, `--sr-error`, `--sr-error-bg`,
`--sr-error-border`, `--sr-gray-400`, `--sr-switch-thumb`,
`--sr-switch-thumb-shadow`, `--sr-card-shadow`, `--sr-scrim`, the global
focus ring.

No new type sizes: `0.8125rem/600` key-switch label and dialog leads,
`0.8125rem` descriptions and dialog body, `0.75rem` reasons, status, sync
lines, the pending line and the note's closing line, `0.71875rem` inline
Retry, `0.6875rem` header, `1rem/700` dialog titles.

New CSS classes (globals.css, beside the shipped `.sr-ics-*` / `.sr-dlg-*`
rules; phone-tier declarations, if any prove necessary, go inside the
established ≤640 tier block): `.sr-ics-key-label`, `.sr-ics-remove-actions`,
`.sr-ics-pending`, `.sr-dlg-fine`, `.sr-key-line`.

## Interaction Notes

- **Gate:** every addition renders only while `showICloudSync()` (FR-45).
- **Key switch:** click while off and operable opens the note; the switch
  stays `aria-checked="false"` until Turn on. Click while on turns off
  immediately (FR-32): no confirmation, local keys untouched, rows read "Sync
  off", the key record is removed when reachable; while the removal is
  pending the Remove keys button stays with the pending line (FR-33). While
  not operable, a click does nothing and the reason is already visible.
- **File switch off** turns the key switch off in the same action (FR-07):
  the key rows read "Sync off" (FR-40), the reason "Turn on iCloud Sync
  first." appears in the key row at that instant with no animation (the
  consequence shows where the cause is), and the file rows behave exactly as
  in 1.0.11.
- **Turn on:** rows with a local key read "Syncing" with their local
  provenance, then "Up to date"; the Remove keys button appears once iCloud
  holds the record. Focus returns to the key switch.
- **Rows before key sync has ever been on:** no sync line at all (FR-40).
- **Row status regions (live):** the shipped `role="status"` line, children
  replaced on change, so a state change (Syncing, Up to date, Could not sync,
  Replaced, Cleared) is announced once. Never contains a value (NFR-03).
- **Check now** runs both passes; the announcer text is unchanged. A pending
  key removal is retried by any check with iCloud reachable (FR-33).
- **Clear (key sync on):** confirmation, then the local key goes at once;
  the row shows "Syncing" while the marker uploads, then today's empty state.
  Offline, the row reads "Waiting to upload · This clear has not reached
  iCloud yet." until the marker goes up (FR-30). Focus goes to that row's
  Update / Add key button (Clear is now disabled).
- **Clear (key sync off):** today's instant local clear, unchanged (FR-31).
- **Remove synced keys:** confirmation, then the record is deleted. If this
  device has key sync on, its rows read "Syncing" then "Up to date" and the
  Remove keys button returns, exactly as the confirmation says. Focus returns
  to the Remove keys button if still rendered, else to the key switch.
- **Retry:** sets the row to "Syncing" immediately (cross-fade), then "Up to
  date" or "Could not sync" with the mapped reason.
- **Reason copy for Could not sync** (closed table, one sentence, never a
  value): `key-shape` "This key has characters iCloud sync cannot carry.";
  `timeout` "iCloud did not respond in time."; anything else "iCloud could not
  be read."
- **Dialogs:** `role="dialog" aria-modal="true" aria-labelledby`; focus trap;
  Escape and backdrop cancel; focus returns to the opener (or the
  `fallbackFocus` above).
- **Keyboard:** every control is a real `<button>` with `tabIndex={0}` and
  the global focus ring. The aria-disabled key switch is focusable and its
  reason is read through `aria-describedby`.
- **Idempotence of rendering:** the sync line, the status text and the
  announcer are stable elements whose text changes; never remount per state.

## Motion Spec

- Enable note / Clear confirmation / Remove keys confirmation open: panel
  opacity 0 to 1 (160ms ease-out) + scale 0.94 to 1 (180ms
  `cubic-bezier(0.2, 0, 0, 1)`), `transform-origin` at the center of the
  trigger (the key switch, the row's Clear, the Remove keys button); scrim
  0 to 1 (160ms ease-out). Reduced motion: 0.01s. Lib: CSS (shipped shell).
- Dialog close: the reverse at 120ms ease-out; unmount after `transitionend`
  (130ms fallback). Reduced motion: immediate. Lib: CSS.
- Key-row sync line state change: cross-fade, opacity 1 to 0 (120ms
  ease-out), swap children, 0 to 1 (160ms ease-out); no transform; first fill
  and clear-to-empty instant. Reduced motion: instant swap. Lib: CSS (shipped
  `SyncLine`).
- Key switch: the shipped `ToggleSwitch` ease-out track/knob transitions,
  unchanged; aria-disabled opacity 150ms ease-out. Reduced motion: global
  rule. Lib: CSS.
- "Turn on iCloud Sync first." reason, the pending-removal line, and the
  Remove keys button appearing or leaving: no animation, instant (a
  consequence appears the moment its cause changes). Lib: none.
- Buttons: border/background/color 120ms ease-out (shipped). Lock tile
  background/color 160ms ease-out when a row gains or loses a key (shipped).
- Nothing animates on mount; no pulse on "Syncing" (the label carries it); no
  stagger; no hover scale; no spring on the switch.

## Content Notes

Voice: plain, warm, specific; says as little as it can and never more than
iCloud actually provides (NFR-02). No em dash (U+2014) anywhere. Straight
apostrophes, as in `icloudCopy.ts`. Exact strings (the complete new set;
1.0.11 strings are unchanged):

- Key switch label: `Sync API keys`
- Key switch helper: `Keeps your eBird and OpenWeather keys the same on every Mac, iPhone and iPad that also turns this on.`
- Key switch reason (available, file switch off): `Turn on iCloud Sync first.`
- Key switch reason (not available): the file switch's availability note, associated, not repeated.
- Buttons: `Remove synced keys from iCloud`, `Retry`, `Cancel`, `Turn on`, `Remove from iCloud`, `Clear from all synced devices`, `Clear` / `Update` / `Add key` / `Show` / `Hide` (rows, unchanged).
- Pending line: `Waiting to remove the key copy from iCloud. SnowRaven will try again when iCloud is reachable.`
- Row state labels: `Up to date`, `Syncing`, `Waiting to upload`, `iCloud unavailable`, `Sync off`, `Could not sync`.
- Provenance: `From this device, changed <time>`, `From <devName>, changed <time>`.
- FR-41: `Replaced by the key from <devName>, changed <time>`.
- FR-42: `Cleared from <devName>, <time>`.
- FR-30: `This clear has not reached iCloud yet.`
- Reasons: `This key has characters iCloud sync cannot carry.`, `The date and time on this device are too far off to sync this key.` (added in the security fix round for a time outside the writable window), `iCloud did not respond in time.`, `iCloud could not be read.`
- Enable note title: `Turn on API key sync`
- Enable note leads: `What goes to iCloud`, `Whose account`, `How Apple protects it`, `Which devices`, `What happens next`, `How to stop`
- Enable note bodies: as quoted in the Enable note section above, with `<here>` from `hereWord(platform)`.
- Enable note closing line: `Nothing is written to iCloud until you choose Turn on.`
- File note (1.0.11), amended sentence only: `Nothing else: your settings and caches stay on <here>, and so do your API keys unless you also turn on Sync API keys.`
- Clear title: `Clear eBird API Key?` / `Clear OpenWeather API Key?`
- Clear body: `Your <eBird | OpenWeather> key will be removed from <here>, from iCloud, and from every device sharing keys at its next check. Devices with Sync API keys off keep theirs.`
- Remove keys title: `Remove synced keys from iCloud?`
- Remove keys body: `Your eBird key and your OpenWeather key will be deleted from your iCloud account. The keys on <here> and on your other devices are not touched.` then `To keep iCloud empty, turn Sync API keys off on each device first: a device with key sync on uploads its keys again at its next check.`
- Times: always `formatUploadDate` (month-first + local time, honoring the
  user's date-format preference).
- Fixture content used in the mockup (for tests and screenshots): eBird key
  `q7v3kd9m2pah` changed Aug 30, 2026 at 6:48 PM on this device;
  OpenWeather key `3f8c1a2e9b7d4c6f0a1b2c3d4e5f6a7b` changed Sep 1, 2026 at
  8:02 AM on "iPad"; replacement key `x2n8wq4tk7dm`; a clear from "iPhone"
  at Sep 1, 2026 at 8:40 AM; last checked Sep 1, 2026 at 9:14 AM; this
  device "Dave's MacBook Pro" (mac); the 64-code-unit label
  `DavesMacBookPro16inch2024WorkLaptopBirdingFieldMachineBackupUnit` (mac).
  Files as in 1.0.11.
