import { useState, useCallback } from 'react'
import { parseEbirdCSV } from '../lib/parseEbird'
import { compareSpecies } from '../lib/compare'
import type { FileData, ComparisonResult } from '../types'
import { DropZone } from './DropZone'
import { ResultsView } from './ResultsView'

interface ListComparerProps {
  onExpandedChange?: (expanded: boolean) => void
}

export function ListComparer({ onExpandedChange }: ListComparerProps) {
  const [fileA, setFileA] = useState<FileData | null>(null)
  const [fileB, setFileB] = useState<FileData | null>(null)
  const [errorA, setErrorA] = useState<string | null>(null)
  const [errorB, setErrorB] = useState<string | null>(null)
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [expanded, setExpanded] = useState(false)

  const processFile = useCallback((slot: 'a' | 'b', filename: string, file: File) => {
    const setFile = slot === 'a' ? setFileA : setFileB
    const setError = slot === 'a' ? setErrorA : setErrorB

    if (!filename.toLowerCase().endsWith('.csv')) {
      setFile(null)
      setError('Please upload a CSV file. eBird backups are downloaded as .csv.')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = parseEbirdCSV(filename, e.target?.result as string)
        setFile(data)
        setError(null)
      } catch (err) {
        setFile(null)
        if (err instanceof Error && err.message === 'INVALID_EBIRD') {
          setError("This doesn't look like an eBird backup. Make sure you're using the 'Download My Data' export from eBird.")
        } else {
          setError('Something went wrong reading this file. Try re-downloading it from eBird.')
        }
      }
    }
    reader.onerror = () => {
      setFile(null)
      setError('Something went wrong reading this file. Try re-downloading it from eBird.')
    }
    reader.readAsText(file)
  }, [])

  const handleCompare = () => {
    if (!fileA || !fileB) return
    setResult(compareSpecies(fileA.species, fileB.species))
  }

  const handleReset = () => {
    setFileA(null)
    setFileB(null)
    setErrorA(null)
    setErrorB(null)
    setResult(null)
    setExpanded(false)
    onExpandedChange?.(false)
  }

  const handleToggleExpanded = () => {
    setExpanded(prev => {
      const next = !prev
      onExpandedChange?.(next)
      return next
    })
  }

  const canCompare = fileA !== null && fileB !== null

  return (
    <div style={{
      flex: 1,
      minHeight: 0,
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {result ? (
        <ResultsView
          fileA={fileA!}
          fileB={fileB!}
          result={result}
          onReset={handleReset}
          expanded={expanded}
          onToggleExpanded={handleToggleExpanded}
        />
      ) : (
        <div style={{ width: '100%', maxWidth: 600 }}>
          <h1 style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.4px',
            marginBottom: 6,
            color: '#0F1117',
          }}>
            Compare two eBird life lists
          </h1>
          <p style={{ fontSize: 14, color: '#71717A', lineHeight: 1.55, marginBottom: 28 }}>
            Drop your eBird backup CSV files below to see which birds you share and which are unique to each list.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <DropZone
              label="File A"
              file={fileA}
              error={errorA}
              onFile={(name, file) => processFile('a', name, file)}
            />
            <DropZone
              label="File B"
              file={fileB}
              error={errorB}
              onFile={(name, file) => processFile('b', name, file)}
            />
          </div>

          <button
            onClick={handleCompare}
            disabled={!canCompare}
            aria-disabled={!canCompare}
            style={{
              width: '100%',
              height: 48,
              background: '#2D8653',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: canCompare ? 'pointer' : 'not-allowed',
              opacity: canCompare ? 1 : 0.4,
              transition: 'opacity 0.15s',
            }}
          >
            Compare Lists
          </button>
        </div>
      )}
    </div>
  )
}
