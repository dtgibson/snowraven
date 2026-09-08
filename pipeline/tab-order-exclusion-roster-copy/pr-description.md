## Tab-Order Exclusion Roster Copy

### What this does
Keeps exact exception cardinality in the executable `EXCLUSIONS` roster and removes copied totals from the surrounding test commentary, UI convention, and accessibility statement. The non-owner prose now describes the durable rule and the distinct exception shapes, so a future roster change cannot leave three competing counts behind.

### How to test
Run `npx vitest run src/lib/tabOrderCoverage.test.ts` from `frontend/`. Confirm the roster cardinality assertions and the new source-first prose guard pass, then search the scoped files for the retired count-bearing phrases.

### Notes for reviewer
There is no interaction or tab-order behavior change. `useFocusTrap.ts` had already stopped restating the roster in the earlier shared-primitives checkpoint; this change keeps that as the reference pattern and brings the remaining source and published prose into line. A mutation that restored “five rostered exceptions” made the new guard fail before the source was restored.
