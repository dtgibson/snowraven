import os
import httpx


async def fetch_historical(lat: float, lng: float, dt: int) -> dict:
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        raise ValueError("OPENWEATHER_API_KEY not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.openweathermap.org/data/3.0/onecall/timemachine",
            params={"lat": lat, "lon": lng, "dt": dt, "appid": api_key, "units": "imperial"},
            timeout=10.0,
        )

    resp.raise_for_status()
    return resp.json()


async def fetch_forecast(lat: float, lng: float) -> dict:
    """Base One Call 3.0 call (no timemachine, no dt): returns `current` plus the
    `hourly` (48h) and `daily` (8d) forecast in one response. Same key/subscription
    as fetch_historical — used by the Current/Predict lookups (/weather/at)."""
    api_key = os.getenv("OPENWEATHER_API_KEY")
    if not api_key:
        raise ValueError("OPENWEATHER_API_KEY not configured")

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.openweathermap.org/data/3.0/onecall",
            params={
                "lat": lat, "lon": lng, "appid": api_key, "units": "imperial",
                "exclude": "minutely,alerts",
            },
            timeout=10.0,
        )

    resp.raise_for_status()
    return resp.json()
