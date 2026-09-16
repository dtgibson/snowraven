"""SHARED-FIXTURE PARITY TEST -- the Python half of the single-moment weather
builders' malformed-figure contract (weather-at-malformed-parity). The TS half
is frontend/src/lib/weatherAtMalformedParity.test.ts and drives the SAME
frontend/src/lib/weatherAtMalformed.fixture.json, whose two verdict columns were
produced by the shipped TS builders; this side reproducing both of them from the
same One Call body IS the parity claim.

WHAT THIS SIDE HAD WRONG, because it is the half the idea's framing missed.
`.claude/rules/security.md` requires a twinned builder pair to agree on what a
malformed figure IS. Measured at v1.0.31 over the 203 shapes below, the two
builders disagreed on **124** of them: 107 where the desktop twin answered while
this side refused, 9 where both answered with DIFFERENT figures, and 8 where the
roles INVERTED. Six of those eight are on the `daily` tier, where
`_hour_from_daily` substituted `0` for every absent figure and
`_FALLBACK_WEATHER` for an absent `weather` BEFORE anything could refuse it, so
`GET /weather/at` answered

    HTTP 200  description "Clear sky"  emoji ☀️
    "☀️ | Clear sky | Temperature: 55 - 74°F"

for a body the provider had sent no weather in at all, while the desktop twin
refused it. This side answered `tempF: 0` on 5 rows and invented a condition on
6. A repair to the TS side alone would have closed 107 rows and left these open
WHILE REMOVING THE ONLY SIDE THAT STILL REFUSED THEM, which is why the fix is in
the shared dependency rather than in the symptom.

One class is worth naming on its own, because no amount of cross-transport
parity checking could ever have found it: a BOOLEAN figure. `round(True)` is 1
here and `Math.round(true)` is 1 there, so `temp: true` rendered
"Temperature: 1°F" on BOTH runtimes -- an AGREEING wrong number, and the only 9
of 50 hour shapes this side accepted. That is why `is_finite_figure` excludes
bools rather than resting on `isinstance(v, int)`.

The wrong number is the dangerous half of this defect, not the blank: `0°F` and
"Clear sky" are indistinguishable from a real reading, and they reach the
copy-ready block a user pastes into a public eBird checklist.

`test_tide_epoch_parity.py` is the shape this file follows.
"""

import copy
import json
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from formatters.weather import HOUR_FIGURES, format_weather
from main import app
from services.forecast import build_weather_payload
from services.plan_weather import build_weather_plan

_LIB = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib"
FIXTURE = json.loads((_LIB / "weatherAtMalformed.fixture.json").read_text(encoding="utf-8"))
PLAN_FIXTURE = json.loads((_LIB / "weatherTidePlan.fixture.json").read_text(encoding="utf-8"))

ROWS = FIXTURE["rows"]
HOUR_ROWS = FIXTURE["hourRows"]
HOUR_BASE = FIXTURE["hourBase"]
TARGETS = FIXTURE["targets"]
TZ = ZoneInfo(FIXTURE["tz"])
LAT, LNG, NOW_TS = FIXTURE["lat"], FIXTURE["lng"], FIXTURE["nowTs"]

KEY = "sekrit-key"
W_AT_DETAIL = "Weather data unavailable for this location."
W_CL_DETAIL = "Weather data unavailable for this checklist's time and location."

client = TestClient(app)


def base() -> dict:
    return copy.deepcopy(PLAN_FIXTURE["families"][0]["onecall"])


# ── the shared shape DSL ─────────────────────────────────────────────────────
# Deliberately re-implemented here rather than shared with the TS half: this
# side applying the same five fields to the same body from its OWN code is what
# the cross-transport claim consists of. The conforming CONTROL rows are what
# catch a mis-implementation of the DSL itself.
def apply_shape(oc: dict, row: dict) -> dict:
    op, tier = row["op"], row["tier"]
    if op == "none":
        return oc
    if op == "tier-replaced":
        oc[tier] = copy.deepcopy(row.get("value"))
        return oc
    if op == "entries-non-objects":
        oc["current" if tier == "current" else tier] = "nope" if tier == "current" else ["x", None, 5]
        return oc
    all_entries = [oc["current"]] if tier == "current" else oc[tier]
    indices = range(len(all_entries)) if "only" not in row else [row["only"]]
    for i in indices:
        entry = all_entries[i]
        if op == "keep-dt-only":
            stub = {"dt": entry.get("dt")}
            if tier == "current":
                oc["current"] = stub
            else:
                oc[tier][i] = stub
            continue
        parts = row["field"].split(".")
        target = entry
        for p in parts[:-1]:
            nxt = target.get(p)
            target = nxt if isinstance(nxt, dict) else None
            if target is None:
                break
        if target is None:
            continue
        if op == "delete":
            target.pop(parts[-1], None)
        else:
            target[parts[-1]] = copy.deepcopy(row.get("value"))
    return oc


def hour_body(row: dict):
    if row["op"] == "body":
        return copy.deepcopy(row.get("value"))
    h = copy.deepcopy(HOUR_BASE)
    if row["op"] == "delete":
        h.pop(row["field"], None)
    else:
        h[row["field"]] = copy.deepcopy(row.get("value"))
    return {"data": [h]}


def payload_verdict(oc: dict, tier: str):
    """(verdict, payload) under the same four-value vocabulary the TS half uses."""
    try:
        payload = build_weather_payload(oc, TARGETS[tier], TZ, LAT)
    except Exception:
        return "refuse", None
    return ("accept", payload) if payload["summary"] is not None else ("out-of-range", payload)


def plan_verdict(oc: dict) -> str:
    try:
        built = build_weather_plan(oc, NOW_TS, TZ, LAT, LNG)
    except Exception:
        return "refuse"
    return "accept" if built["ok"] else "no-daily"


def _ids():
    return {r["id"] for r in ROWS}


# ── non-vacuity: the matrix carries the shapes that separate the twins ───────

@pytest.mark.parametrize("shape", [
    "daily temp delete",             # the fabricated tempF: 0 / H 0° · L 0°
    "daily weather delete",          # the fabricated "Clear sky"
    "daily (entry) keep-dt-only",    # every figure zero under an invented condition
    "daily temp set empty-object",   # 0 on this side, NaN on the other
    "current temp set string",       # the NaN half of the same defect
    "current wind_speed set null",   # "Calm" -- a confident wrong WORD, not a blank
    "current wind_speed set string",  # "Gale" for the string "warm"
    "hourly weather set list-of-empty-object",
    "daily weather set empty-list",  # the one row the twins AGREED on, both fabricating
])
def test_the_matrix_carries_every_class_the_brief_measured(shape):
    """A fixture of conforming bodies cannot see a twin divergence at all, and one
    without the DAILY tier could not see the inversion -- the half a one-sided
    repair would have left open while making it harder to spot."""
    assert shape in _ids()


def test_the_matrix_represents_both_outcomes_so_an_all_refuse_degeneration_fails_loudly():
    verdicts = {r["verdict"] for r in ROWS}
    assert {"refuse", "accept", "out-of-range"} <= verdicts
    assert {"refuse", "accept"} <= {r["planVerdict"] for r in ROWS}
    assert len(ROWS) >= 200
    assert len(HOUR_ROWS) >= 41


@pytest.mark.parametrize("tier", ["current", "hourly", "daily"])
def test_the_conforming_control_still_answers_so_the_dsl_cannot_be_mis_implemented(tier):
    control = next(r for r in ROWS if r["op"] == "none" and r["tier"] == tier)
    assert control["verdict"] == "accept"
    verdict, payload = payload_verdict(apply_shape(base(), control), tier)
    assert verdict == "accept"
    assert payload["resolution"] == tier


@pytest.mark.parametrize("tier", ["current", "hourly", "daily"])
def test_the_named_targets_really_select_their_own_tier(tier):
    _, payload = payload_verdict(base(), tier)
    assert payload["resolution"] == tier


def test_every_row_that_does_not_refuse_states_a_reason():
    # The direction a reader cannot check by eye: a guard that refused
    # everything would satisfy every other assertion in this file.
    assert [r["id"] for r in ROWS if r["verdict"] != "refuse" and not r.get("why")] == []


# ── claim 1: the single-moment builder answers the shared verdict ────────────

@pytest.mark.parametrize("row", ROWS, ids=lambda r: r["id"])
def test_build_weather_payload_answers_the_shared_verdict(row):
    assert payload_verdict(apply_shape(base(), row), row["tier"])[0] == row["verdict"]


# ── claim 2: nothing an accepted payload carries is fabricated ───────────────
ACCEPTED = [r for r in ROWS if r["verdict"] == "accept"]


@pytest.mark.parametrize("row", ACCEPTED, ids=lambda r: r["id"])
def test_no_accepted_payload_carries_a_fabricated_or_missing_figure(row):
    _, payload = payload_verdict(apply_shape(base(), row), row["tier"])
    s = payload["summary"]
    for name in ("tempF", "cloudsPct", "humidityPct", "dewPointF"):
        assert isinstance(s[name], (int, float)) and not isinstance(s[name], bool), (row["id"], name)
        assert s[name] == s[name], (row["id"], name)
    # highF/lowF are None by design off the daily tier; ON it they are figures,
    # and `H 0° · L 0°` over a body with no temperature is exactly this pair.
    if s["isDaily"]:
        assert isinstance(s["highF"], (int, float)) and isinstance(s["lowF"], (int, float)), row["id"]
    else:
        assert s["highF"] is None and s["lowF"] is None, row["id"]
    # THE SURFACE THAT MATTERS: this string is what a user pastes into a public
    # eBird checklist.
    assert "NaN" not in payload["formatted"], row["id"]


def test_an_accepted_condition_is_the_one_the_provider_sent():
    """The fabrication check as a property rather than a count: for every
    accepting row that mutated `weather`, the description must be the SELECTED
    entry's own, never a substituted `clear sky`."""
    rows = [r for r in ACCEPTED if r.get("field") == "weather"]
    assert rows, "no accepting weather row -- the substitution check would be vacuous"
    for row in rows:
        oc = apply_shape(base(), row)
        _, payload = payload_verdict(oc, row["tier"])
        description = payload["summary"]["description"]
        assert "only" in row, row["id"]
        sources = [
            e["weather"][0]["description"].capitalize()
            for i, e in enumerate(oc[row["tier"]])
            if i != row["only"] and isinstance(e.get("weather"), list) and e["weather"]
            and isinstance(e["weather"][0].get("description"), str)
        ]
        assert description in sources, (row["id"], description)


# ── claim 3: the plan builder that delegates here answers its own verdict ────

@pytest.mark.parametrize("row", ROWS, ids=lambda r: r["id"])
def test_build_weather_plan_answers_the_shared_plan_verdict(row):
    """The column that makes the v1.0.29 reference true for the first time. The
    plan pair diverged on 58 of these 203 rows at v1.0.31 (57 by verdict, one
    by document), because this side's `_hour_from_daily` had already defaulted
    the figure away -- so Python's half of that supposed agreement rested on
    `build_weather_payload` happening to raise, which on the `daily` tier it
    did not."""
    assert plan_verdict(apply_shape(base(), row)) == row["planVerdict"]


# ── claim 4: the copy block's own formatter, the checklist twin ──────────────

@pytest.mark.parametrize("row", HOUR_ROWS, ids=lambda r: r["id"])
def test_format_weather_refuses_every_malformed_hour(row):
    """This side already refused 41 of these 50 implicitly (a `round()` that
    raised, a KeyError, a `.capitalize()` on None) -- not all of them, which is
    the point of the 9 boolean rows. The explicit guard is what its TS twin can
    be held to: measured at v1.0.31, that twin refused 13 of these and produced
    PASTEABLE TEXT for the other 37, including `Temperature: NaN - NaN°F`,
    `Temperature: 0°F` from a null, `Wind: Calm` from a null speed and
    `Wind: Gale` from the string "warm", 8 of them carrying `NaN`. The 9 both
    accepted are the boolean rows, where the two agreed on a wrong number."""
    with pytest.raises(Exception):
        format_weather([hour_body(row)], TZ, LAT)


def test_format_weather_still_produces_the_conforming_block_unchanged():
    out = format_weather([{"data": [copy.deepcopy(HOUR_BASE)]}], TZ, LAT)
    assert "Temperature:" in out
    assert "SnowRaven" in out
    assert "NaN" not in out


# ── claim 5: the `current` PRESENCE boundary, derived in BOTH directions ─────
# WHY THESE ROWS ARE HAND-WRITTEN AND WHY THEY LIVE BESIDE THE MATRIX RATHER
# THAN IN IT. The 203 rows above carry verdict columns PRODUCED by the shipped
# TS builders, which is right for them and is what makes this file's
# reproduction a parity claim -- but a generated column can only ever pin
# AGREEMENT, and what this class needed was a DIRECTION. The direction is
# argued from the two runtimes' contracts (the presence paragraph on
# `pick_forecast_slice`, and `isPresent` in forecastSlice.ts), so the
# expectations here are literals, written identically in
# weatherAtMalformedParity.test.ts: neither runtime can drift from the stated
# contract without one of the two files going red.
#
# They are separate from the matrix because every figure recorded against those
# 203 shapes -- 124 divergences at v1.0.31, 58 plan divergences, 0 after -- is a
# measurement over exactly that population, and growing it would silently
# restate all of them over a different one.
#
# THE DEFECT THEY CLOSE. The first cut of this build swapped `if current` for
# `current is not None`, which fixed `{}` and `[]` (falsy here, truthy in JS)
# and broke `0` / `False` / `""` (falsy in JS, not-None here): those three
# AGREED on `out-of-range` at v1.0.31 and became a 502 here against an
# out-of-range 200 there -- a new divergence of exactly the class this build
# exists to close, in the function it rewrote.
_ABSENT = object()

PRESENCE_ROWS = [
    # The two out-of-range answers, pre-existing and unchanged on both runtimes:
    # One Call legitimately omits `current` (the `exclude` parameter), and with
    # no `dt` target there is no other tier to answer from.
    ("current absent", _ABSENT, "out-of-range"),
    ("current null", None, "out-of-range"),
    # FALSY IN JS, NOT-NONE HERE -- the three F-1 names. Present, so refused by
    # the shared validator, so the answer is the provider error rather than a
    # false claim about the forecast horizon.
    ("current 0", 0, "refuse"),
    ("current false", False, "refuse"),
    ("current empty string", "", "refuse"),
    # TRUTHY IN JS, FALSY HERE -- the half the first cut did derive.
    ("current empty object", {}, "refuse"),
    ("current empty list", [], "refuse"),
    # Every other non-None value is present too, and refused for the same reason.
    ("current a number", 5, "refuse"),
    ("current a string", "nope", "refuse"),
    ("current a list of pairs", [["dt", 1]], "refuse"),
    ("current an object with no dt", {"a": 1}, "refuse"),
]


def _presence_body(value) -> dict:
    oc = base()
    if value is _ABSENT:
        oc.pop("current", None)
    else:
        oc["current"] = copy.deepcopy(value)
    return oc


def test_the_presence_rows_are_not_vacuous():
    verdicts = {v for _, _, v in PRESENCE_ROWS}
    assert {"refuse", "out-of-range"} <= verdicts
    ids = {i for i, _, _ in PRESENCE_ROWS}
    for name in ("current 0", "current false", "current empty string"):
        assert name in ids, name
    # ROW COUNT, asserted in BOTH languages so neither hand-written table can
    # grow alone -- the same discipline v1.0.12 put on the iCloud time-parity
    # fixture. These two tables are the parity claim for this class, and a row
    # added here and not in weatherAtMalformedParity.test.ts would leave the
    # other runtime unmeasured with both files green.
    assert len(PRESENCE_ROWS) == 11


def test_the_presence_control_still_answers_at_the_current_tier():
    verdict, payload = payload_verdict(base(), "current")
    assert verdict == "accept"
    assert payload["resolution"] == "current"


@pytest.mark.parametrize("name,value,verdict", PRESENCE_ROWS, ids=[r[0] for r in PRESENCE_ROWS])
def test_the_current_presence_boundary_is_presence_not_truthiness(name, value, verdict):
    assert payload_verdict(_presence_body(value), "current")[0] == verdict


# ── claim 6: the copy block validates what each response CONTRIBUTES ─────────
# `format_weather` is a FAN-IN: `/weather/{checklist_id}` hands it one response
# per sampled hour of the checklist. The nine figures are aggregated from every
# one of them -- including `dt`, `sunrise` and `sunset`, which `_is_night_hour`
# reads from all of them to decide the moon emoji -- while `weather[0]` is read
# from `first` ALONE.
#
# So the guard is per field-each-response-contributes, and the rows below pin
# that. The defect they close (QA finding F-2) is the first cut running the
# WHOLE validator on every response: a malformed `weather` on hour 2 of 3 was
# accepted on both runtimes at v1.0.31 and became a 502 on both -- an unrecorded
# widening that contradicted this build's own tier-selector argument, where one
# bad hour of 48 is explicitly not allowed to cost the answer. It is also
# inconsistent one level down: `weather[1]` is deliberately unchecked because
# nothing reads it.
LATER_CONDITION = [{"id": 804, "description": "overcast clouds"}]


def multi_responses() -> list:
    """Three sampled hours an hour apart, all inside the sunrise-sunset window.
    Hours 1 and 2 carry a DIFFERENT condition from hour 0 on purpose: the block
    must report hour 0's, which is what makes `weather` first-only a measured
    fact about this formatter rather than a reading of its source."""
    out = []
    for i in range(3):
        h = copy.deepcopy(HOUR_BASE)
        h["dt"] = HOUR_BASE["dt"] + i * 3600
        h["temp"] = HOUR_BASE["temp"] + i * 2
        h["wind_speed"] = HOUR_BASE["wind_speed"] + i
        if i != 0:
            h["weather"] = copy.deepcopy(LATER_CONDITION)
        out.append({"data": [h]})
    return out


WEATHER_MUTATIONS = [
    ("delete", "delete", None),
    ("set null", "set", None),
    ("set empty-list", "set", []),
    ("set list-of-empty-object", "set", [{}]),
    ("set null-description", "set", [{"id": 800, "description": None}]),
    ("set string", "set", "sunny"),
]
# One row per HOUR_FIGURES member, on a NON-FIRST response. All nine are read
# from every response, so all nine must refuse -- the three clock fields
# included, which is the half a reader of `first["sunrise"]` would get wrong.
FIGURE_MUTATIONS = [
    ("dt", "set", None),
    ("temp", "set", "warm"),
    ("humidity", "delete", None),
    ("dew_point", "set", None),
    ("wind_speed", "set", "warm"),
    ("wind_deg", "set", True),
    ("clouds", "delete", None),
    ("sunrise", "set", "x"),
    ("sunset", "delete", None),
]

MULTI_ROWS = (
    [("the CONFORMING control", 0, None, None, None, "accept")]
    + [(f"weather {label} @1 (a LATER hour)", 1, "weather", op, value, "accept")
       for label, op, value in WEATHER_MUTATIONS]
    + [(f"weather {label} @0 (the FIRST hour)", 0, "weather", op, value, "refuse")
       for label, op, value in WEATHER_MUTATIONS]
    + [(f"{field} {op} @1 (a LATER hour)", 1, field, op, value, "refuse")
       for field, op, value in FIGURE_MUTATIONS]
)


def _multi_body(index, field, op, value) -> list:
    rs = multi_responses()
    if field is None:
        return rs
    h = rs[index]["data"][0]
    if op == "delete":
        h.pop(field, None)
    else:
        h[field] = copy.deepcopy(value)
    return rs


def test_the_block_reports_the_first_hours_condition():
    out = format_weather(multi_responses(), TZ, LAT)
    assert "Scattered clouds" in out
    assert "Overcast clouds" not in out
    assert "NaN" not in out
    # And the aggregated fields really do come from all three, so the rows below
    # cannot pass by the later hours being ignored wholesale.
    assert "Temperature: 60 - 64°F" in out


def test_the_multi_hour_rows_cover_all_nine_aggregated_figures():
    covered = sorted(
        field for _, index, field, _, _, verdict in MULTI_ROWS
        if verdict == "refuse" and index != 0 and field != "weather"
    )
    assert covered == sorted(HOUR_FIGURES)
    # Both outcomes, and the row count in both languages (see the presence
    # block above for why the count is asserted rather than left implicit).
    verdicts = {v for *_, v in MULTI_ROWS}
    assert {"accept", "refuse"} <= verdicts
    assert len(MULTI_ROWS) == 22


@pytest.mark.parametrize(
    "name,index,field,op,value,verdict", MULTI_ROWS, ids=[r[0] for r in MULTI_ROWS]
)
def test_format_weather_validates_the_fields_each_hour_contributes(
    name, index, field, op, value, verdict
):
    body = _multi_body(index, field, op, value)
    if verdict == "refuse":
        with pytest.raises(Exception):
            format_weather(body, TZ, LAT)
        return
    # ACCEPT is the stronger claim: not merely that it does not raise, but that
    # the produced block is byte-identical to the all-conforming one, because a
    # field nothing reads cannot change what is printed.
    assert format_weather(body, TZ, LAT) == format_weather(multi_responses(), TZ, LAT)


# ── the two routes: the verdict a user actually meets ────────────────────────
def _local(ts: int) -> str:
    return datetime.fromtimestamp(ts, TZ).strftime("%Y-%m-%d %H:%M")


def _get_weather_at(tier: str, body: dict, monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", KEY)
    params = {"lat": LAT, "lng": LNG}
    if TARGETS[tier] is not None:
        params["dt"] = _local(TARGETS[tier])
    with patch("routers.weather.fetch_forecast", new=AsyncMock(return_value=body)):
        return client.get("/weather/at", params=params)


# One representative refusing row per tier, plus the two rows the brief names as
# the sharpest: a daily body with NO weather in it, and a daily body missing one
# figure. These are the rows that used to answer 200.
ROUTE_ROWS = [
    ("current", "current temp set string"),
    ("current", "current wind_speed set null"),
    ("hourly", "hourly temp set string"),
    ("hourly", "hourly weather set list-of-empty-object"),
    ("daily", "daily weather delete"),
    ("daily", "daily humidity delete"),
    ("daily", "daily temp delete"),
    ("daily", "daily (entry) keep-dt-only"),
]


@pytest.mark.parametrize("tier,shape", ROUTE_ROWS)
def test_weather_at_answers_502_and_fabricates_nothing(monkeypatch, tier, shape):
    row = next(r for r in ROWS if r["id"] == shape)
    assert row["verdict"] == "refuse", shape
    resp = _get_weather_at(tier, apply_shape(base(), row), monkeypatch)
    assert resp.status_code == 502, (tier, shape)
    assert resp.json()["detail"] == W_AT_DETAIL
    # The three things that used to come back on the daily tier. Asserted on the
    # raw text so a nested figure cannot slip past a keyed assertion.
    assert "Clear sky" not in resp.text, shape
    assert "tempF" not in resp.text, shape
    assert "NaN" not in resp.text, shape
    assert KEY not in resp.text


def test_the_sharpest_single_row_from_the_brief(monkeypatch):
    """`GET /weather/at` with `daily[*].weather` absent answered HTTP 200
    carrying `description: "Clear sky"`, `☀️`, and a copy block reading
    `☀️ | Clear sky | Temperature: 55 - 74°F`. The provider sent no weather at
    all. This row is the before/after of the whole build."""
    row = next(r for r in ROWS if r["id"] == "daily weather delete")
    resp = _get_weather_at("daily", apply_shape(base(), row), monkeypatch)
    assert resp.status_code == 502
    assert resp.json() == {"detail": W_AT_DETAIL}
    for fabricated in ("Clear sky", "clear sky", "☀", "Temperature"):
        assert fabricated not in resp.text


@pytest.mark.parametrize("tier", ["current", "hourly", "daily"])
def test_weather_at_is_unchanged_on_the_conforming_body(monkeypatch, tier):
    resp = _get_weather_at(tier, base(), monkeypatch)
    assert resp.status_code == 200
    data = resp.json()
    assert data["resolution"] == tier
    assert data["tz"] == FIXTURE["tz"]
    assert "NaN" not in resp.text
    for name in ("tempF", "cloudsPct", "humidityPct", "dewPointF"):
        assert isinstance(data["summary"][name], (int, float))


MOCK_CHECKLIST = {"obs_dt": "2024-05-01 06:30", "loc_name": "L", "lat": LAT, "lng": LNG, "duration_hrs": 1.0}


@pytest.mark.parametrize("row", HOUR_ROWS, ids=lambda r: r["id"])
def test_weather_checklist_answers_502_for_every_malformed_hour(monkeypatch, row):
    """`/weather/{checklist_id}` is the OTHER single-moment lookup, one call away
    and sharing this formatter -- scoped in deliberately, because a rule applied
    only where a brief points leaves its neighbours one call away (the flag the
    preceding build raised). This side already answered 502 for all of these;
    the row exists so that stays true and so the desktop twin has a target."""
    monkeypatch.setenv("OPENWEATHER_API_KEY", KEY)
    monkeypatch.setenv("EBIRD_API_KEY", KEY)
    with (
        patch("routers.weather.fetch_checklist", new=AsyncMock(return_value=dict(MOCK_CHECKLIST))),
        patch("routers.weather.fetch_historical", new=AsyncMock(return_value=hour_body(row))),
    ):
        resp = client.get("/weather/S123456")
    assert resp.status_code == 502, row["id"]
    assert resp.json()["detail"] == W_CL_DETAIL
    assert "NaN" not in resp.text
    assert KEY not in resp.text


def test_weather_checklist_is_unchanged_on_the_conforming_hour(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", KEY)
    monkeypatch.setenv("EBIRD_API_KEY", KEY)
    with (
        patch("routers.weather.fetch_checklist", new=AsyncMock(return_value=dict(MOCK_CHECKLIST))),
        patch("routers.weather.fetch_historical", new=AsyncMock(return_value={"data": [copy.deepcopy(HOUR_BASE)]})),
    ):
        resp = client.get("/weather/S123456")
    assert resp.status_code == 200
    assert "Temperature:" in resp.json()["formatted"]
    assert "NaN" not in resp.text
