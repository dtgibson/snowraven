import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

import routers.taxonomy as taxonomy_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolate_taxonomy_disk(tmp_path, monkeypatch):
    """Point the offline floor + persist target at a temp dir so these tests
    never read a pre-existing disk twin / bundled snapshot and never write into
    the real repo data/ dir. Each test thus exercises the network path with no
    floor unless it creates one explicitly."""
    monkeypatch.setattr(taxonomy_module, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(taxonomy_module, "_DISK", tmp_path / "data" / "taxonomy.json")
    monkeypatch.setattr(taxonomy_module, "_STATIC", tmp_path / "staticdata" / "ebird_taxonomy.json")

_FAKE_TAXONOMY = [
    {"speciesCode": "amerob", "comName": "American Robin", "sciName": "Turdus migratorius", "taxonOrder": 27616, "category": "species"},
    {"speciesCode": "baleag", "comName": "Bald Eagle", "sciName": "Haliaeetus leucocephalus", "taxonOrder": 3640, "category": "species"},
    {"speciesCode": "cangoo", "comName": "Canada Goose", "sciName": "Branta canadensis", "taxonOrder": 60, "category": "species"},
    {"speciesCode": "rocpig", "comName": "Rock Pigeon", "sciName": "Columba livia", "taxonOrder": 6649, "category": "species"},
    # Sub-forms (domestic/form): not species; reportAs points back to the parent.
    {"speciesCode": "rocpig1", "comName": "Rock Pigeon (Feral Pigeon)", "sciName": "Columba livia (Feral Pigeon)", "category": "domestic", "reportAs": "rocpig"},
    {"speciesCode": "rocpig2", "comName": "Rock Pigeon (Wild type)", "sciName": "Columba livia (Wild type)", "category": "form", "reportAs": "rocpig"},
]


def _patch_taxonomy(taxonomy=_FAKE_TAXONOMY):
    """Patch httpx so the eBird taxonomy fetch returns fake data."""
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json = lambda: taxonomy

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(return_value=mock_resp)
    return patch("routers.taxonomy.httpx.AsyncClient", return_value=mock_client)


def _reset_cache():
    import routers.taxonomy as t
    t._by_sci.clear()
    t._by_com.clear()
    t._by_order.clear()
    t._by_code.clear()
    t._report_as.clear()
    t._version = ""
    t._loaded = False


def test_codes_and_orders_returned():
    _reset_cache()
    with _patch_taxonomy():
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "American Robin", "scientificName": "Turdus migratorius"},
            {"commonName": "Bald Eagle", "scientificName": "Haliaeetus leucocephalus"},
        ]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["codes"]["American Robin"] == "amerob"
    assert data["codes"]["Bald Eagle"] == "baleag"
    assert data["orders"]["American Robin"] == 27616
    assert data["orders"]["Bald Eagle"] == 3640


def test_orders_is_integer():
    _reset_cache()
    with _patch_taxonomy():
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "Canada Goose", "scientificName": "Branta canadensis"},
        ]})
    data = resp.json()
    assert isinstance(data["orders"]["Canada Goose"], int)
    assert data["orders"]["Canada Goose"] == 60


def test_species_not_in_taxonomy_absent_from_orders():
    _reset_cache()
    with _patch_taxonomy():
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "Unknown Bird", "scientificName": "Unknownus birdus"},
        ]})
    data = resp.json()
    assert "Unknown Bird" not in data["codes"]
    assert "Unknown Bird" not in data["orders"]


def test_empty_request_returns_empty_maps():
    _reset_cache()
    with _patch_taxonomy():
        resp = client.post("/taxonomy/codes", json={"species": []})
    assert resp.status_code == 200
    data = resp.json()
    assert data["codes"] == {}
    assert data["orders"] == {}


def test_resolve_species_normalizes_subforms_to_parent():
    """A checklist may report a sub-form code (e.g. domestic "rocpig1"). resolve_species
    must map it to the parent species code AND return the parent's real common name —
    not the raw code. This is the rocpig1-shown-as-a-name bug."""
    _reset_cache()
    import routers.taxonomy as t
    with _patch_taxonomy():
        out = asyncio.run(t.resolve_species(["rocpig1", "rocpig2", "amerob"]))
    assert out["rocpig1"] == {"speciesCode": "rocpig", "commonName": "Rock Pigeon"}
    assert out["rocpig2"] == {"speciesCode": "rocpig", "commonName": "Rock Pigeon"}
    # A plain species code is returned unchanged with its name.
    assert out["amerob"] == {"speciesCode": "amerob", "commonName": "American Robin"}


def test_resolve_species_unknown_code_falls_back_to_code():
    _reset_cache()
    import routers.taxonomy as t
    with _patch_taxonomy():
        out = asyncio.run(t.resolve_species(["notabird9"]))
    assert out["notabird9"] == {"speciesCode": "notabird9", "commonName": "notabird9"}


def test_taxonomy_fetch_failure_returns_empty_maps():
    _reset_cache()
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(side_effect=Exception("network error"))
    with patch("routers.taxonomy.httpx.AsyncClient", return_value=mock_client):
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "American Robin", "scientificName": "Turdus migratorius"},
        ]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["codes"] == {}
    assert data["orders"] == {}


# --- Offline floor (FR-22/FR-24, QA-18) -----------------------------------

# A tiny pre-derived 5-map snapshot fixture (the shape the build script emits).
# byCode/reportAs carry ALL categories; bySci/byCom/byOrder are species-only.
_FIXTURE_SNAPSHOT = {
    "version": "2027",
    "generated": "2026-06-20",
    "bySci": {"turdus migratorius": "amerob", "columba livia": "rocpig"},
    "byCom": {"american robin": "amerob", "rock pigeon": "rocpig"},
    "byOrder": {"american robin": 27616, "rock pigeon": 6649},
    "byCode": {
        "amerob": "American Robin",
        "rocpig": "Rock Pigeon",
        "rocpig1": "Rock Pigeon (Feral Pigeon)",
    },
    "reportAs": {"rocpig1": "rocpig"},
}


def _patch_network_blocked():
    """Any outbound eBird fetch raises — so a test that succeeds proves the floor
    served the request with ZERO network calls (QA-18)."""
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(side_effect=Exception("network blocked in test"))
    return patch("routers.taxonomy.httpx.AsyncClient", return_value=mock_client)


def test_offline_floor_from_bundled_snapshot(tmp_path):
    """With the bundled snapshot present and the network blocked, _ensure_loaded
    populates the maps and /taxonomy/codes returns populated codes/orders with no
    outbound eBird call (QA-18)."""
    _reset_cache()
    snap = tmp_path / "staticdata" / "ebird_taxonomy.json"
    snap.parent.mkdir(parents=True, exist_ok=True)
    import json as _json
    snap.write_text(_json.dumps(_FIXTURE_SNAPSHOT))
    # The autouse fixture redirected _STATIC into tmp_path already; point it at
    # this snapshot file (a sibling tmp_path from the fixture, so override here).
    taxonomy_module._STATIC = snap

    with _patch_network_blocked():
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "American Robin", "scientificName": "Turdus migratorius"},
            {"commonName": "Rock Pigeon", "scientificName": "Columba livia"},
        ]})

    assert resp.status_code == 200
    data = resp.json()
    assert data["codes"]["American Robin"] == "amerob"
    assert data["codes"]["Rock Pigeon"] == "rocpig"
    assert data["orders"]["American Robin"] == 27616
    assert isinstance(data["orders"]["American Robin"], int)


def test_offline_floor_resolves_subform_via_reportas(tmp_path):
    """The bundled floor carries the all-category byCode/reportAs, so a sub-form
    code resolves to its parent species name offline (the QA-16 invariant)."""
    _reset_cache()
    snap = tmp_path / "staticdata" / "ebird_taxonomy.json"
    snap.parent.mkdir(parents=True, exist_ok=True)
    import json as _json
    snap.write_text(_json.dumps(_FIXTURE_SNAPSHOT))
    taxonomy_module._STATIC = snap

    with _patch_network_blocked():
        out = asyncio.run(taxonomy_module.resolve_species(["rocpig1", "amerob"]))

    assert out["rocpig1"] == {"speciesCode": "rocpig", "commonName": "Rock Pigeon"}
    assert out["amerob"] == {"speciesCode": "amerob", "commonName": "American Robin"}


def test_offline_floor_prefers_disk_twin_over_snapshot(tmp_path):
    """When both a disk twin and a bundled snapshot exist, the disk twin wins
    (the prior online fetch persisted under data/)."""
    _reset_cache()
    import json as _json
    snap = tmp_path / "staticdata" / "ebird_taxonomy.json"
    snap.parent.mkdir(parents=True, exist_ok=True)
    snap.write_text(_json.dumps(_FIXTURE_SNAPSHOT))
    taxonomy_module._STATIC = snap
    # Disk twin maps the same species to a DIFFERENT code, proving precedence.
    disk = tmp_path / "data" / "taxonomy.json"
    disk.parent.mkdir(parents=True, exist_ok=True)
    disk_snap = dict(_FIXTURE_SNAPSHOT)
    disk_snap["byCom"] = {"american robin": "diskcode"}
    disk_snap["bySci"] = {"turdus migratorius": "diskcode"}
    disk.write_text(_json.dumps(disk_snap))
    taxonomy_module._DISK = disk

    with _patch_network_blocked():
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "American Robin", "scientificName": "Turdus migratorius"},
        ]})

    assert resp.json()["codes"]["American Robin"] == "diskcode"


def test_online_refresh_persists_disk_twin(tmp_path):
    """When online with a fresher fetch and no disk twin yet, the derived bundle
    is written to the disk twin (write-temp-then-rename) so the next start reads
    the fresher copy."""
    _reset_cache()
    disk = tmp_path / "data" / "taxonomy.json"
    taxonomy_module._DISK = disk
    taxonomy_module.DATA_DIR = tmp_path / "data"
    # No floor present (the fixture's _STATIC tmp path is empty) -> network path.

    with _patch_taxonomy():
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "American Robin", "scientificName": "Turdus migratorius"},
        ]})

    assert resp.status_code == 200
    assert resp.json()["codes"]["American Robin"] == "amerob"
    # The fetch should have persisted the disk twin.
    assert disk.exists()
    import json as _json
    written = _json.loads(disk.read_text())
    assert written["byCode"]["amerob"] == "American Robin"
    assert written["reportAs"]["rocpig1"] == "rocpig"
