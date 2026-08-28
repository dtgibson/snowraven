import asyncio
import os
import time
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException, Query

from http_client import get_client
from routers.taxonomy import collapse_to_species_list
from services.ebird_errors import (
    parse_retry_after_seconds,
    raise_ebird_http_error,
)

router = APIRouter()

_EBIRD_BASE = "https://api.ebird.org/v2"

# ── The eBird 429 contract, single-sourced (county-shading-and-project-stats) ─
# The mapper and its Retry-After parser moved to services/ebird_errors.py so
# routers/checklists.py can surface a 429 through the SAME code rather than a
# copy (FR-30). These module-level aliases are kept deliberately: this router's
# five call sites and test_map_router.py's existing patch targets both resolve
# through them, so the extraction changes no behavior and no test plumbing.
#
# Only the 429 half is shareable — the checklist route keeps its own non-429
# fallback, whose detail the Life List Comparer displays (see the ebird_errors
# module docstring).
_parse_retry_after_seconds = parse_retry_after_seconds
_raise_ebird_http_error = raise_ebird_http_error


def _api_key() -> str:
    key = os.getenv("EBIRD_API_KEY", "")
    if not key:
        raise HTTPException(
            status_code=401,
            detail="eBird API key not configured. Add it in Settings.",
        )
    return key


@router.get("/map/hotspots")
async def get_hotspots(lat: float, lng: float, dist: int = 25):
    key = _api_key()
    client = get_client()
    try:
        resp = await client.get(
            f"{_EBIRD_BASE}/ref/hotspot/geo",
            params={"lat": lat, "lng": lng, "dist": dist, "back": 30, "fmt": "json"},
            headers={"X-eBirdApiToken": key},
            timeout=10.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        _raise_ebird_http_error(exc)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach the eBird API.")
    return resp.json()


@router.get("/map/hotspot-region")
async def get_hotspot_region(
    regionCode: str = Query(..., min_length=2, max_length=12, pattern=r"^[A-Z]{2}(-[A-Z0-9]+){0,2}$"),
):
    """All PUBLIC hotspot locIds in an eBird region (country / subnational1 / subnational2,
    e.g. "US-CA"). Used to build the region-scoped hotspot Set that classifies a location
    as a public hotspot (link) vs a personal location (plain text) — O(regions) calls, not
    one per location. Returns just the ids; the Set only needs membership."""
    key = _api_key()
    client = get_client()
    try:
        resp = await client.get(
            f"{_EBIRD_BASE}/ref/hotspot/{regionCode}",
            params={"fmt": "json"},
            headers={"X-eBirdApiToken": key},
            timeout=15.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        _raise_ebird_http_error(exc)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach the eBird API.")
    return [h["locId"] for h in resp.json() if h.get("locId")]


@router.get("/map/county-species")
async def get_county_species(
    regionCode: str = Query(..., pattern=r"^US-[A-Z]{2}-[0-9]{3}$"),
):
    """All-time species list for a US county region (eBird product/spplist),
    collapsed to SPECIES level for the Completeness metric's denominator +
    targets pool (FR-08/FR-09): subspecies/forms fold into their reportAs
    parent, spuh/slash/hybrid drop out, dedupe preserves eBird taxonomic order.
    County subnational2 codes only (stricter than hotspot-region, matching
    deriveCountyRegionCode). Desktop twin: mapService.getCountySpecies — keep
    both in lockstep. Deliberately NOT in the frontend's CACHED_GET_PATHS: the
    30-day persistent completeness cache owns caching for this route."""
    key = _api_key()
    client = get_client()
    try:
        resp = await client.get(
            f"{_EBIRD_BASE}/product/spplist/{quote(regionCode, safe='')}",
            headers={"X-eBirdApiToken": key},
            timeout=15.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        _raise_ebird_http_error(exc)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach the eBird API.")

    raw = resp.json()
    codes = [c for c in raw if isinstance(c, str)] if isinstance(raw, list) else []
    try:
        species = await collapse_to_species_list(codes)
    except Exception:
        # Taxonomy unavailable (no bundled floor AND no network for a refresh) —
        # an honest, retryable server error instead of a Y that counted nothing.
        raise HTTPException(status_code=502, detail="Could not load the eBird taxonomy. Try again.")
    return {"regionCode": regionCode, "speciesCount": len(species), "species": species}


@router.get("/map/hotspot-activity")
async def get_hotspot_activity(
    locId: str = Query(..., min_length=2, max_length=11, pattern=r"^L[0-9]{1,10}$"),
):
    """Recent community activity for ONE public hotspot: eBird
    data/obs/{locId}/recent with back=30 (eBird accepts a locId as the region
    code — the same accepts-a-narrow-region pattern county-species uses with
    product/spplist). Response is reduced to one (speciesCode, obsDt) pair per
    species — the most recent report of each — from which the client derives
    both the 30-day and 7-day counts (one call serves both windows, FR-16).

    SSRF: the only interpolated value is locId, constrained to ^L[0-9]{1,10}$ —
    a character class that cannot express a scheme, host, credential, '?', '@',
    or path separator, so the destination cannot be steered; quote(locId,
    safe='') is belt-and-braces. `back` is a fixed literal (no numeric query
    params at all, which satisfies the bounded-numeric-params rule by having
    none). The shared client does not follow redirects, and the upstream body
    is reduced, never reflected. The pattern uses explicit [0-9] (never \\d —
    pydantic's Rust regex treats \\d as Unicode digits) and stays a `pattern=`
    constraint (the documented carve-out: the Rust engine rejects a trailing
    newline itself; do NOT "fix" it toward fullmatch). Desktop twin:
    mapService.getHotspotActivity — keep both in lockstep (shared fixture
    parity test, frontend/src/lib/hotspotActivity.fixture.json). Deliberately
    NOT in the frontend's CACHED_GET_PATHS: the 6-hour persistent
    hotspotActivityCache is the single caching layer for this route (no backend
    in-process cache either — one caching layer per call)."""
    key = _api_key()
    client = get_client()
    try:
        resp = await client.get(
            f"{_EBIRD_BASE}/data/obs/{quote(locId, safe='')}/recent",
            params={"back": 30, "fmt": "json"},
            headers={"X-eBirdApiToken": key},
            timeout=10.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        # Re-surfaced through the shared helper: 429 AS 429 with the fixture
        # detail + re-serialized bounded Retry-After, else the generic 502.
        _raise_ebird_http_error(exc)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach the eBird API.")

    raw = resp.json()
    # Reduce: keep a record only when speciesCode and obsDt are both non-empty
    # strings; dedupe by speciesCode keeping the lexicographically greatest
    # obsDt (ISO-style dates compare correctly as strings — the documented
    # /map/recent-obs reasoning); first-seen order (dict insertion), matching
    # the JS twin's Map insertion order. Nothing else from upstream crosses.
    best: dict[str, str] = {}
    if isinstance(raw, list):
        for obs in raw:
            if not isinstance(obs, dict):
                continue
            code = obs.get("speciesCode")
            obs_dt = obs.get("obsDt")
            if not isinstance(code, str) or not code:
                continue
            if not isinstance(obs_dt, str) or not obs_dt:
                continue
            prev = best.get(code)
            if prev is None or obs_dt > prev:
                best[code] = obs_dt
    return {
        "locId": locId,
        "species": [{"speciesCode": c, "obsDt": d} for c, d in best.items()],
    }


# ── Codes-independent recent-obs cache (TIDY #3) ──────────────────────────────
# The raw eBird data/obs/geo/recent fetch is cached behind an in-process TTL +
# single-flight, keyed ONLY by (lat, lng, dist) — `back` is a fixed 30 and
# `codes` is NOT part of the fetch (eBird returns every species in the radius),
# so Media Targets (codes given) and Nearby Lifers (no codes) at the SAME center
# share ONE eBird fetch. The codes filter is applied AFTER the cached fetch.
# 90 s TTL matches the desktop networkCache. Errors are NEVER cached (a failed
# loader leaves no entry, so a transient 401/502 doesn't stick for the window).
# Mirrors lib/tauri/mapService.ts getRecentObs — keep both in lockstep.
_RECENT_OBS_TTL_S = 90.0

_recent_obs_cache: dict[tuple[float, float, int], tuple[float, list]] = {}
_recent_obs_inflight: dict[tuple[float, float, int], asyncio.Task] = {}


async def _fetch_recent_obs_raw(lat: float, lng: float, dist: int, key: str) -> list:
    """The bare eBird data/obs/geo/recent fetch (no codes filter). Raises
    HTTPException on error so the caller never caches a failure."""
    client = get_client()
    try:
        resp = await client.get(
            f"{_EBIRD_BASE}/data/obs/geo/recent",
            params={"lat": lat, "lng": lng, "dist": dist, "back": 30, "fmt": "json"},
            headers={"X-eBirdApiToken": key},
            timeout=10.0,
        )
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        _raise_ebird_http_error(exc)
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Could not reach the eBird API.")
    return resp.json()


async def _cached_recent_obs_raw(lat: float, lng: float, dist: int, key: str) -> list:
    """Return the raw radius observations for (lat, lng, dist), served from the
    TTL cache when fresh, otherwise fetched once (single-flight — concurrent
    same-key callers share the in-flight Task). Errors are not cached."""
    cache_key = (lat, lng, dist)
    now = time.monotonic()

    hit = _recent_obs_cache.get(cache_key)
    if hit is not None and hit[0] > now:
        return hit[1]

    inflight = _recent_obs_inflight.get(cache_key)
    if inflight is not None:
        return await inflight

    task = asyncio.ensure_future(_fetch_recent_obs_raw(lat, lng, dist, key))
    _recent_obs_inflight[cache_key] = task
    try:
        observations = await task
    finally:
        if _recent_obs_inflight.get(cache_key) is task:
            del _recent_obs_inflight[cache_key]
    # Cache ONLY on success (a raised HTTPException propagates without caching).
    _recent_obs_cache[cache_key] = (time.monotonic() + _RECENT_OBS_TTL_S, observations)
    return observations


@router.get("/map/recent-obs")
async def get_recent_obs(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    dist: int = Query(25, ge=1, le=200),
    codes: str = "",
):
    key = _api_key()
    code_set = {c.strip() for c in codes.split(",") if c.strip()}

    # The raw radius fetch is codes-independent and cached on (lat, lng, dist);
    # the codes filter is applied AFTER, so a with-codes and a no-codes call at
    # the same center hit eBird once.
    observations = await _cached_recent_obs_raw(lat, lng, dist, key)

    # Filter to requested species (when codes given) and group by (speciesCode, locId).
    # An empty code_set means no filter — return every species in the radius.
    groups: dict[tuple[str, str], dict] = {}
    for obs in observations:
        code = obs.get("speciesCode", "")
        if code_set and code not in code_set:
            continue
        loc_id = obs.get("locId", "")
        group_key = (code, loc_id)
        if group_key not in groups:
            groups[group_key] = {
                "speciesCode": code,
                "comName": obs.get("comName", ""),
                "locId": loc_id,
                "locName": obs.get("locName", ""),
                "lat": obs.get("lat"),
                "lng": obs.get("lng"),
                "recentDate": obs.get("obsDt", ""),
                "checklistCount": 0,
                "subId": obs.get("subId", ""),
            }
        entry = groups[group_key]
        entry["checklistCount"] += 1
        # Keep the most recent date and its subId; eBird dates are ISO-format so lexicographic comparison works
        current_date = obs.get("obsDt", "")
        if current_date > entry["recentDate"]:
            entry["recentDate"] = current_date
            entry["subId"] = obs.get("subId", "")

    return list(groups.values())
