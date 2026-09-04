## weather-backlog-honest-load-failure (Weather: a stored backup that will not load is reported as a load failure)

### What this does

The **Weather** tab's *List checklists with no weather blocks* section built its list from
`loadEbirdObservations()` alone and mapped every falsy answer, and its `.catch`, onto one state: the
`StateBlock` titled **"Load your eBird backup first"** with a **Go to Import** button. Since v1.0.14 that
promise resolves `null` for four different things (no file stored, a read that failed, a read that came back
empty, a parse that failed), so a birder whose stored `MyEBirdData.csv` was truncated by an interrupted write
was told to import a file Settings was still listing as saved. That is the exact lie this family exists to
remove, and this section was the last place in the app that told it.

The checkable claim, which is a property rather than a count: **this was the only `loadEbirdObservations`
caller that rendered a claim about the backup without an upstream `getFilesStatus()` branch.** The eight tab
loaders, List Comparer, `LifeList.resolveMLCounties` and `lib/hotspotSet.ts` all ask first, which is why a
falsy load already means "stored but unloadable" there. This one now asks too, and the two questions land on
two states:

- no backup **stored** → the existing guidance panel and its Go to Import CTA, unchanged. That is the right
  answer to a genuinely unconfigured app (the `setup-required` / `error` split, `DECISIONS.md:2996`).
- a backup **stored** that will not become rows (falsy load, or a rejection) → `EBIRD_BACKUP_LOAD_ERROR`,
  the one string the rest of the family already carries, rendered through the shared `TabLoadErrorAlert`
  with its Go to Settings button.

`rows` gained a fourth value rather than a flag beside it: `ChecklistRowData[] | null | BACKLOG_LOAD_FAILED |
undefined`, one state machine, because a separate boolean would make "failed and ready at once"
representable and there is nothing honest to render for it.

### The two decisions the brief left open

**1. The new error state announces (`role="alert"`), and the split is what decides it.** The
tab-error-panel-alerts work deliberately left this `StateBlock` out of the alert sweep because it is
*guidance*, and that reasoning is right and unchanged: `setup-required` describes a stable fact about an
app that has not been configured, present from the moment the section opens, and it keeps the `role="status"`
it already had. But `DECISIONS.md:2996` assigns treatment by phase, not by panel, and the state added here is
on the `error` side of that same split: an asynchronous failure of something the user has already done,
arriving after the section has said "Building your backlog…". Every other `error` phase in the app announces,
through this same component, in these same words. Leaving this one silent would mean a screen-reader user
watching the spinner get replaced by a message no one reads out. So it announces, and it announces the
sentence and nothing else, because the component's region holds the message while the Go to Settings button
is its sibling.

**2. The collapse gap is FIXED, not recorded.** The brief is right that a region mounted inside the panel
would hold v0.5.83's guarantee on the first expand (the panel always opens on `rows === undefined`, the
spinner) and lose it on every collapse-then-re-expand, where the region and its message would arrive in one
commit. The eight tabs have no analogue because a tab's panel does not unmount under its region. The repair
is the same structural one, one level up: **the region is mounted outside the disclosure**, at the section
root, so it is present and empty whenever the section is on screen, whether the panel is open or shut. Its
message is set only while the section is open, so collapsing empties it and re-opening inserts a fresh
message node into a region that was already there. Idle it carries no inline styles and no content and
computes to zero height; it is never hidden to achieve that, since hiding a live region is the other route
into the same trap. This was recorded rather than fixed only if the fix cost something, and it did not: the
panel's card chrome moved to a shared constant that the failure state reuses, so the failure reads as the box
it replaces, and the panel is not rendered in that state so the two are never both on screen.

Because it is fixed, `ACCESSIBILITY.md` gains a true sentence rather than a caveat. It is scoped in time, the
way the eight-tab sentence directly above it already was: the region is *already present, and empty, from the
moment the section is on screen, rather than being created along with its text*, and the failure is announced
on the first opening and on every later one. An earlier wording said "present and empty whenever the section
is on screen", which is false read universally, in exactly the state the sentence is about.

### The testability gap, which was the substance of the job

No test in this repo renders `App.tsx` (verified, not assumed: nothing imports it; the files that mention it
read it as *text*, for the entry-chunk graph walks). So asserting only that the component renders the right
thing for the right prop would have left the branch actually being fixed unguarded, which is the
`clear-means-clear` failure mode: symmetry in the code without symmetry in the evidence.

The load decision therefore moved into `frontend/src/lib/weatherBacklogLoad.ts` and is driven directly by
`honestLoadFailures.test.tsx`, with its dependencies **injected rather than imported**. Injection is not
decoration here: that suite mocks `lib/storage` and `lib/observationsCache` wholesale, so a test reaching this
code through the module graph would be mocking the two modules it is trying to prove the loader consults,
which `DECISIONS.md:17` records as structurally impossible to verify. The function returns exactly the value
the prop takes, so what remains in the effect is one liveness check and one setter, with no mapping left to
get wrong.

The loader is **total against rejection**, and the call site depends on it: `App.tsx` calls it with a `.then`
and no `.catch`. Every call the loader makes into one of its four dependencies is inside a `try`, both
`isCurrent()` sites and the row build included, and its own statements are a `Boolean`, two comparisons and
returns. The row build is `return await`, not `return`, and the `await` is load-bearing on a value the type
says is a plain array: an async function's `return v` performs promise resolution of `v` *after* the try
exits, so a `buildRows` handing back a thenable would escape through two separate doors on one
enclosed-looking statement, the `then` call and the `Get(v, "then")` getter lookup. **One boundary is named
rather than claimed away: rejection is closed, non-settlement is not.** A dependency returning a thenable that
never settles leaves the promise pending (measured: still pending at 2s) and the section holds its spinner; no
`try` closes that anywhere, the answer is a timeout, and it belongs to whoever introduces a dependency that
can hang. None of the four can today. **The claim needed correcting three times before it was true, and all
three are in the docstring, because each read as correct on inspection.** The effect this replaced wrapped its whole `.then` body in a single `.catch`,
so a throw from `buildChecklistRows` was covered before the lift; left outside it would escape unhandled
(there is no global handler in `src`), `setBacklogRows` would never run, and the section would park on
"Building your backlog…" for the rest of the session. And the second `isCurrent()` call sat outside every
`try`, which is invisible on inspection precisely because the FIRST one is inside the status read's try: a
predicate that throws immediately is caught, one that throws late rejected the promise.

### Why the totality guard is written the way it is

The first spelling of it named three of the four dependencies in a literal array, which is a roster wearing a
totality claim's clothes: it cannot see what it does not name, and what it did not name was `isCurrent`, the
one member with an unguarded call site. A designed mutation (a fifth dependency called outside every `try`)
produced no failures at all against it.

It now iterates `Object.keys(backlogDeps())` instead. That closes it by construction rather than by diligence,
because TypeScript already forces the fixture to carry every member of `BacklogLoadDeps` for the call under
test to compile, so a dependency added later brings its own rows whether or not anyone remembers this file.
The other half is the **nth-call sweep**: a member called more than once has more than one site and they are
not equally guarded, so each member is made to throw on each of its first three calls rather than only its
first. A throw on a call that never happens leaves the healthy path intact, so the row asserts the promise
FULFILLED and the value a legal state, rather than always the failure one, with the member and call number in
the assertion's own message. Non-vacuity is a counter compared against `keys × 3`, so an empty or partial key
list fails rather than passing quietly. One named row sits beside the sweep for the specific case, asserting
the resolved value and that the later call was really reached.

### Files

- `frontend/src/lib/weatherBacklogLoad.ts` (new) — the decision, and the two sentinels
- `frontend/src/App.tsx` — the effect calls it; the state's type gains the fourth value
- `frontend/src/components/WeatherBacklog.tsx` — the fourth state, and the always-mounted region
- `frontend/src/components/honestLoadFailures.test.tsx` — Finding E, and a stale header paragraph
- `frontend/src/components/WeatherBacklog.test.tsx` — the fourth state's row, and one repair (below)
- `frontend/src/components/ui/TabLoadErrorAlert.tsx`, `frontend/src/components/TabLoadErrorAlert.test.tsx`,
  `frontend/src/components/setupCopy.tsx`, `.claude/rules/ui.md` — comments and a rule's wording, no behaviour
  change
- `CHANGELOG.md` (the existing 1.0.16 section), `docs/HELP.md`, `ACCESSIBILITY.md`, `ROADMAP.md`
- `pipeline/weather-backlog-honest-load-failure/verify-backlog-alert.mjs` — the real-engine harness (below)

### How to test

`pipeline/weather-backlog-honest-load-failure/how-to-see.md` has the click-by-click version. In short: with a
valid backup saved, replace it with any non-eBird `.csv` (the slot accepts it, since `importFileContent`
validates only the extension), then open Weather and expand *List checklists with no weather blocks*. Before
this change the section says "Load your eBird backup first" and offers Go to Import over a file Settings
lists as saved; after it, the section says the backup could not be loaded and offers Go to Settings. Deleting
the backup entirely still shows the original guidance and its Go to Import button.

### Notes for reviewer

- **A failing `getFilesStatus()` reports the load failure, and this goes beyond the letter of the brief.**
  The brief specifies the error state for "whenever `getFilesStatus()` says a backup is stored". A status read
  that *rejects* says neither thing, and it is reachable on web and Pi, where `getFilesStatus` is a bare
  `fetch` at a backend that can be unreachable. The alternative is to fall through to the guidance, which
  re-introduces the family's lie in the one corner nobody enumerated: with no way to see the file, "you have
  no backup" is a claim the section has no basis for, while "couldn't load your backup" is true of the
  situation either way. It has its own test row saying it is deliberate. Note the desktop is unaffected by the
  choice, because `TauriStorage.readMeta` already swallows its own failures into `{ebird: null, ml: null}`.
  **The consequence is that this is now the only surface in the app that answers a rejecting status read
  honestly:** the eight tab loaders still map it to `setup-required` in their outer `catch`, which is the same
  lie one layer up and is ordinary on web and Pi. That is not fixed here (eight loaders is its own run) and it
  was recorded nowhere, so it is now a named, reachable item in `ROADMAP.md`'s honest-failure residue bullet,
  stated as the property and with the divergence attached, as an argument for doing the eight rather than for
  undoing this one. The same bullet's first item was this build's own defect and is marked closed; its stale
  "ninth surface" phrasing and its item count went with it. **The sweep of that bullet turned up a second stale
  item:** its third, `LifeList`'s non-throwing ML failures rendering a silently empty Multimedia list, was
  closed by build 3 of this same bundle and had been left on the list. Both closures are now recorded with the
  constants that carry them, and the bullet is down to two items.
- **`BACKLOG_SUPERSEDED` is a return value, not a fourth display state.** The added status read is a new async
  boundary, so the liveness check happens after *both* awaits, inside the loader, where it can also stop a
  superseded run from spending a full `buildChecklistRows` pass on an answer nobody will read. It resolves to a
  sentinel the caller narrows away rather than to `undefined`, because writing `undefined` would push a settled
  section back to its spinner; TypeScript enforces the narrowing, since `setBacklogRows` does not accept it.
  The ordering follows Finding C's rule: a superseded run writes nothing *even when it settles truthy*, and
  that has its own row.
- **`Array.isArray(rows)`, not `rows ?`, in the backlog memo.** `BACKLOG_LOAD_FAILED` is a non-empty string
  and would have sailed straight through a truthiness test into `computeBacklog`. Worth a look because it is
  the one place the sentinel's shape could have bitten.
- **One existing test needed repairing, and it is the documented consequence rather than a surprise.**
  `WeatherBacklog.test.tsx`'s "failures render as role=alert" resolved `findByRole('alert')` as a singleton,
  which stops being true the moment an always-mounted empty region exists. v0.5.83's fourth rule says exactly
  this: when a region becomes always-mounted, every alert-PRESENCE assertion in the repo has to become an
  alert-CARRIES-TEXT one, or it starts asserting the defect. The row now filters to the alerts carrying text,
  asserts there is exactly one, and asserts it is the offline sentence. No assertion was weakened, and this is
  the only place in the suite where it was true (the full run is green).
- **Finding E's rows are NOT in the tab rosters, and that is deliberate.** `EBIRD_MESSAGE_TABS` and
  `TabLoadErrorAlert.test.tsx`'s roster are rosters of *tabs* (`lib/tabLayout.ts`'s `TAB_LABELS` is what a tab
  is). This is a section on the Weather tab, and the difference is load-bearing rather than cosmetic, since it
  is what forces the region out of the disclosure. Both files now say where a non-tab consumer's rows live, so
  the eight-tab framing cannot be read as "eight is all the call sites".
- **The count of surfaces is not published anywhere in this change,** in code, tests, docs or the changelog,
  and the two places that already published one were swept rather than left. Three defensible rosters give
  three different numbers, so the property is written instead. `honestLoadFailures.test.tsx`'s opening
  paragraph still read "Three findings" and "the same nine surfaces" after build 3 added a fourth finding.
  `setupCopy.tsx` said "nine surfaces carry the eBird one", which this build makes ten, in the very file that
  exists to stop this family's copy drifting; it now states the property, names the three rosters, and says
  which test asserts it surface by surface. And `.claude/rules/ui.md` recorded `.sr-wrap-anywhere` as "inert
  on two of the nine surfaces it was applied to", one behind the code for the same reason; the number is gone,
  the two inert surfaces are still named, and the new surface's measurement is recorded there instead. A count
  in a comment is a defect the moment a surface is added, so it is the roster that gets written down, never
  its length.
- **A published `ACCESSIBILITY.md` claim was false in a reachable state, and the repair is the paragraph, not
  the clause.** "Already present, and empty, from the moment the section is on screen" does not hold on
  tab-return with a latched failure: tab panels are hidden with `display: none` rather than unmounted, so the
  region is still populated from before. The claim is now scoped to the message's arrival, which is what the
  guarantee actually is and is true in every state: the region is in place *before any message reaches it*,
  opening the section fills a region that was already there, and closing it empties that same region rather
  than removing it. The paragraph's opening clause was widened with it, from "When a tab cannot load your
  saved..." to "When part of the app cannot load...", since the paragraph now covers a surface that is not a
  tab and the old subject made the new sentence read as an appendix to a claim about tabs. The existing
  eight-tab sentence was checked against the same standard and is already time-scoped correctly ("from the
  moment the tab starts loading"), so it was left alone.
- **Docs were swept at paragraph scope in both directions.** `docs/HELP.md`'s eBird-backup section said "If a
  tab says it couldn't load your eBird backup"; the backlog is not a tab, so that sentence's subject widened
  rather than gaining a second, narrower formulation beside it. The backlog paragraph's "If no backup is
  loaded" also conflated the two states this change separates, so it now names both. `README.md` and
  `website/index.html` were checked rather than assumed: each mentions the backlog in a single clause about
  what it lists, neither describes this state, and both stay true unedited.
  `website/tools/capture-appstore.mjs` expands the disclosure with a healthy backup loaded, so it exercises
  only unchanged states, and the idle region adds no height.
- **Not touched, deliberately:** `TauriStorage.readMeta`'s blanket catch (`storage.ts:632-639`), which turns
  any unreadable `metadata.json` into `{ebird: null, ml: null}`. It leaves this surface with a residual exactly
  equal to the one every other stored-file surface already carries, it does not undo this fix (today *every*
  failure here is the lie; afterwards only the metadata-unreadable one is), and it is captured as its own
  build. **The family is therefore not closed by this build**, and that is the one thing left in it.

### Verification

- `npm run build` clean (the pre-push gate); `npx tsc --noEmit` clean; `eslint src --max-warnings=0` clean
- Full frontend suite: **269 files, 4402 tests, all passing** (4386 before; +16). Re-run after the
  `return await` change, which needed no test change: the totality sweep asserts fulfilment, which
  `return await` preserves. No re-runs were needed: no
  test failed in this run, so the suite's known scheduling flakiness did not appear and nothing about it is
  claimed here.
- **Mutation check, five of them.** With `resolveBacklogRows` reverted to the pre-fix shape (never ask
  whether a backup is stored, map every failure to the guidance state), exactly **7** Finding E rows go red,
  including the non-vacuity row proving the honest branch comes from the status read rather than from the load
  happening to succeed. With the region moved back INSIDE the disclosure (the in-branch shape), exactly the
  **2** identity rows go red and the message and absent rows stay green, which is the demonstration itself: a
  presence or `textContent` assertion cannot discriminate that defect. With the row build's `try` removed,
  exactly the **2** rows covering it go red and nothing else. With the later `isCurrent()` check moved back
  outside its `try` (the attempt-2 defect), the named row and the totality sweep both go red. And the designed
  mutation that defeated the first spelling of that guard, **a fifth dependency called outside every `try`**,
  now turns the sweep red where it previously produced 0 failures across all rows. All five reverted and
  re-run green.
- **Real engines, both of them, region idle** (`.claude/rules/ui.md`: jsdom loads no stylesheet and has no
  accessibility tree). A Playwright harness serves the production build with a stub backend reporting a stored
  backup whose bytes come back 500, so the failure is reached through the real storage seam. In **Chromium and
  WebKit**: an alert region exists while the section is COLLAPSED and `ariaSnapshot` reports it as `- alert`
  with no name; no ancestor on the chain to `<html>` is hidden or `aria-hidden`; Chromium CDP
  `Accessibility.getPartialAXTree` reports the idle node `ignored: false, live: "assertive"`; after expanding,
  the region reads `- alert: Couldn't load your eBird backup. Re-upload MyEBirdData.csv in Settings → Default
  Files → eBird Backup.` and nothing else, the setup-shaped title is absent, and Go to Settings is beside the
  sentence; collapsing empties the region without unmounting it and re-expanding refills it.
- **The harness was run against the build that LACKS the fix and fails there**, which is what makes it a
  measurement: in both engines, zero alert regions exist, the message never appears, and the section renders
  "Load your eBird backup first" over the stored backup (4 failed checks, and it reports the lie by name rather
  than only the absence of the truth).
- **320px at 200% in-app text scale, measured in both engines:** `documentElement.scrollWidth` 320 against
  `innerWidth` 320, message box 190px wide. The `sr-wrap-anywhere` allowance that the eight tabs needed for
  the unbreakable `MyEBirdData.csv` run holds in this container too.
- An accessibility tree is a proxy, never proof of an announcement: no screen reader was used, which is what
  `ACCESSIBILITY.md` already says about these regions and continues to say.
- No backend files changed and the diff touches no Python, so `pytest` was not run.

### Two Informational findings from the security review, recorded rather than fixed here

- **The harness's `TYPES[extname(file)]`** is a bare object-literal lookup keyed by a request-derived string,
  which is the shape `.claude/rules/security.md` requires `Object.hasOwn` on. It is safe today on an invariant
  rather than a guard (`extname` returns the empty string or a leading-dot string, and no `Object.prototype`
  member begins with a dot), and it serves a local dist to a headless browser on an ephemeral port. That
  argues for leaving it in a throwaway harness, not for shipping it as tooling, so the note lives in the
  harness's own promotion section, which is where a promoting build will read it.
- **The docstring named `TauriStorage.readMeta` as the residual but not its web twin.**
  `WebStorage.getFilesStatus` returns `{ebird: null, ml: null}` for any non-ok response, so a backend
  answering 500 reads as "no file stored" on web and Pi. Naming only the desktop half left the picture half
  drawn, so the module comment now names both, and `ROADMAP.md` records the sharper form: three swallowing
  sites are the actual subject of that item, because no loader can tell "no file" from "could not ask" until
  one of them stops discarding the difference, and the eight outer catches are downstream of that.

### Where the harness lives, and what reusing it would take

`pipeline/weather-backlog-honest-load-failure/verify-backlog-alert.mjs`, committed rather than left in a
session scratchpad, because it is the only real-engine evidence for the always-mounted region and the only
evidence that `App.tsx` still calls the seam rather than a copy of it.

**What it is.** One self-contained Node script. It serves a production `dist` behind a stub backend that
reports a stored eBird backup whose bytes come back 500, so the failure state is reached through the real
storage seam rather than by injection, then drives Chromium and WebKit through the idle region's
`ariaSnapshot`, a computed-style walk from that region to `<html>` for hiding values and `aria-hidden`,
Chromium CDP `Accessibility.getPartialAXTree` for `ignored` and `live`, the populated snapshot, the collapse
and re-expand path, and a 320px / 200% text-scale overflow probe. `--expect-broken` inverts the exit code, so
pointing it at a pre-fix build is itself a check. Ephemeral port, no fixtures on disk, no global state,
non-zero exit on mismatch: CI-shaped already.

**What reusing it would take, since I gather that is the intent.** It is deliberately a pipeline artifact and
not repo tooling, because promoting it is its own build rather than a ride-along. That build is small and has
one real decision in it. The mechanics: move it under a tools directory with an npm script, and give it a
`--dist` default so it does not need a path argument. The decision: **the dependency.** Playwright is not a
`frontend` dependency; it lives in `website/tools/node_modules` for the screenshot scripts, which is why the
resolver points there, and the browsers come from the shared `ms-playwright` cache. Making this a gate means
either declaring that dependency properly or accepting a check that silently skips where those are absent, and
the second is the shape that rots. Everything else generalizes as written: the stub backend is the honest way
to drive *any* stored-file state (change what `/settings/files` and `/settings/files/<slot>` answer), and the
three accessibility probes are per-region rather than per-feature. Worth saying plainly: builds 1 and 2 of
this bundle shipped their WebKit tab-order claims on inference, because jsdom has no tab order at all, and
this harness is the shape of the thing that would have measured them.
