from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _mock_ml_response(results: list, status_code: int = 200):
    mock_resp = MagicMock()
    mock_resp.status_code = status_code
    mock_resp.json.return_value = {"results": results}
    if status_code >= 400:
        mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error", request=MagicMock(), response=MagicMock()
        )
    else:
        mock_resp.raise_for_status = MagicMock()
    return mock_resp


def _patch_ml_by_id(results_by_id: dict):
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    async def _get(url, **kwargs):
        catalog_id = (kwargs.get("params") or {}).get("q", "")
        results = results_by_id.get(catalog_id, [])
        return _mock_ml_response(results)

    mock_client.get = _get
    return patch("routers.ml.httpx.AsyncClient", return_value=mock_client)


def _patch_ml_error(exc):
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.get = AsyncMock(side_effect=exc)
    return patch("routers.ml.httpx.AsyncClient", return_value=mock_client)


def test_valid_lookup_returns_media_types():
    results_by_id = {
        "111111": [{"catalogId": 111111, "mediaType": "Photo"}],
        "222222": [{"catalogId": 222222, "mediaType": "Audio"}],
    }
    with _patch_ml_by_id(results_by_id):
        resp = client.post("/ml/media-types", json={"catalog_ids": ["111111", "222222"]})

    assert resp.status_code == 200
    data = resp.json()
    assert data["media_types"]["111111"] == "Photo"
    assert data["media_types"]["222222"] == "Audio"


def test_missing_id_omitted_from_response():
    results_by_id = {
        "111111": [{"catalogId": 111111, "mediaType": "Photo"}],
        "999999": [],
    }
    with _patch_ml_by_id(results_by_id):
        resp = client.post("/ml/media-types", json={"catalog_ids": ["111111", "999999"]})

    assert resp.status_code == 200
    data = resp.json()
    assert "111111" in data["media_types"]
    assert "999999" not in data["media_types"]


def test_ml_api_unreachable_returns_503():
    with _patch_ml_error(httpx.TransportError("unreachable")):
        resp = client.post("/ml/media-types", json={"catalog_ids": ["123456"]})

    assert resp.status_code == 503
    assert "Macaulay Library" in resp.json()["detail"]


def test_empty_catalog_ids_returns_empty_media_types():
    with _patch_ml_by_id({}):
        resp = client.post("/ml/media-types", json={"catalog_ids": []})

    assert resp.status_code == 200
    assert resp.json()["media_types"] == {}


def test_catalog_id_with_string_in_response():
    results_by_id = {
        "123456": [{"catalogId": "ML123456", "mediaType": "Video"}],
    }
    with _patch_ml_by_id(results_by_id):
        resp = client.post("/ml/media-types", json={"catalog_ids": ["123456"]})

    assert resp.status_code == 200
    assert resp.json()["media_types"]["123456"] == "Video"
