"""The single-moment lookups' provider-body containment (at-route-try-containment).

The v1.0.29 rule in .claude/rules/security.md -- "a route's `try` covers the
BUILDER that consumes the provider body, not only the fetch" -- applied to the
four handlers the Planner's routes left on the older shape: /weather/at,
/weather/{checklist_id}, /tide/at and /tide/{checklist_id}.

Every row below was MEASURED raising on this transport before the repair was
written; none is inferred from the plan suites. Two things make that necessary
rather than ceremonial:

  * /weather/at is TIER-SENSITIVE. It slices ONE forecast tier, so a shape that
    mutates another tier usually answers 200 untouched -- six of the seven
    shapes test_weather_plan.py carries answer 200 here at the default Current
    tier. The tier-insensitivity control below is what makes the table's rows
    mean what they say rather than pass for an unrelated reason.

    It is NOT tier-ISOLATED, and this header asserted that it was until
    weather-at-malformed-parity measured otherwise: since that build
    `_hour_from_point` reads sunrise/sunset from the DAILY tier whenever the
    selected current/hourly point omits them (One Call does exactly that at
    polar latitudes), so a daily-only mutation CAN decide a current-tier
    answer. Measured on one body: `daily[*].sunrise = 'x'` answers 200
    untouched while `current` carries its own sun times, and 502 once it does
    not. Every row below still holds, and it holds because MOCK_ONECALL's
    `current` carries them -- a property of this fixture rather than of the
    route, which is exactly why the sentence needed correcting.
  * The tide half's honest state is {"status": "unavailable"}, NOT a 502 --
    the same state an unreadable body already gets, exactly as /tide/plan does.

The API key is asserted absent from every failure body, on every row.
"""

import copy
from datetime import datetime
from zoneinfo import ZoneInfo
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

KEY = "sekrit-key"
W_AT_DETAIL = "Weather data unavailable for this location."
W_CL_DETAIL = "Weather data unavailable for this checklist's time and location."
W_DATE_DETAIL = "This checklist's date could not be read."


def _hour(dt, temp=60.0, **kw):
    h = {
        "dt": dt, "temp": temp, "humidity": 70, "dew_point": 50,
        "wind_speed": 8, "wind_deg": 270, "clouds": 20,
        "weather": [{"id": 802, "description": "scattered clouds"}],
        "sunrise": dt - 3 * 3600, "sunset": dt + 6 * 3600,
    }
    h.update(kw)
    return h


BASE_DT = 1714563000  # 2024-05-01, ~midday ET
MOCK_ONECALL = {
    "current": _hour(BASE_DT, 61.0),
    "hourly": [_hour(BASE_DT + i * 3600) for i in range(48)],
    "daily": [
        {
            "dt": BASE_DT + d * 86400, "temp": {"day": 58, "min": 51, "max": 64},
            "humidity": 78, "dew_point": 50, "wind_speed": 6, "wind_deg": 315,
            "clouds": 30, "weather": [{"id": 801, "description": "few clouds"}],
            "sunrise": BASE_DT + d * 86400 - 6 * 3600, "sunset": BASE_DT + d * 86400 + 6 * 3600,
        }
        for d in range(8)
    ],
}

# The tier is chosen by `dt`, the LOCATION's local wall-clock (America/New_York
# for these coordinates); no dt at all is the Current view.
_NY = ZoneInfo("America/New_York")
def _local(ts):
    return datetime.fromtimestamp(ts, _NY).strftime("%Y-%m-%d %H:%M")

TIER_DT = {"current": None, "hourly": _local(BASE_DT + 5 * 3600), "daily": _local(BASE_DT + 5 * 86400)}
W_PARAMS = {"lat": 40.0, "lng": -74.0}


def _mutate(name):
    b = copy.deepcopy(MOCK_ONECALL)
    cur, hourly, daily = b["current"], b["hourly"], b["daily"]
    if name == "current.temp non-numeric":
        cur["temp"] = "warm"
    elif name == "current.weather non-list":
        cur["weather"] = "sunny"
    elif name == "current.wind_speed null":
        cur["wind_speed"] = None
    elif name == "current.clouds string":
        cur["clouds"] = "lots"
    elif name == "current.sunrise absurd":
        cur["sunrise"] = 10 ** 20
    elif name == "current dt-only":
        b["current"] = {"dt": cur["dt"]}
    elif name == "hourly.temp non-numeric":
        hourly[5]["temp"] = "warm"
    elif name == "hourly.weather non-list":
        hourly[5]["weather"] = "sunny"
    elif name == "hourly.wind_speed null":
        hourly[5]["wind_speed"] = None
    elif name == "hourly dt-only":
        hourly[5] = {"dt": hourly[5]["dt"]}
    elif name == "daily.temp non-object":
        daily[5]["temp"] = "x"
    elif name == "daily.weather non-list":
        daily[5]["weather"] = "sunny"
    else:
        raise AssertionError(f"unknown shape {name}")
    return b


def _get_weather_at(tier, body, monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", KEY)
    params = dict(W_PARAMS)
    if TIER_DT[tier]:
        params["dt"] = TIER_DT[tier]
    with patch("routers.weather.fetch_forecast", new=AsyncMock(return_value=body)):
        return client.get("/weather/at", params=params)


# ── /weather/at ───────────────────────────────────────────────────────────────
# (tier, shape) pairs measured raising THROUGH THIS ROUTE at that tier.
W_AT_ROWS = [
    ("current", "current.temp non-numeric"), ("current", "current.weather non-list"),
    ("current", "current.wind_speed null"), ("current", "current.clouds string"),
    ("current", "current.sunrise absurd"), ("current", "current dt-only"),
    ("hourly", "hourly.temp non-numeric"), ("hourly", "hourly.weather non-list"),
    ("hourly", "hourly.wind_speed null"), ("hourly", "hourly dt-only"),
    ("daily", "daily.temp non-object"), ("daily", "daily.weather non-list"),
]


@pytest.mark.parametrize("tier,shape", W_AT_ROWS)
def test_weather_at_malformed_body_is_502_never_500(monkeypatch, tier, shape):
    resp = _get_weather_at(tier, _mutate(shape), monkeypatch)
    assert resp.status_code == 502, (tier, shape)
    assert resp.json()["detail"] == W_AT_DETAIL
    assert KEY not in resp.text


@pytest.mark.parametrize("shape,answering_tier", [
    ("current.temp non-numeric", "daily"),
    ("current.sunrise absurd", "hourly"),
    ("daily.temp non-object", "current"),
    ("hourly dt-only", "daily"),
])
def test_weather_at_is_tier_sensitive_so_another_tiers_shape_is_untouched(monkeypatch, shape, answering_tier):
    """NON-VACUITY for the table above: /weather/at consumes ONE tier, so the very
    same malformed body answers 200 when a different tier is asked for. Without
    this, a row asserting 502 could be passing for any reason at all."""
    resp = _get_weather_at(answering_tier, _mutate(shape), monkeypatch)
    assert resp.status_code == 200, (shape, answering_tier)
    assert resp.json()["resolution"] == answering_tier


def test_weather_at_wellformed_body_is_unchanged(monkeypatch):
    resp = _get_weather_at("current", copy.deepcopy(MOCK_ONECALL), monkeypatch)
    assert resp.status_code == 200
    assert resp.json()["summary"]["tempF"] == 61


# ── /weather/{checklist_id}: the historical body ──────────────────────────────
MOCK_CHECKLIST = {"obs_dt": "2024-05-01 06:30", "loc_name": "L", "lat": 40.0, "lng": -74.0, "duration_hrs": 1.0}

HIST_SHAPES = {
    "data empty list": {"data": []},
    "data missing": {},
    "data list of non-objects": {"data": ["x", None]},
    "temp non-numeric": {"data": [_hour(BASE_DT, temp="warm")]},
    "weather non-list": {"data": [_hour(BASE_DT, weather="sunny")]},
    "weather empty list": {"data": [_hour(BASE_DT, weather=[])]},
    "wind_speed null": {"data": [_hour(BASE_DT, wind_speed=None)]},
    "clouds string": {"data": [_hour(BASE_DT, clouds="lots")]},
    "sunrise absurd": {"data": [_hour(BASE_DT, sunrise=10 ** 20)]},
    "hour dt-only": {"data": [{"dt": BASE_DT}]},
    "body is a string": "nope",
    "body is a list": [1, 2, 3],
}


@pytest.mark.parametrize("shape", list(HIST_SHAPES))
def test_weather_checklist_malformed_historical_body_is_502_never_500(monkeypatch, shape):
    monkeypatch.setenv("OPENWEATHER_API_KEY", KEY)
    monkeypatch.setenv("EBIRD_API_KEY", KEY)
    with (
        patch("routers.weather.fetch_checklist", new=AsyncMock(return_value=dict(MOCK_CHECKLIST))),
        patch("routers.weather.fetch_historical", new=AsyncMock(return_value=HIST_SHAPES[shape])),
    ):
        resp = client.get("/weather/S123456")
    assert resp.status_code == 502, shape
    assert resp.json()["detail"] == W_CL_DETAIL
    assert KEY not in resp.text


# ── /weather/{checklist_id}: the checklist's OWN date ─────────────────────────
# eBird is a different upstream from the weather provider, so this gets its own
# honest detail: the weather detail would name a provider that was never called,
# and "Please try again" would promise a retry that is deterministic.
BAD_OBS_DT = ["2024-13-40 25:61", "", "not-a-date", "2024-05-01T12:00:00Z", None, 12345, "0000-00-00 00:00"]


@pytest.mark.parametrize("bad", BAD_OBS_DT)
def test_weather_checklist_unreadable_obs_dt_is_502_never_500(monkeypatch, bad):
    monkeypatch.setenv("OPENWEATHER_API_KEY", KEY)
    monkeypatch.setenv("EBIRD_API_KEY", KEY)
    cl = {**MOCK_CHECKLIST, "obs_dt": bad}
    with (
        patch("routers.weather.fetch_checklist", new=AsyncMock(return_value=cl)),
        patch("routers.weather.fetch_historical", new=AsyncMock(return_value={"data": [_hour(BASE_DT)]})) as hist,
    ):
        resp = client.get("/weather/S123456")
    assert resp.status_code == 502, bad
    assert resp.json()["detail"] == W_DATE_DETAIL
    assert KEY not in resp.text
    # The weather provider is never called for a checklist we cannot date.
    hist.assert_not_called()


def test_weather_checklist_wellformed_is_unchanged(monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", KEY)
    monkeypatch.setenv("EBIRD_API_KEY", KEY)
    with (
        patch("routers.weather.fetch_checklist", new=AsyncMock(return_value=dict(MOCK_CHECKLIST))),
        patch("routers.weather.fetch_historical", new=AsyncMock(return_value={"data": [_hour(BASE_DT)]})),
    ):
        resp = client.get("/weather/S123456")
    assert resp.status_code == 200
    assert resp.json()["obs_dt"] == "2024-05-01 06:30"
    assert "Temperature:" in resp.json()["formatted"]


# ── /tide/at and /tide/{checklist_id} ────────────────────────────────────────
MOCK_STATION = {"id": "9410230", "name": "La Jolla", "lat": 32.87, "lng": -117.26, "state": "CA", "obs": True}
OBS_BODY = {"error": {"message": "no data"}}
PRED_BODY = {"predictions": [
    {"t": "2024-05-01 11:30", "v": "3.10"}, {"t": "2024-05-01 12:00", "v": "3.40"},
    {"t": "2024-05-01 12:30", "v": "3.70"}]}
HILO_BODY = {"predictions": [
    {"t": "2024-05-01 09:00", "v": "0.50", "type": "L"}, {"t": "2024-05-01 15:00", "v": "5.20", "type": "H"}]}

TIDE_SHAPES = {
    "observed list of non-objects": ({"data": ["x", None, 5]}, PRED_BODY, HILO_BODY),
    "continuous list of non-objects": (OBS_BODY, {"predictions": ["x", None, 5]}, HILO_BODY),
    "high/low list of non-objects": (OBS_BODY, PRED_BODY, {"predictions": ["x", None, 5]}),
    "continuous predictions a string": (OBS_BODY, {"predictions": "nope"}, HILO_BODY),
    "high/low predictions a string": (OBS_BODY, PRED_BODY, {"predictions": "nope"}),
    # F1's ZeroDivisionError half: two sentinel epochs give interp_level a zero
    # divisor. Containment is what closes it (pipeline/tide-timezone-parse).
    "two impossible-calendar high/low times": (
        OBS_BODY, {"predictions": []},
        {"predictions": [{"t": "2024-13-40 25:61", "v": "0.50", "type": "L"},
                         {"t": "0000-00-00 00:00", "v": "5.20", "type": "H"}]}),
}
TIDE_PARAMS = {"lat": 32.87, "lng": -117.26, "dt": "2024-05-01 12:00"}
TIDE_CHECKLIST = {"obs_dt": "2024-05-01 12:00", "loc_name": "L", "lat": 32.87, "lng": -117.26, "duration_hrs": 1.0}


@pytest.mark.parametrize("shape", list(TIDE_SHAPES))
def test_tide_at_malformed_body_is_unavailable_never_500(shape):
    obs, pred, hilo = TIDE_SHAPES[shape]
    with (
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 1.2)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(obs, pred, hilo))),
    ):
        resp = client.get("/tide/at", params=TIDE_PARAMS)
    assert resp.status_code == 200, shape
    assert resp.json() == {"status": "unavailable"}


@pytest.mark.parametrize("shape", list(TIDE_SHAPES))
def test_tide_checklist_malformed_body_is_unavailable_never_500(monkeypatch, shape):
    monkeypatch.setenv("EBIRD_API_KEY", KEY)
    obs, pred, hilo = TIDE_SHAPES[shape]
    with (
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 1.2)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(obs, pred, hilo))),
        patch("routers.tide.fetch_checklist", new=AsyncMock(return_value=dict(TIDE_CHECKLIST))),
    ):
        resp = client.get("/tide/S123456")
    assert resp.status_code == 200, shape
    assert resp.json()["status"] == "unavailable"
    assert KEY not in resp.text


# ONLY FOUR of the seven shapes reach a raise on the tide path, and the split is
# MEASURED rather than carried over: normalize_obs_dt raises on a non-string and
# shift_local on an impossible calendar value, but '', 'not-a-date' and an ISO
# string with a trailing 'Z' pass through BOTH helpers and yield a window string
# the route then queries NOAA with quite happily. Reusing the weather route's
# list here asserts more than containment can deliver -- the same "the shapes do
# not transfer verbatim" trap the brief names for the plan suites, one route over.
TIDE_RAISING_OBS_DT = ["2024-13-40 25:61", "0000-00-00 00:00", None, 12345]
TIDE_SILENT_OBS_DT = ["", "not-a-date", "2024-05-01T12:00:00Z"]


@pytest.mark.parametrize("bad", TIDE_RAISING_OBS_DT)
def test_tide_checklist_unreadable_obs_dt_is_unavailable_never_500(monkeypatch, bad):
    """The tide twin of the weather obs_dt row above. The honest state here is the
    route's OWN existing soft state, not a 502 -- the same asymmetry the provider-
    body rows carry, because each route keeps the honest state it already has."""
    monkeypatch.setenv("EBIRD_API_KEY", KEY)
    cl = {**TIDE_CHECKLIST, "obs_dt": bad}
    with (
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 1.2)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(OBS_BODY, PRED_BODY, HILO_BODY))) as ft,
        patch("routers.tide.fetch_checklist", new=AsyncMock(return_value=cl)),
    ):
        resp = client.get("/tide/S123456")
    assert resp.status_code == 200, bad
    assert resp.json()["status"] == "unavailable"
    assert KEY not in resp.text
    ft.assert_not_called()


@pytest.mark.parametrize("bad", TIDE_SILENT_OBS_DT)
def test_tide_checklist_unparseable_obs_dt_still_answers_ok_out_of_scope(monkeypatch, bad):
    """PINNED, and deliberately OUT of scope. These three dates are unreadable and
    NOTHING RAISES on them: normalize_obs_dt/shift_local pass them through, the
    route queries NOAA with a nonsense window, and the bracketing logic returns a
    perfectly well-formed reading built on it. A `try` catches nothing here, so
    this build cannot close it -- the exact shape of F1's silently-wrong half in
    pipeline/tide-timezone-parse/security-report.md, arriving from the checklist's
    date rather than from the provider's. Recorded as a row rather than left
    unstated so it reads as a measured decision, not an oversight; if one of these
    ever starts raising, this goes red and sends the reader to decisions.md."""
    monkeypatch.setenv("EBIRD_API_KEY", KEY)
    cl = {**TIDE_CHECKLIST, "obs_dt": bad}
    with (
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 1.2)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(OBS_BODY, PRED_BODY, HILO_BODY))),
        patch("routers.tide.fetch_checklist", new=AsyncMock(return_value=cl)),
    ):
        resp = client.get("/tide/S123456")
    assert resp.status_code == 200, bad
    assert resp.json()["status"] == "ok"
    assert KEY not in resp.text


def test_tide_wellformed_bodies_are_unchanged(monkeypatch):
    monkeypatch.setenv("EBIRD_API_KEY", KEY)
    with (
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 1.2)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(OBS_BODY, PRED_BODY, HILO_BODY))),
    ):
        at = client.get("/tide/at", params=TIDE_PARAMS)
    assert at.status_code == 200 and at.json()["status"] == "ok"
    assert at.json()["reading"]["trend"] == "rising"
    with (
        patch("routers.tide.nearest_station", return_value=(MOCK_STATION, 1.2)),
        patch("routers.tide.fetch_tides", new=AsyncMock(return_value=(OBS_BODY, PRED_BODY, HILO_BODY))),
        patch("routers.tide.fetch_checklist", new=AsyncMock(return_value=dict(TIDE_CHECKLIST))),
    ):
        cl = client.get("/tide/S123456")
    assert cl.status_code == 200 and cl.json()["status"] == "ok"
