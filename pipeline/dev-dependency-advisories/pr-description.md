## Dev Dependency Advisories

### What this does
Clears the two high-severity `npm audit` advisories in `frontend/`. Both were in test and lint tooling that never ships. `npm audit fix` (no `--force`) moved `brace-expansion` from 5.0.9 to 5.0.12 (under eslint > minimatch) and `undici` from 7.29.0 to 7.30.0 (under jsdom). Both new versions are inside their parents' existing semver ranges. This is a lockfile-only change and doesn't change the shipped app, so per CLAUDE.md Versioning it gets no version bump, CHANGELOG line, tag or release.

### How to test
1. `cd frontend && npm audit` (networked; never `--offline`) prints "found 0 vulnerabilities". It printed 2 high before the change.
2. `npm audit --omit=dev` prints "found 0 vulnerabilities". It printed the same before, so the shipped tree was already clean.
3. `npm ls brace-expansion undici --all` shows `brace-expansion@5.0.12` and `undici@7.30.0`.
4. `npm run typecheck`, `npm run lint` and `npm run build` pass.
5. Build `dist/` before and after the change and hash the tree. The two hashes match.

### Notes for reviewer
- **Diff scope:** `frontend/package-lock.json` only, 6 lines. Each package changes only its `version`, `resolved` and `integrity`. The `dependencies` blocks are unchanged, and `package.json` is untouched.
- **Byte-identical build:** `dist/` was hashed file by file with a null-delimited walk, because the map glyph paths contain spaces. Two pre-change builds and the post-change build all came out at 171 files with aggregate SHA-256 `209ba892e6700f907b13129b06b6b06f44016defc550c5456461299fbc51299e`. The repeat pre-change build was a control showing that the build is deterministic, so a match here means something.
- **Lint is not a vacuous pass:** minimatch is the package that does eslint's glob matching, so the run was checked directly. It linted 803 files, matching the 803 candidate `.ts/.tsx/.js/.mjs` files outside `dist` and `node_modules`, with 0 errors and 0 warnings. Brace globs such as `**/*.{ts,tsx}` still match correctly.
- **jsdom smoke:** `transport.test.ts` plus five jsdom component suites (WeatherBacklog, PlanResult, Settings.icloud, MapExplorerSearchThisArea, honestLoadFailures) all pass: 6 files, 301 tests, on undici 7.30.0. The full `vitest run` runs once at the bundle flush.
- **No how-to-see guide:** nothing in the app looks or behaves differently.
