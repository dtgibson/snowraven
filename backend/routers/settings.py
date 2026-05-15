import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

router = APIRouter()

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
EBIRD_FILE = DATA_DIR / "ebird-backup.csv"
ML_FILE = DATA_DIR / "ml-export.csv"
META_FILE = DATA_DIR / "metadata.json"

MAX_BYTES = 50 * 1024 * 1024  # 50 MB


def _read_meta() -> dict:
    if not META_FILE.exists():
        return {"ebird": None, "ml": None}
    try:
        return json.loads(META_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"ebird": None, "ml": None}


def _write_meta(meta: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    META_FILE.write_text(json.dumps(meta), encoding="utf-8")


async def _upload(upload: UploadFile, target: Path, slot: str) -> dict:
    filename = upload.filename or ""
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted.")

    # Read up to MAX_BYTES + 1 to detect oversized files without loading everything
    content = await upload.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds the 50 MB limit.")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)

    uploaded_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    meta = _read_meta()
    meta[slot] = {"filename": filename, "uploadedAt": uploaded_at}
    _write_meta(meta)

    return {"filename": filename, "uploadedAt": uploaded_at}


def _delete(target: Path, slot: str) -> dict:
    if not target.exists():
        raise HTTPException(status_code=404, detail="No file stored.")
    target.unlink()
    meta = _read_meta()
    meta[slot] = None
    _write_meta(meta)
    return {"ok": True}


@router.get("/settings/files")
def get_status() -> dict:
    return _read_meta()


@router.post("/settings/files/ebird")
async def upload_ebird(file: UploadFile = File(...)) -> dict:
    return await _upload(file, EBIRD_FILE, "ebird")


@router.get("/settings/files/ebird")
def get_ebird() -> FileResponse:
    if not EBIRD_FILE.exists():
        raise HTTPException(status_code=404, detail="No eBird backup stored.")
    return FileResponse(EBIRD_FILE, media_type="text/plain; charset=utf-8")


@router.delete("/settings/files/ebird")
def delete_ebird() -> dict:
    return _delete(EBIRD_FILE, "ebird")


@router.post("/settings/files/ml")
async def upload_ml(file: UploadFile = File(...)) -> dict:
    return await _upload(file, ML_FILE, "ml")


@router.get("/settings/files/ml")
def get_ml() -> FileResponse:
    if not ML_FILE.exists():
        raise HTTPException(status_code=404, detail="No ML export stored.")
    return FileResponse(ML_FILE, media_type="text/plain; charset=utf-8")


@router.delete("/settings/files/ml")
def delete_ml() -> dict:
    return _delete(ML_FILE, "ml")
