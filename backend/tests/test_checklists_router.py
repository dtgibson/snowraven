from unittest.mock import AsyncMock, MagicMock, patch
from urllib.parse import unquote

import pytest
from fastapi.testclient import TestClient

import routers.taxonomy as taxonomy_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolate_taxonomy_disk(tmp_path, monkeypatch):
    """Resolving a checklist normalizes sub-forms via the taxonomy router, whose
    online refresh now persists a disk twin. Redirect that twin (and the bundled
    snapshot) into a temp dir so these tests never write into the real repo
    data/ dir."""
    monkeypatch.setattr(taxonomy_module, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(taxonomy_module, "_DISK", tmp_path / "data" / "taxonomy.json")
    monkeypatch.setattr(taxonomy_module, "_STATIC", tmp_path / "staticdata" / "ebird_taxonomy.json")

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
    "protocolId": "P22",
    "durationHrs": 0.95,
    "effortDistanceKm": 1.83,
    "effortDistanceEnteredUnit": "mi",
    "numObservers": 1,
    "submissionMethodCode": "EBIRD_iOS",
    "submissionMethodVersionDisp": "3.6.5",
    "comments": "&#x1f325;\r\nBroken clouds",
    "obs": [
        {
            "speciesCode": "amerob", "howManyStr": "3",
            # Raw eBird exotic provenance rides on the observation.
            "exoticCategory": "N", "userDoNotCount": "",
            # breeding code lives in obsAux (internal code; UI translates to display)
            "obsAux": [{"fieldName": "breeding_code", "value": "S1"}],
            "mediaCounts": {"P": 2, "A": 1},
            "comments": "Making display flights",
        },
        # A sub-form: it normalizes to its parent species AND carries its own
        # provenance, which is the case the monotone OR exists for.
        {"speciesCode": "rocpig1", "howManyStr": "6", "exoticCategory": "X", "userDoNotCount": "DNC"},
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
    """One shared-client mock routing by URL. services.ebird (the checklist/view +
    region/info fetches) and routers.taxonomy (the taxonomy refresh) each hold
    their OWN `get_client` reference now (the pooled-client seam), so the two
    patch targets below both point at this one instance — a single mock must serve
    the checklist/view, region/info, AND taxonomy fetches."""
    async def fake_get(url, *args, **kwargs):
        if "/product/checklist/view/" in url:
            return _make_resp(_FAKE_CHECKLIST)
        if "/ref/region/info/" in url:
            return _make_resp(_FAKE_REGION)
        if "/ref/taxonomy/ebird" in url:
            return _make_resp(_FAKE_TAXONOMY)
        return _make_resp({}, status=404)

    mc = AsyncMock()
    mc.get = AsyncMock(side_effect=fake_get)
    return mc


def test_checklist_resolves_location_and_normalizes_subform(monkeypatch):
    _reset_taxonomy_cache()
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    # Both modules' get_client point at ONE shared mock instance (the pooled
    # client is process-wide; the two bound names must be patched separately).
    shared = _combined_client()
    with patch("services.ebird.get_client", return_value=shared), \
         patch("routers.taxonomy.get_client", return_value=shared):
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
    # Effort/provenance metadata passes through (frontend formats it).
    assert data["protocolId"] == "P22"
    assert data["durationHrs"] == 0.95
    assert data["distanceKm"] == 1.83
    assert data["distanceUnit"] == "mi"
    assert data["numObservers"] == 1
    assert data["submissionMethod"] == "EBIRD_iOS"
    assert data["submissionVersion"] == "3.6.5"
    # Comments pass through raw (HTML-entity encoded); the frontend decodes them.
    assert data["comments"] == "&#x1f325;\r\nBroken clouds"
    assert by_name["American Robin"]["comments"] == "Making display flights"
    assert by_name["Rock Pigeon"]["comments"] == ""


def test_provenance_fields_pass_through_additively(monkeypatch):
    """FR-39/QA-44/QA-45: exoticCategory and userDoNotCount are carried through
    RAW, and every field the Life List Comparer already reads is untouched."""
    _reset_taxonomy_cache()
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    shared = _combined_client()
    with patch("services.ebird.get_client", return_value=shared), \
         patch("routers.taxonomy.get_client", return_value=shared):
        resp = client.get("/checklists/S12345678")
    assert resp.status_code == 200
    by_name = {s["commonName"]: s for s in resp.json()["species"]}
    assert by_name["American Robin"]["exoticCategory"] == "N"
    assert by_name["American Robin"]["userDoNotCount"] == ""
    # The sub-form's provenance lands on the COLLAPSED parent code, which is
    # precisely the join key the provenance cache uses.
    assert by_name["Rock Pigeon"]["speciesCode"] == "rocpig"
    assert by_name["Rock Pigeon"]["exoticCategory"] == "X"
    assert by_name["Rock Pigeon"]["userDoNotCount"] == "DNC"
    # Purely additive: the Comparer's fields are unchanged.
    assert by_name["American Robin"]["count"] == "3"
    assert by_name["American Robin"]["breedingCode"] == "S1"
    assert by_name["American Robin"]["media"] == {"photo": 2, "audio": 1, "video": 0}


def test_fields_provenance_skips_the_second_outbound_call(monkeypatch):
    """FR-13/QA-18: a provenance pass issues exactly ONE eBird request per
    checklist. Without the flag the seam makes a SECOND call to ref/region/info
    purely to resolve a readable location name, which the pass does not need.

    The response SHAPE is unchanged either way: locName falls back to the locId,
    exactly as it already does when resolution fails."""
    _reset_taxonomy_cache()
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    shared = _combined_client()
    with patch("services.ebird.get_client", return_value=shared), \
         patch("routers.taxonomy.get_client", return_value=shared):
        resp = client.get("/checklists/S12345678", params={"fields": "provenance"})
    assert resp.status_code == 200
    urls = [c.args[0] for c in shared.get.await_args_list]
    assert any("/product/checklist/view/" in u for u in urls)
    assert not any("/ref/region/info/" in u for u in urls)
    # Shape intact, name degraded to the locId rather than the field vanishing.
    data = resp.json()
    assert data["locName"] == "L99"
    assert data["obsDt"] == "2025-03-02 10:55"
    assert len(data["species"]) == 2
    assert data["species"][0]["exoticCategory"] == "N"


def test_without_the_flag_the_location_name_is_still_resolved(monkeypatch):
    """The must-stay-GREEN half of the pair: the flag is what changes behavior,
    not the presence of the parameter. An unknown `fields` value behaves exactly
    like no value at all, so a typo degrades to the shipped path rather than
    silently suppressing a call."""
    _reset_taxonomy_cache()
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    shared = _combined_client()
    with patch("services.ebird.get_client", return_value=shared), \
         patch("routers.taxonomy.get_client", return_value=shared):
        resp = client.get("/checklists/S12345678", params={"fields": "somethingelse"})
    assert resp.status_code == 200
    assert resp.json()["locName"] == "Albany Bulb"
    urls = [c.args[0] for c in shared.get.await_args_list]
    assert any("/ref/region/info/" in u for u in urls)


# --- Checklist-id shape guard (checklists-route-guard) ----------------------
# The guard itself is single-sourced on services.ebird.CHECKLIST_ID_RE and its
# cross-transport behavior is locked by the shared fixture in
# tests/test_checklist_id_parity.py. This is the ROUTE-level half: single-sourcing
# prevents the three copies DRIFTING, it does nothing to prevent one being
# DROPPED, so each router keeps its own test that the guard is still applied
# here. This route has no key check ahead of the fetch, so the reasoning is even
# tighter than the weather/tide siblings': the fetch is mocked to succeed, so a
# 400 can ONLY be the shape guard.

_GUARD_FAKE_FETCH = {"locName": "L99", "obsDt": "2025-03-02 10:55", "species": []}


def test_query_injection_shape_rejected_at_the_route(monkeypatch):
    """The exact shape the v0.5.88 finding measured end to end: this route was
    the one caller of fetch_checklist_species reaching outbound eBird URL
    construction unguarded, and the reachable injection was the QUERY STRING
    ONLY — `/checklists/S1%3Ffoo=bar` arrives as `S1?foo=bar` and previously
    built `…/checklist/view/S1?foo=bar`.

    `%3F` is a URL escape rather than a literal `?` in this source (a literal
    would be parsed as the request's own query string and never reach the path);
    the decoded value is pinned below so a future edit cannot quietly turn it
    into an ordinary id. Removing the guard makes this request reach the mocked
    fetch, which turns both assertions red."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    assert unquote("S1%3Ffoo=bar") == "S1?foo=bar"

    fetch = AsyncMock(return_value=_GUARD_FAKE_FETCH)
    with patch("routers.checklists.fetch_checklist_species", new=fetch):
        resp = client.get("/checklists/S1%3Ffoo=bar")
    assert resp.status_code == 400
    assert "valid eBird checklist ID" in resp.json()["detail"]
    fetch.assert_not_awaited()


def test_unicode_digit_id_rejected_at_the_route(monkeypatch):
    """`S` + Arabic-Indic 012 (U+0660..U+0662): the v0.5.54 character-class row,
    asserted at THIS call site (Python's `\\d` would admit it; the shipped
    explicit ASCII `[0-9]` rejects it)."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    fetch = AsyncMock(return_value=_GUARD_FAKE_FETCH)
    with patch("routers.checklists.fetch_checklist_species", new=fetch):
        resp = client.get("/checklists/S\u0660\u0661\u0662")
    assert resp.status_code == 400
    assert "valid eBird checklist ID" in resp.json()["detail"]
    fetch.assert_not_awaited()


def test_trailing_newline_id_rejected_at_the_route(monkeypatch):
    """The anchor row, and why this test mocks rather than trusting the parity
    file: the shared fixture pins the PATTERN, so mutating this call site to
    `CHECKLIST_ID_RE.match(...)` would leave the whole suite green while
    `GET /checklists/S123%0A` genuinely passed the guard (Python's `$` matches
    before a trailing newline). Reverting this call site to `.match()` turns
    this red.

    `%0A` is a URL escape rather than a literal newline in this source, and the
    decoded value is pinned below. The weather twin verified out-of-band that
    the shape survives routing: the handler receives "S123" + chr(10) rather
    than the request 404ing first."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    assert unquote("S123%0A") == "S123" + chr(10)

    fetch = AsyncMock(return_value=_GUARD_FAKE_FETCH)
    with patch("routers.checklists.fetch_checklist_species", new=fetch):
        resp = client.get("/checklists/S123%0A")
    assert resp.status_code == 400
    assert "valid eBird checklist ID" in resp.json()["detail"]
    fetch.assert_not_awaited()


def test_over_ceiling_id_rejected_at_the_route(monkeypatch):
    """The {1,15} length ceiling asserted AT THIS CALL SITE
    (length-bound-checklist-id, build 1 of this bundle; this guard is build 2).

    16 digits is one past the ceiling; the at-ceiling direction below proves the
    guard rejects only what it claims to. The pattern half lives in
    test_checklist_id_parity.py; this pins that THIS route applies it (the
    v0.5.88 rule: single-sourcing prevents copies drifting, not a call site
    being dropped)."""
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    fetch = AsyncMock(return_value=_GUARD_FAKE_FETCH)
    with patch("routers.checklists.fetch_checklist_species", new=fetch):
        resp = client.get("/checklists/S" + "9" * 16)
    assert resp.status_code == 400
    assert "valid eBird checklist ID" in resp.json()["detail"]
    fetch.assert_not_awaited()

    # The other direction, at the exact boundary: 15 digits still reaches the
    # outbound fetch and the full pipeline (through the same shared-client
    # machinery as the file's other 200 tests, so this doubles as the guard's
    # no-regression case alongside test_checklist_resolves_location_and_
    # normalizes_subform's S12345678).
    _reset_taxonomy_cache()
    shared = _combined_client()
    with patch("services.ebird.get_client", return_value=shared), \
         patch("routers.taxonomy.get_client", return_value=shared):
        resp = client.get("/checklists/S" + "9" * 15)
    assert resp.status_code == 200
    urls = [c.args[0] for c in shared.get.await_args_list]
    assert any("/product/checklist/view/" in u for u in urls)
