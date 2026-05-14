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

## Breeding code CSV parser rewritten to handle multiline fields — 2026-05-14

**Bug:** Breeding Codes tab showed "no breeding codes found" for some eBird backup files, even when breeding codes had been entered.

**Cause:** The original parser split the CSV content by newlines (`content.split(/\r?\n/)`) before parsing fields. This broke any row where a quoted field contained an embedded newline — for example, a location name like `"River\nTrail"` entered before the breeding code column. The row would be split across two "lines," the breeding code would land at the wrong column index, and the `BREEDING_CODE_MAP.has()` check would silently fail.

**Fix:** Replaced the line-split approach with a single-pass character iterator (`parseCSV`) that tracks quote state across newlines. Quoted newlines are consumed as part of the field; unquoted newlines end the row. Also strips UTF-8 BOM on first character.

**Implications:** Any future CSV parser in this project should use a full character-level parser, not `content.split(/\r?\n/)`. The line-split approach is incorrect for RFC 4180 CSV files with embedded newlines in quoted fields.

## eBird Breeding Code column stores code + label, not just the code — 2026-05-14

**Bug:** Breeding Codes tab showed "No species with breeding codes found in this file" for every eBird backup file, even when breeding codes had been entered.

**Cause:** eBird stores the full label text alongside the code abbreviation in the Breeding Code column — e.g. `CN Carrying Nesting Material`, not just `CN`. The parser did an exact `BREEDING_CODE_MAP.has()` lookup against the raw cell value, which never matched any of the 23 expected abbreviations.

**Fix:** Split the raw cell value on whitespace and take the first token before the map lookup (`rawCode.split(/\s+/)[0]`). Single-token bare codes are unaffected; full-label values yield the correct abbreviation.

**Implications:** Never assume eBird CSV column values contain only the code abbreviation — inspect actual export data before writing a lookup. The test suite now includes a case using the real eBird format.

## Multi-dimensional filter state uses an object, not a string union — 2026-05-14

**Decision:** The Media List filter state moved from a single `MediaFilter` string union (`'all' | 'no-photo' | ...`) to a `MediaFilterState` object with one key per dimension (`{ photo: 'has'|'no'|null, audio: ..., video: ... }`). The Breeding Codes filter state moved from a single `string` to `Set<string>`.

**Rationale:** A string union encodes only one active selection at a time, which made AND logic across dimensions impossible without a fundamentally different type. The object form makes per-dimension independence structurally enforced and AND logic trivial. `Set<string>` gives O(1) membership testing and naturally prevents duplicates; JSON-incompatibility is not a concern since filter state is never serialised.

**Implications:** Any future filter surface with multiple independent dimensions should use an object (one key per dimension) rather than a string union. Any filter surface that allows selecting from an open-ended set of values should use `Set<string>`.

## ML export as preferred input for Media Life List — 2026-05-12

**Decision:** Offer the Macaulay Library "My Media" CSV export as the primary input method for the Media Life List, with the eBird backup CSV as a secondary fallback. Input type is auto-detected from the CSV header — no user selection required.

**Rationale:** The ML export contains `Format` (Photo/Audio/Video) directly in each row, eliminating the backend CDN lookup entirely. This avoids rate limiting, latency, and network dependency. It also requires no Macaulay Library API keys. The two-zone upload UI makes the preferred path prominent without removing the eBird path.

**Implications:** The ML export path is entirely client-side. The eBird path still requires the `POST /ml/media-types` backend endpoint and batch CDN probing. Both paths share the same `LifeListEntry` type and downstream table/filter components.
