// Shared sortable list of individually-named birds. Used by the Named Birds tab
// (showSpecies) and by a per-species section on Species Detail (showSpecies off).
// Each row expands to the bird's checklists: date, a link to the eBird checklist,
// and the species comment.

import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, ExternalLink } from 'lucide-react'
import { formatDate } from '../lib/formatDate'
import { sortNamedBirds, type NamedBird, type NamedBirdSort } from '../lib/namedBirds'

export function NamedBirdsTable({ birds, showSpecies, renderSpecies }: {
  birds: NamedBird[]
  showSpecies: boolean
  /** Renders a species name (BirdName) — supplied only when showSpecies. */
  renderSpecies?: (commonName: string, scientificName: string) => React.ReactNode
}) {
  const [sort, setSort] = useState<NamedBirdSort>('lastSeen')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const sorted = useMemo(() => sortNamedBirds(birds, sort), [birds, sort])

  const toggle = (key: string) =>
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const sortOptions: { key: NamedBirdSort; label: string }[] = showSpecies
    ? [{ key: 'name', label: 'Name' }, { key: 'species', label: 'Species' }, { key: 'lastSeen', label: 'Last seen' }]
    : [{ key: 'name', label: 'Name' }, { key: 'lastSeen', label: 'Last seen' }]

  return (
    <div>
      {/* Sort control */}
      <div role="group" aria-label="Sort named birds" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', fontWeight: 600 }}>Sort</span>
        <div style={{ display: 'inline-flex', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, overflow: 'hidden' }}>
          {sortOptions.map((o, i) => (
            <button tabIndex={0}
              key={o.key}
              aria-pressed={sort === o.key}
              onClick={() => setSort(o.key)}
              style={{
                height: 28, padding: '0 12px', border: 'none',
                borderLeft: i > 0 ? '1.5px solid var(--sr-accent-border)' : 'none',
                background: sort === o.key ? 'var(--sr-accent-bg)' : 'transparent',
                color: sort === o.key ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-disabled)', marginLeft: 'auto' }}>
          {birds.length} {birds.length === 1 ? 'named bird' : 'named birds'}
        </span>
      </div>

      {/* Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sorted.map(bird => {
          const open = expanded.has(bird.key)
          return (
            <div key={bird.key} style={{ border: '1px solid var(--sr-border)', borderRadius: 8, overflow: 'hidden', background: 'var(--sr-surface)' }}>
              <button tabIndex={0}
                aria-expanded={open}
                onClick={() => toggle(bird.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '10px 12px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}
              >
                <span style={{ color: 'var(--sr-text-muted)', flexShrink: 0, display: 'inline-flex' }}>
                  {open ? <ChevronDown size={15} strokeWidth={2.4} aria-hidden /> : <ChevronRight size={15} strokeWidth={2.4} aria-hidden />}
                </span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--sr-text)', flexShrink: 0 }}>{bird.name}</span>
                {showSpecies && (
                  <span style={{ minWidth: 0, overflow: 'hidden' }}>
                    {renderSpecies ? renderSpecies(bird.commonName, bird.scientificName) : (
                      <span style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>{bird.commonName}</span>
                    )}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>
                    {formatDate(bird.firstSeen)} – {formatDate(bird.lastSeen)}
                  </span>
                  <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--sr-accent)' }}>
                    {bird.sightingCount} {bird.sightingCount === 1 ? 'sighting' : 'sightings'}
                  </span>
                </span>
              </button>

              {open && (
                <div style={{ borderTop: '1px solid var(--sr-border-subtle)', background: 'var(--sr-surface-faint)' }}>
                  {bird.sightings.map((s, i) => (
                    <div
                      key={`${s.submissionId}-${i}`}
                      style={{ padding: '8px 12px 8px 35px', borderBottom: i < bird.sightings.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>{formatDate(s.date)}</span>
                        <a
                          href={`https://ebird.org/checklist/${s.submissionId}`}
                          target="_blank" rel="noreferrer"
                          aria-label={`Open eBird checklist ${s.submissionId} (opens in a new tab)`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--sr-accent)', textDecoration: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {s.submissionId}<ExternalLink size={10} strokeWidth={2.5} aria-hidden />
                        </a>
                      </div>
                      {s.comment && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--sr-text)', lineHeight: 1.5 }}>{s.comment}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
