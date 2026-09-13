"""SHARED-FIXTURE PARITY TEST -- the Python half of the Weather/tide Planner's
twin builders (tide-weather-planner NFR-04 / QA-44).

`services.plan_weather.build_weather_plan` and `services.plan_tide.build_tide_plan`
are twins of `frontend/src/lib/weatherPlan.ts` / `tidePlan.ts`. Both halves load
the ONE shared fixture (frontend/src/lib/weatherTidePlan.fixture.json), drive
their SHIPPED builders over each family's raw inputs (never a retyped rule), and
assert deep equality with the expected halves plus canonical-JSON byte
equality, so the two transports cannot drift independently.

The expected halves were produced by the TS builders (see the env-gated
generator beside the fixture); this side reproducing them from the same raw
One Call and NOAA bodies IS the parity claim. Each family also carries a
non-vacuity check that it really contains the shape it is named for, so a
fixture that quietly lost its discriminating rows would still fail here.
"""

import json
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from services.plan_tide import build_tide_plan, plan_tide_range
from services.plan_weather import build_weather_plan

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "lib" / "weatherTidePlan.fixture.json"
)
FIXTURE = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
FAMILIES = {f["name"]: f for f in FIXTURE["families"]}

EXPECTED_NAMES = [
    "reference", "subordinate", "dst-fall", "dst-spring", "far-station", "gap",
    "no-hourly", "five-daily", "polar", "no-daily", "missing-daily",
    "now-in-hour", "same-minute-high", "maximal",
]


def _norm(v):
    """JSON has no int/float distinction: JS prints 2.0 as `2` and Python as
    `2.0`, so an integral float is written as an int for the byte comparison
    (the deep-equality assertion beside it already treats them as equal)."""
    if isinstance(v, float) and v.is_integer():
        return int(v)
    if isinstance(v, dict):
        return {k: _norm(x) for k, x in v.items()}
    if isinstance(v, list):
        return [_norm(x) for x in v]
    return v


def canonical(doc) -> str:
    return json.dumps(_norm(doc), sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def test_fixture_carries_every_named_family():
    assert [f["name"] for f in FIXTURE["families"]] == EXPECTED_NAMES


@pytest.mark.parametrize("name", EXPECTED_NAMES)
def test_weather_half_matches_the_shared_fixture(name):
    fam = FAMILIES[name]
    tz = ZoneInfo(fam["tz"])
    got = build_weather_plan(fam["onecall"], fam["nowTs"], tz, fam["lat"], fam["lng"])
    assert got == fam["expectedWeather"], name
    assert canonical(got) == canonical(fam["expectedWeather"]), name


@pytest.mark.parametrize("name", EXPECTED_NAMES)
def test_tide_half_matches_the_shared_fixture(name):
    fam = FAMILIES[name]
    tz = ZoneInfo(fam["tz"])
    span = plan_tide_range(fam["nowTs"], tz)
    assert span == fam["span"], name
    got = build_tide_plan(fam["predBody"], fam["hiloBody"], fam["station"], fam["distanceMi"], tz, span)
    assert got == fam["expectedTide"], name
    assert canonical(got) == canonical(fam["expectedTide"]), name


# ── Non-vacuity: each family really holds the shape it is named for ──────────

def _plan(name):
    return FAMILIES[name]["expectedWeather"]["plan"]


def test_reference_family_is_a_reference_station_with_eight_days():
    p = _plan("reference")
    t = FAMILIES["reference"]["expectedTide"]
    assert len(p["days"]) == 8 and t["continuous"] is True
    assert all(s["hilo"] is False for s in t["curve"])
    assert any(e["weather"]["resolution"] == "hourly" for e in p["events"])
    assert any(e["weather"]["resolution"] == "daily" for e in p["events"])


def test_subordinate_family_interpolates_every_sample():
    t = FAMILIES["subordinate"]["expectedTide"]
    assert t["continuous"] is False and len(t["curve"]) > 0
    assert all(s["hilo"] is True for s in t["curve"])


def test_dst_families_draw_the_changed_day_at_its_true_length():
    fall = _plan("dst-fall")
    spring = _plan("dst-spring")
    assert any(d["endTs"] - d["startTs"] + 1 == 90000 for d in fall["days"])
    assert any(d["endTs"] - d["startTs"] + 1 == 82800 for d in spring["days"])
    # A turning point inside the repeated hour lands at its true instant.
    tps = FAMILIES["dst-fall"]["expectedTide"]["turningPoints"]
    repeated = [p for p in tps if p["local"] == "2026-11-01 01:10"]
    assert len(repeated) == 1 and repeated[0]["t"] == 1793524200


def test_far_station_family_places_the_same_gmt_bodies_on_the_locations_clock():
    ref = FAMILIES["reference"]["expectedTide"]
    far = FAMILIES["far-station"]["expectedTide"]
    assert FAMILIES["far-station"]["force"] is True
    assert far["tz"] == "America/New_York" and ref["tz"] == "America/Los_Angeles"
    # Same epoch instants for the turning points both spans hold; different
    # local strings, three hours apart.
    by_t = {p["t"]: p for p in ref["turningPoints"]}
    shared = [p for p in far["turningPoints"] if p["t"] in by_t]
    assert len(shared) > 20
    for p in shared:
        assert p["v"] == by_t[p["t"]]["v"]
        assert p["local"] != by_t[p["t"]]["local"]


def test_gap_family_has_interpolated_samples_around_the_first_sunrise():
    p = _plan("gap")
    t = FAMILIES["gap"]["expectedTide"]
    sunrise = next(e for e in p["events"] if e["kind"] == "sunrise")["t"]
    around = [s for s in t["curve"] if abs(s["t"] - sunrise) <= 1800]
    assert around and all(s["hilo"] is True for s in around)
    assert any(s["hilo"] is False for s in t["curve"])


def test_no_hourly_family_has_only_daily_cells_from_the_axis_start():
    p = _plan("no-hourly")
    assert p["hourlyEndTs"] == p["window"]["axisStartTs"]
    assert p["cells"] and all(c["resolution"] == "daily" for c in p["cells"])
    assert all(e["weather"]["resolution"] == "daily" for e in p["events"])


def test_five_daily_family_ends_on_its_fifth_day():
    p = _plan("five-daily")
    assert len(p["days"]) == 5 and p["window"]["endTs"] == p["days"][-1]["endTs"]


def test_polar_family_omits_the_missing_events_and_says_so_per_day():
    p = _plan("polar")
    assert any(d["sunset"] is None for d in p["days"])
    assert any(d["sunrise"] is None for d in p["days"])
    kinds = {(e["date"], e["kind"]) for e in p["events"]}
    for d in p["days"]:
        if d["sunset"] is None:
            assert (d["date"], "sunset") not in kinds
        if d["sunrise"] is None:
            assert (d["date"], "sunrise") not in kinds


def test_empty_and_missing_daily_families_build_no_plan():
    assert FAMILIES["no-daily"]["expectedWeather"] == {"ok": False, "reason": "no-daily"}
    assert FAMILIES["missing-daily"]["expectedWeather"] == {"ok": False, "reason": "no-daily"}
    assert FAMILIES["no-daily"]["onecall"]["daily"] == []
    assert "daily" not in FAMILIES["missing-daily"]["onecall"]


def test_now_in_hour_family_reads_the_current_block_as_hourly():
    fam = FAMILIES["now-in-hour"]
    p = fam["expectedWeather"]["plan"]
    first = p["events"][0]
    cur = fam["onecall"]["current"]
    assert abs(first["t"] - cur["dt"]) <= 3600
    assert first["weather"]["resolution"] == "hourly"
    # The reading is the current block's, not hourly[0]'s, which differ.
    assert first["weather"]["description"] == cur["weather"][0]["description"].capitalize()
    assert first["weather"]["description"] != fam["onecall"]["hourly"][0]["weather"][0]["description"].capitalize()


def test_same_minute_high_family_has_a_turning_point_at_the_events_minute():
    p = _plan("same-minute-high")
    tps = FAMILIES["same-minute-high"]["expectedTide"]["turningPoints"]
    event_minutes = {e["t"] - e["t"] % 60 for e in p["events"]}
    assert any(tp["t"] in event_minutes and tp["kind"] == "high" for tp in tps)


def test_maximal_family_is_the_largest_conforming_shape():
    fam = FAMILIES["maximal"]
    p = fam["expectedWeather"]["plan"]
    t = fam["expectedTide"]
    assert len(fam["onecall"]["hourly"]) == 48 and len(fam["onecall"]["daily"]) == 8
    assert len(fam["predBody"]["predictions"]) >= 2000
    assert len(p["days"]) == 8 and len(t["curve"]) >= 400
