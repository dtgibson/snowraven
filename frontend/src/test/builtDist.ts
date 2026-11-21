/// <reference types="node" />
// ONE ANSWER TO "IS THERE A PRODUCTION BUILD TO READ?" for the rows that read
// frontend/dist (security-bloat-deps-and-tests-cleanup, item B).
//
// Those rows used to skip whenever dist/ was absent, and the Pipeline workflow
// ran vitest before `npm run build`, so they skipped on every GitHub run while
// the run read as green: a gate that skips silently reports "not run" as
// "verified" (testing.md v1.0.16). The workflow now builds first, so on CI a
// missing build is a broken step order and this THROWS, failing the file at
// collection. Locally a run without a build still skips those rows, and says
// so with a line written to stderr directly: vitest's default reporter drops
// console output from a file whose tests pass, in a terminal and in a pipe
// alike (measured on vitest 4.1.12), so a console.warn here was never seen.
// A local dist/ can be stale (built from an older tree); run `npm run build`
// before trusting these rows on a changed tree.

/**
 * Whether the rows that read `path` should run. `present` is the caller's own
 * test of what it reads (a file, or a non-empty listing), so each file keeps
 * deciding what "a build is there" means for it.
 */
export function builtDistReady(present: boolean, path: string, rows: string): boolean {
  if (present) return true
  if (process.env.CI) {
    throw new Error(`${rows}: no production build at ${path} on CI. The Pipeline workflow runs \`npm run build\` before vitest, so these rows must run there; a missing build is a broken step order, never a skip.`)
  }
  process.stderr.write(`[skipped] ${rows}: no production build at ${path}. Run \`npm run build\` first to include them (CI always does).\n`)
  return false
}
