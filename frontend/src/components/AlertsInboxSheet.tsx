// The Alerts inbox as its own view (ios-alerts design-spec 7.3, 7.5 and 8; the
// revision after the live look, which found the inline inbox in Settings hard
// to find). ONE App-root overlay, a sibling of the shell like Help and the
// palette, so it opens over any tab, at two densities chosen by CSS alone: the
// More sheet's register at phone width (scrim, a panel rising from the bottom
// edge, a drag handle, the bottom safe area) and the ModalDialog panel register
// at 641px and up (centered, scaling in from the control that opened it).
//
// LAZY: App.tsx imports it through import() and only on iPhone and iPad (the
// opener is installed there alone), so neither it nor BirdName nor the copy
// module rides the entry chunk (entryChunk.test.ts).
//
// ONE CLOSE PATH. The X, a mousedown on the scrim outside the panel, a downward
// swipe on the handle (phone; a nicety, never the only way) and Escape all run
// `requestClose`, which plays the exit and then hands control to the host
// (lib/alerts/alertsInboxHost.ts), which unmounts this and returns focus to the
// opener from an effect after the close commits. A row tap closes the same way
// and the host opens the map AFTER the close (FR-37, unchanged).
//
// STACKING. The root is `z-index: 1270`: above the fullscreen map and the phone
// bar (1200) and the More sheet (1260), below the palette (1280). The Clear
// confirmation is the shared ModalDialog rendered as a CHILD of this root and a
// SIBLING of the panel, so it stacks inside this root's own stacking context,
// above the panel, whatever its own 1200 says; it is outside the panel because
// the panel carries a transform, which would make it the containing block of a
// fixed-position descendant. While the confirmation is open this sheet's Escape
// and focus trap stand down, so one Escape closes only the dialog.
//
// FOCUS. The trap is the shared useFocusTrap (per-keydown re-query; the
// keydown arm only, as the More sheet and ModalDialog use it: every focusable in
// the panel is a shared Button primitive, so WebKit's tab order and the trap's
// list agree). Initial focus is the Close button.
//
// MARK READ (alerts-inbox-mark-read). Beside Clear, enabled while any row is
// New against `viewedAt`. A press moves focus to Close FIRST (the button is
// about to disable itself, and focus must never fall to <body>), then has the
// host move "last viewed" (disk, store and this sheet's `viewedAt`, at once),
// then sets the one polite status sentence. The rows' accessible names drop
// "New. " with the new `viewedAt` straight away; only the VISIBLE marks (the
// dot and the word, both aria-hidden) keep the pre-press value while they fade
// (`.sr-alert--read`), until their transitionend or a fallback, then unmount.

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Bell, ChevronRight, X } from 'lucide-react'
import { Button } from './ui/Button'
import { ModalDialog } from './ui/ModalDialog'
import { BirdName } from './BirdName'
import { useFocusTrap } from '../lib/useFocusTrap'
import { alertsActions, useAlertsState, type InboxRow } from '../lib/alerts/alertsState'
import { isNewSince } from '../lib/alerts/alertsInboxEntry'
import * as C from '../lib/alerts/alertsCopy'

type Phase = 'enter' | 'open' | 'closing'

/** The exit's fallback for engines that emit no transitionend (jsdom). */
const CLOSE_FALLBACK_MS = 260
/** A downward drag on the handle past this many px closes the sheet. */
const SWIPE_CLOSE_PX = 56
/** The marks' fade is 160ms; this ends it where no transitionend arrives. */
const MARKS_FADE_FALLBACK_MS = 200
/** How long "Marked read." stays in the status region before it is cleared. */
const STATUS_CLEAR_MS = 4000

export interface AlertsInboxSheetProps {
  /** "Last viewed" as of this opening: the New marks are computed against it
   *  and stay for the life of the opening (design-spec 7.5) unless Mark read
   *  moves it, when the host passes the new value. */
  viewedAt: string | null
  /** The control that opened the sheet: the iPad panel scales in from it. */
  opener: () => HTMLElement | null
  /** Called once, after the exit, with the row that was tapped (or null). */
  onClosed: (row: InboxRow | null) => void
  /** Mark read: the host moves "last viewed" to the snapshot's `now`; false
   *  when it could not (then nothing fades and nothing is announced). */
  onMarkRead: () => boolean
}

export default function AlertsInboxSheet({ viewedAt, opener, onClosed, onMarkRead }: AlertsInboxSheetProps) {
  const { snapshot: snap } = useAlertsState()
  const inbox = snap?.inbox ?? []
  const nowMs = snap ? Date.parse(snap.now) : 0
  const titleId = useId()

  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const clearRef = useRef<HTMLButtonElement>(null)
  const [phase, setPhase] = useState<Phase>('enter')
  const [clearOpen, setClearOpen] = useState(false)
  // While the marks fade after a Mark read: the `viewedAt` they were drawn
  // against before the press (a wrapper, because null is a real value: never viewed).
  const [fade, setFade] = useState<{ from: string | null } | null>(null)
  // The status sentence, in a sequence-keyed child so a second press announces (ui.md).
  const [status, setStatus] = useState<{ seq: number; text: string }>({ seq: 0, text: '' })
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Refs for the document listener, which must read the CURRENT values.
  const phaseRef = useRef<Phase>('enter')
  const clearOpenRef = useRef(false)
  const chosenRef = useRef<InboxRow | null>(null)
  const closedRef = useRef(false)
  const dragRef = useRef<{ id: number; y: number } | null>(null)

  useEffect(() => { phaseRef.current = phase }, [phase])
  useEffect(() => { clearOpenRef.current = clearOpen }, [clearOpen])

  // Mount closed, then open on the next frame so the rise (or scale) runs.
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setPhase(p => (p === 'enter' ? 'open' : p)))
    return () => cancelAnimationFrame(id)
  }, [])

  // The iPad panel scales in FROM the opener (the ModalDialog shell's
  // trigger-origin behaviour). Harmless at phone width, where it rises.
  useLayoutEffect(() => {
    const panel = panelRef.current
    const t = opener()
    if (!panel || !t) return
    const tr = t.getBoundingClientRect()
    const pr = panel.getBoundingClientRect()
    panel.style.transformOrigin = `${tr.left + tr.width / 2 - pr.left}px ${tr.top + tr.height / 2 - pr.top}px`
  }, [opener])

  useEffect(() => { closeRef.current?.focus() }, [])

  const requestClose = useCallback((row: InboxRow | null = null) => {
    if (phaseRef.current === 'closing') return
    chosenRef.current = row
    phaseRef.current = 'closing'
    setPhase('closing')
    setStatus(s => (s.text ? { seq: s.seq, text: '' } : s))
  }, [])

  // The status timer never outlives the sheet.
  useEffect(() => () => { if (statusTimerRef.current) clearTimeout(statusTimerRef.current) }, [])

  // The marks' fade ends on their own opacity transitionend, or the fallback;
  // then they adopt the new `viewedAt` and unmount. Under reduced motion the
  // global rule makes the transition near-instant, so they simply go.
  useEffect(() => {
    if (!fade) return
    const panel = panelRef.current
    const done = () => setFade(null)
    const onEnd = (e: TransitionEvent) => {
      const t = e.target
      if (e.propertyName === 'opacity' && t instanceof Element && t.matches('.sr-alert--read .sr-alert-dot, .sr-alert--read .sr-alert-new')) done()
    }
    panel?.addEventListener('transitionend', onEnd)
    const timer = setTimeout(done, MARKS_FADE_FALLBACK_MS)
    return () => {
      panel?.removeEventListener('transitionend', onEnd)
      clearTimeout(timer)
    }
  }, [fade])

  const anyNew = inbox.some(row => isNewSince(row, viewedAt))

  const pressMarkRead = () => {
    // 1. Focus first: this button is about to disable itself. Close is always
    //    mounted with the sheet; <main> is 7.3's last resort, never <body>.
    const close = closeRef.current
    if (close) close.focus()
    else document.querySelector<HTMLElement>('main')?.focus()
    // 2. The host: disk, store and this sheet's `viewedAt`, none of it delayed
    //    by the fade, which keeps the pre-press value for the visible marks only.
    if (!onMarkRead()) return
    setFade({ from: viewedAt })
    // 3. One polite sentence naming the action, cleared after a while.
    setStatus(s => ({ seq: s.seq + 1, text: C.MARKED_READ_STATUS }))
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    statusTimerRef.current = setTimeout(() => {
      statusTimerRef.current = null
      setStatus(s => ({ seq: s.seq, text: '' }))
    }, STATUS_CLEAR_MS)
  }

  // The exit, then the host: on the panel's own transition end, or the fallback.
  useEffect(() => {
    if (phase !== 'closing') return
    const panel = panelRef.current
    const finish = () => {
      if (closedRef.current) return
      closedRef.current = true
      onClosed(chosenRef.current)
    }
    const onEnd = (e: TransitionEvent) => { if (e.target === panel) finish() }
    panel?.addEventListener('transitionend', onEnd)
    const timer = setTimeout(finish, CLOSE_FALLBACK_MS)
    return () => {
      panel?.removeEventListener('transitionend', onEnd)
      clearTimeout(timer)
    }
  }, [phase, onClosed])

  // Escape: this sheet's layer, standing down while the confirmation is open
  // (its own document listener closes it). Bubble phase, like ModalDialog's.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || clearOpenRef.current || phaseRef.current === 'closing') return
      e.preventDefault()
      requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [requestClose])

  useFocusTrap(phase !== 'closing' && !clearOpen, panelRef)

  const rootClass =
    'sr-inbox-root' +
    (phase === 'open' ? ' sr-inbox-root--open' : '') +
    (phase === 'closing' ? ' sr-inbox-root--closing' : '')

  return (
    <div
      className={rootClass}
      role="presentation"
      // mousedown, not click: a press that STARTED inside the panel and ended on
      // the scrim must not close it (the More sheet rule). A mousedown on the
      // confirmation's own scrim targets that root, not this one.
      onMouseDown={e => { if (e.target === e.currentTarget) requestClose() }}
    >
      <div ref={panelRef} className="sr-inbox-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div
          className="sr-inbox-grab"
          aria-hidden="true"
          onPointerDown={e => {
            dragRef.current = { id: e.pointerId, y: e.clientY }
            e.currentTarget.setPointerCapture?.(e.pointerId)
          }}
          onPointerUp={e => {
            const d = dragRef.current
            dragRef.current = null
            if (d && d.id === e.pointerId && e.clientY - d.y >= SWIPE_CLOSE_PX) requestClose()
          }}
          onPointerCancel={() => { dragRef.current = null }}
        >
          <div className="sr-inbox-handle" />
        </div>
        <div className="sr-inbox-head">
          <Bell size={16} strokeWidth={2.2} aria-hidden="true" className="sr-inbox-glyph" />
          <h2 className="sr-inbox-title" id={titleId}>
            {C.INBOX_ENTRY_LABEL}
            {inbox.length > 0 ? <small>{C.inboxCount(inbox.length)}</small> : null}
          </h2>
          <Button
            ref={closeRef}
            type="button"
            className="sr-inbox-close"
            aria-label={C.CLOSE_INBOX}
            onClick={() => requestClose()}
          >
            <X size={16} strokeWidth={2.2} aria-hidden="true" />
          </Button>
        </div>

        <div className="sr-inbox-body">
          {inbox.length > 0 ? (
            <ul className="sr-alerts-inbox sr-inbox-list" aria-label={C.INBOX_LIST_LABEL}>
              {inbox.map((row, i) => {
                const w = C.rowWhen(row, nowMs)
                const isNew = isNewSince(row, viewedAt)
                // Read by Mark read but still fading: visible marks only.
                const leaving = !isNew && fade !== null && isNewSince(row, fade.from)
                const marked = isNew || leaving
                return (
                  <li key={row.id}>
                    <Button
                      type="button"
                      id={`sr-alerts-row-${i}`}
                      className={'sr-alert' + (marked ? ' sr-alert--new' : '') + (leaving ? ' sr-alert--read' : '')}
                      aria-label={C.rowLabel(row, nowMs, undefined, undefined, isNew)}
                      onClick={() => requestClose(row)}
                    >
                      {/* Inside a button, so no favicon links: interactive
                          content cannot nest in a button, and the row tap
                          already opens the sighting. */}
                      <span className="sr-alert-name" aria-hidden="true">
                        {marked && <span className="sr-alert-dot" />}
                        <BirdName commonName={row.comName} hasEntry={false} size="md" />
                        {marked && <span className="sr-alert-new">{C.NEW_WORD}</span>}
                      </span>
                      <span className="sr-alert-dist" aria-hidden="true">{`${row.distanceMi.toFixed(1)} mi`}</span>
                      <span className="sr-alert-place" aria-hidden="true">{row.locName || C.placeLabel(row.place)}</span>
                      <span className="sr-alert-when" aria-hidden="true">
                        {'Reported '}<b>{w.day}</b>{` · Alerted ${w.alerted}`}
                      </span>
                      <ChevronRight size={15} strokeWidth={2} aria-hidden="true" className="sr-alert-chev" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="sr-inbox-empty">
              <p>{C.INBOX_EMPTY}</p>
              <p className="sr-inbox-empty-detail">{C.INBOX_EMPTY_DETAIL}</p>
            </div>
          )}
        </div>

        <div className="sr-inbox-foot">
          <p className="sr-inbox-fine">{C.INBOX_BOUND}</p>
          {/* The two whole-inbox actions travel as one group, so they wrap
              under the fine print together; Clear keeps the trailing edge. */}
          <div className="sr-inbox-actions">
            <Button
              type="button"
              className="sr-btn-quiet sr-touch-target"
              disabled={!anyNew}
              onClick={pressMarkRead}
            >
              {C.MARK_READ}
            </Button>
            <Button
              ref={clearRef}
              type="button"
              className="sr-btn-quiet sr-touch-target"
              disabled={inbox.length === 0}
              onClick={() => setClearOpen(true)}
            >
              {C.CLEAR}
            </Button>
          </div>
          {/* Always mounted, only its child changes (ui.md). */}
          <div className="sr-only" role="status" aria-live="polite">
            {status.text ? <span key={status.seq}>{status.text}</span> : null}
          </div>
        </div>
      </div>

      <ModalDialog
        open={clearOpen}
        title={C.CLEAR_TITLE}
        trigger={() => clearRef.current}
        // After a confirmed clear the trigger is disabled; Close is still there.
        fallbackFocus={() => closeRef.current}
        onRequestClose={() => setClearOpen(false)}
        initialFocus="first"
        actions={
          <>
            <Button type="button" className="sr-btn-quiet sr-touch-target" onClick={() => setClearOpen(false)}>{C.CANCEL}</Button>
            <Button
              type="button" className="sr-btn-quiet sr-btn-quiet--danger sr-touch-target"
              onClick={() => { setClearOpen(false); void alertsActions.clearInbox() }}
            >
              {C.CLEAR}
            </Button>
          </>
        }
      >
        <p className="sr-dlg-text">{C.CLEAR_BODY}</p>
      </ModalDialog>
    </div>
  )
}
