"""Generic key/value settings store (FR-41/FR-42).

Backs the storage seam's generic ``GET/POST/DELETE /settings/{key}`` calls on
web/Pi. Each key gets its OWN file under ``data/settings/<key>.json`` so a large
or partial blob write (persisted map style, replay store) can never corrupt the
shared scalar ``settings.json`` — the FR-42 isolation requirement.

Mirrors ``mapdefaults.py``'s repo-root ``data/`` convention. The raw JSON body
is stored verbatim (any JSON value — bool, string, number, object), NOT a fixed
Pydantic model, so a bare ``true`` and a multi-KB style object share one route.

Route ordering is LOAD-BEARING: this generic ``/settings/{key}`` MUST be the
final ``include_router`` in ``main.py`` (after apikeys/mapdefaults/settings) or a
``{key}`` match would silently shadow ``/settings/keys`` / ``/settings/files`` /
``/settings/map-defaults``. The reserved-key guard below is defense-in-depth so a
future reorder still can't clobber those typed handlers.
"""

import json
import re
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool

# Repo-root data/ dir — the established convention, NOT backend/data/. Shared
# via datadir.py so the SR_DATA_DIR override reaches every data/ consumer.
from datadir import DATA_DIR

router = APIRouter()

SETTINGS_DIR = DATA_DIR / "settings"

# NFR-12/QA-39: shape-validate the key before it touches a path — blocks
# `..`/`/` traversal into the CSVs, api-keys.json, or settings.json.
#
# The character class is already EXPLICIT ASCII, so the v0.5.54 rule (never `\d`
# / `\w` on the Python half of a twinned guard) is satisfied and this pattern is
# NOT a twin of anything on the JS side — the storage seam builds `/settings/{key}`
# from hardcoded keys and carries no shape guard of its own.
_KEY_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")

# Defense-in-depth: never let the free-form store answer for a key that has a
# dedicated typed handler (route order already protects these when correct).
_RESERVED_KEYS = {"keys", "files", "map-defaults"}

# Server-side payload backstop (the client caps replay/style well below this).
_MAX_BYTES = 16 * 1024 * 1024  # ~16 MB


def _key_path(key: str) -> Path:
    # `fullmatch`, NEVER `.match()`: Python's `$` matches BEFORE a trailing
    # newline, so `_KEY_RE.match("theme\n")` succeeded and this guard admitted a
    # key it was written to exclude — `POST /settings/theme%0A` returned 200 and
    # wrote a second file `theme\n.json` beside `theme.json`, and
    # `POST /settings/keys%0A` slipped past the _RESERVED_KEYS check below where
    # the un-suffixed form 404s. No traversal was ever reachable (`..` and `a/b`
    # are rejected upstream by routing), but a shape guard on a value that
    # becomes a FILENAME has to mean what it says. `fullmatch` requires the whole
    # string, so the newline is unconsumed and the key is rejected; it is the
    # house form for the Python half of any shape guard (v0.5.87 anchor rule).
    #
    # The DELIBERATE CARVE-OUT beside that rule: pydantic `pattern=` constraints
    # (routers/map.py, routers/media.py) run on the Rust regex engine, which
    # rejects a trailing newline already. Do NOT "fix" those toward `fullmatch`.
    if not _KEY_RE.fullmatch(key):
        raise HTTPException(status_code=422, detail="Invalid settings key.")
    if key in _RESERVED_KEYS:
        # 404 — this generic store does not own reserved keys.
        raise HTTPException(status_code=404, detail="Not found.")
    return SETTINGS_DIR / f"{key}.json"


@router.get("/settings/{key}")
def get_setting(key: str):
    path = _key_path(key)
    if not path.exists():
        # The storage seam treats !ok (404) as null.
        raise HTTPException(status_code=404, detail="No value stored.")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        raise HTTPException(status_code=500, detail="Could not read setting.")


@router.post("/settings/{key}")
async def save_setting(key: str, request: Request):
    path = _key_path(key)

    raw = await request.body()
    if len(raw) > _MAX_BYTES:
        raise HTTPException(status_code=413, detail="Payload too large.")

    try:
        value = json.loads(raw)
    except Exception:
        raise HTTPException(status_code=422, detail="Body must be valid JSON.")

    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    # Offload the write off the event loop (payloads up to ~16 MB); identical
    # on-disk result. run_in_threadpool forwards the encoding kwarg.
    await run_in_threadpool(path.write_text, json.dumps(value), encoding="utf-8")
    return {"ok": True}


@router.delete("/settings/{key}")
def delete_setting(key: str):
    path = _key_path(key)
    # Idempotent unlink — deleting an absent key is a no-op success.
    if path.exists():
        path.unlink()
    return {"ok": True}
