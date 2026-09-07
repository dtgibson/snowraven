// The per-bird sighting strip inside an expanded Named Birds card: one mark per
// distinct sighting date, from this individual's first sighting to whichever
// endpoint the tab-wide range control is set to.
//
// Named-Birds-tab-only. It is mounted only when the row receives its `timeline`
// prop, which `NamedBirdsTable` supplies only for the tab, so Species Detail's
// reuse of that table renders neither this nor the range control BECAUSE THERE
// IS NO VALUE IT COULD TAKE rather than because a branch remembers to.
//
// It RECEIVES the axis rather than computing it: the row needs that same axis
// for the header duration figure, and one computation feeding both is what makes
// the number and the picture of the number incapable of disagreeing.
//
// The two render gates are the ROW's, not this component's: it is mounted only
// when the bird has two or more sightings. A bird with a single sighting gets no
// strip in either range (a chart of one fact, with the fact already stated above
// it), and its header figure still renders. The ZERO-DAY case is this
// component's, below.

import { ChartNoAxesGantt } from 'lucide-react'
import { NamedBirdTickList } from './NamedBirdTickList'
import type { TimelineAxis, TimelineLane } from '../lib/namedBirdTimeline'
import { lbPerBird, oneDate, perBirdHead, restPerBird } from '../lib/namedBirdTimelineCopy'

export function NamedBirdTimeline({ lane, axis }: {
  /** This individual's own lane, already built against `axis`. */
  lane: TimelineLane
  axis: TimelineAxis
}) {
  return (
    <div style={{ padding: '12px 14px 2px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
        fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
        textTransform: 'uppercase', color: 'var(--sr-text-muted)',
      }}>
        <ChartNoAxesGantt size={12} strokeWidth={2.2} aria-hidden />
        {perBirdHead}
      </div>

      {axis.spanDays === 0 ? (
        // Every sighting on one date, so there is no axis: no strip, no listbox,
        // no tab stop and no readout. One sentence instead, reusing the shipped
        // one-item rule (a chart of one fact is chrome around a single fact).
        // With the range on `today` the same bird has a real axis and becomes
        // selectable in the ordinary way.
        <p className="sr-nbt-oneday">{oneDate(axis.start)}</p>
      ) : (
        <NamedBirdTickList
          variant="card"
          ariaLabel={lbPerBird(lane.name)}
          lanes={[lane]}
          axis={axis}
          restLine={restPerBird}
        />
      )}
    </div>
  )
}
