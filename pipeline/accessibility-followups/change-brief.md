# Change Brief — accessibility-followups

## What is changing
Finish three deferred accessibility items from the 0.5.31 WCAG pass and correct stale records:

1. **ChecklistLink rollout (F064).** Fold the 14 remaining hand-rolled "open checklist on eBird" links (7 files: `speciesDetail/ui.tsx`, `SpeciesDetail.tsx`, `NamedBirdRow.tsx`, `SightingsMap.tsx`, `MediaStatsSections.tsx`, `map/TargetMarkers.tsx`, `BirdingStats.tsx`) into the shared component. **Hybrid:** full text+icon where there's room (~9 sites); a new `compact` icon-only mode for the 4 dense spots (most-individuals / one-and-done species pills, the "Most species/checklists" location cards, the 60px "N best" year column, the Map Explorer target popup). One accessible name + one visual mark everywhere (WCAG 3.2.4 Consistent Identification).
2. **"Opens in a new tab" cue (F078).** Add the screen-reader cue to the ~20 external links lacking it, via a small shared `ExternalLink` wrapper; wording standardized to "(opens in a new tab)". Screen-reader-only — no visible copy changes. Notable site: the shared comment renderer `CommentText.tsx` (feeds Comparer + Checklists; the cue must stay out of `seg.text` so the display==search invariant holds).
3. **Stale comments.** Reword the "Leaflet panes" comment in `TabNav.tsx` (~line 297) and the "(Leaflet bounds)" tag in `atlasBlocks.ts`. Leave the legitimate historical "replaces the Leaflet-era…" notes in `mapStyle.ts` / `fitBounds.ts` / `heat.ts`.
4. **Records truth-up (incl. F082/F106).** The Southern-Hemisphere moon-phase orientation already shipped in 0.5.28 — this is a docs correction, not code. Fix the wrong "deferred" note in `DECISIONS.md` / `ACCESSIBILITY.md`; correct `CLAUDE.md`'s inaccurate ChecklistLink adopters list.

## Why now
Deferred as Known Exceptions in the 0.5.31 a11y pass; this run closes them. Two records are currently inaccurate (the moon-phase "deferred" note and the `CLAUDE.md` adopters list), and `ACCESSIBILITY.md` is a published statement that must stay true to shipped code.

## User-facing impact
Default: minimal. ~6 spots gain a small external-link icon next to a date/number; the 4 dense spots are unchanged (compact mode preserves their footprint); the 3 already-iconed spots are pixel-identical. Screen-reader users get consistent checklist-link naming and a uniform new-tab warning. No layout or behavior change beyond the added icons. No visible copy change.

## Decisions touched
- `DECISIONS.md` F064 entry — completed (full adoption), not reversed.
- `DECISIONS.md` / `ACCESSIBILITY.md` F082/F106 "deferred" note — corrected; the feature already ships (0.5.28).
- `DECISIONS.md` / `ACCESSIBILITY.md` F078 Known Exception — closed.
- `CLAUDE.md` ChecklistLink adopters list — corrected (currently inaccurate).
- No technical decision overturned; the moon-phase byte-parity trio (ts/py/golden) is untouched (no code change there).

## What done looks like
All 14 checklist links render via `ChecklistLink` (hybrid text+icon / compact); all external links carry the new-tab cue via the shared wrapper; `TabNav`/`atlasBlocks` comments accurate; records (`DECISIONS.md`, `ACCESSIBILITY.md`, `CLAUDE.md`, `CHANGELOG.md`) reflect reality; frontend + backend suites green (with updated assertions for changed accessible names/hrefs); `tsc` and prod build clean; patch version bump to **0.5.32** (`frontend/package.json` + `src-tauri/tauri.conf.json`).
