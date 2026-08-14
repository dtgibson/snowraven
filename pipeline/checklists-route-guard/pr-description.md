# checklists-route-guard

## What this does

`GET /checklists/{checklist_id}` now applies the same checklist-id shape guard
`/weather/{checklist_id}` and `/tide/{checklist_id}` already carry: it imports
`CHECKLIST_ID_RE` from `services/ebird.py` and refuses any id that fails
`fullmatch` as the handler's first act, before any outbound eBird call, with
status 400 and a detail string byte-identical to the weather/tide precedent
("That doesn't look like a valid eBird checklist ID.", copied from the shipped
code, not retyped).

This closes the v0.5.88 security-review Low (deferred to its own change,
ROADMAP.md:173): this route was the one caller of `fetch_checklist_species`
that reached outbound eBird URL construction unguarded. The reachable shape was
the QUERY STRING ONLY: `/checklists/S1%3Ffoo=bar` arrived at the handler as
`S1?foo=bar` and built `.../product/checklist/view/S1?foo=bar`. Build 1 of this
Spool bundle length-bounded `CHECKLIST_ID_RE` to `^S[0-9]{1,15}$`, which is
what made the constant fit as an SSRF guard here; the two ROADMAP entries were
explicitly paired.

Nothing is user-visible. Both shipped frontend callers already gate before
sending (`ChecklistComparer.tsx:238` via `isValidChecklistId`,
`useExoticProvenance.ts:134` via `SUBMISSION_ID_RE`), so no valid flow reaches
the new branch. A hand-crafted invalid id changes from an eBird 404/502
passthrough to a clean 400 with zero outbound requests. The existing
404/400/502 branches for valid-shaped ids are untouched, including the 502's
reflected-detail comment block.

Files changed:

- `backend/routers/checklists.py`: the import, the guard (first act in the
  handler), and a call-site comment recording both grounds: the guard fronts
  the route, and Starlette's default `str` path converter (`[^/]+`) remains the
  second, independent ground. The route's converter stays `str`, never `:path`.
- `backend/tests/test_checklists_router.py`: four route-level 400 tests
  (query-injection shape, Arabic-Indic digits, trailing newline, 16-digit
  over-ceiling id), each pinning the mocked outbound fetch awaited zero times,
  plus the at-ceiling 15-digit id proving the guard rejects only what it
  claims to. The pre-existing valid-id 200 tests are unchanged.
- `backend/services/ebird.py`: COMMENT-ONLY. The guard-status block claiming
  this route "does NOT gate" went false with this change and was corrected;
  the JS-counterparts paragraph was corrected in the same pass (it undercounted
  which requests the two JS gates cover). Verified mechanically: every changed
  diff line begins with `#`; the regex and all functions are byte-identical.
- `backend/tests/test_checklist_id_parity.py`: DOCSTRING-ONLY. The three spots
  naming the enforcing routers/tests now name all three.

Not changed, per the brief: the route's `str` converter, the frontend,
`lib/tauri/checklistService.ts` (in-process; its callers gate, and the JS
request gate lives at call sites per v0.5.88), pydantic patterns. Spool bundle
build 2 of 4: no version bump, no CHANGELOG entry, no release in this build.

## How to test

All commands from the repo root, each gate run under `set -o pipefail` with the
exit status echoed explicitly (a pipeline into `tail`/`grep` otherwise reports
the last command's status, not the gate's):

1. The changed test files:
   `set -o pipefail; cd backend && .venv/bin/python -m pytest tests/test_checklists_router.py tests/test_checklist_id_parity.py tests/test_weather_router.py tests/test_tide_router.py -q; echo $?`
   Observed: 38 passed, exit 0.
2. The full backend suite:
   `set -o pipefail; cd backend && .venv/bin/python -m pytest tests/ -q; echo $?`
   Observed: 234 passed, exit 0 (baseline before the change: 230 passed,
   exit 0).
3. Comment-only proof for `services/ebird.py`:
   `git diff backend/services/ebird.py | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-]#'`
   must print nothing (observed: no output, grep exit 1 = zero non-comment
   changed lines).
4. Manual end-to-end, if desired: start the backend and request
   `curl -i 'http://localhost:1620/checklists/S1%3Ffoo=bar'` — expect
   `400 {"detail":"That doesn't look like a valid eBird checklist ID."}` and no
   outbound eBird traffic; a real id still behaves as before.

Mutation checks performed (and restored):

- Guard removed entirely: exactly the 4 new tests in
  `test_checklists_router.py` went red (4 failed, 230 passed, exit 1) — and
  ONLY this router's file, proving the per-consumer pinning (single-sourcing
  prevents drift, not a dropped call site; each consumer has its own red).
- Guard reinstated as `.match()` instead of `fullmatch`: exactly
  `test_trailing_newline_id_rejected_at_the_route` went red (1 failed, 233
  passed, exit 1) — the anchor half is pinned at this call site, as its
  docstring claims.
- Restore verified by grepping the INTENDED content (never by diffing against
  the snapshot used to restore): `fullmatch` present on the guard line, the 400
  detail string byte-identical across all three routers, the only `.match(`
  occurrence being the explanatory comment. Full suite re-run green after
  restore (234 passed, exit 0).

## Notes for reviewer

- Why the guard's claim is deliberately narrow: traversal, host steering and
  request splitting were measured end to end in the v0.5.88 review as
  UNREACHABLE on this route, and remain so, because Starlette's default `str`
  path converter matches `[^/]+` — the id is always exactly one path segment,
  so no `/` (nor `%252F`, backslash, overlong UTF-8 `%C0%AF`, or fullwidth
  solidus) can arrive as a separator; httpx's `../` normalization needs a
  literal slash the route cannot deliver, `@`/`://`/`//` still resolve to
  api.ebird.org, and httpx rejects CR/LF outright. The guard closes the one
  reachable shape (query-string injection) and adds defense in depth for the
  rest. Do NOT widen the PR/record wording to claim traversal or host steering
  were reachable or "fixed" — over-claiming was explicitly called out in
  v0.5.88 as sizing deferred work a grade too high.
- The route protection is now two independent grounds, both stated at the call
  site in `routers/checklists.py`: the guard (first), and the routing converter
  (second). Changing the route to `{checklist_id:path}` (regex `.*`) removes
  the routing ground; the comment says so.
- This route has no API-key check ahead of the fetch (unlike weather/tide), so
  the new tests' reasoning is tighter than the siblings': the outbound seam is
  mocked to SUCCEED, so a 400 can only be the shape guard.
- The Arabic-Indic digits in the new test are written as `\uXXXX` escapes, not
  literal characters (house rule: literal exotic characters have been silently
  flattened to ASCII four times across two builds).
- `test_checklists_router.py`'s query-injection test pins
  `unquote("S1%3Ffoo=bar") == "S1?foo=bar"` in-line, so a future edit cannot
  quietly turn the probe into an ordinary id; same posture as the weather
  twin's `%0A` pin.
