import os

import httpx
from fastapi import APIRouter, HTTPException

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


@router.get("/map/recent-obs")
async def get_recent_obs(lat: float, lng: float, dist: int = 25, codes: str = ""):
    key = _api_key()
    code_set = {c.strip() for c in codes.split(",") if c.strip()}
    if not code_set:
        return []

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

    # Filter to requested species and group by (speciesCode, locId)
    groups: dict[tuple[str, str], dict] = {}
    for obs in observations:
        code = obs.get("speciesCode", "")
        if code not in code_set:
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
