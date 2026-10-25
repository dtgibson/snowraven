## Taxonomy 2026 readiness, Leg 1

### What this does

Gets SnowRaven ready for eBird's 2026 taxonomy update (scheduled for 27 October 2026) before the data exists. The web/Pi backend's saved copy of eBird's taxonomy (`data/taxonomy.json`) was written once and never rewritten, always beat the bundled snapshot offline, and a running server never re-fetched; all three are fixed. Two new CI guards fail on a Frivolous Lists name eBird no longer publishes and on a species code outside the shape the app's code guards accept, and the snapshot generator now refuses such a code before writing anything. The misleading "Clements year" comments are corrected (the snapshot `VERSION` "2027" is a cache counter holding eBird's 2025 taxonomy), and the annual refresh is written down as one ordered runbook. Leg 2 (loading the 2026 data) is not in this change.

No visible change on any platform. The built frontend is byte-identical to a build of HEAD.

### How to test

1. Backend rows: `cd backend && .venv/bin/python -m pytest tests/test_taxonomy_router.py -v`. The four new rows are `test_live_fetch_that_differs_from_the_saved_copy_rewrites_it`, `test_offline_floor_prefers_a_newer_bundled_snapshot_to_an_older_saved_copy` (two cases), `test_a_server_older_than_seven_days_refetches` and `test_a_failed_seven_day_refresh_keeps_the_maps_and_waits_another_seven_days`; the audit fixes add `test_a_malformed_seven_day_refresh_keeps_the_maps_and_fetches_once` (four cases) and `test_a_short_seven_day_refresh_keeps_the_maps_and_the_saved_copy`.
2. Frontend guards: `cd frontend && npx vitest run src/lib/frivolousLists.test.ts src/lib/exoticProvenanceCache.test.ts src/lib/alphaCodesGenerator.test.ts`.
3. Full gates: `cd backend && .venv/bin/ruff check . && .venv/bin/python -m pytest tests/`, then in `frontend/`: `npx vitest run`, `npm run build`, `npx eslint .`.
4. To watch a live rewrite on web/Pi, see `pipeline/taxonomy-2026-readiness/how-to-see.md`.

### Notes for reviewer

**The saved-copy mechanism** (`backend/routers/taxonomy.py`). A live fetch is saved with `version` set to the bundled snapshot's version, and the offline floor uses the saved copy only when its `version` equals the bundled one. This is the desktop's `CACHE_KEY` rule: one hand-bump at the annual revision retires old copies on both. A fetch the backend accepts rewrites the twin when its five maps or its version differ from the saved copy, and only then; a body that is too short or cannot be turned into maps is refused and never saved. A load expires after seven days on the monotonic clock; a failed refresh keeps the maps it has and waits another seven days rather than retrying on every request (each try can take 30 s or longer, since the timeout is per phase). The reasoning, the measured cost and the known limitation (every taxonomy request that arrives during the weekly refresh waits for it, sharing one fetch) are in `decisions.md`, section 8.

**Why `SPECIES_CODE_KEY_RE` is tested through `sanitizeStore`.** Exporting the constant was tried and changed the built `dist/` (the `exoticProvenanceCache` chunk and every hash citing it), so the guard reads it through its one call site and the bundle stays byte-identical.

**The generator check lives in the pure core** (`scripts/lib/ebirdTaxonomyDerive.mjs`, `codeShapeViolations`, called by `planTaxonomyRun`, which `build-ebird-taxonomy.mjs` runs before its only write). The core takes no app imports by design, so it spells `SPECIES_CODE_SHAPE_RE` itself, and `alphaCodesGenerator.test.ts` holds that declaration equal to `SPECIES_CODE_RE` (source and flags).

**Not changed, on purpose.** No version bump, no `CHANGELOG.md` entry (the proposed text is in `held-copy.md`, per the release-commit convention), no published copy. `.claude/rules/bird-names.md` was read and left alone: it never calls the version a year. `speciesCode.ts` says the longest code is 10; it is 8 on the 2025 snapshot, recorded for Leg 2's re-derive list (README step 6) rather than edited.

#### Commands run and results

| Check | Result |
|---|---|
| `ruff check .` (backend, 0.15.20, as CI) | All checks passed |
| `pytest tests/` (backend) | 2,071 passed |
| `npx vitest run` (frontend, full) | First run: 1 failure, `parseBarChart.test.ts` > names at 512 and 513 characters (CPU quotient 3.52 against 3.2), the row `.claude/rules/testing.md` names as the known collector-cost residual; this change touches nothing under `lib/barChart/`. Green alone (55 of 55), then a clean full re-run: 10,372 passed, 6 skipped, 0 failed, and the same again on the final tree |
| `npm run typecheck` / `npm run build` | Pass (the first build caught an implicit `any` in the new Frivolous Lists guard, fixed by typing the entries) |
| `npx eslint .` (frontend) | Pass, no output |
| `node --check` on both generator files; the generator with no key | Syntax ok; stops at "EBIRD_API_KEY is not set" before any fetch |
| Snapshot twins | `cmp` identical |
| Live web/Pi check, `SR_DATA_DIR` on an empty scratch folder | First request saved the fetched taxonomy under `version: "2027"`; a restart and the same request left the file unmodified (`decisions.md`, section 12). The real `data/` was not touched |

#### Built-bundle comparison

HEAD was built twice from a clean state (`dist/` and `node_modules/.vite` removed), and the two builds are byte-identical (determinism control). The final tree, built the same way, is **byte-identical to the HEAD build across the whole of `dist/`**, including `assets/index-CbbWEUbZ.css` (177,717 bytes, same content hash). Reproducibility control: the rejected export experiment above, built the same way, did change `dist/`, so the comparison can see a change.

#### Red, then green: the backend rows

Run against HEAD's router (`git show HEAD:backend/routers/taxonomy.py`), then against six mutations of the new one, restored by sha256 each time:

| Run | Red |
|---|---|
| HEAD router | all five new cases. The saved-copy row reads `version ''` where `'2027'` is expected; both floor cases serve `diskcode` where `amerob` is expected; the two seven-day rows fail on the missing `_clock` hook, so their behavioural proof is M1 and M5 |
| M1 no seven-day age | both seven-day rows |
| M2 persist on a version difference only | the saved-copy row (its second leg) |
| M3 persist on every load | the saved-copy row (its third leg) |
| M4 saved copy always preferred offline | both floor cases |
| M5 a failed refresh does not restart the age | the failed-refresh row |
| M6 fetch saved without the snapshot version | the saved-copy row |

#### Red, then green: the frontend guards and the generator check

One snapshot of the five files involved, a baseline run first, each mutation restored from the snapshot and the restore checked by sha256 (all five matched afterward). Baseline: 0 of 120 red in the three files.

| Injected defect | Red |
|---|---|
| A1 a listed name renamed (`Great White Egret`) | the Frivolous Lists name row |
| A2 a listed name in the wrong case (`Great egret`) | the Frivolous Lists name row |
| A3 the snapshot renames a listed species (Great Egret) | the Frivolous Lists name row |
| A4 a list emptied | the non-vacuity row, plus two existing count rows |
| B1 the snapshot gains the code `Bad Code` | both code rows (`SPECIES_CODE_RE`, the store's load) |
| B2 a `reportAs` value only goes out of shape | both code rows |
| B3 `SPECIES_CODE_RE` tightened to 7 characters | the `SPECIES_CODE_RE` row and the generator's spelling pin |
| B4 `SPECIES_CODE_KEY_RE` loses the hyphen | the store's load row, plus the existing hyphenated-code row |
| G1 the generator's stop removed | the generator refusal row |
| G2 the generator's shape drifts to 15 characters | the generator's spelling pin |

No whole-file phrase assertion was written, so none needed measuring against HEAD. Every added line is ASCII, and none carries an em dash.

### Audit fixes

The Auditor's four notes (`security-report.md`), fixed. Reasons and details are in `decisions.md`, sections 13 to 16.

- **F1 (Medium).** In `_ensure_loaded`, the plausibility check, `_derive_from_taxonomy` and `_apply_snapshot` now sit inside the fetch's `try`, so a 200 the router cannot turn into maps keeps the loaded maps, saves nothing and waits seven days, like a failed fetch. `_apply_snapshot` now derives the all-category reverse map (`_by_com_all_for`, formerly `_rebuild_by_com_all`) before it clears any map: a form with a numeric `comName` got through the builder and raised there after the maps were replaced, so covering the builder alone was not enough.
- **F2 (Low).** `_MIN_ENTRIES = 100` beside the fetch, the desktop's rule: a body that is not a list, or has fewer than 100 entries, is a failed refresh and is never applied or saved.
- **F3 (Low).** Runbook step 4's key reader prints a fixed message and exits 1 on any failure, and never prints the file.
- **F4 (Informational).** `decisions.md` section 8's known limitation reworded, and the same claims swept through this file and the router comment.

New rows in `backend/tests/test_taxonomy_router.py`:

- `test_a_malformed_seven_day_refresh_keeps_the_maps_and_fetches_once`, four cases: a body that is not JSON, a JSON object (`{"errors": []}`), a list holding a species whose `sciName` is `null`, and a list holding a form whose `comName` is `5`. In each, at day 7, five requests make one fetch between them, every map is unchanged and `data/taxonomy.json` is byte-identical; seven days later the next fetch runs.
- `test_a_short_seven_day_refresh_keeps_the_maps_and_the_saved_copy`: at the shipped floor of 100, a 3-entry 200 at day 7 leaves the `"2027"` saved copy byte-identical and the maps unchanged. The row first asserts that the backend's floor equals the desktop's, read from the comment-stripped TypeScript.
- The isolation fixtures of the three files that drive the live fetch patch the floor down to 1, because their fakes hold one to nine entries.

| Check | Result |
|---|---|
| `cd backend && .venv/bin/ruff check .` | All checks passed |
| `.venv/bin/python -m pytest tests/test_taxonomy_router.py -v` | 25 passed |
| `.venv/bin/python -m pytest tests/` (full backend) | 2,076 passed (2,071 before, plus the five new cases); this supersedes the backend row in the table above |
| Real `data/taxonomy.json` after the full suite | Unchanged (12 August, 1,848,864 bytes) |
| `git status` under `frontend/` | The same three test files as before the errand, all Leg 1's earlier edits; no file under `frontend/` is newer than the errand's start. The frontend was not rebuilt |

Red, then green. The router was snapshotted once; each mutation was applied from the snapshot, checked to match exactly once and to change the file, and the router was restored and verified by sha256 afterwards. Baseline: 25 of 25 green.

| Mutation | Red |
|---|---|
| M1 the pre-fix shape (no floor, builder after the `try`, reverse map after the clears) | json-object, null-sciName, numeric-form-comName, and the short-refresh row. The not-JSON case stays green, because `resp.json()` was already inside the `try` |
| M2 builder inside the `try`, apply after it | numeric-form-comName |
| M3 apply inside the `try`, reverse map after the clears | numeric-form-comName |
| M4 floor check removed | the short-refresh row |
| M5 `_MIN_ENTRIES` drifts to 99 | the short-refresh row (the two declarations disagree) |
| The patch-down removed from `test_checklists_router.py` | 2 of that file's 8 rows |

F3's scratch test is the table in `decisions.md`, section 15: the old command printed both fake keys from a truncated key file, and the new one printed only the fixed message.
