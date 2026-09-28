// The place-name search field (Map Explorer's sidebars; the Targets tab's
// "Measure distances from" chooser). One component so the two cannot drift:
// submit-only (Enter or the Search button, never as you type), one request per
// press, the same miss line, and offline read as offline. The request and the
// validation of its answer live in `lib/placeSearch.ts`.
//
// TWO REGISTERS, ONE BEHAVIOUR. Without `hint` it renders Map Explorer's shipped
// markup, inline styles and all, unchanged by the extraction. With `hint` it
// renders the chooser's register (design-spec 2a): classed rather than inline,
// a hint line under the field that a miss replaces, an ALWAYS-MOUNTED alert
// region with a sequence-keyed child (a region created with its first message
// is not announced; ui.md), and focus kept in the field after a miss.

import { useId, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from './ui/Button'
import { classifyLiveError } from '../lib/offlineMessage'
import { PLACE_NOT_FOUND, PLACE_SEARCH_FAILED, searchPlace } from '../lib/placeSearch'

export interface AddressSearchProps {
  /** A hit: its coordinates and the query as typed, trimmed. */
  onLocate: (lat: number, lng: number, query: string) => void
  /** The chooser register's hint line; its presence selects that register. */
  hint?: string
  /** The line shown when the request fails for a reason other than offline. */
  failedMessage?: string
}

export function AddressSearch({ onLocate, hint, failedMessage = PLACE_SEARCH_FAILED }: AddressSearchProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorSeq, setErrorSeq] = useState(0)
  const inFlight = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const hintId = useId()
  const chooser = hint !== undefined

  function fail(message: string) {
    setError(message)
    setErrorSeq(s => s + 1)
    // A miss keeps the chooser open with focus in the field (design-spec 2a).
    if (chooser) inputRef.current?.focus()
  }

  async function handleSearch() {
    const q = query.trim()
    // One request per press: a press while one is outstanding sends nothing.
    if (!q || inFlight.current) return
    inFlight.current = true
    setLoading(true); setError('')
    try {
      const hit = await searchPlace(q)
      if (hit === null) { fail(PLACE_NOT_FOUND); return }
      onLocate(hit.lat, hit.lng, q)
      setQuery('')
    } catch (err) {
      // Offline geocode must read "you're offline", NOT a "no matches"/"failed"
      // message that conflates the two distinct states (FR-38).
      fail(classifyLiveError(err, { errorMessage: failedMessage }).message)
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }

  if (chooser) {
    const empty = !query.trim()
    return (
      <>
        <div className="sr-tg-apop-search">
          <input
            ref={inputRef}
            className="sr-input-16 sr-tg-apop-field"
            type="text"
            placeholder="Search by place name"
            aria-label="Search by place name"
            aria-describedby={error ? undefined : hintId}
            autoComplete="off"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSearch() } }}
          />
          {/* Native `disabled` only while the field is empty (focus is in the
              field then, never on the button); `aria-disabled` while a search
              runs, so a press does not throw focus to <body>. */}
          <Button
            type="button"
            className="sr-tg-apop-go"
            title="Search"
            aria-label="Search"
            disabled={empty}
            aria-disabled={loading ? true : undefined}
            onClick={() => { void handleSearch() }}
          >
            <Search size={14} strokeWidth={2} aria-hidden="true" />
          </Button>
        </div>
        <div className="sr-tg-apop-err" role="alert">
          {error ? <span key={errorSeq}>{error}</span> : null}
        </div>
        {error ? null : <div className="sr-tg-apop-hint" id={hintId}>{hint}</div>}
      </>
    )
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {/* .sr-input-16 sits on the <input> ITSELF (not the flex wrapper) so it
            out-ranks the inline fontSize below — the phone-tier iOS focus-zoom
            guard is inert anywhere else. Same on all nine sidebar controls. */}
        <input
          className="sr-input-16"
          type="text"
          placeholder="Search by place name"
          aria-label="Search by place name"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleSearch() }}
          style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', minWidth: 0 }}
        />
        <Button
          onClick={() => { void handleSearch() }}
          disabled={loading || !query.trim()}
          title="Search"
          aria-label="Search"
          style={{
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: loading || !query.trim() ? 'var(--sr-surface-subtle)' : 'var(--sr-accent)',
            color: loading || !query.trim() ? 'var(--sr-text-muted)' : 'var(--sr-on-accent)',
            border: '1.5px solid var(--sr-border)', borderRadius: 6,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >
          <Search size={14} strokeWidth={2} />
        </Button>
      </div>
      {error && <div role="alert" style={{ fontSize: '0.6875rem', color: 'var(--sr-error)', marginTop: 4 }}>{error}</div>}
    </div>
  )
}
