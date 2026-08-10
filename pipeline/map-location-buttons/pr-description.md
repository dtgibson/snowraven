# Map Location Buttons

### What this does

Adds a location button to the Map Explorer's floating control cluster on all
four views (it was previously reachable only through the filters sidebar, and
not at all on My Sightings), corrects the share-pin glyph so the two round white
buttons beside each other are told apart by silhouette, and gives the
location-failure message a home on the map surface where a screen reader
announces it.

Three files carry the behavior: `MapExplorer.tsx` (the button, the message
region, the failure state), `map/SharePin.tsx` (one glyph swap, which reaches all
five share-pin surfaces because it is one shared component), and `globals.css`
(one new FAB rule, three message rules, five declarations added to the cluster).
No new dependency, no backend route, no persisted state, no Tauri grant.
`lib/location.ts`, `src-tauri/` and `backend/` are untouched.

### How to test

See `how-to-see.md` in this folder for the click-by-click walkthrough. The short
version: open Map Explorer, look at the bottom-right corner, press the round
button with the target reticle. Deny location permission first if you want to see
the failure message.

---

## Notes for reviewer

### 1. QA-02 is amended, deliberately, and the PRD row now says so

The Designer moved the button's gate from "is there data" to "is there a map",
which means it is **absent on My Sightings while the setup-required screen is
showing** (`viewMode === 'sightings' && isSetupRequired`). There is no map mounted
in that branch, so a press would detect successfully, arm `panTarget`, and do
nothing observable, which is exactly the lesson today's pin button teaches and the
reason this feature exists. It could also raise an OS location prompt for no
benefit, which is a real cost in a privacy-first app.

QA-02 as written tested precisely that combination and would have failed by
design. The row in `prd.md` is amended to scope it to the three centre views,
where the button's independence from the user's data can actually be observed,
and both halves are asserted in `MapExplorerLocateFab.test.tsx` so the amendment
is a decision the suite records rather than a silent narrowing. FR-02's intent is
preserved: on Hotspots, Nearby Lifers and Media Targets the map renders with
`isSetupRequired` true, and so does the button.

### 2. The cluster wrapper is now mounted unconditionally. Its buttons are not.

This is a small structural deviation from both the schema and the design, and it
fixes a regression they would otherwise have shipped.

The design puts the live region inside the cluster, and the PRD (Q1, ratified)
drops `role="alert"` from the sidebar's failure block so there is exactly one
announcer. But the cluster is gated on `!sidebarOpen`, and on a phone with the
Filters overlay open the sidebar's own "Use my location" is still pressable and
can still fail. With the sidebar's role removed and the cluster unmounted, that
state would have had **no announcer at all** - strictly worse than today.

The design's own justification for the placement is "mounted whenever a message
can be produced". That is the right principle; the sentence that followed it
("absent only in the mobile-Filters-overlay state where the button cannot be
pressed anyway") is about the FAB and overlooks the sidebar control. So: the
`<div className="sr-map-fab-cluster">` wrapper and the message region inside it
are always mounted, and the `!sidebarOpen` gate moved inward to wrap only the
interactive contents. Every shipped behavior is preserved - the overlay still
hides every FAB (FR-12), `setFabSlot` still goes null so `SharePin` renders no
button - and an empty cluster is a 0x0 `pointer-events: none` box. Covered by a
test named for the state it protects.

### 3. `.sr-map-geo-error:empty { display: none }` was removed. It was hiding the live region.

**This shipped in the first revision and was caught in security review
(Medium).** `display: none` removes an element from the *accessibility tree*, not
just from view, so the `role="status"` region was being inserted into the tree at
the same instant its first content arrived - the documented way to make a live
region fail to announce. Two things made it worse than a first-message problem:
`handleUseMyLocation` clears the message as its first statement, so **every**
announcement was a `none → flex` transition; and it defeated the whole point of
`geoErrorState.ts`, whose sequence-keyed child assumes a *stable* region whose
child is replaced. On My Sightings there is no sidebar copy (`CenterPointControl`
renders only in the three centre sidebars), so that region is the sole carrier.

The rule is deleted, which is the Auditor's option (a) and puts the region in the
same posture as the house reference, `SharePopup.tsx:263` - always rendered, only
the child changes. The alternative (a separate `.sr-only` announcer beside a
collapsible card) was rejected because here the announced text *is* the visible
card, so a duplicate would put the same 105-character sentence in the reading
order twice; `SharePopup` can afford it only because its visible confirmation is
different, shorter copy.

Deleting it costs nothing measurable. The design justified the rule as keeping
the buttons from sitting 10px lower, and that was already found false during the
first pass: the cluster is **bottom**-anchored, so an empty row grows the box
*upward* (134px → 144px, top 478 → 468) and every button's frame is byte-identical
either way. What the rule actually bought was 10px of dead space inside an
invisible, `pointer-events: none` box - paid for with the announcement.

**Verified in a real accessibility tree**, not reasoned about, using Playwright's
`ariaSnapshot` on the built app at 320px / 200%:

| build | cluster's accessibility tree while idle |
|---|---|
| **fixed (shipped)** | `- status` present, then `- status: Location access was denied...` on failure |
| **`:empty` reverted** | no `status` node at all - only the four buttons |

**And the button positions survive**, re-verified frame-relative at the same size
across empty / short (68 char) / longest (105 char): `share@72,830
locate@170,830 fullscreen@268,856 filters@179.08,928`, identical in all three;
cluster left 16, leftmost button edge 72, `scrollWidth` 320 = viewport.

The guard is deliberately **paired**, because neither half is sufficient. jsdom
loads no stylesheet, so the component test's "region is in the DOM while idle"
passes on the broken build - it is necessary, not sufficient, and its docblock
says so. The half that rejects the defect is a scan in
`mapFabClusterCss.test.ts` over every rule in the stylesheet whose subject is
this region, asserting nothing sets `display`/`visibility`/`content-visibility`
to a hiding value, plus a positive `display: flex` so the check cannot pass
vacuously by the rule being deleted outright.

Mutation-checked, since this build has already been bitten once by a guard that
passed either way. Each of these now fails it: the exact rule that shipped,
reintroduced at top level; the same rule minified; `:not(:has(*)) { visibility:
hidden }`; the rule smuggled into the 640, 480, **or** 1024 media tier; hiding the
card instead of the region; deleting the base rule. Finding this also exposed a
bug in the test file's own `decl()` helper - it did not match a declaration
directly following `{`, so the raw-rule scan was inert against single-line rules
until mutation testing caught it. Fixed, with the reason recorded at the helper.

### 4. QA-19: the discriminating test is the pure one, and here is why

The Architect warned that the two-press UI path passes without the sequence key.
Confirmed empirically: the key was removed from the region and
`MapExplorerLocateFab.test.tsx` still passed.

It is stronger than the warning suggests. `handleUseMyLocation` begins with
`setGeoError('')`, which commits before the await resolves, so the message node
genuinely unmounts and remounts between two failures - and since that clear is
the *only* other `setGeoError` call site, **there is no press sequence in the
shipped component that lands two identical messages with no clear between**. The
DOM-level difference the key makes is not reachable from the UI today.

The key is still required (FR-14) and still correct: it is what keeps the region
announcing if that leading clear is ever removed or a second call site added. So
the discrimination lives where it is real - `lib/geoErrorState.test.ts` asserts
that an identical repeat advances the sequence, that a clear never does, and that
clearing an already-clear state returns the same object. Both test files say in
prose exactly what they do and do not reject, rather than banking the false
confidence CLAUDE.md warns about.

That reducer moved into its own module (`lib/geoErrorState.ts`) to make it
testable - exporting it from `MapExplorer.tsx` would trip
`react-refresh/only-export-components`. It is a `useReducer` rather than a
`useState` plus a wrapper setter for a specific reason: `dispatch` is recognized
as stable by `react-hooks/exhaustive-deps` exactly like a `useState` setter,
whereas a `useCallback` wrapper is not and would have forced a change to
`handleUseMyLocation`'s dependency array. The schema expected a `useCallback` to
be equally invisible; it is not, to the lint rule.

**QA-03 verified literally:** `handleUseMyLocation` is byte-identical to `HEAD`
(21 lines, `diff` clean), and `git diff --stat` on `frontend/src/lib/location.ts`,
`src-tauri/` and `backend/` is empty.

### 5. `ACCESSIBILITY.md` named an attribute the code does not ship

**Security review, Low.** The paragraph added in the first revision said the
location button "reports being busy". It ships `aria-disabled`; `aria-busy`
appears nowhere (grep count: 0). The mechanism was right and the prose was wrong
- the same shape as the v0.5.75 defect CLAUDE.md records, whose standing rule is
that where published prose states a trigger, the predicate gets grepped.

Every claim in that paragraph was then grepped, which turned up a second error
the report did not flag: it said the message is shown "in addition to being shown
in the filters sidebar", but `CenterPointControl` renders only inside
`hotspotsSidebar`, `targetsSidebar` and `lifersSidebar` - never on My Sightings,
which is the one view where the on-map region is the sole carrier. The paragraph
is rewritten to describe what actually ships: the busy state is carried by the
accessible name and the glyph shape (so it survives reduced motion), and
`aria-disabled` is what blocks re-entry without dropping the button out of the
tab order. The sidebar clause is now scoped to the three centre views.

### 6. The privacy property now has a regression guard

**Security review, Low.** "A press on My Sightings sends no coordinate anywhere"
is the claim `PRIVACY_POLICY.md`, `docs/HELP.md` and the PRD all rest on, and it
had been verified only by watching a live network panel - a check of this
revision, not a standing guard. The transport seam was already mocked in
`MapExplorerLocateFab.test.tsx` and never asserted against.

Added as a **pair**, per the report's own note, because the negative case alone
passes on any implementation that has silently stopped searching everywhere: a
press on `sightings` asserts no coordinate-bearing `transport.get` and no
`transport.post`; a press on `hotspots` asserts `/map/hotspots` *is* called with
the detected coordinate (compared numerically, so a formatting change does not
fail it but a wrong coordinate does). Both wait on the button's own busy state
clearing - the handler's `finally` - so neither can assert "no request" against a
handler that had simply not got there yet, which matters because My Sightings has
no coordinate fields to watch.

Mutation-checked: widening the gate to `viewMode === 'hotspots' || viewMode ===
'sightings'` fails the negative case, and disabling the searches entirely fails
the positive one.

### 7. A latent gap in the shared stylesheet parser, found and fixed

`lib/cssTopLevelRules.ts` could not see `:root`. `globals.css` opens with
`@import "tailwindcss";`, and the parser sliced from the file start to the first
`{`, producing the selector `@import "tailwindcss"; :root`, which starts with `@`
and was skipped. Any guard reaching for a token there got `undefined` and, with
optional chaining, passed vacuously.

Fixed by treating a top-level `;` as a selector terminator (four lines), with a
fixture case in `cssTopLevelRules.test.ts` written against the specific wrong
parser, in the style of the five cases already there. The two existing consumers
(`iosChrome.test.ts`, `mapIosFullscreen.test.ts`) are green.

---

## Browser verification

All geometry below is measured in Chromium against the **synthetic demo dataset**
(`SR_DATA_DIR=website/tools/demo-data`), never a real eBird export, with the
production build served by the backend on :1620. Nothing here is arithmetic, and
nothing is a `scrollWidth` assertion.

### QA-16 - the cluster at 320px and 200% text scale

The comparison is like-for-like on one DOM: the shipped build as served, and a
"broken" variant produced by reverting exactly the four cluster declarations this
feature adds. Boxes are `getBoundingClientRect()` per cluster child measured
against the cluster's own content box (the share slot is `display: contents`, so
its button is measured, since that is what the user must reach).

| 320px x 200% | share | locate | fullscreen | Filters | cluster width | leftmost edge | `document.scrollWidth` |
|---|---|---|---|---|---|---|---|
| **shipped (wrapped + capped)** | 88 | 88 | 36 | 124.92 | 288 | **16** | 320 |
| **broken (declarations reverted)** | 88 | 88 | 36 | 124.92 | **366.92** | **-62.92** | 320 |

The broken build leaves the share button **62.92px off the left edge of the
viewport**, where it is unreachable - and `document.scrollWidth` reads exactly
**320**, the viewport width, because a *left* overflow on an absolutely positioned
element never extends the scroll width. The design's predicted numbers reproduce
to the pixel. **A `scrollWidth` check certifies this broken build**, which is why
QA-16 is written as an element-vs-container measurement.

Both rows measured with the region empty; the shipped row holds at every message
length (below).

### The buttons do not move when a message appears

The property that makes the in-cluster placement correct, and the thing nothing
else tests. Every cluster button's frame-relative position, at 320px / 200%:

| region | share | locate | fullscreen | Filters |
|---|---|---|---|---|
| empty | 72,478 | 170,478 | 268,504 | 179.08,576 |
| short message (68 chars) | 72,478 | 170,478 | 268,504 | 179.08,576 |
| longest message (105 chars) | 72,478 | 170,478 | 268,504 | 179.08,576 |

Byte-identical. The cluster grows upward instead (134px -> 266px -> 336px tall),
so the retry button never moves under the user's finger.

### FR-16 - pointer transparency, and what the message covers

`elementFromPoint` at 320px / 200% with the longest message:

| point | hit |
|---|---|
| message centre | `LABEL.sr-map-layers-trails` (stack: `LABEL -> DIV.sr-map-layers -> CANVAS.maplibregl-canvas`) |
| message lower edge (clear of the switcher) | `CANVAS.maplibregl-canvas` |
| gap between two FABs | `CANVAS.maplibregl-canvas` |
| each of the four buttons | that button's own content |

The message element is **absent from the hit stack entirely** -
`elementFromPoint` skips `pointer-events: none` - so it is fully click-through,
and the layer switcher underneath stays operable. `messageOverlapsAnyControl:
false` at every size and message length.

The gap between two FABs reaching the canvas is new: before the
`pointer-events: none` / `auto` pair, the cluster's box swallowed gestures in the
gaps. That pre-existing dead zone is fixed as a side effect.

**The residual the design named, confirmed:** at 320px with 200% text scale the
map area is 363px tall and the longest message renders 191.98px of it, so it does
sit over the layer switcher. No placement avoids that - the message alone is more
than half the available height - and it covers no control, is click-through, and
clears on the next success or view change.

### QA-07 / QA-34 - touch posture, tokens and contrast

| | locate | share | fullscreen |
|---|---|---|---|
| 320px @ 200% | 88 x 88 | 88 | 36 |
| 1280px @ 100% | 36 | 36 | 36 |

The location button matches the share button at both scales. The fullscreen
toggle stays at 36px on a phone - a pre-existing gap the PRD explicitly defers,
and FR-04 holds the new button to the better of the two shipped precedents. It is
now the odd one out in a row of three, so it has been added to `ROADMAP.md`'s On
the Horizon alongside the shared-FAB-base extraction it should be done with.

Message, measured from the rendered element:

| theme | color | background | contrast | opaque | radius | font |
|---|---|---|---|---|---|---|
| light | `rgb(211,31,31)` | `rgb(254,242,242)` | **4.82:1** | yes | 12px | 24px @200% |
| dark | `rgb(248,113,113)` | `rgb(28,5,5)` | **7.07:1** | yes | 12px | 24px @200% |

Both clear WCAG AA, matching the figures already recorded at the token, so no new
parse-the-tokens contrast guard is owed. Every new colour is a `var(--sr-*)`
token; the one literal is the shadow, asserted equal to `.sr-map-loading-chip`'s.

### The rest

- **The shipped handler works end to end in a browser**, not only under mocks: a
  real press with permission denied produced `Location access was denied. Allow
  location access in your browser settings.` in the region.
- **Both glyphs, both themes, screenshotted** at 320px/200% and at desktop width.
  The flag and the target reticle are unmistakably different silhouettes at 17px.
  On Hotspots the share pin is correctly absent and the location button is the
  first control.
- **QA-35 / NFR-04:** a fresh `npm run build` shows no `vendor-maplibre` or
  `us-counties` entry in `dist/index.html`'s modulepreload, and
  `entryChunk.test.ts` is green. No new static import was added anywhere.
- **QA-36 / NFR-05:** the glyph is a leaf `<svg>` inside an existing `<button>`.
  It is not routed through `plantSeq`, `sharePinResetKey`, or any `<SharePin
  key=...>`, so no marker set remounts and no bounds fitter re-runs on the four
  glyph-only surfaces.
- **QA-15:** no `order` declaration exists on the cluster or any of its children,
  asserted over the parsed stylesheet.

### The stylesheet guard is not inert

CLAUDE.md records that a stylesheet test passes on a class that does nothing, so
`mapFabClusterCss.test.ts` was mutation-checked. Each of these fails at least one
assertion: dropping `flex-wrap`; dropping `pointer-events: auto` on the buttons;
giving the locate button a width that diverges from the share FAB; dropping the
phone touch posture; adding an `order` declaration to a cluster child; swapping
the message's `28rem` cap for `448px`; and every route to hiding the live region
listed in note 3 above.

---

## Gates

`npx vitest run` 1987 passed (149 files) - `npm run build` (`tsc -b && vite
build`) clean - `npx eslint src --max-warnings=0` clean - `grep -n '—'` over
`docs/HELP.md`, `README.md`, `website/index.html`, `PRIVACY_POLICY.md`,
`ACCESSIBILITY.md` and the added user-facing strings returns nothing (the only
hits in the diff are code and CSS comments, which the rule excludes).

## Documentation and privacy

`docs/HELP.md`, `README.md`, `website/index.html`, `ACCESSIBILITY.md` and
`ROADMAP.md` updated in this change. `ACCESSIBILITY.md`'s map-controls list gains
both the location button and the share pin (the latter was missing already), and
its paragraph was rewritten after security review so every claim in it matches a
grepped predicate: the busy state is carried by the accessible name and the glyph
shape, `aria-disabled` is named as what keeps the button in the tab order, the
live region is stated to be in the accessibility tree from first render, and the
sidebar's duplicate copy is scoped to the three centre views that actually render
it.

**FR-26 / Q4, the privacy check, recorded.** Both halves were verified. The "Your
Location" sentence remains literally true on My Sightings: `handleUseMyLocation`'s
auto-search branch is reachable only on the three centre views, so a press there
issues no eBird, Nominatim, OpenWeather or NOAA request. But read alone it implies
the coordinate has no outward consequence, and centering the map does cause tiles
for the area around the user to be requested. Per the ratified resolution, a short
cross-reference to "Map Tiles" was added and **neither existing statement was
weakened**. No new provider, no new request, and no change to which component
makes one.

## Not in this change

Version bump, `CHANGELOG.md`, and the `ROADMAP.md` release headline: this is the
last of four builds in a bundled Spool release, versioned once at closeout.
`frontend/package.json`, `src-tauri/tauri.conf.json` and `CHANGELOG.md` are
untouched.
