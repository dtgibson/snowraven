# Engineering log: security-bloat-deps-and-tests-cleanup

Phase 1 (brief "Scope and order" item 1 and the no-release parts of item 5), The Engineer, 2026-11-20, on the dev Mac only.
Branch `improve/security-bloat-deps-and-tests-cleanup`, cut from `main` at `18977177`. `main` is untouched. Written so a fresh Engineer can continue from it; every figure names how it was taken.

Environment: macOS 27.2 on the 8-core dev Mac (6 performance, 2 efficiency), Node 24.18.0 (`.nvmrc` 24) and Node 20.20.2 through nvm, npm 11.16.0, cargo 1.96.1, vitest 4.1.12. Load averages are recorded beside each timing reading; every reading in item A was taken at a load of 1.4 to 2.9 with nothing of this session compiling. Scratch work lives in this session's scratchpad (`.../scratchpad/`), not in the repo.

Decisions in force: D-01 to D-05 in `decisions.md` (the coordinator wrote D-02 to D-05 from the user's answers mid-phase: Node 24 on CI yes, a branch plus a draft pull request, the shipped-code half later as 1.0.75, and the timing bar).

---

## A. The two red files on GitHub (`c6328b4a`, `f79a03a9`)

### What GitHub measured (all 25 failing `Pipeline` runs on `main`, 2026-11-09 to 2026-11-20, Node 20)

Read with `gh run view <id> --log-failed` for each run (read-only), first failing assertion per row. `lifeListsLinearity.test.ts` was red in 24 runs, `alphaCodes.test.ts` in 5, and no other file failed in any of the 25.

| Row | Runs red | Read | Limit |
|---|---|---|---|
| LL pass 1, every row its own species | 22 | 20.33 to 26.11 | 20 |
| LL pass 1R, every row its own species, every row its own (state, county) | 10 | 25.58 to 32.38 | 25.55 |
| LL pass 1R, 200 species repeated, every row its own (state, county) | 9 | 25.63 to 32.23 | 25.55 |
| LL pass 2R, every row its own species, every row its own (state, county) | 16 | 20.69 to 45.20 | 20 |
| LL pass 2R, every row its own species, 20 counties in 4 states | 10 | 20.93 to 27.11 | 20 |
| LL pass 2R, 200 species repeated, every row its own (state, county) | 10 | 20.71 to 40.29 | 20 |
| AC published names, a code query (first doubling) | 5 | 3.35 to 3.92 | 3.2 |

The alphaCodes failures all had the same shape: first doubling 3.35 to 3.92, second 1.09 to 1.24, third 1.90 to 2.69, and 8k over 1k 8.1 to 11.0 against 15.6. The quadratic-join mutation read 3.73 to 3.98 per doubling on this Mac (species-code-search decisions.md 8), so GitHub's correct code reached the mutation's own band.

### What this Mac measures on both Nodes (2026-11-20, load 1.4 to 2.9, three runs each, `--maxWorkers=1`)

Taken with a temporary probe in `src/test/cpuTiming.ts` that appended each call's per-leg CPU times to a scratch file (restored afterwards and checked equal to HEAD by hash and `git diff`). Two earlier attempts printed nothing for passing rows, because vitest 4.1.12's default reporter drops console output from passing tests; the readings below are from the file probe. Quotient = large over small per-call CPU time; pass 3 shows raw with the floored (asserted) value in brackets, because its small leg runs under the 0.05 ms floor (testing.md v1.0.63).

| Row | Limit | Node 24 | Node 20 |
|---|---|---|---|
| pass 1, every row its own species | 20 | 10.76, 10.73, 11.05 | 17.20, **20.43**, **20.29** |
| pass 2, every row its own species | 20 | 10.89, 10.77, 11.13 | 18.94, 13.95, 15.90 |
| pass 3, every row its own species | 28.94 derived | 12.59 (9.72), 13.21 (9.67), 13.41 (10.02) | 12.75, 12.78, 13.12 |
| pass 1, 200 species repeated | 20 | 8.85, 9.12, 8.85 | 8.74, 8.58, 8.82 |
| pass 2, 200 species repeated | 20 | 10.45, 10.18, 10.31 | 9.76, 9.48, 9.50 |
| pass 3, 200 species repeated | 20 | 1.20 (0.69), 1.21, 1.20 | 1.18, 1.18, 1.19 |
| pass 1R, own species, own (state, county) | 25.55 | 13.69, 14.03, 13.79 | 19.76, 22.07, **26.73** |
| pass 2R, own species, own (state, county) | 20 | 12.62, 13.06, 13.00 | 12.48, 12.44, 14.08 |
| pass 1R, own species, 20 counties | 20 | 13.60, 14.07, 13.29 | 13.92, 14.19, 13.87 |
| pass 2R, own species, 20 counties | 20 | 14.35, 14.84, 14.80 | 16.67, 18.94, **20.19** |
| pass 1R, 200 repeated, own (state, county) | 25.55 | 12.14, 12.14, 11.97 | 18.91, **28.22**, 21.79 |
| pass 2R, 200 repeated, own (state, county) | 20 | 11.79, 12.29, 12.16 | 17.41, 12.18, 18.42 |
| pass 1R, 200 repeated, 20 counties | 20 | 10.14, 10.15, 10.26 | 10.27, 10.31, 10.36 |
| pass 2R, 200 repeated, 20 counties | 20 | 11.94, 11.68, 10.84 | 11.93, 11.62, 11.98 |
| a region press | 28.94 derived | 11.71, 11.80, 12.46 | 13.49, 12.13, 12.21 |
| the choice build | 27.41 | 13.02, 13.24, 13.31 | 12.98, 13.10, 12.69 |
| mutant of pass 1R (must exceed 20) | > 20 | 109.91, 107.82, 108.67 | 106.93, 107.79, 104.22 |
| mutant of pass 1 (must exceed 20) | > 20 | 107.02, 105.81, 107.19 | 105.15, 105.22, 103.24 |
| AC published, per doubling / 8x | 3.2 / 15.6 | 2.03/2.03/2.05 8.44; 2.08/2.01/2.02 8.45; 2.05/2.07/1.99 8.40 | 1.86/2.04/1.98 7.48; 2.04/2.00/1.52 6.20; 1.96/1.76/2.30 7.93 |
| AC hostile, per doubling / 8x | 3.2 / 15.6 | 1.99/2.00/2.00 7.92; 1.97/2.00/2.00 7.87; 1.96/2.00/2.00 7.85 | **2.75**/1.99/2.00 10.91; **2.96**/2.00/1.99 11.78; **2.93**/1.99/2.00 11.64 |

Bold: Node 20 readings over the limit, or the alphaCodes first-doubling step. Node 20 failed 2 of these 3 runs (and 3 of the 6 earlier runs, whose per-row output was lost to the reporter), always on the Map-heavy every-key legs; Node 24 passed all of them. So a large part of GitHub's red was CI's Node, and part is hardware: GitHub's Node 20 readings run higher still than this Mac's Node 20.

### Identical-input control (Node 24, load 1.7 to 2.0, a temporary test file, deleted after)

A leg timed against itself through `bestPerCallCpuMs`:

| Leg | rows' own settings (7 rounds, 20 ms) | 25 rounds of 100 ms | cost of the 25x100 pair |
|---|---|---|---|
| pass 1 at 50k distinct | 1.014, 1.005 | 0.990, 1.010 | 3.2 to 6.7 s |
| pass 1R at 20k pairs | 0.973, 0.942 | 1.006, 0.906 | 5.3 to 6.0 s |
| pass 2R at 20k pairs | 1.003, 1.089 | 1.020, 0.991 | 5.4 s |
| alpha join at 8k | 1.002, 1.003 | 1.000, 0.875 | 6.4 to 6.5 s |

The method is measuring at the rows' own settings; the v1.0.74 form is no steadier on these legs and costs 15 to 20 times as much.

### The bar, applied in order

- **alphaCodes.test.ts.** Tier 1 exists and is kept: the work count (`_alphaCodeJoinLookups`, already in the shipped module) is now its own pair of rows, asserted at all four legs, and gates on GitHub. It sees a join that looks rows up more than once; it cannot see a search inside the per-row work. Tier 2 for the CPU half fails on CI's Node itself: Node 24 reads 2.08 against the 3.2 per-doubling cap (1.5x) and 8.5 against 15.6 (1.8x), inside the 2x testing.md v0.5.84 says is not margin, and the v1.0.74 form would cost at least 25 s a run (5 legs x 25 rounds x 100 ms per row, two rows) against about 0.5 s. Tier 3: the CPU rows run behind the switch, limits and legs unchanged.
- **lifeListsLinearity.test.ts.** Tier 1 is not reachable: the plausible wrong implementation (the file's own mutants) is a hand-written search over a collection the pass builds itself, which no counter outside the module can see, and the passes carry no counter (adding one changes the shipped bundle, out of this phase). Tier 2 fails on CI's Node: Node 24 reads the every-key legs 1.35x to 1.9x under their limits, and the 500/5,000 sort rows 2.06x to 2.32x (raw readings against derived limits of 27.41 and 28.94), all within about 2x; the v1.0.74 form would cost at least 100 s a run for the file's twenty quotient measurements (sixteen rows, two in each mutant row) against 28 s for the whole file on GitHub. Tier 3: every quotient row and both mutant rows run behind the switch; the capped replica (hang guard) and the 150,000-row bound (structural counts) still gate on GitHub. Row order is unchanged (heap history moves these readings), and `git diff -w` shows only the header paragraph, one import and the two block wrappers.

### The switch

`frontend/src/test/localOnlyTiming.ts` exports `SKIP_LOCAL_ONLY_TIMING` (true only when `SR_SKIP_LOCAL_ONLY_TIMING=1`) and `LOCAL_ONLY`, the suffix every switched block carries in its title. Any other value throws at import. `pipeline.yml` sets it on the vitest step and nowhere else. Checked: unset, the two files run 37 of 37; `1`, 17 pass and 20 skip; `true`, both files fail at collection with the message.

### Seen red (harness `scratchpad/mut/timing-mutate.sh`: modules snapshotted once, controls first in both modes, one mutation at a time, restore verified by hash against the intended files and by a re-run, no git inside the harness)

| Mutation (in the shipped module, reverted after) | GitHub mode (switch on) | Local mode (switch off) |
|---|---|---|
| control, unmutated | AC 15 pass 2 skip; LL 2 pass 18 skip | AC 17/17; LL 20/20 |
| A1: `buildAlphaCodeIndex` looks every row up a second time | red: both work-done rows, and the QA-45 "fifty keystrokes" row | same three red; CPU rows green (a second pass is linear) |
| A2: a linear search over the index in place of `index.get(key)` | green (the count cannot see it) | red: CPU, published names (the hostile leg has no codes) |
| L1: pass 1 searches its own output in place of `map.get(name)` | green (the stated residual) | red: pass 1 every-key, and the mutant row's shipped-pass check |
| L2: `putSighting` searches its slots in place of `slots.get(name)` | green (the stated residual) | red: pass 1R own (state, county), pass 1R 20 counties, the region mutant row |
| control after restore | AC and LL green | (modules equal HEAD) |

### Rule and record text updated with the rows

testing.md gains one bullet after its v1.0.74 rule (the bar, the switch, the two files moved). security.md's n log n rule notes that the cited `lifeListsLinearity.test.ts` rows now run locally. DECISIONS.md's per-ship records of the v1.0.70 D-12 allowance are history and were not edited; the brief retires D-12 once CI is green, which is phase 2.

### Residual, stated in both files

GitHub no longer catches a search inside the Life Lists passes or inside the alpha join's per-row work. The local full suite does, and every builder runs it before pushing (testing.md).

---

## B. The 20 bundle rows that skipped on every CI run

`pipeline.yml` now runs `npm run build` right after typecheck and before vitest. The three files decide through `frontend/src/test/builtDist.ts` (`builtDistReady(present, path, rows)`): with a build the rows run; on CI without one the helper throws at collection; locally without one they skip and the helper writes one `[skipped]` line to stderr. It writes to stderr directly because vitest's default reporter drops console output from a passing file in a terminal and in a pipe alike (tested both ways; a `console.warn` was invisible). Each file keeps its own presence test (`dist/index.html`, or a non-empty CSS listing).

| Check (Node 24) | Result |
|---|---|
| fresh build, `CI=1` | 3 files, 212 of 212 pass (the 20 included) |
| no build, `CI` unset | 192 pass, 20 skip, three `[skipped]` lines on stderr |
| no build, `CI=1` | all three files fail at collection, naming the missing path |

Timeout arithmetic: the same steps in a new order, so the 944 s and 84 min sum in the job's comment stand; the comment records the recount. The new step times come from the draft pull request's runs.

---

## C. Dev-dependency advisories, no release (`845a6bf0`, `0d2eba38`, `c45dfc4e`)

Audits online, never `--offline`, both scopes, with the pre-change lockfile as the control.

| Tree | Scope | Before | After |
|---|---|---|---|
| frontend | full | 11 (2 High, 9 Moderate) | 0 |
| frontend | `--omit=dev` | 0 | 0 |
| website/tools | full | 1 High | 0 |
| website/tools | `--omit=dev` | 1 High | 0 |

**frontend (commit `chore(deps): frontend dev-tree audit fix, lockfile only`).** `npm audit fix --package-lock-only --ignore-scripts` (no `--force`) in a scratch copy first, then the lockfile copied in and `npm ci`. `package.json` unchanged. Every package that moved is dev: undici 7.30.0 to 7.30.2 (jsdom; GHSA-4qv8-2p9j-2685, GHSA-f72v-6w45-q472), zod 4.4.3 to 4.6.7 (eslint-plugin-react-hooks; GHSA-mrhx-c7xc-m3w5), minimatch 10.2.5 to 11.0.9 (GHSA-g3hv-75wg-m249), which needs eslint 10.3.0 to 10.15.0 and typescript-eslint and its seven `@typescript-eslint/*` packages 8.59.2 to 8.73.0, all inside their declared ranges, plus their own dependencies (`@eslint/config-array` 0.23.6, `@eslint/config-helpers` 0.7.0, `@eslint/plugin-kit` 0.7.3, `file-entry-cache` 11.1.5, `flat-cache` 6.1.23, `keyv` 5.6.0 and seven new small packages under them; `json-buffer` removed). Then: lint 0 problems, typecheck clean, full suite 11,520 passed and 8 skipped (as at the branch point), build byte-identical.

**website/tools (commit `chore(deps): sharp 0.35.5 in website/tools`).** `sharp` is pinned exactly, so `package.json` moves `0.35.4` to `0.35.5` and `npm install` writes the lockfile: sharp and its 16 `@img/sharp-*` platform packages 0.35.4 to 0.35.5, the 10 `@img/sharp-libvips-*` packages 1.3.3 to 1.3.4 (libvips 8.18.6 to 8.18.7), tslib 2.8.1 to 2.9.1. Advisory GHSA-wq5f-xc86-pv6w (librsvg, CVE-2026-96889); SnowRaven's scripts never hand sharp an SVG.
- Frames, by `scratchpad/sharp-ab/scripts/compose-ab.mjs`, which calls the composer's own exported `composeFamily` with `outRoot` in the scratchpad (so `appstore/` is never written) and then re-runs `process-img.mjs`'s resize and WebP jobs for the inputs present in `website/tools/shots/` (11 of 13; `hotspot-reports-light.png` and `life-lists-light.png` are not on this Mac).
- Non-vacuity: each run wrote 32 files (21 frames, 11 WebP), checked before any comparison (the first attempt wrote nothing and its comparison passed vacuously; that is why the count check exists).
- 0.35.4 twice: identical over all 32. The 0.35.4 recompose equals all 21 committed frames in `appstore/screenshots/` byte for byte. 0.35.4 against 0.35.5: identical over all 21 frames and all 11 WebP files.
- `website/tools` `npm test`: 15 of 15 pass on 0.35.5.

**The install warning (commit `chore(deps): record the fsevents install-script decision as no`).** The "old warning" is npm 11.16's `allow-scripts` notice, on every install in `frontend/` and `website/tools/`, for `fsevents` (darwin-only, optional; 2.3.3 and 2.3.2). Decision: **no**. As installed, fsevents declares no `install` script and ships no `binding.gyp` (the flag comes from registry metadata) and carries its prebuilt `fsevents.node`, so nothing would run anyway. `"allowScripts": { "fsevents": false }` in both `package.json` files silences it, lockfiles unchanged, and `require('fsevents').watch` still loads. A future fsevents with a real install script stays unrun until someone decides again. No app code imports `package.json`; the five guards that read it pass.

**"No bundle change", measured.** `npm run build` with `dist/` and `node_modules/.vite` removed first; SHA-256 of every file in `frontend/dist`. Determinism control: the branch point built twice, identical (133 JS, CSS and HTML files; 190 files in all). Compared against that baseline: after C1, after A and B's edits, and on the final tree (`e2e082f9`): identical over all 190 files each time, `index-CBeIKwWf.css` and `index-DxAK-VjO.js` unchanged. So the test-file edits in A, B and D, which Tailwind scans, emitted no rule.

---

## D. Every action pinned by commit SHA

Resolved read-only from each action's own repository: `gh api repos/<owner>/<repo>/git/ref/tags/<tag>`, annotated tags peeled through `git/tags/<sha>`, and the exact release found by matching the commit among `git/matching-refs/tags/<major>.`.

| Workflow | Was | Pinned to | Release |
|---|---|---|---|
| pipeline (x2), pages | `actions/checkout@v4` | `11d5960a326750d5838078e36cf38b85af677262` | v4.4.0 |
| pipeline | `actions/setup-node@v4` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | v4.4.0 |
| pipeline | `actions/setup-python@v5` | `a26af69be951a213d495a4c3e4e4022e16d87065` | v5.6.0 |
| pages | `actions/configure-pages@v5` | `983d7736d9b0ae728b81ab479565c72886d7745b` | v5.0.0 |
| pages | `actions/upload-pages-artifact@v3` | `56afc609e74202658d3ffba0e8f6dda462b719fa` | v3.0.1 |
| pages | `actions/deploy-pages@v4` | `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e` | v4.0.5 |
| windows-build | `actions/checkout@v6` | `d23441a48e516b6c34aea4fa41551a30e30af803` | v6.1.0 |
| windows-build | `actions/setup-node@v6` | `249970729cb0ef3589644e2896645e5dc5ba9c38` | v6.5.0 |
| windows-build | `dtolnay/rust-toolchain@stable` | `39008827e6b4319a349e9a42dfc90579dd25f1ca` | `stable` branch head, 2026-11-15; its `action.yml` defaults `toolchain` to `stable` |
| windows-build | `Swatinem/rust-cache@v2` | `d1527c8f67ef9af357290475d4af4b0fab8f12e0` (annotated tag `e9d7b9f1`) | v2.9.3 |
| windows-build | `actions/upload-artifact@v7` | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` | v7.0.2 |

Each pin is the commit the old ref resolved to on 2026-11-20, so no step changed. Each workflow's header carries the convention and how to move a pin. `frontend/src/lib/workflowActionPins.test.ts` holds every workflow read from `.github/workflows` (regular files only, testing.md v1.0.20) to `owner/repo@<40 hex>` plus a trailing release comment (a version tag, or a branch and its head's date), checks that every `uses:` line was read, and carries a guard-the-guard over the predicate. It replaces `androidProjectPins.test.ts`'s Android-only row (removal-ledger.md).

Seen red (`scratchpad/mut/pins-mutate.sh`, the same snapshot discipline): control green; each of seven mutations turns exactly one row red (a tag restored in each of `pipeline.yml`, `pages.yml`, `windows-build.yml` and `android-build.yml`, a dropped release comment, a step written as a flow mapping, a new unpinned workflow file); control green after restore, hashes equal.

Stated limit (in `pages.yml` and the guard): a composite action's own steps are outside a pin's reach (`upload-pages-artifact` names `actions/upload-artifact` by tag inside its own `action.yml`).

---

## Node 24 on GitHub (D-03, added mid-phase)

`pipeline.yml` and `windows-build.yml` take `node-version-file: '.nvmrc'` in place of `'20'`, keeping their SHA pins. **The next tag's Windows build is that job's first on Node 24, so the release leg should watch it.** The Android build is outside this decision and still runs Node 20: `scripts/android/toolchain.env` pins `NODE_MAJOR=20`, mirrored in the F-Droid recipe (the evaluator notes say the Android build runs 24; it does not). Text that said CI runs Node 20 was restated in the same commit: testing.md's v1.0.40 note and its v1.0.46 sizing rule (now "the Node CI runs", with Node 20's 64,000-character string-building bound kept until re-measured there), security.md's URLPattern sentence (Node 24 has `URLPattern`, Node 20 does not, checked), and comments in `cpuTiming.ts`, `tauriHttpScope.test.ts`, `parseBarChart.test.ts`, `countyShadingPerSpecies.test.ts` and `release.sh`. No guard pinned `'20'`.

---

## E. Python and Cargo audits, findings only

Tools installed in the scratchpad only: `python3 -m venv .../scratchpad/e/audit-venv` with pip-audit 2.10.1, and `cargo install cargo-audit --locked --root .../scratchpad/e/cargo-tools` (0.23.0), run with `--db .../scratchpad/e/advisory-db` so nothing lands in `~/.cargo`. `src-tauri/Cargo.lock` and `Cargo.toml` were hashed before and checked after every cargo command: unchanged.

### Python: 0 findings in every scope

| What | Packages | Vulnerabilities |
|---|---|---|
| `pip-audit -r backend/requirements.txt` (this Mac's Python 3.15.2) | 25 | 0 |
| `pip-audit --path backend/.venv/.../site-packages` (as installed) | 32 | 0 |
| CI's resolution: `pip install --dry-run --report` for CPython 3.11 on manylinux x86_64, `requirements.txt` plus CI's `ruff==0.15.20 pytest==9.1.1`, then `pip-audit --no-deps --disable-pip` over the 31 pins | 31 | 0 |
| control: `starlette==0.36.1` | 1 | 4 (PYSEC-2026-1941, -1943, -2280, -2281) |

No interpreter was installed for the 3.11 check. Caveat kept from the notes: `requirements.txt` pins only the 7 direct packages, so CI's transitive set floats; the 31 above are what it resolves today.

### Cargo: 24 vulnerabilities in 9 crates, 17 warnings. Every one is release work, held for strand 4 (1.0.75)

Reach is from `cargo tree --locked --offline -e normal,no-proc-macro --target <t> -i <crate>` on the four shipped targets (Mac `aarch64-apple-darwin`, Windows `x86_64-pc-windows-msvc`, iOS `aarch64-apple-ios`, Android `aarch64-linux-android`). `cargo tree` exits 0 with no output when nothing matches, so reach is read from the output (a negative control, `windows-sys` on the Mac target, prints nothing). Update commands are from `cargo update ... --dry-run`.

| Crate | Advisories | Shipped graph | Command that closes it | Notes |
|---|---|---|---|---|
| rustls 0.23.40 | RUSTSEC-2026-0346, -0285, -0348, -0349 (fixed 0.23.45 and 0.23.46) | Mac, Windows, iOS, Android | `cargo update -p rustls --precise 0.23.46` | A plain `-p rustls` stops at 0.23.43, the newest whose `rust-version` fits the crate's declared 1.77.2, which is not fixed; the `--precise` form also moves rustls-webpki to 0.103.17 |
| rustls-webpki 0.103.13 | RUSTSEC-2026-0382 (fixed 0.103.16) | all four | `cargo update -p rustls-webpki` (to 0.103.17) | |
| webpki-roots 1.0.7 | RUSTSEC-2026-0381 (fixed 1.0.10) | all four | `cargo update -p webpki-roots` (to 1.0.12) | |
| webpki-root-certs 1.0.7 | RUSTSEC-2026-0383 (fixed 1.0.10) | none | `cargo update -p webpki-root-certs` (to 1.0.12) | In the lockfile, in no target's graph |
| h2 0.4.14 | RUSTSEC-2026-0258 (fixed 0.4.16) | all four | `cargo update -p h2` (to 0.4.20) | |
| quick-xml 0.39.4 | RUSTSEC-2026-0194, -0195 (fixed 0.41.0) | all four, through `plist` | `cargo update -p plist` (1.9.0 to 1.10.4, which takes quick-xml 0.42.0) | `cargo update -p quick-xml` does nothing (0.41 is semver-incompatible). 0.39.4 stays in the lockfile for `wayland-scanner`, Linux only |
| zip 4.6.1 | RUSTSEC-2026-0367, -0368, -0369, -0429, -0545, -0548 (fixed 9.0.0, 9.0.5) | Windows only, through tauri-plugin-updater | **none per crate.** tauri-plugin-updater 2.10.1 to 2.14.0 all require `zip ^4`; 2.14.1 requires `zip ^9` and `tauri ^2.12`, and `cargo update -p tauri-plugin-updater --precise 2.14.1` drops the vendored `tao` patch from the graph ("patch `tao v0.35.3` was not used"), so closing it means a Tauri upgrade with the patch re-vendored (`src-tauri/vendor/tao/VENDORED.md`) | The updater acts only on a download whose minisign signature verified, and on Windows its artifact is the NSIS installer itself (windows-build.yml), so whether zip extraction runs at all is for strand 4 to read in the plugin source |
| quinn-proto 0.11.14 | seven, RUSTSEC-2026-0185 to -0524 (fixed 0.11.19) | none | `cargo update -p quinn-proto` (to 0.11.19; it also moves rand 0.9.4 to 0.10.4 and rand_core, and drops ppv-lite86 and rand_chacha) | HTTP/3 is not enabled on any target |
| quinn-udp 0.5.14 | RUSTSEC-2026-0538 (fixed 0.5.16) | none | `cargo update -p quinn-udp` (to 0.5.16) | |
| anyhow 1.0.102 (unsound) | RUSTSEC-2026-0190 (fixed 1.0.103) | all four | `cargo update -p anyhow` (to 1.0.104) | |
| rustix 1.1.4 (unsound) | RUSTSEC-2026-0486 (fixed 1.1.6) | Mac, iOS, Android | `cargo update -p rustix` (to 1.1.6) | |
| tokio 1.52.3 (unsound) | RUSTSEC-2026-0386 (fixed 1.53.3) | all four | `cargo update -p tokio` (to 1.54.1) | |
| event-listener 5.4.1 (unsound) | RUSTSEC-2026-0221 | Linux only (unshipped) | none needed | |
| glib 0.18.5 (unsound) | RUSTSEC-2024-0429 | Linux only (unshipped) | none needed | |
| clipboard-win 5.4.1 (yanked) | | Windows | `cargo update -p clipboard-win` (to 5.4.3) | |
| async-executor 1.14.0 (yanked) | | Linux only (unshipped) | `cargo update -p async-executor` (to 1.14.1) if wanted | |
| chrono, proc-macro-error, unic-char-property, unic-char-range, unic-common, unic-ucd-ident, unic-ucd-version, zbus_names, zvariant, zvariant_derive (unmaintained) | ten advisories, no fixed version | unic-* on all four (runtime); proc-macro-error, zbus_names, zvariant, zvariant_derive Linux only; chrono none | none | No action; recorded |

A combined dry run, `cargo update -p rustls-webpki -p webpki-roots -p h2 -p plist -p anyhow -p rustix -p tokio -p clipboard-win --dry-run`, moves exactly those crates (plus `base64` 0.23.1 and `quick-xml` 0.42.0 added for plist) and keeps the `tao` patch in the graph (no "not used" warning). With `cargo update -p rustls --precise 0.23.46` beside it, that is the per-crate set for 1.0.75; zip is the one that needs its own decision.

Two corrections to the brief's strand 4 line, for whoever plans 1.0.75: `zip` has no per-crate update that keeps the vendored `tao` patch, and `quick-xml` closes through `cargo update -p plist`, not `-p quick-xml`.

---

## Verification on the final tree (`e2e082f9`, before the docs commit)

| Gate | Result |
|---|---|
| frontend full suite, local (Node 24, default workers, switch unset, fresh build), load 2.1 at start | 524 files passed, 5 skipped (529); 11,527 tests passed, 8 skipped (11,535); 85.0 s |
| the same at the branch point (`18977177`, fresh build), load 9.5 at start | 523 passed, 5 skipped (528); 11,520 passed, 8 skipped (11,528); 115.1 s |
| frontend suite as GitHub runs it (`CI=1 SR_SKIP_LOCAL_ONLY_TIMING=1 --maxWorkers=1`, Node 24, fresh build), load 13 at start falling to 2.6 | 524 files passed, 5 skipped (529); 11,507 passed, 28 skipped (the 8 by design and the 20 local-only timing rows; the 20 bundle rows ran); 413.7 s (tests 282.6 s) |
| `npm run typecheck`, `npm run lint` | clean, 0 problems |
| `npm run build` | rc 0; byte-identical to the branch point, 190 files |
| backend `pytest` (`backend/.venv`) | 2,080 passed |
| backend `ruff check .` (0.15.20) | all checks passed |
| `website/tools` `npm test` | 15 of 15 |

The +1 file and +7 tests against the branch point: `workflowActionPins.test.ts` (6 rows) less the moved Android row, and alphaCodes' two new work-done rows. No failure in any run of the final tree, so none to sort into pre-existing and mine.

---

## For later phases (found, not done here)

- `lifeListsLinearity.test.ts` "pass 3, 200 species repeated": both legs hold 200 species, so the row is an identical-input control (it reads 1.18 to 1.21), not a linearity check. A candidate for strand 2's ineffective-row work, with evidence class (a).
- `f64dbf25` (website/tools weather capture expects 1080x2021): `npm test` there passes 15 of 15 today, so the saved failure does not reproduce; strand 2 should confirm and close it.
- `pipeline/baseline-failures.json` was not re-recorded: the brief re-records it from every runner, which needs the gate's own runs (phase 2).
- ROADMAP's "Pin the actions in windows-build.yml, pipeline.yml and pages.yml" and "Move CI from Node 20 to Node 24" are now done on this branch, and the v1.0.70 D-12 allowance retires once CI is green; recording those is the Chronicler's at closeout.
- The CI timeout's 944 s figure should be re-measured from the draft pull request's runs (build now before the suite; the suite now runs the 20 bundle rows and skips the local-only rows).

---

# Phase 2

Phase 2 (brief "Scope and order" items 3 and 4, plus the gate's first GitHub reds, which the coordinator added mid-phase), The Engineer, 2026-11-20, on the dev Mac only. Same branch, continued from `350dd6f4`. Node 24.18.0, vitest 4.1.12, Playwright 1.62.1. Load averages are beside each reading; nothing of this session compiled during a timing reading, and every timing row was run alone. Harnesses live in this session's scratchpad (`.../scratchpad/p2/`), never in the repo; each snapshots its targets once, restores from the snapshot and checks the restore by SHA-256 against the intended content, and every scratch file placed in the tree was deleted before the next commit.

## A. Flaky and ineffective tests (the saved ideas)

| Idea | State | Commit |
|---|---|---|
| `5951387a` specificity helper never ends on an unclosed `[` | Done | `bbeea0ff` |
| `095bc19b` Clear-race rows cannot go red | Done | `74214db4` |
| `c82edfe2` memo headroom types figures by hand | Done | `e3249ec9` |
| `87bc0c34` AlertsInboxSheet Escape race | Done | `131dd875` |
| `87bc0c34` parseBarChart ratio row | Decided against a test change, with the residual measured (below) | none |
| `e62c8d06` three rows that fail only under load | Done (two rows); the third moved before this run | `9b757795` |
| `2396195c` taxonomy-history speed checks on the wall clock | Done before this run (`01581be0`, 2026-11-19); margin and control measured here | none |
| `337b21d6` palette check can skip its Escape test | Done | `0acda972` |
| Life Lists pass 3, 200 species repeated (phase 1's finding) | Relabelled as the control it is | `ed56f5d3` |
| `f64dbf25` website/tools weather capture test | Not reproducible (15 of 15 pass); CI step decided against (below) | none |
| `5f274893` cargo test on GitHub | Decided (below) | see item E |

### `5951387a`: the specificity helper (`frontend/src/test/cssSpecificity.ts`)
`simpleParts` set its cursor back to 0 on an attribute selector with no `]` (`indexOf` gives -1, so `end + 1` is 0) and looped forever. It now throws (fails closed; no committed stylesheet holds such a selector, the build would refuse it). The new row in `controlRegisters.test.ts` runs the function's own text in a `node:vm` context with a 2 s bound before calling it directly, because a `testTimeout` cannot interrupt a synchronous loop (testing.md v1.0.33). Seen red with the guard line removed: `Script execution timed out after 2000ms` in 2.0 s, no hung worker; restored by hash, control green. The first seen-red attempt filtered on a title word the row does not contain and ran nothing (31 skipped); it was re-run with the right filter, and that is recorded because a run that measures nothing reads like a pass.

### `095bc19b`: the Clear-race mock (`frontend/src/lib/clearDerived.test.ts`)
The shared storage mock parked a held read first and read after, so a parked load always got the post-purge disk. It now reads first and parks after, the order a Tauri chain link queued ahead of the purge's delete has (testing.md v1.0.62), counts the held read, and each row waits for that read and clears the hold before it purges (testing.md v1.0.14 rule 4: prove the interleaving claimed).

| Guard deleted (the indented `if (_store) return _store` after the await) | HEAD's park-first mock | Reads-first mock |
|---|---|---|
| none (control) | 37 of 37 green | 37 of 37 green |
| `exoticProvenanceCache.ts` | 37 of 37 green | red: its LOAD_RACES row and the escapee-name publish row |
| `checklistProjectsCache.ts` | 37 of 37 green | red: its LOAD_RACES row only |
| `countyCompletenessCache.ts` | 37 of 37 green | red: its LOAD_RACES row only |
| `countyDayObsCache.ts` | 37 of 37 green | red: its LOAD_RACES row only |
| `hotspotRegionCache.ts` | 37 of 37 green | red: its LOAD_RACES row only |

Each mutation matched exactly once and changed the file; all six files restored equal to their snapshot by hash; 37 of 37 after. (The idea said 51 rows; the file runs 37.)

### `c82edfe2`: memo headroom (`frontend/src/lib/speciesUtilsMemoBound.test.ts`)
The longest published name and the published-name count are now read from `ebird-taxonomy.json`'s `byCode` values when the test runs (18,631 distinct, longest 66 at the 2026 taxonomy), with a floor on each so a reader that matched nothing fails. Seen red against the asset: a 70-character name added (row red, "longest published name 70"), 400 names added ("19031 published names", red); HEAD's file stayed green with both added. Asset restored by hash.

### `87bc0c34`, first half: the AlertsInboxSheet Escape race
The Clear confirmation reaches its `enter` phase on an animation frame, outside `act`, so `findByRole` can resolve on that commit before the passive effect arms `ModalDialog`'s Escape listener. The row now waits for focus inside the dialog, which the same effect flush moves in (CLAUDE.md v1.0.25). Reproduced on demand with `ModalDialog`'s focus and listener effects each deferred:

| Row version | ModalDialog unchanged | both effects deferred one task (0 ms) | deferred 150 ms |
|---|---|---|---|
| HEAD | green | red | red |
| new | green | green | green |

### `87bc0c34`, second half: parseBarChart's ratio row, decided against a test change
The flaky row is the 512/513 names shape, whose large leg carries the residual the file already names: `tidy()` builds each name by `+=`, the collector's share grows faster than the input, and no clock removes it (testing.md v1.0.40 rule 3). Measured here (Node 24, load 1.7 to 2.4, three runs of the file): its second leg read 2.93, 1.58 and 2.35 against 3.2, every other shape 1.82 to 2.22. Raising the limit is forbidden, more rounds and forced collections were already measured worse, and the one change that retires it is application code (building the name in one piece in `tidy()`, saved idea `b1e71586`), outside this phase. Left unchanged, with the reading recorded; it is a candidate ride-along for the 1.0.75 release (flagged).

### `e62c8d06`: rows that failed only under load
- **`HotspotLink.test.tsx`, generated corpus.** About 2,800 renders, 1.0 s idle, 6.4 s under heavy load against vitest's 5 s default; it asserts no time, so it takes its own 30 s budget (testing.md v1.0.32). Seen red with a 500 ms default: HEAD's row fails at 988 ms, the new one passes.
- **`weatherStatsShared.test.ts`, doubling row.** One wall-clock sample per leg became `bestPerCallCpuMs` with legs (10k/20k/40k rows) and limit (under 3 per doubling) unchanged, and each leg's answer asserted. Node 24, load 1.7 to 2.4: 2.00 to 2.02 per doubling over three runs; a leg-against-itself control at the row's own settings 1.00, 1.00, 1.00. Seen red: the scan's `Set` replaced by a hand-written array search reads 235 to 814 ms per call (3.46) and turns only this row red (the file's source scan looks for `.includes(` and friends, so it stays green, as designed).
- **`taxonomyHistory.test.ts`.** Already on CPU time (`01581be0`). Its quotients, three runs: 3.99 to 4.09, 3.79 to 4.14, 3.49 to 3.66 and 3.70 to 4.07 against 9 (a quadratic reads about 16), the kept-form row 1.25 to 2.49; a 10k reference leg against itself 0.92, 0.97, 1.00.
- These rows keep gating on GitHub: none failed there in the 25 runs phase 1 read, and D-05's test is "reads steady there". A doubling quotient sits within 2x of both linear and quadratic by construction, so it never has the 2x margin testing.md v0.5.84 asks of an absolute; if one goes red on GitHub, the switch is the documented next step.

### `2396195c`: taxonomy-history speed checks
Moved to the CPU-time helper by `01581be0` (recorded-names-in-splits-and-lumps, 2026-11-19), legs and limits unchanged. A search of every frontend test file that calls `performance.now()` found no taxonomy-history timing left on the wall clock. Readings and control are above.

### `337b21d6`: the palette check's skipped Escape row (`website/tools/verify/verify-palette.mjs`)
Every run of the check is a cold start, so the Welcome screen must appear; the harness counted it once and skipped FR-50 on 0. It now waits for it (bounded, 10 s) and records a failure naming the reason when it never comes. Seen in Chromium and WebKit with scratch copies (deleted after) whose init script delays the cold-start reads by 2.5 s or refuses them:

| Harness | Welcome on time | 2.5 s late | never |
|---|---|---|---|
| HEAD | 24/24, FR-50 measured | FR-50 skipped, then unrelated rows failed | 22/22 PASS, FR-50 never measured |
| new | 24/24 | 24/24 | red: exactly the two FR-50 rows, "the Welcome screen never appeared on a cold start" |

### Life Lists pass 3, 200 species repeated
Both legs select the same 200 species, so the row cannot see a pass-3 defect: with `selectRows`' sort made quadratic (a selection sort, quadratic for any order) it read 1.38 and stayed green, while the distinct leg read 68.8 and the region press 30.6, both red. The smaller true change was the label: its title now says it is a fixed-size control (raw 1.17 to 1.18 on Node 24, floored to about 0.68) and its comment says what it cannot see; assertion, legs and limit unchanged.

## B. Rows that cannot fail: a mutation sample

Chosen where a silent pass would cost most: the Tauri CSP, capabilities and HTTP permit, the link and id gates, Clear and purge paths, TTL, upload refusals, the eBird gate, the passive-reader import graph, the entry chunk, and the publishing guards. Harness `scratchpad/p2/mut/probes/` (`spec*.mjs`, `run*.mjs`): every target file snapshotted once; each mutation must match exactly once and change the file; the named guard files run; the file is restored from the snapshot and checked by hash; a control over every guard file named runs green before and after each round (800, 646 and 383 rows). Load 1.7 to 3.4; the real-engine gate was running beside round 1, which loads the machine as a runner would.

**Denominator: 33 distinct mutations (38 runs).** 28 went red with the suite as it stands; 3 stayed green for a stated reason and were left; 2 stayed green because no row could fail, and those rows were repaired and seen red.

| # | Mutation | Guards run | Result |
|---|---|---|---|
| 1 | CSP `script-src` gains `'unsafe-eval'` | tauriCsp | red |
| 2 | CSP `form-action` `'none'` to `'self'` | tauriCsp | red |
| 3 | capability scoped to a second window | tauriCsp, androidProjectPins, singleWebviewInvariant | red (2 rows) |
| 4 | HTTP permit `https://api.ebird.org/*` (no fixed path segment) | tauriHttpScope | red (5) |
| 5 | HTTP permit `https://api.ebird.org/v*` | tauriHttpScope | red (5). I had labelled it the documented "broader prefix stays green" case; `v*` has no fixed segment, so the guard's floor refuses it. The guard was right |
| 6 | a service's base URL moved to an unpermitted host | tauriHttpScope | red (2) |
| 7 | the SINGLE-WEBVIEW INVARIANT marker removed from one of `replayStore.ts`'s two notes | singleWebviewInvariant | **green, left**: the file's second note still carries it, and the guard's claim is the marker per file |
| 8 | the marker removed from both notes | singleWebviewInvariant | red (2) |
| 9 | a monitor lookup added in a module iOS compiles | iosMonitorLookups | red |
| 10 | Help's link gate loosened to `/^https?:/i` | helpLinks | red (2) |
| 11 | CommentText's link gate loosened to `/^https?:/i` | CommentText, commentTextRegexBound, newTabLinkDispatch | **green: no row could fail** (`linkify` only yields `http(s)://`, so no input reaches the gate). Repaired: a source pin, comments stripped (security.md, deliberately redundant guards); red after |
| 12 | `SUBMISSION_ID_RE` without its `$` | ChecklistLink alone: green; with all nine suites that name it: red (5, through `checklistId.parity.test.ts`) | red (class (b) for ChecklistLink's own rows) |
| 13 | `LOCATION_ID_RE` without its `$` | all nine suites that name HotspotLink or the pattern | **green: no row could fail** (the wrong-shape row used `not-an-id`). Repaired: prefix-shaped ids added to that row; red after |
| 14 | `isValidChecklistId` ceiling 15 to 20 digits | checklistIdRegexBound, checklistId.parity | red (3) |
| 15 | OutboundLink dispatches a fixed URL, not its href | newTabLinkDispatch, OutboundLink | red (6) |
| 16 | `Button` loses its `tabIndex = 0` default | tabOrderCoverage, ButtonLink | red (2) |
| 17 | `allowInlineMediaFrame` true on Android | platformGates | red |
| 18 | the hotspot-region store's purge made a no-op in the Clear registry | clearDerived, cacheInventory | red (4) |
| 19 | `clearDerived.ts` gains a static import of a store | entryChunk | red (2) |
| 20 | the replay store's purge-generation check dropped from `put` | clearDerived, replayStore | red |
| 21 | the day cache's first purge-generation check (before `ensureLoaded`) dropped from the snapshot merge | countyDayObsCache, clearDerived | **green, left**: the re-check after the await is the protective one; dropping the first costs one store load after a purge, which the store's `loads` counter could pin if that is ever wanted |
| 22 | `isWithinTtl`'s 24 h future bound dropped | ttlWindow | red (3) |
| 23 | `refuseBySize` refuses nothing | uploadGuard | red (5) |
| 24 | a web/Pi DELETE loses `APP_REQUEST_HEADERS` | storage.settings | red (3) |
| 25 | `/map/county-day-obs` dropped from `EBIRD_GATED_PATHS` | transport, ebirdGate | red |
| 26 | eBird start spacing 150 to 100 ms | rateLimit, ebirdGate | red |
| 27 | the passive provenance reader gains a transport import | exoticProvenanceGraph | red (2) |
| 28 | `App.tsx` statically imports maplibre-gl | entryChunk | red |
| 29 | the F-Droid recipe's `CurrentVersionCode` one behind | fdroidRecipe | red (3) |
| 30 | one of the three Fastlane changelogs drifts | fastlaneMetadata | red (2) |
| 31 | `bundle.android.versionCode` one behind | androidVersionSource | red |
| 32 | `UIApplicationSupportsMultipleScenes` false in `Info.ios.plist` | iosSceneManifest | red (2) |
| 33 | the website version pill (text and label) one version behind, footer current | icloudKeysPublishedClaims | **green, left**: the weakness CLAUDE.md and docs-and-website.md already record (a `toContain` over the whole file; ROADMAP) |

Two of the 33 found a row that could not fail; both were repaired (`9b4cf3c9`). Taken with item A, phase 2 found and repaired eight rows that could not fail (the five Clear-race rows, the memo headroom row, and these two) and relabelled one that claimed more than it checked.

## C. Efficiency

Profiled per file with vitest's JSON reporter as GitHub runs the suite (`CI=1 SR_SKIP_LOCAL_ONLY_TIMING=1 --maxWorkers=1`, Node 24.18.0, a fresh `frontend/dist`). Before: 414 s wall, tests 283 s, environment 54 s, import 36 s, load 1.7 at start and 2.7 at the end (GitHub's latest red run: 789 s wall, tests 524 s, environment 114 s, import 80 s). Per-file test time (the JSON's per-file duration is its rows' time; import and environment are separate):

| File | Rows | Before (ms) | Where the time goes | Decision |
|---|---|---|---|---|
| components/Calendar.test.tsx | 86 | 24,875 | 86 full renders of 12 month grids, median 263 ms each, over a 7-row fixture; no real sleep, no asset parse | Left: the cost is the component's render. Sharing renders would couple 86 rows' state |
| lib/useChecklistProjects.test.tsx | 44 | 20,457 | Seven rows of 2.0 to 3.5 s that run the throttled emission and the 429 cooldown through the real gate on purpose, as their comments say (a rate claim is measured against a real-duration pass, ui.md v0.5.87) | Left, named as deliberately expensive: fake timers would remove the property |
| lib/taxonomyHistory.test.ts | 61 | 12,708 | One row 10.2 s: `snapshotCodes` re-read and re-parsed the 1.7 MB snapshot on each of 508 calls | **Reworked** (`1a3de084`): parsed once. The row 4.1 s, the file 6.7 s (single-file runs, load about 2); red on its tier-0 mutant |
| components/MapExplorerSearchThisArea.test.tsx | 65 | 11,229 | 65 Map Explorer renders, median 147 ms; no sleeps | Left: render cost, spread thin |
| lib/dateRangeFieldsCss.test.ts | 39 | 7,767 | Five rows of about 1 s: the cascade resolver asked jsdom to match every rule in `globals.css` on every query | **Reworked** (`6f11c8ac`): rules indexed by the property they declare; both resolvers agreed on all 2,812 queries; red on a phone-tier mutation |
| lib/hotspotReportsLinearity.test.ts, lib/paletteLocationsLinearity.test.ts | 18, 9 | 6,595, 6,436 | Deliberately expensive linearity legs | Left: the cost is the property |
| components/Settings.icloud.test.tsx, Settings.icloudKeys.test.tsx, calendarOverlaysOff.test.tsx, MapExplorerWidgetLink.test.tsx | 43, 30, 17, 56 | 6,237, 5,556, 5,845, 4,666 | Renders of Settings and the Calendar (the overlays file compares captured markup over eight scenarios and a round trip each, testing.md v1.0.38) at 110 to 360 ms each; no real sleeps over 300 ms | Left: under the few-seconds bar per change, or the cost is the property |
| components/AlertsInboxSheet.test.tsx | 22 | 5,662 | Renders; two 300 ms absence waits | Left: 0.6 s of waits, under the bar |

**Environment time.** The default environment is already `node`; 182 files opt into jsdom. A scan for jsdom files that touch no DOM API found two, and both are jsdom on purpose (`alphaCodeSearch.jsdom.test.ts` exists to run its roster under jsdom; `lifeListsRegionConvergence.test.ts` drives the real `storage.ts`). At about 0.3 s of environment per jsdom file here, converting any one would save less than the few-seconds bar, so none was converted.

After (same command, at `68f86672`, every phase-2 change in but the one-file readiness fix in section H): 524 files passed, 5 skipped; 11,509 passed, 28 skipped; 404 s wall, tests 271.5 s, environment 54.2 s, import 36.5 s; load 2.8 at start, 2.5 at the end. Summed per-file test time 279.8 s to 268.3 s (11.5 s): taxonomyHistory 12.7 to 6.7 s, dateRangeFieldsCss 7.8 to 1.0 s, and weatherStatsShared 2.7 to 4.0 s (its CPU-time form samples each leg seven times; its comment now says so). GitHub's own figures for the same steps come from the pull request's runs.

## G. The gate's first GitHub reds (run 44848092329, added by the coordinator mid-phase)

The first `Pipeline` run on the pull request passed lint, typecheck, build and vitest (8 min 40 s), and the real-engine gate, running there for the first time since 2026-11-09, failed 2 of its 9 harnesses.

### `verify-hotspot-reports.mjs`: "every tile label is one line wherever the tiles are two or more across"
Red in both engines at all four scales on GitHub (24, 28, 34 and 43 configurations), everything else green. Cause, established by measurement: the face. The app bundles no font; its stack is `'Inter', system-ui, 'Segoe UI', Roboto, sans-serif` (`--font-sans`, `globals.css`), so a harness that measures text measures the machine's resolution of it. Reproduced on this Mac with a scratch copy of the harness (sections 2 and 4, the glance tiles; deleted after) that defines the stack's first family as a chosen open face, waits until it has loaded, and prints the face Chromium used for a tile label (CDP `CSS.getPlatformFontsForNode`, the control that the override applied):

| Face (stands for) | Chromium face read | Wrapped configurations, 100 / 125 / 150 / 200% (Chromium and WebKit alike) |
|---|---|---|
| this Mac's own resolution (Mac, iPhone, iPad) | `.SF NS` | 0 / 0 / 0 / 0 |
| DejaVu Sans 2.37 (Ubuntu's default sans, the runner's fallback) | DejaVu Sans | **24 / 28 / 34 / 43**, and the phone pattern `414:336/2t/1f/2l` at 125%: GitHub's exact readings |
| Roboto, Google Fonts variable (Android) | Roboto | 0 / 0 / 0 / 0 |
| Selawik 1.01 (Microsoft's open, metric-compatible fallback for Segoe UI: Windows) | Selawik | 0 / 0 / 0 / 0 |
| Inter 4.0 (the stack's first family) | Inter Variable | 0 / 0 / 0 / 0 |

So the red was the runner's fallback face, wider than the face of every shipped platform, and not a defect a Mac, Windows, iPhone, iPad or Android user sees. The one kind of real viewer it describes is a Linux browser whose UI face has DejaVu Sans metrics opening the web/Pi build: there "Species per hour" takes two lines in a band of about 24px past each tile-track change. That is a cosmetic wrap (no overlap, no clipping; the harness's ink row stayed at 0px there), recorded as a known limitation and flagged; it would need the tile minimum (`.sr-hsr-tiles`, `minmax(min(8rem, 100%), 1fr)`, `globals.css` line 6653) or the label's tracking changed, a design decision for the user, not a phase-2 change.

The fix, in the harness's environment and not its assertion: `pipeline.yml` installs `fonts-inter` after the browsers, so the runner resolves the face the stack names first, and the harness prints `MEASURE <engine> face ...` (Chromium's own answer through CDP), so every GitHub reading now says which face it measured. Nothing was loosened. Checked with Inter in place: the whole gate run the way GitHub runs it (`run.mjs`), every context given Inter by a temporary swap of `playwright.mjs` (restored by hash), was 9 of 9 green in 725 s (load 2.2 to 2.6), Chromium reporting `Inter Variable`; and with Inter plus the label tracking widened to 0.16em (a plausible regression), the row went red at 33, 40, 40 and 43 configurations in both engines. The same gate with this Mac's own faces was 9 of 9 green in 705 s (load 1.8 to 3.4). The first forced attempt measured nothing: the wrapper spread Playwright's browser-type objects, dropping their prototype methods, so the gate's own Playwright check refused to start; it was rebuilt on the prototype before any reading was taken.

### `verify-plan-readout.mjs`: WebKit, no tide, 2x, 320px, `dWeek 1.00 dList 1.00`
Seen on GitHub twice (2026-10-08, saved idea `da77d628`, and this run), never on this Mac. Not reproduced here in four full runs (this Mac's faces, DejaVu Sans, Inter, and once more after the change), each 0.00px worst movement, nor in 48 targeted trials of the failing transition (1.5x at 1440px to 2x at 320px) in both engines, where the week row's computed size and position read the same immediately after the scale change, two frames later and 300 ms later. So the runner's face is ruled out and the cause is not established. What is established is that the harness broke testing.md v1.0.56 at exactly the failing reading: `MEASURE` set the text scale itself and read in the same task, confirming the scale on the root only, so the first width of each scale's sweep was the one reading taken across a scale change, and 320px @2x is the first width of the 2x sweep. The change: `applyScale` sets each scale once before its sweep and waits until `.sr-plan-week` (0.6875rem) reads 11px per unit of scale, then settles; and a failure now reports how many widths failed and each state's readout top and chart-box height, so a recurrence names the element that moved. Seen red: a scratch copy that moves the readout down 1px only while a pick is shown failed 55 of 55 widths in every sweep in both engines with GitHub's exact signature (`dH 0.00 dWeek 1.00 dList 1.00`); the neutered leg still reads "MOVES". If it recurs on GitHub, it is either a WebKit-on-Linux rounding at that one configuration or an app movement a Linux WebKit user could see; the new detail will say which box moved.

## E. Two CI-step decisions

### `5f274893`: a `cargo test` job, decided against in this phase
Measured: `cargo test --locked` on this Mac runs all 140 Rust tests green in 29 s on a warm `target/` (load 3.7 to 4.5); `Cargo.lock` and `Cargo.toml` equal by hash before and after. Against the cost bar (runs on ubuntu without the Apple-only code, caches well, adds little wall time):
- **Coverage on ubuntu is 76 of 140.** `icloud.rs` (64 tests, the regular-file, size-bound and symlink guards among them) is `cfg(any(target_os = "macos", target_os = "ios"))`; the rest (`window_geometry` 47, `widgets` 15, `worker_csp` 7, `lib` 4, `alerts` 3) compile on Linux.
- **It needs two things the workflow does not have.** The crate links Tauri, so the job installs the WebKitGTK development stack through apt, a second apt surface beside the one whose Chrome source already needed isolating; and `tauri::generate_context!` refuses to compile when `frontendDist` does not exist (tauri-codegen 2.6.2, `context.rs` line 189), so the job also needs `npm ci` and `npm run build`, or an artifact from the frontend job, which serializes the two.
- **Wall time** would be roughly nothing as a parallel job beside the 35 to 45 min frontend job, and it would cache through the already-pinned `Swatinem/rust-cache`; but its first runs would be unverified on Linux (it cannot run on this Mac), against a done-bar of three consecutive green runs.
- **Decision:** not added in this phase. The option that covers all 140 with no system packages is a `macos-latest` job (GitHub's macOS runners are free for a public repository), which is outside the stated bar and is a question for the user (flagged).

### `f64dbf25`: `website/tools` `npm test`, not reproducible, and no CI step
15 of 15 pass in 1.6 s on this Mac (phase 1 read the same). Cost on GitHub would be seconds, since the gate already installs the tooling and both browsers. But `compose-appstore.test.mjs` asserts each frame's caption against a fixed box in a real Chromium, and the composer's stack is `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, sans-serif`, which on the runner falls to a DejaVu-metric face (Inter is not in that stack). That is the same face-dependent surface the Hotspot Reports row just showed, so the step is out under its own condition (no new flake surface). Reversal: the composer naming a face the runner has, or the frames being composed on Linux.

## D. Housekeeping
- `pipeline/baseline-failures.json` re-recorded at the end (testing.md v1.0.43), after every runner the brief names had run on the final tree with no failure: the frontend suite three times locally and once as GitHub runs it, backend pytest, `website/tools` `npm test`, the real-engine gate, and `cargo test`. It names no failure, so its `updatedAt` is the only field that moves.
- An accidental `weft-scope baseline record --help` rewrote the file's `updatedAt` mid-phase (the subcommand takes stdin and treats `--help` as input); it was restored to HEAD at once, and the real record is the one above, made only after every runner the brief names had run.
- Rule and record text changed with the rows: testing.md (the specificity helper, the Clear-race mock, the memo-headroom instance) and CLAUDE.md (the headroom rule's open instance). `DECISIONS.md`, `ROADMAP.md` and `PRODUCT_CONTEXT.md` untouched.

## H. The pull request's second run (`44857230539`, at `9b68033c`)
Backend green; the frontend vitest step red on one row, so the build, the tooling install and the gate did not run there. The row: `useExoticProvenance.test.tsx` > "a store holding only a stamp (no record at all) reads settled", which expected `['complete']` and read `[]`. Pre-existing, in a file this branch had not touched, and green locally in Pacific time and under `TZ=UTC` (three runs each). Cause: the harness pushes each emission from a passive effect, which can run after the commit a DOM wait resolves on (testing.md's frozen-shell rule). Fixed in `7f37ba5e`: every row of that shape in the file waits for the emission list itself (the two exact lists after the settled-names render, the one after the TTL re-ask, and the sequence row's last emission); rows that filter earlier emissions or assert an absence were read and left, since a late push cannot turn them red. Reproduced on demand by deferring the harness's push by one task or 30 ms, dropping any push whose list was since reset (without that drop, a push from an earlier session polluted the next list and the model failed rows for its own reason): HEAD fails this row and the TTL row, the fixed rows pass; unmutated 48 of 48.

## Verification on the final tree (`7f37ba5e`, before the docs commit)

| Gate | Result |
|---|---|
| frontend full suite, local (Node 24, default workers, switch unset), three runs | 524 files passed, 5 skipped; 11,529 passed, 8 skipped (11,537) each time; 84, 83 and 86 s; load 2.2 at the first start (the suite itself drives it to 11 to 13) |
| the same as GitHub runs it (`CI=1 SR_SKIP_LOCAL_ONLY_TIMING=1 --maxWorkers=1`, fresh build), at `68f86672` | 524 passed, 5 skipped; 11,509 passed, 28 skipped (the 8 by design and the 20 local-only timing rows); 404 s, tests 271.5 s; load 2.5 to 2.8 |
| `npm run typecheck`, `npm run lint` | clean, 0 problems |
| `npm run build` | rc 0; byte-identical to a fresh build of `main` (`18977177`) over all 190 files in `frontend/dist`, checked on the final tree after the last test-comment edit; `main` built twice for the determinism control |
| backend `pytest` (`backend/.venv`) | 2,080 passed |
| `website/tools` `npm test` | 15 of 15 |
| real-engine gate, `run.mjs` as GitHub runs it | 9 of 9 with this Mac's faces (705 s); 9 of 9 with Inter forced (725 s) |
| `cargo test --locked` (`src-tauri`) | 140 passed; `Cargo.lock` and `Cargo.toml` equal by hash before and after |
| `git status` | clean apart from this phase's commits |

Against phase 1's final tree (11,527 passed locally): +2 rows, the specificity helper's and CommentText's source pin.

Runs started on GitHub in phase 2: `44857230539` (at `9b68033c`, red as above), and the one the docs commit starts.
