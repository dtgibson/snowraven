# Bug Brief — milestone-badge-dark-contrast

## What is broken
On the Statistics tab, the "Firsts & Milestones" badges are unreadable in dark mode.
The `--sr-milestone-*` tile backgrounds are intentionally near-white in BOTH themes
(globals.css `:root` 142-161 and `[data-theme="dark"]` 305-324 are byte-identical), so on a
dark page the badges glare as bright white tiles. The bird species name is the only badge
element not bound to a milestone token: it inherits global `--sr-text`, which flips to
near-white in dark mode (~1:1 contrast, invisible) on the pale tile. The "Complete!" badge in
Frivolous Lists shares the same tier-1 tokens and is wrong in dark mode for the same reason.

## Steps to reproduce
1. Load an eBird backup with enough species to cross a milestone threshold (10/50/100…).
2. Set the app theme to dark.
3. Open Statistics → "Firsts & Milestones" (Section 2).
4. See bright near-white tiles on the dark page; the species name on each is invisible (the
   number, date, and check stay readable). Light mode renders fine — confirms dark-only.

## Expected behavior
In dark mode the milestone badges have proper dark-tinted tiles (deep green tiers 1–3, deep
amber tier 4) with every text/graphic element re-tuned to remain legible at WCAG 2.1 AA.
Light mode unchanged.

## Blast radius
Chosen approach (scope B): re-tune the dark-theme `--sr-milestone-*` tokens only. Both token
consumers are fixed together because they share the tokens — BirdingStats.tsx milestone badges
(tiers 1–4) and FrivolousListsSections.tsx CompletionBadge (tier 1). No light-mode change; no
global `--sr-text` / `.sr-birdname-*` change; nothing outside the Statistics tab. Likely
token-only (zero component code), pending name-color verification on the dark tile.

## What done looks like
- Dark-mode badges are dark tiles, not white; tiers stay visually distinct (green 1–3, amber 4).
- AA on the dark tile: number (large/bold) ≥3:1; date link + species name (plain, linked, and
  hover/focus accent) ≥4.5:1; white ✓ on its check fill ≥3:1; border ≥3:1.
- Light mode visually unchanged; verified with the project's luminance math (both themes), a
  manual dark-mode look, the full CI mirror (lint/typecheck/vitest/build), and a version bump
  (package.json + tauri.conf.json) with a CHANGELOG entry.
