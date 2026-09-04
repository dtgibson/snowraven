# Bug Brief -- WebKit Tab Order, App-Wide

## What is broken
WebKit's default tab mode (Safari with macOS "Keyboard navigation" off, which is the default and
what WKWebView follows) gives no place in the tab order to a plain `<button>` or a plain
`<a href>`. v1.0.16 marked six map corner controls and, in doing so, established that the gap is
app-wide. **45 more controls SnowRaven renders are still unreachable by Tab on the shipped Mac,
iPhone and iPad apps: 30 buttons and every one of the app's 15 `<a href>` sites.** Chromium (web,
Windows) is unaffected -- a `<button>` is already tab-index 0 there and an explicit `tabindex="0"`
preserves document order, so the change is additive on WebKit only.

---

## Verified inventory

**Method, stated so it can be re-run and disagreed with.** Every `.tsx` under `frontend/src`
excluding `*.test.tsx` (79 files) was parsed with the TypeScript compiler API (`typescript` is
already a direct devDependency at `~6.0.2`) and every `JsxOpeningElement` / `JsxSelfClosingElement`
enumerated with its attributes. **An AST walk is comment-immune by construction** -- `{/* ... */}`
parses as an empty JSX expression container, so a `<button>` written inside one is not an element
at all. This resolves build 1's count discrepancy: `BirdingStats.tsx:1206` is the string
`<button aria-label="Close popup">` inside a source comment, which is the 31st button build 1's
Tester counted and the reason three passes produced 30 / 31. **The real count is 30.** The scan
script is at `scratchpad/scan.mjs` for this session; the guard below re-derives it in the suite.

Regex cannot do this job here and that is worth saying once: nearly every one of these JSX openings
spans multiple lines and contains `>` inside expression braces (`style={{...}}`, `onMouseEnter={e => ...}`),
so neither `<button[^>]*>` nor a line-based `toContain` can associate a `tabIndex` with its own tag.

### A. Plain `<button>` with no `tabIndex` -- 30 sites, 12 files

| File | Lines | What |
|---|---|---|
| `components/WeatherBacklog.tsx` | 252, 302, 309, 361, 412, 468, 517, 525 | the row's copy-and-go action, two "Try again" links, the empty-state CTA, the collapsed disclosure, the widen `role="switch"`, and both paging buttons |
| `components/BirdingStats.tsx` | 810, 2007, 2109, 2130 | four `aria-pressed` segmented toggle groups (accumulation granularity, breeding tier filter, media chart mode, media interval) |
| `components/Calendar.tsx` | 623, 1008, 1014, 1017 | the day-details dialog's Close, prev/next year, and the all-years toggle |
| `components/LifeListTable.tsx` | 269, 289, 307 | sortable column headers |
| `components/map/SharePopup.tsx` | 200, 226, 253 | the popup close, the copy button, "Select all" |
| `components/BreedingCodeTable.tsx` | 263, 291 | sortable column headers |
| `components/NamedBirdMedia.tsx` | 146 | "Show more" media |
| `components/SightingsMap.tsx` | 132 | the sighting marker button |
| `components/map/MapControls.tsx` | 129 | the search-center pin button |
| `components/map/NearbyLiferMarkers.tsx` | 83 | the nearby-lifer chip |
| `components/map/SharePin.tsx` | 182 | the dropped share pin |
| `components/map/TargetMarkers.tsx` | 98 | the media-target chip |

The four `BirdingStats` clusters sit inside `role="group"` wrappers but are **independent
`aria-pressed` toggles with no arrow-key handler**, not radio groups -- each needs its own tab stop,
exactly as the Map Explorer's filter pills already have. `Calendar.tsx:1008/1014` also carry native
`disabled`; an explicit `tabIndex` alongside it is inert while disabled and correct when not.

### B. `<a href>` with no `tabIndex` -- 15 sites, 9 files, and **zero** anchors in the app carry one

**Two of the fifteen are shared components and they carry the leverage.** `OutboundLink.tsx:39` has
22 direct call sites across 14 files *and* is what `HotspotLink` renders (17 more call sites across
9 files), so one edit reaches 39. `ChecklistLink.tsx:64` has 24 call sites across 16 files. **Two
edits, 63 call sites.** `OutboundLink` already spreads `{...rest}` onto its `<a>`, so a
`tabIndex={0}` placed *before* the spread stays caller-overridable.

The other thirteen are per-site: `App.tsx:737` (the "Skip to main content" link, which
`ACCESSIBILITY.md` promises comes first of everything), `App.tsx:939` (edit checklist effort on
eBird), `App.tsx:1125` (SnowRaven Mini), `BirdingStats.tsx:699` (the Statistics jump-nav, N anchors
per render), `CommentText.tsx:24` (linkified URLs in comments, N per render), `LifeList.tsx:635`
(the Multimedia jump link), `LifeListTable.tsx:355/370/385/400` (the four Macaulay Library count
links, N rows x 4), `SpeciesDetail.tsx:990`, and `SpeciesLinks.tsx:18/45` (the eBird and Birds of
the World favicon links).

Nine of those thirteen are external links that predate `OutboundLink` and would be that component's
callers under the app's own convention. **Routing them through it is out of scope** -- it changes
each one's accessible-name formula, which is a published behaviour, not a tab-order fix. ROADMAP.

### C. Anything else genuinely unreachable

- **No `role="link"` anywhere**, and the one `role="button"` on a non-button (`DropZone.tsx:54`)
  already carries `tabIndex={0}`. A sweep for non-interactive intrinsics carrying `onClick` or
  `onKeyDown` without a `tabIndex` returns six hits, all deliberate composite-widget containers
  (`role="radiogroup"`, `role="tablist"`, `role="listbox"`, `role="option"`) plus a backdrop.
- **Controls SnowRaven switches on but does not render.** `SnowMap.tsx:206`'s `NavigationControl`
  injects maplibre's zoom `+` / `-` as library-owned `<button>`s; the `AttributionControl` injects
  a `<summary>`, which WebKit *does* visit. And `BirdingStats.tsx:1209` passes `closeButton` to a
  maplibre `Popup` on the Statistics geographic map, with a source comment saying it is enabled "so
  the popup is keyboard-dismissable" -- **a claim WebKit defeats.** See *Scope calls* below.

---

## The remedy shape -- the decision this brief exists to make

**Ship `tabIndex={0}` at all 45 call sites (46 with Calendar's switch, below), and add ONE
source-level guard test. Do not build a component abstraction, do not add a lint rule, do not stamp
attributes at runtime.**

Why per-call-site wins on the code: **188 of the app's 218 buttons already do exactly this.** The
codebase has already voted; the 30 are the stragglers, not a design gap. And two of the anchor edits
are component-level for free, because `OutboundLink` and `ChecklistLink` already exist and already
own their `<a>`.

The three alternatives, and why each is rejected:

- **Shared `<Button>` / `<Link>` primitives.** This is the honest answer to "a future component will
  not inherit," and it is a refactor of 218 buttons across 79 files with bespoke inline styles, not
  a fix. It also does not actually solve the discipline problem: a shared `Button` that always sets
  `0` would break the roving-tabindex widgets below, so it needs an override prop, and remembering
  to *not* pass the override is the same class of mistake one level up. ROADMAP.
- **A lint rule.** There is no `jsx-a11y` in `frontend/eslint.config.js`, and jsx-a11y has no such
  rule -- this is a WebKit-default-mode requirement, not a standard a11y rule -- so it means
  authoring a custom rule. Decisive against: `.claude/rules/testing.md` states outright that vitest
  and eslint are **not** the pre-push gate here. A lint rule would be advisory over a gap that has
  already shipped twice.
- **A runtime sweep** (an effect stamping `tabindex` on every button on mount). It would stamp the
  roving-tabindex widgets, it is invisible to source review, and it makes the published claim
  unverifiable from source -- which is the one property this run needs most.

### The guard: a source-level population scan, not a bigger roster

**Build 1's guard shape does not scale, and that is the structural finding.**
`components/mapCornerTabStops.test.tsx` is a roster of six rendered rows plus four closed "every
button in this container" assertions. It is the right shape for a cluster of controls on four map
surfaces. App-wide it would mean mounting all 79 components in jsdom -- impractical, and each mount
is a fresh source of mocking drift. **The axis that scales is the source, not the render.**

Add `frontend/src/lib/tabOrderCoverage.test.ts`: parse every non-test `.tsx` under `frontend/src`
with the TypeScript AST and assert that **every intrinsic `<button>` and every `<a href>` carries an
explicit `tabIndex`**, with a literal `EXCLUSIONS` roster (below) as the only permitted misses. A
new component's unmarked button fails without anyone remembering to write a row for it, and adding
to the exclusion roster becomes a deliberate, reviewable act. This is the same posture as
`cacheInventory.test.ts` (a table each store must appear in) and satisfies
`.claude/rules/testing.md`'s comment-stripping requirement structurally rather than by filter.

**Keep build 1's test as well, and say why in its header.** The two guards sit at different
altitudes and neither subsumes the other: the source scan cannot see a `tabIndex` that a component's
own conditional strips at render time, and the render test cannot see a file nobody mounted.

---

## What must NOT get `tabIndex={0}` -- the exclusion roster

These six are the guard's allowlist. Blanket-adding the attribute breaks arrow-key navigation and is
the real regression risk in this build.

| Site | Why it holds one tab stop, not many |
|---|---|
| `TabNav.tsx:142` | `tabIndex={activeTab === item.id ? 0 : -1}` on `role="tab"`; the tablist holds one stop and `ArrowLeft` / `ArrowRight` move between tabs (`TabNav.tsx:126-129`) |
| `TabNav.tsx:325` | `tabIndex={-1}` on `role="option"` in the collapsed-tab-bar listbox; same roving pattern |
| `Settings.tsx:97` | `tabIndex={checked ? 0 : -1}` on `role="radio"` -- the three `<RadioGroup>`s (Color theme, Text size, Date format) |
| `SpeciesCombobox.tsx:190` | `tabIndex={-1}` on the list-toggle chevron; the `role="combobox"` `<input>` beside it is a native form control (a tab stop even under WebKit's default) whose `onFocus` opens the same list |
| `SnowMap.tsx:230` | `tabIndex={rasterOffline ? -1 : 0}` **plus native `disabled`** -- the platform removes it regardless, and `ACCESSIBILITY.md`'s Offline States section publishes exactly this |
| `SnowMap.tsx:257` | `tabIndex={offline ? -1 : 0}` plus native `disabled` on the Trails checkbox; same published statement |

Out of the guard's population by construction, and listed so nobody "fixes" them: the programmatic
focus targets at `tabIndex={-1}` that are not controls (`App.tsx:766` `<main>`,
`MediaCommentsSection.tsx:41`, `NamedBirdMedia.tsx:216`, `SubspeciesExplorer.tsx:152`,
`statsPrimitives.tsx:21`), and `SpeciesCombobox.tsx:235`'s `role="option"` divs, which are an
`aria-activedescendant` listbox and must stay unfocusable.

---

## Scope calls

### `Calendar.tsx:134` -- IN

The `Switch` sets `aria-disabled` **and** `tabIndex={disabled ? -1 : 0}`. That is a direct
divergence from `.claude/rules/ui.md`: *"a control that is not operable but whose REASON must be
readable in place stays focusable with `aria-disabled="true"`, the reason wired through
`aria-describedby`"* (v1.0.12; `ToggleSwitch`'s `ariaDisabled` mode is the named reference). It is
also the sole counter-example to `ACCESSIBILITY.md:13`'s "always because another tab stop already
reaches them," which this build is about to make a stronger claim around. It is unlike
`SnowMap.tsx:230/257`, which pair the `-1` with native `disabled`.

The fix is `tabIndex={0}`, and **two things ride with it**: associate the existing helper text
(`COUNT_FORMS_HELPER`, rendered beside the switch at `Calendar.tsx:1066`) via `aria-describedby`
rather than adding new copy -- the rule says to associate a neighbouring note, not repeat it -- and
note that the wrapper at `Calendar.tsx:1053` sets `pointerEvents: 'none'` while disabled, which does
not block keyboard activation; the `onClick` guard at `Calendar.tsx:140` already does.

### `ModalDialog.tsx:165` -- this build makes it BETTER, not live. Verified.

`ModalDialog` calls `useFocusTrap(trapped, panelRef)` with `containOutsideFocus` defaulting false,
so it wraps at the ends only, and the end-wrap fires on `activeEl === last` where `last` comes from
`focusablesIn()` in DOM order. That is a prediction of the engine's tab order, which `DECISIONS.md`
v1.0.15 forbids. All six call sites are in `Settings.tsx` and all six sit behind a Mac/iOS platform
gate, so they render **only** on the engine where the prediction is wrong.

Each of the six was read. Every one contains exactly two `<button>`s in `actions` (both already
`tabIndex={0}`) plus `<p>` text. **No dialog contains a link, an input, or a `<summary>`.** So
`focusablesIn`'s order already equals WebKit's, and marking buttons and links app-wide keeps it that
way while removing the coincidence the correctness currently rests on. **This build narrows the
prediction gap; it does not open it.** The residual after this build is `<summary>`, which WebKit
visits and `FOCUSABLE_SELECTOR` does not match -- no dialog has one today, and the map overlay,
which does, already opts into `containOutsideFocus`.

### The live one is the Calendar's day-details dialog, and this build fixes it

`Calendar.tsx:551-576` hand-rolls its own trap, with its own copy of the selector and **no
containment arm**. Its dialog contains exactly two kinds of focusable content: the Close button
(`:623`, unmarked) and one `ChecklistLink` per row (`:722`, unmarked). **On WebKit today there is
not one tab stop inside it.** `closeRef.current?.focus()` puts focus in; the first Tab moves to the
next explicitly-tabindexed element in the document, which is behind the modal; the trap's
`activeElement === last` is false, nothing prevents it, and focus is gone.
`ACCESSIBILITY.md:17` publishes "focus moves into the dialog, stays there while it is open." **That
is false on the Mac, iPhone and iPad apps right now**, and marking the Close button plus
`ChecklistLink` repairs it. Verify it after the fix rather than assuming it.

**Out of scope, ROADMAP:** there are **five** copies of the focusable selector, four outside
`useFocusTrap.ts` (`WelcomeScreen.tsx:32`, `Calendar.tsx:561`, `MapExplorer.tsx:577`,
`HelpDocs.tsx:336`), against `.claude/rules/ui.md`'s "live there and nowhere else." Consolidating
them is a bundle of its own with published focus behaviour on four surfaces. Record it, because this
build makes the Calendar copy *look* fixed, which is exactly how it gets forgotten.

### Library-injected DOM -- one in, one a stated residual

`BirdingStats.tsx:1209`'s maplibre `Popup` on the Statistics geographic map is scoped **in**:
SnowRaven chose `closeButton` for a keyboard reason WebKit defeats, and the app already owns the
alternative one directory away (`map/SharePopup.tsx:190` passes `closeButton={false}` and renders its
own). Swap to that pattern if it is a like-for-like change; if the markup or accessible name would
move, stop and record it as a residual instead -- do not force it.

maplibre's zoom `+` / `-` buttons are a **permanent stated residual**. SnowRaven does not render
them, and the published keyboard route for zoom is already the `+` and `-` keys with the map focused
(`ACCESSIBILITY.md:19`), which stays true. **Do not stamp library DOM imperatively** -- it would put
the published claim beyond the reach of the source guard, which is the property this run is buying.

---

## Steps to reproduce
1. Mac app (or iPhone/iPad), macOS System Settings > Keyboard > "Keyboard navigation" **off** (the default).
2. Statistics: Tab from the top. The jump-nav pills, the four segmented toggle groups, and every eBird / Macaulay Library link are skipped entirely.
3. Multimedia and Breeding Codes: Tab through the table. No sortable column header is ever reached, so the tables cannot be sorted from the keyboard at all.
4. Calendar: activate any day cell to open the day details, then press Tab. Focus leaves the dialog on the first press and lands on the page behind it.
5. Weather, at the bottom: open "List checklists with no weather blocks". Neither the disclosure, nor any row's action, nor the paging buttons is reachable.

## Expected behavior
Every control SnowRaven itself renders holds an explicit place in the tab order, so it is reached by
Tab in DOM order on all four platforms without depending on a system setting -- with the six
roving-tabindex and offline-disabled sites above as the deliberate, documented exceptions. Enter
activates every one, and Space as well on the buttons. The Calendar day dialog keeps focus.

---

## `ACCESSIBILITY.md` is the definition of done, again

Line numbers against the working tree at 1.0.16. **Sweep at paragraph scope, never sentence scope**
-- build 1 hit the neighbouring-sentence failure three times, and twice in text the previous pass had
just written.

- **Line 11** (the whole "One thing colors everything below" paragraph). Its subject is that the app
  marks "a great many" controls "but not yet all of them," and that the specifics live under Known
  Exceptions. After this build it should state the platform difference and then say that every
  control the app renders now asks for its place explicitly, with the residual named once. Rewrite
  the paragraph, not its last sentence.
- **Line 13.** "A few controls are deliberately kept out of the tab order, always because another
  tab stop already reaches them" becomes true once `Calendar.tsx:134` is fixed. Leave the wording;
  re-verify it against the six exclusions.
- **Line 19** (the Map markers paragraph, and the map-controls sentences after it). "The
  media-target and nearby-lifer chips are real buttons, but they hold no explicit place in the tab
  order, so they are reached by Tab on the web and Windows versions and not on the Mac, iPhone and
  iPad apps" becomes **false** and must be rewritten; the canvas half of that sentence stays true
  and stays a separate reason. The five-control map sentence can widen. The zoom clause stands.
- **Line 89** (Known Exceptions, its closing "**One cross-cutting exception is outstanding**"
  sentence and the mechanism paragraph after it) and **lines 91, 93, 95.** Line 93's four-kind
  taxonomy is what this build closes and should go, not shrink. Line 95's "Marking the rest
  explicitly ... is open work rather than a closed item" closes.
- **Line 17** (Calendar). The dialog focus-containment claim becomes true on WebKit. It needs no
  rewrite, but confirm it rather than leaving it as a claim that happened to be repaired.

**Three rules build 1 paid for across three QA rounds, restated because they apply again:**
1. **Publish the property, never the count.** "No `<button>` or `<a href>` in the app's own sources
   lacks an explicit place in the tab order, apart from [the six]" is checkable and stays true;
   "45 of 45" depends on a scan method, and three defensible methods disagreed last time.
2. **A repair is swept at paragraph scope**, then across the untouched neighbours the claim reaches.
3. **Never name a surface from a component name.** `TAB_LABELS` in `lib/tabLayout.ts` is
   authoritative: `life-list` is **Multimedia**, `birding-stats` is **Statistics**. Line 93's "the
   Weather Backlog" is a component name for a section on the **Weather** tab whose visible name is
   "List checklists with no weather blocks" (`docs/HELP.md:109`) -- that sentence is being deleted,
   so the trap is retired rather than repaired, but do not re-introduce the pattern.

**If the gap cannot be fully closed, the honest partial statement is the deliverable.** If the
Statistics popup close button stays library-owned, say so plainly next to the zoom buttons; do not
write an app-wide claim over two named residuals.

---

## Blast radius
- **Behaviorally inert on Chromium and Gecko.** Explicit `tabindex="0"` preserves document order, so
  web, Windows and every shipped test are unchanged. Additive on WebKit only.
- **The focus traps.** `FOCUSABLE_SELECTOR` already matched all 45 by `button` and `a[href]`, so no
  trap's *list* changes; only WebKit's real order changes, toward the list. **This does not license
  reverting the `focusin` containment arm** -- `DECISIONS.md` v1.0.15 forbids prediction outright,
  and `lib/useFocusTrap.ts:42-49` already says so. That header needs re-tensing again (it currently
  reasons about "the next unmarked `<button>` or `<a href>`"), and it is precisely where a reader
  could wrongly conclude the arm is now redundant. Re-tense the measurement; do not weaken the rule.
- **Existing tests.** No test asserts the *absence* of a `tabIndex` on any of the 45. The suite
  should be unchanged, and any red is a genuine finding.
- **`docs/HELP.md`.** Build 1 rewrote the search-center pin's keyboard sentence to point at the
  corner share button because `MapControls.tsx:129` was unmarked. This build marks it, so that
  paragraph and the "the pin itself is named in Known Exceptions" clause need re-walking.
- **`ROADMAP.md`.** Build 1 put the residual gap on the Horizon; this build closes it. Move it, and
  add the two new ROADMAP items above (shared control primitives; the four hand-rolled focus traps).
- **Version set (four files), user-facing fix:** `frontend/package.json`, `src-tauri/tauri.conf.json`,
  `CHANGELOG.md`, and `website/index.html` (pill visible text **and** `aria-label`, plus
  `footer-version`). The guard is a whole-file `toContain`, so check for a stale version string too.

## Decisions touched
- **`DECISIONS.md` v1.0.15 (the focus trap):** not reversed, and reinforced. It records the same
  WebKit measurement and names explicit `tabIndex={0}` as the only reason the base-map buttons are
  visited. Historical record; leave as written.
- **`DECISIONS.md` v0.5.91 ("Search this area"):** the original precedent -- a keyboard path made
  unconditional in both engines so it does not depend on macOS Full Keyboard Access. Same remedy,
  now applied to the whole app.
- **`.claude/rules/ui.md`, the `aria-disabled` rule (v1.0.12):** `Calendar.tsx:134` is repaired
  *into* compliance, not excepted from it.
- **`.claude/rules/ui.md`, the focus-trap rule (v1.0.15):** its "`FOCUSABLE_SELECTOR` lives there
  and nowhere else" clause is violated in four places today. Recorded, not fixed here.

## What done looks like
1. All 30 buttons, all 15 anchors and `Calendar.tsx:134` carry an explicit `tabIndex={0}`, the six
   exclusions are untouched, and `Calendar.tsx:134`'s reason is wired through `aria-describedby`.
2. `frontend/src/lib/tabOrderCoverage.test.ts` asserts the property over the whole source
   population with a literal exclusion roster, and is mutation-checked: removing one attribute turns
   it red, and adding an unmarked `<button>` to a file with no existing row turns it red.
3. On WebKit, Tab reaches the sort headers, the Statistics toggles and jump links, the Weather
   backlog controls and every link, in DOM order; Enter activates each; and Tab inside the Calendar
   day dialog stays inside it.
4. `ACCESSIBILITY.md` lines 11, 13, 17, 19, 89, 91, 93 and 95 read true as written against the
   measured source, stated as a property, with any residual named rather than implied away.
