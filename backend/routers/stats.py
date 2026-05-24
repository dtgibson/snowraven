import os

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter()

_EBIRD_BASE = "https://api.ebird.org/v2"


@router.get("/stats/nemesis")
async def get_nemesis(
    lat: float = Query(...),
    lng: float = Query(...),
    dist: int = Query(...),
):
    if not (-90 <= lat <= 90):
        raise HTTPException(status_code=400, detail="lat must be between -90 and 90")
    if not (-180 <= lng <= 180):
        raise HTTPException(status_code=400, detail="lng must be between -180 and 180")
    if not (1 <= dist <= 200):
        raise HTTPException(status_code=400, detail="dist must be between 1 and 200")

    key = os.getenv("EBIRD_API_KEY", "")
    if not key:
        raise HTTPException(status_code=503, detail="eBird API key not configured.")

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                f"{_EBIRD_BASE}/data/obs/geo/recent",
                params={"lat": lat, "lng": lng, "dist": dist, "back": 30},
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

    # Group by comName, keep the most recent obsDt per species
    species_dates: dict[str, str] = {}
    for obs in observations:
        name = obs.get("comName", "")
        date = obs.get("obsDt", "")
        if not name:
            continue
        if name not in species_dates or date > species_dates[name]:
            species_dates[name] = date

    species_list = sorted(
        [
            {"commonName": name, "recentDate": date[:10]}
            for name, date in species_dates.items()
        ],
        key=lambda x: x["recentDate"],
        reverse=True,
    )

    return {"species": species_list}
