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


# MAX_BYTES is twinned with MAX_UPLOAD_BYTES in frontend/src/lib/uploadGuard.ts, and
# frontend/src/lib/uploadGuard.test.ts reads this module's literal and pins it. That
# pins the CONSTANT. These two pin the ENFORCEMENT, which is a separate thing:
# single-sourcing a guard prevents the copies DRIFTING, and does nothing to prevent
# one being DROPPED (.claude/rules/security.md). Deleting the `len(content) >
# MAX_BYTES` check left the whole backend suite and the frontend parity test green;
# these rows go red on it. MAX_BYTES is monkeypatched down so the test does not have
# to post 50 MB, which is also what makes it read the module attribute at call time
# rather than a value captured at import.
@pytest.mark.parametrize("slot, stored", [("ebird", "ebird-backup.csv"), ("ml", "ml-export.csv")])
def test_upload_over_cap_rejected(tmp_path, monkeypatch, slot, stored):
    monkeypatch.setattr(settings_module, "MAX_BYTES", 16)

    resp = client.post(
        f"/settings/files/{slot}",
        files={"file": ("MyEBirdData.csv", b"x" * 17, "text/csv")},
    )

    assert resp.status_code == 413
    assert resp.json()["detail"] == "File exceeds the 50 MB limit."
    # Refused means NOT written: no file, and no metadata entry claiming one.
    assert not (tmp_path / stored).exists()
    assert client.get("/settings/files").json()[slot] is None


@pytest.mark.parametrize("slot, stored", [("ebird", "ebird-backup.csv"), ("ml", "ml-export.csv")])
def test_upload_exactly_at_cap_accepted(tmp_path, monkeypatch, slot, stored):
    """The other edge, so the rows above cannot pass by refusing everything."""
    monkeypatch.setattr(settings_module, "MAX_BYTES", 16)
    body = b"x" * 16

    resp = client.post(
        f"/settings/files/{slot}",
        files={"file": ("MyEBirdData.csv", body, "text/csv")},
    )

    assert resp.status_code == 200
    assert (tmp_path / stored).read_bytes() == body


def test_upload_over_cap_does_not_replace_a_stored_file(tmp_path, monkeypatch):
    """A refused upload is not a partial write over what was already there."""
    good = b"Submission ID,Common Name\nS1,American Robin\n"
    client.post(
        "/settings/files/ebird",
        files={"file": ("MyEBirdData.csv", good, "text/csv")},
    )
    assert (tmp_path / "ebird-backup.csv").read_bytes() == good

    monkeypatch.setattr(settings_module, "MAX_BYTES", 16)
    resp = client.post(
        "/settings/files/ebird",
        files={"file": ("Huge.csv", b"y" * 4096, "text/csv")},
    )

    assert resp.status_code == 413
    assert (tmp_path / "ebird-backup.csv").read_bytes() == good
    assert client.get("/settings/files").json()["ebird"]["filename"] == "MyEBirdData.csv"


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
