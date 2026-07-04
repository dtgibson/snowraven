## What We Accomplished

Shipped **v0.5.59** — three improvements across existing tabs, batched into one release:

1. **Named Birds** — each individual's title bar now shows the elapsed span between
   its first and last sighting (e.g. "1 yr. 2 mos.", "5 days") beside the dates.
2. **Calendar** — a new **Species** filter narrows the whole calendar to one species:
   the day count becomes that species' daily presence (or the checklists that recorded
   it), the shading, legend, and popup follow, and the spuh/slash/hybrid toggle goes
   inert while a species is selected. Filtering is by normalized common name, so a
   bird's subspecies/forms fold into the one selectable name.
3. **Map Explorer** — the Nearby Lifers and Media Targets markers gained an always-on
   **locator dot** at their exact point, plus a per-panel **Labels / Dots** toggle so
   bird locations are easy to see. Switching Labels↔Dots is an in-place re-render, so
   the map doesn't jump or close an open popup.

Frontend-only, offline, zero new network calls, providers, or data; privacy unchanged.

## What Has Been Saved

- **Feature commit `ec220ff`, tag `v0.5.59`.** Binaries **LIVE** as a GitHub release
  marked *Latest* (github.com/dtgibson/snowraven/releases/tag/v0.5.59): notarized +
  stapled universal macOS DMG, updater bundle + signature, signed Windows installer +
  signature, `latest.json` for all three platforms. Windows CI run `28693829086`
  (headSha == tag) supplied the installer; the release ran headless on Hephaestus.
- **Records commit `cda2394`** (`chore(pipeline): v0.5.59 closeout — records`):
  `DECISIONS.md` (the per-species-filter semantics + the marker-view-mode-as-prop
  lesson), `PRODUCT_CONTEXT.md` (Named Birds / Calendar / Map Explorer lines revised),
  `ROADMAP.md` (Shipped 92→93), `CLAUDE.md` (one new map convention), and the
  `pipeline/tab-improvements/` artifacts.
- Code: `frontend/src/lib/formatDate.ts`, `components/NamedBirdRow.tsx`,
  `lib/calendar.ts`, `components/Calendar.tsx`, `components/map/NearbyLiferMarkers.tsx`,
  `components/map/TargetMarkers.tsx`, `components/MapExplorer.tsx`, and their tests.
  Version 0.5.59 in both manifests; `CHANGELOG.md`, `docs/HELP.md`, `README.md`,
  `website/` updated. `PRIVACY_POLICY.md` correctly unchanged.
- Verification: full suite **1374 frontend + 178 backend** tests green,
  typecheck / lint / build clean. Security review: **PASSED, 0 findings**.

## Where We Are

Improvement complete — all six Improve-lane stages done and shipped. Pipeline is idle.

## Resume Prompt

To start the next thing, run `/weft` in a Claude Code session in this project. It reads
saved state and picks up fresh.
