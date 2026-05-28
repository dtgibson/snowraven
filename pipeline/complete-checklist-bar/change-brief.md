# Change Brief — Complete Checklist Bar

## What is changing
The "complete checklists" percentage is currently displayed at the bottom of the Effort &
Methodology card as a plain text sentence: "82% of checklists reported all species observed
(complete checklists)." It will be:
1. Moved to the top of the card, above Protocol Distribution
2. Displayed as a two-segment bar matching the Protocol Distribution pattern — a filled
   segment (complete, `var(--sr-accent)`) and a muted segment (incomplete,
   `var(--sr-surface-subtle)`) with percentage labels inside each segment when wide enough,
   and a colour-coded legend below

The `effort` computed object will also expose `completeCount` and `allObsCount` (already
computed inside the useMemo but not currently returned) so the legend can show raw counts
alongside the percentages.

## Why now
User request to make the display consistent with Protocol Distribution and improve readability
by surfacing the complete-checklist rate prominently.

## User-facing impact
Visual change to the Effort & Methodology card only. The data is identical; the presentation
improves. No new data is computed or stored.

## Decisions touched
None.

## What done looks like
- Open Statistics tab → Effort & Methodology
- "Complete checklists" bar appears at the top, above Protocol Distribution
- Bar is two segments: filled (accent colour, % complete) and muted (% incomplete)
- Percentage shown inside each segment when ≥8% wide
- Legend row below bar shows "Complete (N)" and "Incomplete (N)" with colour swatches
- The old text sentence at the bottom of the card is gone
