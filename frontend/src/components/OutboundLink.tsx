// One shared affordance for every outbound link that isn't a checklist (F078).
// It guarantees two things a screen-reader user depends on: the link always opens
// in a new tab (target/rel) and always announces that it does. The "(opens in a
// new tab)" cue is screen-reader-only — it never changes the visible copy.
//
// How the cue reaches the accessible name:
//   • Explicit aria-label, or plain-string children (the common case) → a clean,
//     spaced name is built: "<text> (opens in a new tab)". The visible text leads
//     it, so WCAG 2.5.3 Label in Name holds.
//   • Rich (JSX) children (text + a decorative glyph/icon) → the text can't be read
//     here, so the cue is appended as an .sr-only node in the flow; the accessible
//     name is the visible text plus the cue.
//
// Named OutboundLink, not ExternalLink, to avoid colliding with lucide-react's
// `ExternalLink` ICON (the visual ↗ glyph) that many components import. For
// checklist links use ChecklistLink, which bakes this in already. This wrapper is
// for eBird species/region links, the Macaulay Library, OpenWeather, GitHub, map
// popups, comment URLs, the atlas, etc.

import type { AnchorHTMLAttributes, ReactNode } from 'react'

const NEW_TAB_CUE = ' (opens in a new tab)'

export interface OutboundLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  children: ReactNode
}

export function OutboundLink({ href, children, 'aria-label': ariaLabel, ...rest }: OutboundLinkProps) {
  // Build a clean accessible name when we have text to build from (an explicit
  // aria-label, or plain string children). For rich children, fall back to an
  // .sr-only cue node so the announcement still reaches assistive tech.
  const base = ariaLabel ?? (typeof children === 'string' ? children : undefined)
  const fullAria = base
    ? base.includes('opens in a new tab') ? base : `${base}${NEW_TAB_CUE}`
    : undefined

  return (
    // tabIndex sits BEFORE {...rest} deliberately, so a caller can still override
    // it; WebKit's default tab mode gives a plain <a href> no place in the tab
    // order at all (measurement in lib/useFocusTrap.ts's header), so this one line
    // is what puts every link routed through this component on the keyboard's
    // path on the Mac, iPhone and iPad builds: 22 direct call sites across 14
    // files, plus every HotspotLink, which renders through here.
    //
    // NOT every outbound link in the app, and the difference matters to anyone
    // reading this as coverage: thirteen anchors are still written per-site
    // (App.tsx, SpeciesLinks, LifeListTable's Macaulay Library columns,
    // CommentText, and others). Nine of those predate this component and would be
    // its callers under the app's own convention; routing them through it would
    // change each one's accessible-name formula, which is published behaviour, so
    // it is on the ROADMAP rather than done here. They each carry their own
    // tabIndex, and lib/tabOrderCoverage.test.ts is what actually guarantees the
    // app-wide property.
    <a tabIndex={0} href={href} target="_blank" rel="noreferrer" {...rest} aria-label={fullAria}>
      {children}
      {!fullAria && <span className="sr-only">{NEW_TAB_CUE}</span>}
    </a>
  )
}
