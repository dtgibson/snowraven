## honest-load-failures

### What this does

Three findings left over from the two earlier builds in this Spool bundle, all
the same claim on the same nine surfaces: **what a tab says about a stored file
must match what is actually true of it.**

1. **A failed Macaulay Library read no longer claims your eBird backup is
   missing.** Statistics, Map Explorer and Species Detail put `loadMLExport()`
   unguarded in the same `Promise.all` as the eBird load, and `loadMLExport`
   awaits `storage.readFile('ml')` *outside* its own `try`. An ML read failure
   therefore rejected the whole `Promise.all` into the outer catch and rendered
   "eBird Backup Required" over a backup that had loaded perfectly. They now
   degrade to no-media, which is what `Checklists.tsx` has always done.
2. **A stored-but-unloadable file gets a message that is honest AND useful.** It
   was *"Couldn't load your eBird backup from Settings. Try re-uploading it."* on
   eight tabs plus two spellings inside List Comparer. It is now
   *"Couldn't load your eBird backup. Re-upload MyEBirdData.csv in Settings →
   Default Files → eBird Backup."* — the shape `BreedingCodeList`'s wrong-file
   branch already had.
3. **A cancelled effect run writes no state at all.** Four loaders spelled the
   guard `if (!ebird || cancelled)`, so a *stale* run whose backup resolved
   truthy still painted an error phase over a tab a newer run had just made
   ready.

Plus one thing the copy change itself made necessary: **List Comparer's `catch`
was narrowed** so the sharper message is attached only to failures that are
genuinely the backup's. See *Notes for reviewer*.

### Reach, stated accurately rather than overclaimed

Finding 1 is a **web/Pi bug, effectively unreachable on the desktop app.**
`WebStorage.readFile` (`storage.ts:239`) is a bare `fetch` and throws on network
failure. `TauriStorage.readFile` (`:645`) wraps everything except `await this.fs()`
— a dynamic import already resolved and memoized by the `getFilesStatus()` call
that runs immediately before. So on desktop there is no reachable throw. It is
still a real lie on the web/Pi build, and it is fixed there.

### The nine surfaces

| Surface | Finding 1 | Finding 2 | Finding 3 |
|---|---|---|---|
| Statistics (`BirdingStats`) | `.catch(() => null)` on the ML load | shared constant | `if (cancelled) return` first |
| Species Detail | `.catch(() => null)` | shared constant | already correct |
| Map Explorer | `.catch(() => null)` | shared constant | already correct (build 1) |
| Multimedia (`LifeList`) | its own ML branch, see below | shared constant | already correct (build 1) |
| Checklists | already guarded (the precedent) | shared constant | `if (cancelled) return` first |
| Breeding Codes | n/a | shared constant | `if (cancelled) return` first |
| Named Birds | n/a | shared constant | `if (cancelled) return` first |
| Calendar | n/a | shared constant | already correct |
| List Comparer | n/a | shared constant, replacing **two** spellings | n/a |

`grep -rn "!ebird || cancelled" frontend/src` now returns nothing, and
`grep -rn "Couldn't load your eBird backup from Settings"` returns nothing.

### Multimedia's ML branch is a deliberate third thing, not a fourth `.catch`

`LifeList` reads the ML file itself (`storage.readFile('ml')`), deliberately not
through `loadMLExport` — `DECISIONS.md:1395` rejected that consolidation as not
output-identical, because the helper swallows a bad parse to null and has no
`detectFileType` gate. Its read has finding 1's exact shape, and an unguarded
throw lands on **"Macaulay Library Export Required"** while an export is plainly
stored: the same lie, on the ML side, in a bundle named for exactly this.

`.catch(() => null)` would have been a *different* lie — a silently empty
Multimedia list. So the read records the failure and the tab says so, in its own
message in the same voice: *"Couldn't load your Macaulay Library export.
Re-upload it in Settings → Default Files → ML Export."* It names the Settings
slot rather than a filename because the ML download's name varies (it carries the
user's ML user id) and `ML_EXPORT_STEPS` tells them not to rename it.

### The copy is a terse error, NOT the setup panel

`DECISIONS.md` (2026-05-22) keeps `setup-required` and `error` deliberately
distinct: `setup-required` means "go configure this in Settings first" and shows
the `SetupRequired` guidance component with `EBIRD_BACKUP_STEPS`; `error` means "a
file IS stored and it would not load" and shows a terse message with a Go to
Settings button. Putting the steps into the error state would blur exactly that
split, so the new copy names the file and the path *inside the terse panel*
instead. **Every row of the copy roster asserts the steps are ABSENT**, and every
row has an absent case: with no file stored, the steps ARE shown and the error
message is not. The genuinely-unconfigured user still gets the full guidance.

Both constants live in `components/setupCopy.tsx` beside `EBIRD_BACKUP_STEPS`.
Single-sourcing prevents drift but not a *dropped* copy (`DECISIONS.md`, v0.5.87),
so each of the nine surfaces still has its own render assertion.

### A layout overhang at 320px that only a browser could see

`MyEBirdData.csv` is an unbreakable run (a `.` between letters is not a
line-break opportunity), and the message box is a flex item, so its automatic
minimum size is floored by that run and the box grows past the width it was given.

**The numbers below are QA's, measured against the REAL BUILT APP** (a stub
backend forcing genuine error phases, real fonts, both engines, and all four
shipped text scales including 125%). My own measurement was a static HTML
reproduction, and its page-level number was an artifact of its own ancestor
chain rather than a fact about the app; see the correction note below.

At 320px the shared error panel overhangs its content column by **23.28px per
side at 200% text scale**, which the fix zeroes. The box widths reproduce to the
hundredth between the static repro and the real app:

| engine | width | text scale | shape | box width | panel overhang / side |
|---|---|---|---|---|---|
| chromium | 320 | 150% | shared panel | 194.14 | present, smaller |
| chromium | 320 | 200% | shared panel | 238.56 | **23.28px**, zeroed by the fix |
| webkit | 320 | 150% | shared panel | 194.16 | present, smaller |
| webkit | 320 | 200% | shared panel | 238.55 | **23.28px**, zeroed by the fix |

**What this is NOT, stated plainly because the first draft of this file got it
wrong.** Page `scrollWidth` measures **320 in every configuration, patched and
unpatched, with no clipping ancestor** — the shell's own padding absorbs the
overhang, so the box's right edge reaches 279.28 on a 320 viewport and nothing
leaks. There is **no horizontal page scroll**, so the pre-fix state was **not** a
WCAG 1.4.10 (Reflow) failure. This is **layout correctness, not an accessibility
repair**: a box sized past its column, fixed. The stats panel (`BirdingStats`)
overflows nothing at all in the real app.

The fix is the existing house helper `.sr-wrap-anywhere` on the message box, and
it ships: it is inert at 100% and 125%, inert at 1024px, and `anywhere` is
genuinely the only value that lowers the flex item's minimum. Measured:
`overflow-wrap: break-word` renders identically and does **not** change the box
width, and `min-width: 0` on the box does not either. This is CLAUDE.md's v0.5.85
note (`break-word` never affects intrinsic sizing) paying out in the direction
where it decides the fix rather than forbidding it.

This is also **not** new in kind, only in reach: the same unbreakable token
already ships in the same panel shape at `BreedingCodeList.tsx:173` (the
wrong-file branch) and measures the identical box width today. This change takes
it from one branch on one tab to nine surfaces, so it is fixed here rather than
left as a courtesy.

`jsdom` cannot see any of this, so the component tests assert the **mechanism**
(the class is on the box that renders the message) and the browser probe owns the
pixels. List Comparer's slot is a block `<p>`, not a flex item, and measured
clean; it carries the class anyway so all nine surfaces are uniform, and the
probe confirms it is inert there.

**Correction, recorded rather than quietly fixed.** The first version of this
file claimed "a 47px page-scroll leak at 320px", from a static HTML reproduction
whose page `scrollWidth` read 367 against a 320 viewport. The box widths in that
repro were right; the page number was not, because the repro's ancestor chain
above the panel was mine and not the app's, and the app's shell absorbs what the
repro let propagate to `documentElement`. The lesson is in the convention flags:
a page-level number from a hand-built repro is evidence about the repro.

### Tests

`frontend/src/components/honestLoadFailures.test.tsx`, +31 tests. Three rosters,
one row per surface, so a tenth surface or a fifth cancel-guarded loader reads as
a **missing row** rather than as nothing at all.

**Every test was mutation-checked, 18 of 18 red**, each with the blast radius it
should have (the two Multimedia rows share one box, and the two backup-attribution
rows share one catch, so a mutation there correctly turns both of its own rows red
and nothing else). The harness runs an
unmutated BASELINE first and restores each file by comparing against the
*intended* bytes rather than the snapshot it used to restore.

| Mutation | Went red |
|---|---|
| drop the ML `.catch` in `BirdingStats` | Statistics ML-guard row |
| drop the ML `.catch` in `SpeciesDetail` | Species Detail ML-guard row |
| drop the ML `.catch` in `MapExplorer` | Map Explorer ML-guard row |
| `LifeList` back to a bare `storage.readFile('ml')` | Multimedia ML row |
| `LifeList` swallowing to `null` instead (**the different lie**) | Multimedia ML row |
| restore `!ebird \|\| cancelled` in `BirdingStats` | Statistics cancel row |
| restore `!ebird \|\| cancelled` in `Checklists` | Checklists cancel row |
| restore `!ebird \|\| cancelled` in `BreedingCodeList` | Breeding Codes cancel row |
| restore `!ebird \|\| cancelled` in `NamedBirds` | Named Birds cancel row |
| revert the shared constant to the old terse string | the copy-content test |
| Named Birds keeps the old literal (one surface only) | Named Birds copy row |
| List Comparer's catch keeps its own second spelling | the List Comparer catch row |
| drop `sr-wrap-anywhere` from the Statistics box | Statistics copy row |
| drop `sr-wrap-anywhere` from the Multimedia box | both Multimedia rows |
| drop `sr-wrap-anywhere` from List Comparer's alert | the List Comparer empty-read row |
| outer catch blames the backup again (the shipped-before behaviour) | the attribution row |
| the backup read/parse catch stops naming the backup | both backup-attribution rows |
| drop the inner `try` wholesale (narrowing reverted) | both backup-attribution rows |

Two details in the cancel-guard test that decide whether it is evidence at all:

- **The non-vacuity wait.** All four loaders already have an `if (cancelled)
  return` immediately after `getFilesStatus()`. Unless the first run is parked
  *on the observations load* when the rerender lands, it bails at that earlier
  guard and the test passes against the defect. The test waits for
  `loadEbirdObservations` to have been called once before it re-triggers.
- **Statistics re-runs on the files EPOCH, not on a `filesVersion` prop** (it has
  no such prop), so its row drives `notifyFilesChanged()` instead of a rerender.
  A roster row that quietly used the wrong trigger would never have re-run the
  effect at all.

The copy rows deliberately prove only *delivery* — they import the same constant
the components import, so they cannot fail if the string's content is wrong
(v0.5.88: a reference point derived from the thing being verified). The content
claim is pinned exactly once, against literals written in the test: it names
`MyEBirdData.csv`, it names `Settings → Default Files → eBird Backup`, it does not
claim the file is missing, and it carries no em dash.

### How to test

1. `cd frontend && npm run dev`, then open http://localhost:5173
2. Settings → Default Files → upload any non-eBird CSV as the eBird Backup.
3. Open Statistics, Calendar, Checklists, Breeding Codes, Named Birds, Species
   Detail, Map Explorer and Multimedia. Each one now names `MyEBirdData.csv` and
   the Settings path, in the terse error panel, with no step list.
4. List Comparer → Life Lists → upload any CSV as List B → Compare Lists. Same
   sentence, in the inline slot.
5. The absent case: clear the eBird file in Settings and revisit those tabs. They
   show the full step-by-step `SetupRequired` panel, not the error message.
6. Narrow the window to 320px and set Settings → Text Size to 200%. The message
   wraps and the panel stays inside its column. (There was never a sideways page
   scroll here; the shell's padding absorbed the overhang.)

`pipeline/honest-load-failures/how-to-see.md` is the plain-English version.

### Notes for reviewer

**Finding 1 was fixed at the CALL SITES, not inside `mlExportCache.ts` — deferred,
with a reason, not out of scope.** The bug brief's *Blast radius* explicitly
allows "the ML guard at the three call sites (or inside `mlExportCache.ts`)", so
the module was always a permitted target; an earlier draft of this file said
otherwise and was wrong. The call-site form matches the shipped precedent and its
comment at `Checklists.tsx:424-429` and leaves the helper's contract untouched.

The honest reason for deferring is **timing, not permission**: moving the `await
storage.readFile('ml')` inside `loadFresh`'s existing `try` changes a shared cache
seam for every present and future caller, and this is the **last build of a
three-build bundle** that is about to go to release prep. That is the wrong moment
to alter a seam four tabs read through, however small the diff.

The cost of deferring is real and worth stating: the hazard is now guarded in four
places, and a fifth caller reintroduces it. The module fix would make the defect
structurally impossible and align `loadMLExport` with its own docstring, which
already promises `null` on failure and does not deliver it. **Queued as a
follow-up for the next Improve run** rather than left as a horizon item.

**The eBird cache has the identical defect, and the follow-up covers BOTH.**
`observationsCache.ts:193` awaits `storage.readFile('ebird')` outside
`loadFresh`'s `try`, exactly as `mlExportCache.ts:23` does, so a read throw there
lands in each tab's outer catch and maps to `setup-required` -- the same lie this
build exists to stop, four lines above the docstring that spells the harm out. It
was measured, not reasoned: with both files reported stored, a read throw renders
"eBird Backup Required" plus the full steps panel on Statistics, Map Explorer and
Checklists, and the ML steps panel on Multimedia. Reachable on web and Pi only,
the same trigger as the ML half, and the eBird CSV is the larger file, so a
mid-body `res.text()` failure is likelier on this side than on the side that was
fixed. Out of the brief's scope and correctly not fixed here, but the queued
follow-up names both modules, because a note naming only the ML half would send
the next Improve run after half the hazard.

**List Comparer's broad `catch` was NARROWED, because the enumeration turned out
to be small.** Sharpening the copy made this slot say *"Re-upload MyEBirdData.csv
in Settings → Default Files → eBird Backup"* for **any** failure in
`handleCompare`, which is a more confident version of a mis-attribution it already
had. Rather than assume, I enumerated everything inside that `try`:

| Statement | Can it throw? | Is it about the backup? |
|---|---|---|
| `await storage.readFile('ebird')` | yes (IO) | **yes** |
| `parseEbirdCSV('My List', text)` | yes (`INVALID_EBIRD`) | **yes** |
| `setListALabel` / `setListBLabel` | no (React setState) | n/a |
| `compareSpecies(listA, fileB)` | no: pure Set/Array/Map work over two already-parsed `FileData` | no, it spans both lists |
| `fetchTaxonCodes(...)` | cannot reach this catch: unawaited, `async`, and wholly inside its own `try` | no |

So the eBird attribution now wraps exactly the two statements that are genuinely
about the backup, and the outer catch carries a message that names no file:
*"Something went wrong comparing these lists. Try again."*

**Stated precisely, because it would be easy to oversell:** the mis-attribution is
**not reachable today** — nothing below the read and parse can throw into that
catch. This is a guard on the CLAIM, not a live bug fix. Its value is that the
next statement added inside that `try` cannot silently inherit the backup's
message, which is exactly the failure mode this bundle exists to stop. The
attribution row proves it by making `compareSpecies` throw through a mocked seam,
and mutation-checking confirms reverting the narrowing turns it red.

Two limits worth recording. The generic string is one site, so it lives beside
`ListComparer` rather than in `setupCopy.tsx`. And one earlier note in this file
was wrong, corrected here rather than deleted: it claimed that in **upload** mode
the error slot does not render at all, so a failure there sets a message nobody
sees. Not so. In upload mode List A renders `<DropZone ... error={errorA} />`
(`ListComparer.tsx:295-299`) and `DropZone` renders the error in a
`role="alert" aria-live="assertive"` paragraph (`DropZone.tsx:130-133`), which is
that mode's normal error surface: `processFile` writes there for a non-CSV file,
an `INVALID_EBIRD` parse, and a `FileReader` failure. The `my-list`-gated slot at
`:310` is a different one. Nothing user-visible turns on this today, since the
outer catch is unreachable either way, and this build touches neither `DropZone`
nor the upload path. The real nearby quirk, worth recording instead: because
`isLoaded = file !== null && error === null` (`DropZone.tsx:35`), writing `errorA`
in upload mode replaces the loaded-file display, hiding the "N species found"
confirmation for a file that actually loaded fine. Pre-existing, unchanged, out of
scope here.

**Six of the eight error panels have no `role="alert"`.** Only Calendar and Map
Explorer do. The panel replaces the whole tab body after an async load with no
user action, which is the case an assertive live region exists for, so the six are
arguably wrong — but that is an accessibility change to six components and none of
the three findings, so it is flagged, not fixed. The copy tests assert the terse
panel by the absence of the steps list, which holds on all eight.

**`MapExplorer`'s lifers-sidebar generic hint and `LifeList.resolveMLCounties`'s
secondary eBird read stay out**, as build 1 decided. The latter is falsy-safe and
falls through to the Nominatim pass.

**Docs.** One sentence closing `docs/HELP.md`'s `### eBird backup` section, which
also closes build 1's outstanding HELP debt (it introduced a new visible error
state on Map Explorer and Multimedia with no HELP line). `docs/HELP.md:652` was
re-read and stays true as written. No `README.md` or `website/` change is owed —
neither describes tab error states. No em dashes anywhere in the new copy or the
HELP sentence; `grep -c '—' docs/HELP.md` is 0.

**Not in this change, per the bundle:** no version bump, no `CHANGELOG.md` entry.
Both ride the Spool bundle's release prep at the flush.

### Verification

| Gate | Result |
|---|---|
| `npm run build` (`tsc -b && vite build`) | **exit 0**, 628 ms. Only the pre-existing "chunks larger than 1100 kB" advisory. |
| `npm run lint` | **exit 0**, zero findings |
| `npx vitest run` | **exit 0** — **258 files / 4195 tests passed** (baseline 257 / 4164; +1 file, +31 tests, all this build's) |
| `backend/.venv/bin/python -m pytest tests/ -q` | **exit 0** — **311 passed**. Backend untouched (`git status --short backend/` empty). |
| Real-app browser measurement (QA) | box widths reproduce to the hundredth; panel overhang 23.28px/side at 320px + 200%, **zeroed by the fix**; page `scrollWidth` 320 throughout |

Run on a quiet machine with nothing else compiling, per `.claude/rules/testing.md`.

### Convention Flags

- **Fix a hazard where it is CREATED, not at each place it is consumed, unless
  the seam's contract genuinely differs per caller.** `loadMLExport` documents
  that it returns `null` on failure and does not: the read sits outside its own
  `try`. Four call sites now compensate for that, which is four chances for a
  fifth to forget. The rule that travels is the question to ask at the fix, not
  the answer taken here: *would this defect be structurally impossible if the
  producer honored its own docstring?* Where the answer is yes and no caller
  wants the current behavior — none of the four did — the producer is the cheaper
  and more durable place, and a call-site fix should say in the PR what it is
  trading away.

- **A hand-built static reproduction is evidence about ELEMENTS, never about the
  PAGE, because its ancestor chain above the component is the author's invention.**
  This build's probe reproduced every box width to the hundredth and then reported
  a 47px page-scroll leak that does not exist: the repro let the overhang
  propagate to `documentElement` where the real shell's padding absorbs it. The
  element numbers were right for the same reason the page number was wrong -- the
  DOM under the component was copied, the DOM above it was not. So: read
  element-vs-container numbers off a repro if you like, but any claim containing
  the words `scrollWidth`, "page", or "viewport" has to come from the real built
  app, and a repro that produces one should be treated as having produced a
  question rather than a finding. **The corollary is about framing, and it is the
  half that reaches users:** "47px of page scroll at 320px" reads as a WCAG 1.4.10
  Reflow failure and "a box 23.28px past its column, absorbed by the shell" reads
  as tidiness. Same fix, same diff, and only one of them is true. Establish
  whether a geometric defect is visible to the USER before writing the sentence
  that will outlive the build.

- **`overflow-wrap: break-word` and `overflow-wrap: anywhere` are not
  interchangeable, and the one that renders identically is the one that does not
  fix an unbreakable run inside a flex item.** `break-word` does not affect
  intrinsic sizing, so it cannot lower a flex item's automatic minimum; only
  `anywhere` can. CLAUDE.md's v0.5.85 note states this as a reason to *reject*
  `anywhere`; the converse case exists and this is it. Measure both, and where the
  container is externally bounded (so `anywhere` cannot collapse it below its own
  content minimum) reach for the house `.sr-wrap-anywhere` helper.

- **A test that imports the constant it is checking proves DELIVERY, never
  CONTENT.** Nine per-surface rows importing `EBIRD_BACKUP_LOAD_ERROR` stayed
  green through a mutation that reverted the constant to the old, wrong sentence —
  correctly, because that is not what they are for. Where a message is
  single-sourced, split the evidence explicitly: N delivery rows against the
  shared symbol, plus exactly one content test asserting the literal facts the
  copy must carry. Say which is which in the file, or the next reader will
  reasonably assume the rows cover both.

- **A guard against a stale-effect write is vacuous unless the test proves the
  stale run got PAST the earlier cancellation checks.** Every one of these four
  loaders already returns on `cancelled` right after `getFilesStatus()`, so a test
  that re-triggers before the first run reaches the observations load exercises
  the wrong guard entirely and passes against the defect. Park the first run on
  the await under test — assert the mocked loader has been called — then
  re-trigger. Same family as the harness-vacuity rules: the setup, not the
  assertion, is where this class of test goes wrong.

- **Sharpening a message sharpens whatever it is attached to, including the wrong
  attributions.** List Comparer's `catch` covered its whole handler and said
  "couldn't load your eBird backup" for anything that failed. That was vague and
  wrong; single-sourcing the better copy made it specific and wrong, which is
  worse, because a user acts on *"re-upload MyEBirdData.csv in Settings"* and
  merely re-reads *"something didn't load"*. **A copy improvement is therefore a
  reason to re-audit the scope of every `catch` that carries it**, and the audit
  is cheap: enumerate the statements inside the `try` and ask of each one whether
  it can throw AND whether the message would be true if it did. Here that was five
  lines and settled the question, including that the answer today is "nothing else
  can throw" — which is a reason to guard the claim structurally rather than a
  reason to skip it, because the enumeration is only true until someone adds a
  sixth line.

- **A roster of surfaces must carry each row's own re-trigger, not one assumed to
  be shared.** Statistics re-runs its load on the files epoch and has no
  `filesVersion` prop; the other three are prop-driven. A roster that rerendered
  all four with a new prop would have left Statistics' effect never re-running,
  and its row would have passed by never reaching the code it exists to test.
