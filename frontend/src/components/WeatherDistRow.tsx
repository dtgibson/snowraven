// The distribution row: glyph, name, rail, count (hotspot-reports schema 8.1).
//
// EXTRACTED FROM `WeatherStatsSection.tsx` VERBATIM, not rewritten, so the
// Statistics Weather section and the Hotspot Reports tab render ONE
// implementation of the row's three states rather than two that agree today and
// disagree later (the `WeatherSpeciesRow` precedent, design-system "ONE
// PRIMITIVE, TWO SURFACES"). Its own file, never an export from the section,
// because that file statically imports the species picker, `BirdName` and the
// Statistics weather copy, which would put the whole section on the other tab's
// static graph. `WeatherDistRow.golden.test.tsx` pins the section's markup,
// captured before the move, byte for byte.
//
// Three states and each has its own SHAPE as well as its own text, because a
// band you have never birded in and a band you have birded once must not look
// alike. A non-zero count always paints (the fill carries a 3px floor inside an
// `overflow: hidden` track, so it can never widen the row), and a non-zero share
// that rounds to nothing prints "<1%" rather than "0%" -- the band below
// freezing really does hold one outing.
//
// TWO DEFAULTED PROPS, each saying something the row could not say before; with
// `share` supplied and `emphasis` omitted the markup is the section's, character
// for character. `share` omitted: the count cell prints the figure alone, with no
// separator and no share (a count-only row: months and years). `emphasis` true:
// the row takes `is-typical` (the most common band, set at 700 by a rule scoped
// under the tab that uses it).

import { fmt } from '../lib/statsFormat'

export function DistRow({ glyph, label, n, max, share, emphasis = false }: {
  glyph?: React.ReactNode
  label: string
  n: number
  max: number
  share?: string
  emphasis?: boolean
}) {
  const zero = n === 0
  const w = max > 0 ? (n / max) * 100 : 0
  return (
    <div className={`sr-wx-row${glyph ? '' : ' no-glyph'}${zero ? ' is-zero' : ''}${emphasis ? ' is-typical' : ''}`}>
      {glyph !== undefined && <span className="sr-wx-glyph" aria-hidden="true">{glyph}</span>}
      <span className="sr-wx-label">{label}</span>
      {zero
        ? <div className="sr-wx-track is-empty" aria-hidden="true" />
        : (
          <div className="sr-wx-track" aria-hidden="true">
            <span className="sr-wx-fill" style={{ ['--w' as string]: `${w.toFixed(2)}%` }} />
          </div>
        )}
      {share === undefined
        ? <span className="sr-wx-count"><b>{fmt(n)}</b></span>
        : (
          <span className="sr-wx-count">
            <b>{fmt(n)}</b> <span aria-hidden="true">·</span> {share}
          </span>
        )}
    </div>
  )
}
