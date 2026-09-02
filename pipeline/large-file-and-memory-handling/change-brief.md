# Change Brief — Large-File and Memory Handling

## What is changing

Three contained, user-invisible changes, each measured before being scoped in.
(1) The eBird observation parser stops materializing a full `string[][]` grid of
every cell before building entries, and streams row-by-row instead.
(2) `observationsCache` stops retaining the entire raw CSV text for the whole
session when its one consumer needs only a first-line boolean.
(3) `lib/networkCache.ts` — the single unbounded cache in the repo — gains the
FIFO cap every other durable cache already has, and joins the inventory guard
that would have caught it.

Nothing about how the app looks, reads, or behaves changes. The parse output is
byte-identical on the user's own export (verified, below).

## Why now

The saved idea asked for two things: large eBird backups handled without
crashing, and memory that does not accumulate across tab views. Both were
measured against the real code rather than assumed, and each turned out to have
one dominant, fixable cause plus a lot that is already correct.

## Measured findings (the evidence this scope rests on)

**Large files.** `parseEbirdObservations.ts` calls `parseCSV(content)`, which
returns every cell as a separate string in one `string[][]`, and holds it for
the whole entry-building loop — so source string, full grid, and entry array are
alive simultaneously. Because fields are accumulated character-by-character
(`field += ch`, `parseEbirdObservations.ts:44`), each cell is built as a
cons-string rope (~32 bytes per node) and pushed into the grid unflattened; the
ropes only collapse later, when the entry loop calls `.trim()`. So the peak lands
exactly when `parseCSV` returns, and it is dominated by rope nodes rather than
character data. Measured on the user's **real 6.6 MB / 21,369-row export**:
13.2 MB source string, 20.6 MB entries, and **126 MB of transient grid** — 19x
the file size, about 6.2 KB per record. At 100k rows the grid is 340 MB; at 500k
rows, 1,700 MB (peak 2.2 GB). A comment-heavy export is worse still, because
`Checklist Comments` is re-allocated per observation row rather than per
checklist (455 distinct values across 21,856 rows in the repo's own backup).

The only size guard in the system is `backend/routers/settings.py:19,41-44`
(50 MB, bounded read, HTTP 413) and it protects the **web/Pi path only**. The
desktop (`TauriStorage.writeFile`) and iOS (`lib/iosImport.ts`) paths have no
cap, no row check and no warning, so the guard is absent on exactly the two
platforms where a serious lister's export actually lands.

The first failure is the grid, not V8's string limit, not the render. Run at
capped heaps, the current parser **crashes with "JS heap out of memory" at
700 MB, 1 GB and 1.5 GB ceilings** on a 500k-row export; a streaming variant
completes at all three. The parse runs in a Web Worker
(`observationsWorker.ts`), so this OOM happens on the worker heap — which is
also why it is invisible until it kills the load.

**Retained text.** `observationsCache.ts:57` caches `{ text, observations }` at
module scope for the session. `ebird.text` has exactly one consumer,
`BreedingCodeList.tsx:170`, and `deriveBreedingData` uses it only for
`hasBreedingCodeColumn(content)`, which reads the **first line**
(`parseBreedingCodes.ts:109-115`). 13.2 MB is held all session to answer a
boolean; 116 MB at 500k rows.

**Memory across tabs.** The user's perception is correct, but the dominant cause
is deliberate and stays: tabs mount on first open and never unmount
(`display: none` + an additive `mountedTabs` Set), so each visited tab adds a
permanent tier. That plateaus after all 11 tabs — a step function, not unbounded
growth. The one genuinely unbounded thing is `networkCache.ts`: a module-scope
`Map` with expire-on-read only, no cap, no sweep, keyed by lat/lng rounded to
5 decimals (~1 m), so every distinct map search center adds a permanent entry
holding a full eBird payload. It has two entry points (`transport.ts:264` and
the desktop raw path `tauri/mapService.ts:152`) and is the **only** cache absent
from `cacheInventory.test.ts`. Its header comment claims it "mirrors the
established cache idiom", but that idiom is single-slot; this is a growing Map.

Everything else audited is clean: observers, listeners, timers, subscriptions,
and MapLibre disposal are all correctly torn down, and the other six durable
caches have real, verified caps on every write path.

## User-facing impact

None. No surface, copy, control, or output changes. The parse produces identical
entries; the caches serve identical answers within their windows.

## Design pass

**Not needed — no visual change.** All three changes are invisible by
construction. The only candidates that would have needed a design pass are a
long-import progress indicator and an oversized-file warning, and both are
deliberately excluded (see below) precisely because they are new user-facing
affordances, not optimizations.

## What is NOT changing (deliberate exclusions)

- **The never-unmount tab architecture.** Recorded three times as intentional
  (DECISIONS.md:3326, 2243; PRODUCT_CONTEXT.md:1687-1691) and load-bearing: the
  cross-tab species handoff depends on tabs staying mounted (DECISIONS.md:2871).
  Unmounting would lose state on tab switch — a user-visible behavior change and
  a decision reversal well outside this run.
- **Any new UI**: import progress, oversized-file warning, new error state. New
  affordances, New Feature territory. Excluded on purpose.
- **Converging `parseEbird` with `parseEbirdObservations`**, and routing
  `ChecklistComparer`/`ListComparer` (which each do their own full read + parse)
  through the shared cache. DECISIONS.md:451 measured and rejected parser
  convergence as silent data loss. Noted, untouched.
- **Slice-based field extraction** instead of `field += ch`. Measured a further
  large win in V8, but it works by sharing the parent buffer — engine-specific
  accounting that need not hold in JavaScriptCore (the real desktop/iOS
  runtime), and `.claude/rules/testing.md` warns that byte figures encode one
  engine's heap. The app ships on three engines with three different accountings
  (V8 without pointer compression, WebView2's V8 with it at ~0.7x, and JSC),
  so this is unprovable across the fleet. Excluded.
- **The Worker structured-clone doubling** (text cloned in, entries cloned out).
  Real, but fixing it is a transferable-protocol redesign. The grid fix already
  removes the dominant term from the worker heap, where the OOM happens.
- **The unvirtualized "Show all N checklists" render** (`Checklists.tsx:490`,
  `:770`), which drops the `PAGE = 10` slice and renders every row. There is no
  virtualization anywhere in the app (no `react-window`/`react-virtual`), and
  every other long list is capped, so this is the one unbounded render. Fixing
  it means a new dependency or a windowing implementation plus visible list
  behavior — its own run, with a design pass.
- **The worker's missing timeout and reject path** (`observationsCache.ts:26-36`)
  — a real bug, not an improvement; see the hand-back flags. Excluded here so a
  memory change and a control-flow repair are not verified as one thing.
- `speciesCodeMap` and `useHotspotActivity.answers`: structurally uncapped but
  bounded by real data (~11k taxonomy; hotspots actually searched). Below bar.
- The Weather backlog builds a second full `ChecklistRowData[]` at app scope
  (`App.tsx:568-571`), independent of the Checklists tab's. Noted, not scoped.
- **No version bump and no CHANGELOG entry** — this run is one of two builds in
  a bundled release that ships as a single version, handled centrally.

## Decisions touched

- **DECISIONS.md:451 (v0.5.85)** — parsers were EXTRACTED, not converged, and
  "relocation was proved, not reasoned about". Binds change 1: the streaming
  rewrite must ship with a differential oracle, and forbids the convergence
  excluded above.
- **DECISIONS.md:409 (v0.5.86)** — capacity+1 is a measurement rule, not one
  policy; FIFO where an eviction costs a redundant request, admission control
  where it destroys a paid-for answer. Governs change 3 as FIFO.
- **DECISIONS.md:469 (v0.5.85)** — the memo bound as admission control. The
  precedent for change 3's measurement method, not for its policy.
- **PRODUCT_CONTEXT.md:564 (v0.5.16 performance sweep)** — established
  parse-once plus the worker. Changes 1 and 2 extend it; do not undo it.
- **DECISIONS.md:3326 / 2243 / 2871** — the tab architecture. Explicitly NOT
  touched; named as why the largest apparent accumulation is left alone.

## What done looks like

1. The streaming parser is proved byte-identical to today's, by a differential
   oracle over the real export plus malformed probes (the DECISIONS.md:451
   standard), and the existing 46 parser tests still pass.
2. A 500k-row export parses to completion under a heap ceiling that makes the
   current parser OOM, and no full-file grid is ever materialized — asserted
   STRUCTURALLY (at most one row array live at a time), never as elapsed time or
   a byte product, per `.claude/rules/testing.md`.
3. `networkCache` holds at most its cap, proven at **capacity+1** asserting work
   done, and `cacheInventory.test.ts` enumerates it so it cannot drift back.
4. `observationsCache` retains no full-file string; the Breeding Codes tab still
   shows exactly what it shows today.
