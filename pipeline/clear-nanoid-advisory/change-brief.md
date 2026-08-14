# Change Brief — clear-nanoid-advisory

## What is changing
`frontend/package-lock.json` gets a one-package refresh: `nanoid` 3.3.17 → 3.3.18,
clearing the high npm audit advisory GHSA-2v37-7h3g-55p8 ("custom generators can
loop indefinitely when size is zero"). The chain is `vite@8.0.16` (devDependency) →
`postcss@8.5.26` → `nanoid`; postcss declares `^3.3.17`, so 3.3.18 is
semver-compatible and plain `npm audit fix` suffices — no override, no
`package.json` edit. The root lockfile is already clean (0 vulnerabilities, no
nanoid) and is untouched. Verified: `npm audit fix --dry-run` changes exactly one
package and nothing else.

## Why now
Found during the v0.5.89 release preflight and scheduled in ROADMAP.md ("Clear the
`nanoid` npm audit advisory"). It was already in v0.5.88's lockfile, so it is
pre-existing and build-time only — but a high-severity advisory firing on every
`npm audit` / release preflight is noise that hides a real future finding. The fix
is one dry-run-verified package bump; clearing it now costs minutes.

## User-facing impact
None. nanoid appears in no `frontend/dist` asset (grep-verified); it is reachable
only through the dev-time build chain. The shipped bundle must be byte-identical,
and per the v0.5.85 measurement rule that claim is proven by build-and-byte-compare
against a baseline HEAD build (same directory, same toolchain, with a determinism
control: build the baseline twice, expect identical) — never by inspection alone.

## Design pass
Not needed — no visual change.

## Decisions touched
- CLAUDE.md versioning rule: a dev-only/toolchain change with a byte-identical
  bundle gets NO version bump, changelog entry, tag, or release; it reaches the
  release machine on the next `git pull`. Precedents: the `dev-dependency-cleanup`
  `undici` patch and the Node-25 release-tooling fix (both "no version bump").
  Within this Spool bundle: build 3 contributes commits but nothing release-worthy.
- CHANGELOG: OMIT this fix from the bundle's entry entirely — the rule explicitly
  lists "changelog entry" among the things a dev-only change does not require, and
  both precedents shipped with none. The record lives in the commit message and the
  ROADMAP item's closure; a dev-only note would break precedent for no reader gain.
- v0.5.85 "no bundle change" measurement rule (see User-facing impact) — it governs
  the verification, and the claim is what breaks if skipped.

## What done looks like
`cd frontend && npm audit` reports 0 vulnerabilities (root stays at 0); the diff is
`frontend/package-lock.json` only; `npm run build` succeeds; and the byte-compare
shows `dist/` assets identical to the HEAD baseline (determinism control passing).
No version bump, no tag, no release step, and the bundle CHANGELOG makes no claim
about this build.
