## Tide At Bad Request

### What this does

`GET /tide/at` had no validation of the moment it was asked about, where its
sibling `/weather/at` has had one since 0.5.34. Over the 32 `dt` shapes the
Evaluator measured, the backend answered a **plain-text HTTP 500 on eight of
them**, a 502 blaming NOAA for a value that never reached NOAA on one more, and
200 on the rest — several carrying a confident water level for a moment nobody
asked about. The desktop twin never crashed and was worse for it: `Date` **rolls**
an impossible calendar value into a real instant where Python raises, so
`?dt=2024-05-01 99:00` rendered `Water level: 0.4 – 5.6 ft · Rising` for a
four-day window, in the block a user pastes into a public eBird checklist.

Both runtimes now refuse an unreadable `dt` identically, before any NOAA
request: **HTTP 400** / `{ status: 400 }` carrying `/weather/at`'s existing
sentence, single-sourced from one constant per runtime so the two cannot drift.

Three more things move with it, because they are one change:

- **The desktop weather half gets the same guard.** It had none, and its parse
  sat outside the try and threw status-less, which `isOfflineError` reads as
  `true` — so the panel said *you're offline* on an online device whose request
  had never left the machine. Leaving it would put *bad date* and *you're
  offline* side by side on one screen from the same value.
- **Current tide starts working on desktop and iOS.** `transport.ts` passed
  `params?.dt ?? ''` where the weather branch passes `undefined`, and `getTideAt`
  had no "now" fallback, so every Current lookup sent NOAA a single space as
  `begin_date` and resolved `{ status: "unavailable" }`. Broken since 0.5.34, in
  no decision and no ROADMAP line, with `WeatherForecastPanel.tsx:325`'s own
  comment asserting the opposite. That comment is now true.
- **`shift_local`'s `\d` becomes explicit ASCII `[0-9]`** (F2 of
  `tide-timezone-parse`, the half this build touches), which converges the two
  transports on `/tide/{checklist_id}`: Python silently succeeded at shifting a
  clock written in Arabic-Indic digits where the TS twin returned it unchanged,
  so the two asked NOAA for different windows for the same checklist.

**Measured, provider seams doubled, over the 32-shape roster:**

| | before | after |
|---|---|---|
| `/tide/at` 500s | 8 | **0** |
| `/tide/at` mis-worded 502s | 1 | **0** |
| `/tide/at` NOAA calls | 23 | **4** |
| desktop `getTideAt` NOAA requests | 96 | **12** |
| desktop `getWeatherAt` throws read as OFFLINE | 16 | **0** |
| rows where the two runtimes disagree | 12 tide (9 verdict + 3 window) / 26 weather | **0 / 0** |
| `/weather/at` rows whose status moved | — | **0** |

### How to test

1. `cd backend && .venv/bin/python -m pytest tests/ -q` — 1,356 pass.
2. `cd frontend && npm run build` — green; `npx eslint .` — clean.
3. `cd backend && .venv/bin/ruff check .` — clean.
4. Manually: start the app, open the **Weather** tab, scroll to Current/Plan and
   press **Current**. The tide box should fill with a real reading — on desktop
   and iOS it has been showing "unavailable" since 0.5.34. Then in **Plan**, pick
   a place and submit with a valid date; both halves fill. The step-by-step
   version is in `pipeline/tide-at-bad-request/how-to-see.md`.

### Security retry 1 — F1 (Medium) closed

**The Auditor found that this build's own "now" fallback reintroduced the
falsehood the build exists to remove.** `getTideAt`'s blank-`dt` branch handed
the native timezone seam's result straight to `nowInZone`, and
`tzf_rs::DefaultFinder::get_tz_name` returns the **empty string** for a point no
polygon covers. `Intl.DateTimeFormat({ timeZone: '' })` throws a status-less
`RangeError`, `isOfflineError` reads that as `true`, and the panel said *you're
offline* on an online device — four lines from the refusal that carries
`status: 400` precisely so it does not. **The two halves of one `if` had
different error contracts.** The backend twin could not do it: it has always read
`_tf.timezone_at(...) or "UTC"`.

Reproduced independently before fixing (both services, `''` and a non-empty
unknown zone: rejected, `status: undefined`, `isOfflineError: true`, zero
requests). The roster could not see it — all 32 rows vary `dt` and supply a
valid zone, which is the axis the roster is about.

**Fixed at both seams, and the two guards close different inputs — measured, not
assumed:**

| Guard | Closes | Why the other cannot |
|---|---|---|
| `zone_or_fallback` (`src-tauri/src/lib.rs`) | the **empty** name | the seam's contract, matching the Python twin's `or "UTC"`; fixes every JS caller at once |
| `zoneOrUtc` (`lib/wallClock.ts`) | a **non-empty name this runtime's ICU does not know** | the seam default tests `is_empty()`, so such a name passes straight through it (`Ocean/Nowhere` measured identical to `''`) |

Three things ride with it. **The JS side now resolves at ONE chokepoint**
(`lib/tauri/locationZone.ts`), because the zone had *four* dereference sites
here — `nowInZone`, `convergeLocal`, `formatLocalTime` (which builds the pasted
copy block) and `tzClock.ts`'s `fmtFor` — against the backend's one; that
asymmetry is the finding, and resolving once is the twin's own structure. All five
`invoke('get_timezone')` call sites go through it and `convergeLocal`'s
interim guard was **removed again**, so no guard is left whose necessity is
unmeasured. **The Python half moved too** — `get_timezone` now catches an
unknown zone name, which previously raised `ZoneInfoNotFoundError` outside every
route's try as a plain-text 500; closing only the desktop side would have opened
a fresh divergence of exactly the class this build exists to close. And a
`zoneNames` fixture block drives both runtimes with two fallback rows, two
controls and a non-vacuity assertion on each side, plus four Rust unit tests on
the extracted pure mapping — one of which pins the stated *limit* that a
non-empty unknown name passes the seam untouched.

Red-first on the repair: **2 backend rows and 7 frontend rows**, restored by
`shasum -a 256 -c` on all five touched files and by an independent behavioural
re-run. `cargo test --lib` 65 passed; `cargo check` clean.

**F4 (Informational) — recorded.** The linearity argument for the new scan, and
the argument **against** adding a length refusal, now live in both module
docstrings (§14): structural bound, measurements flat to 10 MB on both runtimes,
the h11 16 KB request-line enforcement point, and the reason a length check would
buy nothing here — the string is materialized before the predicate runs, the
opposite of `uploadGuard`'s retention bound. Both docstrings say *do not add
one*.

**F3 (Informational) — corrected.** §4's `_LST_RE:159` citation was wrong (the
sites are `:83` and `:113`); the sweep itself was right and the review verified
it independently. Corrected in place with a note, rather than silently amended.

**F2 is not ours** — 17 files cited in `.claude/rules/security.md`'s rule bodies
match no glob. Pre-existing; handed to The Chronicler below. No new text in this
build adds an eighteenth.

### QA retry 2 — the seam's other failure mode, and two record corrections

**QA passed the F1 repair and found the blind spot had MOVED rather than
closed.** The `zoneNames` fixture covers what the native timezone command
*returns*; every one of its rows mocks it as resolving, and nothing in this repo
drove a *rejecting* `invoke`. Measured: a rejection gives both services a
status-less throw with `isOfflineError` true — the F1 signature exactly, on the
axis the new fixture holds constant.

**Closed, and the two failure modes get different answers (§15).** An unusable
*return* means the lookup succeeded and said this point has no usable zone, so
UTC is honest and matches the backend. A *rejection* means the lookup never
happened and the point probably does have a zone, so UTC would invent a moment
up to ten hours off — the one thing this build exists to prevent. `locationZone`
therefore refuses, with `{ status: 500 }` so it can never read as offline.

**That is a deliberate departure from QA's suggested one-line UTC fallback, and
the argument is parity, measured.** The reachable trigger is a NaN or
out-of-range coordinate (open deferral 4), and `GET /tide/at?lat=nan` answers
**500** on the backend today. A UTC fallback here would make desktop *succeed
where web/Pi fails* — a fresh divergence, toward a confidently wrong answer. A
status-bearing refusal makes both runtimes show the one generic sentence.

**Also closed:** `zoneOrUtc(undefined)` returned `undefined`, and
`new Intl.DateTimeFormat({ timeZone: undefined })` is legal and means "use the
runtime default" — so `nowInZone(undefined)` silently formatted in the **device's**
zone (`04:15` LA where UTC read `11:15`). Unreachable while the Rust command
returns `String`; closed anyway, because the cost is one line and the failure is
silent.

**Record corrections:**

- **F-A — `decisions.md` §13 said 3 backend red-first rows; it is 2.** Fixed, and
  then generalized as asked: this is the third stale count in this build, so §12
  now **re-derives every mutation figure against the final shipped suites** (13
  mutations, both runtimes) and §0 drops its combined red-first number in favour
  of §12's per-guard figures — a form that does not decay when the next row
  lands.
- **F-B — "measured-necessary for different inputs" overstated, and pointed at
  the wrong guard.** Re-derived independently as mutations M11 and M13:
  neutering `zoneOrUtc` turns **14** frontend rows red; reverting the Rust seam
  default turns **0** on either runtime. The Rust guard is *subsumed* — kept on
  twin-parity grounds, which is what its own doc comment leads with — and the
  reason this matters more than wording is that **the frontend suite mocks
  `invoke`, so it cannot exercise that guard at all.** Corrected in
  `decisions.md` §13 and in `src-tauri/src/lib.rs`.
- **A third correction QA found in passing:** the chokepoint closes **four**
  dereference sites and **five** service paths, not three — `tzClock.ts`'s
  `fmtFor`, reached via `localClock` from both plan paths, was uncounted. The
  correction understates rather than overstates the fix: before the chokepoint
  those two plan paths fed the raw zone string into `Intl` directly, which is the
  identical F1 shape.

**And my own harness failed once, the way this repo already records.** The first
re-derivation of §12 restored files from a snapshot taken two rounds earlier,
silently reinstating the pre-chokepoint services and inflating four rows by ten
each — no error, just wrong and plausible numbers in the table being used to fix
a finding about wrong numbers. Caught because a second snapshot at the intended
state disagreed on three files (v0.5.88's rule). Re-snapshotted and re-run; the
final restore verifies all twelve files byte-identical against the intended
state.

Gates: backend 1,356 passed, ruff clean; `cargo check` clean, `cargo test --lib`
65 passed; frontend build green, eslint clean, 16 scoped suites 1,187 passed.

### Notes for reviewer

**The finding worth your time is in `decisions.md` §7.** "No roster row moved on
`/weather/at`" was true of the 32 shapes and **false of the predicate**. A
differential sweep of 80,504 generated strings against the exact `strptime` pair
this build replaces found **67 shapes it accepted and the new predicate does
not**, and zero in the other direction. They fall into four categories, the
largest two being *non-space whitespace as the date/time separator* (a literal
space in a `strptime` format matches any whitespace run, NBSP included) and *a
non-ASCII decimal digit in the year, hour or minute* (`%Y` is `\d\d\d\d`, which
is Unicode in Python, while `%m`/`%d` are literal ASCII alternations).

The roster could not see any of it: its Arabic-Indic row puts the digits in the
**month**, where `strptime` is strict. Put the same digits in the **year** and
the reference guard accepted them — a v0.5.54 violation shipped since 0.5.34, in
the very guard the brief calls the reference. All 67 resolved to the *correct*
moment on the backend and **all 67 threw status-less on the desktop twin and
were reported as "you're offline"**, so they were divergent rows all along. The
build converges them on refusal; the three grounds are in §7, and the direction
has a reversal condition.

**Other things to look at:**

- **The margin is a per-caller argument (§2).** `/tide/at` passes 25 hours (the
  widest shift it makes); `/weather/at` passes 0. Folding 25 into the predicate
  would have turned `?dt=9999-12-31 23:59` on the weather route from a truthful
  `out-of-range` into a bad-request error, and the Predict date input has a `min`
  and no `max`, so that is reachable. **Cross-RUNTIME parity is total;
  cross-ROUTE parity is deliberately not**, on two of the 32 shapes.
- **§8 is a coercion that moves no verdict.** `Date.UTC` maps years 0–99 onto
  1900–1999, so `dt=0001-01-01 00:00` resolved to **1901** on desktop and year 1
  on the backend; both answered `out-of-range`, so the roster shows the row
  agreeing before and after. An agreeing wrong answer is invisible to parity
  checking by construction, which is why it gets its own argument.
- **M8 in §12 is a finding about the tests.** Reverting the one `transport.ts`
  line left all 116 frontend rows green (the denominator at the round it was
  found in; it is 179 now), because the suite drives `getTideAt`
  directly. Two rows were added to `transport.test.ts`; M8 now goes red on
  exactly those two.
- **Red-first is recorded PER GUARD** in `decisions.md` §12's mutation table —
  13 mutations, both runtimes, re-derived against the final shipped suites —
  rather than as one combined count. That is a deliberate change of form: this
  section carried a combined figure through three revisions and it went stale
  each time, not because anything was measured wrong but because later rounds
  added rows. The headline pair from that table: reverting the backend `dt`
  guard turns **36 of 95** backend rows red with the frontend untouched;
  reverting the desktop `dt` guards turns **115 of 179** frontend rows red with
  the backend untouched. Restores are verified against a snapshot taken at the
  INTENDED state, never the one used to perform the restore, and behaviourally.
- **Two rule gates were extended** (§11): `security.md` and `weather-tide.md`
  both gated the Python half of these twins and neither gated the TypeScript
  half. Each carries a comment under its frontmatter saying why.

**Deliberately out of scope**, per the brief's fence: the `0.0` sentinel in
`_epoch_min`/`epochMin` and `interp_level`'s divisor — a malformed timestamp in
NOAA's *response*. `test_tide_epoch_parity.py` and `tideEpoch.parity.test.ts`
are green **unchanged**, including their three pinned divergences, which is the
check that this build has not crossed that line. `_clock:144`'s `\d` is left with
it for the same reason and is named in §4.

**Deferrals handed to The Chronicler for `ROADMAP.md`** (not edited here):

1. **`_clock` at `backend/services/tide.py:144` still uses `\d`** — the
   remaining open half of F2 of `tide-timezone-parse`. Its input is NOAA's
   response `t`, which the next queued build owns. The fix is two characters;
   the reason it is not taken here is the scope fence, not difficulty.
2. **The Current tide path was broken on desktop and iOS from 0.5.34 to this
   build**, silently, on the majority platform, with a source comment asserting
   the opposite and no test anywhere driving `transport.get('/tide/at')` without
   a `dt`. Worth a line in its own right: nothing in the repo recorded it.
3. **`/tide/at` refuses `9999-12-31 23:59` with a sentence that is a shade
   imprecise for that one band** (§2). Resolve it if the panel ever gains a
   bad-date error kind.
4. **`at-route-try-containment` decision 11 (unbounded and NaN coordinates on
   both `/at` handlers) is still open.** This build narrows it — the refusal now
   precedes `get_timezone`, which is where it raises — without closing it. The
   one-line fix per handler is unchanged.
5. **ROADMAP line 47 describes this defect as open and carries the reversal
   condition "take it in the same build that decides whether the TS date helpers
   refuse".** That condition is met and the item is closed; the line needs
   rewriting rather than deleting, because its measured table is still the best
   record of what the defect was.
6. **Seventeen files cited in `.claude/rules/security.md`'s own rule bodies match
   no `paths` glob** (security review F2, pre-existing). Two are worth naming:
   `src-tauri/src/window_geometry.rs`, which is the *second instance* in the
   v1.0.13 native-read rule — the rule's own text records that it "shipped to
   review unbounded and symlink-following" because an earlier wording was read as
   not covering it — and `frontend/src/lib/storage.ts`, named in the v1.0.20 rule
   as the place a "no network call" claim goes wrong. This build's two `paths`
   edits are correctly scoped to what they argue; closing all 17 is outside a fix
   lane's fence. The Auditor's suggested durable form is a guard test that
   extracts every path-shaped citation from a rule body and fails when one
   matches no glob in that file's frontmatter — the `cacheInventory.test.ts`
   shape, applied to the rule files.
7. **A `try/catch` closes rejection and structurally cannot close
   NON-SETTLEMENT, so a seam that never answers leaves `getTideAt` pending**
   (QA round 3, measured: still pending past 800 ms, which would park the panel
   on its spinner for the session). CLAUDE.md's v1.0.16 *Promise boundaries*
   entry states the general form — a timeout is owed by whoever introduces a
   dependency that can hang, and `locationZone` has none. Reachability is low:
   `get_timezone` is a synchronous Rust command returning `String`, so it
   answers or the process is already gone. Deliberately not fixed here — it is
   not a divergence of this build's class (that class is answering a different
   moment or saying something false; a hang answers nothing) and a timeout is a
   behaviour decision of its own.
8. **No test in this repo drives a rejecting `invoke`, on any command other than
   `get_timezone`** (QA's Known Limitations). This build added the first such
   rows, for one seam; every other native command in the app is still driven
   only in its resolving shape. The `seamFailures` block is the shape to copy.
9. **The Rust zone guard has no integration coverage** — four unit tests on the
   pure mapping, and nothing that drives the real command through the JS path,
   because the frontend suite mocks `invoke`. Inherent to the seam being mocked;
   recorded so it is not mistaken for broader coverage.
10. **`tzf-rs` and `timezonefinder` can disagree with their runtimes' tz
    databases, and both sides now fall back to UTC rather than failing** (§13).
   The fallback is silent by design, so a genuine database drift would show up
   as wrong-by-hours clock text rather than as an error. Worth a line: if it ever
   fires for a LAND point in normal use, the answer is to update the databases,
   not to widen the guard.

### Changelog line

- Fixed: the Current tide reading on the Mac, iPhone and iPad apps, which had
  been showing as unavailable rather than fetching the tide for where you are.
  A date and time that cannot be read is now refused politely by both the tide
  and weather lookups instead of reporting an error, showing a reading for a
  different moment, or saying you are offline while you are online.
