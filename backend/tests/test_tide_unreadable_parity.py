"""SHARED-FIXTURE GROUND-TRUTH TEST -- the web/Pi half of the tide builders'
unreadable-timestamp contract. The TS half is
frontend/src/lib/tideUnreadableParity.test.ts and drives the SAME
frontend/src/lib/tideUnreadable.fixture.json.

WHY THIS FILE IS NOT A PARITY TEST, AND WHY THAT IS THE WHOLE POINT.
Every other cross-transport fixture in this repo asserts that the two runtimes
AGREE. That is exactly the check this defect was invisible to: measured at HEAD,
20 of the 23 unreadable `t` shapes below produced a water level that both
runtimes rendered BYTE FOR BYTE IDENTICALLY and that was wrong in both, because
`_epoch_min` / `epochMin` anchored an unreadable timestamp at the 1970 epoch and
1970 is 56 years from the window -- so the interpolation fraction collapsed to
~0.99999 and the reading degenerated into "return the other bracket". A window
whose true answer is `2.4 - 2.8 ft` rendered `1.5 - 1.5 ft`: plausible, in
range, correctly rounded, and wrong by however far the window sat from that
bracket. `weather-at-malformed-parity/decisions.md` section 4 named the shape:
**an agreeing wrong number is invisible to every cross-transport parity check by
construction.**

So every assertion here is against GROUND TRUTH, derived structurally on this
runtime alone: **a `t` that cannot be placed on the epoch axis means that point
is MISSING, so the rendered block must equal the block this same builder
produces from the same series with that entry REMOVED.** The fixture carries the
roster, the scenarios and the agreed placement verdict; it does not carry an
expected string, because a generated expected column would have recorded the
wrong answer twice and a hand-typed one would encode the author's model of the
data, which is the model that wrote the bug (v1.0.21).

The cross-transport claim is then a consequence rather than the assertion: both
halves drive one roster against one structural property, so agreement is what is
left over when both are right.

DELETION COVERAGE (v1.0.20). Single-sourcing a predicate across two languages
stops the copies drifting and does nothing to stop one being DROPPED, so this
side owns a test that fails when THIS side's placement filter is removed:
`test_an_unplaceable_point_is_dropped` is that test, and removing the
`place_instant` filter in `compute_tide_reading` turns its rows red here while
the frontend suite stays green.
"""

import json
import re
from pathlib import Path

import pytest

from formatters.tide import format_tide_body
from services.plan_tide import build_tide_plan, plan_tide_range
from services.tide import _clock, compute_tide_reading, parse_hilo, parse_observed, parse_predictions
from zoneinfo import ZoneInfo

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "lib" / "tideUnreadable.fixture.json"
)
F = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

STATION = F["station"]
DISTANCE_MI = F["distanceMi"]
START, END = F["window"]["start"], F["window"]["end"]
CONTROL = F["control"]
SHAPES = F["shapes"]
SCENARIOS = F["scenarios"]
UNPLACEABLE = [s for s in SHAPES if not s["placeable"]]
PLACEABLE = [s for s in SHAPES if s["placeable"]]

# A copy block reads `Previous high: 3.6 ft at 10:09am`. These are the two shapes
# a dangling clock takes: nothing after the "at" (an empty or absent `t`), and
# something that is not a clock (`at not a date`, `at 1:61pm`).
DANGLING_END = " at"
DIGITS = "0123456789"


# ── the shared shape DSL ─────────────────────────────────────────────────────
# Deliberately re-implemented on each side rather than shared: the TS half
# applying the same roster to the same bodies from its own code is what the
# cross-transport claim consists of. The CONFORMING rows are what catch a
# mis-implementation of the DSL itself.

def apply_shape(rows: list[dict], index, shape: dict) -> list[dict]:
    """The roster row applied to one entry (or every entry) of a series."""
    out = []
    for i, row in enumerate(rows):
        copy = dict(row)
        if index == "all" or i == index:
            if shape["op"] == "delete":
                copy.pop("t", None)
            else:
                copy["t"] = shape.get("t")
        out.append(copy)
    return out


def without_index(rows: list[dict], index) -> list[dict]:
    """The same series with that entry (or every entry) REMOVED: ground truth."""
    if index == "all":
        return []
    return [dict(r) for i, r in enumerate(rows) if i != index]


def bodies_for(scenario: dict, rows: list[dict]):
    """The three NOAA bodies a scenario feeds the builder, from one series."""
    no_data = {"error": {"message": "No data was found."}}
    if scenario["series"] == "hilo":
        return no_data, {"predictions": []}, {"predictions": rows}
    if scenario["series"] == "observed":
        return {"data": rows}, {"predictions": []}, {"predictions": CONTROL["hilo"]}
    # 'pool': no window samples and no curve at all, so the nearest-point
    # fall-back is the branch under test.
    return {"data": rows}, {"predictions": []}, {"predictions": []}


def reading_for(scenario: dict, rows: list[dict]):
    obs, pred, hilo = bodies_for(scenario, rows)
    return compute_tide_reading(
        START, END,
        parse_observed(obs), parse_predictions(pred), parse_hilo(hilo),
        STATION, DISTANCE_MI,
    )


def render(scenario: dict, rows: list[dict]) -> str:
    """What the route would answer, as one comparable string. A raise is
    rendered rather than swallowed: this runtime raised `ZeroDivisionError` on
    the divisor pairs where the TS twin produced `-Infinity`, and a caught raise
    that vanished into `unavailable` is precisely how that asymmetry stayed
    hidden -- the route's own `try` turned it into a status, one runtime only."""
    try:
        reading = reading_for(scenario, rows)
    except Exception as exc:  # noqa: BLE001 -- the verdict IS the exception type
        return f"(threw: {type(exc).__name__})"
    return "(unavailable)" if reading is None else format_tide_body(reading)


def series_of(scenario: dict) -> list[dict]:
    return CONTROL[scenario["series"]]


def _ids(rows, key):
    return [r[key] for r in rows]


def test_the_fixture_carries_the_shapes_that_discriminate_and_both_verdicts():
    ids = {s["id"] for s in SHAPES}
    # Each of these separates something. Without them the roster would be a list
    # of obviously-broken strings, which is the roster that cannot see a twin
    # divergence (.claude/rules/security.md).
    for needed in (
        "arabic-indic-digits",   # a non-ASCII digit row
        "trailing-newline", "leading-newline", "embedded-newline",
        "the-epoch-itself",      # the sentinel collision
        "far-past",              # a placeable NEGATIVE epoch
        "iso-t-separator",       # the `T` separator the class admits
        "null", "boolean", "empty-list", "empty-object",  # non-string `t`
    ):
        assert needed in ids, needed
    # Both verdicts represented, so a roster that degenerated to all-refusing
    # (or all-accepting) fails loudly rather than passing vacuously.
    assert UNPLACEABLE, "no unplaceable shapes"
    assert PLACEABLE, "no placeable shapes"
    assert len(ids) == len(SHAPES), "duplicate shape id"


# ── 1. an unplaceable `t` removes its point from the series ──────────────────
# THE DELETION TEST FOR THIS SIDE. Remove `compute_tide_reading`'s placement
# filter and these rows go red here while the frontend suite stays green.
@pytest.mark.parametrize("scenario", SCENARIOS, ids=_ids(SCENARIOS, "id"))
@pytest.mark.parametrize("shape", UNPLACEABLE, ids=_ids(UNPLACEABLE, "id"))
def test_an_unplaceable_point_is_dropped(scenario, shape):
    rows = series_of(scenario)
    assert render(scenario, apply_shape(rows, scenario["index"], shape)) == render(
        scenario, without_index(rows, scenario["index"])
    )


# ── 2. no copy block ever contains a dangling clock ──────────────────────────
@pytest.mark.parametrize("scenario", SCENARIOS, ids=_ids(SCENARIOS, "id"))
@pytest.mark.parametrize("shape", SHAPES, ids=_ids(SHAPES, "id"))
def test_no_dangling_clock_reaches_the_copy_block(scenario, shape):
    rows = series_of(scenario)
    body = render(scenario, apply_shape(rows, scenario["index"], shape))
    for line in body.split("\n"):
        if not line.endswith(DANGLING_END):
            continue
        pytest.fail(f"nothing after \"at\": {line!r}")
    idx = body.find(DANGLING_END + " ")
    while idx != -1:
        after = body[idx + len(DANGLING_END) + 1:]
        assert after[:1] in DIGITS, f"a non-clock after \"at\": {after[:24]!r}"
        idx = body.find(DANGLING_END + " ", idx + 1)


# ── 3. no reading carries a non-finite level ─────────────────────────────────
@pytest.mark.parametrize("scenario", SCENARIOS, ids=_ids(SCENARIOS, "id"))
@pytest.mark.parametrize("shape", SHAPES, ids=_ids(SHAPES, "id"))
def test_every_reading_is_finite(scenario, shape):
    rows = series_of(scenario)
    reading = reading_for(scenario, apply_shape(rows, scenario["index"], shape))
    if reading is None:
        return
    for name in ("level_min", "level_max"):
        v = getattr(reading, name)
        assert v == v and v not in (float("inf"), float("-inf")), name
    body = format_tide_body(reading)
    assert "inf" not in body.lower() and "nan" not in body.lower()


# ── 4. the divisor pairs ─────────────────────────────────────────────────────
# Missing-vs-zero does not close these and that is measured, not argued:
# `interp_level` brackets on the STRING and divides on the EPOCH, so its
# `prev["t"] == nxt["t"]` guard never saw two distinct strings naming one instant.
@pytest.mark.parametrize("pair", F["divisorPairs"], ids=_ids(F["divisorPairs"], "id"))
def test_a_zero_divisor_never_reaches_the_reading(pair):
    rows = [dict(row, t=(pair["a"] if i == 0 else pair["b"]))
            for i, row in enumerate(CONTROL["hilo"])]
    scenario = {"id": "divisor", "series": "hilo", "index": 0}
    reading = reading_for(scenario, rows)
    if pair["verdict"] == "unavailable":
        assert reading is None
        return
    assert reading is not None
    for name in ("level_min", "level_max"):
        v = getattr(reading, name)
        assert v == v and v not in (float("inf"), float("-inf")), name
    body = format_tide_body(reading)
    assert "inf" not in body.lower() and "nan" not in body.lower()


# ── 5. the parsers agree on a non-string `t` ─────────────────────────────────
# They diverged BEFORE the sentinel was ever reached: `str(None)` is `'None'`
# and `String(null)` is `''`, and `'None'` sorts AFTER every real timestamp
# where `''` sorts before -- so the two runtimes bracketed the window with
# different points and took different branches.
NON_STRING = [s for s in SHAPES if s["op"] == "delete" or not isinstance(s.get("t"), str)]


@pytest.mark.parametrize("shape", NON_STRING, ids=_ids(NON_STRING, "id"))
def test_a_non_string_t_never_becomes_a_coerced_string(shape):
    assert len(parse_hilo({"predictions": apply_shape(CONTROL["hilo"], 0, shape)})) \
        == len(CONTROL["hilo"]) - 1
    assert len(parse_observed({"data": apply_shape(CONTROL["observed"], 0, shape)})) \
        == len(CONTROL["observed"]) - 1
    assert len(parse_predictions({"predictions": apply_shape(CONTROL["hilo"], 0, shape)})) \
        == len(CONTROL["hilo"]) - 1


def test_a_conforming_t_is_untouched_by_that_rule():
    assert len(parse_hilo({"predictions": CONTROL["hilo"]})) == len(CONTROL["hilo"])
    assert len(parse_observed({"data": CONTROL["observed"]})) == len(CONTROL["observed"])


# ── 6. the Planner is the third twin pair on this axis ───────────────────────
# Its span filter hid the divergence: the impossible-calendar shapes that roll
# OUTSIDE the fetched span were dropped for that reason and agreed by accident.
# Every shape here rolls INTO it.
_P = F["plan"]
_PLAN_TZ = ZoneInfo(_P["tz"])
_SPAN = plan_tide_range(_P["nowTs"], _PLAN_TZ)
_PLAN_STATION = {"id": STATION["id"], "name": STATION["name"]}


def _plan(rows: list[dict]) -> str:
    return json.dumps(build_tide_plan(
        {"predictions": []}, {"predictions": rows},
        _PLAN_STATION, _P["distanceMi"], _PLAN_TZ, _SPAN,
    ), sort_keys=True)


@pytest.mark.parametrize("t", _P["shapes"])
def test_the_planner_drops_an_unplaceable_point_too(t):
    mutated = [dict(row, t=t) if i == _P["index"] else dict(row)
               for i, row in enumerate(_P["hilo"])]
    dropped = [dict(row) for i, row in enumerate(_P["hilo"]) if i != _P["index"]]
    assert _plan(mutated) == _plan(dropped)


def test_a_conforming_turning_point_is_still_kept_by_the_planner():
    dropped = [dict(row) for i, row in enumerate(_P["hilo"]) if i != _P["index"]]
    assert _plan(_P["hilo"]) != _plan(dropped)
    doc = build_tide_plan(
        {"predictions": []}, {"predictions": _P["hilo"]},
        _PLAN_STATION, _P["distanceMi"], _PLAN_TZ, _SPAN,
    )
    assert doc["status"] == "ok"
    assert len(doc["turningPoints"]) == len(_P["hilo"])


# The predicate is PLACEABLE, not POSITIVE. Every shape in the roster above is
# refused by both spellings, so the roster alone cannot separate them -- a
# mutation reverting this pair to `t > 0` left the whole file green until these
# two rows existed, which is a finding about the test rather than about the fix.
@pytest.mark.parametrize("row", _P["placeableNotPositive"], ids=_ids(_P["placeableNotPositive"], "t"))
def test_the_planner_keeps_a_placeable_point_that_is_not_positive(row):
    doc = build_tide_plan(
        {"predictions": [{"t": row["t"], "v": "3.500"}]}, {"predictions": []},
        _PLAN_STATION, _P["distanceMi"], _PLAN_TZ, _SPAN,
    )
    assert doc["status"] == "ok", row["why"]


def test_an_unplaceable_continuous_point_still_yields_unavailable():
    # The non-vacuity leg for the two rows above: the same body shape with an
    # unreadable `t` must NOT be kept, or they would pass against a predicate
    # that keeps everything.
    doc = build_tide_plan(
        {"predictions": [{"t": "not a date", "v": "3.500"}]}, {"predictions": []},
        _PLAN_STATION, _P["distanceMi"], _PLAN_TZ, _SPAN,
    )
    assert doc["status"] == "unavailable"


# ── 6b. the clock never renders a time it did not place ──────────────────────
# `_clock` / `clockTime` used to re-SCAN the string with an unanchored
# `[ T](\d{2}):(\d{2})`, so `2026/05/01 10:09` rendered `10:09am` and
# `2026-13-40 25:61` rendered `1:61pm` -- sixty-one minutes past one, after the
# word "at", in a permanent public checklist comment. This side's `\d` also
# matched Unicode decimal digits where the TS twin's did not, which was the open
# half of F2 from pipeline/tide-timezone-parse that build 4 deferred here by
# name.
#
# THIS BLOCK EXISTS BECAUSE THE PLACEMENT FILTER HID THE NEED FOR IT. Reverting
# the scan left every other row in this file green, since `compute_tide_reading`
# labels only points that survived the filter -- so the fence build 4 handed over
# would have been closed with nothing pinning it closed. Asserting the
# passthrough is VERBATIM (rather than merely "not clock-shaped") is what also
# catches the Arabic-Indic divergence, where the reverted half here renders a
# half-ASCII clock that the TS twin never produced.
_STRING_SHAPES = [s for s in SHAPES if isinstance(s.get("t"), str)]
_CLOCK_RE = re.compile(r"^([0-9]|1[0-2]):[0-9]{2}(am|pm)$")


@pytest.mark.parametrize(
    "shape", [s for s in _STRING_SHAPES if not s["placeable"]],
    ids=_ids([s for s in _STRING_SHAPES if not s["placeable"]], "id"))
def test_the_clock_refuses_a_string_it_did_not_place(shape):
    assert _clock(shape["t"]) == shape["t"], shape["why"]


@pytest.mark.parametrize(
    "shape", [s for s in _STRING_SHAPES if s["placeable"]],
    ids=_ids([s for s in _STRING_SHAPES if s["placeable"]], "id"))
def test_the_clock_renders_a_string_it_placed(shape):
    assert _CLOCK_RE.match(_clock(shape["t"])), shape["why"]


def test_the_clock_reads_the_same_time_off_every_separator_the_class_admits():
    assert _clock("2026-05-01 10:09") == "10:09am"
    assert _clock("2026-05-01T10:09") == "10:09am"
    assert _clock("2026-05-01 10:09:30") == "10:09am"
    assert _clock("2026-05-01 00:00") == "12:00am"
    assert _clock("2026-05-01 12:00") == "12:00pm"


# ── 7. the control, which is what makes every row above a measurement ────────
def test_the_control_window_reads_the_level_the_data_supports():
    reading = reading_for({"id": "control", "series": "hilo", "index": 0}, CONTROL["hilo"])
    assert reading is not None
    body = format_tide_body(reading)
    assert "Water level: 2.4 – 2.8 ft" in body
    assert "Previous high: 3.6 ft at 10:09am" in body
    assert "Next low: 1.5 ft at 3:07pm" in body
