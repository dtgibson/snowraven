# Design Spec: iOS Alerts (new lifer nearby)

**Feature:** ios-alerts
**Stage:** 4 (The Designer), approved by the user 2026-09-30; **revised and re-approved 2026-09-30 after the live look** (the inbox moved out of the Settings card into its own sheet, with three entry points; sections 1, 7 and 8 and the Component, Interaction and Motion sections carry the revision, and the superseded inline-inbox description is kept, marked, in 7.0)
**Mockup:** `pipeline/ios-alerts/design.html` (single self-contained file; the approved direction, revised in place)
**Design system:** `pipeline/design-system.md` exists and was designed within. No deviation was made, so no `decisions.md` entry.

## Visual Direction

The Alerts section is a Settings section, not a feature surface: it takes the tab's own register (the uppercase `SectionHeader`, one `--sr-surface` card at radius 10 with a 1px `--sr-border`, rows of `14px 16px` separated by `--sr-border-subtle` hairlines, the bare `ToggleSwitch`, the Appearance-row choice buttons, the Default Location input register, `.sr-btn-quiet`, and the shared `ModalDialog`). Restraint is the brand: the accent appears only on the on-state switch track, the selected choice button, the Search button, and the focus ring. Off, the card is two sentences and a switch and nothing suggests anything is running; on, the configuration unfolds beneath it in one motion.

**Placement:** directly after the Default Location section and before Tab Layout, on iPhone and iPad only (gated markup, never hidden markup). `settingsSectionOrder.test.tsx`'s `BELOW_THE_PAIR` list gains `'Alerts'` between `'Default Location'` and `'Tab Layout'`.

## Screens / Views

### 1. The section, OFF (default)

One row: description column plus the bare switch.

- Line 1 (`.sr-ics-desc` register, 0.8125rem muted): **"Tells you when eBird reports a species you have never recorded near a place you choose. Only on iPhone and iPad."**
- Line 2 (same register, 6px below): **"Off until you turn it on. Nothing is checked, sent or asked for before then."**
- Switch: `ToggleSwitch bare labelVisible={false}`, `label="Alerts"`, `aria-labelledby` the section header's id, `aria-describedby` both lines. Off.
- Nothing else is rendered below the row while off (the configuration block is present in the DOM inside a collapsed, `inert` grid-collapse wrapper so the reveal can animate; it contributes no height and no tab stops), **except the Inbox row (7.1) when the inbox has rows**: alerts paused for a trip must not hide the history. Off and empty, the card is the one row above and nothing else.

### 2. Turning on

Pressing the switch on, when the notification permission is `notDetermined`, is where the iOS system notification prompt appears (native, from `alerts_set_enabled(true)`). The mockup shows a schematic dashed placeholder at that point rather than a fake dialog; the real app shows nothing of its own, only the system prompt. After the prompt (allowed or denied), the switch is on and the configuration reveals. Denied: alerts stay on and the notes row shows the denied sentence (section 6).

When the permission was already decided, the switch turns on with no prompt and the configuration reveals at once.

Once on, line 2 of the first row is replaced (no animation) with: **"Checks run in the background and when you open the app. Turn it off and every scheduled check and pending notification stops at once."** Turning off restores the off sentence.

### 3. The configuration rows (in FR-05 order, each a `.sr-row` on a hairline)

**Cadence**
- Sub-label (`.sr-ics-key-label` register, 0.8125rem/600 `--sr-text`): **"Cadence"**
- Description: **"Hourly checks about once an hour, Daily about once a day. iOS decides when a background check runs. Opening the app also checks, once the interval has passed."**
- Control: the Settings `RadioGroup` (Appearance's `toggleBtnStyle` register: `flex: 1`, height 34, radius 6, `--sr-surface-subtle` at rest, `--sr-accent-bg` + `--sr-accent-border` + `--sr-accent` + 600 when checked), `aria-label="Cadence"`, options **"Hourly"** (default) and **"Daily"**.

**Quiet hours**
- Sub-label: **"Quiet hours"**; description: **"No alert arrives inside the window. Anything found then goes into the inbox right away and is delivered when the window ends."**
- Control: bare `ToggleSwitch` (`label="Quiet hours"`), off by default.
- When on, a grid-collapse reveal beneath the row holds two native `<input type="time">` in the Default Location input register, labelled **"From"** (default 22:00) and **"To"** (default 07:00), two-up (`minmax(min(8rem, 100%), 1fr)`), then one note line (0.75rem):
  - Normal (muted): `"Quiet from {start} to {end}{, across midnight}. A find inside the window is delivered at {end}."` Times in 12-hour local form (`10:00 PM`, `7:00 AM`). The ", across midnight" clause appears only when end < start. Default renders **"Quiet from 10:00 PM to 7:00 AM, across midnight. A find inside the window is delivered at 7:00 AM."**
  - Start equals end (`--sr-text`, not muted): **"Start and end must differ. Until they do, no quiet period applies."** (FR-34)

**Measure from**
- Sub-label: **"Measure from"**; `RadioGroup` (`aria-label="Measure from"`) with **"Fixed place"** (default) and **"My location"**.
- Description under the control changes with the choice (swap, no animation):
  - Fixed place: **"Distances are measured from the place below."**
  - My location: **"Your most recent known position, under the same While Using permission as Use my location. With the app closed, a check uses the last position the app or a widget recorded in the past 24 hours; SnowRaven never asks for Always. When no recent position is known, the fixed place below is used instead."**
- Choosing My location runs the existing `getCurrentLocation()` flow (schema 6.4); choosing Fixed place performs no location read.

**Fixed place** (rendered under BOTH models; under My location it is the fallback)
- Sub-label: **"Fixed place"** under Fixed place; **"Fixed place, used when no recent position is known"** under My location.
- Summary line (`.sr-place`, 0.8125rem, wrapping): the place name at 600 `--sr-text` when the place was chosen by name search (e.g. **"Davis, CA"**); the coordinates in `--font-mono` 0.75rem muted (`38.54490, -121.74050`); and, when `fixedPlace` is null (following), the muted phrase **"Following your Default Location"** with the Default Location's coordinates and no name.
- Place search: the shipped `AddressSearch` (Map Explorer register: text input with placeholder **"Search by place name"**, `aria-label` the same, plus an accent **"Search"** button at 34px). A hit writes `fixedPlace = { lat, lng, name: query }`. The miss and offline lines are the component's own.
- Coordinates: two inputs of the Default Location register, labels **"Latitude"** / **"Longitude"** (0.6875rem/600 muted), mono, 34px, radius 6, 1.5px `--sr-border`, accent border on focus. Editing either writes `fixedPlace = { lat, lng, name: null }`.
- Buttons (wrapping `.sr-btn-row`, gap 8): `.sr-btn-quiet` **"Use my location"** with the lucide `Navigation` glyph (13px, `--sr-accent`) and the busy label **"Locating…"** (U+2026 ellipsis, as the Default Location button); `.sr-btn-quiet` **"Follow Default Location"**, native `disabled` while already following. Use my location writes `fixedPlace = { lat, lng, name: null }`; Follow writes `fixedPlace = null`.
- Hint (0.6875rem muted): **"Editing this place never changes your Default Location, and saving a Default Location later leaves a place you set here alone."**

**Radius**
- Sub-label as a `<label for>`: **"Radius"**; a 5.5rem mono input (`inputmode="numeric"`, default **25**) with the unit word **"miles"** beside it (0.8125rem muted).
- Hint (`aria-describedby`): **"A whole number from 1 to 25."**
- Refusal (`role="alert"`, 0.6875rem `--sr-error`, appears only on an invalid non-empty value; the stored value never changes): **"Radius is a whole number from 1 to 25 miles."**

### 4. The status line

A `.sr-row` holding one `role="status" aria-live="polite"` paragraph in the iCloud status register (0.75rem, muted, line-height 1.45). The leading sentence is 600 `--sr-text`; any trailing guidance is muted. The row is always rendered (never unmounted) so the region pre-exists its changes.

**The six last-check sentences** (the lead is the whole line; times are the user's local time; the singular is "1 lifer"):

| Outcome | Rendered |
|---|---|
| none yet | **Not checked yet** |
| `nothing-new` | **Last checked 9:41 AM, nothing new** |
| `hits` (n) | **Last checked 9:41 AM, 3 lifers** |
| offline / timeout | **Last checked 9:41 AM, offline** |
| unusable answer | **Last checked 9:41 AM, eBird did not answer** |
| `busy` (429) | **Last checked 9:41 AM, eBird busy** |
| `key-rejected` (401/403) | **Last checked 9:41 AM, eBird did not accept your key** |

**Decision on the sixth sentence (schema 4.7 flag):** yes. "offline" is advice to check your own connection, which is wrong when eBird itself answered badly. The schema's single `unreachable` outcome therefore splits by whether an answer arrived: `FetchResult.offline` and `.timeout` render **"offline"**; `.status(n)` for any n other than 429/401/403, `.tooLarge`, and a body that fails `RecentObsReducer` render **"eBird did not answer"**. The Engineer adds one outcome value beside `unreachable` (suggested `'no-answer'`, with `unreachable` narrowed to offline and timeout; the `stale-handover` internal reason from schema 3.6 belongs with `no-answer`), twinned in TS and covered by the parity fixture's `rejects`, `500`, `too-large` and `malformed` rows. No inbox write and no notification for either, as before.

**Caption** under the sentence when `lastCheck.from == 'fixed-fallback'` (a second line in the same paragraph, muted): **"From your fixed place"**.

**Blocked sentences** replace the last-check sentence entirely (the lead in 600 `--sr-text`, the rest muted; the first missing one, in FR-18's order):

| `blocked` | Rendered |
|---|---|
| `no-key` | **Add your eBird API key** in API Keys, above. Checks wait until then. |
| `no-backup` | **Load your eBird backup** in Default Files, above. Checks wait until then. |
| `no-place` | **Set a place to measure from.** Search a place name, enter coordinates, or use your location above. |
| `location-off` | **Location is off for SnowRaven.** Turn it on in Settings, Privacy & Security, Location Services, or set a fixed place instead. |
| `no-position` | **No recent position.** Open SnowRaven with Location on, or set a fixed place instead. |

### 5. The notes row (permissions and background refresh)

A second `.sr-row` directly under the status row, rendered only when it has something to say (it is not a live region; the status line is), holding one `.sr-ics-note` paragraph (0.75rem `--sr-text`):

- Notifications denied: **"Notifications are off for SnowRaven, so checks fill the inbox but no banner is sent. Turn them on in Settings, Notifications, SnowRaven."**
- Background App Refresh `denied` or `restricted` (schema's offered third sentence, adopted): **"Background App Refresh is off for SnowRaven, so checks run only when you open the app. Turn it on in Settings, General, Background App Refresh."**
- Both true: two paragraphs in that order.

### 6. Fine print

Two `.sr-fine` paragraphs (0.75rem muted, the first on a `--sr-border-subtle` top rule, `12px 16px 14px`), directly under the status and notes rows, inside the on/off reveal and above the Inbox row (7.1):

- **"A check sends the chosen coordinates to eBird with your own key, the same nearby-sightings request Nearby Lifers makes. Nothing is sent to the developer."** (FR-20, the durable network form)
- **"Alerts name species only. Spuhs, slashes and hybrids stay on the map and in the widgets, but never interrupt you."** (the FR-23 difference, stated in-app as well as in help)

### 7. The inbox (revised 2026-09-30)

#### 7.0 Superseded: the inline inbox

The first approved direction rendered the inbox inside the Settings card, below the fine print: a header row ("Inbox" plus a muted count and a Clear button), the rows, the empty state and the bound line. It was built that way, and at the live look the user found it hard to find and asked for the inbox as its own view with easier ways in. **That inline placement is superseded by 7.1 to 7.4 below.** The row anatomy, the empty sentence, the bound line and the Clear confirmation copy carry over unchanged; only where they render and how they are reached changes. One built detail is kept and is now the rule: rows render the bird name through `<BirdName commonName={row.comName} hasEntry={false} size="md" />` **without** the eBird / Birds of the World icon links (interactive content cannot nest inside the tappable row, and the row already opens the sighting).

#### 7.1 The Settings card's Inbox row (entry point 1)

The last element of the Alerts card, **outside** the on/off reveal so it can show while alerts are off, after the fine print.

- One full-width `Button` (`.sr-inbox-link`: `13px 16px`, top hairline `--sr-border-subtle`, hover `--sr-surface-subtle` at 120ms), `aria-haspopup="dialog"`, laid out as: a lucide `Bell` (15px, `--sr-accent`), a text column, a lucide `ChevronRight` (15px, muted).
- Text column, line 1: **"Inbox"** (0.8125rem/600 `--sr-text`). Line 2 (0.75rem muted): `"{n} alerts"` with the singular `"1 alert"`, followed by `", {k} new"` when the since-last-viewed count k is above zero (rendered example: **"6 alerts, 3 new"**); **"No alerts yet"** (no period) when the inbox is empty.
- Accessible name: `"Inbox, {n} alerts{, {k} new}"`, or **"Inbox, no alerts yet"**.
- **Visibility rule (shared by every entry point):** rendered when `settings.enabled` is true OR `inbox.length > 0`; absent (not hidden, not disabled) when alerts are off and the inbox is empty, so an off switch is never advertised. The row is iPhone and iPad only by construction, since the whole section is.
- Press: opens the sheet (7.3) with this row as the opener.

#### 7.2 The bell, the sidebar item and the palette row (entry points 2 and 3)

All three read the same gate as 7.1 (Alerts on or the inbox has rows; iPhone and iPad only; the webview's entry-safe `alertsState` store already carries both facts) and the same count (7.5). None exists on Mac, Windows or web/Pi.

- **iPhone header bell.** A 36px icon `Button` at the trailing edge of the phone header (`.sr-hdr-inbox`: `position: absolute; right: 12px`, vertically centered on the compact header, radius 8, muted lucide `Bell` 18px, hover `--sr-surface-subtle`), `aria-haspopup="dialog"`. A count badge (`.sr-badge`: 16px tall, min-width 16px, radius 8, `--sr-accent` fill, `--sr-on-accent` 0.625rem/700 tabular, top-right of the button, `aria-hidden`) shows the since-last-viewed count when above zero, capped in display at **"9+"**; no badge at zero. Accessible name: **"Alerts inbox"** with no count, **"Alerts inbox, 3 new"** with one. Rendered inside the phone `<header>`, so it inherits `chromeInert` and disappears under the fullscreen map exactly as the brand does. It must not collide with the centered brand at 320px and 200% text (the brand is ~140px wide; measured clear in the mockup).
- **iPad sidebar item.** In the nav column, directly under the existing Search field and above the destination list, the same `.sr-nav-item` anatomy as a destination (34px, radius 8, lucide `Bell` 16px, label **"Alerts inbox"**) but **not** a `role="tab"` and not in the saved order; at rail density an icon-only button carrying the same `aria-label` and the rail's hover name. A trailing count pill (`.sr-nav-count`: 18px, radius 9, `--sr-accent-bg` fill, `--sr-accent` 0.6875rem/700, `aria-hidden`) when the count is above zero. Accessible name as the bell's.
- **Command palette row.** One row in the palette's **Destinations** group, first in the group, label **"Alerts inbox"** with the lucide `Bell` glyph and the same count pill; accessible name as the bell's. Selecting it closes the palette and opens the sheet, with the palette's own opener as the sheet's focus-return target. It is a destination the user types for; it adds no new group and no new copy family.

#### 7.3 The sheet (iPhone) and panel (iPad)

One component at the App root, a sibling of the shell like Help and the palette, so it opens over any tab. `role="dialog" aria-modal="true" aria-labelledby` the title.

- **iPhone (phone density, 640px and below):** a bottom sheet in the More sheet's register: `--sr-scrim` root; `--sr-surface` panel, top radius 16, 1px `--sr-border` top edge, `--sr-card-shadow`, a 36x4 `--sr-border-medium` drag handle, max height 92% of the viewport, rising from the bottom. iOS safe-area insets apply at the bottom as the More sheet's do.
- **iPad (641px and up):** the same component as a centered panel in the dialog register: max width 520px, max height 80%, radius 14, 1px `--sr-border`, no handle; scales in from the control that opened it (transform-origin at the opener, like `ModalDialog`).
- **Header row** (`10px 12px 10px 18px`, bottom rule `--sr-border`): lucide `Bell` 16px `--sr-accent`; title `<h2>` **"Alerts inbox"** (0.9375rem/700, -0.01em) followed by a muted count at 0.75rem/500: `"{n} alerts"` / `"1 alert"`, nothing when empty; a 32px icon `Button` with lucide `X` 16px, accessible name **"Close the inbox"**, initial focus.
- **Body:** the scrolling region (the sheet, not the page, scrolls). Rows exactly as 7.0's anatomy: `<ul aria-label="Past alerts, newest first">`, each row a `Button` with `id="sr-alerts-row-{index}"` (index-keyed), the three-line grid (name 0.84375rem/500; distance `"{distanceMi.toFixed(1)} mi"` 0.8125rem/600 tabular top-right; place 0.75rem muted; `"Reported {day word} · Alerted {time}"` 0.71875rem muted with the day word at 600; `ChevronRight` 15px muted), hover `--sr-surface-subtle` 120ms. Accessible name `"{name}, {place}, {distance} miles, reported {day word}, alerted {time}. Show on the map"`.
- **The "New" mark:** a row whose `alertedAt` is after the last-viewed time (7.5) carries a 6px `--sr-accent` dot before the name and the word **"New"** after it (0.6875rem/600 `--sr-accent`), and its accessible name is prefixed **"New. "**. The name line wraps (`flex-wrap`) so the word follows the name at 200% text. The marks are computed when the sheet opens and stay for the life of that opening; they clear on close (7.5).
- **Empty state:** `.sr-empty` (0.8125rem muted, `22px 18px 24px`): **"No alerts yet."** and, on its own line at 0.75rem, **"A species eBird reports near your place that is not in your backup appears here, and as a notification."**
- **Footer** (top hairline, `10px 16px 18px`, wrapping): the bound line as a `.sr-fine` paragraph, **"Kept on this device for 30 days, up to 200 alerts, and never synced. Cleared with your eBird backup. Tap an alert to see it on the map."**, and a `.sr-btn-quiet` **"Clear"** on the right, native `disabled` when empty.
- **Closing, one path:** the X, a tap on the scrim outside the panel, a downward swipe on the handle (phone; a native-feel nicety, never the only way), and Escape. Focus returns to the opener (the card row, the bell, the sidebar item, or the palette's opener); if the opener has since unmounted or hidden (the gate flipped while open), focus goes to the Alerts switch when Settings is showing, else to `<main>`. The focus trap re-queries its focusables per keydown (the `useFocusTrap` the More sheet and `ModalDialog` use).
- **A row tap** closes the sheet, then opens Map Explorer's Nearby Lifers from that alert's point and radius with that species alone beside Show all (FR-37, unchanged); the tap-through decision in section 10 stands.
- **Stacking:** the shipped `ModalDialog` root is `z-index: 1200`, the More sheet root 1260 and the palette 1280. The inbox sheet's Clear confirmation must render **above** the sheet, so either the sheet sits below 1200 (1190 is above the fullscreen map's chrome handling as Help is) or the dialog is raised above the sheet; The Engineer picks and states it. The palette stays above the sheet (a palette-opened sheet closes the palette first, so they never overlap in practice).

#### 7.4 Turning alerts off

Unchanged: the inbox and every setting stay. The entry points stay too while the inbox has rows (the gate), and go when the user clears it.

#### 7.5 The since-last-viewed count and "last viewed"

- **Meaning:** the number of inbox rows whose `alertedAt` is later than `alertsInboxViewedAt`. It is shown on the bell badge, the sidebar pill, the palette pill and the card row's second line, all from one derivation.
- **Where "last viewed" lives:** one ISO-8601 timestamp, `alertsInboxViewedAt`, in the **device-local settings document** (`settings.json`) through the storage seam (`storage.getSetting` / `setSetting`, the `docChains` writer), **never synced** (the standing decision that settings stay on the device; the iCloud scope statement is untouched). It is not an alerts document and native never reads it; a missing value means every row is new, which is the right first-run reading. The Architect extends schema.md with this one field; nothing else changes shape.
- **When it is set:** to `snapshot.now` when the sheet **opens** (so a check that lands while the sheet is open shows as new on the next opening). The visible marks and badge update on **close**, so the user sees what was new while looking at it; the count is zero on close by construction.
- **Clear** empties the rows, so the count is zero after it; the timestamp is left alone.
- The count is never announced live; it is read in the control's accessible name when the control is reached.

### 8. Clear confirmation

The shared `ModalDialog` (`.sr-dlg-*`), opened from the sheet's footer Clear and rendered **above the sheet** (7.3, Stacking), `trigger` = the footer Clear button, `fallbackFocus` = the sheet's Close button (after a confirmed clear the trigger is disabled). After a confirmed clear the sheet stays open and shows the empty state.

- Title: **"Clear the inbox?"**
- Body: **"Removes every alert from this device. Your settings stay as they are, and alerts stay on. A species alerted before may alert again at the next check."**
- Actions, right-aligned, 96px minimum, stacking full width on the phone tier: `.sr-btn-quiet` **"Cancel"** (initial focus) and `.sr-btn-quiet sr-btn-quiet--danger` **"Clear"**.

### 9. The notification (native, `NotificationText.swift`)

Exactly one per check. Title `"{n} lifer reported {phrase}"` / `"{n} lifers reported {phrase}"`, phrase `near {name}` (place chosen by search) | `near you` (My location) | `nearby` (fixed place with no name). Body: up to three names nearest-first joined by `", "`, then `" and {n-3} more"`. Example: title **"3 lifers reported near Davis"**, body **"Sabine's Gull, Ruff, Baird's Sandpiper"**; with five hits **"Sabine's Gull, Ruff, Baird's Sandpiper and 2 more"**. Names are eBird's display names, no code, no favicon, no link. Default sound, thread `alerts`.

### 10. Where a tap lands (approved as designed; the user asked whether a tap should open the inbox and chose this)

- **Notification tap (FR-31):** Map Explorer, Nearby Lifers view, searching from the check's point and radius over the Day range, centered on the first-named species' sighting with every lifer shown (no focus pill). Saved Default Location and Radius unchanged. If the sighting is no longer reported, every lifer with the existing statement line.
- **Inbox row tap (FR-37):** the same view from that alert's own point and radius, that species alone and centered beside the existing **"Only {name} · Show all"** focus pill (`.sr-map-focus-btn`, the widget row precedent). Same fallback line when the species is gone.
- Neither landing is redesigned; the mockup's map frame is illustrative only.

## Component Usage

| Need | Component / register |
|---|---|
| Section header | `SectionHeader` (`label="Alerts"`, with an id for the switch's `aria-labelledby`) |
| Card and rows | the Settings card (`border 1px --sr-border`, radius 10, `--sr-surface`, `overflow: hidden`, `marginBottom: 24`) with `.sr-ics-row`-shaped rows on `--sr-border-subtle` |
| On/off, Quiet hours | `ToggleSwitch bare labelVisible={false}` |
| Cadence, Measure from | the Settings `RadioGroup` with Appearance's `toggleBtnStyle` |
| Time fields | native `<input type="time">` in the Default Location input register |
| Place search | `AddressSearch` (Map Explorer register, no `hint`) |
| Coordinates, Radius | Default Location `<input>` register (mono, 34px, radius 6) |
| Use my location, Follow Default Location, Clear, Cancel | `Button` with `.sr-btn-quiet` (`--danger` for the confirm) |
| Search | `Button` with `.sr-btn-accent` at 34px |
| Status | `role="status" aria-live="polite"` paragraph, `.sr-ics-status` register |
| Species names | `<BirdName>` (`hasEntry={false}`, no icon links inside a row) |
| Inbox row | `Button` (full-row, `.sr-alert` grid), inside the sheet |
| The inbox sheet / panel | one App-root overlay component: the More sheet's root, handle, rise and `useFocusTrap` at phone density; the `ModalDialog` panel register at 641px and up |
| Card Inbox row | `Button` (`.sr-inbox-link`) |
| Header bell | `Button` (`.sr-hdr-inbox` + `.sr-badge`) in the phone `<header>` |
| Sidebar item | `Button` in the nav column's `.sr-nav-item` register (+ `.sr-nav-count`), not a tab |
| Palette row | one Destinations row in `CommandPalette` (+ `.sr-nav-count`) |
| Confirmation | `ModalDialog`, stacked above the sheet |
| Icons | lucide `Navigation` (Use my location), `ChevronRight` (row affordance and the card row), `Bell` (every inbox entry and the sheet title), `X` (sheet close); nothing else |

Every button and link is the shared `Button` / `Link` primitive (tab-order contract). No new component, no new library.

## Design Tokens Applied

All from `globals.css`, both themes; no new token. Surfaces `--sr-surface`, `--sr-surface-subtle` (choice buttons at rest, hover); text `--sr-text`, `--sr-text-muted`, `--sr-text-disabled` (placeholders, disabled Clear); borders `--sr-border`, `--sr-border-subtle`, `--sr-border-medium` (hover, the sheet handle); accent `--sr-accent` (also the badge fill, the New dot and word, the bell glyph on the card row and sheet title), `--sr-accent-bg` (the count pills), `--sr-accent-border`, `--sr-accent-strong` (Search hover), `--sr-on-accent` (the badge figure: 5.7:1 light, 7.9:1 dark); switch `--sr-gray-400`, `--sr-switch-thumb`, `--sr-switch-thumb-shadow`; error `--sr-error`, `--sr-error-bg`, `--sr-error-border` (radius refusal, the danger Clear); overlays `--sr-scrim`, `--sr-card-shadow`. Type: Inter/system-ui stack, roles as above (sub-label 0.8125/600, body 0.8125 muted, hint 0.6875 muted, fine print 0.75 muted, field labels 0.6875/600 muted, row name 0.84375/500). All sizes in rem so the in-app Text Size scale applies; geometry in px.

## Interaction Notes

- **Reveal:** the configuration block is a `0fr/1fr` grid-collapse wrapper, `inert` while collapsed, opened by the switch. The quiet-hours times use the same mechanism inside their row.
- **No location read** on render, on choosing Fixed place, on editing coordinates, on searching, or on changing cadence, quiet hours or radius (QA-07). Only My location and Use my location read (schema 6.4).
- **Radius** is refused at entry (0, 26, decimals, non-numbers) with the alert line; the stored value is only ever a whole number 1..25.
- **Status** is recomputed from the snapshot on every render and on the native poke, and re-read on `visibilitychange`; its wording is `alertsCopy.ts`, scanned by `alertsCopy.test.ts` for U+2014, British spellings and the forbidden cadence words ("every hour", "exactly", any clock time in the cadence sentence).
- **Accessibility:** switch, cadence and model expose state through `role="switch"` / `role="radio"` (`aria-checked`, roving tabindex with arrow keys, Home, End); the status line is the one live region in the section; the Clear dialog traps focus, closes on Escape, backdrop and both buttons through one path, and returns focus to the sheet's Clear (or its Close after a confirmed clear); every DOM id is index-keyed. The sheet is `role="dialog" aria-modal="true"` labelled by its title, traps focus, and returns it to the opener (7.3). Every entry control carries `aria-haspopup="dialog"` and a name that includes the count (**"Alerts inbox"** / **"Alerts inbox, 3 new"**; the card row **"Inbox, 6 alerts, 3 new"** / **"Inbox, no alerts yet"**); the badge and pills themselves are `aria-hidden`. The count is not a live region.
- **The entry gate** is one predicate read from the entry-safe `alertsState` store: `settings.enabled || inbox.length > 0`, on iPhone and iPad only (`alertsSupported()`), evaluated on every snapshot. It must be absent markup when false (not `display: none`, not `disabled`), so a tab-order or presence test cannot find an inbox control while alerts are off and empty.
- **Layout floors:** no positive `min-width` anywhere; grids use `minmax(min(Nrem, 100%), 1fr)`; the summary line, the button row, the status row, the sheet footer and the row name line wrap. Verified in the mockup at 390 and 320px, both themes, 100% and 200% text, and on the 900px iPad frame with the sidebar nav; the sheet verified in the same set.
- **Tester reference, `design.html` query-string states** (the frame is a true phone viewport; its content scrolls inside it and the overlays are viewport-fixed): `?on=1` (configured, 3 lifers, the card's Inbox row and the header bell with a count of 3); `?on=1&sheet=1` (the inbox sheet open); `?on=1&sheet=1&theme=dark`; `?on=1&device=ipad&sheet=1` (the iPad panel and the sidebar's Alerts inbox item); `?on=1&palette=1` (the command palette with the Alerts inbox row); `?on=1&new=0` (no count anywhere); `?on=1&inbox=empty&sheet=1` (the empty sheet); `?inbox=empty` (alerts off and empty: no bell, no row, no palette row); `?on=1&scale=2&sheet=1` (200% text); plus the earlier `?on=1&theme=dark`, `?on=1&device=ipad`, `?on=1&scale=2`, `?on=1&status={hits|nothing|notyet|offline|noanswer|busy|badkey|fallback|nokey|nobackup|noplace|locoff|noposition|notifdenied|bgoff}`, `?on=1&quiet=1`, `?on=1&model=my-location`, `?on=1&cadence=daily`, `?on=1&place=follow`, `?on=1&inbox=empty`. Parameters combine. With no `on=1` the page opens in the OFF state and pressing the switch shows the system-prompt placeholder. In the mockup, closing the sheet with new rows clears the marks and the badge, which is the real behavior.

## Motion Spec

- Switch track and knob: `background-color` and `left`, ease-out, 180ms, reduced motion instant (the shipped `ToggleSwitch`), CSS.
- Configuration reveal (and the quiet-hours times): `grid-template-rows` 0fr to 1fr, `cubic-bezier(0.2, 0, 0, 1)`, 220ms, origin the row above it; collapse the same; reduced motion instant, CSS.
- Choice buttons, quiet buttons, inbox rows: color and background, ease-out, 120ms, reduced motion instant, CSS.
- Clear dialog: scrim opacity 160ms ease-out; panel opacity plus scale 0.94 to 1 over 160ms `cubic-bezier(0.2, 0, 0, 1)` with `transform-origin` at the Clear button (the shared `ModalDialog` shell's trigger-origin behavior); close 120ms; reduced motion instant, CSS.
- Status line, notes, sub-label swap, off/on sentence swap, radius refusal: no animation (a consequence appears where its cause is).
- Inbox sheet, phone: scrim opacity 160ms ease-out; panel `translateY(100%)` to 0 over 220ms `cubic-bezier(0.2, 0, 0, 1)`, origin the bottom edge it rises from (the More sheet's motion); close the same in reverse; reduced motion instant, CSS.
- Inbox panel, iPad: scrim 160ms ease-out; panel opacity plus scale 0.96 to 1 over 160ms `cubic-bezier(0.2, 0, 0, 1)` with `transform-origin` at the opener; reduced motion instant, CSS.
- Bell, card row, sidebar item, sheet close: background and color, ease-out, 120ms; reduced motion instant, CSS. The badge and the count pills appear and change with no animation.
- Palette row: the palette's own entrance; nothing added.
- Nothing animates on mount; no pulsing, no stagger, no overshoot.

## Content Notes

- Voice: the widgets' register. Short, plain, one thing at a time; a problem sentence names the one thing in the way and where to fix it.
- American spelling; no em dash (U+2014) anywhere; middle dot (U+00B7) as the in-line separator; ellipsis U+2026 in "Locating…".
- Cadence copy contains "about once an hour" and "about once a day" and never "every hour", "exactly" or a clock time.
- Relative day words in the inbox follow the widgets: today, yesterday, N days ago. Times are 12-hour local with AM/PM. Distances one decimal with the unit `mi` in rows and the word `miles` in sentences.
- Example content used in the mockup is illustrative only: Davis, CA (38.54490, -121.74050); Yolo Bypass Wildlife Area, Davis Wetlands, Yolo County Central Landfill, Putah Creek Riparian Reserve, Lake Solano County Park; Ruff, Sabine's Gull, Baird's Sandpiper, Pectoral Sandpiper, Broad-winged Hawk, Lesser Black-backed Gull.
- `docs/HELP.md`'s Alerts subsection (FR-44) restates the two fine-print sentences and the My location sentence in the same words, and gains one sentence on where the inbox is: reached from the Inbox row on the Alerts card, the bell at the top of the screen on iPhone (the Alerts inbox item in the sidebar on iPad), or Search; the bell shows how many alerts arrived since you last opened the inbox.
- **New strings in the revision, verbatim** (for `alertsCopy.ts`): "Inbox"; "{n} alerts" / "1 alert"; ", {k} new"; "No alerts yet" (the card row, no period); "Inbox, {n} alerts{, {k} new}"; "Inbox, no alerts yet"; "Alerts inbox"; "Alerts inbox, {k} new"; "9+"; "Close the inbox"; "New" and the name prefix "New. "; "No alerts yet." with "A species eBird reports near your place that is not in your backup appears here, and as a notification."; "Past alerts, newest first" (unchanged); the bound line (unchanged); "Clear", "Clear the inbox?", "Cancel" and the dialog body (unchanged).
