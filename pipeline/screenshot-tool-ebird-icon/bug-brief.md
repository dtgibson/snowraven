# Bug Brief — screenshot-tool-ebird-icon

## What is broken
Both capture scripts (`website/tools/capture.mjs`, `capture-appstore.mjs`, sharing `makePage` in `capture-lib.mjs`) photograph the eBird link mark as the app's fallback Globe glyph on every tab that shows species marks. On the Statistics contexts they also photograph the Birds of the World mark as its fallback SquareLibrary glyph.
Reproduced 2026-09-28 against the real app (demo data, scratch backend on a copy of `demo-data`): Breeding Codes 12 of 12 eBird marks drawn as glyphs, Species Detail 1 of 1, Statistics both marks.

## Confirmed cause (two, measured)
1. ebird.org runs Anubis (Techaro). To the Playwright default UA (`HeadlessChrome/151.0.7922.34`) it answers `/favicon.ico` with `200 text/html`: an eBird-branded "Access Denied: error code ..." page that also clears `ebird.org-anubis-auth`. Chromium then blocks it (`ERR_BLOCKED_BY_ORB`). A normal Chrome UA, curl or Node gets the `302` to the icon.
2. This matches Anubis's own `headless-chrome` rule (`user_agent_regex: HeadlessChrome`, `DENY`, in its deny-pathological-bots set). It fires before the favicon allowance, so this is deliberate bot protection Cornell deployed, not an accident. It falls under the 2026-09-25 stance (DECISIONS "Direct access to personal Macaulay Library media", v0.5.76).
3. Statistics only: the escapee stub route cancels lazy cross-origin `<img>` loads (the v1.0.19 finding), so both marks fall back whatever the UA is.

## Steps to reproduce
1. `curl -sI -A '<UA containing HeadlessChrome/151...>' https://ebird.org/favicon.ico` returns 200 text/html plus the Anubis cookie. The same request with `Chrome/151...` returns 302 to `is-ebird-web-static-content-prod.s3.amazonaws.com/.../favicon.ico`.
2. Start the backend with `SR_DATA_DIR` on a copy of `website/tools/demo-data`, then open Breeding Codes or Species Detail (Northern Cardinal) through the committed `makePage`. Each `.sr-favicon-slot` for eBird holds the lucide `svg`. The BoW images load at `naturalWidth` 48.
3. Open Statistics with a `**/checklists/**` route registered. Both slots hold the glyph.

## Expected behavior
Captures show the eBird and Birds of the World marks an online user sees. The tool gets them without disguising itself and without asking eBird for what it refuses to headless browsers. A capture that would draw a fallback glyph fails instead of writing the frame.

## Recommended fix (does not disguise automation)
- In `makePage`, add a route-free init script that maps exactly `https://ebird.org/favicon.ico` and `https://birdsoftheworld.org/favicon.ico` to local `data:` URLs. It must cover BOTH `Element.prototype.setAttribute('src')` and the `HTMLImageElement.prototype.src` setter: React 19 sets both, and patching only the attribute was measured to fail. Measured on the real app, marks loaded at 48px on Breeding Codes (12/12), Species Detail (1/1) and Statistics with the stub route (1/1), and no request went to either favicon URL.
- A fulfil ROUTE cannot do this. With any route registered, lazy cross-origin images error before the handler sees them (measured; `--blink-settings=lazyLoadEnabled=false` does not help). An init script is not a route and works alongside the stub.
- Add a fail-loud check: fail the shot when any `.sr-favicon-slot` inside its clip holds the fallback `svg` or a 0-width image. This is part two of the ROADMAP item.
- Keep the local copies as gitignored files (for example `website/tools/marks/`) that the user saves once from a normal browser. The capture refuses to run, with instructions, when they are missing. The Engineer builds and tests with a stand-in image.
- Rejected: a normal Chrome UA or headed Chromium (both beat the headless DENY, which the stance rules out); fetching the S3 release URL (a way around the gate, like the v0.5.76 CDN case, and tied to one release); a Node or curl download (it identifies itself honestly and is allowed, but hands automation what eBird refuses automation).

## Blast radius
- Tool only. `capture-lib.mjs` (`makePage`) changes, and both scripts pick it up. Also stale: the comments in `capture.mjs` and `capture-lib.mjs` that call the Statistics glyphs an "accepted, stated cost", the `website/tools/README.md` route note, and ROADMAP line 59, whose part one ("sets a normal Chrome user agent") this fix replaces.
- Untouched: the app itself; the `SpeciesLinks` glyph fallback, which is by design (v1.0.19); the `verify/` harnesses; the weather shot, which has no marks; the demo-data guard.

## Published screenshots (nothing is recaptured in this build)
- Showing the fallback glyphs: `website/assets/shots/statistics.webp` and `statistics-dark.webp` (the "First species ever" card), and `appstore/screenshots/ipad-13/02-statistics.png` (that card plus every Top Species row). All three come from cause 3.
- Every other published shot that shows marks has the real ones. The 1.0.34 and 1.0.39 recaptures behind them came from copies of the rig running a normal Chrome UA (DECISIONS v1.0.34, ROADMAP). `statistics-mobile.webp` and the iPhone `02-statistics.png` show no marks in frame.
- A recapture needs the user's explicit approval.

## What done looks like
1. With the committed rig, UA unchanged, on demo data, both scripts: every mark in every frame is a loaded image, and neither favicon URL is requested.
2. A missing local copy, or the substitution reverted, fails the capture with a named reason instead of writing a glyph frame.
3. No change to `website/`, `README.md`, the App Store listing, the privacy policy or any screenshot.
