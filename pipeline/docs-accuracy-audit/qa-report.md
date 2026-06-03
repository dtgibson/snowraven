# QA Report — Documentation Accuracy & Completeness Audit

**Date:** 2026-06-02
**Lane:** Improve
**Result:** PASSED

## Nature of change
Content-only edits to `docs/HELP.md` and `README.md`. No code changed.
`HELP.md` is bundled into the app via `HelpDocs.tsx` (`?raw` import), so
a clean production build confirms it still resolves and renders.

## Checks
- Production build (`vite build`): clean — the `?raw` Help import resolves.
- Markdown structure intact (headings, lists, the new sections nest correctly).

## Claim verification (docs vs. code/assets)
| Fix | Claim | Verified against | Result |
|---|---|---|---|
| A1 | App runs on Mac **and Windows** + Pi/web | Windows desktop shipped v0.4.0 (PRODUCT_CONTEXT, release assets) | ✓ |
| A2 | Breeding tiers end at **Possible** (no "Observed") | `breedingCodes.ts` — tiers 4/3 Confirmed, 2 Probable, 1 Possible | ✓ |
| A3 | Files stored locally (desktop) / on server (web/Pi) | `storage.ts` seam; Settings section already states both | ✓ |
| A4 | Theme preference wording platform-neutral | n/a (wording) | ✓ |
| C1 | My Sightings has Species/Breeding/Date/County/Media + Radius | `MapExplorer.tsx` SidebarLabels | ✓ |
| C2 | Desktop-only "Rebuild caches & restart" exists | `Settings.tsx` `RebuildCachesButton` (Tauri-gated) | ✓ |
| C3 | "Check For Updates" footer + `update.sh` flow | App footer updater; `update.sh` | ✓ |
| R1 | Mac build is Apple Silicon only (no Intel DMG) | `release.sh` (single ARCH), `latest.json` darwin-aarch64 only; v0.5.4 assets | ✓ |
| R2 | Security note applies only to Pi/self-hosted | Desktop apps run no server/port (Tauri) | ✓ |

## Regression
- Full frontend build green; no source files touched, so the unit suite
  (266) is unaffected.
- README links unchanged except the corrected Mac-download line; no
  broken/removed anchors.

## Notes
- Live render of the in-app Help can be eyeballed on the dev server
  (Help tab) if desired; not required — markdown is static and the build
  confirms it bundles.
- R1 wording is intentionally provisional: the spun-off Intel/universal
  Mac build task will revise it once an Intel build exists.
