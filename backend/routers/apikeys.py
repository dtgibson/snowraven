import os
from pathlib import Path

from dotenv import get_key, set_key, unset_key
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"

KEY_MAP: dict[str, str] = {
    "ebird":       "EBIRD_API_KEY",
    "openweather": "OPENWEATHER_API_KEY",
}


class KeyValue(BaseModel):
    value: str


@router.get("/settings/keys")
def get_keys() -> dict:
    return {
        slot: get_key(str(ENV_FILE), var) or None
        for slot, var in KEY_MAP.items()
    }


@router.post("/settings/keys/{key_name}")
def save_key(key_name: str, body: KeyValue) -> dict:
    if key_name not in KEY_MAP:
        raise HTTPException(status_code=404, detail="Unknown key.")
    value = body.value.strip()
    if not value:
        raise HTTPException(status_code=400, detail="Key value cannot be blank.")
    var = KEY_MAP[key_name]
    set_key(str(ENV_FILE), var, value)
    os.environ[var] = value
    return {"ok": True}


@router.delete("/settings/keys/{key_name}")
def delete_key(key_name: str) -> dict:
    if key_name not in KEY_MAP:
        raise HTTPException(status_code=404, detail="Unknown key.")
    var = KEY_MAP[key_name]
    unset_key(str(ENV_FILE), var)
    os.environ.pop(var, None)
    return {"ok": True}
