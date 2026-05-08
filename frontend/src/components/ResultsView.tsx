import type { FileData, ComparisonResult } from '../types'
import { SpeciesPanel } from './SpeciesPanel'

interface ResultsViewProps {
  fileA: FileData
  fileB: FileData
  result: ComparisonResult
  onReset: () => void
  expanded: boolean
  onToggleExpanded: () => void
}

export function ResultsView({ fileA, fileB, result, onReset, expanded, onToggleExpanded }: ResultsViewProps) {
  const nameA = fileA.filename
  const nameB = fileB.filename

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
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
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
        <SpeciesPanel title="In Both" species={result.both} expanded={expanded} />
        <SpeciesPanel title={`${nameA} only`} species={result.aOnly} expanded={expanded} />
        <SpeciesPanel title={`${nameB} only`} species={result.bOnly} expanded={expanded} />
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
