// The Weather section of the Statistics tab: what the weather blocks in the
// user's own checklist comments say about their birding.
//
// ITS OWN FILE because `BirdingStats.tsx` is 2,300 lines and should not grow by
// a section's worth -- the same reason `MediaStatsSections`, `ProjectsSection`
// and `FrivolousListsSections` have theirs.
//
// THE REGISTER IS EVIDENTIAL, NOT ANALYTICAL, and that decides every rendering
// choice below. Every figure states what it counts and how many things are
// behind it, IN TEXT, before any bar draws. The bars are reinforcement; the
// numbers are the content.
//
// WHICH IS WHY EVERY RAIL HERE IS `aria-hidden` AND CARRIES NO ROLE. This
// follows the shipped `BarRow` groups in Data Quality, which carry no role
// either, and explicitly NOT the shipped `Donut` in `MediaStatsSections`, which
// needs `role="img"` and a values-listing `aria-label` only because an SVG pie
// has no text to read. Putting an image role on these groups would replace
// readable rows with one long label and make the section WORSE for a screen
// reader. This is a deliberate, approved deviation from the requirement's
// literal wording; do not "fix" it.
//
// AND THERE IS NO INTERACTIVE CHART HERE, so the `aria-activedescendant`
// listbox shape the Named Birds strips use is deliberately absent: that pattern
// exists for marks positioned by data that cannot each be a target, and here the
// row count is fixed by the band tables (11, 7, 9, 2) and every row is a line of
// text. The only `aria-activedescendant` in the section is `SpeciesCombobox`'s
// own, which is shipped and correct.
//
// `BarRow` is deliberately NOT reused and `statsPrimitives.tsx` is NOT modified.
// It right-aligns its label, has no glyph slot, and cannot stack at the phone
// tier without changing how it renders on the six shipped surfaces that already
// call it. One new class is a better trade than a prop on a component Data
// Quality, Media and Breeding Stats all render.

import { useMemo, useState } from 'react'
import { ArrowRight, CloudSun, Moon, Sun } from 'lucide-react'
import { BirdName } from './BirdName'
import { SpeciesCombobox } from './SpeciesCombobox'
import { WeatherSpeciesRow } from './WeatherSpeciesRow'
import { Divider, SubLabel } from './statsPrimitives'
import { fmt, fmtSharePct } from '../lib/statsFormat'
// EXTRACTED, NOT COPIED (species-detail-weather, FR-26). The labels, the sky
// display order and the per-species row moved out VERBATIM so the Species Detail
// card renders from the same ones; this section's output is byte-identical.
import { CONDITION_LABEL, inDisplayOrder } from '../lib/weatherDisplay'
import {
  WEATHER_BAND_MIN_TO_SHOW, weatherSectionState,
} from '../lib/weatherStats'
import type { WeatherBandRow, WeatherStats } from '../lib/weatherStats'
import {
  SPECIES_FIGURE_SUFFIX, WEATHER_COPY, axisDenominatorSuffix, bandHeadCount,
  belowFloorLine, coverageCounts, coveragePct, coverageSentence, durationFigureDenominator,
  durationFigureUnit, legendFloorNote, pickerRestParts, speciesChartNote,
  speciesFigureValue, speciesGroupDenominator, speciesLedeParts,
  tempFootnote, thinDurationsLine, unreadableClause,
} from '../lib/weatherStatsCopy'
import type { WeatherAxis } from '../lib/weatherStatsCopy'

const NOTE_STYLE = { fontSize: '0.6875rem', lineHeight: 1.45, color: 'var(--sr-text-muted)', margin: 0 } as const
const BODY_STYLE = { fontSize: '0.8125rem', lineHeight: 1.55, color: 'var(--sr-text)', margin: 0 } as const
const DENOM_STYLE = { fontSize: '0.6875rem', color: 'var(--sr-text-muted)' } as const
const STRONG_STYLE = { color: 'var(--sr-text)', fontWeight: 600 } as const

// ── Rows ────────────────────────────────────────────────────────────────────

/**
 * One distribution row: glyph, name, rail, count.
 *
 * Three states and each has its own SHAPE as well as its own text, because a
 * band you have never birded in and a band you have birded once must not look
 * alike. A non-zero count always paints (the fill carries a 3px floor inside an
 * `overflow: hidden` track, so it can never widen the row), and a non-zero share
 * that rounds to nothing prints "<1%" rather than "0%" -- the band below
 * freezing really does hold one outing.
 */
function DistRow({ glyph, label, n, max, share }: {
  glyph?: React.ReactNode
  label: string
  n: number
  max: number
  share: string
}) {
  const zero = n === 0
  const w = max > 0 ? (n / max) * 100 : 0
  return (
    <div className={`sr-wx-row${glyph ? '' : ' no-glyph'}${zero ? ' is-zero' : ''}`}>
      {glyph !== undefined && <span className="sr-wx-glyph" aria-hidden="true">{glyph}</span>}
      <span className="sr-wx-label">{label}</span>
      {zero
        ? <div className="sr-wx-track is-empty" aria-hidden="true" />
        : (
          <div className="sr-wx-track" aria-hidden="true">
            <span className="sr-wx-fill" style={{ ['--w' as string]: `${w.toFixed(2)}%` }} />
          </div>
        )}
      <span className="sr-wx-count">
        <b>{fmt(n)}</b> <span aria-hidden="true">·</span> {share}
      </span>
    </div>
  )
}

function DistGroup({ title, axis, denominator, rows, footnote }: {
  title: string
  axis: WeatherAxis
  denominator: number
  rows: Array<{ glyph?: React.ReactNode; label: string; n: number }>
  footnote?: string
}) {
  let max = 0
  let sum = 0
  for (const r of rows) { if (r.n > max) max = r.n; sum += r.n }
  return (
    <>
      <div className="sr-action-row" style={{ margin: '0 0 10px' }}>
        <SubLabelInline>{title}</SubLabelInline>
        <span style={DENOM_STYLE}>
          <b style={STRONG_STYLE}>{fmt(denominator)}</b>{` ${axisDenominatorSuffix(axis)}`}
        </span>
      </div>
      <div className="sr-wx-rows">
        {rows.map((r, i) => (
          <DistRow key={i} glyph={r.glyph} label={r.label} n={r.n} max={max} share={fmtSharePct(r.n, sum)} />
        ))}
      </div>
      {footnote && <p style={{ ...NOTE_STYLE, marginTop: 8 }}>{footnote}</p>}
    </>
  )
}

/** `SubLabel` with its bottom margin removed, for use inside `.sr-action-row`
 *  where the row owns the spacing. */
function SubLabelInline({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: 0,
    }}>{children}</p>
  )
}

/**
 * One band of the species-and-time-out chart.
 *
 * FOUR OUTCOMES, and three of them are a kind of "nothing here" that must not
 * look like the others:
 *
 *   full            head + two lanes, each with its figure
 *   thin durations  head + the species lane + an ITALIC sentence, and NO second
 *                   rail -- an empty rail here would be the zero-band treatment,
 *                   which means something else entirely
 *   thin band       head + an ITALIC sentence, no lanes; the band still appears
 *   zero band       head (muted) + an UPRIGHT sentence, no lanes
 *
 * Italic against upright is a second, non-colour cue separating "you have, and
 * it is too few" from "you never have".
 */
function BandBlock({ row, label, glyph, maxSpecies, maxDuration, unit }: {
  row: WeatherBandRow
  label: string
  glyph?: string
  maxSpecies: number
  maxDuration: number
  unit: 'condition' | 'band'
}) {
  const zero = row.checklists === 0
  const thin = !zero && row.checklists < WEATHER_BAND_MIN_TO_SHOW
  return (
    <div className={`sr-wx-band${zero ? ' is-zero' : ''}`}>
      <div className="sr-wx-bandhead">
        <span className="nm">
          {glyph !== undefined && <span aria-hidden="true">{glyph}</span>}
          {label}
        </span>
        <span className="n">{bandHeadCount(row.checklists)}</span>
      </div>
      {zero ? (
        <p className="sr-wx-none">
          {unit === 'condition' ? WEATHER_COPY.zeroBandCondition : WEATHER_COPY.zeroBandTemp}
        </p>
      ) : thin ? (
        <p className="sr-wx-thin">{WEATHER_COPY.thinBand}</p>
      ) : (
        <>
          <div className="sr-wx-lane">
            <div className="sr-wx-track" aria-hidden="true">
              <span
                className="sr-wx-fill"
                style={{ ['--w' as string]: `${maxSpecies > 0 ? ((row.avgSpecies ?? 0) / maxSpecies) * 100 : 0}%` }}
              />
            </div>
            <span className="sr-wx-fig">
              <b>{speciesFigureValue(row.avgSpecies ?? 0)}</b>{` ${SPECIES_FIGURE_SUFFIX}`}
            </span>
          </div>
          {row.avgDurationMin === null ? (
            <p className="sr-wx-thin">{thinDurationsLine(row.durationCount)}</p>
          ) : (
            <div className="sr-wx-lane">
              <div className="sr-wx-track is-thin" aria-hidden="true">
                <span
                  className="sr-wx-fill is-dur"
                  style={{ ['--w' as string]: `${maxDuration > 0 ? (row.avgDurationMin / maxDuration) * 100 : 0}%` }}
                />
              </div>
              <span className="sr-wx-fig">
                <b>{durationFigureUnit(row.avgDurationMin)}</b>
                {' out '}
                <span className="dn">{durationFigureDenominator(row.durationCount)}</span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── The section ─────────────────────────────────────────────────────────────

export interface WeatherStatsSectionProps {
  stats: WeatherStats
  /** An in-app tab move, so the route is a `<button>` and never an `<a href>`.
   *  Threaded from App.tsx, mirroring the shipped `onGoToSettings`. */
  onGoToWeather: () => void
  /** Species Detail wiring, exactly as every other Statistics list uses it. */
  codeFor: (name: string) => string | undefined
  hasEntryFor: (name: string) => boolean
  sciFor: (name: string) => string | undefined
  onOpenSpecies?: (commonName: string) => void
}

export function WeatherStatsSection({
  stats, onGoToWeather, codeFor, hasEntryFor, sciFor, onOpenSpecies,
}: WeatherStatsSectionProps) {
  // Session-only, matching the tab's other view toggles: a tab stays mounted
  // once opened, so this survives leaving and returning to Statistics and resets
  // on relaunch. No storage seam.
  const [axis, setAxis] = useState<'temp' | 'cond'>('temp')
  const [species, setSpecies] = useState<string | null>(null)

  const state = weatherSectionState(stats)

  const speciesOptions = useMemo(
    () => stats.species.names.map(name => ({ name, sciName: sciFor(name) })),
    [stats.species.names, sciFor],
  )

  const routeButton = (
    <button className="sr-wx-route" tabIndex={0} type="button" onClick={onGoToWeather}>
      <span>
        {WEATHER_COPY.route}
        <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
      </span>
    </button>
  )

  // The ONE discriminator gates both the card and its jump-nav entry in
  // `BirdingStats`. Repeating the absent branch here is belt and braces: it
  // makes "the section does not render" a property of this component too, so the
  // two halves cannot half-happen if a future caller forgets the gate.
  if (state === 'absent') return null

  if (state === 'below-floor') {
    return (
      <>
        <p style={{ ...BODY_STYLE, marginBottom: 10 }}>
          {belowFloorLine(stats.readableCount)}
          {unreadableClause(stats.unreadableCount)}
        </p>
        <p style={{ ...NOTE_STYLE, marginBottom: 2 }}>{WEATHER_COPY.belowFloorBody}</p>
        {routeButton}
      </>
    )
  }

  const condRows = inDisplayOrder(stats.byCondition)
  const condDenominator = stats.byCondition.reduce((n, r) => n + r.checklists, 0)
  const tempDenominator = stats.byTempBand.reduce((n, r) => n + r.checklists, 0)
  const windDenominator = stats.byWindBand.reduce((n, r) => n + r.checklists, 0)

  const bandRows = axis === 'temp' ? stats.byTempBand : condRows
  const bandUnit = axis === 'temp' ? 'band' : 'condition'
  let maxSpecies = 0
  let maxDuration = 0
  for (const r of bandRows) {
    if (r.avgSpecies !== null && r.avgSpecies > maxSpecies) maxSpecies = r.avgSpecies
    if (r.avgDurationMin !== null && r.avgDurationMin > maxDuration) maxDuration = r.avgDurationMin
  }

  // A selection is only honoured while it is still an option, which guards a
  // stale pick after the backup changes under a mounted tab.
  const speciesIdx = species === null ? -1 : stats.species.names.indexOf(species)
  const selected = speciesIdx >= 0 ? stats.species.names[speciesIdx] : null

  // The bar's scale and the printed share come from the SPECIES' own counts on
  // each axis, computed per axis and never shared between them. `reduce` rather
  // than a `Math.max` spread: the arrays are data-derived, and a spread over a
  // data-length array is the RangeError this repo has already guarded once.
  const spCond = speciesIdx >= 0 ? stats.species.byCondition[speciesIdx] : []
  const spTemp = speciesIdx >= 0 ? stats.species.byTempBand[speciesIdx] : []
  const maxCondCount = spCond.reduce((m, n) => Math.max(m, n), 0)
  const maxTempCount = spTemp.reduce((m, n) => Math.max(m, n), 0)
  const spCondTotal = spCond.reduce((a, b) => a + b, 0)
  const spTempTotal = spTemp.reduce((a, b) => a + b, 0)

  return (
    <>
      {/* ── 1. Coverage, before any chart ────────────────────────────────── */}
      <div className="sr-wx-cov">
        <div className="sr-action-row">
          <SubLabelInline>{WEATHER_COPY.coverageLabel}</SubLabelInline>
          <span style={DENOM_STYLE}>
            <b style={STRONG_STYLE}>{coveragePct(stats.readableCount, stats.totalChecklists)}%</b>
            {` · ${coverageCounts(stats.readableCount, stats.totalChecklists)}`}
          </span>
        </div>
        {/* The shipped Data Quality two-segment ratio bar, reused exactly. The
            percentage lives in the header row above because neither segment can
            carry AA-contrast in-bar text. */}
        <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex' }} aria-hidden="true">
          <div style={{
            width: `${stats.totalChecklists > 0 ? (stats.readableCount / stats.totalChecklists) * 100 : 0}%`,
            background: 'var(--sr-accent)',
          }} />
          <div style={{ flex: 1, background: 'var(--sr-chart-slate)' }} />
        </div>
        <p style={BODY_STYLE}>
          {coverageSentence(stats.readableCount, stats.totalChecklists)}
          {unreadableClause(stats.unreadableCount)}
        </p>
        {/* The loop, kept quiet and kept NUMBERLESS. The Weather tab's own
            backlog counts blocks with a LOOSER test than this card does, so a
            "checklists with no block" figure here would sit on screen
            disagreeing with the backlog's by a number neither explains. */}
        {routeButton}
      </div>

      {/* ── 2. Your outings by weather ───────────────────────────────────── */}
      <Divider />
      <SubLabel>{WEATHER_COPY.distributionHeading}</SubLabel>
      <p style={{ ...NOTE_STYLE, marginBottom: 14, marginTop: -4 }}>{WEATHER_COPY.threeDenominators}</p>

      <DistGroup
        title={WEATHER_COPY.axisSky}
        axis="sky"
        denominator={condDenominator}
        rows={condRows.map(r => ({
          glyph: r.key,
          label: CONDITION_LABEL[r.index],
          n: r.checklists,
        }))}
        footnote={WEATHER_COPY.skyFootnote}
      />

      <div style={{ height: 18 }} />
      <DistGroup
        title={WEATHER_COPY.axisTemp}
        axis="temp"
        denominator={tempDenominator}
        rows={stats.byTempBand.map(r => ({ label: r.key, n: r.checklists }))}
        footnote={tempFootnote(stats.medianTempSpanF)}
      />

      <div style={{ height: 18 }} />
      <DistGroup
        title={WEATHER_COPY.axisWind}
        axis="wind"
        denominator={windDenominator}
        rows={stats.byWindBand.map(r => ({ label: r.key, n: r.checklists }))}
        footnote={WEATHER_COPY.windFootnote}
      />

      <div style={{ height: 18 }} />
      {/* Day and night are two ordinary distribution rows, not a second ratio
          bar: the sibling groups above are rows, and a different chart form for
          the same kind of fact would read as a different kind of fact. */}
      <DistGroup
        title={WEATHER_COPY.axisDayNight}
        axis="daynight"
        denominator={stats.dayNight.denominator}
        rows={[
          { glyph: <Sun size={13} strokeWidth={2.2} aria-hidden="true" />, label: 'Day', n: stats.dayNight.day },
          { glyph: <Moon size={13} strokeWidth={2.2} aria-hidden="true" />, label: 'Night', n: stats.dayNight.night },
        ]}
        footnote={WEATHER_COPY.dayNightFootnote}
      />

      {/* ── 3. Species and time out, by weather ──────────────────────────── */}
      <Divider />
      <div className="sr-action-row" style={{ margin: '0 0 8px' }}>
        <SubLabelInline>{WEATHER_COPY.speciesHeading}</SubLabelInline>
        <div className="sr-wx-seg" role="group" aria-label={WEATHER_COPY.axisToggleGroup}>
          <button tabIndex={0} type="button" aria-pressed={axis === 'temp'} onClick={() => setAxis('temp')}>
            {WEATHER_COPY.axisToggleTemp}
          </button>
          <button tabIndex={0} type="button" aria-pressed={axis === 'cond'} onClick={() => setAxis('cond')}>
            {WEATHER_COPY.axisToggleSky}
          </button>
        </div>
      </div>
      {/* The effort confound, named ONCE, plainly, near the figures it is about
          -- and then SHOWN continuously, because every species average has the
          same bands' average time out beside it. */}
      <p style={{ ...NOTE_STYLE, marginBottom: 10, lineHeight: 1.5 }}>{WEATHER_COPY.confound}</p>
      <div className="sr-wx-legend" style={{ marginBottom: 12 }}>
        <span><i className="sr-wx-key k-sp" aria-hidden="true" />{WEATHER_COPY.legendSpecies}</span>
        <span><i className="sr-wx-key k-du" aria-hidden="true" />{WEATHER_COPY.legendDuration}</span>
        <span><i className="sr-wx-key k-zero" aria-hidden="true" />{WEATHER_COPY.legendNoOutings}</span>
        <span>{legendFloorNote()}</span>
      </div>
      {/* Keyed on the axis, so the bar entrance replays exactly when the data
          changed and not otherwise. */}
      <div className="sr-wx-bands" key={`bands-${axis}`}>
        {bandRows.map(r => (
          <BandBlock
            key={r.index}
            row={r}
            label={axis === 'temp' ? r.key : CONDITION_LABEL[r.index]}
            glyph={axis === 'temp' ? undefined : r.key}
            maxSpecies={maxSpecies}
            maxDuration={maxDuration}
            unit={bandUnit}
          />
        ))}
      </div>

      {/* ── 4. One species, its weather ──────────────────────────────────── */}
      <Divider />
      <SubLabel>{WEATHER_COPY.pickerHeading}</SubLabel>
      <div className="sr-wx-pick">
        {/* THE WRAPPER AND THE REGISTER ARE BOTH LOAD-BEARING, and both are
            measurements rather than taste.

            `size="sm"` caps the combobox at 220px INLINE, and the listbox is
            positioned `left: 0; right: 0` on that wrapper, so the cap is the
            listbox's width too. Inside a 220px listbox an option row gives the
            common name a 79.2px box, against 210.2px of ink for the longest
            name-and-scientific pair in a real export: both halves cut at once,
            which is the defect. `panel` is the smallest shipped register that
            carries no cap (it is what the Map Explorer's own picker uses); `md`
            would work too and is a 40px control against this one's 34px.

            The cap that remains is `.sr-wx-pickctl`'s, which is the section's
            own and is in rem, so it stops binding exactly when large text needs
            the room. The 40% scientific-name cap inside the shared component is
            NOT touched: five other surfaces render it, and it exists because
            without it the scientific name crushed the common name to a measured
            0px in the Map Explorer panel at 200%. */}
        <div className="sr-wx-pickctl">
          <SpeciesCombobox
            options={speciesOptions}
            value={selected}
            onChange={setSpecies}
            allLabel={WEATHER_COPY.pickerAll}
            placeholder={WEATHER_COPY.pickerAll}
            ariaLabel={WEATHER_COPY.pickerAria}
            size="panel"
            className="sr-input-16"
          />
        </div>
        {selected === null ? (
          <p className="sr-wx-lede">
            {pickerRestParts(stats.readableCount).lead}{' '}
            <span style={NOTE_STYLE}>{pickerRestParts(stats.readableCount).note}</span>
          </p>
        ) : (
          <p className="sr-wx-lede">
            <span className="sp">
              <BirdName
                commonName={selected}
                taxonCode={codeFor(selected)}
                hasEntry={hasEntryFor(selected)}
                onOpenSpecies={onOpenSpecies}
                size="sm"
              />
            </span>
            {sciFor(selected) && <span className="sci"> {sciFor(selected)}</span>}
            <br />
            {speciesLedeParts(stats.species.checklists[speciesIdx], stats.readableCount).lead}{' '}
            <span style={NOTE_STYLE}>
              {speciesLedeParts(stats.species.checklists[speciesIdx], stats.readableCount).note}
            </span>
          </p>
        )}
      </div>

      {selected !== null && (
        // Keyed on the selection, so the bars replay when a different species is
        // chosen -- and NOT while the picker's query is being typed, because
        // that is the combobox's own internal state and never reaches here.
        <div key={`sp-${selected}`}>
          {/* The trap, named once and then shown continuously -- the same move
              the effort confound makes one block up. The bars are the bird's own
              record, so they carry when the user was out as well as the bird;
              the muted figure on each row is the population shape to check that
              against, without scrolling back to the chart at the top of the
              card. */}
          <p style={{ ...NOTE_STYLE, margin: '12px 0 10px', lineHeight: 1.5 }}>
            {speciesChartNote(selected)}
          </p>
          <div className="sr-wx-pair">
            <div>
              <div className="sr-action-row" style={{ margin: '0 0 8px' }}>
                <SubLabelInline>{WEATHER_COPY.axisSky}</SubLabelInline>
                {/* Denominator 4, and its "of its N" is deliberate: it names the
                    species by the pronoun the lede one line above has bound, so
                    a skimmer cannot read this sum as an outing count and think
                    it disagrees with the card's own coverage figure. */}
                <span style={DENOM_STYLE}>
                  {speciesGroupDenominator(spCondTotal, stats.species.checklists[speciesIdx], 'sky')}
                </span>
              </div>
              <div className="sr-wx-rows">
                {condRows.map(r => (
                  <WeatherSpeciesRow
                    key={r.index}
                    glyph={r.key}
                    label={CONDITION_LABEL[r.index]}
                    count={spCond[r.index]}
                    maxCount={maxCondCount}
                    speciesAxisTotal={spCondTotal}
                    bandN={r.checklists}
                    axisTotal={condDenominator}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="sr-action-row" style={{ margin: '0 0 8px' }}>
                <SubLabelInline>{WEATHER_COPY.axisTemp}</SubLabelInline>
                <span style={DENOM_STYLE}>
                  {speciesGroupDenominator(spTempTotal, stats.species.checklists[speciesIdx], 'temp')}
                </span>
              </div>
              <div className="sr-wx-rows">
                {stats.byTempBand.map(r => (
                  <WeatherSpeciesRow
                    key={r.index}
                    label={r.key}
                    count={spTemp[r.index]}
                    maxCount={maxTempCount}
                    speciesAxisTotal={spTempTotal}
                    bandN={r.checklists}
                    axisTotal={tempDenominator}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** The card icon. A COMPONENT rather than a bare JSX constant: a non-component
 *  export from a `.tsx` file trips `react-refresh/only-export-components`, which
 *  is build-blocking here. */
export function WeatherSectionIcon() {
  return <CloudSun size={16} />
}
