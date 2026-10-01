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
// only on CLOSE, so the marks and the badge the user is looking at do not
// change under them. Clear leaves the timestamp alone.
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

  return { open, openInbox, closeInbox, openerEl }
}
