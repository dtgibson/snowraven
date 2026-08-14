# length-bound-checklist-id

## What this does

Adds a length ceiling to every eBird checklist-id shape guard: `S` followed by
1-15 ASCII digits, replacing the unbounded `S[0-9]+` / `S\d+`. One backend
constant and six JS literals move in lockstep:

- `backend/services/ebird.py` `CHECKLIST_ID_RE` -> `^S[0-9]{1,15}$` (still
  `re.compile`, still `fullmatch` at both router call sites, still `[0-9]`
  never `\d`)
- `frontend/src/lib/checklistId.ts` `isValidChecklistId` (gates the request)
- `frontend/src/components/speciesDetail/ui.tsx` `SUBMISSION_ID_RE` (gates the
  link)
- the four byte-identical display-guard copies: `lib/mediaStats.ts`,
  `lib/speciesStats.ts`, `components/map/TargetMarkers.tsx`,
  `components/map/NearbyLiferMarkers.tsx`

The ceiling is 15 because the shipped persisted-key guard
`SUBMISSION_KEY_RE = /^S[0-9]{1,15}$/` (`lib/exoticProvenanceCache.ts`) already
refused 16+ digits, so an id in that window passed every request/link guard yet
failed the store's own key guard (the v0.5.87 silent-discard shape). Real ids
are ~10 digits, so 15 keeps ~5 orders of magnitude of headroom and no id eBird
has ever emitted changes verdict. This discharges the Low finding deferred from
the v0.5.88 security review (a 65,001-character id passed the guard and issued
an outbound eBird request).

Also corrected in the same edit, per the grep-the-predicate rule: the fixture's
12-digit row's stale "bounds shape, not length" why-text, the
`exoticProvenanceCache.ts` comment calling the display guard "unbounded in
length", the `checklistId.ts` comment describing the quantifier as unbounded,
the `namedBirdMedia.ts` comment quoting `^S\d+$`, and the
`checklistIdRegexBound.test.ts` test that pinned the old unbounded quantifier
by value (it now asserts the body carries NO unbounded quantifier, with a
guard-the-guard proving the scanner still flags the reverted form).

## How to test

Nothing is user-visible: every real checklist id behaves exactly as before, and
only 16+-digit ids (a shape eBird has never emitted) are newly refused, exactly
as every other junk id shape already was. So the proof is end to end through
the guards rather than through the UI:

1. `cd backend && python -m pytest tests/ -v` - the shared fixture's new
   at-ceiling (15-digit, valid) and over-ceiling (16-digit, invalid) rows run
   through the shipped `CHECKLIST_ID_RE`, and `test_weather_router.py` /
   `test_tide_router.py` each pin the bound AT THE ROUTE: `GET /weather/S<16
   digits>` and `GET /tide/S<16 digits>` return 400 with the outbound checklist
   fetch awaited zero times, while the 15-digit id still reaches the fetch.
2. `cd frontend && npx vitest run src/lib/checklistId.parity.test.ts
   src/lib/checklistIdRegexBound.test.ts` - the same fixture rows through both
   shipped JS guards, plus a per-guard mutation test asserting the ceiling on
   each guard separately (agreement alone cannot reject a joint revert).
3. Non-vacuity was exercised by actual mutation, all restored and re-verified:
   reverting the backend constant to `^S[0-9]+$` fails 4 tests (fixture loop,
   ceiling guard, both router call-site tests); reverting
   `isValidChecklistId` fails 4 (parity x3 + the structural quantifier scan);
   reverting `SUBMISSION_ID_RE` fails 3 (its fixture loop, the agreement test,
   the per-guard ceiling test).

## Notes for reviewer

- The bound is a lockstep literal sweep, NOT the JS-side consolidation v0.5.88
  recorded as separate work; the six sites stay byte-identical to each other.
- Deliberately untouched, per the brief: `/checklists/{checklist_id}` gating
  (its own queued Spool build), the pydantic `pattern=` constraints in
  `routers/map.py` / `routers/media.py` (the recorded rust-regex carve-out),
  `services/tide.py`'s trusted-NOAA `\d` sites, and `SUBMISSION_KEY_RE` itself.
- The four display-guard copies are swept but not driven by the parity fixture
  (they are module-private); the fixture header states this honestly. A revert
  of one of those four alone is caught by no test - the same standing
  limitation v0.5.88 recorded for the pre-existing copies, unchanged here.
- Ceiling 15 deviates from ROADMAP's `{1,20}` candidate deliberately;
  the reasoning lives at the `CHECKLIST_ID_RE` definition site.
- No version bump or CHANGELOG entry: this ships in a Spool bundle and the
  bundle flush handles both.
