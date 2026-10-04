# Decisions: Stats Badges Uniform (deployment)

Improve lane, design pass. These are the ship-stage decisions, written by
the Deployer. The design decisions are in `design-refinement.md` and
`pipeline/design-system.md`; the one measured spec deviation (track minimum
7.25rem, not 7.5rem) is in `pr-description.md`.

## 1. Pre-deploy reconciliation (2026-10-03)

- Branch base `c49b0a9`. After `git fetch origin`, `origin/main` was
  `995feba` ("chore: context update after the 1.0.49 Spool bundle"), one
  commit ahead. It touches only records (`.claude/rules/*`, `CLAUDE.md`,
  `DECISIONS.md`, `PRODUCT_CONTEXT.md`, `ROADMAP.md`,
  `pipeline/spool-bundle-20261003/`) and none of this build's files.
- This build's work was committed first (`21c79fd`), then `origin/main` was
  merged INTO this branch (`a58ae97`), with no conflicts.
- Regression basics on the merged tree, run from `frontend/`:
  - `npm run typecheck`: exit 0.
  - `npx vitest run`: 9,308 passed, 7 skipped, 1 failed, of 9,316. The one
    failure is the wall-clock ratio row in `weatherStatsShared.test.ts`
    ("grows about 2x per doubling ...", 3.51 against a limit of 3), at a load
    average of 18 while other sessions were building. This build does not
    touch that file. Re-run alone: 24 of 24 passed. Judged a load reading,
    per `.claude/rules/testing.md`, not a regression.
  - `npm run build`: succeeded; the only warning is the existing chunk-size
    notice for the taxonomy and county chunks.
  - An earlier run launched from the worktree root, not `frontend/`, reported
    18 failed files. Every failure was a guard reading `src/...` relative to
    the working directory (ENOENT). That run was discarded as an instrument
    error, not counted.

## 2. Version number and the parallel-ship check

Version **1.0.50**, the next patch. Checked before taking it:

- Tags: newest `v1.0.49`; the remote has no `v1.0.5x` tag beyond the old
  `v1.0.5`.
- GitHub releases: newest `v1.0.49` (Latest, 2026-10-03).
- CI: the newest runs are on `995feba` (Pipeline, success) and the 1.0.49
  tag and stamp commits. No run on an unknown commit.
- App Store Connect (read-only GET, metadata key): record `99e3f9ff`
  (1.0.49, build 1.0.49.1) is `WAITING_FOR_REVIEW` as submission
  `f8156470`; 1.0.47 and every earlier record listed are `READY_FOR_SALE`.
  Newest TestFlight build 1.0.49.1 `VALID`; no 1.0.50 build exists.
- Other work in progress, read from committed branch refs only (no other
  worktree was entered or touched):
  - The main checkout is on a Spool branch, `weft-spool/20261004-031125`,
    with one fix committed (`a0f770c`, map-recency-dst-colors) and no version
    bump. Whichever of the two ships second takes the next number and
    reconciles `CHANGELOG.md`'s top entry.
  - `worktree-android-release` (locked, active build) carries version 1.0.48
    and a stale `[1.0.49] - unreleased` changelog section, so it renumbers
    when it lands. It has not claimed 1.0.50.
  - `worktree-species-first-of-year` (locked) sits at `995feba` with no
    commits of its own.
  No release was mid-flight for 1.0.50.

## 3. The four-file version set

`frontend/package.json` (and the two version lines in
`frontend/package-lock.json`, as the 1.0.49 bump did), `src-tauri/tauri.conf.json`,
`CHANGELOG.md`, and `website/index.html`'s version pill (visible text and
`aria-label`) and footer line. Nothing else in `website/` changed. The
parity guards `icloudKeysPublishedClaims.test.ts` and
`iosSceneManifest.test.ts` passed (61 of 61), and a grep confirms the pill,
its label and the footer each read 1.0.50 with no 1.0.49 left in those
places.

The changelog entry was written against the shipped code (the diff of the
milestones block), not the PR description: uniform size, an even grid with
the last row in the same columns, threshold then species then date, long
names wrapping with their marks, thousands separators, the "Life list
milestones" label, the check mark and leading divider removed, and a list
for screen readers.

## 4. Published surfaces

- README, website copy, App Store listing copy and the privacy policy are
  untouched. The website changes only by its version stamp.
- Screenshots: all five published Statistics shots
  (`appstore/screenshots/ipad-13/02-statistics.png`,
  `appstore/screenshots/iphone-6.9/02-statistics.png`,
  `website/assets/shots/statistics.webp`, `statistics-dark.webp`,
  `statistics-mobile.webp`) were opened and checked: each stops at Life List
  Totals or the top of Top Species, so none shows a milestone badge and none
  needs recapturing.
- `docs/HELP.md`'s Firsts and Milestones paragraph stays true (QA checked; it
  never named the check mark), so it is unchanged.

## 5. The App Store leg is a separate decision

The production confirm covers the desktop release and the TestFlight upload
only. The App Store submission waits for the user's own device check of
TestFlight build 1.0.50.1, and then needs its own choice, because 1.0.49's
record `99e3f9ff` is `WAITING_FOR_REVIEW`: defer 1.0.50 behind it (its own
record once 1.0.49 is `READY_FOR_SALE`), or withdraw 1.0.49 and roll it into
1.0.50. Either way a 1.0.50 What's New line needs the user's yes before it is
written to App Store Connect. Whatever is chosen is recorded in CLAUDE.md's
App Store list in the same ship.
