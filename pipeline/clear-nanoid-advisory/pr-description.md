# clear-nanoid-advisory

## What this does
Clears the high-severity npm audit advisory GHSA-2v37-7h3g-55p8 ("nanoid: custom
generators can loop indefinitely when size is zero") by refreshing exactly one
package in `frontend/package-lock.json`: `nanoid` 3.3.17 -> 3.3.18. The chain is
`vite` (devDependency) -> `postcss` -> `nanoid`; postcss declares `^3.3.17`, so
the bump is semver-compatible and plain `npm audit fix` sufficed. No override, no
`package.json` edit, root lockfile untouched. This is a dev-only toolchain change:
nanoid appears in no shipped asset, and the built bundle is proven byte-identical
below.

## How to test
All gates were run under `set -o pipefail` with echoed exit statuses.

1. `cd frontend && npm audit` -> `found 0 vulnerabilities` (exit 0). Before the
   fix it reported 1 high (GHSA-2v37-7h3g-55p8, exit 1).
2. Repo root `npm audit` -> `found 0 vulnerabilities` (exit 0), unchanged.
3. `git diff` touches only `frontend/package-lock.json`; every `package.json` and
   the root `package-lock.json` are untouched.
4. Byte-identity: `cd frontend && npm run build`, then hash every file in `dist/`
   (`find . -type f -print0 | sort -z | xargs -0 shasum -a 256`) and diff the
   manifest against `pipeline/clear-nanoid-advisory/verification/dist-baseline-1.sha256`.
   Expect zero differences across all 114 files.
5. `npm run typecheck` -> exit 0. Vitest smoke (`checklistId.parity.test.ts`,
   `checklistIdRegexBound.test.ts`, `cssTopLevelRules.test.ts`) -> 88/88 passed,
   exit 0.

## Notes for reviewer
- **Byte-identity proof (the v0.5.85 measurement rule: measured, not inspected).**
  The pre-change HEAD state was built twice from `frontend/` in the same directory
  with the same toolchain (Node v24.18.0, npm 11.16.0, per `.nvmrc`) as a
  determinism control: the two baseline SHA-256 manifests are identical (114
  files, `diff` exit 0), so a manifest diff is a valid comparator with no
  hash-embedding or timestamp caveats. The post-fix rebuild's manifest is
  byte-identical to the baseline: every one of the 114 `dist/` files has the same
  SHA-256. Manifests are checked in under
  `pipeline/clear-nanoid-advisory/verification/` (`dist-baseline-1.sha256`,
  `dist-baseline-2.sha256` for the control, `dist-postfix.sha256`).
- **One flagged extra hunk, mechanical and expected.** Besides the nanoid
  version/resolved/integrity triple, the lockfile's own recorded `version` field
  synced `0.5.86` -> `0.5.89` (two lines). `frontend/package.json` has been
  committed at 0.5.89 since ae584d9; version bumps edit only `package.json`, and
  npm resyncs the lockfile's copy of that field on its next lockfile write, which
  this was. It is metadata catching up to committed truth, not a dependency
  change; `npm audit fix` itself reported "changed 1 package". The complete
  non-nanoid diff is exactly those two version lines.
- **No changelog line, no version bump, no release.** Per the CLAUDE.md
  versioning rule, a dev-only/toolchain change with a byte-identical bundle gets
  no version bump, changelog entry, tag, or release; it reaches the release
  machine on the next `git pull`. Precedents: the `dev-dependency-cleanup`
  `undici` patch and the Node-25 release-tooling fix. This build therefore
  contributes NO line to the Spool bundle's release notes; the record lives in
  the commit message and the ROADMAP item's closure.
- The advisory was pre-existing (already in v0.5.88's lockfile) and build-time
  only; clearing it removes standing noise from every release preflight.
