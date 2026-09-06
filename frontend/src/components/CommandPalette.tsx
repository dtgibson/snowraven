// The command palette: a modal search overlay over the app's destinations and
// the species in the user's own eBird backup (feature: command-palette).
//
// IT OWNS NOTHING AND DERIVES EVERYTHING. Destinations are `App.tsx`'s own
// `navItems` -- `visibleTabs(tabLayout)` labelled from `TAB_LABELS` and drawn
// with `TAB_ICONS`, in the saved order with hidden tabs already filtered and
// Settings already appended -- so there is no destination list in this file at
// all, a destination added in a future release appears here with no
// registration step, and the order cannot drift from the navigation's (FR-16 to
// FR-18). Species come from the shared `loadEbirdObservations()` parse. Nothing
// is fetched, nothing is persisted, and no cache is created (FR-22, FR-55).
//
// ── FOCUS CONTAINMENT: `containOutsideFocus` STAYS OFF, and both reasons are
//    load-bearing rather than one reason stated twice.
//
// 1. THE MARKUP MAKES THE KEYDOWN ARM'S PREDICTION CORRECT BY CONSTRUCTION.
//    `useFocusTrap`'s `focusin` arm exists because a keydown-only trap PREDICTS
//    the engine's tab order, and WebKit's default tab mode -- what the shipped
//    Mac, iPhone and iPad apps run -- visits only explicitly-`tabindex`ed
//    elements, native form controls and `<summary>`. This panel's only
//    focusables are a native `<input>` (visited) and one `<button>` carrying a
//    literal `tabIndex={0}` (visited). The `role="option"` rows carry no
//    `tabindex`, so `FOCUSABLE_SELECTOR`'s `[tabindex]:not([tabindex="-1"])`
//    clause does not match them and they are in NEITHER list. The prediction and
//    the engine agree.
//
// 2. TURNING IT ON WOULD BREAK FR-12. The `focusin` arm pulls focus back into an
//    overlay that is about to unmount, and focus then drops to `<body>` -- the
//    measured F061 defect in `NavMoreSheet`'s own header. `App.tsx` runs the
//    restore in a post-commit effect anyway, but the option would still buy
//    nothing here and cost a working close path.
//
// THE COROLLARY IS THE REQUIREMENT: adding any focusable to this panel without a
// literal `tabIndex={0}` silently reopens the v1.0.15 hole. QA-15's source
// assertion is the guard and it is not optional. One further constraint follows
// from the same measurement: THIS PANEL RENDERS NO `<details>` / `<summary>`.
// WebKit visits `<summary>` and `FOCUSABLE_SELECTOR` does not match it, which is
// the one gap the trap cannot close.
//
// ── ESCAPE is not handled here. `lib/usePaletteHotkey.ts` consumes it at
//    `window`, capture phase, with `stopImmediatePropagation()`, so it never
//    reaches this component at all -- and while the palette is CLOSED that arm
//    returns before touching the event, leaving every other Escape layer in the
//    app exactly as it shipped (FR-49, FR-50).
//
// ── `<BirdName>` IS DELIBERATELY NOT RENDERED IN THE ROWS (FR-27). It composes
//    a button and two anchors, which would nest interactive controls inside
//    `role="option"` and add tab stops inside the overlay -- the standing
//    form-control exclusion in `.claude/rules/bird-names.md` and
//    `pipeline/design-system.md`, not a shortcut. The eBird and Birds of the
//    World link marks are reached by opening the species.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { AlertCircle, Loader2, Search, Upload, X } from 'lucide-react'
import { NAV_ICON } from '../lib/tabIcons'
import { useFilesEpoch } from '../lib/useFilesEpoch'
import { useFocusTrap } from '../lib/useFocusTrap'
import { storage } from '../lib/storage'
import { loadEbirdObservations } from '../lib/observationsCache'
import { speciesIndexFor } from '../lib/speciesIndex'
import {
  buildPaletteRows,
  SPECIES_CAP,
  type PaletteNavItem,
  type PaletteRow,
} from '../lib/paletteRows'
import {
  PALETTE_SPECIES_SUPERSEDED,
  PALETTE_SPECIES_UNLOADABLE,
  resolvePaletteSpecies,
  type ResolvedSpecies,
} from '../lib/paletteSpeciesLoad'
import { PALETTE_COPY, speciesCapLine } from '../lib/paletteCopy'
import { resolveChordHint } from '../lib/paletteHint'
// Imported from where it lives for every surface that says a stored file would
// not load, and never re-exported through paletteCopy.ts: FR-35 requires this
// exact string, and a second name for it would break the delivery-versus-content
// split honestLoadFailures.test.tsx rests on.
import { EBIRD_BACKUP_LOAD_ERROR } from './setupCopy'
import type { Tab } from '../lib/tabLayout'

/**
 * The species half's own pending marker.
 *
 * NOT returned by `resolvePaletteSpecies`, which only ever hands back a settled
 * answer. It exists so the four rendered states are the render of ONE value
 * rather than four flags -- the loading line then cannot coexist with an answer,
 * and QA-33's "never present at the same time as either" is a property of the
 * type rather than of the render.
 */
const SPECIES_PENDING = 'palette-species-pending'
type SpeciesHalf = ResolvedSpecies | typeof SPECIES_PENDING | undefined

export interface CommandPaletteProps {
  /** `App.tsx`'s `navItems`, unchanged. The palette holds no destination list. */
  items: readonly PaletteNavItem[]
  /** FR-19. App's wrapper, which collapses a fullscreen map when navigating AWAY. */
  onSelectTab: (tab: Tab) => void
  /** FR-28. App's `navigateToSpeciesDetail`, with the fullscreen collapse. */
  onOpenSpecies: (commonName: string) => void
  /** The ONE close path: Escape, the backdrop, the close button and any selection. */
  onClose: () => void
}

export function CommandPalette({ items, onSelectTab, onOpenSpecies, onClose }: CommandPaletteProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(-1)
  const [species, setSpecies] = useState<SpeciesHalf>(undefined)
  const filesEpoch = useFilesEpoch()

  const uid = useId()
  const listboxId = `${uid}-listbox`
  const optionId = useCallback((idx: number) => `${uid}-option-${idx}`, [uid])

  // The shipped trap, with `containOutsideFocus` left off. See the header.
  useFocusTrap(true, panelRef)

  // FR-13: focus lands in the query input on open, and the query is empty on
  // every open because this component mounts fresh each time.
  useEffect(() => { inputRef.current?.focus() }, [])

  // ── The species half ──────────────────────────────────────────────────────
  //
  // FR-31: the effect carries `useFilesEpoch()` in its deps, so replacing or
  // clearing the eBird backup cannot leave the palette offering species from a
  // file that is gone, and the change is seen with no relaunch. That works with
  // a plain epoch-keyed re-load and nothing else BECAUSE
  // `clearEbirdObservationsCache()` runs BEFORE `notifyFilesChanged()` on all
  // three mutation paths (Settings.tsx's upload and clear, and the iCloud
  // controller's synced arrival), so the re-load starts a fresh parse and
  // `speciesIndexFor` sees a new array identity. That ordering is not this
  // component's to enforce; `CommandPalette.test.tsx` tests it through the REAL
  // observations cache rather than a mocked loader, which is what makes the
  // ordering the thing under test.
  //
  // FR-32: opening the palette may START the shared parse if nothing has, and
  // never blocks on it. Destinations render in the first commit from a prop that
  // is already computed, and the species rows join THIS OPEN SESSION when the
  // parse lands.
  useEffect(() => {
    let alive = true
    // FR-34 and FR-37 together, and this is the whole reason the loading line is
    // armed HERE rather than in the initial state. The `role="status"` region
    // must already be in the accessibility tree, EMPTY, in the commit before its
    // first message; initialising `species` to a value that renders the loading
    // line would create the region and its first message in one commit, which is
    // the documented way for an announcement to be missed (.claude/rules/ui.md).
    // The post-commit setState is therefore the deliberate mechanism, the same
    // posture as App.tsx's `setMountedTabs`. It also re-arms the line when the
    // files epoch changes, so a replaced backup shows a load rather than a stale
    // answer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSpecies(SPECIES_PENDING)
    // No `.catch`, deliberately: `resolvePaletteSpecies` never rejects, and that
    // is a property of its shape rather than a hope about it (its docstring owns
    // the claim and names the one boundary it does not close). If an exception is
    // ever added there, this call site owes a `.catch`.
    void resolvePaletteSpecies({
      getFilesStatus: () => storage.getFilesStatus(),
      loadObservations: loadEbirdObservations,
      buildIndex: speciesIndexFor,
      isCurrent: () => alive,
    }).then(next => {
      if (!alive || next === PALETTE_SPECIES_SUPERSEDED) return
      setSpecies(next)
    })
    return () => { alive = false }
  }, [filesEpoch])

  // ── The rows ──────────────────────────────────────────────────────────────

  const index = Array.isArray(species) ? species : null
  const { rows, destinationCount, speciesTruncated } = useMemo(
    () => buildPaletteRows({ items, index, query }),
    [items, index, query],
  )
  const speciesCount = rows.length - destinationCount

  // Clamped rather than trusted: `rows` shrinks as the user types and grows when
  // the index lands mid-session, and an index left pointing past the end would
  // make `aria-activedescendant` name an element that is not there.
  const active = activeIdx >= 0 && activeIdx < rows.length ? activeIdx : -1

  useEffect(() => {
    if (active < 0) return
    // The optional call is required: jsdom has no `scrollIntoView`.
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' })
  }, [active, optionId])

  const choose = useCallback((row: PaletteRow) => {
    // Every selection closes through the SAME `onClose` the backdrop, the close
    // button, Escape and a second chord press use (FR-11, QA-11).
    if (row.kind === 'tab') onSelectTab(row.id)
    else onOpenSpecies(row.name)
    onClose()
  }, [onSelectTab, onOpenSpecies, onClose])

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // CLAMPED, NEVER WRAPPED (FR-39, PRD Open Question 11), matching the shipped
    // SpeciesCombobox exactly: wrapping would make one key answer differently on
    // two surfaces of one app.
    // Computed from `active` and `rows` of the SAME render rather than through a
    // functional updater, so a stale index left behind by a shrinking list can
    // never be the base of the next move.
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(Math.min(active + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(Math.max(active - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // FR-40. With no active option and at least one result, Enter activates
      // rows[0]. THIS DIFFERS FROM `SpeciesCombobox` DELIBERATELY, and the
      // difference is recorded so it is not later read as drift: that component
      // prefers the first SPECIES match because it carries a synthetic "All
      // species" clearing row at index 0. The palette has no such row, so "the
      // first row" is unambiguous. With no results Enter does nothing and the
      // palette stays open (QA-39).
      const target = active >= 0 ? rows[active] : rows[0]
      if (target) choose(target)
    }
  }

  // ── The species half's one sentence ───────────────────────────────────────
  //
  // Exactly one of the four, or none. The `pending` marker and the three settled
  // values are one state, so the loading line cannot outlive the answer (FR-34).

  const statusMessage: string | null =
    species === SPECIES_PENDING ? PALETTE_COPY.speciesLoading
      : species === null ? PALETTE_COPY.speciesNoBackup
      : species === PALETTE_SPECIES_UNLOADABLE ? EBIRD_BACKUP_LOAD_ERROR
      : query.trim() !== '' && rows.length === 0 ? PALETTE_COPY.noMatches
      : null

  const statusGlyph =
    species === SPECIES_PENDING ? 'loading'
      : species === null ? 'upload'
      : species === PALETTE_SPECIES_UNLOADABLE ? 'error'
      : null

  // The message is a SEQUENCE-KEYED child, so an identical repeat is still a
  // real node replacement rather than a text reconciliation React bails out of
  // (.claude/rules/ui.md). The sequence is adjusted DURING RENDER -- React's
  // documented alternative to an effect that calls setState, and the shape
  // TabNav's rail tooltip already uses -- because the key has to be right in the
  // same render as the message. Stated honestly: on this surface the message
  // node also UNMOUNTS between two identical messages (the query passes through
  // states with no sentence), so the remount alone would already be a real DOM
  // addition; the key is kept because the next edit to this state machine may
  // remove that property, and the guard for the announcement itself is a real
  // accessibility tree, not a mutation count.
  const [statusSeq, setStatusSeq] = useState(0)
  const [seenStatus, setSeenStatus] = useState<string | null>(null)
  if (seenStatus !== statusMessage) {
    setSeenStatus(statusMessage)
    setStatusSeq(n => n + 1)
  }

  // The Species group's heading renders when it has rows, or when the species
  // half has a sentence of its own, so a reader always knows which half is
  // speaking. `noMatches` is NOT a species-half sentence: it is about the whole
  // query, so it gets no heading (design-spec Interaction Note 7).
  const speciesHasSentence = species === SPECIES_PENDING || species === null || species === PALETTE_SPECIES_UNLOADABLE

  const hint = resolveChordHint()

  return (
    <div
      className="sr-palette-root"
      // mousedown, not click: a drag that STARTED inside the panel and ended on
      // the backdrop must not close it (the NavMoreSheet rule).
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="sr-palette-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={PALETTE_COPY.inputLabel}
      >
        <div className="sr-palette-head">
          <div className="sr-palette-field">
            <Search size={17} strokeWidth={2.1} aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              tabIndex={0}
              // The iOS focus-zoom guard every SpeciesCombobox call site passes.
              // It must sit on the <input> itself to out-rank an inline size.
              className="sr-palette-input sr-input-16"
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                // Reset on every query change, which is also what keeps the
                // index valid as `rows` shrinks.
                setActiveIdx(-1)
              }}
              onKeyDown={onInputKeyDown}
              role="combobox"
              aria-label={PALETTE_COPY.inputLabel}
              aria-expanded="true"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-activedescendant={active >= 0 ? optionId(active) : undefined}
              placeholder={PALETTE_COPY.placeholder}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            type="button"
            tabIndex={0}
            className="sr-palette-close"
            aria-label={PALETTE_COPY.closeLabel}
            onClick={onClose}
          >
            <X size={17} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        {/* THE SCROLLER IS NOT THE LISTBOX. A listbox may own only `option` and
            `group` children, so the cap line and the status region are siblings
            BELOW it inside the same scroller, and each visible group heading is
            carried by a `role="group"` wrapper's own `aria-label` (the APG
            grouped-listbox pattern). The flat row array and its single active
            index are untouched, so ArrowDown still crosses the group boundary
            for free. */}
        <div className="sr-palette-results">
          <div id={listboxId} role="listbox" aria-label={PALETTE_COPY.inputLabel}>
            {destinationCount > 0 && (
              <div role="group" aria-label={PALETTE_COPY.groupDestinations}>
                <div className="sr-palette-group" role="presentation">{PALETTE_COPY.groupDestinations}</div>
                {rows.slice(0, destinationCount).map((row, i) => (
                  <Option key={rowKey(row)} row={row} active={active === i} id={optionId(i)} onChoose={choose} />
                ))}
              </div>
            )}
            {speciesCount > 0 && (
              <div role="group" aria-label={PALETTE_COPY.groupSpecies}>
                <div className="sr-palette-group" role="presentation">{PALETTE_COPY.groupSpecies}</div>
                {rows.slice(destinationCount).map((row, i) => {
                  const idx = destinationCount + i
                  return (
                    <Option key={rowKey(row)} row={row} active={active === idx} id={optionId(idx)} onChoose={choose} />
                  )
                })}
              </div>
            )}
          </div>

          {speciesTruncated && (
            <p className="sr-palette-note">{speciesCapLine(SPECIES_CAP)}</p>
          )}

          {speciesCount === 0 && speciesHasSentence && (
            <div className="sr-palette-group">{PALETTE_COPY.groupSpecies}</div>
          )}

          {/* ALWAYS MOUNTED, EMPTY UNTIL IT HAS A SENTENCE. All padding and
              typography live on the child line, so the idle region computes to
              zero height WITHOUT any rule hiding it -- `display: none` on a live
              region is the insert-with-first-message trap by another route, and
              `paletteCss.test.ts` scans for it. It sits outside every
              `inert`-able element, which is free here because the palette has
              none. */}
          <div className="sr-palette-status" role="status">
            {statusMessage ? (
              <span className="sr-palette-status-line" key={statusSeq}>
                {statusGlyph === 'loading' && <Loader2 size={14} strokeWidth={2.1} className="spin" aria-hidden="true" />}
                {statusGlyph === 'upload' && <Upload size={14} strokeWidth={2.1} aria-hidden="true" />}
                {statusGlyph === 'error' && <AlertCircle size={14} strokeWidth={2.1} aria-hidden="true" />}
                {statusMessage}
              </span>
            ) : null}
          </div>
        </div>

        {/* FR-46's rule extended one step (Designer's D-09): a user with no
            keyboard is shown no key legend either. It contains no interactive
            element and adds no tab stop. */}
        {hint !== 'none' && (
          <div className="sr-palette-foot">
            <span className="sr-palette-legend">
              <kbd className="sr-palette-kbd">↑</kbd>
              <kbd className="sr-palette-kbd">↓</kbd>
              {PALETTE_COPY.legendMove}
            </span>
            <span className="sr-palette-legend">
              <kbd className="sr-palette-kbd">↵</kbd>
              {PALETTE_COPY.legendOpen}
            </span>
            <span className="sr-palette-legend">
              <kbd className="sr-palette-kbd">Esc</kbd>
              {PALETTE_COPY.legendClose}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/** A React key that is unique across both groups without leaning on the index. */
function rowKey(row: PaletteRow): string {
  return row.kind === 'tab' ? `tab:${row.id}` : `species:${row.name}`
}

/**
 * One `role="option"` row.
 *
 * A `<div>`, not a `<button>`: the combobox pattern puts the only tab stop on
 * the input, and a button here would nest an interactive control inside an
 * option and add a tab stop inside the overlay. It carries no `tabindex`, so it
 * is in neither WebKit's tab order nor `FOCUSABLE_SELECTOR`'s list, which is
 * what keeps the focus trap's prediction and the engine in agreement.
 *
 * A destination row draws its `TAB_ICONS` glyph at the shipped `NAV_ICON.sheet`
 * preset (17 / 2.1, the closest register to a list row), introducing no new
 * number. A species row carries NO glyph: fifty identical marks down the densest
 * part of the list would be ornament rather than clarification, and the group
 * heading already says what these rows are.
 */
function Option({
  row, active, id, onChoose,
}: {
  row: PaletteRow
  active: boolean
  id: string
  onChoose: (row: PaletteRow) => void
}) {
  const className = 'sr-palette-row' + (active ? ' sr-palette-row--active' : '')
  if (row.kind === 'tab') {
    const Icon = row.icon
    return (
      <div id={id} role="option" aria-selected={active} className={className} onClick={() => onChoose(row)}>
        <span className="sr-palette-row-icon">
          <Icon size={NAV_ICON.sheet.size} strokeWidth={NAV_ICON.sheet.strokeWidth} />
        </span>
        <span className="sr-palette-row-name">{row.label}</span>
      </div>
    )
  }
  return (
    <div id={id} role="option" aria-selected={active} className={className} onClick={() => onChoose(row)}>
      <span className="sr-palette-row-name">{row.name}</span>
      {row.sciName && <span className="sr-palette-row-sci">{row.sciName}</span>}
    </div>
  )
}
