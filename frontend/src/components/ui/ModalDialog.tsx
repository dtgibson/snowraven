import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

// The app's shipped dialog shape (the Calendar day-details overlay), extracted
// into one component because the iCloud Sync feature opens three of them
// (design-spec.md "Dialog shell"): a fixed scrim, a centred panel that scales
// in FROM THE CONTROL THAT OPENED IT (transform-origin set from the trigger's
// rect in the panel's coordinate space), a focus trap that re-queries its
// focusables per Tab keydown, Escape and a backdrop mousedown as cancel, and
// focus returned to the trigger on close (or to a caller-named fallback when
// the trigger is gone or disabled). All motion is CSS (globals.css .sr-dlg-*),
// ease-out and under 200ms; the global prefers-reduced-motion rule collapses
// it toward zero without removing it, so `transitionend` still fires and the
// 130ms fallback timer below is only for engines that never emit it (jsdom).
//
// Mount lifecycle: `open` flips true -> mount in the 'enter' phase (opacity 0,
// scale .94) -> next frame 'open'; `open` flips false -> 'closing' (the reverse
// transition) -> unmount and restore focus after the panel's opacity
// transition ends. No dialog library; every close affordance routes through
// the one onRequestClose.

interface ModalDialogProps {
  open: boolean
  title: string
  /** Cancel, Escape and the backdrop all call this; the parent flips `open`. */
  onRequestClose: () => void
  /** The control that opened the dialog: origin of the scale-in, and where
      focus returns. A getter (read in effects, never during render) so a
      caller can hand over a ref-held element without reading the ref in render. */
  trigger: () => HTMLElement | null
  /** Where focus goes on close when the trigger is unmounted or disabled. */
  fallbackFocus?: () => HTMLElement | null
  /** Which action button takes initial focus: the last (primary) or the first (Cancel). */
  initialFocus?: 'first' | 'last'
  children: React.ReactNode
  actions: React.ReactNode
}

type Phase = 'closed' | 'enter' | 'open' | 'closing'

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
const CLOSE_FALLBACK_MS = 130

export function ModalDialog({
  open,
  title,
  onRequestClose,
  trigger,
  fallbackFocus,
  initialFocus = 'last',
  children,
  actions,
}: ModalDialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>(open ? 'enter' : 'closed')
  // The trigger at open time, so a re-render that drops the prop mid-close
  // cannot lose the element focus must return to.
  const triggerRef = useRef<HTMLElement | null>(null)
  const getTriggerRef = useRef(trigger)
  const fallbackRef = useRef(fallbackFocus)
  useEffect(() => {
    getTriggerRef.current = trigger
    fallbackRef.current = fallbackFocus
  })

  // Open: mount, then promote to 'open' on the next frame so the entrance
  // transition has a from-state to run from.
  useEffect(() => {
    if (open) {
      if (phase === 'closed' || phase === 'closing') {
        triggerRef.current = getTriggerRef.current() ?? null
        const raf = requestAnimationFrame(() => setPhase('enter'))
        return () => cancelAnimationFrame(raf)
      }
      if (phase === 'enter') {
        if (!triggerRef.current) triggerRef.current = getTriggerRef.current() ?? null
        const raf = requestAnimationFrame(() => setPhase('open'))
        return () => cancelAnimationFrame(raf)
      }
      return
    }
    if (phase === 'open' || phase === 'enter') {
      const raf = requestAnimationFrame(() => setPhase('closing'))
      return () => cancelAnimationFrame(raf)
    }
  }, [open, phase])

  // Origin-aware scale-in: the panel's transform-origin is the centre of the
  // trigger in the panel's own coordinate space. Layout effect so the first
  // painted frame already has it.
  useLayoutEffect(() => {
    if (phase !== 'enter') return
    const panel = panelRef.current
    const t = triggerRef.current
    if (!panel) return
    if (!t) {
      panel.style.transformOrigin = '50% 50%'
      return
    }
    const tr = t.getBoundingClientRect()
    const pr = panel.getBoundingClientRect()
    panel.style.transformOrigin = `${tr.left + tr.width / 2 - pr.left}px ${tr.top + tr.height / 2 - pr.top}px`
  }, [phase])

  // Initial focus once mounted.
  useEffect(() => {
    if (phase !== 'enter') return
    const panel = panelRef.current
    if (!panel) return
    const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => !el.hasAttribute('disabled'))
    const target = initialFocus === 'first' ? focusables[0] : focusables[focusables.length - 1]
    target?.focus()
  }, [phase, initialFocus])

  // Closing: unmount after the panel's transition ends (or the fallback
  // timer), then return focus.
  useEffect(() => {
    if (phase !== 'closing') return
    const panel = panelRef.current
    let done = false
    const finish = () => {
      if (done) return
      done = true
      setPhase('closed')
      const t = triggerRef.current
      const alive = t && document.contains(t) && !(t as HTMLButtonElement).disabled
      const target = alive ? t : fallbackRef.current?.() ?? null
      target?.focus()
    }
    const onEnd = (e: TransitionEvent) => {
      if (e.target === panel && e.propertyName === 'opacity') finish()
    }
    panel?.addEventListener('transitionend', onEnd)
    const timer = setTimeout(finish, CLOSE_FALLBACK_MS)
    return () => {
      panel?.removeEventListener('transitionend', onEnd)
      clearTimeout(timer)
    }
  }, [phase])

  // Escape and the Tab trap, re-querying focusables per keydown.
  useEffect(() => {
    if (phase !== 'enter' && phase !== 'open') return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onRequestClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => !el.hasAttribute('disabled'))
      if (focusables.length < 2) {
        e.preventDefault()
        focusables[0]?.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [phase, onRequestClose])

  if (phase === 'closed') return null

  const rootClass =
    'sr-dlg-root' +
    (phase === 'open' ? ' sr-dlg-root--open' : '') +
    (phase === 'closing' ? ' sr-dlg-root--closing' : '')

  return (
    <div
      role="presentation"
      className={rootClass}
      onMouseDown={e => { if (e.target === e.currentTarget && phase !== 'closing') onRequestClose() }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="sr-dlg">
        <div className="sr-dlg-head">
          <h2 id={titleId} className="sr-dlg-title">{title}</h2>
        </div>
        <div className="sr-dlg-body">{children}</div>
        <div className="sr-dlg-actions">{actions}</div>
      </div>
    </div>
  )
}
