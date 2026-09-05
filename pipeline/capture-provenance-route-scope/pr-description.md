## capture-provenance-route-scope

### What this does
`website/tools/capture.mjs` installed the Statistics escapee-pass stub
(`installProvenanceRoutes`) on every browser context through its `page()`
wrapper, under a comment calling that "harmless on tabs that make no such
lookup". It is not: registering any Playwright route on a context, whatever its
pattern, cancels every cross-origin `<img>` load in that context
(net::ERR_ABORTED), and the eBird and Birds of the World glyphs beside species
names are exactly such loads. Four website screenshots therefore published
empty 14px glyph slots. The stub is now registered only on the three Statistics
contexts (the two desktop `tab('Statistics', ...)` calls and the mobile block)
through a per-shot `routes` hook, the same shape `capture-appstore.mjs` already
uses; every other context has no route registered, except the pre-existing,
per-shot `WEATHER_REPLAY` abort on the weather context, which stays by design.
The comment now states the measured mechanism and the scoping rule, and the
same rule sits in the shared `installProvenanceRoutes` JSDoc in
`capture-lib.mjs` and in the Statistics paragraph of `website/tools/README.md`.
The four affected images were recaptured from the demo backend.

Website-only: no app code, no version bump, no CHANGELOG entry (the
`chore(website)` recapture precedent, `43d5593` / `6790e74` / `a836c57`).

### Files changed
Code and docs:
- `website/tools/capture.mjs`
- `website/tools/capture-lib.mjs`
- `website/tools/README.md`

Images (exactly these four, from `species-light`, `breeding-light`,
`media-light`, `named-birds-light` via `process-img.mjs`):
- `website/assets/shots/species.webp`
- `website/assets/shots/breeding.webp`
- `website/assets/shots/multimedia.webp`
- `website/assets/shots/named-birds.webp`

Not changed (restored with `git checkout --` after the full run):
`statistics.webp`, `statistics-dark.webp`, `statistics-mobile.webp`,
`map.webp`, `map-dark.webp`, `calendar.webp`, `weather.webp`, and every
App Store PNG. Of those, `map.webp`, `map-dark.webp`, `calendar.webp` and
`statistics-mobile.webp` came out byte-identical to the committed files on
this run anyway; `statistics.webp`, `statistics-dark.webp` and `weather.webp`
differed only because this rig carries no eBird or OpenWeather key (see
Notes) and were restored.

### How to test
1. Read the diff of `capture.mjs`: `page()` no longer calls
   `installProvenanceRoutes`; `tab()` takes `routes`; only the two Statistics
   `tab(...)` calls pass `routes: statsRoutes`, and the mobile Statistics
   block calls `await statsRoutes(ctx)` before `goto`. `grep -n "route("
   website/tools/capture.mjs` should show exactly one direct `ctx.route(`
   call, the `WEATHER_REPLAY` abort, inside the weather block.
2. Open the four recaptured images under `website/assets/shots/` and confirm
   both glyphs (the green eBird "e" and the Birds of the World bird) beside
   each species name: the Species Detail header (Northern Cardinal), every
   Breeding Codes row, every Multimedia row, and the three Named Birds rows
   (Ring-billed Gull, Rock Pigeon, Mallard). Each image should show its own
   tab highlighted in the sidebar.
3. Optional full re-run, per `website/tools/README.md`: build the frontend,
   start the backend with `SR_DATA_DIR=<repo>/website/tools/demo-data` on
   1620, `BASE=http://localhost:1620 node capture.mjs`, `node process-img.mjs`.
   The demo-dataset guard prints `demo-dataset guard OK (368 synthetic
   checklists)`. Commit only the four images above.

### Measurement (from the brief's item 3)
`document.querySelectorAll('img.sr-favicon')` counted on a fresh context
against the demo backend at 1600x900, `loaded` = `naturalWidth > 0`, once with
no route registered and once with the stub installed on the context. Same
page, same settle, same backend; the only difference is the route.

| Tab            | glyph imgs | loaded, no route | loaded, stub route |
|----------------|-----------:|-----------------:|-------------------:|
| Named Birds    |          6 |                6 |                  0 |
| Species Detail |         22 |               22 |                  0 |
| Breeding Codes |        174 |              174 |                  0 |
| Multimedia     |        298 |              298 |                  0 |

With the stub route installed, every glyph that had attempted its load had
already been hidden by `SpeciesLinks`' `onError` (6/6, 22/22, 128/174,
132/298; the remainder are lazy-loading images below the fold that had not
started yet).

Wiring proof that the per-shot hook is live: from a page on a context WITHOUT
the stub, `fetch('/checklists/S9000000069')` returns the backend's real answer
(400, `EBIRD_API_KEY not configured` on this keyless rig); on a context WITH
`installProvenanceRoutes` it returns the stub's 200 with the demo species list.

### Notes for reviewer
- This rig carries no eBird key and no OpenWeather key (`backend/.env` is
  empty; the key used for `6790e74` lived outside the repo and was deleted
  after that run). So on this run the Statistics shots rendered "No eBird
  key, so exotic status cannot be checked" rather than the stubbed pass's
  "Exotic status checked across N checklists", and the weather shot rendered
  the "API key not configured" state. Neither is the "eBird could not be
  reached" banner, and none of those images is committed. The stub itself is
  proven installed on the routed contexts (see the wiring proof); its end
  state on Statistics is the same code and the same per-shot shape the App
  Store capture already exercises.
- Pre-existing, out of scope, worth a roadmap line: the weather block's
  error guard only checks for "Weather data unavailable", so on a keyless rig
  the shot logs `OK` with an "API key not configured" frame (`FAIL` was
  expected). It is a wrong-but-plausible frame passing an exit-code check,
  the class `selectTab`'s throw was added for. Not touched here (fix lane).
- Accepted, stated cost, unchanged by this fix: the Statistics contexts keep
  the stub, so the one glyph in their frame (the "First species ever" card)
  stays absent, as on the App Store Statistics shot.
- No em dash (U+2014) was added to any file; the pre-existing ones in the
  surrounding comments and README were left alone (fix lane, and both are
  outside the published-prose rule).
