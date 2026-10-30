## App Store listing polish: composed screenshot sets, and an iPhone Duo set

### What this does
The App Store screenshots go from bare captures to composed frames. Each capture becomes a rounded card on SnowRaven's dark green band, under the tab's name, with one line saying what it shows and the raven mark. A new composer, `website/tools/compose-appstore.mjs`, rebuilds all three sets from committed raw captures. The third set, for the iPhone Duo's inner display (the slot that earns the "Made for iPhone Duo" badge), is taken by the existing capture tool at a new viewport row. Nothing in the app changes.

### How to test
1. `cd website/tools && npm ci && npm test`. This runs 15 tests, two of them the composer's.
2. `node compose-appstore.mjs` rewrites the 18 frames. Afterwards `git status appstore/screenshots` should show no change, because the composer is byte-identical from run to run on the same Mac.
3. On the review page, judge every frame on the light and the dark store pages, plus the captions and the held `LISTING.md` section.

### Seeing it
The review page is `pipeline/app-store-listing-polish/review.html`, served over the tailnet at the URL the Orchestrator gives.

### Notes for reviewer
- **Commit the index on its own first.** It holds exactly the twelve `git mv` renames, all R100: `appstore/screenshots/{iphone-6.9,ipad-13}/` moved to `appstore/screenshots/raw/`. Then commit the rest. The composed sets reuse the old folder names, so a single commit would record the old paths as modified and the raws as new files. `git log --follow` on `raw/` would then stop at this change.
- **Raws.** Six are new: the iPhone Duo set, `raw/iphone-duo/*`. One was recaptured: `raw/iphone-6.9/03-weather-tide.png`, at the page top. The other eleven are byte-identical to the committed captures by sha256, including the iPad Wood Thrush Species Detail frame (v1.0.52).
- **The keyed capture used the v1.0.19 path.**
  - Keys were read from the desktop app's own store.
  - A scratchpad ASGI wrapper exported them and wrote a mode-0600 env file in the scratchpad, outside the repo. It repointed `routers.apikeys.ENV_FILE` at that file and made `load_dotenv()` a no-op, so its parent-directory walk could not reach the main checkout.
  - The backend ran on port 17631 against the generated demo data. The demo guard passed with 368 synthetic checklists.
  - `backend/.env` was never created. The temp file is deleted.
  - A scan of 3,275 files found no key value: the worktree's tracked and untracked files, the ignored capture outputs, and the scratchpad.
  - Weather (live OpenWeather plus NOAA) and Statistics (the keyed, checked state) both captured.
- **Duo capture branches.** The row is `phone: false`. At 669px the app draws the icon rail on every tab, and the map's filters are an in-flow sidebar (the overlay is the 640px tier only), so the non-phone Map Explorer path applies.
  - Breeding Codes is left unscrolled: the code pills, then the matrix from about a third of the way down.
  - The Duo Weather frame keeps the committed "Edit checklist comment" anchor. At 669pt both long tide lines fit their box, and the spec keeps that anchor unless the rail layout clips.
- **Capture script changes.** There is a new `SHOT=` filter so a recapture touches only the frames it names. The iPhone 6.9 Weather recapture used `FAMILY=iphone SHOT=03`. A `FAMILY` or `SHOT` that names nothing now fails the run instead of capturing nothing.
- **One app defect is visible in the new iPhone Weather frame, and it is not fixed here.**
  - The checklist field draws 20px tall instead of 44px at widths of 480 and under, in Chromium and in WebKit.
  - Cause: the 480px tier stacks `.sr-field-row` as a column, and the input's inline `flex: 1 1 0%` basis overrides its inline `height: 44px`.
  - It is in the shipped iPhone app today. It is out of scope here (no `frontend/src` change).
  - The review page shows the page-top frame and the committed mid-page frame side by side, so the user can choose. Follow-up: a phone-tier `flex: none` (or `height`) for that input, with a real-engine check.
- **Renderer.** Playwright Chromium with the mockup's `.fr` CSS copied verbatim. The text is set in the system font (Chromium reports `.SF NS`, SF Pro).
  - Each raw is first reduced with sharp to the card's measured width, so Chromium draws it pixel for pixel rather than resampling.
  - The browser runs with `--force-color-profile=srgb`, and every frame's flat lower corner is checked to read `#0c1f17` exactly.
  - Every output is flattened to 3-channel RGB with no alpha.
- **Deviations from the spec, each a no-op on the geometry:**
  - The mockup's 2.4% frame radius is overridden to 0 in the output, because the store rounds corners itself.
  - The Duo mockup's preview-only letterbox rule is dropped: the real captures have the canvas's exact aspect.
  - Raws are pre-reduced with sharp, as in the spec's sharp-route recipe, rather than scaled by Chromium.
- **Security.** The composer reads only committed files (the raws and the raven master SVG) and its own caption table. It takes no untrusted input. Its one scan, the caption-width measurement, runs over that table, not over user text.
- **CI.** `.github/workflows/pipeline.yml` runs `npm run verify` in `website/tools` but not `npm test`, so the composer's test (like the two existing ones there) runs locally only.
- **Still to do, and not done here:**
  - The `LISTING.md` Screenshots section is a held patch (`listing-screenshots.patch`) awaiting the user's yes.
  - Uploading all three sets, the Duo set being new, whole and in order, is the Deployer's, after the user's yes. That includes re-verifying the store facts and writing the version's disposition in `RELEASE_LEDGER.md`.
  - The Duo Species Detail frame shows Northern Cardinal, because the capture tool hard-codes it (ROADMAP: a species parameter). The iPad keeps its approved Wood Thrush.
