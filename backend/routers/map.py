import os
from urllib.parse import quote

import httpx
from fastapi import APIRouter, HTTPException, Query

from routers.taxonomy import collapse_to_species_list

router = APIRouter()

_EBIRD_BASE = "https://api.ebird.org/v2"


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
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                f"{_EBIRD_BASE}/ref/hotspot/geo",
                params={"lat": lat, "lng": lng, "dist": dist, "back": 30, "fmt": "json"},
                headers={"X-eBirdApiToken": key},
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"eBird API error: {exc.response.status_code}",
            )
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
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                f"{_EBIRD_BASE}/ref/hotspot/{regionCode}",
                params={"fmt": "json"},
                headers={"X-eBirdApiToken": key},
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"eBird API error: {exc.response.status_code}",
            )
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
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(
                f"{_EBIRD_BASE}/product/spplist/{quote(regionCode, safe='')}",
                headers={"X-eBirdApiToken": key},
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"eBird API error: {exc.response.status_code}",
            )
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


@router.get("/map/recent-obs")
async def get_recent_obs(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    dist: int = Query(25, ge=1, le=200),
    codes: str = "",
):
    key = _api_key()
    code_set = {c.strip() for c in codes.split(",") if c.strip()}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                f"{_EBIRD_BASE}/data/obs/geo/recent",
                params={"lat": lat, "lng": lng, "dist": dist, "back": 30, "fmt": "json"},
                headers={"X-eBirdApiToken": key},
            )
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise HTTPException(
                status_code=502,
                detail=f"eBird API error: {exc.response.status_code}",
            )
        except httpx.RequestError:
            raise HTTPException(status_code=502, detail="Could not reach the eBird API.")

    observations = resp.json()

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
