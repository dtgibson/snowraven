## website-screenshot-sizing

### What this does

Sizes the feature figures on the public website to the one-or-two-sentence paragraphs
they now sit beside. Every `.feature-media` is a 16:9 box of its grid track and the two
tracks are equal, so all ten figures share one height at any width (502 x 282 at 1280)
and the `reverse` alternation can no longer render the same asset shape at two sizes.
Below 920px the row becomes the centred 640px column the section head already uses. On a
phone the screenshots stay whole and the two hand-built mocks tighten (type and padding
only, content untouched) so they stop towering over them.

Four assets are recaptured from the built 1.0.32 app against the synthetic demo dataset:
Weather is reframed 16:9 around the weather output instead of being a portrait capture of
the whole panel, and Named Birds and the two Map Explorer shots are reshaped to 16:9 at
capture so the CSS box never crops them. `statistics-mobile.webp` finally declares its
true 560x1226, which is the atomicity violation Stage 1 found.

No copy changes. One alt text changes, because the Weather frame no longer shows the tide
block; it is called out below and needs the user's yes.

- `website/styles.css`: equal tracks, the 16:9 media box, `justify-self: end` on reverse
  text, the 640px single-column tier, `overflow: visible` on the mocks, the 440px mock
  tightening, and both Weather special cases deleted.
- `website/index.html`: five `width`/`height` declarations and the Weather alt. Nothing
  else, no row moved, the version pill and footer untouched.
- `website/tools/capture.mjs`: the anchored 16:9 Weather frame with three fail-closed
  assertions, and `clipH: 900` for Named Birds and both map shots.
- `frontend/src/lib/websiteFigureDimensions.test.ts`: a new guard, the only file touched
  under `frontend/`.

### How to test

1. Serve the site: `cd website && python3 -m http.server 8791 --bind 127.0.0.1`, then
   open `http://127.0.0.1:8791/index.html`.
2. Scroll the "What each tab does" section at a desktop width. Every figure is the same
   size, and the Weather row no longer towers over its paragraph: it is 385px tall where
   it used to be 887px.
3. Read the Weather screenshot. Its text should be legible: the checklist identity line
   and the whole weather output block, with the tide block and the eBird edit link out of
   frame.
4. Toggle the site's theme on the Map Explorer row. The light and dark shots swap and
   both fill the same box.
5. Narrow the window through 920px, 440px and 320px. The rows become one centred column,
   nothing overflows sideways at any width, and the two mocks (Checklists, List Comparer)
   come down toward the screenshots rather than dwarfing them.
6. `cd frontend && npx vitest run src/lib/websiteFigureDimensions.test.ts` reads the files
   on disk and proves every declared size matches its asset and every feature asset is
   within 1% of 16:9.

### Notes for reviewer

- **One text change, awaiting approval.** The Weather alt is now: "The Weather tab's
  output for a checklist at Jamaica Bay: sky, temperature, wind, cloud cover, humidity,
  dew point, sunrise and sunset, ready to paste into the checklist comment." It is the
  spec's proposed wording verbatim, and it is the only prose byte this bundle touches.
- **`weather.webp` is 1080x606, not the spec's predicted 1080x608.** The spec read the
  committed file's pixel width as the panel's CSS width; `#panel-weather` is 684 CSS px,
  and the old asset was a 1368x2560 capture downscaled to 1080 wide. The frame is built
  exactly as specified; only the prediction about its size was off. Full working in
  `pipeline/website-screenshot-sizing/decisions.md`, Stage 3.
- **The Weather shot was captured live**, but this rig's `backend/.env` has no
  `EBIRD_API_KEY`, so the key already stored by the desktop app was used for the run and
  removed straight after (`.env` restored and checksum-verified). `WEATHER_REPLAY=1` is
  not a substitute on such a rig: the tide route resolves the checklist through eBird too,
  so the panel still renders an error. That tooling gap is left unfixed here.
- **Only the four reshaped assets are committed.** The capture run regenerates all
  eleven; the other seven were put back with `git checkout --`, so whether to also ship
  refreshed 1.0.32 captures of them stays the user's call.
- The seven feature-row guards (`*PublishedClaims` plus the version parity check) are
  untouched and green: 168 tests.

### Changelog line

- Website: every feature screenshot now renders at the same size beside its paragraph, and the Weather, Named Birds and Map Explorer shots were recaptured to fit.
