# Change Brief — Checklist Duration Stat

## What is changing
A "Checklist duration" distribution is added to the Temporal Stats
section of the Statistics tab (BirdingStats.tsx SectionCard ~657):
a histogram of durations in 15-minute bins for the first three hours
(0-15m ... 2h45-3h, 12 bins), then hourly bins (3-4h, 4-5h, ...) up
to the bin containing the longest checklist, plus an average caption
(reuse `effort.avgDurationMin` + `formatDuration`). Rendered in the
section's existing SubLabel + BarRow idiom (the "By start hour"
pattern). The binning is a new pure helper in `lib/birdingStats.ts`
(own function or a `computeTemporal` extension), unit-tested.

## Why now
User's saved idea from the queue, picked for this Spool bundle run:
"add a new stat to show the average duration of a checklist...
broken down by 10 or 15 minute increments for the first three hours,
and then by hour for any longer durations." 15-minute increments
chosen (the idea offers 10 or 15; 15 gives 12 clean first-tier bins).

## User-facing impact
One new stat block inside the existing Temporal Stats card: the
duration histogram + average caption. Semantics: bins are
lower-inclusive half-open ranges; zero-count bins WITHIN the data's
range render as empty-track bars (honest shape), bins beyond the
longest checklist are omitted; null-duration checklists are excluded
from bins and the average, with a muted note of coverage (n of m) or
the section's empty-state idiom ("No duration data in this export.")
when nothing has a duration. Bin labels use hyphen/en dash ranges,
never em dashes. No other surface changes.

## Design pass
Not needed — no visual change to existing surfaces. The block reuses
the section's exact established idiom (SubLabel, Divider, BarRow
rows with label/value/pct, muted empty state, existing `--sr-*`
tokens); no new visual vocabulary, layout, or tokens.

## Decisions touched
- "Birding Stats: protocol breakdown removed from Temporal Stats"
  (2026-05-24): established don't-duplicate-Effort-content-in-
  Temporal without user confirmation. Average duration already shows
  in Effort & Methodology; the user's idea explicitly requests this
  stat in Temporal Stats, which is that confirmation. The
  distribution is new content; only the small average caption
  overlaps the Effort tile. Not a reversal — a user-directed touch.
- "Birding Stats: map, Big Year, and average-observers removed"
  (2026-05-23): precedent-consistent (distribution-over-average was
  the user's own idiom for observers), not touched or reversed.

## What done looks like
`npm run build` + suites green. Unit tests lock the binning helper:
15-min edges, the 3h hourly handoff, longest-bin cutoff, in-range
zero bins present, null-duration exclusion, empty input. Component
render shows the block with labeled BarRows + average caption under
Temporal Stats (jsdom conventions of BirdingStats.test.tsx; no
impure render reads). Bundle-level (once for the whole Spool run,
not per-stat): version bump both files, CHANGELOG, docs/HELP.md
Statistics copy + README/website sync.
