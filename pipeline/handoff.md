## What We Accomplished

Shipped **v0.5.63** — a Calendar-tab refinement that corrects the day-number
placement from the previous release and enriches the day popups. All frontend-only
(offline, no new network, data, or providers):

1. **Day numbers moved to the year-overview.** The big month grids are clean
   again (just shading and a count); the small year-at-a-glance thumbnails now
   carry the day-of-month numbers (hiding on very small cells so they never
   smudge). This is the placement you asked for.
2. **The confusing cross-view link is gone.** Clicking a month in the overview no
   longer jumps you into the other view — switching views is the Compact/Large
   toggle only.
3. **Day popups work in the overview.** Instead, clicking a birded day in the
   overview opens that day's popup right there.
4. **Richer popup rows.** Each checklist in a day popup now shows its start time,
   location, and species count, alongside the eBird link.

The Compact/Large names, and the all-years view's current-year alignment (leap
day included), are unchanged.

## What Has Been Saved

- **Feature commit `026bedf`, tag `v0.5.63`.** Binaries **LIVE** as a GitHub
  release marked *Latest*
  (github.com/dtgibson/snowraven/releases/tag/v0.5.63): notarized + stapled
  universal macOS DMG, updater bundle + signature, signed Windows installer +
  signature, and `latest.json` for macOS (both architectures) and Windows.
  Windows CI run `28727513719` (headSha == tag); released headless on Hephaestus.
- **Records commit `d2627fb`** (`chore(pipeline): v0.5.63 closeout — records`):
  `DECISIONS.md` (an entry logging that this corrects the v0.5.62 date placement —
  reversing v0.5.61's big-cell dates, restoring v0.5.60's thumbnail numbers, and
  removing the cross-view link that had existed since v0.5.58), `CLAUDE.md` (a new
  convention: the Calendar tab stays offline, so location names render as plain
  text rather than through the app-wide hotspot-link), `PRODUCT_CONTEXT.md`, and
  `ROADMAP.md` (Shipped 96 → 97).
- Code: `Calendar.tsx`, `lib/calendar.ts`, `globals.css`, their tests, plus
  `docs/HELP.md`, `README.md`, `website/index.html`, `CHANGELOG.md`, and version
  0.5.63 in both manifests. `PRIVACY_POLICY.md` / `ACCESSIBILITY.md` correctly
  unchanged.
- Verification: full suite **1423 tests** green (re-run independently at each
  preview round and once more after the review), typecheck / lint / build clean;
  an 8-lens adversarial verification returned **0 confirmed findings**; security
  review **PASSED, 0 findings**.

## Where We Are

Improvement complete — all six Improve-lane stages done and shipped. Pipeline is
idle.

Note: this run was developed with you reviewing a live desktop preview across
three rounds (the popup gained day-level access, then time + location, then the
species count).

## Resume Prompt

To start the next thing, run `/weft` in a Claude Code session in this project. It
reads saved state and picks up fresh.
