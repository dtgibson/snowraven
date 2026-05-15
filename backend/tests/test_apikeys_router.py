import os

import pytest
from fastapi.testclient import TestClient

from routers import apikeys as apikeys_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def use_tmp_env(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("")
    monkeypatch.setattr(apikeys_module, "ENV_FILE", env_file)
    monkeypatch.delenv("EBIRD_API_KEY", raising=False)
    monkeypatch.delenv("OPENWEATHER_API_KEY", raising=False)


def test_get_keys_empty():
    resp = client.get("/settings/keys")
    assert resp.status_code == 200
    assert resp.json() == {"ebird": None, "openweather": None}


def test_save_ebird_key():
    resp = client.post("/settings/keys/ebird", json={"value": "abc123"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_get_keys_after_save():
    client.post("/settings/keys/ebird", json={"value": "abc123"})
    resp = client.get("/settings/keys")
    assert resp.json()["ebird"] == "abc123"
    assert resp.json()["openweather"] is None


def test_save_updates_os_environ():
    client.post("/settings/keys/openweather", json={"value": "wx-key-456"})
    assert os.environ.get("OPENWEATHER_API_KEY") == "wx-key-456"


def test_save_blank_key_rejected():
    resp = client.post("/settings/keys/ebird", json={"value": "   "})
    assert resp.status_code == 400


def test_save_unknown_key_rejected():
    resp = client.post("/settings/keys/unknown", json={"value": "x"})
    assert resp.status_code == 404


def test_delete_key():
    client.post("/settings/keys/ebird", json={"value": "to-delete"})
    resp = client.delete("/settings/keys/ebird")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    resp2 = client.get("/settings/keys")
    assert resp2.json()["ebird"] is None


def test_delete_removes_from_os_environ():
    client.post("/settings/keys/ebird", json={"value": "temp"})
    client.delete("/settings/keys/ebird")
    assert "EBIRD_API_KEY" not in os.environ


def test_delete_unknown_key_rejected():
    resp = client.delete("/settings/keys/unknown")
    assert resp.status_code == 404


def test_delete_key_not_in_env_still_ok():
    resp = client.delete("/settings/keys/ebird")
    assert resp.status_code == 200


def test_both_keys_independent():
    client.post("/settings/keys/ebird", json={"value": "e-key"})
    client.post("/settings/keys/openweather", json={"value": "w-key"})
    resp = client.get("/settings/keys")
    data = resp.json()
    assert data["ebird"] == "e-key"
    assert data["openweather"] == "w-key"
