import pytest
from fastapi.testclient import TestClient

from routers import mapdefaults as mapdefaults_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def use_tmp_data(tmp_path, monkeypatch):
    monkeypatch.setattr(mapdefaults_module, "DATA_DIR", tmp_path)
    monkeypatch.setattr(mapdefaults_module, "MAP_DEFAULTS_FILE", tmp_path / "map-defaults.json")


def test_get_when_absent():
    resp = client.get("/settings/map-defaults")
    assert resp.status_code == 404


def test_save_and_get():
    resp = client.post(
        "/settings/map-defaults",
        json={"lat": 37.8716, "lng": -122.2727, "dist": 25},
    )
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    resp = client.get("/settings/map-defaults")
    assert resp.status_code == 200
    data = resp.json()
    assert data["lat"] == pytest.approx(37.8716)
    assert data["lng"] == pytest.approx(-122.2727)
    assert data["dist"] == 25


def test_delete_when_stored():
    client.post("/settings/map-defaults", json={"lat": 51.5, "lng": -0.12, "dist": 10})
    resp = client.delete("/settings/map-defaults")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert client.get("/settings/map-defaults").status_code == 404


def test_delete_when_absent():
    resp = client.delete("/settings/map-defaults")
    assert resp.status_code == 404


def test_save_overwrites_existing():
    client.post("/settings/map-defaults", json={"lat": 40.0, "lng": -75.0, "dist": 5})
    client.post("/settings/map-defaults", json={"lat": 51.5, "lng": -0.12, "dist": 50})
    data = client.get("/settings/map-defaults").json()
    assert data["lat"] == pytest.approx(51.5)
    assert data["dist"] == 50


def test_invalid_lat_rejected():
    resp = client.post("/settings/map-defaults", json={"lat": 91.0, "lng": 0.0, "dist": 10})
    assert resp.status_code == 422


def test_invalid_lng_rejected():
    resp = client.post("/settings/map-defaults", json={"lat": 0.0, "lng": -181.0, "dist": 10})
    assert resp.status_code == 422


def test_invalid_dist_rejected():
    resp = client.post("/settings/map-defaults", json={"lat": 0.0, "lng": 0.0, "dist": 0})
    assert resp.status_code == 422


def test_negative_dist_rejected():
    resp = client.post("/settings/map-defaults", json={"lat": 0.0, "lng": 0.0, "dist": -5})
    assert resp.status_code == 422


def test_boundary_values_accepted():
    resp = client.post("/settings/map-defaults", json={"lat": -90.0, "lng": 180.0, "dist": 1})
    assert resp.status_code == 200
    resp = client.post("/settings/map-defaults", json={"lat": 90.0, "lng": -180.0, "dist": 100})
    assert resp.status_code == 200
