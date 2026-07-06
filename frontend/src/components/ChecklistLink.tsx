// One shared affordance for "open this checklist on eBird" (F064). Before this,
// the same function was rendered many different ways across tabs (a bare ↗ glyph,
// an unlabeled icon link, plain accent text, an underlined id with a title) and
// named several different ways — so a screen-reader user who learned one
// identification on the Checklists tab could not recognize it on Statistics or in
// a map popup (WCAG 3.2.4 Consistent Identification). This component is the single
// visual signature (the lucide ExternalLink icon) and the single accessible-name
// formula for that function.
//
// Accessible name (WCAG 2.5.3 Label in Name): when a visible label is shown (a date
// or count rather than the id itself), the name LEADS with that visible text so a
// Voice Control user can activate the link by what they see; the functional suffix
// ("open checklist on eBird (opens in a new tab)") stays identical everywhere, so
// 3.2.4 consistency holds. With no label the id is the visible text and is named
// directly.
//
// `compact` renders the icon alone (no text) for dense spots — species pills, a
// fixed-width stat column, map-popup rows — while keeping the identical accessible
// name. A junk id renders plain text (or nothing, in compact mode), never a link.
//
// Standing security check: only a shape-valid eBird submission id (SUBMISSION_ID_RE)
// becomes a link; a junk id renders as plain text, never a styled 404 link.

import { ExternalLink } from 'lucide-react'
import type { CSSProperties } from 'react'
import { SUBMISSION_ID_RE } from './speciesDetail/ui'

export interface ChecklistLinkProps {
  /** The eBird submission id (e.g. "S12345678"). Shape-validated before linking. */
  submissionId: string
  /** Visible label. Defaults to the id itself; pass a formatted date or value to override. */
  label?: string
  /** Icon + text scale. */
  size?: 'sm' | 'md'
  /** Icon-only rendering for dense spots (pills, fixed-width cells, map popups). Keeps the identical accessible name. */
  compact?: boolean
  /** Optional native hover tooltip for extra context a sighted user may want (e.g. "1 of N that day"). */
  title?: string
  /** Extra style merged onto the link/fallback (e.g. fontWeight, whiteSpace). */
  style?: CSSProperties
}

// The one accessible name for this function, everywhere it appears. Pass the visible
// `label` (when one is shown) so the name leads with it — WCAG 2.5.3.
// eslint-disable-next-line react-refresh/only-export-components -- pure accessible-name formula, tested directly; lives here beside the component it names
export function checklistLinkAriaLabel(submissionId: string, label?: string): string {
  if (label && label !== submissionId) {
    return `${label}: open checklist on eBird (opens in a new tab)`
  }
  return `Open checklist ${submissionId} on eBird (opens in a new tab)`
}

export function ChecklistLink({ submissionId, label, size = 'sm', compact = false, title, style }: ChecklistLinkProps) {
  const text = label ?? submissionId
  const iconSize = size === 'md' ? 11 : 10

  // Junk id: plain text, no link (matches the StatValueLink / DateLink fallbacks).
  // In compact mode there is no visible text to fall back to, so render nothing.
  if (!SUBMISSION_ID_RE.test(submissionId)) {
    return compact ? null : <span title={title} style={{ display: 'inline-block', color: 'var(--sr-text)', ...style }}>{text}</span>
  }

  return (
    <a
      href={`https://ebird.org/checklist/${submissionId}`}
      target="_blank"
      rel="noreferrer"
      aria-label={checklistLinkAriaLabel(submissionId, compact ? undefined : label)}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 0 : 3,
        color: 'var(--sr-accent)',
        textDecoration: 'none',
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
    >
      {!compact && text}
      <ExternalLink size={iconSize} strokeWidth={2.5} aria-hidden="true" />
    </a>
  )
}
