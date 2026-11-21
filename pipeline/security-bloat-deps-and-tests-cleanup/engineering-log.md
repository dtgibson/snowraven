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
