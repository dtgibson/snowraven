import { useState, useCallback, useRef } from 'react'
import { Bird, Search, Loader2, ClipboardCopy, Check, AlertCircle, ExternalLink, List, Dna } from 'lucide-react'
import { ListComparer } from './components/ListComparer'
import { LifeList } from './components/LifeList'
import { BreedingCodeList } from './components/BreedingCodeList'

type AppState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; formatted: string; checklistId: string; locName: string; obsDt: string }
  | { status: 'error'; message: string }

type Tab = 'weather' | 'comparer' | 'life-list' | 'breeding-codes'

type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up-to-date'; current: string }
  | { kind: 'available'; latest: string }
  | { kind: 'error' }

function extractChecklistId(raw: string): string {
  const s = raw.trim().replace(/\/+$/, '').split('?')[0]
  return s.includes('/') ? (s.split('/').pop() ?? s) : s
}

function isValidId(id: string): boolean {
  return /^S\d+$/.test(id)
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('weather')
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [state, setState] = useState<AppState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ kind: 'idle' })
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleLookup = useCallback(async () => {
    const id = extractChecklistId(input)
    if (!isValidId(id)) {
      setState({ status: 'error', message: "That doesn't look like a valid eBird checklist ID." })
      return
    }
    setState({ status: 'loading' })
    try {
      const res = await fetch(`/weather/${encodeURIComponent(id)}`)
      const data = await res.json()
      if (!res.ok) {
        setState({ status: 'error', message: data.detail ?? 'Something went wrong. Please try again.' })
        return
      }
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
    } catch {
      setState({ status: 'error', message: 'Could not reach the server. Is the backend running?' })
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
    if (updateStatus.kind === 'checking') return
    if (updateTimerRef.current) clearTimeout(updateTimerRef.current)
    setUpdateStatus({ kind: 'checking' })
    try {
      const res = await fetch('/version/check')
      const data = await res.json()
      if (!res.ok) {
        setUpdateStatus({ kind: 'error' })
        updateTimerRef.current = setTimeout(() => setUpdateStatus({ kind: 'idle' }), 4000)
        return
      }
      if (data.up_to_date) {
        setUpdateStatus({ kind: 'up-to-date', current: data.current })
        updateTimerRef.current = setTimeout(() => setUpdateStatus({ kind: 'idle' }), 4000)
      } else {
        setUpdateStatus({ kind: 'available', latest: data.latest })
        updateTimerRef.current = setTimeout(() => setUpdateStatus({ kind: 'idle' }), 8000)
      }
    } catch {
      setUpdateStatus({ kind: 'error' })
      updateTimerRef.current = setTimeout(() => setUpdateStatus({ kind: 'idle' }), 4000)
    }
  }, [updateStatus.kind])

  const isLoading = state.status === 'loading'
  const hasError = state.status === 'error'
  const hasResult = state.status === 'success'

  const tabStyle = (tab: Tab): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 16px',
    border: 'none',
    borderBottom: `2px solid ${activeTab === tab ? '#2D8653' : 'transparent'}`,
    background: 'none',
    fontFamily: 'var(--font-sans)',
    fontSize: 14,
    fontWeight: 500,
    color: activeTab === tab ? '#2D8653' : '#71717A',
    cursor: 'pointer',
    marginBottom: -1,
    transition: 'color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
  })

  return (
    <div style={{
      ...(isExpanded ? { minHeight: '100vh' } : { height: '100vh', overflow: 'hidden' }),
      background: '#f9fafb',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-sans)',
      color: '#0F1117',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <Bird size={30} strokeWidth={1.75} style={{ color: '#2D8653' }} />
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.6px' }}>
            Snow<span style={{ color: '#2D8653' }}>Raven</span>
          </span>
        </div>
        <p style={{ fontSize: 14, color: '#71717A', marginBottom: 28 }}>
          Birding tools for your eBird workflow
        </p>
      </div>

      {/* Tab bar */}
      <div style={{ borderBottom: '1px solid #E4E4E7', display: 'flex', justifyContent: 'center', padding: '0 24px', flexShrink: 0 }}>
        <nav style={{ display: 'flex', maxWidth: 880, width: '100%' }} role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'weather'}
            style={tabStyle('weather')}
            onClick={() => { setActiveTab('weather'); setIsExpanded(false) }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
            </svg>
            Weather
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'life-list'}
            style={tabStyle('life-list')}
            onClick={() => { setActiveTab('life-list'); setIsExpanded(false) }}
          >
            <List size={14} strokeWidth={2.5} aria-hidden="true" />
            Media Life List
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'comparer'}
            style={tabStyle('comparer')}
            onClick={() => { setActiveTab('comparer'); setIsExpanded(false) }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 6H3"/><path d="M10 12H3"/><path d="M10 18H3"/><polyline points="15 12 18 15 21 12"/><path d="M18 6v9"/>
            </svg>
            Life List Comparer
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'breeding-codes'}
            style={tabStyle('breeding-codes')}
            onClick={() => { setActiveTab('breeding-codes'); setIsExpanded(false) }}
          >
            <Dna size={14} strokeWidth={2.5} aria-hidden="true" />
            Breeding Codes
          </button>
        </nav>
      </div>

      {/* Weather tab content */}
      <div
        role="tabpanel"
        style={{
          display: activeTab === 'weather' ? 'flex' : 'none',
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '40px 24px 24px',
        }}
      >
        <div style={{
          width: '100%',
          maxWidth: 540,
          background: '#fff',
          border: '1px solid #E4E4E7',
          borderRadius: 12,
          padding: 32,
          boxShadow: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
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
                border: `1.5px solid ${hasError ? '#DC2626' : '#E4E4E7'}`,
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'inherit',
                color: 'inherit',
                background: '#fff',
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
                background: '#2D8653',
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
                background: '#FEF2F2',
                borderRadius: 6,
                fontSize: 13,
                color: '#DC2626',
              }}
            >
              <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
              {state.message}
            </div>
          )}

          {hasResult && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #E4E4E7', margin: '24px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <span style={{
                  fontSize: 12,
                  color: '#71717A',
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
                      color: '#2D8653',
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
                  color: '#71717A',
                }}>
                  Weather output
                </span>
                <button
                  onClick={handleCopy}
                  aria-label="Copy weather output to clipboard"
                  style={{
                    height: 30,
                    padding: '0 12px',
                    background: copied ? '#2D8653' : '#E8F5EE',
                    color: copied ? '#fff' : '#2D8653',
                    border: `1.5px solid ${copied ? '#2D8653' : 'rgba(45,134,83,0.18)'}`,
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
                  background: '#F4F4F5',
                  border: '1px solid #E4E4E7',
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
        style={{
          display: activeTab === 'comparer' ? 'flex' : 'none',
          ...(isExpanded ? {} : { flex: 1, minHeight: 0, overflowY: 'auto' as const }),
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        <ListComparer onExpandedChange={setIsExpanded} />
      </div>

      {/* Life List tab content */}
      <div
        role="tabpanel"
        style={{
          display: activeTab === 'life-list' ? 'flex' : 'none',
          ...(isExpanded ? {} : { flex: 1, minHeight: 0, overflowY: 'auto' as const }),
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        <LifeList onExpandedChange={setIsExpanded} />
      </div>

      {/* Breeding Codes tab content */}
      <div
        role="tabpanel"
        style={{
          display: activeTab === 'breeding-codes' ? 'flex' : 'none',
          ...(isExpanded ? {} : { flex: 1, minHeight: 0, overflowY: 'auto' as const }),
          flexDirection: 'column',
          padding: '40px 24px 24px',
        }}
      >
        <BreedingCodeList onExpandedChange={setIsExpanded} />
      </div>

      {/* Footer */}
      <p style={{ textAlign: 'center', fontSize: 12, color: '#b0b0b8', padding: '0 24px 20px', flexShrink: 0 }}>
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
              color: '#b0b0b8',
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
          <span style={{ color: '#71717A' }}>Checking…</span>
        )}
        {updateStatus.kind === 'up-to-date' && (
          <span style={{ color: '#2D8653' }}>Up to date (v{updateStatus.current})</span>
        )}
        {updateStatus.kind === 'available' && (
          <span style={{ color: '#92400e' }}>
            v{updateStatus.latest} available — run{' '}
            <code style={{ fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace' }}>./update.sh</code>
          </span>
        )}
        {updateStatus.kind === 'error' && (
          <span style={{ color: '#b91c1c' }}>Could not check for updates</span>
        )}
      </p>
    </div>
  )
}
