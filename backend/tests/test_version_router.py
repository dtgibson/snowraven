from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def _mock_github_response(tag_name: str, status_code: int = 200):
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = {"tag_name": tag_name}
    mock_resp.raise_for_status = MagicMock()
    if status_code >= 400:
        from httpx import HTTPStatusError
        mock_resp.raise_for_status.side_effect = HTTPStatusError(
            "error", request=MagicMock(), response=MagicMock()
        )
    return mock_resp


def _patch_github(tag_name: str, status_code: int = 200):
    mock_resp = _mock_github_response(tag_name, status_code)
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(return_value=mock_resp)
    return patch("routers.version.get_client", return_value=mock_client)


def test_version_check_up_to_date(tmp_path, monkeypatch):
    pkg = tmp_path / "package.json"
    pkg.write_text('{"version": "1.2.3"}')
    monkeypatch.setattr("routers.version._PACKAGE_JSON", pkg)

    with _patch_github("v1.2.3"):
        response = client.get("/version/check")

    assert response.status_code == 200
    data = response.json()
    assert data["current"] == "1.2.3"
    assert data["latest"] == "1.2.3"
    assert data["up_to_date"] is True


def test_version_check_update_available(tmp_path, monkeypatch):
    pkg = tmp_path / "package.json"
    pkg.write_text('{"version": "0.0.4"}')
    monkeypatch.setattr("routers.version._PACKAGE_JSON", pkg)

    with _patch_github("v0.0.5"):
        response = client.get("/version/check")

    assert response.status_code == 200
    data = response.json()
    assert data["current"] == "0.0.4"
    assert data["latest"] == "0.0.5"
    assert data["up_to_date"] is False


def test_version_check_strips_v_prefix(tmp_path, monkeypatch):
    pkg = tmp_path / "package.json"
    pkg.write_text('{"version": "2.0.0"}')
    monkeypatch.setattr("routers.version._PACKAGE_JSON", pkg)

    with _patch_github("v2.0.0"):
        response = client.get("/version/check")

    assert response.json()["latest"] == "2.0.0"


def test_version_check_missing_package_json(tmp_path, monkeypatch):
    monkeypatch.setattr("routers.version._PACKAGE_JSON", tmp_path / "missing.json")

    with _patch_github("v1.0.0"):
        response = client.get("/version/check")

    assert response.status_code == 500


def test_version_check_no_releases_not_up_to_date(tmp_path, monkeypatch):
    """FR-39 / QA-28: a GitHub 404 (no release found) must NOT report
    up_to_date — it is a reachable-but-error outcome, distinct from offline (503)
    and from genuinely up to date (200)."""
    pkg = tmp_path / "package.json"
    pkg.write_text('{"version": "0.0.5"}')
    monkeypatch.setattr("routers.version._PACKAGE_JSON", pkg)

    with _patch_github("", status_code=404):
        response = client.get("/version/check")

    # Reachable error -> 502 (generic update-check error), never up_to_date=true.
    assert response.status_code == 502
    assert "up_to_date" not in response.text


def test_version_check_server_error_is_generic_not_offline(tmp_path, monkeypatch):
    """A reachable 5xx reports the generic error (502), distinct from offline (503)."""
    pkg = tmp_path / "package.json"
    pkg.write_text('{"version": "0.0.5"}')
    monkeypatch.setattr("routers.version._PACKAGE_JSON", pkg)

    with _patch_github("", status_code=500):
        response = client.get("/version/check")

    assert response.status_code == 502


def test_version_check_github_unreachable(tmp_path, monkeypatch):
    pkg = tmp_path / "package.json"
    pkg.write_text('{"version": "0.0.4"}')
    monkeypatch.setattr("routers.version._PACKAGE_JSON", pkg)

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(side_effect=Exception("network error"))

    with patch("routers.version.get_client", return_value=mock_client):
        response = client.get("/version/check")

    assert response.status_code == 503
