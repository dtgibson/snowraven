// One shared affordance for "open this checklist on eBird" (F064). Before this,
// the same function was rendered four different ways across tabs (a bare ↗ glyph,
// an unlabeled icon link, plain accent text, an underlined id with a title) and
// named three different ways — so a screen-reader user who learned one
// identification on the Checklists tab could not recognize it on Statistics or in
// a map popup (WCAG 3.2.4 Consistent Identification). This component is the single
// visual signature (the lucide ExternalLink icon) and the single accessible-name
// formula (`Open checklist {id} on eBird (opens in a new tab)`) for that function.
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
  /** Extra style merged onto the link/fallback (e.g. fontWeight, whiteSpace). */
  style?: CSSProperties
}

// The one accessible name for this function, everywhere it appears.
export function checklistLinkAriaLabel(submissionId: string): string {
  return `Open checklist ${submissionId} on eBird (opens in a new tab)`
}

export function ChecklistLink({ submissionId, label, size = 'sm', style }: ChecklistLinkProps) {
  const text = label ?? submissionId
  const iconSize = size === 'md' ? 11 : 10

  // Junk id: plain text, no link (matches the StatValueLink / DateLink fallbacks).
  if (!SUBMISSION_ID_RE.test(submissionId)) {
    return <span style={{ color: 'var(--sr-text)', ...style }}>{text}</span>
  }

  return (
    <a
      href={`https://ebird.org/checklist/${submissionId}`}
      target="_blank"
      rel="noreferrer"
      aria-label={checklistLinkAriaLabel(submissionId)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        color: 'var(--sr-accent)',
        textDecoration: 'none',
        ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
    >
      {text}
      <ExternalLink size={iconSize} strokeWidth={2.5} aria-hidden="true" />
    </a>
  )
}
