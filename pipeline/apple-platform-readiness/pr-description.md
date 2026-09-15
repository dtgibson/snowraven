## Apple platform readiness — iOS 27 scene lifecycle

### What this does

Adds the `UIApplicationSceneManifest` the iOS 27 SDK requires, so the next iOS
build launches. Without it the app installs and then **fails to launch**:
`_UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption ... UIScene life
cycle is required for apps built with this SDK`. Nothing in the release recipe
would have caught this — `altool --validate-app` checks icons and entitlements,
not scene adoption — so TestFlight would have accepted the build and users would
have got a dead app.

It also removes the stale iOS version from the xcodegen input (`project.yml` said
`0.5.63` while the shipped app is `1.0.30`), and adds guards for both. Two further
items from the brief were **verification only** and are closed in writing below
with no speculative code added.

Nothing user-facing changes on any existing surface. **No version bump, no
changelog entry, no tag, no release** — the release shape is the Deployer's call
and the brief lays out both routes.

### How to test

1. `cd frontend && npm run build` (the real pre-push gate, not just vitest)
2. `cd frontend && npx vitest run` — the two new guards are
   `src/lib/iosSceneManifest.test.ts` and `src/lib/safeAreaPerSide.test.ts`
3. `cd frontend && npx eslint src`
4. `cd src-tauri && cargo check --lib --target aarch64-apple-ios` and
   `cargo check --target aarch64-apple-darwin`
5. To see the actual fix, build and launch on an iOS 27 simulator — the full
   recipe is in `pipeline/apple-platform-readiness/how-to-see.md`. The short
   version: recreate `/tmp/xcshim`, `tauri ios build --target aarch64-sim`,
   `simctl install`, `simctl launch`, and **take a screenshot** (see below for
   why a process check is not enough).

### Notes for reviewer

**The multi-scene flag is `true`, and it was settled by launching, not by
reading code.** Three builds, same command, same device (iPhone 18 Pro, iOS
27.0), each confirmed fresh by bundle mtime and by reading the manifest out of
the built `.app` before launching:

| manifest | process | screen |
|---|---|---|
| none (HEAD today) | **gone** — bounces to the home screen, logs the UIScene runtime issue | app never appears |
| present, `UIApplicationSupportsMultipleScenes` **false** | alive | **blank black** |
| present, flag **true** | alive | renders the Welcome screen correctly |

The `false` row is the reason this needed a build rather than an argument, and
it is the trap worth carrying forward: **it does not crash.** tao 0.35.3's
`multiple_scenes_enabled()` reads exactly that key, so a false value sends tao
down its non-scene startup path while UIKit runs the app in scene mode; the
process stays alive, WebKit loads and *finishes* the page, and the window is
never attached to a scene, so nothing paints. A liveness check, an exit code, or
"did it crash" all pass the broken build. **Verify a scene-manifest change with a
screenshot.** I had the `false` build reported as working before I looked at the
screen.

The brief predicted a double `on_app_ready()` panic for `false` (tao's
`did_finish_launching` calls it when the flag is false, and `connect_scene` calls
it again on first scene connect, where the second hits `bug!("unexpected
state")`). That is not what happens — the failure is quieter than predicted, and
the measurement is what corrected it.

**Accepted side effect:** `true` declares the app multi-window-capable on
iPadOS, so an iPad user can open two SnowRaven windows side by side. That is a
platform consequence of the only working configuration, not a designed
capability — actually *supporting* iPad multi-window would be its own feature
run. The layout already holds to 320px, so a half-width window needs no new work.
Deliberately **not** documented in `docs/HELP.md` / README / website: writing it
up would advertise it as a feature.

**Why the manifest is in three files.** `gen/apple/snowraven_iOS/Info.plist` is
what the build reads (the build log shows `GENERATE_INFOPLIST_FILE=NO` and
`INFOPLIST_FILE=snowraven_iOS/Info.plist`, so `tauri ios build` does *not*
regenerate it from `project.yml`). `gen/apple/project.yml` is the xcodegen input,
and `xcodegen` is installed on this machine, so a manifest missing there is one
command from being lost. `src-tauri/Info.ios.plist` is Tauri's build-time
overlay, merged into the generated plist on every iOS build — **this is the
extension beyond the brief's two files, and the reason is that it is the only one
of the three outside `gen/`, so it is the only one that survives a re-run of
`tauri ios init`**, which DECISIONS.md v0.5.68 records re-stamping Tauri's
placeholders over `gen/apple`. The final build confirmed the overlay merge is a
no-op against the committed plist. `iosSceneManifest.test.ts` pins all three
identical, so the third copy cannot drift.

Per the brief, the configuration is a real entry naming `TaoSceneDelegate`, not
the empty `UISceneConfigurations` dict from Tauri's own docs, which
tauri-apps/tauri #15719 reports trapping under the iOS 27 SDK as well. The guard
asserts against emptiness explicitly rather than leaving it unasserted.

**The version keys are removed from `project.yml` rather than stamped.**
`tauri ios build` writes `CFBundleShortVersionString` and `CFBundleVersion` into
the generated plist from `tauri.conf.json` + `--build-number` on every build, so
a value in `project.yml` is a second source of truth that can only ever go stale
— which is exactly what it did. Removing it deletes the drift instead of policing
it. **The guard deliberately does not inherit the known weakness of the existing
four-file parity check** (CLAUDE.md records it as a `toContain` substring scan
that goes green as soon as one correct version string exists anywhere): this one
parses the plists properly and compares exact values. Three rows:

* `project.yml` declares neither version key — **with YAML comments stripped
  first**, because `project.yml`'s own comment explains the absence and names
  both keys, so a raw scan would fail a correct file.
* the generated plist is internally consistent (`CFBundleVersion` is
  `CFBundleShortVersionString` + `.` + a build number).
* the stamped iOS version never *leads* `frontend/package.json`. Deliberately not
  equality: CLAUDE.md's release rhythm bumps `package.json` first and stamps the
  iOS plist several commits later, so `main` legitimately sits with the plist
  *behind* the app version for the length of a ship. An equality guard would turn
  the suite red on `main` every release — the exact failure the four-file guard
  already caused once. Leading can only ever be a mistake.

The plist reader is pure JS on purpose: the frontend CI job runs on
`ubuntu-latest`, where `plutil` and `PlistBuddy` do not exist, so shelling out
would make the guard macOS-only and it would silently not run where it matters.
It fails closed on any shape it does not understand, and has its own
guard-the-guard rows.

**Verification item 2 — Safari 27 scroll anchoring: the brief names four
block-axis sites; three were driven — null at two, a measured WebKit-only
difference at the third — the fourth was not driven and is reported as undriven
below, and still no `overflow-anchor` added.** Measured against the production
build in Playwright
WebKit *and* Chromium. Every reading was taken twice on the same build — as
shipped, and with anchoring forced off by an injected
`* { overflow-anchor: none !important }` — because anchoring can only matter
where those two differ, and if forcing it off changes nothing then adding the
declaration to `globals.css` would be dead code.

The engine's capability was established first, or a clean reading would be
indistinguishable from an engine that does not implement the feature: in a
controlled fixture this WebKit adjusted a scroll offset by exactly the 300px a
grown element added (`scrollTop 500 -> 800`, anchor held at 0), and
`overflow-anchor: none` suppressed it (`scrollTop 500 -> 500`, anchor moved 300).
Chromium behaved identically.

**Two sites read identical with anchoring on and off, in both engines.** That is
the whole scope of the null result — these two scrollports, not the app:

* `.sr-palette-results` across a filter-driven rebuild: `scrollTop 88 -> 21`
  (rows 11→7, scrollHeight 557→401) in all four combinations; and the same
  scrollport driven by the `scrollIntoView({ block: 'nearest' })` call at
  `CommandPalette.tsx:190`: `scrollTop 21`, active option offset `243`, in all
  four.
* the Help overlay body, the one direct `scrollTop` write in the app
  (`HelpDocs.tsx:368`): `scrollTop 3486`, drift `0` after a further settle, in
  all four. Deliberately *not* "the one programmatic vertical scroll" — the
  `lib/scroll.ts` wrapper below is one too.

**The third site does differ, and only in WebKit.** `SpeciesCombobox.tsx:94` was
not driven by this build's probe — populating it needs a loaded eBird export and
that harness ran with no backend — and it was closed here by analogy to the
palette site, on the reasoning that it is the same call in the same shape.
**That inference was wrong, and measurement is what corrected it.** Driven at QA
against the real app on the real backend over the 149-species demo dataset, five
readings per configuration, a fresh browser context for every reading and the
config order rotated per repetition, with pre-filter `scrollTop` 697 in every
single reading:

| engine | anchored (as shipped) | `* { overflow-anchor: none }` | `.sr-combobox-list { overflow-anchor: none }` |
|---|---|---|---|
| **WebKit** | **47** (5/5) | 162 (5/5) | 162 (5/5) |
| **Chromium** | 162 (5/5) | 162 (5/5) | 162 (5/5) |

Zero variance, and the scoped leg reproduces the off-value exactly — so the
adjustment happens on the `.sr-combobox-list` scrollport, and a one-line
declaration there is the precise fix if one is ever wanted. The reason the
analogy failed is worth carrying: **what anchoring adjusts is the scrollport and
its content mutation, not the call.** Two sites with an identical
`scrollIntoView({ block: 'nearest' })` shape can measure differently, so a null
result at one is never coverage for another.

**The cross-engine reassurance does not transfer, and could not have.** "The app
has already shipped under Chromium's anchoring for years" was this item's
load-bearing argument, and the one case that diverges is precisely one
**Chromium does not adjust at all** (162 in all three configurations). Long
exposure to one engine is evidence about that engine only. Safari 27 is the
first engine to change this surface's behaviour, and it reaches existing macOS
and iOS users who never upgrade — so on this site the argument runs the other
way, and only measurement settles it.

**The declaration is deliberately NOT added, and this is the evidence for that
call.** The brief's bar is a *real jump*; what was measured is a different
resting position after a filter rebuild, with nothing lost, hidden or
unreachable. With 11 filtered rows in the 260px-capped listbox, anchored lands
on rows ~2–8 and unanchored on ~5–11 — neither shows row 1, and the anchored
position is arguably the more useful. Nothing in the component's keyboard or
ARIA contract reads that offset:

* a **filter-driven** rebuild always commits with no active option: every
  keystroke sets `activeIdx` to `-1` (`SpeciesCombobox.tsx:136-137`), so
  `aria-activedescendant` is `undefined` at that instant (line 188) and nothing
  is parked at the anchored position for assistive tech to follow. **Scoped to
  "filter-driven" on purpose:** `rows` is memoized on `[filtered, allLabel]` and
  `filtered` on `[options, query]` (lines 65-77), so it also rebuilds on an
  `options` or `allLabel` prop change, which is not a filter rebuild and does not
  touch `activeIdx`; at two of the four call sites (`Calendar.tsx:1008`,
  `SpeciesDetail.tsx:742`) `options` is a fresh `.map(...)` array on every parent
  render, so such a rebuild is routine. The reveal effect is keyed on
  `[activeIdx]` alone (lines 91-98) and so does not re-fire on one. That path
  cannot strand an active option today — the option *contents* are loaded
  upstream and do not change while the listbox is open — but the sentence is
  written to the memo's actual deps rather than to the case that was measured.
* the first ArrowDown moves from `-1` to row 0 (line 163) and the reveal effect
  scrolls that row into view (lines 91-98), so the first keyboard move
  self-corrects to the top of the list from either resting position. The reveal
  call itself measured **identical** in both engines and both configurations
  (`scrollTop 697`, active option offset `918`).
* Enter with no active option commits to the first species match computed from
  `rows` (lines 168-181), never from what is on screen, so the commit path does
  not read scroll position at all.

Adding the declaration on that evidence would be exactly the speculative code
the brief rules out, and it would pin a shipped surface to the pre-Safari-27
position on a preference rather than a defect. **What would reverse this:** a
report that the anchored position is disorienting in use, or any later change
that parks focus or `aria-activedescendant` inside the list across **any rebuild
of `rows`** — a filter rebuild, or an `options`/`allLabel` prop change, which
rebuilds it just the same and does not reset `activeIdx`. Written to the memo's
deps rather than to the filter case alone, because a reversal condition narrower
than the code's exposure is the same defect this item already spent a round
repairing. The fix is then one line — `overflow-anchor: none` on the existing
top-level `.sr-combobox-list` rule in `globals.css`, where the class already is
— and it owes a guard naming this measurement.

**The fourth named site was not driven, and this is the record of that rather
than a null result.** The brief's list closes with the `lib/scroll.ts:29`
wrapper — `smoothScrollIntoView`, and `jumpTo` (line 46) which calls it. It has
four shipped call sites: `LifeList.tsx:670` (jump to the media-comments
section), `SpeciesDetail.tsx:363` (`openSpeciesInTab`) and `:474`
(`pickExplorerSpecies`), and `BirdingStats.tsx:780` (the section jump-nav).
**All four scroll the page**, which puts them squarely in scope. The structural
reason is stated in the stylesheet itself (`globals.css:5305-5308`): *"THE PAGE
REMAINS THE SCROLLPORT. `.sr-content` deliberately sets no `overflow` and
`<main>` is not a scroll container"* — which is why the two sticky pinned-label
bands anchor to the page at all. So nothing between these scroll targets and the
viewport establishes a scroll container: none of the three components declares a
vertical scrollport around the scrolled element, and every scrollable-overflow
rule in `globals.css` — checked across both the `overflow-y` and the `overflow`
shorthand forms, nine in total — sits inside a popup, dialog, nav column or
sheet, map overlay, or the palette results, never on the tab-content chain.
`.claude/rules/ui.md` (the v0.5.81 `scroll-padding` entry) says the same from the
other direction: *"the scrollport is the page."* The page scrolls in the block
axis, and the block axis is what anchoring adjusts.

**It was not measured, and one call site has the shape that broke the analogy.**
`SpeciesDetail.tsx:363` is `revealAndSelect(match)` followed by
`requestAnimationFrame(() => smoothScrollIntoView(rootRef.current))` — a content
mutation immediately followed by a programmatic scroll on the same scrollport,
structurally the same pairing as the combobox filter rebuild that diverged in
WebKit. By the rule this round established, that is reported as an unverified
region, not closed by reasoning from the three sites that were driven.

**Why it ships unverified anyway, stated as a judgement.** The exposure is real
but its shape differs from the combobox's in the way that matters. What diverged
at the combobox was the *resting* position after a rebuild that is followed by no
programmatic scroll at all — `activeIdx` is `-1`, so the reveal effect does not
fire and the anchoring adjustment is the last thing to touch the offset. At all
four wrapper call sites an explicit `scrollIntoView` always runs *after* the
mutation, so the explicit scroll is the last writer and sets the position the
user ends on; an anchoring adjustment before it is overwritten. Two of the four
(`LifeList.tsx:670`, `BirdingStats.tsx:780`) are pure fragment jumps with no
content mutation, so there is nothing for anchoring to adjust around in the first
place. `jumpTo` then moves focus with `preventScroll: true`, so the focus move
adds no second scroll. **What would change this:** any of these call sites
growing a content mutation that lands *after* its scroll — at which point the
adjustment is no longer overwritten and the site needs driving — or a report of a
jump on Statistics, Multimedia or Species after using one of these jumps. The
measurement, if wanted, is the same probe pointed at `SpeciesDetail.tsx:363`.

The measurement is recorded here rather than promoted into
`website/tools/verify/`: it documents an accepted difference, not a claim the
gate must hold, and a harness pinning a resting scroll offset would go red on
any future change to the list's height or row count for reasons that are not
defects. The plan timeline is correctly out of scope: scroll anchoring adjusts
in the block flow direction and `.sr-plan-scroller` scrolls the inline axis.

**Verification item 3 — foldable safe-area insets: no CSS changed, guard
added.** The
stylesheet was already per-side correct; `safeAreaPerSide.test.ts` pins that it
stays so. It derives its subjects from the stylesheet rather than naming
surfaces, because the defect it guards against would arrive on a surface nobody
has written yet. It asserts that no declaration reads the opposite side's inset,
and that every rule insetting one horizontal edge insets the other — with a
counted roster of the two deliberate single-edge rules
(`.sr-ios-app .sr-map-fab-cluster` right-only, `.sr-ios-app .sr-skip-link:focus`
left-only), each carrying its reason, compared as a counted multiset so a second
unmatched declaration beside a rostered one cannot be absorbed silently. It also
pins `viewport-fit=cover` in `index.html`, without which every inset is 0 and the
whole claim would be vacuously true. Enumerated **39 safe-area declarations, 10
of them horizontal**. Only the *horizontal* figure matches the brief, and the
other one is not meant to — corrected here, because this sentence previously
claimed both matched. The brief counted **34** raw `safe-area-inset` occurrences
in the stylesheet text (one inside a comment, so 33 live); this is the parser's
count of AST-confirmed declarations, which emits one per selector in a
comma-separated list. Two rules account for the entire gap: the pinned Breeding
Codes and Multimedia `scroll-margin-top` rules (`globals.css:1416-1420` and
`1487-1491`) each list four selectors against a single `env()`, so 33 + 3 + 3 =
39. Different quantities, both checked against the file — and the horizontal
count is 10 under either counting, which is why that one genuinely agrees.

This needed one new export on the shared parser,
`findAllSafeAreaDeclarations` in `lib/cssTopLevelRules.ts` — the existing
`findSafeAreaDeclarations` requires a surface class, and a guard making a claim
about the stylesheet as a whole cannot name its surfaces.

**Build-environment note for whoever ships this.** `tauri ios build` refuses
before compiling unless `APPLE_API_KEY` / `APPLE_API_ISSUER` /
`APPLE_API_KEY_PATH` are exported — including for a simulator target, and
`--no-sign` does not skip it. It also aborts with `failed to rename app ...
Directory not empty` when a previous `snowraven_iOS.xcarchive` is present; that
cost one build here and is the same stale-artifact hazard the release skill
already documents, so **move the archive aside first**. My first "control" run hit
exactly this, silently produced no new bundle, and would have had me measuring
the previous build — the freshness check on bundle mtime is what caught it.

**One side effect on build products, stated so nobody rediscovers it as a
mystery.** The simulator builds run here consumed the payload of
`gen/apple/build/snowraven_iOS.xcarchive` (the 1.0.30 device archive), leaving
empty archive shells, which I removed. Nothing shippable is lost: the whole
`build/` directory is gitignored, 1.0.30 already shipped, and the release recipe
rebuilds the archive and explicitly refuses to trust a pre-existing one. The
named per-version archives (1.0.17, 1.0.18, 1.0.23.1, 1.0.24, 1.0.28, 1.0.29)
are untouched and still carry their `iphoneos` payloads. I checked that by
running the same inspection against two known-good archives first — a script
that reports "no app inside" for everything looks identical to archives that are
genuinely empty.

## Convention Flags

- **A decision NOT to act on a measured difference is written down AS a decision
  — the evidence, what would reverse it, and the exact one-line fix and its
  location — because a silent non-action is indistinguishable from an
  oversight.** Verification item 2 ends with a real WebKit-only difference and no
  code, which from the outside looks exactly like the site never having been
  driven, which is the state this item was actually in one round earlier. This
  repo already enforces the identical shape one layer up: CLAUDE.md's App Store
  rule, where a rollup and a silent skip leave the same evidence signature, so
  the written sentence naming both versions is what separates them and "a
  version with no record and no sentence is a skip." This run is the second
  layer it shows up on, which is what makes it a pattern rather than a one-off —
  a verification item closed with no fix owes the sentence for the same reason a
  folded-in release does.

- **A COUNT IN PROSE IS CHECKED AGAINST THE THING IT COUNTS, IN THE SAME PASS
  THAT WRITES THE CLAIM — and when one count is found wrong, the CLASS is swept,
  never just the instance.** Two QA rounds each found exactly one written figure
  that did not match what was done: a null result asserted app-wide that held for
  two scrollports, then a denominator of three over a list of four. Repairing
  only the named instance is precisely what turned round one into round two.
  Sweeping every numeral, denominator, "only these" list and scope word in both
  artifacts turned up three more that no report had flagged — a PlanChart
  enumeration of three scroll writes where the file has four, a safe-area figure
  claiming to match the brief's while counting a different quantity (39 parsed
  declarations against 34 raw text occurrences, reconciled by two four-selector
  rules), and a totality phrase, "the one genuine programmatic vertical scroll",
  contradicted by the very list it sat in. **None of the three changed a
  conclusion, and that is the point:** they cost minutes to fix and they are the
  reason a reader stops trusting the figures that *do* carry weight. The sweep is
  mechanical — grep the numerals and the scope words, check each against the
  artifact it describes — so it is cheap enough to owe every time a count is
  written, not only after one is caught.

- **A CLAIM IS ATTRIBUTED TO THE FILE THAT ACTUALLY STATES IT.** The round-2
  report placed "the page is the block-axis scrollport for all ten tabs" in
  CLAUDE.md; CLAUDE.md says nothing about scrollports. The fact is true and is
  stated in two other places — `.claude/rules/ui.md`'s v0.5.81 `scroll-padding`
  entry, and `globals.css:5305` in the stylesheet's own words — so the finding
  stood, but the citation would have sent the next reader to the wrong file to
  confirm it. A true claim with a wrong source is still an unverified claim, and
  it propagates faster than a wrong one because nobody re-checks it.
