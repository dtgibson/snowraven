// The county picker (targets-tab FR-05, FR-06, FR-10; design-spec section 2).
//
// Its OWN `aria-activedescendant` combobox rather than `SpeciesCombobox`: that
// component's four-site identity guard would otherwise move to five, and its
// options are species with scientific names, not counties with counts and an
// unavailable state. The shape is the house one (ui.md, v1.0.21): the input is
// the control and the one tab stop inside the field besides the chevron; the
// options are plain `div role="option"` with no tabIndex and no per-option
// focus, and the active option is carried by `aria-activedescendant`.
//
// OPTION IDS ARE KEYED ON THE INDEX, never on a county name (security.md,
// v1.0.21): a name out of the user's backup can carry whitespace, which cannot
// resolve as an IDREF and would silently switch the announcement off.
//
// An unavailable county (FR-06) stays listed, `aria-disabled`, with its reason
// on a second line; it cannot be chosen by click or by Enter.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { Button } from '../ui/Button'
import { US_STATE_NAMES } from '../../lib/countyBoundaries'
import type { CountyChoice } from '../../lib/targets/targetsCounties'
import {
  COUNTY_CHEVRON_LABEL, COUNTY_LABEL, COUNTY_LIST_LABEL, COUNTY_NO_MATCH, COUNTY_PLACEHOLDER, checklistCount,
} from '../../lib/targets/targetsCopy'

interface Props {
  choices: readonly CountyChoice[]
  selected: CountyChoice | null
  onSelect: (choice: CountyChoice) => void
}

/** The text a query is matched against: the label and the full state name. */
function haystack(c: CountyChoice): string {
  const st = c.label.slice(c.label.lastIndexOf(', ') + 2)
  const full = Object.hasOwn(US_STATE_NAMES, st) ? US_STATE_NAMES[st] : ''
  return `${c.label} ${full}`.toLowerCase()
}

export function TargetsCountyPicker({ choices, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const uid = useId()
  const listId = `${uid}-list`
  const optionId = (i: number) => `${uid}-opt-${i}`

  const haystacks = useMemo(() => choices.map(haystack), [choices])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return choices.map((c, i) => ({ c, i }))
    const out: { c: CountyChoice; i: number }[] = []
    for (let i = 0; i < choices.length; i++) if (haystacks[i].includes(q)) out.push({ c: choices[i], i })
    return out
  }, [choices, haystacks, query])

  // Close on an outside press.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) { setOpen(false); setActive(-1); setQuery('') }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  // Keep the active option in view.
  useEffect(() => {
    if (!open || active < 0) return
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' })
    // optionId derives from the stable uid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open])

  const openList = () => {
    setOpen(true)
    setQuery('')
    const at = selected ? shownIndexOf(choices.map((c, i) => ({ c, i })), selected) : -1
    setActive(at)
  }
  const close = () => { setOpen(false); setActive(-1); setQuery('') }
  const choose = (c: CountyChoice | undefined) => {
    if (!c || c.unavailableReason !== null) return
    onSelect(c)
    close()
  }

  return (
    <div ref={rootRef} className="sr-tg-combo">
      <div className="sr-tg-combo-field">
        <Search size={14} strokeWidth={2} aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          className="sr-tg-combo-input sr-input-16"
          role="combobox"
          aria-label={COUNTY_LABEL}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-activedescendant={open && active >= 0 && active < shown.length ? optionId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={COUNTY_PLACEHOLDER}
          value={open ? query : (selected?.label ?? '')}
          onFocus={() => { if (!open) openList() }}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (!open) { openList(); return }
              setActive(i => Math.min(i + 1, shown.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive(i => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              if (!open) return
              e.preventDefault()
              const target = active >= 0 ? shown[active]?.c : shown.find(s => s.c.unavailableReason === null)?.c
              choose(target)
            } else if (e.key === 'Escape') {
              // Innermost layer first: consumed only while the list is open.
              if (open) { e.stopPropagation(); close() }
            } else if (e.key === 'Tab') {
              close()
            }
          }}
        />
        {selected && !open ? <span className="sr-tg-combo-count" aria-hidden="true">{checklistCount(selected.checklists)}</span> : null}
        <Button
          type="button"
          className="sr-tg-combo-chevron"
          aria-label={COUNTY_CHEVRON_LABEL}
          aria-expanded={open}
          onClick={() => { if (open) close(); else { openList(); inputRef.current?.focus() } }}
        >
          <ChevronDown size={14} strokeWidth={2.2} aria-hidden="true" />
        </Button>
      </div>
      {open ? (
        <div className="sr-tg-combo-list" role="listbox" id={listId} aria-label={COUNTY_LIST_LABEL}>
          {shown.length === 0 ? (
            <div className="sr-tg-combo-empty">{COUNTY_NO_MATCH}</div>
          ) : shown.map(({ c }, i) => (
            <div
              key={i}
              id={optionId(i)}
              role="option"
              aria-selected={selected !== null && c.key === selected.key}
              aria-disabled={c.unavailableReason !== null ? true : undefined}
              className={`sr-tg-combo-opt${i === active ? ' is-active' : ''}`}
              onMouseDown={e => { e.preventDefault(); choose(c) }}
            >
              <span className="sr-tg-combo-opt-name">
                {c.label}
                {c.unavailableReason !== null ? <span className="sr-tg-combo-opt-why">{c.unavailableReason}</span> : null}
              </span>
              <span className="sr-tg-combo-opt-count">{checklistCount(c.checklists)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function shownIndexOf(shown: readonly { c: CountyChoice; i: number }[], selected: CountyChoice): number {
  for (let k = 0; k < shown.length; k++) if (shown[k].c.key === selected.key) return k
  return -1
}
