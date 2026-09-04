## Nav rework: one responsive navigation at three densities

### What this does

Replaces the horizontal tab strip, and the single all-or-nothing dropdown it
swapped itself for the moment it would overflow, with one responsive navigation
over the same eleven destinations at three densities: a `13.5rem` vertical
sidebar on wide windows, a `3.75rem` icon rail when width is tight, and a bottom
bar of four favourites plus a More sheet at phone widths. Density is derived from
measured available width against the app's own 640px content floor, never a
device check.

The strip needed about 1,409px and collapsed below about 1,457px, so an
unmaximised laptop window, an iPad, a half-screen Mac window and every phone got
the dropdown. The dropdown was the common case rather than the narrow-screen case
it was designed as, and in it all eleven destinations were one scrolling list.

The composition win is that the brand block moves out of the page header and into
the nav column, so `<main>` now starts at the top of the window on every wide
window: roughly 150px of height returned to every tab.

Nothing new is stored. The saved order and hidden tabs are honoured in all three
densities, and the phone bar's four favourites are the first four of that same
saved visible order, so the existing reorder-and-hide setting already chooses
them. The collapse toggle is session-only by design: a persisted density can be
restored into a window where it is wrong, leaving the user to undo a state they
do not remember setting.

### How to test

1. `cd backend && uvicorn main:app --reload --port 1620`, then
   `cd frontend && npm run dev`, then open http://localhost:5173.
2. **Sidebar.** The nav is a column on the left; the wordmark and tagline are at
   the top of it and the page content starts at the top of the window.
3. **Active state.** Click through destinations: tinted fill, accent icon and
   label, heavier weight, and a 3px accent bar on the leading edge.
4. **Collapse.** The button at the foot of the column narrows it to icons with a
   200ms animation, and widens it back. Hover an icon in the rail for its name.
5. **Drag the window narrower.** Below about 850px the sidebar becomes the rail
   on its own, with **no** animation. That is deliberate.
6. **Map Explorer at about 1000px wide** drops to the rail while other tabs at
   the same width keep the sidebar, because the map's own sidebar is subtracted
   before the floor is applied. Widen out and both come back.
7. **Under 640px**, the nav becomes the bottom bar plus the More sheet. Choose a
   destination that lives under More and the More cell takes the active
   treatment.
8. **Keyboard.** Up/Down (not Left/Right) move within the vertical tablist;
   Home/End jump to the ends; Tab leaves the group. At phone width every bar cell
   and every sheet row is its own Tab stop.
9. `npm run build`, `npx vitest run`, `npx eslint src` all green.

### Notes for reviewer

**The three things the design flagged, and how each landed.**

* `lib/mapPanelChrome.ts` keeps its arithmetic and loses its stale prose. At
  sidebar and rail density `main.parentElement` is the content column and the
  brand header has moved into the nav, so `above` collapses to about the body's
  safe-area padding and `below` is the footer alone: still the whole of what the
  panel shares the viewport with. At phone density the fixed bottom bar is in
  neither term, so its measured height is added as an explicit third argument
  (`fixedBelow`), and the bar is passed as an **element** rather than a ref so
  its mount and unmount rebuild the ResizeObserver.
* The footer stays in the content column, below `<main>`.
* The width transition is opt-in: `.sr-nav-col--anim` is added by the manual
  toggle and removed on the width `transitionend` (gated on target and property,
  since transitionend bubbles), and the derived-change path clears it in the same
  commit as the width change so a window drag can never animate. There is a
  400ms belt for a transitionend that never arrives.

**Guards updated in the same change.**

* `tabOrderCoverage.test.ts`: the roster goes from five rows to **four**. The
  vertical tablist survives with a new initializer (`{active ? 0 : -1}`) and a
  `why` naming the vertical orientation; the collapsed dropdown's `role="option"`
  listbox row is **retired**, because the More sheet uses plain trapped buttons at
  `tabIndex={0}`. Every other control the nav draws carries a literal
  `tabIndex={0}`.
* `TabNav.test.tsx` rewritten; `navDensity.test.ts` and `navCss.test.ts` added.
* The off-screen measurement probe is gone. The threshold reads the live root
  font size instead, so the v0.5.37 page-horizontal-scroll hazard cannot recur
  here.
* `chromeBoxes`' one-level descent through a `display: contents` child is kept and
  its docstring rewritten: App no longer wraps the nav in one (the column is a
  real box carrying its own `inert`), so the descent is now stated as a general
  property of the walk rather than as a description of one line.

**Two real bugs found while building, both worth a look.**

* **An ancestor's ref is not attached when a child's layout effect runs.** The
  shell was originally passed to the nav as a ref object; React attaches a
  parent's ref only after its children's layout effects, so the first measurement
  read null and, worse, the ResizeObserver never attached at all, which would have
  pinned the nav at its initial density for the life of the page. The shell and
  the bottom bar are both passed as **state** for this reason.
* **The fixed bar and `.sr-map-fullscreen-panel` share `z-index: 1200`,** and the
  bar comes later in the DOM, so an `inert` bar would still have painted over a
  fullscreen map. The bar is not rendered at all while the map is fullscreen,
  which also matches the shipped behaviour (the phone nav was already hidden
  there rather than covered).

**Deliberate deviations from the design spec, both narrowing risk.**

* The spec's `--sr-nav-reserve` custom-property channel is implemented as a prop
  from App instead. An unregistered CSS custom property is not resolved by
  `getComputedStyle` (reading `clamp(240px, 28vw, 300px)` back returns the token
  stream as authored, not a length), so a px number has to be computed anyway;
  App already owns `activeTab` and the fullscreen flag, so this needs no change to
  the lazy Map Explorer chunk. The JS/CSS duplication of the clamp is closed by
  `navCss.test.ts`, which parses the three numbers back out of the shipped
  stylesheet and compares them to the constants.
* The mockup drew the Settings hairline **outside** the tablist with Settings
  after it, which would have put a `role="tab"` outside its own group. The
  hairline is `aria-hidden` **inside** the tablist instead. Identical visually;
  valid ARIA.

**`rootFontSizePx` maps the `medium` keyword to 16px,** and only that keyword.
jsdom has no cascade and returns the unresolved keyword rather than a px length,
which would otherwise have made the derivation silently inert in every component
test. `medium` is 16px in every engine, so this is the spec's own value rather
than a guess, and any other unreadable value still returns `null` and holds the
current answer.

**Published surfaces rewritten in the same change:** `docs/HELP.md` (the
strip-collapsing-into-a-dropdown passage), `ACCESSIBILITY.md` (four passages, at
paragraph scope: the roving-focus roster, which is now one group and not two; the
reflow sentence; the Known Exceptions restatement; and the screen-reader
sentence, which claimed tab/tabpanel linkage universally and is now scoped to the
densities where a tablist exists), `README.md` (a feature entry for the
navigation), and the website capture tooling. The 1,600px capture width was
pinned purely to stay above the old collapse threshold; that threshold no longer
exists, so the justification is **rewritten rather than deleted** around what the
width now decides, which is which density gets photographed. `selectTab` handled
only the strip and the dropdown and would have broken at ship time; it now
handles the vertical tablist, the rail (matching `aria-label`, since rail buttons
have no visible text) and the bottom bar plus its More sheet.

**No version bump and no changelog entry**, deliberately: this repo's four-file
version set is stamped as one at ship time and a partial bump fails its own
release-parity guard.

---

### QA round 1: three published-surface fixes, and one more capture-tooling trap

No production code changed in this round. All three defects were prose or
tooling.

**A published claim no code implements.** `docs/HELP.md` and `README.md` both
said the heading at the top of each page names the tab you are on. Measured at
rail density, zero of eleven destinations do and five render no heading at all.
It came from this feature's own design spec, whose layer-1 answer for *where you
are* in the icon rail was "every tab already draws the house page header" — a
component that does not exist. That premise is what justified an icon-only rail,
so it is corrected at the source too: `design-refinement.md` now records the
struck layer explicitly rather than quietly dropping it, and the rail's
identification is restated on the three layers that ship and were verified in
both engines (`aria-label` on every button, the tooltip on hover **and**
`:focus-visible`, and the touch hold), plus the active treatment the rail keeps
in full. The keyboard half of the tooltip matters more than it first appeared:
with the page-header layer gone, `:focus-visible` is the only thing that names a
destination for a sighted keyboard user. The stated limit is now larger and
honest rather than smaller and false. Fixing it by building eleven page headings
would have been scope growth into every tab.

**The rule files that mirror the guard's prose.** `.claude/rules/ui.md` still
said the app has "three such groups" and named the retired dropdown as one;
`.claude/rules/maps.md` still cited "the responsive tab dropdown" as its
`z-index: 1200` exemplar. Both corrected, and the maps rule now carries the
finding that came out of this build: **a fixed element at 1200 later in the DOM
than `.sr-map-fullscreen-panel` paints over a fullscreen map, and `inert` does
not stop it,** because `inert` removes a subtree from focus and the accessibility
tree, never from the paint.

**The bar-height figures were incomplete rather than wrong.** The design's
57 to 68px range is the height with labels on at 1x; 430px at 150% measures
79.5px. Nothing depends on the range being small (the height is published from a
live measurement precisely so no constant has to be right), but a range that
stops at the sampled widths is the shape that later gets treated as a bound, so
the row and a note are added.

**Screenshots regenerated, and the capture found one more trap.** The website set
and the App Store set were both stale (Aug 25 to 27), showing the old strip and
the old Multimedia glyph. Regenerated against the backend pointed at the
synthetic demo data, with the structural id-range guard asserted first: all 7,869
served rows in the `S9` range.

The trap: the phone capture clipped to 860px of an 880px viewport. That was
harmless when the bottom 20px held nothing, and with a **fixed** bottom bar
measuring 56.5px it cut the bar in half — every icon survived, every label fell
outside the frame, nothing failed, and the shot looked entirely plausible. Caught
by looking at the image rather than at the exit code, then measured in the engine
(labels 43.05 x 11.5px, bar 56.5px, `--sr-navbar-h` 57px) to confirm the labels
were rendering and only the frame was wrong. The clip is now the full viewport
height, with the reason recorded beside it.

Verified by eye rather than by exit code, per the standing rule: the desktop
shots show the sidebar with the new `Images` glyph for Multimedia, and the iPad
Map Explorer shot shows the **rail** with the map's own 300px sidebar beside it,
which is the design's central claim (the arithmetic decides it, not a rule that
the map always gets the rail) working in the shipped product.

### QA round 2: the sweep that stopped at the repo root

One defect, and the interesting part is where it was. The tooltip's own doc
comment in `TabNav.tsx` still carried the struck page-header premise verbatim,
sitting in the very file D1 was about and contradicting `design-refinement.md` in
the same folder. Round 1's sweep covered `docs/`, `README.md`,
`ACCESSIBILITY.md`, `website/` and the spec, and never entered `frontend/src/`;
`grep -rn "page header" frontend/src/` finds it in one hop. The lesson is the
sweep's SCOPE, not its diligence: a claim that reached published prose got there
FROM the source, so the source is where the sweep has to start, and
`.claude/rules/docs-and-website.md`'s publish-the-property rule says in as many
words that it covers comments.

The comment is corrected to the real three layers and the struck one is **left
written down rather than quietly deleted**, because of what it would otherwise
cost the next reader: it says touch is already handled, which is exactly the
belief that would justify removing the touch hold as redundant. That hold is the
only thing that names a destination on a touch device in the rail, and iPad
portrait is the rail's primary device. The handler now says so at its own site
too, so the warning is where someone deleting it would be looking.

Three other `page header` hits in the tree were checked and are correct as
written: two describe the brand block moving out of the page header into the nav
column, which is true and is the composition win; the third is a Statistics
section header and a different sense of the phrase entirely.

`docs/HELP.md` gains one sentence for the touch hold. It stated hover, keyboard
and screen reader, none of which apply on the rail's primary device.

### Security review: two Low findings closed

**The demo-dataset guard is now shared.** `capture-appstore.mjs` asserted every
submission id the backend serves matches `^S9\d{9}$` before the first frame;
`capture.mjs`, which writes every image on the public website, had only a
sanity-check-by-eye instruction in its README. An `SR_DATA_DIR` that silently
failed to take would have published real sighting locations and exited 0.
`assertBackendServesDemoData` moves into `capture-lib.mjs`, `capture.mjs` calls
it before its first frame, and `capture-appstore.mjs` drops its private copy for
the shared one, so there is one implementation and the next script that writes a
published artifact inherits it.

Verified in four directions rather than asserted: demo data allowed; a real id
mixed into an otherwise-demo export refused (the realistic partial-contamination
shape, not just a wholly-real export); an unreachable backend refused rather than
assumed empty; an empty export refused. Then end-to-end against a dead port,
where both scripts exit **1** and write no frames. Worth noting how that last
number was obtained: the first attempt piped the run through `head` and read
`exit=0`, which is the pipeline-exit-code trap `.claude/rules/testing.md` records
by name, met in my own verification. The real code was read without the pipe.

**The focus-trap comment claimed containment the call site does not enable.** It
said the trap "contains on `focusin`"; `containOutsideFocus` is not passed and
defaults to false, so the keydown end-wrap arm is the whole of it, byte-for-byte
what `ModalDialog` does.

Closed by CORRECTING the comment, not by enabling the option, and the choice was
measured rather than argued. Enabling it fails both focus-return tests: the
`focusin` arm pulls focus back into the panel whenever it lands outside, and
`closeSheet(true)` focuses the More button synchronously while the sheet is still
mounted, so the trap yanks focus back into a sheet that then unmounts and drops
it to `<body>` — the F061 defect. Doing it properly would mean moving the focus
restore into a post-commit effect (the `restoreFiltersFocusRef` pattern), which
is a change to a working, QA-measured close path.

Since this is the same class of defect as the page-header claim, the corrected
comment does not merely get vaguer: it names the condition the containment
actually rests on. The keydown arm predicts the engine's tab order from a
`querySelectorAll` list, and that prediction is correct here only because every
focusable in the panel carries a literal `tabIndex={0}` — which is a property of
the MARKUP, is exactly what failed in WebKit at v1.0.15, and would silently
reopen the hole if an unmarked focusable were ever added. The comment says so,
and says what to do instead.

### The last two App Store shots, captured with a key

`02-statistics.png` on both devices waits for the escapee pass's terminal state,
which is gated on an eBird key being present. With Dave's approval the key was
used, and the whole App Store set was then re-captured in ONE pass so all twelve
come from one build, one dataset and one run.

**The key never entered the repo, and there is a structural reason it could not
simply be exported.** `GET /settings/keys` — which is what the app asks to decide
whether a key exists — reads `backend/.env` through `dotenv.get_key`, at a path
hardcoded relative to the router's own `__file__`. It is not `SR_DATA_DIR`-aware
and not overridable by environment. So an env var alone satisfies the outbound
eBird calls (`os.getenv`) and leaves the app still believing it has no key.

Rather than write a repo file or stub `/settings/keys` in Playwright — which
would have put a state the app cannot actually reach into a published App Store
screenshot — the backend was run from a COPY of itself outside the repo
(`/tmp`, mode 700), with a symlink back to `frontend/` so `../frontend/dist`
still resolved, its own copy of the demo data so nothing could dirty the repo's,
and the key in that copy's `.env` and in the process environment. The rig was
deleted afterwards.

Verified after teardown: zero files anywhere in the working tree contain the key,
zero occurrences in the bytes of any of the 23 published images, and every
session temp file removed. The repo's own `backend/.env` is still the zero-byte
file dated Sep 2 that predates this work.

**The shared dataset guard passed unchanged** — 368 synthetic checklists, the
same reading as the keyless runs — which is the point: the key changed what the
app could compute, not what the backend was serving.

