# Decisions

Project-level decisions, bug post-mortems, and meaningful reversals recorded here.

---

## Header pinned in expanded view — 2026-05-12

**Bug:** When "Show all" was activated on the Media Life List or Life List Comparer tabs, the SnowRaven header and tab bar remained pinned at the top of the viewport. This wasted space on mobile and produced cluttered print output.

**Cause:** The outer app container used `height: 100vh; overflow: hidden` with the header as `flexShrink: 0`. The tab panels scrolled internally (`overflowY: auto`), so the header never left the screen regardless of scroll position.

**Fix:** `App.tsx` tracks an `isExpanded` boolean. When true, the outer container switches to `minHeight: 100vh` (no overflow clip) and the active tab panel drops its `flex: 1 / overflowY: auto` constraints, letting the whole page scroll normally and the header scroll away. `LifeList` and `ListComparer` notify the parent via `onExpandedChange` callbacks; the parent resets `isExpanded` on tab switch.

**Implications:** Any future tab that adds a "Show all" / expand toggle should follow the same `onExpandedChange` callback pattern.
