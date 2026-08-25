# Website screenshot tooling

The screenshots on the site (`../assets/shots/*.webp`) are generated from the running
SnowRaven app driven against **synthetic demo data — never real eBird data**. The
published site must never contain anyone's personal sighting locations, which is the
whole point of the demo dataset. Regenerate the shots when the UI changes.

## Prerequisites

```
npm install playwright sharp
npx playwright install chromium
```

## Steps

1. **Generate the demo dataset** (a fictional birder at well-known public northeast-US
   hotspots; deterministic):

   ```
   node gen-demo-data.mjs        # -> ./demo-data/{ebird-backup,ml-export}.csv + metadata + map-defaults
   ```

2. **Run SnowRaven against the demo data — not your real data.** Build the frontend so
   the backend serves it, then start the backend with `SR_DATA_DIR` pointed at the
   demo dataset:

   ```
   (cd ../../frontend && npm run build)
   DEMO="$PWD/demo-data"
   (cd ../../backend && SR_DATA_DIR="$DEMO" .venv/bin/uvicorn main:app --port 1620)
   ```

   Capture the path into `DEMO` first: `$PWD` has to be read here in
   `website/tools/`, before the `cd`, and an environment prefix cannot be applied
   to a subshell (`VAR=x (cd … && …)` is a syntax error in both bash and zsh), so
   the assignment goes inside the parentheses.

   `SR_DATA_DIR` (see `backend/datadir.py`) overrides the data directory for every
   backend route that reads it — uploads/status, the generic settings store, map
   defaults, and the taxonomy disk cache. **Your real `data/` is never moved, copied,
   or touched.** Earlier versions of this file told you to `mv ../../data
   ../../data.real` and move it back afterwards; do not do that. A crash or an
   interrupted capture between the two commands leaves your real eBird export
   stranded under a name nothing looks for.

   Sanity-check before capturing: the app should show the demo birder's data (a few
   hundred species at northeast-US public hotspots), not yours. If you see your own
   sightings, `SR_DATA_DIR` did not take — stop and fix that first, because the
   published screenshots would otherwise contain your real locations.

3. **Capture** (drives the app with Playwright; the live Weather + Tide shot uses a real
   **public** coastal eBird checklist so a tide shows — override with `CHECKLIST=...` if
   the default has aged out):

   ```
   BASE=http://localhost:1620 node capture.mjs        # -> ./shots/*.png
   ```

4. **Optimize** into the WebP assets the site serves:

   ```
   node process-img.mjs                               # -> ../assets/shots/*.webp
   ```

Then review the site, update any feature copy in `../index.html`, and commit
`website/` (the `demo-data/`, `shots/`, and `node_modules/` here are git-ignored).

## App Store screenshots

`capture-appstore.mjs` is a second consumer of the same pipeline (shared
helpers in `capture-lib.mjs`). It captures the committed App Store screenshot
sets from the same demo-data-backed instance — steps 1 and 2 above are
identical, then:

```
BASE=http://localhost:1620 node capture-appstore.mjs   # -> ../../appstore/screenshots/{iphone-6.9,ipad-13}/*.png
```

- Six shots per device family, in the listing order (Map Explorer with the
  Jamaica Bay popup open, Statistics, Weather & Tide, Calendar, Species
  Detail, Breeding Codes), light theme.
- Sizes: iPhone 6.9-inch `1320x2868` (viewport 440x956 at scale 3) and iPad
  13-inch `2064x2752` (viewport 1032x1376 at scale 2) — the one required size
  per family App Store Connect accepts and scales down (re-verify the
  accepted-size list at submission time; the constants and their reasoning
  live at the top of `capture-appstore.mjs`).
- Output is PNG (what ASC accepts); `process-img.mjs` is not part of this
  path. Every image is dimension-verified after capture and any failed shot
  fails the run.
- The PNGs are **committed** under `appstore/screenshots/` (unlike this
  directory's git-ignored `shots/`), so the listing set is reviewable and
  regenerable. Re-run when the photographed UI changes, review every image by
  eye (demo-data names only), and commit the new set.
- The weather shot performs a live lookup (real public coastal checklist via
  `CHECKLIST`) and, unlike `capture.mjs`, does **not** trim the attribution
  lines: an App Store screenshot shows the app's real output, untouched.

The reviewer demo dataset hosted at `../demo/` (see `appstore/REVIEW_NOTES.md`)
is the same generator's output: after changing `gen-demo-data.mjs`, re-run it
and copy `demo-data/ebird-backup.csv` and `demo-data/ml-export.csv` over
`../demo/snowraven-demo-ebird-backup.csv` and
`../demo/snowraven-demo-ml-export.csv` in the same edit.
