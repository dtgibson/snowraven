// The App-root host of the Alerts inbox sheet (ios-alerts design-spec 7.3 and
// 7.5, the revision after the live look): opening, closing, "last viewed" and
// where focus returns. A hook in its own module, because the sheet's close and
// the restore have to live at the App root (the sheet unmounts on close, so an
// effect inside it could not run after the close commits: the
// `restorePaletteFocusRef` shape App.tsx already uses for the palette) and no
// test in this repo renders App.tsx. Everything that DECIDES is here, where a
// small harness can drive it; App.tsx calls the hook and renders the lazy sheet.
//
// ENTRY-SAFE: it imports the store, the entry module, the storage seam and the
// pure focus decision, all already on the entry graph; never the sheet.
//
// "LAST VIEWED" (7.5). Opening writes `snapshot.now` to settings.json through
// the storage seam (`docChains`; device-local, never synced, never read by
// native), so a check that lands while the sheet is open shows as new on the
// next opening. The store's own copy, which every count reads, moves forward
// on CLOSE, so the marks and the badge the user is looking at do not change
// under them, unless the user presses Mark read. Clear leaves the timestamp
// alone.
//
// MARK READ (alerts-inbox-mark-read) is the second writer, through the same
// seam and the same `parseViewedAt` check: it moves "last viewed" to the
// CURRENT snapshot's `now` (newer than the opening's when a check landed while
// the sheet was open), writes it to disk, moves the store's copy at once (so
// every count reads zero before the close) and the open sheet's marks with it.
// It also becomes the pending value the close commits, so a close can never
// move "last viewed" back to the time taken at opening. A `now` the read would
// refuse is neither written nor kept, exactly as on opening.
//
// FOCUS (7.3). Back to the control that opened the sheet; if it has since
// unmounted or hidden (the gate flipped while open), to the Alerts switch when
// Settings is showing, else to <main>. `restoreOpenerFocus` reads
// `document.activeElement` back after each try, so a target hidden with its tab
// (`display: none`) falls through rather than ending the restore on <body>.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { alertsActions, alertsSupported, getAlertsState, setAlertsState, type InboxRow } from './alertsState'
import { INBOX_VIEWED_SETTING, installInboxOpener, parseViewedAt, type InboxOpener } from './alertsInboxEntry'
import { restoreOpenerFocus } from '../paletteFocus'
import { storage } from '../storage'

/** The section's switch: the fallback when the opener is gone. Focusing it
 *  fails (and the restore falls through to <main>) unless Settings is showing. */
function alertsSwitch(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.sr-alerts-switch [role="switch"]')
}

export interface AlertsInboxHost {
  /** Non-null while the sheet is open: the "last viewed" it marks against. */
  open: { viewedAt: string | null } | null
  openInbox: (o: InboxOpener) => void
  /** The sheet's one close path, after its exit; a chosen row opens the map AFTER the close. */
  closeInbox: (row: InboxRow | null) => void
  /** Mark read: "last viewed" moves to the snapshot's `now`, on disk, in the
   *  store and in the open sheet, and a later close cannot move it back. False
   *  when nothing moved (a `now` the read would refuse), so the sheet does not
   *  announce an action that did not happen. */
  markRead: () => boolean
  /** The opener's element, for the iPad panel's transform-origin. */
  openerEl: () => HTMLElement | null
}

export function useAlertsInboxHost(mainRef: RefObject<HTMLElement | null>): AlertsInboxHost {
  const [open, setOpen] = useState<{ viewedAt: string | null } | null>(null)
  const openerRef = useRef<InboxOpener | null>(null)
  const pendingRef = useRef<string | null>(null)
  const restoreRef = useRef(false)

  const openInbox = useCallback((o: InboxOpener) => {
    // iPhone and iPad only, whoever calls it: the palette row calls this
    // directly rather than through the opener registry, so the gate is here too.
    if (!alertsSupported()) return
    const st = getAlertsState()
    openerRef.current = { trigger: o.trigger, fallback: () => o.fallback?.() ?? alertsSwitch() }
    // The snapshot's `now` is native's clock: validated ONCE, by the same rule
    // the read uses, and that one result is what is written to disk and what
    // the store takes on close, so memory and disk always agree. A value the
    // read would refuse is neither written nor kept.
    const now = parseViewedAt(st.snapshot?.now, Date.now())
    pendingRef.current = now
    if (now) void storage.setSetting(INBOX_VIEWED_SETTING, now).catch(() => {})
    setOpen({ viewedAt: st.inboxViewedAt })
  }, [])

  const closeInbox = useCallback((row: InboxRow | null) => {
    if (pendingRef.current) setAlertsState({ inboxViewedAt: pendingRef.current })
    pendingRef.current = null
    restoreRef.current = true
    setOpen(null)
    // FR-37, unchanged: the row's own link through the one parser and the one
    // Map Explorer effect. After the close, so the map is what the user sees.
    if (row) alertsActions.openRow(row)
  }, [])

  const markRead = useCallback((): boolean => {
    if (!alertsSupported()) return false
    // The same one validation opening uses, so memory and disk still agree.
    const now = parseViewedAt(getAlertsState().snapshot?.now, Date.now())
    if (!now) return false
    pendingRef.current = now
    void storage.setSetting(INBOX_VIEWED_SETTING, now).catch(() => {})
    setAlertsState({ inboxViewedAt: now })
    setOpen(o => (o ? { viewedAt: now } : o))
    return true
  }, [])

  const openerEl = useCallback(() => openerRef.current?.trigger() ?? null, [])

  // The one opener every entry control calls (iPhone and iPad only).
  useEffect(() => {
    if (!alertsSupported()) return
    installInboxOpener(openInbox)
    return () => installInboxOpener(null)
  }, [openInbox])

  // After the close commits (the sheet has unmounted), never inside it.
  useEffect(() => {
    if (open || !restoreRef.current) return
    restoreRef.current = false
    restoreOpenerFocus(openerRef.current, mainRef.current)
  }, [open, mainRef])

  return { open, openInbox, closeInbox, markRead, openerEl }
}
