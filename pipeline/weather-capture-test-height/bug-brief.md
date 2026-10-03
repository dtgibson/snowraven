# Bug Brief: Weather capture test height

## What is broken
One row in `website/tools/weather-capture.test.mjs`, "the published Weather asset and its scoped markup agree on 1080x2021", fails on its own: it expects the Weather screenshot to be 2021px tall and reads 606. The asset is right and the test is stale.
`bbb2c6b` (website-screenshot-sizing, shipped in 1.0.33) reframed the shot to 16:9 (1080x606) and updated `website/index.html` (size and alt) and `capture.mjs`, but not this row.
Three of the row's four assertions are stale (height 2021, the markup's `height="2021"`, and the alt phrase "a tide block"). A run shows only the first, because `assert.equal` stops there.
It went unseen for 12 days because CI installs `website/tools` but runs only `npm run verify`, never `npm test`.

## Steps to reproduce
1. `cd website/tools && npm test`: exit 1, 12 pass and 1 fail, `606 !== 2021` at line 200.
2. `sips -g pixelHeight website/assets/shots/weather.webp` reads 606, and `website/index.html:186` declares `width="1080" height="606"`.
3. A scratch probe of the row's four assertions: width 1080 passes; height 2021, the `height="2021"` markup match and the "tide block" alt match all fail.
4. In `frontend/`, `npx vitest run src/lib/websiteFigureDimensions.test.ts` passes 6 of 6: the asset and markup agree, and the asset is 0.25% off 16:9.

## Expected behavior
The row checks what its title claims, that the published Weather asset and its markup agree. It compares the asset's real size (read with sharp) to the size the markup declares, never to a restated literal (CLAUDE.md, guard rule 5), so an approved recapture cannot turn it red.
The title drops "1080x2021". The alt check stops requiring a tide block, which the user's approved 1.0.33 alt removed on purpose (DECISIONS.md, v1.0.33). Keep a phrase from the current alt or drop the check: the Engineer decides and says why in the test.
It still goes red when the asset and markup disagree, and it fails rather than passing vacuously if the figure is not found.

## Blast radius
Test only: one row in `website/tools/weather-capture.test.mjs`. No app, asset, `website/`, README, App Store or privacy edit; the published asset is correct, so nothing needs the user's yes.
The change is dev-only and leaves the shipped app byte-identical, so there is no version bump and no CHANGELOG.md line (CLAUDE.md, the dev-only rule).
The row overlaps `frontend/src/lib/websiteFigureDimensions.test.ts`, which already holds every figure's size in CI. Keeping it is fine: it reads the asset separately, with sharp, and stays scoped to this capture.
Flagged, not in scope: adding `website/tools`' `npm test` to `.github/workflows/pipeline.yml` (that job already installs Chromium) would catch the next stale row, but how it behaves on Ubuntu has not been measured. ROADMAP.md line 45, item (1), closes with this fix.

## What done looks like
`npm ci && npm test` in `website/tools` exits 0 with 13 of 13 passing, and a red-first mutation (asset and markup made to disagree) turns the row red.
The Tester runs every runner the baseline names, `website/tools` included (testing.md, v1.0.43), and `weft-scope baseline check` shows the old id RESOLVED and the renamed row's id not NEW. The Tester then re-records from that full run, so `pipeline/baseline-failures.json` is left with no failures.
`frontend/src/lib/websiteFigureDimensions.test.ts` stays green.
