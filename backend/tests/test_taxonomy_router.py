import asyncio
import json
import math
import time
from unittest.mock import AsyncMock, MagicMock, patch

import re
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

import routers.taxonomy as taxonomy_module
from main import app

client = TestClient(app)

# The live-fetch plausibility floor as shipped, read at import (before any
# fixture patches it down), for the row that holds it to the desktop's.
_REAL_MIN_ENTRIES = taxonomy_module._MIN_ENTRIES


@pytest.fixture(autouse=True)
def isolate_taxonomy_disk(tmp_path, monkeypatch):
    """Point the offline floor + persist target at a temp dir so these tests
    never read a pre-existing disk twin / bundled snapshot and never write into
    the real repo data/ dir. Each test thus exercises the network path with no
    floor unless it creates one explicitly."""
    monkeypatch.setattr(taxonomy_module, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(taxonomy_module, "_DISK", tmp_path / "data" / "taxonomy.json")
    monkeypatch.setattr(taxonomy_module, "_STATIC", tmp_path / "staticdata" / "ebird_taxonomy.json")
    # The fixtures carry a handful of taxa, far under the shipped floor of 100,
    # so the floor is patched down to refusing only an empty list. The real
    # floor is restored, and held to the desktop's, by
    # test_a_short_seven_day_refresh_keeps_the_maps_and_the_saved_copy.
    monkeypatch.setattr(taxonomy_module, "_MIN_ENTRIES", 1)

_FAKE_TAXONOMY = [
    {"speciesCode": "amerob", "comName": "American Robin", "sciName": "Turdus migratorius", "taxonOrder": 27616, "category": "species"},
    {"speciesCode": "baleag", "comName": "Bald Eagle", "sciName": "Haliaeetus leucocephalus", "taxonOrder": 3640, "category": "species"},
    {"speciesCode": "cangoo", "comName": "Canada Goose", "sciName": "Branta canadensis", "taxonOrder": 60, "category": "species"},
    {"speciesCode": "rocpig", "comName": "Rock Pigeon", "sciName": "Columba livia", "taxonOrder": 6649, "category": "species"},
    # Sub-forms (domestic/form): not species; reportAs points back to the parent.
    {"speciesCode": "rocpig1", "comName": "Rock Pigeon (Feral Pigeon)", "sciName": "Columba livia (Feral Pigeon)", "category": "domestic", "reportAs": "rocpig"},
    {"speciesCode": "rocpig2", "comName": "Rock Pigeon (Wild type)", "sciName": "Columba livia (Wild type)", "category": "form", "reportAs": "rocpig"},
    # The bug's real case: Scaly-breasted Munia + its (Scaled) issf form. The species
    # code (nutman) differs from the form code (scbmun2) — the OFF vs ON distinction.
    {"speciesCode": "nutman", "comName": "Scaly-breasted Munia", "sciName": "Lonchura punctulata", "taxonOrder": 33000, "category": "species"},
    {"speciesCode": "scbmun2", "comName": "Scaly-breasted Munia (Scaled)", "sciName": "Lonchura punctulata (Scaled)", "category": "issf", "reportAs": "nutman"},
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
    return patch("routers.taxonomy.get_client", return_value=mock_client)


def _reset_cache():
    import routers.taxonomy as t
    t._by_sci.clear()
    t._by_com.clear()
    t._by_order.clear()
    t._by_code.clear()
    t._report_as.clear()
    t._by_com_all.clear()
    t._version = ""
    t._loaded = False
    t._fresh_until = math.inf
    t._bundled_version = ""


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
    assert data["formCodes"] == {}


# --- formCodes (media-catalog-taxon-links) --------------------------------

def test_form_codes_resolve_issf_form_name_to_its_own_code():
    """A trailing-parenthetical FORM name resolves to its OWN issf code in formCodes
    (the ON / "Show subspecies" media link), while `codes` (species-only, favicons)
    still MISSES it — proving the additive map does not disturb species behavior."""
    _reset_cache()
    with _patch_taxonomy():
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "Scaly-breasted Munia (Scaled)", "scientificName": "Lonchura punctulata (Scaled)"},
            {"commonName": "Rock Pigeon (Feral Pigeon)", "scientificName": "Columba livia (Feral Pigeon)"},
        ]})
    data = resp.json()
    # Form names carry their OWN code in formCodes.
    assert data["formCodes"]["Scaly-breasted Munia (Scaled)"] == "scbmun2"
    assert data["formCodes"]["Rock Pigeon (Feral Pigeon)"] == "rocpig1"
    # species-only `codes` MUST NOT resolve the form names (byte-identical behavior).
    assert "Scaly-breasted Munia (Scaled)" not in data["codes"]
    assert "Rock Pigeon (Feral Pigeon)" not in data["codes"]


def test_form_codes_species_name_resolves_to_species_code():
    """A plain SPECIES name resolves to the species code in BOTH codes and formCodes —
    formCodes falls back to the species code so a species name still links correctly."""
    _reset_cache()
    with _patch_taxonomy():
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "Scaly-breasted Munia", "scientificName": "Lonchura punctulata"},
        ]})
    data = resp.json()
    assert data["codes"]["Scaly-breasted Munia"] == "nutman"
    assert data["formCodes"]["Scaly-breasted Munia"] == "nutman"


def test_species_codes_byte_identical_with_form_map_added():
    """Adding formCodes must not change the species `codes`/`orders` for a species
    request — the favicon/sort contract."""
    _reset_cache()
    with _patch_taxonomy():
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "American Robin", "scientificName": "Turdus migratorius"},
            {"commonName": "Bald Eagle", "scientificName": "Haliaeetus leucocephalus"},
        ]})
    data = resp.json()
    assert data["codes"] == {"American Robin": "amerob", "Bald Eagle": "baleag"}
    assert data["orders"] == {"American Robin": 27616, "Bald Eagle": 3640}


def test_form_codes_offline_floor(tmp_path):
    """formCodes resolves a form name from the bundled snapshot with the network
    blocked — the offline floor (byCode inversion) works with zero eBird calls."""
    _reset_cache()
    snap = tmp_path / "staticdata" / "ebird_taxonomy.json"
    snap.parent.mkdir(parents=True, exist_ok=True)
    import json as _json
    snap.write_text(_json.dumps(_FIXTURE_SNAPSHOT))
    taxonomy_module._STATIC = snap
    with _patch_network_blocked():
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "Rock Pigeon (Feral Pigeon)", "scientificName": "Columba livia (Feral Pigeon)"},
        ]})
    data = resp.json()
    assert data["formCodes"]["Rock Pigeon (Feral Pigeon)"] == "rocpig1"


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
    with patch("routers.taxonomy.get_client", return_value=mock_client):
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
    return patch("routers.taxonomy.get_client", return_value=mock_client)


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
    """When the disk twin was saved under the bundled snapshot's own version
    (both "2027" here), the disk twin wins: it is the prior online fetch,
    persisted under data/. The older-version case is
    test_offline_floor_prefers_a_newer_bundled_snapshot_to_an_older_saved_copy."""
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


# --- The saved copy and the seven-day refresh (taxonomy-2026-readiness) -------
#
# Through 1.0.60 the web/Pi disk twin was written once and never again (a live
# fetch's version was always "", equal to the twin's own ""), it beat the bundled
# snapshot on every offline start, and a running server never re-fetched. These
# rows hold the three behaviours that replace that.

SEVEN_DAYS = 7 * 24 * 60 * 60  # the desktop's SEVEN_DAYS_MS, in seconds

# eBird's next revision, as the fixture sees it: Rock Pigeon renamed, then a
# later fetch that also adds a species.
_RENAMED = [dict(t, comName="Rock Dove") if t["speciesCode"] == "rocpig" else t for t in _FAKE_TAXONOMY]
_RENAMED_AND_SPLIT = _RENAMED + [
    {"speciesCode": "wesrob1", "comName": "Western Robin", "sciName": "Turdus occidentalis", "taxonOrder": 27617, "category": "species"},
]


def _write_bundle(path, doc):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc))


def _fetches(*results):
    """A shared client whose successive taxonomy fetches return each result in
    turn (an Exception is raised instead, and a prepared response is returned
    as it is), so a test can count fetches."""
    responses = []
    for r in results:
        if isinstance(r, (Exception, MagicMock)):
            responses.append(r)
        else:
            resp = MagicMock()
            resp.raise_for_status = MagicMock()
            resp.json = (lambda t: (lambda: t))(r)
            responses.append(resp)
    mock_client = AsyncMock()
    mock_client.get = AsyncMock(side_effect=responses)
    return mock_client


def _name_for(code):
    """The common name the router serves for a species code (resolve_species)."""
    return asyncio.run(taxonomy_module.resolve_species([code]))[code]["commonName"]


def test_live_fetch_that_differs_from_the_saved_copy_rewrites_it(tmp_path, monkeypatch):
    """A live fetch whose derived maps differ from the disk twin rewrites it,
    stamped with the bundled snapshot's version, and a fetch equal to it does
    not (the twin is ~1.7 MB). Each leg starts from a fresh process state."""
    static = tmp_path / "staticdata" / "ebird_taxonomy.json"
    disk = tmp_path / "data" / "taxonomy.json"
    _write_bundle(static, _FIXTURE_SNAPSHOT)  # version "2027"
    # The twin as every earlier build wrote it: the live maps under version "".
    _write_bundle(disk, taxonomy_module._derive_from_taxonomy(_FAKE_TAXONOMY))
    writes = []
    real_persist = taxonomy_module._persist
    monkeypatch.setattr(taxonomy_module, "_persist", lambda b: (writes.append(b["version"]), real_persist(b)))

    # 1. eBird renamed a species: the twin is rewritten under the snapshot's version.
    _reset_cache()
    with patch("routers.taxonomy.get_client", return_value=_fetches(_RENAMED)):
        assert _name_for("rocpig") == "Rock Dove"
    saved = json.loads(disk.read_text())
    assert saved["version"] == "2027"
    assert saved["byCode"]["rocpig"] == "Rock Dove"

    # 2. The versions now agree, so only the maps can call for this write.
    _reset_cache()
    with patch("routers.taxonomy.get_client", return_value=_fetches(_RENAMED_AND_SPLIT)):
        assert _name_for("wesrob1") == "Western Robin"
    assert json.loads(disk.read_text())["byCode"]["wesrob1"] == "Western Robin"
    assert writes == ["2027", "2027"]

    # 3. A fetch equal to the saved copy writes nothing.
    _reset_cache()
    with patch("routers.taxonomy.get_client", return_value=_fetches(_RENAMED_AND_SPLIT)):
        assert _name_for("wesrob1") == "Western Robin"
    assert writes == ["2027", "2027"]


@pytest.mark.parametrize("saved_under", ["2027", ""])
def test_offline_floor_prefers_a_newer_bundled_snapshot_to_an_older_saved_copy(tmp_path, saved_under):
    """Offline, a bundled snapshot newer than the disk twin's version wins, both
    for a twin saved under the previous snapshot ("2027") and for one written
    before saved copies carried a version ("")."""
    _reset_cache()
    _write_bundle(tmp_path / "staticdata" / "ebird_taxonomy.json", dict(_FIXTURE_SNAPSHOT, version="2028"))
    stale = dict(_FIXTURE_SNAPSHOT, version=saved_under)
    stale["byCom"] = {"american robin": "diskcode"}
    stale["bySci"] = {"turdus migratorius": "diskcode"}
    _write_bundle(tmp_path / "data" / "taxonomy.json", stale)

    with _patch_network_blocked():
        resp = client.post("/taxonomy/codes", json={"species": [
            {"commonName": "American Robin", "scientificName": "Turdus migratorius"},
        ]})

    assert resp.json()["codes"]["American Robin"] == "amerob"


def test_a_server_older_than_seven_days_refetches(tmp_path, monkeypatch):
    """Maps loaded at start are served without another fetch for seven days; the
    first request at seven days re-fetches and serves eBird's new names."""
    _write_bundle(tmp_path / "staticdata" / "ebird_taxonomy.json", _FIXTURE_SNAPSHOT)
    # A fake clock anchored on the real one, so the deadline this test leaves
    # behind is in the real future for any later test that reuses the maps.
    now = [time.monotonic()]
    monkeypatch.setattr(taxonomy_module, "_clock", lambda: now[0])
    ebird = _fetches(_FAKE_TAXONOMY, _RENAMED)

    _reset_cache()
    with patch("routers.taxonomy.get_client", return_value=ebird):
        assert _name_for("rocpig") == "Rock Pigeon"
        now[0] += SEVEN_DAYS - 1
        assert _name_for("rocpig") == "Rock Pigeon"
        assert ebird.get.await_count == 1
        now[0] += 1
        assert _name_for("rocpig") == "Rock Dove"
        assert ebird.get.await_count == 2


def test_a_failed_seven_day_refresh_keeps_the_maps_and_waits_another_seven_days(tmp_path, monkeypatch):
    """Offline at the seven-day refresh: the loaded maps keep serving, and the
    next attempt waits another seven days instead of running on every request."""
    _write_bundle(tmp_path / "staticdata" / "ebird_taxonomy.json", _FIXTURE_SNAPSHOT)
    now = [time.monotonic()]  # anchored on the real clock, as above
    monkeypatch.setattr(taxonomy_module, "_clock", lambda: now[0])
    ebird = _fetches(_RENAMED, Exception("offline"), _FAKE_TAXONOMY)

    _reset_cache()
    with patch("routers.taxonomy.get_client", return_value=ebird):
        assert _name_for("rocpig") == "Rock Dove"
        now[0] += SEVEN_DAYS
        assert _name_for("rocpig") == "Rock Dove"   # the refresh failed
        assert _name_for("rocpig") == "Rock Dove"
        assert ebird.get.await_count == 2
        now[0] += SEVEN_DAYS
        assert _name_for("rocpig") == "Rock Pigeon"
        assert ebird.get.await_count == 3


def _unparseable_response():
    """A 200 whose body is not JSON at all."""
    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.json = MagicMock(side_effect=ValueError("not JSON"))
    return resp


def _loaded_maps():
    t = taxonomy_module
    return [dict(m) for m in (t._by_sci, t._by_com, t._by_order, t._by_code, t._report_as, t._by_com_all)]


# Each 200 the router cannot turn into maps, and where it used to raise. The two
# list bodies are long enough to clear the floor, so only the builder can refuse
# them: a species with a null sciName raises in _derive_from_taxonomy, and a form
# with a non-string comName gets through it and raises in _apply_snapshot.
@pytest.mark.parametrize("bad_body", [
    pytest.param(_unparseable_response(), id="not-json"),
    pytest.param({"errors": []}, id="json-object"),
    pytest.param(_FAKE_TAXONOMY + [
        {"speciesCode": "nulsci1", "comName": "Null Sci", "sciName": None, "taxonOrder": 1, "category": "species"},
    ], id="null-sciName"),
    pytest.param(_FAKE_TAXONOMY + [
        {"speciesCode": "numcom1", "comName": 5, "sciName": "Columba livia (x)", "category": "form", "reportAs": "rocpig"},
    ], id="numeric-form-comName"),
])
def test_a_malformed_seven_day_refresh_keeps_the_maps_and_fetches_once(tmp_path, monkeypatch, bad_body):
    """A 200 at the seven-day refresh that cannot be turned into maps takes the
    failed-refresh path: the loaded maps keep serving, unchanged; one fetch
    serves every request until seven more days pass; the saved copy is left
    byte-identical."""
    _write_bundle(tmp_path / "staticdata" / "ebird_taxonomy.json", _FIXTURE_SNAPSHOT)
    disk = tmp_path / "data" / "taxonomy.json"
    now = [time.monotonic()]  # anchored on the real clock, as above
    monkeypatch.setattr(taxonomy_module, "_clock", lambda: now[0])
    ebird = _fetches(_RENAMED, bad_body, _FAKE_TAXONOMY)

    _reset_cache()
    with patch("routers.taxonomy.get_client", return_value=ebird):
        assert _name_for("rocpig") == "Rock Dove"
        saved = disk.read_bytes()
        maps = _loaded_maps()
        now[0] += SEVEN_DAYS
        for _ in range(5):
            assert _name_for("rocpig") == "Rock Dove"
        assert ebird.get.await_count == 2
        assert _loaded_maps() == maps
        assert disk.read_bytes() == saved
        now[0] += SEVEN_DAYS
        assert _name_for("rocpig") == "Rock Pigeon"
        assert ebird.get.await_count == 3


def test_a_short_seven_day_refresh_keeps_the_maps_and_the_saved_copy(tmp_path, monkeypatch):
    """A 200 at the seven-day refresh holding fewer entries than the floor (the
    desktop's 100) is a failed refresh: the 2027-stamped saved copy stays
    byte-identical and the loaded maps unchanged. Runs at the shipped floor."""
    # The two declarations of the floor agree (comments stripped from the TS,
    # so only the code can supply the figure).
    service = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "tauri" / "taxonomyService.ts"
    source = re.sub(r"/\*.*?\*/|//[^\n]*", "", service.read_text(encoding="utf-8"), flags=re.S)
    desktop = re.findall(r"taxonomy\.length < (\d+)", source)
    assert desktop == [str(_REAL_MIN_ENTRIES)]
    monkeypatch.setattr(taxonomy_module, "_MIN_ENTRIES", _REAL_MIN_ENTRIES)

    short = _FAKE_TAXONOMY[:3]
    assert len(short) < _REAL_MIN_ENTRIES
    # A first fetch long enough to clear the shipped floor.
    plausible = _RENAMED + [
        {"speciesCode": f"filler{i}", "comName": f"Filler {i}", "sciName": f"Filler species{i}", "taxonOrder": 90000 + i, "category": "species"}
        for i in range(_REAL_MIN_ENTRIES)
    ]
    _write_bundle(tmp_path / "staticdata" / "ebird_taxonomy.json", _FIXTURE_SNAPSHOT)
    disk = tmp_path / "data" / "taxonomy.json"
    now = [time.monotonic()]  # anchored on the real clock, as above
    monkeypatch.setattr(taxonomy_module, "_clock", lambda: now[0])
    ebird = _fetches(plausible, short)

    _reset_cache()
    with patch("routers.taxonomy.get_client", return_value=ebird):
        assert _name_for("rocpig") == "Rock Dove"
        saved = disk.read_bytes()
        assert json.loads(saved)["version"] == "2027"
        maps = _loaded_maps()
        now[0] += SEVEN_DAYS
        assert _name_for("rocpig") == "Rock Dove"
        assert _name_for("filler7") == "Filler 7"
        assert ebird.get.await_count == 2
        assert _loaded_maps() == maps
        assert disk.read_bytes() == saved
