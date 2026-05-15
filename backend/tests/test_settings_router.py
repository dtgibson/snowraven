import json

import pytest
from fastapi.testclient import TestClient

from routers import settings as settings_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def use_tmp_data(tmp_path, monkeypatch):
    monkeypatch.setattr(settings_module, "DATA_DIR", tmp_path)
    monkeypatch.setattr(settings_module, "EBIRD_FILE", tmp_path / "ebird-backup.csv")
    monkeypatch.setattr(settings_module, "ML_FILE", tmp_path / "ml-export.csv")
    monkeypatch.setattr(settings_module, "META_FILE", tmp_path / "metadata.json")


def test_get_status_empty():
    resp = client.get("/settings/files")
    assert resp.status_code == 200
    assert resp.json() == {"ebird": None, "ml": None}


def test_upload_ebird_valid(tmp_path):
    content = b"col1,col2\nval1,val2"
    resp = client.post(
        "/settings/files/ebird",
        files={"file": ("MyEBirdData.csv", content, "text/csv")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["filename"] == "MyEBirdData.csv"
    assert "uploadedAt" in data
    assert (tmp_path / "ebird-backup.csv").exists()
    meta = json.loads((tmp_path / "metadata.json").read_text())
    assert meta["ebird"]["filename"] == "MyEBirdData.csv"


def test_upload_non_csv_rejected():
    resp = client.post(
        "/settings/files/ebird",
        files={"file": ("data.txt", b"some content", "text/plain")},
    )
    assert resp.status_code == 400


def test_get_ebird_when_stored(tmp_path):
    content = b"col1,col2\nval1,val2"
    client.post(
        "/settings/files/ebird",
        files={"file": ("test.csv", content, "text/csv")},
    )
    resp = client.get("/settings/files/ebird")
    assert resp.status_code == 200
    assert resp.content == content


def test_get_ebird_when_absent():
    resp = client.get("/settings/files/ebird")
    assert resp.status_code == 404


def test_delete_ebird_when_stored(tmp_path):
    client.post(
        "/settings/files/ebird",
        files={"file": ("test.csv", b"a,b", "text/csv")},
    )
    resp = client.delete("/settings/files/ebird")
    assert resp.status_code == 200
    assert not (tmp_path / "ebird-backup.csv").exists()
    meta = json.loads((tmp_path / "metadata.json").read_text())
    assert meta["ebird"] is None


def test_delete_ebird_when_absent():
    resp = client.delete("/settings/files/ebird")
    assert resp.status_code == 404


def test_replace_existing_file(tmp_path):
    client.post(
        "/settings/files/ebird",
        files={"file": ("first.csv", b"first", "text/csv")},
    )
    client.post(
        "/settings/files/ebird",
        files={"file": ("second.csv", b"second", "text/csv")},
    )
    resp = client.get("/settings/files/ebird")
    assert resp.content == b"second"
    meta = json.loads((tmp_path / "metadata.json").read_text())
    assert meta["ebird"]["filename"] == "second.csv"


def test_get_status_partial(tmp_path):
    client.post(
        "/settings/files/ml",
        files={"file": ("ml.csv", b"ml data", "text/csv")},
    )
    resp = client.get("/settings/files")
    data = resp.json()
    assert data["ebird"] is None
    assert data["ml"]["filename"] == "ml.csv"
