## screenshot-tool-ebird-icon

### What this does
Both screenshot capture scripts now photograph the real eBird and Birds of the
World marks beside species names instead of the app's fallback Globe and
SquareLibrary glyphs, including on the Statistics frames that carry the escapee
stub route. `makePage` serves the two icons from copies committed in
`website/tools/marks/` through an init script (not a route), so the capture
never requests either icon and keeps its default headless user agent. Every
frame is checked before it is written, and a mark that would photograph as a
glyph, a 0px image, or anything not from the committed copy fails the run.

### How to test
1. `cd website/tools && npm test`. The four new rows in
   `capture-marks.test.mjs` pass. (One existing row, "the published Weather
   asset and its scoped markup agree on 1080x2021", fails on `HEAD` as well; it
   predates this change, see the notes.)
2. Start a backend on a copy of the demo data (the README's step 2), on any
   loopback port.
3. Run `BASE=http://127.0.0.1:<port> node capture.mjs`. Every tab shot logs
   `OK`. Magnify the "First species ever" card in `shots/stats-light.png`: it
   shows the green eBird "e" and the Birds of the World woodpecker, not a Globe
   and a library glyph.
4. Temporarily move one file out of `website/tools/marks/` and rerun: the
   capture refuses before the browser starts, naming the missing file and
   `git checkout -- website/tools/marks/`. Put it back.

Do not run `capture-appstore.mjs` in the repo just to test this: it writes
straight into the committed `appstore/screenshots/`.

### Notes for reviewer
- **Why an init script.** eBird's Anubis filter denies `HeadlessChrome` on
  purpose, and this repo does not get around Cornell's protection. A
  fulfilling route cannot substitute the images (any route cancels cross-origin
  `<img>` loads before its handler runs). The init script rewrites exactly the
  two favicon URLs to `data:` URLs at both `Element.prototype.setAttribute('src')`
  and the `HTMLImageElement.prototype.src` setter; the real-engine test
  mutates each away separately and goes red either way.
- **The icons (user decision, 2026-09-28).** Mirrored in the repo, fetched once
  with a plain `curl -L` using curl 8.7.1's default user agent; eBird answered
  with its icon. Source, date, hashes and purpose are in
  `website/tools/marks/PROVENANCE.md` and `decisions.md`. They are not in any
  app build: Vite builds `frontend/`, Tauri bundles `frontend/dist` with no
  `resources`, and the built dist holds neither file.
- **Open for the user:** `.github/workflows/pages.yml` publishes all of
  `website/`, so on `main` the two icons and the note become reachable on the
  site's host under `tools/marks/`, like the rest of `website/tools/`. Nothing
  links to them.
- **Run failure in `capture.mjs`.** A mark failure (`MarksInFrameError`) now
  joins `requiredFailures`, so the run cannot end on the success banner while
  the previous run's PNG for that frame sits in `shots/`. Other tab failures
  keep their existing log-and-continue behavior.
- **`website/tools/README.md` is not edited** (published-copy rule). Its route
  note is now misleading. Proposed replacement for the sentence beginning "The
  stub is installed only on the three Statistics contexts, because...":

  > The stub is installed only on the three Statistics contexts, because
  > registering any Playwright route on a context, whatever its pattern,
  > cancels every cross-origin `<img>` load in it. The eBird and Birds of the
  > World marks beside species names are not such loads: both scripts serve
  > them from the copies committed in `marks/` (see `marks/PROVENANCE.md`),
  > never request them, and fail any frame that would show a fallback glyph
  > where a mark belongs.

- **Stale records for the Chronicler:** ROADMAP line 59 (part one, "sets a
  normal Chrome user agent", is replaced by this fix; part two, the fail-loud
  check, is done) and line 151 (the Statistics frames' glyph question now has
  its capture-side answer).
- **Pre-existing and untouched:** the Weather dimensions test above expects
  1080x2021 while `weather.webp` has been 16:9 since website-screenshot-sizing;
  on this keyless rig the website Weather shot and the App Store Statistics
  shot fail for want of an eBird key (the Statistics wait for "Exotic status
  checked" never arrives, which ROADMAP line 59 already records).
- **Verification (no recapture; every run wrote to a scratch copy of the rig):**
  both scripts end to end against a scratch backend on demo data. All ten
  website tab shots and ten of twelve store shots passed the frame check; the
  two store failures are the key-dependent Statistics wait above. Marks counted
  in frame: Breeding Codes 24, Multimedia 26, Named Birds 6, Species Detail 2,
  Statistics with the stub 2 (42 on iPad). Every rendered mark loaded 48px wide
  from a `data:` URL, with zero glyphs. A CDP Network watcher saw 2,623
  requests over 31 pages and none to ebird.org, birdsoftheworld.org or eBird's
  S3 bucket. The same watcher, in a negative control with the substitution
  removed and both hosts blackholed by local DNS, saw both favicon requests on
  7 pages, and the check failed all 7 mark-bearing frames by name
  ("View American Crow on eBird (opens in a new tab): fallback glyph") without
  writing them. Playwright's own `request` event was measured not to report
  these requests, which is why the watcher uses CDP.

## Seeing screenshot-tool-ebird-icon locally

1. Open a terminal in your project folder.
2. Build the app once: `cd frontend && npm run build && cd ..`
3. Copy the demo data somewhere scratch and start the backend on it:
   `cp -R website/tools/demo-data /tmp/sr-demo && (cd backend && SR_DATA_DIR=/tmp/sr-demo .venv/bin/uvicorn main:app --host 127.0.0.1 --port 1620)`
4. In a second terminal: `cd website/tools && BASE=http://127.0.0.1:1620 node capture.mjs`
5. Look for `OK` beside every tab shot. Without an eBird key the Weather shot
   fails, as it did before this change.
6. Open `website/tools/shots/stats-light.png` and zoom into the "First species
   ever" card: the two small marks after the bird's name are the eBird and
   Birds of the World icons.
7. When done, stop the backend with Ctrl+C. The files in `shots/` are
   gitignored; do not run `process-img.mjs` unless you mean to publish.
