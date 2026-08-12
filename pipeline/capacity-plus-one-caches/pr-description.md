# PR Description — Capacity Plus One Caches

## Summary

Measures every cache named by the v0.5.85 follow-up through its real exported
API at capacity+1 or the honest shipped-caller-domain equivalent. The evidence
leaves the count-bounded county-completeness and replay FIFO policies unchanged, proves
`storage.ts` is only an I/O adapter, and bounds the two reachable Nominatim
coordinate-cache twins with the same non-thrashing admission policy.

There is no intended UI or response change. This closes process-lifetime
retained growth while preserving provider etiquette, result ordering, cached
hits/nulls, durable shapes, TTLs, and newest-offline-data behavior.

## What changed

- Added deterministic, test-only work recorders to the county completeness and
  replay stores. Capacity+1 and payload-length-budget+1 tests seed genuinely
  full persisted documents, call only the exported APIs, and separate
  loader/put work, order search, shifted slots, eviction, debounce, retained
  payload code units, and serialized snapshot volume.
- Kept both FIFO policies. Their work is bounded to 250/300 slots and one
  debounced snapshot; the expensive work is network/storage I/O, and admission
  would throw away the newest county or last-loaded replay response.
- Added an inventory guard proving `storage.ts` has no independent cache or
  eviction policy.
- Exercised both variants in the shipped `VectorVariant` domain plus a third
  repeat. The seam is read twice across that shipped graph, and production
  `SnowMap` still requests only `positron`; the helper API itself accepts
  arbitrary strings and is not claimed as structurally bounded.
- Added a 4,096-entry fill-and-stop cap to both
  `frontend/src/lib/tauri/nominatimService.ts` and
  `backend/routers/nominatim.py`. Once full, later lookups return normally but
  are not retained; existing keys never churn.
- Added frontend and backend Nominatim tests for rounded-coordinate dedup,
  ordering, repeats, cached null/failure results, capacity+1, non-thrash,
  overlapping forward/reverse one-second spacing, same-key in-flight dedup,
  rejection-safe queue recovery/reset isolation, cross-runtime half-step
  rounding, registered route reachability, and twin cap/admission parity.

## Design decision

Admission control is appropriate only for the two Nominatim memo caches. Their
entries are an optimization over deterministic external lookups, and FIFO at
capacity+1 could rotate a repeated ML batch into thousands of rate-limited
misses. The persistent FIFO stores serve a different product promise: retain
the newest offline data. Their bounded array work does not amplify their live
network calls, so changing policy would be a regression rather than a hardening.

The committed 127,751-byte synthetic ML export contains 515 data lines and 10
unique rounded coordinates. A 4,096-entry cap provides 409.6x observed
headroom; it is a retention bound, not an upload limit.

The durable stores retain their existing best-effort debounce semantics. Their
in-memory mirrors remain current, but overlapping slow persistence calls are
not serialized; an older completion can overwrite a newer durable snapshot.
This pre-existing residual is documented rather than expanded into the scoped
Nominatim limiter retry.

## Verification

- Focused frontend: 7 files, 71 tests passed; focused backend: 9 tests passed
  with the established Starlette warning.
- The previously recorded full backend regression passed with one existing
  Starlette deprecation warning.
- TypeScript project check passed.
- Touched frontend ESLint and backend Ruff passed.
- `git diff --check` passed.

## Scope

No changes to `transport.ts`, callers/components, `storage.ts`, provider
contracts, persistent document shapes, TTLs, durable-store caps,
`networkCache.ts`, versions, changelog, or UI.
