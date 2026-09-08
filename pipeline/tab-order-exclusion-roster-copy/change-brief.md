# Change Brief — Tab-Order Exclusion Roster Copy

## What is changing
Make `tabOrderCoverage.test.ts` the only place that owns the exception roster's cardinality. Rewrite the surrounding source comments, standing UI rule, and published accessibility paragraphs to state the durable property and name the exception shapes without restating totals or ordinal categories. `useFocusTrap.ts` already follows that pattern after the shared-primitives build and remains the reference wording.

## Why now
The queued audit found three descriptions of one roster carrying different totals after the responsive navigation retired an entry. An earlier bundled change repaired `useFocusTrap.ts`, but count-bearing explanations remain in the roster owner, `.claude/rules/ui.md`, and `ACCESSIBILITY.md`.

## User-facing impact
No behavior changes. The published accessibility statement becomes harder to stale while preserving the same keyboard guidance and named exceptions.

## Design pass
Not needed — this is source and published-prose maintenance with no visual or interaction change.

## Decisions touched
Strengthens the v1.0.16 “publish the property, never the count” decision and preserves the v1.0.17 navigation and tab-order behavior. It does not change the current roster, primitive contract, or focus handling.

## What done looks like
The executable roster retains exact per-row cardinality checks, because cardinality is the guard's job. Every explanatory source and published paragraph outside that data states the property without a roster total, a “whole list” claim, or ordinal category numbering; focused guard tests and a source-first prose sweep pass.
