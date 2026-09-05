# Map popup keyboard close

### What this does

Five map popups rendered maplibre's own injected close button. That button
carries no `tabIndex`, and WebKit's default tab mode (Safari with macOS
"Keyboard navigation" off, which is the default and what WKWebView follows, so
it is what the shipped Mac, iPhone and iPad apps get) skips a plain `<button>`
entirely. Three of the five therefore had **no keyboard close at all**, and two
could only be closed from a sidebar row that did not open them.

Each of the five now draws its own close button in SnowRaven's markup:
`closeButton={false}` on the `<Popup>` plus an app-rendered
`<button tabIndex={0} type="button" className="maplibregl-popup-close-button">`,
exactly as `BirdingStats.tsx:1221` and `map/SharePopup.tsx:184` already did. The
class is maplibre's own, so the button inherits the existing theming and the
~44px coarse-pointer target already in `globals.css:3062-3077` and nothing moves
for a mouse user. Each button calls the same clearing path the popup's own
`onClose` already called; no new path was invented.

| Component | Clearing path | Accessible name | `closeOnClick` |
|---|---|---|---|
| `components/AtlasLayer.tsx` | `setSel(null)` | Close the atlas block popup | `false` (unchanged) |
| `components/map/CountyLayer.tsx` | `setSel(null)` | Close the county popup | `false` (unchanged) |
| `components/SightingsMap.tsx` | `setSelectedCoord(null)` | Close the sighting locations popup | maplibre default (unchanged) |
| `components/map/TargetMarkers.tsx` | `onSelect(null)` | Close the media targets popup | maplibre default (unchanged) |
| `components/map/NearbyLiferMarkers.tsx` | `onSelect(null)` | Close the nearby lifers popup | maplibre default (unchanged) |

Only the close control changes owner. No library DOM is stamped with `tabindex`
imperatively, which is the property that keeps the published claim checkable
from source by `lib/tabOrderCoverage.test.ts`. Escape handling is deliberately
out of scope, per the brief's reasoning. The list rows, `countyPopupFit`'s
arithmetic and `COUNTY_POPUP_CONTENT_CHROME_PX` are untouched.

Reach: one `CountyLayer` edit covers all three county mounts (Map Explorer,
Species Detail's Sighting Locations, Statistics' Geographic Stats); one
`SightingsMap` edit covers Species Detail and the Named Birds card map;
`AtlasLayer`, `TargetMarkers` and `NearbyLiferMarkers` are Map Explorer only.

### How to test

`pipeline/map-popup-keyboard-close/how-to-see.md` is the step-by-step version.
In short: load a backup, open each of the five popups, and press Tab until focus
reaches its close button, then press Enter. On the Mac app that route did not
exist before this change for the atlas, county and Sighting Locations popups.

### What was verified

**Tests.** `components/SightingsMap.test.tsx:55-61` asserted
`expect(popup.closeButton).not.toBe(false)` under the name "mounts the popup
WITH a close button so it is keyboard-dismissable (F044)". That assertion
encoded the defect: it vouched for a control that was not reachable by Tab at
all on three of the app's six platforms. It is rewritten, not deleted, into four
tests asserting the new contract, and equivalent focused coverage was added to
`AtlasLayer.test.tsx`, `map/CountyLayer.test.tsx`, `map/TargetMarkers.test.tsx`
and `map/NearbyLiferMarkers.test.tsx`. Each file asserts that maplibre's button
is OFF, that an app-owned `<button>` exists with its own accessible name, a
literal `tabIndex={0}` and the `maplibregl-popup-close-button` class, that it
clears the selection through the popup's own path, and that `closeOnClick` is
exactly what it was before. The `TargetMarkers` and `NearbyLiferMarkers` `Popup`
stubs previously drew a close button of their own; they no longer do, because a
stub button would hide the absence of the app's.

**`lib/tabOrderCoverage.test.ts` sees the five new buttons and stays green with
no new `EXCLUSIONS` row.** Proven rather than assumed: removing the `tabIndex`
from the `AtlasLayer` button alone turns it red with
`components/AtlasLayer.tsx:234  <button>  tabIndex=(absent)`, and both of its
assertions fail. The attribute was restored and the guard is green again.

**`entryChunk.test.ts` green against a fresh `npm run build`;** `vendor-maplibre`
and the county chunk are absent from `dist/index.html`'s modulepreload.

**Green:** `npm run typecheck`, `npm run lint`, `npm run build`, all 26 files
under `components/map`, plus every test file that references one of the five
components (batched, ~500 tests). The full suite is deliberately left for the
bundle's single full run at the flush.

**Real-engine check on `CountyLayer`, the one popup carrying fit arithmetic.**
Measured in headless Chromium against the BUILT stylesheets in shipped source
order (app CSS, then `vendor-maplibre` CSS, which is what makes the vendor rule
win at equal specificity), at a 320px viewport with a coarse pointer, in the
anchored and sheet forms, at 1x and 200% in-app text scale. In all four
configurations the popup box, the content box and the body box are identical
with and without the app-owned button, to the hundredth of a pixel:

| Form / scale | popup w | body w x h | close box | `elementFromPoint` at its centre |
|---|---|---|---|---|
| Anchored 1x | 210.00 | 188.00 x 69.00 | 44 x 44 | the close button |
| Sheet 1x | 248.00 | 226.00 x 69.00 | 44 x 44 | the close button |
| Anchored 200% | 238.08 | 216.08 x 89.00 | 88 x 88 | the close button |
| Sheet 200% | 248.00 | 226.00 x 89.00 | 88 x 88 | the close button |

The button computes to `position: absolute; right: 0; top: 0` in every case, so
it adds nothing to content flow, and `countyPopupFit` measures the map container
rather than the popup. A tap at the button's centre actually reaches the button
rather than an overlay, and the button stays inside the map's box.

### Documentation

`ACCESSIBILITY.md` swept at PARAGRAPH scope, in four places rather than the
three the brief named. The fourth is the sentence "There are two kinds",
immediately above the close-button paragraph: after this change the map library
draws only one kind of control the app does not, so that count was false and a
sentence-scope sweep would have shipped it. The Map markers paragraph's "Those
two panels open a popup but do not close it again" is rewritten to say the popup
now carries its own dismissal, and that paragraph's list of keyboard-operable
map controls now includes the popup close buttons. The Known Exceptions
close-button paragraph no longer publishes "Three popups have no keyboard close
at all"; it states the property ("Every popup SnowRaven's maps open can be
dismissed from the keyboard, on every platform") rather than a count, names
which popups carry a button and which are closed by their in-view row instead,
and says the source test can now see them. The paragraph after it is rewritten
from "is open work" to what was actually done. The toggle-to-close claim for the
four sidebar in-view lists is true and untouched. No em dash (U+2014) anywhere
in the file.

**`docs/HELP.md`, `README.md` and `website/` need no edit, confirmed by grep.**
`docs/HELP.md`'s only "close button" mention is at line 391, which is the share
popup's, already app-owned and unchanged; line 148 describes clicking a pin to
open the Sighting Locations popup and never mentions closing it. `README.md`'s
only map line is about the fullscreen button. The website's only popup mention
is `index.html:306`, about fullscreen preserving an open popup. Screenshots need
no recapture: `website/tools/capture.mjs` opens no popup at all, and
`capture-appstore.mjs` opens the "Sightings in view" popup, which is
`SightingMarkers` and out of scope; in any case the button's appearance,
position and touch target are unchanged.

`CHANGELOG.md` gains one `### Fixed` bullet under the existing `## [1.0.19]`
heading. No version file was touched: the bundle is already stamped 1.0.19.

### Notes for reviewer

- **Nothing is committed or staged.** The tree holds the five components, their
  five test files, `ACCESSIBILITY.md`, `CHANGELOG.md` and these two pipeline
  artifacts.
- **The 200% coarse-pointer button is 88x88 and overlaps the popup body's
  bounds.** That is pre-existing and unchanged: the rules that size it are
  class-based, and maplibre's own button had the identical box. Worth a look,
  not a fix here.
- `CountyLayer.test.tsx`'s `Popup` stub now renders its children (it returned
  `null` before) so the app button is queryable. Its existing assertions read
  `popupLog` props and two class-scoped `querySelector`s, none of which the
  extra DOM disturbs; a `cleanup()` was added to its `beforeEach` because the
  file has several renders per describe.
- `weft-design-lint` reports three `note`s on `AtlasLayer.tsx`, all pre-existing
  and on lines this change did not touch: the `'#000000'` tier fallback at :204
  (required by the atlas/county fallback convention), the `flyTo` camera ease at
  :184, and the file-level reduced-motion note that the app-wide `globals.css`
  collapse answers for DOM transitions. No `warn`.
### What the five buttons also fix, beyond the tab order

**maplibre 5.24.0 sets no `aria-label` on its own popup close button.**
`_createCloseButton` in `maplibre-gl.js` sets exactly two things: `type =
"button"` and `innerHTML = "&#215;"`. So the accessible name of the control the
app was relying on was the times sign itself, on all five popups. The five
app-drawn buttons therefore close an accessible-name gap as well as a tab-order
one: each now says which popup it closes. The test comment that was deleted
alongside the defective assertion in `SightingsMap.test.tsx` claimed maplibre
rendered `aria-label="Close popup"`; it did not, so that comment was wrong on
top of the assertion beneath it being backwards.

**The attribution control is not a second kind of unreachable library control.**
maplibre builds it as a `<details>` with a `<summary>`, and WebKit's default tab
mode visits `<summary>`. So the zoom buttons genuinely are the only library-drawn
controls left carrying the gap, which is what `ACCESSIBILITY.md`'s "There is one
kind left" now says.

### Prose repair after the first QA pass

QA returned one defect, in the prose rather than the code. The Map markers
paragraph had gained a new absolute of my own making: "Every popup any of these
maps opens carries its own close button." That is false, and the same file said
so seventy lines later. `map/SightingMarkers.tsx:128` and
`map/HotspotMarkers.tsx:264` pass `closeButton={false}` with no replacement, so
two of the four popups that paragraph's own in-view lists open carry no close
button at all. The shape of the mistake is worth recording: the sweep correctly
caught a fourth paragraph whose count had gone false, and introduced a fresh
totality claim with an unnamed exception in the first one.

Repaired at paragraph scope rather than by patching the clause. The paragraph
now says that **where** a popup on these maps has a close button SnowRaven draws
it, so it holds a place in the tab order and Enter or Space closes the popup
however it was opened; that the sighting and hotspot popups have none and do not
need one, because the "Sightings in view" and "Hotspots in view" row that opens
each of them closes it again; and that either way every popup these maps open
can be dismissed from the keyboard. That is the same property the Known
Exceptions paragraph states, with the same named exception, so the two passages
now agree. The rest of the file was re-read for a third leak of the absolute:
the only two remaining "every popup" sentences are those two dismissability
claims, each stated beside its exception.
### Known limitation the Auditor verified, no change owed

`SightingMarkers` is fed `filteredLocations` rather than the bounds-scoped list,
so its popup can outlive the "Sightings in view" row that closes it: pan the
selected pin out of view, or push the list past its cap, and the row is gone
while the popup is still open. The route is recoverable by panning or zooming
back until the row returns, so the dismissal absolutes published in
`ACCESSIBILITY.md` survive. Recorded here so the next reader does not have to
re-derive it. This is the same pair of popups already flagged for the roadmap.

### Second review pass: three accuracy defects in claims

Security passed with no Critical, High or Medium and a clean code diff. Three
Informational findings, all accuracy defects, all fixed here.

**1. `ACCESSIBILITY.md:95` quantified a naming clause too widely.** "…and a name
that says which popup it closes" covers all seven app-drawn close buttons, and
the sentence after it folds in the Statistics and share popups, but
`BirdingStats.tsx` named its button `"Close popup"`. This is the round-1 defect's
shape once more: the repair narrowed the population for close-button OWNERSHIP
and left the NAMING clause in the same sentence quantifying over everything.
Fixed by making the claim true rather than by narrowing it: that button is
renamed **"Close the top location popup"**, in the same voice as the five, after
the section's own published copy ("Top locations by checklists" / "Top locations
by species"). No test asserted the old name. `ACCESSIBILITY.md` needed no edit,
because the clause is now true as written.

**2. `CHANGELOG.md`'s bullet claimed too little changed off WebKit.** It said the
web and Windows versions were unaffected. Two things change on every platform,
and the bullet now says both in a birder's terms: the button gains a name at all
(maplibre sets no `aria-label`, so a screen reader read the times sign), and the
keyboard is likely to start on the close button rather than the popup's first
link, because `addTo()` calls `_focusFirstElement()` and the app's button now
comes earlier in the popup than the library's did. The second is stated as read
from how the library works rather than measured per browser, which is what it is.

**3. `MapExplorer.tsx:985-987` carried a struck premise.** "the map popups have
no close button" was true of `openSightingFromList`, which it is attached to, but
worded as a general claim and sitting thirteen lines above `openLiferFromList`,
whose popup now has one. It now names the specific popup (`SightingMarkers`,
`closeButton={false}` with no replacement) and says outright that the atlas,
county, Media Targets and Nearby Lifers popups each draw their own, so
`openLiferFromList` is not the only dismissal for the popup it opens.

**Two more struck premises swept at the source, same claim, found while fixing
the above.** `map/SharePopup.tsx:189` and `map/SharePopup.test.tsx:101` both said
maplibre "hardcodes `Close popup`" on its own button. It does not, as this
build's own reading of `_createCloseButton` establishes. Both now state what
maplibre actually does, as does the comment above the renamed button in
`BirdingStats.tsx`, which had claimed the app button carried "the same accessible
name as maplibre's". Comments only, no behaviour; swept because
`.claude/rules/docs-and-website.md` puts `frontend/src/` in scope for a claim
that reached published prose from the source, and this one did.
