import { useState, useCallback } from 'react'
import { Bird, Search, Loader2, ClipboardCopy, Check, AlertCircle } from 'lucide-react'

type AppState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; formatted: string }
  | { status: 'error'; message: string }

function extractChecklistId(raw: string): string {
  const s = raw.trim().replace(/\/+$/, '').split('?')[0]
  return s.includes('/') ? (s.split('/').pop() ?? s) : s
}

function isValidId(id: string): boolean {
  return /^S\d+$/.test(id)
}

export default function App() {
  const [input, setInput] = useState('')
  const [state, setState] = useState<AppState>({ status: 'idle' })
  const [copied, setCopied] = useState(false)

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
      setState({ status: 'success', formatted: data.formatted })
    } catch {
      setState({ status: 'error', message: 'Could not reach the server. Is the backend running?' })
    }
  }, [input])

  const handleCopy = async () => {
    if (state.status !== 'success') return
    try {
      await navigator.clipboard.writeText(state.formatted)
    } catch {
      const el = document.getElementById('output-pre')
      if (el) {
        const range = document.createRange()
        range.selectNode(el)
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isLoading = state.status === 'loading'
  const hasError = state.status === 'error'
  const hasResult = state.status === 'success'

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '64px 24px 80px',
      fontFamily: 'var(--font-sans)',
      color: '#0F1117',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Bird size={30} strokeWidth={1.75} style={{ color: '#2D8653' }} />
        <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.6px' }}>
          Snow<span style={{ color: '#2D8653' }}>Raven</span>
        </span>
      </div>
      <p style={{ fontSize: 14, color: '#71717A', marginBottom: 40 }}>
        Weather for your eBird checklists
      </p>

      {/* Card */}
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

      <p style={{ marginTop: 32, fontSize: 12, color: '#b0b0b8' }}>
        SnowRaven · self-hosted weather for birders
      </p>
    </div>
  )
}
