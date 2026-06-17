// One shared affordance for "open this PUBLIC hotspot on eBird". A location name
// becomes a link ONLY when it is a public eBird hotspot — the caller passes
// `isHotspot` (decided by isPublicHotspot against the region hotspot Set) — AND the
// id is shape-valid. A personal location, an unknown/absent id, or a not-yet-loaded
// Set all render as plain text, never a styled 404 link. (The pre-existing inline
// hotspot links gated on id-format ALONE, so they wrongly linked personal locations
// to dead pages; routing them through here adds the Set gate that fixes that.)
//
// Wraps OutboundLink so target/rel + the "(opens in a new tab)" cue are guaranteed.
// The accessible-name suffix matches ChecklistLink ("open … on eBird (opens in a new
// tab)") for WCAG 3.2.4 Consistent Identification; the visible text is the hotspot NAME.
// `compact` renders the icon alone for dense spots (map popups) with the same name.

import { ExternalLink } from 'lucide-react'
import type { CSSProperties } from 'react'
import { OutboundLink } from './OutboundLink'
import { LOCATION_ID_RE } from './speciesDetail/ui'

export interface HotspotLinkProps {
  /** eBird location id (e.g. "L123456"). Shape-validated before linking. */
  locId: string
  /** The visible location name (the link text). */
  name: string
  /** True when this locId is a public hotspot (caller decides via isPublicHotspot). */
  isHotspot: boolean
  size?: 'sm' | 'md'
  /** Icon-only rendering for dense spots (map popups, fixed-width cells). */
  compact?: boolean
  /** Ellipsis-truncate a long name while keeping the trailing icon visible. */
  truncate?: boolean
  /** Optional native hover tooltip; does not change the accessible name. */
  title?: string
  className?: string
  style?: CSSProperties
}

/** The one accessible name for this function, everywhere it appears. */
// eslint-disable-next-line react-refresh/only-export-components -- pure accessible-name formula, tested directly; lives here beside the component it names
export function hotspotLinkAriaLabel(name: string): string {
  return `Open ${name} on eBird (opens in a new tab)`
}

export function HotspotLink({ locId, name, isHotspot, size = 'sm', compact = false, truncate = false, title, className, style }: HotspotLinkProps) {
  // Plain text unless it's a confirmed public hotspot with a shape-valid id.
  if (!isHotspot || !LOCATION_ID_RE.test(locId)) {
    // When truncating, mirror the LINK branch's box model exactly — an inline-flex
    // shell around an inner sr-truncate span — so a plain (personal) name and a linked
    // (hotspot) name share the same first-line text baseline in a baseline-aligned row
    // (an inline-block-with-overflow synthesizes its baseline from the margin edge and
    // would sit a few px off the link/date/separator). Ellipsis works in any parent.
    if (truncate) {
      return (
        <span
          className={className}
          title={title}
          style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0, maxWidth: '100%', color: 'var(--sr-text)', ...style }}
        >
          <span className="sr-truncate">{name}</span>
        </span>
      )
    }
    return <span className={className} title={title} style={{ color: 'var(--sr-text)', ...style }}>{name}</span>
  }
  const iconSize = size === 'md' ? 11 : 10
  return (
    <OutboundLink
      href={`https://ebird.org/hotspot/${locId}`}
      aria-label={hotspotLinkAriaLabel(name)}
      title={title}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 0 : 3,
        minWidth: 0,
        textDecoration: 'none',
        ...style,
        // A link is always the accent color — a caller's plain-text color (e.g. muted
        // for a comment location) must not bleed onto the linked state.
        color: 'var(--sr-accent)',
      }}
    >
      {!compact && <span className={truncate ? 'sr-truncate' : undefined}>{name}</span>}
      <ExternalLink size={iconSize} strokeWidth={2.5} aria-hidden="true" style={{ flexShrink: 0 }} />
    </OutboundLink>
  )
}
