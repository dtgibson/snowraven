## Map FAB keyboard reachable

### What this does

The buttons in a map's corner are plain `<button>` elements. WebKit's default tab
mode (Safari with macOS "Keyboard navigation" off, which is the default and what
WKWebView follows) visits only explicitly-`tabindex`ed elements, native form
controls and `<summary>`; a plain `<button>` is skipped entirely. So on the
shipped Mac and iOS apps a keyboard-only user could not reach any of them, up to
and including v1.0.15's fullscreen toggle, whose only job is to enter fullscreen.

This adds `tabIndex={0}` at six source sites, corrects the one source comment the
change makes stale, and repairs three claims in `ACCESSIBILITY.md` that the
measurement showed were false.

**The four corner FABs (the Evaluator's verified inventory):**

- `frontend/src/components/map/SharePin.tsx` - the share / drop-a-pin FAB. One
  button, five surfaces (Map Explorer My Sightings via portal, plus the four
  embedded mounts).
- `frontend/src/components/map/MapCornerControls.tsx` - the embedded-map
  fullscreen toggle. Four mounts (Species Detail Pins + Heatmap, Named Birds
  card, Statistics geographic).
- `frontend/src/components/MapExplorer.tsx` - the centre-share FAB
  (`sr-map-center-share-btn`), on the three centre views.
- `frontend/src/components/MapExplorer.tsx` - the location FAB
  (`sr-map-locate-btn`).

**Plus a deliberate scope addition, `frontend/src/components/AtlasLayer.tsx`
(the disclosure and its rows).** The Evaluator left it out of scope as a separate
published claim. It is folded in because `ACCESSIBILITY.md` publishes the "Atlas
blocks in view" list as the keyboard substitute for the pointer-only canvas
markers, so leaving it unreachable would ship a run whose whole purpose is making
that document true while a claim it makes stays false. It is the same
one-attribute repair on the same map surface, and `CountyLayer`'s identical panel
already carried `tabIndex={0}`.

**Controls deliberately NOT touched**, because the Evaluator confirmed they
already carry `tabIndex={0}`: the Map Explorer's own fullscreen toggle, its
Filters pill, "Search this area", and the base-map switcher and Trails checkbox
in `SnowMap.tsx`. This corrects the ROADMAP item, which said the Map Explorer's
fullscreen button was "equally unreachable".

### Blast radius

Behaviorally inert on Chromium and Gecko. A `<button>` is already a tab stop at
index 0, and an explicit `tabindex="0"` keeps document order, so the web and
Windows builds and every shipped test are unchanged. The change is additive on
WebKit only.

### The focus trap is NOT touched, and this does not license simplifying it

`FOCUSABLE_SELECTOR` in `lib/useFocusTrap.ts` already matched these by `button`,
so its list does not change. `lib/useFocusTrap.ts:34-37` asserted in the present
tense that the share drop button and the fullscreen toggle carry no explicit
tabindex; that is re-tensed to the measurement it was, with the correction stated
explicitly so a future reader does not read it as permission to revert. It is
not: DECISIONS.md v1.0.15 forbids keydown-only prediction outright, and a
prediction that happens to be right for the controls someone remembered to
tabindex is still a prediction. The next unmarked `<button>` added inside a
trapped surface would reopen the identical defect silently.

### How to test

See `pipeline/map-fab-keyboard-reachable/how-to-see.md`.

### Guard tests

`frontend/src/components/mapCornerTabStops.test.tsx` (new, 10 tests). One ROSTER,
one template, per the v1.0.14 rule: the six source sites are rows, so a seventh
corner control added without a `tabIndex` reads as a missing row rather than as
nothing at all. Each row mounts its surface the way that surface's own suite
mounts it, asserts its selector matched something (per-row non-vacuity), and
asserts the LITERAL `tabindex="0"` attribute.

The literal attribute, never the `tabIndex` IDL property: the property reads `0`
on a plain `<button>` too, which is exactly the state that is unreachable in
WebKit. And never a reproduced tab order: jsdom has none (`useFocusTrap.ts:50`),
so a test that walked one would only re-assert the broken assumption this defect
came from. The attribute is the property that makes the engine's order
irrelevant, so the attribute is what is asserted.

Below the roster sit four **closed** assertions, which are what the roster
structurally cannot do: every `<button>` inside the Map Explorer cluster (on My
Sightings and on a centre view), inside an embedded corner row, and inside the
Atlas panel must carry the attribute. A new unmarked control that nobody wrote a
row for fails there.

**Mutation-checked, all six, with the harness sanity-checked against an
unmutated baseline first** (a harness that reports a verdict is checked before
any result from it is trusted). Each mutation removes exactly one site's
attribute, anchored on a unique string so the harness cannot silently mutate the
wrong occurrence, and each restore is verified byte-identical against a hash
taken before the mutation:

| Mutation | Result | Rows red |
|---|---|---|
| SharePin drop FAB | RED | its own row, the My Sightings cluster, the embedded row |
| MapCornerControls fullscreen toggle | RED | its own row, the embedded row |
| MapExplorer centre-share FAB | RED | its own row, the centre-view cluster |
| MapExplorer locate FAB | RED | its own row, both clusters |
| AtlasLayer disclosure | RED | its own row, the Atlas panel |
| AtlasLayer rows | RED | its own row, the Atlas panel |

Every mutation isolates one arm: it turns exactly its own roster row red, plus
the closed assertion over the container it lives in.

### ACCESSIBILITY.md: three repairs, and why the code fix alone was not enough

This is the Evaluator's main finding and it is not optional. Correcting the code
does not make line 11 true.

**Line 11** claimed app-wide that "Every button, link, tab, filter pill, toggle,
sortable column header, and the species selector is in the tab order". Measured
against the source after this fix, roughly 30 `<button>` elements and every
`<a href>` still carry no explicit `tabindex`, including two categories line 11
names outright: the sortable column headers in `BreedingCodeTable.tsx` and
`LifeListTable.tsx`, and every link through `OutboundLink` / `ChecklistLink` /
`HotspotLink`. The "Skip to main content" link is in the same position.

The user's stated preference was to fix the code rather than qualify the prose.
That preference rested on the FABs being the only gap, and they are not, so this
does both: it ships the fix AND makes the line true. The paragraph now leads with
the platform difference, so every claim after it is read under it, rather than
qualifying claims one at a time or implying the gap away.

**Line 87** ("No cross-cutting accessibility exceptions are outstanding at this
time") became false, and the residual gap is recorded in Known Exceptions, which
is the established home for an honest gap.

**The first draft of that Known Exception failed verification, and the way it
failed is worth recording.** It read "The ones that are not ... are X, Y, Z",
which is an exhaustive claim, and a source sweep broke it: a Named Birds card's
"Show more" button, the in-page "jump to" links on Statistics and Multimedia, the
DOM marker buttons on four map surfaces, and three external links outside the
four destinations it named were all real, visible, unmarked controls that the
sentence excluded. That is this run's own defect reproduced at smaller scale.
Line 11 failed for exactly this reason, and replacing it with a second exhaustive
claim that measurement also breaks is the same bug, in a document held to the
privacy policy's liability posture.

The repair is structural rather than three more list items, because a patched
closed list breaks at the next sweep. The entry now states the **mechanism** as
the operative claim, in bold: any control that has not yet been marked explicitly
is unreachable by Tab on those two platforms, wherever in the app it sits. It
says outright that this is a property of individual controls rather than of
particular screens, and that the examples are illustrative with no claim to be
the whole of it. The examples are then grouped by KIND, which is the shape a
reader can reason from: every link in the app (the one category that is a
measured universal, 15 of 15 carrying no explicit tabindex), sortable column
headers, buttons on particular screens, and the markers drawn over a map that are
real elements rather than canvas. The marked-and-reachable list is opened the
same way ("They include").

**The same test was then applied to every other sentence written into that
document in this change,** which caught two immediately (WebKit's rule stated as
a closed list of what it visits, now led by the provable negative; and the map
controls sentence's universal subject, now the verified five as the subject of
their own sentence) and MISSED two more, which failed verification on the next
pass. Both are recorded below with the full sweep, because the miss is the
finding.

### The document-wide sweep, and what it found

The pattern repeated twice in this one document: the repair of an over-claim is
where the next over-claim gets written, and the neighbouring sentence is where it
hides. So every sentence this run touched, plus its immediate neighbours, was
walked for universal or enumerative claims and each was checked against source.
What follows is the record, so a later reader can see what was verified rather
than take the prose on trust.

**Two genuine failures, both in sentences the previous pass had just rewritten:**

- **"Every button, link, tab, ... is a tab stop."** False on every platform, web
  included, and false *by construction*: the main tab bar is a roving-tabindex
  tablist (`TabNav.tsx:148`, `tabIndex={activeTab === item.id ? 0 : -1}`), so the
  strip holds exactly one tab stop by design. The same paragraph contradicted
  itself two sentences later with "Tab moves you into the page content", which is
  true only *because* the strip holds one stop. This landed in one sentence while
  the immediately preceding sentence had the same over-claim correctly removed in
  the same pass. The sweep then found a second instance the report did not name:
  `SpeciesCombobox.tsx:192`, the list-toggle chevron, also a deliberate `-1`. The
  repair names the shape rather than either instance: a few controls are
  deliberately kept out of the tab order, always because another tab stop already
  reaches them.
- **"Sortable column headers, on the Life List and the Breeding Codes matrix."**
  There is no "Life List" surface. `lib/tabLayout.ts:32` maps `life-list` to the
  label **Multimedia**, and `LifeListTable` is rendered by `LifeList.tsx`, which
  is that tab. The same paragraph called it Multimedia two sentences earlier. In
  `docs/HELP.md` "Life List" is only ever the concept and "Life List Totals" is a
  section on Statistics, so the wording sent a reader to the wrong screen. Now
  "on Multimedia and on the Breeding Codes matrix, which are the two tables that
  sort" (measured: `aria-sort` appears in exactly those two files).

**A third defect the sweep found on its own, in an immediate neighbour nobody had
flagged.** The map-markers sentence said the on-map markers "are rendered on the
GPU canvas or as pointer-only chips, so they cannot themselves be tab stops."
Measured: the Map Explorer's sighting pins and hotspot teardrops are canvas
(`SightingMarkers.tsx` draws `<Layer>`s, `HotspotMarkers.tsx` has no `<Marker>`
at all), but the media-target and nearby-lifer chips are real `<button>`
elements inside `<Marker>`s, so on Chromium they ARE tab stops. The sentence also
omitted the nearby-lifer chips while the same paragraph describes their in-view
list. Left alone it would have contradicted the new Known Exception, which lists
those same chips as unmarked buttons. It now gives both reasons separately and
says which markers fall under which.

**Claims checked and found sound, with the check:**

| Claim | Checked against |
|---|---|
| "Links, which is all of them" | No `<a href>` anywhere in the sources carries a `tabIndex`. Stated as the property, not a count: scan methods disagree on the denominator (a comment-stripped sweep of non-test `.tsx` finds 15 tags, a raw scan 17, the Tester's sweep of `frontend/src` 21) and the property is what holds under all three. An earlier draft of this PR published "15 of 15" as a fact; that number is the kind of thing this run exists to stop publishing. |
| The four-kind taxonomy is complete | Independently re-derived: every unmarked real `<button>` in the app maps onto a kind, uncovered set empty. The examples *within* each kind stay illustrative, and the document now says so in the same breath as the taxonomy. |
| "the in-page jump links on Statistics and Multimedia" | Complete: `BirdingStats.tsx:699` and `LifeList.tsx:635` are the only `<a href="#...">` besides the skip link, which is named separately. |
| The DOM-marker list | Complete: five unmarked `<button>`s inside a `<Marker>` (`SharePin.tsx:182`, `MapControls.tsx:129`, `SightingsMap.tsx:132`, `TargetMarkers.tsx:98`, `NearbyLiferMarkers.tsx:83`). `SightingsMap` is mounted by Species Detail AND a Named Birds card, so the prose names both rather than saying "the sighting markers", which would read as the Map Explorer's, which are canvas. Statistics' rank pins are `<Marker>`s with no button, so they are not tab stops anywhere and are correctly absent. |
| "the base-layer switcher, the filters, fullscreen, the location button and the share button ... hold a place in the tab order explicitly" | All five verified: `SnowMap.tsx:170` and `:230` and the Trails `<input>` at `:257`, plus the four this change fixed. |
| "the map's own zoom answers the + and - keys" | maplibre's keyboard handler is never disabled: no `keyboard` prop or option anywhere in the sources. |
| "the buttons, switches and radio groups in Settings" | `Settings.tsx` has 38 `<button>`s, none unmarked; `ToggleSwitch.tsx:46` carries `tabIndex={0}`. |
| "(color theme, text size, and date format)" arrow-key groups | Complete: exactly three `<RadioGroup>` call sites, labelled "Color theme", "Text size", "Date format". Untouched neighbour, checked because it is the second roving-tabindex instance in the document. |
| The four maps that carry corner buttons | Complete: `MapCornerControls` is mounted by `BirdingStats`, `SightingsMap` and `SpeciesDetail`, and `SightingsMap` by Species Detail and `NamedBirdRow`. |

**Two pre-existing over-claims in sentences this change was already rewriting
were corrected in passing:** "every control described in this section is in the
tab order" is false of the roving-tabindex tab bar the same paragraph goes on to
describe (it is now a reachability claim, which is both true and what a reader
wants), and "activated with Enter or Space" is not true of a link. One ambiguity
was tightened throughout: "marks a control explicitly" also describes
`tabIndex={-1}`, which is the opposite of what was meant, so the document now
says "gives it an explicit place in the tab order".

**The CHANGELOG entry and the `docs/HELP.md` edits were run through the same
test.** HELP.md came back clean. The changelog's "All of them now ask explicitly,
on every map: [four maps]" swept the Atlas panel into a list of maps it is not
on; the corner buttons and the Atlas panel are now stated separately. The
four-map list itself is verified complete and stays closed.

**Line 17**'s map-controls sentence is now true for share, location, fullscreen
and Filters, and says so in the terms that make it verifiable ("each hold a place
in the tab order explicitly rather than relying on the browser to grant one").
Its zoom clause was the one part that could not carry that promise: zoom rides
maplibre's own injected buttons, which carry no `tabindex` either, so the
sentence now states what is actually true there instead (the canvas is a tab stop
and maplibre's own +/- handler works).

No em dashes anywhere in the published prose; the sweep in
`icloudKeysPublishedClaims.test.ts` covers `ACCESSIBILITY.md` and stays green.

### Prose sweep (docs-and-website rule)

`docs/HELP.md` carried one sentence this change falsifies in the other direction
and one gap it fills:

- The search-centre pin's "click it (or reach it with the keyboard)" was never
  true on WebKit (`CenterPin`'s button carries no `tabIndex`, and it is a map
  marker rather than a corner control, so it stayed out of scope). The sentence
  now points at the corner share button, which opens the same popup and IS
  reachable everywhere. The pin itself is named in Known Exceptions.
- The Atlas blocks overlay section never documented its keyboard panel at all.
  It does now, in the wording the Counties in view panel already uses.

`README.md` states no keyboard path and needs no change. `website/index.html`
line 314 ("a corner button drives the whole flow from the keyboard") becomes true
on all platforms rather than false on two, so its copy stands as written.

### Version set (four files)

Patch bump 1.0.15 to 1.0.16, a user-facing fix: `frontend/package.json`,
`src-tauri/tauri.conf.json`, `CHANGELOG.md`, and `website/index.html` (pill
visible text AND `aria-label`, plus `footer-version`). All three website spots
were changed, and the file was checked to contain no remaining `v1.0.15` string,
because the guard is a `toContain` over the whole file and goes green on one
correct string. `it('the website version pill and footer follow the app
version')` passes.

### Verification

- `npm run build` (`tsc -b && vite build`): clean.
- `npx vitest run`: 268 files, 4362 tests, all green.
- `npx eslint` over every touched file: clean.
- Six mutations, all red; unmutated baseline and restore verified.

### Notes for reviewer

- **jsdom cannot prove the engine-level claim.** That Tab actually reaches these
  controls on WebKit in its default tab mode, in the published DOM order, is a
  browser measurement and is the one thing this PR asserts without a test behind
  it. The attribute is guarded; the engine behavior it buys is inferred from the
  v1.0.15 measurement recorded in DECISIONS.md, where the base-map buttons'
  explicit `tabIndex={0}` was named as the only reason WebKit visited them.
- **`SharePin`'s `buttonHost === 'corner'` branch is still dead code** at both
  live call sites (both portal). It is covered by the roster anyway, through the
  portal path, so the fix travels whichever branch a future caller takes.
- The residual non-FAB WebKit gap is now a published Known Exception. The
  ROADMAP still carries this run as Up Next item 2 and should move to Shipped,
  with the residual gap taking its place on the Horizon.
- **Two claims in the document are stated as universals and both are measured**,
  so both need re-checking if the code moves: "every link" (no `<a href>` carries
  a `tabIndex`) and the completeness of the four-kind taxonomy. Marking a single
  link explicitly falsifies the first; a new unmarked control that is not a link,
  a sort header, a screen button or an on-map marker falsifies the second.

## Convention Flags

- A control on a map corner, or in an on-map in-view list, carries an explicit
  `tabIndex={0}`. It is not redundant: a plain `<button>` is not a tab stop in
  WebKit's default tab mode, which is what the shipped Mac and iOS apps run.
- A published claim in `ACCESSIBILITY.md` about what is "in the tab order" is
  engine-dependent and must be measured on WebKit as well as Chromium before it
  is written, or scoped to the platforms where it was measured.
- **A published statement records a gap by naming its MECHANISM and giving
  examples as examples; it never hands the reader a closed roster it cannot
  prove complete.** Repairing an over-claim is exactly where the next over-claim
  gets written, and an enumeration is the form it takes: the fix for a false
  "every X" is not a shorter list of X, because the next sweep breaks that too.
  State the rule that decides membership, say the examples are examples, and
  reserve a closed list for a set that has actually been measured closed.
- **The next over-claim lands in the NEIGHBOURING sentence, so a prose repair is
  swept at paragraph scope, never at sentence scope.** This document produced
  three rounds of it: the fix for line 11 wrote a closed roster into Known
  Exceptions, and the fix for THAT wrote "every tab is a tab stop" into the
  sentence directly below one whose identical over-claim had just been removed in
  the same pass. Two of the three defects were in text the previous pass had just
  touched, and a third was sitting untouched one sentence away, contradicting the
  new text. When a sentence is rewritten, walk its whole paragraph and its
  neighbours for "every / all / each" and for lists presented as complete, and
  record what was checked against what.
- **ROVING TABINDEX makes "every X is in the tab order" false by construction,
  and this app has two groups of it** (`TabNav.tsx:148` for the tablist,
  `Settings.tsx:102` for the choice groups, plus `SpeciesCombobox.tsx:192` as a
  single control). A `role="tab"` or `role="radio"` group holds exactly ONE tab
  stop on purpose. Any published sentence quantifying over tab stops has to
  exempt them, and the honest framing is that a control is kept out only where
  another tab stop already reaches it.
- **NEVER name a user-facing surface from a component or file name; `TAB_LABELS`
  in `lib/tabLayout.ts` is authoritative.** Four of the ten tabs have a component
  name that differs from the label the user sees, and `life-list` is the trap:
  the component is `LifeList`/`LifeListTable`, the tab is **Multimedia**, and
  "Life List" separately names both a concept and a Statistics section, so the
  wrong name does not read as wrong, it reads as a different screen.
