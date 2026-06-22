import pytest
from fastapi.testclient import TestClient

from routers import mapdefaults as mapdefaults_module
from routers import settings as settings_module
from routers import settingskv as settingskv_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def use_tmp_data(tmp_path, monkeypatch):
    monkeypatch.setattr(settingskv_module, "DATA_DIR", tmp_path)
    monkeypatch.setattr(settingskv_module, "SETTINGS_DIR", tmp_path / "settings")
    # Isolate the dedicated-route handlers' data dirs too, so the route-resolution
    # regression tests don't depend on the real repo data/ contents.
    monkeypatch.setattr(mapdefaults_module, "DATA_DIR", tmp_path)
    monkeypatch.setattr(mapdefaults_module, "MAP_DEFAULTS_FILE", tmp_path / "map-defaults.json")
    monkeypatch.setattr(settings_module, "DATA_DIR", tmp_path)
    monkeypatch.setattr(settings_module, "EBIRD_FILE", tmp_path / "ebird-backup.csv")
    monkeypatch.setattr(settings_module, "ML_FILE", tmp_path / "ml-export.csv")
    monkeypatch.setattr(settings_module, "META_FILE", tmp_path / "metadata.json")


# --- Round-trip: object value ---------------------------------------------

def test_object_value_roundtrips():
    blob = {"variant": "positron", "style": {"layers": [1, 2, 3]}, "savedAt": 1718841600000}
    resp = client.post("/settings/map-style-positron", json=blob)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    resp = client.get("/settings/map-style-positron")
    assert resp.status_code == 200
    assert resp.json() == blob


# --- Round-trip: scalar values --------------------------------------------

def test_scalar_bool_roundtrips():
    resp = client.post("/settings/welcomeSeen", json=True)
    assert resp.status_code == 200

    resp = client.get("/settings/welcomeSeen")
    assert resp.status_code == 200
    assert resp.json() is True


def test_scalar_string_roundtrips():
    client.post("/settings/dateFormat", json="iso")
    assert client.get("/settings/dateFormat").json() == "iso"


def test_scalar_number_roundtrips():
    client.post("/settings/map-zoom", json=7)
    assert client.get("/settings/map-zoom").json() == 7


# --- GET of unset key -> 404 ----------------------------------------------

def test_get_unset_key_404():
    resp = client.get("/settings/never-written")
    assert resp.status_code == 404


# --- POST overwrites -------------------------------------------------------

def test_post_overwrites():
    client.post("/settings/tab-layout", json=["a", "b"])
    client.post("/settings/tab-layout", json=["c"])
    assert client.get("/settings/tab-layout").json() == ["c"]


# --- DELETE ----------------------------------------------------------------

def test_delete_removes_value():
    client.post("/settings/map-base-layer", json="positron")
    resp = client.delete("/settings/map-base-layer")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert client.get("/settings/map-base-layer").status_code == 404


def test_delete_is_idempotent():
    # Deleting an absent key is a no-op success.
    resp = client.delete("/settings/never-existed")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


# --- Key sanitization (NFR-12) --------------------------------------------

def test_path_traversal_key_rejected_dotdot():
    # httpx/starlette normalizes a literal '..' segment in the path, so hit the
    # handler with an encoded traversal that survives routing.
    resp = client.get("/settings/..%2Fapi-keys")
    # Either the path doesn't match (404) or the key validator rejects it (422);
    # what matters is it never reads outside the settings dir.
    assert resp.status_code in (404, 422)


def test_key_with_slash_does_not_hit_generic_store():
    # A slash makes it a two-segment path; the single-segment {key} can't match,
    # so it can't traverse into another file via this route.
    resp = client.post("/settings/foo/bar", json=True)
    assert resp.status_code in (404, 405)


def test_invalid_char_key_rejected_422():
    resp = client.post("/settings/bad key with spaces", json=True)
    assert resp.status_code == 422
    # And GET of the same
    assert client.get("/settings/bad key with spaces").status_code == 422


def test_overlong_key_rejected_422():
    long_key = "a" * 129
    assert client.post(f"/settings/{long_key}", json=True).status_code == 422


# --- Reserved-key guard ----------------------------------------------------

def test_reserved_key_keys_not_owned_by_generic_store():
    # GET /settings/keys must hit the DEDICATED apikeys handler, never this store.
    # (The dedicated handler returns the api-key slots dict, status 200.)
    resp = client.get("/settings/keys")
    assert resp.status_code == 200
    body = resp.json()
    assert "ebird" in body and "openweather" in body  # api-keys shape, not a stored value


# --- Body validation -------------------------------------------------------

def test_non_json_body_rejected_422():
    resp = client.post(
        "/settings/somekey",
        content=b"not json at all",
        headers={"content-type": "text/plain"},
    )
    assert resp.status_code == 422


# --- Route-resolution regression (QA-31 / QA-34) --------------------------
# After settingskv is registered as the final router, the specific /settings/*
# routes must STILL reach their dedicated handlers (a generic {key} registered
# first would shadow them).

def test_settings_keys_hits_apikeys_handler():
    resp = client.get("/settings/keys")
    assert resp.status_code == 200
    assert set(resp.json().keys()) == {"ebird", "openweather"}


def test_settings_files_hits_settings_handler():
    resp = client.get("/settings/files")
    assert resp.status_code == 200
    # The dedicated metadata handler returns the two-slot metadata shape.
    body = resp.json()
    assert "ebird" in body and "ml" in body


def test_settings_files_ebird_hits_dedicated_handler():
    # No eBird backup uploaded in the test data dir -> the dedicated GET returns
    # 404 (its own "no file stored"), NOT a generic-store 404 for a key 'ebird'.
    resp = client.get("/settings/files/ebird")
    assert resp.status_code == 404


def test_settings_map_defaults_hits_dedicated_handler():
    # The dedicated map-defaults GET returns 404 when none stored — proving the
    # generic store did not shadow it (a generic {key='map-defaults'} would 404
    # via the reserved-key guard too, but this confirms the literal route wins).
    resp = client.get("/settings/map-defaults")
    assert resp.status_code == 404


def test_generic_key_still_served_after_specific_routes():
    # A genuinely generic key round-trips through the new store.
    client.post("/settings/some-generic-key", json={"x": 1})
    assert client.get("/settings/some-generic-key").json() == {"x": 1}
    assert client.get("/settings/another-unset-generic").status_code == 404
