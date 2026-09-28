"""eBird bar-chart files, one per county, for the web/Pi transport
(targets-tab, schema.md section 1.3).

The desktop twin is ``TauriStorage``'s four bar-chart methods in
``frontend/src/lib/storage.ts``; ``WebStorage`` maps the same four onto these
routes with the same failure shapes:

  GET    /settings/barcharts               the manifest; empty when absent;
                                           a corrupt manifest is a 500, NOT empty
                                           (a failed status read is UNKNOWN, v1.0.25)
  GET    /settings/barcharts/{regionCode}  the file, text/plain, or 404
  POST   /settings/barcharts/{regionCode}  multipart ``file``; .txt/.tsv only (400);
                                           a name over ``_FILENAME_MAX`` (400);
                                           over the shared cap is 413
  DELETE /settings/barcharts/{regionCode}  idempotent: 200 whether or not a file
                                           was stored

A bar-chart file is its OWN family, never a third slot in ``metadata.json``: the
two data-file slots are synced by iCloud on desktop and this kind is never
synced, so it keeps its own directory and manifest (schema.md 1.1). No content
validation happens here, exactly as ``settings._upload`` does none: the content
rule is the client registry's (``lib/uploadGuard.ts``), and this router's job is
the cap and the extension.

WHY THE ON-DISK PATH CANNOT BE STEERED. ``regionCode`` becomes a file name, so
it is constrained by ``Path(pattern=r"^US-[A-Z]{2}-[0-9]{3}$")`` before the
handler runs: the class admits no separator, dot or percent sign, so no
``..``, ``/``, ``%2F`` or ``%C0%AF`` form is expressible. Two independent facts
make that hold: Starlette's default ``str`` path converter matches ONE segment
(``[^/]+``), so a captured value never contains a ``/``; and the pattern refuses
everything else. The ``pattern=`` constraint runs on pydantic's Rust engine,
which rejects a trailing newline itself: the documented carve-out, do NOT
"fix" it toward ``fullmatch``. Explicit ``[0-9]``, never ``\\d``, which the Rust
engine reads as Unicode digits (v0.5.54). Do NOT switch this route to a
``{regionCode:path}`` converter: that removes the one-segment half.

"barcharts" is a reserved key in ``settingskv.py`` and this router is included
BEFORE the generic ``/settings/{key}`` store in ``main.py``, so
``GET/POST /settings/barcharts`` can never fall through to the key/value store.
"""

import json
import os
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, File, HTTPException, Path, UploadFile
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from datadir import DATA_DIR
from routers import settings as settings_module
from services.county_day_obs import _utf16_len

router = APIRouter()

BARCHARTS_DIR = DATA_DIR / "barcharts"
BARCHARTS_META = DATA_DIR / "barcharts.json"

_REGION_PATTERN = r"^US-[A-Z]{2}-[0-9]{3}$"
_ALLOWED_SUFFIXES = (".txt", ".tsv")
_EXTENSION_MESSAGE = "Only .txt or .tsv bar-chart files are accepted."

# The longest filename the manifest keeps, in UTF-16 code units: the unit the
# manifest READER (``normalizeBarChartManifest`` in lib/storage.ts, via
# ``BARCHART_FILENAME_MAX`` in lib/uploadGuard.ts) measures with ``.length``.
# A longer name would be stored and then dropped on read, leaving the county's
# file invisible and orphaned (security review L2), so it is refused before
# anything is written. uploadGuard.test.ts compares this to the TS constant.
_FILENAME_MAX = 255
_FILENAME_MESSAGE = "That file's name is too long, so it was not saved. Rename it and add it again."

# The manifest is ONE document holding several counties' entries, so every
# read-modify-write on it holds this lock: two concurrent adds for different
# counties would otherwise each rewrite it from a stale base and drop the
# other's entry (the desktop twin serializes on its docChains key for the same
# reason). The writes happen in the threadpool, hence a threading lock.
_META_LOCK = threading.Lock()


def _empty_manifest() -> dict:
    return {"version": 1, "counties": {}}


def _read_manifest_strict() -> dict:
    """The manifest as stored, or the empty one when absent. Raises on a
    document that cannot be read or is not a JSON object: that is UNKNOWN."""
    if not BARCHARTS_META.exists():
        return _empty_manifest()
    data = json.loads(BARCHARTS_META.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("manifest is not an object")
    return data


def _read_manifest_for_write() -> dict:
    """Inside a write: a corrupt manifest is HEALED rather than wedging every
    later add and remove (the read route still reports it as a 500). Stated
    residual, the same as the desktop twin's: another county's entry in a
    corrupt document is lost from the manifest; its file stays on disk and is
    overwritten by its next add."""
    try:
        data = _read_manifest_strict()
    except (OSError, ValueError):
        return _empty_manifest()
    counties = data.get("counties")
    if data.get("version") != 1 or not isinstance(counties, dict):
        return _empty_manifest()
    return {"version": 1, "counties": dict(counties)}


def _write_manifest(meta: dict) -> None:
    """Atomic replace, so a concurrent GET never reads a half-written file."""
    BARCHARTS_META.parent.mkdir(parents=True, exist_ok=True)
    tmp = BARCHARTS_META.with_name(BARCHARTS_META.name + ".tmp")
    tmp.write_text(json.dumps(meta), encoding="utf-8")
    os.replace(tmp, BARCHARTS_META)


def _file_path(region_code: str):
    # region_code has already passed the route's pattern; the path is one
    # segment inside BARCHARTS_DIR by construction.
    return BARCHARTS_DIR / f"{region_code}.txt"


def _store(region_code: str, content: bytes, filename: str) -> dict:
    uploaded_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    with _META_LOCK:
        BARCHARTS_DIR.mkdir(parents=True, exist_ok=True)
        _file_path(region_code).write_bytes(content)
        meta = _read_manifest_for_write()
        meta["counties"][region_code] = {"filename": filename, "uploadedAt": uploaded_at}
        _write_manifest(meta)
    return {"filename": filename, "uploadedAt": uploaded_at}


def _remove(region_code: str) -> None:
    with _META_LOCK:
        path = _file_path(region_code)
        if path.exists():
            path.unlink()
        meta = _read_manifest_for_write()
        meta["counties"].pop(region_code, None)
        _write_manifest(meta)


@router.get("/settings/barcharts")
def get_barcharts() -> dict:
    try:
        return _read_manifest_strict()
    except (OSError, ValueError):
        # UNKNOWN, never EMPTY: settings.py's "corrupt reads as empty" is a
        # recorded pre-existing weakness this route deliberately does not copy.
        raise HTTPException(status_code=500, detail="Could not read the bar-chart file list.")


@router.get("/settings/barcharts/{regionCode}")
def get_barchart(regionCode: str = Path(..., pattern=_REGION_PATTERN)) -> FileResponse:
    path = _file_path(regionCode)
    if not path.exists():
        raise HTTPException(status_code=404, detail="No bar-chart file stored for this county.")
    return FileResponse(path, media_type="text/plain; charset=utf-8")


@router.post("/settings/barcharts/{regionCode}")
async def upload_barchart(
    regionCode: str = Path(..., pattern=_REGION_PATTERN),
    file: UploadFile = File(...),
) -> dict:
    filename = file.filename or ""
    if not filename.lower().endswith(_ALLOWED_SUFFIXES):
        raise HTTPException(status_code=400, detail=_EXTENSION_MESSAGE)
    if _utf16_len(filename) > _FILENAME_MAX:
        raise HTTPException(status_code=400, detail=_FILENAME_MESSAGE)
    # The cap is read from the settings module at CALL time, so the one shared
    # 50 MB constant (twinned with lib/uploadGuard.ts MAX_UPLOAD_BYTES) governs
    # this route too, and a test can patch it down instead of posting 50 MB.
    max_bytes = settings_module.MAX_BYTES
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings_module._max_bytes_label()} limit.",
        )
    return await run_in_threadpool(_store, regionCode, content, filename)


@router.delete("/settings/barcharts/{regionCode}")
def delete_barchart(regionCode: str = Path(..., pattern=_REGION_PATTERN)) -> dict:
    _remove(regionCode)
    return {"ok": True}
