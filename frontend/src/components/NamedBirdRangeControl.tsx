// The Named Birds range switch: which endpoint every span on the tab is measured
// to, the bird's last sighting or today.
//
// ONE VALUE FOR THE WHOLE TAB, rendered in three places (the tab control strip
// under Sort, inside the open card, and above the strip at the bottom). Every
// instance reads and writes the same `useState` in `NamedBirdsTable`, so two
// controls on screen at once can never answer the same question differently —
// which is the ambiguity this feature exists to remove.
//
// It reuses the shipped Named Birds pill pattern VERBATIM: self-bordered
// native buttons inside `.sr-wrap-flex` with a 6px gap, each carrying
// `.sr-touch-target`, `aria-pressed` reflecting selection, and the shared
// `Button` primitive's `tabIndex={0}` default (required by WebKit's default tab
// mode in the shipped Mac, iPhone and iPad apps). Self-bordered pills with a gap rather than a shared shell with divider
// borders: when the group wraps at large text scale each pill keeps its own
// rounded border instead of leaving stray divider lines behind.
//
// It must NOT import `SegControl` from `components/map/MapSidebarUI.tsx`. That
// module statically imports `lib/countyTextures` and `lib/countyCompleteness`,
// and `NamedBirds` is on App.tsx's static import graph, so importing it here
// would put the county texture and completeness band tables on first paint for
// every user on every platform.

import { Button } from './ui/Button'
import { optLastSighting, optToday, rangeLabel } from '../lib/namedBirdTimelineCopy'
import type { SpanRange } from '../lib/namedBirdTimeline'

const OPTIONS: ReadonlyArray<{ value: SpanRange; label: string }> = [
  { value: 'last-sighting', label: optLastSighting },
  { value: 'today', label: optToday },
]

export function NamedBirdRangeControl({ range, onChange, groupLabel }: {
  range: SpanRange
  onChange: (r: SpanRange) => void
  /** Required, not defaulted: three instances can be on one page and each needs
   *  its own accessible name rather than three identical groups. */
  groupLabel: string
}) {
  return (
    // .sr-ctl-row is a CONTAINER hook: it gives every interactive descendant the
    // shared phone-tier size (max(16px, 0.75rem)), which is what keeps these
    // pills off a sub-16px font on a phone without minting a third copy of that
    // declaration. It sizes descendants, never the container.
    <div className="sr-nbt-ctlrow sr-ctl-row" role="group" aria-label={groupLabel}>
      <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', fontWeight: 600 }}>{rangeLabel}</span>
      <div className="sr-wrap-flex" style={{ ['--sr-wrap-gap' as string]: '6px' }}>
        {OPTIONS.map(o => (
          <Button
            className="sr-touch-target"
            key={o.value}
            type="button"
            aria-pressed={range === o.value}
            onClick={() => onChange(o.value)}
            style={{
              height: 30, padding: '0 13px',
              border: '1.5px solid var(--sr-accent-border)', borderRadius: 8,
              background: range === o.value ? 'var(--sr-accent-bg)' : 'transparent',
              color: range === o.value ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
              fontSize: '0.75rem', fontWeight: range === o.value ? 600 : 500,
              fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
