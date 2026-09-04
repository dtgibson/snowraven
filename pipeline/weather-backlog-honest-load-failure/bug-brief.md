# Bug Brief — weather-backlog-honest-load-failure

## Decision: the defect is real, the diagnosis is right, and one word in it is wrong

The Weather Backlog does render the setup-shaped "Load your eBird backup first" over a stored-but-unreadable backup, and
`App.tsx`'s effect really is the one `loadEbirdObservations` caller that claims something about the user's backup without
first branching on `getFilesStatus()` — `DECISIONS.md:19` already recorded it by name as "exactly one", and a sweep of the
callers confirms it. But the collapse is **not structural**. `storage` is already imported at `App.tsx:7`, and `App.tsx:357`
already calls `getFilesStatus()` for the cold-start check; the effect simply never asks. This is not-yet-wired, not
information-unavailable, and the fix is one added await, a fourth state on one prop, and a decision about the live region.

## What is broken

`App.tsx:565-575` builds the backlog from `loadEbirdObservations()` alone and maps every falsy answer to
`setBacklogRows(null)` (`:571`), which `WeatherBacklog.tsx:445-451` renders as the `StateBlock` titled **"Load your eBird
backup first"** with a **Go to Import** button. Since v1.0.14 that promise resolves `null` for four different things — no file
stored, a read that failed, a read that came back empty, a parse that failed (`observationsCache.ts:174-184`) — so a birder
whose stored `MyEBirdData.csv` was truncated by an interrupted write, or whose Pi backend dropped mid-download, is told to
import a backup Settings plainly lists as saved. The `.catch` at `:573` maps to the same lie; it is defense in depth (that
promise structurally cannot reject) and belongs on the failure branch with everything else. Every other surface asks first:
`NamedBirds.tsx:62-70` is the reference shape — `getFilesStatus()`, then `!status.ebird` → guidance, falsy load → the shared
`EBIRD_BACKUP_LOAD_ERROR`.

## Steps to reproduce

1. Settings → Default Files: upload a valid `MyEBirdData.csv`. Open **Weather**, expand "List checklists with no weather
   blocks"; the backlog builds.
2. Quit the app. Truncate the stored backup to zero bytes, leaving `metadata.json` untouched — exactly what an interrupted
   write leaves behind, since `writeFile` is a direct `writeTextFile` with no temp-and-rename (`storage.ts:691`):
   `: > ~/Library/Application\ Support/com.snowraven/data/ebird-backup.csv`
3. Relaunch, open Weather, expand the backlog. Observed: "Load your eBird backup first" and Go to Import, over a backup
   Settings still lists as saved.
   Two variants needing no file surgery: store any non-eBird `.csv` in the **eBird Backup** slot — `importFileContent`
   validates only the extension (`Settings.tsx:1898-1901`) — so it saves and the parse fails; or, on web/Pi, stop the backend
   mid-load, where `WebStorage.readFile` is a bare `fetch` and an unreachable backend or a body cut short over a ~6 MB CSV is
   an ordinary event rather than an exotic one.

## Expected behavior

One property, on the Weather tab's backlog: **a stored eBird backup that cannot be turned into rows is reported as a load
failure, never as "you have no backup"** — carrying the family's one string, `EBIRD_BACKUP_LOAD_ERROR` (`setupCopy.tsx:44`),
so a tenth spelling cannot drift in. Both routes land there whenever `getFilesStatus()` says a backup is stored: a falsy
`loadEbirdObservations`, and a rejection. The absent case is untouched — `!status.ebird` still shows the existing StateBlock
and its Go to Import CTA, which is the right answer to it (the 2026-05-22 `setup-required`/`error` split, `DECISIONS.md:2996`).

## The item's count is unpublishable; the property is what to carry

Three rosters give three different numbers, so no count survives contact: nine sites carry `EBIRD_BACKUP_LOAD_ERROR` (the
eight tab loaders plus List Comparer's two branches, per `setupCopy.tsx:40`), eight carry `TabLoadErrorAlert`, and
`pipeline/tab-error-panel-alerts/change-brief.md` called this StateBlock "the possible ninth surface" of that second roster —
on the first roster it is the tenth. The checkable claim is the property: **this is the only `loadEbirdObservations` caller
that renders a claim about the backup without an upstream `getFilesStatus()` branch.** The others are the eight tab loaders;
List Comparer, gated by its own status read (`ListComparer.tsx:49-60`, which drops "My List" mode entirely when no backup is
stored, so its error branch is unreachable without one); `LifeList.resolveMLCounties`, gated at `:262` and silently degrading
to Nominatim; and `lib/hotspotSet.ts:101`, which returns an empty Set and tells the user nothing at all.

## Where this surface is genuinely shaped differently, and what follows

It is a **section**, not a tab: no `Phase` union, its state is a prop owned by `App.tsx`, and the panel is collapsed by
default and **unmounts on collapse** — no tab does that. Two consequences the Engineer must decide rather than inherit. The
prop `rows: ChecklistRowData[] | null | undefined` needs a fourth state and must stay ONE state machine; a second boolean
prop beside `rows` admits "error and ready at once". And the announcement guarantee `TabLoadErrorAlert` exists to provide —
the region already in the accessibility tree when the message lands (`DECISIONS.md` v0.5.83) — holds on the first-expand path,
where the panel always mounts at the loading state (`rows === undefined`), but **not on collapse-then-re-expand**, where
region and message mount together. The tab-error-panel-alerts decision kept this StateBlock role-less-of-`alert` because it
is *guidance*; that reasoning does not cover a new *error* state, so this is a live question, not a settled one.

## Blast radius

Narrow, by measurement rather than by impression: `backlogRows` has exactly one consumer (`App.tsx:1116` → `WeatherBacklog`)
and nothing else in `App.tsx` reads it, so no other tab shares this path. No entry-chunk cost — `storage`, `setupCopy` and
`ui/TabLoadErrorAlert` are already on `App.tsx`'s static graph through the statically-imported tabs. The added
`getFilesStatus()` costs one metadata read on the paths the effect already runs (first expand, and each `filesVersion` bump),
never on a Weather-tab paint: a chained `metadata.json` read on desktop, one `fetch('/settings/files')` on web/Pi. It adds an
async boundary, so the existing `alive` guard must also be checked after the status await; it needs **no** new loading state,
since `rows === undefined` already covers the whole effect. Not changing: `loadEbirdObservations`, the storage seam, the eight
tab loaders, List Comparer, and the `setup-required`/`error` split.

## Two things this does NOT close, stated rather than implied

`TauriStorage.readMeta`'s blanket catch (`storage.ts:632-639`) turns any unreadable `metadata.json` into
`{ebird: null, ml: null}`, so this surface — like the nine others — would still say "no backup" over an intact CSV. **It does
not undo this fix.** It leaves a residual exactly equal to the one every other surface already carries, while the common case
(metadata intact, CSV unreadable or unparseable) is fully repaired: today *every* failure here is the lie, afterwards only the
metadata-unreadable one is. Build 3 scoped it as its own build and that stands. The second is the collapse/re-expand
announcement gap above, which cannot be closed inside the card. The family is therefore **not closed** after this build.

## What done looks like

Expanding the backlog with a stored backup that will not load shows `EBIRD_BACKUP_LOAD_ERROR` and never the "Load your eBird
backup first" title; with no backup stored it still shows that title and its Go to Import CTA; a healthy backup still builds
the list. Guarded in `honestLoadFailures.test.tsx` — the right home precisely because it mocks `observationsCache` wholesale
and the claim under test is a CALLER's branching (`DECISIONS.md:17`). **No test in this repo renders `App.tsx`**, so asserting
only on the component's prop contract would leave the branch actually being fixed unguarded — symmetry in the code without
symmetry in the evidence. Lift the load decision into a small seam-injected function the test can drive directly and assert
both halves, with an absent case on each. `docs/HELP.md:119` ("If no backup is loaded, the section explains…") gains the
failure case. `README.md:11` and `website/index.html:185` were checked rather than assumed: each mentions the backlog in a
single clause about what it lists and neither describes this state, so both stay true unedited (`website/tools/capture-appstore.mjs`
expands the disclosure for screenshots and exercises only the healthy and absent states, which are unchanged). A `### Fixed`
bullet under the existing `## [1.0.16]`, no version bump (both manifests already read 1.0.16). `npm run build` green, not
vitest alone, on a machine with nothing else compiling.
