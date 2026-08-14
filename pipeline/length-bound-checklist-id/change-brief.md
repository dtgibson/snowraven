# Change Brief — length-bound-checklist-id

## What is changing
`CHECKLIST_ID_RE` (`backend/services/ebird.py`) gains a length bound: `^S[0-9]+$` becomes
`^S[0-9]{1,15}$`. The same ceiling goes onto both fixture-driven JS twins in the same change
(`isValidChecklistId` in `frontend/src/lib/checklistId.ts`; `SUBMISSION_ID_RE` in
`components/speciesDetail/ui.tsx`) so the shared parity fixture can carry the discriminating
over-ceiling row, and onto the four byte-identical display-guard copies (`lib/mediaStats.ts`,
`lib/speciesStats.ts`, `map/TargetMarkers.tsx`, `map/NearbyLiferMarkers.tsx`) so no copy drifts.
This is a lockstep literal sweep, NOT the JS-side consolidation v0.5.88 recorded as separate work.
Ceiling 15 deviates from ROADMAP's `{1,20}` candidate deliberately: it aligns with the shipped
persisted-key guard `SUBMISSION_KEY_RE = /^S[0-9]{1,15}$/` (`exoticProvenanceCache.ts`), closing
the 16-20-digit window where an id would pass every guard yet fail the store's own key guard
(the v0.5.87 silent-discard shape). Real ids are ~10 digits; 15 keeps 5 orders of headroom.

## Why now
Low finding from the v0.5.88 security review, deliberately deferred out of that build's scope
and queued on The Spool. Measured through the real route: a 65,001-character id passes the
guard and issues an outbound eBird request. That deviates from the house SSRF rule (the
reference guard `/media/embed-status` is explicitly bounded) and from the neighbouring
`_KEY_RE` (`{1,128}`) shipped in the same v0.5.88 change.

## User-facing impact
Default: none. Every real eBird checklist id (~10 digits today) is accepted exactly as before.
Only ids of 16+ digits — outside any shape eBird has ever emitted — are newly refused: the
weather/tide routes return 400 with no outbound fetch, and display guards render such an id
as plain text instead of a link (already the behavior for every other junk id shape).

## Design pass
Not needed — no visual change.

## Decisions touched
- **v0.5.88** ("One class of defect, two independent bugs"): the direct predecessor. This
  discharges the length-bound deferral it recorded; nothing in it is reversed. Its per-consumer
  rule holds: each router keeps its own route-level test pinning the call site, so the new bound
  is asserted per-router (over-ceiling id → 400, outbound awaited zero times), not only at the
  pattern — the fix for "a verification derived from the thing it checks cannot fail."
- **v0.5.54 / v0.5.87** (twin-parity rules, CLAUDE.md): upheld. `[0-9]` never `\d` on the Python
  side; `fullmatch` anchors; fixture keeps its newline rows and gains at-ceiling (15-digit,
  valid) + over-ceiling (16-digit, invalid) rows asserted on both transports, with non-vacuity
  pins so a revert to unbounded goes red on every guard. The pydantic `pattern=` constraints in
  `routers/map.py`/`media.py` are the recorded carve-out and are NOT swept in.
- **v0.5.87** (escapee stores): motivates ceiling 15 (guard/store alignment); `SUBMISSION_KEY_RE`
  itself is unchanged. Two stale comments corrected in the same edit per the grep-the-predicate
  rule: the fixture's 12-digit row's "bounds shape, not length" why-text (row stays VALID at 12
  digits), and `exoticProvenanceCache.ts`'s "unbounded in length" clause about the display guard.

## What done looks like
Changed: `services/ebird.py`, the six JS guard sites, `checklistId.fixture.json`, both parity
tests, `test_weather_router.py`, `test_tide_router.py`, the `exoticProvenanceCache.ts` comment.
Not changed: `/checklists/{checklist_id}` gating (its own queued Spool build), router call
sites, pydantic patterns, `services/tide.py`'s trusted-NOAA `\d` sites, `SUBMISSION_KEY_RE`.
Verification: this feature's tests plus the backend suite green. Bundle context: ships in a
Spool bundle — no version bump, CHANGELOG entry, or release in this build (bundle flush handles
those; full cumulative suite runs there).
