"""Nearest-NOAA-station resolution for the tide route (web/Pi twin of
frontend/src/lib/tideStations.ts). Loads the same bundled US-only station list
and does haversine + a coarse US-region test, all offline."""

import json
import math
import os
from functools import lru_cache

_DATA = os.path.join(os.path.dirname(os.path.dirname(__file__)), "staticdata", "noaa_tide_stations.json")

TIDE_MAX_MILES = 25

# Coarse US bounding boxes [west, south, east, north] — mirror the build script
# and the TS lib. Distinguish "outside the US" from "far inland in the US".
_US_BOXES = [
    (-125.1, 24.2, -66.7, 49.5),
    (-179.5, 51.0, -129.0, 71.5),
    (172.0, 51.0, 180.0, 53.5),
    (-160.5, 18.5, -154.5, 22.6),
    (-67.5, 17.6, -64.5, 18.6),
    (144.5, 13.0, 145.9, 15.3),
    (-171.2, -14.5, -169.3, -13.2),
]


@lru_cache(maxsize=1)
def _stations() -> list[dict]:
    with open(_DATA, encoding="utf-8") as f:
        return json.load(f)["stations"]


def is_in_us(lat: float, lng: float) -> bool:
    return any(w <= lng <= e and s <= lat <= n for (w, s, e, n) in _US_BOXES)


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 3958.8
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def nearest_station(lat: float, lng: float, prefer_obs: bool = False, obs_within_mi: float = 10.0):
    """Return (station_dict, distance_mi) or None. Biases toward gauge stations
    when one is within obs_within_mi of the overall nearest."""
    stations = _stations()
    if not stations:
        return None
    best = best_obs = None
    best_d = best_obs_d = float("inf")
    for s in stations:
        d = haversine_miles(lat, lng, s["lat"], s["lng"])
        if d < best_d:
            best_d, best = d, s
        if s.get("obs") and d < best_obs_d:
            best_obs_d, best_obs = d, s
    if prefer_obs and best_obs is not None and best_obs_d <= best_d + obs_within_mi:
        return best_obs, best_obs_d
    return best, best_d


def classify(lat: float, lng: float, nearest, max_miles: float = TIDE_MAX_MILES) -> str:
    """'ok' | 'too-far' | 'outside-us'."""
    if not is_in_us(lat, lng):
        return "outside-us"
    if nearest is None or nearest[1] > max_miles:
        return "too-far"
    return "ok"
