## species-picker-options-memo

### What this does

`SpeciesCombobox` filters and builds its rows in two `useMemo`s keyed on the
`options` array it is handed. `useMemo` compares with `Object.is` and `.map()`
returns a new array every call, so a call site building `options` inline misses
**both** memos on **every** parent render — certain, not probabilistic. Three of
the four shipped call sites did this; the fix is one hook each.

| Site | Fix |
|---|---|
| `Calendar.tsx` | `useMemo` on `[speciesOptions]` |
| `SpeciesDetail.tsx` | `useMemo` on `[displaySpeciesList, sciNameMap]` |
| `BirdingStats.tsx` | `useCallback` on `[sciByNorm]` for `sciFor` |
| `MapExplorer.tsx` | none — already correct, now a roster row |

The third was not on the roadmap and is a level up from the other two: `sciFor`
was a plain body function, so it took a fresh identity per render and defeated
`WeatherStatsSection`'s **own** `speciesOptions` memo before the combobox ever
saw an array.

No user-visible change. No DOM, CSS, copy, ARIA, keyboard path or persisted
value moves; the rendered output is identical at every site. The only observable
difference is less work per keystroke on a long list.

### How to test

1. `cd backend && .venv/bin/uvicorn main:app --reload --port 1620`
2. `cd frontend && npm run dev`, then open `http://localhost:5173`
3. Use the species picker on **Calendar**, **Species Detail**, **Statistics →
   Weather**, and **Map Explorer → Filters**. Each should type-to-filter and hold
   its selection exactly as before.
4. On **Species Detail**, type into "Filter comments" and confirm the picker does
   not flicker or lose its selection.
5. On **Species Detail** toggle **Show all forms**, and on **Statistics →
   Weather** toggle **Count all forms**. Both lists must really grow and shrink.
6. On **Statistics → Weather**, type a **scientific** name (e.g. `Cyanocitta`)
   and confirm it still matches — the path a frozen `sciFor` would silently break.
7. In **Settings**, re-upload your eBird backup, then return to **Calendar**: the
   species picker must pick up the new file's species.

`pipeline/species-picker-options-memo/how-to-see.md` is the same walkthrough in
plain English.

### Notes for reviewer

**The guard counts work done, never elapsed time.**
`frontend/src/components/speciesComboboxOptionsIdentity.test.tsx` is one roster
over all four call sites, **14 rows**: a source-derived roster with cardinality
(so a **fifth** call site arrives as a missing row), one behavioural row per site
with its own in-app re-trigger, and **a staleness row at each of the three fixed
sites, each naming the defect it catches**.

**The code was correct from the first round and never changed.** Two QA rounds
found guard-coverage gaps, both now closed, and they are the interesting part of
this PR.

**Round 1 — the staleness mutation had been applied at one site in three.** At
the other two it was unguarded where it mattered:

| Staleness mutation | Guard rows red (12-row guard) | Pre-existing tests red (of 141) |
|---|---|---|
| Species Detail frozen `[]` | 3 | 10 |
| Calendar frozen `[]` | 1 | 5 |
| **`sciFor` frozen `[]`** | **0** | **0** |

**Round 2 — Calendar's remaining coverage was incidental, and one mutation
settled it.** Freezing Calendar's memo **and** relaxing B1's non-vacuity
assertion to `toBeGreaterThanOrEqual(0)` turned the whole guard **green over a
permanently empty, permanently stale picker**. The coverage was a single line
documented as checking something else, the identity row stays green under a
frozen memo, and Part C's stated reason for not driving Calendar ("nothing short
of a new file moves them") was simply false — a `filesVersion` bump is the app's
own reload path at `Calendar.tsx:819`. That sentence is corrected in place.

Re-measured at 14 rows, each mutation alone, all four files restored
byte-identical by sha256:

| Mutation | Red of 14 |
|---|---|
| Baseline | 14/14 green |
| Calendar frozen `[]` | 2 — incidental line + **named row** |
| Species Detail frozen `[]` | 3 — both B2 rows + part C |
| `sciFor` frozen `[]` | 1 — **named B4 row** |
| **M8: Calendar frozen AND non-vacuity relaxed** | **1 — named row only** (was 0) |
| Restored | 14/14 green |

Three further things worth attention:

1. **The `sciFor` mutation leaves the structural scan green.** `BirdingStats` is
   not a JSX call site, so a source scan structurally cannot see it; only the
   composed-seam row catches it — which is exactly where the round-1 gap hid.
2. **Dropping `sciNameMap` from the deps turns nothing red**, recorded as a
   finding. That map and `sortedSpeciesList` come from one memo, so neither moves
   without the other. It is a superset whose only effect is an extra rebuild,
   never staleness, and the comment says so at the definition site. An earlier
   draft overclaimed and was corrected at source.
3. **A defect was found in the guard, not the code.** Part A's first version
   scanned `options={...}` at file scope and matched the Calendar's `SegControl`.
   Now scoped to `<SpeciesCombobox …>` tags via a brace-depth walk, swept across
   18 formattings; every mishandled shape fails loudly.

**`.sr-combobox-list` scroll anchoring is checked and deliberately untouched** —
no focus or `aria-activedescendant` behaviour, no CSS change, and `rows` rebuilds
strictly reduced, so it moves away from that decision's reversal condition.

**Ride-along:** `entryChunk.test.ts:450` claimed "only three importers." There are
four. The assertion was correct throughout; only the comment changed.

### For the Chronicler

- **The ROADMAP entry is wrong on its count.** It names two sites
  (`Calendar.tsx:1008`, `SpeciesDetail.tsx:742`); there are **three** — the third
  is `BirdingStats.tsx:426`'s `sciFor`, feeding `WeatherStatsSection.tsx:245`.
  Complete, and should be **retired** with the count corrected in the same edit.
  `ROADMAP.md` was deliberately not edited by this build.
- **Changelog line this build contributes** (the bundle takes one four-file bump
  at the end; no version file was touched here):

  `- Species pickers on Calendar, Species Detail and Statistics no longer rebuild their whole list every time something unrelated on the page changes.`

- **Convention — a mutation table is read as a coverage claim over the whole
  change, so apply the red-first mutation at every fixed site, not at the one
  with the most convenient harness.** Per-site behavioural rows made this build's
  coverage *look* symmetric while the mutation that tests the dangerous direction
  ran at one site in three; the unguarded site had no pre-existing coverage at
  all.
- **Convention — it is not enough that a mutation goes red; it must go red on a
  row that NAMES the defect.** A site whose coverage comes from another
  assertion's side effect is one refactor from uncovered, and nothing will say
  so. The worked example is in this build: same frozen Calendar memo, one
  unrelated line apart, **1 red with a named row against 0 red without one**.
  Two instances in a single build.
- **Convention — a value that is a memo INPUT one level down owes the same
  stability as one compared directly.** `sciFor` read as an ordinary helper and
  was load-bearing three components away; it is why the roadmap undercounted this
  item, and why the round-1 gap hid at that exact site.

### Verification

`npm run typecheck` exit 0 · `npm run build` exit 0 · `npx eslint .` exit 0 ·
237/237 across 13 scoped suites · 14/14 on the roster, proved red-first at all
three fixed sites and under M8. The full frontend suite is deliberately not run
here; the bundle gets one full run at release.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
