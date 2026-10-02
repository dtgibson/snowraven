# Bug Brief — Dev Dependency Advisories

## What is broken
`npm audit` in `frontend/` reports 2 high-severity advisories, both in test/lint tooling that never ships:
- `brace-expansion` 5.0.9 (vulnerable 4.0.0-5.0.11; GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p, all DoS) via eslint@10.3.0 / typescript-eslint -> minimatch@10.2.5 (`^5.0.5`).
- `undici` 7.29.0 (vulnerable 7.0.0-7.29.0; ten GHSAs incl. GHSA-3wwx-pv8p-q78v, GHSA-w293-vg96-wgc3) via jsdom@29.1.1 (`^7.25.0`), the vitest jsdom environment.
Both are `"dev": true` in the lockfile. `npm audit --omit=dev` = 0. Repo root and `website/tools` audit clean.

## Steps to reproduce
1. `cd frontend && npm audit` (networked; never `--offline`) -> "2 high severity vulnerabilities".
2. `npm ls brace-expansion --all` -> eslint > minimatch > brace-expansion@5.0.9.
3. `npm ls undici --all` -> jsdom > undici@7.29.0.
4. `npm audit --omit=dev` -> "found 0 vulnerabilities" (shipped tree already clean).

## Expected behavior
Full-tree `npm audit` reports 0. Measured on a scratch copy: `npm audit fix` (no `--force`) moves brace-expansion 5.0.9 -> 5.0.12 and undici 7.29.0 -> 7.30.0, both inside the parents' existing ranges; `package.json` unchanged; lockfile diff is exactly those two entries (version/resolved/integrity); re-audit = 0.
Release-neutral: per CLAUDE.md Versioning and the DECISIONS.md precedents (`Dev Dependency Cleanup` undici patch, Node-25 tooling fix, nanoid at line ~1097) this needs no version bump, CHANGELOG line, tag or release, even riding this bundle branch.

## Blast radius
`frontend/package-lock.json` only. Consumers: `npm run lint` (eslint/typescript-eslint glob matching via minimatch) and the ~152 vitest files annotated `@vitest-environment jsdom` (undici backs jsdom's fetch/WebSocket). Nothing under `frontend/src` imports either package and Vite does not bundle them, so the built app should be byte-identical. Backend pins (`backend.md`) and Rust untouched.

## What done looks like
Networked `npm audit` = 0 and `npm audit --omit=dev` = 0; lockfile diff confined to the two packages; `npm run typecheck`, `npm run lint`, `npm run build` and the full `vitest run` green; `dist/` hash-identical to a pre-change build (the nanoid precedent's proof shape).
