# Decisions

Project-level decisions, bug post-mortems, and meaningful reversals recorded here.

---

## Header pinned in expanded view — 2026-05-12

**Bug:** When "Show all" was activated on the Media Life List or Life List Comparer tabs, the SnowRaven header and tab bar remained pinned at the top of the viewport. This wasted space on mobile and produced cluttered print output.

**Cause:** The outer app container used `height: 100vh; overflow: hidden` with the header as `flexShrink: 0`. The tab panels scrolled internally (`overflowY: auto`), so the header never left the screen regardless of scroll position.

**Fix:** `App.tsx` tracks an `isExpanded` boolean. When true, the outer container switches to `minHeight: 100vh` (no overflow clip) and the active tab panel drops its `flex: 1 / overflowY: auto` constraints, letting the whole page scroll normally and the header scroll away. `LifeList` and `ListComparer` notify the parent via `onExpandedChange` callbacks; the parent resets `isExpanded` on tab switch.

**Implications:** Any future tab that adds a "Show all" / expand toggle should follow the same `onExpandedChange` callback pattern.

## ML lookup timeouts — 2026-05-12

**Bug:** Media Life List batch lookups would progress quickly for the first few batches then slow to a crawl or fail entirely with "Couldn't reach the Macaulay Library." The symptom was CDN rate limiting triggered by burst concurrency.

**Cause:** The original implementation fired up to 75 concurrent HEAD requests per 25-ID batch (3 URLs × 25 IDs via `asyncio.gather`). Over many batches the cumulative load tripped the Cornell CDN's rate limiter.

**Fix:** Three changes in combination: (1) `asyncio.Semaphore(8)` at module level caps concurrent CDN connections; (2) CDN probing within each `_detect_type` call is now sequential and Photo-first — most assets resolve in 1 request instead of 3; (3) frontend batch size reduced 25→10 with a 500ms inter-batch delay. Individual batch errors changed from `break` to `continue` so a single failed batch no longer aborts the entire lookup.

**Implications:** The Cornell CDN has undocumented rate limits. Keep outbound concurrency low (semaphore ≤ 8) and batch sizes small (≤ 10) for any future feature that probes it at scale.
