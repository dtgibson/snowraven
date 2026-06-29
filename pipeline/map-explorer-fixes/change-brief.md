# Change Brief — Map Explorer Fixes

## What is changing
Five Map Explorer improvements, all confirmed Improve-lane (none a new feature):

1. **Popup overflow.** The county-shading popup's county-name header is the only map
   popup missing wrap handling. Add `sr-wrap-anywhere` + `min-width:0` (linked +
   plain branches) so long names wrap with the ↗ icon attached. (`CountyLayer.tsx`)
2. **County line precision.** Geometry is simplified to ~2.5% of source vertices
   (median 12/county) → blocky. Regenerate at **10% keep** (crisp) from the same
   Census 500k source; raise the build script's size guards + the PRD budget.
   (`scripts/build-county-boundaries.mjs`, `frontend/src/assets/us-counties.json`)
3. **Count label clarity.** The popup count is a **checklist** count (one per
   checklist the species was on), never individuals. Add a "checklists" column
   header + per-row tooltip "On N of your checklists", headline-stat tooltips
   ("…not individual birds counted"), and unify the "Records" toggle label →
   "Checklists". (`CountyLayer.tsx`, `MapExplorer.tsx`, `countyShading.ts`)
4. **Shading scale.** Already a data-driven quantile ramp, capped at 4 steps →
   widen to **10 quantile steps** (same algorithm); add green tokens
   `--sr-county-5..10` (both themes), extend the GL fill `match` / fallback / type
   cast + the contrast test. (`countyShading.ts`, `globals.css`, `CountyLayer.tsx`,
   `MapExplorer.tsx`, tests)
5. **Collapse the in-view list.** Add a chevron disclosure (aria-expanded) to the
   four "… in view" lists (Sightings/Hotspots/Targets/Lifers), reusing the shipped
   Filters / "Counties in view" pattern. Expanded by default, count in collapsed
   header, session-only `useState`, per-panel. (`MapSidebarUI.tsx`, `MapExplorer.tsx`)

## Why now
User-reported polish + a requested control on the v0.5.46/0.5.47 county overlay.

## User-facing impact
Sharper lines, clearer popup label, finer shade scale, collapsible list,
non-overflowing popup. Warrants a patch version bump + changelog + HELP/README/
website. The county on-demand chunk grows ~310 KB → ~950 KB gz — off first paint,
fetched only when the county overlay is first opened, then cached.

## Decisions touched
- **v0.5.46 county ramp (4 green steps)** → 10 steps (same quantile algorithm, same
  light→deep green endpoints; finest adjacencies ~1.22:1, at the legibility floor —
  `countyContrast.test.ts` is the guard, extended to tiers 1..10).
- **NFR-02 county-chunk budget (≤400 KB gz)** → raised to ~1.3 MB for sharp geometry
  (the PRD anticipated "a tighter or looser budget"). Update NFR-02 / QA-29 notes.
- **Version:** user-facing → bump to v0.5.48 + changelog + docs/website (confirmed at
  the Deployer gate). Supersedes the still-pending v0.5.47 binary release.

## What done looks like
- No popup overflow at 200% text scale; county lines crisp at zoom 5–9; popup count
  reads clearly as checklists (not individuals); 10-step quantile scale with legible
  adjacent shades (contrast test green); collapse chevron works and is keyboard/inert
  correct on all four lists.
- Full CI mirror green (lint, typecheck, test, build); new tests for the 1..10 ramp,
  the 10-class quantile, and the popup count label.
