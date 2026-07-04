## What We Accomplished

Shipped **v0.5.62** — a Calendar-tab "view clarity" improvement, three changes,
all frontend-only (offline, no new network, data, or providers):

1. **The all-years combined calendar now lays out like the current year.** It
   used to align its weekday columns to a fixed reference year, so a cell's
   position matched no real year — the true cause of the old "all-years shows
   fewer species" confusion. It now aligns to this year's calendar, and the
   leap-day (Feb 29) cell still shows. The counts themselves never changed and
   stay regression-locked; this fixes the layout, not the numbers.
2. **The year-overview thumbnails are clean shading again.** The small
   month thumbnails dropped the day-numbers that had been crowding them (added
   in v0.5.60); exact figures still live in the big month grids and the day
   popup.
3. **The view toggle names were swapped to read the way you'd expect** — the big
   month grids are now "Compact" and the whole-year thumbnail overview is
   "Large."

## What Has Been Saved

- **Feature commit `89e3b9c`, tag `v0.5.62`.** Binaries **LIVE** as a GitHub
  release marked *Latest*
  (github.com/dtgibson/snowraven/releases/tag/v0.5.62): notarized + stapled
  universal macOS DMG, updater bundle + signature, signed Windows installer +
  signature, and `latest.json` covering macOS (both architectures) and Windows.
  Windows CI run `28720531141` (headSha == tag); released headless on Hephaestus.
- **Records commit `a12e098`** (`chore(pipeline): v0.5.62 closeout — records`):
  `DECISIONS.md` (a new entry logging the partial reversals of the v0.5.60 and
  v0.5.61 Calendar decisions), `CLAUDE.md` (a new "use label-agnostic internal
  values for relabelable toggles" convention + two stale-reference fixes),
  `PRODUCT_CONTEXT.md` (the Calendar line), `ROADMAP.md` (Shipped 95 → 96), and
  the `pipeline/calendar-view-clarity/` artifacts.
- Code: `Calendar.tsx`, `lib/calendar.ts`, `globals.css`, their tests, plus
  `docs/HELP.md`, `README.md`, `website/index.html`, `CHANGELOG.md`, and version
  0.5.62 in both `frontend/package.json` and `src-tauri/tauri.conf.json`.
  `PRIVACY_POLICY.md` / `ACCESSIBILITY.md` correctly unchanged.
- Verification: independent ground-truth re-run of the full suite —
  **1410 frontend tests** green, plus typecheck / lint / production build clean;
  a 7-lens adversarial verification pass returned **0 confirmed defects**;
  security review **PASSED, 0 findings**.

## Where We Are

Improvement complete — all six Improve-lane stages done and shipped. Pipeline is
idle.

Note: the "all-years shows fewer species" report from the last two Calendar runs
is now fixed at its root — the combined grid's layout — rather than mitigated by
labels. The per-day counts were correct all along and remain regression-tested.

## Resume Prompt

To start the next thing, run `/weft` in a Claude Code session in this project. It
reads saved state and picks up fresh.
