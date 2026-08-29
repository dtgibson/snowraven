// Subspecies Explorer UI (subspecies-explorer): the "Subspecies and forms"
// disclosure below the species selector + its full-backup list panel, and the
// per-species "Subspecies and Forms" breakdown section. Both render only in
// merged mode & ready state — the parent gates that (FR-04, FR-19, FR-23).
//
// All derivation lives in lib/subspeciesExplorer.ts; these components render
// strings the contracts emit. Colors are --sr-* tokens only; hover/open states
// and motion live in globals.css (.sr-ssx-*), where the global
// prefers-reduced-motion block collapses them.

import { forwardRef, useId, useRef, useState } from 'react'
import { ChevronDown, ListTree } from 'lucide-react'
import { BirdName } from '../BirdName'
import { SectionCard, SectionHead, StatLabel } from './ui'
import {
  type Breakdown, type ExplorerEntry,
  formCountLabel, formNotedLabel, ledgerNote, reportCountLabel, speciesCountLabel,
} from '../../lib/subspeciesExplorer'

// ── The entry control + explorer list ───────────────────────────────────────

export function SubspeciesExplorerControl({ entries, selectedSpecies, onPick }: {
  entries: ExplorerEntry[]
  /** The page's selected species (merged-mode normalized name), for aria-current. */
  selectedSpecies: string | null
  /** Selects via the page's own selectSpecies path and scrolls to the breakdown
   *  (FR-06) — the same code path as the selector, not a parallel one. */
  onPick: (species: string) => void
}) {
  // Ephemeral component state: collapsed by default, never persisted (FR-06).
  // No storage seam, no setting.
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  // Escape closes the panel and returns focus to the control (design-spec.md).
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
      toggleRef.current?.focus()
    }
  }

  return (
    // .sr-ctl-row: on a phone the control's label reads at the same
    // scale-tracking size as the toggles above and the county select below
    // (globals.css); the panel rows' text is span-sized and unaffected.
    <div className="sr-ctl-row" style={{ marginBottom: 16, flexShrink: 0 }} onKeyDown={handleKeyDown}>
      <button
        ref={toggleRef}
        type="button"
        tabIndex={0}
        className="sr-ssx-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(v => !v)}
      >
        <span className="sr-ssx-tile" aria-hidden="true">
          <ListTree size={12} strokeWidth={2.2} />
        </span>
        Subspecies and forms
        <span className="sr-ssx-count">{speciesCountLabel(entries.length)}</span>
        <ChevronDown size={13} strokeWidth={2.2} className="sr-ssx-caret" aria-hidden="true" />
      </button>

      {/* Conditionally RENDERED, not CSS-collapsed: while closed there is no
          subtree, so no `inert` is owed and nothing strays into the tab order. */}
      {open && (
        <div className="sr-ssx-panel" id={panelId}>
          <div className="sr-ssx-panel-head">
            {entries.length === 0
              // FR-07: the honest empty message, in the panel-header style.
              ? 'Your loaded data contains no subspecies or form entries.'
              // FR-04's "subspecies and forms" descriptive copy + FR-08's
              // honesty note, exact per the approved design.
              : 'Every species in your loaded data with at least one subspecies or form noted. Shares reflect your whole backup, not the current filter.'}
          </div>
          {entries.length > 0 && (
            <ul className="sr-ssx-list">
              {entries.map(entry => (
                <li key={entry.species}>
                  <button
                    type="button"
                    tabIndex={0}
                    className="sr-ssx-row"
                    aria-current={entry.species === selectedSpecies ? 'true' : undefined}
                    onClick={() => {
                      setOpen(false)
                      onPick(entry.species)
                    }}
                  >
                    <span className="sr-ssx-row-top">
                      {/* FR-17: names render through BirdName. Its non-link,
                          favicon-less form, deliberately: the whole row is one
                          button, so a nested link or favicon anchor would be an
                          interactive-inside-interactive violation — and the
                          approved mockup shows none here. */}
                      <span className="sr-ssx-row-name"><BirdName commonName={entry.species} /></span>
                      <span className="sr-ssx-row-count">{formCountLabel(entry.forms.length)}</span>
                    </span>
                    <span className="sr-ssx-row-forms">
                      {entry.forms.map((form, i) => (
                        <span key={form.name}>
                          {i > 0 && <span className="sr-ssx-dot" aria-hidden="true">·</span>}
                          <BirdName commonName={form.name} />
                          {' '}
                          <span className="sr-ssx-pct">{form.pctLabel}</span>
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// ── The breakdown section ───────────────────────────────────────────────────

export const SubspeciesBreakdownSection = forwardRef<HTMLDivElement, {
  /** Contract B over the page's existing filtered `speciesObs` memo. */
  breakdown: Breakdown
  /** Whether the species has >= 1 countable form ANYWHERE in the loaded backup
   *  (Contract A). Separates the FR-15 empty state from FR-14's filtered-to-zero. */
  qualifies: boolean
  /** The Sightings "Checklists" figure for the current view (speciesObs.length),
   *  quoted by the FR-13 ledger footnote. */
  sightingsTotal: number
  /** Changes per species/filter change; keys the row list so the share bars
   *  replay their fill exactly when the data changed (Motion Spec). */
  resetKey: string
}>(function SubspeciesBreakdownSection({ breakdown, qualifies, sightingsTotal, resetKey }, ref) {
  const { rows, total, nonCountableCount } = breakdown

  // The FR-13 ledger: rendered whenever the current view holds excluded rows,
  // in every body state — it is exactly the honest surface for the delta
  // between this section's total and the Sightings figure (schema.md).
  const footnote = nonCountableCount > 0 ? (
    <div style={{ marginTop: 12, fontSize: '0.71875rem', color: 'var(--sr-text-muted)', lineHeight: 1.55, maxWidth: '62ch' }}>
      {ledgerNote(nonCountableCount, sightingsTotal)}
    </div>
  ) : null

  return (
    // tabIndex -1: the focus target after an explorer pick (jumpTo), so
    // keyboard and AT users land where the answer is (design-spec.md).
    <div ref={ref} tabIndex={-1}>
      <SectionCard>
        <SectionHead icon={<ListTree size={14} strokeWidth={2.2} />} title="Subspecies and Forms" />
        <div className="sr-pad-x-trim" style={{ padding: '16px 18px' }}>
          {!qualifies ? (
            <>
              {/* FR-15: the one-line honest empty state — the section is
                  present, never silently absent. */}
              <span style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
                No subspecies or form detail is recorded for this species.
              </span>
              {footnote}
            </>
          ) : total === 0 ? (
            <>
              {/* FR-14: the species qualifies but the active filter leaves no
                  countable rows — the page's filtered-to-nothing reading,
                  distinct from the FR-15 copy. */}
              <span style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
                No reports match the current filter.
              </span>
              {footnote}
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                <div>
                  <StatLabel>Reports</StatLabel>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--sr-text)', fontVariantNumeric: 'tabular-nums' }}>
                    {total}
                  </div>
                </div>
                <div>
                  <StatLabel>Form noted</StatLabel>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--sr-accent)', fontVariantNumeric: 'tabular-nums' }}>
                    {formNotedLabel(breakdown)}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>of your reports</div>
                </div>
              </div>

              <ul key={resetKey} style={{ listStyle: 'none', margin: '14px 0 0', padding: 0 }}>
                {rows.map((row, idx) => (
                  <li
                    key={row.kind === 'plain' ? '__plain' : row.name}
                    style={{ padding: '9px 0 10px', borderTop: idx > 0 ? '1px solid var(--sr-border-subtle)' : 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                        {row.kind === 'form' ? (
                          // FR-17: the full reported name through BirdName
                          // (non-link form per the approved design).
                          <BirdName commonName={row.name} />
                        ) : (
                          // Display copy, not a bird name (the convention's
                          // form-control exception) — plain muted text.
                          <span style={{ fontSize: '0.84375rem', fontWeight: 500, color: 'var(--sr-text-muted)' }}>
                            {row.name}
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: '0.78125rem', color: 'var(--sr-text-muted)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {reportCountLabel(row.count)}
                      </span>
                      <span style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--sr-text)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, minWidth: '3.2rem', textAlign: 'right' }}>
                        {row.pctLabel}
                      </span>
                    </div>
                    {/* Share bar: reinforcement only — every value above is
                        text (NFR-03). Plain reports fill with --sr-gray-400 so
                        they read as a different kind without relying on color
                        alone (the shape difference is the pinned-last row). */}
                    <div style={{ height: 3, borderRadius: 2, marginTop: 6, background: 'var(--sr-border)', overflow: 'hidden' }} aria-hidden="true">
                      <div
                        className="sr-ssx-bar-fill"
                        style={{
                          height: '100%', borderRadius: 2,
                          background: row.kind === 'form' ? 'var(--sr-accent)' : 'var(--sr-gray-400)',
                          width: `${row.pct}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              {footnote}
            </>
          )}
        </div>
      </SectionCard>
    </div>
  )
})
