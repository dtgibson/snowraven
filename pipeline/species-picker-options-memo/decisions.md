# Decisions — species-picker-options-memo

## What shipped

Three hooks, at the three call sites that handed `SpeciesCombobox` a fresh
`options` array on every parent render. `MapExplorer.tsx:2052` was already
memoized on stable deps and was **not** touched; it became a roster row.

| Site | Before | After |
|---|---|---|
| `Calendar.tsx` | `options={speciesOptions.map(name => ({ name }))}` | `speciesComboOptions`, `useMemo` on `[speciesOptions]` |
| `SpeciesDetail.tsx` | `options={displaySpeciesList.map(...)}` | `speciesComboOptions`, `useMemo` on `[displaySpeciesList, sciNameMap]` |
| `BirdingStats.tsx` | `sciFor` a plain body function | `useCallback` on `[sciByNorm]` |
| `MapExplorer.tsx` | already memoized | unchanged |

The third is a level up from the other two and is why the roadmap's count was
wrong. `sciFor` is a **memo input one level down**: `WeatherStatsSection` lists
it in the deps of its own `speciesOptions` memo, so a fresh identity per render
defeated that memo before the combobox ever saw an array.

The hooks were correct from the first round and never changed. Both QA rounds
found **guard-coverage gaps**, not code defects, and both are closed.

## The risk that governed the design

Memoizing with wrong dependencies converts a wasteful rebuild into a **stale
list**. Today's behaviour is only wasteful; a stale options list shows the user
the wrong species. Every identity row rewards a memo for *not* rebuilding, so a
memo that never rebuilds at all would pass all of them. That inversion is the
thing the staleness rows exist to prevent — and it took two rounds to apply that
principle at every site.

## Guards: work done, never elapsed time

`frontend/src/components/speciesComboboxOptionsIdentity.test.tsx`, **14 rows**.
It deliberately does not extend `speciesUtilsMemoBound`'s timing shape: a
re-render that adds exactly zero predicate calls is a reference the hardware
cannot move.

- **Part A — roster derived from the tree, with cardinality.** Asserts the call
  sites equal the four known ones, that `sites.length === 4`, and that none
  builds its options inline. QA drove a real fifth, correctly-memoized call site:
  the row failed with an exact diff naming the file.
- **Part B — one behavioural row per site, each with its own in-app re-trigger.**
  Identity survives the re-render; with a query typed it adds **zero**
  `matchesSpeciesQuery` calls, each leg first asserting typing cost more than
  zero.
- **Staleness rows, one per FIXED site, each naming the defect it catches:**
  Calendar (B1, a new export via `filesVersion`), Statistics (B4, `sciFor` still
  resolving a scientific name), Species Detail (Part C, "Show all forms").

## The convention this build established, in two instances

**Round 1 — a mutation table is read as a coverage claim over the whole change,
so the red-first mutation is applied at every fixed site.** The first version
applied the staleness mutation at Species Detail only. Applied at all three, the
one that mattered was unguarded: `sciFor` frozen on `[]` turned **0 of 12** guard
rows red and **0 of 141** pre-existing tests red. It captures the first render's
empty `sciByNorm`, so every option's `sciName` is `undefined` for the session and
the Weather picker silently stops matching on scientific name. Option *names* are
unaffected, which is exactly why every name-based row stayed green.

**Round 2 — it is not enough that a mutation goes red; it must go red on a row
that NAMES the defect.** Calendar had no staleness row. Its frozen memo did go
red, but only through the `typing > 0` non-vacuity assertion — a frozen list is
empty, so typing costs zero matches. QA settled it with one mutation rather than
on taste: freezing the memo **and** relaxing that single assertion to
`toBeGreaterThanOrEqual(0)` turned the entire guard **green over a permanently
empty, permanently stale picker**.

Three things make that decisive:

1. **The coverage was one line whose documented job is something else.** It fails
   with `expected 0 to be greater than 0`, on an assertion commented "non-vacuity:
   the predicate really ran." Anyone tidying it gets no signal they are deleting
   staleness coverage — the round-1 failure shape exactly: coverage by side
   effect, invisible to whoever removes it.
2. **The identity row stays green under a frozen memo**, because a frozen memo
   trivially keeps one identity. That is verbatim the inversion the guard's own
   header says the staleness rows exist to prevent.
3. **The stated reason not to drive Calendar was false.** Part C claimed its list
   is "a function of the loaded export alone, so nothing short of a new file moves
   them." A new file **is** drivable: the mocked loader plus a `filesVersion` bump
   is the app's real reload path (`Calendar.tsx:819`), what Settings does after an
   upload. Left standing, that sentence told the next reader not to bother. It is
   corrected in place, naming what was wrong rather than quietly rewritten.

## Red-first verification (re-measured at 14 rows, not accepted)

Each mutation applied alone; all four tracked files restored and verified
byte-identical by sha256.

| Mutation | Red of 14 | Which rows |
|---|---|---|
| Baseline (correct code) | 0 | 14/14 green |
| Calendar memo frozen `[]` | 2 | B1 match-calls (incidental) + **B1 named staleness row** |
| Species Detail memo frozen `[]` | 3 | both B2 rows + Part C |
| `sciFor` frozen `[]` | 1 | **B4 named staleness row** |
| **M8 — Calendar frozen `[]` AND B1 non-vacuity relaxed** | **1** | **B1 named row only** |
| Restored | 0 | 14/14 green, all four files byte-identical |

**M8 is the leg that matters.** The same scenario left the 13-row guard fully
green; the named row survives it. Staleness now goes red at all three fixed sites
on a row that names the defect, and no site's coverage depends on another
assertion's side effect.

Map Explorer has no staleness row, which is a **scope** statement rather than a
claim about what is drivable: it is the site this build did not change.

## Earlier mutation results (reproduced exactly by QA, both rounds)

| Mutation | Red | Which rows |
|---|---|---|
| M1 Calendar: restore the inline `.map` | 3 | Part A + both B1 rows |
| M2 Species Detail: restore the inline `.map` | 3 | Part A + both B2 rows |
| M3 Statistics: `sciFor` back to a plain function | 2 | both original B4 rows |
| M5 Species Detail: drop `sciNameMap` from the deps | **0** | — |

**M3 leaves Part A green, and that is the point.** `BirdingStats` is not a JSX
call site, so the structural scan structurally cannot see it; only the
composed-seam behavioural row catches it. That is also precisely where the
round-1 staleness gap hid.

## M5 is a finding about the code, recorded rather than explained away

Dropping `sciNameMap` from Species Detail's deps turns **nothing** red.
`sciNameMap` and `sortedSpeciesList` are returned by the **same** memo (keyed on
`phase`, `taxonOrders`, `mergeSubspecies`), and `displaySpeciesList` derives from
`sortedSpeciesList`, so nothing can rebuild the map without also rebuilding the
list the first dependency already tracks.

The dependency is a **correctness statement, not an independently observable
one** — a superset whose only possible effect is an extra rebuild, never
staleness. It stays because removing it would bank on an invariant enforced in a
different memo twenty lines away. An earlier draft of the comment claimed
dropping it "would leave the options stale against a rebuilt map"; unsupported by
measurement, corrected at source. QA verified the reasoning structurally and
empirically and requested no change.

## A defect found in the guard, not the code

Part A's first version scanned `options={...}` at **file** scope and matched the
Calendar's `SegControl`, reporting the wrong element's prop. Fixed by scoping to
`<SpeciesCombobox …>` tags via a brace-depth walk. QA swept 18 call-site
formattings: 8 handled, 4 correctly rejected, 3 edge cases all failing **loudly**.
Part A's non-vacuity row is load-bearing for one of them (a generic type
argument), which is not obvious from that row's name.

## Decisions touched, and not touched

- **The `.sr-combobox-list` WebKit scroll-anchoring decision** (2026-09-15,
  `b472ae8`) — checked and deliberately untouched. This build adds no focus or
  `aria-activedescendant` behaviour, edits no CSS, and strictly *reduces* `rows`
  rebuilds, so it moves **away** from that reversal condition. Confirmed by QA
  against the whole diff.
- **`SightingsMap` / `MapBoundsFitter` fresh-array finding** (v1.0.29) — same
  defect class, extended not reversed; its guard shape is what Part B and the
  staleness rows copy.
- **The `SpeciesCombobox` extraction** (v0.5.61) — Species Detail remains the
  reference implementation; `SpeciesCombobox.tsx` is not edited at all.

## Ride-alongs

- `entryChunk.test.ts:450` said "only three importers." There are four. The
  assertion was correct throughout; only the comment changed.
- The ROADMAP entry names two sites and is wrong: it is three. Left for The
  Chronicler; `ROADMAP.md` deliberately not edited here.
- No version bump. All four version files untouched (`package.json` still
  1.0.30) and `pipeline/control-style-registers/` byte-identical (sha256
  re-verified against the recorded hashes).

## Verification

`npm run typecheck` exit 0 (0 TS errors) · `npm run build` exit 0 ·
`npx eslint .` exit 0 · **237/237 across 13 scoped suites** · **14/14 on the
roster**, proved red-first at all three fixed sites and under M8. The full
~4,500-test suite is deliberately not run here; the bundle gets one full run at
release.
