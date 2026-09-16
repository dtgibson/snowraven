"""Parse NOAA CO-OPS responses into a TideReading (web/Pi twin of
frontend/src/lib/tide.ts). Pure; no I/O."""

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


@dataclass
class HiLoLabeled:
    kind: str          # 'high' | 'low'
    v: float
    time_local: str


@dataclass
class TideReading:
    level_min: float
    level_max: float
    source: str        # 'observed' | 'predicted'
    trend: str         # 'rising' | 'falling'
    turned_during: bool
    prev_hl: HiLoLabeled | None
    next_hl: HiLoLabeled | None
    station: dict
    distance_mi: float


def is_noaa_error(body) -> bool:
    return isinstance(body, dict) and "error" in body


def _num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def parse_observed(body) -> list[dict]:
    if is_noaa_error(body) or not isinstance(body, dict):
        return []
    out = []
    for d in body.get("data") or []:
        v = _num(d.get("v"))
        if v is not None:
            out.append({"t": str(d.get("t", "")), "v": v, "q": str(d.get("q", ""))})
    return out


def parse_predictions(body) -> list[dict]:
    if is_noaa_error(body) or not isinstance(body, dict):
        return []
    out = []
    for p in body.get("predictions") or []:
        v = _num(p.get("v"))
        if v is not None:
            out.append({"t": str(p.get("t", "")), "v": v})
    return out


def parse_hilo(body) -> list[dict]:
    if is_noaa_error(body) or not isinstance(body, dict):
        return []
    out = []
    for p in body.get("predictions") or []:
        v = _num(p.get("v"))
        ty = p.get("type")
        if v is not None and ty in ("H", "L"):
            out.append({"t": str(p.get("t", "")), "v": v, "type": ty})
    return out


def _in_window(t: str, start: str, end: str) -> bool:
    return start <= t <= end


# Explicit ASCII classes, never `\d`: Python's `\d` matches every Unicode decimal
# digit and `int()` parses one happily, while the TS twin's `\d` is ASCII-only
# (the v0.5.54 character-class rule for twinned guards). Anchored and fixed-width
# with no alternation, so a hostile provider string matches or fails inside the
# first 16 characters.
_LST_RE = re.compile(r"^([0-9]{4})-([0-9]{2})-([0-9]{2})[ T]([0-9]{2}):([0-9]{2})")


def _epoch_min(t: str) -> float:
    """Epoch-minutes for a NOAA `lst_ldt` wall-clock string, read on a fixed UTC
    axis; 0.0 for a string that does not match and for an impossible calendar
    value. Twin of `epochMin` in frontend/src/lib/tide.ts.

    NOT calendar-correct, which this docstring claimed until 2026-09-15. The
    string is the STATION's local clock and is read here as though it were UTC,
    so a wall-clock 01:00 -> 03:00 span at a station crossing its own DST
    transition measures 120 minutes where 180 actually elapsed. That is the
    contract rather than an oversight: both consumers (`interp_level`'s
    interpolation fraction, the nearest-point `min` below) take only
    DIFFERENCES between two of these values, and reading every string on one
    fixed axis is what makes a difference equal the CALENDAR difference of the
    two wall clocks on every machine. Re-parsing in the station's real zone
    would give true elapsed time and is a separate, deliberately deferred
    decision -- pipeline/tide-timezone-parse/decisions.md and ROADMAP.md carry
    the evidence, the reversal condition and the exact change.

    `tzinfo=timezone.utc` is load-bearing. A naive `datetime(...).timestamp()`
    resolves in the SERVER PROCESS's zone, so the same string read differently
    on two machines: the span above measured 180 minutes on a US/Pacific server
    against 120 on a UTC one, and the checklist tide then rendered
    `Water level: 1.0 - 5.0 ft` where the correct figure is `1.5 - 4.5 ft`. It
    also removes an uncaught raise -- the naive call raises `year 0 is out of
    range` near the calendar's start, out of a `compute_tide_reading` that sits
    outside the routes' `try`.
    """
    m = _LST_RE.match(t)
    if not m:
        return 0.0
    y, mo, d, h, mi = (int(x) for x in m.groups())
    try:
        return datetime(y, mo, d, h, mi, tzinfo=timezone.utc).timestamp() / 60.0
    except ValueError:
        return 0.0


def interp_level(t: str, sorted_hilo: list[dict]):
    """Linear-interpolate the predicted level at `t` between bracketing H/L
    events. None if the series doesn't bracket on at least one side."""
    if not sorted_hilo:
        return None
    prev = nxt = None
    for h in sorted_hilo:
        if h["t"] <= t:
            prev = h
        if h["t"] >= t:
            nxt = h
            break
    if prev and nxt:
        if prev["t"] == nxt["t"]:
            return prev["v"]
        f = (_epoch_min(t) - _epoch_min(prev["t"])) / (_epoch_min(nxt["t"]) - _epoch_min(prev["t"]))
        return prev["v"] + (nxt["v"] - prev["v"]) * f
    return (prev or nxt)["v"]


def _clock(t: str) -> str:
    m = re.search(r"[ T](\d{2}):(\d{2})", t)
    if not m:
        return t
    h = int(m.group(1))
    ap = "pm" if h >= 12 else "am"
    h = h % 12 or 12
    return f"{h}:{m.group(2)}{ap}"


def compute_tide_reading(start, end, observed, predicted, hilo, station, distance_mi):
    sh = sorted(hilo, key=lambda p: p["t"])

    # Level samples over the window, in priority order: observed gauge points,
    # continuous predictions (reference stations), else interpolated from the
    # high/low curve (subordinate stations, which serve only hilo).
    obs_in = [p for p in observed if _in_window(p["t"], start, end)]
    pred_in = [p for p in predicted if _in_window(p["t"], start, end)]
    if obs_in:
        pts = sorted(obs_in, key=lambda p: p["t"])
        source = "observed"
        start_v, end_v = pts[0]["v"], pts[-1]["v"]
    elif pred_in:
        pts = sorted(pred_in, key=lambda p: p["t"])
        source = "predicted"
        start_v, end_v = pts[0]["v"], pts[-1]["v"]
    else:
        s = interp_level(start, sh)
        e = interp_level(end, sh)
        if s is None and e is None:
            pool = ([dict(p, src="observed") for p in observed] if observed
                    else [dict(p, src="predicted") for p in predicted])
            if not pool:
                return None
            nearest = min(pool, key=lambda p: abs(_epoch_min(p["t"]) - _epoch_min(start)))
            pts, source = [nearest], nearest["src"]
            start_v = end_v = nearest["v"]
        else:
            source = "predicted"
            start_v = s if s is not None else e
            end_v = e if e is not None else s
            inside = [{"t": h["t"], "v": h["v"]} for h in sh if _in_window(h["t"], start, end)]
            pts = sorted([{"t": start, "v": start_v}, *inside, {"t": end, "v": end_v}], key=lambda p: p["t"])

    level_min = min(p["v"] for p in pts)
    level_max = max(p["v"] for p in pts)

    prev = next((h for h in reversed(sh) if h["t"] <= start), None)
    nxt = next((h for h in sh if h["t"] >= end), None)
    turned = any(_in_window(h["t"], start, end) for h in sh)

    delta = end_v - start_v
    if delta > 0:
        trend = "rising"
    elif delta < 0:
        trend = "falling"
    elif nxt:
        trend = "rising" if nxt["type"] == "H" else "falling"
    elif prev:
        trend = "falling" if prev["type"] == "H" else "rising"
    else:
        trend = "rising"

    def lab(h):
        return None if h is None else HiLoLabeled("high" if h["type"] == "H" else "low", h["v"], _clock(h["t"]))

    return TideReading(level_min, level_max, source, trend, turned, lab(prev), lab(nxt), station, distance_mi)


# ── Local-time window helpers (mirror tide.ts) ────────────────────────────────

def normalize_obs_dt(obs_dt: str) -> str:
    s = obs_dt.strip()
    return f"{s} 00:00" if len(s) == 10 else s[:16]


def shift_local(local: str, hours: float) -> str:
    # Explicit ASCII `[0-9]`, never `\d`, for the same reason as `_LST_RE` above
    # and now stated at both sites: Python's `\d` matches every Unicode decimal
    # digit and `int()` parses it, while the TS twin `shiftLocal`'s is
    # ASCII-only -- so `٢٠٢٤-٠٥-٠١ 12:00` SHIFTED here (to `2024-05-01 13:00`)
    # and fell through the twin's `if (!m) return local` passthrough. Closing
    # F2 of pipeline/tide-timezone-parse/security-report.md for this half:
    # `/tide/at` can no longer reach it at all now that its `dt` is validated at
    # the route, but `/tide/{checklist_id}` still feeds eBird's `obs_dt` here
    # unvalidated, and on that path the two transports now agree.
    #
    # `_clock` at line 144 still carries `\d` and is deliberately left open: its
    # input is NOAA's RESPONSE `t`, which is the next build's subject.
    n = normalize_obs_dt(local)
    m = re.match(r"^([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2})", n)
    if not m:
        return local
    y, mo, d, h, mi = (int(x) for x in m.groups())
    dt = datetime(y, mo, d, h, mi) + timedelta(hours=hours)
    return dt.strftime("%Y-%m-%d %H:%M")


def to_noaa_date(local: str) -> str:
    n = normalize_obs_dt(local)
    return f"{n[0:4]}{n[5:7]}{n[8:10]} {n[11:16]}"
