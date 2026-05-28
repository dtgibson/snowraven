# QA Report — Responsive Tab Bar

**Date:** 2026-05-27
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results
239 tests passing, 0 failing (13 files). TypeScript typecheck clean. ESLint clean on all changed files.

## Acceptance Criteria Verification

| Criterion | Result | Notes |
|---|---|---|
| QA-01 — Desktop layout unchanged | ✓ Pass | Confirmed live at wide width — bar identical to prior behavior. |
| QA-02 — Compact layout appears | ✓ Pass | Confirmed live — single dropdown, no horizontal overflow. |
| QA-03 — Live switching | ✓ Pass | Confirmed live dragging width down/up; no reload. |
| QA-04 — Active tab preserved | ✓ Pass | activeTab state lives in App, unaffected by layout swap; confirmed live. |
| QA-05 — Collapsed shows current tab | ✓ Pass | Trigger shows active icon + label; confirmed live. |
| QA-06 — Dropdown opens to full list | ✓ Pass | Confirmed live. |
| QA-07 — Order and visibility honored | ✓ Pass | Covered by `visibleTabs` unit tests; Settings appended after divider. |
| QA-08 — Selection switches and closes | ✓ Pass | Confirmed live. |
| QA-09 — Active item indicated | ✓ Pass | Accent background + checkmark; confirmed live. |
| QA-10 — Settings reachable both modes | ✓ Pass | Bar (last tab) and dropdown (below divider); confirmed live. |
| QA-11 — Close affordances | ✓ Pass | Item select confirmed live; Escape and outside-click implemented and verified in code. |
| QA-12 — Empty-tabs edge case | ✓ Pass | `visibleTabs` returns [] when all hidden; App appends Settings, so dropdown always lists it. Unit-tested. |
| QA-13 — Widen-while-open | ✓ Pass | On widening, TabDropdown unmounts and its open state goes with it — no orphaned menu. Verified by implementation. |
| QA-14 — Keyboard + ARIA | ✓ Pass | Bar keeps roving-tabindex arrow nav; dropdown trigger has aria-haspopup/expanded, listbox/option roles, arrow/Home/End/Escape handling; trigger and items tabIndex=0 for WKWebView. Verified by implementation. |
| QA-15 — No initial flash | ✓ Pass | Layout chosen in useLayoutEffect (pre-paint) from measured width. Verified by implementation; no flash observed live. |
| QA-16 — Theming | ✓ Pass | All colors via `var(--sr-*)`; shadow via `--sr-card-shadow`. Confirmed live in light and dark. |

## Edge Cases Tested
- The overflow "dead zone" between the old fixed breakpoint and the width where tabs fit — confirmed eliminated live (bar hands off to dropdown exactly when tabs would overflow).
- Dropdown stacking over the Leaflet map (Map Explorer tab) — confirmed the menu renders above the map at z-index 1200.

## Known Limitations
- No DOM/component test environment is configured in this project (tests are pure-function units), so the dropdown's keyboard and ARIA behaviors are verified by implementation and live use rather than automated component tests. Not a blocker; noted for tracking.

## Convention Flags
- Consider establishing a standing pattern: floating overlays (menus, popovers) must use a z-index above Leaflet's map layers (~1000) on any view that can host a map.
