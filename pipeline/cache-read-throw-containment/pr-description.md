## cache-read-throw-containment

### What this does

Moves `await storage.readFile(...)` inside `loadFresh`'s existing `try` in both
shared parse caches — `frontend/src/lib/observationsCache.ts` and
`frontend/src/lib/mlExportCache.ts` — so a read rejection resolves `null` instead
of escaping to the caller. Both docstrings already promised exactly that and
delivered it for the parse only.

The consequence is what the fix is for. A thrown load lands in each tab loader's
outer `catch`, which sets `{ tag: 'setup-required' }` — the SetupRequired panel
telling the user to upload a backup that `getFilesStatus` has just reported as
stored. Eight eBird tabs (Statistics, Calendar, Checklists, Breeding Codes, Named
Birds, Species Detail, Map Explorer, and Multimedia's backup half) now take the
honest falsy branch they already had and land on `error` with
`EBIRD_BACKUP_LOAD_ERROR`, which names `MyEBirdData.csv` and the Settings path.
That is the exact lie 1.0.14's honest-load-failures build removed everywhere else;
this closes the one path it left.

Reachable on web/Pi, where `WebStorage.readFile` is a bare `fetch` + `res.text()`:
the fetch rejects when the backend is unreachable, and `res.text()` rejects on a
body truncated mid-download, which is an ordinary Wi-Fi event over a ~6 MB CSV
served off a Pi. `TauriStorage.readFile` already wraps its IO in its own try and
returns null, so Mac, Windows, iPhone and iPad were unaffected.

### This EXECUTES a deferral; it does not reverse one

`DECISIONS.md` line 29 (v1.0.14) recorded this by name, both modules, and stated
the reason was **timing** — a shared seam four tabs read through, on the last build
of a three-build bundle about to enter release prep — **not permission or scope**.
The 2026-05-22 `setup-required` vs `error` split (`PRODUCT_CONTEXT.md:1847`) is
upheld, not weakened: `error` stays a distinct phase with distinct copy, and every
test row asserts the SetupRequired step list is ABSENT, with an absent case proving
a genuinely unconfigured user still gets the full guidance panel.

`DECISIONS.md` line 1421 / v0.5.52 is untouched. Life List deliberately reads the
ML file itself (`LifeList.tsx:437`) rather than through `loadMLExport`, because
swallow-to-null would be a different lie there — it needs `mlReadFailed` to say
"your export would not load" instead of silently showing a shorter list. Nothing
here routes it through the cache, and it was not tidied in passing.

### Why collapsing the throw to null loses nothing

No caller uses the throw to separate "no file" from "unreadable file", and the
architecture is why: every tab calls `storage.getFilesStatus()` FIRST and branches
on `status.ebird` / `status.ml` before the cache is reached, so "no file at all" is
already decided upstream and a falsy return already means "stored but unloadable".
The two callers that skip `getFilesStatus` already collapse both cases identically
(`lib/hotspotSet.ts:101` returns an empty Set on falsy while `useHotspotSet.ts:24`
catches the throw to the same empty Set; `App.tsx:568` sets `backlogRows` null on
both), so behavior there is unchanged.

### The five caller guards stay

`BirdingStats.tsx:182`, `MapExplorer.tsx:683`, `Checklists.tsx:429`,
`SpeciesDetail.tsx:209` and `NamedBirds.tsx`'s inner try/catch keep their
`.catch(() => null)`. They now have nothing left to catch, and they are kept
anyway because the cost of being wrong is asymmetric: a rejection there rejects the
whole `Promise.all` into the outer catch and claims there is no eBird backup while
one is plainly loaded. Removing them is a second behavior surface and belongs in a
different change. Their comments are RETARGETED rather than deleted — each said the
read "sits outside its try", which is now false, and a comment that misdescribes
its own guard is worse than no comment.

### The memoized-promise hazard: checked, and there is no equivalent trap

`DECISIONS.md` v1.0.14 records that a memoized promise inherits its producer's
worst settle path — a pending promise sat in `inflight`, whose `.finally` therefore
never ran, so every later caller for the session joined a dead promise.

Both caches memoize `loadFresh` the same way
(`inflight = loadFresh(generation).finally(() => { inflight = null })`), so the
question is live. It does not apply here, and the distinction is between a promise
that never settles and one that settles badly: `.finally` runs on rejection as well
as fulfilment, so even BEFORE this fix a read rejection cleared `inflight` — it
poisoned the caller, never the session. After the fix there is no rejection at all.
Both properties are asserted rather than argued: one row proves the next call
re-reads and the later good parse is cached, and one proves three concurrent
first-callers sharing the one memoized promise all receive `null` from a single
read (that shared promise is precisely why a rejection reached every mounted tab at
once).

### The adjacent finding: LEFT, and flagged

`TauriStorage.readFile` (`frontend/src/lib/storage.ts:645`) has the same defect
shape in miniature — `const { readTextFile, exists, BaseDirectory } = await this.fs()`
sits one line ABOVE the try that returns null for every IO failure, so a failed
dynamic import of `@tauri-apps/plugin-fs` still throws.

It was excluded, against the standing instruction to include it only if it is a
one-line move needing **no new reasoning**. It needs its own thought, on two counts:

1. `this.fs()` memoizes the module promise (`this.fsModule ??= import(...)`), so a
   single failed import stays rejected for the session. Moving the await inside the
   try converts a loud permanent failure into a silent permanent "no file", across
   the desktop read path — a judgment about failure signalling, not a code move.
2. `LifeList.tsx:437` deliberately distinguishes a read THROW from a null
   (`mlReadFailed`) under the protected v0.5.52 decision. Establishing that the
   change is harmless there requires reasoning about a second module's deliberate
   error distinction — which is exactly the kind of thought the instruction says
   disqualifies it from riding along.

The conclusion of that reasoning is probably "harmless" (`readMeta` already
swallows a failed `fs()` into `{ebird: null, ml: null}`, so `getFilesStatus`
short-circuits every tab upstream before a read is attempted). But "probably
harmless after analysis" is not "no new reasoning", and the desktop path is not
where this bug lives. Flagged for its own change.

### How to test

Full walkthrough in `pipeline/cache-read-throw-containment/how-to-see.md`. In
short: run backend + frontend, save an eBird backup, then block exactly
`*/settings/files/ebird` in DevTools (a DIFFERENT URL from `/settings/files`, so
file status still resolves "a backup is stored" while only the CSV read fails) and
open any observations tab. Before: "eBird Backup Required" plus the Download My
Data step list. After: the terse panel naming `MyEBirdData.csv` and
Settings → Default Files → eBird Backup, with a Go to Settings button.

### Tests

Two new files, split by what each can actually see.

`frontend/src/lib/cacheReadThrowContainment.test.ts` — the SEAM, at module level,
both caches from one roster (a third cache of this shape reads as a missing row).
Twelve rows: a rejecting read resolves null (both at connect and mid-body, the
truncated-download case a large CSV off a Pi actually hits); the failure is not
cached and `inflight` clears so the next call re-reads and the later good parse IS
cached; concurrent first-callers all get null from one read; and the absent and
healthy cases still work.

`frontend/src/components/cacheReadThrowTabs.test.tsx` — the TAB-LEVEL consequence,
and the reason it is a separate file: `honestLoadFailures.test.tsx` mocks
`../lib/observationsCache` wholesale, so it proves the caller guards and
structurally CANNOT see what the cache module does with a failing read. Here the
cache is real and only `storage` is mocked, so the rejection starts where it starts
in production and travels the real seam into the tab. Breeding Codes and Calendar,
each asserting the honest message present AND both halves of the lie absent (the
step list and the "eBird Backup Required" title), each with a no-file-stored row
proving the split holds and a healthy-read row proving the tab still renders. Two
of the eight is a sample, not a roster, and the file says so:
`honestLoadFailures.test.tsx` owns the full eight-surface roster for the falsy
branch these now reach.

**Mutation-checked.** With the read moved back above the try in both modules, 10 of
the 18 rows go red — every claim-carrying row, in both files — and only the four
absent-case rows stay green, which is correct: they describe behavior the fix does
not change. `honestLoadFailures.test.tsx` passes unchanged.

### Verification

`npm run typecheck`, `npm run build`, `npx eslint .` all clean. Full frontend
suite: 265 files, 4,319 tests, all passing. Backend: 311 passing.

### Version and docs

No version bump. Build 2 of this Spool bundle already moved `frontend/package.json`,
`src-tauri/tauri.conf.json` and the website pill to **1.0.15**; verified before
deciding, and this adds an entry to the existing 1.0.15 `CHANGELOG.md` section
rather than opening a new one.

**No docs change, and the reason is that the docs already describe this
behavior.** `docs/HELP.md:68` reads: "If a tab says it couldn't load your eBird
backup, the file is still stored but SnowRaven could not read it, so re-upload
`MyEBirdData.csv` in Settings under Default Files." That sentence was written for
1.0.14 and was true of a file that loaded but could not be parsed — and false of
the case it most literally names, a file that could not be READ. This fix closes
the gap between the published statement and the code rather than requiring a new
one. `README.md` and `website/` describe features, not per-tab failure copy, and
neither mentions the setup-required panel; `PRIVACY_POLICY.md` and
`ACCESSIBILITY.md` are unaffected (nothing about what is stored, sent, or how any
surface is operated changes). User-visible behavior DOES change on eight web/Pi
tabs, which is why it earns a changelog entry; it does not change any statement
those four documents make.

### Notes for reviewer

- The eBird `loadFresh` needed `let text: string` hoisted above the try so
  `firstLine(text)` can still run after it. TypeScript's control-flow analysis
  accepts the definite assignment because the catch returns, so only normal
  completion of the try reaches the line below; `npm run build` is the gate that
  confirms it.
- The catch in `observationsCache` now covers the read AND the parse, and its
  comment says so. The result construction and the `myGen === generation` cache
  write stay OUTSIDE it deliberately — widening the catch to cover a cache
  assignment would silently swallow a different class of failure.
- Scope held to the fix: no caller guard removed, no LifeList reroute, no
  `TauriStorage` change.
