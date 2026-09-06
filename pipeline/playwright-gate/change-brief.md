# Change Brief — Playwright Gate

## What is changing

Promote **3 of the repo's 14 committed real-engine Playwright harnesses** from hand-run `pipeline/` artifacts to a post-build gate: a stable tracked home at `website/tools/verify/`, one runner with an npm script, and one CI step in `pipeline.yml`'s frontend job immediately after `npm run build`. **The dependency is declared, not skipped:** `website/tools/package.json` and `package-lock.json` are un-ignored and committed (they are untracked today, see below), and the runner **exits 1 when `CI` is set** and Playwright cannot be resolved, while printing a loud non-zero-cost skip locally. One shared apparatus module (`serveDist.mjs`) replaces the two near-duplicate static-file servers, carrying the `Object.hasOwn` MIME guard the backlog harness's own header requests at promotion and the path-traversal `normalize` only one of the two has today. In scope: `verify-backlog-alert.mjs`, `verify-palette.mjs`, `verify-webkit-tab-premise.mjs`. Deferred: the 10 `nav-rework` harnesses and `verify-design.mjs`.

## Why now

The premise the idea was written on has moved twice, both times in ways that make the work more urgent and its shape different. **First, there are now 14 harnesses, not 2** — this spin added `verify-palette.mjs` and `verify-design.mjs`, and `nav-rework` contributed 10. All 14 are tracked (`pipeline/.gitignore` covers only `handoff.md`, `how-to-see.md` and the run records, so the v1.0.12 gitignored-file trap does **not** apply here). **Second, and this is the crux: `website/tools/package.json` and `package-lock.json` are gitignored and untracked.** A fresh clone gets five `.mjs` files and a README — Playwright is declared **nowhere in this repository**, so every one of the 14 harnesses fails at `createRequire` on any machine but this one, and so does the existing screenshot tooling. ROADMAP:68's recommendation ("a `verify:regions`-style script in `website/tools/package.json`") is written against a file that is not in the repo and cannot be executed as written. `.claude/rules/testing.md:99` already carries the rule this work implements: a harness that skips when its dependency is missing is worse than no harness at all.

## User-facing impact

None. Developer tooling and CI configuration only; no shipped file, no surface, no behavior, no schema. The frontend bundle is byte-identical, so per CLAUDE.md's dev-only rule this needs no version bump, changelog entry, tag, or release.

## Design pass

**Not needed — no visual change.** Nothing rendered to a user is touched. The work is a runner, a shared server module, two path parameterisations, a `.gitignore` correction, and one CI step.

## Decisions touched

- **`DECISIONS.md` v1.0.16** (*"The WebKit default tab mode is a platform fact…"*) — three passages. It records that both harnesses "stay hand-run rather than being wired in with a silent skip", that neither is wired into CI, and that promotion must single-source the exceptions allowlist. This build **discharges** the first two and **defers** the third with a reason.
- **`DECISIONS.md` v1.0.15** (*"A focus trap must contain on `focusin`…"*) — touched only by adjacency: `lib/useFocusTrap.ts` restates the exclusions roster in prose. **Not modified here** (see flags).
- **`ROADMAP.md`:68** — the promotion item itself. Its recommended option is amended, not followed: it assumes a tracked `website/tools/package.json`. Strike it in the same bundle, per the repo's own standing rule.
- **`website/tools/.gitignore`** — reversing its `package.json` / `package-lock.json` lines. Read as a **correction of a mis-grouping** rather than a reversal: those two are manifests, grouped by oversight with three genuine artifacts (`node_modules/`, `demo-data/`, `shots/`). Naming it either way is required; The Engineer should not do it silently.

## What done looks like

A fresh clone plus `npm ci --prefix website/tools` and `npx playwright install chromium webkit` runs `npm run verify --prefix website/tools -- <dist>` green against a built `frontend/dist`, in both Chromium and WebKit. The gate is **proven to discriminate, not merely to pass**: `verify-backlog-alert.mjs` still fails ≥4 checks against a pre-fix build via its `--expect-broken` mode, which is the property that makes it a measurement. **Non-vacuity is proven directly:** with Playwright uninstalled and `CI=1`, the runner exits **1** and says why; with `CI` unset it exits 0 with a loud skip. Both parameterised harnesses run with no `/Users/developer` path anywhere in the tree. The CI step is attached after `npm run build` and is red when a harness is red.
