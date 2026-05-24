# PRD — Tab Order Settings
**Feature:** tab-order-settings
**Session:** 001
**Date:** 2026-05-24
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A "Tab Layout" section at the bottom of the Settings tab that lets users reorder and hide tabs in SnowRaven's tab bar. Preferences are stored in `localStorage` and applied immediately; the Settings tab is always visible and always anchored at the end.

---

## User Stories

**US-01** — As a SnowRaven user, I want to reorder tabs so that my most-used tab is first and I don't have to scroll or hunt for it.

**US-02** — As a SnowRaven user, I want to hide tabs I never use so the tab bar feels less cluttered.

**US-03** — As a SnowRaven user, I want my tab layout to be remembered across page reloads so I don't have to reconfigure it every session.

**US-04** — As a SnowRaven user, I want a "Restore defaults" button so I can undo any changes and get back to the original layout.

**US-05** — As a user sharing a server with others, I want my tab preferences to be independent from other people's, so changing my layout doesn't affect theirs.

---

## Functional Requirements

### Tab Layout Controls

**FR-01** — The Settings tab shall include a "Tab Layout" section below the Default Location section.

**FR-02** — The Tab Layout section shall display all user-configurable tabs as a reorderable list. The configurable tabs are, in default order: Weather, Species Detail, Statistics, Map Explorer, Media List, Breeding Codes, Life List Comparer. The Settings tab is not included in this list.

**FR-03** — Each tab row in the list shall include a drag handle for reordering, the tab's display name, and a visibility toggle (eye icon or equivalent) to show/hide that tab.

**FR-04** — Dragging a row shall reorder the tabs in the list; the tab bar shall update immediately to reflect the new order.

**FR-05** — Toggling a tab's visibility to hidden shall remove it from the tab bar immediately. Toggling it back to visible shall restore it at its position in the list.

**FR-06** — The Settings tab shall always be the last tab in the bar and shall not appear in the reorderable list. It cannot be hidden.

**FR-07** — At least one non-Settings tab must remain visible at all times. When only one non-Settings tab is visible, its visibility toggle shall be disabled (not clickable), preventing it from being hidden.

**FR-08** — If the currently active tab is hidden, the app shall automatically switch to the first visible tab in the current order.

**FR-09** — A "Restore defaults" button shall appear in the Tab Layout section. Clicking it shall reset both order and visibility to the default state without requiring confirmation.

### Persistence

**FR-10** — Tab layout preferences shall be stored in `localStorage` under the key `sr-tab-layout`. The value shall be a JSON object: `{ "order": [<tab-id>, ...], "hidden": [<tab-id>, ...] }`, where `order` lists all configurable tab IDs in user-defined sequence and `hidden` lists tab IDs currently toggled off.

**FR-11** — On app load, the stored `sr-tab-layout` value shall be read and applied before the tab bar renders. If the value is absent, unreadable, or contains unrecognised tab IDs, the app shall silently fall back to the default order with all tabs visible.

**FR-12** — Tab IDs used in the stored preference shall be the internal tab identifiers already used in `App.tsx` (e.g. `'weather'`, `'species-detail'`). The Engineer shall use the existing tab ID values — do not introduce new identifiers.

**FR-13** — If a stored preference contains a tab ID that no longer exists (e.g. from a future removal), that entry shall be silently ignored. If it is missing a tab ID that now exists (e.g. a newly added tab), the new tab shall be appended at the end of the visible order.

---

## Non-Functional Requirements

**NFR-01 — Performance:** Reading `localStorage` and computing the initial tab order shall complete synchronously before first render. No async operations required — this must not cause a layout flash.

**NFR-02 — Resilience:** Any `localStorage` read/write error (e.g. private browsing mode with storage blocked) shall be caught silently. The app shall operate with default tab order and no error shown to the user.

**NFR-03 — Accessibility:** Each drag handle shall have an `aria-label` indicating its purpose. Visibility toggles shall have `aria-label` values that describe their current state (e.g. "Hide Species Detail tab" / "Show Species Detail tab").

**NFR-04 — No flash:** Tab order shall be resolved from `localStorage` at module initialisation time (outside the React component), not inside a `useEffect`, so the rendered order is correct on first paint.

---

## Out of Scope

- Server-side storage of tab preferences
- Per-tab renaming or custom labels
- Tab grouping or nesting
- Keyboard-driven drag-and-drop (drag handle + mouse is sufficient for this release)
- Any changes to what the tabs contain

---

## Open Questions

**OQ-01 — Drag-and-drop implementation:** No drag-and-drop library is currently in the dependency tree. Options are: (a) native HTML5 drag-and-drop, (b) add a small library such as `@dnd-kit/core`, (c) up/down arrow buttons instead.

Default assumption if unresolved before Stage 5: use native HTML5 drag-and-drop to avoid adding a dependency. The Designer's mockup may influence this if the interaction proves awkward to express visually.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Default tab order on first load | With no localStorage entry, tabs render in the order: Weather · Species Detail · Statistics · Map Explorer · Media List · Breeding Codes · Life List Comparer · Settings |
| QA-02 | Reorder persists across reload | Drag "Breeding Codes" to position 1; reload page; "Breeding Codes" is the first tab |
| QA-03 | Hidden tab disappears from bar | Toggle "Map Explorer" to hidden; "Map Explorer" tab is absent from the tab bar |
| QA-04 | Hidden tab persists across reload | Hide "Map Explorer"; reload; "Map Explorer" remains hidden |
| QA-05 | Active tab hidden → auto-switch | With "Statistics" active, hide it; app switches to first visible tab |
| QA-06 | Settings tab immovable | Settings tab always appears last; no drag handle or visibility toggle for it in the list |
| QA-07 | Last visible tab protection | With one non-Settings tab visible, its visibility toggle is disabled |
| QA-08 | Restore defaults | After reordering and hiding tabs, click "Restore defaults"; all tabs visible in default order |
| QA-09 | Invalid localStorage graceful | Set `sr-tab-layout` to malformed JSON; reload; app loads with default order and no error |
| QA-10 | Unknown tab ID ignored | Set `sr-tab-layout` with an unknown tab ID; reload; app ignores the unknown ID and loads remaining tabs correctly |
| QA-11 | No first-paint flash | Tab order on first render matches stored preference — no visible reorder after initial paint |
| QA-12 | localStorage blocked | Simulate blocked localStorage (private browsing); app loads with default order and no error shown |
