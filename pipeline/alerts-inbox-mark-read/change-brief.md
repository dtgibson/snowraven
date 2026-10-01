# Change Brief: Alerts inbox "Mark read"

## What is changing
The iOS Alerts inbox sheet (iPhone bottom sheet, iPad panel) gains a **Mark read** button in its footer beside **Clear**. Pressing it clears every "New" mark in the open sheet right away and zeroes the count on the bell, the iPad sidebar item, the Search row and the Settings Inbox row. It removes no alerts. "Read" uses the model already shipped: one "last viewed" time (`alertsInboxViewedAt` in `settings.json`). Mark read moves that time forward to the current snapshot's `now`, checked by the existing `parseViewedAt`, and writes it through the storage seam just as opening the sheet does. Nothing is stored per alert and no new setting is added. Alerts that arrive later still show as New. Rows alerted in the same second as that `now` are read, because `isNewSince` uses a strict `>`.

## Why now
The user asked for it ("a Mark read button ... alongside the existing button that clears the alerts"). Today the only way to clear New marks is to close the sheet, and nothing on screen says so. Design-spec 7.5 keeps the marks for the whole time the sheet is open on purpose. A check that lands while the sheet is open still counts as new after it closes, because "last viewed" was taken when the sheet opened. Mark read gives the user a direct way to say "I've seen these", and it also covers that late-arrival case.

## Branch check (Improve, with reasons)
- Passes. No new screen, flow or data: it moves the existing "last viewed" time, which opening and closing the sheet already does. The only thing that changes is when it moves.
- Borderline on one rule taken literally ("a user can interact with something they couldn't before"): a new button is a new control. I judged it Improve because the result (marks cleared, badge at zero) is already reachable, and no strategy or PRD work is needed.
- Out of scope, and a New Feature if wanted: read state per alert (that needs a stored set of read ids), and any "mark unread".

## User-facing impact
iPhone and iPad only (the inbox exists only there). There is one new footer button. New marks and the counts clear when the user presses it, where today they clear only on close. Mac, Windows and web/Pi do not change. `docs/HELP.md`'s inbox paragraph gets one sentence (no stop needed). The App Store "What's New" line is held for the user's express yes at ship. README, website, privacy policy and listing body do not change: "last viewed" is still device-local and never synced, so the privacy sentence still holds.

## Design pass
**Needed.** The sheet footer gets a second button. The Designer decides:
- The label: the user said "Mark read". It acts on every row, so "Mark all read" is a fair alternative to weigh.
- Order and placement: suggested just before Clear, same `.sr-btn-quiet sr-touch-target` register, so Clear (destructive) keeps the trailing edge. Both must wrap cleanly under the fine print at 320px and 200% text, in the phone sheet and in the iPad panel.
- State: suggested native `disabled` when no row is marked New, which matches Clear when the inbox is empty. No confirmation, since nothing is removed.
- Where focus goes when the pressed button disables itself (never `<body>`; Close is the existing fallback), plus a one-time polite confirmation that names the action, never a count (7.5: "the count is never announced live").
- Whether the marks just disappear or fade (reduced motion respected).

## Decisions touched
- **ios-alerts design-spec 7.5 / 7.3 (modified, not reversed):** "marks stay for the life of that opening; they clear on close" becomes "...unless the user presses Mark read". When the sheet opens, "last viewed" is still written then, and the counts still update on close.
- **DECISIONS.md v1.0.42 iOS Alerts, inbox bullet (kept):** one device-local "last viewed" setting through the storage seam, never synced, never read by native. Mark read becomes its second writer, through the same seam and the same `parseViewedAt` check.
- **ios-alerts schema.md `alertsInboxViewedAt` row:** its writer column names `openInbox` only. That build record is closed, so it is not edited. The new writer is recorded in this run and in DECISIONS.md.
- **"Clear leaves the timestamp alone" (7.5):** unchanged.

## Scope
**Changes:** `lib/alerts/alertsInboxHost.ts` (a `markRead` that validates `snapshot.now`, writes the setting, updates the store, updates `open.viewedAt` so the sheet marks again, and sets the pending value so **close can never move "last viewed" backwards**: today close writes the value taken at open); `components/AlertsInboxSheet.tsx` (the button, the enabled rule, focus); `App.tsx` (one prop); `lib/alerts/alertsCopy.ts` (the label and any status text); `globals.css` (footer layout for two buttons); the header comments in `alertsInboxHost.ts` and `alertsInboxEntry.ts` that say "last viewed" is written only on open; `docs/HELP.md`; the four-file version bump plus CHANGELOG (the Engineer does this).
**Unchanged:** all Swift and Rust, the App Group documents, `alertsController.ts`, `parseViewedAt`, `isNewSince` / `newSinceViewed`, the entry controls, Clear and its dialog, the published copy.

## What done looks like
- Tests in `AlertsInboxSheet.test.tsx` (the host block):
  - Pressing Mark read with New rows clears every "New. " name prefix in place, writes `alertsInboxViewedAt` = the snapshot's `now`, and sets the store's count to 0 before close.
  - After close the value does not go back to the open-time value.
  - A row that arrives later (newer snapshot) shows New again and re-enables the button.
  - The button is disabled with nothing new; a `now` that `parseViewedAt` refuses is neither written nor kept; focus never lands on `<body>`.
- `tabOrderCoverage` and the copy corpus stay green; `npm run build` passes.
