"""The tide half of the Weather/tide Planner: the 30-minute curve and the
turning points over a span derived from `now` alone (tide-weather-planner,
schema sections 3.4 and 4.6). Twin of frontend/src/lib/tidePlan.ts; both are
driven from frontend/src/lib/weatherTidePlan.fixture.json and must produce
byte-identical documents.

Pure: `now_ts` is a parameter and nothing here reads a clock. Both NOAA bodies
pass through the shipped linear parsers unchanged; the only new step is the
GMT clock string to epoch conversion at the parse boundary (`gmt_epoch`, the
scan declared in schema section 9). The caps are applied BEFORE any per-sample
work, so a body larger than the request could produce bounds the work rather
than the work being bounded by trust in the provider.
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from services.tide import parse_hilo, parse_predictions
from services.tz_clock import (
    add_days, gmt_epoch, local_clock, local_date, local_midnight_ts, start_of_local_hour,
)

PLAN_TIDE_DAYS_AHEAD = 8
PLAN_CONTINUOUS_MAX = 4096
PLAN_HILO_MAX = 64
# Nine 24-hour days at 30 minutes is 432 samples and a fall-back day makes it
# 434, so the cap sits above the largest conforming shape rather than at it.
PLAN_CURVE_MAX = 448

_HALF_HOUR = 1800
_DAY = 86400


def plan_tide_range(now_ts: int, tz: ZoneInfo) -> dict:
    """The span the plan fetches, from the clock and the location alone (D2):
    the start of the current local hour through the end of the eighth calendar
    day after today, the high/low request widened a day each side."""
    axis_start_ts = start_of_local_hour(now_ts, tz)
    today = local_date(now_ts, tz)
    tide_end_ts = local_midnight_ts(add_days(today, PLAN_TIDE_DAYS_AHEAD + 1), tz) - 1
    return {
        "axisStartTs": axis_start_ts,
        "tideEndTs": tide_end_ts,
        "hiloStartTs": axis_start_ts - _DAY,
        "hiloEndTs": tide_end_ts + _DAY,
    }


def to_noaa_gmt_date(ts: int) -> str:
    """NOAA `begin_date` / `end_date` for a GMT request: 'YYYYMMDD HH:MM' in UTC."""
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y%m%d %H:%M")


def interp_at_epoch(t: int, points: list[dict]):
    """The predicted level at instant `t` on the high/low curve: the epoch
    twin of `interp_level`. prev = latest at or before, next = earliest at or
    after; linear on the time fraction; equal times give prev's value; one
    side missing gives that side's value; none gives None. The operation order
    `a + (b - a) * f` with `f` as one division is shared byte for byte with the
    TS twin."""
    if not points:
        return None
    prev = nxt = None
    for p in points:
        if p["t"] <= t:
            prev = p
        if p["t"] >= t:
            nxt = p
            break
    if prev is not None and nxt is not None:
        if prev["t"] == nxt["t"]:
            return prev["v"]
        f = (t - prev["t"]) / (nxt["t"] - prev["t"])
        return prev["v"] + (nxt["v"] - prev["v"]) * f
    side = prev if prev is not None else nxt
    return None if side is None else side["v"]


def build_tide_plan(pred_body, hilo_body, station: dict, distance_mi: float, tz: ZoneInfo, span: dict) -> dict:
    """Build the tide half from the two range bodies. `station` and
    `distance_mi` come from the bundled station list, never from a provider
    response."""
    continuous = []
    for p in parse_predictions(pred_body):
        t = gmt_epoch(p["t"])
        if t > 0:
            continuous.append({"t": t, "v": p["v"]})
    continuous.sort(key=lambda p: p["t"])
    del continuous[PLAN_CONTINUOUS_MAX:]

    turning_points = []
    for h in parse_hilo(hilo_body):
        t = gmt_epoch(h["t"])
        if t > 0 and span["hiloStartTs"] <= t <= span["hiloEndTs"]:
            turning_points.append({
                "kind": "high" if h["type"] == "H" else "low",
                "t": t,
                "v": h["v"],
                "local": local_clock(t, tz),
            })
    turning_points.sort(key=lambda p: p["t"])
    del turning_points[PLAN_HILO_MAX:]

    if not continuous and not turning_points:
        return {"status": "unavailable"}

    rng = {"startTs": span["axisStartTs"], "endTs": span["tideEndTs"]}
    curve = []
    i = 0
    first_t = -(-rng["startTs"] // _HALF_HOUR) * _HALF_HOUR
    t = first_t
    while t <= rng["endTs"] and len(curve) < PLAN_CURVE_MAX:
        while i < len(continuous) and continuous[i]["t"] < t:
            i += 1
        if i < len(continuous) and continuous[i]["t"] == t:
            curve.append({"t": t, "v": continuous[i]["v"], "hilo": False})
        else:
            v = interp_at_epoch(t, turning_points)
            if v is not None:
                curve.append({"t": t, "v": v, "hilo": True})
        t += _HALF_HOUR
    has_continuous_in_range = any(rng["startTs"] <= p["t"] <= rng["endTs"] for p in continuous)

    return {
        "status": "ok",
        "source": "predicted",
        "station": {"id": station["id"], "name": station["name"]},
        "distanceMi": distance_mi,
        "tz": str(tz),
        "continuous": has_continuous_in_range,
        "range": rng,
        "curve": curve,
        "turningPoints": turning_points,
    }
