"""Parse NOAA CO-OPS responses into a TideReading (web/Pi twin of
frontend/src/lib/tide.ts). Pure; no I/O."""

import re
from dataclasses import dataclass
from datetime import datetime, timedelta


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


def _epoch_min(t: str) -> float:
    """Calendar-correct epoch-minutes from 'YYYY-MM-DD HH:MM'."""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})", t)
    if not m:
        return 0.0
    y, mo, d, h, mi = (int(x) for x in m.groups())
    return datetime(y, mo, d, h, mi).timestamp() / 60.0


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
    n = normalize_obs_dt(local)
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})", n)
    if not m:
        return local
    y, mo, d, h, mi = (int(x) for x in m.groups())
    dt = datetime(y, mo, d, h, mi) + timedelta(hours=hours)
    return dt.strftime("%Y-%m-%d %H:%M")


def to_noaa_date(local: str) -> str:
    n = normalize_obs_dt(local)
    return f"{n[0:4]}{n[5:7]}{n[8:10]} {n[11:16]}"
