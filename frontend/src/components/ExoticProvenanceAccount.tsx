// The count-rule account (design-spec.md — View 2). One region, directly under
// the number it explains, inside the Life List Totals card.
//
// It is NOT a card: a Divider and then plain rows on the card background, the
// way the card already separates its own regions. A bordered inset here would be
// a card inside a card.
//
// Layout lives in globals.css (`.sr-exotic-*`), never in an inline style: a
// React inline style is specificity (1,0,0) and unreachable from a media query,
// which is exactly why the repo's responsive vocabulary exists. Colours stay
// inline and come only from `var(--sr-*)` tokens; this feature mints none.
//
// Three defects the design probe found at 320px and 200% text scale, all fixed
// in the mockup and none of which may be reintroduced:
//   1. the evidence line must WRAP (a `white-space: nowrap` version ran 133.38px
//      past the card's content box);
//   2. any fixed grid track uses the self-collapsing `minmax(min(Xrem, 100%), 1fr)`;
//   3. the progress row is CONDITIONALLY RENDERED, never `hidden` against an
//      author `display` (which `[hidden]` loses to).
// Page `scrollWidth` read a clean 320 on the broken build, so it is not a usable
// assertion for any of them: measure the element against its container's
// content box.

import { useId, useState } from 'react'
import {
  AlertCircle, Check, ChevronDown, ChevronUp, Circle,
  KeyRound, Loader2, RotateCw, Square, WifiOff,
} from 'lucide-react'
import { BirdName } from './BirdName'
import { Divider } from './statsPrimitives'
import {
  discloseLabel, evidenceLine, statusSentence,
  ESCAPEE_LEAD_OFF, ESCAPEE_LEAD_ON, ESCAPEE_RULE_OFF, ESCAPEE_RULE_ON,
} from '../lib/exoticCopy'
import type { ExcludedSpecies } from '../lib/exoticProvenance'
import type { ProvenanceStatus } from '../lib/useExoticProvenance'

function StatusIcon({ kind }: { kind: ProvenanceStatus['kind'] }) {
  const muted = { color: 'var(--sr-text-muted)' }
  switch (kind) {
    case 'in-progress':
      return <Loader2 size={14} strokeWidth={2.2} className="spin sr-exotic-icon" aria-hidden="true" style={{ color: 'var(--sr-accent)' }} />
    case 'complete':
      return <Check size={14} strokeWidth={2.2} className="sr-exotic-icon" aria-hidden="true" style={{ color: 'var(--sr-accent)' }} />
    case 'partial':
      return <AlertCircle size={14} strokeWidth={2.2} className="sr-exotic-icon" aria-hidden="true" style={{ color: 'var(--sr-warning)' }} />
    case 'error':
      return <AlertCircle size={14} strokeWidth={2.2} className="sr-exotic-icon" aria-hidden="true" style={{ color: 'var(--sr-error)' }} />
    case 'no-key':
      return <KeyRound size={14} strokeWidth={2.2} className="sr-exotic-icon" aria-hidden="true" style={muted} />
    case 'offline':
      return <WifiOff size={14} strokeWidth={2.2} className="sr-exotic-icon" aria-hidden="true" style={muted} />
    default:
      return <Circle size={14} strokeWidth={2.2} strokeDasharray="3 3" className="sr-exotic-icon" aria-hidden="true" style={muted} />
  }
}

export interface ExoticProvenanceAccountProps {
  status: ProvenanceStatus
  /** Advances on every status update so the live region's keyed child is a real
   *  DOM replacement even when the sentence repeats (NFR-06, QA-54). */
  statusSeq: number
  excluded: readonly ExcludedSpecies[]
  /** The "Count escapees" checkbox. Off (the default) means escapees are excluded. */
  includeEscapees: boolean
  onStop: () => void
  onRetry: () => void
  onGoToSettings: () => void
  codeFor: (name: string) => string | undefined
  onOpenSpecies?: (commonName: string) => void
}

export function ExoticProvenanceAccount({
  status, statusSeq, excluded, includeEscapees,
  onStop, onRetry, onGoToSettings, codeFor, onOpenSpecies,
}: ExoticProvenanceAccountProps) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  const running = status.kind === 'in-progress'
  const found = excluded.length
  const total = running ? status.planned + status.additional : 0

  return (
    <>
      <Divider />
      <div className="sr-exotic">
        {/* Row 1 — the live status, with its action trailing on the same line.
            The row WRAPS rather than shrinking the control, so the button keeps
            its touch target on a phone. */}
        <div className="sr-exotic-statusrow">
          {/* Rendered from first paint and NEVER `display: none` while idle.
              Hiding a live region while empty makes it be INSERTED with its
              first message, which breaks announcement entirely and is invisible
              to both layout measurement and jsdom (the v0.5.83 trap). The
              message sits in a SEQUENCE-KEYED CHILD so an identical repeat is a
              real node replacement and still announces; do not append an
              invisible character to force a diff, which would make every
              textContent assertion quietly false. */}
          <div className="sr-exotic-status" role="status" aria-live="polite">
            <StatusIcon kind={status.kind} />
            <span key={statusSeq} className="sr-exotic-msg">
              {statusSentence(status, found)}
              {status.kind === 'no-key' && (
                <>
                  {' '}
                  <button type="button" tabIndex={0} className="sr-exotic-link" onClick={onGoToSettings}>
                    Add a key in Settings
                  </button>
                </>
              )}
            </span>
          </div>

          {running && (
            <button type="button" tabIndex={0} className="sr-exotic-act" onClick={onStop}>
              <Square size={11} strokeWidth={2.2} fill="currentColor" aria-hidden="true" />
              Stop
            </button>
          )}
          {/* FR-31 gives only `error` a retry. This build also gives the four
              `partial` reasons a "Check again", an APPROVED DEVIATION (design
              gate, 2026-08-12): a birder who presses Stop otherwise has no route
              back, and because a tab stays mounted once opened, partial
              (cancelled) would persist for the rest of the session with no way
              to resume. Do not remove it as an oversight. */}
          {status.kind === 'partial' && (
            <button type="button" tabIndex={0} className="sr-exotic-act" onClick={onRetry}>
              <RotateCw size={12} strokeWidth={2.2} aria-hidden="true" />
              Check again
            </button>
          )}
          {status.kind === 'error' && (
            <button type="button" tabIndex={0} className="sr-exotic-act" onClick={onRetry}>
              <RotateCw size={12} strokeWidth={2.2} aria-hidden="true" />
              Try again
            </button>
          )}
        </div>

        {/* Row 1b — the definite progress figure. CONDITIONALLY RENDERED, never
            `hidden`: the denominator is known before the first request goes out,
            so this is never an indeterminate bar. */}
        {running && (
          <div className="sr-exotic-progress">
            <div
              className="sr-exotic-track"
              role="progressbar"
              aria-valuenow={status.done}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label="Exotic status check progress"
            >
              <div
                className="sr-exotic-fill"
                style={{ width: `${total > 0 ? Math.min(100, Math.round((status.done / total) * 100)) : 0}%` }}
              />
            </div>
            <span className="sr-exotic-count">{status.done} / {total}</span>
          </div>
        )}

        {/* Row 2 — the standing rule. Always present, whichever way the toggle
            is set and whatever the pass has resolved so far. */}
        <p className="sr-exotic-rule">{includeEscapees ? ESCAPEE_RULE_ON : ESCAPEE_RULE_OFF}</p>

        {/* Row 3 — the disclosure (FR-32). Appears only once a species has been
            found, and STAYS AVAILABLE with the toggle on, where only the lead
            sentence changes: the same list, framed as information rather than
            exclusion. */}
        {found > 0 && (
          <>
            <button
              type="button"
              tabIndex={0}
              className="sr-exotic-disclose"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen(v => !v)}
            >
              {open ? <ChevronUp size={12} aria-hidden="true" /> : <ChevronDown size={12} aria-hidden="true" />}
              {discloseLabel(found, open, running)}
            </button>
            {/* Animated with grid-template-rows 0fr/1fr, so the panel is CLIPPED
                to zero rather than unmounted. Clipped-to-zero controls stay in
                the tab order and in the accessibility tree, which would leave
                the collapsed list's bird-name buttons and their two link icons
                reachable while `aria-expanded="false"` says otherwise (WCAG
                2.4.3 and 4.1.2). `inert` is what removes them, and it is the
                same fix, on the same grid-rows shape, as the Map Explorer's
                collapsed filter panel.

                NOTE this is deliberately NOT the "Show all N counties" idiom,
                which conditionally RENDERS its content and therefore needs no
                guard. That idiom is the source of the expander BUTTON's styling
                only; the panel below it behaves differently and must say so. */}
            <div id={panelId} className={open ? 'sr-exotic-excluded sr-exotic-excluded--open' : 'sr-exotic-excluded'}>
              <div className="sr-exotic-excluded-inner" inert={!open}>
                <p className="sr-exotic-lead">{includeEscapees ? ESCAPEE_LEAD_ON : ESCAPEE_LEAD_OFF}</p>
                <div className="sr-exotic-rows">
                  {excluded.map(sp => (
                    <div key={sp.speciesCode} className="sr-exotic-row">
                      <span className="sr-min0">
                        {/* These species remain on the Life List, so `hasEntry`
                            is true and the name links to Species Detail. */}
                        <BirdName
                          commonName={sp.name}
                          taxonCode={codeFor(sp.name)}
                          hasEntry
                          onOpenSpecies={onOpenSpecies}
                          size="sm"
                        />
                      </span>
                      <span className="sr-exotic-why">{evidenceLine(sp.checklistsChecked)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
