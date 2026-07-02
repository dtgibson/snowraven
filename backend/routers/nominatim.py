import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from http_client import get_client

router = APIRouter()


class LocationPoint(BaseModel):
    lat: float
    lng: float


class NominatimRequest(BaseModel):
    locations: list[LocationPoint]


class LocationResult(BaseModel):
    lat: float
    lng: float
    county: Optional[str] = None


class NominatimResponse(BaseModel):
    results: list[LocationResult]


# In-process cache: (rounded_lat, rounded_lng) → county | None
_cache: dict[tuple[float, float], Optional[str]] = {}
_rate_lock = asyncio.Lock()


def _round_coord(v: float) -> float:
    return round(v, 4)


async def _lookup(lat: float, lng: float) -> Optional[str]:
    key = (_round_coord(lat), _round_coord(lng))
    if key in _cache:
        return _cache[key]
    async with _rate_lock:
        # Re-check after acquiring lock — another coroutine may have populated it
        if key in _cache:
            return _cache[key]
        county = None
        try:
            client = get_client()
            resp = await client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"format": "json", "lat": lat, "lon": lng},
                headers={"User-Agent": "SnowRaven/1.0"},
                timeout=8.0,
            )
            if resp.status_code == 200:
                county = resp.json().get("address", {}).get("county")
        except Exception:
            pass
        _cache[key] = county
        await asyncio.sleep(1.0)
        return county


@router.get("/nominatim/search")
async def forward_geocode(q: str):
    async with _rate_lock:
        data: list = []
        error = False
        try:
            client = get_client()
            resp = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={"q": q, "format": "json", "limit": 5},
                headers={"User-Agent": "SnowRaven/1.0"},
                timeout=8.0,
            )
            if resp.status_code == 200:
                data = resp.json()
            else:
                error = True
        except Exception:
            error = True
        await asyncio.sleep(1.0)
    if error:
        raise HTTPException(status_code=502, detail="Location search unavailable.")
    return data


@router.post("/nominatim/counties", response_model=NominatimResponse)
async def reverse_geocode_counties(request: NominatimRequest) -> NominatimResponse:
    # Deduplicate by rounded coordinate
    seen: dict[tuple[float, float], LocationPoint] = {}
    for loc in request.locations:
        key = (_round_coord(loc.lat), _round_coord(loc.lng))
        seen[key] = loc

    results: list[LocationResult] = []
    for loc in seen.values():
        county = await _lookup(loc.lat, loc.lng)
        results.append(LocationResult(lat=loc.lat, lng=loc.lng, county=county))

    return NominatimResponse(results=results)
