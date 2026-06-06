import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

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
