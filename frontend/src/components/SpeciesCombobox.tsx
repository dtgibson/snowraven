// Shared searchable species combobox — the type-to-filter picker lifted out of
// SpeciesDetail (its reference implementation) so the Calendar tab can reuse the
// exact same feel. Typing narrows a scrollable list (case-insensitive substring
// over common AND scientific name), Arrow/Enter/Escape/Tab work, active option
// scrollIntoView, outside-click closes. An optional "All species" clearing row
// (allLabel) prepends a synthetic first entry that calls onChange(null) and is
// reachable in the arrow sequence.
//
// The combobox owns ONLY the ephemeral picker state (query / open / active index);
// value + onChange are lifted, so ALL selection side-effects (SpeciesDetail's
// selectSpecies reset, the Calendar's setPopup(null)) live in the parent's
// onChange. listbox/option ids are useId()-namespaced so two instances on one page
// can't collide.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'
import { matchesSpeciesQuery, normalizeSpeciesQuery } from '../lib/speciesMatch'

export interface SpeciesComboboxOption {
  name: string
  sciName?: string
}

interface SpeciesComboboxProps {
  options: SpeciesComboboxOption[]        // already sorted upstream
  value: string | null                     // selected name; null/'' = none
  onChange: (name: string | null) => void  // null when "All / clear" chosen
  allLabel?: string                         // e.g. "All species" — renders a clearing row at top
  placeholder?: string
  ariaLabel: string
  size?: 'sm' | 'md' | 'panel'              // Calendar ~30px; SpeciesDetail 40px; Map Explorer filter panel 34px (the SELECT_STYLE register)
  className?: string                        // lands on the <input> (carries .sr-input-16 — the iOS-zoom guard must sit on the input, not the wrapper)
}

// A row in the rendered listbox: either the synthetic "all/clear" row, or a species.
type Row =
  | { kind: 'all'; label: string }
  | { kind: 'species'; name: string; sciName?: string }

export function SpeciesCombobox({
  options, value, onChange, allLabel, placeholder, ariaLabel, size = 'md', className,
}: SpeciesComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const rootRef = useRef<HTMLDivElement>(null)

  const uid = useId()
  const listboxId = `${uid}-listbox`
  const optionId = (idx: number) => `${uid}-option-${idx}`

  // Case-insensitive substring filter over common AND scientific name (the `?? ''`
  // fallback means a missing sci name simply never matches).
  //
  // THE PREDICATE ITSELF LIVES IN lib/speciesMatch.ts NOW, and this component
  // imports it rather than owning it (command-palette FR-23). It was EXTRACTED
  // with its behaviour preserved exactly -- same trim().toLowerCase(), same OR,
  // same `?? ''` -- so that the palette and the three shipped pickers cannot
  // answer the same query two ways. If this component's tests ever go red on a
  // change to that module, the change is wrong, not the tests. The query is
  // normalized ONCE per keystroke rather than once per row, which is why
  // normalization and matching are two functions there.
  const filtered = useMemo<SpeciesComboboxOption[]>(() => {
    const q = normalizeSpeciesQuery(query)
    if (!q) return options
    return options.filter(o => matchesSpeciesQuery(o, q))
  }, [options, query])

  // The rendered rows: the synthetic "all/clear" row (when allLabel is set) always
  // sits first and is NOT filtered out, so the user can always clear.
  const rows = useMemo<Row[]>(() => {
    const speciesRows: Row[] = filtered.map(o => ({ kind: 'species', name: o.name, sciName: o.sciName }))
    return allLabel != null ? [{ kind: 'all', label: allLabel }, ...speciesRows] : speciesRows
  }, [filtered, allLabel])

  // Close on outside click.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setActiveIdx(-1)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (activeIdx >= 0) {
      const el = document.getElementById(optionId(activeIdx))
      el?.scrollIntoView?.({ block: 'nearest' })
    }
    // optionId is derived from the stable uid; activeIdx is the only real dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx])

  // The value the input shows: the live query while open, else the current selection.
  const isNone = value == null || value === ''
  const displayValue = open ? query : (value ?? '')

  const chooseRow = (row: Row) => {
    if (row.kind === 'all') onChange(null)
    else onChange(row.name)
    setQuery('')
    setOpen(false)
    setActiveIdx(-1)
  }

  // Sizing registers. `panel` maps EXACTLY onto the Map Explorer sidebar's
  // SELECT_STYLE numbers (34px box, 0.8125rem text, radius 6, full panel width)
  // so the picker sits at the register of its neighbouring selects. The `sm`
  // and `md` values are deliberately untouched, so Species Detail and the
  // Calendar render exactly as before this variant existed.
  const height = size === 'panel' ? 34 : size === 'sm' ? 30 : 40
  const fontSize = size === 'panel' ? '0.8125rem' : size === 'sm' ? '0.75rem' : '0.875rem'
  const iconLeft = size === 'panel' ? 9 : size === 'sm' ? 8 : 11
  const iconSize = size === 'panel' ? 14 : size === 'sm' ? 13 : 15
  const padLeft = size === 'panel' ? 30 : size === 'sm' ? 28 : 38
  const radius = size === 'panel' ? 6 : 8

  return (
    <div ref={rootRef} style={{ position: 'relative', minWidth: 0, maxWidth: size === 'sm' ? 220 : undefined, zIndex: 20 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: iconLeft, top: '50%', transform: 'translateY(-50%)', color: 'var(--sr-text-muted)', pointerEvents: 'none', display: 'flex' }}>
          <Search size={iconSize} strokeWidth={2} aria-hidden />
        </span>
        <input
          type="text"
          className={className}
          value={displayValue}
          placeholder={placeholder}
          onChange={e => {
            setQuery(e.target.value)
            setActiveIdx(-1)
            if (!open) setOpen(true)
          }}
          onFocus={e => {
            setActiveIdx(-1)
            setOpen(true)
            // Select any in-progress text so typing replaces it for a fresh search.
            e.currentTarget.select()
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              // Consume the press ONLY while the listbox is open, so an outer
              // Escape layer (the Map Explorer filter sheet / fullscreen exit,
              // both bubble-phase document listeners) is not dismissed by the
              // same press — innermost layer first (.claude/rules/ui.md). With
              // the listbox CLOSED the event must keep bubbling: Escape still
              // closes the sheet / exits fullscreen, which is shipped intent.
              // Species Detail and the Calendar have no outer Escape layers,
              // so their behavior is unchanged either way.
              if (open) e.stopPropagation()
              setOpen(false); setActiveIdx(-1)
            }
            if (e.key === 'Tab') { setOpen(false); setActiveIdx(-1) }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (!open) setOpen(true)
              setActiveIdx(i => Math.min(i + 1, rows.length - 1))
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActiveIdx(i => Math.max(i - 1, -1))
            }
            if (e.key === 'Enter' && open) {
              e.preventDefault()
              // With no explicitly-active option, a typed query commits to its
              // FIRST MATCH — never the synthetic "all/clear" row, which sits at
              // rows[0] when allLabel is set (a bare rows[0] fallback would reset
              // the filter instead of selecting what the user typed). An empty
              // query keeps the plain first-row fallback; a query with zero
              // matches is a no-op (Enter never silently resets to All).
              const fallback = query.trim() === '' ? rows[0] : rows.find(r => r.kind === 'species')
              const target = activeIdx >= 0 ? rows[activeIdx] : fallback
              if (target) chooseRow(target)
            }
          }}
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-activedescendant={open && activeIdx >= 0 ? optionId(activeIdx) : undefined}
          style={{
            width: '100%', height, padding: `0 34px 0 ${padLeft}px`,
            border: `1.5px solid ${open ? 'var(--sr-accent)' : 'var(--sr-border-input)'}`,
            borderRadius: open ? `${radius}px ${radius}px 0 0` : radius,
            borderBottomColor: open ? 'transparent' : undefined,
            fontSize, fontWeight: !isNone && !open ? 500 : 400,
            fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)',
            transition: 'border-color 0.15s', minWidth: 0,
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="Toggle species list"
          onClick={() => setOpen(o => !o)}
          style={{
            position: 'absolute', right: 7, top: '50%',
            transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
            transition: 'transform 0.15s', cursor: 'pointer',
            color: 'var(--sr-text-muted)', display: 'flex',
            background: 'transparent', border: 'none', padding: 4,
          }}
        >
          <ChevronDown size={16} strokeWidth={2} aria-hidden />
        </button>
      </div>

      {open && (
        /* sr-combobox-list carries the shared 140ms ease-out entrance motion
           (globals.css), deliberately on ALL sizes so the three pickers cannot
           drift; the global reduced-motion rule makes it an instant appear.
           Close stays instant removal, no exit animation. */
        <div
          className="sr-combobox-list"
          role="listbox"
          id={listboxId}
          aria-label={ariaLabel}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            background: 'var(--sr-surface)',
            border: '1.5px solid var(--sr-accent)',
            borderTop: 'none', borderRadius: `0 0 ${radius}px ${radius}px`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
            maxHeight: 260, overflowY: 'auto', zIndex: 1200,
          }}
        >
          {rows.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
              No species match this search.
            </div>
          ) : (
            rows.map((row, idx) => {
              const isSelected = row.kind === 'all' ? isNone : row.name === value
              const isActive = idx === activeIdx
              return (
                <div
                  key={row.kind === 'all' ? '__all__' : row.name}
                  id={optionId(idx)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => chooseRow(row)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 14px', cursor: 'pointer',
                    background: isActive ? 'var(--sr-accent-bg-hover)' : isSelected ? 'var(--sr-accent-bg)' : 'transparent',
                    outline: isActive ? '2px solid var(--sr-accent)' : 'none',
                    outlineOffset: '-2px',
                  }}
                  onMouseEnter={e => { if (!isSelected && !isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--sr-surface-subtle)' }}
                  onMouseLeave={e => { if (!isSelected && !isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                >
                  <span style={{ width: 16, flexShrink: 0, color: 'var(--sr-accent)', display: 'flex' }}>
                    {isSelected && <Check size={13} strokeWidth={3} aria-hidden />}
                  </span>
                  <span
                    className="sr-truncate"
                    style={{
                      fontSize: '0.84375rem',
                      fontWeight: 500,
                      fontStyle: row.kind === 'all' ? 'italic' : 'normal',
                      color: isSelected ? 'var(--sr-accent)' : 'var(--sr-text)',
                      flex: 1,
                    }}
                  >
                    {row.kind === 'all' ? row.label : row.name}
                  </span>
                  {row.kind === 'species' && row.sciName && (
                    /* maxWidth caps the SECONDARY text's claim on the row. The
                       common name's flex-basis is 0, so without the cap flex
                       serves this span its full intrinsic width FIRST and the
                       primary name gets only the leftover — in a narrow listbox
                       (the Map Explorer panel, any picker at phone width) the
                       scientific name then crushes the common name toward a
                       zero-width box (measured 0px at 200% text scale). The
                       percentage resolves against the row, so the guarantee
                       (name keeps the majority) holds at every width and text
                       scale; both spans keep .sr-truncate, whose overflow
                       clipping is what makes crowding truncate rather than
                       paint one text over the other. */
                    <span className="sr-truncate" style={{ fontSize: '0.6875rem', fontStyle: 'italic', color: 'var(--sr-text-muted)', flex: '0 1 auto', maxWidth: '40%', textAlign: 'right' }}>
                      {row.sciName}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
