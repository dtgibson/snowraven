## focusable-selector-single-source

### What this does

Folds the four hand-rolled focus traps in `frontend/src` onto the shared
`lib/useFocusTrap` hook, so `FOCUSABLE_SELECTOR` lives in one module and nowhere
else under `frontend/src` — the rule `.claude/rules/ui.md` already stated and
that four copies had been quietly violating. The Calendar's day-details dialog
additionally opts into `containOutsideFocus`, which closes the cause
`DECISIONS.md` v1.0.16 recorded as **a repaired symptom over an intact cause**:
that dialog decided containment by comparing `activeElement` against the ends of
a `querySelectorAll` list — the tab-order prediction v1.0.15 forbids — and
v1.0.16's tab-stop marking made it *look* fixed by making WebKit's real order
agree with the prediction. It now contains by construction.

No version bump, no changelog entry, no website change: build 5 of a bundled
Spool release, and the bundle owns the version.

### The four call sites, and what each one got

| Site | Trap | `containOutsideFocus` | Why |
|---|---|---|---|
| `Calendar.tsx` day dialog | shared hook | **ON** | the recorded defect; topmost, F061-safe (rAF restore) |
| `MapExplorer.tsx` filters sidebar | shared hook + its own visibility filter | **ON**, and only while the sidebar is genuinely an overlay | opaque phone/iOS overlay over a live map; F061-safe (`restoreFiltersFocusRef`) |
| `HelpDocs.tsx` | shared hook | off (default) | consolidation only, behaviour preserved |
| `WelcomeScreen.tsx` | shared hook | off (default) | **measured blocker — see below** |

`ModalDialog`'s default is not flipped. `NavMoreSheet` and `CommandPalette` are
untouched, comments included.

### Three things measured that changed the plan

**1. WelcomeScreen cannot opt in, and the reason is its own markup.** The change
brief had it as F061-safe ("no opener at all, a first-run takeover"), which is
correct about F061 and not the whole question. This screen renders, as one of its
own three buttons, the control that opens `HelpDocs` — and App.tsx mounts
`<HelpDocs>` as a **later sibling** while the welcome stays mounted (it is gated
on `coldStart && !welcomeDismissed`, which opening Help does not change).
`useFocusTrap`'s `focusin` arm is a document listener that asks only "is the new
focus inside MY root", so an armed welcome trap answers HelpDocs' own opening
`.focus()` by yanking focus back onto the welcome screen. Measured in jsdom on
exactly that shape: the later sibling's control never keeps focus. The Help
overlay would be unusable on the only run this screen has. The same holds for the
Cmd-K palette, which binds unconditionally at `window`. So WelcomeScreen
consolidates at the default; the reason is in its header and pinned by two tests.

**2. HelpDocs is not an F061 site.** The brief deferred its opt-in because "its
opener-restore lives in the cleanup of an effect defined before the trap effect,
so at unmount the restore fires with the listener still attached." Every step of
that is true except the conclusion. Measured on App.tsx's real shape — a parent
conditionally rendering the overlay, closed through its own Close button, with
`containOutsideFocus: true` — focus lands on the opener, not on `<body>`. **The
arm needs a live root**, and by the time an effect *cleanup* runs, React has
already detached the ref in the same commit's mutation phase, so `onFocusIn`
returns at its `if (!root) return` guard. The distinction that replaces it, and
that decides the next call site: F061 bites where the restore runs **before** the
unmount commit — synchronously inside a close handler, panel still mounted. "The
restore is declared before the trap" is not by itself an F061 finding. HelpDocs
still stays at the default (this was a consolidation; nothing measured a leak to
fix), but the deferral now rests on an honest reason.

**3. The Calendar day dialog's end-wrap had no test at all.** Found by running
the mutation rather than citing it: deleting the whole `useFocusTrap` call turned
only the new containment rows red, and the v1.0.16 block stayed green — because
that block asserts the dialog's tab-stop *marking* (every focusable carries
`tabindex="0"`, no `<summary>`, no form controls), which is true whether or not a
trap is mounted. The entire hand-rolled trap could have been deleted with the
file green, in the file whose post-mortem is about a defect that looked closed.
Two end-wrap rows are the repair and ship with this build.

### The shared hook

- New `filter?: (el: HTMLElement) => boolean` option, layered **on** the shared
  selector rather than replacing it. `focusablesIn` does no visibility filtering
  — a control clipped to zero height inside a collapsed accordion still matches
  the selector, and no selector can see `inert` on an ancestor. MapExplorer's
  sidebar is the one call site that needs it; handing it the raw list would have
  admitted collapsed-panel content into its trap list, which is a regression, not
  a simplification. The option documents that it must be passed a stable
  module-scope function, because it sits in the effect's dependency array.
- **Roster prose corrected by removing it** (`ROADMAP.md:68` item (2), deferred
  to this build by name). The header claimed "five rostered exceptions... three
  roving groups" while `EXCLUSIONS` holds four rows over two roving groups —
  stale since the nav rework retired the collapsed-tab-bar listbox, on a build
  that never touched this file. It now names `EXCLUSIONS` as the owner and states
  the **property** (a control is kept out only where another tab stop already
  reaches it, or where the platform removes it via native `disabled`), so there
  is nothing left to go stale. `ACCESSIBILITY.md:13` was re-read and deliberately
  **not** edited: its list is three items because the fourth roster row, the
  natively-disabled offline base map, is published separately under Offline
  States — the prose is already correct and a "fix" would have made it wrong.
- Two other header claims my own change falsified were corrected in passing: the
  entry-graph paragraph ("both of its consumers") and the guard filename it named
  (`focusTrapEntrySafe.test.ts`, which has never existed; it is
  `lib/mapFullscreenEntrySafe.test.ts` — `ROADMAP.md:49` item (3)).

### Deliberate non-changes

- **`website/tools/verify/verify-palette.mjs:122`** keeps its copy of the
  selector and now carries a comment saying why: it runs inside `page.evaluate`,
  serialized into the browser, where there is no module graph to import from. It
  is the one copy left in the repo.
- **`CommandPalette.tsx:23`** mentions one clause of the selector in prose, not
  as a copy. Untouched, as are all of that file's and `NavMoreSheet`'s focus
  decisions.
- **`ModalDialog`'s default stays `false`.** Flipping it would silently arm
  `NavMoreSheet` and `CommandPalette` (measured F061 sites, v1.0.19), and all six
  of its own call sites sit behind a Mac/iOS platform gate with no test in the
  repo firing a Tab at a dialog — there is no browser-reachable way to measure the
  change it would make.

### Known and recorded, not introduced here

The Cmd-K palette can open above a contained overlay, and the arm treats its
focus as an escape. This is not new and not specific to the two sites that opted
in: `lib/useMapFullscreen.ts` has shipped `containOutsideFocus: true` since
v1.0.15 and the palette can open over an expanded map identically. Recorded at
both new call sites rather than fixed, because the fix belongs in the hook (an
arm that yields to a modal above it), would change three call sites at once, and
touches focus decisions this build was scoped to uphold.

### Security round — two findings addressed

**Finding 1 (Medium, introduced by this build): the filters sidebar kept
containing focus after the viewport left the tier the opt-in was argued for.**
`sidebarOpen` is plain state with no width awareness, so opening Filters on a
phone and rotating to landscape left it `true` at ~844px — where the sidebar is
an in-flow column, the backdrop is gone, and `.sr-map-sidebar-close` is
`display: none`, so `SIDEBAR_VISIBLE` filtered the Close button out of the trap's
own list. The call-site comment asserted the opposite. Preserving the Auditor's
split: **the keydown cycle was pre-existing**; what the `focusin` arm added was
the removal of the click-outside release, turning an escapable-by-mouse cycle
into a hard capture on a non-modal region — and that increase is this build's.

Fixed by the review's preferred remedy — the sidebar cannot outlive the tier —
with two deliberate departures from the suggested shape, both forced by
measurement rather than taste:

- **Not a `matchMedia` listener**: `lib/useIsPhone.ts` is the sanctioned
  render-safe width read (`useSyncExternalStore` over the `(max-width:640px)`
  MQL), and `.claude/rules/ui.md` forbids a raw resize handler.
- **Not an effect**: `react-hooks/set-state-in-effect` rejects a synchronous
  `setState` in an effect, and it is right to — this is a cascading render. It is
  a **render-phase adjustment**, the same shape and the same stated reasons as the
  `centerShareOpen` adjustment further down the same file: self-terminating, no
  tracking state (a standing invariant, not a change signal), and **routed around
  `closeSidebar`** exactly as that precedent is. That last part matters: the close
  path arms the restore ref, and the restore targets `filtersButtonRef`, whose
  `.sr-map-filters-btn` is `display: none` above the tier — so `.focus()` would
  no-op and drop focus to `<body>`, which is the outcome the F061 rule exists to
  prevent. Nobody pressed anything; the viewport changed. Focus is left where it
  is, on a sidebar control that is still on screen and still in flow.

The call-site comment now says what is true, and records the wrong argument it
replaces (which was sound at every step and did not follow: `sidebarOpen`
persists across a viewport change).

**Finding 2 (Low): `SIDEBAR_TRAP`'s comment stated a mechanism the hook does not
have.** The hook destructures before its dependency array, so the options object
is never a dependency and only a fresh *function* re-arms. Corrected to the real
mechanism, with the QA numbers (12 adds / 10 removes for a fresh arrow, 2 / 0 for
a module constant) and an explicit note that a call site needing a dynamic option
**can pass a fresh literal freely** — which is the wrong fix the false sentence
invited, and the dangerous direction: a `useMemo` with an incomplete dep list
would freeze `containOutsideFocus` at its first value.

**Finding 3 (Informational, optional): taken.** One paragraph added to the
`filter` JSDoc stating the predicate must be total, and that a throw fails
**open** — in `onKey` it aborts before `preventDefault()`, so containment is lost
rather than focus stranded, no listener is detached, and the next event runs
normally. No `try`/`catch`, which the review explicitly did not want.

**Proved, not asserted.** The defect is a viewport-tier *transition*, so the
transition is what is measured: `MapExplorerSidebarTrap.test.tsx` gained a
controllable `matchMedia` stub that notifies its listeners, and four rows that
open the overlay inside the tier and then leave it. Asserting "no trap at desktop
width" from a fresh desktop render would have proved nothing — the sidebar cannot
be opened there, so that row would pass against the unfixed build. Mutation-checked
in two directions: **adjustment deleted → 3 red / 8 green**; **routed through
`closeSidebar()` instead → 1 red / 10 green**, and the red one is the
focus-not-dropped-to-`<body>` row.

Three consequences worth naming rather than burying:

- **A latent vacuity in my own first-round helper, found by this fix.**
  `openSidebar()` waited on the "Close filters" button, which is hidden by CSS
  rather than conditionally rendered — so in jsdom, which loads no stylesheet, it
  is present in every state and the wait waited for nothing. The helper now waits
  on the Filters FAB's *disappearance*, which is a real observable of
  `sidebarOpen` (its whole cluster is gated on `!sidebarOpen`).
- **Two pre-existing tests needed the phone tier supplied**
  (`MapExplorerLocateFab.test.tsx`, `MapExplorerSearchThisArea.test.tsx`). Both
  exercise "the phone Filters overlay", a state that now genuinely requires phone
  width; jsdom has no `matchMedia`, so each file stubs it. This is the fix working,
  not a workaround for it.
- **The tier condition is written twice, deliberately.** I first hoisted
  `isIOS() && !!isFullscreen` into a shared const so the trap and the CSS class
  could not drift — which turned `lib/mapIosFullscreen.test.ts` red: that guard
  pins the literal `mapContentClass( isIOS() &&` call shape precisely so a
  refactor cannot silently enable the iOS scope class for desktop fullscreen. The
  hoist was reverted and the render site left byte-identical; single-sourcing the
  two would mean re-pointing another build's guard at the definition, which is not
  this build's business. Noted at the site, and in the hand-back as an inbox
  candidate.

### How to test

1. `cd frontend && npm run build` — clean.
2. `cd frontend && npx vitest run` — 289 files, 4890 tests green.
3. `cd frontend && npx eslint .` — clean.
4. `npm run verify --prefix website/tools -- "$PWD/frontend/dist"` — 3/3
   harnesses green in Chromium **and** WebKit, including the palette's tab-stop
   population check, which measures the selector this build consolidated.
5. `grep -rn 'tabindex\]:not' frontend/src` — one hit, the prose reference in
   `CommandPalette.tsx`. The selector itself is only in `lib/useFocusTrap.ts`.

### Notes for reviewer

- **Every new assertion was mutation-checked in both directions and the counts
  are recorded in the test files**, per v1.0.15's option-gated-extraction clause.
  Calendar: gate off → 3 red / 54 green; trap removed → 5 red. MapExplorer: gate
  off → 3 red; armed unconditionally → 1 red; **filter deleted → 2 red**.
  HelpDocs: arming it → 1 red; trap removed → a different 1 red. WelcomeScreen:
  arming it → 2 red / 4 green; trap removed → 1 red / 5 green. Hook: ignoring the
  filter → 7 red across two files.
- **The MapExplorer filter guard had to be rebuilt after its first version passed
  with the filter deleted.** `useFocusTrap` reads only the *first and last*
  entries of its list, so a filter that removes only middle entries is
  behaviourally invisible — and collapsing the filter panel alone does exactly
  that (measured: raw indices 2–10 go inert, neither end moves). The shipped rows
  also collapse the in-view list at the bottom, which puts collapsed content on an
  **end**. A guard for a filter has to be built in a state where the filter's
  output can differ from its input at an edge; that is written at the block.
- **jsdom's `offsetParent` is `null` on every element** (measured, not assumed —
  jsdom implements no layout). `MapExplorerSidebarTrap.test.tsx` therefore stubs
  it on `HTMLElement.prototype` with restore in `afterEach`; without that, every
  row in the file would pass vacuously against a trap holding an empty list. The
  stub is deliberately weaker than a real `offsetParent` — it knows nothing about
  `display: none` — and that is stated at the stub, because the exclusion those
  rows measure is the `[inert]` half, which is a real attribute in jsdom.
- **No `<a href>` or `<button>` site was added or removed**, so
  `tabOrderCoverage.test.ts`'s population floors are untouched and it is green
  unchanged. Verified by diffing the JSX openings, not just by reading.
- `SIDEBAR_VISIBLE` is exported from `MapExplorer.tsx` so its guard measures the
  shipped predicate rather than a copy of it.
- Entry-chunk safety is unaffected: `useFocusTrap` was already on the entry graph
  and gained no imports; the four new consumers are three lazy chunks plus
  `WelcomeScreen`, which App.tsx already imported statically. `entryChunk.test.ts`
  is green.
