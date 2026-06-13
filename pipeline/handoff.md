# Handoff — media-sex-age-filters COMPLETE; v0.5.33 pushed to GitHub (release pending from the Mac)

## What We Accomplished

Added Sex (Male/Female) and Age (Juvenile/Immature/Adult) dropdown filters to the Multimedia tab. They compose with the existing media and county/date filters; each species' photo/audio/video counts and the "X of N species" total reflect the active filter, species with no matching media drop out, and the Macaulay Library links carry the filter so a click opens the same subset. A single facet is broad (any female, any juvenile); choosing both targets one kind of bird (a juvenile female), which the Macaulay link also honors. Frontend only, no backend. Ships as v0.5.33.

## What Has Been Saved

- Code: `frontend/src/lib/mediaStats.ts` (`assetMatchesFacet` + `buildCatalogAgeSex`), `frontend/src/components/LifeList.tsx` (the two filters + the facet projection), `frontend/src/components/LifeListTable.tsx` (facet-aware counts + links); tests in `mediaStats.test.ts` + `LifeListTable.test.tsx`.
- Version: `frontend/package.json` + `src-tauri/tauri.conf.json` → 0.5.33; `CHANGELOG.md` entry.
- Records: `PRODUCT_CONTEXT.md`, `DECISIONS.md`, `ROADMAP.md`, `README.md`, `docs/HELP.md`, `website/index.html`.
- Pipeline artifacts: `pipeline/media-sex-age-filters/`.
- **Committed and pushed to `main` from the VM; tag `v0.5.33` pushed** (rebased onto the Mac's "mark 0.5.32 released" commit).

## Where We Are

Feature complete, verified (frontend 877, backend 110, build + security clean), committed, and pushed to `main` with the `v0.5.33` tag (Windows CI building). Pipeline idle. **0.5.32 is already released live.** The release of v0.5.33 is pending from the Mac.

## To Release v0.5.33 (your steps from the Mac)

`main` and the `v0.5.33` tag are on GitHub and Windows CI is running. After CI finishes, run `./release.sh` from the Mac (notarized macOS build + signed Windows installer + `latest.json`).

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
