"""NOAA CO-OPS data fetch (keyless) for the tide route. Returns the parsed JSON
bodies for observed water level, continuous predictions, and high/low predictions
over the checklist window. Web/Pi twin of the fetch in tauri/tideService.ts."""

import asyncio

import httpx

from http_client import get_client

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
    client = get_client()
    # The three products are independent, so fetch them concurrently on the
    # shared keep-alive client (matches the desktop TS twin's Promise.all). _get
    # swallows exceptions and returns None, so gather can't raise and tuple order
    # is preserved — byte-identical to the sequential version, ~3x fewer waits.
    obs, pred, hilo = await asyncio.gather(
        _get(client, {"begin_date": begin, "end_date": end, "station": station, "product": "water_level"}),
        _get(client, {"begin_date": begin, "end_date": end, "station": station, "product": "predictions", "interval": "6"}),
        _get(client, {"begin_date": hilo_begin, "end_date": hilo_end, "station": station, "product": "predictions", "interval": "hilo"}),
    )
    return obs, pred, hilo
