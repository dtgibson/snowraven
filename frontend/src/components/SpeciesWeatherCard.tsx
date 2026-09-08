// The Weather card on Species Detail: what the selected bird has turned up in
// (species-detail-weather).
//
// ITS OWN FILE because `SpeciesDetail.tsx` is 1,678 lines and should not grow by
// a section's worth -- the same reason `WeatherStatsSection`, `MediaStatsSections`
// and `ProjectsSection` have theirs.
//
// NO PICKER, NO SELECTOR, NO SPECIES STATE. The card is about the species the
// tab has already selected, which is the whole reason it is not a duplicate of
// the Statistics per-species view: that one needs a picker because the user
// arrives with no bird in mind. Here they arrived having named one. There is no
// axis toggle either -- the Statistics PER-SPECIES view has none (its Sky /
// Temperature control governs the band chart above it), and inventing one here
// would put a control on the surface whose premise is that the reader operates
// nothing to get the answer.
//
// THE SENTENCE IS THE DESIGN, NOT THE CHART. On the reference export 225 of the
// 283 selectable species -- four in five -- land in `bird-below-floor` or at
// zero and render no chart at all. That state is therefore built as THE FULL
// CARD WITH THE CHART NOT YET ARRIVED: the same opening block, in the same
// place, at the same weight, with one quiet line naming the floor. It is
// deliberately NOT an empty-state box, a dashed border, a centred glyph or a
// muted "no data" panel; on four birds in five that framing would be the card's
// normal appearance, and a below-floor card has to read as a fact about
// coverage rather than as a broken chart.
//
// ONE NUMERATOR, TWO WHOLES, AND NOTHING DIVIDES THEM. The opening block states
// the bird's weather-block count against the user's whole weather record, then
// the SAME count against the checklists the bird is on. "That is" binds them:
// without it the same figure printed twice reads as two different counts. There
// is no coverage percentage for the bird here or anywhere, now or later.
//
// EVERY COUNT-BEARING STRING COMES FROM `lib/weatherStatsCopy.ts`. A string built
// inline here would be invisible to that module's generated corpus sweep however
// correct it happens to be today.

import { Button } from './ui/Button'
import { ArrowRight, CloudSun } from 'lucide-react'
import { BirdName } from './BirdName'
import { WeatherSpeciesRow } from './WeatherSpeciesRow'
import { SectionCard, SectionHead } from './speciesDetail/ui'
import { normalizeSpeciesName } from '../lib/speciesUtils'
import { CONDITION_LABEL, inDisplayOrder } from '../lib/weatherDisplay'
import { speciesWeatherIndex, speciesWeatherState } from '../lib/weatherStats'
import type { WeatherStats } from '../lib/weatherStats'
import {
  WEATHER_COPY, belowFloorLine, filterBasisClause, formBasisClause, speciesChartNote,
  speciesFloorNote, speciesGroupDenominator, speciesLedeParts, speciesOwnWhole,
  speciesOwnWholeZero, speciesZeroLedeParts,
} from '../lib/weatherStatsCopy'

const LEDE_STYLE = { fontSize: '0.8125rem', lineHeight: 1.55, color: 'var(--sr-text)', margin: 0 } as const
const NOTE_STYLE = { fontSize: '0.6875rem', lineHeight: 1.45, color: 'var(--sr-text-muted)', margin: 0 } as const
const DENOM_STYLE = { fontSize: '0.6875rem', color: 'var(--sr-text-muted)' } as const
const SCI_STYLE = {
  fontStyle: 'italic' as const, fontSize: '0.71875rem', color: 'var(--sr-text-gray)',
}

/** `SubLabel` with its bottom margin removed, for use inside `.sr-action-row`
 *  where the row owns the spacing. Same shape as the Statistics section's. */
function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em',
      textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: 0,
    }}>{children}</p>
  )
}

export interface SpeciesWeatherCardProps {
  /** The whole-export aggregate, all-forms variant, from `weatherStatsFor`. */
  stats: WeatherStats
  /** Normalized common name -> distinct submissions the bird is on, over the
   *  raw unfiltered parse. The second whole in the opening block. */
  ownChecklists: ReadonlyMap<string, number>
  /** The tab's own selection. The card renders no control that could change it. */
  selectedSpecies: string
  sciName?: string
  taxonCode?: string
  /** True while a county or date filter is active on the tab, which is the ONLY
   *  thing that decides whether the filter basis clause renders. The figures
   *  themselves are export-wide either way. */
  filtersActive: boolean
  /** An in-app tab move, so the route is a `<button>` and never an `<a href>`,
   *  mirroring the Statistics section's own. */
  onGoToWeather: () => void
}

export function SpeciesWeatherCard({
  stats, ownChecklists, selectedSpecies, sciName, taxonCode, filtersActive, onGoToWeather,
}: SpeciesWeatherCardProps) {
  // FR-02: the published table dedupes on the normalized common name and holds
  // no form-level rows, so a form selected with Show subspecies on reports its
  // PARENT and says so in one clause. FR-03: a name absent from the table is a
  // bird on no readable-block checklist -- a count of zero, never an error,
  // never a thrown load, never a reason to hide the card.
  const normalized = normalizeSpeciesName(selectedSpecies)
  const idx = speciesWeatherIndex(stats, normalized)
  const onCount = idx >= 0 ? stats.species.checklists[idx] : 0
  const ownTotal = ownChecklists.get(normalized) ?? 0
  const state = speciesWeatherState(stats, onCount)

  // LOAD-BEARING, AND MEASURED TO BE SO. This is not a restatement of the
  // caller's gate, and the earlier comment here calling it "belt and braces" was
  // wrong in a way worth naming: a guard whose comment says it is redundant is a
  // guard with a deletion notice on it, which is exactly the v1.0.22 shape
  // `.claude/rules/security.md` records.
  //
  // WHAT IT CATCHES. `hasAnyWeatherBlock` and `computeWeatherStats` are related
  // by a one-way implication, not an equivalence: `foundCount > 0` implies the
  // gate, never the reverse. The two disagree about which row of a submission
  // speaks for it, so a submission whose FIRST row has an empty or `undefined`
  // `checklistComments` and whose LATER row carries the block passes the gate
  // and contributes nothing to `foundCount` (the full account is at
  // `hasAnyWeatherBlock`'s definition site). The hook then hands this component a
  // real `stats` object in which `foundCount` is 0.
  //
  // WHY THE GATE CANNOT CATCH IT. The gate's whole value is that it answers
  // before the 15.67 ms aggregate exists, so it cannot consult the number that
  // exposes the divergence. Closing it there instead would mean testing every row
  // of every submission, which changes the gate's cost profile on hostile input.
  // This branch is the cheaper and truer place, and it is the ONLY place.
  //
  // WHAT REMOVING IT DOES. `state` would fall through to the export-below-floor
  // branch, because `readableCount` of 0 is below the section floor, and the card
  // would render "You have 0 checklists with a readable weather block" plus a
  // route to the Weather tab, on an export with no weather block at all. That is
  // FR-05's exact prohibition -- absent renders nothing -- reached from a state no
  // behavioural test currently produces. Do not delete this line.
  if (state === 'absent') return null

  const head = <SectionHead icon={<CloudSun size={14} strokeWidth={2.2} />} title={WEATHER_COPY.cardTitle} />

  // ── Export below floor: about the FILE, not the bird ──────────────────────
  //
  // No bird name and no figure about this species, so the card renders
  // identically on every selection -- which is correct, because the statement is
  // about the export. Same words and same destination as the Statistics
  // section's below-floor state, because it is the same state about the same
  // export, and there filling in the backlog really is what changes it.
  if (state === 'export-below-floor') {
    return (
      <SectionCard>
        {head}
        <div style={{ padding: '14px 18px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={LEDE_STYLE}>{belowFloorLine(stats.readableCount)}</p>
          <p style={NOTE_STYLE}>{WEATHER_COPY.belowFloorBody}</p>
          <Button className="sr-wx-route" type="button" onClick={onGoToWeather}>
            <span>
              {WEATHER_COPY.route}
              <ArrowRight size={13} strokeWidth={2.2} aria-hidden="true" />
            </span>
          </Button>
        </div>
      </SectionCard>
    )
  }

  // ── The opening block, rendered identically in both remaining states ───────
  //
  // The zero case takes its own wording in BOTH sentences: `speciesLedeParts`
  // would print "is on 0 of your 392", and "That is 0 of the 26" would put a
  // bare zero exactly where the sentence is meant to be an account.
  const lede = onCount === 0 ? speciesZeroLedeParts(stats.readableCount) : speciesLedeParts(onCount, stats.readableCount)
  const ownWhole = onCount === 0 ? speciesOwnWholeZero(ownTotal) : speciesOwnWhole(onCount, ownTotal)

  // The muted run after the lede, in the order lede-note, filter, form. Each
  // clause is absent when it does not apply, so nobody is made to read an
  // explanation of a filter they did not set, and with neither applicable the
  // block is exactly the shipped one sentence.
  const basis = [
    lede.note,
    filtersActive ? filterBasisClause() : '',
    normalized !== selectedSpecies ? formBasisClause() : '',
  ].filter(Boolean).join(' ')

  const openingBlock = (
    <p style={LEDE_STYLE}>
      {/* No `onOpenSpecies`: a link to the page the reader is already on is a
          control that looks pressable and does nothing. And no accent wrapper --
          the Statistics lede forces the accent because there the name answers
          "which bird" the user just typed into a picker; here the page header
          already names the bird, and the accent on this card belongs to the bar
          fills. `BirdName`'s own default is used unchanged. */}
      <BirdName commonName={selectedSpecies} taxonCode={taxonCode} size="sm" />
      {sciName && <span style={SCI_STYLE}> {sciName}</span>}
      <br />
      {lede.lead}
      <br />
      {ownWhole}{' '}
      <span style={NOTE_STYLE}>{basis}</span>
    </p>
  )

  // ── Bird below floor: the full card with the chart not yet arrived ─────────
  //
  // No bars, no reference figures, no group denominators, and NO ROUTE TO
  // ANYWHERE. The backlog is a list of the user's blockless checklists across
  // the whole export and nothing here knows how many of them carry THIS species,
  // so "fill in the gaps" beside a sentence about one bird would read as "and
  // then this chart will appear", which the card cannot promise. What it gives
  // instead is the thing it can promise: the floor, named, built from the
  // constant.
  if (state === 'bird-below-floor') {
    return (
      <SectionCard>
        {head}
        <div style={{ padding: '14px 18px 16px' }}>
          {openingBlock}
          <p style={{ ...NOTE_STYLE, marginTop: 10 }}>{speciesFloorNote()}</p>
        </div>
      </SectionCard>
    )
  }

  // ── Full ──────────────────────────────────────────────────────────────────
  //
  // Rows are addressed by the payload's explicit `index`, never by array
  // position, so the display reorder above is free and the species alignment
  // cannot drift. Every band renders, including one with a count of zero and one
  // the user has never birded: dropping bands makes the distribution itself lie.
  const condRows = inDisplayOrder(stats.byCondition)
  const condDenominator = stats.byCondition.reduce((n, r) => n + r.checklists, 0)
  const tempDenominator = stats.byTempBand.reduce((n, r) => n + r.checklists, 0)

  // Each group scales to the BIRD'S OWN largest value on ITS OWN axis, computed
  // per axis and never shared between the two. `reduce` rather than a
  // `Math.max` spread: the arrays are data-derived, and a spread over a
  // data-length array is the RangeError this repo has already guarded once.
  const spCond = stats.species.byCondition[idx]
  const spTemp = stats.species.byTempBand[idx]
  const maxCondCount = spCond.reduce((m, n) => Math.max(m, n), 0)
  const maxTempCount = spTemp.reduce((m, n) => Math.max(m, n), 0)
  const spCondTotal = spCond.reduce((a, b) => a + b, 0)
  const spTempTotal = spTemp.reduce((a, b) => a + b, 0)

  return (
    <SectionCard>
      {head}
      <div style={{ padding: '14px 18px 18px' }}>
        {openingBlock}
        {/* The confound, named ONCE above the pair and then SHOWN continuously by
            the per-row reference figure. The bars are the bird's own record, so
            they carry when the user was out as well as the bird. */}
        <p style={{ ...NOTE_STYLE, margin: '12px 0 10px', lineHeight: 1.5 }}>
          {speciesChartNote(selectedSpecies)}
        </p>
        {/* Keyed on the selection, so the bar entrance replays exactly when the
            data changed and not otherwise -- the same mechanism and the same
            reason as the shipped section's `key={`sp-${selected}`}`. */}
        <div className="sr-wx-pair" key={`sp-${selectedSpecies}`}>
          <div>
            <div className="sr-action-row" style={{ margin: '0 0 8px' }}>
              <GroupLabel>{WEATHER_COPY.axisSky}</GroupLabel>
              {/* "of its N" is deliberate: it names the species by the pronoun
                  the lede above has bound, so a skimmer cannot read this sum as
                  an outing count and think it disagrees with the coverage line. */}
              <span style={DENOM_STYLE}>
                {speciesGroupDenominator(spCondTotal, onCount, 'sky')}
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
              <GroupLabel>{WEATHER_COPY.axisTemp}</GroupLabel>
              <span style={DENOM_STYLE}>
                {speciesGroupDenominator(spTempTotal, onCount, 'temp')}
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
    </SectionCard>
  )
}
