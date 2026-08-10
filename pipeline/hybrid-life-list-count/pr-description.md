## Hybrid life-list count

### What this does

`filterObservations` (`frontend/src/lib/birdingStats.ts`) filtered on `isSpuhOrSlash`, which
omits hybrids, so `" x "` hybrid rows survived as countable species. Its own doc comment
already claimed it dropped hybrids, and CLAUDE.md is explicit that a life-list COUNT uses
the countable-life-list predicate, not the bare `isSpuhOrSlash` display primitive. The
predicate is swapped and the doc comment corrected to describe what the function does.

The predicate has to be applied to the **normalized** name, which is the subtlety this
change turns on. `normalizeSpeciesName` strips a trailing parenthetical, and the hybrid
marker is a `" x "` in the *base* name, so testing the raw exported name conflates two
different birds:

- `Mallard x American Black Duck (hybrid)` → base `Mallard x American Black Duck`, a true
  inter-species hybrid, correctly not countable.
- `Yellow-rumped Warbler (Myrtle x Audubon's)` → base `Yellow-rumped Warbler`, a countable
  intraspecific intergrade whose `" x "` is only inside the parenthetical.

Swept against the bundled eBird taxonomy, a raw-name predicate newly excludes 818 names:
782 true hybrids (correct) and **36 countable intergrades** (wrong), which erases the
species outright when the intergrade is a birder's only record of it. The shipped
predicate excludes exactly the 782, with **zero** other movement. New exported helper
`isNonCountableObservedName` in `lib/speciesUtils.ts` is the single source of that rule;
it is deliberately asymmetric (the `" x "` half tests the normalized name, the spuh/slash
half tests the raw name) and its doc comment explains why, so the asymmetry does not read
as an oversight and does not get "tidied up" later.

One predicate change fixes both `filterObservations` consumers, so neither call site is
patched individually:

- **Statistics** (`BirdingStats.tsx:257`) propagates to every derived stat: headline species
  count, per-checklist species counts, the accumulation curve and milestones (a hybrid could
  previously *be* a milestone), top species, temporal, geo, quality, breeding, and fun stats.
- **Map Explorer** (`MapExplorer.tsx:815` → `buildCountyAggregates`), whose "distinct species
  per county" comment already claimed hybrids were excluded. Before this change, county
  **Species** and county **Completeness** counted by different rules in the same dropdown;
  they now agree.

**`lib/calendar.ts:191` is fixed in the same change**, pointed at the same helper. It had
the identical raw-name over-exclusion and dropped those same 36 intergrades. It belongs
here rather than in a follow-up for two reasons: it is the same one-line defect in the
same predicate family, and the HELP.md paragraph below asserts Statistics uses "the same
rule as the Calendar tab's switch", which is only true once both call the one helper.

Three smaller pieces ride along:

- **Toggle label.** Statistics' checkbox read "Include spuh / slash species", which is
  inaccurate once the filter governs hybrids. It now reads **"Count spuh, slash & hybrids"**,
  matching the Calendar tab's existing switch verbatim rather than inventing new copy. Both
  surfaces now describe the same rule in the same words.
- **Predicate dedupe, zero behavior change.** `frivolousLists.ts` re-inlined
  `isSpuhOrSlash(name) || name.includes(' x ')`, which is literally `isNonCountableSpecies`.
  It now calls the canonical helper. Predicate drift is the exact bug class being fixed here,
  so the duplicate is retired in the same change.
- **Docs accuracy.** `docs/HELP.md` illustrated a hybrid as `Mallard × American Black Duck`
  (U+00D7) while the matcher keys on ASCII `" x "`, which would mislead a reader about what
  actually matches. Corrected to `Mallard x American Black Duck`.

Behavior is unchanged when the toggle is ON: all forms are counted, exactly as today. The
escape hatch is intact.

### How to test

1. `cd frontend && npm run dev`, then open http://localhost:5173 and go to **Statistics**.
2. The header checkbox reads **Count spuh, slash & hybrids**, off by default.
3. If your export contains hybrid rows, the headline **Species** total is now lower by the
   number of distinct hybrid names in it. If it contains none, the numbers are unchanged and
   the label is the only visible difference. Both are correct outcomes.
4. Tick the checkbox: spuh, slash, and hybrid forms are all counted again, and the total rises.
5. **Map Explorer** → county shading → **Species** metric. County species counts now use the
   same countable rule as the **Completeness** metric in that same dropdown.
6. **Calendar** tab: a day whose only record is an intergrade now shows a real Species
   number instead of "0" with the toggle off. A hybrid-only day still shows "0" until you
   turn the toggle on.
7. `cd frontend && npx vitest run` (1911 pass), `npm run build`, `npx eslint src --max-warnings=0`.

### Notes for reviewer

- **No existing test asserted the old hybrid-counting behavior.** The full suite passed
  unchanged on the fixed code. Two assertions in the `filterObservations` describe block were
  edited deliberately, not because they broke: a hybrid row was added to the shared fixture
  (so `toHaveLength(3)` became `4`) and the test title was widened from "spuh and slash" to
  "spuh, slash, and hybrid". Nothing anywhere expected a hybrid to count.
- New regression coverage in `birdingStats.test.ts` mirrors the bug brief's reproduction:
  1 real species + 1 spuh + 1 slash + 2 hybrids reported `speciesCount: 3` before, `1` now,
  and `5` with the toggle on. Per-checklist `speciesCount` is covered too.
- **The over-exclusion tests are discriminating, and that was proven, not assumed.** The
  earlier `Xantus's Hummingbird` case passed under both predicates, so it proved nothing; it
  is kept but explicitly labelled a guard. The real cases use trailing-parenthetical
  intergrades asserted to COUNT alongside a true hybrid asserted not to, on all three
  surfaces. Temporarily reverting the helper to the raw-name form turns exactly three tests
  red, one per surface (`speciesUtils`, `birdingStats`, `calendar`); the file was restored
  from a hashed backup and re-verified byte-identical (`3463fb21…`).
- **The taxonomy sweep was reproduced independently** rather than taken on faith: the
  raw-name form excludes 818 (782 hybrids + 36 intergrades), the shipped predicate excludes
  782 with 0 intergrades lost, and 0 names the old code excluded are newly kept. That last
  number is what makes this the narrow option rather than the scope-expanding one.
- **`frivolousLists.ts` keeps the raw-name predicate deliberately.** Its `isExcludedName` is
  also called with a raw `commonName`, so it has the same shape, but the brief required zero
  behavior change there and switching it would change which themed lists tick. Left as-is,
  byte-identical in behavior, with a comment at the call site recording why it differs from
  the count paths. Flagged below rather than silently aligned.
- **`mediaStats.ts:324` is correct as-is** and was checked, not assumed: it operates on
  already-normalized life-list names, which is what `isNonCountableSpecies` expects.
- **Deliberately out of scope, already decided:** `LifeList.tsx:506` (`countLabel` /
  `totalSpecies`) is the length of the display-filtered list by construction, so "correcting"
  it would either make the number disagree with the visible rows or silently drop hybrid rows
  from the list. That is a product decision, recorded for the user separately, and stays as-is.
  `SpeciesDetail.tsx:112,215` and `LifeList.tsx:329,363` are display filters where
  `isSpuhOrSlash` is correct per CLAUDE.md. `mediaStats.ts`, `calendar.ts`, and
  `countyCompleteness.ts` were already correct, so no denominator moves.
- **Docs sync:** `docs/HELP.md`'s Statistics section did not document this toggle at all, and
  the behavior changed, so a short paragraph now states the label and the countable rule.
  Both it and the Calendar section now name the intergrade case explicitly, since a birder
  with a `Northern Flicker (Yellow-shafted x Red-shafted)` needs to know it counts. The
  "subspecies fold into their parent species" claim was verified against the shipped
  functions (`computeLifeList` returns the parent species for an intergrade row), not
  assumed true.
  `README.md` and `website/index.html` describe Statistics without restating the toggle label
  or the countable-species rule, so there was nothing to propagate there; both were checked
  rather than assumed. The remaining `×` in HELP.md is `3×4 grid`, a real multiplication, and
  is correctly left alone.
- No version bump, no changelog: this is part of a bundled Spool release, versioned once for
  the whole bundle at the end. `frontend/package.json`, `src-tauri/tauri.conf.json`, and
  `CHANGELOG.md` are untouched.
