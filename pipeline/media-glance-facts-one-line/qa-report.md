# QA Report — media-glance-facts-one-line

**Date:** 2026-06-10
**Test Runner:** vitest
**Result:** PASSED

## Test Suite Results

673 tests passing, 0 failing (49 files). Typecheck, lint, and production build
clean. 656 tests at session start → 17 added across the stats, formatting,
parsing, and component layers.

## Acceptance Criteria Verification

From the approved bug brief plus the two user-approved scope revisions
(everything-in-tiles + streak dates + archive span; busiest-day checklist link):

| Criterion | Result | Notes |
|---|---|---|
| Busiest day & longest streak are grid tiles again | ✓ Pass | User-verified in browser |
| Every tile reserves the sub-line slot (equal heights at any width) | ✓ Pass | Component test asserts 3 spans per cell; reserveSub on all 8 tiles |
| No floating caption below the grid | ✓ Pass | Component test asserts absence |
| Longest streak shows the dates it ran | ✓ Pass | Pref-aware compact range |
| Archive span tile (length over first-to-latest range) | ✓ Pass | |
| Busiest-day date links to that day's checklist | ✓ Pass | Dominant checklist when several; plain text when ids absent/junk |
| BirdingStats tiles unaffected | ✓ Pass | reserveSub defaults off; reviewer-verified all StatCell usages |
| Full suite + typecheck + lint + build green | ✓ Pass | |

## Adversarial Review (5 lenses, 19 agents)

14 raw findings → 6 confirmed by skeptics (5 distinct), 8 refuted. All five
confirmed issues were fixed and regression-tested in this stage:

1. **Streak dedup regression** (low) — the rewritten streak loop no longer
   deduped distinct date keys landing on the same day, splitting streaks on
   non-canonical export dates. Fixed: day-number dedup restored.
2. **Out-of-range dates rolled over** (low) — `dayNumber` accepted "2024-13-05"
   / "2024-02-00" via Date.UTC rollover while `formatDate` rejects them,
   so a tile could lose its sub-line (breaking uniform height) or render an
   empty link. Fixed: range check matching `parseParts`; such rows are undated.
3. **Checklist id not shape-validated** (low ×2, two lenses) — every other
   ebird.org/checklist link site gates on `/^S\d+$/`; the new link didn't, so
   column junk ("N/A") became a styled 404 link. Fixed: ids validated at tally.
4. **aria-label hid the date** (medium) — the accessible name replaced the
   visible date, violating WCAG 2.5.3 (Voice Control users couldn't activate
   the link by its visible text). Fixed: label now begins with the date;
   test asserts it.
5. **Link undocumented** (low) — CHANGELOG 0.5.25 entry and the HELP.md
   At a glance bullet now describe it.

Belt-and-braces from the same pass: `StatCell` renders the reserved slot for
empty-string subs too (`sub || nbsp`), and all three date-bearing tiles pass
`reserveSub` + `|| undefined` fallbacks so a blank sub can never collapse a row.

## Edge Cases Tested

Rollover/garbage dates, duplicate same-day keys, junk checklist ids, ties in
the dominant-checklist tally (deterministic), single-dated and undated archives,
1-day streaks, formatDateRange across all three date-format preferences and
boundary spans for formatSpanLength.

## Known Limitations

- When a busiest day spans several checklists, the link opens the one with the
  most media (tooltip explains); a per-checklist breakdown was out of scope.
- Out-of-range export dates are now excluded from the date stats entirely
  (previously they silently rolled onto a neighboring day).
