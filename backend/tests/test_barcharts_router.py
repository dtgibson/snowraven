"""The web/Pi eBird bar-chart file routes (targets-tab, schema.md section 1.3).

What is pinned here, and what is not:
  * the extension rule, the shared 50 MB cap (enforcement, not only the constant,
    per security.md v1.0.20: the constant is patched DOWN and a canary row after
    the patched rows proves the patch did not leak), the region-code pattern
    (including Unicode digits and a trailing newline), the manifest round trip
    preserving another county, a corrupt manifest reading as a 500 (UNKNOWN, never
    EMPTY), delete idempotence, and the reserved key;
  * traversal shapes through the TestClient. A TestClient probe NORMALIZES some
    of them (``%2F`` is decoded before the request leaves), so a green row here
    is not evidence about the live server's reach: the raw-socket verification
    security.md v0.5.88 asks for is the QA stage's, against a running uvicorn.
    What these rows DO prove is that no shape the client can send is served
    from, or written to, outside the bar-chart directory.
"""

import json
from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

from main import app
from routers import barcharts as barcharts_module
from routers import settings as settings_module
from routers import settingskv as settingskv_module

client = TestClient(app)

REGION = "US-CA-001"
SAMPLE = b"Sample Size:\t1.0\t2.0\nLincoln's Sparrow\t0.1\t0.2\n"


@pytest.fixture(autouse=True)
def use_tmp_data(tmp_path, monkeypatch):
    monkeypatch.setattr(barcharts_module, "BARCHARTS_DIR", tmp_path / "barcharts")
    monkeypatch.setattr(barcharts_module, "BARCHARTS_META", tmp_path / "barcharts.json")
    # The generic key/value store too, so a fall-through would be visible here.
    monkeypatch.setattr(settingskv_module, "SETTINGS_DIR", tmp_path / "settings")


def _post(region=REGION, name="ebird_US-CA-001__1900_2026_1_12_barchart.txt", content=SAMPLE):
    return client.post(f"/settings/barcharts/{region}", files={"file": (name, content, "text/plain")})


def test_manifest_empty_when_absent():
    resp = client.get("/settings/barcharts")
    assert resp.status_code == 200
    assert resp.json() == {"version": 1, "counties": {}}


def test_upload_round_trip(tmp_path):
    resp = _post()
    assert resp.status_code == 200
    assert resp.json()["filename"] == "ebird_US-CA-001__1900_2026_1_12_barchart.txt"
    assert (tmp_path / "barcharts" / "US-CA-001.txt").read_bytes() == SAMPLE
    got = client.get(f"/settings/barcharts/{REGION}")
    assert got.status_code == 200
    assert got.headers["content-type"].startswith("text/plain")
    assert got.content == SAMPLE
    manifest = client.get("/settings/barcharts").json()
    assert manifest["version"] == 1
    entry = manifest["counties"][REGION]
    assert entry["filename"] == "ebird_US-CA-001__1900_2026_1_12_barchart.txt"
    # The strftime form settings.py uses for the two data-file slots.
    assert len(entry["uploadedAt"]) == 20 and entry["uploadedAt"].endswith("Z")


def test_a_second_county_does_not_drop_the_first():
    assert _post().status_code == 200
    assert _post(region="US-CA-013", name="barchart.tsv").status_code == 200
    counties = client.get("/settings/barcharts").json()["counties"]
    assert sorted(counties) == ["US-CA-001", "US-CA-013"]
    # Replace overwrites the file and the entry, and leaves the other county.
    assert _post(content=b"Sample Size:\t9.0\n", name="replaced.TXT").status_code == 200
    counties = client.get("/settings/barcharts").json()["counties"]
    assert counties["US-CA-001"]["filename"] == "replaced.TXT"
    assert counties["US-CA-013"]["filename"] == "barchart.tsv"
    assert client.get(f"/settings/barcharts/{REGION}").content == b"Sample Size:\t9.0\n"


@pytest.mark.parametrize("name", ["MyEBirdData.csv", "barchart.zip", "barchart.txt.csv", "barchart", ""])
def test_extension_refused_before_anything_is_written(tmp_path, name):
    resp = _post(name=name)
    # An empty filename is refused by the multipart parser or by the rule; both
    # leave nothing behind.
    assert resp.status_code in (400, 422)
    if resp.status_code == 400:
        assert resp.json()["detail"] == "Only .txt or .tsv bar-chart files are accepted."
    assert not (tmp_path / "barcharts").exists()
    assert not (tmp_path / "barcharts.json").exists()


# Names at the bound and one over, in the UTF-16 code units the manifest reader
# counts (security review L2). The astral rows are where UTF-16 and Python's
# code points disagree: 125 birds, one letter and ".txt" is 255 units in 130
# characters; 126 birds and ".txt" is 256 units in 130 characters.
_BIRD = "\U0001F426"
_AT = "n" * (barcharts_module._FILENAME_MAX - 4) + ".txt"
_OVER = "n" * (barcharts_module._FILENAME_MAX - 3) + ".txt"


@pytest.mark.parametrize("name, expected", [
    (_AT, 200),
    (_BIRD * 125 + "x.txt", 200),
    (_OVER, 400),
    (_BIRD * 126 + ".txt", 400),
], ids=["ascii-at-bound", "astral-at-bound", "ascii-one-over", "astral-one-over"])
def test_filename_bound_round_trip(tmp_path, name, expected):
    resp = _post(name=name)
    assert resp.status_code == expected
    counties = client.get("/settings/barcharts").json()["counties"]
    if expected == 200:
        # Written, and read back verbatim: the reader keeps what the route admits.
        assert counties[REGION]["filename"] == name
        assert len(name.encode("utf-16-le", "surrogatepass")) // 2 <= barcharts_module._FILENAME_MAX
    else:
        assert resp.json()["detail"] == barcharts_module._FILENAME_MESSAGE
        assert REGION not in counties
        assert not (tmp_path / "barcharts" / "US-CA-001.txt").exists()


TEST_MAX_BYTES = 1024


@pytest.mark.parametrize("size, expected", [(TEST_MAX_BYTES, 200), (TEST_MAX_BYTES + 1, 413)])
def test_the_shared_cap_is_enforced_here_too(tmp_path, monkeypatch, size, expected):
    monkeypatch.setattr(settings_module, "MAX_BYTES", TEST_MAX_BYTES)
    resp = _post(content=b"x" * size)
    assert resp.status_code == expected
    if expected == 413:
        # The label is derived from the constant the route read, not repeated.
        assert resp.json()["detail"] == f"File exceeds the {settings_module._max_bytes_label()} limit."
        assert not (tmp_path / "barcharts" / "US-CA-001.txt").exists()
        assert "US-CA-001" not in client.get("/settings/barcharts").json()["counties"]


def test_canary_the_cap_patch_did_not_leak():
    # Runs after the patched rows: the production constant is back.
    assert settings_module.MAX_BYTES == 50 * 1024 * 1024
    assert _post(content=b"x" * 2048).status_code == 200


@pytest.mark.parametrize("region", [
    "US-CA-٠١٢",   # Unicode digits: `\d` on the Rust engine would admit them
    "US-CA-001\n",
    "us-ca-001",
    "US-CA-01",
    "US-CA-0011",
    "US-CA",
    "..",
    "US-CA-001.txt",
])
def test_region_pattern_refuses_before_the_handler(tmp_path, region):
    # Percent-encoded, as a browser sends it: the route decodes `%0A` back into a
    # newline in the captured segment, which is the shape the pattern must refuse.
    url = f"/settings/barcharts/{quote(region, safe='')}"
    for method in ("get", "post", "delete"):
        if method == "post":
            resp = client.post(url, files={"file": ("b.txt", SAMPLE, "text/plain")})
        else:
            resp = getattr(client, method)(url)
        # 422 from the pattern, or 404 when routing never matched this route
        # (a `..` segment is collapsed by the client). Never a 200.
        assert resp.status_code in (404, 405, 422), (method, region, resp.status_code)
    assert not (tmp_path / "barcharts").exists()


@pytest.mark.parametrize("path", [
    "/settings/barcharts/..%2F..%2Fsettings%2Fbarcharts",
    "/settings/barcharts/US-CA-001%2F..%2F..%2Fx",
    "/settings/barcharts/%2E%2E",
    "/settings/barcharts/US-CA-001%C0%AF..",
    "/settings/barcharts/../../barcharts.json",
])
def test_traversal_shapes_never_reach_a_file(tmp_path, path):
    (tmp_path / "barcharts.json").write_text(json.dumps({"version": 1, "counties": {}}))
    for method in ("get", "delete"):
        resp = getattr(client, method)(path)
        assert resp.status_code != 200 or method == "get" and resp.json() == {"version": 1, "counties": {}}, (method, path)
    # The manifest was never deleted or rewritten by a traversal DELETE.
    assert json.loads((tmp_path / "barcharts.json").read_text()) == {"version": 1, "counties": {}}


def test_corrupt_manifest_is_500_not_empty(tmp_path):
    (tmp_path / "barcharts.json").write_text("{not json")
    resp = client.get("/settings/barcharts")
    assert resp.status_code == 500
    (tmp_path / "barcharts.json").write_text("[]")
    assert client.get("/settings/barcharts").status_code == 500


def test_a_write_heals_a_corrupt_manifest(tmp_path):
    (tmp_path / "barcharts.json").write_text("{not json")
    assert _post().status_code == 200
    assert list(client.get("/settings/barcharts").json()["counties"]) == [REGION]


def test_missing_file_is_404():
    resp = client.get(f"/settings/barcharts/{REGION}")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "No bar-chart file stored for this county."


def test_delete_is_idempotent_and_drops_only_its_entry(tmp_path):
    assert client.delete(f"/settings/barcharts/{REGION}").status_code == 200
    assert _post().status_code == 200
    assert _post(region="US-CA-013").status_code == 200
    assert client.delete(f"/settings/barcharts/{REGION}").status_code == 200
    assert not (tmp_path / "barcharts" / "US-CA-001.txt").exists()
    assert list(client.get("/settings/barcharts").json()["counties"]) == ["US-CA-013"]
    assert client.delete(f"/settings/barcharts/{REGION}").status_code == 200


def test_barcharts_is_a_reserved_generic_key():
    assert "barcharts" in settingskv_module._RESERVED_KEYS


def test_the_manifest_route_never_falls_through_to_the_key_value_store(tmp_path):
    # POST with a JSON body is not this router's shape (it has no POST on the
    # bare path), and it must not land in the generic store either.
    resp = client.post("/settings/barcharts", json={"version": 1, "counties": {"US-CA-001": {}}})
    assert resp.status_code in (404, 405)
    assert not (tmp_path / "settings" / "barcharts.json").exists()
    # And GET is this router's answer, not a stored setting.
    assert client.get("/settings/barcharts").json() == {"version": 1, "counties": {}}


# ---- icloud-bar-chart-sync: the bulk removal (schema.md 6.4; FR-21, FR-22) ----


def test_bulk_delete_removes_every_file_and_empties_the_manifest(tmp_path):
    assert _post().status_code == 200
    assert _post(region="US-CA-013").status_code == 200
    resp = client.delete("/settings/barcharts")
    assert resp.status_code == 200
    assert sorted(resp.json()["removed"]) == ["US-CA-001", "US-CA-013"]
    assert resp.json()["failed"] == []
    assert not (tmp_path / "barcharts" / "US-CA-001.txt").exists()
    assert not (tmp_path / "barcharts" / "US-CA-013.txt").exists()
    assert client.get("/settings/barcharts").json() == {"version": 1, "counties": {}}


def test_bulk_delete_reports_a_survivor_and_keeps_exactly_it_listed(tmp_path, monkeypatch):
    assert _post().status_code == 200
    assert _post(region="US-CA-013").status_code == 200
    stuck = tmp_path / "barcharts" / "US-CA-013.txt"
    real_unlink = type(stuck).unlink

    def unlink(self, *args, **kwargs):
        if self == stuck:
            raise PermissionError("busy")
        return real_unlink(self, *args, **kwargs)

    monkeypatch.setattr(type(stuck), "unlink", unlink)
    resp = client.delete("/settings/barcharts")
    assert resp.status_code == 200
    assert resp.json() == {"removed": ["US-CA-001"], "failed": ["US-CA-013"]}
    assert stuck.exists()
    counties = client.get("/settings/barcharts").json()["counties"]
    assert list(counties) == ["US-CA-013"]


def test_bulk_delete_is_idempotent_on_an_empty_store():
    first = client.delete("/settings/barcharts")
    assert first.status_code == 200
    assert first.json() == {"removed": [], "failed": []}
    assert client.delete("/settings/barcharts").json() == {"removed": [], "failed": []}


def test_bulk_delete_never_builds_a_path_from_a_key_that_is_not_a_county(tmp_path):
    # A hand-edited manifest: a traversal-shaped key and a trailing-newline key.
    (tmp_path / "barcharts").mkdir(parents=True, exist_ok=True)
    outside = tmp_path / "keep.txt"
    outside.write_text("keep")
    (tmp_path / "barcharts.json").write_text(json.dumps({
        "version": 1,
        "counties": {
            "../keep": {"filename": "x.txt", "uploadedAt": "2026-09-01T00:00:00Z"},
            "US-CA-001\n": {"filename": "x.txt", "uploadedAt": "2026-09-01T00:00:00Z"},
        },
    }))
    resp = client.delete("/settings/barcharts")
    assert resp.status_code == 200
    assert resp.json() == {"removed": [], "failed": []}
    assert outside.read_text() == "keep"
    assert client.get("/settings/barcharts").json() == {"version": 1, "counties": {}}
