## weather-capture-test-height

### What this does

Fixes the one failing row in `website/tools/weather-capture.test.mjs`. It still expected the Weather screenshot at 1080x2021 and an alt mentioning "a tide block", though the approved 1.0.33 reframe (`bbb2c6b`) made the shot 16:9 at 1080x606 and dropped the tide from the alt. The row now compares the asset's real size, read with sharp, to the size `website/index.html` declares for that figure, so an approved recapture that lands with its markup keeps it green. Its alt check now asks for a non-empty alt, not specific wording. Test-only: the app, the image and `website/index.html` are unchanged.

### How to test

1. `cd website/tools && npm ci && npm test`: 13 tests, 13 pass (before: 12 pass, 1 fail, `606 !== 2021`).
2. `cd frontend && npx vitest run src/lib/websiteFigureDimensions.test.ts`: 6 of 6 pass.
3. To see the row discriminate, on a scratch copy only (never the real files): change the Weather `<img>`'s `height="606"` in a copied `index.html`, or resize a copied `weather.webp`, and run the copied test. The row goes red and names both sizes. Move both together and it stays green.

### Notes for reviewer

- **Derived, not pinned.** The row reads the asset with sharp and the `<img>`'s declared `width` and `height` from the figure, then `deepEqual`s them (CLAUDE.md guard rule (5): compare two declarations of one number, never restate the literal). The width was derived too: it was not stale, but it was the same kind of literal. Structural checks stay: the figure exists, its `<img>` points at `assets/shots/weather.webp`, and both declared values are positive integers. A missing figure or attribute fails with its own message rather than passing over nothing.
- **Renamed.** It is now "the published Weather asset and its scoped markup declare the same size". The old id is the only entry in `pipeline/baseline-failures.json`.
- **Alt: presence, not wording.** The alt is approved published copy, and the user approved the current one at 1.0.33. A pinned phrase is one more copy of that prose to go stale unseen, which is what "a tide block" did. The row requires a non-empty alt only. The first draft matched `alt="[^"]*\S[^"]*"` in place, and mutation showed `\S` can match the closing quote, so an empty alt passed. It now captures the value and tests it.
- **Overlap kept on purpose.** `frontend/src/lib/websiteFigureDimensions.test.ts` holds every figure's size to its file in CI with a pure-JS WebP parser. This row is the independent sharp-side read for the Weather figure. That suite pins size and aspect only. Neither pins the alt's wording.
- **Why it sat red for 12 days:** CI installs `website/tools` but runs only `npm run verify`, never `npm test`. Adding `npm test` to `.github/workflows/pipeline.yml` is out of scope: `capture-marks.test.mjs` drives Playwright Chromium and has never run on Ubuntu.
- **Mutation-checked** on a scratch mirror, with the real `index.html` and `weather.webp` hashed before and after (unchanged), 13 of 13 as expected. Each turned the row red: markup height or width off by one, markup back to 2021, asset resized with markup unchanged, figure renamed, `height` removed, `src` pointed at another asset, alt emptied, whitespace-only or removed. Each stayed green: the unmutated control, asset and markup moved together to 1000x561, and a reworded alt. Table in `decisions.md` section 7.
- **No version bump, no changelog line.** Dev-only, and the shipped app is byte-identical. A push redeploys Pages because the file is under `website/**`, but the site's visible content does not change.
