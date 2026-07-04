## What We Accomplished

Shipped **v0.5.60** — three refinements to the Calendar tab, batched into one release:

1. **Total count metric** — alongside Species and Checklists, the Calendar now offers
   **Total count**: each day shaded and numbered by the total individual birds you
   recorded (the eBird count). Paired with the per-species filter, it answers "how
   many of this bird did I record across the year." An "X"/present-not-counted entry
   contributes 0 individuals, matching the Statistics tab's tally so the two never
   disagree.
2. **Large / Compact view rename** — the Months/Year toggle became **Large / Compact**,
   since both show the whole year and only the cell size differs.
3. **Day numbers in the Compact view** — the compact (formerly "Year") mini-cells now
   show each day's count, not just shading, with a legibility floor that falls back to
   shading-only where a cell is genuinely too small.

Frontend-only, offline, zero new network calls, providers, or data; privacy unchanged.

## What Has Been Saved

- **Feature commit `6de8f74`, tag `v0.5.60`.** Binaries **LIVE** as a GitHub release
  marked *Latest* (github.com/dtgibson/snowraven/releases/tag/v0.5.60): notarized +
  stapled universal macOS DMG, updater bundle + signature, signed Windows installer +
  signature, `latest.json` for all three platforms. Windows CI run `28697588995`
  (headSha == tag); released headless on Hephaestus.
- **Records commit `72aa33f`** (`chore(pipeline): v0.5.60 closeout — records`):
  `DECISIONS.md` (the Total-count "X"→0 rule, the Large/Compact rename, the compact
  numbers — extending, not reversing, the prior Calendar entries), `PRODUCT_CONTEXT.md`
  (Calendar line revised), `ROADMAP.md` (Shipped 93→94), `CLAUDE.md` (a new
  container-query legibility-floor convention), and the `pipeline/calendar-refinements/`
  artifacts.
- Code: `frontend/src/lib/calendar.ts`, `components/Calendar.tsx`, `globals.css`, and
  their tests. Version 0.5.60 in both manifests; `CHANGELOG.md`, `docs/HELP.md`,
  `README.md`, `website/` updated. `PRIVACY_POLICY.md` correctly unchanged.
- Verification: full suite **1387 frontend + 178 backend** tests green, typecheck /
  lint / build clean. Security review: **PASSED, 0 findings**.

## Where We Are

Improvement complete — all six Improve-lane stages done and shipped. Pipeline is idle.

One thing to eyeball in the running app once you update: the day numbers in the new
Compact view (they were verified by tests and CSS, not a live pixel render, since the
Calendar needs your eBird data loaded to show).

## Resume Prompt

To start the next thing, run `/weft` in a Claude Code session in this project. It reads
saved state and picks up fresh.
