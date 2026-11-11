// The Hotspot Reports location picker (FR-18 to FR-25; schema 3.4;
// design-spec "The location picker").
//
// A member of the house `aria-activedescendant` combobox family
// (`TargetsCountyPicker`, `LifeListsRegionPicker`), at the 40px hero register:
// the input is the combobox and one tab stop, the chevron `Button` the other;
// options are plain `div role="option"` with no tabIndex and no per-option
// handler (the listbox owns one mousedown handler and reads the option's INDEX
// back from `data-i`); the active option is carried by `aria-activedescendant`.
//
// EVERY ID AND IDREF IS KEYED ON AN INDEX over the rendered list, with a
// `useId()` prefix, never on a name, a place or a Location ID (security.md,
// v1.0.21): a location name out of the user's backup can carry whitespace,
// which cannot resolve as an IDREF. A Location ID shown for a namesake is text.
//
// The rendered rows are the Overview row, then one window of at most
// PICKER_OPTION_CAP locations (`filterLocations`), then one non-option line when
// more match than are drawn, or the no-match line. The window is a memo on the
// index, the query and the selection; with an empty query it slides so a
// selected location ranked beyond the cap is drawn and can be the active row on
// open (FR-23). The kind marks are computed for the rendered rows only.

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Button } from '../ui/Button'
import type { HotspotResolution } from '../../lib/hotspotSet'
import type { LocationIndex } from '../../lib/hotspotReports'
import { filterLocations, PICKER_QUERY_MAX_CHARS } from '../../lib/hotspotReportsPicker'
import { kindOf } from '../../lib/hotspotReportsKind'
import {
  NO_MATCH, OVERVIEW_LABEL, PICKER_CHEVRON_LABEL, PICKER_LABEL, PICKER_LIST_LABEL, PICKER_PLACEHOLDER,
  checklistCountLabel, displayName, narrowingLine, overviewMeta,
} from '../../lib/hotspotReportsCopy'
import { LocationMeta, LocationName, MetaLine } from './HotspotReportsParts'

export interface HotspotReportsPickerProps {
  index: LocationIndex
  /** The selected location's ordinal, or null for the overview. */
  selectedOrd: number | null
  onSelect: (ord: number | null) => void
  resolution: HotspotResolution
}

export function HotspotReportsPicker({ index, selectedOrd, onSelect, resolution }: HotspotReportsPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const uid = useId()
  const labelId = `${uid}-label`
  const listId = `${uid}-list`
  const optionId = (i: number) => `${uid}-opt-${i}`
  const L = index.locations.length
  const disabled = L === 0

  const win = useMemo(() => filterLocations(index, open ? query : '', selectedOrd), [index, open, query, selectedOrd])
  // Row 0 is the Overview choice (ord null); rows 1.. are the window.
  const rowCount = win.ords.length + 1
  const act = open ? Math.min(active, rowCount - 1) : -1

  const selectedLabel = selectedOrd === null || selectedOrd >= L
    ? OVERVIEW_LABEL
    : displayName(index.locations[selectedOrd].name, index.locations[selectedOrd].truncated) || OVERVIEW_LABEL

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
  // `scrollIntoView` would also scroll the page (design-spec, Interaction Notes).
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

  /** Open with the query cleared and the selected row active (Overview when
   *  nothing is selected), wherever that location sorts (FR-23). */
  function openList() {
    if (disabled) return
    setOpen(true)
    setQuery('')
    if (selectedOrd === null) { setActive(0); return }
    const w = filterLocations(index, '', selectedOrd)
    let at = 0
    for (let i = 0; i < w.ords.length; i++) if (w.ords[i] === selectedOrd) { at = i + 1; break }
    setActive(at)
  }
  function close() { setOpen(false); setActive(-1); setQuery('') }
  function choose(row: number) {
    if (row < 0 || row >= rowCount) return
    close()
    onSelect(row === 0 ? null : win.ords[row - 1])
  }

  const option = (row: number) => {
    const ord = row === 0 ? null : win.ords[row - 1]
    const isSel = ord === selectedOrd
    const rec = ord === null ? null : index.locations[ord]
    return (
      <div
        key={row}
        id={optionId(row)}
        role="option"
        aria-selected={isSel}
        data-i={row}
        className={`sr-hsr-opt${ord === null ? ' sr-hsr-opt--all' : ''}${row === act ? ' is-active' : ''}`}
      >
        <span className="sr-hsr-opt-main">
          {rec === null ? (
            <>
              <span className="sr-hsr-opt-name">{OVERVIEW_LABEL}</span>
              <MetaLine items={[overviewMeta(L)]} />
            </>
          ) : (
            <>
              <span className="sr-hsr-opt-name"><LocationName rec={rec} /></span>
              <LocationMeta
                rec={rec}
                kind={kindOf(rec, resolution)}
                showId={index.showId[rec.ord] === 1}
                extra={checklistCountLabel(index.checklistCount[rec.ord])}
              />
            </>
          )}
        </span>
        {isSel ? <Check size={13} strokeWidth={2.5} className="sr-hsr-opt-check" aria-hidden="true" /> : null}
      </div>
    )
  }

  const rows: number[] = []
  for (let i = 0; i < rowCount; i++) rows.push(i)

  return (
    <div className="sr-hsr-pickrow">
      <span className="sr-hsr-label sr-ctl-label" id={labelId}>{PICKER_LABEL}</span>
      <div ref={rootRef} className="sr-hsr-picker">
        <div className={`sr-hsr-field${disabled ? ' is-disabled' : ''}`}>
          <Search size={15} strokeWidth={2.2} className="sr-hsr-field-glyph" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            className="sr-hsr-input sr-input-16"
            role="combobox"
            aria-labelledby={labelId}
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-activedescendant={act >= 0 ? optionId(act) : undefined}
            autoComplete="off"
            spellCheck={false}
            maxLength={PICKER_QUERY_MAX_CHARS}
            placeholder={PICKER_PLACEHOLDER}
            disabled={disabled}
            value={open ? query : selectedLabel}
            onFocus={() => { if (!open) openList() }}
            onMouseDown={() => { if (!open && document.activeElement === inputRef.current) openList() }}
            onChange={e => {
              const q = e.target.value
              setQuery(q)
              setOpen(true)
              const w = filterLocations(index, q, selectedOrd)
              setActive(q.trim() === '' ? 0 : w.ords.length > 0 ? 1 : -1)
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (!open) { openList(); return }
                setActive(Math.min(act + 1, rowCount - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                if (!open) { openList(); return }
                setActive(Math.max(act - 1, 0))
              } else if (e.key === 'Home' && open) {
                e.preventDefault()
                setActive(0)
              } else if (e.key === 'End' && open) {
                e.preventDefault()
                setActive(rowCount - 1)
              } else if (e.key === 'Enter') {
                if (!open) return
                e.preventDefault()
                if (act >= 0) choose(act)
              } else if (e.key === 'Escape') {
                // Innermost layer first: consumed only while the list is open.
                if (open) { e.preventDefault(); e.stopPropagation(); close() }
              } else if (e.key === 'Tab') {
                close()
              }
            }}
          />
          <Button
            type="button"
            className="sr-hsr-chev sr-touch-target"
            aria-label={PICKER_CHEVRON_LABEL}
            aria-expanded={open}
            disabled={disabled}
            onClick={() => {
              if (open) { close(); return }
              openList()
              inputRef.current?.focus()
            }}
          >
            <ChevronDown size={15} strokeWidth={2.2} className="sr-hsr-chev-glyph" aria-hidden="true" />
          </Button>
        </div>
        {open ? (
          <div
            ref={listRef}
            className="sr-hsr-list"
            role="listbox"
            id={listId}
            aria-label={PICKER_LIST_LABEL}
            onMouseDown={e => {
              // Focus never leaves the input; an option is chosen on press,
              // read back by its index.
              e.preventDefault()
              const el = (e.target as Element).closest('[data-i]')
              if (el !== null && listRef.current !== null && listRef.current.contains(el)) choose(Number(el.getAttribute('data-i')))
            }}
          >
            {rows.map(option)}
            {win.matches === 0
              ? <div className="sr-hsr-nomatch">{NO_MATCH}</div>
              : win.matches > win.ords.length
                ? <div className="sr-hsr-more">{narrowingLine(win.ords.length, win.matches)}</div>
                : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
