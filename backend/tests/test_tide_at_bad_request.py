"""The `dt` REQUEST PARAMETER boundary on the two single-moment routes.

`GET /tide/at` had no validation of the moment it was asked about, where its
sibling `GET /weather/at` has had one since 0.5.34. Measured at v1.0.31 over the
32-shape roster in frontend/src/lib/wallClock.fixture.json, driving the real
route with the provider seams doubled: **8 shapes answered a plain-text HTTP
500**, one answered a mis-worded 502 blaming NOAA for a value that never reached
NOAA, and the remaining 23 answered 200 -- several of them carrying a confident
water level for a moment nobody asked about. Every row here was watched failing
against that code before the guard was written.

THIS FILE IS THE BACKEND HALF OF A TWO-RUNTIME PAIR. Its twin is
frontend/src/lib/tideAtBadRequest.test.ts, and both drive the same roster from
the same fixture. Single-sourcing the refusal SENTENCE stops the two copies
drifting; it does nothing to stop one side's ENFORCEMENT being dropped
(.claude/rules/security.md, v1.0.20), so the route rows below fail when THIS
runtime's guard is removed and the TS rows fail when that one's is -- neither
covers the other.

Scope fence, restated because the neighbouring build is one function away: this
file is about the CALLER's `dt`. NOAA's own `t` in the response body -- the
`0.0` sentinel in `_epoch_min` and `interp_level`'s divisor -- is the next
build's subject and nothing here touches it.
"""

import copy
import json
import re
import zoneinfo
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from main import app
from services.wall_clock import (
    BAD_DT_DETAIL,
    TIDE_WINDOW_MARGIN_HOURS,
    is_blank_wall_clock,
    parse_wall_clock,
    wall_clock_text,
)

client = TestClient(app, raise_server_exceptions=False)

FIXTURE = json.loads(
    (
        Path(__file__).resolve().parents[2]
        / "frontend" / "src" / "lib" / "wallClock.fixture.json"
    ).read_text(encoding="utf-8")
)


def _dt(row: dict):
    """The row's `dt`, with the fixture's `padX` recipe applied."""
    dt = row["dt"]
    pad = row.get("padX")
    return dt if pad is None else dt + ("x" * pad)


ROSTER = FIXTURE["roster"]
SEPARATORS = FIXTURE["separators"]

STATION = {"id": "9410230", "name": "La Jolla", "lat": 32.87, "lng": -117.26, "state": "CA", "obs": True}
OBS_BODY = {"error": {"message": "no data"}}
PRED_BODY = {"predictions": [
    {"t": "2024-05-01 11:30", "v": "3.10"},
    {"t": "2024-05-01 12:00", "v": "3.40"},
    {"t": "2024-05-01 12:30", "v": "3.70"},
]}
HILO_BODY = {"predictions": [
    {"t": "2024-05-01 09:00", "v": "0.50", "type": "L"},
    {"t": "2024-05-01 15:00", "v": "5.20", "type": "H"},
]}

# A minimal One Call body: `current` only, so /weather/at's Current tier answers
# and a far-future target answers `out-of-range` rather than a provider error.
ONECALL = {
    "current": {
        "dt": 1714564800, "temp": 71, "humidity": 60, "dew_point": 50,
        "wind_speed": 5, "wind_deg": 270, "clouds": 10,
        "weather": [{"id": 800, "description": "clear sky"}],
        "sunrise": 1714564800 - 20000, "sunset": 1714564800 + 20000,
    },
    "hourly": [], "daily": [],
}

NOAA_DATE_RE = re.compile(r"^[0-9]{8} [0-9]{2}:[0-9]{2}$")


def _tide(dt, lat=32.87, lng=-117.26, **extra):
    """Drive GET /tide/at, recording every outbound NOAA window."""
    windows = []

    async def fake_fetch_tides(station, begin, end, hilo_begin, hilo_end):
        windows.append((begin, end, hilo_begin, hilo_end))
        return (OBS_BODY, PRED_BODY, HILO_BODY)

    params = {"lat": lat, "lng": lng, **extra}
    if dt is not None:
        params["dt"] = dt
    with (
        patch("routers.tide.nearest_station", return_value=(STATION, 1.2)),
        patch("routers.tide.fetch_tides", new=fake_fetch_tides),
    ):
        resp = client.get("/tide/at", params=params)
    return resp, windows


def _weather(dt, monkeypatch):
    """Drive GET /weather/at, recording every outbound OpenWeather call."""
    calls = []

    async def fake_fetch_forecast(lat, lng):
        calls.append((lat, lng))
        return copy.deepcopy(ONECALL)

    monkeypatch.setenv("OPENWEATHER_API_KEY", "k")
    params = {"lat": 32.87, "lng": -117.26}
    if dt is not None:
        params["dt"] = dt
    with patch("routers.weather.fetch_forecast", new=fake_fetch_forecast):
        resp = client.get("/weather/at", params=params)
    return resp, calls


# ── The roster, through the real routes ──────────────────────────────────────

@pytest.mark.parametrize("row", ROSTER, ids=[r["name"] for r in ROSTER])
def test_tide_at_roster(row):
    dt = _dt(row)
    resp, windows = _tide(dt)

    if row["tide"] == "refused":
        # HTTP 400 with /weather/at's existing sentence, and -- the
        # CHECKLIST_ID_RE posture -- ZERO NOAA requests: the guard is the
        # handler's first act, before any outbound call.
        assert resp.status_code == 400, f"{row['name']}: {resp.text[:120]}"
        assert resp.json()["detail"] == FIXTURE["badDtMessage"]
        assert windows == []
        return

    assert resp.status_code == 200, f"{row['name']}: {resp.text[:120]}"
    assert len(windows) == 1
    begin, end, hilo_begin, hilo_end = windows[0]
    # Whatever the verdict, an ACCEPTED moment produces a well-formed NOAA
    # window. The blank rows are the shipped-but-broken Current path on the
    # desktop twin; on this transport they have always been correct, and this
    # row is what keeps them so.
    for value in (begin, end, hilo_begin, hilo_end):
        assert NOAA_DATE_RE.fullmatch(value), f"{row['name']}: {value!r}"
    if row["tide"] == "ok":
        canonical = row["canonical"]
        assert begin == f"{canonical[0:4]}{canonical[5:7]}{canonical[8:10]} {canonical[11:16]}"


@pytest.mark.parametrize("row", ROSTER, ids=[r["name"] for r in ROSTER])
def test_weather_at_roster(row, monkeypatch):
    dt = _dt(row)
    resp, calls = _weather(dt, monkeypatch)

    if row["weather"] == "refused":
        assert resp.status_code == 400, f"{row['name']}: {resp.text[:120]}"
        assert resp.json()["detail"] == FIXTURE["badDtMessage"]
        assert calls == []
        return

    assert resp.status_code == 200, f"{row['name']}: {resp.text[:120]}"
    assert len(calls) == 1


def test_no_malformed_dt_ever_yields_a_tide_reading():
    """Spec item 5: no refused moment may produce a `status: "ok"` reading, and
    none of its text may reach the copy block a user pastes into a public eBird
    checklist. Asserted over the whole refused set at once, so a future row that
    slipped through a per-row assertion still lands here."""
    for row in ROSTER:
        if row["tide"] != "refused":
            continue
        resp, _ = _tide(_dt(row))
        body = resp.json()
        assert body.get("status") != "ok", row["name"]
        assert "formatted" not in body, row["name"]
        assert "Water level" not in resp.text, row["name"]


def test_the_refusal_echoes_nothing_of_the_request_or_the_providers():
    """A refusal is a NEW ERROR PATH, and error paths are where keys, provider
    text and coordinates leak. The detail is a fixed module constant with no
    interpolation; this asserts the property at the wire rather than by reading
    the source."""
    hostile = "2026-01-01 12:00&station=EVIL#../../etc/passwd"
    resp, windows = _tide(hostile)
    assert resp.status_code == 400
    assert resp.json() == {"detail": BAD_DT_DETAIL}
    assert windows == []
    for leak in ("EVIL", "passwd", "32.87", "-117.26", "tidesandcurrents", "9410230"):
        assert leak not in resp.text, leak


def test_a_refused_dt_never_reaches_the_timezone_lookup():
    """The refusal precedes `get_timezone`, which is the one call the two `/at`
    handlers make before their provider and is where an out-of-range coordinate
    raises today (at-route-try-containment decision 11, still open). A guard
    placed after it would inherit that 500 for a request it was about to
    refuse anyway."""
    with patch("routers.tide.get_timezone", side_effect=AssertionError("must not be reached")):
        resp, windows = _tide("2024-13-01 12:00")
    assert resp.status_code == 400
    assert windows == []


def test_force_does_not_bypass_the_refusal():
    """`force` overrides the too-far / outside-US NOTICE, not the request
    boundary. A user tapping the override must not be able to ask for a moment
    the route has already refused."""
    resp, windows = _tide("2024-13-01 12:00", force="1")
    assert resp.status_code == 400
    assert windows == []


@pytest.mark.parametrize("dt", [None, ""], ids=["absent", "empty string"])
def test_blank_dt_resolves_now_in_the_locations_timezone(dt):
    """Spec item 4, and the invariant DECISIONS.md:2216 and PRODUCT_CONTEXT.md:384
    both record. Asserted on the OUTBOUND window rather than on the response, so
    it cannot pass by the doubled seam answering regardless of the date."""
    zone = zoneinfo.ZoneInfo("Pacific/Kiritimati")
    with patch("routers.tide.get_timezone", return_value=zone):
        resp, windows = _tide(dt)
    assert resp.status_code == 200
    begin = windows[0][0]
    assert NOAA_DATE_RE.fullmatch(begin), repr(begin)
    assert begin == datetime.now(zone).strftime("%Y%m%d %H:%M")[:11] + begin[11:]
    assert begin[:8] == datetime.now(zone).strftime("%Y%m%d")


def test_blank_dt_reads_the_LOCATION_clock_and_not_a_fixed_one():
    """Non-vacuity for the row above, with no dependence on what time it
    happens to be. Kiritimati is UTC+14 and Niue is UTC-11 -- 25 hours apart --
    so their local dates ALWAYS differ. A route that read the server's clock,
    or the caller's, would answer the same day for both."""
    begins = []
    for name in ("Pacific/Kiritimati", "Pacific/Niue"):
        with patch("routers.tide.get_timezone", return_value=zoneinfo.ZoneInfo(name)):
            _, windows = _tide(None)
        begins.append(windows[0][0][:8])
    assert begins[0] != begins[1], begins


# ── The separator rows: shapes chosen to tell the two implementations apart ──

@pytest.mark.parametrize("row", SEPARATORS, ids=[r["name"] for r in SEPARATORS])
def test_separator_rows(row):
    """HAND-WRITTEN rows, kept beside the roster rather than in it. Each names
    the mechanism by which the two languages would disagree if the predicate
    were written the obvious way; the roster's generated agreement cannot see
    any of them."""
    dt = _dt(row)
    for margin, expected in ((0, row["margin0"]), (TIDE_WINDOW_MARGIN_HOURS, row["margin25"])):
        got = parse_wall_clock(dt, margin)
        if expected == "refused":
            assert got is None, f"{row['name']} @{margin}h: {got!r} -- {row['mechanism']}"
        else:
            assert got is not None, f"{row['name']} @{margin}h -- {row['mechanism']}"
            if "canonical" in row:
                assert wall_clock_text(got) == row["canonical"]


@pytest.mark.parametrize("row", FIXTURE["tighteningsOverTheReplacedWeatherGuard"],
                         ids=[r["name"] for r in FIXTURE["tighteningsOverTheReplacedWeatherGuard"]])
def test_tightenings_over_the_replaced_weather_guard(row, monkeypatch):
    """The `/weather/at` guard this build replaced was LENIENT in three ways its
    desktop twin could not follow, and the 32-shape roster structurally could
    not see any of them. Each row asserts BOTH directions as a measurement: the
    replaced expression really did accept the string (and to the moment named),
    and the shipped predicate refuses it on both routes.

    A differential sweep over 80,504 generated strings found 67 such shapes and
    ZERO in the other direction -- nothing the new predicate accepts was refused
    before. The full derivation is in decisions.md section 6."""
    dt = _dt(row)

    # Direction 1: the replaced expression, spelled exactly as routers/weather.py
    # carried it from 0.5.34 to v1.0.31, accepted this and resolved it correctly.
    replaced = None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            replaced = datetime.strptime(dt, fmt)
            break
        except ValueError:
            continue
    assert replaced is not None, f"{row['name']}: the replaced guard did NOT accept this"
    assert wall_clock_text(replaced) == row["pythonAccepted"]

    # Direction 2: the shipped predicate refuses it, and so do both routes.
    assert parse_wall_clock(dt) is None
    resp, calls = _weather(dt, monkeypatch)
    assert resp.status_code == 400
    assert calls == []
    resp, windows = _tide(dt)
    assert resp.status_code == 400
    assert windows == []


def test_the_tightenings_cover_every_category_the_sweep_found():
    """Guard the guard. The sweep's 67 strings fell into four categories; three
    are represented above and the fourth ("other" -- a one-digit month or day,
    or a space-padded day) is the same strptime-leniency mechanism as the
    one-digit minute row. Asserting the counts here keeps the table honest
    about what it is a sample OF."""
    rows = FIXTURE["tighteningsOverTheReplacedWeatherGuard"]
    assert len(rows) == 3
    assert {r["category"] for r in rows} == {
        "non-ASCII decimal digit",
        "non-space whitespace as the date/time separator",
        "one-digit hour or minute",
    }
    assert sum(r["sweepCount"] for r in rows) == 64  # of 67; the 4th category is 3


class _StubFinder:
    """Stands in for the module-level TimezoneFinder. Patched as the whole
    object rather than its method, because `TimezoneFinder.timezone_at` is
    read-only and `patch.object` on it raises."""

    def __init__(self, name):
        self._name = name

    def timezone_at(self, lat=None, lng=None):
        return self._name


@pytest.mark.parametrize("row", FIXTURE["zoneNames"], ids=[r["name"] for r in FIXTURE["zoneNames"]])
def test_zone_name_rows(row):
    """The timezone-NAME axis, which the 32-shape roster is blind to by
    construction: every roster row supplies a valid zone, because the roster
    varies `dt` and nothing else.

    F1 of the security review. The desktop "now" fallback this build ADDED threw
    a status-less RangeError on an empty zone name -- `isOfflineError` reads that
    as true, so the panel claimed the device was offline while online, four lines
    from the refusal that carries `status: 400` precisely so it does not. This
    runtime could not do it (`or "UTC"` has always been there), which is what
    made it a twin divergence rather than a shared bug, and is why the fix
    belongs at the seam on both sides.

    This half asserts the SEAM's contract: whatever name the finder produces,
    `get_timezone` returns a usable tzinfo and never raises."""
    from formatters import weather as weather_fmt

    with patch.object(weather_fmt, "_tf", _StubFinder(row["tz"] or None)):
        tz = weather_fmt.get_timezone(32.87, -117.26)
    assert str(tz) == row["resolvesTo"], row["name"]
    # Usable, not merely constructed: the route calls datetime.now(tz) on it.
    assert datetime.now(tz).utcoffset() is not None


def test_get_timezone_never_raises_on_any_name_the_finder_could_return():
    """The other half of F1's class, and the reason the seam default alone is
    not the whole fix. An EMPTY name is tzf-rs's documented uncovered-point
    return and Python's `or "UTC"` already handled it; a name the runtime's tz
    DATABASE does not know is a different case and reaches both runtimes.

    It is a real risk rather than a defensive one: `timezonefinder` ships its own
    tzdb-derived polygon data and `zoneinfo` reads the system tzdb, so a zone
    added in one and absent from the other (America/Ciudad_Juarez, tzdata 2022g,
    is the standing example) resolves here and raises. `get_timezone` sits
    OUTSIDE every route's try, so that was a plain-text 500."""
    from formatters import weather as weather_fmt

    for name in ("", None, "Ocean/Nowhere", "America/Ciudad_Juarez_Nonexistent", "Not/A/Zone"):
        with patch.object(weather_fmt, "_tf", _StubFinder(name)):
            tz = weather_fmt.get_timezone(32.87, -117.26)
        assert str(tz) == FIXTURE["fallbackZone"], name
        assert datetime.now(tz).utcoffset() is not None


def test_an_uncovered_coordinate_still_answers_tide_at_rather_than_failing():
    """The route-level consequence, which is the one a user meets: an in-range
    coordinate over open water. `at-route-try-containment` decision 11 (the PR's
    deferral 4) does NOT cover this -- that one is about coordinate RANGE, and
    this coordinate is perfectly in range."""
    from formatters import weather as weather_fmt

    # `force=1` because an open-water point is legitimately `outside-us`, and
    # that notice returns before any NOAA call -- which would make this row pass
    # for the wrong reason. Forcing it drives the whole pipeline, which is where
    # the timezone lookup's result actually gets used.
    with patch.object(weather_fmt, "_tf", _StubFinder(None)):
        resp, windows = _tide(None, lat=0.0, lng=-140.0, force="1")
    assert resp.status_code == 200
    assert len(windows) == 1
    assert NOAA_DATE_RE.fullmatch(windows[0][0])


def test_zone_name_rows_are_not_vacuous():
    """Guard the guard, the twin of the frontend assertion: the table must hold
    both rows that fall back and rows that pass through, or it would pass
    against a seam that answered UTC for every coordinate on earth."""
    rows = FIXTURE["zoneNames"]
    fell_back = [r for r in rows if r["resolvesTo"] == FIXTURE["fallbackZone"] and r["tz"] != FIXTURE["fallbackZone"]]
    passed_through = [r for r in rows if r["resolvesTo"] == r["tz"]]
    assert len(fell_back) >= 2
    assert len(passed_through) >= 2
    assert any(r["tz"] != FIXTURE["fallbackZone"] for r in passed_through)


def test_separator_rows_are_not_vacuous():
    """Guard the guard: the separator table must actually contain both verdicts
    in both margin columns, or a predicate that refused (or accepted)
    everything would satisfy it."""
    assert {r["margin0"] for r in SEPARATORS} == {"ok", "refused"}
    assert {r["margin25"] for r in SEPARATORS} == {"ok", "refused"}
    assert any(r["margin0"] != r["margin25"] for r in SEPARATORS)


# ── The predicate's own contract ─────────────────────────────────────────────

def test_blank_is_none_or_empty_and_nothing_else():
    """The presence half is spelled `is None`, never truthiness: Python and
    JavaScript disagree about {} / [] / 0 / False / "" in two directions at
    once, so a twinned presence test names the empty string EXPLICITLY and
    leaves every other value to the validator (weather-at-malformed-parity
    decision 10). A query parameter is only ever `str | None`, so none of the
    other falsy values is reachable here -- which is exactly why the spelling,
    not the reachability, is what this row pins."""
    assert is_blank_wall_clock(None) is True
    assert is_blank_wall_clock("") is True
    for present in (" ", "0", "false", "[]", "{}", "null", "2024-05-01 12:00"):
        assert is_blank_wall_clock(present) is False, present


def test_the_pattern_is_explicit_ascii_and_full_match():
    """Structural pin for the two twinned-guard rules the roster cannot reach on
    its own: explicit `[0-9]`, never `\\d` (v0.5.54), and `fullmatch`, never a
    `$` that Python matches before a trailing newline (v0.5.87)."""
    from services import wall_clock
    src = _code_only(Path(wall_clock.__file__).read_text(encoding="utf-8"))
    pattern = wall_clock._WALL_CLOCK_RE.pattern
    assert "\\d" not in pattern, pattern
    assert "[0-9]" in pattern
    assert "fullmatch" in src
    # The behaviour the two structural halves buy, so this row is not purely a
    # source scan: a trailing newline and an Arabic-Indic digit each refuse.
    assert parse_wall_clock("2024-05-01 12:00\n") is None
    assert parse_wall_clock("٢٠٢٤-٠٥-٠١ 12:00") is None
    assert parse_wall_clock("2024-05-01 12:00") is not None


def _code_only(src: str) -> str:
    """Drop `#` comment tails before scanning source for a pattern.

    Not tidiness: both structural rows below scan for the STRING `\\d`, and the
    comments that explain why it is absent necessarily contain it. A raw text
    scan therefore fails a correct file -- the same trap `iosSceneManifest.test.ts`
    records for `project.yml`, whose own comment names the keys it asserts are
    missing. Quote-aware so a `#` inside a pattern literal is not a comment."""
    out = []
    for line in src.split("\n"):
        quote = None
        for i, ch in enumerate(line):
            if quote:
                if ch == "\\":
                    quote = quote  # escaped char; the next one is consumed below
                elif ch == quote:
                    quote = None
            elif ch in "\"'":
                quote = ch
            elif ch == "#":
                line = line[:i]
                break
        out.append(line)
    return "\n".join(out)


def test_shift_local_uses_an_explicit_ascii_class_too():
    """F2 of pipeline/tide-timezone-parse/security-report.md, closed for the
    half this build touches. `shift_local` is on the `dt` path and its `\\d`
    matched Arabic-Indic digits in Python where the TS twin's is ASCII-only, so
    the backend silently SUCCEEDED (shifting the clock) where the desktop twin
    fell through unchanged.

    `_clock` at services/tide.py:144 still carries `\\d` and is deliberately left
    open: its input is NOAA's response `t`, which is the NEXT build's subject
    and outside this one's fence. Named here so the sweep is on the record."""
    from services import tide as tide_service
    src = Path(tide_service.__file__).read_text(encoding="utf-8")
    shift_body = _code_only(src[src.index("def shift_local"):src.index("def to_noaa_date")])
    assert "\\d" not in shift_body, shift_body
    assert "[0-9]{4}" in shift_body
    assert tide_service.shift_local("٢٠٢٤-09-12 22:41", 1) == "٢٠٢٤-09-12 22:41"


def test_the_sentence_is_single_sourced_from_the_weather_route():
    """Byte-identical to the sentence /weather/at has carried since 0.5.34, and
    read from ONE constant so the two cannot drift."""
    assert BAD_DT_DETAIL == FIXTURE["badDtMessage"]
    weather_src = (Path(__file__).resolve().parents[1] / "routers" / "weather.py").read_text(encoding="utf-8")
    tide_src = (Path(__file__).resolve().parents[1] / "routers" / "tide.py").read_text(encoding="utf-8")
    for src in (weather_src, tide_src):
        assert "BAD_DT_DETAIL" in src
        assert FIXTURE["badDtMessage"] not in src, "the sentence is imported, never re-spelled"


def test_the_margin_is_the_widest_shift_the_tide_route_makes():
    """`TIDE_WINDOW_MARGIN_HOURS` is not a taste value: the route derives
    `end = start + 1h` and then asks NOAA for `shift_local(start, -24)` through
    `shift_local(end, +24)`, so 25 hours forward is the widest reach. Derived
    from the route at the moment the guard is written, per the rule that a guard
    naming a NUMBER is asserting that number."""
    assert TIDE_WINDOW_MARGIN_HOURS == 25
    tide_src = (Path(__file__).resolve().parents[1] / "routers" / "tide.py").read_text(encoding="utf-8")
    assert "shift_local(start, -24)" in tide_src
    assert "shift_local(end, 24)" in tide_src
    assert "shift_local(start, 1)" in tide_src
