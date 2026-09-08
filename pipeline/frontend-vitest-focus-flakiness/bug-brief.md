# Bug Brief - Frontend Vitest Focus Flakiness

## What is broken
The full frontend suite can assert before asynchronous Map Explorer children or provenance announcements settle. The affected files pass alone, but suite load exposes waits that observe an earlier loading shell or render commit instead of the exact portaled DOM child or passive-effect log the assertion consumes.

## Steps to reproduce
1. Verify the machine is quiet, including orphaned high-CPU processes.
2. Run the full frontend Vitest suite repeatedly from a clean HEAD checkout.
3. Observe intermittent failures in the four recorded Map Explorer and provenance identities.
4. Re-run each failed file alone; the historical sample produced no isolated failures.

## Expected behavior
Tests wait for the state their next assertion actually reads, so the affected family and the full suite pass independently of ordinary scheduling variation. No sleep, timeout increase, or weaker product assertion is used to hide the race.

## Blast radius
The repair is test-only: the four historical identities plus comparable Map Explorer helpers that share the same early-readiness pattern. Production components, focus behavior, manifests, dependencies, and shipped bundles stay unchanged.

## What done looks like
Every affected wait targets the downstream child, control, or effect-owned announcement it consumes. Repeated focused runs, typecheck, lint, and the production build pass; the Spool flush owns the cumulative full-suite run.
