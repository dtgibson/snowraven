## Frontend Vitest Focus Flakiness

### What this does
Makes the remaining load-sensitive Map Explorer and exotic-provenance tests wait for the exact asynchronous value they assert against. The change is test-only: it adds no sleep, raises no timeout, weakens no product assertion, and changes no shipped behavior.

### How to test
Run the six affected test files together, then repeat the four historical failure files twelve times. Run `npm run typecheck`, `npm run lint`, and `npm run build` from `frontend/`; the Spool flush owns the cumulative full-suite run.

### Notes for reviewer
The Map Explorer fixes distinguish the always-mounted loading shell from portaled or view-specific controls. The provenance fix distinguishes the terminal render from the passive effect that records the terminal live-region announcement. This is dev-only test stabilization, so the project rule requires no version bump, changelog entry, tag, or release on its own.
