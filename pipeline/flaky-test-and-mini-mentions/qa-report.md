# QA Report — flaky-test-and-mini-mentions

**Date:** 2026-06-10
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

## Test Suite Results

- Frontend: **769 tests passing, 0 failing** (52 files), fresh `npx vitest run`.
- Backend: **110 tests passing, 0 failing**, `backend/.venv/bin/python -m pytest tests/ -v`.
- `npx tsc --noEmit`: clean. `npx eslint .`: clean.

## Flake Acceptance (Part A) — independent verification

All runs are the Tester's own, on top of the Engineer's 10.

**Shim enabled — 8 full-suite runs, all clean:**

| Run | Result | `Unhandled\|cancelAnimationFrame` hits |
|---|---|---|
| fresh | 769/769 pass | 0 |
| loop 1 | 769/769 pass | 0 |
| loop 2 | 769/769 pass | 0 |
| loop 3 | 769/769 pass | 0 |
| loop 4 | 769/769 pass | 0 |
| loop 5 | 769/769 pass | 0 |
| loop 6 | 769/769 pass | 0 |
| post-restore | 769/769 pass | 0 |

Plus 3 isolated `BirdingStats.test.tsx` runs: 3/3 green (3 tests each), zero hits.

**Negative control — shim disabled (setupFiles line commented), 18 full-suite runs:**

- Round 2, run 2: **reproduced** — exit code 1, four unhandled
  `ReferenceError: cancelAnimationFrame is not defined`, each attributed by
  vitest to `src/components/BirdingStats.test.tsx` ("...while it was
  running"). This is the exact pinned failure from the brief.
- Round 1, run 5: one run with 1 test failed / 768 passed, no
  cancelAnimationFrame text in the summary grep; the full log was not
  captured and the failure did not recur in 12 subsequent logged
  shim-disabled runs. Most plausibly the same root cause in its
  fail-the-running-test manifestation (the brief documents that vitest's
  unhandled-error handling "intermittently fails whichever test is
  running"); noted for honesty, not reproducible on demand.
- Remaining 16 runs green. 2 bad / 18 ≈ 11%, matching the brief's pinned
  flake rate.

**Restoration:** `frontend/vite.config.ts` was backed up before the toggle
and copied back byte-exact — the `git diff` on it before and after the
negative control is identical (diff-of-diffs empty). `test-setup.ts` never
left place. One full post-restore run confirmed green.

**Mechanism note (non-blocking):** `BirdingStats.test.tsx` is jsdom-env
(`// @vitest-environment jsdom`), where `vi.unstubAllGlobals()` restores
jsdom's own native cAF. The unhandled error actually lands when the
toolkit's stray 100 ms fallback timer outlives the file and fires while a
later **node-env** file runs in the same worker — bare
`cancelAnimationFrame` doesn't exist there. The shim fixes it precisely
because vitest runs `setupFiles` for every test file, so node-env files get
a baseline cAF (a `clearTimeout` on a foreign id is a harmless no-op). The
brief's narrative is slightly loose on which environment lacks cAF; the
root cause, fix, and empirics all hold.

## Acceptance Criteria Verification

| Criterion | Result | Notes |
|---|---|---|
| Full vitest suite green | ✓ Pass | 769/769, 52 files |
| Full pytest suite green | ✓ Pass | 110/110 |
| 10 consecutive zero-unhandled-error full runs | ✓ Pass | Engineer's 10 + Tester's independent 8, all zero hits |
| 3 isolated BirdingStats runs green | ✓ Pass | 3/3, zero hits |
| Negative control proves the shim is the fix | ✓ Pass | ReferenceError reproduced with shim disabled; never with it enabled |
| `test-setup.ts` idempotent, baseline-only | ✓ Pass | `typeof === 'undefined'` guards on both globals; jsdom files keep native impls; commented with the recharts/toolkit root cause |
| BirdingStats stubs/assertions untouched | ✓ Pass | `git diff` empty; rafQueue/idleQueue mechanism intact; `vi.stubGlobal` overrides the shim during its tests regardless |
| No production code in the flake fix | ✓ Pass | Only `test-setup.ts` (new) + `vite.config.ts` `test.setupFiles` (plus a vitest/config type reference) |
| `git diff` empty: BirdingStats.test.tsx, commentBlocks.ts, all formatters | ✓ Pass | None in the working-tree diff; backend untouched entirely |
| B1 Weather-tab mention byte-equal + placement | ✓ Pass | `<p>` between weather card's `</div>` and the panel-weather tabpanel's `</div>` (next sibling is panel-comparer); all six style props exact; anchor href/target/rel/aria-label/color-inherit/underline exact; no icon, no fetch, token color only; JSX whitespace renders the approved text exactly ("…browser: SnowRaven Mini, a Chrome/Firefox…") |
| B2 README mention byte-equal + placement | ✓ Pass | Byte-equal line, after the docs/HELP.md pointer, before `## Privacy` |
| B3 HELP.md mention byte-equal + placement | ✓ Pass | Byte-equal; `### SnowRaven Mini (browser extension)` inside `## Weather` after `### Tides` content, before the `---`; links + em dash only (renderer-safe); no `HelpDocs.tsx` change |
| Version 0.5.29 in both manifests | ✓ Pass | `frontend/package.json` + `src-tauri/tauri.conf.json` |
| CHANGELOG [0.5.29] entry accurate | ✓ Pass | Added (Mini mentions) + Fixed (flake, correct root-cause summary, "test infrastructure only" claim true) |
| Website pill + footer at v0.5.29, nothing else | ✓ Pass | Pill at L48 incl. `aria-label="Version 0.5.29"`, footer at L502; diff contains only those two hunks |
| PRIVACY_POLICY.md untouched | ✓ Pass | Not in the working-tree diff; B1 is a plain href, no fetch until clicked |
| No other test file's behavior changed by the shims | ✓ Pass | No `typeof requestAnimationFrame`/presence checks anywhere in `src/`; only consumers are production components + BirdingStats' own stubs; node-env spot-check (`mapPins.test.ts` 12/12) and jsdom spot-check (BirdingStats isolation) green |

## Edge Cases Tested

- Shim interaction with `vi.stubGlobal`/`vi.unstubAllGlobals` (BirdingStats'
  own stubs always win during its tests).
- Cross-environment behavior: jsdom files keep native rAF/cAF (guards
  no-op); node-env files gain baselines only where undefined.
- Byte-exact restoration of the negative-control toggle, verified by
  comparing `git diff` output before/after.

## Known Limitations

- The flake is probabilistic (~11%/run shim-disabled); 18 clean-ish control
  runs caught it once definitively. One uncaptured single-test failure in a
  shim-disabled run (round 1, run 5) could not be re-reproduced in 12
  logged attempts; it occurred only without the shim, so it does not
  implicate this change. If a full-suite failure without
  cancelAnimationFrame text ever appears WITH the shim in place, treat it
  as a separate pre-existing flake and capture the log.
- Retry loop: 0 attempts used — no failures caused by this change.

## Convention Flags

- When a third-party library schedules fallback timers that can outlive a
  test file (here: @reduxjs/toolkit's autoBatch inside recharts), baseline
  global shims belong in a vitest `setupFiles` entry — per-test
  `vi.stubGlobal` cannot cover timers that fire after the file's
  environment is torn down, because the stray callback resolves bare
  globals against whatever file is running next in the worker.
