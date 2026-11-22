// Find on the Family Tree tab (family-rollups-and-tree design-spec 8; schema
// 12). The house combobox: one `role="combobox"` input carries the only tab
// stop and every key handler; the list is `role="listbox"` of `div
// role="option"` rows chosen through `aria-activedescendant`, ids keyed on the
// row's index (security.md, the IDREF rule), with no tabIndex and no handler of
// their own; a press is read back on the list by the row's index. Escape is
// consumed at the element only while the list is open. The list renders inside
// the tab, never in a portal. It rides the tab's chunk and serves both views.

import { useId, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useAlphaCodes } from '../../lib/useAlphaCodes'
import { findMatches, type FindIndex, type FindRow } from '../../lib/familyTreeFind'
import { nameOf, type NamesState } from '../../lib/familyTreeNames'
import { FIND_LABEL, FIND_LIST_LABEL, FIND_NONE, LEVEL_WORDS } from '../../lib/familyTreeCopy'

export interface FamilyTreeFindProps {
  findIndex: FindIndex
  names: NamesState
  onChoose: (row: FindRow) => void
}

export function FamilyTreeFind({ findIndex, names, onChoose }: FamilyTreeFindProps) {
  const uid = useId()
  const listId = `${uid}-find-list`
  const optionId = (i: number) => `${uid}-find-opt-${i}`
  const codes = useAlphaCodes()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listRef = useRef<HTMLDivElement | null>(null)
  const rows = useMemo(() => findMatches(findIndex, query, names, codes), [findIndex, query, names, codes])
  const shown = open && query.trim() !== ''
  const act = shown && active >= 0 && active < rows.length ? active : -1

  function close() { setOpen(false); setActive(-1) }
  function choose(r: FindRow | undefined) {
    if (r === undefined) return
    close()
    setQuery('')
    onChoose(r)
  }

  return (
    <div className="sr-ft-find">
      <div className="sr-lfl-region-field sr-ft-find-field">
        <Search size={13} strokeWidth={2.2} className="sr-lfl-region-glyph" aria-hidden="true" />
        <input
          type="text"
          className="sr-lfl-region-input sr-input-16"
          role="combobox"
          aria-label={FIND_LABEL}
          aria-expanded={shown}
          aria-controls={shown ? listId : undefined}
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-activedescendant={act >= 0 ? optionId(act) : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder={FIND_LABEL}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setActive(0) }}
          onBlur={close}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (!open) { setOpen(true); setActive(0); return }
              setActive(Math.min(act + 1, rows.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (shown) setActive(Math.max(act - 1, 0))
            } else if (e.key === 'Enter') {
              if (!shown) return
              e.preventDefault()
              choose(rows[act >= 0 ? act : 0])
            } else if (e.key === 'Escape') {
              // Innermost layer first: consumed only while the list is open.
              if (shown) { e.stopPropagation(); close() }
            }
          }}
        />
      </div>
      {shown ? (
        <div
          ref={listRef}
          className="sr-lfl-region-list sr-ft-find-list"
          role="listbox"
          id={listId}
          aria-label={FIND_LIST_LABEL}
          onMouseDown={e => {
            // Focus never leaves the input; a row is chosen on press, read back by its index.
            e.preventDefault()
            const el = (e.target as Element).closest('[data-i]')
            if (el !== null && listRef.current !== null && listRef.current.contains(el)) choose(rows[Number(el.getAttribute('data-i'))])
          }}
        >
          {rows.map((r, i) => {
            const n = nameOf(r.level, r.common, r.scientific, names)
            return (
              <div
                key={i}
                id={optionId(i)}
                role="option"
                aria-selected={i === act}
                data-i={i}
                className={`sr-lfl-region-opt sr-ft-find-opt${i === act ? ' is-active' : ''}`}
              >
                <span className="sr-ft-find-main">
                  <span className={n.leadItalic ? 'is-sci' : undefined}>{n.lead}</span>
                  {n.alt !== null ? <span className={`sr-ft-find-sub${n.altItalic ? ' is-sci' : ''}`}>{n.alt}</span> : null}
                </span>
                <span className="sr-ft-find-kind">{LEVEL_WORDS[r.level]}</span>
              </div>
            )
          })}
          {rows.length === 0 ? <div className="sr-lfl-region-empty">{FIND_NONE}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
