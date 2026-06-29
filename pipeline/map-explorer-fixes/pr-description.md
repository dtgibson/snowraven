## Map Explorer Fixes (v0.5.48)

### What this does
Five Map Explorer improvements:
1. Long county names no longer overflow the county-shading popup — the name header
   wraps (reusing `sr-wrap-anywhere` + `min-width:0`), matching the other popups.
2. Sharper county boundary lines — geometry regenerated at 10% keep (from the same
   Census 500k source); the on-demand chunk goes ~310 KB → ~751 KB gz.
3. The county popup count is now clearly labelled as **checklists** (not individual
   birds): a "by your checklist count" caption, per-row tooltips, headline-stat
   tooltips, and the toggle renamed "Records" → "Checklists".
4. The county shading scale widened from 4 to **10 data-driven quantile steps** so
   well-birded counties separate; new `--sr-county-5..10` tokens (contrast-guarded).
5. A chevron disclosure collapses the four "… in view" lists (Sightings/Hotspots/
   Targets/Lifers), reusing the Filters / Counties-in-view pattern.

### How to test
- Map Explorer → County lines on → Shade by species seen.
- Click a county with a long name (e.g. an AK census area) → name wraps, ↗ stays attached.
- Read the popup count → "by your checklist count", tooltips clarify "not individuals".
- Legend shows up to 10 ascending ranges; adjacent well-birded counties are distinguishable.
- Each panel's "… in view" header has a chevron → collapses/expands; count stays in the header.

### Notes for reviewer
- County geometry: `scripts/build-county-boundaries.mjs` SIMPLIFY_PCT 2.5% → 10%,
  size guards raised; `frontend/src/assets/us-counties.json` regenerated (public-domain
  Census CB 500k, 3,144 counties). Off the entry chunk (entryChunk.test.ts still green).
- 10-step ramp is geometric-luminance spaced; every adjacency ≥1.212:1 (countyContrast.test
  extended to tiers 1..10). Both themes identical (basemap-anchored).
- Popup stays escaped JSX (NFR-08). No new network calls, no new providers.
- Full CI mirror green: lint, typecheck, 1163 tests, build.
