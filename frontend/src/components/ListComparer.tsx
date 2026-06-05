import { useState, useCallback, useEffect } from 'react'
import { FileCheck } from 'lucide-react'
import { parseEbirdCSV } from '../lib/parseEbird'
import { compareSpecies } from '../lib/compare'
import type { FileData, ComparisonResult, SortOrder } from '../types'
import { DropZone } from './DropZone'
import { ResultsView } from './ResultsView'
import { transport } from '../lib/transport'
import { storage } from '../lib/storage'

export function ListComparer({ onOpenSpecies }: { onOpenSpecies?: (commonName: string) => void }) {
  const [storedEbirdStatus, setStoredEbirdStatus] = useState<'loading' | 'available' | 'unavailable'>('loading')
  const [listAMode, setListAMode] = useState<'my-list' | 'upload'>('my-list')
  const [fileA, setFileA] = useState<FileData | null>(null)
  const [fileB, setFileB] = useState<FileData | null>(null)
  const [errorA, setErrorA] = useState<string | null>(null)
  const [errorB, setErrorB] = useState<string | null>(null)
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [sort, setSort] = useState<SortOrder>('taxonomic')
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  const [comparing, setComparing] = useState(false)
  const [listALabel, setListALabel] = useState('My List')
  const [listBLabel, setListBLabel] = useState('Other List')
  // Whether List A is the user's own stored backup (⇒ those species have Species Detail entries).
  const [resultAIsMine, setResultAIsMine] = useState(false)

  useEffect(() => {
    storage.getFilesStatus()
      .then(data => {
        const hasEbird = data.ebird != null
        setStoredEbirdStatus(hasEbird ? 'available' : 'unavailable')
        if (!hasEbird) setListAMode('upload')
      })
      .catch(() => {
        setStoredEbirdStatus('unavailable')
        setListAMode('upload')
      })
  }, [])

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

  const fetchTaxonCodes = async (names: string[]) => {
    try {
      const data = await transport.post<{ codes: Record<string, string> }>(
        '/taxonomy/codes',
        { species: names.map(n => ({ commonName: n, scientificName: '' })) }
      )
      setTaxonMap(data.codes ?? {})
    } catch {
      // silently fail — icons simply won't appear
    }
  }

  const handleCompare = async () => {
    if (!fileB) return
    setComparing(true)
    setErrorA(null)
    try {
      let listA = fileA
      if (listAMode === 'my-list') {
        const text = await storage.readFile('ebird')
        if (!text) {
          setErrorA("Couldn't load your eBird backup from Settings. Try re-uploading it.")
          return
        }
        listA = parseEbirdCSV('My List', text)
      }
      if (!listA) return

      const resolvedALabel = listAMode === 'my-list' ? 'My List' : listA.filename
      const resolvedBLabel = listAMode === 'my-list' ? 'Other List' : fileB.filename
      setListALabel(resolvedALabel)
      setListBLabel(resolvedBLabel)

      const compResult = compareSpecies(listA, fileB)
      setResult(compResult)
      setResultAIsMine(listAMode === 'my-list')
      fetchTaxonCodes([...compResult.both, ...compResult.aOnly, ...compResult.bOnly])
    } catch {
      setErrorA("Couldn't load your eBird backup. Try re-uploading it in Settings.")
    } finally {
      setComparing(false)
    }
  }

  const handleReset = () => {
    setFileA(null)
    setFileB(null)
    setErrorA(null)
    setErrorB(null)
    setResult(null)
    setSort('taxonomic')
    setTaxonMap({})
  }

  const canCompare = comparing
    ? false
    : listAMode === 'my-list'
      ? fileB !== null && storedEbirdStatus === 'available'
      : fileA !== null && fileB !== null

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
          listALabel={listALabel}
          listBLabel={listBLabel}
          result={result}
          onReset={handleReset}
          sort={sort}
          onSortChange={setSort}
          taxonMap={taxonMap}
          listAIsMine={resultAIsMine}
          onOpenSpecies={onOpenSpecies}
        />
      ) : (
        <div style={{ width: '100%', maxWidth: 600 }}>
          <h1 style={{
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '-0.4px',
            marginBottom: 6,
            color: 'var(--sr-text)',
          }}>
            Compare eBird life lists
          </h1>
          <p style={{ fontSize: 14, color: 'var(--sr-text-muted)', lineHeight: 1.55, marginBottom: 28 }}>
            {storedEbirdStatus === 'available'
              ? 'Use your saved eBird backup as your list, or upload two files to compare.'
              : 'Drop your eBird backup CSV files below to see which birds you share and which are unique to each list.'}
          </p>

          {storedEbirdStatus === 'available' && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
                letterSpacing: '0.07em', color: 'var(--sr-text-disabled)', marginBottom: 8,
              }}>
                List A
              </div>
              <div style={{
                display: 'inline-flex',
                borderRadius: 7,
                border: '1.5px solid var(--sr-border)',
                overflow: 'hidden',
              }}>
                {(['my-list', 'upload'] as const).map((mode, i) => (
                  <button tabIndex={0}
                    key={mode}
                    onClick={() => setListAMode(mode)}
                    style={{
                      height: 32, padding: '0 14px',
                      fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                      cursor: 'pointer', border: 'none',
                      borderLeft: i > 0 ? '1.5px solid var(--sr-border)' : 'none',
                      background: listAMode === mode ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                      color: listAMode === mode ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {mode === 'my-list' ? 'My List' : 'Upload a file'}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {listAMode === 'my-list' ? (
              <div style={{
                minHeight: 192,
                borderRadius: 10,
                border: '2px solid var(--sr-accent)',
                background: 'var(--sr-accent-bg)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '40px 24px 28px',
                position: 'relative',
              }}>
                <span style={{
                  position: 'absolute', top: 14, left: 18,
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const,
                  letterSpacing: '0.08em', color: 'var(--sr-accent)',
                }}>
                  List A
                </span>
                <FileCheck size={28} strokeWidth={1.75} style={{ color: 'var(--sr-accent)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--sr-accent)' }}>My List</span>
                <span style={{ fontSize: 12, color: 'var(--sr-accent-border-strong)' }}>Loaded from Settings</span>
              </div>
            ) : (
              <DropZone
                label="List A"
                file={fileA}
                error={errorA}
                onFile={(name, file) => processFile('a', name, file)}
              />
            )}
            <DropZone
              label="List B"
              file={fileB}
              error={errorB}
              onFile={(name, file) => processFile('b', name, file)}
            />
          </div>

          {errorA && listAMode === 'my-list' && (
            <p style={{ fontSize: 12, color: 'var(--sr-error)', marginBottom: 12, margin: '0 0 12px' }}>
              {errorA}
            </p>
          )}

          <button tabIndex={0}
            onClick={handleCompare}
            disabled={!canCompare}
            aria-disabled={!canCompare}
            style={{
              width: '100%',
              height: 48,
              background: 'var(--sr-accent)',
              color: 'var(--sr-on-accent)',
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
            {comparing ? 'Loading…' : 'Compare Lists'}
          </button>
        </div>
      )}
    </div>
  )
}
