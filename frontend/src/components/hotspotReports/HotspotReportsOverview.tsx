// General statistics, shown before a choice (FR-26 to FR-30; design-spec
// "Overview"): the count block and the two ranked lists whose rows open that
// location. Nothing else: no map, no chart, no other statistic.
//
// The count block reuses Statistics' hotspot partition (`.sr-hs-*`) with counts
// where Statistics prints percentages, in three states (FR-27): every location
// classified (two figures and the bar); some not yet known (the known figures,
// the bar with a dashed third segment, and one reason); nothing classified (no
// split, no bar and no zero for either kind, the total with one sentence and
// the reason). `kindSplitDrawn` is the one predicate both halves read.

import { ChevronRight, Info } from 'lucide-react'
import { Button } from '../ui/Button'
import type { HotspotResolution } from '../../lib/hotspotSet'
import type { HotspotShare } from '../../lib/hotspotShare'
import type { LocationIndex, RankedRow } from '../../lib/hotspotReports'
import { kindOf, kindSplitDrawn, type KindReason } from '../../lib/hotspotReportsKind'
import {
  ADD_KEY_LINK, KIND_REASONS, KIND_WORDS, NOT_YET_KNOWN_TAIL, OVERVIEW_HINT, RANK_HEADINGS,
  displayName, formatCount, hotspotFigureLabel, nothingClassifiedLine, personalFigureLabel,
  rankRowLabel, rankUnit, soleChecklistsParts, soleSpeciesParts, totalLabel,
} from '../../lib/hotspotReportsCopy'
import { LocationMeta, LocationName } from './HotspotReportsParts'

export interface HotspotReportsOverviewProps {
  index: LocationIndex
  share: HotspotShare
  reason: KindReason
  resolution: HotspotResolution
  ranks: { readonly byChecklists: readonly RankedRow[]; readonly bySpecies: readonly RankedRow[] }
  totals: Int32Array
  onSelectRanked: (ord: number) => void
  onGoToSettings: () => void
}

function ReasonLine({ reason, onGoToSettings }: { reason: KindReason; onGoToSettings: () => void }) {
  if (reason === 'none') return null
  return (
    <p className="sr-hs-sofar">
      {KIND_REASONS[reason]}
      {reason === 'no-key' ? (
        <>
          {' '}
          <Button type="button" className="sr-proj-link" onClick={onGoToSettings}>{ADD_KEY_LINK}</Button>
        </>
      ) : null}
    </p>
  )
}

function CountBlock({ share, reason, onGoToSettings }: { share: HotspotShare; reason: KindReason; onGoToSettings: () => void }) {
  const total = share.total
  const drawn = kindSplitDrawn(share)
  return (
    <>
      <p className="sr-hsr-total"><b>{formatCount(total)}</b><span>{totalLabel(total)}</span></p>
      {drawn ? (
        <div className="sr-hsr-split">
          <div className="sr-hs-figs">
            <span className="sr-hs-fig">
              <span className="sr-hs-pct">{formatCount(share.hotspot)}</span>
              <span className="sr-hs-figlab">{hotspotFigureLabel(share.hotspot)}</span>
            </span>
            <span className="sr-hs-fig sr-hs-fig--end">
              <span className="sr-hs-pct">{formatCount(share.personal)}</span>
              <span className="sr-hs-figlab">{personalFigureLabel(share.personal)}</span>
            </span>
          </div>
          {/* No text inside the bar: the figures above hold every number it
              shows. Both inline keys are always present and vary by value only. */}
          <div className="sr-hs-bar" aria-hidden="true">
            <div className="sr-hs-seg--hot" style={{ width: `${(share.hotspot / total) * 100}%`, minWidth: share.hotspot > 0 ? 3 : 0 }} />
            <div className="sr-hs-seg--pers" />
            {share.unclassified > 0
              ? <div className="sr-hsr-seg--unk" style={{ width: `${(share.unclassified / total) * 100}%` }} />
              : null}
          </div>
        </div>
      ) : null}
      {share.unclassified > 0 ? (
        <div className="sr-hs-status">
          <Info size={14} strokeWidth={2.2} className="sr-hs-glyph" aria-hidden="true" />
          <div className="sr-hs-lines">
            {drawn
              ? <p className="sr-hs-line"><b>{formatCount(share.unclassified)}</b>{NOT_YET_KNOWN_TAIL}</p>
              : <p className="sr-hs-line">{nothingClassifiedLine(total)}</p>}
            <ReasonLine reason={reason} onGoToSettings={onGoToSettings} />
          </div>
        </div>
      ) : null}
    </>
  )
}

function RankList({ list, rows, index, totals, resolution, onSelect }: {
  list: 'checklists' | 'species'
  rows: readonly RankedRow[]
  index: LocationIndex
  totals: Int32Array
  resolution: HotspotResolution
  onSelect: (ord: number) => void
}) {
  // A list with no qualifying location renders nothing, heading included.
  if (rows.length === 0) return null
  return (
    <div className="sr-hsr-rank">
      <h3 className="sr-hsr-sub">{RANK_HEADINGS[list]}</h3>
      <ol>
        {rows.map((row, i) => {
          const rec = index.locations[row.ord]
          const kind = kindOf(rec, resolution)
          const showId = index.showId[row.ord] === 1
          const figure = list === 'checklists' ? row.checklists : totals[row.ord]
          const unit = rankUnit(list, figure)
          const parts = [displayName(rec.name, rec.truncated)]
          if (kind !== null) parts.push(KIND_WORDS[kind])
          if (rec.place !== '') parts.push(rec.place)
          if (showId) parts.push(rec.locationId)
          return (
            <li key={row.ord}>
              <Button type="button" className="sr-hsr-rankrow" aria-label={rankRowLabel(parts, figure, unit)} onClick={() => onSelect(row.ord)}>
                <span className="sr-hsr-rank-num" aria-hidden="true">{i + 1}</span>
                <span className="sr-hsr-rank-name"><LocationName rec={rec} /></span>
                <LocationMeta rec={rec} kind={kind} showId={showId} />
                <span className="sr-hsr-rank-fig">
                  {formatCount(figure)}
                  <span className="sr-hsr-rank-unit"> {unit}</span>
                </span>
                <ChevronRight size={14} strokeWidth={2.2} className="sr-hsr-rank-chev" aria-hidden="true" />
              </Button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** FR-30's degenerate form: with exactly one location each list is one sentence
 *  naming it, with a control that opens its report, and no rank. */
function SoleList({ list, figure, rec, onSelect }: {
  list: 'checklists' | 'species'
  figure: number
  rec: LocationIndex['locations'][number]
  onSelect: () => void
}) {
  if (list === 'species' && figure === 0) return null
  const { before, after } = list === 'checklists' ? soleChecklistsParts(figure) : soleSpeciesParts(figure)
  return (
    <div className="sr-hsr-rank">
      <h3 className="sr-hsr-sub">{RANK_HEADINGS[list]}</h3>
      <p className="sr-hsr-sole">
        {before}
        <Button type="button" className="sr-proj-link" onClick={onSelect}>
          {displayName(rec.name, rec.truncated)}
        </Button>
        {after}
      </p>
    </div>
  )
}

export function HotspotReportsOverview({
  index, share, reason, resolution, ranks, totals, onSelectRanked, onGoToSettings,
}: HotspotReportsOverviewProps) {
  const sole = index.locations.length === 1
  return (
    <div className="sr-hsr-card">
      <div className="sr-hsr-sum">
        <CountBlock share={share} reason={reason} onGoToSettings={onGoToSettings} />
        <p className="sr-hsr-note">{OVERVIEW_HINT}</p>
      </div>
      <div className="sr-hsr-ranks">
        {sole ? (
          <>
            <SoleList list="checklists" figure={index.checklistCount[0]} rec={index.locations[0]} onSelect={() => onSelectRanked(0)} />
            <SoleList list="species" figure={totals[0]} rec={index.locations[0]} onSelect={() => onSelectRanked(0)} />
          </>
        ) : (
          <>
            <RankList list="checklists" rows={ranks.byChecklists} index={index} totals={totals} resolution={resolution} onSelect={onSelectRanked} />
            <RankList list="species" rows={ranks.bySpecies} index={index} totals={totals} resolution={resolution} onSelect={onSelectRanked} />
          </>
        )}
      </div>
    </div>
  )
}
