"""The /media/embed-status probe.

Cornell put a proof-of-work bot check in front of macaulaylibrary.org, and its
interstitial cannot complete inside a cross-site iframe. The browser cannot
detect that itself (a same-status 200, cross-origin, no CORS headers), so this
route is the web/Pi half of the out-of-band probe.
"""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

# Trimmed from the real interstitial served to a browser User-Agent.
CHALLENGE_HTML = (
    b"<!DOCTYPE html><html><head><title>Making sure you&#39;re not a bot!</title>"
    b'</head><body><id id="anubis_challenge" value="abc"></id>'
    b'<script src="/.within.website/x/cmd/anubis/static/js/main.mjs"></script>'
    b"</body></html>"
)

# The real embed page: a Nuxt document with none of the challenge markers.
REAL_EMBED_HTML = b"<!doctype html><html><head><meta charset=utf-8></head><body>player</body></html>"

ANUBIS_COOKIES = [
    "macaulaylibrary.org-anubis-auth=; Path=/; Secure; SameSite=None; Partitioned",
]
ORDINARY_COOKIES = ["I18N_LANGUAGE=en; Max-Age=31536000; Path=/; SameSite=Lax"]


class _FakeHeaders:
    def __init__(self, set_cookie):
        self._set_cookie = set_cookie

    def get_list(self, name):
        return self._set_cookie if name.lower() == "set-cookie" else []


class _FakeStream:
    """Stands in for `async with client.stream(...) as resp`."""

    def __init__(self, status_code=200, body=b"", set_cookie=None):
        self.status_code = status_code
        self.headers = _FakeHeaders(set_cookie or [])
        self._body = body

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def aiter_bytes(self):
        # Two chunks, so a reader that stops early is still exercised.
        yield self._body[:32]
        yield self._body[32:]


def _patch_ml(**kwargs):
    mock_client = MagicMock()
    mock_client.stream = MagicMock(return_value=_FakeStream(**kwargs))
    return patch("routers.media.get_client", return_value=mock_client)


def test_challenge_markup_reports_gated():
    with _patch_ml(body=CHALLENGE_HTML, set_cookie=ORDINARY_COOKIES):
        response = client.get("/media/embed-status", params={"catalogId": "662004247"})

    assert response.status_code == 200
    assert response.json() == {"gated": True}


def test_challenge_cookie_reports_gated_without_body_markers():
    """Second, independent signal: a markup change alone must not blind the probe."""
    with _patch_ml(body=REAL_EMBED_HTML, set_cookie=ANUBIS_COOKIES):
        response = client.get("/media/embed-status", params={"catalogId": "662004247"})

    assert response.json() == {"gated": True}


def test_real_embed_page_reports_open():
    with _patch_ml(body=REAL_EMBED_HTML, set_cookie=ORDINARY_COOKIES):
        response = client.get("/media/embed-status", params={"catalogId": "662004247"})

    assert response.status_code == 200
    assert response.json() == {"gated": False}


def test_probe_sends_a_browser_user_agent():
    """The gate only challenges browser-shaped requests: with httpx's default
    User-Agent the real page comes back and every viewer would be told the
    embeds are fine while they are all seeing the error card."""
    mock_client = MagicMock()
    mock_client.stream = MagicMock(
        return_value=_FakeStream(body=REAL_EMBED_HTML, set_cookie=ORDINARY_COOKIES)
    )

    with patch("routers.media.get_client", return_value=mock_client):
        client.get("/media/embed-status", params={"catalogId": "662004247"})

    _, kwargs = mock_client.stream.call_args
    assert "Mozilla/5.0" in kwargs["headers"]["User-Agent"]
    assert "Safari" in kwargs["headers"]["User-Agent"]


def test_malformed_catalog_id_is_rejected():
    for bad in ("abc", "12x", "", "1 2", "../etc"):
        response = client.get("/media/embed-status", params={"catalogId": bad})
        assert response.status_code == 422, bad


def test_non_ascii_digits_are_rejected():
    """pydantic's rust regex reads \\d as Unicode decimal, so the pattern uses an
    explicit [0-9] class and matches the JS twin's ASCII-only guard."""
    response = client.get("/media/embed-status", params={"catalogId": "٠١٢"})
    assert response.status_code == 422


def test_missing_catalog_id_is_rejected():
    assert client.get("/media/embed-status").status_code == 422


def test_upstream_error_is_reported_as_bad_gateway():
    with _patch_ml(status_code=500, body=b"", set_cookie=[]):
        response = client.get("/media/embed-status", params={"catalogId": "662004247"})

    assert response.status_code == 502


def test_unreachable_macaulay_is_reported_as_offline():
    mock_client = MagicMock()
    mock_client.stream = MagicMock(side_effect=Exception("network error"))

    with patch("routers.media.get_client", return_value=mock_client):
        response = client.get("/media/embed-status", params={"catalogId": "662004247"})

    # The app treats any failure here as "not gated", so a probe that cannot run
    # never hides media that would have played.
    assert response.status_code == 503
