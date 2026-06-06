import os

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# Module-level cache: populated on first request, reused for the lifetime of
# the process. The eBird taxonomy updates ~once a year with the Clements
# checklist revision; restarting the app is sufficient to pick up changes.
_by_sci: dict[str, str] = {}    # sciName.lower() -> speciesCode (species only)
_by_com: dict[str, str] = {}    # comName.lower() -> speciesCode (species only)
_by_order: dict[str, int] = {}  # comName.lower() -> taxonOrder (species only)
_by_code: dict[str, str] = {}   # speciesCode -> comName (ALL categories, original case)
_report_as: dict[str, str] = {} # sub-form code -> parent species code (eBird reportAs)
_loaded = False


async def _ensure_loaded() -> None:
    global _by_sci, _by_com, _by_order, _by_code, _report_as, _loaded
    if _loaded:
        return

    api_key = os.getenv("EBIRD_API_KEY", "")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.ebird.org/v2/ref/taxonomy/ebird",
            # Full taxonomy (no cat filter) so sub-forms reported on checklists —
            # domestic/issf/form/etc., e.g. "rocpig1" — resolve and map to a species.
            params={"fmt": "json"},
            headers={"x-ebirdapitoken": api_key},
            timeout=30.0,
        )
        resp.raise_for_status()
        taxonomy = resp.json()

    for taxon in taxonomy:
        code = taxon.get("speciesCode", "")
        if not code:
            continue
        _by_code[code] = taxon.get("comName", "")
        report_as = taxon.get("reportAs")
        if report_as:
            _report_as[code] = report_as
        # Name -> code maps stay species-level (preserves the /taxonomy/codes behavior).
        if taxon.get("category") != "species":
            continue
        sci = taxon.get("sciName", "").lower()
        com = taxon.get("comName", "").lower()
        order = taxon.get("taxonOrder")
        if sci:
            _by_sci[sci] = code
        if com:
            _by_com[com] = code
            if order is not None:
                _by_order[com] = int(order)

    _loaded = True


async def resolve_species(codes: list[str]) -> dict[str, dict]:
    """Raw observation code -> {speciesCode, commonName}, normalizing eBird sub-forms
    (domestic/issf/form) to their parent species via reportAs, so the same bird matches
    across checklists regardless of the form it was reported at. Empty if taxonomy
    unavailable (caller falls back to the raw code)."""
    try:
        await _ensure_loaded()
    except Exception:
        return {}
    out: dict[str, dict] = {}
    for c in codes:
        norm = _report_as.get(c, c)
        name = _by_code.get(norm) or _by_code.get(c) or norm
        out[c] = {"speciesCode": norm, "commonName": name}
    return out


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
        # Taxonomy unavailable — return empty maps; frontend falls back gracefully.
        return {"codes": {}, "orders": {}}

    codes: dict[str, str] = {}
    orders: dict[str, int] = {}
    for item in req.species:
        com_lower = item.commonName.lower()
        code = _by_sci.get(item.scientificName.lower()) or _by_com.get(com_lower)
        if code:
            codes[item.commonName] = code
        order = _by_order.get(com_lower)
        if order is not None:
            orders[item.commonName] = order

    return {"codes": codes, "orders": orders}
