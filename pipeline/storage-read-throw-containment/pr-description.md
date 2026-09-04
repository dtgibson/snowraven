## storage-read-throw-containment (Multimedia: a stored ML export that cannot become rows is a load failure)

### What this does

On the **Multimedia** tab, a stored Macaulay Library export that could not be turned into rows rendered as a
*successful* load: the tab reached `ready` with an empty media list, every photo and recording missing and nothing
on screen saying anything had failed. One route (a read that rejects) was already reported honestly; the other
three were not, and a fourth threw through to the outer catch and rendered "Macaulay Library Export Required" over
an export that is plainly stored.

All four now land on the one existing message, `ML_EXPORT_LOAD_ERROR`:

1. the read **rejects** (already guarded; web/Pi only, where `WebStorage.readFile` is a bare fetch)
2. the read resolves **falsy** (`null` from a non-ok web/Pi response or a desktop read error; `''` from a
   zero-byte file, which an interrupted `writeTextFile` leaves behind since `writeFile` has no temp-and-rename)
3. the stored file **is not an ML export** (`importFileContent` validates only the `.csv` extension, so
   `MyEBirdData.csv` uploaded into the ML Export slot stores without complaint)
4. `parseMLExport` throws **INVALID_ML_EXPORT** (no header row, or a header missing one of the three columns it
   requires by exact name: Catalog Number, Common Name, Format)

The absent case is untouched: with no export stored, `!status.ml` still shows the SetupRequired guidance panel.

**The queued fix was not applied, per the approved brief.** `await this.fs()` stays OUTSIDE
`TauriStorage.readFile`'s try (`frontend/src/lib/storage.ts`). Moving it in is behaviour-neutral in every case
reachable today and harmful in the one that is not: `fsModule` is memoized with `??=` and never reset, so a
rejection there is permanent for the session, and folding a permanent failure into a `null` return is the exact
"report a failure as no data" the 1.0.14 family removed. The 1.0.15 cache fix is not a precedent for it, because
that contained a *transient* per-call failure inside a layer that clears its memo. The line gained a comment
recording all of this and no behaviour change.

### Files

- `frontend/src/components/LifeList.tsx` — the fix
- `frontend/src/lib/storage.ts` — comment only, no behaviour change
- `frontend/src/components/honestLoadFailures.test.tsx` — Finding D: the four routes, the precedence, the absent case
- `frontend/src/components/TabLoadErrorAlert.test.tsx` — fixture repair (see "Notes for reviewer")
- `CHANGELOG.md` (existing 1.0.16 section), `docs/HELP.md`

### How to test

`pipeline/storage-read-throw-containment/how-to-see.md` has the click-by-click version. In short: with both files
saved, replace the ML export with `MyEBirdData.csv` (the slot accepts it) and open Multimedia. Before this change
the tab renders a species list with every media count at zero; after it, the tab says the export could not be
loaded and offers Go to Settings. Clearing the export still shows the setup instructions.

### Notes for reviewer

- **`mlReadFailed` is kept although `!mlText` now implies it.** The `.catch` returns `null`, so the flag is
  redundant on today's code. It is kept for the reason 1.0.15 kept all five ML `.catch(() => null)` guards: it
  names the reject route at the call site, so a later catch returning something truthy cannot quietly rejoin the
  ready path. The alternative (delete it and rely on the falsy check) reads as if the reject route did not exist.
- **Precedence: the four ML checks run BEFORE the eBird guard.** This extends the precedence the code already had
  rather than inventing one, since `mlReadFailed` was already checked ahead of the eBird guard. The alternative
  splits the four routes across that guard, so two of them would be pre-empted by a simultaneous eBird failure and
  two would not. Pinned by a test ("Multimedia blames the export, not the backup, when both fail at once"). Cost:
  when the eBird backup has also failed, `parseMLExport` has already run and its result is discarded. It is pure,
  writes no state, and this is an error path only.
- **`TabLoadErrorAlert.test.tsx` needed a fixture repair, and it is worth a look.** Its `storage.readFile` mock
  returned `'ML Catalog Number,Format\n1,Photo\n'` — an ML export with no Common Name column, so `parseMLExport`
  throws on it. That was invisible before, because the eBird guard returned first and the parse never ran. Under
  the new precedence the Multimedia row reported the ML message instead of the eBird one those tests are about.
  The fixture now carries the Common Name column and the comment says why it has to. Three tests, no assertion
  weakened. This is the only place in the suite where that was true; the full run is green.
- **The alert region is unchanged.** Multimedia's error phase already renders through `TabLoadErrorAlert` above the
  phase branch (v1.0.15), so the new routes deliver into a region that is already mounted and empty. No new copy
  string was added — `ML_EXPORT_LOAD_ERROR` is the one that already existed. `ACCESSIBILITY.md`'s eight-tab
  load-failure paragraph therefore stays true as written and was not edited; its claim is about the mechanism,
  which this change does not touch.
- **Docs.** `docs/HELP.md`'s ML export section gains the failure state, including the wrong-file route, which is
  the one a user can hit without any file surgery. The eBird section's parenthetical used to restate the ML case
  in one clause; it is now a pointer to that section instead, so there is one formulation rather than two that can
  drift. `README.md` describes Multimedia at feature level and needs no change; `website/` says nothing about
  load-failure behaviour and needs none. Version pill and footer are already at 1.0.16 from builds 1 and 2.
- **Out of scope, deliberately:** `TauriStorage.readMeta`'s blanket catch turns any failure to read
  `metadata.json` into `{ebird: null, ml: null}`, so every stored-file surface shows SetupRequired while both CSVs
  sit intact on disk. Same family, one layer down, at the chokepoint they all pass through. It needs a
  distinguishable "could not determine" signal plus a branch in every loader, which is its own build. Already
  captured; not touched here.

### Verification

- `npm run build` clean (the pre-push gate); `npx tsc --noEmit` clean; `eslint src --max-warnings=0` clean
- Full frontend suite: **269 files, 4386 tests, all passing**
- Mutation check: with `LifeList.tsx` reverted to the pre-fix shape, exactly the five new behavioural tests fail
  (the four routes plus the precedence row) and the absent case still passes. Restored and re-run green.
- No backend files changed, and this machine has no backend virtualenv, so `pytest` was not run. The diff touches
  no Python.
