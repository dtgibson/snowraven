## What We Accomplished

Shipped **v0.5.58** — a brand-new **Calendar** tab. It lays out a birding year as
twelve monthly grids (like a wall calendar's pages), each day carrying a number:
the species you saw that day, or the checklists you reported (a toggle). Days are
shaded by relative volume with a purpose-built deep-green ramp, there's a
colorblind crosshatch mode, and a **Months / Year** toggle flips between the big
month pages and a 3×4 all-months heatmap "year overview." You can page back and
forward across every year you have data, compress all years into one combined
view, and click any day for a popup with that day's counts and links to its eBird
checklists. A default-off "count spuh, slash & hybrids" toggle refines the species
number. It's frontend-only, works offline, and adds no new network calls,
providers, or data — another lens on the eBird backup you've already loaded.

## What Has Been Saved

- **Feature commit `60785fd`, tag `v0.5.58`.** Binaries **LIVE** as a GitHub
  release marked *Latest* (github.com/dtgibson/snowraven/releases/tag/v0.5.58):
  notarized + stapled universal macOS DMG, updater bundle + signature, signed
  Windows installer + signature, and `latest.json` for all three platforms
  (`darwin-aarch64` / `darwin-x86_64` / `windows-x86_64`). Windows CI run
  `28686932793` (headSha == tag) supplied the installer; the release ran headless
  on Hephaestus.
- **Records commit `a3cf3a5`** (`chore(pipeline): v0.5.58 closeout — records`):
  `PRODUCT_CONTEXT.md` (Calendar tab added), `ROADMAP.md` (Shipped 91→92; Up Next
  unchanged — off-roadmap request), `DECISIONS.md` (the calendar decisions),
  `CLAUDE.md` (two new conventions: the text-on-fill contrast rule and the
  DOM-vs-map texture split), `pipeline/design-system.md` (the `--sr-cal` ramp
  pattern), and the `pipeline/calendar-tab/` artifacts.
- Code: new `frontend/src/lib/calendar.ts`, `lib/calendarTextures.ts`,
  `components/Calendar.tsx` and their tests, `lib/calendarContrast.test.ts`; edits
  to `App.tsx`, `lib/tabLayout.ts`, `globals.css` (`--sr-cal-1..5` + `--sr-cal-fg`),
  and the `entryChunk`/`tabLayout` tests. Version 0.5.58 in `frontend/package.json`
  + `src-tauri/tauri.conf.json`; `CHANGELOG.md`, `docs/HELP.md`, `README.md`, and
  `website/` all updated. `PRIVACY_POLICY.md` unchanged (correctly — no new data
  leaves the device).
- Verification: full suite **1351 frontend tests + 178 backend** green,
  typecheck / lint / production build clean, Calendar code-split as a ~7.5 KB-gz
  on-demand chunk (no maplibre on first paint). Security review: **PASSED, 0
  findings**. The three named QA gaps flagged during testing (no-re-read spy,
  error phase, popup focus-restore) were closed with mutation-verified tests.

## Where We Are

Feature complete — all nine Feature-lane stages done and shipped. Pipeline is idle.

## Resume Prompt

To start the next thing, run `/weft` in a Claude Code session in this project. It
reads saved state and picks up fresh.
