# Decisions — Tide Timezone Parse

## Parse `lst_ldt` on a fixed UTC axis, NOT in the station's real zone (2026-09-15)

**Decision:** `_epoch_min` reads NOAA's `lst_ldt` wall-clock strings with an
explicit `tzinfo=timezone.utc`, matching the shipped TS twin `epochMin`. It is
deliberately **not** re-parsed in the station's own zone via `get_timezone(...)`.
The Evaluator scoped this out; the Engineer ratifies that scoping, with the
residual measured and written down here rather than left silent.

**What the fix does buy.** The shipped helper used a naive
`datetime(...).timestamp()`, which resolves in whatever zone the **server
process** runs in. Measured at HEAD, the same string read differently on two
machines, and the divergence reached a user-facing figure:

| | `03:00` − `01:00` on 2026-11-01 | rendered water level |
|---|---|---|
| `TZ=UTC` | 120 min (correct) | `1.5 – 4.5 ft` |
| `TZ=America/Los_Angeles` | 180 min (wrong) | `1.0 – 5.0 ft` |

The explicit-UTC form makes that reading identical in every process zone and
restores parity with the desktop transport, which was already correct.

**What it does NOT buy — the measured residual.** The string is the *station's*
local clock and is read as though it were UTC, so a wall-clock `01:00 → 03:00`
span **at a station crossing its own DST transition** still measures 120
minutes where 180 genuinely elapsed. The interpolation fraction across that
span is therefore off by up to an hour's worth of curve, twice a year, and only
on the two fallback branches: `interp_level` (subordinate stations, which serve
only hi/lo) and the nearest-point `min`. Reference stations with a continuous
series never reach it.

**Why it is deferred rather than fixed here.**
1. The shipped TS twin (`frontend/src/lib/tide.ts`, and the desktop
   `frontend/src/lib/tauri/tideService.ts`) reads the same strings the same
   fixed-axis way. Changing only the backend would *re-open* the transport
   divergence this fix exists to close — the web/Pi and desktop apps would
   disagree again, in the opposite direction.
2. It reopens planner decision **D4**. The planner already settled on the
   explicit-epoch approach for `time_zone=gmt` bodies (`services/tz_clock.py`'s
   `gmt_epoch`); a station-zone reading for `lst_ldt` is a second, different
   time model in the same subsystem.
3. The station's zone is not simply the request location's zone. `routers/tide.py`
   computes `tz = get_timezone(lat, lng)` for the **request** location, but a
   far-station override can put the station in a different zone entirely, so the
   correct fix needs `get_timezone(station_lat, station_lng)` — a change with its
   own blast radius, not a one-line substitution.

**What would reverse this decision.** A user reporting a wrong water level or
tide trend at a subordinate station on a DST transition date; or any change that
moves the TS twin to a station-zone reading, at which point the backend must
follow in the same change to keep the transports in step.

**The exact fix, with its location, if it is ever taken.**
- `backend/services/tide.py`: give `_epoch_min` a `tz: ZoneInfo` parameter and
  build the datetime with `tzinfo=tz` (accepting `fold=0` semantics for the
  repeated hour). Thread it through `interp_level` and the nearest-point `min`
  inside `compute_tide_reading`.
- `backend/routers/tide.py`: resolve the zone from the **station's** coordinates,
  not the request's, at both call sites.
- `frontend/src/lib/tide.ts` and `frontend/src/lib/tauri/tideService.ts`: the
  same change to `epochMin` / `interpLevel` / `computeTideReading`, in the same
  change, or the transports diverge.
- `frontend/src/lib/tideEpoch.fixture.json` would need station-zone rows, and
  the two parity halves regenerated.

**Recorded because a silent non-action and an oversight leave identical
evidence** (CLAUDE.md standing rule). Promote to `DECISIONS.md` and `ROADMAP.md`
at closeout; the existing ROADMAP entry at line 47 asks for exactly the
convergence this build delivers and should be updated to name this residual as
what remains.

## Pin the two twin divergences rather than omit them (2026-09-15)

**Decision:** The shared fixture carries a `divergent` list — three strings the
two transports genuinely read differently — asserted on **both** sides, instead
of quietly holding only strings that agree.

**Rationale:** Measured, not assumed. `Date.UTC` rolls an impossible calendar
value over (`2026-13-40 25:61` → a real instant in 2027) and maps any year below
`0100` into the 1900s via JavaScript's legacy two-digit-year rule, where the
Python twin refuses the value and returns `0.0`. A fixture of conforming strings
alone cannot see one twin raising where the other returns a value
(`.claude/rules/security.md`), so a row that **separates** the twins is what
makes their agreement on the other sixteen rows a measurement rather than an
assumption. Omitting them would make the parity claim read as total when it is
not. None of the three is a shape NOAA can emit.

**Reversal condition:** if either transport changes its handling of impossible
calendar values, a pinned row turns red and sends the reader here.

## No version bump in this build (2026-09-15)

**Decision:** No change to `frontend/package.json`, `src-tauri/tauri.conf.json`,
`CHANGELOG.md` or `website/index.html`.

**Rationale:** This is one of five builds in a bundled Spool release that ships
as a single version. The bundle takes one four-file bump at the release with an
entry per build; bumping here would put five version bumps in one release. The
changelog line this build is owed is in the PR description. This is a deliberate
deferral of CLAUDE.md's "always bump" rule for a bundled release, not a skip.
