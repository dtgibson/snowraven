// The strip at the bottom of the Named Birds tab: one labelled lane per named
// bird on a single shared time axis, so "which birds was I following when" is
// answered without expanding any card.
//
// EVERY named bird gets a lane. No cap, no truncation, no "show more": the strip
// grows vertically and the page scrolls, exactly as the unbounded card list above
// it already does. Omitting birds would leave the strip's whole question partly
// unanswered. Lane order equals card order under whichever Sort option is
// selected, which is the shipped "bar order equals row order" contract.
//
// MONOCHROME, deliberately, and the categorical palette is not merely unused but
// wrong here. Four distinguishable colours plus slate would give three named
// birds a colour each and twenty birds four colours and sixteen slate lanes,
// implying a grouping that does not exist; and `--sr-graph-photo` / `-audio` /
// `-video` already mean photo, audio and video on a tab where every expanded card
// carries a media section. Identity is carried by the lane's own text label
// (WCAG 1.4.1: the strip still reads with colour removed) and a bird's extent by
// its span line.
//
// The card chrome is hand-rolled inline to match `NamedBirdRow`, deliberately
// NOT an import of either `SectionCard`: both live on lazy chunks and
// `NamedBirds` is a static import in App.tsx. It is a SIBLING of the cards, never
// nested inside one.

import { ChartNoAxesGantt } from 'lucide-react'
import { NamedBirdRangeControl } from './NamedBirdRangeControl'
import { NamedBirdTickList } from './NamedBirdTickList'
import type { SpanRange, TimelineAxis, TimelineLane } from '../lib/namedBirdTimeline'
import {
  lbMaster, masterCaption, masterHead, masterSentence, rangeGroupMaster, restMaster,
} from '../lib/namedBirdTimelineCopy'

export function NamedBirdMasterTimeline({ lanes, axis, range, onRangeChange, showSpecies }: {
  /** Lanes in card order — the caller has already sorted them. */
  lanes: TimelineLane[]
  axis: TimelineAxis
  range: SpanRange
  onRangeChange: (r: SpanRange) => void
  showSpecies: boolean
}) {
  // With one named bird the card above already is the picture, and a zero-day
  // shared axis has nothing to plot.
  if (lanes.length < 2 || axis.spanDays === 0) return null

  return (
    <section style={{
      marginTop: 14, padding: 14,
      background: 'var(--sr-surface)', border: '1px solid var(--sr-border)',
      borderRadius: 10, boxShadow: 'var(--sr-card-shadow)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
        fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
        textTransform: 'uppercase', color: 'var(--sr-text-muted)',
      }}>
        <ChartNoAxesGantt size={13} strokeWidth={2.2} aria-hidden />
        {masterHead}
      </div>

      {/* OUTSIDE the listbox and in the accessibility tree: this sentence is what
          makes the strip's meaning reachable without a live region, and it is
          why the caption and the axis dates inside the listbox can be
          aria-hidden. It updates when the range changes. */}
      <p className="sr-nbt-sentence">{masterSentence(lanes.length, axis, range)}</p>

      <NamedBirdRangeControl range={range} onChange={onRangeChange} groupLabel={rangeGroupMaster} />

      <NamedBirdTickList
        variant="master"
        ariaLabel={lbMaster}
        lanes={lanes}
        axis={axis}
        caption={masterCaption(lanes.length, range)}
        restLine={restMaster}
        showSpecies={showSpecies}
      />
    </section>
  )
}
