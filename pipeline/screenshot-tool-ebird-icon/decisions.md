# Decisions: screenshot-tool-ebird-icon

## The two marks are mirrored in the repository (user decision, 2026-09-28)

The bug brief's default kept the local copies of the eBird and Birds of the
World icons out of git, saved once by hand from a normal browser. Mid-build the
user changed that: mirror both icons in the repository, beside the capture
scripts, used only by those scripts and never bundled into the app, obtained
only by an honest request.

**Where:** `website/tools/marks/ebird-favicon.ico` and
`website/tools/marks/birdsoftheworld-favicon.ico`, with their provenance in
`website/tools/marks/PROVENANCE.md`. `capture-lib.mjs` reads them through
`loadSiteMarks`; nothing else does.

**How they were obtained:** on 2026-09-28 (22:58 PDT, 2026-09-29 05:58 UTC),
one plain `curl -L` request per icon, carrying curl 8.7.1's default user agent
(`curl/8.7.1`) and no other headers. That is a request that identifies itself
truthfully, not a browser-imitating user agent and not headless-disguising
flags. eBird was not asked to accept anything it refuses:

| Icon | Answer |
|---|---|
| `https://ebird.org/favicon.ico` | `302` to its S3 release copy (`.../releases/20260923_152816/eBirdCommon/lib/images/favicons/ebird/favicon.ico`), `200`, 1,166 bytes, served as `image/vnd.microsoft.icon`, actually a 48x48 PNG. SHA-256 `cf869d60af8a8822b05bd092eb35dd8d05aa400fa14ed2015ce71f6235c8e064`. |
| `https://birdsoftheworld.org/favicon.ico` | `200` directly, 15,086 bytes, `image/x-icon`, an ICO with 48, 32 and 16 px images. SHA-256 `3267ad4796dba86c613cf365c4e4962ebb0dd67d627b459d7d461c10936d85a7`. |

**What they are for:** they are Cornell's marks, used only so the capture
scripts render faithful screenshots of SnowRaven's own UI (the marks an online
user sees beside every species name). The capture itself never requests either
icon; an init script, not a route, serves the committed bytes as `data:` URLs.

**What changed as a result:** no ignore rule for `marks/`, and no "save them
once from a normal browser" path. A missing or non-image copy still refuses the
capture before the browser starts, naming the file and pointing at
`git checkout -- website/tools/marks/` and the provenance note.

**Not in any app build (checked):** Vite builds from `frontend/` with
`frontend/public/` as its public directory and no source imports anything under
`website/`; `src-tauri/tauri.conf.json` bundles `../frontend/dist` and lists no
`resources`; the built `frontend/dist` holds no `.ico` and no reference to
either file.

**Open, for the user: the Pages workflow publishes all of `website/`.**
`.github/workflows/pages.yml` uploads the `website` directory as the site
artifact, so once this reaches `main` the two icons and the note are reachable
on the site's host under `tools/marks/`, like every other tracked file in
`website/tools/` already is. Nothing links to them. If they should not be
served there, the options are to exclude `website/tools/` from the Pages
artifact or to move the folder outside `website/`; this build did neither,
because both are outside its scope.

## The substitution is an init script, never a route or a disguise

Unchanged from the brief. The capture keeps Playwright's default user agent and
headless flags. eBird's Anubis filter deliberately refuses `HeadlessChrome`, and
this repo does not get around Cornell's protection without permission
(DECISIONS.md, the v0.5.76 Macaulay bot-check entry, restated 2026-09-25). A
fulfilling route cannot do the job either: any registered route cancels
cross-origin `<img>` loads before its handler runs.

## A wrong mark fails the whole capture.mjs run, not just its shot

`capture.mjs` logs a failed tab shot and carries on, and until now only the
Weather shot could set a nonzero exit. A frame skipped for a fallback glyph
would leave the previous run's PNG in `shots/` under a "CAPTURE DONE, now run
process-img.mjs" banner, so a mark failure (`MarksInFrameError`) now joins
`requiredFailures`. Other tab failures keep their existing non-fatal behavior;
widening that is outside this fix. `capture-appstore.mjs` already fails the run
on any shot failure.
