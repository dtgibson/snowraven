// The per-individual "Top locations" block on the Named Birds tab: where THIS
// named bird has been recorded, ranked by its own sighting count. Sits between a
// card's sighting reports and its map, and reads as a third section of the same
// card — the same uppercase micro-label idiom as "Where {name} has been seen" and
// "Media of {name}", flat on --sr-surface-faint, no card inside a card.
//
// The ranking is a pure helper (computeNamedBirdLocations) so the "one sighting
// per checklist, skip the unlocated, group by name" semantics are unit-testable
// without React. This component is presentational + reveal-state only.
//
// Named-Birds-tab-only, gated by the same `showMap` prop as the map and the media
// section: Species Detail's reuse of NamedBirdsTable already sits beneath its own
// species-wide Top Locations, and a second, narrower list there would be noise.

import { useMemo, useState } from 'react'
import { MapPin, ChevronDown } from 'lucide-react'
import { computeNamedBirdLocations } from '../lib/namedBirds'
import { HotspotLink } from './HotspotLink'
import type { NamedSighting } from '../lib/namedBirds'

/** Rows shown before the expander. Species Detail shows 10; a card inside a
 *  single-open accordion can't afford that much vertical run. */
const INITIAL_ROWS = 5

export function NamedBirdLocations({ sightings, isHotspot, lastInCard = false }: {
  /** This individual's sightings — already name-tag-scoped by computeNamedBirds. */
  sightings: NamedSighting[]
  isHotspot: (locId: string | null | undefined) => boolean
  /** True when no map and no media section follow, so the block closes the card
   *  and needs the bottom padding the map block would otherwise supply. */
  lastInCard?: boolean
}) {
  const locations = useMemo(() => computeNamedBirdLocations(sightings), [sightings])
  // Reveal state is per row-instance and resets for free: NamedBirdRow renders
  // this only inside its `{open && (…)}` body, so collapsing a card unmounts it.
  const [showAll, setShowAll] = useState(false)

  // No located sightings → no block at all (heading included), mirroring the map's
  // absence for a bird with no usable coordinates.
  if (locations.length === 0) return null

  const label = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7,
      fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.04em',
      textTransform: 'uppercase', color: 'var(--sr-text-muted)',
    }}>
      <MapPin size={12} strokeWidth={2.2} aria-hidden />
      Top locations
    </div>
  )

  // A ranking of one is not a ranking. One place → a sentence, no numbering and
  // no expander.
  if (locations.length === 1) {
    const only = locations[0]
    return (
      <div style={{ padding: lastInCard ? '12px 14px 14px' : '12px 14px 2px' }}>
        {label}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, padding: '3px 0 1px', fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>
          <span>Every sighting at</span>
          <HotspotLink
            locId={only.locationId}
            name={only.location}
            isHotspot={isHotspot(only.locationId)}
            title={only.location}
            style={{ fontSize: '0.75rem', fontWeight: 600 }}
          />
        </div>
      </div>
    )
  }

  const visible = showAll ? locations : locations.slice(0, INITIAL_ROWS)

  return (
    <div style={{ padding: lastInCard ? '12px 14px 14px' : '12px 14px 2px' }}>
      {label}
      {visible.map((loc, i) => (
        <div
          key={`${loc.locationId || loc.location}-${i}`}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 0',
            borderBottom: i < visible.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none',
          }}
        >
          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', minWidth: 16, flexShrink: 0, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {i + 1}.
          </span>
          {/* The name is the only thing that shrinks: it ellipsizes so the count
              never leaves the row, exactly as the report rows above behave. */}
          <HotspotLink
            locId={loc.locationId}
            name={loc.location}
            isHotspot={isHotspot(loc.locationId)}
            truncate
            title={loc.location}
            style={{ fontSize: '0.75rem', flex: 1, minWidth: 0, color: 'var(--sr-text-muted)' }}
          />
          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {loc.count} {loc.count === 1 ? 'sighting' : 'sightings'}
          </span>
        </div>
      ))}

      {locations.length > INITIAL_ROWS && (
        <button tabIndex={0}
          className="sr-touch-target"
          aria-expanded={showAll}
          onClick={() => setShowAll(prev => !prev)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            width: '100%', padding: '9px 0 10px', marginTop: 2,
            border: 'none', borderTop: '1px solid var(--sr-border-subtle)',
            // Transparent, not --sr-surface-faint: the card body already is that.
            background: 'transparent',
            fontSize: '0.75rem', fontWeight: 500, color: 'var(--sr-accent)',
            fontFamily: 'inherit', cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--sr-accent-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {/* The global prefers-reduced-motion block collapses this transition. */}
          <ChevronDown
            size={13}
            strokeWidth={2.5}
            aria-hidden
            style={{ transform: showAll ? 'rotate(180deg)' : 'none', transition: 'transform 150ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          />
          {showAll ? `Show top ${INITIAL_ROWS}` : `Show all ${locations.length} locations`}
        </button>
      )}
    </div>
  )
}
