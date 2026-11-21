# Evaluator notes: security-bloat-deps-and-tests-cleanup

Measured 2026-11-20 on the dev Mac at `main` (18977177), read-only. Each figure names its source so it can be re-measured rather than repeated.

## 1. GitHub checks (`Pipeline` workflow)

- **Last green on `main`:** 2026-11-09, `b98884b1` (1.0.67 iOS stamp). Of the last 100 runs on `main`: 19 success, 41 failure, 40 cancelled (`cancel-in-progress` on quick re-pushes).
- **Where it fails:** the 25 most recent failed runs (2026-11-09 to 2026-11-20) all fail in the Frontend job's `npm run test -- --maxWorkers=1` step. Backend (ruff, pytest) is green in every one.
- **Which files:** `src/lib/lifeListsLinearity.test.ts` fails in 24 of 25 runs and is the only failing file in 20 of them; `src/lib/alphaCodes.test.ts` fails in 5 of 25. No other test file failed in any of the 25.
- **Which rows:**
  - `lifeListsLinearity`: CPU-time quotients of 500 against 5,000 rows, limit 20 (`LIMIT`, line 77), 7 rounds. Failing rows are pass 1 (every row its own species), pass 1R and pass 2R (region index and assets, three leg shapes). CI readings 20.33 to 48.16. A real quadratic reads about 99 (DECISIONS.md, v1.0.70 D-12), so the noise reaches half the defect's signal: 2x is not margin (testing.md v0.5.84).
  - `alphaCodes`: "published names, a code query", a per-doubling CPU quotient read 3.35 against 3.2, with legs of 0.54 to 5.76 ms. That is the few-millisecond case testing.md v1.0.74 says needs 25 rounds of about 100 ms samples and an identical-input control; the row uses the defaults.
- **Consequence:** `npm run build`, the tooling install, the browser install and the real-engine gate (9 harnesses under `website/tools/verify/`) are skipped on every red run, so none has run on GitHub since 2026-11-09. `verify-hotspot-reports.mjs` (1,800 s budget) and the 90-minute job bound have never run there (DECISIONS.md, the hotspot-report-order-and-stats entry). Expect the gate's first GitHub runs to surface their own reds.
- **Rows that always skip on CI:** the test step runs before the build, so 20 rows that read `frontend/dist` skip on every run: `entryChunk.test.ts` (6, the post-build modulepreload rows behind testing.md's v1.0.63 first-paint rule), `targetsSortSelectCss.test.ts` (10), `mapFabCascade.test.ts` (4). Locally they run only when some `dist/` exists, which may be stale. A gate that skips silently reports "not run" as "verified" (testing.md v1.0.16).
- **Not run anywhere in CI:** `website/tools` `npm test` (3 `node:test` files; idea `f64dbf25` is a known failure there) and the 140 Rust `#[test]` rows in 6 files under `src-tauri/src` (idea `5f274893`). `pipeline/baseline-failures.json` is empty, last updated 2026-10-03.
- **Suite time on CI:** the vitest step took 433 to 799 s across the 25 runs for near-identical test counts (10,790 to 11,527 tests), against 407 s on the last green run. The spread clusters (about 450, 570 and 740 s), which reads like different runner hardware. Latest run: 789 s wall, of which tests 524 s, environment 114 s, import 80 s.
- **Local lead (hypothesis, not a finding):** on the dev Mac at load average about 20, both failing files passed once under Node 24 (35 of 35). Under Node 20.20.2, run 1 failed pass 1 at 21.27 against 20 and run 2 passed. CI runs Node 20; the Mac release, `.nvmrc` and the Android build run 24. Two samples settle nothing; it is worth measuring before sizing any leg.

### Slowest test files on CI (latest run, one worker)

| File | Tests | ms |
|---|---|---|
| components/Calendar.test.tsx | 86 | 43,401 |
| lib/lifeListsLinearity.test.ts | 20 | 28,393 |
| components/MapExplorerSearchThisArea.test.tsx | 65 | 25,894 |
| lib/taxonomyHistory.test.ts | 61 | 23,412 |
| lib/useChecklistProjects.test.tsx | 44 | 20,354 |
| lib/dateRangeFieldsCss.test.ts | 39 | 13,428 |
| components/Settings.icloud.test.tsx | 43 | 11,584 |
| components/calendarOverlaysOff.test.tsx | 17 | 11,422 |
| components/MapExplorerWidgetLink.test.tsx | 56 | 10,808 |
| components/Settings.icloudKeys.test.tsx | 30 | 10,079 |

Across 523 timed files: the top 10 take 38% of test time, the top 25 take 56%, the top 50 take 74%.

## 2. Test estate

- Frontend: 528 test files (11,527 tests on CI, 29 skipped by design or by the missing `dist/`) beside 419 non-test source files.
- Of the frontend test files: 12 use the CPU-time helper (`src/test/cpuTiming.ts`), 26 call `performance.now()`, and 188 read source text with `readFileSync` (source-shape guards, which tie a module's text to a test).
- Backend: 36 `test_*.py` files; pytest runs in about 6 s on CI.
- `website/tools`: 3 `node:test` files plus 9 verify harnesses.
- Native: 140 Rust tests in 6 files; 17 Swift test files (Xcode on the Mac only, out of scope).

## 3. Dependency advisories

Run online (never `--offline`), both scopes.

| Tree | Scope | Result |
|---|---|---|
| frontend | shipped (`--omit=dev`) | 0 |
| frontend | full | 11: 2 High, 9 Moderate |
| website/tools | full and `--omit=dev` | 1 High |

- frontend High: `undici` 7.30.0 through `jsdom` 29.1.1 (the test environment) and `zod` 4.4.3 through `eslint-plugin-react-hooks` (lint). Moderate: one `minimatch` root through `eslint` and `typescript-eslint` (nine entries). All report a fix without `--force`. Dev-only, so no release (idea `845a6bf0`; ROADMAP line 49).
- website/tools High: `sharp` 0.35.4, direct, fix 0.35.5 (not a major). It is screenshot tooling, not shipped (idea `0d2eba38`). Its condition, that the current App Store screenshot set is uploaded, has been met since 1.0.61.
- Python: `pip-audit` is not installed. An OSV batch query over the 31 packages resolved in `backend/.venv` found 0 advisories. Two caveats: CI installs on Python 3.11 while the local venv is 3.15.2, and `requirements.txt` pins only the 7 direct packages, so CI's transitive set floats.
- Cargo: neither `cargo-audit` nor `cargo-deny` is installed. An OSV batch query over the 622 crates.io packages in `src-tauri/Cargo.lock` found 25 with entries. A lockfile entry is not reachability, so each needs a class.
  - **In the shipped graph, network trust:** `rustls` 0.23.40, `rustls-webpki` 0.103.13 ("may accept distrusted intermediates"), `webpki-roots` 1.0.7 and `webpki-root-certs` 1.0.7 (distrusted emSign intermediates), and `h2` 0.4.14. All come in through `reqwest` under `tauri`, `tauri-plugin-http` and `tauri-plugin-updater`, so they sit under the app's own HTTPS requests.
  - **Archive and XML:** `zip` 4.6.1 through `tauri-plugin-updater` (desktop only; it extracts an archive only after its minisign check), and `quick-xml` 0.39.4 through `plist` under `tauri`.
  - **Unsound, low reach:** `anyhow`, `event-listener`, `glib` (Linux), `rustix`, `tokio`.
  - **Unmaintained:** `chrono`, `proc-macro-error`, five `unic-*` crates, `zbus_names`, `zvariant`.
  - **In the lockfile but in no target's normal graph:** `quinn-proto` and `quinn-udp`.
  - Any `Cargo.lock` change alters the shipped binary, so it is release work, and a precise `cargo update -p <crate>` must keep the vendored `tao` patch (`src-tauri/vendor/tao/VENDORED.md`).

## 4. GitHub Actions

- `android-build.yml` pins every action by commit SHA, and `androidProjectPins.test.ts` refuses a mutable ref there.
- `pipeline.yml`, `pages.yml` and `windows-build.yml` use mutable tags. `windows-build.yml` builds the shipped Windows installer, which `release.sh` re-signs locally, and it uses the third-party `dtolnay/rust-toolchain@stable` and `Swatinem/rust-cache@v2`, so a moved tag runs someone else's code inside a release build.
- Every workflow states `permissions: contents: read` or narrower.
- Node: `pipeline.yml` and `windows-build.yml` pin `'20'` (past end of life). `.nvmrc` is 24, `release.sh` refuses a mismatch on the Mac, and the Android build reads its Node major from its pins.

## 5. Unused code and exposed surface (first pass, leads for the Engineer)

- **Tauri commands:** 32 `#[tauri::command]` functions, and 29 have a caller by string in `frontend/src` app code. The three without one are `get_api_key`, `set_api_key` and `delete_api_key` (`src-tauri/src/lib.rs` lines 46 to 70), the system-keychain path reversed in v0.3.16 (DECISIONS.md around line 4401; CLAUDE.md "Do not use ... the system Keychain"). They are still in `generate_handler!`, and `build.rs` is a plain `tauri_build::build()` with no app manifest, so any script in the webview can call them. `keyring = "3"` is declared with no features. No test, rule file or published copy names them.
- **Frontend runtime dependencies:** all 15 are imported by app code.
- **Frontend modules with no non-test importer:** 15, and every one is a test helper by design (`src/test/*`, `test-setup.ts`, `lib/cssTopLevelRules.ts`, `lib/regexSweepGuards.ts`, `lib/webviewFloor.ts`, two `fixtureBuild` files). File-level dead code in the shipped frontend looks close to zero. Unused exports inside used files are not measured yet (knip's job).
- **Backend routes:** 38 in total; a sample of 13 all have callers. `/settings/map-defaults` has no literal caller and is reached through `storage.setSetting('map-defaults')` on the generic `/settings/{key}` path.
- **Capabilities:**
  - `core:webview:allow-set-webview-zoom` has no app caller, but it backs `zoomHotkeysEnabled: true` (Tauri's own injected hotkey script), which ACCESSIBILITY.md promises ("the desktop app enables the same zoom hotkeys"). Keep it.
  - `process:allow-exit` has no `exit(` call in app code (only `relaunch()`). It is a candidate, but it needs a dev-mode probe of the update path before removal.
  - `opener:default` grants more than opening URLs and is a candidate for narrowing.
  - `core:default` is wide by design. Do not narrow it in this run.
- **Suppressions:** `alerts.rs` and `widgets.rs` carry `allow(dead_code)` off iOS on purpose (iOS-only modules compiled on desktop for their tests).

## 6. Tools and how to run them without global installs

- Already on: `noUnusedLocals` and `noUnusedParameters` (tsconfig), eslint at defaults, and ruff's default rules (unused imports and locals).
- Missing: knip, ts-prune, vulture, pip-audit, cargo-audit and cargo-deny.
- **knip:** `npx knip@<exact version>` from `frontend/`, with entry points for `main.tsx`, every `new Worker(new URL(...))`, `vite.config.ts`, `src/test/*` and the test files. Do not add it to `package.json` unless the run decides to keep it as a guard.
- **pip-audit and vulture:** `python3 -m venv <scratch>/audit-venv`, then `<scratch>/audit-venv/bin/pip install pip-audit vulture`. Run `pip-audit -r backend/requirements.txt`, then audit a Python 3.11 resolution as CI installs it. Run `vulture backend --exclude .venv,tests` with a whitelist for FastAPI decorators and pydantic validators.
- **cargo-audit:** `cargo install cargo-audit --locked --root <scratch>/cargo-tools`, then `<scratch>/cargo-tools/bin/cargo-audit audit` in `src-tauri` (it fetches the advisory database over the network). The OSV batch query used here is the no-install fallback.
- **False-positive traps:**
  - dynamic `import()` (`clearDerived.ts`, lazy tabs, the iCloud controller)
  - workers built with `new URL`
  - `?raw` imports (`docs/HELP.md`)
  - `lib/tauri/` services reached through `TauriTransport`'s path tables
  - Tauri commands invoked by string
  - `_reset*ForTests` and `_set*ForTests` seams, and production purge exports reached through the Clear registry
  - 188 source-text guards (removing a module or a comment can break a guard that reads it)
  - templated backend paths
  - capability entries used by Tauri's own scripts
  - iOS-only Rust behind `cfg`
  - Tailwind scanning `frontend/` test files as sources, so deleting a test file can drop a rule from the shipped CSS

## 7. Saved ideas, in or out

| Id | What | Decision |
|---|---|---|
| c6328b4a | two timing tests red on GitHub since 1.0.67; baseline stale | In (stability, first) |
| f79a03a9 | whether speed-ratio checks run on GitHub's shared machines | In (settled by the bar in the brief) |
| 845a6bf0 | 11 dev advisories, 2 High | In (no release) |
| 0d2eba38 | sharp 0.35.5 in website/tools | In (no release; composed frames byte-identical) |
| e62c8d06 | three tests fail only under heavy load | In |
| 87bc0c34 | AlertsInboxSheet Escape race; parseBarChart ratio | In |
| 2396195c | taxonomy-history speed checks on the wall clock | In |
| 095bc19b | clearDerived.test.ts Clear-race rows cannot go red | In (ineffective test) |
| 337b21d6 | palette check can skip its Escape test and pass | In (ineffective gate) |
| da77d628 | verify-plan-readout failed once on CI | In, observe first once the gate runs again |
| c82edfe2 | memo-headroom test types figures by hand | In (testing.md names it open) |
| 5951387a | specificity helper hangs on an unclosed bracket; probe URL prefix match | In for the helper; the archived probe scripts are out |
| f64dbf25 | website/tools weather capture test fails | In (fix it or drop it with evidence) |
| 5f274893 | CI runs no cargo test | In only if a job fits the cost bar; otherwise record the decision |
| c45dfc4e | old install warning for a Mac-only helper | In (noise that hides new warnings) |
| b1e71586 | bar-chart reader memory | Out (shipped-code performance fix, own lane) |
| one-off defect fixes | contrast (d4911df4, b54b4bfb, 8550e2f5), hand-edited-backup crashes (25608818, 7cd17abc, 47faa2a0, 8feceed1), id and type shape (3eb8682b, c5fa8455, c7cf73d6, 892c158d) and the rest | Out, own lane. If strand 4 ships a release, the security-flavoured ones (3eb8682b, c7cf73d6, c5fa8455, 25608818) are natural ride-alongs, but only by a separate decision |
