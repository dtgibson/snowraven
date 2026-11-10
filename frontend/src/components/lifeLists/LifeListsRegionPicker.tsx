// The Life Lists Region control (life-list-region-filter FR-07 to FR-09;
// design-spec "The control strip"; schema 4.4).
//
// Its own `aria-activedescendant` combobox, the Targets county picker's family
// (ui.md, v1.0.21): the input is the control and the one tab stop in the field
// besides the chevron; options are plain `div role="option"` with no tabIndex
// and no per-option handler (the listbox owns the one mousedown handler and
// reads the option's INDEX back from `data-i`), and the active option is
// carried by `aria-activedescendant`.
//
// EVERY ID AND IDREF IS KEYED ON AN INDEX over the flattened shown list, with a
// `useId()` prefix, never on a region's text (security.md, v1.0.21): a county
// out of the user's backup can carry whitespace, which cannot resolve as an
// IDREF. A group heading's id is keyed on the closed level literal.
//
// The first row is always Everywhere; then up to three groups in the fixed
// order countries, states and provinces, counties, each omitted when nothing
// in it is shown. Typing filters by the choice's label (schema S14: one
// substring test per choice per keystroke over labels lowercased once per
// epoch). With no choice in the backup the input and chevron take native
// `disabled` (FR-08): nothing needs reading at the control (ui.md).

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Button } from '../ui/Button'
import type { RegionChoice, RegionChoices, RegionLevel, RegionRef } from '../../lib/lifeListsRegion'
import {
  EVERYWHERE_LABEL, REGION_CHEVRON_LABEL, REGION_CONTROL_LABEL, REGION_GROUP_LABELS, REGION_LIST_LABEL,
  REGION_NO_MATCH, REGION_PLACEHOLDER,
} from '../../lib/lifeListsCopy'

export interface LifeListsRegionPickerProps {
  choices: RegionChoices
  /** The EFFECTIVE region: a choice's own `region` object, or null for Everywhere. */
  selected: RegionRef | null
  onSelect: (region: RegionRef | null) => void
}

const LEVELS: readonly RegionLevel[] = ['country', 'state', 'county']

/** One shown row: Everywhere (choice null) or a choice under its level. */
interface Shown { readonly choice: RegionChoice | null; readonly level: RegionLevel | null }
const EVERYWHERE: Shown = { choice: null, level: null }

function groupOf(choices: RegionChoices, level: RegionLevel): readonly RegionChoice[] {
  return level === 'country' ? choices.countries : level === 'state' ? choices.states : choices.counties
}

export function LifeListsRegionPicker({ choices, selected, onSelect }: LifeListsRegionPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const labelId = `${uid}-region-label`
  const listId = `${uid}-region-list`
  const optionId = (i: number) => `${uid}-region-opt-${i}`
  const disabled = choices.total === 0

  // The haystacks, once per epoch (the choices only change with the files).
  const haystacks = useMemo(() => {
    const out = {} as Record<RegionLevel, string[]>
    for (const level of LEVELS) out[level] = groupOf(choices, level).map(c => c.label.toLowerCase())
    return out
  }, [choices])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out: Shown[] = [EVERYWHERE]
    for (const level of LEVELS) {
      const group = groupOf(choices, level)
      const hay = haystacks[level]
      for (let i = 0; i < group.length; i++) if (!q || hay[i].includes(q)) out.push({ choice: group[i], level })
    }
    return out
  }, [choices, haystacks, query])

  const selectedLabel = useMemo(() => {
    if (selected === null) return EVERYWHERE_LABEL
    const group = groupOf(choices, selected.level)
    for (let i = 0; i < group.length; i++) if (group[i].region === selected) return group[i].label
    return EVERYWHERE_LABEL
  }, [choices, selected])

  const act = open && shown.length > 0 ? Math.min(Math.max(active, 0), shown.length - 1) : -1

  // Close on a press outside the control, only while it is open.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // Keep the active option in view, scrolling the LISTBOX only: an option's
  // `scrollIntoView` would also scroll the page when the list runs past the
  // viewport (design-spec, Interaction Notes).
  useEffect(() => {
    const list = listRef.current
    if (!open || act < 0 || list === null) return
    const opt = document.getElementById(optionId(act))
    if (opt === null) return
    const top = opt.offsetTop
    const bottom = top + opt.offsetHeight
    if (top < list.scrollTop) list.scrollTop = Math.max(0, top - 4)
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight + 4
    // optionId derives from the stable uid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [act, open])

  function openList() {
    if (disabled) return
    setOpen(true)
    setQuery('')
    let at = 0
    if (selected !== null) {
      // Over the unfiltered list: Everywhere, then the groups in order.
      let k = 1
      for (const level of LEVELS) {
        const group = groupOf(choices, level)
        for (let i = 0; i < group.length; i++, k++) if (group[i].region === selected) at = k
      }
    }
    setActive(at)
  }
  function close() { setOpen(false); setActive(-1); setQuery('') }
  function choose(item: Shown | undefined) {
    if (item === undefined) return
    close()
    onSelect(item.choice === null ? null : item.choice.region)
  }

  // The flattened list split into its groups, each item carrying its index.
  const groups: { level: RegionLevel; items: { item: Shown; i: number }[] }[] = []
  for (let i = 1; i < shown.length; i++) {
    const item = shown[i]
    const last = groups.length > 0 ? groups[groups.length - 1] : null
    if (last === null || last.level !== item.level) groups.push({ level: item.level!, items: [{ item, i }] })
    else last.items.push({ item, i })
  }

  const option = (item: Shown, i: number) => {
    const isSel = item.choice === null ? selected === null : item.choice.region === selected
    return (
      <div
        key={i}
        id={optionId(i)}
        role="option"
        aria-selected={isSel}
        data-i={i}
        className={`sr-lfl-region-opt${item.choice === null ? ' sr-lfl-region-opt--all' : ''}${i === act ? ' is-active' : ''}`}
      >
        <span className="sr-lfl-region-opt-name">{item.choice === null ? EVERYWHERE_LABEL : item.choice.label}</span>
        {isSel ? <Check size={13} strokeWidth={2.5} className="sr-lfl-region-opt-check" aria-hidden="true" /> : null}
      </div>
    )
  }

  return (
    <div className="sr-lfl-region-row">
      <span className="sr-ctl-label sr-lfl-label" id={labelId}>{REGION_CONTROL_LABEL}</span>
      <div ref={rootRef} className="sr-lfl-region">
        <div className={`sr-lfl-region-field${disabled ? ' is-disabled' : ''}`}>
          <Search size={13} strokeWidth={2.2} className="sr-lfl-region-glyph" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="sr-lfl-region-input sr-input-16"
            role="combobox"
            aria-labelledby={labelId}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-activedescendant={act >= 0 ? optionId(act) : undefined}
            autoComplete="off"
            spellCheck={false}
            placeholder={REGION_PLACEHOLDER}
            disabled={disabled}
            value={open ? query : selectedLabel}
            onFocus={() => { if (!open) openList() }}
            onChange={e => { setQuery(e.target.value); setOpen(true); setActive(1) }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (!open) { openList(); return }
                setActive(Math.min(act + 1, shown.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                if (open) setActive(Math.max(act - 1, 0))
              } else if (e.key === 'Home' && open) {
                e.preventDefault()
                setActive(0)
              } else if (e.key === 'End' && open) {
                e.preventDefault()
                setActive(shown.length - 1)
              } else if (e.key === 'Enter') {
                if (!open) return
                e.preventDefault()
                choose(shown[act >= 0 ? act : (shown.length > 1 ? 1 : 0)])
              } else if (e.key === 'Escape') {
                // Innermost layer first: consumed only while the list is open.
                if (open) { e.stopPropagation(); close() }
              } else if (e.key === 'Tab') {
                close()
              }
            }}
          />
          <Button
            type="button"
            className="sr-lfl-region-chev sr-touch-target"
            aria-label={REGION_CHEVRON_LABEL}
            aria-expanded={open}
            disabled={disabled}
            onClick={() => {
              if (open) { close(); return }
              openList()
              inputRef.current?.focus()
            }}
          >
            <ChevronDown size={14} strokeWidth={2.2} className="sr-lfl-region-chev-glyph" aria-hidden="true" />
          </Button>
        </div>
        {open ? (
          <div
            ref={listRef}
            className="sr-lfl-region-list"
            role="listbox"
            id={listId}
            aria-label={REGION_LIST_LABEL}
            onMouseDown={e => {
              // Focus never leaves the input (FR-09); an option is chosen on
              // press, read back by its index.
              e.preventDefault()
              const el = (e.target as Element).closest('[data-i]')
              if (el !== null && listRef.current !== null && listRef.current.contains(el)) choose(shown[Number(el.getAttribute('data-i'))])
            }}
          >
            {option(EVERYWHERE, 0)}
            {groups.map(g => (
              <div key={g.level} className="sr-lfl-region-group" role="group" aria-labelledby={`${uid}-region-grp-${g.level}`}>
                <div className="sr-lfl-region-grp" id={`${uid}-region-grp-${g.level}`}>{REGION_GROUP_LABELS[g.level]}</div>
                {g.items.map(({ item, i }) => option(item, i))}
              </div>
            ))}
            {shown.length === 1 ? <div className="sr-lfl-region-empty">{REGION_NO_MATCH}</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
