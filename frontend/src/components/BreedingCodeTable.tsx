import { useState } from 'react'
import { BREEDING_CODE_MAP, TIER_COLORS } from '../lib/breedingCodes'
import type { BreedingEntry } from '../lib/parseBreedingCodes'
import type { BreedingSortState, SortDir } from '../types'
import { BirdName } from './BirdName'

interface Props {
  entries: BreedingEntry[]
  codesPresent: string[]
  sort: BreedingSortState
  onSortChange: (next: BreedingSortState) => void
  filter: Set<string>
  taxonMap: Record<string, string>
  taxonOrders: Record<string, number>
  wideMode: boolean
  /** Opt-in pinned code labels. Required, not defaulted: this component RENDERS
   *  the pinned state, so the call site must answer for it (the same discipline
   *  as MediaFrame's `compact`). `pinned && wideMode` is the gate — Normal view
   *  can never pin, so a stray `pinned` there is inert rather than broken. */
  pinned: boolean
  onOpenSpecies?: (commonName: string) => void
}

const TIER_LABELS: Record<number, string> = {
  4: 'Confirmed',
  3: 'Confirmed (also)',
  2: 'Probable',
  1: 'Possible',
}

// Text color for the count badge sitting on a solid TIER_COLORS fill. Paired
// per-theme with --sr-tier-N in globals.css so every tier passes AA in both
// themes (the old hardcoded white-on-tier-2 was 3.96:1 in dark mode).
const TIER_TEXT_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: 'var(--sr-tier-4-text)',
  3: 'var(--sr-tier-3-text)',
  2: 'var(--sr-tier-2-text)',
  1: 'var(--sr-tier-1-text)',
}

// Sticky species-column width. Was a flat 220px, which on a 320-360px phone left
// the scrollable code matrix a ~1-column peephole. This clamp resolves to 220px
// on every viewport ≥550px (desktop/tablet unchanged) but NARROWS on phones (40vw
// = 128px at 320px), and its rem floor grows the column with the in-app Text Size
// control so it still holds at 200% text scale (the matrix then scrolls in its
// overflow-x wrapper rather than the name column crushing). A viewport/rem
// expression is intrinsically responsive with no media query, so it can live
// inline without the "unreachable by a media query" pitfall the class convention
// guards against. The value is single-sourced so the header cell, every row's
// name cell, and the scrollPaddingLeft stay perfectly aligned.
const NAME_COL_WIDTH = 'clamp(7.5rem, 40vw, 220px)'

export function BreedingCodeTable({ entries, codesPresent, sort, onSortChange, filter, taxonMap, taxonOrders, wideMode, pinned, onOpenSpecies }: Props) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  // Pinning is offered in Unbounded ONLY. In Normal the overflow-x:auto wrapper is
  // the scrollport, so a sticky header there would need a capped-height inner box —
  // and at 200% in-app text scale no height unit works (dvh leaves ~5 rows; rem
  // exceeds the viewport, putting the scrollport's top and the header off-screen).
  // BreedingCodeList's state machine enforces `pinned implies Unbounded`; this is
  // the second, local guard, so the component is honest on its own.
  const pinnedNow = pinned && wideMode

  const filtered = filter.size === 0
    ? entries
    : entries.filter(e => [...filter].every(code => (e.codes[code] ?? 0) > 0))

  function nameCompare(a: BreedingEntry, b: BreedingEntry): number {
    if (sort.nameSortMode === 'taxonomic') {
      const aOrder = taxonOrders[a.commonName] ?? Infinity
      const bOrder = taxonOrders[b.commonName] ?? Infinity
      const diff = aOrder - bOrder
      if (diff !== 0) return diff
    }
    return a.commonName.localeCompare(b.commonName)
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sort.column === 'name') {
      const cmp = nameCompare(a, b)
      return sort.dir === 'asc' ? cmp : -cmp
    }
    const aCount = a.codes[sort.column] ?? 0
    const bCount = b.codes[sort.column] ?? 0
    if (aCount !== bCount) return sort.dir === 'desc' ? bCount - aCount : aCount - bCount
    return nameCompare(a, b)
  })

  function handleHeaderClick(col: string) {
    if (sort.column === col) {
      onSortChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    } else {
      const defaultDir: SortDir = col === 'name' ? 'asc' : 'desc'
      onSortChange({ ...sort, column: col, dir: defaultDir })
    }
  }

  function sortIndicator(col: string) {
    if (sort.column !== col) return null
    return (
      <span style={{ fontSize: '0.625rem', color: 'var(--sr-accent)', marginLeft: 2 }}>
        {sort.dir === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  const tierGroups = new Map<1 | 2 | 3 | 4, string[]>()
  for (const code of codesPresent) {
    const def = BREEDING_CODE_MAP.get(code)
    if (!def) continue
    if (!tierGroups.has(def.tier)) tierGroups.set(def.tier, [])
    tierGroups.get(def.tier)!.push(code)
  }

  // By DEFAULT there is no vertical (top) freeze: the header row scrolls away with
  // the page (the user chose natural page scroll over a capped-height frozen-header
  // data-grid). position is kept 'sticky' only so the CORNER can carry its horizontal
  // left:0 name-column freeze (added in the corner's own style block); with no `top`
  // the code headers have no vertical anchor and scroll normally.
  //
  // The header's divider from the first row (the bottom-border boxShadow) is LIFTED
  // to `.sr-bc-matrix thead th` in globals.css — same value, so unpinned rendering is
  // byte-identical. It cannot stay here: the opt-in `.sr-bc-matrix--pinned` rule has
  // to override it, and a React inline style is specificity 1,0,0, unreachable from a
  // stylesheet. Everything the pinned band needs (sticky, top, the iOS
  // safe-area-inset top, scroll-margin-top) lives in that stylesheet for the same
  // reason — an inline `top: 0` could never be re-pointed by the .sr-ios-app gate,
  // and the band would pin into the notch.
  //
  // Keeping keyboard focus clear of the band (WCAG 2.2 SC 2.4.11) is done there
  // too, by `scroll-margin-top` on the pinned body cells AND their focusable
  // DESCENDANTS. The descendants are the operative half: focus goes to the
  // <button> BirdName renders inside the cell, not to the cell, and scroll-margin
  // applies to the element scrolled into view and does not inherit — so a rule on
  // the cells alone is inert. This is the vertical counterpart of, but NOT the
  // same property as, the wrapper's scrollPaddingLeft below: scroll-padding goes
  // on a scrollport, scroll-margin goes on a focus target, and in Unbounded the
  // scrollport is the page rather than any element this component owns.
  const thBase: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    userSelect: 'none',
    background: 'var(--sr-bg)',
  }

  // Sortable headers are real <button>s inside the <th> so screen readers
  // announce them as activatable controls (the <th> keeps role columnheader +
  // aria-sort). The button inherits the th's text styling and fills the cell.
  const sortBtn = (active: boolean, justify: 'flex-start' | 'center'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: justify,
    width: '100%',
    font: 'inherit',
    letterSpacing: 'inherit',
    textTransform: 'inherit',
    color: active ? 'var(--sr-text)' : 'var(--sr-text-muted)',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  })

  return (
    <div
      // .sr-bc-card is applied ONLY in wideMode — it owns the card's width so the
      // ≤640 phone tier can override it (an inline width is unreachable by a media
      // query). Base rule `width: max-content` reproduces the old inline wideMode
      // value exactly (desktop Unbounded byte-identical: the card hugs its wide
      // auto-layout table). At ≤640 the class switches to `width: min-content`, which
      // sizes the card to the SUM of the fixed-layout table's DECLARED column widths
      // (~540px) instead of `max-content`'s INTRINSIC content width (~1751px) — so the
      // now-narrow 30px-column table no longer trails ~1200px of empty card to its
      // right. min-content (not fit-content) sizes to the declared-width sum
      // regardless of viewport, so a 320px phone can't cap the card below the table
      // and force a table-overflows-card clip. Normal mode omits the class entirely
      // (no max-content card — it uses the overflowX:auto wrapper), so it is untouched.
      className={wideMode ? 'sr-bc-card' : undefined}
      style={{
        border: '1px solid var(--sr-border)',
        borderRadius: 10,
        background: 'var(--sr-surface)',
        display: 'flex',
        flexDirection: 'column',
        // min-width:0 lets this card shrink below the table's max-content width
        // when it's a flex child of the panel, so the inner overflowX:auto wrapper
        // actually engages and scrolls instead of pushing the whole page wide.
        minWidth: 0,
      }}
    >
      {/* Horizontal-only scroll: overflow-x:auto keeps the wide matrix scrolling
          sideways WITHIN the card (no page-level horizontal leak) while the table
          renders at its FULL natural height and the whole PAGE scrolls vertically as
          one — so the tier legend below simply follows the last row in normal flow.
          No vertical max-height / inner scroll box (the user chose natural page
          scroll over a capped frozen-header data-grid). */}
      {/* scrollPaddingLeft keeps a focused cell from landing under the sticky
          first column when keyboard focus scrolls it horizontally (WCAG 2.2 SC 2.4.11). */}
      {/* position:relative scopes the cells' absolutely-positioned .sr-only
          screen-reader spans to THIS scroll container, so they're clipped with
          the table instead of escaping to the page and forcing horizontal page
          scroll on phones (the wide matrix sits far right of the viewport). */}
      <div style={wideMode ? {} : { overflowX: 'auto', scrollPaddingLeft: NAME_COL_WIDTH, minWidth: 0, position: 'relative' }}>
        {/* .sr-bc-matrix owns the table's width/min-width AND a ≤640-only
            `table-layout: fixed` (globals.css). The BASE class rule is today's
            `width: 100%; min-width: max-content` (so desktop + Normal are
            byte-identical, and Unbounded on desktop keeps its content-driven wide
            columns). At the ≤640 phone tier the class switches to
            `table-layout: fixed; width: max-content; min-width: 0`, which makes the
            declared column widths (name = NAME_COL_WIDTH; each code col = the
            .sr-bc-code-col 30px) AUTHORITATIVE, so the phone narrowing holds in BOTH
            Normal and Unbounded (wideMode). The width MUST live on the class, not
            inline: `table-layout: fixed` + inline `width: 100%` + inline
            `min-width: max-content` inside wideMode's shrink-to-fit (max-content)
            card is a CIRCULAR width constraint that runs away to the browser's
            max-element cap (~500,000px). Under `fixed`, `width: max-content` resolves
            to the sum of the declared column widths (~540px) — definite and
            non-circular. Per the standing convention (inline beats a media query),
            these widths live on the class so the ≤640 rule can override them.

            .sr-bc-matrix--pinned is the opt-in pinned-code-labels modifier. It is
            added ONLY in Unbounded (see pinnedNow above); with it absent the whole
            pinned rule block in globals.css is inert and the table renders exactly
            as it ships. borderCollapse:'separate' below is already required for
            sticky table headers, so nothing changes there. */}
        <table className={pinnedNow ? 'sr-bc-matrix sr-bc-matrix--pinned' : 'sr-bc-matrix'} style={{
          borderCollapse: 'separate',
          borderSpacing: 0,
        }}>
          <thead>
            <tr>
              {/* The corner (species-name header) keeps the HORIZONTAL name-column
                  freeze only: sticky left:0 in Normal so the name column stays put
                  while the codes scroll sideways (wideMode drops it, as before).
                  zIndex 3 keeps it above the sticky name body cells (1) during a
                  sideways scroll. No vertical freeze is set here in either mode:
                  unpinned, the header scrolls away with the page; pinned (Unbounded
                  only), the corner is an ORDINARY member of the pinned header row
                  and picks up sticky/top from .sr-bc-matrix--pinned like every other
                  header cell — it holds vertically and travels horizontally with the
                  rest, which is the shipped Unbounded behavior. Because Unbounded
                  drops the left freeze, the corner is never sticky on both axes. */}
              <th
                scope="col"
                className="sr-bc-name-col"
                aria-sort={sort.column === 'name' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                style={{
                  ...thBase,
                  ...(wideMode ? {} : { position: 'sticky', left: 0, zIndex: 3, boxShadow: 'inset 0 -1px 0 var(--sr-border), 1px 0 0 var(--sr-border)' }),
                  textAlign: 'left',
                  padding: '10px 12px',
                  width: NAME_COL_WIDTH,
                  minWidth: NAME_COL_WIDTH,
                }}
              >
                <button type="button" style={sortBtn(sort.column === 'name', 'flex-start')} onClick={() => handleHeaderClick('name')}>
                  Species{sortIndicator('name')}
                </button>
              </th>
              {codesPresent.map(code => {
                const def = BREEDING_CODE_MAP.get(code)!
                return (
                  <th
                    key={code}
                    scope="col"
                    className="sr-bc-code-col"
                    aria-sort={sort.column === code ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    title={def.label}
                    // Width + column separator live in .sr-bc-code-col
                    // (globals.css): 44px base narrowing to ~30px at the ≤640
                    // phone tier (an inline width can't be reached by a media
                    // query). No inline sticky/top/zIndex: unpinned the code
                    // headers scroll away normally with the page, and the pinned
                    // opt-in comes from .sr-bc-matrix--pinned in the stylesheet.
                    style={{
                      ...thBase,
                      textAlign: 'center',
                      padding: '10px 0',
                    }}
                  >
                    {/* The visible header is the terse code; the aria-label carries
                        the full meaning so screen-reader / touch users get it
                        without the UA title tooltip (which never fires on focus). */}
                    <button
                      type="button"
                      aria-label={`Sort by ${def.label} (${code})`}
                      style={sortBtn(sort.column === code, 'center')}
                      onClick={() => handleHeaderClick(code)}
                    >
                      {code}{sortIndicator(code)}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={codesPresent.length + 1} style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--sr-text-muted)', fontSize: '0.8125rem' }}>
                  No species match these filters.
                </td>
              </tr>
            )}
            {sorted.map(entry => {
              const isHovered = hoveredRow === entry.commonName
              const rowBg = isHovered ? 'var(--sr-surface-faint)' : 'var(--sr-surface)'
              return (
                <tr
                  key={entry.commonName}
                  onMouseEnter={() => setHoveredRow(entry.commonName)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <th scope="row" className="sr-bc-name-col" style={{
                    padding: '9px 12px',
                    // <th> defaults to center; match the left-aligned name cells used
                    // elsewhere (Media tab, Life List, etc.).
                    textAlign: 'left',
                    // Horizontal name-column freeze only: sticky left:0 keeps the name
                    // visible while the codes scroll sideways (zIndex 1 lifts it above
                    // the normal body cells during that scroll). No vertical freeze.
                    ...(wideMode ? {} : { position: 'sticky', left: 0, zIndex: 1, boxShadow: '1px 0 0 var(--sr-border)' }),
                    background: rowBg,
                    width: NAME_COL_WIDTH,
                    minWidth: NAME_COL_WIDTH,
                    maxWidth: NAME_COL_WIDTH,
                    borderTop: '1px solid var(--sr-border-subtle)',
                    verticalAlign: 'middle',
                    fontWeight: 'normal',
                  }}>
                    <BirdName
                      commonName={entry.commonName}
                      scientificName={entry.scientificName}
                      taxonCode={taxonMap[entry.commonName]}
                      hasEntry={!!onOpenSpecies}
                      onOpenSpecies={onOpenSpecies}
                      showSci
                    />
                  </th>
                  {codesPresent.map(code => {
                    const count = entry.codes[code] ?? 0
                    const def = BREEDING_CODE_MAP.get(code)!
                    return (
                      <td
                        key={code}
                        className="sr-bc-code-col"
                        style={{
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          padding: '6px 0',
                          background: rowBg,
                          borderTop: '1px solid var(--sr-border-subtle)',
                        }}
                      >
                        {count > 0 && (() => {
                          const tierCategoryName = def.tier >= 3 ? 'Confirmed' : def.tier === 2 ? 'Probable' : 'Possible'
                          return (
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: TIER_COLORS[def.tier],
                              color: TIER_TEXT_COLORS[def.tier],
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              letterSpacing: '-0.3px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              {count}
                              <span className="sr-only">, {tierCategoryName}</span>
                            </div>
                          )
                        })()}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{
        background: 'var(--sr-surface-faint)',
        borderTop: '1px solid var(--sr-border-subtle)',
        padding: '12px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        flexShrink: 0,
      }}>
        {([4, 3, 2, 1] as const).filter(tier => tierGroups.has(tier)).map(tier => (
          <div key={tier} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              background: TIER_COLORS[tier], flexShrink: 0, marginTop: 1,
            }} />
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', minWidth: 0 }}>
              <span style={{ fontWeight: 600 }}>{TIER_LABELS[tier]}</span>
              {/* Each present code shows its full meaning as visible text (e.g.
                  "NB Nest Building") so a touch user reads it without the hover-only
                  title tooltip. The list wraps gracefully on a phone. */}
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginTop: 3 }}>
                {tierGroups.get(tier)!.map(code => (
                  <span key={code} style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 700 }}>{code}</span> {BREEDING_CODE_MAP.get(code)!.label}
                  </span>
                ))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
