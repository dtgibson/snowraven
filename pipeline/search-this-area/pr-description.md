## Search This Area

### What this does

Adds a **Search this area** control to the Map Explorer's three centre-based
views (Hotspots, Nearby Lifers, Media Targets). It derives a search **centre and
radius** from the current map viewport, adopts the **centre** into the sidebar as
that view's shared search centre, and re-runs that view's existing eBird search
over the derived area in one press, without opening the Filters panel. **The
derived radius is sent but is deliberately NOT written into the sidebar's Radius
control** — see "The Radius control is the user's" below. It appears only when a press would
search ground the last search did not already cover, and the area the search
actually covered is drawn on the map by dimming the ground outside it.

**The circle COVERS the screen.** The covering radius is measured
centre-to-corner, so it CIRCUMSCRIBES the viewport rather than fitting inside it,
and the shape of the viewport matters and not only its width. It is then snapped
UP to the smallest rung of the sidebar's own 5/10/25/50 ladder that holds it, and
capped at `DERIVED_MAX_MI` (25 mi) by narrowing that ladder. Past the cap the
circle is deliberately smaller than the viewport — the one case where "everything
on screen was searched" stops being true, and exactly the case the drawn
indicator exists to make visible rather than to paper over.

Before this, panning the map somewhere else left stale pins on screen with no
indication they were stale, and the only routes to re-searching were the
coordinate boxes in a sidebar that becomes a full-screen overlay on a phone, or a
right-click gesture with no keyboard equivalent.

No new dependency, endpoint, backend route, Tauri service function, Tauri
capability, tile provider, or persisted setting. `PRIVACY_POLICY.md`,
`package.json`, `backend/`, and `lib/tauri/mapService.ts` are untouched.

### How to test

See `pipeline/search-this-area/how-to-see.md` for the step-by-step version. The
short form: Map Explorer → Hotspots → set a centre → drag the map twenty miles →
press the green **Search this area** pill above the round buttons in the
bottom-right corner.

### Files

| File | |
|---|---|
| `frontend/src/lib/searchArea.ts` | NEW. The pure module: the centre derivation, the covering radius, the rung snap and its cap, the offer predicate's two conjuncts (`hasMovedFrom` + `viewportCoveredBy`), the scrim alpha model, the control-fit predicate, and the two indicator geometries. No React, no map, no clock. |
| `frontend/src/lib/searchOutcomeState.ts` | NEW. The announcement sequence reducer and every string this feature renders. |
| `frontend/src/components/map/SearchedAreaLayer.tsx` | NEW. Three GL layers: a world-covering scrim with the searched circle as a hole, a halo, and a dashed edge. |
| `frontend/src/components/MapExplorer.tsx` | Wiring: the derivation, the pending record, the per-view search record, the control, the live region, and the two trailing parameters (`overrideRadius`, `fromViewport`) on the three fetch handlers. |
| `frontend/src/globals.css` | Two tokens (both themes), three layout classes, one keyframe, one phone-tier block. |
| `frontend/src/lib/mapExplorerTypes.ts` | `CenterViewMode`. |
| `docs/HELP.md`, `README.md`, `website/index.html` | Prose. |
| 5 new test files, 3 pre-existing test files | See below. |
| `website/tools/probe-search-area-radius.mjs` | NEW, dev tool only (not bundled, not published). The Playwright probe behind the R-01 browser table; its header records the four probe hazards that bit while writing it. |

---

## Notes for the reviewer

### The three things most worth checking

**1. The derived radius is passed EXPLICITLY, not read off a closure — and this
is the load-bearing consequence of leaving the sidebar's Radius alone.**
`applyCenter` forwards the derived radius straight to the handler and writes it
nowhere else. Because a press no longer moves the Radius control, `radius` holds
the **user's** setting for the whole session, so the derived radius and the state
radius are simply different numbers rather than a tick apart: a handler reading
`radius` off its own closure would send the wrong distance on essentially *every*
press, and would look entirely self-consistent from the sidebar while doing it.
The explicit third argument is what makes the value sent, the value recorded and
the value **drawn** provably the same number. It is selected `overrideRadius !==
undefined` at the point of use in each handler, never a truthiness check — 0 is
not a radius this app can produce, but a truthy test would silently swap a future
0 for the state value, and the guard costs nothing (its mutant is M3 below).

The fourth parameter position is `fromViewport`, a boolean that suppresses the
results re-fit (see the ratchet section). Both trailing parameters are optional
and falsy by default, and every existing caller passes zero or two arguments —
verified at each site, and both prop-passed callers are typed `(lat, lng) => void`
and invoke with exactly two — so no shipped path can reach either, and only this
control's press passes them. The three `useCallback` dependency arrays are
unchanged: `radius` is still read from the closure on every other route, and a
parameter is not a closure read.

Worth checking specifically: press the control and confirm the request went out
at the **derived** rung's `dist` while the sidebar's Radius SegControl has **not**
moved. The tests that pin this assert both halves on the same press, move off both
the derived value and the shipped default first so "unchanged" cannot pass by
landing on a value already selected, read the whole pressed set rather than one
label, and sweep the sidebar's rung both below and above the derived one.

**2. `MapExplorer.tsx:1072`'s personal-location filter reads `radiusMi`, not the
`radius` state.** It is the only place in the three handlers where the radius is
read for something other than `distKm`, and it must use the same radius the
request used or the map shows personal pins from a circle eBird was never asked
about — on a derived press the two genuinely differ, and now they stay different
for the rest of the session rather than for a tick. Same circle, one variable. It
is guarded by a test whose fixture makes the candidate values *disagree* (the
derivation returns 25 mi while the Radius state stays at the 5 mi default, and the
backup's one personal location sits ~7.7 mi out, inside 25 and outside 5) and
asserts both counts, because most viewports put that location outside both radii
and would pass either way.

**3. The scrim is a world-covering `fill`, and a MapLibre fill is hit-tested at
any opacity.** None of the three layer ids appears in `MARKER_LAYERS`
(AtlasLayer, CountyLayer) or `INTERACTIVE_MAP_LAYERS` (`lib/mapPins.ts`), and the
component binds no pointer handler and calls no `queryRenderedFeatures`. Its only
two `map.on(...)` calls are `styledata` listeners (the dark-basemap flag and the
layer-order re-assert), a style-lifecycle event that carries no pointer target and
hit-tests nothing. Both halves are asserted, and both go red under mutation.

### Decisions worth seeing

**The Radius control is the user's, and the press does not touch it (PRD
revision R-01).** As originally specified, a press adopted *both* derived values
into the sidebar. Shown the built feature in a live preview, the user was asked
directly whether the press should also move their Radius setting and chose to
leave it alone, so FR-10 now adopts the **centre** only. This was decided after
the QA and security passes had completed against the original wording; the
derivation, the record, the suppression predicate and the drawn indicator are all
untouched by it, and the only code change is the removal of one `setRadius` call
from `applyCenter`.

The consequence was named to the user and accepted in these terms: *the button
searches the area you are looking at, but your Radius control keeps whatever you
set, and the map and sidebar can then disagree about what was last searched.* It
shows up in two concrete places, and both are pinned by tests rather than left to
be discovered:

- After a press, the drawn circle and the Radius SegControl show different sizes.
  The circle is the one reporting what was actually searched, which is why FR-17's
  indicator carries more weight after this revision than before it.
- Leaving a centre view and coming back re-runs that view's search from the
  sidebar — shipped FR-15 behaviour, older than this feature — so the search is
  re-issued at the **sidebar's** radius and the ring follows it down to that
  smaller circle. That is truthful (the ring reports the most recent search, and
  the control correctly re-offers itself because the smaller circle no longer
  covers the view) but it does mean a press is not sticky across a view
  round-trip. Before the revision the adoption hid this entirely: the sidebar
  held the derived rung, so the return search reproduced the same circle. It is
  the one behaviour a reviewer is most likely to be surprised by, so it has a
  test of its own that says so in its name.

**The record is written inside the three handlers, keyed by the handler.** FR-15
names six routes that must write a search record; all six funnel through one of
three fetch handlers, so it collapses from a six-site checklist to a three-site
invariant. The write is the last statement of the success path (not `finally`,
which runs on failure too), and it writes the handler's own locals, captured
before the `await` — so a pan mid-flight cannot change what is recorded.
Deliberately keyed by the **handler**, never by `viewMode`: at the view-mode-change
call site the new mode's handler runs while `viewMode` still holds the *old*
value, so a `viewMode`-keyed write would file the search under the view just left.

**Every route announces, not only this control.** The success/empty/failure
sentences are emitted from the same three places as the record write, so the
sidebar Find button, place-name search, Use my location, a pin drop or drag, and
a view-mode change all announce too. On a phone the sidebar is off screen, so
this is a strict accessibility gain on the shipped routes.

**Validation errors are not announced.** The `validationError(...)` early returns
("Enter a valid latitude and longitude", "No target species to search for", the
taxonomy-codes failure) are searches that never ran; they keep today's
sidebar-only behaviour.

**The control is a full-width row in the FAB cluster, BELOW `.sr-map-geo-error`.**
The cluster is bottom-anchored, so a row below the location-failure row keeps an
offset from the bottom that is invariant to whether a location failure is on
screen. That is the property the geo-error row's own comment exists to protect,
and it matters most here because a failed search's retry *is* this control.
Placing it first would move it whenever a location failure appeared or cleared.
It is the first child of the shipped `{!sidebarOpen && (<>…</>)}` fragment, which
satisfies the Filters-overlay gate **by position** — no duplicated condition to
write and none that can drift from the one the shipped discs use.

**The derived radius IS capped, at 25 mi, and OQ-01 stays open.** The open
question is whether eBird honours a `dist` above its documented 50 km ceiling: the
app converts miles to km, so the shipped 50 mi rung already sends `dist=80` while
eBird documents 50 km as the maximum for `ref/hotspot/geo` and
`data/obs/geo/recent`, and nothing in this repo clamps it. It matters here because
a zoomed-out viewport can otherwise derive a large rung, which would be a number
the user never chose on a circle FR-17 draws claiming coverage.

`DERIVED_MAX_MI = 25` is **40 km, comfortably inside the documented ceiling**, and
`snapRadiusMi` applies it by NARROWING THE LADDER rather than clamping the snapped
answer, so the result is a member of `RUNGS` by construction rather than by
coincidence and the derived path can only ever send `dist` ∈ {8, 16, 40} km,
whatever the viewport. The reason is honesty rather than exposure: a user who
picks 50 mi in the sidebar is making their own request, unchanged by this feature,
while a user who presses this control is handed a number they never chose, so it
has to be one this feature can vouch for.

**This was not settled by a live probe, and this PR does not attempt one.**
Settling OQ-01 means measuring eBird's own behaviour above 50 km, which is a
network experiment against a third party rather than anything a test in this repo
can assert. Either answer is a **one-constant change** — raise `DERIVED_MAX_MI` to
50 if eBird honours the request, revisit the app-wide 50 mi rung if it clamps —
and no existing route's behaviour is altered here: `RUNGS` is unchanged, the
sidebar's Radius control still offers all four options including 50 mi, and a
50 mi search from the Find button still sends `dist=80` exactly as before.

**`RadiusControl` now derives its four options from `RUNGS`.** The feature's only
touch of a shipped sidebar control. Two copies of the same ladder in two files is
a silent-drift hazard, and a drift HERE would desynchronize what the derivation
snaps to from what the control can display — a derived radius the SegControl has
no option to render is exactly the disagreement FR-10 forbids. Renders
byte-identically: same four options, same labels, same order; a test pins the four
labels.

### Three pre-existing test files were edited, and no assertion in them changed

`MapExplorerLocateFab.test.tsx`, `MapExplorerCenterShareFab.test.tsx` and
`MapExplorerInputZoom.test.tsx` mock `react-map-gl/maplibre` with only
`useMap`/`Marker`/`Popup`. Once a view has a search record, `MapExplorer` mounts
`SearchedAreaLayer`, which needs `Source`/`Layer`. All three gained the same
`Source`/`Layer` passthrough stubs; **no assertion, fixture, or expectation in any
of the three changed** (the diff on each file is six added lines: four of comment
and the two stubs).

**Two of the three actually failed; the third did not, and the earlier wording
here conflated the two facts.** Measured rather than asserted, by removing the two
stub lines from all three and running them: `MapExplorerCenterShareFab` and
`MapExplorerLocateFab` fail with *"No `Source` export is defined on the
`react-map-gl/maplibre` mock"*, one test each; `MapExplorerInputZoom` passes
unchanged, because no path it drives ever writes a search record, so
`SearchedAreaLayer` never renders in it. Its stub is defensive consistency across
the three sibling suites, not a repair, and it is worth saying so — a reader
diffing the three files and finding the identical edit would otherwise reasonably
infer three identical failures.

Extending the mock was preferred over mocking `SearchedAreaLayer` away in those
files, so the real layer still renders (inertly, with a null map) inside those
suites rather than being hidden from them.

---

## Verification

Every gate run with `set -o pipefail`, status captured as `rc=$?` and echoed
explicitly; nothing piped to `tail`/`head` and read for its exit code.

| Gate | Result |
|---|---|
| `npm run typecheck` (`tsc -b`) | **rc=0** |
| `npx vitest run` (full suite) | **rc=0** — **190 files, 2819 tests passed**, 0 failed |
| `npm run build` (`tsc -b && vite build`) | **rc=0** |
| `npx eslint .` | **rc=0**, no output (0 bytes) |
| `backend: .venv/bin/python -m pytest tests/ -q` | **rc=0** — **234 passed**, 1 pre-existing warning |
| `weft-design-lint check frontend/src` | **rc=0**, **0 warn**, 37 notes |

The table previously read "189 files, 2729 tests", which was two rounds stale.
These are the figures measured at the end of the R-01 pass. The test count moved
**+2 against the immediately preceding run of 2817**, which reconciles exactly:
one test was rewritten in place (the radius-adoption assertion became a
radius-*unchanged* assertion) and three were added (the sidebar rung above the
derived one; the view-switch re-search consequence; and the R-01 press case).

**On the backend gate:** `python3 -m pytest` fails on this machine with *"No
module named pytest"* — Homebrew's `python3.11` is not the project interpreter.
The suite runs under `backend/.venv/bin/python`. Worth knowing before someone
reads a tooling failure as a test failure.

**On design-lint:** all 37 findings are advisory notes and **the finding set is
identical to `HEAD`'s**, verified by running the linter against a detached
`git worktree` at HEAD and diffing the path-normalized, line-number-stripped
finding sets (37 vs 37, `diff` rc=0). No finding is on any file this feature
added — `SearchedAreaLayer.tsx` in particular does not raise the `reduced-motion`
note, because it reads `prefersReducedMotion()`. The pre-existing notes are
`reduced-motion` file-level heuristics on components whose motion is collapsed by
the app's global CSS block, `slow-motion` hits on numbers in test files and on
map fly-to durations, and two `untinted-black` hits on the two overlays'
basemap-anchored boundary-line literal.

### R-01 browser verification (this pass)

jsdom cannot settle any of this: the derivation reads a real MapLibre viewport,
so the rung a press derives exists only in an engine with layout. Measured in
headless Chromium through Playwright (`website/tools/probe-search-area-radius.mjs`),
against the SYNTHETIC demo dataset via `SR_DATA_DIR`, with every `/map/hotspots`
call intercepted and answered locally so no eBird request left the machine.

| Case | Sidebar Radius | Sent `dist` | Sidebar after the press |
|---|---|---|---|
| **A** — zoomed out | 5 mi | **40 km** (25 mi derived) | **still 5 mi** |
| **C** — zoomed in | 25 mi | **8 km** (5 mi derived) | **still 25 mi** |

The two cases **bracket** the sidebar's rung deliberately: in A the derived value
is the larger, in C the smaller. Either case alone would leave the other
direction untested, and C is the one that catches an implementation quietly
sending the sidebar's radius, since there that would mean 40 km instead of 8.
A non-vacuity check asserts the two presses derived different radii.

**Two presses, map unmoved (case B): one lookup.** The second press issued **0
requests**. That alone is not decisive, because `/map/hotspots` sits in the
transport's 90 s `CACHED_GET_PATHS`, so a genuine second dispatch with identical
params would be *served from the client cache and emit no request at all*. So the
check carries a cache-independent second instrument: a watcher on the live status
region, which every dispatch necessarily writes to (each handler clears the
outcome before its fetch and writes a new sentence after). It recorded **0 new
sentences**, and a guard-the-guard proves it is not simply broken — armed across
case C's real press it recorded `["2 hotspots found in this area."]`.

**Three probe defects were found and fixed before any number above was trusted**,
each recorded in the probe's own header so the next person does not repeat them:
the first mutation instrument counted the outcome message's own self-dismiss timer
and reported a dispatch that never happened; zooming *in* after a 25 mi press
correctly withholds the control at every zoom (FR-13's coverage term), so case C
needed a clean reload rather than a continuation; and `page.mouse.wheel` does not
zoom this map in headless Chromium at all, which silently made an early run
measure the same viewport twice and report it as two zoom levels.

That last one was checked rather than assumed, because the obvious reading of the
code says the app is at fault: `MapExplorer` renders `<SnowMap>` without
`scrollZoom`, and SnowMap forwards `scrollZoom={scrollZoom}` — i.e. `undefined`.
The wrapper the app actually uses resolves handler props with
`nextProps[propName] ?? true` (`@vis.gl/react-maplibre/dist/maplibre/maplibre.js:414`),
so `undefined` leaves scroll zoom **enabled** and there is no defect to report.
The probe uses the map's own NavigationControl zoom buttons instead.

### Second QA cycle: the ratchet, and the layer order

**The ratchet (QA-11 / QA-13 / FR-24).** A successful press moved the map out from
under its own search record, so the control re-offered itself and a second press
spent a second lookup, one unrequested lookup per step.

The cause is a feedback loop, not a threshold. The three marker layers re-frame
the map whenever their pin count changes, and the fit reliably re-frames OUTWARD
on the results: the fitted rectangle spans the searched circle, so its covering
radius comes out a rung HIGHER (5 mi to 10 mi to 25 mi, since a rectangle framing
results that span the circle has a half-diagonal approaching `r*sqrt(2)`), and the
fitted centre lands away from the searched one. Either term on its own is enough
to re-offer the control on a map the **user** never moved.

No geometric predicate can separate that from a deliberate user pan or zoom-out,
because the two produce the identical viewport — `searchArea.test.ts` carries a
test saying so by name, so the fix cannot later be dropped in favour of the offer
predicate. The cut is that a search whose centre and radius were derived FROM the
framing does not re-frame: an `autoFit` prop, default `true`, false only for this
control's press. Every shipped route — the sidebar Find button, the place-name
search, "Use my location", a dropped or dragged centre pin, a view-mode change —
still frames its results exactly as before, and each of those genuinely needs to,
because it can set a centre nowhere near the screen.

The suppression is per **result set**, not per press: it holds for as long as the
results on screen came from a viewport-derived search, so it covers every re-fit
trigger on that view over that whole period. A changed pin count is one such
trigger on all three views. A **display filter** is another on two of them, and
that half was previously undocumented: Media Targets and Nearby Lifers each pass
a filtered derivative as `pins` (`displayedTargetPins`, `displayedLiferLocations`),
so the fit key moves when Nearby Lifers' Time Range, or Media Targets' Time Range
or media-type filter, changes — and that re-fit is suppressed too, which is what
stops a filter change yanking the map off a circle the user is still reading.
Hotspots is **not** a third case despite looking like one: it passes the
unfiltered `hotspotPins` and applies `hiddenKinds` as a GL filter expression
inside the layer, so hiding a kind never moves its fit key. Measured per surface,
five cases: with `autoFit` true a filter change re-fits on Media Targets and
Nearby Lifers and does nothing on Hotspots; with `autoFit` false none of the
three moves.

Verified as a **build A/B** in Chromium against the synthetic demo dataset, with
an eBird-shaped stub whose pin count and spread grow with the radius:

| | fixed | guard removed (rebuilt) |
|---|---|---|
| zoom after the press | 12.600 → **12.600** | 12.600 → **11.215** |
| centre moved | **0.000 mi** | 0.270 mi |
| control after the press | retained, `aria-disabled="true"` | **re-offered**, `aria-disabled="false"` |
| lookups for one press + five further activations | **1** | **2** |
| searched circle in a 1300x666px canvas, zoomed out | **175x175px** | 630x630px |

All three centre views, both response configurations. The last row is **QA-19**,
which the re-frame had been erasing: on a zoomed-out view the circle is meant to
read visibly smaller than the screen, and the fit was zooming to the results until
it nearly filled it.

`shouldOfferSearchArea` is a conjunction — a press would SEND something different
from the record **and** the viewport is not already inside the recorded circle.
The second conjunct is a narrowing, so it can only ever withdraw an offer, and it
fixes a different case: a pan taken while zoomed well inside a large searched
circle does reach fresh ground, all of it off screen, while every pin the user is
looking at was already fetched. It is **not** what fixes the ratchet, and
`searchArea.test.ts` says so in a test that asserts the control IS still offered
after a re-frame.

`hasMovedFrom` BEING A CONJUNCT AT ALL is what keeps the CAPPED case correct, and
that is the property most easily broken by a future change. Past `DERIVED_MAX_MI`
the searched circle is deliberately smaller than the viewport, so the coverage
conjunct is false there and stays false however long the map sits still: coverage
ALONE would offer the control in perpetuity on a map nobody has touched, every
press sending the identical centre and the identical capped radius for the
identical answer. A test asserts both halves of that on a viewport spanning most
of California, naming the competing wrong implementation rather than relying on
one lucky fixture.

**The layer order.** The indicator was measured painting BELOW the county fill
(`fill-opacity` 0.85) and would equally sit below the atlas fill (0.45) — not
because of a wrong `beforeId`, but because every overlay inserts below the same
marker layer and mount order decides the rest. Two consequences, and they pull in
opposite directions, so both were settled by measurement rather than argument:

- the dim, the halo and the dashed edge were 85% blocked over any shaded county,
  which is exactly where the feature's claim matters; and
- the tier shift the ramp alpha exists to prevent could not happen there, so
  backing 0.18 off to 0.08 was buying nothing while costing all of that.

Measured over the real basemap, modal rendered colour per tier (single-point
sampling picked up roads and water — three "tier colours" in a first pass came
back a blue and an orange). The smallest step between adjacent tiers, as rendered,
is **1.1425:1**. How far the scrim moves a tier:

| | below the fills | above the fills |
|---|---|---|
| 0.08 | 1.027–1.037 | **1.135–1.172** (0.95–1.19 of a step) |
| 0.18 | 1.058–1.128 | 1.329–1.460 (2.14–2.84 of a step) |

Below the fills even 0.18 stayed under one step. So the coherent fix is to enforce
the order — the group immediately below the marker layers, re-asserted on
`styledata`, moving only when out of position — at which point **0.08 is the right
constant and is load-bearing**, and the unit test that pins it (which already
composited the scrim OVER the rendered tier) is finally modelling the shipped
stack. Over unshaded ground the scrim is 1.178:1 either way; inside the circle it
moves nothing at all (1.000, the control in every run).

**Flagged, because it changes an approved look:** with a shading ramp on, shaded
ground *outside* the searched circle now dims by ~8% where it previously did not.
That is the design's own primary mark finally reaching the pixels; nothing changes
inside the circle, and nothing changes at all when no ramp is active. Hit-testing
is untouched — every `queryRenderedFeatures` in this app is layer-scoped, so the
county and atlas click handlers and `updateMapCursor` cannot see what sits above
them, and markers still paint on top.

### Entry-chunk standing check

`vendor-maplibre` is **absent** from `dist/index.html`'s modulepreload (grep count
0). `entryChunk.test.ts` passes. `SearchedAreaLayer.tsx` imports
`react-map-gl/maplibre` and is imported only from `MapExplorer.tsx`, which is
already lazy; `searchArea.ts` and `searchOutcomeState.ts` are React-free and
map-free.

### Mutation testing

**Fourteen** mutations, run through a harness that **sanity-checked an unmutated
baseline first** (all four suites rc=0), refused to score a mutation that did not
change the file's hash, and verified restoration after each — restoration checked
against the *intended* properties (writer count, guard spellings, forwarding
sites) and a re-run of the suite, not by diffing the restored file against the
snapshot used to restore it, which is identical by construction.

(The count is stated as fourteen because the table has fourteen rows. An earlier
revision of this section said "eleven" over a thirteen-row table; the rows were
right and the number was not. M9 is new in PRD revision R-01.)

| # | Mutation | Result |
|---|---|---|
| M1 | Drop the third `applyCenter` argument (the derived radius) | **RED** |
| M2 | Personal-location filter reads state `radius` | **RED** |
| M3 | `overrideRadius !== undefined` → truthiness, at each handler's point of use | **RED** |
| M4 | Add `sr-search-area-scrim` to `INTERACTIVE_MAP_LAYERS` | **RED** |
| M4b | Add `sr-search-area-line` to `AtlasLayer`'s `MARKER_LAYERS` | **RED** |
| M5 | Reducer stops advancing `seq` on an identical repeat | **RED** |
| M5b | Drop `key={outcome.seq}` from the message node | **GREEN** (expected — see below) |
| M6a | `:empty { display: none }` on the region, top level | **RED** |
| M6b | `display: none` on the region, smuggled into the phone tier | **RED** |
| M6c | `visibility: hidden` on the region | **RED** |
| M6d | Delete the region's positive `display`, so the scan could pass vacuously | **RED** |
| M7 | Ungated `env(safe-area-inset-*)` rule on the control | **RED** |
| M8 | Centre the region with `left: 50%; translateX(-50%)` | **RED** |
| M9 | Reintroduce the adoption: `if (radiusMi !== undefined) setRadius(radiusMi)` in `applyCenter` (R-01) | **RED** — 7 tests |

**M5b is the one documented GREEN, and it is a fact about what a
mutation-counting test can prove rather than a gap.** Each handler's leading
`setSearchOutcome('')` unmounts the message node before its fetch, and a result
also self-dismisses on a timer, so the node genuinely remounts between
announcements and the remount is a real DOM addition with or without the key. The
component test says exactly this in its own comment and names the assertion that
*does* carry the guarantee: the sequence semantics in
`searchOutcomeState.test.ts`, which M5 turns red. The keyed child ships anyway,
because the case it protects (two announcements with no clear between them) is a
refactor away rather than impossible.

### Browser-level verification: what was measured, and what is still open

**This section previously listed QA-19, QA-31, QA-32, QA-35, QA-41, OI-01 and
OI-02 as "NOT performed". That was written before the QA rounds ran and was never
updated, and it contradicted `qa-report.md`, which records all five QA rows as
measured and Pass (QA-31 in both engines). The list below is reconciled against
that report rather than left as it stood.**

Measured in a real browser and recorded in `qa-report.md` — Chromium **and**
WebKit throughout, WebKit deliberately because it is the engine the macOS and iOS
apps ship on:

- **QA-31 / NFR-01** — round 4, re-measured: control geometry at 320, 390 and
  1440 px wide, at 1x and 200% text scale, in both engines. Rounds 1 to 3 also
  carried the containment claim, measured as **text ink and box against the
  container's content box** rather than as a page `scrollWidth`.
- **The no-overlap claim** — carried forward from rounds 1 to 3: non-overlap with
  the layers switcher, confirmed in both engines.
- **OI-01** — carried forward from rounds 1 to 3: the shipped buttons' positions
  measured unchanged with and without the control **and** with and without a
  location-failure message, which is exactly the both-rows-present case the open
  item asked about. Round 4 then swept 40 live configurations down to 320x260,
  where the control is withheld at 200% by the fit predicate rather than
  overflowing.
- **OI-02** — all eight `scrimOpacity` branches measured, plus the enforced layer
  order with markers above the indicator. The open item's own premise was wrong
  and is corrected in "Second QA cycle" above: inserting below the marker layers
  does not put the scrim above the atlas and county fills, because every overlay
  inserts below the same marker layer, so whichever mounts LAST ends up on top —
  and measurement found the county fill above the indicator. The sanctioned fix
  for the alpha itself, a basemap-conditional value and never a change to the
  token's colour, held and is what shipped.
- **QA-19** — capped searches draw a circle visibly smaller than the viewport.
- **QA-32** — the `.sr-ios-app` gated inset, no double inset, positioned ancestor
  named in code and asserted; measured on a WebKit iPhone 13 device profile.
- **QA-35** — on-control text clears 4.5:1 in both themes from parsed tokens.
- **QA-41** — a `moveend` with the control mounted does no network work and no
  layout beyond the shipped bounds report.

Genuinely still open, and narrower than the old list claimed. Both are items the
QA report does not assert either, so this is not a retreat from anything measured:

- **QA-27's accessibility-TREE half** — an `ariaSnapshot` (or CDP
  `Accessibility.getFullAXTree`) against a real render showing the status region
  present while **idle**. The stylesheet scan rejects every rule that could hide
  it, the component test proves it is in the DOM, and the security report checks
  the `display: flex`/`:empty` prohibitions — but none of those is an
  accessibility tree, and this repo's own convention is that only a real engine
  settles that question.
- **QA-32 on real hardware, and a physical rotation.** The safe-area inset was
  measured through a device profile, not a device; `qa-report.md`'s Known
  Limitations says the same thing in the same words.

### The Tailwind source-detection check

Tailwind v4 auto source detection scans test files too and emits a rule for any
bare word that names a real utility, **comments included**. Measured rather than
assumed: with the five new test files present, `dist/assets/index-*.css` was
52,021 bytes; with them moved aside, 51,802. The 219-byte delta was one rule,
identified by diffing the selector sets, emitted from a single word in a comment
in `mapSearchAreaCss.test.ts`. That comment was reworded to describe the word
rather than spell it, and the stylesheet is now **byte-identical and
hash-identical** to the build with those five files removed entirely
(`9535eca9…`, 51,802 bytes), with a determinism control (HEAD built twice,
identical) and a reproducibility control (restore, rebuild, delta returns).

**Re-measured for R-01, which edited `docs/HELP.md` — and it corrected a claim
made earlier in this feature's own QA record.** The build after the R-01 prose
edits (`docs/HELP.md`, `README.md`, `website/index.html`) produces
`index-DGvd7JYs.css`, sha256 `9535eca9…5a5e`, **51,802 bytes**: byte- and
hash-identical to the recorded baseline, so none of that prose reached the
stylesheet.

That result would be worthless if the check could not fail, so it was made to
fail. Appending one rare single-word utility to `docs/HELP.md` and building clean
(with `dist/` and the Vite cache removed) emitted **no** rule and moved nothing.
The identical word in a comment in `frontend/src/lib/useSearchControlFit.ts`, as a
control in the same session, **did** emit it and moved the bundle to
`index-DwP8Vg1P.css` / 51,829 bytes; reverting returned it to `index-DGvd7JYs.css`
/ 51,802 with the rule gone.

So the mechanism is live for source files and **`docs/HELP.md` is not scanned at
all** — it sits at the repo root while the build runs in `frontend/`, outside
Tailwind's scanned tree. `qa-report.md`'s QA-38 sensitivity control claimed the
opposite for that file; it has been corrected in place rather than left standing.
Being *bundled* (through the `?raw` import) and being *scanned* are different
things, and only the first is true of `docs/HELP.md`.

### What this change deliberately does not do

- No automatic search on pan or zoom, in any form, including debounced. Twenty
  synthetic pans with the control on screen issue zero requests, asserted.
- No `AbortController`. A fetch in flight is let finish; the record holds what
  was sent.
- No change to `applyCenter`'s pre-existing unrounded pass-through, or to the
  Media Targets gate discrepancy between the view-mode switch and `applyCenter`.
  Both observed, both left alone; this feature adopts `applyCenter`'s condition so
  a press behaves exactly like a pin drop.
- No fourth FAB, and no change to the FAB row's contents, geometry, or measured
  4.00px of horizontal slack.
- Nothing persisted. Asserted against the storage seam.
- **No change to the user's Radius setting.** A press writes the centre and
  sends the derived radius; the sidebar's Radius control has exactly two writers
  and neither is this feature (R-01), pinned structurally so a third cannot
  reappear unnoticed.

---

## Convention Flags

- **A full-width ACTION row in the map's FAB cluster is now a pattern.** The
  cluster already hosted a full-width *message* row; this establishes the action
  form on the same mechanism (`flex: 0 0 100%`, the cluster's own `row-gap` /
  `justify-content` / `max-width` doing the work, bottom-anchored so it grows
  upward and no shipped button moves). The transferable ordering rule: **a row
  whose position must be stable under a neighbouring row's appearance goes BELOW
  that neighbour**, because the cluster grows upward.
- **A labelled action in that cluster takes the accent-TINTED treatment, not the
  accent-filled slab** — a solid accent fill on the map canvas means sighting
  pin, and the accent-filled Filters pill already sits in the same cluster.
- **The map-anchored theme-identical token family gains a third member.**
  `--sr-search-area-rgb` / `--sr-search-area-scrim-rgb` join `--sr-share-pin`,
  `--sr-map-pin-*`, `--sr-rank-pin-*` and the county ramp. Red-orange `#B4341F` is
  now shared by two map graphics (the planted share pin and the searched-area
  edge), deliberately reusing one audited value because they never co-occur as a
  data class and shape distinguishes them. It is the last free hue on this canvas:
  green, amber, violet, blue, purple and slate are all spent.
- **A GL paint transition does NOT inherit the app's global reduced-motion
  collapse.** MapLibre `-transition` values are configured in JavaScript and
  rendered on the canvas; no CSS rule reaches them. Any future GL layer that
  animates must read `prefersReducedMotion()` from `lib/scroll.ts` and pass
  duration 0. Read it in a state initializer, never in render.
- **An absolutely positioned live region that WRAPS must be anchored `left` AND
  `right`, never centred with a 50% translate.** A box with only `left` set
  shrink-to-fits against the space from that edge, giving a wrapping message half
  its container's width. The shipped loading chip gets away with the 50% form only
  because it is effectively single-line.
- **`weft-design-lint`'s finding set can be baselined against `HEAD` with a
  detached `git worktree`**, which turns "these notes are all pre-existing" from a
  claim into a diff. Worth reusing.
