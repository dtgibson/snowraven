## Species Detail: count checklists on a checklist basis

### What this fixes

Species Detail used observation-row count for the Sightings card's **Checklists** value and as
Frequency's numerator, while Frequency's denominator already counted distinct non-empty eBird
submission IDs. A checklist containing a parent species row plus one or more subspecies/form rows
could therefore count more than once in the numerator, display Frequency above 100%, and disagree
with the meaning of the **Checklists** label.

The numerator now counts distinct, non-empty `submissionId` values from the already-filtered
species observations. The county filter and inclusive from/to date bounds remain shared with the
existing denominator. With **Show subspecies** off, parent and form rows normalize to the selected
parent before their IDs are deduplicated; with it on, the existing exact-name selection is retained
and repeated IDs are still deduplicated. The active-filter strip now uses the same checklist basis
for both figures in `Showing N of M checklists`. That sentence comes from the Species Detail copy
module and renders the singular `Showing 1 of 1 checklist` when its denominator is one.

Empty submission IDs remain excluded, matching the denominator. When the denominator is zero,
**Checklists** displays 0 and Frequency remains absent, as before.

### Deliberately unchanged

The filtered observation rows themselves are not deduplicated. Individuals, personal best,
first/last observation, media, breeding, graph, map, calendar, location, co-occurrence,
taxonomy/form-breakdown, selector, **Show all forms**, and **Show escapees** behavior therefore keep
their existing row-based or reveal semantics. The full-export Frequency denominator and its
zero-denominator branch are unchanged.

The new helper makes one pass over its input and stores IDs in one `Set`, so counting remains linear
in the number of parsed observation rows. It intentionally checks only whether an ID is non-empty;
it does not introduce submission-ID format validation on one side of the ratio.

### Files

- `frontend/src/lib/speciesStats.ts` — adds `countDistinctChecklists` and exposes the unambiguous
  `checklistCount` statistic.
- `frontend/src/components/SpeciesDetail.tsx` — uses distinct checklist counts in the Sightings card,
  Frequency numerator, and location-filter strip.
- `frontend/src/lib/speciesStats.test.ts` — covers ordinary parity, duplicate IDs, empty IDs, and
  unchanged row-based individual/best statistics.
- `frontend/src/components/SpeciesDetailChecklistFrequency.test.tsx` — exercises the real Species
  Detail surface in merged and exact-name modes, county and inclusive date filters, filter-strip
  counts and singular copy, the zero-ID branch, ordinary count/percentage parity, and the 100%
  ceiling.
- `frontend/src/lib/speciesDetailCopy.ts` — owns the filter-strip's count-bearing sentence and its
  denominator-driven singular/plural choice.
- `frontend/src/lib/speciesDetailCopy.test.ts` — generates the reachable count corpus, applies the
  copy rules, and guards the component-to-copy-module route.

### Verification

- Focused affected suite: **5 files, 36 tests, all passing**.
- `npm run typecheck`: passing.
- ESLint on all six changed frontend files: passing with no warnings or errors.
- `npm run build`: passing; Vite transformed 2,607 modules, with only the existing large-chunk
  advisory.
- Mutation check 1: changing the repaired numerator back to `speciesObs.length` produced five
  discriminating failures across the pure helper and all four component cases.
- Mutation check 2: changing the filter strip back to raw filtered/base row lengths failed its
  dedicated component assertion.
- QA-retry mutation checks also rejected all three wrong variants: a hard-coded plural failed three
  tests across the copy and component suites; re-inlining even grammatically correct copy failed the
  source-of-truth guard while behavior tests stayed green; and replacing the full-export Frequency
  denominator with the species count failed the filtered 67% case and the new ordinary 50% case.
- Every mutation was reverted and the restored production source passed all checks above.
- `git diff --check`: passing. No version, changelog, roadmap, website, convention, deployment, or
  release files changed.

The reference export still illustrates the defect (four named species and 12 excess rows among
21,369 rows), but its `4 of 282` note conflicts with a later census of 283 selectable species. This
change does not present either denominator as a new product-wide prevalence claim.

### Spool posture

There is no feature-specific version bump, release note, stamp, deployment, or release. This fix
receives the shared patch stamp when the Spool is flushed.
