// The ONE per-species weather row in this repo (species-detail-weather, FR-26).
//
// EXTRACTED FROM `WeatherStatsSection.tsx` VERBATIM -- props, class names, three
// states and the comment block below all travel unchanged -- so that section's
// rendered output is byte-identical and its existing tests pass untouched. It
// keeps using the global `.sr-wx-*` classes in `globals.css`; this extraction
// duplicates no CSS and adds none.
//
// WHY EXTRACT RATHER THAN COPY. Both the Statistics section and the Species
// Detail card render this row, and the user can reach both in two clicks about
// their own data. A pair that agrees today is a pair that will disagree later,
// so there is exactly one implementation, by construction rather than by
// agreement. The narrowed condition on changing it is in the PRD (FR-26): a
// change is correct only when it repairs a defect confirmed against the SHIPPED
// build in a real engine, changes layout rules only in `globals.css`, touches no
// data, copy, markup structure or component behaviour, is verified on BOTH
// surfaces at the configurations the defect lives in, leaves the shipped section
// unregressed, and REMOVES the defect rather than relocating it.

import { fmt } from '../lib/statsFormat'
import { NO_OUTINGS, speciesRowReference, speciesRowShare } from '../lib/weatherStatsCopy'

/**
 * One row of the per-species view.
 *
 * THE BAR IS THE BIRD'S OWN RECORD, SCALED TO THE BIRD'S LARGEST BAND ON THIS
 * AXIS -- so the biggest band always fills the track and every other band is
 * legible against it. This replaced a shared-rail treatment where the rail was
 * the outings in the band and the fill the ones carrying the bird. That was
 * well-founded and it did not survive real data: against hundreds of outings,
 * anything the user has not seen dozens of times rendered as a sliver, and the
 * user's own example was "1 of 395 and a tiny bar". A chart that carries no
 * information at the size a person reads it is not saved by being technically
 * correct.
 *
 * Scaled to `max(count)` and deliberately NOT to the species' total: scaling to
 * the total makes every bar small again the moment a bird is spread across
 * eleven conditions, which is the failure this change exists to fix. Each of the
 * two groups scales to its OWN axis's maximum, never a shared one. That makes
 * this the same chart form and the same scaling rule as the distribution chart
 * at the top of the card, so the two are read in identical units.
 *
 * TWO STATES, NOT THREE. There is no thin state here and that is not an
 * oversight: `WEATHER_BAND_MIN_TO_SHOW` gates derived AVERAGES, and this chart
 * derives nothing. A count of one is a fact, not an estimate.
 *
 * The two zeros still must not look alike, and now differ in three places:
 *
 *   `0 · 0%`     a SOLID full-width track, no fill, and a reference figure --
 *                warm outings that never held this bird, a fact about the BIRD
 *   `no outings` a DASHED track, no numeral, no share and NO reference --
 *                a band never birded, a fact about the BIRDER
 *
 * The reference is omitted rather than printed as "outings 0%", which would only
 * repeat what "no outings" already said and would collapse the distinction.
 */
export function WeatherSpeciesRow({ glyph, label, count, maxCount, speciesAxisTotal, bandN, axisTotal }: {
  glyph?: React.ReactNode
  label: string
  /** Checklists in this band carrying the species. */
  count: number
  /** The species' largest band on THIS axis -- the bar's scale. */
  maxCount: number
  /** The species' own axis total, which the printed share is of. */
  speciesAxisTotal: number
  /** All readable checklists in this band, for the reference figure. */
  bandN: number
  /** The axis's own sum, which the reference share is of. */
  axisTotal: number
}) {
  const noOutings = bandN === 0
  const w = maxCount > 0 ? (count / maxCount) * 100 : 0
  return (
    <div className={`sr-wx-row sr-wx-row--sp${glyph ? '' : ' no-glyph'}${noOutings ? ' is-zero' : ''}`}>
      {glyph !== undefined && <span className="sr-wx-glyph" aria-hidden="true">{glyph}</span>}
      <span className="sr-wx-label">{label}</span>
      {noOutings
        ? <div className="sr-wx-track is-empty" aria-hidden="true" />
        : (
          <div className="sr-wx-track" aria-hidden="true">
            {count > 0 && <span className="sr-wx-fill" style={{ ['--w' as string]: `${w.toFixed(2)}%` }} />}
          </div>
        )}
      <span className="sr-wx-count">
        {noOutings
          ? NO_OUTINGS
          : <><b>{fmt(count)}</b> <span aria-hidden="true">·</span> {speciesRowShare(count, speciesAxisTotal)}</>}
      </span>
      <span className="sr-wx-ref">{speciesRowReference(bandN, axisTotal)}</span>
    </div>
  )
}
