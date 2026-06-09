# Handoff — 0.5.20 (media-statistics-expansion) — BUILT, parked on a branch for the Mac

## What We Accomplished

A new feature, built/tested/CI-green and pushed to the branch
**`feature/media-statistics-expansion`**, undeployed (releases from the Mac).

The Statistics → Media card now goes well beyond the most-photographed/recorded/
filmed lists, reading more of the Macaulay Library export:

- **At a glance** — totals, photo/audio/video split, species documented, busiest
  media day, longest streak, collection span.
- **Documentation coverage** — % of the life list captured with any media / photo
  / audio / video.
- **Format coverage** — how species-with-media break down by format combination
  (shown even without an eBird life list loaded).
- **Age & sex** — two donuts (per individual; Unknown shown honestly; center %
  shares the ring's per-individual basis).
- **Age coverage by species** — which age classes captured per species + an
  only-adults-so-far count.
- **Behaviors documented** — top behaviors, distinct count, and media-backed
  breeding tiers (confirmed / probable / possible).
- **When you capture media** — time-of-day distribution split by format.
- **Community ratings** — distribution + mean + top-rated, auto-hidden below 8
  rated assets.

Verified against the real 2073-asset export (coverage 181/282, 985 rated, dawn
audio peak, etc.). Adversarial review: security/privacy clean; 6 minor findings
(donut dual-basis, dead field, completeness gating, donut contrast, aria zeros,
density) all fixed.

## What Has Been Saved (committed on `feature/media-statistics-expansion`)

- Parser: `frontend/src/lib/parseMLExport.ts` (MLExportRow + reads Age/Sex,
  Behaviors, Time, Year, Month, Average Community Rating, Number of Ratings).
- New: `frontend/src/lib/mediaStats.ts` (+ test), `frontend/src/components/MediaStatsSections.tsx` (+ test).
- `frontend/src/components/BirdingStats.tsx` (wires the new section into the Media card),
  `frontend/src/globals.css` (new `--sr-age-*` / `--sr-sex-*` tokens, both themes).
- Test row builders updated: `lib/mediaComments.test.ts`, `lib/sightingsGraph.test.ts`.
- Demo: `website/tools/gen-demo-data.mjs` populates the new ML columns (synthetic).
- Docs/version: `CHANGELOG.md` (0.5.20), `docs/HELP.md`, `README.md`,
  `frontend/package.json` + `src-tauri/tauri.conf.json` (0.5.18 → 0.5.20).
- Pipeline artifacts: `pipeline/media-statistics-expansion/{ideation,ml-format-findings}.md`.

## Where We Are

Feature lane, paused at **Stage 8 (The Deployer)**. `main` was left clean.

## Deploy (on the Mac)

Two features are parked off `main` (0.5.18): **0.5.19**
(`improve/date-unify-media-comments-hint`) and **0.5.20**
(`feature/media-statistics-expansion`, this one).

1. Release **0.5.19 first**, then 0.5.20. Both branch off 0.5.18 and bump
   version + edit the top of `CHANGELOG.md`, so integrating the second will throw
   a trivial conflict — keep both changelog entries, version `0.5.20`.
2. Per branch: confirm the version in `frontend/package.json` and
   `src-tauri/tauri.conf.json`, push the `vX.Y.Z` tag, wait for Windows CI, then
   run `./release.sh`.
3. **Catch up `website/`** (still v0.5.17): bump the version pill + footer, add
   copy for 0.5.18's Media Comments + date-format picker, 0.5.19's jump-to-comments,
   and 0.5.20's media stats, and **regenerate the demo screenshots** (the demo
   generator now populates Age/Sex/Behaviors/ratings, so the shots will show the
   new Media card). Update `README.md` too. Do this when the features actually ship.
