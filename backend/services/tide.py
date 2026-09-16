"""Parse NOAA CO-OPS responses into a TideReading (web/Pi twin of
frontend/src/lib/tide.ts). Pure; no I/O."""

import re
from dataclasses import dataclass
from datetime import datetime, timedelta

from services.tide_instant import clock_text, place_epoch_min, place_instant


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
        t = d.get("t")
        v = _num(d.get("v"))
        if isinstance(t, str) and v is not None:
            out.append({"t": t, "v": v, "q": str(d.get("q", ""))})
    return out


def parse_predictions(body) -> list[dict]:
    if is_noaa_error(body) or not isinstance(body, dict):
        return []
    out = []
    for p in body.get("predictions") or []:
        t = p.get("t")
        v = _num(p.get("v"))
        if isinstance(t, str) and v is not None:
            out.append({"t": t, "v": v})
    return out


def parse_hilo(body) -> list[dict]:
    if is_noaa_error(body) or not isinstance(body, dict):
        return []
    out = []
    for p in body.get("predictions") or []:
        t = p.get("t")
        v = _num(p.get("v"))
        ty = p.get("type")
        if isinstance(t, str) and v is not None and ty in ("H", "L"):
            out.append({"t": t, "v": v, "type": ty})
    return out


def _in_window(t: str, start: str, end: str) -> bool:
    return start <= t <= end


def interp_level(t: str, sorted_hilo: list[dict]):
    """Linear-interpolate the predicted level at `t` between bracketing H/L
    events. None if the series doesn't bracket on at least one side.

    THE DIVISOR IS A BRACKETING PROBLEM, NOT A SENTINEL PROBLEM, and that is
    measured rather than argued. This function brackets on the STRING (the
    series sorts chronologically as text, which is all the bracketing needs) and
    divides on the EPOCH, so the old `prev["t"] == nxt["t"]` guard did not
    guarantee a non-zero divisor: two WELL-FORMED strings naming one instant --
    `2026-05-01 10:09` and `2026-05-01T10:09`, both admitted by the shared
    `[ T]` class -- raised `ZeroDivisionError` here and produced
    `Water level: -Infinity ft` on the desktop twin, which has nothing to throw.
    Filtering unplaceable points out upstream does nothing about them. So the
    equality guard sits on the PLACED epoch, exactly as `interp_at_epoch` /
    `interpAtEpoch` already do.

    Degrading to `prev["v"]` is the same answer the string-equality guard always
    gave for a zero span, extended to the two other ways a fraction can fail to
    exist. Both are reachable: `compute_tide_reading` filters the series so
    `prev` and `nxt` are always placeable, but `t` is the WINDOW string, which
    `/tide/{checklist_id}` derives from eBird's unvalidated `obs_dt`.
    """
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
        at = place_epoch_min(t)
        at_prev = place_epoch_min(prev["t"])
        at_nxt = place_epoch_min(nxt["t"])
        if at is None or at_prev is None or at_nxt is None or at_nxt == at_prev:
            return prev["v"]
        f = (at - at_prev) / (at_nxt - at_prev)
        return prev["v"] + (nxt["v"] - prev["v"]) * f
    return (prev or nxt)["v"]


def _clock(t: str) -> str:
    """A NOAA `t` as the block's clock. Twin of `clockTime`.

    Formats from the PLACED components; it no longer re-scans the string. The
    old unanchored `re.search(r"[ T](\\d{2}):(\\d{2})")` read `3:07pm` off
    `2026/05/01 15:07`, rendered `2026-13-40 25:61` as `1:61pm` -- sixty-one
    minutes past one, into a public checklist comment -- and its `\\d` matched
    Unicode decimal digits where the TS twin's did not, the open half of F2 from
    pipeline/tide-timezone-parse that build 4 handed on by name.

    The passthrough is this total function's boundary, not a second guard:
    `compute_tide_reading` labels only points that survived its placement
    filter, so an unplaceable string cannot reach the copy block through it. The
    deletion coverage for that filter is
    `test_tide_unreadable_parity.py::test_an_unplaceable_point_is_dropped`, and
    `test_no_dangling_clock_reaches_the_copy_block` is what fails if the
    property is ever re-opened here.
    """
    at = place_instant(t)
    return t if at is None else clock_text(at)


def compute_tide_reading(start, end, observed, predicted, hilo, station, distance_mi):
    # A `t` that cannot be placed on the epoch axis means that point is MISSING,
    # so it is dropped BEFORE any level is derived from it -- exactly as the
    # sibling Planner (`services/plan_tide.py`) already does, which is the
    # strongest available argument that "missing" is the right answer here too.
    # It is never anchored at 1970, never contributes an interpolation weight,
    # never ties for nearest, and never renders a clock. THIS FILTER IS THIS
    # SIDE'S PLACEMENT GUARD: removing it turns
    # test_tide_unreadable_parity.py::test_an_unplaceable_point_is_dropped red
    # here while the frontend suite stays green (v1.0.20).
    sh = sorted((h for h in hilo if place_instant(h["t"]) is not None), key=lambda p: p["t"])

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
            # Nearest to WHAT: both the candidates and the window's own start
            # have to be placeable for "nearest" to mean anything. Under the
            # sentinel every unplaceable candidate tied at distance-to-1970 and
            # `min` handed back the EARLIEST pooled point, presented as the
            # reading for now. `unavailable` is the honest state both routes
            # already have, and `min` still keeps the first on a tie, which is
            # what the TS twin's strict `<` reduce does.
            start_at = place_epoch_min(start)
            rankable = [(p, at) for p in pool
                        if (at := place_epoch_min(p["t"])) is not None]
            if start_at is None or not rankable:
                return None
            nearest = min(rankable, key=lambda pair: abs(pair[1] - start_at))[0]
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
    # `_clock` carried the last `\d` in this module's twinned guards and was
    # deliberately left open here, its input being NOAA's RESPONSE `t`. That
    # build has landed: `_clock` formats from the components `place_instant`
    # already validated and scans nothing at all, so both halves of F2 are
    # closed and this is now the only regex left in the module.
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
