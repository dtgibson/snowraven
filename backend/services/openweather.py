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
