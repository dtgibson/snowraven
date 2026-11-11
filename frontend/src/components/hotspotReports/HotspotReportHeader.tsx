// The report's header band (FR-32, FR-39, FR-50; design-spec "Header band"):
// the kind as an eyebrow where known, the name as the report's heading (the
// focus target after a ranked-row press, `tabIndex={-1}` with no ring), the
// place and a namesake's Location ID, the two totals, and the rule sentence
// directly under them.
//
// Only a hotspot's name is a link, through `HotspotLink`, which also refuses an
// id that is not `L` plus digits. A personal or not-yet-known name is text.

import type { RefObject } from 'react'
import { HotspotLink } from '../HotspotLink'
import type { LocationRecord } from '../../lib/hotspotReports'
import type { LocationKind } from '../../lib/hotspotReportsKind'
import { RULE_SENTENCE, TOTAL_LABELS, displayName, formatCount } from '../../lib/hotspotReportsCopy'
import { KindTag, LocationName, MetaLine } from './HotspotReportsParts'

export function HotspotReportHeader({ rec, kind, showId, species, checklists, headingRef }: {
  rec: LocationRecord
  kind: LocationKind
  showId: boolean
  species: number
  checklists: number
  headingRef: RefObject<HTMLHeadingElement | null>
}) {
  const meta = []
  if (rec.place !== '') meta.push(rec.place)
  if (showId) meta.push(<span className="sr-hsr-locid">{rec.locationId}</span>)
  return (
    <header className="sr-hsr-card sr-hsr-hero">
      <div className="sr-hsr-ident">
        <KindTag kind={kind} eyebrow />
        <h3 className="sr-hsr-name" tabIndex={-1} ref={headingRef}>
          {kind === 'hotspot'
            ? <HotspotLink locId={rec.locationId} name={displayName(rec.name, rec.truncated)} isHotspot size="md" />
            : <LocationName rec={rec} />}
        </h3>
        <MetaLine items={meta} />
      </div>
      <div className="sr-hsr-totals">
        <div className="sr-hsr-figs">
          <div className="sr-hsr-fig">
            <span className="sr-hsr-fig-label">{TOTAL_LABELS.species}</span>
            <span className="sr-hsr-fig-value sr-hsr-fig-value--key">{formatCount(species)}</span>
          </div>
          <div className="sr-hsr-fig">
            <span className="sr-hsr-fig-label">{TOTAL_LABELS.checklists(checklists)}</span>
            <span className="sr-hsr-fig-value">{formatCount(checklists)}</span>
          </div>
        </div>
        <p className="sr-hsr-rule">{RULE_SENTENCE}</p>
      </div>
    </header>
  )
}
