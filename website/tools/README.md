# Website tooling

This directory holds two things that share one dependency (Playwright): the
**website screenshot pipeline**, documented below, and the **real-engine
verification gate** in `verify/`, documented at the end.

`package.json` and `package-lock.json` are **tracked**. They were gitignored
until 2026-09-05, which meant Playwright was declared nowhere in this repository
and everything here failed at `createRequire` on a fresh clone. Install with
`npm ci` in this directory.

## Website screenshots

The screenshots on the site (`../assets/shots/*.webp`) are generated from the running
SnowRaven app driven against **synthetic demo data — never real eBird data**. The
published site must never contain anyone's personal sighting locations, which is the
whole point of the demo dataset. Regenerate the shots when the UI changes.

### Prerequisites

```
npm ci                                    # in website/tools
npx playwright install chromium webkit    # webkit is for verify/, below
```

### Steps

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

   **Both capture scripts now enforce this themselves**, before the first frame:
   `assertBackendServesDemoData` in `capture-lib.mjs` reads the export the BACKEND
   is serving (never the file on disk, which proves nothing about what the server
   answered with) and refuses unless every submission id is in the synthetic
   `S9xxxxxxxxx` range. It fails closed on a real export, on a partially
   contaminated one, on an empty one, and on a backend it cannot reach. The guard
   lived only in `capture-appstore.mjs` until the nav-rework security review; the
   script that writes every image on the public website had only the eye-check
   above. Your own eye is still the second layer, not the first.

3. **Capture** (drives the app with Playwright; the live Weather + Tide shot uses a real
   **public** coastal eBird checklist so a tide shows — override with `CHECKLIST=...` if
   the default has aged out):

   ```
   BASE=http://localhost:1620 node capture.mjs        # -> ./shots/*.png
   ```

   **The capture width is load-bearing.** The app has ONE responsive navigation at
   three densities, chosen from the width actually available: a labelled sidebar
   while `viewport - 13.5rem - (the active tab's own sidebar) >= 640`, an icon rail
   otherwise, and a bottom bar at 640px and under. The desktop shots are meant to
   show the sidebar, and the binding case is the Map Explorer, which reserves
   `clamp(240px, 28vw, 300px)` for its own sidebar and therefore needs about
   1,156px; every other tab needs about 856px. `DESKTOP_VP` is 1600 for that
   headroom. Dropping below the threshold does not fail loudly, it quietly
   photographs the rail, so check the images. (Until the nav rework this width
   was defending a different line entirely, the old tab strip's ~1,457px collapse
   into a dropdown; that threshold no longer exists.)

   The App Store captures inherit the same rule and land on both sides of it by
   design: the iPhone viewport (440px) gets the bottom bar, and the iPad one
   (1032px) gets the sidebar on every tab except the Map Explorer, where the map's
   own sidebar puts it into the rail. `selectTab` reads a control's `aria-label`
   when it has no visible text, which is what makes it work in the rail.

   The Statistics escapee pass is answered from the demo dataset itself (a shared
   stub in `capture-lib.mjs`, also used by the App Store capture). The demo's
   submission ids are synthetic and above eBird's live allocation, so a real
   lookup 404s and the tab would correctly render "eBird could not be reached" —
   an honest state, and not what the site should show. The stub is installed
   only on the three Statistics contexts, because registering any Playwright
   route on a context, whatever its pattern, cancels every cross-origin `<img>`
   load in it, which is exactly what the eBird and Birds of the World glyphs
   beside species names are; installed on every context it photographed empty
   glyph slots on Species Detail, Breeding Codes, Multimedia and Named Birds.

   If `backend/.env` carries no usable OpenWeather key, add `WEATHER_REPLAY=1`
   to serve the weather shot from the app's stored replay result instead of a
   live call. Note that unlike the App Store capture, the website weather shot's
   frame INCLUDES the "Offline: showing the last loaded result" cue, so a replay
   capture is only suitable if you then frame or trim it out. The committed
   `weather.webp` was captured live; leave it alone unless you have a working
   key. The run fails rather than publishing a "Weather data unavailable" frame.

4. **Optimize** into the WebP assets the site serves:

   ```
   node process-img.mjs                               # -> ../assets/shots/*.webp
   ```

Then review the site, update any feature copy in `../index.html`, and commit
`website/` (the `demo-data/`, `shots/`, and `node_modules/` here are git-ignored).

### App Store screenshots

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
  `CHECKLIST`). Unlike `capture.mjs` it does **not** strip the attribution
  lines, but as of v1.0.4 it does **unwrap their anchor markup**:
  `<a href="...">SnowRaven</a>` becomes `SnowRaven`. The app's output box shows
  exactly what goes on the clipboard, and eBird renders HTML in checklist
  comments, so the raw tags are correct in the app and read as a rendering bug
  in a store listing. Unwrapping keeps BOTH attributions in full, including the
  provider-required NOAA CO-OPS credit, and shows the text a birder actually
  ends up with once the block is pasted. Nothing is removed. `capture.mjs`
  still strips those lines outright for the website shot, which is why the two
  scripts differ here.

The reviewer demo dataset hosted at `../demo/` (see `appstore/REVIEW_NOTES.md`)
is the same generator's output: after changing `gen-demo-data.mjs`, re-run it
and copy `demo-data/ebird-backup.csv` and `demo-data/ml-export.csv` over
`../demo/snowraven-demo-ebird-backup.csv` and
`../demo/snowraven-demo-ml-export.csv` in the same edit.

## The real-engine verification gate (`verify/`)

Three harnesses that measure claims vitest and jsdom structurally cannot see: a
tab order, a real accessibility tree, and laid-out geometry at 320px and 200%
in-app text scale. Both engines, every run -- WebKit is what the shipped Mac,
iPhone and iPad apps run.

```
(cd ../../frontend && npm run build)
npm run verify                     # this repo's frontend/dist
npm run verify -- /some/other/dist
```

CI runs exactly this, in `pipeline.yml`'s frontend job right after
`npm run build`, with the job bounded by `timeout-minutes`.

**A `verify-*.mjs` file in this directory IS a harness.** The runner discovers
them from disk rather than from a list, so a new one cannot be silently unrun
while the summary keeps printing a confident `N/N green` over a denominator that
shrank. The list in `run.mjs` sets the ORDER of the ones it names, and nothing
else; a name in it that is not on disk fails the run. Each harness is also
bounded at 180 s (`SR_VERIFY_TIMEOUT_MS` to override), and a timeout is a
failure, never a skip.

| file | what it measures |
|---|---|
| `verify-webkit-tab-premise.mjs` | whether WebKit's default tab mode skips a plain `<button>`/`<a href>` and visits one carrying `tabindex="0"` -- the platform fact the app-wide `tabIndex={0}` rule rests on |
| `verify-palette.mjs` | the command palette's focus containment, tab stops, live region, arrow clamping and 320px/200% geometry |
| `verify-backlog-alert.mjs` | the Weather backlog's load-failure live region, idle and populated, out of a real accessibility tree |
| `serveDist.mjs` | shared apparatus: a loopback static server over a built `dist` |
| `playwright.mjs` | the one place Playwright is resolved, and the availability check the runner gates on |

**A skip is never silent, and with `CI` set it is not a skip.** If Playwright or
its browsers are missing, `npm run verify` prints an unmissable banner and exits
0 locally, and exits **1** when `CI` is set. A gate that skips quietly reports
"not run" as "verified", which is the shape `.claude/rules/testing.md` names as
worse than having no gate at all.

**Apparatus is overridable; a scenario is not.** `SR_VERIFY_DIST` and a first
positional argument set the dist, and `SR_VERIFY_BASE` points `verify-palette.mjs`
at an already-running server instead of its own. `verify-backlog-alert.mjs`
deliberately takes no base override: its stub backend (a stored eBird backup
whose bytes will not come back) *is* what it measures, so pointing it at another
server would silently measure a different state.

`verify-backlog-alert.mjs` also has an `--expect-broken` mode that inverts its
exit code, for re-proving it discriminates against a build that lacks the fix:

```
node verify/verify-backlog-alert.mjs /path/to/pre-fix/dist --expect-broken
```

Eleven other harnesses remain hand-run under `pipeline/`: the ten `nav-rework`
printers (no exit codes, hardcoded to a dev server nothing in the repo starts)
and `verify-design.mjs` (drives a per-build mockup that has no meaning once the
build ships). Promoting them is its own build; see `ROADMAP.md`.
