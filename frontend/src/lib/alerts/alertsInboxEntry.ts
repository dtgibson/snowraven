// The Alerts inbox's ENTRY POINTS, entry-safe (ios-alerts design-spec 7.1,
// 7.2 and 7.5, the revision after the live look). The iPhone header bell and
// the iPad sidebar item ride the App shell, which is on the entry chunk, so the
// one gate, the one count and the few words they print live here, beside the
// store, and not in the lazy `alertsCopy.ts` (which re-exports them, so its
// corpus sweep still covers every string). entryChunk.test.ts asserts this
// module IS on the entry graph and imports nothing but the store.
//
// THE GATE is one predicate: alerts on, OR the inbox has rows, on iPhone and
// iPad only. Every entry control renders ABSENT markup when it is false (never
// hidden, never disabled), so an off switch is never advertised and a presence
// or tab-order test cannot find an inbox control while alerts are off and empty.
//
// THE COUNT is the number of rows alerted after "last viewed", a device-local
// ISO timestamp in settings.json (`alertsInboxViewedAt`, written through the
// storage seam when the sheet opens and when Mark read is pressed in it, never
// synced, never read by native). A missing value means every row is new, which
// is the right first-run reading.

import { alertsSupported, useAlertsState, type AlertsSnapshot, type InboxRow } from './alertsState'

/** The settings.json key for "last viewed" (schema.md, the revision row). */
export const INBOX_VIEWED_SETTING = 'alertsInboxViewedAt'

/** The bell's, the sidebar item's, the palette row's and the sheet's name. */
export const INBOX_ENTRY_LABEL = 'Alerts inbox'
/** The badge's display cap. */
export const BADGE_CAP_TEXT = '9+'

/** "Alerts inbox" with no count, "Alerts inbox, 3 new" with one. */
export function inboxEntryName(newCount: number): string {
  return newCount > 0 ? `${INBOX_ENTRY_LABEL}, ${newCount} new` : INBOX_ENTRY_LABEL
}

/** The badge figure, capped in display at "9+". */
export function badgeText(newCount: number): string {
  return newCount > 9 ? BADGE_CAP_TEXT : String(newCount)
}

/** The gate's data half: alerts on, or the inbox has rows. */
export function inboxEntryOpen(snap: AlertsSnapshot | null): boolean {
  return snap !== null && (snap.settings.enabled || snap.inbox.length > 0)
}

/** A row alerted after "last viewed" (every row, when it was never viewed). */
export function isNewSince(row: InboxRow, viewedAt: string | null): boolean {
  if (viewedAt === null) return true
  const at = Date.parse(row.alertedAt)
  const seen = Date.parse(viewedAt)
  return Number.isFinite(at) && Number.isFinite(seen) && at > seen
}

/** The since-last-viewed count: one derivation for the bell, the sidebar, the
 *  palette and the card row. */
export function newSinceViewed(inbox: readonly InboxRow[], viewedAt: string | null): number {
  let n = 0
  for (const r of inbox) if (isNewSince(r, viewedAt)) n += 1
  return n
}

const VIEWED_AT_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,3})?Z$/
/** The build's existing plausibility window: more than 24 hours ahead of now
 *  is a time the clock wrote while running ahead (ALERT_FUTURE_SKEW_HOURS). */
const FUTURE_SKEW_MS = 24 * 3_600_000

/**
 * "Last viewed" as stored, validated on read: an ISO-8601 UTC instant that
 * round-trips through `Date` (so an impossible calendar date is refused rather
 * than rolled into a real one) and is no more than 24 hours ahead of `nowMs`.
 * Anything else, including a non-string from a hand-edited settings.json,
 * reads as absent, which counts every row as new.
 */
export function parseViewedAt(raw: unknown, nowMs: number): string | null {
  if (typeof raw !== 'string' || raw.length > 30 || !VIEWED_AT_RE.test(raw)) return null
  const ms = Date.parse(raw)
  if (!Number.isFinite(ms)) return null
  if (new Date(ms).toISOString().slice(0, 19) !== raw.slice(0, 19)) return null
  if (ms - nowMs > FUTURE_SKEW_MS) return null
  return raw
}

/** The control that opened the sheet, as a getter (the ModalDialog trigger
 *  contract), plus an optional second choice: the shape `restoreOpenerFocus`
 *  (lib/paletteFocus.ts) takes. */
export interface InboxOpener {
  trigger: () => HTMLElement | null
  fallback?: () => HTMLElement | null
}

let opener: ((o: InboxOpener) => void) | null = null

/** App.tsx installs the one function that opens the App-root sheet. */
export function installInboxOpener(fn: ((o: InboxOpener) => void) | null): void {
  opener = fn
}

/** Every entry control calls this; a no-op until App has installed it. */
export function openAlertsInbox(o: InboxOpener): void {
  opener?.(o)
}

/** The gate and the count, from the store, for a render. */
export function useInboxEntry(): { visible: boolean; count: number } {
  const { snapshot, inboxViewedAt } = useAlertsState()
  const visible = alertsSupported() && inboxEntryOpen(snapshot)
  return { visible, count: visible && snapshot ? newSinceViewed(snapshot.inbox, inboxViewedAt) : 0 }
}
