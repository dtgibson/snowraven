// The per-row iCloud sync line (icloud-sync FR-23 to FR-29), shared by the
// Settings file rows and, since icloud-bar-chart-sync, the Targets tab's eBird
// bar chart section (design-spec.md, Component Usage: one vocabulary for one
// idea, so a user who has read a Default Files row reads the Targets line
// without learning anything new). Lifted out of Settings.tsx unchanged so the
// Targets section can use it without pulling Settings onto its graph.

import { useEffect, useRef, useState } from 'react'
import { CircleAlert, CloudCheck, CloudDownload, CloudOff, CloudUpload } from 'lucide-react'
import { Button } from './Button'
import type { SlotView } from '../../lib/icloud/icloudState'
import { BUTTONS, STATE_LABELS, fromText, fromWithTimeText, replacedText } from '../../lib/icloud/icloudCopy'
import { formatUploadDate } from '../../lib/formatDate'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// One row's sync content: [glyph] state label · provenance [action]. The label
// is text (never colour alone); the glyph is reinforcement; the middot lives
// INSIDE the provenance span so a wrapped line never ends on a dangling dot.
// Label and filename strings from a shared record render only as children.
export function SyncContent({ view, onDownloadNow, onRetry }: {
  view: SlotView
  onDownloadNow?: () => void
  onRetry?: () => void
}) {
  const label = STATE_LABELS[view.state]
  let Icon = CloudCheck
  let error = false
  let more: string | null = null
  let action: 'download' | 'retry' | null = null
  const withTime = () => view.uploadedAt
    ? fromWithTimeText(view.fromThisDevice, view.origin, formatUploadDate(view.uploadedAt))
    : fromText(view.fromThisDevice, view.origin)
  switch (view.state) {
    case 'up-to-date':
      Icon = CloudCheck
      // FR-25: the "Replaced by" line TAKES THE PLACE of the provenance while set.
      more = view.replacedAt
        ? replacedText(view.origin, formatUploadDate(view.replacedAt))
        : fromText(view.fromThisDevice, view.origin)
      break
    case 'uploading':
      Icon = CloudUpload; more = fromText(view.fromThisDevice, view.origin); break
    case 'downloading':
      Icon = CloudDownload; more = withTime(); break
    case 'in-icloud-not-downloaded':
      Icon = CloudDownload; more = withTime(); action = 'download'; break
    case 'waiting-to-upload':
      Icon = CloudUpload; more = fromText(view.fromThisDevice, view.origin); break
    case 'unavailable':
      Icon = CloudOff; more = fromText(view.fromThisDevice, view.origin); break
    case 'off':
      Icon = CloudOff; break
    case 'error':
      Icon = CircleAlert; error = true; more = view.reason ?? null; action = 'retry'; break
  }
  return (
    <>
      <span className={'sr-sync-state' + (error ? ' sr-sync-state--error' : '')}>
        <Icon size={13} strokeWidth={2.2} aria-hidden />
        {label}
      </span>
      {more && (
        <>
          <span className="sr-only">. </span>
          <span className="sr-sync-more"><span className="sr-sync-sep" aria-hidden>·</span> {more}</span>
        </>
      )}
      {action === 'download' && (
        <Button type="button" className="sr-btn-quiet sr-btn-inline sr-touch-target" onClick={onDownloadNow}>
          {BUTTONS.downloadNow}
        </Button>
      )}
      {action === 'retry' && (
        <Button type="button" className="sr-btn-quiet sr-btn-inline sr-touch-target" onClick={onRetry}>
          {BUTTONS.retry}
        </Button>
      )}
    </>
  )
}

// The stable status region. ALWAYS rendered while the platform gate is true
// (empty when the row has no view); its children are replaced on change and
// the element itself never unmounts and is never display:none (the house
// live-region posture), so a state change is announced once. A view-to-view
// change cross-fades (120ms out, swap, 160ms in via the class transition);
// the first fill and the clear to empty are instant, and reduced motion swaps
// instantly. The fade class is toggled on the element through the ref rather
// than through state so the effect stays free of synchronous setState.
// Generic over the view (a file row's SlotView or a key row's KeySlotView):
// the caller supplies the content renderer, and the region itself is shared,
// not forked (icloud-api-key-sync design-spec.md, Component Usage).
export function SyncLine<V extends object>({ view, render }: {
  view: V | null
  render: (view: V) => React.ReactNode
}) {
  const lineRef = useRef<HTMLDivElement>(null)
  const key = view ? JSON.stringify(view) : ''
  const [shown, setShown] = useState<{ key: string; view: V | null }>({ key, view })

  useEffect(() => {
    if (key === shown.key) return
    const el = lineRef.current
    const instant = !shown.view || !view || prefersReducedMotion()
    if (!instant) el?.classList.add('sr-sync-line--fading')
    const t = setTimeout(() => {
      setShown({ key, view })
      el?.classList.remove('sr-sync-line--fading')
    }, instant ? 0 : 120)
    return () => {
      clearTimeout(t)
      el?.classList.remove('sr-sync-line--fading')
    }
  }, [key, view, shown.key, shown.view])

  return (
    <div ref={lineRef} role="status" className="sr-sync-line">
      {shown.view ? render(shown.view) : null}
    </div>
  )
}
