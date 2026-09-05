# Species Link Glyph Fallback

## What this does

The two link marks beside every bird name (`SpeciesLinks`) answer a failed
favicon load with a bundled lucide glyph in the same reserved 14px slot, instead
of running `visibility: hidden` and leaving a fully invisible, still focusable,
still clickable 24x24 target beside the name. Offline that happened to every mark
on every surface, which also made `docs/HELP.md`'s cold-start offline claim false.

- **eBird gets `Globe`, Birds of the World gets `SquareLibrary`**, both at 14px /
  stroke 2.2 / round caps, in the design system's in-content icon register.
- **Non-destructive and per image** (the v0.5.66 embed shape, third surface): the
  `<img>` is never unmounted, only hidden, so it keeps its reserved box and can
  still fire `onLoad`, which clears the flag and restores the real favicon in
  place. Each mark decides for itself, so a mixed pair (one favicon, one glyph) is
  an ordinary state rather than an edge case. No retry, no `src` nudge: no
  outbound-request policy changes.
- **The colour is set, not inherited.** `color: var(--sr-text)` on the glyph, so
  lucide's `stroke="currentColor"` cannot pick up a host surface's link colour and
  the measured 3:1 non-text contrast actually holds (7.96:1 light, 7.63:1 dark at
  the anchor's resting 0.75 opacity, worst-case surface). The dark-theme
  `brightness(0) invert(1)` filter stays `img.sr-favicon`-scoped and structurally
  cannot reach a token-coloured stroke.
- **No motion anywhere.** A substitution is not an entrance: no `transition` on
  the slot, its children, or the anchor's opacity, and a test asserts it.
- **The two anchors are now one internal sub-component called twice**, so the
  fallback lives in one place. Rendered output in the success state is unchanged.
- **One bounded addition rides along** (`ROADMAP.md:106`): the `speciesCode` href
  shape gate, `/^[a-z0-9-]{2,16}$/`, rendering nothing on a miss exactly as the
  component already does with no code. The consumer-side `Object.hasOwn` sweep
  stays on the roadmap; the `.sr-favicon-slot` rename stays dropped.

Online, with both favicons loading, nothing a user sees changes.

## How to test

`pipeline/species-link-glyph-fallback/how-to-see.md` is the plain-English version.
In short: `cd frontend && npm run dev`, open a tab that lists bird names, then turn
the network off (or block `ebird.org` and `birdsoftheworld.org`) and reload. The
marks that were invisible holes are now a globe and a shelf of books, in both
themes, opening the same pages.

Automated, all green:

- `src/components/SpeciesLinks.test.tsx` — rewritten and extended: `onError`
  shows the glyph and keeps the anchor's accessible name, href, target, tabindex
  and 5px padding; a later `onLoad` restores the favicon (the case a latched
  implementation fails); the mixed pair renders one of each; `Globe` pairs with
  eBird and `SquareLibrary` with Birds of the World; the glyph is an `<svg>` with
  no `sr-favicon` class, so the dark filter cannot apply; the shape gate renders
  nothing for eight malformed codes and leaves a well-formed one untouched; no
  inline `transition` on anything the component draws.
- `src/components/BirdName.test.tsx` — the slot assertion now states both halves:
  the favicon is in the slot and there is no glyph while it loads; on failure the
  image is still mounted and the glyph is in the same slot, with the link's
  accessible name unchanged.
- `breedingNameColumnCss.test.tsx`, `entryChunk.test.ts`, `tabOrderCoverage.test.ts`,
  `RavenGlyph.test.tsx`, `WeatherBacklog.test.tsx`, `ExoticProvenanceAccount.test.tsx`,
  `CountyCompletenessUI.test.tsx`, `lifeListPinnedCss.test.ts`,
  `breedingCodePinnedCss.test.ts`, and the eight HELP/published-claims suites —
  green, untouched.
- `npm run typecheck`, `npm run lint`, `npm run build` — clean.
  `weft-design-lint check src/components/SpeciesLinks.tsx` — 0 findings.

## Notes for reviewer

**Geometry is measured, not asserted.** A Chromium layout probe (deviceScaleFactor
2) over the shipped slot CSS with a name plus the mark pair, in all three states:

| | both loaded | mixed | both failed |
| --- | --- | --- | --- |
| name box width | 140.41 | 140.41 | 140.41 |
| cluster x / width | 127.41 / 33 | 127.41 / 33 | 127.41 / 33 |
| anchor boxes | 24x24 @ 122.41, 141.41 | identical | identical |
| slot boxes | 14x14 @ 127.41, 146.41 | identical | identical |
| glyph box | — | 14x14 @ 127.41 | 14x14 @ 127.41, 146.41 |

Nothing moves in any direction, and each glyph occupies exactly its slot. Measured
ink extents are `Globe` 12.95px and `SquareLibrary` 11.78px, matching the design
refinement's 12.95 / 11.80; no per-glyph size correction was applied, per the spec.

**How the overlay is held.** The glyph is `position: absolute; top: 0; left: 0`
inside the slot, and the slot takes an inline `position: relative` **only in the
fallback state**, so the success-state DOM is byte-identical to what shipped.
`globals.css` is untouched, no new class, no new token.

**Entry chunk.** `SpeciesLinks` is on `App.tsx`'s static graph, so the two lucide
icons ride the entry chunk by design: `lucide-react` is already there via
`lib/tabIcons.tsx`. Measured cost of the whole change, built before and after:
`dist/assets/index-*.js` 312,520 -> 312,746 bytes raw, 82,486 -> 82,707 gzipped
(+226 / +221 bytes). `entryChunk.test.ts` green with a production build present.

**Privacy statements confirmed true and untouched.** No request is added, removed
or moved; no host changes; no component changes who it talks to. Both favicons are
still requested from the same two hosts on exactly the same schedule, and a failed
one is not re-requested. `PRIVACY_POLICY.md:74`, its `website/privacy.html:180`
mirror and `appstore/LISTING.md:160-162` therefore stay true and are not edited.
`ACCESSIBILITY.md:49` stays true (targets unchanged, measured above) and `:39`
needs no roster edit; the 3:1 claim is confirmed by the design's measured ratios
rather than reworded.

**Docs, at paragraph scope, exactly the two spots the brief names.**
`docs/HELP.md:663` (the cold-start offline bullet) now states the property rather
than naming the site icons: the marks are present, same spot, same size, same
destinations, and offline they are the app's own stand-ins. `docs/HELP.md:137`
(the one place that defines the bird-name format) gains the fallback clause.
`:441` stays as it is, per the brief. No em dash (U+2014) anywhere in `docs/HELP.md`
or in the component's `title` / `aria-label` strings.

**Source sweep.** `website/tools/capture-lib.mjs:176` stated "SpeciesLinks hides a
glyph whose load fails, so a tab that renders BirdName / SpeciesLinks photographs
empty glyph slots on any context this is installed on" — false as of this build,
and corrected in the same change to say those contexts now photograph the fallback
glyphs. Its sibling `website/tools/capture.mjs:89-98` carried the same struck
premise in the same words and is corrected too (QA finding): the present-tense
"SpeciesLinks hides a glyph whose load fails" is now scoped to the build that
shipped it, the past-tense history of the blanket install stays, and the accepted
cost that read "the 'First species ever' glyph stays absent" now states the v1.0.19
behaviour instead, that the mark photographs as the fallback Globe and
SquareLibrary pair, with the Statistics recapture recorded as DEFERRED and the
honest fix named as capture-side rather than app-side, because the route stub is
what cancels the image loads. `globals.css:772-774`, `BirdName.tsx:1-5` and
`BirdingStats.tsx:201`/`:1907` were re-read and stay accurate. **Not swept, out of this build's file scope:**
`PRODUCT_CONTEXT.md:821` still says "`onError` hides failed loads" — that is a
record file the Chronicler owns at closeout, and it is flagged for that stage.

**Screenshots: no recapture owed for the eight keyless shots, and the reasoning was
re-derived rather than taken on trust.** Both capture scripts pass routes per shot:
`website/tools/capture.mjs` passes `routes: statsRoutes` only to the three
Statistics shots, and `capture-appstore.mjs`'s `SHOTS` table gives `null` to
`01-map-explorer`, `04-calendar`, `05-species-detail` and `06-breeding-codes`. The
eight keyless frames therefore run with no Playwright route registered on their
context, both favicons load, and they are pixel-unchanged.

**One frame family will change, and it is reported rather than fixed.** The five
Statistics frames (`website/assets/shots/stats-{light,dark}.webp`, the mobile
Statistics shot, and `appstore/screenshots/{iphone-6.9,ipad-13}/02-statistics.png`)
install the provenance route, and registering any route on a context cancels every
cross-origin `<img>` load in it. So both favicons fire `onError` there. The "First
species ever" mark that photographs as an empty slot on the shipped shots is
expected to photograph as the fallback glyph pair from the next capture. That is
better than a hole but is not what an online user sees. Those shots were last taken
with a live eBird key and `backend/.env` on this rig is empty, so they cannot be
recaptured here; QA should decide between recapturing on a keyed rig and fixing it
on the capture side (the honest fix is capture-side: the route stub is what breaks
the images, not the app).

**Version:** the bundle is already stamped 1.0.19. No version file is touched; the
CHANGELOG gains one bullet under the existing `## [1.0.19]` heading, in a new
`### Fixed` subsection.

**Known limitations, for the Tester.**

1. `loading="lazy"` is unchanged, so a mark far down a long table neither loads nor
   errors until it is scrolled near. The glyph appears at that moment, exactly as
   the favicon would have. Not a regression: the slot was empty until then before.
2. A late `onLoad` restore is only reachable where the browser actually re-requests
   the image (a re-mount, or a first load that resolves after a slow start). No
   retry is added, so a mark that has already errored on this element stays on the
   glyph for that element's life. That is the design's intent, not a gap.
3. The glyph is drawn at `--sr-text` and the surviving favicon beside it is a
   filled raster; in dark theme the glyph measures higher contrast (9.44:1 against
   roughly 5.0:1 on `--sr-surface`). The design left that gap deliberately: a
   1.28px outline carries about a quarter of the ink a filled raster does, so they
   read at comparable weight. Worth an eye at the mixed pair rather than a number.
4. Worth re-checking at 320px and 200% in-app text scale on the **Breeding Codes**
   phone name cell specifically. The marks are px-sized and do not scale with text,
   and the fallback occupies exactly the same boxes (measured above), so the cell
   should wrap as it does today, but that cell is the tightest place this renders.
