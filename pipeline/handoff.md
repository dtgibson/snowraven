# Handoff — 0.5.26 BUILT on main; pending Mac release (last live: 0.5.25)

## Where We Are

No active Weft session (`activeFeature: null`, `lastCheckpointStatus: complete`).
**0.5.26 is built on `main` but not yet released** — last live release is
**0.5.25**. `v0.5.26` is tagged and Windows CI is running; once it's green the
release ships from the **Mac** (`./release.sh`).

## What's Ready To Ship — 0.5.26 (Named Birds feature lane)

- **Per-individual map.** Expanding a named bird shows a small map of everywhere
  that individual has been seen, drawn like the Species Detail map. The map is now
  a single shared `SightingsMap` component used by **both** Named Birds and Species
  Detail (new `SightingsMap.tsx`, `lib/sightingMarkers.ts` + tests,
  `NamedBirdRow.tsx`).
- **Location per report.** Each sighting shows its location between the date and
  the checklist link.
- **Sorting.** Options are now Name (Individual) / Alphabetical / Taxonomic /
  Last Seen.
- **Readability polish.** Higher contrast, name + species on a shared baseline,
  each comment in its own quoted block, cards open one at a time.

Chronicled (PRODUCT_CONTEXT / DECISIONS / CHANGELOG) + a product-brief refresh on
the VM. Version bumped to 0.5.26 (`frontend/package.json` + `src-tauri/tauri.conf.json`).
Website bumped to 0.5.26 on the VM.

**Verified on the Mac:** build clean, **692** frontend tests + **102** backend
tests green.

## To Ship (on the Mac)

1. Wait for the **`v0.5.26`** Windows CI run to go green (in progress).
2. `./release.sh` — builds + notarizes the macOS universal bundle, fetches + signs
   the CI Windows installer, writes `latest.json` (all 3 platforms).
3. Health-check: release assets present, `latest.json` version 0.5.26, both macOS
   arches → the one universal bundle, Windows → `-setup.exe`, every updater URL
   HEAD 200.
4. Set `releasedVersion: 0.5.26`, refresh this handoff + `session-state.json`.

## Machine boundary (standing rule)

- **Ubuntu VM — all dev work** (coding, content/assets incl. website + demo
  screenshots, pushing the `vX.Y.Z` tag).
- **Mac — only signing and shipping** (`./release.sh` needs Xcode + Apple creds).

> The VM keeps pushing while a Mac session is open — re-pull before editing the
> pipeline files, and treat the VM's commits as authoritative on conflict. The VM
> typically does NOT update `handoff.md` / `session-state.json` narrative fields,
> so they need correcting Mac-side each release.

## Roadmap — Up Next (build on the VM)

- Mobile app
- Accessibility / clarity / simplification
- Windows code signing (remove the SmartScreen "unknown publisher" prompt)
