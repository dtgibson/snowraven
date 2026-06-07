import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense } from 'react'
import { Bird, Search, Loader2, ClipboardCopy, Check, AlertCircle, ExternalLink, List, Dna, BookOpen, BarChart2 } from 'lucide-react'
import { transport, TransportError } from './lib/transport'
import { storage } from './lib/storage'
import { isTauri } from './lib/platform'
import { copyText } from './lib/clipboard'
import { extractChecklistId, isValidChecklistId } from './lib/checklistId'
import { readStoredScale, persistTextScale, applyScaleToDom, hydrateStoredScale } from './lib/textScale'
import type { TextScale } from './lib/textScale'
import { applyTheme, hydrateStoredTheme } from './lib/theme'
import { ListComparer } from './components/ListComparer'
import { LifeList } from './components/LifeList'
import { BreedingCodeList } from './components/BreedingCodeList'
import { Settings } from './components/Settings'
import { WelcomeScreen } from './components/WelcomeScreen'
import { TabNav, type NavItem } from './components/TabNav'

// Lazy chunks. The map (maplibre-gl ~270 KB gz), stats (recharts ~112 KB gz), Species
// Detail, and Help are kept out of the entry bundle so first paint is light. Named
// import thunks so the same loaders can be idle-prefetched (see the effect below) —
// returning users get instant tab opens without paying the weight on first paint.
const importMapExplorer = () => import('./components/MapExplorer')
const importSpeciesDetail = () => import('./components/SpeciesDetail')
const importBirdingStats = () => import('./components/BirdingStats')
const importHelpDocs = () => import('./components/HelpDocs')
const MapExplorer = lazy(() => importMapExplorer().then(m => ({ default: m.MapExplorer })))
const SpeciesDetail = lazy(() => importSpeciesDetail().then(m => ({ default: m.SpeciesDetail })))
const BirdingStats = lazy(() => importBirdingStats().then(m => ({ default: m.BirdingStats })))
const HelpDocs = lazy(() => importHelpDocs().then(m => ({ default: m.HelpDocs })))
import {
  type ConfigurableTab,
  type Tab,
  type TabLayoutState,
  type SerializedLayout,
  loadTabLayout,
  saveTabLayout,
  parseLayout,
  serializeLayout,
  visibleTabs,
  DEFAULT_TAB_ORDER,
  TAB_LABELS,
} from './lib/tabLayout'

// Settings-seam key for the tab layout (desktop persistence — localStorage is
// ephemeral in Tauri's WKWebView, so the layout must go through the storage seam).
const TAB_LAYOUT_SETTING = 'tabLayout'

type AppState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; formatted: string; checklistId: string; locName: string; obsDt: string }
  | { status: 'error'; message: string }

type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up-to-date'; current: string }
  | { kind: 'available'; latest: string }
  | { kind: 'downloading'; progress: number | null }
  | { kind: 'ready-to-restart' }
  | { kind: 'error' }


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

// Tabs that mount on first open and then stay mounted, so their state + parsed data
// survive tab switches without re-loading. Everything EXCEPT the always-present
// Weather tab defers its mount — and therefore its startup data work (CSV parses, the
// synchronous breeding-code parse, /taxonomy/codes POSTs, files-status reads) — until
// the tab is first opened, instead of running it all on first paint.
const DEFERRED_TABS: Tab[] = [
  'map-explorer', 'species-detail', 'birding-stats',
  'comparer', 'life-list', 'breeding-codes', 'settings',
]

// Fallback shown while a lazy tab's chunk is being fetched.
function TabLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', padding: 48, minHeight: 200 }}>
      <Loader2 size={22} className="spin" style={{ color: 'var(--sr-text-muted)' }} aria-hidden="true" />
      <span style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }} role="status">{label}</span>
    </div>
  )
}

export default function App() {
  // Web/Pi: loadTabLayout reads localStorage synchronously, so the saved layout
  // is correct on first paint (no flash). Desktop: localStorage is wiped on every
  // WKWebView relaunch, so this starts at the default and the saved layout is
  // hydrated from the storage seam in the effect below.
  const [tabLayout, setTabLayout] = useState<TabLayoutState>(loadTabLayout)
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const layout = loadTabLayout()
    const first = layout.order.find(t => !layout.hidden.has(t))
    return first ?? 'settings'
  })
  const [input, setInput] = useState('')
  const [state, setState] = useState<AppState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)
  // Mobile-only: Map Explorer occupies the full viewport when true.
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: 'idle' })
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [filesVersion, setFilesVersion] = useState(0)
  const [keysVersion, setKeysVersion] = useState(0)
  const [mediaListFilter, setMediaListFilter] = useState<'is-target' | undefined>(undefined)
  // Click any bird name → open + select it on the Species Detail tab (single-use).
  const [requestedSpecies, setRequestedSpecies] = useState<string | undefined>(undefined)
  // Documentation overlay — lifted to App so a Help affordance is reachable from
  // every tab (the footer), not only the button inside Settings.
  const [helpOpen, setHelpOpen] = useState(false)
  // Heavy tabs mount on first open and then stay mounted (preserving their state).
  // Seeded with the initial active tab so a heavy default tab mounts immediately.
  const [mountedTabs, setMountedTabs] = useState<Set<Tab>>(() =>
    DEFERRED_TABS.includes(activeTab) ? new Set([activeTab]) : new Set()
  )
  // First-run welcome: null = undetermined, true = cold start (no keys, no files,
  // not previously dismissed). welcomeDismissed hides it for the rest of the session.
  const [coldStart, setColdStart] = useState<boolean | null>(null)
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  // In-app Text Size (rem multiplier on the root). Initial value is read sync from
  // localStorage (web flash-free); desktop hydrates the durable value after mount.
  const [textScale, setTextScaleState] = useState<TextScale>(readStoredScale)

  const handleFilesSaved = useCallback(() => setFilesVersion(v => v + 1), [])

  const navigateToMediaList = useCallback(() => {
    setActiveTab('life-list')
    setMediaListFilter('is-target')
  }, [])

  const resetMediaListFilter = useCallback(() => setMediaListFilter(undefined), [])

  const navigateToSpeciesDetail = useCallback((commonName: string) => {
    setActiveTab('species-detail')
    setRequestedSpecies(commonName)
  }, [])

  const clearRequestedSpecies = useCallback(() => setRequestedSpecies(undefined), [])

  // Persist the layout durably per platform: storage seam on desktop (file-backed,
  // survives relaunch), localStorage on web/Pi (durable there and read synchronously
  // for a flash-free first paint).
  const persistLayout = useCallback((next: TabLayoutState) => {
    if (isTauri()) {
      void storage.setSetting<SerializedLayout>(TAB_LAYOUT_SETTING, serializeLayout(next))
    } else {
      saveTabLayout(next)
    }
  }, [])

  // Desktop only: hydrate the saved layout from the storage seam after mount,
  // since localStorage was cleared on relaunch. Web reads it synchronously above.
  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    void storage.getSetting<SerializedLayout>(TAB_LAYOUT_SETTING).then(raw => {
      if (cancelled || !raw) return
      const restored = parseLayout(raw)
      setTabLayout(restored)
      // If the saved layout hides the tab we defaulted to, move to the first visible one.
      setActiveTab(current => {
        if (current === 'settings') return current
        return restored.hidden.has(current as ConfigurableTab)
          ? (visibleTabs(restored)[0] ?? 'settings')
          : current
      })
    })
    return () => { cancelled = true }
  }, [])

  const handleReorder = useCallback((newOrder: ConfigurableTab[]) => {
    setTabLayout(prev => {
      const next = { ...prev, order: newOrder }
      persistLayout(next)
      return next
    })
  }, [persistLayout])

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
      persistLayout(next)
      return next
    })
  }, [persistLayout])

  const handleRestoreDefaults = useCallback(() => {
    const next: TabLayoutState = { order: [...DEFAULT_TAB_ORDER], hidden: new Set() }
    setTabLayout(next)
    persistLayout(next)
  }, [persistLayout])

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

  // Cold-start detection for the first-run welcome: only when no keys, no data files,
  // and not previously dismissed. Resolves to false fast for returning users (no flash).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [ebirdKey, owKey, files, seen] = await Promise.all([
          storage.getApiKey('ebird'),
          storage.getApiKey('openweather'),
          storage.getFilesStatus().catch(() => null),
          storage.getSetting<boolean>('welcomeSeen').catch(() => false),
        ])
        if (cancelled) return
        const noKeys = !ebirdKey && !owKey
        const noFiles = !files || (!files.ebird && !files.ml)
        setColdStart(noKeys && noFiles && !seen)
      } catch {
        if (!cancelled) setColdStart(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const dismissWelcome = useCallback(() => {
    setWelcomeDismissed(true)
    void storage.setSetting<boolean>('welcomeSeen', true)
  }, [])

  const handleWelcomeGetStarted = useCallback(() => {
    dismissWelcome()
    setActiveTab('settings')
  }, [dismissWelcome])

  // Apply the saved text scale app-wide on load, regardless of the open tab. The
  // index.html script covers web pre-paint; this also hydrates the durable value
  // from the storage seam (desktop, where localStorage is wiped on relaunch).
  useEffect(() => {
    applyScaleToDom(textScale)
    let cancelled = false
    void hydrateStoredScale().then(v => {
      if (cancelled || v === null) return
      setTextScaleState(v)
      applyScaleToDom(v)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleTextScale = useCallback((s: TextScale) => {
    setTextScaleState(s)
    persistTextScale(s)
  }, [])

  // Honor the saved theme app-wide on load. The index.html anti-flash script covers
  // web pre-paint via localStorage; on desktop localStorage is wiped each relaunch,
  // so hydrate the durable choice from the storage seam and apply it.
  useEffect(() => {
    let cancelled = false
    void hydrateStoredTheme().then(pref => {
      if (!cancelled && pref) applyTheme(pref)
    })
    return () => { cancelled = true }
  }, [])

  // After first paint, warm the lazy chunks during idle time so opening a heavy tab
  // is instant for returning users — without adding their weight to the first paint.
  useEffect(() => {
    const warm = () => {
      void importMapExplorer().catch(() => {})
      void importSpeciesDetail().catch(() => {})
      void importBirdingStats().catch(() => {})
      void importHelpDocs().catch(() => {})
    }
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
    const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback
    if (ric) {
      const h = ric(warm, { timeout: 3000 })
      return () => cic?.(h)
    }
    const t = setTimeout(warm, 1500)
    return () => clearTimeout(t)
  }, [])

  // Mark a heavy tab as mounted the first time it becomes active (then it stays mounted).
  useEffect(() => {
    if (DEFERRED_TABS.includes(activeTab)) {
      setMountedTabs(prev => (prev.has(activeTab) ? prev : new Set(prev).add(activeTab)))
    }
  }, [activeTab])

  // Lock background scroll while the map is fullscreen (the panel covers everything).
  // Guarded on the active tab so it self-clears if navigation leaves the map tab.
  useEffect(() => {
    if (!(mapFullscreen && activeTab === 'map-explorer')) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [mapFullscreen, activeTab])

  const handleLookup = useCallback(async () => {
    const id = extractChecklistId(input)
    if (!isValidChecklistId(id)) {
      setState({ status: 'error', message: "That doesn't look like a valid eBird checklist ID." })
      return
    }
    setState({ status: 'loading' })
    try {
      const data = await transport.get<{ formatted: string; checklist_id: string; loc_name: string; obs_dt: string }>(
        `/weather/${encodeURIComponent(id)}`
      )
      setState({ status: 'success', formatted: data.formatted, checklistId: data.checklist_id, locName: data.loc_name, obsDt: data.obs_dt })
      // Auto-copy via the clipboard seam — uses the native Tauri clipboard on
      // desktop (no user-gesture requirement) and navigator.clipboard on web.
      if (await copyText(data.formatted)) {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
      // If the copy failed, the user can still click Copy.
    } catch (err) {
      const detail = err instanceof TransportError ? (err.detail ?? err.message) : undefined
      setState({ status: 'error', message: detail ?? 'Something went wrong. Please try again.' })
    }
  }, [input])

  const handleCopy = async () => {
    if (state.status !== 'success') return
    await copyText(state.formatted)
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

  // Navigable destinations in saved order, hidden tabs removed, Settings last.
  // Shared by both the desktop bar and the compact dropdown (see TabNav).
  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = visibleTabs(tabLayout).map(tab => ({
      id: tab,
      label: TAB_LABELS[tab],
      icon: TAB_ICONS[tab],
    }))
    items.push({
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      ),
    })
    return items
  }, [tabLayout])

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
          <span style={{ fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.6px' }}>
            Snow<span style={{ color: 'var(--sr-accent)' }}>Raven</span>
          </span>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--sr-text-muted)', marginBottom: 28 }}>
          Birding tools for your eBird workflow
        </p>
      </div>

      {/* Tab navigation — bar on desktop, dropdown on narrow screens (see TabNav) */}
      <TabNav items={navItems} activeTab={activeTab} onSelect={setActiveTab} />

      {/* Weather tab content */}
      <main>
      <div
        role="tabpanel"
        id="panel-weather"
        aria-labelledby="tab-weather"
        aria-live="polite"
        aria-atomic="true"
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
                fontSize: '0.8125rem', color: 'var(--sr-warning)',
              }}>
                <span>eBird API key not configured — weather lookups require an eBird API key.</span>
                <button tabIndex={0}
                  onClick={() => setActiveTab('settings')}
                  style={{
                    background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', fontWeight: 600,
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
                fontSize: '0.8125rem', color: 'var(--sr-warning)',
              }}>
                <span>OpenWeather API key not configured — weather lookups won't return conditions. If you don't use weather features, you can disable or move this tab in Settings.</span>
                <button tabIndex={0}
                  onClick={() => setActiveTab('settings')}
                  style={{
                    background: 'none', border: 'none', padding: 0, fontSize: '0.75rem', fontWeight: 600,
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
            style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: 8 }}
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
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                color: 'inherit',
                background: 'var(--sr-surface)',
                minWidth: 0,
              }}
            />
            <button tabIndex={0}
              onClick={handleLookup}
              disabled={isLoading}
              style={{
                height: 44,
                padding: '0 18px',
                background: 'var(--sr-accent)',
                color: 'var(--sr-on-accent)',
                border: 'none',
                borderRadius: 8,
                fontSize: '0.875rem',
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
                fontSize: '0.8125rem',
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
                  fontSize: '0.75rem',
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
                      fontSize: '0.75rem',
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
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const,
                  color: 'var(--sr-text-muted)',
                }}>
                  Weather output
                </span>
                <button tabIndex={0}
                  onClick={handleCopy}
                  aria-label="Copy weather output to clipboard"
                  style={{
                    height: 30,
                    padding: '0 12px',
                    background: copied ? 'var(--sr-accent)' : 'var(--sr-accent-bg)',
                    color: copied ? 'var(--sr-on-accent)' : 'var(--sr-accent)',
                    border: `1.5px solid ${copied ? 'var(--sr-accent)' : 'var(--sr-accent-border)'}`,
                    borderRadius: 6,
                    fontSize: '0.75rem',
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
                  fontSize: '0.84375rem',
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
        id="panel-comparer"
        aria-labelledby="tab-comparer"
        className="sr-panel"
        style={{
          display: activeTab === 'comparer' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        {mountedTabs.has('comparer') && <ListComparer onOpenSpecies={navigateToSpeciesDetail} />}
      </div>

      {/* Life List tab content */}
      <div
        role="tabpanel"
        id="panel-life-list"
        aria-labelledby="tab-life-list"
        className="sr-panel"
        style={{
          display: activeTab === 'life-list' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        {mountedTabs.has('life-list') && (
          <LifeList
            onGoToSettings={() => setActiveTab('settings')}
            requestedFilter={mediaListFilter}
            onRequestedFilterConsumed={resetMediaListFilter}
            filesVersion={filesVersion}
            onOpenSpecies={navigateToSpeciesDetail}
          />
        )}
      </div>

      {/* Breeding Codes tab content */}
      <div
        role="tabpanel"
        id="panel-breeding-codes"
        aria-labelledby="tab-breeding-codes"
        className="sr-panel"
        style={{
          display: activeTab === 'breeding-codes' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        {mountedTabs.has('breeding-codes') && (
          <BreedingCodeList onGoToSettings={() => setActiveTab('settings')} filesVersion={filesVersion} onOpenSpecies={navigateToSpeciesDetail} />
        )}
      </div>

      {/* Species Detail tab content */}
      <div
        role="tabpanel"
        id="panel-species-detail"
        aria-labelledby="tab-species-detail"
        className="sr-panel"
        style={{
          display: activeTab === 'species-detail' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        {mountedTabs.has('species-detail') && (
          <Suspense fallback={<TabLoading label="Loading species detail…" />}>
            <SpeciesDetail
              onGoToSettings={() => setActiveTab('settings')}
              filesVersion={filesVersion}
              requestedSpecies={requestedSpecies}
              onRequestedSpeciesConsumed={clearRequestedSpecies}
            />
          </Suspense>
        )}
      </div>

      {/* Map Explorer tab content */}
      <div
        role="tabpanel"
        id="panel-map-explorer"
        aria-labelledby="tab-map-explorer"
        style={{
          display: activeTab === 'map-explorer' ? 'flex' : 'none',
          flexDirection: 'column',
          overflow: 'hidden',
          ...(mapFullscreen
            ? { position: 'fixed', inset: 0, width: '100vw', height: '100dvh', zIndex: 1200, background: 'var(--sr-bg)' }
            : { height: 'calc(100vh - 178px)' }),
        }}
      >
        {mountedTabs.has('map-explorer') && (
          <Suspense fallback={<TabLoading label="Loading map…" />}>
            <MapExplorer
              onGoToSettings={() => { setMapFullscreen(false); setActiveTab('settings') }}
              onNavigateToMediaList={() => { setMapFullscreen(false); navigateToMediaList() }}
              keysVersion={keysVersion}
              isFullscreen={mapFullscreen}
              onToggleFullscreen={() => setMapFullscreen(v => !v)}
              onOpenSpecies={(name) => { setMapFullscreen(false); navigateToSpeciesDetail(name) }}
            />
          </Suspense>
        )}
      </div>

      {/* Statistics tab content */}
      <div
        role="tabpanel"
        id="panel-birding-stats"
        aria-labelledby="tab-birding-stats"
        className="sr-panel"
        style={{
          display: activeTab === 'birding-stats' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        {mountedTabs.has('birding-stats') && (
          <Suspense fallback={<TabLoading label="Loading charts…" />}>
            <BirdingStats onGoToSettings={() => setActiveTab('settings')} onOpenSpecies={navigateToSpeciesDetail} />
          </Suspense>
        )}
      </div>

      {/* Settings tab content */}
      <div
        role="tabpanel"
        id="panel-settings"
        aria-labelledby="tab-settings"
        className="sr-panel"
        style={{
          display: activeTab === 'settings' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        {mountedTabs.has('settings') && (
          <Settings
            onKeysSaved={fetchKeyStatus}
            onFilesSaved={handleFilesSaved}
            onOpenHelp={() => setHelpOpen(true)}
            textScale={textScale}
            onTextScaleChange={handleTextScale}
            tabOrder={tabLayout.order}
            tabHidden={tabLayout.hidden}
            onReorder={handleReorder}
            onToggleVisibility={handleToggleVisibility}
            onRestoreDefaults={handleRestoreDefaults}
          />
        )}
      </div>
      </main>

      {/* Footer */}
      <p role="contentinfo" style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--sr-text-footer)', padding: '0 24px 20px', flexShrink: 0 }}>
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
        <button tabIndex={0}
          onClick={() => setHelpOpen(true)}
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
          Help
        </button>
        {' · '}
        {updateStatus.kind === 'idle' && (
          <button tabIndex={0}
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
          <span aria-live="polite" style={{ color: 'var(--sr-text-muted)' }}>
            <Loader2 size={11} className="spin" aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 4 }} />
            Checking…
          </span>
        )}
        {updateStatus.kind === 'up-to-date' && (
          <span aria-live="polite" style={{ color: 'var(--sr-accent)' }}>Up to date (v{updateStatus.current})</span>
        )}
        {updateStatus.kind === 'available' && (
          isTauri() ? (
            <span style={{ color: 'var(--sr-warning)' }}>
              v{updateStatus.latest} available —{' '}
              <button tabIndex={0}
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
          <span aria-live="polite" style={{ color: 'var(--sr-text-muted)' }}>
            <Loader2 size={11} className="spin" aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 4 }} />
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

      {coldStart === true && !welcomeDismissed && (
        <WelcomeScreen
          onGetStarted={handleWelcomeGetStarted}
          onOpenHelp={() => setHelpOpen(true)}
          onDismiss={dismissWelcome}
        />
      )}

      {helpOpen && (
        <Suspense fallback={null}>
          <HelpDocs onClose={() => setHelpOpen(false)} />
        </Suspense>
      )}
    </div>
  )
}
