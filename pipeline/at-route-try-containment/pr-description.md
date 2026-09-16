## At-Route Try Containment

### What this does

Applies the v1.0.29 rule in `.claude/rules/security.md` — *a route's `try`, and a
desktop twin's `catch`, covers the builder that consumes the provider body, not
only the fetch* — to the four single-moment lookups the Planner's routes left on
the older shape: `/weather/at`, `/weather/{checklist_id}`, `/tide/at` and
`/tide/{checklist_id}`, plus their four desktop twins.

Before this change, a JSON-valid but semantically malformed provider body
surfaced as the app's own fault: a bare plain-text **500** on FastAPI, and on
the Mac/iPhone/iPad app a **status-less `TypeError`/`RangeError`** that
`isOfflineError` classified as connection-level, so the panel printed *"You're
offline. This needs a connection."* while the device was online and the request
had plainly reached the provider. Now the weather routes map it to their
existing `502` and wording, and the tide routes to `{"status": "unavailable"}` —
the honest state an unreadable body already gets, exactly as `/tide/plan` does.

**The `try` encloses the whole argument expression, not just the builder call.**
Four of the measured NOAA shapes raise inside `parse_observed` /
`parse_predictions` / `parse_hilo` and never reach `compute_tide_reading` at
all, so wrapping the builder alone would have closed only part of the defect.

This also closes the `ZeroDivisionError` half of **F1** from
`pipeline/tide-timezone-parse/security-report.md`, at both of the locations that
finding names.

### How to test

```
cd backend && .venv/bin/python -m pytest tests/ -q      # 636 passed
cd backend && .venv/bin/python -m ruff check .          # All checks passed
cd frontend && npx vitest run src/lib/atRouteServices.test.ts \
  src/components/weatherTideErrorDetail.test.tsx \
  src/components/WeatherTideSection.test.tsx        # 31 + 10 + existing, passed
cd frontend && npm run build                            # clean
cd website/tools && node --test weather-capture.test.mjs   # capture guard
```

`pipeline/at-route-try-containment/how-to-see.md` has a plain-English walkthrough,
including how to confirm that ordinary lookups are unchanged.

### Notes for reviewer

**Red-first, then green.** Every suite was run against the unrepaired code first
and shows the right signature: backend **47 failed / 10 passed**, desktop
**21 failed / 10 passed**, call-site detail **4 failed / 6 passed**, where every
green row before the repair is a control (tier-insensitivity, well-formed-body,
pinned divergences, offline preservation, and the three silent tide-date rows
that assert a `200 ok` the unrepaired code already produces). After the repair:
**57**, **31** and **10**.

An earlier revision of this PR reported the backend figure as 50 / 7. That was
measured against a draft of the test file, before the tide `obs_dt` rows were
split into raising and silent groups; 47 / 10 is the shipped file, re-measured
by reverting both routers to HEAD and restoring them (verified by sha256 and by
re-running the full suite, since a restore checked only against its own snapshot
cannot fail). `decisions.md` §9 records it.

**The gate held.** `test_weather_at.py` and `test_tide_at.py` (12 tests) pass
**unedited** — `git status` shows neither file touched. Full backend suite went
579 → 636 (+57, all new). Scoped frontend suites: 266 passed across 9 files.

**The two named test shapes do NOT transfer verbatim, and ROADMAP says they do.**
`/weather/at` is tier-sensitive — it slices one forecast tier, so six of the
seven plan-suite shapes answer **200** there at the default Current tier. The
tables were rebuilt per tier from live measurement, and a
tier-insensitivity control proves the rows are not passing for an unrelated
reason. On the desktop side only 3 of 10 probed weather shapes actually throw,
so only those can assert a 502. ROADMAP needs correcting; `decisions.md` has the
exact wording.

**Three shapes the brief did not enumerate**, all measured raising. The largest
is **site 2** — `format_weather` over the historical body in
`/weather/{checklist_id}` — where **all twelve** probed shapes 500'd on the
backend and eight of twelve threw status-less on desktop. Also:
`hilo predictions` being a string, and `current.weather` being an empty list.

**Scope calls, all argued in `decisions.md`:**

- `obs_dt` containment was scoped in by the Orchestrator. Its honest failure
  state is a **new** 502 detail, `"This checklist's date could not be read."`,
  on both transports — not the weather wording (which would name a provider that
  is never called on that path; the test asserts `fetch_historical` is not
  awaited) and not "Please try again" (which would promise a retry that is
  deterministic).
- **I also contained the tide twin** of that same date defect, measured raising
  on `normalize_obs_dt` / `shift_local`. Fixing one and leaving its twin one file
  away is the split the preceding build's own convention flag warns against.
- **I deliberately did not fix `GET /tide/at?dt=<malformed>`**, which I measured
  as a genuine user-reachable 500 where its `/weather/at` sibling already answers
  400. Fixing only the backend would open a *new* twin divergence, and closing
  that properly means changing a shipped builder — the class ruled out of scope.
  Recorded with evidence, reversal condition and the exact fix.
- The two out-of-scope items stayed out: the silently-wrong tide reading (F1's
  other half) and teaching `forecastSlice.ts` to refuse a non-numeric figure.
  Both are **pinned as passing test rows** so they read as measured decisions
  rather than oversights, and so neither can change silently.

**Worth a close look:** `it('a connection-level failure is still OFFLINE, not a
502')`. On desktop the fetch stays *outside* the new `catch` on purpose — a
genuinely offline device must keep getting the offline message rather than being
told the provider failed. That test goes red if anyone widens the catch.

**The detail had to survive the CALL SITE, not just the throw** (caught in
review; `decisions.md` §8). The desktop services throw a plain `Error` carrying
`status`/`detail`, and both weather call sites extracted the detail with
`err instanceof TransportError ? … : undefined` -- so the sentence was dropped
and the user got "Something went wrong. Please try again." on Mac/iPhone/iPad
while web/Pi showed the real reason. A swept count found six sites that extract
a detail; four already handled a non-`TransportError` throw and exactly two,
both weather, did not. They now use the same expression as
`MapExplorer.tsx:196`, `useHotspotActivity.ts:112` and
`useCountyCompleteness.ts:61`.

`weatherTideErrorDetail.test.tsx` asserts this **at the render** -- real
component, real `classifyLiveError`, real `OfflineMessage` -- and was watched
failing with the literal generic string first. Its `TransportError` row passed
throughout, which is what makes the transport divergence a measurement. The file
also carries a five-site roster with cardinality, covering `App.tsx`, which has
no component harness; the file says plainly which half is rendered text and
which is code shape.

**Not changed, and argued rather than missed:** `WeatherForecastPanel` (the
`/weather/at` and `/tide/at` consumer) never extracts a detail at all -- it uses
`classifyLiveError(err).kind` and renders its own fixed copy -- so no sentence
from those two routes has ever reached the screen there. Pre-existing, outside
the swept scope.

**`website/tools/weather-capture.mjs`** gained the new sentence in its
fail-closed `TERMINAL_ERROR` pattern, with a test row. A stale pattern there
degrades silently: an unmatched terminal state reads as a healthy frame and the
tool publishes a screenshot of an error.

**Security review: PASSED WITH NOTES — nothing Critical or High.** Seven
findings; five pre-existing or already recorded. Two a reviewer should know:

- **This build introduces the one exception to its own fixed-literals property
  (Low, accepted; `decisions.md` §10).** The call-site fallback un-suppresses a
  pre-existing throw at `weatherService.ts:82` that interpolates an unvalidated
  eBird `locId`, so on desktop that id now reaches rendered copy where it
  previously fell through to the generic string. Measured: it renders escaped,
  creates **zero** `<script>` elements, and web/Pi never shows it. Accepted with
  a reversal condition and a one-line fix recorded.
- **The broad-catch invariant is argued, not enforced (Informational;
  `decisions.md` §13).** A deliberate `HTTPException` raised inside a guarded
  call would become a 502 on the weather sites and a **200 `unavailable`** on
  the tide sites. Nothing can raise one today (no `fastapi` import anywhere in
  the guards' import closure), and that is now stated as an explicit invariant
  rather than left to be inferred.

Also newly recorded: both `/at` handlers accept unbounded and NaN coordinates
and 500 on them while the `plan` siblings in the same files answer 422
(`decisions.md` §11, pre-existing, one line per handler to fix).

**Bundle impact: none, measured not assumed.** The new test file lives under
`frontend/`, which Tailwind scans as a build source. Built CSS is byte-identical
with and without it (md5 `91ae90a4f503b450b82e28c5c8b6ca5a`, 112,607 bytes),
with a determinism control and a verified restore.

**No version bump.** One build in a bundled Spool release; all four version files
verified untouched. The changelog line this build is owed:

```
- Fixed: when a weather or tide service sends back a response SnowRaven can't
  read, you now get a clear "weather data unavailable" note instead of a raw
  server error, and the app no longer tells you that you're offline when you
  aren't.
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
