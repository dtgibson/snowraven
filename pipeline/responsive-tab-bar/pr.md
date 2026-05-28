## Responsive Tab Bar

### What this does
The main tab navigation now adapts to available width. When the tabs fit, it renders as today's horizontal bar; when they would overflow, it collapses into a compact dropdown that shows the current tab and opens to the full list. The dropdown reuses the existing tab order and hidden-tab settings, with Settings pinned below a divider.

### How to test
1. `cd frontend && npm run dev`, open the local URL.
2. At a wide window, confirm the bar looks and behaves as before.
3. Slowly narrow the window: the bar collapses to a dropdown the moment the tabs would overflow — there is no width where tabs are clipped or unreachable.
4. Open the dropdown, pick a tab: it switches and closes. Try Escape and outside-click to close.
5. On the Map Explorer tab in compact mode, open the dropdown: it renders above the map.
6. Toggle dark mode and re-check.
7. Keyboard: Tab to the trigger, Enter/Down to open, arrows to move, Enter to select, Escape to close.

### Notes for reviewer
- Collapse is driven by **measured overflow**, not a fixed breakpoint — this realizes the PRD's "collapse when the bar would otherwise overflow" decision and holds for any tab count or zoom. A hidden probe measures the bar's natural width against the available width via `ResizeObserver`; the decision is made in `useLayoutEffect` so the correct layout paints with no flash.
- The desktop bar keeps its existing `tablist` semantics and roving arrow-key navigation, moved verbatim into `TabNav`.
- The dropdown menu sits at `z-index: 1200` to clear Leaflet's map panes/controls.
- New shared helper `visibleTabs(layout)` removes the duplicated visible-tab computation that was inline in App.

### Files
- `frontend/src/components/TabNav.tsx` (new) — responsive navigation (bar + dropdown).
- `frontend/src/lib/tabLayout.ts` — added `Tab` type and `visibleTabs()` helper.
- `frontend/src/lib/tabLayout.test.ts` — tests for `visibleTabs` (QA-07, QA-12).
- `frontend/src/App.tsx` — builds `navItems`, renders `<TabNav>` in place of the inline bar.
