import { useEffect, useRef, useState } from 'react'
import { Smartphone, X } from 'lucide-react'
import { useIsPhone } from '../lib/useIsPhone'
import { storage } from '../lib/storage'

// One-time, phone-only tip shown above the first chart on Statistics and
// Species Detail. Deliberately accent-free (green means actionable; this
// informs) and never steering: both viewing options are named, neither is
// pushed. Dismissal is per page and persists through the storage seam, so it
// never returns after a relaunch on any platform.

export const CHART_TIP_SETTING = 'chartTipDismissed'

export type ChartTipPage = 'statistics' | 'species-detail'

type DismissedMap = Partial<Record<ChartTipPage, boolean>>

const TIP_BODY =
  "Charts get more room in landscape. Rotate your device for a wider view, or open SnowRaven's desktop app if you have it."

function readMap(raw: unknown): DismissedMap {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as DismissedMap) : {}
}

export function ChartViewTip({ page }: { page: ChartTipPage }) {
  const isPhone = useIsPhone()
  // 'pending' until the saved flags hydrate. Closed-until-hydrated: a
  // dismissed installation must never flash the tip at startup (the same
  // posture as the embed-eligibility gate).
  const [state, setState] = useState<'pending' | 'show' | 'hidden'>('pending')
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    void storage
      .getSetting<DismissedMap>(CHART_TIP_SETTING)
      .catch(() => null)
      .then(raw => {
        if (cancelled) return
        setState(readMap(raw)[page] ? 'hidden' : 'show')
      })
    return () => {
      cancelled = true
    }
  }, [page])

  if (!isPhone || state !== 'show') return null

  const dismiss = () => {
    // Merge-write so dismissing one page never clears the other page's flag.
    void storage
      .getSetting<DismissedMap>(CHART_TIP_SETTING)
      .catch(() => null)
      .then(raw =>
        storage.setSetting<DismissedMap>(CHART_TIP_SETTING, { ...readMap(raw), [page]: true }),
      )

    const wrap = wrapRef.current
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!wrap || reduced) {
      setState('hidden')
      return
    }
    // Collapse (220ms ease-out, from the stylesheet), then unmount. The
    // timeout is a safety net in case transitionend never fires.
    wrap.style.height = `${wrap.scrollHeight}px`
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        wrap.style.height = '0px'
        wrap.style.opacity = '0'
      })
    })
    const fallback = window.setTimeout(() => setState('hidden'), 400)
    wrap.addEventListener('transitionend', function done(e: TransitionEvent) {
      if (e.propertyName !== 'height') return
      wrap.removeEventListener('transitionend', done)
      window.clearTimeout(fallback)
      setState('hidden')
    })
  }

  return (
    <div ref={wrapRef} className="sr-chart-tip-wrap">
      <div className="sr-chart-tip" role="note" aria-label="Tip about chart viewing options">
        <Smartphone size={15} strokeWidth={2.2} className="sr-chart-tip-icon" aria-hidden="true" />
        <span className="sr-chart-tip-text">
          <span className="sr-chart-tip-kicker">Tip</span>
          <span className="sr-chart-tip-body">{TIP_BODY}</span>
        </span>
        <button
          type="button"
          tabIndex={0}
          className="sr-chart-tip-dismiss sr-touch-target"
          aria-label="Dismiss this tip"
          onClick={dismiss}
        >
          <X size={15} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
