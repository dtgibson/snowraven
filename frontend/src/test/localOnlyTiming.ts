/// <reference types="node" />
// THE ONE SWITCH FOR TIMING ROWS THAT RUN ONLY IN THE LOCAL FULL SUITE
// (security-bloat-deps-and-tests-cleanup, D-05).
//
// The bar for a speed check that blocks GitHub's checks, in order: a work count
// or a structural assertion, which no machine can move; failing that, a
// same-run CPU-time quotient (src/test/cpuTiming.ts) whose margin is measured
// on the Node CI runs, with an identical-input control reading about 1.00x
// (testing.md v1.0.74). A row that can reach neither runs only in the local
// full suite, behind this switch, and its file says why and which of its rows
// still gate on GitHub. A row behind the switch keeps its legs, inputs and
// limits unchanged: the switch moves where a row runs, never what it accepts.
//
// The Pipeline workflow sets SR_SKIP_LOCAL_ONLY_TIMING=1 on its vitest step.
// Every other run, every local full suite included, runs the rows. A value
// other than unset, empty or "1" throws, so a mistyped value cannot quietly
// pick a side.
const raw = process.env.SR_SKIP_LOCAL_ONLY_TIMING

if (raw !== undefined && raw !== '' && raw !== '1') {
  throw new Error(`SR_SKIP_LOCAL_ONLY_TIMING must be unset or "1", not ${JSON.stringify(raw)}`)
}

/** True where the local-only timing rows are skipped: GitHub's vitest step. */
export const SKIP_LOCAL_ONLY_TIMING = raw === '1'

/** The suffix every row behind the switch carries in its title, so a skipped
 *  row's name says why it was skipped. */
export const LOCAL_ONLY = '(local full suite only: SR_SKIP_LOCAL_ONLY_TIMING)'
