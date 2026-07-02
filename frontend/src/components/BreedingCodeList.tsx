import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, MapPin, Calendar } from 'lucide-react'
import { SetupRequired } from './SetupRequired'
import { EBIRD_BACKUP_STEPS } from './setupCopy'
import { formatDate as formatDateLabel } from '../lib/formatDate'
import { deriveBreedingData, aggregateBreedingRows } from '../lib/parseBreedingCodes'
import type { BreedingData, BreedingEntry, BreedingCodeRow } from '../lib/parseBreedingCodes'
import { loadEbirdObservations } from '../lib/observationsCache'
import { BREEDING_CODE_MAP, TIER_COLORS, CATEGORY_CODES } from '../lib/breedingCodes'
import type { BreedingCategory } from '../lib/breedingCodes'
import { BreedingCodeTable } from './BreedingCodeTable'
import type { BreedingSortState, DateRangeState } from '../types'
import { DATE_RANGE_CLEAR } from '../types'
import { transport } from '../lib/transport'
import { storage } from '../lib/storage'

type Phase =
  | { tag: 'loading-saved' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; data: BreedingData }

function codePillStyle(tier: 1 | 2 | 3 | 4, active: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 30,
    padding: '0 12px',
    borderRadius: 6,
    fontSize: '0.75rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: '1.5px solid transparent',
    background: 'none',
  }
  if (!active) return { ...base, borderColor: 'var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)' }
  const bgAlpha = tier === 1 ? 0.15 : 0.08
  const borderAlpha = tier === 1 ? 0.5 : 0.3
  return {
    ...base,
    background: `rgba(var(--sr-tier-${tier}-rgb),${bgAlpha})`,
    borderColor: `rgba(var(--sr-tier-${tier}-rgb),${borderAlpha})`,
    // -fg (not the raw -N fill) so the label text meets AA on the tint in both themes.
    color: `var(--sr-tier-${tier}-fg)`,
  }
}

function categoryPillStyle(cat: BreedingCategory, active: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    height: 30, padding: '0 12px', borderRadius: 6,
    fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit',
    cursor: 'pointer', border: '1.5px solid transparent', background: 'none',
  }
  if (!active) return { ...base, borderColor: 'var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)' }
  // Text uses the -fg tokens (not the raw -N fills) so each label meets AA on
  // its tint in both themes; tier-2-fg is verified on the tier-1 tint too (the
  // 'possible' pill's cross-case).
  const styles: Record<BreedingCategory, React.CSSProperties> = {
    confirmed: { background: 'rgba(var(--sr-tier-4-rgb),0.08)', borderColor: 'rgba(var(--sr-tier-4-rgb),0.3)', color: 'var(--sr-tier-4-fg)' },
    probable:  { background: 'rgba(var(--sr-tier-2-rgb),0.08)', borderColor: 'rgba(var(--sr-tier-2-rgb),0.3)', color: 'var(--sr-tier-2-fg)' },
    possible:  { background: 'rgba(var(--sr-tier-1-rgb),0.15)', borderColor: 'rgba(var(--sr-tier-1-rgb),0.5)', color: 'var(--sr-tier-2-fg)' },
  }
  return { ...base, ...styles[cat] }
}

const CATEGORY_META: { key: BreedingCategory; label: string }[] = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'probable',  label: 'Probable' },
  { key: 'possible',  label: 'Possible' },
]

function ghostBtn(active = false): React.CSSProperties {
  return {
    height: 28,
    padding: '0 10px',
    borderRadius: 6,
    fontSize: '0.6875rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: active ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
    background: active ? 'var(--sr-accent-bg)' : 'none',
    color: active ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
    whiteSpace: 'nowrap' as const,
  }
}

export function BreedingCodeList({ onGoToSettings, filesVersion, onOpenSpecies }: { onGoToSettings: () => void; filesVersion?: number; onOpenSpecies?: (commonName: string) => void }) {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading-saved' })
  const [filter, setFilter] = useState<Set<string>>(new Set())
  const [categoryFilter, setCategoryFilter] = useState<Set<BreedingCategory>>(new Set())
  const [sort, setSort] = useState<BreedingSortState>({ column: 'name', dir: 'asc', nameSortMode: 'az' })
  const [wideMode, setWideMode] = useState(false)
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  const [taxonOrders, setTaxonOrders] = useState<Record<string, number>>({})
  const [countyFilter, setCountyFilter] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeState>(DATE_RANGE_CLEAR)

  const fetchTaxonCodes = async (entries: BreedingEntry[]) => {
    try {
      const data = await transport.post<{ codes: Record<string, string>; orders: Record<string, number> }>(
        '/taxonomy/codes',
        { species: entries.map(e => ({ commonName: e.commonName, scientificName: e.scientificName })) }
      )
      setTaxonMap(data.codes ?? {})
      setTaxonOrders(data.orders ?? {})
    } catch {
      // silently fail — links absent, sort falls back to A–Z
    }
  }

  useEffect(() => {
    let cancelled = false
    async function autoLoad() {
      setPhase({ tag: 'loading-saved' })
      try {
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }
        const ebird = await loadEbirdObservations()   // shared parse — no second CSV walk
        if (!ebird || cancelled) {
          setPhase({ tag: 'error', message: "Couldn't load your eBird backup from Settings. Try re-uploading it." })
          return
        }
        const data = deriveBreedingData(ebird.observations, ebird.text)
        if (!data.hasBreedingCodeColumn) {
          setPhase({ tag: 'error', message: "The stored file doesn't look like an eBird backup. Re-upload MyEBirdData.csv in Settings → Default Files → eBird Backup." })
          return
        }
        setPhase({ tag: 'ready', data })
        if (data.entries.length > 0) fetchTaxonCodes(data.entries)
      } catch {
        if (!cancelled) setPhase({ tag: 'setup-required' })
      }
    }
    autoLoad()
    return () => { cancelled = true }
  }, [filesVersion])

  // These useMemos must be declared before any early return so that the
  // hook call order stays the same on every render regardless of phase.
  const phaseData = phase.tag === 'ready' ? phase.data : null

  const counties = useMemo(() => {
    if (!phaseData) return [] as string[]
    const set = new Set<string>()
    for (const row of phaseData.rows) {
      if (row.county) set.add(row.county)
    }
    return [...set].sort()
  }, [phaseData])

  const filteredRows = useMemo((): BreedingCodeRow[] => {
    if (!phaseData) return []
    if (countyFilter === null && !dateRange.from && !dateRange.to) return phaseData.rows
    return phaseData.rows.filter(row => {
      if (countyFilter !== null && row.county !== countyFilter) return false
      if (dateRange.from && row.date < dateRange.from) return false
      if (dateRange.to && row.date > dateRange.to) return false
      return true
    })
  }, [phaseData, countyFilter, dateRange])

  const hasLocationFilter = countyFilter !== null || !!dateRange.from || !!dateRange.to

  const displayData = useMemo(() => {
    if (!phaseData) return null
    if (!hasLocationFilter) return phaseData
    const { entries: filteredEntries, codesPresent: filteredCodes } = aggregateBreedingRows(filteredRows)
    return { ...phaseData, entries: filteredEntries, codesPresent: filteredCodes }
  }, [phaseData, hasLocationFilter, filteredRows])

  if (phase.tag === 'loading-saved') {
    return (
      <div role="status" aria-label="Loading saved eBird data" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)' }} aria-hidden />
      </div>
    )
  }

  if (phase.tag === 'setup-required') {
    return (
      <SetupRequired
        title="eBird Backup Required"
        body="The Breeding Codes tab loads automatically from your stored eBird backup. You haven't saved one yet."
        steps={EBIRD_BACKUP_STEPS}
        onGoToSettings={onGoToSettings}
      />
    )
  }

  if (phase.tag === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 13px', background: 'var(--sr-error-bg)', borderRadius: 8,
          fontSize: '0.8125rem', color: 'var(--sr-error)', maxWidth: 480,
        }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          {phase.message}
        </div>
        <button tabIndex={0}
          onClick={onGoToSettings}
          style={{
            height: 32, padding: '0 14px', borderRadius: 6,
            border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)',
            color: 'var(--sr-text-muted)', fontSize: '0.75rem', fontWeight: 500,
            fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          Go to Settings
        </button>
      </div>
    )
  }

  // phaseData and displayData are non-null — phase is 'ready' at this point
  const { entries, codesPresent } = displayData!

  if (entries.length === 0 && !hasLocationFilter) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--sr-text-muted)' }}>No species with breeding codes found in the stored file.</span>
      </div>
    )
  }

  const categoryFilteredEntries = categoryFilter.size === 0
    ? entries
    : entries.filter(e => {
        for (const cat of categoryFilter) {
          if (![...CATEGORY_CODES[cat]].some(code => (e.codes[code] ?? 0) > 0)) return false
        }
        return true
      })

  const filteredCount = (categoryFilter.size === 0 && filter.size === 0)
    ? entries.length
    : categoryFilteredEntries.filter(e =>
        filter.size === 0 || [...filter].every(code => (e.codes[code] ?? 0) > 0)
      ).length

  const totalSpecies = phaseData!.entries.length
  const countLabel = (categoryFilter.size === 0 && filter.size === 0 && !hasLocationFilter)
    ? `${entries.length} species`
    : `${filteredCount} of ${totalSpecies} species`

  // Format a YYYY-MM-DD date as human-readable "May 1, 2022"
  const filterStripText = (() => {
    const parts: string[] = []
    if (countyFilter) parts.push(countyFilter)
    if (dateRange.from && dateRange.to) parts.push(`${formatDateLabel(dateRange.from)} – ${formatDateLabel(dateRange.to)}`)
    else if (dateRange.from) parts.push(`From ${formatDateLabel(dateRange.from)}`)
    else if (dateRange.to) parts.push(`Through ${formatDateLabel(dateRange.to)}`)
    parts.push(`${filteredCount} of ${totalSpecies} species`)
    return parts.join(' · ')
  })()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button tabIndex={0}
            aria-pressed={filter.size === 0 && categoryFilter.size === 0}
            style={{
              display: 'inline-flex', alignItems: 'center',
              height: 30, padding: '0 12px', borderRadius: 6,
              fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit',
              cursor: 'pointer',
              border: filter.size === 0 && categoryFilter.size === 0 ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
              background: filter.size === 0 && categoryFilter.size === 0 ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
              color: filter.size === 0 && categoryFilter.size === 0 ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
            }}
            onClick={() => { setFilter(new Set()); setCategoryFilter(new Set()) }}
          >
            All
          </button>
          {CATEGORY_META
            .filter(({ key }) => [...CATEGORY_CODES[key]].some(code => codesPresent.includes(code)))
            .map(({ key, label }) => {
              const active = categoryFilter.has(key)
              return (
                <button tabIndex={0}
                  key={key}
                  aria-pressed={active}
                  style={categoryPillStyle(key, active)}
                  onClick={() => {
                    setCategoryFilter(prev => {
                      const next = new Set(prev)
                      if (next.has(key)) next.delete(key)
                      else next.add(key)
                      return next
                    })
                  }}
                >
                  {label}
                </button>
              )
            })
          }
          {codesPresent.map(code => {
            const def = BREEDING_CODE_MAP.get(code)!
            const active = filter.has(code)
            return (
              <button tabIndex={0}
                key={code}
                aria-pressed={active}
                style={codePillStyle(def.tier, active)}
                onClick={() => {
                  setFilter(prev => {
                    const next = new Set(prev)
                    if (next.has(code)) next.delete(code)
                    else next.add(code)
                    return next
                  })
                }}
                title={def.label}
                // The visible label is the terse code; the title only shows on mouse
                // hover, so the aria-label carries the full meaning for SR/touch users.
                aria-label={`${def.label} (${code})`}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%',
                  background: TIER_COLORS[def.tier], flexShrink: 0,
                }} />
                {code}
              </button>
            )
          })}

          <div style={{ width: 1, height: 20, background: 'var(--sr-border)', flexShrink: 0, alignSelf: 'center' }} />

          {/* A–Z / Taxonomic sort toggle */}
          <div role="group" aria-label="Sort order" style={{ display: 'inline-flex', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
            <button tabIndex={0}
              aria-pressed={sort.nameSortMode === 'az'}
              style={{
                height: 30, padding: '0 13px', border: 'none',
                borderRight: '1.5px solid var(--sr-accent-border)',
                background: sort.nameSortMode === 'az' ? 'var(--sr-accent-bg)' : 'transparent',
                color: sort.nameSortMode === 'az' ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' as const,
              }}
              onClick={() => setSort({ column: 'name', dir: 'asc', nameSortMode: 'az' })}
            >
              A–Z
            </button>
            <button tabIndex={0}
              aria-pressed={sort.nameSortMode === 'taxonomic'}
              style={{
                height: 30, padding: '0 13px', border: 'none',
                background: sort.nameSortMode === 'taxonomic' ? 'var(--sr-accent-bg)' : 'transparent',
                color: sort.nameSortMode === 'taxonomic' ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' as const,
              }}
              onClick={() => setSort({ column: 'name', dir: 'asc', nameSortMode: 'taxonomic' })}
            >
              Taxonomic
            </button>
          </div>

          {counties.length > 0 && (
            <>
              <div style={{ width: 1, height: 20, background: 'var(--sr-border)', flexShrink: 0, alignSelf: 'center' }} />

              {/* County dropdown */}
              <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                <MapPin size={12} strokeWidth={2} style={{
                  position: 'absolute', left: 7, color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                  pointerEvents: 'none', flexShrink: 0,
                }} />
                <select
                  aria-label="County"
                  value={countyFilter ?? ''}
                  onChange={e => setCountyFilter(e.target.value || null)}
                  className="sr-input-16"
                  style={{
                    height: 26, paddingLeft: 24, paddingRight: 22, borderRadius: 5,
                    border: countyFilter
                      ? '1.5px solid var(--sr-accent-border-strong)'
                      : '1.5px solid var(--sr-border)',
                    background: countyFilter ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                    color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                    fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit',
                    cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                    // Cap so a long county name (user data) at large text scale can't
                    // push the select past the viewport and leak page horizontal scroll
                    // — the selected option ellipsizes instead (min-width:0 lets the
                    // flex item shrink below its longest-option min-content width).
                    maxWidth: '100%', minWidth: 0, textOverflow: 'ellipsis',
                  }}
                >
                  <option value="">All Counties</option>
                  {counties.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span style={{
                  position: 'absolute', right: 6, pointerEvents: 'none',
                  color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                  fontSize: '0.5625rem',
                }}>▾</span>
              </div>

              {/* Date range — .sr-field-row stacks From/To full-width ≤480 where
                  native date inputs can't shrink below their intrinsic min-width. */}
              <div className="sr-field-row" style={{ gap: 4 }}>
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
                  <Calendar size={11} strokeWidth={2} style={{
                    position: 'absolute', left: 7, color: dateRange.from ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                    pointerEvents: 'none',
                  }} />
                  <input
                    type="date"
                    aria-label="From date"
                    value={dateRange.from}
                    onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                    className="sr-input-16"
                    style={{
                      height: 26, paddingLeft: 24, paddingRight: 6, borderRadius: 5,
                      border: dateRange.from
                        ? '1.5px solid var(--sr-accent-border-strong)'
                        : '1.5px solid var(--sr-border)',
                      background: dateRange.from ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                      color: dateRange.from ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                      fontSize: '0.75rem', fontFamily: 'inherit',
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>→</span>
                <input
                  type="date"
                  aria-label="To date"
                  value={dateRange.to}
                  onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                  className="sr-input-16"
                  style={{
                    height: 26, paddingLeft: 8, paddingRight: 6, borderRadius: 5,
                    border: dateRange.to
                      ? '1.5px solid var(--sr-accent-border-strong)'
                      : '1.5px solid var(--sr-border)',
                    background: dateRange.to ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                    color: dateRange.to ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                    fontSize: '0.75rem', fontFamily: 'inherit',
                  }}
                />
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span aria-live="polite" style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>{countLabel}</span>
          <button tabIndex={0}
            style={ghostBtn(wideMode)}
            onClick={() => setWideMode(w => !w)}
            title={wideMode ? 'Collapse table into scroll box' : 'Expand table — scroll the whole page on mobile'}
          >
            {wideMode ? '↔ Normal' : '↔ Unbounded'}
          </button>
        </div>
      </div>

      {hasLocationFilter && (
        <div className="sr-action-row sr-action-row-stack" style={{
          padding: '7px 12px', marginBottom: 8,
          background: 'var(--sr-accent-bg)', borderRadius: 6,
          fontSize: '0.75rem', color: 'var(--sr-accent)', flexShrink: 0,
        }}>
          <span className="sr-min0" style={{ fontWeight: 500 }}>{filterStripText}</span>
          <button tabIndex={0}
            onClick={() => { setCountyFilter(null); setDateRange(DATE_RANGE_CLEAR) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              fontSize: '0.75rem', color: 'var(--sr-accent)', fontFamily: 'inherit',
              // ≥24px hit area (WCAG 2.2 target size) without shifting the row layout.
              minHeight: 24, padding: '0 6px', margin: '0 -6px', textDecoration: 'underline',
            }}
          >
            Clear filter
          </button>
        </div>
      )}

      <BreedingCodeTable
        entries={categoryFilteredEntries}
        codesPresent={codesPresent}
        sort={sort}
        onSortChange={setSort}
        filter={filter}
        taxonMap={taxonMap}
        taxonOrders={taxonOrders}
        wideMode={wideMode}
        onOpenSpecies={onOpenSpecies}
      />
    </div>
  )
}
