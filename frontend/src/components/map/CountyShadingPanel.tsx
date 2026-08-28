// The county shading panel, shared by the two NEW mount sites (Species Detail's
// Sighting Locations map and Statistics' Geographic Stats map) —
// county-shading-and-project-stats, FR-04, FR-12, FR-13, FR-18.
//
// It sits BENEATH its map rather than in a control strip above it: the Heatmap
// Intensity strip already occupies the above-map slot on Species Detail, and
// stacking two strips there costs a phone two rows before any map is visible.
// Everything that changes how the shading PAINTS therefore lives in one place,
// in the Map Explorer's order (metric, textures, legend).
//
// The Map Explorer keeps its own sidebar controls unchanged: this component is
// for the two new surfaces only, and it deliberately offers NO Completeness
// option and reaches no completeness controller (FR-16). It imports the pure
// `lib/countyCompleteness` band table only transitively, through MapSidebarUI's
// legend primitives; `lib/useCountyCompleteness.ts` — the thing that fetches —
// is not in this module's graph at all.
//
// LAYOUT LIVES IN globals.css (`.sr-countypanel*` / `.sr-countylegend*`), never
// in an inline style: a React inline style is specificity (1,0,0) and
// unreachable from a media query. Colours stay inline and come only from
// `var(--sr-*)` tokens; this feature mints none.

import { AlertCircle } from 'lucide-react'
import { ToggleSwitch } from '../ui/ToggleSwitch'
import { SegControl, CountyDensitySwatch } from './MapSidebarUI'
import { COUNTY_METRIC_META, type CountyMetric, type CountyTiers } from '../../lib/countyShading'
import type { CountyTier } from '../../lib/countyTextures'

/** Singular unit for the one-item first legend row. The shipped legend appends
 *  the unit to the first row only, which reads "1 checklists" whenever the
 *  minimum is 1 — and on both new surfaces it always is. One word; the Map
 *  Explorer can inherit the fix later. */
const UNIT_SINGULAR: Record<CountyMetric, string> = {
  species: 'species',
  records: 'checklist',
}

export const TEXTURES_HINT =
  'Adds a distinct hatch density per level so counties are distinguishable without color.'

export interface CountyShadingPanelProps {
  /** Drives the grid-rows disclosure AND the `inert` on its clipped inner div. */
  open: boolean
  metric: CountyMetric
  /** Present only on Statistics (FR-13): the two-option Species/Checklists
   *  group. Species Detail fixes the metric to `records` and renders no group,
   *  because per species "distinct species" is always 1 (OQ-04). */
  onMetricChange?: (metric: CountyMetric) => void
  useTextures: boolean
  onToggleTextures: () => void
  tiers: CountyTiers
  /** Overrides `COUNTY_METRIC_META[metric].title`. Species Detail names the
   *  bird ("Your Common Raven checklists per county") rather than reading
   *  "Total checklists per county", which would be wrong there (FR-12). */
  legendTitle?: string
  /** The one-line explanation under the metric control. */
  hint: string
  /** The second sentence of the no-shadeable-counties note. The shipped Map
   *  Explorer wording ("Add records or load a backup with county data") is wrong
   *  advice when a backup IS loaded and the species is simply narrow. */
  emptyNote: string
}

export function CountyShadingPanel({
  open, metric, onMetricChange, useTextures, onToggleTextures,
  tiers, legendTitle, hint, emptyNote,
}: CountyShadingPanelProps) {
  const meta = COUNTY_METRIC_META[metric]
  return (
    // A CSS-collapsed disclosure is CLIPPED, not unmounted, so its focusable
    // descendants stay in the tab order and the accessibility tree while the
    // panel reads as closed (WCAG 2.4.3, 4.1.2). `inert` is what removes them,
    // on the same grid-rows shape as the Map Explorer's collapsed filter panel
    // and the escapee account's disclosure. React 19 emits `inert={false}` as
    // an absent attribute; pre-19 rendered the truthy string "false", which
    // would pin the panel permanently inert, so the test asserts the LITERAL
    // attribute in both states.
    <div className="sr-countypanel" data-open={open ? 'true' : 'false'}>
      <div className="sr-countypanel-inner" inert={!open}>
        <div className="sr-countypanel-pad">
          {onMetricChange && (
            <div className="sr-countypanel-row">
              <span className="sr-min0 sr-countypanel-label">Shade counties by</span>
              <SegControl
                ariaLabel="Choropleth metric"
                options={[
                  { value: 'species', label: COUNTY_METRIC_META.species.label },
                  { value: 'records', label: COUNTY_METRIC_META.records.label },
                ]}
                value={metric}
                onChange={v => onMetricChange(v as CountyMetric)}
              />
            </div>
          )}

          <p className="sr-countypanel-hint">{hint}</p>

          {/* Use Textures: the shipped control, off by default, session-scoped,
              no persistence. The visible label sits LEFT of the switch, so the
              switch carries its own accessible name through the `.sr-only`
              label rather than repeating the text on screen. */}
          <div className="sr-countypanel-row">
            <span className="sr-min0 sr-countypanel-label">Use Textures</span>
            <ToggleSwitch
              bare
              labelVisible={false}
              label="Use textures on shaded counties"
              checked={useTextures}
              onChange={onToggleTextures}
            />
          </div>
          <p className="sr-countypanel-hint">{TEXTURES_HINT}</p>

          {/* The legend deliberately carries NO aria-live, unlike the Map
              Explorer's. There the legend is conditionally rendered with no
              inert boundary above it; here it is inside a clipped, inert-able
              panel, and a live region inside such a subtree is INSERTED into the
              accessibility tree when the panel opens — announcing the whole ramp
              on every open, which is the insert-with-first-message trap by
              another route. A metric change is already announced through the
              SegControl's own aria-pressed. */}
          {tiers.legend.length === 0 ? (
            <div className="sr-countylegend-empty">
              <AlertCircle size={14} aria-hidden="true" />
              <span>No recorded counties to shade. {emptyNote}</span>
            </div>
          ) : (
            <div className="sr-countylegend">
              <div className="sr-countylegend-h">{legendTitle ?? meta.title}</div>
              {tiers.legend.map((row, i) => {
                const isLast = i === tiers.legend.length - 1
                const range = isLast
                  ? `${row.min.toLocaleString()}+`
                  : row.min === row.max
                    ? `${row.min.toLocaleString()}`
                    : `${row.min.toLocaleString()}–${row.max.toLocaleString()}`
                const unit = range === '1' ? UNIT_SINGULAR[metric] : meta.unit
                return (
                  <div key={row.tier} className="sr-countylegend-row">
                    {useTextures
                      ? <CountyDensitySwatch tier={row.tier as CountyTier} />
                      : <span aria-hidden="true" className="sr-countylegend-sw" style={{ background: `var(--sr-county-${row.tier})` }} />}
                    <span>
                      {range}{i === 0 && <span className="sr-countylegend-mut"> {unit}</span>}
                    </span>
                  </div>
                )
              })}
              <div className="sr-countylegend-row sr-countylegend-row--none">
                <span aria-hidden="true" className="sr-countylegend-sw sr-countylegend-sw--none" />
                <span>
                  No records <span className="sr-countylegend-mut">(outline only)</span>
                </span>
              </div>
              <div className="sr-countylegend-note">
                Ranges are quantiles of <em>your</em> non-zero counties, so the breaks shift with your data.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
