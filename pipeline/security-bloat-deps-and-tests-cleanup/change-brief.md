# Change Brief: Security, bloat, dependencies and tests cleanup

## What is changing
Four strands, ordered by the user's priority of stability and efficiency. Measurements are in `evaluator-notes.md` in this folder.
1. **GitHub checks.** A red mark goes back to meaning a real problem. The `Pipeline` Frontend job's vitest step turns green on GitHub with no allowance in force. The build step and the real-engine gate (9 Playwright harnesses) then run there again; they have been skipped since 2026-11-09.
2. **Tests.** Rows that cannot fail, skip silently, duplicate another row, or cost far more than they buy are reworked or dropped under the bar below. The slowest files are profiled and reworked where a cheaper form keeps the property.
3. **Dependencies.** The dev-tree advisories are fixed: frontend has 2 High and 9 Moderate, and `website/tools` has `sharp`. The three workflows still on tags get every action pinned by commit SHA. CI's Node follows `.nvmrc` if the user agrees. Python and Cargo audits are run and every finding gets a written disposition.
4. **Shipped code.** An evidence-backed inventory of dead code and exposed surface across `frontend/src`, `backend/` and `src-tauri/`. The one confirmed item so far: the three system-keychain commands and the `keyring` crate. They have had no caller since v0.3.16, yet any script in the webview can still call them. Their removal, plus a precise Cargo update for the certificate and TLS advisories in the native build, ships as one release, and only on the user's yes.

## Why now
- `Pipeline` has been red on every push to `main` since 1.0.67. All 25 of the latest failures are the vitest step: `lifeListsLinearity.test.ts` in 24, `alphaCodes.test.ts` in 5, nothing else. Backend is green throughout.
- Releases 1.0.70 to 1.0.74 shipped under a written allowance for those rows (v1.0.70 D-12) plus same-commit re-runs. A red run no longer stops anything, and the build and gate have gone 11 days without running on GitHub.
- 20 bundle rows skip on every CI run because the tests run before the build.
- Saved ideas `c6328b4a`, `845a6bf0` and `f79a03a9` asked for this work. The dev advisories have been open since 1.0.61. CI runs Node 20, which is past end of life, while the Mac release and the Android build run 24.
- The user's words: "If certain tests are ineffective or inefficient we do not need to keep running them"; "The priority is stability and efficiency."

## User-facing impact
Default: none.
- **Strands 1 to 3** touch only tests, CI workflows and dev-tool lockfiles. No version bump, changelog, tag or release; they commit to `main`.
- **Strand 4, if approved,** is a patch release with nothing visible: the removed commands have no caller, and the Cargo update swaps libraries under the app's own HTTPS requests. Its What's New sentence and the three F-Droid changelogs are published copy that waits for the user's yes. The user's iPhone launch check of the uploaded build applies.
- **Published claims:** a removal that would make one false is flagged, not made. The zoom permission behind ACCESSIBILITY.md's zoom-hotkey promise is the known trap.

## Design pass
Not needed: no visual change. Nothing here alters how any screen looks or behaves.

## Decisions touched
- **v1.0.70 D-12, its 1.0.73 extension to `paletteLocationsLinearity`, and v1.0.64 D-17** (red timing rows may ship): RETIRED once CI is green. A red run of record stops the ship again.
- **ROADMAP "Pipeline Frontend job fails intermittently: stabilise, or rule it advisory"** (v1.0.18, corrected v1.0.30): DECIDED as stabilise, by the user's direction.
- **ROADMAP "Move CI from Node 20 to Node 24"** (open since 1.0.46): open question in the hand-back. On a yes, testing.md's v1.0.46 Node 20 sizing rule is restated against the Node CI runs.
- **testing.md timing rules** (v0.5.84 margin, v1.0.21 honest forms, v1.0.40 CPU time, v1.0.46, v1.0.63 floored leg, v1.0.74 25 rounds): APPLIED to every reworked row. Where a rule file names a file whose row changes (`parseBarChart` 512/513, `lifeListsLinearity`, `speciesUtilsMemoBound`, `clearDerived` LOAD_RACES), that rule text is updated in the same change.
- **testing.md v1.0.16** (audit online, both scopes, with a control) and **v1.0.43** (baseline check): APPLIED. `pipeline/baseline-failures.json` is re-recorded from every runner.
- **DECISIONS.md v0.3.16** keychain reversal and **CLAUDE.md "Do not use the system Keychain"**: COMPLETED if strand 4 ships.
- **`android-build.yml`'s SHA-pin convention:** EXTENDED to the other three workflows. The workflow's 90-minute timeout arithmetic is recounted if a harness budget changes.

## Scope and order
1. **Stability first:** rework the failing rows in `lifeListsLinearity` and `alphaCodes` (`c6328b4a`, `f79a03a9`), and make the 20 bundle rows run after the build.
2. **Then watch** three full CI runs with the gate on, and fix what the gate shows (`da77d628`, `337b21d6`).
3. **Flaky and ineffective tests:** `e62c8d06`, `87bc0c34`, `2396195c`, `095bc19b`, `c82edfe2`, `f64dbf25` (`website/tools` `npm test`, which no CI step runs), and the hang in `5951387a`'s specificity helper.
4. **Efficiency:** profile per file. The top 50 of 523 files take 74% of test time; rework the costliest where a cheaper form keeps the property.
5. **Dependencies, no release:** a lockfile-only audit fix in `frontend/` (`845a6bf0`); `sharp` 0.35.5 with composed frames byte-identical (`0d2eba38`); SHA pins; Node 24 on a yes; `c45dfc4e`; a `cargo test` job only if it fits a stated cost bar (`5f274893`).
6. **Shipped code, a release only on a yes:** inventory with knip, vulture, a command-caller check and a capability check, and remove only what is proven dead. That covers the keychain commands and `keyring`, plus a per-crate `cargo update -p` for `rustls-webpki`, `webpki-roots`, `rustls`, `h2`, `zip` and `quick-xml`, shipped as one 1.0.75 to every platform.

**Out of scope:** the saved one-off defect fixes (contrast, hand-edited-backup crashes, id-shape checks, `b1e71586`), which keep their own lane; Swift tests; narrowing `core:default`; any published copy.

## Method and removal bar
- **Dropping a test needs one of three kinds of evidence:** a mutation that removes the guarded thing leaves it green and no small fix can make it go red; or another named row goes red on the same mutants; or its cost is out of proportion and a cheaper form is shown going red on the same defect. Each drop gets a line in a removal ledger in this folder.
- **Timing rows.** A row keeps gating on GitHub only in a form that reads steady there: a work count or a structural assertion first. Failing that, a same-run CPU quotient whose margin is measured on CI's Node, with a control reading about 1.00x. A row that cannot reach that runs in the local full suite behind one named switch, and the file says so. Never raise a limit to fit a reading. Each reworked row is seen red against its own defect.
- **Removing code needs all four:** no caller by import or by string (dynamic `import()`, workers, `?raw`, `TauriTransport` tables, string-invoked commands and templated routes all count); no guard that reads its text; no published claim that rests on it; and a green build and green full suites afterwards. Tool output is a lead, never the evidence.
- **"No bundle change" is measured,** not claimed: byte-compare the built CSS and JS against a HEAD build. Tailwind scans test files, so a deleted test or comment can move the shipped stylesheet.
- **Dependency changes:** audit online in both scopes with the old lockfile as the control; keep diffs lockfile-only; run both `npm run build` and `eslint`; and make Cargo updates per-crate, keeping the vendored `tao` patch.

## What done looks like
- `Pipeline` is green on `main` for three consecutive pushes with every step run (vitest, build, real-engine gate), and no allowance is in force.
- Audits: frontend full tree 0 High (each Moderate fixed or written down), shipped scope 0, `website/tools` 0 High. pip-audit and cargo-audit are run and every finding has a disposition. Every action in every workflow is pinned by SHA.
- A removal ledger lists each dropped or reworked test with its evidence, beside CI vitest time before and after.
- If strand 4 is approved: the keychain commands and `keyring` are gone, a guard checks that every registered Tauri command has a frontend caller, and 1.0.75 has shipped on every leg.
