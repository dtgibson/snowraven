# Bug Brief — ML API Response Structure Mismatch

**Date:** 2026-05-12
**Severity:** High — Life List media lookup completely broken for all users

## What's broken

The Life List tab always shows the "Couldn't reach the Macaulay Library" error
banner after loading a CSV. Media coverage columns show "—" for every species.

## Root cause

The Macaulay Library search API returns:
```json
{"results": {"count": 0, "content": [{"catalogId": "...", "mediaType": "Photo", ...}]}}
```

The backend (`backend/routers/ml.py`) assumed:
```json
{"results": [{"catalogId": "...", "mediaType": "Photo", ...}]}
```

`data.get("results", [])` returns the inner dict. Iterating over a dict yields
its keys (`"count"`, `"content"`). The line `item.get("catalogId")` raises
`AttributeError` because strings don't have `.get()`. This exception is not caught
by `except httpx.HTTPError`, so FastAPI returns a 500. The frontend sees a non-2xx
response, sets `mlError = True`, and displays the error banner.

## Confirmed via

Direct curl against the ML API confirmed the actual response shape and that the
API is reachable from the backend host.

## Fix scope

- `backend/routers/ml.py` — change `data.get("results", [])` to
  `data.get("results", {}).get("content", [])`
- `backend/tests/test_ml_router.py` — update mock response format to match
  actual API structure in all tests
