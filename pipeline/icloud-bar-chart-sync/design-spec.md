# Design Spec: iCloud Bar-Chart Sync

**Feature:** icloud-bar-chart-sync
**Date:** 2026-09-28
**Stage:** 4, The Designer (hands-off draft; build 1 of the 2026-09-28 Spool spin)
**Source:** prd.md, schema.md, strategic-brief.md; `pipeline/design-system.md` (designed within it, no evolution)
**Companions:** `design.html` (the interactive mockup: both themes, desktop and phone, 100% and 200% text), `copy-review.html` (every string, before and after, numbered, with the nine decisions)

**Every user-facing string in this document is a DRAFT, pending the user's approval.** The Engineer must not write any user-facing string that is not in the Copy table below as approved by the user (CLAUDE.md, user direction 2026-09-27; PRD FR-34). The numbers here are the numbers on `copy-review.html`, so the user's answers map onto this table one to one.

---

## Visual Direction

Quiet utility, exactly as the design system fixes it. This feature adds no new visual idea: the Targets tab's eBird bar chart section borrows the Settings rows' status line, glyphs and state words verbatim; the two new confirmations are the shared dialog shell; the new Settings section is the tab's quietest register (the Troubleshooting card shape). The green appears only where it already does (Add file, a focus ring, the success line), the danger register only on Remove and its confirm buttons. Nothing pulses, nothing bounces; a state change cross-fades and a dialog scales in from the control that opened it.

## Screens / Views

### 1. Targets: the eBird bar chart section (macOS, iOS, iPadOS; sync on)

The existing `.sr-tg-file-card` gains one element: the shared row status line (`SyncLine`, `role="status"`, `.sr-sync-line`) rendered from first paint inside `.sr-tg-file-line`, under the detail line, empty when the section has no sync view. Its content is `SyncContent` over the county's `SlotView` (`useICloudState().barCharts[regionCode]`): the 13px lucide cloud glyph (`aria-hidden`), the state label at 600, the sr-only full stop, the muted provenance span with its middot inside it, then the inline Download now or Retry (`sr-btn-quiet sr-btn-inline`).

States and what the card shows (the mockup's demo strip walks all eight):

| County view | Title | Detail | Sync line | Actions |
|---|---|---|---|---|
| present, `up-to-date` | `fileTitle` | join detail · Show unmatched · filename | Up to date · From this device | Replace, Remove |
| present, `up-to-date` + `replacedAt` | same | same | Up to date · Replaced by the file from Dave's iPhone (iPhone), uploaded ... | same |
| present, `in-icloud-not-downloaded` | same (the LOCAL file's range) | same | In iCloud, not downloaded here · From Dave's iPhone (iPhone), uploaded ... · **Download now** | same |
| absent locally, shared `in-icloud-not-downloaded` | item 10, "A bar-chart file for {County} is in iCloud" | the add instruction (item 8) and the ebird.org link | In iCloud, not downloaded here · From ... · **Download now** | Add file (accent) |
| present, `uploading` / `waiting-to-upload` | `fileTitle` | same | Syncing, uploading / Waiting to upload · From this device | same |
| present, `error` | same | same | Could not sync · {reason} · **Retry** (label in `--sr-error`) | same |
| present, sync off or non-Apple | same | same | (empty; margin collapses) | same |
| absent, sync on | `addFileTitle` | add instruction (item 8) + **item 9** + link | (empty) | Add file |
| absent, sync off or non-Apple | `addFileTitle` | add instruction (item 8) + link | (empty) | Add file |

Key decisions:
- **One vocabulary.** No new state word on Targets; FR-15's list is the eight shipped `STATE_LABELS`, `replacedAt` carries FR-17 through the shipped `replacedText`. A user who has read a Default Files row reads this line without learning anything.
- **Remove confirms only with sync on** (FR-10). With sync on, Remove opens the shared `ModalDialog` (items 5 to 7) with `initialFocus="first"` (Cancel), `trigger` the Remove button, `fallbackFocus` the section's first action button (after a confirmed remove, Remove has unmounted). With sync off, Remove is the instant local action it is today. The sync-on gate is `barCharts[regionCode] !== undefined`, which is also what gates the sync line, so the two can never disagree.
- **The in-iCloud-only state keeps the add path.** Item 10's title replaces "Add ... to sort by eBird frequency" only in that state; the instruction, the ebird.org link and the accent Add file button stay beneath, because a file added here is the newer upload and wins (FR-01).
- **The frequency figures follow the local file.** The Probability column reads from whatever file is current (FR-18); in the in-iCloud-only state the column shows the existing "No file for {County}" cells until Download now lands.
- **Status line parity.** The join detail is computed from the parsed file, identical bytes give identical text on every device (QA-15). Nothing here changes.

### 2. Settings: iCloud Sync section (macOS, iOS, iPadOS)

Layout unchanged. Three strings change (items 1, 2, 4) and the Remove synced files confirmation's list gains one line for the county files and, with D1, one for the day answers (item 3). The list stays a `<ul class="sr-dlg-files">`: the two filenames as today, then "Bar-chart files for N counties" (counted from `sharedCountyCodes.length`; singular form in item 3), then the day-answers line when any peer snapshot exists. The turn-on note keeps its four items; only the first's text changes.

### 3. Settings: the new Bar-chart files section (every platform)

Position: after Tab Layout and before Troubleshooting, so it sits at the same position relative to the tab's last sections on every platform (Troubleshooting is Tauri-only; Acknowledgments stays last). The quiet section register from `design-system.md`: an uppercase `SectionHeader` ("Bar-chart files", item 12) over a `--sr-surface` card (1px `--sr-border`, radius 10) whose one `quiet-card` holds:

1. the description line (item 13), 0.75rem muted, as the Troubleshooting card's;
2. a `.bc-status-row` (flex, wrap, gap 10px 12px): the quiet bordered button (item 17; the Rebuild caches register: 32px, 1px `--sr-border`, `--sr-surface`, radius 6, 0.75rem/500) and, beside it, the status line (items 14 to 16) at 0.75rem muted, `flex: 1 1 200px`; on the phone tier the button takes the full row and the status wraps under it;
3. an always-rendered `role="alert"` line for the partial-failure sentence (item 22), `--sr-error`, empty otherwise;
4. an always-rendered polite `role="status"` line for the success sentence (item 23), `--sr-accent`, empty otherwise. Both regions are in the tree from first paint and never `display: none` while they may speak (they collapse through `:empty` margin only; the ui rule on live regions).

The button's `aria-describedby` is the status line, so the count or the reason is read at the control. With zero counties or an unreadable manifest, the button is `aria-disabled="true"`, still focusable, ignores click and keyboard activation, and takes the `opacity: 0.72; cursor: not-allowed` look (NFR-03); never native `disabled`. The unknown state shows the existing Retry link-button beside the sentence.

The confirmation (items 18 to 21) is the shared shell, `initialFocus="first"`, trigger the button, fallback the button itself (it stays mounted, `aria-disabled` after a full removal, so the fallback is the same element). The body is the sync-off text everywhere except when `syncEnabled && availability === 'available'` (schema 6.5), which is false by construction off Apple. Confirm button: "Remove all" (sync off) or "Remove from all synced devices" (sync on, shared with the Targets dialog).

After confirm: `clearAllBarChartFiles()`; the status line re-reads the manifest (through the bar-chart epoch) so it describes exactly the survivors (FR-22); the success line speaks once; with sync on, `barChartsCleared(removed, isoNow)` follows. The Targets tab, still mounted, reflects the removal through the same epoch (FR-06).

## Component Usage

- `components/ui/ModalDialog.tsx` for both new confirmations (one close path, per-keydown trap re-query, focus return to the trigger or the named fallback, origin-aware scale-in). No new overlay.
- `SyncLine` / `SyncContent` from `Settings.tsx`, lifted to a shared module the Targets section can import without pulling Settings onto the Targets graph (a `components/settings/SyncLine.tsx` or `components/ui/SyncLine.tsx`; the Engineer decides the home, the behaviour is unchanged). `entryChunk.test.ts` stays green: `icloudState.ts` is already entry-safe.
- `Button` primitive for every new button (Remove all bar-chart files, both dialogs' actions, Download now / Retry on Targets); `tabIndex={0}` default inherited, no overrides.
- Lucide: the shipped cloud glyph set at 13px in the sync line, `FileText` 16px in the card, `RefreshCw` 12px on Retry. No new icon.
- `SectionHeader` and the Troubleshooting card shape for the new section; no new component.
- Copy: every new string in `icloudCopy.ts` (the iCloud-flavoured ones, the two dialogs, the Settings section) or `targetsCopy.ts` (items 8 to 10), never inline in a component, so the em-dash and count-agreement sweeps see them. The count builders (`filesFor(n)`, singular at exactly one) live beside `counted()`.

## Design Tokens Applied

No new token. Surfaces `--sr-surface` / `--sr-surface-subtle`; text `--sr-text`, `--sr-text-muted`; borders `--sr-border`, `--sr-border-subtle`, `--sr-border-medium` (hover); accent `--sr-accent` only on Add file, the success line, the focus ring and the Retry / Show unmatched link-buttons (as today); `--sr-error` on the Could not sync label, the partial-failure alert and the danger buttons' text; `--sr-error-border` / `--sr-error-bg` on the danger register; `--sr-scrim` behind the dialogs; `--sr-card-shadow` on the panel. Type stays the house scale: 0.8125rem/600 titles, 0.75rem details and status, 1rem/700 dialog titles, 0.6875rem/600 uppercase headers.

## Interaction Notes

- **Targets Remove, sync on:** press opens the dialog; Escape, backdrop, Cancel close it with nothing written; the confirm button removes the file locally through `removeBarChartFile` (as today), then `icloudActions.barChartsCleared([code], isoNow)` writes the county's cleared marker; the section shows the absent state; focus returns to the Add file button (the fallback) because Remove has unmounted.
- **Targets Remove, sync off / non-Apple:** unchanged, instant, no dialog.
- **Download now on Targets:** `icloudActions.downloadBarChartNow(code)`; the line stays "In iCloud, not downloaded here" until the pull lands, then reads "Up to date · Replaced by the file from ..." (when a local file existed) or "Up to date · From ..." (first arrival; `replacedBySyncAt` is stamped only on a real replacement, schema 5.4). The frequencies switch to the new file at that moment.
- **Retry on Targets:** `icloudActions.retryBarChart(code)`.
- **Add / Replace with sync on:** after the write, `barChartSaved(code)` puts the line at "Syncing, uploading" at once; the check runs from the epoch subscription (schema 5.7).
- **Settings Remove all bar-chart files:** see section 3. Activation while `aria-disabled` does nothing, by click or by keyboard.
- **Turn-on note:** unchanged behaviour; only item 2's text.
- **Keyboard:** every new control is a tab stop through the primitives; the dialogs trap Tab and close on Escape.
- **Phone tier (<=640):** the shipped rules apply unchanged: the sync-state label wraps (`white-space: normal`, glyph on the first line), Download now / Retry take a full-width line under the state text, dialog buttons stack full width at the 44px posture, the Remove all button takes its row. Measured in the mockup at 320px in Chromium and WebKit, 100% and 200% text: document scroll width 320 in every state of both surfaces, dialogs 28px to 292px.

## Motion Spec

- Dialog scrim: opacity 0 to 1, 160ms ease-out; close 120ms; CSS (the shipped `.sr-dlg-root`).
- Dialog panel: opacity 0 to 1 over 160ms ease-out plus scale 0.94 to 1 over 180ms `cubic-bezier(0.2, 0, 0, 1)`, transform-origin at the centre of the trigger in the panel's space (Remove on Targets; the Remove all button; the iCloud Sync switch for the note); close 120ms; reduced motion: durations collapse to ~0 through the global rule, `transitionend` still fires; CSS via `ModalDialog`.
- Sync line view change: cross-fade, 120ms out then 160ms in, ease-out; first fill and clear-to-empty instant; reduced motion instant; CSS class toggle (the shipped `SyncLine`).
- Bar-chart files status line: instant text replacement, no motion (a consequence appears where its cause is; the switch-reason rule).
- Success and alert lines: instant; no entrance animation (a live region that animates in is decoration on a sentence).
- Button hover: 120ms ease-out border/background colour fade (the shipped quiet and danger registers).
- Nothing on mount animates; no stagger; no pulse.

## Content Notes

Tone: short, specific, the app's own words ("Remove", "Up to date", "From this device"), American spelling, no em dash anywhere. A count is never published; in-app counts come from the manifest or the state and take the singular at exactly one (`filesFor`, `counted`). No surface is named from a component: the tab is Targets, the section is eBird bar chart, the new Settings section is Bar-chart files. A reason never carries Apple's text or a code (the closed `REASONS` table; item 4 removes the one number it quoted). Every published sentence that said iCloud Sync copies exactly two files, that the bar-chart file stays on the device, or (with D1) that cached lookups are never synced, is replaced at paragraph scope and the files are compared against each other (items 25 to 44).

**Flags for the Engineer**
- `docs/HELP.md` gains a `### Bar-chart files` heading (item 32): extend the Help sidebar index and its parity guard in the same change.
- `targetsPublishedClaims.test.ts` rows for the retired sentences flip to the approved replacements; a published-claims guard of the house shape reads every new sentence on the privacy, HELP, README, website and listing surfaces (FR-38).
- `appstore/LISTING.md` item 44 carries a version number; read it off `main` at rebase time.
- The mockup keeps Inter (the design system's type) against the doctrine's display-face rule; recorded in `decisions.md`.

---

## Copy table

**APPROVED by the user on 2026-09-28 (decisions.md §8 to §9).** Take the "if D1 = yes" variant of every item. Items 1 to 33 are approved for The Engineer to write. Items 34 to 44 (privacy policy, README, website, App Store listing) are HELD: prepare them as a patch in this folder, do not apply them; the user approves them again, rendered, before the bundle ships. Item 45 is no change. Item 46 is not written (D7 = unchanged).

Every string is **DRAFT, pending user approval**. Item numbers are `copy-review.html`'s. `${here}` is `hereWord(platform)` ("this Mac", "this iPhone", "this iPad", "this device"); `${county}` is "Name, ST"; `${n}`/`${k}` are counts from the manifest or the state, rendered through `counted()` with the singular at one. A row marked **D1** has a stated variant if the day cache does not ship. **The Engineer must not write any user-facing string that is not in this table as approved.**

### In-app: `frontend/src/lib/icloud/icloudCopy.ts`

| # | Where | Before | After (DRAFT) |
|---|---|---|---|
| 1 | `ICS_DESCRIPTION` (:12) | Keeps your eBird backup and ML export the same on every Mac, iPhone and iPad signed in to your iCloud account. | Keeps your eBird backup, ML export and eBird bar-chart files the same on every Mac, iPhone and iPad signed in to your iCloud account. |
| 2 | `enableNoteItems(here)[0].text` (:121), **D1** | Your eBird backup and your Macaulay Library export, along with each file's name, when it was uploaded, which device it came from (its name), its size and a checksum. Nothing else: your settings and caches stay on ${here}, and so do your API keys unless you also turn on Sync API keys. | Your eBird backup, your Macaulay Library export and every eBird bar-chart file you have added on the Targets tab, along with each file's name, when it was uploaded, which device it came from (its name), its size and a checksum. The day-by-day eBird answers behind the Targets tab's live counts go too, so your other devices do not ask eBird again. Your settings and other caches stay on ${here}, and so do your API keys unless you also turn on Sync API keys. (D1 = no: the first sentence as here, then "Nothing else: your settings and caches stay on ${here}, and so do your API keys unless you also turn on Sync API keys.") |
| 3 | Remove synced files list, new builder beside `REMOVE_INTRO`; rendered at `Settings.tsx:861-863`, **D1** | the two filenames only | the two filenames, then `Bar-chart files for ${counted(n, 'county', 'counties')}` (singular `The bar-chart file for 1 county`), then, when any peer snapshot exists, `The Targets tab's saved day-by-day eBird answers` (D1 = no: no day-answers line). Intro and outro unchanged. |
| 4 | `REASONS['too-large']` (:77) | The file in iCloud is larger than 200 MB. | The file in iCloud is too large to sync. |
| 5 | new `removeCountyTitle(county)` | (new) | Remove the bar-chart file for ${county}? |
| 6 | new `removeCountyBody(county, here)` | (new) | The file for ${county} will be removed from ${here} and from iCloud. Every Mac, iPhone and iPad with iCloud Sync on removes its copy at its next check. Devices with sync off keep theirs. |
| 7 | new `BUTTONS.removeAllSynced` (Cancel reuses `BUTTONS.cancel`) | (new) | Remove from all synced devices |

### In-app: `frontend/src/lib/targets/targetsCopy.ts`

| # | Where | Before | After (DRAFT) |
|---|---|---|---|
| 8 | `ADD_FILE_DETAIL_TAIL` (:307) | . The file stays on this device and is not synced. | . |
| 9 | new `ADD_FILE_SYNC_NOTE` (rendered only while the section has a sync view) | (new) | With iCloud Sync on, a file you add here reaches your other synced devices too. |
| 10 | new `inICloudTitle(county)` (the in-iCloud-only state's title) | (new) | A bar-chart file for ${county} is in iCloud |
| 11 | the Targets sync line (information) | no sync state on Targets | reuses `STATE_LABELS`, `fromText`, `fromWithTimeText`, `replacedText`, `REASONS`, `BUTTONS.downloadNow`, `BUTTONS.retry` verbatim; no new string |

### In-app: Settings, the Bar-chart files section (new strings; `icloudCopy.ts` or a sibling copy module)

| # | Where | Before | After (DRAFT) |
|---|---|---|---|
| 12 | section header | (new) | Bar-chart files |
| 13 | description line | (new) | County bar-chart files added on the Targets tab, for sorting by eBird frequency. |
| 14 | status, files saved (also the button's `aria-describedby`) | (new) | Saved for ${counted(n, 'county', 'counties')} on ${here}. |
| 15 | status, none saved (the `aria-disabled` reason) | (new) | No bar-chart files are saved on ${here}. |
| 16 | status, manifest unreadable (+ existing Retry) | (new) | Couldn't check for bar-chart files on ${here}. |
| 17 | button | (new) | Remove all bar-chart files |
| 18 | dialog title | (new) | Remove all bar-chart files? |
| 19 | dialog body, sync off (every non-Apple platform) | (new) | Bar-chart files for ${counted(n, 'county', 'counties')} will be removed from ${here}. Your eBird backup, ML export and API keys are not touched. (singular: The bar-chart file for 1 county will be removed from ${here}. ...) |
| 20 | dialog body, sync on | (new) | Bar-chart files for ${counted(n, 'county', 'counties')} will be removed from ${here} and from iCloud. Every Mac, iPhone and iPad with iCloud Sync on removes its copies at its next check. Devices with sync off keep theirs. Your eBird backup, ML export and API keys are not touched. |
| 21 | confirm button, sync off (sync on reuses item 7) | (new) | Remove all |
| 22 | partial failure, `role="alert"` | (new) | Bar-chart files for ${counted(k, 'county', 'counties')} could not be removed and remain on ${here}. Try again. (singular: The bar-chart file for 1 county could not be removed and remains on ${here}. Try again.) |
| 23 | success, polite `role="status"`, once | (new) | Removed bar-chart files for ${counted(n, 'county', 'counties')}. (singular: Removed the bar-chart file for 1 county.) |
| 24 | screen-reader text (information) | n/a | no new sr-only string; `aria-describedby` wiring to items 14 to 16, dialogs labelled by items 5 and 18 |

### Published: `docs/HELP.md`

| # | Where | Change (DRAFT; full paragraphs on `copy-review.html`) |
|---|---|---|
| 25 | :424 | Last sentence replaced: "On a Mac, iPhone or iPad with iCloud Sync on, a file you add here reaches your other synced devices, the section shows the same sync state the Default Files rows do, and **Remove** asks you to confirm because the file is removed from those devices too (see iCloud Sync under Settings). Everywhere else the file stays on this device, so add it on each device where you want eBird's frequencies." |
| 26 | :739 | "your eBird backup, your Macaulay Library export and the eBird bar-chart files you add on the Targets tab are kept the same ...: upload a fresh export or add a county's bar chart on any one of them and the others use it" |
| 27 | :741, **D1** | "(the files, and for each ...; and the day-by-day eBird answers behind the Targets tab's live counts)"; "Your settings and other caches stay on each device: only those day-by-day answers are shared, so a county's days checked on one device are not asked of eBird again on another. Your API keys are synced only if ..." (D1 = no: only "the two files" to "the files") |
| 28 | :745 | "For each file, a county's bar-chart file included, the most recently uploaded copy wins, whole" |
| 29 | :747 | appended: "The Targets tab's **eBird bar chart** section shows the same state, where the file came from, and **Download now** or **Retry**, for the county you have selected." |
| 30 | :749, **D1/D5** | "...so the row asks you to confirm first; **Remove** on a county's bar-chart file in the Targets tab does the same and asks the same way. On every device that clears its eBird backup, the saved answers ... go with it, exactly as described under Default Files above, and the day-by-day eBird answers' shared copies in iCloud go too. Devices with sync off keep theirs. With sync off, Clear and Remove are the same instant local actions as everywhere else." (D1 = no: drop the shared-copies clause) |
| 31 | :751, **D1** | "deletes the file copies in your iCloud account, bar-chart files and the shared day-by-day answers included, without touching any device" (D1 = no: ", bar-chart files included,") |
| 32 | new `### Bar-chart files` after :793 | "The Bar-chart files section, near the bottom of Settings on every platform, says how many counties have a bar-chart file saved on this device and offers **Remove all bar-chart files**. It always asks you to confirm first, and the confirmation says how many counties' files go. With iCloud Sync on, the copies in iCloud go too and every other device with sync on removes its files at its next check; devices with sync off keep theirs. Your eBird backup, Macaulay Library export and API keys are not touched. With no saved files the button cannot be pressed, and the line beside it says so." |
| 33 | :820, **D1 only** | "The days already checked stay on the device and still show offline (with iCloud Sync on, days another of your devices checked count too)" |

### Published: `PRIVACY_POLICY.md`, mirrored in `website/privacy.html`

| # | Where (policy / website) | Change (DRAFT; full paragraphs on `copy-review.html`) |
|---|---|---|
| 34 | :13 / :121 | "which copies your data files (your eBird backup, your Macaulay Library export and any eBird bar-chart files you have added), and your API keys only if ..." |
| 35 | :16 / :124, **D3, D1/D5** | "from the Settings tab (a single county's bar-chart file, also from the Targets tab)"; "the day-by-day eBird reports behind the Targets tab's live counts (and, with iCloud Sync on, every device's copy of them in iCloud)" (D1 = no: first parenthesis only) |
| 36 | :32 / :141 | "is read only to show eBird's frequencies for its county. It is stored on your device, and on a Mac, iPhone or iPad with iCloud Sync on it is copied to your own iCloud account along with your other synced files (see the iCloud Sync section below)." |
| 37 | :65 / :170 | "keep your data files (your eBird backup, your Macaulay Library export and any eBird bar-chart files you have added on the Targets tab) the same across your own devices through iCloud" |
| 38 | :67 / :172, **D1** | "writes your eBird backup, your Macaulay Library export and each county's eBird bar-chart file into ..."; "...and are never synced, with one exception: the day-by-day lists of species that eBird reported in a county, which the Targets tab fetches with your key, are written into the same container as one copy per device, each holding only what that device fetched from eBird (the county, the day, and each species eBird listed with the time and place of that report as eBird gives them), so your other devices do not repeat those requests. They hold none of your own sightings." (D1 = no: first change only) |
| 39 | :70 / :175, **D1** | "deletes the file copies in your iCloud account, the bar-chart files and the day-by-day lists included, without touching any device" (D1 = no: ", the bar-chart files included,") |
| 40 | :3 / :84 | Effective date: the ship date, identical in both files |

### Published: `README.md`, `website/index.html`, `appstore/LISTING.md`, others

| # | Where | Change (DRAFT) |
|---|---|---|
| 41 | `README.md:59` | "Your eBird backup, Macaulay Library export, eBird bar-chart files and API keys are stored only on your device unless ..." (one correction; the Targets section untouched) |
| 42 | `website/index.html:126-129` | the same sentence |
| 43 | `appstore/LISTING.md:73` and App Store Connect | the same sentence |
| 44 | `appstore/LISTING.md:192-202`, **D1** | heading "iCloud Sync (v1.0.11; bar-chart files and the Targets day lists from v1.0.40)"; "copies the user's data files (the eBird backup, the Macaulay Library export and any eBird bar-chart files added on the Targets tab, each with a small record naming the file, its upload time, and a random per-device id with the device's name)"; last sentence "Settings are never written to it. The one cache that is: the Targets tab's per-day lists of species eBird reported in a county, one copy per device, so the user's other devices do not repeat those eBird requests; they hold no user sightings." (D1 = no: heading "; bar-chart files from v1.0.40", the data-files change, and "Settings and caches are never written to it." kept) |
| 45 | `appstore/REVIEW_NOTES.md` | no iCloud restatement exists; no change |
| 46 | `ACCESSIBILITY.md:15`, **only if D7 = revise** | "...the iCloud Sync section's **Sync API keys** switch, and on every platform the **Remove all bar-chart files** button, stay in the tab order while they cannot be operated (each is marked `aria-disabled` rather than removed with the native `disabled` attribute), so the one-line reason associated with each is read in place, and every confirmation the Settings tab and the Targets tab open traps focus, closes on Escape, and returns focus to the control that opened it." |

### Decisions the copy depends on (D1 to D9, `copy-review.html`)

D1 day-cache sync (default yes); D2 clear-all confirms with sync off (yes); D3 revise the privacy "delete from Settings" sentence (yes, item 35); D4 adoption-time fallback (check time, file still pushed); D5 backup clear removes the shared day copies (yes); D6 no compatibility shim (yes); D7 ACCESSIBILITY.md unchanged (yes; item 46 otherwise); D8 per-device snapshots merged on read (accept); D9 take the roadmap eviction fix in this build (yes).
