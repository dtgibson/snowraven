# WebKit tab order, app-wide

## What this does

WebKit's default tab mode gives no place in the tab order to a plain `<button>` or a plain
`<a href>`. That is Safari with macOS "Keyboard navigation" off, which is the default, and it is
what WKWebView follows, so it is what the shipped Mac, iPhone and iPad apps get. v1.0.16's first
build marked six map corner controls and established that the gap was app-wide.

This closes the rest. **46 one-token edits**: `tabIndex={0}` at the 30 unmarked `<button>` sites and
the 15 unmarked `<a href>` sites, plus a repair at `Calendar.tsx:134`. Two of the anchor edits are
component-level and carry the leverage: `OutboundLink` (39 call sites, counting the `HotspotLink`
that renders through it) and `ChecklistLink` (24). **Two edits, 63 call sites.**

Chromium and Gecko are unaffected: an explicit `tabindex="0"` preserves document order, so the web
and Windows versions are behaviourally identical. This is additive on WebKit only.

### The inventory, re-derived rather than taken on trust

The bug-brief's AST-derived inventory was reproduced independently before any edit, with a fresh
script over the TypeScript compiler API: **79 non-test `.tsx` files, 218 `<button>` (30 unmarked),
15 `<a href>` (15 unmarked)**. Identical to the brief, including the detail that resolves the
earlier count discrepancy: `BirdingStats.tsx:1206` is a `<button>` inside a *source comment*, which
an AST walk does not see as an element at all, because `{/* ... */}` parses as an empty JSX
expression container. The real count is 30, not 31.

After the change the same scan reports **0 unmarked** of either kind, and 219 buttons (the extra one
is the app-owned popup close button described below).

### `Calendar.tsx:134` needed more than the token

The Calendar's `Switch` set `aria-disabled` **and** `tabIndex={disabled ? -1 : 0}`, which is a
direct divergence from `.claude/rules/ui.md`'s rule that a control which is not operable but whose
*reason* must be readable in place stays focusable, with the reason wired through `aria-describedby`.
Dropping it from the tab order put the explanation out of reach of exactly the user it was written
for.

Both halves are done. The switch is now unconditionally `tabIndex={0}`, and it takes a `describedBy`
prop (mirroring `ToggleSwitch`'s existing `ariaDisabled` shape) pointing at `COUNT_FORMS_HELPER`,
the note **already rendered beside it**. The rule says to associate a neighbouring note rather than
repeat it, so no new copy was added. Inoperability is the `onClick` guard's job, which was already
there; the wrapper's `pointerEvents: 'none'` never blocked keyboard activation anyway.

### The live defect: the Calendar's day dialog

The brief predicted this and asked for it to be verified rather than assumed. It was.

`Calendar.tsx` hand-rolls its own focus trap with its own copy of the focusable selector and **no
`focusin` containment arm**, so it contains by comparing `document.activeElement` against the ends
of a `querySelectorAll` list. That is a prediction of the engine's tab order, which `DECISIONS.md`
v1.0.15 forbids. The dialog's only focusable content is the Close button (`:623`) and one
`ChecklistLink` per row (`:722`), and neither was marked, so **on WebKit the dialog held zero tab
stops**: `closeRef.current?.focus()` put focus in, the first Tab went to the next
explicitly-tabindexed element in the document (behind the modal), `activeEl === last` was never
true, nothing called `preventDefault`, and focus was gone on the first press.
`ACCESSIBILITY.md:17` published "focus moves into the dialog, stays there while it is open." That
was **false on all three Apple platforms**.

Verified after the fix by four new cases in `Calendar.test.tsx`, not by inspecting attributes:
the dialog now holds at least two focusables (so the trap's wrap arm can fire at all, rather than
falling into its `length < 2` pin-focus branch), **every** element the trap's own selector finds
inside it carries `tabindex="0"`, the Close button and every checklist link are each named
individually, and focus starts inside the dialog. That is the property that makes the engine's order
irrelevant. It is deliberately *not* a reproduced tab order: jsdom has none, and a test that walked
one would only re-assert the assumption the defect came from.

### `BirdingStats.tsx:1209`, the call the brief left open

Scoped **in**, and swapped. The source comment there claimed `closeButton` was enabled "so the popup
is keyboard-dismissable", which is a claim WebKit defeats: maplibre injects a real `<button>` with
no `tabIndex`, so that popup was not keyboard-dismissable at all on Mac, iPhone or iPad.

The brief's condition was "swap if like-for-like, otherwise record a residual". It is genuinely
like-for-like, and `map/SharePopup.tsx:190` already proves the pattern: pass `closeButton={false}`
and render an app-owned `<button className="maplibregl-popup-close-button">`. Same class, so it
inherits the existing theming *and* the ~44px coarse-pointer target already in `globals.css`; same
`×` glyph; same `aria-label="Close popup"` maplibre used, so the accessible name does not move; and
maplibre's stylesheet positions that class absolutely, so nothing shifts visually. It also brings the
control inside the source guard's reach, which stamping `tabindex` onto library DOM would not.

## Notes for reviewer

### The exclusion roster, and the refinement to it

Six sites were listed. **Five are in the guard's population; the sixth is not.**
`SnowMap.tsx:257` (the Trails checkbox) is an `<input>`, so it is outside a `<button>`/`<a href>`
population by element type, and a native form control is a tab stop under WebKit's default mode
anyway. It never needed marking. This is recorded in the guard's own comment so it does not read as
an omission.

The five, all untouched and all verified still working:

| Site | Why |
|---|---|
| `TabNav.tsx:142` | `role="tab"`; the tablist holds one stop, arrows move between tabs |
| `TabNav.tsx:325` | `role="option"` in the collapsed tab-bar listbox; roving, moved by the programmatic focus ArrowUp/ArrowDown drive |
| `Settings.tsx:97` | `role="radio"` in the three `RadioGroup`s |
| `SpeciesCombobox.tsx:190` | the list-toggle chevron; the `role="combobox"` `<input>` beside it is a native tab stop whose `onFocus` opens the same list |
| `SnowMap.tsx:230` | base-map button, paired with native `disabled` |

`git diff` shows **zero changes** to `TabNav.tsx`, `Settings.tsx`, `SpeciesCombobox.tsx` and
`SnowMap.tsx`. Arrow-key navigation confirmed green by the existing suites: TabNav's
"ArrowRight/ArrowLeft still wrap around" and "options are removed from the tab sequence (roving
focus)", SpeciesCombobox's "Arrow keys move the active option", and Settings' "Color theme group
exposes a single tab stop and moves checked on ArrowRight" and its ArrowDown sibling.

### Two existing tests changed, and why that is a finding rather than a fixup

`Calendar.test.tsx` asserted `tabindex === '-1'` on the `aria-disabled` Count-all-forms switch in two
places. Those encode the **pre-repair** contract at `Calendar.tsx:134`, which the brief scoped in as
a divergence from `.claude/rules/ui.md`. Both now assert `'0'`, and the first also asserts what the
rule actually requires and the old test did not check at all: that `aria-describedby` **resolves to
a real element with text**, and that the switch is still inoperable when pressed. The brief predicted
"the suite should be unchanged, and any red is a genuine finding"; this was the genuine finding.

### Two guards, and why both

`lib/tabOrderCoverage.test.ts` is new: a TypeScript-AST scan over all 79 shipped `.tsx`, asserting
every intrinsic `<button>` and `<a href>` carries a **literal `tabIndex={0}`**, with `EXCLUSIONS` as
the only permitted misses.

A note on that choice. The brief specified "carries an explicit `tabIndex`", but every one of the
five rostered sites already satisfies that, which would leave the roster with no members and no force.
Asserting the literal `{0}` is what makes the roster load-bearing, catches a `tabIndex={-1}` sneaking
in, and matches what `ACCESSIBILITY.md` actually publishes, which is about being *in the tab order*,
not about carrying an attribute.

Mutation-checked five ways against the real tree, each caught and each naming the offending site:

1. removing one `tabIndex` → fails, names `components/LifeListTable.tsx:269`
2. a **new file** with an unmarked button → fails, names it (no row needed to exist first)
3. a new **unrostered roving** `tabIndex={on ? 0 : -1}` → fails
4. making a rostered site stop matching → fails, names the row and the count it claims
5. **a second `tabIndex={-1}` button added to the already-rostered `TabNav.tsx`** → fails (see the
   retry section below; this one passed silently before the site binding)

Nine further cases run the analyser over source strings, so a broken *scanner* fails loudly rather
than silently passing everything: it sees a `tabIndex` through a multi-line opening containing `>`
inside expression braces, ignores a `<button>` written inside a JSX comment, ignores `<a>` with no
`href`, ignores components whose names merely look like tags, and refuses to accept a `tabIndex`
arriving only through `{...spread}`.

**`components/mapCornerTabStops.test.tsx` is kept, and both files now carry a header saying why.**
Neither subsumes the other. The source scan sees every file including ones no test has mounted, but
cannot see a `tabIndex` a component strips at render time behind its own conditional. The render
test catches exactly that, on the surfaces where `ACCESSIBILITY.md` publishes those controls as the
*only* keyboard route, but cannot see a file nobody mounted. Broad and shallow; narrow and deep.

### `lib/useFocusTrap.ts` re-tensed, not weakened

Its header reasoned about "the next unmarked `<button>` or `<a href>`", which no longer exists. That
sentence is exactly where a reader could now wrongly conclude the `focusin` containment arm is
redundant, so it was re-tensed with the three places the gap between the trap's list and WebKit's
real order is **still open**, all beyond the coverage guard's reach:

1. **Library DOM** (maplibre's zoom buttons and its popup close buttons) is in the trap's list and
   not in WebKit's order. The exact v1.0.15 shape.
2. **`<summary>`**, which fails in the *other* direction and is live today: WebKit visits it and
   `FOCUSABLE_SELECTOR` does not match it, so the trap's list is missing an element the engine stops
   on. maplibre's `AttributionControl` renders one, which is why the map overlay opts into
   `containOutsideFocus`.
3. **Render-time stripping**, which a source-level guard cannot see.

The rule is unchanged: containment stays driven by `focusin`.

### `ACCESSIBILITY.md` swept at paragraph scope

Lines 11, 13, 17, 19, 89, 91, 93 and 95 all moved, following the three rules build 1 paid for:

- **The property is published, never the count.** "No button and no link in the app's own screens
  lacks an explicit place in the tab order, apart from [the exceptions]" is checkable and stays true.
  A count depends on a scan method, and three methods disagreed last time.
- **Paragraph scope.** Line 13's "always because another tab stop already reaches them" was
  re-verified against the roster and found to be true of four of the five but **not** of
  `SnowMap.tsx:230`, which is natively `disabled` for a different reason entirely. Rather than leave
  a sentence that quietly does not cover its own roster, the paragraph now closes the list
  explicitly (tab bar, its collapsed dropdown, the combobox chevron, the three Settings rows) and
  routes the disabled case to Offline States, where line 77 already publishes it. Prose and
  `EXCLUSIONS` now correspond one to one.
- **No surface named from a component name.** `TAB_LABELS` was checked: `life-list` is
  **Multimedia**, `birding-stats` is **Statistics**, and the Weather Backlog is a component name for
  a section on the **Weather** tab whose visible name is "List checklists with no weather blocks".
  The sentence carrying that trap was deleted rather than repaired.

Line 17's containment claim was **confirmed by test** rather than left as a claim that happened to be
repaired, and the Calendar paragraph gained the Count-all-forms switch. Line 19's false sentence
about the marker chips was rewritten; the canvas half stays true and stays a separate reason.

### The residual is named, and one half of it is a real gap

The brief's instruction was that if the gap cannot be fully closed, the honest partial statement is
the deliverable. It cannot be fully closed, and it is stated plainly next to the zoom buttons rather
than implied away.

Five maplibre popups still use the library's own close button: `AtlasLayer`, `CountyLayer`,
`SightingsMap`, `TargetMarkers`, `NearbyLiferMarkers`. On the Map Explorer this costs nothing,
because activating the same in-view list row or marker a second time closes the popup it opened,
which `ACCESSIBILITY.md` already publishes.

**On the Sighting Locations map it does cost something**, and this was checked rather than assumed:
`SightingsMap.tsx:129` calls `setSelectedCoord(...)`, which **sets** rather than toggles, and there
is no Escape handler. So a keyboard user on Mac, iPhone or iPad can open a sighting's popup, read it
and reach the checklist links inside it, but has no key that closes it, and moves on with it left
open. It covers nothing and traps nothing, and the same checklists are on the Checklists tab, but it
is a gap rather than a design and it is written up as one.

Those five were deliberately **not** swapped in this build. The brief's inventory scoped in only
`BirdingStats.tsx:1209`; each of the others needs its own accessible-name call and `CountyLayer`
carries the popup-fit arithmetic, so it is a run rather than a ride-along on a build already touching
19 component files. It is on the ROADMAP with the fix spelled out.

### ROADMAP

The map-corner-FAB entry left in **Up Next** was closed (build 1 shipped it and did not update the
file). Three Horizon entries added: the app-wide close plus the library-DOM residual above; shared
`<Button>`/`<Link>` primitives; and the four hand-rolled copies of `FOCUSABLE_SELECTOR`, recorded
because **this build makes the Calendar copy look fixed without fixing it** — its containment now
holds by agreement with WebKit rather than by construction, which is exactly how a repaired symptom
over an intact cause gets forgotten.

### Version

Not bumped. Build 1 already moved all four files to **1.0.16**; this adds to that existing section.
`frontend/package.json`, `src-tauri/tauri.conf.json` and `website/index.html` (pill text, pill
`aria-label`, footer) were confirmed already consistent at 1.0.16.

## How to test

Automated, all green:

- `cd frontend && npm run build` — the pre-push gate (`tsc -b && vite build`), clean.
- `npx vitest run` — **269 files, 4379 tests, all passing** (baseline was 4362; +13 in the new source
  guard, +4 in the Calendar dialog verification).
- `npx eslint .` — clean.

### One unreproduced full-suite failure, and I am no longer calling it established

A full-suite run failed once on `Settings.icloud.test.tsx > "Escape cancels the note and focus
returns to the switch"`, a `waitFor` timeout in a file this build does not touch. Stashing and
running the clean baseline produced one failure in three runs, in the sibling file
`Settings.icloudKeys.test.tsx` on the same assertion shape, which is what led me to write it up as a
pre-existing load-dependent flake.

**The Tester could not reproduce it in fifteen runs, eight under deliberate CPU load, on either this
build or a stashed clean baseline.** So the honest status is unreproduced, not "pre-existing,
load-dependent" as I first stated it. Two runs on my machine are not a characterization, and I
should not have written one from them. What is actually established: the failure appeared once here
and once on a baseline with my changes stashed, both times in a file this build does not modify, and
the only `useFocusTrap.ts` change in this build is comment text (confirmed by filtering the diff to
non-comment lines, which is empty). There is no evidence of a regression from this build, and no
established characterization of the flake.

By hand, and **note that a Chromium browser will show you nothing**, since it was never affected:

1. Open the Mac app. In System Settings → Keyboard, confirm "Keyboard navigation" is **off** (the
   default). This is the whole point: the fix must work without it.
2. **Statistics.** Tab from the top. The jump-nav pills, all four segmented toggle groups, and every
   eBird / Macaulay Library link are now reached, in reading order. Open a popup on the geographic
   map and Tab to its close button.
3. **Multimedia** and **Breeding Codes.** Tab through the table headers and press Enter. Both tables
   now sort from the keyboard, which they could not do at all before.
4. **Calendar.** Tab to a day cell, press Enter, then press Tab repeatedly. Focus cycles between the
   Close button and the checklist links and never leaves the dialog. Then switch the metric to
   Checklists and Tab to the "Count all forms" switch: it is still reachable, and VoiceOver reads the
   note beside it as its reason.
5. **Weather**, at the bottom. Open "List checklists with no weather blocks". The disclosure, each
   row's copy action, the widen switch and both paging buttons are all reachable.
6. Regression check on the roster: the main tab bar still holds **one** tab stop with arrows moving
   between tabs, the species selector's chevron is still skipped, and the Settings colour theme /
   text size / date format rows are still arrow-key groups.

## Retry round: three precision defects, and what the sweep for their siblings turned up

All three findings were the same class, and it is worth naming: **a correction landed in one place
and not in its siblings.** Every defect in this build and all three in build 1 have that shape.

### 1. `ACCESSIBILITY.md` called all the exceptions roving-tabindex widgets

Fixed. The species selector's chevron is a fixed `tabIndex={-1}`, and the arrow keys never move to
it: they move an `aria-activedescendant` index on the `<input>` beside it. I made exactly this
correction at line 13 and did not carry it two paragraphs down to the Known Exceptions summary. The
summary now splits the four correctly: three are groups where the arrow keys move within, and the
chevron is skipped because the text box beside it opens the same list.

Verified in source rather than assumed, and the two cases genuinely differ:
`SpeciesCombobox.tsx` moves `activeIdx` and never focuses the chevron, while `TabNav.tsx`'s
dropdown option really is roving (`focusItem()` calls `.focus()` on it from ArrowUp/ArrowDown).

### 2. The guard's `EXCLUSIONS` docstring contradicted two of its own rows

Fixed. It said "every row is a ROVING-TABINDEX widget" while row five's `why` said "paired with
native disabled". The docstring now states the three kinds explicitly, says that a summary calling
all five roving is false **twice** over (the chevron and the base map), and records that an earlier
revision of that very docstring said exactly that while its own data contradicted it.

### 3. The roster admitted a second control in an already-rostered file. Bound, not documented.

**Binding was clean, so I bound it.** Each row now declares the exact `count` of sites it covers, and
both roster tests assert equality rather than existence; the multiset comparison is counted rather
than de-duplicated, which was the other half of the hole (a `Set` collapsed two sites sharing a file
and an initializer into one entry). Keyed by file plus initializer plus count rather than by line
number, so a row still survives an unrelated edit above it.

Verified by reproducing the Tester's exact mutation: a fresh `<button tabIndex={-1}>` added to
`TabNav.tsx` now fails with `EXCLUSIONS row out of date: components/TabNav.tsx tabIndex={-1} claims
1 site(s), found 2`. All four original mutations still behave, and the clean tree is green.

I did not take the documented-hole option. `CLAUDE.md`'s version-pill precedent is the right pattern
for a weakness that cannot be cheaply closed; this one closes in a `count` field, and a documented
hole in the guard this feature exists to buy would be a worse trade.

### The sweep for siblings, which is the part that mattered

Re-reading every summary, docstring, header and roster I wrote or touched, against the thing it
summarizes, turned up **five more instances of the same class** that nobody had flagged:

1. **`lib/useFocusTrap.ts`** repeated "five rostered roving-tabindex sites" verbatim. Corrected.
2. **`ROADMAP.md`** repeated it too. Corrected, and now also records the site binding.
3. **`CHANGELOG.md`** characterized all the exceptions as ones "a neighbouring control and the arrow
   keys already reach". Corrected to name the two kinds.
4. **`OutboundLink.tsx`'s new comment claimed this one line puts "every outbound link in the app" on
   the keyboard's path.** False: 22 direct call sites plus every `HotspotLink`, but **thirteen**
   anchors are still written per-site and bypass the component entirely. The comment now says which,
   says why they are not routed through it, and points at the coverage guard as what actually
   carries the app-wide property. (`ChecklistLink`'s comment checked out: exactly 24 call sites
   across 16 files, and every checklist link really does route through it, per `.claude/rules/ui.md`.)
5. **Two headers hardcoded "79 shipped .tsx files"** — a count that drifts, in the same file whose
   header argues for publishing the property rather than the count. Both now say the property; the
   guard's own non-vacuity assertion carries the floor.

### And one substantive finding the sweep produced, which enlarges a published gap

My residual paragraph said the Map Explorer popups "cost nothing, because activating the same
in-view list row or marker a second time closes the popup it opened", and named **Sighting
Locations** as the single gap. I had verified `SightingsMap` carefully and generalized about the
other four. Checking each:

- **`MapExplorer.tsx:989/995/1001`** and its targets sibling do compare the incoming id against the
  current selection and clear it, so the four **sidebar in-view lists** genuinely toggle closed.
  `ACCESSIBILITY.md:19`'s existing claim is true for those.
- **`AtlasLayer.tsx`'s `openBlockFromList` and `CountyLayer.tsx`'s `openCountyFromList` only SET
  `sel`** and never clear it, and both popups carry `closeOnClick={false}`.
- **No `Escape` handler exists on any of the five** (grep count 0 in each file).
- The **markers** set rather than toggle, so "or marker" was wrong as well.

So **three** popups have no keyboard close, not one: the breeding-atlas popup, the county popup, and
the Sighting Locations popup. `ACCESSIBILITY.md`, `ROADMAP.md` and `CHANGELOG.md` now all say three
and name them. This understated a real accessibility gap, which is the worse direction to be wrong
in, and it is exactly the defect class under review: one surface checked, four assumed.

`ACCESSIBILITY.md:19`'s "gives the same keyboard path" for the atlas and county panels was also
tightened to "a keyboard path", with an explicit note that those two open a popup but do not close
it, so the two paragraphs cannot be read as contradicting each other.

Still out of scope, and now on the ROADMAP with the per-popup evidence: bringing those popups into
SnowRaven's own markup the way `BirdingStats.tsx:1221` now is.

### One more assertion added, because the sweep found the claim was load-bearing

The Calendar dialog block gained a test for the **converse** direction. Marking every button and link
closes one way the trap's list and WebKit's order can disagree; the other way is `<summary>` (WebKit
visits it, `FOCUSABLE_SELECTOR` does not match it) and native form controls. Verified that
`DayPopup` and `PopupChecklistRow` contain no `<input>`, `<select>`, `<textarea>` or `<summary>`, so
here the two sets are equal **by construction rather than by luck** — which is what makes the
containment claim solid rather than coincidental. The test asserts it and is mutation-checked: adding
a `<details><summary>` inside the dialog turns it red.

## Convention Flags

- **Publish the property, never the count.** A source guard should assert a property a reader can
  check ("no X lacks Y, apart from this roster") rather than a number, because a number depends on a
  scan method and methods disagree. This is the second build in a row to pay for that lesson.
- **A source-level AST scan is the guard shape that scales past a roster of rendered rows.** A render
  roster is right for a cluster of controls on a few surfaces; app-wide it means mounting everything.
  The two altitudes are complementary and neither subsumes the other, so when both exist each should
  carry a header saying what it cannot see.
- **An exclusion roster must be able to have members.** If the asserted property is one every
  intended exception already satisfies, the roster is decorative. Assert the stricter property so
  that adding a row is a deliberate, reviewable act.
- **A guard over source needs mutation checks on its analyser, not just on the tree.** A scanner that
  silently matches nothing passes everything.
- **A correction is not done until its SIBLINGS are swept.** Every defect across both builds of this
  feature had one shape: a fix landed in one place and its summary, its roster, its docstring or its
  neighbouring paragraph kept the old wording. The sweep that follows a correction should be
  mechanical (grep the phrase you just replaced across every file you touched, in both directions,
  prose against data and data against prose), not a re-read.
- **Generalizing from one verified case is the same defect wearing different clothes.** Checking
  `SightingsMap` properly and then writing a sentence about all five popups understated a published
  accessibility gap by two surfaces. Where a claim quantifies over N things, check N things.
- **An exclusion roster needs CARDINALITY, not just membership.** Keying rows on file plus attribute
  makes each row a blanket pardon for its whole file. A declared per-row count binds it to its site
  without pinning a line number, and a multiset comparison rather than a set is the other half.
- **A repaired symptom over an intact cause gets recorded, loudly.** The Calendar's trap now works
  because WebKit's order happens to match its predicted list. That is not the same as being correct,
  and the ROADMAP entry says so in those words.
