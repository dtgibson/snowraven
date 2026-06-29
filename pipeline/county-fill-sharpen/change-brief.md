# Change Brief — county-fill-sharpen

## What is changing
Raise the bundled US county geometry's fidelity one notch: increase `SIMPLIFY_PCT`
in `scripts/build-county-boundaries.mjs` above its current `10%` and regenerate
`frontend/src/assets/us-counties.json`. The sharper geometry lets the county *fill*
edge (drawn from this bundled file) hug the true boundary more closely, so the
hair-thin shaded sliver that peeks out from under the crisp basemap-tile county
line at high zoom (county shading ON) shrinks below visibility. This one file drives
both the fill and the below-z9 / offline line fallback, so sharpening it is the
deferred "option D" in a single move.

## Why now
The deferred "A-plus" polish from v0.5.49 — Dave picked the minimal route "to start."
v0.5.49 made the county *lines* crisp (basemap vector tiles, z9+) but left the
bundled *fill* at 10% simplify, so a thin shaded sliver shows at high zoom under the
now-crisp line. Saved as an idea (84ee5f2a); picked up now.

## User-facing impact
None new. The county overlay is unchanged except the shaded-fill edge tracks the
county line more tightly at high zoom and the sliver is no longer perceptible. No new
control, copy, network call, tile provider, or privacy change. The on-demand county
chunk grows somewhat — still off first paint, fetched only when the county overlay is
first enabled, and within the existing 1.3 MB gz budget.

## Decisions touched
- `scripts/build-county-boundaries.mjs` `SIMPLIFY_PCT` tunable + its comment (the
  "10% / ~0.95 MB" figures).
- CLAUDE.md county-overlay notes: the "10%-keep Visvalingam / ~751 KB-gz" figures
  update to the new percentage/size.
- NFR-02 on-demand-chunk budget: NOT raised — the new asset must stay within the
  existing 1.3 MB gz guard, with margin. DECISIONS.md gets a one-line note.

## What done looks like
- `us-counties.json` regenerated at the higher percentage; the script's hard guards
  (>=3000 features, raw <=5.5 MB, gz <=1.3 MB) pass with comfortable margin.
- At z10-12 over a US area with county shading on, the shaded sliver under the county
  line is no longer perceptible; the bundled-line handoff at ~z9 stays clean.
- Full CI mirror green (lint, typecheck, tests, build); entry-chunk guard still shows
  county geometry off the entry chunk.
- Patch version bump (0.5.49 -> 0.5.50): package.json + tauri.conf.json, CHANGELOG,
  docs/HELP, README, website.
