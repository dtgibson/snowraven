# QA Report — accessibility-followups

**Date:** 2026-06-13
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

## Test Suite Results
- **Frontend:** 868 passing, 0 failing (70 files; +11 from the new `ChecklistLink` / `OutboundLink` tests).
- **Backend:** 110 passing, 0 failing.
- `tsc -b` clean; production build clean.

## Change-Brief Criteria Verification
| Criterion | Result | Notes |
|---|---|---|
| All 14 checklist links via `ChecklistLink` (hybrid) | ✓ Pass | full text+icon where roomy; compact for the 4 dense spots |
| All external links carry the new-tab cue (`OutboundLink`) | ✓ Pass | ~20 sites; wording unified to "(opens in a new tab)" across 41 spots |
| `CommentText` display==search invariant preserved | ✓ Pass | cue is an sr-only sibling node, never in `seg.text` |
| Stale Leaflet comments fixed | ✓ Pass | `TabNav` ~297, `atlasBlocks.ts:57` |
| Version 0.5.32 + CHANGELOG | ✓ Pass | `package.json` + `tauri.conf.json` |
| No regressions | ✓ Pass | adversarial review (below); 2 code findings fixed and re-verified |

## Adversarial Review
Four parallel reviewers (correctness / accessibility / visual / completeness), each finding refute-by-default verified. 13 raw → 8 confirmed → triaged:

**Fixed this stage (re-verified green):**
- `TargetMarkers` target popup was migrated full-mode (no `compact`/`label`), surfacing a raw `S…` id instead of the brief's intended icon-only form → reverted to `compact`.
- `ChecklistLink` junk-id fallback rendered an inline `<span>` (vertical margins ignored) → set `display: inline-block` so the rare malformed-id case keeps its spacing.

**Deferred to The Chronicler (Step 6, by design — tracked):**
- `ACCESSIBILITY.md` Known Exceptions still lists F064 / F078 (now shipped) and the Southern-Hemisphere moon phase (shipped 0.5.28) as deferred.
- `DECISIONS.md` deferred block (lines 86–94) still frames F078 / F082 / F106 as not-done; `CLAUDE.md` ChecklistLink adopters/formula line needs updating to the now-complete, label-aware reality.

**Resolved after review (user asked to keep the tooltip):**
- `MediaStatsSections` busiest-day link had lost its "largest checklist of N that day" hint when standardized to `ChecklistLink`. Restored via a new optional `title` pass-through on `ChecklistLink` — the sighted-hover tooltip is back; the screen-reader name stays canonical (WCAG 3.2.4).

## Known Limitations
- Records files (`ACCESSIBILITY.md`, `DECISIONS.md`, `CLAUDE.md`) are intentionally corrected at the Chronicler step, not here. Nothing ships before that step runs.

## Convention Flags
- New shared component behaviors for `CLAUDE.md`: `ChecklistLink` gained a `compact` (icon-only) mode and a label-aware accessible name (leads with the visible label, WCAG 2.5.3); a new `OutboundLink` wrapper is the standard for non-checklist external links (named to avoid the lucide `ExternalLink` icon collision).
- `ChecklistLink` now takes an optional `title` (native hover tooltip) for extra sighted-user context without altering the canonical accessible name.
