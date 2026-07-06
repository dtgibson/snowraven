// The Named Birds tab: individual birds the user has named in their eBird species
// comments via [name:…] tags, tracked across every checklist. Loads the stored
// eBird backup (shared cache), parses + groups via lib/namedBirds, and renders the
// shared sortable NamedBirdsTable.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, AlertCircle, Tag } from 'lucide-react'
import { SetupRequired } from './SetupRequired'
import { EBIRD_BACKUP_STEPS } from './setupCopy'
import { loadEbirdObservations } from '../lib/observationsCache'
import { loadMLExport } from '../lib/mlExportCache'
import { storage } from '../lib/storage'
import { transport } from '../lib/transport'
import { normalizeSpeciesName } from '../lib/speciesUtils'
import { computeNamedBirds, type NamedBird } from '../lib/namedBirds'
import { computeNamedBirdMedia } from '../lib/namedBirdMedia'
import type { MLExportRow } from '../lib/parseMLExport'
import { NamedBirdsTable } from './NamedBirdsTable'
import { BirdName } from './BirdName'

type Phase =
  | { tag: 'loading-saved' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; birds: NamedBird[] }

export function NamedBirds({ onGoToSettings, filesVersion, onOpenSpecies }: {
  onGoToSettings: () => void
  filesVersion?: number
  onOpenSpecies?: (commonName: string) => void
}) {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading-saved' })
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  const [taxonOrders, setTaxonOrders] = useState<Record<string, number>>({})
  // The parsed ML export rows (null when no ML file is stored). ML is OPTIONAL and
  // orthogonal to the eBird backup — its absence/failure must never block or error
  // the named-birds computation, which is driven entirely by the eBird backup.
  const [mlRows, setMlRows] = useState<MLExportRow[] | null>(null)

  const fetchTaxonCodes = async (birds: NamedBird[]) => {
    try {
      const species = [...new Map(birds.map(b => [b.commonName, b.scientificName])).entries()]
        .map(([commonName, scientificName]) => ({ commonName, scientificName }))
      const data = await transport.post<{ codes: Record<string, string>; orders: Record<string, number> }>('/taxonomy/codes', { species })
      setTaxonMap(data.codes ?? {})
      setTaxonOrders(data.orders ?? {})
    } catch {
      // favicons + taxonomic sort absent — names still render and link, and the
      // sort degrades to name order until the next successful load
    }
  }

  useEffect(() => {
    let cancelled = false
    async function autoLoad() {
      setPhase({ tag: 'loading-saved' })
      setMlRows(null)
      try {
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }
        const ebird = await loadEbirdObservations()
        if (!ebird || cancelled) {
          setPhase({ tag: 'error', message: "Couldn't load your eBird backup from Settings. Try re-uploading it." })
          return
        }
        const birds = computeNamedBirds(ebird.observations)
        setPhase({ tag: 'ready', birds })
        if (birds.length > 0) fetchTaxonCodes(birds)
        // Optional ML media join — loaded independently, never gating the tab. A
        // missing/unparseable export leaves mlRows null (no media section anywhere).
        try {
          const ml = await loadMLExport()
          if (!cancelled) setMlRows(ml?.rows ?? null)
        } catch {
          if (!cancelled) setMlRows(null)
        }
      } catch {
        if (!cancelled) setPhase({ tag: 'setup-required' })
      }
    }
    autoLoad()
    return () => { cancelled = true }
  }, [filesVersion])

  const codeFor = (name: string) => taxonMap[name] ?? taxonMap[normalizeSpeciesName(name)]

  // Taxonomic-order resolver for the Taxonomic sort — mirrors the BirdingStats
  // pattern: exact match, then normalized-name fallback, then Infinity (unknown
  // species land in a stable tail). orderFor's identity changes only when
  // taxonOrders loads, which is what re-triggers the table's sort memo (FR-14).
  const normTaxonOrder = useMemo(() => {
    const m: Record<string, number> = {}
    for (const [name, ord] of Object.entries(taxonOrders)) m[normalizeSpeciesName(name)] = ord
    return m
  }, [taxonOrders])
  const orderFor = useCallback(
    (name: string) => taxonOrders[name] ?? normTaxonOrder[normalizeSpeciesName(name)] ?? Infinity,
    [taxonOrders, normTaxonOrder],
  )

  // The media join, computed once per ML load. Identity-stable until mlRows
  // changes (filesVersion drives the re-load). Pure — no impure call in the memo.
  const mediaByBird = useMemo(() => computeNamedBirdMedia(mlRows), [mlRows])
  const hasML = mlRows !== null

  if (phase.tag === 'loading-saved') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)' }} aria-hidden />
      </div>
    )
  }

  if (phase.tag === 'setup-required') {
    return (
      <SetupRequired
        title="eBird Backup Required"
        body="The Named Birds tab loads automatically from your stored eBird backup. You haven't saved one yet."
        steps={EBIRD_BACKUP_STEPS}
        onGoToSettings={onGoToSettings}
      />
    )
  }

  if (phase.tag === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'var(--sr-error-bg)', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--sr-error)', maxWidth: 480 }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} aria-hidden />
          {phase.message}
        </div>
        <button tabIndex={0} onClick={onGoToSettings} style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)', fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
          Go to Settings
        </button>
      </div>
    )
  }

  const { birds } = phase

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Tag size={15} strokeWidth={2.2} aria-hidden />
        </div>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 2px', color: 'var(--sr-text)' }}>Named Birds</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', margin: 0, lineHeight: 1.5, maxWidth: '68ch' }}>
            Individual birds you've named in your eBird species comments with a <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.78125rem', color: 'var(--sr-text)' }}>[name:…]</code> tag (for example <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.78125rem', color: 'var(--sr-text)' }}>[name:Winky]</code> or <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.78125rem', color: 'var(--sr-text)' }}>[name:one-leg-pete]</code>), tracked across every checklist.
          </p>
        </div>
      </div>

      {birds.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--sr-text-muted)', fontSize: '0.8125rem', lineHeight: 1.6, background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)', borderRadius: 10 }}>
          No individually-named birds found yet.<br />
          Add a tag like <code style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--sr-text)' }}>[name:Winky]</code> to a bird's species comment in eBird, re-upload your backup, and it will appear here.
        </div>
      ) : (
        <NamedBirdsTable
          birds={birds}
          showSpecies
          singleOpen
          orderFor={orderFor}
          mediaByBird={mediaByBird}
          hasML={hasML}
          renderSpecies={(commonName, scientificName) => (
            <BirdName commonName={commonName} scientificName={scientificName} taxonCode={codeFor(commonName)} hasEntry onOpenSpecies={onOpenSpecies} size="sm" />
          )}
        />
      )}
    </div>
  )
}
