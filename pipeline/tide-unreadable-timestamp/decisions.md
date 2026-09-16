# Decisions — Tide Unreadable Timestamp

Every table here was measured by driving the real parsers, the real builders and
the real formatters on both runtimes, before the repair was written and again
after it. Probe scripts and the mutation harness ran from this session's
scratchpad and are not committed; the shipped equivalents are
`frontend/src/lib/tideUnreadable.fixture.json` and
`frontend/src/lib/tideEpoch.fixture.json`, which both new suites drive.

The brief's numbers reproduced. The control window reads `Water level: 2.4 – 2.8
ft`; with the previous high's `t` unreadable both runtimes rendered `Water level:
1.5 – 1.5 ft` and `Previous high: 3.6 ft at `, byte for byte.

---

## 0. The measurement, before and after

Red-first, both runtimes, against ground truth rather than against each other.
The two new suites were written first and watched failing at HEAD.

| | backend rows | frontend rows |
|---|---|---|
| red-first, at HEAD | **70 failed**, 355 passed | **60 failed**, 90 passed |
| after the repair | 0 failed, 425 passed | 0 failed, 150 passed |

**Corrected at QA.** The before-row originally read 59/340 and 51/73, taken on a
smaller revision and never re-taken as rows were added; QA re-derived it at HEAD
as 70/355 and 60/90. The *after* denominators were right all along, which is the
tell -- a before and an after measured at different times, in the very section
that names that hazard. The substance is stronger than was claimed, not weaker.

Red-first is recorded PER GUARD in §11's mutation table rather than as one
combined figure, per build 4's flag: a combined count is stale the moment a row
moves -- which is exactly what happened to the figures above.

**Two scenarios were green at HEAD and stayed green, and that is stated rather
than quietly enjoyed.** `observed-point` and `nearest-pool-one` agreed and were
defensible before this build — an unreadable `t` on an observed point is already
excluded from the window by `_in_window`'s string comparison, and a pool with one
placeable candidate left still ranks that candidate first. Those rows are
coverage, not evidence. The rows that carried the finding are `prev-high`,
`next-low`, `nearest-pool-all`, the four divisor pairs, the parser rows and the
Planner rows.

---

## 1. An unplaceable `t` means the point is MISSING, and the repo already had the answer (2026-09-16)

**Decision:** a NOAA `t` that cannot be placed on the epoch axis removes its
point from the series before any level is derived from it, on both runtimes. It
is never anchored at 1970, never contributes an interpolation weight, never ties
for nearest, and never renders a clock.

**Why this rather than refusal.** Build 4 concluded that *refusal* was the right
axis for its own case and asked this build to check rather than inherit. The two
genuinely differ and the difference is whose string it is. Build 4's `dt` is a
request parameter naming a moment the caller wants, so an unreadable one names no
moment and there is nothing to degrade to. This build's `t` is one datum inside a
series the provider sent; the other points are fine, and refusing a whole reading
over one unplaceable row would throw away a working panel.

**The sibling builder is the argument.** `build_tide_plan` / `buildTidePlan` have
dropped an unplaceable point rather than anchoring it since the Planner shipped —
same provider, same field, same repo. Copying that shape is a smaller claim than
inventing one.

**The 1970 anchor is the mechanism, and it is worth stating precisely because it
is what makes the number look ordinary.** A bad anchor 56 years from the window
does not produce a wild figure. It produces an interpolation fraction so close to
1 that the interpolation degenerates into "return the other bracket" — plausible,
in range, correctly rounded, and wrong by however far the window sits from that
bracket. `Water level: 1.5 – 1.5 ft` is a range of a value with itself (the two
endpoints differ in the seventh significant figure), which is the only tell.

---

## 2. The predicate may not be spelled `== 0` or `> 0`, and both halves are real (2026-09-16)

**Decision:** `place_instant` / `placeInstant` return a distinguishable
`None` / `null`, single-sourced per runtime in `backend/services/tide_instant.py`
and `frontend/src/lib/tideInstant.ts`.

Neither comparison-against-zero spelling works, and neither is theoretical:

| spelling | what it gets wrong | fixture row |
|---|---|---|
| `== 0` | `1970-01-01 00:00` is a placeable instant whose epoch IS the old sentinel | `the-epoch-itself` |
| `> 0` | a pre-1970 instant is placeable and NEGATIVE — and the shipped Planner used exactly this | `far-past`, `1900-01-01 00:00` |

The old fixture said so about itself: its `1970-01-01 00:00` row carried the
comment *"whose 0 is indistinguishable from the no-match sentinel"*. There is no
sentinel now, so it is distinguishable, and the row stays as the reason the
predicate is shaped this way.

**Stated cost.** `tsconfig.app.json` sets no `strict`, so `strictNullChecks` is
off and the compiler will not enforce the null check at any call site. Every
consumer is therefore pinned BEHAVIOURALLY (§11) rather than by the type, and the
module says so at its own definition site.

---

## 3. The divisor is a bracketing problem, not a sentinel problem (2026-09-16)

**Decision:** `interp_level` / `interpLevel` move the equality guard onto the
PLACED epoch, exactly as `interp_at_epoch` / `interpAtEpoch` already do.

**This is measured, not argued, and it is the half the brief's pointer did not
cover.** These functions bracket on the STRING and divide on the EPOCH, so the
old `prev["t"] == nxt["t"]` guard never saw two distinct strings naming one
instant. Filtering unplaceable points out does nothing for it.

| hilo pair | backend, before | desktop, before | both, after |
|---|---|---|---|
| `""` and `"zzz junk"` | `{"status":"unavailable"}` | `ok`, `Water level: -Infinity ft` | `unavailable` |
| `""` and `"not a date"` | `{"status":"unavailable"}` | `ok`, `Water level: -Infinity ft` | `unavailable` |
| `2026-05-01 10:09` and `2026-05-01T10:09` | `{"status":"unavailable"}` | `ok`, `Water level: -Infinity ft` | `ok`, finite |
| `2026-02-30 09:00` and `2026-13-40 25:61` | `{"status":"unavailable"}` | `ok`, `Water level: 3.2 – 3.2 ft` | `unavailable` |

The third row is the one that proves the point: **both strings are well-formed**
and both place. The fourth is the worst: no error, no infinity, an ordinary
`3.2 ft` computed between two dates that do not exist.

**A fifth instance turned up inside the roster itself**, which is what a roster
is for: `next-low / iso-t-separator` put `2026-05-01T10:09` opposite a real
`2026-05-01 10:09` bracket and raised `ZeroDivisionError` on the backend at HEAD.
Nobody wrote that row as a divisor case.

**The degradation is `prev["v"]`, which is not a new answer** — it is the same
answer the string-equality guard always gave for a zero span, extended to the two
other ways a fraction can fail to exist (an unplaceable window `t`, and a zero
divisor between two placeable brackets).

---

## 4. Correcting build 4's comment: the `try` closed the ZeroDivisionError on ONE runtime (2026-09-16)

**`backend/routers/tide.py` stated that its `try` "closes the ZeroDivisionError
half of F1 … where two sentinel epochs give `interp_level` a zero divisor". That
was true here and true on one runtime only.** TypeScript does not throw on
division by zero, so the identically-placed `catch` in
`frontend/src/lib/tauri/tideService.ts` caught nothing, and the same NOAA body
answered `{"status": "unavailable"}` on web/Pi against `Water level: -Infinity ft`
on desktop — on three of the four divisor pairs, and an ordinary-looking
`3.2 – 3.2 ft` on the fourth.

**Both comments are corrected in place rather than deleted**, and the desktop
half now carries the statement too, because the missing sentence was on the side
that had no evidence it was missing. A containment `try` was never the fix in
either direction; `interp_level` guards the divisor at the source, so F1 is closed
on both runtimes. Both `try` blocks stay for the parser shapes they were always
doing the work for (a list holding non-objects, a `predictions` that is a string).

**The durable half:** a containment `try` that catches a language-specific throw
is a ONE-RUNTIME fix wearing a twinned fix's clothes, and the twin's silence looks
identical to the twin being fine. Where a repair is a `try`, ask what the other
language does with the same body — not whether it has a `try` in the same place.

---

## 5. `_clock` / `clockTime` format from the placed instant and scan nothing (2026-09-16)

**Decision:** the clock is derived from the components `place_instant` already
validated. The unanchored `re.search(r"[ T](\d{2}):(\d{2})")` is deleted, not
repaired.

This is the `\d` fence build 4 deferred here by name
(*"its input is NOAA's RESPONSE `t`, which is the next build's subject"*), and it
was a rendering defect as well as a character-class one:

| input | before | after |
|---|---|---|
| `2026/05/01 10:09` | `10:09am` from a string that places nowhere | returned verbatim |
| `2026-13-40 25:61` | **`1:61pm`** — sixty-one minutes past one | returned verbatim |
| `\n2026-05-01 10:09` | `10:09am` (the search was unanchored) | returned verbatim |
| `٢٠٢٦-٠٥-٠١ ١٠:٠٩` | a clock on Python, verbatim on TS — **the twin divergence** | verbatim on both |

Deleting the scan is better than fixing its character class: it closes the
anchor defect and the class defect together, and it removes a scan over provider
text rather than adding one. `backend/services/tide.py` now contains exactly one
regex (`shift_local`'s), and its comment naming `_clock` as the remaining open
`\d` is corrected in the same change.

**The passthrough is the total function's boundary, not a second guard.**
`compute_tide_reading` labels only points that survived the placement filter, so
an unplaceable string cannot reach the copy block through it. That is stated at
both definition sites with the test that would catch a re-opening, rather than
left as a guard a later reader would reasonably delete.

---

## 6. A non-string `t` is DROPPED at the parser, not coerced (2026-09-16)

**Decision:** all three parsers on both runtimes require `t` to be a string and
drop the entry otherwise.

The brief asked for this to be decided explicitly. The two coercions were never
twins, and the divergence never reached the sentinel at all:

| `t` | `str(t)` | `String(t)` | consequence |
|---|---|---|---|
| `null` | `"None"` | `""` | **`"None"` sorts AFTER every real timestamp; `""` sorts BEFORE every one** |
| `true` | `"True"` | `"true"` | different bracket on a series sorted as text |
| `[]` | `"[]"` | `""` | as above |
| `{}` | `"{}"` | `"[object Object]"` | as above |

Because the series is bracketed and windowed by STRING comparison, two runtimes
holding different strings for the same JSON take different branches — which is
why this was a measured `prev-high` divergence with nothing to do with placement.

**Dropping rather than agreeing on a coercion**, for three reasons: it matches
`_num` / `parseFloat` already dropping a non-numeric `v`; it makes the two
parsers produce identical output from identical JSON rather than identical
*wrong* output; and it removes the sort-order question instead of answering it.

**Stated widening.** This is a parser change, so it reaches the Planner's inputs
too. Measured: no effect there, because such an entry was already unplaceable and
dropped one step later. The observable change is confined to the parser's own
output length, which the new suites assert on both runtimes.

---

## 7. The Planner: "placeable", not "positive" (2026-09-16)

**Decision:** `gmt_epoch` / `gmtEpoch` delegate to the shared placement predicate
and return `int | None`; both call sites test `is not None` / `!== null`.

**The span filter had been HIDING a live divergence.** Over the brief's 24-shape
roster the two plan documents agreed on all 24 — because the impossible-calendar
shapes roll to instants OUTSIDE the fetched span on the TS side and were dropped
for that second, unrelated reason. Pick a shape that rolls INTO the span and the
agreement disappears: `2026-04-36 12:00`, `2026-05-05 25:00` and
`2026-05-06 12:90` each made desktop draw a labelled turning point and a
descending curve where web/Pi drew a flat line, from the same body. **And the
plan document is persisted to `replay.json`, so the invented turning point
re-rendered offline.**

**`t > 0` was not the predicate it meant**, and the two rows that say so are now
in the fixture: `1970-01-01 00:00` (placeable, epoch exactly 0) and
`1969-07-20 20:17` (placeable, negative). Both were silently dropped.

**Measured asymmetry between the two call sites, stated rather than papered
over.** The predicate change is observable on the CONTINUOUS arm and provably
unobservable on the TURNING-POINT arm. The turning-point test is
`t > 0 and span["hiloStartTs"] <= t <= span["hiloEndTs"]`, and `hiloStartTs` is
derived from `now` — about 1.78e9 for any real clock — so `t > 0` is *implied by*
the span bound and contributes nothing. That is a structural argument rather than
a measurement, which is why it is stated here: a measurement dates, a structure
does not. Its reversal condition is a span whose `hiloStartTs` is at or below
zero, which requires a system clock at or before 1970. The mutation table records
both arms honestly (§11, M6a/M12a GREEN by equivalence, M6b/M12b RED).

---

## 8. One placement predicate, two unit conversions — and a stale justification corrected (2026-09-16)

**Decision:** `_LST_RE` (`services/tide.py`) and `_GMT_RE` (`services/tz_clock.py`)
are consolidated into one pattern in `services/tide_instant.py`, with
`place_epoch_min` (minutes, for the single-moment builders) and `place_epoch_sec`
(seconds, for the Planner) as unit conversions over it.

**`tz_clock.py`'s docstring carried a justification that had gone false.** It said
`gmt_epoch` was *"deliberately not the shipped `_epoch_min` in services/tide.py,
whose naive `datetime.timestamp()` reads the PROCESS zone"* — true when written,
and false since v1.0.32 gave `_epoch_min` an explicit `tzinfo=utc` for exactly
that reason. From that point the two were the same UTC calendar arithmetic behind
two byte-identical patterns, differing only in unit and in what they returned for
a string they could not read.

**Keeping them apart bought nothing and cost a divergence.** `_epoch_min` was
fixed to refuse impossible calendar values where its TS twin rolled them over,
and the Planner pair inherited that same split — which is §7's finding. The
comment is corrected in place rather than removed, per build 4's flag that a
source comment citing another file is a claim about that file and the present
tense is the trap.

---

## 9. The three pinned divergences are CONVERGED, not deleted (2026-09-16)

**Decision:** `tideEpoch.fixture.json`'s `divergent` list becomes a `converged`
list holding the same three strings, regenerated through
`tideEpoch.fixtureGen.test.ts` under `SR_GEN_TIDE_EPOCH_FIXTURE=1` rather than by
hand, and both guard tests are rewritten around it.

| `t` | PY before | TS before | both, after |
|---|---|---|---|
| `2026-13-40 25:61` | `0.0` (sentinel) | `30037081` (rolled into 2027) | `None` / `null` |
| `2026-02-30 12:00` | `0.0` (sentinel) | `29540880` (rolled to March 2) | `None` / `null` |
| `0001-01-01 00:00` | `-1035593280.0` (year 1) | `-36290880` (1901) | `-1035593280` |

**Note which side moved, because it is not the same side on every row.** The
backend already refused the two impossible calendars (returning the sentinel,
which is what became `None`); the TS side is where `Date.UTC` rolled them into
real instants. On year 1 the roles invert — the backend was already right and the
TS twin came to meet it, closed by building the date through `setUTCFullYear`,
which does not carry `Date.UTC`'s legacy two-digit-year mapping.

**Why rewritten and not deleted.** The pin existed so that *"a change to EITHER
side turns a row red and sends the next reader to
pipeline/tide-timezone-parse/decisions.md"*. A row that separates — or used to
separate — the twins is what makes their agreement elsewhere a measurement rather
than an assumption, and that is as true after the convergence as before it. Each
side therefore keeps a literal before-table (`PY_BEFORE`, `TS_BEFORE`) and a
guard-the-guard row asserting that something actually moved, because the
agreement row alone compares this twin against a column the OTHER twin generated
and would pass just as happily if nothing had changed.

**Also corrected here: a count.** `tide-timezone-parse/decisions.md`'s second
decision is headed *"Pin the two twin divergences"* while its body, the fixture
and every downstream document say three. Named for the Chronicler rather than
edited, since that build's record is closed.

---

## 10. A measured difference this build did NOT act on: the `T` separator sorts where it does not place (2026-09-16)

**Decision: not fixed, deliberately.** Recorded here with its evidence, its
reversal condition and its exact fix, because a silent non-action and an
oversight leave the same evidence (CLAUDE.md, 2026-09-15).

**The measurement.** `2026-05-01 10:09` and `2026-05-01T10:09` place to the SAME
instant (`29627169.0` on both runtimes, asserted in the shared fixture). They do
not sort to the same place: `'T'` (0x54) is greater than `' '` (0x20), so

```
"2026-05-01 10:09" <= "2026-05-01 12:00"   ->  True
"2026-05-01T10:09" <= "2026-05-01 12:00"   ->  False
```

and the series is bracketed, windowed and sorted as TEXT. A previous high written
with the ISO separator therefore sorts after the window start, drops out of the
`prev` bracket, and the block reads `Water level: 1.5 ft` with no
`Previous high:` line where the space-separated twin reads `2.4 – 2.8 ft`.

**Build A/B: this is pre-existing and this build did not move it.** Measured
against `git show HEAD:backend/services/tide.py`, before and after are identical
on both spellings. It is a different axis from this build's subject — the STRING
order disagreeing with the EPOCH order, not a string failing to place — and both
runtimes do the same thing, so it is not a parity divergence either.

**Why not now.** Fixing it means moving the bracketing, the window test and the
sort onto the placed epoch throughout `compute_tide_reading`, which is a change to
the WELL-FORMED path and to the byte-golden formatter parity — the brief's own
"must NOT change" list. It would also collide with the deferred station-zone
decision in `tide-timezone-parse/decisions.md`, which proposes threading a
timezone through those same three call sites.

**Reachability.** NOAA emits `YYYY-MM-DD HH:MM` for all three products, captured
live 2026-09-16; no observed response uses the `T` separator. The `[ T]` class
admits it deliberately and the fixture has carried a `T` row since v1.0.32.

**Reversal condition:** NOAA emitting a `T`-separated `t` on any product, or any
change that makes the window strings themselves `T`-separated.

**The exact fix, if taken:** in `backend/services/tide.py` `compute_tide_reading`
and its twin in `frontend/src/lib/tide.ts`, sort `sh`, `obs_in` / `pred_in` and
the `inside` list on `place_epoch_min(p["t"])` rather than on `p["t"]`, and
replace `_in_window` / `inWindow`'s string comparison with an epoch comparison
against placed `start` and `end`. `interp_level`'s bracketing loop then reads the
placed epoch too, at which point its `at is None` degradation becomes unreachable
and should be removed rather than left as an unmeasured guard.

---

## 11. Mutation table: every guard, one arm at a time (2026-09-16)

Harness rules applied, all three from build 4's flags: the snapshot is re-taken
at the moment of the run (a snapshot that ages performs a silent revert); the
mutated file is asserted to DIFFER from the snapshot and the pattern's match
count is asserted, so a replace weaker than its own label cannot produce a stable
plausible wrong number; and the restore is verified by hash against the INTENDED
content rather than against the copy used to restore it.

| # | mutation | backend suite | frontend suite |
|---|---|---|---|
| M1 | backend: delete the placement filter in `compute_tide_reading` | **RED** | GREEN |
| M2 | backend: revert `interp_level`'s divisor guard to string equality | **RED** | — |
| M3 | backend: drop `parse_hilo`'s string-`t` requirement | **RED** | — |
| M4 | backend: revert the nearest-point pool to the sentinel ranking | **RED** | — |
| M5 | backend: revert `_clock` to the unanchored `\d` scan | **RED** | — |
| M6a | backend: revert the Planner's TURNING-POINT predicate to `t > 0` | GREEN | — |
| M6b | backend: revert the Planner's CONTINUOUS predicate to `t > 0` | **RED** | — |
| M7 | frontend: delete the placement filter in `computeTideReading` | GREEN | **RED** |
| M8 | frontend: revert `interpLevel`'s divisor guard to string equality | — | **RED** |
| M9 | frontend: drop `parseHiLo`'s string-`t` requirement | — | **RED** |
| M10 | frontend: revert the nearest-point pool to the sentinel ranking | — | **RED** |
| M11 | frontend: revert `clockTime` to the unanchored `\d` scan | — | **RED** |
| M12a | frontend: revert the Planner's TURNING-POINT predicate to `t > 0` | — | GREEN |
| M12b | frontend: revert the Planner's CONTINUOUS predicate to `t > 0` | — | **RED** |
| M13 | frontend: revert `gmtEpoch` to the rollover-permitting `Date.UTC` math | — | **RED** |

**M1 and M7 are the deletion coverage (v1.0.20), and the cross column is the
claim.** Each side's placement guard turns only ITS OWN suite red: single-sourcing
a predicate across two languages stops the copies drifting and does nothing to
stop one being dropped.

**Three mutations came back GREEN on the first run and every one was a finding
about the tests.**

- **M5 and M11 (the clock scan).** Green because `compute_tide_reading` labels
  only placement-filtered points, so the scan's behaviour never reached an
  assertion — which would have closed build 4's handed-over fence with nothing
  pinning it closed. Closed by a direct roster block asserting that the clock
  returns an unplaceable string VERBATIM and renders a clock for every placeable
  one. Verbatim rather than "not clock-shaped" is deliberate: it is what also
  catches the Arabic-Indic row, where the reverted Python half renders a
  half-ASCII clock (`10:٠٩am`) that no pattern of ASCII digits would reject.

- **M6 (the Planner predicate), which was also a mutation weaker than its own
  label.** It read GREEN, and the label said "revert the Planner predicate" while
  the replacement touched only the turning-point loop of two. Split into M6a/M6b:
  the continuous arm is genuinely guarded (M6b RED, by the two new
  placeable-not-positive rows), and the turning-point arm is genuinely
  unobservable for the structural reason in §7. **The first reading was a true
  measurement of an untrue mutation**, which is the exact shape build 4's flag
  names, and it was caught only by asking which arm the replacement had reached.

---

## 12. The symmetric difference of every predicate this build changed, in BOTH directions (2026-09-16)

Per `weather-at-malformed-parity/decisions.md` §12 and its Convention Flag: three
of that build's findings and two of build 4's were each the second half of a
derivation done in one direction only.

| Predicate replaced / added | NEWLY DROPS (was kept) | NEWLY KEEPS (was dropped or mangled) | Argued where |
|---|---|---|---|
| `_epoch_min` / `epochMin`'s `0.0` sentinel → `place_epoch_min` / `placeEpochMin` returning `None` | nothing on its own — the value changes, the callers decide | nothing on its own | §1, §2 |
| `compute_tide_reading` / `computeTideReading`'s hilo series → placement-filtered | the 21 unreadable shapes, as high/low events and as clock labels | **nothing** | §1 |
| the nearest-point pool → placement-filtered, ranked against a placed `start` | every unplaceable candidate (they tied at distance-to-1970 and the EARLIEST was returned); and, where `start` itself is unplaceable, the whole branch now answers `unavailable` | nothing | §1 |
| `interp_level` / `interpLevel`'s `prev["t"] == nxt["t"]` (string) → equality on the placed epoch | nothing | **two distinct strings naming one instant now return `prev["v"]` instead of raising `ZeroDivisionError` / returning `-Infinity`** — a WIDENING of the success path on the backend, and the only non-empty cell here | §3 |
| `_clock` / `clockTime`'s unanchored `re.search` with `\d` → format from the placed instant | `1:61pm`, `10:09am` from `2026/05/01 10:09`, `10:09am` from a leading-newline string, and (Python only) a clock off Arabic-Indic digits | nothing — the TS twin already returned those strings unchanged | §5 |
| `str(t)` / `String(t)` in the three parsers → require `isinstance(t, str)` / `typeof t === 'string'` | the `null`, `true`, `[]`, `{}`, numeric and key-absent entries, on both runtimes | nothing | §6 |
| Planner `t > 0` → `is not None` / `!== null`, over the shared predicate | **on the TS side, the three roll-into-span shapes** (`2026-04-36 12:00`, `2026-05-05 25:00`, `2026-05-06 12:90`) and every other impossible calendar `Date.UTC` used to roll | `1970-01-01 00:00` and every pre-1970 instant, **on both runtimes** — observable on the continuous arm, provably unobservable on the turning-point arm | §7 |
| `gmt_epoch` / `gmtEpoch`'s own regex → the shared `place_instant` | on the TS side, the rollover family (as above) | nothing | §8 |

**The rows worth reading twice are the ones whose second column is not empty**,
because that is the direction this bundle has been wrong in five times. There are
two. The divisor row widens the SUCCESS path on the backend — a body that used to
answer `unavailable` now answers a finite reading — and it is argued at §3 and
asserted as its own fixture verdict (`two-spellings-of-one-instant`,
`verdict: "ok"`). The Planner row keeps two instant families it used to drop, and
its own second column is split by call site, which is §7's measured asymmetry.

**The nearest-point row's first column carries a refusal this build newly
makes**, and it is stated as such rather than filed under "drops": where the
window's own `start` cannot be placed, the branch now answers `unavailable`
instead of presenting the earliest pooled point as the reading for now. That path
is reachable — `/tide/{checklist_id}` derives `start` from eBird's unvalidated
`obs_dt` — and `unavailable` is the honest state both routes already have.

---

## 13. What this build did NOT touch, and why (2026-09-16)

- **A well-formed timestamp outside the requested window.** Not a defect,
  measured: `_in_window` is a string comparison, so the point is excluded from
  the window samples, and where it legitimately brackets the window the
  interpolation against it is the honest answer the data supports. `far-future`
  and `far-past` are fixture rows asserting it stays placeable.

- **`re.match` → `re.fullmatch`.** Would BREAK parity by design. The prefix match
  is the contract on both sides and both guard headers say so.

- **Re-reading the string in the station's real zone.** A separate, deliberately
  deferred decision with its own evidence, reversal condition and exact change in
  `tide-timezone-parse/decisions.md`. The docstring stating that contract moved
  with the predicate into `tide_instant.py` rather than being dropped.

- **The `T`-separator sort-order difference.** Measured, deliberately not fixed,
  §10.

- **`ROADMAP.md`.** Deferrals are handed to the Chronicler in the PR description.

- **The version bump.** Build 5 of 5 in a bundled Spool release taking one
  four-file bump at the flush, after this build. `frontend/package.json`,
  `src-tauri/tauri.conf.json`, `CHANGELOG.md` and `website/index.html` are
  untouched here; the changelog line is in the PR description under
  `### Changelog line`. A deliberate deferral of CLAUDE.md's "always bump" rule
  for a bundled release, not a skip.

---

## 14. Rule gate and published prose (2026-09-16)

`.claude/rules/weather-tide.md` gated `tide.ts`, `tideFormatter*`,
`tideService.ts`, `routers/tide.py` and `services/tide.py` but **not
`frontend/src/lib/tidePlan.ts`** — the twin of `backend/services/plan_tide.py`,
whose document is persisted to `replay.json` and re-rendered offline. Added in
this change, with `tideInstant*.ts` alongside it. The omission is the same
path-gating shape CLAUDE.md records as having shipped a stale version pill for
five commits.

**One asymmetry is left as it is and named rather than widened:** that file's
backend entries are listed individually, so the three Python twins
(`plan_tide.py`, `tz_clock.py`, `tide_instant.py`) are covered by
`.claude/rules/security.md`'s `backend/services/**` glob but not by
`weather-tide.md`. Pre-existing, and widening a rule's frontmatter beyond the
files a bug-fix touches is a decision for its own build.

**Published prose swept at paragraph scope, starting at the source**
(`docs/HELP.md`, `README.md`, `website/`, `PRIVACY_POLICY.md`,
`ACCESSIBILITY.md`): nothing stops being true. The only prose describing this
surface is `docs/HELP.md`'s Tides section, which says the box shows "the
surrounding high and low tides with their local times" — already a description of
what is shown when a bracket exists, and the box has always omitted a line it has
no bracket for. No route signature, no new outbound host and no user-facing copy
changed. The stale claims this build did correct are both in SOURCE: `_clock`'s
open-`\d` note in `services/tide.py` (§5) and `tz_clock.py`'s process-zone
justification (§8).

---

## Convention Flags

- **A CONTAINMENT `try` THAT CATCHES A LANGUAGE-SPECIFIC THROW IS A ONE-RUNTIME
  FIX WEARING A TWINNED FIX'S CLOTHES, AND THE TWIN'S SILENCE IS INDISTINGUISHABLE
  FROM THE TWIN BEING FINE.** `routers/tide.py` documented its `try` as closing
  the `ZeroDivisionError` half of a security finding; TypeScript does not throw on
  division by zero, so the identically-placed `catch` caught nothing and the same
  body answered `unavailable` on one transport and `-Infinity ft` on the other. The
  comment was written on the side that HAD the evidence, which is why nothing
  looked wrong. **Where a repair is a `try` or a `catch`, ask what the other
  language DOES with the same input — never whether it has a `try` in the same
  place** — and write the answer at both sites, including the one where the answer
  is "nothing to catch". Same family as the seam's-failure-return flag from build
  4: the untested half of a pair is where this bundle keeps losing.

- **A GUARD PLACED UPSTREAM MAKES ITS DOWNSTREAM REPAIR UNTESTABLE, AND A
  MUTATION IS THE ONLY THING THAT SAYS SO.** Deleting `_clock`'s unanchored `\d`
  scan — the fence build 4 handed over BY NAME — left every row in both new suites
  green, because the placement filter upstream means the scan is never reached with
  a string it could mis-read. The repair was correct, the evidence for it was
  zero, and it would have shipped as a closed fence with nothing pinning it
  closed. **When a build fixes two things where one makes the other unreachable,
  mutate the downstream one on its own and expect GREEN**; then give it a direct
  test against its own contract rather than against the pipeline. The direct test
  must also be the STRONGER claim — "returns the string verbatim" catches the
  Arabic-Indic divergence that "is not clock-shaped" cannot, because the reverted
  half renders a half-ASCII clock.

- **A MUTATION WHOSE LABEL NAMES A PREDICATE MUST REACH EVERY CALL SITE OF THAT
  PREDICATE, AND "THE PLANNER PREDICATE" WAS TWO.** M6 read GREEN as a faithful
  measurement of a mutation that had reverted one of two loops. Split by arm, one
  is guarded and the other is provably equivalent — two true statements the single
  mutation had merged into one false-looking one. Build 4's flag says a
  string-replace can be weaker than its own label; the sharpening is that **a
  replace matching its pattern exactly once can still be weaker than its label,
  when the label names a concept and the concept has more than one site.** Count
  the sites from the code before writing the mutation, and split one mutation per
  arm, per the isolate-one-arm rule.

- **A PREDICATE'S "UNOBSERVABLE" ARM IS ARGUED STRUCTURALLY OR NOT AT ALL.** The
  Planner's turning-point arm cannot distinguish `t > 0` from `is not None`
  because `hiloStartTs` is derived from `now` and is therefore ~1.78e9, so the
  span bound implies the positivity test. That is a property of the code, not of
  the roster, and it carries a reversal condition (a span whose `hiloStartTs` is
  at or below zero). **A green mutation explained by "no row separates them" is a
  gap; a green mutation explained by "no INPUT can separate them, because X" is a
  finding** — and only the second may be left without a new test. Write which one
  it is, with the X.

- **A GROUND-TRUTH ASSERTION CAN BE DERIVED STRUCTURALLY INSTEAD OF TYPED, AND
  THAT IS THE ANSWER TO THE AGREEING-WRONG-NUMBER SHAPE.** No parity fixture could
  see this defect, by construction, and a hand-typed expected column would have
  encoded the model that wrote the bug. The shipped form is neither: **the block
  rendered from a series carrying an unplaceable `t` must EQUAL the block the same
  builder renders from that series with the entry REMOVED** — each runtime derives
  its own expectation, from its own builder, and cross-transport agreement is what
  is left over when both are right. It needs no oracle, cannot go stale, and
  generated 39 discriminating rows per runtime from one roster. Reach for a
  structural equality over a typed expectation whenever the claim is "this input
  should behave like that input".

- **A FIXTURE ROSTER FINDS DEFECTS NOBODY WROTE A ROW FOR, WHICH IS THE ARGUMENT
  FOR DRIVING THE FULL CROSS-PRODUCT.** The fifth zero-divisor instance was not in
  the brief's four-row table: it appeared as `next-low / iso-t-separator` because
  the roster crosses every shape with every scenario. The same cross-product is
  what surfaced §10's `T`-separator sort-order difference, which is a different
  defect on a different axis and pre-dates this build. Cross the roster with the
  scenarios even where most cells are expected to be uninteresting; the cells
  nobody predicted are the return on it.

---

## 13. TWO RESIDUALS THE SECURITY REVIEW MEASURED, NEITHER ACTED ON, BOTH RECORDED (2026-09-16, QA/security round)

Per CLAUDE.md: a decision not to act on a measured difference is written down as a
decision, with the evidence, what would reverse it, and the exact fix. A silent
non-action and an oversight leave the same evidence, so the sentence is the only
thing separating them.

**13a. The placement filter covers the HIGH/LOW SERIES ONLY, and this document
said otherwise for the wrong reason.** `obs_in` / `pred_in` are still selected by
pure string comparison, so an unplaceable `t` that sorts *inside* the window still
contributes its level. Measured on both runtimes, identical: `2.4 - 9.9 ft` where
the truth is `2.4 - 2.8 ft`, from one observed point at `t = "2026-05-01 11:99"`.

Pre-existing and unmoved by this build -- before and after are identical against
`HEAD` -- and no cross-runtime divergence, which is why it is not a regression.
**The correction is to the REASON, not the verdict.** §0 above and `bug-brief.md`
§4 both state the exclusion as a property of `_in_window`. It is not: it is a
property of the ROSTER. None of the 21 unplaceable shapes sorts inside the
`12:00-13:00` window, so the `observed-point` scenario enters that branch zero
times. `_in_window` would happily admit `11:99` if a shape produced it. This is
`.claude/rules/security.md`'s v0.5.85 rule arriving through a scenario roster
instead of a regex corpus -- a null result that is a fact about the corpus, not
about the code.

**Reversal condition:** the first shape added to the roster whose unplaceable `t`
sorts inside the window, or any change to how `obs_in`/`pred_in` are selected.
**The fix:** route `obs_in`/`pred_in` through `place_instant` / `placeInstant` as
the high/low series already are, which is the same one-line shape applied one
selection site over.

**13b. Dropping a BRACKETING high/low widens the interpolation silently.**
Measured: `3.70 - 3.72 ft` where the truth is `0.97 - 1.44 ft`, identical on both
runtimes, into permanent public checklist text. This is the build's **designed and
asserted contract**, not a regression -- `HEAD` renders `3.8 - 3.8 ft` with
`at 11:99am` on the same input, which is worse.

What is worth recording is the **visibility direction**, because it cuts against
the repair. The shipped defect carried two tells this build's own brief names --
the dangling clock (`at 11:99am`) and the range-of-a-value-with-itself
(`3.8 - 3.8 ft`) -- and the repaired path emits **neither**. So the answer is now
more wrong-looking-ordinary than before in this one case, while being far less
wrong in every other. Accepted on that trade, deliberately.

**Reversal condition:** a user report of a plausible-but-wrong range, or any
decision to surface partial-series confidence in the copy block. **The fix:** the
same shape §10 uses for the `T`-separator residual -- state the reduced basis
where the block is built, rather than silently interpolating across a wider gap.

