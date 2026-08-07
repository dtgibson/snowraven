# Checklist Duration Stat

## What this does

Adds a "Checklist duration" histogram to the Temporal Stats section of
the Statistics tab. Checklists are binned by duration in 15-minute
half-open bins ([0,15), [15,30) ... [165,180)) for the first three
hours, then hourly bins ([180,240), [240,300), ...) up to and including
the bin containing the longest checklist. Zero-count bins inside that
range render as empty tracks (honest shape); bins beyond the longest
are omitted. A muted caption shows the average duration (the model's
own `avgDurationMin` through `formatDuration`) and, when some
checklists lack a usable duration, an "n of m checklists have a
usable duration" coverage note. When nothing has a duration the block
shows the section's empty-state idiom: "No duration data in this
export."

## How to test

1. `cd frontend && npx vitest run src/lib/birdingStats.test.ts src/components/BirdingStats.test.tsx`
2. `cd frontend && npm run typecheck`
3. Manually: Statistics tab → Temporal Stats → the "Checklist
   duration" block below "By start hour" (see `how-to-see.md`).

## Notes for reviewer

- **Pure model first**: `computeDurationBins(checklists)` in
  `frontend/src/lib/birdingStats.ts` returns
  `{ bins, durationCount, totalCount, avgDurationMin }`. Its
  `avgDurationMin` parallels `computeEffort`'s formula on sane data;
  a unit test locks the two byte-equal on an all-in-range fixture so
  the Temporal caption and the Effort tile agree wherever both count
  the same durations. The UI caption reads the model's own
  `avgDurationMin` (see Security remediation below).
- **Security remediation** (post-review, Medium + Low): the bin
  ladder's length was arithmetic in the single largest duration value
  — one corrupt cell (e.g. a column-shifted ML catalog number like
  999999999 landing in "Duration (Min)") materialized millions of
  bins (~3 GB heap) and crashed the render via a `Math.max` spread;
  negative durations were counted but binned invisibly at a negative
  index. Fix: `computeDurationBins` treats any duration outside
  [0, 1440] (eBird's own 24 h checklist cap) as duration-less —
  excluded from the bins, from `durationCount` coverage, and from the
  average — so the ladder is structurally bounded at 33 bins
  (12 fine + 21 hourly; the terminal [1380, 1440] bin is closed at
  the cap so an exactly-24h checklist stays visible). The caption now
  uses the model's own average so it can never disagree with the
  bars; `computeEffort` and every other shipped stat are deliberately
  unchanged (Effort still counts out-of-range values). Defense in
  depth: the component's `Math.max(...bins)` spread is now a reduce.
  Locked by three new unit tests, including a crash regression on the
  999999999 cell.
- **Bin-edge arithmetic is lower-inclusive**: a 15-minute checklist
  lands in [15,30), a 180-minute one in [180,240). Locked by unit
  tests, including the full 14-label ladder across the 3h handoff.
- **Labels** use a compact internal formatter ("0-15m", "45-60m",
  "1h 45m-2h", "3-4h") — hyphen ranges, no em dashes, distinct from
  `statsFormat.formatDuration`'s spelled units which would be noise at
  bar-label density.
- **UI reuses the section's exact idiom**: `SubLabel` + `BarRow` rows
  (same `--sr-graph-photo` color and `pctOf` share-of-covered
  semantics as "By start hour"), `Divider`, muted empty state. No new
  tokens, no new visual vocabulary. BarRow's existing 0.3s width
  transition is the only motion; the global
  `prefers-reduced-motion: reduce` block in `globals.css` covers it.
- **Purity**: the model is a pure transform; no `Date.now()`/
  `new Date()` in render paths (eslint `react-hooks/purity` clean).
- Component test added inside the existing jsdom file
  (`BirdingStats.test.tsx`), so the docblock + recharts `afterAll`
  flush conventions carry over unchanged.
- Bundle-level items (version bump, CHANGELOG, docs/HELP.md, README,
  website) are deliberately NOT in this change — handled once for the
  whole Spool run by the docs build.

## Files changed

- `frontend/src/lib/birdingStats.ts` — `computeDurationBins` + label
  helpers (new)
- `frontend/src/components/BirdingStats.tsx` — memo + Temporal Stats
  block
- `frontend/src/lib/birdingStats.test.ts` — 8 new unit tests (5 model
  + 3 range-guard/crash-regression from the security remediation)
- `frontend/src/components/BirdingStats.test.tsx` — 1 new component
  test
