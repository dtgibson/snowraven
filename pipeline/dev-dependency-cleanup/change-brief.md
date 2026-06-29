# Change Brief — Dev Dependency Cleanup

## What is changing
Patch the high-severity `undici` advisory that `npm audit` reports in the
frontend. `undici@7.27.1` is pulled in transitively by `jsdom@29.1.1` (a
dev/test-only dependency used by the vitest jsdom environment). The fix updates
`undici` to a patched release via the non-breaking `npm audit fix` (no
`--force`), changing only `frontend/package-lock.json` — `jsdom` stays at
`^29.1.1` and no application dependency changes.

## Why now
`npm audit` reports 1 high-severity vulnerability (7 `undici` advisories: TLS
cert-validation bypass, Set-Cookie header injection, cache poisoning, WebSocket
DoS, etc.). It was captured as a saved VM chore. Cleared now while the tree is
clean and idle between releases.

## User-facing impact
None. `npm audit --omit=dev` reports **0 vulnerabilities** — `undici`/`jsdom`
are dev/test tooling, not in the shipped bundle. The app binary is byte-unchanged.

## Decisions touched
- CLAUDE.md versioning convention ("always bump version + changelog for a feature
  or fix"). Recommendation: **do NOT bump** for this dev-only change — it produces
  a byte-identical app bundle, and a **v0.5.47 binary release is still pending on
  the Mac**; a 0.5.48 tag would supersede it and re-trigger CI for zero app
  change. Plan: commit the lock-file fix to `main` with no version bump, no tag,
  no release. The final call is confirmed at the push gate (The Deployer).

## What done looks like
- `npm audit` (dev included) reports 0 high/critical vulnerabilities.
- `npm audit --omit=dev` still reports 0.
- Full CI mirror green: lint, typecheck, test, build.
- Only `frontend/package-lock.json` is changed.
