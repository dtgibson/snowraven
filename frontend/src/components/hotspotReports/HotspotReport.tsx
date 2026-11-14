// One location's report (FR-31 to FR-56, FR-31 as modified by
// hotspot-report-order-and-stats), in this reading order at every width:
// header, At a glance, the jump row (one column only), map, visits and media,
// weather, checklists by protocol, most-recorded species (where there is
// something to rank), and the life list last.
//
// `.sr-hsr-report` is a size container: the report is two columns where its own
// width allows and one column otherwise (a container query, not the viewport,
// so a wide window at 200% text stacks as a phone does). In two columns the
// header and At a glance span the width and the rail of compact sections runs
// down the left with the life list down the right, so reading goes down the
// left column and then the right, which is DOM order: no `order` and no
// grid-area placement anywhere. While it is one column the jump row shows:
// navigation only, one chip per section AFTER it (nothing before it has one),
// each scrolling its section into view and moving focus to the section's
// heading. It filters, switches and hides nothing (FR-31).
//
// Section heading ids are fixed literals (one tab instance in the document),
// never built from file content.

import { lazy, Suspense, type RefObject } from 'react'
import { BarChart2, CalendarDays, ClipboardList, CloudSun, ListChecks, ListOrdered, MapPin } from 'lucide-react'
import { Link } from '../ui/Link'
import { smoothScrollIntoView } from '../../lib/scroll'
import type { LocationRecord } from '../../lib/hotspotReports'
import type { LocationKind } from '../../lib/hotspotReportsKind'
import { mostRecordedView, type LocationFacts, type LocationSpecies, type WeatherView } from '../../lib/hotspotReportsLocation'
import {
  JUMP_CHIPS, JUMP_NAV_LABEL, JUMP_SECTIONS, NO_MAP, SECTION_TITLES, displayName, type ReportSection,
} from '../../lib/hotspotReportsCopy'
import { HotspotReportHeader } from './HotspotReportHeader'
import { HotspotReportLifeList } from './HotspotReportLifeList'
import { GlanceBody, MostRecordedBody, ProtocolsBody, VisitsBody, WeatherBody, type MediaState } from './HotspotReportSections'
import { SectionCard } from './HotspotReportsParts'

// The map's own lazy chunk: SnowMap, react-map-gl and maplibre load only when a
// location with coordinates is shown (FR-40, schema section 9).
const HotspotReportMap = lazy(() => import('./HotspotReportMap').then(m => ({ default: m.HotspotReportMap })))

const SECTION_IDS: Readonly<Record<ReportSection, string>> = {
  glance: 'sr-hsr-sec-glance',
  map: 'sr-hsr-sec-map',
  visits: 'sr-hsr-sec-visits',
  weather: 'sr-hsr-sec-weather',
  protocols: 'sr-hsr-sec-protocols',
  top: 'sr-hsr-sec-top',
  list: 'sr-hsr-sec-list',
}

const GLYPH = { size: 14, strokeWidth: 2.2, 'aria-hidden': true } as const

export interface HotspotReportProps {
  rec: LocationRecord
  kind: LocationKind
  showId: boolean
  facts: LocationFacts
  species: LocationSpecies
  weather: WeatherView
  media: MediaState
  /** Changes with every selection, so the life list's pager starts over. */
  selectionSeq: number
  headingRef: RefObject<HTMLHeadingElement | null>
  codeFor: (name: string) => string | undefined
  onOpenSpecies?: (commonName: string) => void
}

export function HotspotReport({
  rec, kind, showId, facts, species, weather, media, selectionSeq, headingRef, codeFor, onOpenSpecies,
}: HotspotReportProps) {
  const checklists = facts.checklists.length
  const name = displayName(rec.name, rec.truncated)
  const top = mostRecordedView(facts, species)
  // The chip set is the sections actually rendered after the row, in order.
  const chips = JUMP_SECTIONS.filter(s => s !== 'top' || top !== null)

  return (
    <div className="sr-hsr-report">
      <HotspotReportHeader
        rec={rec} kind={kind} showId={showId}
        species={species.total} checklists={checklists} headingRef={headingRef}
      />
      <SectionCard id={SECTION_IDS.glance} glyph={<BarChart2 {...GLYPH} />} title={SECTION_TITLES.glance}>
        <GlanceBody facts={facts} species={species} codeFor={codeFor} onOpenSpecies={onOpenSpecies} />
      </SectionCard>
      <nav className="sr-hsr-jump" aria-label={JUMP_NAV_LABEL}>
        {chips.map(s => (
          <Link
            key={s}
            className="sr-hsr-chip sr-touch-target"
            href={`#${SECTION_IDS[s]}`}
            onClick={e => {
              // Scroll the section card into view, then move focus to its
              // heading without a second, competing scroll (lib/scroll.ts).
              e.preventDefault()
              const heading = document.getElementById(SECTION_IDS[s])
              smoothScrollIntoView(heading?.closest('section'))
              heading?.focus({ preventScroll: true })
            }}
          >
            {JUMP_CHIPS[s]}
          </Link>
        ))}
      </nav>
      <div className="sr-hsr-body">
        <div className="sr-hsr-rail">
          <SectionCard
            id={SECTION_IDS.map} glyph={<MapPin {...GLYPH} />} title={SECTION_TITLES.map} flushBody={rec.lat !== null && rec.lng !== null}
          >
            {rec.lat !== null && rec.lng !== null ? (
              <Suspense fallback={<div className="sr-hsr-map" aria-hidden="true" />}>
                <HotspotReportMap lat={rec.lat} lng={rec.lng} name={name} />
              </Suspense>
            ) : (
              <p className="sr-hsr-body-text">{NO_MAP}</p>
            )}
          </SectionCard>
          <SectionCard
            id={SECTION_IDS.visits} glyph={<CalendarDays {...GLYPH} />} title={SECTION_TITLES.visits}
          >
            <VisitsBody facts={facts} media={media} />
          </SectionCard>
          <SectionCard
            id={SECTION_IDS.weather} glyph={<CloudSun {...GLYPH} />} title={SECTION_TITLES.weather}
          >
            <WeatherBody view={weather} />
          </SectionCard>
          <SectionCard
            id={SECTION_IDS.protocols} glyph={<ClipboardList {...GLYPH} />} title={SECTION_TITLES.protocols}
          >
            <ProtocolsBody facts={facts} />
          </SectionCard>
          {top !== null ? (
            <SectionCard
              id={SECTION_IDS.top} glyph={<ListOrdered {...GLYPH} />} title={SECTION_TITLES.top}
            >
              <MostRecordedBody view={top} species={species.total} checklists={checklists} codeFor={codeFor} onOpenSpecies={onOpenSpecies} />
            </SectionCard>
          ) : null}
        </div>
        <SectionCard
          id={SECTION_IDS.list} glyph={<ListChecks {...GLYPH} />} title={SECTION_TITLES.list} flushBody
        >
          <HotspotReportLifeList
            key={selectionSeq}
            species={species}
            checklists={checklists}
            codeFor={codeFor}
            onOpenSpecies={onOpenSpecies}
          />
        </SectionCard>
      </div>
    </div>
  )
}
