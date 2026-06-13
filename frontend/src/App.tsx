import { useState, useCallback, useRef, useEffect, useMemo, lazy, Suspense, createContext, useContext } from 'react'
import { Bird, Search, Loader2, ClipboardCopy, Check, AlertCircle, ExternalLink, List, Dna, BookOpen, BarChart2, Tag, ClipboardList } from 'lucide-react'
import { transport, TransportError } from './lib/transport'
import { storage } from './lib/storage'
import { isTauri } from './lib/platform'
import { copyText } from './lib/clipboard'
import { extractChecklistId, isValidChecklistId } from './lib/checklistId'
import { buildCombined } from './lib/tideFormatter'
import { tideTooFarNotice, tideOverrideLabel } from './lib/tideNotice'
import type { TideResponse } from './lib/tide'
import type { KeyStatus } from './lib/keyStatus'
import { readStoredScale, persistTextScale, applyScaleToDom, hydrateStoredScale } from './lib/textScale'
import type { TextScale } from './lib/textScale'
import { applyTheme, hydrateStoredTheme } from './lib/theme'
import { setDateFormatPref, asDateFormatPref } from './lib/formatDate'
import type { DateFormatPref } from './lib/formatDate'
import { formatObsDate } from './lib/compareChecklists'
import { ListComparer } from './components/ListComparer'
import { LifeList } from './components/LifeList'
import { BreedingCodeList } from './components/BreedingCodeList'
import { NamedBirds } from './components/NamedBirds'
import { Checklists } from './components/Checklists'
import { Settings } from './components/Settings'
import { WelcomeScreen } from './components/WelcomeScreen'
import { TabNav, type NavItem } from './components/TabNav'
import { OutboundLink } from './components/OutboundLink'

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

// The tide box's own independent state — a tide failure never touches weather.
type TideState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; formatted: string; body: string }
  | { status: 'too-far'; station: string; distanceMi: number }
  | { status: 'outside-us'; station: string; distanceMi: number }
  | { status: 'unavailable' }
  | { status: 'error' }

type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up-to-date'; current: string }
  | { kind: 'available'; latest: string }
  | { kind: 'downloading'; progress: number | null }
  | { kind: 'ready-to-restart' }
  | { kind: 'error' }


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
  'named-birds':    <Tag size={14} strokeWidth={2.5} aria-hidden="true" />,
  'checklists':     <ClipboardList size={14} strokeWidth={2.5} aria-hidden="true" />,
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
  'comparer', 'life-list', 'breeding-codes', 'named-birds', 'checklists', 'settings',
]

// Setter for the persistent loading-status region (mounted once in App, OUTSIDE
// every Suspense boundary). A live region must already exist before its text
// changes to be announced reliably (F068) — a status node that MOUNTS together
// with the Suspense fallback (as TabLoading once did) is announced inconsistently.
const TabLoadingAnnouncerContext = createContext<(label: string | null) => void>(() => {})

// Fallback shown while a lazy tab's chunk is being fetched. Visual-only (no
// role=status): on mount it pushes its label to the persistent announcer outside
// the Suspense boundary, and clears it on unmount — so the live region the AT
// observes is never mounted at the same instant as its text (F068).
function TabLoading({ label = 'Loading…' }: { label?: string }) {
  const announce = useContext(TabLoadingAnnouncerContext)
  useEffect(() => {
    announce(label)
    return () => announce(null)
  }, [announce, label])
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', justifyContent: 'center', padding: 48, minHeight: 200 }}>
      <Loader2 size={22} className="spin" style={{ color: 'var(--sr-text-muted)' }} aria-hidden="true" />
      <span style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>{label}</span>
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
  const [tideState, setTideState] = useState<TideState>({ status: 'idle' })
  const [tideCopied, setTideCopied] = useState(false)
  const [bothCopied, setBothCopied] = useState(false)
  const lastLookupId = useRef('')
  // Mobile-only: Map Explorer occupies the full viewport when true.
  const [mapFullscreen, setMapFullscreen] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: 'idle' })
  const [keyStatus, setKeyStatus] = useState<KeyStatus | null>(null)
  const [filesVersion, setFilesVersion] = useState(0)
  const [keysVersion, setKeysVersion] = useState(0)
  // Bumped when the date-format preference changes. formatDate() reads the pref
  // from a module-var at render time, so bumping this re-renders the whole tree
  // and every date reflects the new preference immediately (no remount).
  const [dateFormatVersion, setDateFormatVersion] = useState(0)
  const [mediaListFilter, setMediaListFilter] = useState<'is-target' | undefined>(undefined)
  // Click any bird name → open + select it on the Species Detail tab (single-use).
  const [requestedSpecies, setRequestedSpecies] = useState<string | undefined>(undefined)
  // Documentation overlay — lifted to App so a Help affordance is reachable from
  // every tab (the footer), not only the button inside Settings.
  const [helpOpen, setHelpOpen] = useState(false)
  // Text for the persistent loading-status region rendered once in <main>, outside
  // every Suspense boundary. The TabLoading fallbacks set/clear it via context, so
  // the live region pre-exists its text change and AT announces it reliably (F068).
  const [tabLoadingLabel, setTabLoadingLabel] = useState<string | null>(null)
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

  // Apply the saved date-format preference app-wide on load (default month-first).
  // formatDate() reads the module-var, so setting it once here makes every date
  // render in the chosen format from the first paint after hydration.
  useEffect(() => {
    let cancelled = false
    void storage.getSetting<DateFormatPref>('dateFormat').then(v => {
      if (cancelled || !v) return
      setDateFormatPref(asDateFormatPref(v))
      setDateFormatVersion(n => n + 1)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Settings calls this after persisting + applying a new date-format pref; bump
  // the version to re-render the tree so all dates update immediately.
  const handleDateFormatChange = useCallback(() => {
    setDateFormatVersion(n => n + 1)
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
      // The post-commit setState is the deliberate mount trigger: mounting the
      // heavy tab during the same render as the tab switch would block that
      // frame's paint, which is exactly what the deferral exists to avoid.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Reflect the active view in the page title (web/SPA orientation: 2.4.2) and,
  // on desktop, the native window title — Tauri v2 does NOT mirror document.title
  // to the OS window, so set it explicitly behind isTauri()
  // (core:window:allow-set-title). Label sourced the same way the nav does.
  const activeTabLabel = activeTab === 'settings' ? 'Settings' : TAB_LABELS[activeTab]
  useEffect(() => {
    const title = `${activeTabLabel} — SnowRaven`
    document.title = title
    if (isTauri()) {
      void import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => getCurrentWindow().setTitle(title))
        .catch(() => {})
    }
  }, [activeTabLabel])

  // Returns the tide block { formatted, body } when a reading resolved, else null.
  const loadTide = useCallback(async (id: string, force: boolean): Promise<{ formatted: string; body: string } | null> => {
    setTideState({ status: 'loading' })
    try {
      const t = await transport.get<TideResponse>(
        `/tide/${encodeURIComponent(id)}`,
        force ? { force: '1' } : undefined,
      )
      if (t.status === 'ok' && t.formatted && t.body) {
        setTideState({ status: 'ok', formatted: t.formatted, body: t.body })
        return { formatted: t.formatted, body: t.body }
      } else if ((t.status === 'too-far' || t.status === 'outside-us') && t.station) {
        setTideState({ status: t.status, station: t.station.name, distanceMi: t.distanceMi ?? 0 })
      } else {
        setTideState({ status: 'unavailable' })
      }
    } catch {
      setTideState({ status: 'error' })
    }
    return null
  }, [])

  // Returns the formatted weather string on success, else null. Does NOT
  // auto-copy — handleLookup decides what to copy (weather alone, or combined).
  const loadWeather = useCallback(async (id: string): Promise<string | null> => {
    setState({ status: 'loading' })
    try {
      const data = await transport.get<{ formatted: string; checklist_id: string; loc_name: string; obs_dt: string }>(
        `/weather/${encodeURIComponent(id)}`
      )
      setState({ status: 'success', formatted: data.formatted, checklistId: data.checklist_id, locName: data.loc_name, obsDt: data.obs_dt })
      return data.formatted
    } catch (err) {
      const detail = err instanceof TransportError ? (err.detail ?? err.message) : undefined
      setState({ status: 'error', message: detail ?? 'Something went wrong. Please try again.' })
      return null
    }
  }, [])

  const handleLookup = useCallback(async () => {
    const id = extractChecklistId(input)
    if (!isValidChecklistId(id)) {
      setState({ status: 'error', message: "That doesn't look like a valid eBird checklist ID." })
      setTideState({ status: 'idle' })
      return
    }
    lastLookupId.current = id
    // Weather and tide run concurrently from one action; each owns its state so
    // one failing never blocks the other.
    const [weather] = await Promise.all([loadWeather(id), loadTide(id, false)])
    // Auto-copy the weather on the clipboard seam (native on desktop, navigator
    // on web). Tide has its own Copy + the "Copy Weather and Tide Together"
    // button; a failed copy just leaves the buttons.
    if (weather && await copyText(weather)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [input, loadWeather, loadTide])

  const handleTideOverride = useCallback(() => {
    if (lastLookupId.current) void loadTide(lastLookupId.current, true)
  }, [loadTide])

  const handleCopy = async () => {
    if (state.status !== 'success') return
    await copyText(state.formatted)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyTide = async () => {
    if (tideState.status !== 'ok') return
    await copyText(tideState.formatted)
    setTideCopied(true)
    setTimeout(() => setTideCopied(false), 2000)
  }

  const handleCopyBoth = async () => {
    if (state.status !== 'success' || tideState.status !== 'ok') return
    await copyText(buildCombined(state.formatted, tideState.body))
    setBothCopied(true)
    setTimeout(() => setBothCopied(false), 2000)
  }

  // Every outcome now PERSISTS until the user acts (WCAG 2.2.1 Timing Adjustable):
  // no content-set time limit erases the answer. The 'idle' Check-For-Updates
  // button is re-rendered alongside each persistent outcome (see the footer), so
  // re-checking stays one click away and keyboard focus is never dropped to body.
  const handleUpdateCheck = useCallback(async () => {
    if (updateStatus.kind === 'checking' || updateStatus.kind === 'downloading') return
    setUpdateStatus({ kind: 'checking' })
    try {
      if (isTauri()) {
        const { checkForUpdate } = await import('./lib/tauri/updateManager')
        const result = await checkForUpdate()
        if (result.status === 'up-to-date') {
          setUpdateStatus({ kind: 'up-to-date', current: result.current })
        } else if (result.status === 'available') {
          setUpdateStatus({ kind: 'available', latest: result.latest })
        } else {
          setUpdateStatus({ kind: 'error' })
        }
      } else {
        const data = await transport.get<{ current: string; latest: string; up_to_date: boolean }>('/version/check')
        if (data.up_to_date) {
          setUpdateStatus({ kind: 'up-to-date', current: data.current })
        } else {
          setUpdateStatus({ kind: 'available', latest: data.latest })
        }
      }
    } catch {
      setUpdateStatus({ kind: 'error' })
    }
  }, [updateStatus.kind])

  const handleInstallUpdate = useCallback(async () => {
    setUpdateStatus({ kind: 'downloading', progress: null })
    try {
      const { downloadAndInstall } = await import('./lib/tauri/updateManager')
      // Throttle live-region churn: only commit a new state when the rounded
      // percent actually changes (and at every step it does, AT announces a
      // single integer rather than chattering dozens of stale sub-percent
      // figures across a multi-megabyte download — finding F025).
      let lastPct = -1
      await downloadAndInstall(({ downloaded, total }) => {
        const progress = total ? downloaded / total : null
        const pct = progress === null ? -1 : Math.round(progress * 100)
        if (pct === lastPct) return
        lastPct = pct
        setUpdateStatus({ kind: 'downloading', progress })
      })
      // downloadAndInstall awaits relaunch() before resolving, so this typically
      // runs as the process is already exiting; it is a best-effort terminal
      // state, not a guaranteed paint.
      setUpdateStatus({ kind: 'ready-to-restart' })
    } catch {
      setUpdateStatus({ kind: 'error' })
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

  // While the Map Explorer is fullscreen, the app chrome (header, tab nav, footer)
  // stays in the DOM and the tab order BEHIND the fixed overlay — a keyboard user
  // tabbing out of the map would land on fully obscured controls (F023/F065,
  // WCAG 2.4.11). `inert` removes that chrome from focus + AT while the overlay is
  // up. The non-map tabpanels are already display:none (non-focusable), and the
  // map panel itself is the overlay, so those are left alone. (React 19 supports
  // the boolean `inert` prop; supported in both desktop webviews.)
  const chromeInert = mapFullscreen && activeTab === 'map-explorer'

  return (
    <TabLoadingAnnouncerContext.Provider value={setTabLoadingLabel}>
    <div
      // Carries the date-format version so a pref change is reflected in App's
      // render (and thus re-renders the un-memoized tab tree); formatDate() reads
      // the active pref from its module-var at render time.
      data-date-fmt-version={dateFormatVersion}
      style={{
        minHeight: '100vh',
        background: 'var(--sr-bg)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
        color: 'var(--sr-text)',
      }}
    >
      <a href="#sr-main" className="sr-skip-link">Skip to main content</a>

      {/* Header — banner landmark; the wordmark is the page's h1. */}
      <header inert={chromeInert} className="sr-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Bird size={30} strokeWidth={1.75} style={{ color: 'var(--sr-accent)' }} aria-hidden="true" />
          <h1 style={{ fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.6px', margin: 0 }}>
            Snow<span style={{ color: 'var(--sr-accent)' }}>Raven</span>
          </h1>
        </div>
        <p style={{ fontSize: '0.875rem', color: 'var(--sr-text-muted)', marginBottom: 28 }}>
          Birding tools for your eBird workflow
        </p>
      </header>

      {/* Tab navigation — bar on desktop, dropdown on narrow screens (see TabNav).
          Wrapped so it can be made inert behind the fullscreen map overlay
          (display:contents keeps the wrapper layout-neutral). */}
      <div style={{ display: 'contents' }} inert={chromeInert}>
        <TabNav items={navItems} activeTab={activeTab} onSelect={setActiveTab} />
      </div>

      {/* Weather tab content */}
      <main id="sr-main" tabIndex={-1} style={{ outline: 'none' }}>
      {/* Persistent (always-mounted) polite region for the lazy-tab loading state,
          living OUTSIDE every Suspense boundary so it pre-exists its text change —
          the TabLoading fallbacks push their label here via context (F068). The
          visible spinner inside each fallback is no longer a role=status node. */}
      <span className="sr-only" role="status" aria-live="polite">{tabLoadingLabel ?? ''}</span>
      <div
        role="tabpanel"
        id="panel-weather"
        aria-labelledby="tab-weather"
        aria-label="Weather"
        className="sr-panel"
        style={{
          display: activeTab === 'weather' ? 'flex' : 'none',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '40px 24px 24px',
        }}
      >
        {/* Persistent polite region for clipboard confirmations only. The panel
            itself is no longer a live region (F022) — that re-announced the whole
            weather/tide content on every interaction; the scoped role=alert /
            role=status children below carry their own state changes. */}
        <span className="sr-only" role="status" aria-live="polite">
          {copied ? 'Weather copied to clipboard.'
            : tideCopied ? 'Tide copied to clipboard.'
            : bothCopied ? 'Weather and tide copied to clipboard.'
            : ''}
        </span>
        {/* Persistent (always-mounted) polite region for the tide lifecycle, so
            its state changes are reliably announced — a status node that mounts
            already carrying its text is announced inconsistently (F068). The
            visible tide chips below are plain (no role=status) to avoid a double
            read-out. */}
        <span className="sr-only" role="status" aria-live="polite">
          {tideState.status === 'loading' ? 'Loading tide…'
            : tideState.status === 'unavailable' || tideState.status === 'error' ? 'Tide data unavailable right now.'
            : ''}
        </span>
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

          <p style={{ marginTop: 8, marginBottom: 0, fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>
            Weather information is automatically copied to the clipboard on a successful lookup. Tidal information will also be shown below if available.
          </p>

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
              {/* Edit link on its own line above the checklist info so neither
                  truncates the other. */}
              {state.status === 'success' && (
                <a
                  href={`https://ebird.org/edit/effort?subID=${state.checklistId}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Edit checklist comment on eBird (opens in a new tab)"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--sr-accent)',
                    textDecoration: 'none',
                    marginBottom: 6,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  Edit checklist comment on eBird
                  <ExternalLink size={11} strokeWidth={2.5} />
                </a>
              )}
              <div style={{ marginBottom: 14 }}>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--sr-text-muted)',
                  fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace',
                  letterSpacing: '0.01em',
                }}>
                  {state.status === 'success' && `${state.checklistId} / ${state.locName} / ${formatObsDate(state.obsDt)}`}
                </span>
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

          {/* Tide box — independent of weather; fires from the same lookup. */}
          {tideState.status !== 'idle' && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid var(--sr-border)', margin: '24px 0' }} />
              {tideState.status === 'loading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
                  <Loader2 size={14} className="spin" aria-hidden="true" /> Loading tide…
                </div>
              )}
              {tideState.status === 'unavailable' && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>Tide data unavailable right now.</div>
              )}
              {tideState.status === 'error' && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>Tide data unavailable right now.</div>
              )}
              {(tideState.status === 'too-far' || tideState.status === 'outside-us') && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: 'var(--sr-warning-bg)', border: '1px solid var(--sr-warning-subtle)', color: 'var(--sr-warning)', borderRadius: 8, padding: '13px 15px', fontSize: '0.8125rem', lineHeight: 1.5 }}>
                  <span style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                    {tideTooFarNotice(tideState.station, tideState.distanceMi, tideState.status)}
                  </span>
                  <button tabIndex={0}
                    onClick={handleTideOverride}
                    aria-label="Show the nearest tide station anyway"
                    style={{ flexShrink: 0, height: 30, padding: '0 12px', background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {tideOverrideLabel(tideState.status)}
                  </button>
                </div>
              )}
              {tideState.status === 'ok' && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'var(--sr-text-muted)' }}>
                      Tide output
                    </span>
                    <button tabIndex={0}
                      onClick={handleCopyTide}
                      aria-label="Copy tide output to clipboard"
                      style={{ height: 30, padding: '0 12px', background: tideCopied ? 'var(--sr-accent)' : 'var(--sr-accent-bg)', color: tideCopied ? 'var(--sr-on-accent)' : 'var(--sr-accent)', border: `1.5px solid ${tideCopied ? 'var(--sr-accent)' : 'var(--sr-accent-border)'}`, borderRadius: 6, fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      {tideCopied ? <Check size={12} strokeWidth={2.5} /> : <ClipboardCopy size={12} strokeWidth={2.5} />}
                      {tideCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre style={{ background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)', borderRadius: 8, padding: '18px 20px', fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace', fontSize: '0.84375rem', lineHeight: 1.75, color: 'inherit', whiteSpace: 'pre', overflowX: 'auto', margin: 0 }}>
                    {tideState.formatted}
                  </pre>
                </>
              )}

              {state.status === 'success' && tideState.status === 'ok' && (
                <button tabIndex={0}
                  onClick={handleCopyBoth}
                  aria-label="Copy weather and tide together to clipboard"
                  style={{ marginTop: 18, width: '100%', height: 38, background: bothCopied ? 'var(--sr-accent)' : 'var(--sr-accent-bg)', color: bothCopied ? 'var(--sr-on-accent)' : 'var(--sr-accent)', border: `1.5px solid ${bothCopied ? 'var(--sr-accent)' : 'var(--sr-accent-border)'}`, borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  {bothCopied ? <Check size={14} strokeWidth={2.5} /> : <ClipboardCopy size={14} strokeWidth={2.5} />}
                  {bothCopied ? 'Copied!' : 'Copy Weather and Tide Together'}
                </button>
              )}
            </>
          )}
        </div>
        <p style={{ width: '100%', maxWidth: 540, margin: '14px 0 0', textAlign: 'center', fontSize: '0.75rem', color: 'var(--sr-text-footer)' }}>
          Also for your browser:{' '}
          <a href="https://github.com/dtgibson/snowraven-mini" target="_blank" rel="noreferrer" aria-label="SnowRaven Mini on GitHub (opens in a new tab)" style={{ color: 'inherit', textDecoration: 'underline' }}>SnowRaven Mini</a>
          , a Chrome/Firefox extension with this same weather and tide lookup.
        </p>
      </div>

      {/* List Comparer tab content */}
      <div
        role="tabpanel"
        id="panel-comparer"
        aria-labelledby="tab-comparer"
        aria-label="List Comparer"
        className="sr-panel"
        style={{
          display: activeTab === 'comparer' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        {mountedTabs.has('comparer') && (
          <ListComparer
            onOpenSpecies={navigateToSpeciesDetail}
            keyStatus={keyStatus}
            onGoToSettings={() => setActiveTab('settings')}
          />
        )}
      </div>

      {/* Life List tab content */}
      <div
        role="tabpanel"
        id="panel-life-list"
        aria-labelledby="tab-life-list"
        aria-label="Multimedia"
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
        aria-label="Breeding Codes"
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

      {/* Named Birds tab content */}
      <div
        role="tabpanel"
        id="panel-named-birds"
        aria-labelledby="tab-named-birds"
        aria-label="Named Birds"
        className="sr-panel"
        style={{
          display: activeTab === 'named-birds' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        {mountedTabs.has('named-birds') && (
          <NamedBirds onGoToSettings={() => setActiveTab('settings')} filesVersion={filesVersion} onOpenSpecies={navigateToSpeciesDetail} />
        )}
      </div>

      {/* Checklists tab content */}
      <div
        role="tabpanel"
        id="panel-checklists"
        aria-labelledby="tab-checklists"
        aria-label="Checklists"
        className="sr-panel"
        style={{
          display: activeTab === 'checklists' ? 'flex' : 'none',
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        {mountedTabs.has('checklists') && (
          <Checklists onGoToSettings={() => setActiveTab('settings')} filesVersion={filesVersion} onOpenSpecies={navigateToSpeciesDetail} />
        )}
      </div>

      {/* Species Detail tab content */}
      <div
        role="tabpanel"
        id="panel-species-detail"
        aria-labelledby="tab-species-detail"
        aria-label="Species Detail"
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
        aria-label="Map Explorer"
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
        aria-label="Statistics"
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
        aria-label="Settings"
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
            onDateFormatChange={handleDateFormatChange}
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
      <p inert={chromeInert} role="contentinfo" style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--sr-text-footer)', padding: '0 24px 20px', flexShrink: 0 }}>
        <OutboundLink
          href="https://github.com/dtgibson/snowraven"
          style={{ color: 'inherit', textDecoration: 'none' }}
          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
        >
          SnowRaven
        </OutboundLink>
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
        {/* Update checker. One persistent polite live region carries every textual
            outcome (always mounted, so AT reliably announces text changes — F024),
            and no outcome auto-dismisses (F020: 2.2.1 Timing Adjustable). The
            Check-For-Updates button stays present except while a check/download is
            in flight, so re-checking is one click away and keyboard focus is never
            dropped to <body> when an outcome resolves. */}
        {(updateStatus.kind === 'idle'
          || updateStatus.kind === 'up-to-date'
          || updateStatus.kind === 'available'
          || updateStatus.kind === 'error') && (
          <>
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
            {/* Desktop "available" gets its Install button as a sibling OUTSIDE the
                live span so its mount doesn't depend on live-region timing (F025). */}
            {updateStatus.kind === 'available' && isTauri() && (
              <>
                {' · '}
                <button tabIndex={0}
                  onClick={handleInstallUpdate}
                  style={{
                    background: 'none', border: 'none', padding: 0, font: 'inherit',
                    color: 'var(--sr-warning)', cursor: 'pointer', fontWeight: 600,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  Install update and restart
                </button>
              </>
            )}
          </>
        )}
        {/* Always-mounted polite live region (empty while idle). Its text content
            changes per state, which AT announces reliably. The web "available"
            branch keeps its actionable ./update.sh instruction here, persistent. */}
        <span
          role="status"
          aria-live="polite"
          style={{
            marginLeft: updateStatus.kind === 'idle' ? 0 : 8,
            color:
              updateStatus.kind === 'up-to-date' || updateStatus.kind === 'ready-to-restart' ? 'var(--sr-accent)'
              : updateStatus.kind === 'available' ? 'var(--sr-warning)'
              : updateStatus.kind === 'error' ? 'var(--sr-error)'
              : 'var(--sr-text-muted)',
          }}
        >
          {updateStatus.kind === 'checking' && (
            <>
              <Loader2 size={11} className="spin" aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 4 }} />
              Checking…
            </>
          )}
          {updateStatus.kind === 'up-to-date' && `Up to date (v${updateStatus.current})`}
          {updateStatus.kind === 'available' && !isTauri() && (
            <>
              v{updateStatus.latest} available — run{' '}
              <code style={{ fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace' }}>./update.sh</code>
            </>
          )}
          {updateStatus.kind === 'available' && isTauri() && `v${updateStatus.latest} available`}
          {updateStatus.kind === 'ready-to-restart' && 'Update installed — restarting…'}
          {updateStatus.kind === 'error' && 'Could not check for updates'}
        </span>
        {/* Download progress: a real progressbar AT can query as a value, plus the
            same persistent live text. Indeterminate (no Content-Length) → aria-busy. */}
        {updateStatus.kind === 'downloading' && (
          <span
            role="progressbar"
            aria-label="Downloading update"
            aria-busy={updateStatus.progress === null}
            {...(updateStatus.progress !== null
              ? {
                  'aria-valuemin': 0,
                  'aria-valuemax': 100,
                  'aria-valuenow': Math.round(updateStatus.progress * 100),
                }
              : {})}
            style={{ marginLeft: 8, color: 'var(--sr-text-muted)' }}
          >
            <Loader2 size={11} className="spin" aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 4 }} />
            {updateStatus.progress !== null
              ? `Downloading… ${Math.round(updateStatus.progress * 100)}%`
              : 'Downloading update…'}
          </span>
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
    </TabLoadingAnnouncerContext.Provider>
  )
}
