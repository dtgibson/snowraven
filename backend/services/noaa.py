"""NOAA CO-OPS data fetch (keyless) for the tide route. Returns the parsed JSON
bodies for observed water level, continuous predictions, and high/low predictions
over the checklist window. Web/Pi twin of the fetch in tauri/tideService.ts."""

import httpx

NOAA = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"

_BASE = {
    "datum": "MLLW",
    "units": "english",
    "time_zone": "lst_ldt",
    "format": "json",
    "application": "SnowRaven",
}


async def _get(client: httpx.AsyncClient, params: dict):
    try:
        resp = await client.get(NOAA, params={**_BASE, **params}, timeout=10.0)
        return resp.json()  # NOAA returns 200/400 with an {error:{...}} body — parse regardless
    except Exception:
        return None


async def fetch_tides(station: str, begin: str, end: str, hilo_begin: str, hilo_end: str):
    """Return (observed_body, predictions_body, hilo_body)."""
    async with httpx.AsyncClient() as client:
        obs = await _get(client, {"begin_date": begin, "end_date": end, "station": station, "product": "water_level"})
        pred = await _get(client, {"begin_date": begin, "end_date": end, "station": station, "product": "predictions", "interval": "6"})
        hilo = await _get(client, {"begin_date": hilo_begin, "end_date": hilo_end, "station": station, "product": "predictions", "interval": "hilo"})
    return obs, pred, hilo
