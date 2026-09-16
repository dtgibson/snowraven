# Decisions — At-Route Try Containment

Every table cited here was measured through the real routes and the real
services with the provider seams doubled, before the repair was written. Probe
scripts ran from this session's scratchpad and are not committed.

---

## 1. `/weather/{checklist_id}`'s unreadable `obs_dt` is IN scope, and its honest state is a 502 in its OWN words (2026-09-15)

**Decision:** the checklist date derivation is contained, and maps to
`502` with a **new** detail, `"This checklist's date could not be read."`,
on both transports. It does not reuse either existing string.

**Why it is in scope at all.** The Orchestrator scoped it in and asked that the
failure state be decided on its own merits. The handler was being rewritten for
the provider-body repair regardless, and the defect is the same class: a bare
500 out of an unvalidated upstream value. `services/ebird.py`'s `fetch_checklist`
returns `obs_dt` as a bare `data["obsDt"]` index with no validation and
`duration_hrs` guarded only against a falsy value, so both reach the arithmetic
unchecked. Measured at HEAD, **all seven** probed shapes 500'd on
`/weather/{checklist_id}`: `'2024-13-40 25:61'`, `''`, `'not-a-date'`,
`'2024-05-01T12:00:00Z'`, `None`, `12345`, `'0000-00-00 00:00'`.

**Why not the two strings already in the file.** Both would have lied:

| Candidate | Why it is false here |
|---|---|
| `"Weather data unavailable for this checklist's time and location."` | Names the weather provider as the failing party. On this path OpenWeather is **never called** — the raise happens before the fetch, and the test asserts `fetch_historical` is not awaited. |
| `"Could not fetch checklist data. Please try again."` | We *did* fetch it, successfully. And "try again" promises a retry that cannot succeed: the value is deterministic, so every retry fails identically. |

**Why 502 rather than 400.** A 400 says the caller's request was bad. It was
not — the checklist id passed `CHECKLIST_ID_RE` and resolved. What happened is
that an upstream (eBird) returned something this route cannot use, which is
exactly what 502 means. It also keeps `isOfflineError` reading `false`, so the
failure is never classified as an offline cue.

**CORRECTION (2026-09-15, after the Tester's review).** This section originally
continued "...so the panel shows the sentence rather than an offline cue." **The
second half of that was false on the desktop transport, and it was asserted
rather than measured** -- I verified the THROW and reasoned about the render,
which is precisely where this divergence is invisible. Measured at the render
through the real `classifyLiveError`:

| | What the user actually saw, before the call-site fix |
|---|---|
| Desktop (`getWeather`, unreadable `obs_dt`) | **"Something went wrong. Please try again."** |
| Web/Pi (same 502) | "This checklist's date could not be read." |

The cause is one layer above this build's original scope: every weather/tide
call site extracted the detail with
`err instanceof TransportError ? … : undefined`, and the desktop services throw a
plain `Error` carrying `status`/`detail`, so the detail was dropped and
`classifyLiveError` fell through to `GENERIC_ERROR_MESSAGE`. Not a regression --
before this build those same paths showed the false "you're offline" line -- but
"Please try again" about a value that can never parse is the vaguer cousin of
the exact lie this build exists to remove, on the majority platform.

**It is now true, and decision 8 below records the fix that made it so.** Both
halves are kept deliberately: a record that quietly becomes correct hides that
it was ever wrong, and the reason this was wrong is more useful than the
sentence itself.

**Reversal condition.** If eBird's `obsDt` is ever validated at the seam in
`services/ebird.py` (and its desktop twin in `weatherService.fetchChecklist`,
which casts `data['obsDt'] as string` with no check), this containment becomes
belt-and-braces and should be re-argued rather than silently kept — per the
standing rule never to leave a guard commented as redundant whose necessity has
not been measured.

## 2. The TIDE twin of that date defect is in scope too (2026-09-15)

**Decision:** `/tide/{checklist_id}` and desktop `getTide` contain the same
derivation, mapping to each one's existing soft state
(`{**base, "status": "unavailable"}`), **not** a 502.

**Why.** It is the identical defect on the identical field in the other handler
I was already rewriting, and measured live: `normalize_obs_dt` raises
`AttributeError` on a non-string, `shift_local` raises `ValueError` on an
impossible calendar value, so `None`, `12345`, `'2024-13-40 25:61'` and
`'0000-00-00 00:00'` all 500'd. Containing the weather route's date while
leaving its twin one file away is precisely the split the preceding build's own
convention flag warns about ("a rule applied only where a brief points leaves
its neighbours one call away"), which is the brief's stated reason for scoping
all eight provider-body sites rather than the two the idea named.

**Why a different state from the weather route.** Each route keeps the honest
state it already has — the same asymmetry the provider-body repair carries, and
the same one `/tide/plan` established. The tide surface has a real soft
"no reading" state; the weather surface has none and raises.

## 3. Three `obs_dt` shapes on the tide path are silently wrong and CANNOT be closed here (2026-09-15)

**Decision:** pinned as a passing test row
(`test_tide_checklist_unparseable_obs_dt_still_answers_ok_out_of_scope`),
deliberately not fixed.

**Evidence.** `''`, `'not-a-date'` and `'2024-05-01T12:00:00Z'` pass through
**both** helpers without raising: `normalize_obs_dt('not-a-date')` returns
`'not-a-date 00:00'`, `shift_local` returns it unchanged, and the route then
queries NOAA with a nonsense window and returns a well-formed
`{"status": "ok"}` reading built on it. **Nothing raises, so a `try` catches
nothing** — exactly the shape of F1's silently-wrong half in
`pipeline/tide-timezone-parse/security-report.md`, arriving from the
checklist's date instead of from the provider's body.

**This cost me a round.** My first draft reused the weather route's seven-shape
list for the tide route and three rows went red — the repair was right and the
test was wrong. That is the brief's own "the shapes do not transfer verbatim"
finding reproducing itself one route over, which is worth recording because the
brief only warned about it for the *plan* suites.

**The exact fix, if taken:** give `normalize_obs_dt` / `shift_local` a way to
signal "unreadable" (returning `None` rather than a passthrough string), and
have both routes treat that as `unavailable`. It has twin-parity consequences,
because the TS twins pass these through identically.

## 4. `GET /tide/at?dt=<malformed>` is a REAL, measured 500 that this build deliberately does NOT fix (2026-09-15)

**Recorded as a decision, not left silent, because a silent non-action and an
oversight leave identical evidence** (CLAUDE.md standing rule).

**The measurement.** This is user-supplied input with no provider involved:

| `GET /tide/at?dt=` | Backend | Desktop `getTideAt` |
|---|---|---|
| `2024-13-40 25:61` | **500** | resolves |
| `0000-00-00 00:00` | **500** | resolves |
| `9999-99-99 99:99` | **500** | resolves |
| `not-a-date`, `''` | 200 | resolves |

Its sibling `/weather/at` in the same subsystem already answers `400` with
`"That doesn't look like a valid date and time."` for the same input, so two
handlers disagree — the v0.5.91 sibling-disagreement shape the preceding
security review already recorded for `/tide/at` as F3.

**Why not fixed here.** Three grounds, and the third is decisive:

1. It is user-input **validation**, not upstream-value **containment**. This
   build's whole subject is the latter.
2. Its honest answer is a `400` carrying new user-facing copy, which is a
   product decision rather than a failure-path repair.
3. **Fixing only the backend would OPEN a new twin divergence.** The desktop
   twin resolves all four shapes, so a backend-only 400 makes the two transports
   answer differently for identical input — and closing that properly means
   making `normalizeObsDt`/`shiftLocal` refuse, which is a behaviour change to a
   shipped builder, the exact class the Orchestrator ruled out of scope.

**Reversal condition.** Take it in the same build that decides whether the TS
date helpers refuse, so both transports move together.

**The exact fix, with its location.** Add to `backend/routers/tide.py`'s
`get_tide_at`, before `_resolve_tide_at`, the same guarded parse
`/weather/at` already carries at `routers/weather.py:79-89`; and the matching
refusal in `frontend/src/lib/tauri/tideService.ts`'s `getTideAt`, which today
takes `dtLocal` straight into `normalizeObsDt`.

## 5. The fetch stays OUTSIDE the desktop `catch`, on purpose (2026-09-15)

**Decision:** on desktop, `fetchForecast` / `fetchHistorical` are **not** inside
the new `catch`; only the builder is. On the backend they *are* inside the
`try`, matching `/weather/plan`.

**Why the asymmetry is correct rather than sloppy.** On desktop a
connection-level rejection is the user's own connection, and `isOfflineError`
must keep reading it as offline so the panel says "you're offline" when they
really are. Widening the catch over the fetch would relabel a genuinely offline
device as a provider fault — the same false statement this build exists to
remove, pointing the other way. On the backend the process *is* the server, so a
failed outbound call genuinely is a 502.

This is guarded, not just asserted:
`it('a connection-level failure is still OFFLINE, not a 502')` in
`atRouteServices.test.ts` goes red if anyone widens that catch.

**Stated residual.** A provider body that is not JSON at all still rejects
status-less out of `res.json()` on desktop and reads as offline. The backend
maps it to 502. Closing it means distinguishing a parse failure from a transport
failure inside the fetch helpers; `getWeatherPlan` has the same residual today,
so this build leaves both alike rather than fixing one.

## 6. Each transport keeps its own existing failure wording (2026-09-15)

`/weather/{checklist_id}` says `"Weather data unavailable for this checklist's
time and location."`; desktop `getWeather` says `"Weather data unavailable for
this checklist."`. That divergence is **pre-existing** and is left alone: both
are honest, and changing either is a copy change outside this build. Each
transport's tests assert its own string, so neither can drift unnoticed. The new
date sentence is identical on both sides by design.

## 7. No version bump in this build (2026-09-15)

No change to `frontend/package.json`, `src-tauri/tauri.conf.json`,
`CHANGELOG.md` or `website/index.html` (verified clean in `git status`). This is
one build in a bundled Spool release taking a single four-file bump at the end;
the changelog line this build is owed is in `pr-description.md`. A deliberate
deferral of CLAUDE.md's "always bump" rule for a bundled release, not a skip.

## 8. The detail must survive the CALL SITE, not just the throw (2026-09-15)

**Decision:** `App.tsx`'s `loadWeather` and `WeatherTideSection.tsx`'s
`loadSideWeather` now extract the detail with the repo's existing
non-`TransportError` fallback, so a desktop-thrown sentence reaches the screen.

**Why it is the right scope.** The expression already exists verbatim at
`MapExplorer.tsx:196`, `useHotspotActivity.ts:112` and
`useCountyCompleteness.ts:61`; a swept count found **six** sites that extract a
detail, of which those three plus `ChecklistComparer.tsx:265` already handled a
non-`TransportError` throw and exactly **two** -- both weather -- did not. This
converges on an established pattern rather than inventing one.

**Measured, not assumed, at both ends.** Red-first at the render:
`weatherTideErrorDetail.test.tsx` was watched failing with
`Received: "Something went wrong. Please try again."` before it passed. The
`TransportError` row passed throughout, which is what makes the divergence a
measurement rather than a story.

**Deliberately NOT changed: `WeatherForecastPanel`.** It is the `/weather/at`
and `/tide/at` consumer, and it never extracts a detail at all -- it takes
`classifyLiveError(err).kind` and renders its own fixed copy
("Weather is unavailable right now."). So no sentence from those two routes has
ever reached the screen there, before or after this build. That is pre-existing
and outside the swept scope, which is sites that extract a detail; recorded here
so the next reader finds it argued rather than missed.

**Residual:** the extraction expression now exists in five places. Consolidating
it is a separate change, and the repo's own rule is why it is not folded in
here: single-sourcing prevents copies drifting, not copies being dropped, so
each consumer would still owe its own test.

## 9. The red-first figure was measured against the WRONG FILE (2026-09-15)

**Correction.** The backend red-first signature reported at the first gate,
**50 failed / 7 passed**, was measured against an earlier draft of
`test_at_route_containment.py` -- the one described in decision 3, before the
tide `obs_dt` rows were split into raising and silent groups. The shipped file's
signature is **47 failed / 10 passed**: the three `TIDE_SILENT_OBS_DT` rows
assert a `200 ok` that the *unrepaired* code already produces, so they are
controls and pass before the repair like every other control.

Re-measured directly rather than accepted on report: the two repaired routers
were reverted to HEAD, the shipped suite run (47 failed / 10 passed), and the
routers restored -- verified by sha256 **and** behaviourally by re-running the
full suite (636 passed), since a restore checked only against the snapshot used
to perform it cannot fail.

## 10. F4 — this build INTRODUCES one exception to the fixed-literals property, accepted (2026-09-15)

**Status:** accepted, introduced by this build, deliberately not fixed (the
security pass that found it is documentation-only; a code change there would
re-run the Tester ahead of the Auditor's clearance for a Low).

**The property, stated WITH its exception, because a totality claim with an
unnamed exception is worse than an honest partial one.** Every sentence the eight
containment sites introduce is a fixed literal with no interpolation:
`_WEATHER_UNAVAILABLE_DETAIL`, `_CHECKLIST_WEATHER_DETAIL`,
`_CHECKLIST_DATE_DETAIL`, `CHECKLIST_DATE_UNREADABLE`, the two inline weather
strings, and the two structural `{"status": "unavailable"}` values. Every new
`except`/`catch` arm **discards the caught exception object** rather than
re-messaging it, so no provider body or upstream exception text can reach a
`detail`. **The exception is not in those sentences but in what the decision 8
call-site fallback now lets through**, and it is the one place the property
fails.

*Note on provenance, recorded so the correction is honest:* this property was
derived and stated in the security review, not claimed in these artifacts. I
checked before writing this section, and no such claim appears in `decisions.md`,
`pr-description.md`, `how-to-see.md`, either new test file, or any comment this
build added. It is recorded here now, with its exception attached, because an
unqualified form of it is exactly what a future reader would otherwise infer from
decision 8 and from the containment comments.

**The exception.** `fetchChecklist` throws
``new Error(`Could not find coordinates for location ${locId}.`)`` with
`status: 502` at `frontend/src/lib/tauri/weatherService.ts:82`, where `locId` is
`data['locId'] as string` from the eBird response with **no validation**. Before
decision 8 that message was dropped (a plain `Error` is not a `TransportError`,
so the user saw `GENERIC_ERROR_MESSAGE`). Now `err.message` is the carrier,
`status: 502` keeps `isOfflineError` false, and the sentence renders. Surfaced
via `App.tsx:631-635` and `WeatherTideSection.tsx:47-50`.

**Why it is acceptable to ship, measured rather than reasoned.** It renders as a
React child and is escaped (`&lt;script&gt;`), creates **zero** `<script>`
elements, and no path in that component tree uses `dangerouslySetInnerHTML`. It
is upstream-derived text in user-facing copy, not injection. A real `locId` is
`L\d+`, and reaching it requires control of eBird's response.

**It also creates a transport divergence in the direction of showing more:** the
backend wraps the identical failure (`services/ebird.py:151`) in its route's
`except Exception` and shows "Could not fetch checklist data. Please try again.",
so web/Pi users never see the id and desktop users now do.

**Reversal condition.** Fix it if any consumer of these messages stops escaping
(a `dangerouslySetInnerHTML` anywhere on this path), if `locId` becomes
influenceable without eBird itself being compromised, or if the id is ever
carried somewhere other than a React text child.

**The exact fix, one line, either form.** At `weatherService.ts:82`: make the
throw a fixed literal matching how the backend already reports it, or gate the
interpolation on `/^L\d+$/` (the location-id shape `.claude/rules/security.md`
already standardises) and render the bare sentence on a miss.

## 11. F2 — both `/at` handlers accept unbounded and NaN coordinates, pre-existing and until now unrecorded (2026-09-15)

**Status:** pre-existing, not introduced here, deliberately not fixed.

**Measured:** `/weather/at?lat=999` → **500**, `lat=nan` → **500**
(`cannot convert float NaN to integer`), `lat=inf` → **500**; `/tide/at?lat=999`
→ **500**. The `plan` siblings **in the same two files** answer a clean **422**,
because they declare `Query(..., ge=-90, le=90)` / `ge=-180, le=180`. Two sibling
handlers disagreeing inside one file reads as intentional and is not — the
v0.5.91 shape `.claude/rules/security.md` already names.

**Not SSRF and no amplification:** the raise happens inside `get_timezone`, which
sits *outside* every `try` on both handlers and *before* the provider call
(`reached-provider=False` on every measured row), and the values ride `params=`,
so no scheme, host, credential or separator is expressible. No key in any body.

**Worth naming plainly:** this build rewrote both handlers, contained the four
`dt` shapes, and did not consider the far larger coordinate surface sitting
beside them. That is the same neighbours-one-call-away shape this build invoked
twice in its own favour, arriving at a different parameter.

**The exact fix, one line per handler** (`backend/routers/weather.py:75`,
`backend/routers/tide.py:156`), matching the siblings already in those files:
`lat: float = Query(..., ge=-90, le=90), lng: float = Query(..., ge=-180, le=180)`.
That closes the NaN row too; the desktop twins already refuse via
`assertCoordinateRange` and `getTidePlan`'s `Number.isFinite` guard.

## 12. F5 — the capture tool's comment claimed a totality it does not have, corrected (2026-09-15)

**The only edit in the documentation pass.** The comment I added to
`website/tools/weather-capture.mjs` in the previous round read "Every
user-facing terminal sentence the Weather panel can render belongs here", which
is false: five reachable sentences at that surface are not in the pattern (the
checklist-fetch failure and not-found sentences, the coordinate-resolution
failure of decision 10, the `tauriFetch` timeout, and `/weather/at`'s bad-date
400).

**Fail-closed is confirmed and unchanged, and the regex was not touched.** An
unmatched error sentence cannot be read as a healthy frame, because neither
`WEATHER_RESULT` nor `TIDE_RESULT` can match error copy: an unlisted state
classifies as `incomplete`, burns the readiness timeout and fails the capture.
The cost of a gap is a misleading failure *reason*, never a published screenshot
of an error. The comment now states that partial property, names examples as
examples, and no longer instructs the next author to treat the list as complete.

## 13. F3 — the broad-catch invariant is ARGUED, not enforced; stating it explicitly (2026-09-15)

**Status:** Informational. Stated here rather than enforced, because enforcing it
is a code change and this pass is documentation-only.

**The invariant this build relies on:** *no callable reachable inside any of the
eight new guards may import `fastapi` or raise `HTTPException`.* It holds today,
two independent ways: the full import closure of every callable inside every
guard (`services/tide.py`, `services/forecast.py`, `formatters/weather.py`,
`formatters/tide.py`, `services/openweather.py`, `services/noaa.py`,
`services/tide_stations.py`) contains **no `fastapi` import at all**, and
`asyncio.CancelledError` derives from `BaseException` on Python 3.11, so
cancellation is not swallowed.

**What it costs if it ever stops holding, measured** by patching a deliberate
`HTTPException(400)` inside each guarded call:

| Site | A deliberate 400 raised inside becomes |
|---|---|
| `/weather/at` builder | `502` "Weather data unavailable for this location." |
| `/weather/{id}` `format_weather` | `502` "Weather data unavailable for this checklist's time and location." |
| `/tide/at` builder | **`200` `{"status": "unavailable"}`** |
| `/tide/{id}` builder | **`200` `{"status": "unavailable"}`** |

The tide pair is the worse half: a deliberate error would become a **success**
status code. The comments at these sites explain why the parsers are inside the
`try`; none states why a deliberate signal cannot be. Written down here so a
future `fastapi` import anywhere in that closure is a visible assumption rather
than a silent one.

**Enforcement, if taken:** `except HTTPException: raise` immediately before each
broad `except Exception` on the four backend sites, one line each.

---

## For closeout

**ROADMAP's claim that the two named test shapes "transfer as they are" is
measurably wrong and should be corrected.** The ROADMAP entry reads:

> the two test shapes the plan routes carry
> (`test_a_semantically_malformed_body_is_a_502_never_a_500`, the desktop
> `it.each` asserting status 502 and `isOfflineError` false) transfer as they are.

Neither does:

- **The backend shape does not transfer** because `/weather/at` slices **one**
  forecast tier while `build_weather_plan` consumes the whole body. Six of the
  plan suite's seven shapes answer **HTTP 200** through `/weather/at` at the
  default Current tier. Only the *structure* carries over; the table has to be
  rebuilt per tier, which is why the new suite is 12 `(tier, shape)` pairs plus
  a tier-insensitivity control.
- **The desktop shape does not transfer** because it asserts a 502, and only
  **3 of 10** probed weather shapes actually throw on the TS side. The other
  seven resolve with a NaN or a wrong figure, where there is no rejection to
  assert anything about; they are pinned as known divergences instead.
- **The tide half needs a different assertion entirely** — `{"status":
  "unavailable"}`, never a 502.

**Three shapes the brief did not enumerate, all measured raising:**
`hilo predictions` being a string (not just the continuous one);
`current.weather` being an empty list on the desktop side; and — much the
largest — **site 2, `format_weather` over the historical body, where all twelve
probed shapes 500'd on the backend and eight of twelve threw status-less on
desktop.** That site turned out to be the widest of the eight.

**ROADMAP lines owed (the security review's Finding 7; `ROADMAP.md` is left
untouched here because it is the Chronicler's stage).** Line 45 still carries
both the struck "transfer as they are" claim and a description of this defect as
open, when this build closed it. Correct that line, and add one line each for:

- decision 4 — `/tide/at?dt=<impossible calendar>` is a user-reachable 500
- decision 3 — the three `obs_dt` shapes that yield a confidently-wrong reading
- decision 11 — unbounded and NaN coordinates on both `/at` handlers
- decision 10 — the eBird `locId` now reaching rendered copy on desktop

**And the one that only appears when two findings are read together, which
neither decision 3 nor decision 4 says on its own: NEITHER TRANSPORT IS SAFE ON
AN IMPOSSIBLE-CALENDAR DATE.** The backend falls over (a 500 from `shift_local`)
and the desktop silently rolls the date into a real instant via `Date.UTC` and
returns a reading built on it. One falls over, the other lies. That is an
additional reason to take decisions 3 and 4 in the SAME build, which is what
decision 4's reversal condition already requires for a different reason.
