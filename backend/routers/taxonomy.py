import asyncio
import json
import math
import os
import time
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from datadir import DATA_DIR
from http_client import get_client

router = APIRouter()

# Module-level cache: populated on first request and refreshed from eBird once
# it is seven days old, so a server left running across eBird's annual taxonomy
# update picks the new names up without a restart.
_by_sci: dict[str, str] = {}    # sciName.lower() -> speciesCode (species only)
_by_com: dict[str, str] = {}    # comName.lower() -> speciesCode (species only)
_by_order: dict[str, int] = {}  # comName.lower() -> taxonOrder (species only)
_by_code: dict[str, str] = {}   # speciesCode -> comName (ALL categories, original case)
_report_as: dict[str, str] = {} # sub-form code -> parent species code (eBird reportAs)
# The `version` of the loaded maps: the bundled snapshot's version, or the one a
# live fetch was saved under (below). It is a cache counter kept in lockstep with
# CACHE_KEY in frontend/src/lib/tauri/taxonomyService.ts, not a taxonomy year:
# "2028" holds eBird's 2026 taxonomy ("2027" held the 2025 one).
_version: str = ""
_loaded = False

# Refresh age (the desktop's SEVEN_DAYS_MS in taxonomyService.ts, the age at
# which it stops trusting its saved copy). Measured on the monotonic clock, so a
# wall-clock jump (a Pi setting its clock from the network after boot) neither
# triggers nor postpones a refresh. `_fresh_until` is set by every load below;
# its starting value of infinity means maps injected by setting `_loaded`
# directly, as the parity tests do, never trigger a network call.
_MAX_AGE_S = 7 * 24 * 60 * 60
_clock = time.monotonic
_fresh_until: float = math.inf

# The bundled snapshot's `version`, read by the first floor load ("" when the
# snapshot is absent). Every live fetch is saved under it, which is what lets
# the floor tell a copy saved under this build's snapshot from an older one.
_bundled_version: str = ""

# Additive reverse map (media-catalog-taxon-links fix): comName.lower() -> code for
# ALL categories, derived by inverting _by_code. This is what lets a FORM name (e.g.
# "Scaly-breasted Munia (Scaled)" -> "scbmun2") resolve to its own issf code — the
# species-only _by_com misses it. It is NOT used for favicons/sort (those stay on the
# species-only maps, byte-identical) — only the new `formCodes` response consumes it.
# Names are unique across categories (zero byCode collisions), so the inversion is
# lossless; last-wins would be the fallback, but there are no dupes to lose.
_by_com_all: dict[str, str] = {}


def _by_com_all_for(by_code: dict) -> dict[str, str]:
    """The all-category name->code reverse map of a byCode map (desktop twin:
    byComAllFor in taxonomyService.ts). Cheap (~18k entries) and only runs when
    a bundle is applied. Raises on a name that is not a string, which is why
    _apply_snapshot calls it before it clears any map."""
    return {name.lower(): code for code, name in by_code.items() if name}

# Coalescing lock (FR-27): concurrent first-callers share one serial load instead
# of each re-running it. Lazily bound to the running event loop on first acquire
# (single uvicorn process / one loop — see start.sh; requires Python >= 3.10).
_load_lock = asyncio.Lock()

# Offline floor (FR-24): the disk twin under the repo-root data/ dir (the
# mapdefaults.py convention), which is the last live fetch, or the committed
# bundled snapshot under backend/staticdata/ (the tide_stations.py convention).
# The disk twin is used only when it was saved under the snapshot version this
# build ships, so a newer bundled snapshot beats an older saved copy; the desktop
# gets the same result by changing CACHE_KEY. Both files carry the
# already-derived 5-map bundle, copied in directly, NOT re-derived.
# DATA_DIR (imported above) honors the SR_DATA_DIR override — see datadir.py.
_DISK = DATA_DIR / "taxonomy.json"
_STATIC = Path(__file__).resolve().parent.parent / "staticdata" / "ebird_taxonomy.json"
_MAP_KEYS = ("bySci", "byCom", "byOrder", "byCode", "reportAs")


def _apply_snapshot(snap: dict) -> None:
    """Copy a pre-derived 5-map bundle into the module dicts verbatim.

    Shape: {version, bySci, byCom, byOrder, byCode, reportAs}. byOrder values are
    already integers in the snapshot (coerced at build time, matching int(order)),
    so NO consume-time int() here. Clear-then-update so a refresh fully replaces a
    stale floor rather than merging.

    Everything here that can raise on a malformed bundle (the reverse map, which
    reads every name) runs BEFORE the first map is cleared, so a bundle that
    cannot be applied leaves the loaded maps exactly as they were."""
    global _version
    by_com_all = _by_com_all_for(snap.get("byCode", {}))
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
    # Keep the additive all-category reverse map in sync with _by_code.
    _by_com_all.clear()
    _by_com_all.update(by_com_all)


def _read_bundle(path: Path) -> dict | None:
    """A 5-map bundle file parsed, or None when it is absent, unreadable or not a
    JSON object. Never raises."""
    try:
        if path.exists():
            doc = json.loads(path.read_text(encoding="utf-8"))
            if isinstance(doc, dict):
                return doc
    except Exception:
        pass
    return None


def _load_floor() -> bool:
    """Populate the module dicts from the disk twin when it was saved under the
    bundled snapshot's version, else from the bundled snapshot. Returns True if a
    floor was loaded. Never raises: an absent or corrupt preferred source falls
    through to the other one, and with neither it returns False so the caller
    falls through to the network path.

    A disk twin written before saved copies carried the snapshot's version
    (`version: ""`) never equals it, so the bundled snapshot serves until the
    next live fetch rewrites the twin."""
    global _bundled_version
    disk = _read_bundle(_DISK)
    bundled = _read_bundle(_STATIC)
    _bundled_version = str(bundled.get("version", "")) if bundled is not None else ""
    prefer_disk = disk is not None and (
        bundled is None or disk.get("version") == bundled.get("version")
    )
    for snap in ((disk, bundled) if prefer_disk else (bundled, disk)):
        if snap is None:
            continue
        try:
            _apply_snapshot(snap)
            return True
        except Exception:
            # Malformed maps (e.g. a hand-edited file): try the other source.
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


def _saved_copy_differs(bundle: dict) -> bool:
    """True when the disk twin is absent or unreadable, was saved under another
    version, or holds any map that differs from `bundle`. One comparison of two
    parsed documents, so it is linear in their size; it runs once per load, at
    start and then at most once every seven days."""
    saved = _read_bundle(_DISK)
    if saved is None or saved.get("version") != bundle["version"]:
        return True
    return any(saved.get(key) != bundle[key] for key in _MAP_KEYS)


def _persist(bundle: dict) -> None:
    """Write the 5-map bundle to the disk twin, write-temp-then-rename so a
    partial write can't corrupt the file the next start reads."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = _DISK.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(bundle), encoding="utf-8")
    tmp.replace(_DISK)


# Plausibility floor for a live fetch: a 200 whose body is not a list, or holds
# fewer entries than this, is a failed refresh (keep the maps, never save it,
# wait another seven days), never applied. eBird publishes some 17,900 entries.
# Desktop twin: fetchTaxonomyOnline in frontend/src/lib/tauri/taxonomyService.ts
# refuses the same response (`taxonomy.length < 100`); the backend tests compare
# the two declarations. Read at call time, so tests can patch it down.
_MIN_ENTRIES = 100


async def _ensure_loaded() -> None:
    global _loaded, _fresh_until
    if _loaded and _clock() < _fresh_until:
        return
    async with _load_lock:
        # MANDATORY second check — else every waiter that queued behind the lock
        # re-runs the whole load (FR-27).
        if _loaded and _clock() < _fresh_until:
            return

        # Offline floor first (FR-24): populated maps with NO eBird call when the
        # disk twin or bundled snapshot is present. A refresh of maps that are
        # seven days old keeps those maps as its floor.
        had_floor = True if _loaded else _load_floor()

        # Refresh: keep the eBird fetch as a REFRESH on top of the floor. Always
        # attempted (it is the ONLY source when neither floor exists — graceful
        # for a release before the snapshot asset is generated).
        try:
            api_key = os.getenv("EBIRD_API_KEY", "")
            client = get_client()
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
            if not isinstance(taxonomy, list) or len(taxonomy) < _MIN_ENTRIES:
                raise ValueError("implausible taxonomy response")
            # The builder and the apply sit inside this try, not only the fetch
            # (.claude/rules/security.md, v1.0.29): a 200 the router cannot turn
            # into maps takes the same path as a failed fetch, and
            # _apply_snapshot raises before it clears any map.
            # Saved under the bundled snapshot's version, so the floor can tell
            # this copy from one saved under an older snapshot (see _load_floor).
            bundle = {**_derive_from_taxonomy(taxonomy), "version": _bundled_version}
            _apply_snapshot(bundle)
        except Exception:
            if had_floor:
                # The refresh failed (no answer, an error status, or a 200 that
                # is implausible or cannot be turned into maps) but the floor is
                # good, so serve it (FR-24). The next attempt waits another seven
                # days rather than running on every request, each of which could
                # take 30 s or longer (the timeout is per phase).
                _loaded = True
                _fresh_until = _clock() + _MAX_AGE_S
                return
            # No floor and no usable answer: leave _loaded False so a later call
            # retries; resolve_species/get_species_codes degrade to empty maps.
            raise

        # Rewrite the disk twin whenever the fetch differs from it, and only
        # then (don't rewrite the ~1.7 MB file on every load).
        try:
            if _saved_copy_differs(bundle):
                _persist(bundle)
        except Exception:
            # A failed persist must not fail the load — the maps are in memory.
            pass

        _loaded = True
        _fresh_until = _clock() + _MAX_AGE_S


async def collapse_to_species_list(codes: list[str]) -> list[dict]:
    """The FR-09 species-comparability collapse for a region species list (the
    /map/county-species denominator + targets pool; desktop twin:
    taxonomyService.collapseToSpeciesList — keep in lockstep): each raw code (all
    categories, eBird taxonomic order) collapses to its reportAs species parent;
    only species-category codes survive (spuh/slash/hybrid have no species parent
    and drop out); dedupe preserves first-seen (taxonomic) order.

    Raises if the taxonomy cannot be loaded at all (no floor AND no network) —
    the caller maps that to its own error shape rather than serving a Y that
    silently counted nothing."""
    await _ensure_loaded()
    species_set = set(_by_sci.values())
    seen: set[str] = set()
    out: list[dict] = []
    for c in codes:
        parent = _report_as.get(c, c)
        if parent not in species_set or parent in seen:
            continue
        seen.add(parent)
        out.append({"speciesCode": parent, "commonName": _by_code.get(parent, parent)})
    return out


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
        return {"codes": {}, "orders": {}, "formCodes": {}}

    codes: dict[str, str] = {}
    orders: dict[str, int] = {}
    # `formCodes` is ADDITIVE (media-catalog-taxon-links fix): the code for the name
    # EXACTLY as given, including a trailing subspecies/form parenthetical (issf /
    # domestic / form). It lets the "Show subspecies"-ON media links filter to a
    # form's own media (e.g. "Scaly-breasted Munia (Scaled)" -> "scbmun2"). `codes`
    # / `orders` stay SPECIES-ONLY and byte-identical so favicons/sort don't shift.
    form_codes: dict[str, str] = {}
    for item in req.species:
        com_lower = item.commonName.lower()
        code = _by_sci.get(item.scientificName.lower()) or _by_com.get(com_lower)
        if code:
            codes[item.commonName] = code
        # Taxonomic sort, with the SAME scientific-name bridge `code` above already
        # has. After eBird's annual rollover an export written under the old
        # revision carries a renamed common name ("Cattle Egret", now "Western
        # Cattle-Egret"), which misses the common-name-keyed order map entirely —
        # so the row kept its favicon (resolved through _by_sci) but silently lost
        # its taxonomic position and fell to the A-Z fallback. Scientific names
        # survive a common-name rename, so the bridge is a derivation over maps
        # already loaded: sciName -> code -> CURRENT common name -> order. No
        # snapshot format change, so both committed copies stay as generated.
        #
        # Common name first, so every name that resolves today keeps its exact
        # current answer and this can only ADD an order where there was none.
        # Keep in lockstep with getTaxonomyCodes in
        # frontend/src/lib/tauri/taxonomyService.ts.
        order = _by_order.get(com_lower)
        if order is None and code:
            current_name = _by_code.get(code, "")
            if current_name:
                order = _by_order.get(current_name.lower())
        if order is not None:
            orders[item.commonName] = order
        # All-category exact-name code (may be an issf/form/domestic code). Prefer the
        # all-category map; fall back to the species code so a plain species name still
        # resolves here too.
        form_code = _by_com_all.get(com_lower) or code
        if form_code:
            form_codes[item.commonName] = form_code

    return {"codes": codes, "orders": orders, "formCodes": form_codes}
