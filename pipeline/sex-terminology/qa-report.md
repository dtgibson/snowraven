# QA Report — Sex Terminology (v0.5.65)

**Date:** 2026-07-05 · **Runner:** vitest + production build · **Result:** PASSED

Pure display-only terminology swap ("Gender" → "Sex" in the Statistics Media
card + the docs/record that echo it). No data, logic, token, filter, or
behavior change.

## Verification (independent ground truth)
- `npx vitest run` (Engineer) — **119 files, 1469 tests, all passing**;
  `MediaStatsSections.test.tsx` (10 tests) passes against the new
  "Photos Tagged With Age or Sex" string (re-run independently, green).
- `npm run typecheck` / `npm run lint` / `npm run build` — clean.
- Grep: **zero** user-facing "gender" remains in `frontend/src`, `README.md`,
  `docs/HELP.md`, `website/index.html`, `PRODUCT_CONTEXT.md`. Historical/dated
  records (CHANGELOG v0.5.22 entry, DECISIONS, the media-glance bug-brief) keep
  the original word verbatim, as intended.
- The three Media-card strings confirmed swapped: SubLabel "…Age or Sex", donut
  `title="Sex"`, note "…and sex for…". Variables (`sexedInd`/`sexMix`),
  `SEX_COLOR`, and the male/female/unknown segment labels untouched (already
  correct).
- Version 0.5.65 in both manifests + the website version pill/footer.

## Acceptance
The word "sex" (source-canonical, matching the eBird/ML field) now appears
everywhere the app previously said "gender" for male/female birds. Data model
already used "sex", so behavior is unchanged.
