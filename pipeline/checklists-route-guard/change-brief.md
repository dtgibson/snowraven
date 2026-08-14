# Change Brief — checklists-route-guard

## What is changing
`GET /checklists/{checklist_id}` (`backend/routers/checklists.py:10`) gains the same
shape guard `/weather` and `/tide` already carry: import `CHECKLIST_ID_RE` from
`services/ebird.py` and refuse the id with `fullmatch` as the handler's first act,
before any outbound call. It is the one caller of `fetch_checklist_species` that
reaches outbound eBird URL construction unguarded; the reachable injection is the
QUERY STRING ONLY (`/checklists/S1%3Ffoo=bar` builds `…/checklist/view/S1?foo=bar`).
Do not widen that wording: traversal, host steering and request splitting were
measured end to end and are unreachable because Starlette's default `str` path
converter matches `[^/]+`. The route's converter stays `str` — never `:path`.

## Why now
v0.5.88 security-review finding (Low, pre-existing, deferred to its own change);
ROADMAP.md:173 schedules it with the fix sketch "one import and one `if` plus a
route-level test." Build 1 of this Spool bundle just length-bounded
`CHECKLIST_ID_RE` to `^S[0-9]{1,15}$`, so the constant this route wires in is now
fit as an SSRF guard — the two ROADMAP entries were explicitly paired. The guard
comment in `services/ebird.py` currently states this route "does NOT gate"; that
sentence goes false the moment this lands and must be corrected in the same edit
(the grep-the-predicate rule for scope claims in source).

## User-facing impact
None for any request the shipped app can make: both frontend callers already gate
before sending (`ChecklistComparer.tsx:238` via `isValidChecklistId`,
`useExoticProvenance.ts:134` via `SUBMISSION_ID_RE`), so no valid flow reaches the
new branch. A hand-crafted invalid id changes from an eBird 404/502 passthrough to
a clean 400 with no outbound request — status and detail byte-identical to the
weather/tide precedent: `400`, `"That doesn't look like a valid eBird checklist
ID."` The existing 404/400/502 branches for valid-shaped ids are untouched, and
the 502's reflected-detail comment block stays as is.

## Design pass
Not needed — no visual change.

## Decisions touched
- DECISIONS v0.5.88 (anchor/character-class parity + per-consumer route-test rule):
  extended, not reversed — this discharges its second deferred item (ROADMAP.md:173;
  build 1 discharged :174). This router gets its OWN route-level test pinning its
  call site, so mutating it turns only its file red.
- v0.5.88 "where protection comes from ROUTING, say so at the call site": keep that
  note at the route; after this change the guard fronts it and the `str` converter
  remains the second, independent ground.
- v0.5.54 `[0-9]`-never-`\d` + `fullmatch`-at-call-site: inherited by reuse, not
  re-derived. `test_checklist_id_parity.py`'s docstring (lines 4-5, 25-26, 136-137)
  names only weather/tide as enforcers — add the third name in the same edit.

## What done looks like
Files changed: `backend/routers/checklists.py` (guard + call-site comment),
`backend/tests/test_checklists_router.py` (400 tests: query-injection shape,
Arabic-Indic digits, trailing newline, 16-digit over-ceiling id — each asserting
the mocked outbound fetch is awaited zero times; one valid-id 200 unchanged),
`backend/tests/test_checklist_id_parity.py` (docstring only), `services/ebird.py`
(comment block only — regex and functions byte-identical). NOT changed: the route's
`str` converter, the frontend, `lib/tauri/checklistService.ts` (in-process; callers
gate, and the JS request gate lives at call sites per v0.5.88), pydantic patterns.
Verification: this feature's tests + the backend suite green. Spool bundle build
2 of 4 — no version bump, CHANGELOG, or release in this build.
