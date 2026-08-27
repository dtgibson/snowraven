# Closeout — Named Birds Top Locations

**Written retrospectively on 2026-08-27**, during the
`a11y-taxonomy-screenshot-sweep` run, at the user's request to close this build
out. It is a record of what is verifiable now, not a reconstruction of stage
reports that were never produced. Where a stage did not run, this says so
rather than inventing its output.

## Status

**Shipped.** The code is fully on `main` and released in v1.0.3.

## What is on the record

- `change-brief.md` — the approved scope, including the design-pass decision.
- `design-refinement.md` and `design.html` — the approved design.
- `implementation.md` — the Engineer's record, including a **Verification**
  section reporting `npm run typecheck`, `npm run lint` and `npm run build`
  clean, vitest 208 files / 3063 passed (+18 new cases for this feature),
  `weft-design-lint` clean on the new component, and the entry-chunk guard
  green.

## What is NOT on the record, and why

This build ran as a parallel worktree alongside `custom-raven-glyph`, and the
two shipped together as the single v1.0.3 release. The deploy was carried out
from the `custom-raven-glyph` run, whose `qa-report.md`, `security-report.md`,
`pr-description.md` and `deployment-record.md` cover the release as a whole.
This build produced **no separate QA report, security report, PR description or
deployment record of its own**, and none has been written here after the fact:
a QA or security report is a record of a review that happened at a point in
time, and writing one now would claim a review that did not take place.

What can be said from evidence rather than memory:

- The Engineer's own verification is recorded in `implementation.md` (above) and
  its test counts are consistent with the suite at that commit.
- The feature's 18 tests (`namedBirds.test.ts`, `NamedBirdLocations.test.tsx`)
  are on `main` and pass in the current suite.
- No security-relevant surface was introduced: the change adds no network call,
  no persisted setting, no new dependency, and no new href construction. Its
  location names render through the existing shared `HotspotLink`, which keeps
  the shipped `LOCATION_ID_RE` id-shape guard, and a personal location stays
  plain text.

## Verification that the code is fully on main

Checked on 2026-08-27 from a clean tree:

- All five files named in `implementation.md` are present:
  `frontend/src/lib/namedBirds.ts`, `frontend/src/components/NamedBirdLocations.tsx`,
  `frontend/src/components/NamedBirdRow.tsx`, `frontend/src/lib/namedBirds.test.ts`,
  `frontend/src/components/NamedBirdLocations.test.tsx`.
- `computeNamedBirdLocations` resolves in both its helper and its consumer.
- `git status` clean and no diff against `origin/main`.
- No `weft/*` branches and no registered worktrees survive
  (`git worktree list` shows only the main checkout; `.claude/worktrees` is empty).

## Commits

- `a9906fc` — feat: per-individual top locations on the Named Birds tab (v1.0.3)
- `3efc5d4` — fix(named-birds): terminal period sits tight in the single-location sentence
- Merged at `a9c6e4c` and again at `0028003`; both reachable from tag **v1.0.3**.
- Released: https://github.com/dtgibson/snowraven/releases/tag/v1.0.3

## Conclusion

Nothing from this build is missing from `main`, and nothing further is owed to
it. The worktree it ran in has already been removed. This record exists so the
gap in its stage artifacts reads as a known consequence of a two-build release
rather than as an unfinished build.
