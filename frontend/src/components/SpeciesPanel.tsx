import { SpeciesLinks } from './SpeciesLinks'

interface SpeciesPanelProps {
  title: string
  species: string[]
  expanded?: boolean
  taxonMap?: Record<string, string>
}

export function SpeciesPanel({ title, species, expanded = false, taxonMap = {} }: SpeciesPanelProps) {
  return (
    <div style={{
      border: '1px solid #E4E4E7',
      borderRadius: 10,
      overflow: expanded ? 'visible' : 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
    }}>
      <div style={{
        padding: '13px 18px',
        borderBottom: '1px solid #E4E4E7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: '#0F1117',
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
          background: '#E8F5EE',
          color: '#2D8653',
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 20,
        }}>
          {species.length}
        </span>
      </div>

      <ul
        style={{
          overflowY: expanded ? 'visible' : 'auto',
          flex: expanded ? 'none' : 1,
          minHeight: expanded ? 'auto' : 0,
          padding: '6px 0',
          listStyle: 'none',
          margin: 0,
        }}
        role="list"
        aria-label={`${title} — ${species.length} species`}
      >
        {species.length === 0 ? (
          <li style={{ padding: '32px 18px', fontSize: 13, color: '#71717A', textAlign: 'center' }}>
            No species
          </li>
        ) : (
          species.map(name => (
            <li
              key={name}
              style={{
                padding: '5px 18px',
                fontSize: 13.5,
                color: '#0F1117',
                lineHeight: 1.45,
                borderBottom: '1px solid #E4E4E7',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {name}
              <SpeciesLinks speciesCode={taxonMap[name]} />
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
