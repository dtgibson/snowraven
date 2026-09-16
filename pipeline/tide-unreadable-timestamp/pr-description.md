# Tide: an unreadable NOAA timestamp drops its point instead of anchoring at 1970

## What this does

`_epoch_min` / `epochMin` returned `0.0` — the 1970 epoch — for a NOAA `t` they
could not read, and `compute_tide_reading` then built a confident water level
from that anchor. Because 1970 is 56 years from any tide window, the
interpolation fraction collapsed to ~0.99999 and the reading degenerated into
"return the other bracket": a window whose true answer is `Water level: 2.4 – 2.8
ft` rendered `Water level: 1.5 – 1.5 ft`, with `Previous high: 3.6 ft at ` and
nothing after the "at".

A `t` that cannot be placed on the epoch axis now means that point is **missing**
— it is dropped from the series before any level is derived from it, on both
runtimes, exactly as the sibling `build_tide_plan` / `buildTidePlan` already did
for the same provider and the same field.

**The hard part is that 20 of the 23 unreadable shapes rendered byte-identically
on BOTH runtimes**, so no cross-transport parity check could see this, by
construction — the shape `weather-at-malformed-parity/decisions.md` §4 named. The
two new suites therefore assert against ground truth derived structurally rather
than against the other runtime: the block rendered from a series carrying an
unplaceable `t` must equal the block the same builder renders from that series
with the entry **removed**.

Five things moved, and the last four are not closed by the sentinel fix alone:

1. **The sentinel.** One shared placement predicate per runtime
   (`backend/services/tide_instant.py`, `frontend/src/lib/tideInstant.ts`)
   returning `None` / `null`. It is deliberately **not** spelled `== 0` or
   `> 0`: `1970-01-01 00:00` is a placeable instant whose epoch IS the old
   sentinel, and a pre-1970 instant is placeable and negative.

2. **The divisor, which is a bracketing problem rather than a sentinel problem.**
   `interp_level` brackets on the STRING and divides on the EPOCH, so two
   *well-formed* strings naming one instant (`2026-05-01 10:09` and
   `2026-05-01T10:09`) raised `ZeroDivisionError` on web/Pi and produced
   `Water level: -Infinity ft` on desktop. The equality guard moves onto the
   placed epoch, as `interp_at_epoch` already does.

3. **The clock.** `_clock` / `clockTime` re-scanned the string with an unanchored
   `[ T](\d{2}):(\d{2})`, rendering `1:61pm` for `2026-13-40 25:61` and `3:07pm`
   for `2026/05/01 15:07`. The scan is deleted; a clock is formatted from the
   components the placement already validated. This closes the `\d` fence build 4
   deferred here by name.

4. **The parsers, which diverged BEFORE the sentinel.** `str(None)` is `"None"`
   and `String(null)` is `""` — and `"None"` sorts after every real timestamp
   where `""` sorts before, so the two runtimes bracketed the same window with
   different points. All three parsers now require `t` to be a string and drop
   the entry otherwise, matching `_num` / `parseFloat` already dropping a
   non-numeric `v`.

5. **The Planner, whose span filter had been hiding a live divergence.** Shapes
   that roll to an instant OUTSIDE the fetched span were dropped for that second,
   unrelated reason and agreed by accident. Pick one that rolls INTO the span
   (`2026-04-36 12:00`, `2026-05-05 25:00`, `2026-05-06 12:90`) and desktop drew a
   labelled turning point and a descending curve where web/Pi drew a flat line —
   **and the plan document is persisted to `replay.json`, so the invented turning
   point re-rendered offline.** `t > 0` is replaced by the shared predicate.

Reachability is narrow and worth stating honestly: the only producer of `t` is
NOAA over HTTPS on both transports, nothing user-supplied and nothing replayed
reaches this field. This is a robustness-and-parity repair, not a defect with a
known live trigger. What makes it worth doing is that when it does happen, the
app states a figure it has no basis for, identically on both transports, in the
block a user pastes into a permanent public eBird checklist comment.

## How to test

`pipeline/tide-unreadable-timestamp/how-to-see.md` walks through it locally with
no network. In short:

1. `cd backend && .venv/bin/python -m pytest tests/test_tide_unreadable_parity.py tests/test_tide_epoch_parity.py tests/test_tz_clock_parity.py -q`
2. `cd frontend && npx vitest run src/lib/tideUnreadableParity.test.ts src/lib/tideEpoch.parity.test.ts src/lib/tide.test.ts`
3. To see the defect itself, check out the previous commit's
   `backend/services/tide.py` into a scratch file and render the control window
   from `tideUnreadable.fixture.json` with the previous high's `t` set to `""` —
   `how-to-see.md` gives the exact snippet. It prints `Water level: 1.5 – 1.5 ft`
   and `Previous high: 3.6 ft at `.

## Notes for reviewer

- **Two corrections to an already-checkpointed build are in this diff, and both
  were false claims rather than gaps.** `backend/routers/tide.py` stated its
  `try` "closes the ZeroDivisionError half of F1"; that was true on one runtime
  only, because TypeScript does not throw on division by zero and the
  identically-placed `catch` in `tideService.ts` caught nothing. Both comments
  are corrected in place and the desktop half now carries the statement too.
  `services/tz_clock.py`'s docstring justified keeping `gmt_epoch` separate from
  `_epoch_min` on the grounds that the latter "reads the PROCESS zone" — true
  when written, false since v1.0.32 fixed exactly that, and the two have been the
  same arithmetic behind two byte-identical patterns ever since. They are now one.

- **The three pinned divergences in `tideEpoch.fixture.json` are CONVERGED, not
  deleted.** The `divergent` list becomes a `converged` list holding the same
  three strings, regenerated through `tideEpoch.fixtureGen.test.ts` under
  `SR_GEN_TIDE_EPOCH_FIXTURE=1` rather than by hand, and both guard tests are
  rewritten around it. Each side keeps a literal before-table and a
  guard-the-guard row asserting that something actually moved — the agreement row
  alone compares this twin against a column the OTHER twin generated, and would
  pass just as happily if nothing had changed. Note that the moving side is not
  the same on every row: the backend already refused the two impossible calendars,
  and on year 1 the roles invert.

- **`frontend/src/lib/tide.test.ts` has a three-line import change** — the only
  edit to a file the brief listed as "stays green unchanged". `epochMin` moved to
  `tideInstant.ts` as `placeEpochMin` when its sentinel was removed, so the import
  had to follow; the assertion and its value (`1440`) are untouched. Keeping a
  dead `epochMin` alive in `tide.ts` purely to avoid the edit would have been
  worse. Every other file on that list is green unchanged.

- **`.claude/rules/weather-tide.md` gains `tidePlan.ts` and `tideInstant*.ts`.**
  `tidePlan.ts` — the twin whose document is persisted to `replay.json` — matched
  no path in that file, so a change to it loaded neither the byte-golden parity
  rules nor the marker vocabulary. Same path-gating shape CLAUDE.md records as
  having shipped a stale version pill for five commits. One asymmetry is named
  and deliberately left: that file lists its backend entries individually, so the
  three Python twins are covered by `security.md`'s `backend/services/**` glob
  but not by `weather-tide.md`.

- **The new placement predicate is declared as a scan over provider text with its
  linearity argument attached**, per `.claude/rules/security.md` (v1.0.23) — but
  this build ends with **fewer** scans than it started with: two byte-identical
  patterns become one, and `_clock`'s unanchored search is deleted outright.
  `backend/services/tide.py` now contains exactly one regex.

- **Three mutations came back GREEN on the first harness run and each was a
  finding about the tests**, not a clean bill: the clock repair was untestable
  because the placement filter upstream makes it unreachable (closed with a
  direct roster block), and "revert the Planner predicate" turned out to name two
  call sites while the replacement reached one. The table is
  `decisions.md` §11; 13 of 15 now go red, and the two that stay green are
  provably equivalent for the structural reason in §7.

- **One measured difference is deliberately NOT acted on and is recorded as a
  decision** with its evidence, reversal condition and exact fix
  (`decisions.md` §10): `2026-05-01T10:09` and `2026-05-01 10:09` place to the
  same instant but sort to opposite sides of the window, because `'T'` > `' '`
  and the series is bracketed as text. Build A/B confirms it is pre-existing and
  byte-identical before and after this change; fixing it means moving the
  bracketing, the window test and the sort onto the placed epoch, which is a
  change to the well-formed path and collides with the deferred station-zone
  decision.

- `tsconfig.app.json` sets no `strict`, so the compiler will not enforce the null
  check at any call site of the new predicate. Every consumer is pinned
  behaviourally instead, and the module says so at its own definition site.

- **No version bump in this build.** Build 5 of 5 in a bundled Spool release
  taking one four-file bump at the flush.

### Changelog line

- Tide: a NOAA timestamp the app cannot read now drops that high or low from the
  reading instead of being treated as 1970, which had produced a plausible but
  wrong water level, and a "Previous high … at" line with no time after it, in the
  copy-ready block. The desktop, iPhone, iPad and web readings agree on which
  timestamps are unreadable, and the Weather/tide Planner no longer draws a
  turning point for a date that does not exist.

### Deferrals for The Chronicler

1. **The `T`-separator sort-order difference** (`decisions.md` §10): two spellings
   that place to the same instant bracket the window differently, because
   bracketing, windowing and sorting are done on the STRING. Measured,
   pre-existing, deliberately not fixed. Reversal condition and the exact
   three-call-site fix are recorded; it should be taken together with the
   deferred station-zone decision in `tide-timezone-parse/decisions.md`, which
   threads a timezone through those same call sites.

2. **`tide-timezone-parse/decisions.md` carries a count slip in a heading** —
   "Pin the **two** twin divergences" against a body, a fixture and every
   downstream document saying three. Named rather than edited, since that build's
   record is closed. It is a live instance of this bundle's own "state the
   property, never a count" flag, in the record that flag would have protected.

3. **`.claude/rules/weather-tide.md`'s backend entries are listed individually**
   where its frontend entries are globbed, so `plan_tide.py`, `tz_clock.py` and
   `tide_instant.py` load `security.md` but not the weather/tide conventions.
   Pre-existing and named in that file's own comment; widening it is a decision
   for its own build rather than a bug-fix side effect.

4. **`interp_level` / `interpLevel`'s `at is None` degradation becomes
   unreachable** if deferral 1 is ever taken, and should be removed in that same
   change rather than left as an unmeasured guard.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
