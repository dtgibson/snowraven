from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

_FAKE_TAXONOMY = [
    {"speciesCode": "amerob", "comName": "American Robin", "sciName": "Turdus migratorius", "taxonOrder": 27616, "category": "species"},
    {"speciesCode": "rocpig", "comName": "Rock Pigeon", "sciName": "Columba livia", "taxonOrder": 6649, "category": "species"},
    {"speciesCode": "rocpig1", "comName": "Rock Pigeon (Feral Pigeon)", "sciName": "Columba livia (Feral Pigeon)", "category": "domestic", "reportAs": "rocpig"},
]

# eBird checklist/view: obs carry speciesCode + howManyStr, and there is NO locName —
# only a locId — so the location name must be resolved separately via ref/region/info.
_FAKE_CHECKLIST = {
    "locId": "L99",
    "obsDt": "2025-03-02 10:55",
    "obs": [
        {
            "speciesCode": "amerob", "howManyStr": "3",
            # breeding code lives in obsAux (internal code; UI translates to display)
            "obsAux": [{"fieldName": "breeding_code", "value": "S1"}],
            "mediaCounts": {"P": 2, "A": 1},
        },
        {"speciesCode": "rocpig1", "howManyStr": "6"},  # a sub-form — should normalize
    ],
}
_FAKE_REGION = {"result": "Albany Bulb"}


def _make_resp(payload, status=200):
    resp = MagicMock()
    resp.status_code = status
    resp.raise_for_status = MagicMock()
    resp.json = lambda: payload
    resp.content = b"x"
    return resp


def _reset_taxonomy_cache():
    import routers.taxonomy as t
    for d in (t._by_sci, t._by_com, t._by_order, t._by_code, t._report_as):
        d.clear()
    t._loaded = False


def _combined_client():
    """One AsyncClient routing by URL. services.ebird and routers.taxonomy both
    `import httpx`, so they share httpx.AsyncClient — a single mock must serve the
    checklist/view, region/info, AND taxonomy fetches."""
    async def fake_get(url, *args, **kwargs):
        if "/product/checklist/view/" in url:
            return _make_resp(_FAKE_CHECKLIST)
        if "/ref/region/info/" in url:
            return _make_resp(_FAKE_REGION)
        if "/ref/taxonomy/ebird" in url:
            return _make_resp(_FAKE_TAXONOMY)
        return _make_resp({}, status=404)

    mc = AsyncMock()
    mc.__aenter__ = AsyncMock(return_value=mc)
    mc.__aexit__ = AsyncMock(return_value=False)
    mc.get = AsyncMock(side_effect=fake_get)
    return mc


def test_checklist_resolves_location_and_normalizes_subform(monkeypatch):
    _reset_taxonomy_cache()
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    with patch("services.ebird.httpx.AsyncClient", return_value=_combined_client()):
        resp = client.get("/checklists/S12345678")
    assert resp.status_code == 200
    data = resp.json()
    # Location name resolved from locId (checklist/view had none).
    assert data["locName"] == "Albany Bulb"
    assert data["obsDt"] == "2025-03-02 10:55"
    by_name = {s["commonName"]: s for s in data["species"]}
    # The sub-form "rocpig1" shows its real species name + code, not the raw code.
    assert "Rock Pigeon" in by_name
    assert by_name["Rock Pigeon"]["speciesCode"] == "rocpig"
    assert by_name["Rock Pigeon"]["count"] == "6"
    assert by_name["American Robin"]["count"] == "3"
    # Breeding code (raw API code) and media counts pass through.
    robin = by_name["American Robin"]
    assert robin["breedingCode"] == "S1"
    assert robin["media"] == {"photo": 2, "audio": 1, "video": 0}
    # A species with no breeding/media still has empty/zeroed fields.
    assert by_name["Rock Pigeon"]["breedingCode"] == ""
    assert by_name["Rock Pigeon"]["media"] == {"photo": 0, "audio": 0, "video": 0}
