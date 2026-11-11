// One location's report (FR-31 to FR-56; design-spec "The report"), in this
// reading order at every width: header, jump row, life list, map, checklists by
// protocol, weather, visits and media.
//
// `.sr-hsr-report` is a size container: the report is two columns where its own
// width allows and one column otherwise (a container query, not the viewport,
// so a wide window at 200% text stacks as a phone does). While it is one column
// the jump row shows: navigation only, one chip per section below the header,
// each scrolling its section into view and moving focus to the section's
// heading. It filters, switches and hides nothing (FR-31).
//
// Section heading ids are fixed literals (one tab instance in the document),
// never built from file content.

import { lazy, Suspense, type RefObject } from 'react'
import { CalendarDays, ClipboardList, CloudSun, ListChecks, MapPin } from 'lucide-react'
import { Link } from '../ui/Link'
import { smoothScrollIntoView } from '../../lib/scroll'
import type { LocationRecord } from '../../lib/hotspotReports'
import type { LocationKind } from '../../lib/hotspotReportsKind'
import type { LocationFacts, LocationSpecies, WeatherView } from '../../lib/hotspotReportsLocation'
import {
  JUMP_CHIPS, JUMP_NAV_LABEL, NO_MAP, REPORT_SECTIONS, SECTION_TITLES, displayName, type ReportSection,
} from '../../lib/hotspotReportsCopy'
import { HotspotReportHeader } from './HotspotReportHeader'
import { HotspotReportLifeList } from './HotspotReportLifeList'
import { ProtocolsBody, VisitsBody, WeatherBody, type MediaState } from './HotspotReportSections'
import { SectionCard } from './HotspotReportsParts'

// The map's own lazy chunk: SnowMap, react-map-gl and maplibre load only when a
// location with coordinates is shown (FR-40, schema section 9).
const HotspotReportMap = lazy(() => import('./HotspotReportMap').then(m => ({ default: m.HotspotReportMap })))

const SECTION_IDS: Readonly<Record<ReportSection, string>> = {
  list: 'sr-hsr-sec-list',
  map: 'sr-hsr-sec-map',
  protocols: 'sr-hsr-sec-protocols',
  weather: 'sr-hsr-sec-weather',
  visits: 'sr-hsr-sec-visits',
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

  return (
    <div className="sr-hsr-report">
      <HotspotReportHeader
        rec={rec} kind={kind} showId={showId}
        species={species.total} checklists={checklists} headingRef={headingRef}
      />
      <nav className="sr-hsr-jump" aria-label={JUMP_NAV_LABEL}>
        {REPORT_SECTIONS.map(s => (
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
            id={SECTION_IDS.protocols} glyph={<ClipboardList {...GLYPH} />} title={SECTION_TITLES.protocols}
          >
            <ProtocolsBody facts={facts} />
          </SectionCard>
          <SectionCard
            id={SECTION_IDS.weather} glyph={<CloudSun {...GLYPH} />} title={SECTION_TITLES.weather}
          >
            <WeatherBody view={weather} />
          </SectionCard>
          <SectionCard
            id={SECTION_IDS.visits} glyph={<CalendarDays {...GLYPH} />} title={SECTION_TITLES.visits}
          >
            <VisitsBody facts={facts} species={species} media={media} />
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
