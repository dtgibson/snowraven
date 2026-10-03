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
//
// Two link layouts. The full name (neither `truncate` nor `compact`) is ordinary
// inline flow with the glyph bound to the name's last word, so on a name that wraps
// the glyph sits right after the last word (targets-hotspot-link, 2026-10-02).
// `truncate` and `compact` keep the inline-flex two-box layout: the name box
// ellipsizes while the glyph stays visible, or the glyph is the whole link.

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
  if (!truncate && !compact) {
    // The full name in ordinary inline flow, so it wraps as prose. The last word
    // shares one inline-block with the glyph, so the glyph follows the last word
    // and the two move between lines together (an inline-flex anchor stretched a
    // wrapping name across its container and left the glyph at the far edge).
    // What this component cannot guarantee alone: when the last word nearly fills
    // its line, word plus glyph no longer fit, and the glyph starts the next line
    // by itself. A container with spare room can let the glyph HANG into it
    // instead; the Targets Last report cell does (globals.css, `.sr-tg-place`).
    // The split is at the last SPACE only, keeps the space on the lead, and never
    // adds or drops a character. `max-width` and `overflow-wrap` let a single
    // token wider than the container wrap inside the box rather than force
    // sideways scroll. The accessible name is the anchor's aria-label, so the
    // split is invisible to assistive technology. The glyph carries its own
    // `display: inline-block`: Tailwind preflight makes every svg
    // `display: block`, which would put it on a line of its own under the last
    // word on every link (ui.md, the inline lucide glyph rule).
    const cut = name.lastIndexOf(' ')
    const lead = cut === -1 ? '' : name.slice(0, cut + 1)
    const last = cut === -1 ? name : name.slice(cut + 1)
    return (
      <OutboundLink
        href={`https://ebird.org/hotspot/${locId}`}
        aria-label={hotspotLinkAriaLabel(name)}
        title={title}
        className={className}
        // A link is always the accent color: it stays LAST so a caller's
        // plain-text color (e.g. muted) cannot bleed onto the linked state.
        style={{ textDecoration: 'none', ...style, color: 'var(--sr-accent)' }}
      >
        {lead ? <span>{lead}</span> : null}
        <span style={{ display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere' }}>
          {last}
          <ExternalLink size={iconSize} strokeWidth={2.5} aria-hidden="true" style={{ display: 'inline-block', marginLeft: 3, verticalAlign: 'baseline' }} />
        </span>
      </OutboundLink>
    )
  }
  // `truncate` and `compact`: two flex boxes, so the glyph stays visible after an
  // ellipsis (truncate) or is the whole link (compact).
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
        // Mirror the plain (personal-location) truncate branch: an inline-flex box
        // shrink-to-fits to its own max-content and overflows a block parent, so a
        // long linked name ran off the popup's right edge. maxWidth:100% imposes the
        // parent's width so the inner sr-truncate span can ellipsize. (max-width, not
        // a px/rem width — no text-scale concern; only when truncating, for parity.)
        ...(truncate ? { maxWidth: '100%' } : null),
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
