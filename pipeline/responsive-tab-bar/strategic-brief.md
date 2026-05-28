# Strategic Brief — Responsive Tab Bar

## What We're Building
A tab navigation that adapts to viewport width: the existing horizontal bar on desktop, and a compact dropdown control on narrow screens (mobile browsers and small windows).

## Why Now
Two pressures arrived together. Dave accesses the Raspberry Pi installation from a phone browser today, where eight horizontal tabs overflow and break the layout. And the upcoming native mobile app needs an elegant navigation pattern — solving this now in the web app establishes that pattern early rather than inventing it twice.

## The User Problem
On a narrow screen the tab bar has more destinations than horizontal space, so navigation becomes cramped, overflows, or is unusable. The birder checking a checklist from their phone in the field can't reliably move between Weather, Map Explorer, Media List, and the rest.

## Success Criteria
- On a desktop-width window, navigation looks and behaves exactly as it does today — a horizontal bar.
- On a phone or narrow window, all destinations are reachable through a compact control with no overflow and no horizontal scrolling.
- The compact control reflects the user's existing tab order and hidden-tab choices, with no separate configuration.
- The current tab is always visible at a glance, even when collapsed.
- Navigation remains keyboard-accessible and screen-reader-friendly in both modes.

## Scope
- A single, responsive tab navigation component that switches presentation at a width breakpoint.
- Compact mode presented as a dropdown showing the active tab and expanding to the full ordered, visibility-filtered list.
- Settings remains reachable in both modes.
- Preserve existing keyboard navigation and ARIA semantics.

## Out of Scope
- A bottom tab bar or gesture-based navigation.
- The native mobile app itself (this is the web/responsive layer; the pattern informs it but isn't it).
- Any change to which tabs exist, or to the reorder/hide settings UI.
- Redesigning the tab content or page layouts.

## Key Decisions
- Compact pattern is a **dropdown**, not a bottom bar — chosen because eight destinations exceed a bottom bar's practical limit and a dropdown reuses the existing order/visibility model for free.
- One component handles both modes via a responsive breakpoint, rather than two parallel navigations.
- The breakpoint is the point at which the horizontal bar would otherwise overflow (exact value is The Designer's call).
