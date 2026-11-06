// The "Checklists at hotspots" block in the Statistics tab's Geographic Stats
// section (hotspot-share-stat, design-spec.md). Presentational: the view state is
// derived in BirdingStats from the hotspot resolution snapshot, and every string
// comes from lib/hotspotShareCopy.ts. The component builds no count-bearing text.
//
// Three renderings. SETTLED: two percentage figures above an aria-hidden
// two-segment bar (no text inside it, the F032 pattern) and the counts caption
// beneath. STATUS (the first-lookup states): the Projects status-row register, a
// muted glyph beside the sentence and an optional counts-so-far line; no bar and
// no percentage. NO KEY: the Projects no-key sentence with its inline Settings
// button. No live region (PRD open question 2) and no DOM id.
//
// Motion: the body's child is keyed on the state it shows, so it remounts (and
// replays its 160 ms entrance, and the bar's 240 ms fill) only when the state
// changed; a static block never moves. The global reduced-motion block collapses
// both.

import { AlertCircle, Circle, KeyRound, Loader2, WifiOff } from 'lucide-react'
import { Button } from './ui/Button'
import type { HotspotShareView } from '../lib/hotspotShare'
import {
  hotspotShareSentences, HOTSPOT_SHARE_NO_KEY, HOTSPOT_SHARE_ADD_KEY,
} from '../lib/hotspotShareCopy'

/** Split a figure string ("37% at hotspots") at its first space. */
function splitFigure(s: string): [string, string] {
  const at = s.indexOf(' ')
  return at === -1 ? [s, ''] : [s.slice(0, at), s.slice(at + 1)]
}

function StatusGlyph({ kind }: { kind: 'pending' | 'offline' | 'unanswered' | 'no-region' | 'no-key' }) {
  const common = { size: 14, strokeWidth: 2.2, 'aria-hidden': true as const }
  switch (kind) {
    case 'pending': return <Loader2 {...common} className="spin sr-hs-glyph" />
    case 'offline': return <WifiOff {...common} className="sr-hs-glyph" />
    case 'unanswered': return <AlertCircle {...common} className="sr-hs-glyph" />
    case 'no-key': return <KeyRound {...common} className="sr-hs-glyph" />
    default: return <Circle {...common} strokeDasharray="3 3" className="sr-hs-glyph" />
  }
}

export function HotspotShareBlock({ view, onGoToSettings }: {
  view: HotspotShareView
  onGoToSettings: () => void
}) {
  if (view.kind === 'hidden') return null

  if (view.kind === 'settled') {
    const [figHot, figPers, caption] = hotspotShareSentences(view)
    const [pctHot, labHot] = splitFigure(figHot)
    const [pctPers, labPers] = splitFigure(figPers)
    return (
      <div className="sr-hs-body">
        <div key={`settled:${view.h}:${view.m}`}>
          <div className="sr-hs-figs">
            <div className="sr-hs-fig">
              <span className="sr-hs-pct">{pctHot}</span>
              <span className="sr-hs-figlab">{labHot}</span>
            </div>
            <div className="sr-hs-fig sr-hs-fig--end">
              <span className="sr-hs-pct">{pctPers}</span>
              <span className="sr-hs-figlab">{labPers}</span>
            </div>
          </div>
          {/* The bar carries no text: the figures above and the caption below
              hold every number it shows. Width is the UNROUNDED fraction; both
              inline keys are always present and vary by value only. */}
          <div className="sr-hs-bar" aria-hidden="true">
            <div className="sr-hs-seg--hot" style={{ width: `${view.hotspotWidthPct}%`, minWidth: view.h > 0 ? 3 : 0 }} />
            <div className="sr-hs-seg--pers" />
          </div>
          <p className="sr-hs-caption">{caption}</p>
        </div>
      </div>
    )
  }

  if (view.kind === 'no-key') {
    return (
      <div className="sr-hs-body">
        <div className="sr-hs-status" key="no-key">
          <StatusGlyph kind="no-key" />
          <div className="sr-hs-lines">
            <p className="sr-hs-line">
              {HOTSPOT_SHARE_NO_KEY}{' '}
              <Button type="button" className="sr-proj-link" onClick={onGoToSettings}>
                {HOTSPOT_SHARE_ADD_KEY}
              </Button>
            </p>
          </div>
        </div>
      </div>
    )
  }

  const [first, more] = hotspotShareSentences(view)
  return (
    <div className="sr-hs-body">
      <div className="sr-hs-status" key={`${view.kind}:${view.u}:${view.h}:${view.p}`}>
        <StatusGlyph kind={view.kind} />
        <div className="sr-hs-lines">
          <p className="sr-hs-line">{first}</p>
          {more ? <p className="sr-hs-sofar">{more}</p> : null}
        </div>
      </div>
    </div>
  )
}
