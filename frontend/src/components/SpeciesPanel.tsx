import { BirdName } from './BirdName'

interface SpeciesPanelProps {
  title: string
  species: string[]
  taxonMap?: Record<string, string>
  /** True ⇒ these species are in the user's data (link the name to Species Detail). */
  hasEntry?: boolean
  onOpenSpecies?: (commonName: string) => void
}

export function SpeciesPanel({ title, species, taxonMap = {}, hasEntry = false, onOpenSpecies }: SpeciesPanelProps) {
  return (
    <div style={{
      border: '1px solid var(--sr-border)',
      borderRadius: 10,
      overflow: 'visible',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--sr-surface)',
    }}>
      <div style={{
        padding: '13px 18px',
        borderBottom: '1px solid var(--sr-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'var(--sr-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginRight: 8,
        }}>
          {title}
        </span>
        <span style={{
          flexShrink: 0,
          padding: '2px 8px',
          background: 'var(--sr-accent-bg)',
          color: 'var(--sr-accent)',
          fontSize: '0.6875rem',
          fontWeight: 600,
          borderRadius: 20,
        }}>
          {species.length}
        </span>
      </div>

      <ul
        style={{
          overflowY: 'visible',
          padding: '6px 0',
          listStyle: 'none',
          margin: 0,
        }}
        role="list"
        aria-label={`${title}: ${species.length} species`}
      >
        {species.length === 0 ? (
          <li style={{ padding: '32px 18px', fontSize: '0.8125rem', color: 'var(--sr-text-muted)', textAlign: 'center' }}>
            No species
          </li>
        ) : (
          species.map(name => (
            <li
              key={name}
              style={{
                padding: '5px 18px',
                fontSize: '0.84375rem',
                color: 'var(--sr-text)',
                lineHeight: 1.45,
                borderBottom: '1px solid var(--sr-border-subtle)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <BirdName commonName={name} taxonCode={taxonMap[name]} hasEntry={hasEntry} onOpenSpecies={onOpenSpecies} />
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
