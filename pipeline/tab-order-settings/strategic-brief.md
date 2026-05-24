# Strategic Brief — Tab Order Settings

## What We're Building
A Settings section that lets users reorder and hide SnowRaven's tabs. Preferences apply immediately and persist across sessions, stored in the browser so each person who uses a shared server can have their own layout.

## Why Now
SnowRaven started as a single tool and has grown into an eight-tab birding suite. As users settle into their own workflows — some living in Statistics and Species Detail, others barely touching List Comparer — the fixed tab order becomes friction rather than convenience. This is the right time: the product is stable enough that the tab set won't change drastically, so preferences won't go stale.

## The User Problem
Eight tabs is a lot, and not everyone uses all of them. There's no way to put your most-used tab first or hide the ones you never touch. The tab bar reflects the order the app was built, not the order that fits how any particular person actually uses it.

## Success Criteria
- A user can reorder tabs in Settings and see the change reflected in the tab bar immediately
- A user can hide a tab they don't use and it disappears from the bar
- Settings tab cannot be hidden and is always reachable, regardless of position
- Preferences survive page reloads
- A "Restore defaults" button resets everything to the canonical order
- Default order: Weather · Species Detail · Statistics · Map Explorer · Media List · Breeding Codes · Life List Comparer · Settings

## Scope
- Reorder and visibility controls in a new "Tab Layout" section at the bottom of Settings
- Preferences stored in `localStorage` (per-browser, so different people on a shared server get independent preferences — server-side storage would override everyone's layout globally)
- "Restore defaults" button
- Settings tab fixed at the end; cannot be hidden
- Applies immediately without a page reload

## Out of Scope
- Server-side tab preference storage (localStorage is the right choice here — tab layout is a per-user preference, not a shared server setting)
- Per-tab rename or icon changes
- Nested or grouped tabs
- Pinning tabs

## Key Decisions
- `localStorage` rather than the backend `data/` pattern — this is the first UI preference that genuinely varies per person on a shared server; server-side storage would force everyone to use the same layout
- Settings tab is fixed and cannot be hidden; it anchors the end of the bar
- Changes are live — no save/apply button needed; the preference serialises immediately on each interaction
