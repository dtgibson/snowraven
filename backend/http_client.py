"""Shared keep-alive httpx client (TIDY #2 — pooled httpx).

One process-wide `httpx.AsyncClient` replaces the ~13 per-call
`async with httpx.AsyncClient()` instantiations across routers/services, so
outbound requests reuse pooled keep-alive connections instead of opening a
fresh TCP+TLS handshake per call.

LAZY SINGLETON, deliberately NOT created in the FastAPI lifespan: the test
suite mounts `TestClient(app)` at module scope WITHOUT a context manager, so
lifespan startup never runs. A lifespan-created client would be `None` under
every test. Creating it on first use (`get_client()`) works in both the served
app and the tests. `main.py`'s lifespan only *closes* it on shutdown if one was
ever created.

Per-request timeouts are preserved at each call site by passing `timeout=` to
the individual `.get()` call — the shared client carries no default timeout, so
each request keeps the budget it had before pooling.
"""

import httpx

_client: httpx.AsyncClient | None = None


def get_client() -> httpx.AsyncClient:
    """Return the process-wide shared client, creating it on first use.

    Every call site does `client = get_client()` then `await client.get(...,
    timeout=...)` — NOT `async with`, because the client is long-lived and must
    not be closed per request (that would discard the pooled connections).
    """
    global _client
    if _client is None:
        _client = httpx.AsyncClient()
    return _client


async def close_client() -> None:
    """Close the shared client if one was ever created (lifespan shutdown)."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
