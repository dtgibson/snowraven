"""Single source of truth for the on-disk data directory.

Four routers (``settings``, ``settingskv``, ``mapdefaults``, ``taxonomy``) each
used to derive ``Path(__file__).resolve().parent.parent.parent / "data"``
independently. They now all import ``DATA_DIR`` from here, so the location is
defined once and an override cannot cover some of them and miss others (a
partial override is worse than none: the app would read demo data from one
route and real data from the next).

``SR_DATA_DIR`` overrides the location. The default is unchanged
(``<repo root>/data``), so normal use — ``start.sh``, ``uvicorn``, the desktop
app, the test suite — behaves exactly as before.

The override exists for the website screenshot tooling (``website/tools``),
which must drive the app against the SYNTHETIC demo dataset. Without it, the
documented procedure was to ``mv`` the user's real eBird export aside and move
it back afterwards, which strands real data if a capture crashes partway. An
env var needs no swap, so the real ``data/`` is never touched at all.

Note this is resolved once, at import. The data directory is process-wide
configuration, not a per-request input; nothing in the app reassigns it (the
backend tests monkeypatch each router's own module-level ``DATA_DIR``, which
keeps working unchanged).

``SR_DATA_DIR`` must be set in the process environment BEFORE the backend
starts. Putting it in ``backend/.env`` does nothing: the routers import this
module while ``main`` is still being imported, which is before ``load_dotenv()``
runs, so the value is read from ``os.environ`` and never seen. This fails
silently — the app just uses the default directory — so a capture run that set
it the wrong way would quietly photograph the real data it was meant to avoid.
That import order is also why a file write can never redirect the data root,
which is the security-positive half of the same fact; keep it that way.
"""

import os
from pathlib import Path

# <repo root>/data — this file lives at backend/datadir.py, so parent.parent
# is the repo root.
DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# Env var name, exported so tooling and tests can refer to it by symbol.
DATA_DIR_ENV_VAR = "SR_DATA_DIR"


def resolve_data_dir() -> Path:
    """The data directory: ``$SR_DATA_DIR`` if set and non-blank, else the default."""
    override = os.environ.get(DATA_DIR_ENV_VAR, "").strip()
    if not override:
        return DEFAULT_DATA_DIR
    return Path(override).expanduser().resolve()


DATA_DIR = resolve_data_dir()
