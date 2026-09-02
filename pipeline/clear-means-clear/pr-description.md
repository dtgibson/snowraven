## clear-means-clear

### What this does

Clearing your eBird backup now removes everything SnowRaven had worked out from
it, and tells every open tab at once. Before this, Clear deleted the CSV and
dropped two in-memory caches, then left four durable stores sitting on disk
holding the user's own checklist ids, species codes and escapee common names,
and left the seven still-mounted tabs rendering the cleared backup until a
relaunch.

Three things changed:

1. **One shared teardown, `lib/clearDerived.ts`**, called from all three clear
   paths (`Settings.tsx handleDeleteFile`, `icloudSync.ts clearWithSync`, and
   `icloudSync.ts delete-local`). Each of the four stores gained a real exported
   purge; before, the only clearing function any of them had was a
   `_reset*ForTests` seam that detaches the in-memory mirror and leaves the
   document on disk, which is not a production API.
2. **Purge on CLEAR only, never on REPLACE.** The controller's existing
   `deps.invalidate(slot)` also serves the synced *arrival*, which is a replace,
   so the teardown is a separate dependency (`deps.purgeDerived`) that the pull
   path physically cannot reach.
3. **`handleDeleteFile` bumps the files epoch.** It was the one mutation path
   that did not; both sync clear paths already did.

### Stores purged

| Store | What was left behind |
|---|---|
| `exotic-provenance-v1` (in `settings.json`) | the user's checklist submission ids, species codes, and escapee common names carried verbatim from the export |
| `checklist-projects-v1` (in `settings.json`) | submission ids as document keys |
| `county-completeness-v1` (in `settings.json`) | see the note below |
| `data/replay.json` | the `/weather/S…` and `/tide/S…` entries, keyed by submission id |

**`county-completeness-v1` is in the list, and that is a deliberate call worth
stating.** Its stored *payloads* are eBird's public data and nothing of the
user's, so on payload grounds it does not belong. But a key exists there only
for a county `useCountyCompleteness` decided to fetch, and it fetches only where
the loaded export gives that county `countableCount >= 1`. The *key set* is
therefore derived from the user's own observations: it is the list of counties
they have birded. Leaving it after a Clear is exactly the expectation gap this
change closes. **Accepted cost:** after a clear and a later re-upload, those
county lookups re-fetch from eBird rather than being served from the 30-day
cache. That is one extra request per county the user pans over, once.

Deliberately **not** purged, and each asserted by a test rather than left to
inference:

- **Anything derived from `ml-export.csv`.** Nothing durable is keyed to it; the
  ML caches are session-scoped in memory. The registry has a row for the slot
  and no entries, so the first ML-derived store is a one-line addition.
- **The coordinate-keyed replay entries** `/weather/at` and `/tide/at` (the
  Weather Forecast panel, a place the user typed). They did not come from the
  export, so a Clear must leave them alone.
- **Everything, on a replace.** `PRIVACY_POLICY.md` publishes that loading a
  newer export "asks only about checklists that have not been answered yet", and
  the projects store's 365-day incremental premise rests on it. Purging on
  upload would falsify a published statement and force a full re-sweep on every
  upload.

### How to test

1. `cd frontend && npm run dev`, then open http://localhost:5173
2. Settings → Default Files → upload an eBird backup.
3. Statistics tab: let the escapee section answer, then press the Projects
   section's control and let it answer. Weather tab: look up one checklist's
   weather, and (separately) a forecast for a typed place. Map Explorer: pan
   over a county so its Completeness shading loads.
4. Open Calendar so it loads. Now go to Settings and press **Clear** on the
   eBird row.
5. Switch back to Calendar: it flips to its setup-required panel immediately,
   with no relaunch. That is the epoch bump.
6. Quit, reopen, and inspect `AppLocalData/data/settings.json` and
   `data/replay.json`: `exotic-provenance-v1`, `checklist-projects-v1` and
   `county-completeness-v1` are gone, the `/weather/S…` keys are gone, and the
   `/weather/at?lat=…` key is still there.
7. The negative: re-upload, re-answer, then upload a *newer* export over it. The
   escapee and Projects answers survive, and only unanswered checklists are
   asked about.

`pipeline/clear-means-clear/how-to-see.md` is the plain-English version of the
same walk.

### Notes for reviewer

**The race that made this more than four one-liners.** A purge that only empties
mirrors and deletes documents is not enough, because four things can be in
flight across it:

- A store's own **250 ms debounced whole-document flush**, holding the
  *pre-purge* document. Every purge cancels the pending timer, and every
  `scheduleWrite` callback now checks that its captured store is still the
  installed mirror before flushing.
- **A flush whose write is ALREADY IN FLIGHT** — past the timer, past the
  identity check, inside the seam. Neither mechanism above reaches it (security
  review, Low). `replay.json` is the app's one durable document not on the
  storage seam's `docChains`, so two concurrent `setReplayStore` calls complete
  in whatever order the filesystem returns, and the purge's document is the
  *smaller* one, so it is the likelier to land first and be overwritten by the
  pre-purge flush. `replayStore` now has **one ordered writer** (`writeThrough`,
  the same shape as `TauriStorage.chain`, same two rules): the next write is not
  CALLED until the previous one settles. It orders the writes rather than
  narrowing the window. Mutation-checked, and the first version of that test was
  green against a deliberately unordered store because it released the parked
  write too early; it now asserts the disk is still untouched while the purge's
  write is queued, then asserts the write ORDER.
- The **one-disk-read-per-session load**. Each `ensureLoaded` now returns the
  installed mirror if a purge put one there while the read was parked, instead
  of adopting the pre-purge document it just read.
- A **network answer already in flight**. `dedupedFetchProjects`
  (`checklistProjectsCache.ts:347` captures, `:382` merges) and
  `countyCompletenessCache.dedupedFetch` (`:256` / `:268`) capture the store
  before awaiting their loader, and their write helpers (`mergeEntry`,
  `putEntry`) are private and take that captured store, so an identity check at
  the write point is enough for those two. An earlier draft of this section
  claimed that of "the other three stores"; it was wrong about the third
  (`replayStore`), which is what QA caught. See the bullet below.
- **`exoticProvenanceCache` needed more than identity**, and this is the one
  design decision I would want a second pair of eyes on. `mergeChecklist` is a
  public entry point that calls `ensureLoaded()` for itself, so after a purge it
  would load the fresh empty mirror, find its own store identical to it, and
  merge in observations fetched for a checklist id that came out of the export
  the user just deleted. Identity cannot see that; a **monotone purge
  generation** captured before the first await can, because the question is "did
  a Clear happen since this work began?" rather than "is this the current
  object?". `publishExcludedNames` carries the same guard, for the same reason
  and with more at stake: those are species common names from the export.

- **`replayStore.put` was the same hole, and QA found it after I asserted it was
  not one.** `put` is a *public* entry point that calls `ensureLoaded()` for
  itself — structurally identical to `mergeChecklist` — so after a purge it
  found the fresh mirror, passed its `store !== _store` check, and flushed a
  `/weather/S…` key from the deleted export 250 ms later. Reachable, not
  theoretical: `transport.ts` `getReplayable` puts *after* the network await,
  and `App.tsx` `lookupBacklogWeather` (the Weather Backlog) fires `/weather/<id>`
  for a run of ids read out of the backup while the Weather tab sits mounted
  under `display:none`. It blocked rather than being a known limitation because
  this change *publishes* the guarantee it broke, in `PRIVACY_POLICY.md:16`,
  `website/privacy.html:124` and `docs/HELP.md:601`.

  **The fix had to capture one step earlier than the provenance store's.** A
  generation read inside `put` cannot answer this one on its own: `put` is
  entered only *after* the answer lands, so by then the purge has already moved
  the counter and the capture would read the post-purge value. The capture has
  to happen where the REQUEST begins, which is what
  `dedupedFetchChecklist` does internally for provenance — and replay's fetch
  chokepoint is `transport.getReplayable`, outside the store. So the store
  exports `purgeGeneration()`, `getReplayable` captures it *before* the GET and
  hands it back as `put(key, data, gen)`, and `purgeChecklistReplay` moves the
  counter at the instant it swaps the mirror. `put` still captures before its
  own `ensureLoaded()` await when no generation is passed, which is exactly the
  `mergeChecklist`-level guard — real, but weaker, and documented as such at the
  parameter.

  Three tests hold it, and none passes without the piece it covers. Two are
  half-tests, each mocking the other side: the `replay` row of `WRITE_RACES` in
  `clearDerived.test.ts` (the store refuses the write; hand-rolls the
  transport's shape) and `transport.test.ts` "hands put the generation captured
  BEFORE the request, not after it" (the chokepoint really passes it; mocks the
  store). The third is the **composed seam**, `replayClearSeam.test.ts`: the
  real `CachedTransport`, the real store, the real `purgeDerivedOnClear`, with
  only the storage seam and `fetch` faked, driving the exact call
  `App.tsx lookupBacklogWeather` makes. Two halves that each stay green against
  a mock while they stop fitting together is precisely what a mocked pair
  cannot catch. It carries the OTHER half of the guarantee too: a lookup that
  *starts* after the Clear still persists, so clear-then-re-upload in one
  session is not over-refused. Mutation-checked three ways — capture below the
  await, store guard reduced to identity, store over-refusing after any purge —
  each turning exactly one of its two tests red.

  **`put`'s third argument is REQUIRED** (security review, Low; I had shipped it
  optional with a census guard, and the Auditor's reasoning against that is
  better than mine). A required parameter fails at `npm run build` — this
  project's declared pre-push gate — where a vitest census fails one gate later;
  and a guard asserting an exact two-module allowlist fails *toward widening*,
  because the obvious response to it going red is to add the new module to the
  list. It costs nothing: the only call site already complied, and the 16 call
  sites in `replayStore.test.ts` route through one local helper that captures at
  call time. Demonstrated: dropping the argument now produces
  `error TS2554: Expected 3 arguments, but got 2` from `npm run build`.

  The census guard stays, for the part a required parameter cannot see: that the
  capture is read ABOVE the request rather than below it, and that the call site
  count is still one. `cacheInventory.test.ts` walks the whole `src` tree for it.

**`docChains`.** The three `settings.json` stores purge through
`storage.deleteSetting`, which is already one link on that document's chain, so
no store hand-rolls a read-modify-write. `storageWriteSerialization.test.ts`
gains three interleaving tests for the purge shape (the 1.0.8 clobber aimed at
the delete side, a debounced flush racing the purge, and a randomized order).
`data/replay.json` is its own file with a single writing MODULE, so it has no
read-modify-write to clobber and joins no seam chain — but "one module" is not
"one write at a time", and the security review found the gap: it now has its own
ordered writer inside `replayStore` (see the in-flight-flush bullet above).

**Entry chunk.** `Settings.tsx` is on App.tsx's static graph and
`countyCompletenessCache.ts` must stay off the entry chunk, so `clearDerived.ts`
carries no static imports at all and reaches every store through `import()`.
`entryChunk.test.ts` asserts the registry is on the graph and that its own
closure is exactly one file with no externals, so a row "simplified" into a
static import fails there rather than growing the bundle silently.

**Red-first evidence.** Restoring the shipped clear handlers (commenting out the
three teardown calls and the epoch bump) fails 5 behavioural tests plus the
inventory guard: `Settings.clear.test.tsx` (3), `icloudSync.test.ts` (2) and
`cacheInventory.test.ts` (1). The in-flight race tests in `clearDerived.test.ts`
were red first too, against a first implementation that had identity checks but
no purge generation, which is how the `mergeChecklist` hole was found.

Those race tests are now **one row per durable store, from one template**
(`WRITE_RACES`, beside the existing `LOAD_RACES`), because three of the four
stores having the test is exactly what let the fourth pass review. **Every row
is mutation-checked against its own guard**: removing that store's guard turns
that row red, one row each, no cross-talk — 4 of 4.

That check found a fifth thing worth stating. The county row was green with
`putEntry`'s identity guard removed, because `scheduleWrite`'s downstream guard
keeps the disk clean anyway and the row asserted only on the disk. The guard is
not redundant: `putEntry` mutates module-level `_totalBytes` *before*
`scheduleWrite` declines, so an unguarded put leaves the freshly reset budget
permanently over-counted and drives premature eviction later. Every row now
asserts the observable outcome **and** that the store's write path never ran,
read from its work-stats seam (`puts` / `merges` at zero). Four green rows were
not four working guards — the same blind spot that let `replayStore` through.

The inventory guard reads sources with comments stripped — whole-line `//`, and
a `/*` block that opens a line — after the first version of the red-first check
showed a commented-out call still satisfying a plain `toContain`. QA noted the
`//`-only version still left the block form as a way to satisfy the guard with
a call that does not run; closed, and demonstrated by block-commenting the
replay teardown row and watching the guard go red.

**Docs moved in the same change.** `docs/HELP.md` (Default Files, and the
"Clearing a file with sync on" paragraph), and the one sentence that
`PRIVACY_POLICY.md:16` and `website/privacy.html:124` share, edited together.
`PRIVACY_POLICY.md`'s "asks only about checklists that have not been answered
yet" was re-read as a guard and stays true; the new sentence states the
clear/replace split explicitly, so the two now reinforce each other. `README.md`
and `website/index.html` were checked and carry no clear claim. No em dashes.

**A failed purge is no longer reported as a completed Clear** (security review,
Low). `purgeDerivedOnClear` used `Promise.allSettled` and never read the
results, over a `WebStorage.deleteSetting` that never checked `res.ok` — so a
document that would not delete produced a clean-looking Clear. Three changes,
all small:

- `WebStorage.deleteSetting` rejects a non-2xx, the same reasoning already
  written at `setSetting` one method above it.
- `purgeDerivedOnClear` still attempts every store and still does not reject
  (one store's failure must not abandon the other three, and the file itself is
  already gone, so throwing would mislabel a mostly-successful clear as a failed
  delete) — but it now RESOLVES WITH THE STORES THAT FAILED. An empty resolve
  used to be indistinguishable from a clean sweep.
- Both clear paths the user drives report it with the same sentence: *"File
  removed, but some data worked out from it could not be deleted. Clearing again
  after your next upload will remove it."* It goes in the existing per-row error
  slot, no new UI pattern. It deliberately does not say "try again" — the row is
  empty now, so that is not an action the user can repeat — and it does not
  claim the delete failed, because the file IS gone: the row still clears and
  the epoch still bumps. `clearWithSync` returns the list for the same reason,
  and the iCloud half still runs either way (a local document that will not
  delete is no reason to leave this device's cleared marker unpublished). The
  synced `delete-local` path deliberately does NOT surface it, and QA agreed:
  that clear arrived from another device during a background check, so there is
  no user waiting, and the only surface that path owns is the sync slot view,
  whose error state reads "Could not sync" — which would be false, because the
  sync SUCCEEDED. **Recovery there is narrower than the first version of that
  comment implied**, and the comment now says so: a repeat synced clear
  short-circuits at the `!applied` guard before it ever reaches the purge, so it
  takes an upload and then a clear, not simply "the next Clear". On the other
  two paths the next Clear does re-attempt.

The three published surfaces were re-read after the copy change and still hold:
`PRIVACY_POLICY.md:16`, `website/privacy.html:124` and `docs/HELP.md:601`
describe what Clear removes, which is now both true (the ordering fix) and
honestly reported when a write fails. No em dashes in the new string.

**Both clear paths are guarded, not just written.** QA found that deleting the
surfacing from the SYNCED path left all 41 tests green: the two paths were
symmetric in the code and asymmetric in the evidence. `Settings.icloud.test.tsx`
now drives the real path — sync on, the confirm dialog, `clearWithSync`
resolving one failed store — and asserts the sentence appears and that it does
NOT read as a failed delete; the neighbouring clean-sweep test asserts the
message stays absent when nothing failed. Mutation-checked: removing the
surfacing turns exactly that test red and nothing else. (It also had to reach
the double through `vi.mocked` — `actions` is typed as the real `ICloudActions`
— which `npm run build` caught and `vitest` alone did not, the same
gate-ordering point as the required argument above.)

**Null-prototype accumulator in the purge** (security review, Informational).
`purgeChecklistReplay` built its surviving-entries object as `{}`, keyed by the
unvalidated persisted document — the v0.5.90 write-side rule. On a plain object
the single key `__proto__` is an inherited setter, so the entry would be
silently dropped from the purged document (and the accumulator's prototype
mutated) rather than carried over. `Object.create(null)`, with a test that a
`__proto__`-keyed entry survives a Clear exactly like the coordinate keys.

**Known limitation.** The Map Explorer's county shading holds its completeness
snapshot in component state, so the purged entries leave its in-memory copy
until the tab re-enters its loading phase. In practice the epoch bump does that
immediately, and with no backup loaded the overlay has no denominator and its
`active:` gate is closed anyway, so there is nothing stale to see.

**Not in this change, per the bundle:** no version bump, no `CHANGELOG.md`
entry. Both ride the Spool bundle's release prep at the flush.

### Convention Flags

- **Every path that saves, replaces or removes a stored data file bumps the
  files epoch, with no exception for the handler that did it.** CLAUDE.md's
  `lib/filesChanged.ts` bullet currently carves out "outside the Settings tab's
  own handlers", and that carve-out is what let `handleDeleteFile` be the one
  mutation path that never fired the signal while the synced clear did. The
  reasoning behind the carve-out ("the tab that did it already knows") is wrong
  in this app specifically: tabs are hidden with `display:none` rather than
  unmounted, so the other seven are still mounted with loaders keyed on the
  epoch. Drop the carve-out.

- **A durable store keyed on user-file content registers with the same teardown
  that deletes the file.** Four stores each missed this, and the reason is
  structural rather than careless: there were three clear paths, so wiring a new
  store meant remembering all three. The rule that travels is the registry, not
  the discipline: one table, one entry point, and `cacheInventory.test.ts`
  pairing each store's exported purge with a row that calls it. Two things
  learned building it that belong in the rule. First, **the purge must be a
  production export, never the `_reset*ForTests` seam** — those detach the
  mirror and leave the document, so shipping one as the clear path looks correct
  in a test and clears nothing on disk. Second, **a store is registered on where
  its KEYS come from, not where its VALUES come from**: `county-completeness-v1`
  holds only eBird's public payloads and still belongs, because a key exists
  only for a county the user has birded.

- **A durable store's purge has to supersede the store's own in-flight work, not
  just empty it.** Cancelling the debounced timer, guarding the load path
  against adopting the document it just read, and refusing a write from work
  that began before the purge are three separate mechanisms, and a purge missing
  any one of them silently un-does itself a few hundred milliseconds later. The
  sharper half: **identity (`store !== _store`) is sufficient only where the
  writer captured its store before the await.** A public entry point that calls
  `ensureLoaded()` for itself will find the fresh empty mirror perfectly valid
  and write the old export's data into it. That case needs a monotone generation
  captured before the first await, because the question is "did a Clear happen
  since this work began?", which identity cannot answer. **And the generation
  has to be captured where the REQUEST begins, not where the write happens** —
  a write path is entered after the answer lands, by which time the counter has
  already moved. Where the fetch chokepoint lives inside the store
  (`dedupedFetchChecklist`) the capture is internal; where it lives outside it
  (`transport.getReplayable` for the replay store) the store exports the
  capture and the chokepoint hands it back to the write. Two of the four stores
  here have a public write path that re-loads for itself and needed this; the
  other two, whose write helpers are private and take a pre-captured store, did
  not.

- **Every durable store gets the same in-flight race test, written from ONE
  template, so a missing store is conspicuous.** This is the convention QA
  sharpened, and it is the reason the replay hole shipped to review: three
  stores had a hand-written in-flight test each, the fourth had none, and
  nothing about four separate `it()` blocks made the absent one visible. A
  roster (`WRITE_RACES` in `clearDerived.test.ts`: label, how the write starts,
  what must not be persisted) makes the store list itself the artifact, and a
  fifth store with no row reads as a gap rather than as nothing at all. The
  same shape was already in the file for the load race (`LOAD_RACES`) — the
  lesson is to reach for it at the FIRST store, not the third. **And every row
  must be mutation-checked against its own guard, then assert that the write
  path never RAN, not only that the disk stayed clean.** Four green rows are not
  four working guards: the county row passed with its guard deleted, because a
  downstream guard kept the disk clean while the deleted one was the only thing
  protecting a module-level byte total. A roster that is green for the wrong
  reason is the same failure as a roster with a store missing. **A test that
  forces an interleaving must also prove the interleaving it claims**: the first
  version of the in-flight-write ordering test released the parked write before
  the purge could issue its own, so an unordered store passed on timing alone.
  It now asserts the disk is still untouched while the purge's write is queued
  — the state only an ordered writer can be in.

- **Make it required rather than guarding an optional.** I shipped
  `replayStore.put`'s pre-request generation as optional, defended by a
  source-level census of its call sites, and the security review overruled that
  — rightly. Two reasons that travel. A required parameter fails at
  `npm run build`, which this repo declares as the pre-push gate, while a vitest
  census fails one gate later. And a guard asserting an exact allowlist of
  callers fails TOWARD WIDENING: when a legitimate new importer appears, the
  obvious response is to add it to the list, which is the opposite of what the
  guard exists for. Reach for the type system first; keep a source census only
  for what types cannot express — here, that the capture is read above the
  request rather than below it.

- **A best-effort teardown must report what it could not do.** `allSettled` with
  the results discarded is how "clear everything" becomes "clear whatever
  happened to work", indistinguishable from success at the call site. Keep the
  best-effort loop — one store's failure must not abandon the rest — and return
  the failures, so the caller can decide. And the honest message names what
  actually happened: not "delete failed" when the file is gone, and not "try
  again" when the row the user would press is now empty. A background path with
  no user waiting may decline to surface it, but that has to be a stated
  decision at the call site, not a discarded value.

- **A fix that lands on two symmetric paths needs a test on BOTH: symmetry in
  the code is not symmetry in the evidence.** This build hit the same shape
  three times — three of four stores with an in-flight race test, two half-tests
  with nothing on the composed seam, and two clear paths with the surfacing
  guarded on one — and each time the untested half looked safe precisely because
  its sibling was tested and the code beside it was right. Reading the two
  branches and seeing the same lines is what makes it feel covered; the check
  that settles it is to delete the second branch's behaviour and see whether
  anything goes red. When a change touches N paths, write N tests and
  mutation-check each one against its own path.

- **A pair of guards that each mock the other needs one test of the composed
  seam.** Two half-tests can both stay green while the halves stop fitting
  together — the transport passing a value the store no longer reads, or the
  reverse. One end-to-end test with only the outermost seams faked (storage and
  `fetch`) covers the join, and it is also the natural place to assert the
  guarantee's other side: that the guard does not over-refuse the legitimate
  case it sits next to.

- **A call-site guard must read its sources with comments stripped.** A source
  test asserting "this call site exists" is satisfied by a commented-out call,
  which is precisely the state a half-reverted change is in. Demonstrated here:
  commenting out all three teardown calls left the plain `toContain` guard green
  while every behavioural test went red. **Strip both comment forms**: the
  first version stripped whole-line `//` only, which left `/* … */` as an
  equally good way to satisfy the guard with a call that does not run (QA
  caught this). A line-based filter that drops whole-line `//` and any line a
  `/*` block opens or continues is enough, cannot damage a `//` or `/*` inside
  a string on a code line, and fails in the safe direction: a line wrongly
  dropped makes a `toContain` go red, which is loud.
