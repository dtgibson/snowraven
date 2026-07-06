// Shared sortable list of individually-named birds. Used by the Named Birds tab
// (showSpecies, singleOpen, with a per-individual map) and by a per-species
// section on Species Detail (showSpecies off, multi-open, no map). Each row
// expands to the bird's reports: date · location · checklist link, the species
// comment as a quoted block, and (on the tab) a small sightings map.

import { useMemo, useState } from 'react'
import { sortNamedBirds, type NamedBird, type NamedBirdSort } from '../lib/namedBirds'
import { NamedBirdRow } from './NamedBirdRow'
import { useHotspotSet } from '../lib/useHotspotSet'
import type { NamedBirdAsset } from '../lib/namedBirdMedia'

export function NamedBirdsTable({ birds, showSpecies, renderSpecies, orderFor, singleOpen, mediaByBird, hasML }: {
  birds: NamedBird[]
  showSpecies: boolean
  /** Renders a species name (BirdName) — supplied only when showSpecies. */
  renderSpecies?: (commonName: string, scientificName: string) => React.ReactNode
  /** commonName → eBird taxonomic order. Supplied only by the Named Birds tab —
   *  enables (and gates the presence of) the Taxonomic sort. */
  orderFor?: (commonName: string) => number
  /** Accordion mode: opening a card collapses the previously open one, capping
   *  live maps at one WebGL context. The Named Birds tab passes true; Species
   *  Detail's map-less section stays multi-open. */
  singleOpen?: boolean
  /** NamedBird.key → that individual's matched ML media. Supplied only by the
   *  Named Birds tab; Species Detail omits it → every row gets [] (media-less). */
  mediaByBird?: Map<string, NamedBirdAsset[]>
  /** True when an ML export is loaded (rides alongside mediaByBird) — lets a bird
   *  with no matched media show the empty state vs. the section being absent. */
  hasML?: boolean
}) {
  const [sort, setSort] = useState<NamedBirdSort>('lastSeen')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const { isHotspot } = useHotspotSet()

  // orderFor in deps so the list re-sorts when the taxonomic orders load (its
  // identity changes only then) — the graceful-degradation signal for FR-14.
  const sorted = useMemo(() => sortNamedBirds(birds, sort, orderFor), [birds, sort, orderFor])

  const toggle = (key: string) =>
    setExpanded(prev => {
      if (singleOpen) return prev.has(key) ? new Set() : new Set([key])
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const sortOptions: { key: NamedBirdSort; label: string }[] = showSpecies
    ? [
        { key: 'name', label: 'Name (Individual)' },
        { key: 'alphabetical', label: 'Alphabetical' },
        { key: 'taxonomic', label: 'Taxonomic' },
        { key: 'lastSeen', label: 'Last Seen' },
      ]
    : [
        { key: 'name', label: 'Name (Individual)' },
        { key: 'lastSeen', label: 'Last Seen' },
      ]

  return (
    <div>
      {/* Sort control — wrap-aware so the wide "Name (Individual)" label never
          truncates and the group reflows to two rows on a phone. */}
      <div role="group" aria-label="Sort named birds" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', fontWeight: 600 }}>Sort</span>
        {/* Self-bordered pills with a gap (not a shared shell + borderLeft
            dividers): when the group wraps at large text scale, each pill keeps
            its own rounded border instead of leaving stray divider lines and a
            rounded shell that no longer encloses row 2. */}
        <div className="sr-wrap-flex" style={{ ['--sr-wrap-gap' as string]: '6px' }}>
          {sortOptions.map((o) => (
            <button tabIndex={0}
              className="sr-touch-target"
              key={o.key}
              aria-pressed={sort === o.key}
              onClick={() => setSort(o.key)}
              style={{
                height: 30, padding: '0 13px',
                border: '1.5px solid var(--sr-accent-border)', borderRadius: 8,
                background: sort === o.key ? 'var(--sr-accent-bg)' : 'transparent',
                color: sort === o.key ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: '0.75rem', fontWeight: sort === o.key ? 600 : 500,
                fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-disabled)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
          {birds.length} {birds.length === 1 ? 'named bird' : 'named birds'}
        </span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.map(bird => (
          <NamedBirdRow
            key={bird.key}
            bird={bird}
            open={expanded.has(bird.key)}
            onToggle={() => toggle(bird.key)}
            showSpecies={showSpecies}
            showMap={!!singleOpen}
            renderSpecies={renderSpecies}
            isHotspot={isHotspot}
            media={mediaByBird?.get(bird.key) ?? []}
            hasML={!!hasML}
          />
        ))}
      </div>
    </div>
  )
}
