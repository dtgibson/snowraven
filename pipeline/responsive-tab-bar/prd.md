# PRD — Responsive Tab Bar
**Feature:** responsive-tab-bar
**Date:** 2026-05-27
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
The main tab navigation adapts to viewport width. At desktop widths it renders as today's horizontal bar; below a width breakpoint it collapses into a compact dropdown that shows the current tab and expands to the full list. The dropdown reflects the user's existing tab order and hidden-tab choices with no separate configuration.

## User Stories

> **US-01** — As a birder viewing my Pi install from a phone browser, I want to reach every tool without the tab bar overflowing or forcing me to scroll sideways, so that navigation is usable on a small screen.

> **US-02** — As a desktop user, I want navigation to look and behave exactly as it does today, so that nothing I rely on changes.

> **US-03** — As a user who has reordered or hidden tabs, I want the compact dropdown to honor those choices, so that my customization carries over to mobile without reconfiguring.

> **US-04** — As a user on a narrow screen, I want to see which tab I'm currently on at a glance even when the navigation is collapsed, so that I always know where I am.

> **US-05** — As a keyboard or screen-reader user, I want navigation to remain fully operable in both layouts, so that the feature does not regress accessibility.

## Functional Requirements

**Responsive switching**
> **FR-01** — The app shall render navigation as a horizontal tab bar at viewport widths at or above a defined breakpoint.
> **FR-02** — The app shall render navigation as a compact dropdown control at viewport widths below that breakpoint.
> **FR-03** — The app shall switch between the two layouts live as the viewport crosses the breakpoint, without requiring a reload.
> **FR-04** — The app shall preserve the active tab when the layout switches between bar and dropdown.

**Compact dropdown behavior**
> **FR-05** — The collapsed dropdown control shall display the label and icon of the currently active tab.
> **FR-06** — Activating the dropdown control shall reveal the full list of navigable destinations.
> **FR-07** — The dropdown list shall present the configurable tabs in the user's saved order, excluding any the user has hidden, followed by Settings.
> **FR-08** — Selecting a destination from the dropdown shall switch to that tab and close the dropdown.
> **FR-09** — The dropdown shall indicate which destination is currently active within the open list.
> **FR-10** — Settings shall be reachable from the dropdown in compact mode and from the bar in desktop mode.
> **FR-11** — The dropdown shall close when the user selects an item, presses Escape, or moves focus/clicks outside it.

**Edge cases**
> **FR-12** — When the user has hidden all configurable tabs, the dropdown shall still list Settings (and any tab that cannot be hidden), so navigation is never empty.
> **FR-13** — If the dropdown is open when the viewport widens past the breakpoint, the app shall return to the horizontal bar without leaving an orphaned open menu.

## Non-Functional Requirements

> **NFR-01 — Accessibility:** Navigation shall be fully keyboard operable in both layouts. The dropdown trigger and items shall be reachable and activatable by keyboard, expose correct ARIA state (expanded/collapsed, current selection), and move focus predictably on open/close. The desktop bar shall retain its existing roving arrow-key navigation and tab/tabpanel semantics.

> **NFR-02 — WKWebView compatibility:** Every interactive control introduced (the dropdown trigger and any item buttons) shall set `tabIndex={0}` where it must be keyboard-focusable, because the Tauri WKWebView skips native `<button>` elements in Tab-key navigation.

> **NFR-03 — No initial flash:** The correct layout for the current viewport shall be present on first paint, with no visible switch from one layout to the other after load.

> **NFR-04 — Theming:** All new UI shall use the `var(--sr-*)` design tokens and render correctly in both light and dark themes. No hardcoded colors.

> **NFR-05 — Cross-target parity:** The responsive behavior shall work in mobile browsers (Pi/web access), the desktop Tauri app, and standard desktop browsers.

## Out of Scope
- A bottom tab bar, gestures, or any compact pattern other than the dropdown.
- The native mobile app itself; this is the web/responsive layer.
- Changes to which tabs exist, or to the reorder/hide settings UI in Settings.
- Migrating tab-layout persistence off `localStorage` (pre-existing; unchanged here).
- Redesigning tab content or page layouts.

## Open Questions
- **Breakpoint value.** At what width does the bar collapse to the dropdown? *Default if unresolved by Stage 5:* collapse below 768px (the point at which eight horizontal tabs begin to overflow), refined by The Designer.
- **Control implementation.** Native `<select>` vs. a custom accessible disclosure/menu. *Default if unresolved by Stage 5:* a custom accessible dropdown, so the active tab's icon, theming tokens, and ARIA tab semantics are preserved (a native `<select>` cannot show icons or match the visual language). The Designer/Architect confirm.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Desktop layout unchanged (FR-01) | At ≥ breakpoint width, navigation renders as the horizontal bar identical to current behavior |
| QA-02 | Compact layout appears (FR-02) | At < breakpoint width, navigation renders as a single dropdown control, no horizontal overflow/scroll |
| QA-03 | Live switching (FR-03) | Resizing across the breakpoint switches layouts without reload |
| QA-04 | Active tab preserved (FR-04) | Active tab is identical before and after a layout switch |
| QA-05 | Collapsed shows current tab (FR-05) | Collapsed control displays the active tab's label and icon |
| QA-06 | Dropdown opens to full list (FR-06) | Activating the control reveals all navigable destinations |
| QA-07 | Order and visibility honored (FR-07) | Dropdown lists configurable tabs in saved order, hidden tabs absent, Settings present |
| QA-08 | Selection switches and closes (FR-08, FR-11) | Choosing an item switches tab and closes the dropdown |
| QA-09 | Active item indicated (FR-09) | The open dropdown marks the current destination as selected |
| QA-10 | Settings reachable both modes (FR-10) | Settings can be opened from the bar and from the dropdown |
| QA-11 | Close affordances (FR-11) | Dropdown closes on item select, Escape, and outside click/blur |
| QA-12 | Empty-tabs edge case (FR-12) | With all configurable tabs hidden, dropdown still lists Settings |
| QA-13 | Widen-while-open (FR-13) | Opening the dropdown then widening past breakpoint returns to the bar with no orphaned menu |
| QA-14 | Keyboard + ARIA (NFR-01, NFR-02) | Both layouts fully keyboard operable; dropdown exposes expanded/selected state; new controls focusable in WKWebView |
| QA-15 | No initial flash (NFR-03) | On load at any width, the correct layout paints first with no visible switch |
| QA-16 | Theming (NFR-04) | New UI uses `var(--sr-*)` tokens and is correct in light and dark |
