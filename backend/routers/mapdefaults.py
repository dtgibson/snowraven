import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

# Repo-root data/ dir, honoring the SR_DATA_DIR override (see datadir.py).
from datadir import DATA_DIR

router = APIRouter()

MAP_DEFAULTS_FILE = DATA_DIR / "map-defaults.json"


class MapDefaults(BaseModel):
    lat: float
    lng: float
    dist: int

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not -90 <= v <= 90:
            raise ValueError("lat must be in [-90, 90]")
        return v

    @field_validator("lng")
    @classmethod
    def validate_lng(cls, v: float) -> float:
        if not -180 <= v <= 180:
            raise ValueError("lng must be in [-180, 180]")
        return v

    @field_validator("dist")
    @classmethod
    def validate_dist(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("dist must be a positive integer")
        return v


@router.get("/settings/map-defaults")
def get_map_defaults() -> dict:
    if not MAP_DEFAULTS_FILE.exists():
        raise HTTPException(status_code=404, detail="No map defaults stored.")
    try:
        return json.loads(MAP_DEFAULTS_FILE.read_text(encoding="utf-8"))
    except Exception:
        raise HTTPException(status_code=500, detail="Could not read map defaults.")


@router.post("/settings/map-defaults")
def save_map_defaults(body: MapDefaults) -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MAP_DEFAULTS_FILE.write_text(
        json.dumps({"lat": body.lat, "lng": body.lng, "dist": body.dist}),
        encoding="utf-8",
    )
    return {"ok": True}


@router.delete("/settings/map-defaults")
def delete_map_defaults() -> dict:
    if not MAP_DEFAULTS_FILE.exists():
        raise HTTPException(status_code=404, detail="No map defaults stored.")
    MAP_DEFAULTS_FILE.unlink()
    return {"ok": True}
