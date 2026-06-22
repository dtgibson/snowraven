import asyncio
import json
import os
from pathlib import Path

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
_version: str = ""              # taxonomy version stamp (Clements year), provenance for refresh-gating
_loaded = False

# Coalescing lock (FR-27): concurrent first-callers share one serial load instead
# of each re-running it. Lazily bound to the running event loop on first acquire
# (single uvicorn process / one loop — see start.sh; requires Python >= 3.10).
_load_lock = asyncio.Lock()

# Offline floor (FR-24): disk twin under the repo-root data/ dir (the
# mapdefaults.py convention), else the committed bundled snapshot under
# backend/staticdata/ (the tide_stations.py convention). The snapshot carries the
# already-derived 5-map bundle — copied in directly, NOT re-derived.
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_DISK = DATA_DIR / "taxonomy.json"
_STATIC = Path(__file__).resolve().parent.parent / "staticdata" / "ebird_taxonomy.json"


def _apply_snapshot(snap: dict) -> None:
    """Copy a pre-derived 5-map bundle into the module dicts verbatim.

    Shape: {version, bySci, byCom, byOrder, byCode, reportAs}. byOrder values are
    already integers in the snapshot (coerced at build time, matching int(order)),
    so NO consume-time int() here. Clear-then-update so a refresh fully replaces a
    stale floor rather than merging."""
    global _version
    _by_sci.clear()
    _by_sci.update(snap.get("bySci", {}))
    _by_com.clear()
    _by_com.update(snap.get("byCom", {}))
    _by_order.clear()
    _by_order.update(snap.get("byOrder", {}))
    _by_code.clear()
    _by_code.update(snap.get("byCode", {}))
    _report_as.clear()
    _report_as.update(snap.get("reportAs", {}))
    _version = str(snap.get("version", ""))


def _load_floor() -> bool:
    """Populate the module dicts from the disk twin if present, else the bundled
    snapshot. Returns True if a floor was loaded. Never raises — a corrupt/absent
    disk file silently falls through to the bundled snapshot, and a missing
    snapshot returns False so the caller falls through to the network path."""
    for path in (_DISK, _STATIC):
        try:
            if path.exists():
                _apply_snapshot(json.loads(path.read_text(encoding="utf-8")))
                return True
        except Exception:
            # Corrupt file (e.g. partial disk write) — try the next source.
            continue
    return False


def _derive_from_taxonomy(taxonomy: list) -> dict:
    """Derive the 5-map bundle from the raw eBird taxonomy array. Single source of
    truth shared by the cold network path and the persisted refresh — keep in
    lockstep with the bundled-snapshot build script and taxonomyService.ts."""
    by_sci: dict[str, str] = {}
    by_com: dict[str, str] = {}
    by_order: dict[str, int] = {}
    by_code: dict[str, str] = {}
    report_as: dict[str, str] = {}
    version = ""
    for taxon in taxonomy:
        code = taxon.get("speciesCode", "")
        if not code:
            continue
        by_code[code] = taxon.get("comName", "")
        ra = taxon.get("reportAs")
        if ra:
            report_as[code] = ra
        # Name -> code maps stay species-level (preserves /taxonomy/codes behavior).
        if taxon.get("category") != "species":
            continue
        sci = taxon.get("sciName", "").lower()
        com = taxon.get("comName", "").lower()
        order = taxon.get("taxonOrder")
        if sci:
            by_sci[sci] = code
        if com:
            by_com[com] = code
            if order is not None:
                by_order[com] = int(order)
    return {
        "version": version,
        "bySci": by_sci,
        "byCom": by_com,
        "byOrder": by_order,
        "byCode": by_code,
        "reportAs": report_as,
    }


def _disk_version() -> str:
    """The version stamp of the on-disk twin, or '' if absent/unreadable."""
    try:
        if _DISK.exists():
            return str(json.loads(_DISK.read_text(encoding="utf-8")).get("version", ""))
    except Exception:
        pass
    return ""


def _persist(bundle: dict) -> None:
    """Write the 5-map bundle to the disk twin, write-temp-then-rename so a
    partial write can't corrupt the file the next start reads."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _DISK.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(bundle), encoding="utf-8")
    tmp.replace(_DISK)


async def _ensure_loaded() -> None:
    global _loaded
    if _loaded:
        return
    async with _load_lock:
        # MANDATORY second check — else every waiter that queued behind the lock
        # re-runs the whole load (FR-27).
        if _loaded:
            return

        # Offline floor first (FR-24): populated maps with NO eBird call when the
        # disk twin or bundled snapshot is present.
        had_floor = _load_floor()

        # Refresh: keep the eBird fetch as a REFRESH on top of the floor. Always
        # attempted (it is the ONLY source when neither floor exists — graceful
        # for a release before the snapshot asset is generated).
        try:
            api_key = os.getenv("EBIRD_API_KEY", "")
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.ebird.org/v2/ref/taxonomy/ebird",
                    # Full taxonomy (no cat filter) so sub-forms reported on
                    # checklists — domestic/issf/form/etc., e.g. "rocpig1" —
                    # resolve and map to a species.
                    params={"fmt": "json"},
                    headers={"x-ebirdapitoken": api_key},
                    timeout=30.0,
                )
                resp.raise_for_status()
                taxonomy = resp.json()
        except Exception:
            if had_floor:
                # Online refresh failed but the floor is good — serve it (FR-24).
                _loaded = True
                return
            # No floor AND no network — leave _loaded False so a later call
            # retries; resolve_species/get_species_codes degrade to empty maps.
            raise

        bundle = _derive_from_taxonomy(taxonomy)
        _apply_snapshot(bundle)

        # Persist the refresh ONLY when it advances the disk version (don't
        # rewrite the ~1.7 MB file every load). A floor with no version stamp
        # (the fetched bundle carries version "") still writes once so the next
        # start reads the fresher disk copy; thereafter it's gated by equality.
        try:
            if _DISK.exists():
                if bundle["version"] != _disk_version():
                    _persist(bundle)
            else:
                _persist(bundle)
        except Exception:
            # A failed persist must not fail the load — the maps are in memory.
            pass

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
