import type { FileData, ComparisonResult, SortOrder } from '../types'
import { SpeciesPanel } from './SpeciesPanel'

interface ResultsViewProps {
  fileA: FileData
  fileB: FileData
  result: ComparisonResult
  onReset: () => void
  expanded: boolean
  onToggleExpanded: () => void
  sort: SortOrder
  onSortChange: (s: SortOrder) => void
}

function sortedSpecies(names: string[], order: Map<string, number>, sort: SortOrder): string[] {
  if (sort === 'alpha') return names
  return [...names].sort((a, b) => {
    const oa = order.get(a) ?? Infinity
    const ob = order.get(b) ?? Infinity
    if (oa !== ob) return oa - ob
    return a.localeCompare(b)
  })
}

export function ResultsView({ fileA, fileB, result, onReset, expanded, onToggleExpanded, sort, onSortChange }: ResultsViewProps) {
  const nameA = fileA.filename
  const nameB = fileB.filename
  const { taxOrder } = result
  const displayBoth = sortedSpecies(result.both, taxOrder, sort)
  const displayAOnly = sortedSpecies(result.aOnly, taxOrder, sort)
  const displayBOnly = sortedSpecies(result.bOnly, taxOrder, sort)

  return (
    <div style={{
      width: '100%',
      maxWidth: 880,
      display: 'flex',
      flexDirection: 'column',
      flex: expanded ? 'none' : 1,
      minHeight: expanded ? 'auto' : 0,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
        gap: 16,
        flexShrink: 0,
      }}>
        <p style={{ fontSize: 14, color: '#71717A', margin: 0 }}>
          Comparing{' '}
          <strong style={{ fontWeight: 600, color: '#0F1117' }}>{nameA}</strong>
          {' '}and{' '}
          <strong style={{ fontWeight: 600, color: '#0F1117' }}>{nameB}</strong>
        </p>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1.5px solid #E4E4E7' }}>
            {(['taxonomic', 'alpha'] as SortOrder[]).map((s, i) => (
              <button
                key={s}
                onClick={() => onSortChange(s)}
                style={{
                  height: 34,
                  padding: '0 12px',
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  border: 'none',
                  borderLeft: i > 0 ? '1.5px solid #E4E4E7' : 'none',
                  background: sort === s ? '#F4F4F5' : '#fff',
                  color: sort === s ? '#0F1117' : '#71717A',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {s === 'taxonomic' ? 'Taxonomic' : 'A–Z'}
              </button>
            ))}
          </div>
          <button
            onClick={onToggleExpanded}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              padding: '0 14px',
              background: expanded ? '#E8F5EE' : 'transparent',
              color: '#2D8653',
              border: '1.5px solid rgba(45,134,83,0.22)',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {expanded ? '↑ Collapse' : '↓ Show all'}
          </button>
          <button
            onClick={onReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 34,
              padding: '0 14px',
              background: 'transparent',
              color: '#2D8653',
              border: '1.5px solid rgba(45,134,83,0.22)',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            ← Compare new files
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div
        role="region"
        aria-label="Comparison summary"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          border: '1px solid #E4E4E7',
          borderRadius: 10,
          overflow: 'hidden',
          marginBottom: 20,
          flexShrink: 0,
        }}
      >
        <Stat value={result.totalA} label={`${nameA} total`} />
        <Stat value={result.totalB} label={`${nameB} total`} />
        <Stat value={result.both.length} label="In both" highlight />
        <Stat value={result.aOnly.length} label={`${nameA} only`} />
        <Stat value={result.bOnly.length} label={`${nameB} only`} isLast />
      </div>

      {/* Panels */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        flex: expanded ? 'none' : 1,
        minHeight: expanded ? 'auto' : 0,
      }}>
        <SpeciesPanel title="In Both" species={displayBoth} expanded={expanded} />
        <SpeciesPanel title={`${nameA} only`} species={displayAOnly} expanded={expanded} />
        <SpeciesPanel title={`${nameB} only`} species={displayBOnly} expanded={expanded} />
      </div>
    </div>
  )
}

function Stat({ value, label, highlight = false, isLast = false }: {
  value: number
  label: string
  highlight?: boolean
  isLast?: boolean
}) {
  return (
    <div style={{
      background: '#fff',
      padding: '18px 20px',
      borderRight: isLast ? 'none' : '1px solid #E4E4E7',
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
      minWidth: 0,
    }}>
      <span style={{
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: '-0.5px',
        lineHeight: 1,
        color: highlight ? '#2D8653' : '#0F1117',
      }}>
        {value}
      </span>
      <span style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        color: '#71717A',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </div>
  )
}
