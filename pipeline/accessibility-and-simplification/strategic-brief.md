# Strategic Brief — Accessibility

## What We're Building

A best-efforts accessibility pass across the SnowRaven web app, making it meaningfully usable for people relying on screen readers, keyboard-only navigation, or other assistive technology. No certification target — the goal is real-world usability across the most common limitations.

## Why Now

SnowRaven has grown into an eight-tab, data-rich application. The earlier it gets an accessibility foundation, the less expensive subsequent features are to build accessibly — and the more people can actually use what's already been built. Waiting until the app is larger or until a mobile port exists makes the problem harder, not easier.

## The User Problem

A birder who uses a screen reader or navigates by keyboard currently has a poor experience with SnowRaven — dynamic content updates aren't announced, many interactive elements lack descriptive labels, filter pills and dropdowns may be unreachable without a mouse, and the Breeding Codes color system conveys meaning through color alone. These aren't edge cases; they're predictable barriers for a meaningful portion of potential users.

## Success Criteria

- A screen reader user can navigate all tabs, read all data, and use all core interactive controls without encountering unlabeled or silent elements
- All interactive controls — buttons, pills, dropdowns, toggles — are reachable and operable via keyboard alone
- Color is never the only way meaning is conveyed (especially breeding code tiers and map recency dots)
- Contrast ratios for text and interactive elements meet at least WCAG AA for primary content
- Focus is managed correctly when overlays open and close and when tabs switch
- Touch targets meet a minimum size suitable for users with reduced motor precision

## Scope

- ARIA labels and roles on all interactive elements and landmark regions
- ARIA live regions for dynamic content updates (weather results, loading states, tab content changes)
- Full keyboard navigation: tab order, Enter/Space activation for all interactive controls, Escape to close overlays
- Semantic HTML audit: headings hierarchy, button vs. div, form input labels
- Color contrast review and fixes for primary text, interactive elements, and key status indicators
- Non-color alternatives for color-coded meaning: breeding code tiers, map recency dots
- Touch target sizing for buttons, pills, and toggle controls
- Focus management: on overlay open/close, on tab switch

## Out of Scope

- Leaflet map deep accessibility (maps are fundamentally limited for screen readers; basic landmark labeling is in scope but full map keyboard control is not)
- Drag-to-reorder keyboard alternative for tab layout (out of scope for this pass; document as a known limitation)
- WCAG certification or formal audit report
- New features or UI changes beyond what accessibility requires

## Key Decisions

- Best-efforts, not certification — improvements are guided by real-world usability rather than a checklist
- Color-coded elements (breeding tiers, map dots) will add text or icon supplements — not replace color, which carries useful meaning for users who can see it
- Map interactivity is labeled but not fully keyboarded — this is a known Leaflet limitation, not a regression
- Drag-to-reorder in Settings will be documented as keyboard-inaccessible in this pass; a future maintain session can add a keyboard-based reorder alternative
