import { useState, useCallback, useRef, useEffect } from 'react'
import { Bird, Search, Loader2, ClipboardCopy, Check, AlertCircle, ExternalLink, List, Dna, BookOpen, BarChart2 } from 'lucide-react'
import { transport, TransportError } from './lib/transport'
import { storage } from './lib/storage'
import { isTauri } from './lib/platform'
import { ListComparer } from './components/ListComparer'
import { LifeList } from './components/LifeList'
import { BreedingCodeList } from './components/BreedingCodeList'
import { MapExplorer } from './components/MapExplorer'
import { Settings } from './components/Settings'
import { SpeciesDetail } from './components/SpeciesDetail'
import { BirdingStats } from './components/BirdingStats'
import {
  type ConfigurableTab,
  type TabLayoutState,
  loadTabLayout,
  saveTabLayout,
  DEFAULT_TAB_ORDER,
  TAB_LABELS,
} from './lib/tabLayout'

type AppState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; formatted: string; checklistId: string; locName: string; obsDt: string }
  | { status: 'error'; message: string }

type Tab = ConfigurableTab | 'settings'

type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up-to-date'; current: string }
  | { kind: 'available'; latest: string }
  | { kind: 'downloading'; progress: number | null }
  | { kind: 'ready-to-restart' }
  | { kind: 'error' }

function extractChecklistId(raw: string): string {
  const s = raw.trim().replace(/\/+$/, '').split('?')[0]
  return s.includes('/') ? (s.split('/').pop() ?? s) : s
}

function isValidId(id: string): boolean {
  return /^S\d+$/.test(id)
}

type KeyStatus = { ebird: string | null; openweather: string | null }

// Tab icon lookup — kept outside the component so it's never recreated
const TAB_ICONS: Record<ConfigurableTab, React.ReactNode> = {
  'weather': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
    </svg>
  ),
  'species-detail': <BookOpen size={14} strokeWidth={2.5} aria-hidden="true" />,
  'birding-stats':  <BarChart2 size={14} strokeWidth={2.5} aria-hidden="true" />,
  'map-explorer': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
      <line x1="9" y1="3" x2="9" y2="18"/>
      <line x1="15" y1="6" x2="15" y2="21"/>
    </svg>
  ),
  'life-list':      <List size={14} strokeWidth={2.5} aria-hidden="true" />,
  'breeding-codes': <Dna size={14} strokeWidth={2.5} aria-hidden="true" />,
  'comparer': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 6H3"/><path d="M10 12H3"/><path d="M10 18H3"/><polyline points="15 12 18 15 21 12"/><path d="M18 6v9"/>
    </svg>
  ),
}

export default function App() {
  // loadTabLayout reads localStorage synchronously — initial state is correct before first paint (NFR-04)
  const [tabLayout, setTabLayout] = useState<TabLayoutState>(loadTabLayout)
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const layout = loadTabLayout()
    const first = layout.order.find(t => !layout.hidden.has(t))
    return first ?? 'settings'
  })
  const [input, setInput] = useState('')
  const [state, setState] = useState<AppState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: 'idle' })
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [filesVersion, setFilesVersion] = useState(0)
  const [keysVersion, setKeysVersion] = useState(0)
  const [mediaListFilter, setMediaListFilter] = useState<'is-target' | undefined>(undefined)

  const handleFilesSaved = useCallback(() => setFilesVersion(v => v + 1), [])

  const navigateToMediaList = useCallback(() => {
    setActiveTab('life-list')
    setMediaListFilter('is-target')
  }, [])

  const resetMediaListFilter = useCallback(() => setMediaListFilter(undefined), [])

  const handleReorder = useCallback((newOrder: ConfigurableTab[]) => {
    setTabLayout(prev => {
      const next = { ...prev, order: newOrder }
      saveTabLayout(next)
      return next
    })
  }, [])

  const handleToggleVisibility = useCallback((tab: ConfigurableTab) => {
    setTabLayout(prev => {
      const newHidden = new Set(prev.hidden)
      if (newHidden.has(tab)) {
        newHidden.delete(tab)
      } else {
        newHidden.add(tab)
        // FR-08: if hiding the active tab, switch to the next visible one
        setActiveTab(current => {
          if (current === tab) {
            return prev.order.find(t => !newHidden.has(t)) ?? 'settings'
          }
          return current
        })
      }
      const next = { ...prev, hidden: newHidden }
      saveTabLayout(next)
      return next
    })
  }, [])

  const handleRestoreDefaults = useCallback(() => {
    const next: TabLayoutState = { order: [...DEFAULT_TAB_ORDER], hidden: new Set() }
    setTabLayout(next)
    saveTabLayout(next)
  }, [])

  const fetchKeyStatus = useCallback(async () => {
    try {
      const [ebird, openweather] = await Promise.all([
        storage.getApiKey('ebird'),
        storage.getApiKey('openweather'),
      ])
      setKeyStatus({ ebird, openweather })
      setKeysVersion(v => v + 1)
    } catch {
      // silently fail — notices just won't appear
    }
  }, [])

  useEffect(() => { const run = async () => { await fetchKeyStatus() }; run() }, [fetchKeyStatus])

  const handleLookup = useCallback(async () => {
    const id = extractChecklistId(input)
    if (!isValidId(id)) {
      setState({ status: 'error', message: "That doesn't look like a valid eBird checklist ID." })
      return
    }
    setState({ status: 'loading' })
    try {
      const data = await transport.get<{ formatted: string; checklist_id: string; loc_name: string; obs_dt: string }>(
        `/weather/${encodeURIComponent(id)}`
      )
      setState({ status: 'success', formatted: data.formatted, checklistId: data.checklist_id, locName: data.loc_name, obsDt: data.obs_dt })
      try {
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(data.formatted)
        } else {
          const el = document.createElement('textarea')
          el.value = data.formatted
          el.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
          document.body.appendChild(el)
          el.select()
          document.execCommand('copy')
          document.body.removeChild(el)
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch {
        // clipboard unavailable — user can still click Copy
      }
    } catch (err) {
      const detail = err instanceof TransportError ? (err.detail ?? err.message) : undefined
      setState({ status: 'error', message: detail ?? 'Something went wrong. Please try again.' })
    }
  }, [input])

  const handleCopy = async () => {
    if (state.status !== 'success') return

    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(state.formatted)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      } catch {
        // fall through to legacy method
      }
    }

    // Legacy fallback — works over plain HTTP on local network
    const el = document.getElementById('output-pre')
    if (el) {
      const range = document.createRange()
      range.selectNode(el)
      window.getSelection()?.removeAllRanges()
      window.getSelection()?.addRange(range)
      document.execCommand('copy')
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleUpdateCheck = useCallback(async () => {
    if (updateStatus.kind === 'checking' || updateStatus.kind === 'downloading') return
    if (updateTimerRef.current) clearTimeout(updateTimerRef.current)
    setUpdateStatus({ kind: 'checking' })
    try {
      if (isTauri()) {
        const { checkForUpdate } = await import('./lib/tauri/updateManager')
        const result = await checkForUpdate()
        if (result.status === 'up-to-date') {
          setUpdateStatus({ kind: 'up-to-date', current: result.current })
          updateTimerRef.current = setTimeout(() => setUpdateStatus({ kind: 'idle' }), 4000)
        } else if (result.status === 'available') {
          setUpdateStatus({ kind: 'available', latest: result.latest })
        } else {
          setUpdateStatus({ kind: 'error' })
          updateTimerRef.current = setTimeout(() => setUpdateStatus({ kind: 'idle' }), 4000)
        }
      } else {
        const data = await transport.get<{ current: string; latest: string; up_to_date: boolean }>('/version/check')
        if (data.up_to_date) {
          setUpdateStatus({ kind: 'up-to-date', current: data.current })
          updateTimerRef.current = setTimeout(() => setUpdateStatus({ kind: 'idle' }), 4000)
        } else {
          setUpdateStatus({ kind: 'available', latest: data.latest })
          updateTimerRef.current = setTimeout(() => setUpdateStatus({ kind: 'idle' }), 8000)
        }
      }
    } catch {
      setUpdateStatus({ kind: 'error' })
      updateTimerRef.current = setTimeout(() => setUpdateStatus({ kind: 'idle' }), 4000)
    }
  }, [updateStatus.kind])

  const handleInstallUpdate = useCallback(async () => {
    setUpdateStatus({ kind: 'downloading', progress: null })
    try {
      const { downloadAndInstall } = await import('./lib/tauri/updateManager')
      await downloadAndInstall(({ downloaded, total }) => {
        setUpdateStatus({ kind: 'downloading', progress: total ? downloaded / total : null })
      })
      setUpdateStatus({ kind: 'ready-to-restart' })
    } catch {
      setUpdateStatus({ kind: 'error' })
      updateTimerRef.current = setTimeout(() => setUpdateStatus({ kind: 'idle' }), 4000)
    }
  }, [])

  const isLoading = state.status === 'loading'
  const hasError = state.status === 'error'
  const hasResult = state.status === 'success'

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 16px',
    border: 'none',
    borderBottom: `2px solid ${activeTab === tab ? 'var(--sr-accent)' : 'transparent'}`,
    background: 'none',
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    fontWeight: 500,
    color: activeTab === tab ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
    cursor: 'pointer',
    marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--sr-bg)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      color: 'var(--sr-text)',
    }}>

      {/* Header */}
      <div className="sr-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Bird size={30} strokeWidth={1.75} style={{ color: 'var(--sr-accent)' }} />
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.6px' }}>
            Snow<span style={{ color: 'var(--sr-accent)' }}>Raven</span>
          </span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--sr-text-muted)', marginBottom: 28 }}>
          Birding tools for your eBird workflow
        </p>
      </div>

      {/* Tab bar — order and visibility controlled by tabLayout state */}
      <div style={{ borderBottom: '1px solid var(--sr-border)', display: 'flex', justifyContent: 'center', padding: '0 24px', flexShrink: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <nav style={{ display: 'flex', maxWidth: 880, width: '100%' }} role="tablist">
          {tabLayout.order
            .filter(tab => !tabLayout.hidden.has(tab))
            .map(tab => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                style={tabStyle(tab)}
                onClick={() => setActiveTab(tab)}
              >
                {TAB_ICONS[tab]}
                {TAB_LABELS[tab]}
              </button>
            ))
          }
          <button
            role="tab"
            aria-selected={activeTab === 'settings'}
            style={tabStyle('settings')}
            onClick={() => setActiveTab('settings')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Settings
          </button>
        </nav>
      </div>

      {/* Weather tab content */}
      <div
        role="tabpanel"
        className="sr-panel"
        style={{
          display: activeTab === 'weather' ? 'flex' : 'none',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '40px 24px 24px',
        }}
      >
        {keyStatus && (keyStatus.ebird === null || keyStatus.openweather === null) && (
          <div style={{ width: '100%', maxWidth: 540, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {keyStatus.ebird === null && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '10px 14px', background: 'var(--sr-warning-bg)',
                border: '1px solid var(--sr-warning-subtle)', borderRadius: 8,
                fontSize: 13, color: 'var(--sr-warning)',
              }}>
                <span>eBird API key not configured — weather lookups require an eBird API key.</span>
                <button
                  onClick={() => setActiveTab('settings')}
                  style={{
                    background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600,
                    color: 'var(--sr-warning)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  Go to Settings →
                </button>
              </div>
            )}
            {keyStatus.openweather === null && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '10px 14px', background: 'var(--sr-warning-bg)',
                border: '1px solid var(--sr-warning-subtle)', borderRadius: 8,
                fontSize: 13, color: 'var(--sr-warning)',
              }}>
                <span>OpenWeather API key not configured — weather lookups won't return conditions.</span>
                <button
                  onClick={() => setActiveTab('settings')}
                  style={{
                    background: 'none', border: 'none', padding: 0, fontSize: 12, fontWeight: 600,
                    color: 'var(--sr-warning)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  Go to Settings →
                </button>
              </div>
            )}
          </div>
        )}
        <div className="sr-card" style={{
          width: '100%',
          maxWidth: 540,
          background: 'var(--sr-surface)',
          border: '1px solid var(--sr-border)',
          borderRadius: 12,
          padding: 32,
          boxSizing: 'border-box' as const,
          boxShadow: 'var(--sr-card-shadow)',
        }}>
          <label
            htmlFor="checklist-input"
            style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8 }}
          >
            eBird checklist ID or URL
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="checklist-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder="S12345678 or https://ebird.org/checklist/S12345678"
              aria-describedby={hasError ? 'checklist-error' : undefined}
              autoComplete="off"
              spellCheck={false}
              style={{
                flex: 1,
                height: 44,
                padding: '0 14px',
                border: `1.5px solid ${hasError ? 'var(--sr-error)' : 'var(--sr-border)'}`,
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'inherit',
                color: 'inherit',
                background: 'var(--sr-surface)',
                outline: 'none',
                minWidth: 0,
              }}
            />
            <button
              onClick={handleLookup}
              disabled={isLoading}
              style={{
                height: 44,
                padding: '0 18px',
                background: 'var(--sr-accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                opacity: isLoading ? 0.65 : 1,
              }}
            >
              {isLoading
                ? <Loader2 size={15} className="spin" />
                : <Search size={15} strokeWidth={2.5} />}
              {isLoading ? 'Looking up…' : 'Get weather'}
            </button>
          </div>

          {hasError && (
            <div
              id="checklist-error"
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 10,
                padding: '9px 13px',
                background: 'var(--sr-error-bg)',
                borderRadius: 6,
                fontSize: 13,
                color: 'var(--sr-error)',
              }}
            >
              <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
              {state.message}
            </div>
          )}

          {hasResult && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--sr-border)', margin: '24px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <span style={{
                  fontSize: 12,
                  color: 'var(--sr-text-muted)',
                  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace',
                  letterSpacing: '0.01em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}>
                  {state.status === 'success' && `${state.checklistId} / ${state.locName} / ${state.obsDt}`}
                </span>
                {state.status === 'success' && (
                  <a
                    href={`https://ebird.org/edit/effort?subID=${state.checklistId}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Edit this checklist on eBird (opens in new tab)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--sr-accent)',
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    Edit on eBird
                    <ExternalLink size={11} strokeWidth={2.5} />
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  color: 'var(--sr-text-muted)',
                }}>
                  Weather output
                </span>
                <button
                  onClick={handleCopy}
                  aria-label="Copy weather output to clipboard"
                  style={{
                    height: 30,
                    padding: '0 12px',
                    background: copied ? 'var(--sr-accent)' : 'var(--sr-accent-bg)',
                    color: copied ? '#fff' : 'var(--sr-accent)',
                    border: `1.5px solid ${copied ? 'var(--sr-accent)' : 'var(--sr-accent-border)'}`,
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  {copied
                    ? <Check size={12} strokeWidth={2.5} />
                    : <ClipboardCopy size={12} strokeWidth={2.5} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre
                id="output-pre"
                style={{
                  background: 'var(--sr-surface-subtle)',
                  border: '1px solid var(--sr-border)',
                  borderRadius: 8,
                  padding: '18px 20px',
                  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace',
                  fontSize: 13.5,
                  lineHeight: 1.75,
                  color: 'inherit',
                  whiteSpace: 'pre',
                  overflowX: 'auto',
                  margin: 0,
                }}
              >
                {state.formatted}
              </pre>
            </>
          )}
        </div>
      </div>

      {/* List Comparer tab content */}
      <div
        role="tabpanel"
        className="sr-panel"
        style={{
          display: activeTab === 'comparer' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        <ListComparer />
      </div>

      {/* Life List tab content */}
      <div
        role="tabpanel"
        className="sr-panel"
        style={{
          display: activeTab === 'life-list' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        <LifeList
          onGoToSettings={() => setActiveTab('settings')}
          requestedFilter={mediaListFilter}
          onRequestedFilterConsumed={resetMediaListFilter}
          filesVersion={filesVersion}
        />
      </div>

      {/* Breeding Codes tab content */}
      <div
        role="tabpanel"
        className="sr-panel"
        style={{
          display: activeTab === 'breeding-codes' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        <BreedingCodeList onGoToSettings={() => setActiveTab('settings')} filesVersion={filesVersion} />
      </div>

      {/* Species Detail tab content */}
      <div
        role="tabpanel"
        className="sr-panel"
        style={{
          display: activeTab === 'species-detail' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        <SpeciesDetail onGoToSettings={() => setActiveTab('settings')} filesVersion={filesVersion} />
      </div>

      {/* Map Explorer tab content */}
      <div
        role="tabpanel"
        style={{
          display: activeTab === 'map-explorer' ? 'flex' : 'none',
          flexDirection: 'column',
          height: 'calc(100vh - 178px)',
          overflow: 'hidden',
        }}
      >
        <MapExplorer onGoToSettings={() => setActiveTab('settings')} onNavigateToMediaList={navigateToMediaList} keysVersion={keysVersion} />
      </div>

      {/* Statistics tab content */}
      <div
        role="tabpanel"
        className="sr-panel"
        style={{
          display: activeTab === 'birding-stats' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        <BirdingStats onGoToSettings={() => setActiveTab('settings')} />
      </div>

      {/* Settings tab content */}
      <div
        role="tabpanel"
        className="sr-panel"
        style={{
          display: activeTab === 'settings' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        <Settings
          onKeysSaved={fetchKeyStatus}
          onFilesSaved={handleFilesSaved}
          tabOrder={tabLayout.order}
          tabHidden={tabLayout.hidden}
          onReorder={handleReorder}
          onToggleVisibility={handleToggleVisibility}
          onRestoreDefaults={handleRestoreDefaults}
        />
      </div>

      {/* Footer */}
      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--sr-text-footer)', padding: '0 24px 20px', flexShrink: 0 }}>
        <a
          href="https://github.com/dtgibson/snowraven"
          target="_blank"
          rel="noreferrer"
          style={{ color: 'inherit', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
        >
          SnowRaven
        </a>
        {' · Self-hosted Birding Tools · '}
        {updateStatus.kind === 'idle' && (
          <button
            onClick={handleUpdateCheck}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: 'var(--sr-text-footer)',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            Check For Updates
          </button>
        )}
        {updateStatus.kind === 'checking' && (
          <span style={{ color: 'var(--sr-text-muted)' }}>Checking…</span>
        )}
        {updateStatus.kind === 'up-to-date' && (
          <span style={{ color: 'var(--sr-accent)' }}>Up to date (v{updateStatus.current})</span>
        )}
        {updateStatus.kind === 'available' && (
          isTauri() ? (
            <span style={{ color: 'var(--sr-warning)' }}>
              v{updateStatus.latest} available —{' '}
              <button
                onClick={handleInstallUpdate}
                style={{
                  background: 'none', border: 'none', padding: 0, font: 'inherit',
                  color: 'var(--sr-warning)', cursor: 'pointer', fontWeight: 600,
                }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                Install update
              </button>
            </span>
          ) : (
            <span style={{ color: 'var(--sr-warning)' }}>
              v{updateStatus.latest} available — run{' '}
              <code style={{ fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace' }}>./update.sh</code>
            </span>
          )
        )}
        {updateStatus.kind === 'downloading' && (
          <span style={{ color: 'var(--sr-text-muted)' }}>
            {updateStatus.progress !== null
              ? `Downloading… ${Math.round(updateStatus.progress * 100)}%`
              : 'Downloading update…'}
          </span>
        )}
        {updateStatus.kind === 'ready-to-restart' && (
          <span style={{ color: 'var(--sr-accent)' }}>Update installed — restarting…</span>
        )}
        {updateStatus.kind === 'error' && (
          <span style={{ color: 'var(--sr-error)' }}>Could not check for updates</span>
        )}
      </p>
    </div>
  )
}
