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
            if resp.status_code == 404:
                # No releases published yet — treat as up to date
                return {"current": current, "latest": current, "up_to_date": True}
            resp.raise_for_status()
            latest = resp.json()["tag_name"].lstrip("v")
    except httpx.HTTPStatusError:
        raise HTTPException(
            status_code=503,
            detail="Could not reach GitHub to check for updates.",
        )
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="Could not reach GitHub to check for updates.",
        )

    return {"current": current, "latest": latest, "up_to_date": current == latest}
