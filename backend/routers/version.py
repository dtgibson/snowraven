import json
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

_PACKAGE_JSON = Path(__file__).parent.parent.parent / "frontend" / "package.json"
_GITHUB_API = "https://api.github.com/repos/dtgibson/snowraven/releases/latest"


@router.get("/version/check")
async def check_version():
    try:
        current = json.loads(_PACKAGE_JSON.read_text())["version"]
    except Exception:
        raise HTTPException(status_code=500, detail="Could not read current version.")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                _GITHUB_API,
                headers={"Accept": "application/vnd.github.v3+json"},
                timeout=5.0,
            )
    except Exception:
        # Connection-level failure (offline / DNS / timeout — no HTTP status).
        # The app reads 503 as "couldn't reach the update server — you're offline".
        raise HTTPException(
            status_code=503,
            detail="Could not reach GitHub to check for updates.",
        )

    # Reachable but the response is an HTTP error (FR-39). A 404 means "no release
    # found" — this MUST NOT be reported as "up to date" (the fixed false positive).
    # Any non-OK status is a reachable-but-error → a generic update-check error (502),
    # distinct from the offline (503) and up-to-date (200) outcomes.
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail="The update server returned an error.",
        )

    try:
        latest = resp.json()["tag_name"].lstrip("v")
    except Exception:
        raise HTTPException(
            status_code=502,
            detail="The update server returned an unexpected response.",
        )

    return {"current": current, "latest": latest, "up_to_date": current == latest}
