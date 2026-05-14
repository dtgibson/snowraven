import os

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# Module-level cache: populated on first request, reused for the lifetime of
# the process. The eBird taxonomy updates ~once a year with the Clements
# checklist revision; restarting the app is sufficient to pick up changes.
_by_sci: dict[str, str] = {}   # sciName.lower() -> speciesCode
_by_com: dict[str, str] = {}   # comName.lower() -> speciesCode
_loaded = False


async def _ensure_loaded() -> None:
    global _by_sci, _by_com, _loaded
    if _loaded:
        return

    api_key = os.getenv("EBIRD_API_KEY", "")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.ebird.org/v2/ref/taxonomy/ebird",
            params={"fmt": "json", "cat": "species"},
            headers={"x-ebirdapitoken": api_key},
            timeout=30.0,
        )
        resp.raise_for_status()
        taxonomy = resp.json()

    for taxon in taxonomy:
        code = taxon.get("speciesCode", "")
        if not code:
            continue
        sci = taxon.get("sciName", "").lower()
        com = taxon.get("comName", "").lower()
        if sci:
            _by_sci[sci] = code
        if com:
            _by_com[com] = code

    _loaded = True


class SpeciesItem(BaseModel):
    commonName: str
    scientificName: str


class CodesRequest(BaseModel):
    species: list[SpeciesItem]


@router.post("/taxonomy/codes")
async def get_species_codes(req: CodesRequest) -> dict:
    try:
        await _ensure_loaded()
    except Exception:
        # Taxonomy unavailable — return empty map; frontend falls back to taxaName links.
        return {"codes": {}}

    codes: dict[str, str] = {}
    for item in req.species:
        code = _by_sci.get(item.scientificName.lower()) or _by_com.get(item.commonName.lower())
        if code:
            codes[item.commonName] = code

    return {"codes": codes}
