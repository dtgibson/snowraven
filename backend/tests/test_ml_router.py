from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

_CDN = "https://cdn.download.ams.birds.cornell.edu/api/v2/asset"


def _head_resp(status_code: int) -> MagicMock:
    r = MagicMock()
    r.status_code = status_code
    return r


def _patch_cdn(responses: dict[str, int] | None = None, side_effect=None):
    """Patch httpx.AsyncClient so HEAD calls return configured status codes.

    responses: {url_suffix: status_code} — matched against the end of each URL.
    side_effect: if set, client.head raises this exception for every call.
    """
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    if side_effect is not None:
        mock_client.head = AsyncMock(side_effect=side_effect)
    else:

        async def _head(url, **kwargs):
            for suffix, code in (responses or {}).items():
                if url.endswith(suffix):
                    return _head_resp(code)
            return _head_resp(404)

        mock_client.head = _head

    return patch("routers.ml.httpx.AsyncClient", return_value=mock_client)


def test_photo_detected():
    with _patch_cdn({"111111/1200": 200}):
        resp = client.post("/ml/media-types", json={"catalog_ids": ["111111"]})

    assert resp.status_code == 200
    assert resp.json()["media_types"]["111111"] == "Photo"


def test_audio_detected():
    with _patch_cdn({"222222/mp3": 200}):
        resp = client.post("/ml/media-types", json={"catalog_ids": ["222222"]})

    assert resp.status_code == 200
    assert resp.json()["media_types"]["222222"] == "Audio"


def test_video_detected():
    with _patch_cdn({"333333/mp4/1280": 200, "333333/1200": 200}):
        resp = client.post("/ml/media-types", json={"catalog_ids": ["333333"]})

    assert resp.status_code == 200
    assert resp.json()["media_types"]["333333"] == "Video"


def test_missing_id_omitted_from_response():
    # 111111 is a photo; 999999 returns 404 for all suffixes
    with _patch_cdn({"111111/1200": 200}):
        resp = client.post("/ml/media-types", json={"catalog_ids": ["111111", "999999"]})

    assert resp.status_code == 200
    data = resp.json()
    assert "111111" in data["media_types"]
    assert "999999" not in data["media_types"]


def test_cdn_unreachable_returns_503():
    with _patch_cdn(side_effect=httpx.TransportError("unreachable")):
        resp = client.post("/ml/media-types", json={"catalog_ids": ["123456"]})

    assert resp.status_code == 503
    assert "Macaulay Library" in resp.json()["detail"]


def test_empty_catalog_ids_returns_empty():
    with _patch_cdn({}):
        resp = client.post("/ml/media-types", json={"catalog_ids": []})

    assert resp.status_code == 200
    assert resp.json()["media_types"] == {}
