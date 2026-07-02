## What We Accomplished

Shipped **County Completeness** as **v0.5.54** — a third county-shading metric on
the Map Explorer that shades each US county by how complete your county list is:
your countable species recorded there divided by everything ever reported for
that county on eBird, on a fixed 0–100% ten-band legend. Clicking a county shows
a band-colored progress bar with counts and percent, your five newest county
birds, and the five top species you're still missing; un-birded counties load on
demand. Per-county results cache for 30 days, so previously fetched counties
still shade offline. This is the first county shading mode that needs network +
an eBird key — disclosed at the point of use and in the docs, degrading honestly
to the app's standard offline / no-key / error states.

## What Has Been Saved

- **Release commit `7e19534`** on `main`, tagged **`v0.5.54`** (both pushed).
  Binaries **LIVE** as a GitHub release marked *Latest*: notarized + stapled
  universal macOS DMG, macOS updater bundle + signature, signed Windows installer
  + signature, and `latest.json` (`darwin-aarch64` / `darwin-x86_64` /
  `windows-x86_64`). Windows CI run `28599029027` (headSha == tag) supplied the
  installer; the release ran headless (`CI=true SKIP_NPM_INSTALL=1 zsh -lc ./release.sh`).
  - Code: `frontend/src/lib/countyCompleteness.ts` (+cache, +hook, +tests),
    `components/map/CountyCompletenessPopup.tsx` (+UI tests),
    `CountyLayer.tsx`, `MapExplorer.tsx`, `MapSidebarUI.tsx`,
    `lib/transport.ts`, `lib/tauri/{mapService,taxonomyService}.ts`,
    `backend/routers/{map,taxonomy}.py` (+tests).
  - Version: `frontend/package.json` + `src-tauri/tauri.conf.json` → 0.5.54;
    `CHANGELOG.md`, `docs/HELP.md`, `README.md`, `website/index.html`,
    `PRIVACY_POLICY.md` (eBird bullet made explicit for county species lists).
  - Pipeline artifacts: `pipeline/county-completeness/` (strategic-brief, prd,
    schema, design-spec, design.html, decisions, qa-report, security-report,
    implementation-notes).
- **Post-release records commit `2b1036e`:** `DECISIONS.md` (fixed % bands;
  online/key trade-off; taxonomic-floor targets with upgrade seam; 0%-stays-unshaded;
  security resolutions; D-401/D-402), `CLAUDE.md` (pydantic `[0-9]`-not-`\d` twin
  rule; caching-layers-by-lifetime; fixed-band parallel path convention),
  `ROADMAP.md` (shipped 89; Horizon: targets ranking, test hardening),
  `PRODUCT_CONTEXT.md` (new top entry), `pipeline/design-system.md` (county ramp
  entry corrected to the ten-step current state).
- Verification: frontend **1240 tests green**, backend **163 green**, lint /
  typecheck / build green; QA 36/36 criteria pass; security passed with notes
  (all fixable findings fixed and test-locked).

## Where We Are

Feature complete — all nine stages done; source, binaries, and records shipped.
Pipeline is idle.

## Resume Prompt

To start the next thing, run `/weft` in a Claude Code session in this project.
It reads saved state and picks up fresh.
