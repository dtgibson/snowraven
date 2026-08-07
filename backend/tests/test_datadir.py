"""The shared data directory and its SR_DATA_DIR override (see backend/datadir.py).

The consistency test at the bottom is the one that matters. Four routers touch
``data/``; before this they each derived the path independently, so an override
could silently reach some and miss others — the app would then read demo data on
one route and real data on the next. The guard asserts every consumer resolves
through the one module, so a future router that re-derives its own path fails here.
"""

from pathlib import Path

import datadir
from routers import mapdefaults as mapdefaults_module
from routers import settings as settings_module
from routers import settingskv as settingskv_module
from routers import taxonomy as taxonomy_module

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def test_default_is_repo_root_data(monkeypatch):
    """Unset SR_DATA_DIR keeps the historical <repo root>/data location."""
    monkeypatch.delenv(datadir.DATA_DIR_ENV_VAR, raising=False)
    assert datadir.resolve_data_dir() == REPO_ROOT / "data"
    assert datadir.DEFAULT_DATA_DIR == REPO_ROOT / "data"


def test_env_override_is_honored(tmp_path, monkeypatch):
    monkeypatch.setenv(datadir.DATA_DIR_ENV_VAR, str(tmp_path))
    assert datadir.resolve_data_dir() == tmp_path.resolve()


def test_blank_override_falls_back_to_default(monkeypatch):
    """An empty or whitespace-only value must not resolve to the CWD."""
    for blank in ("", "   ", "\t"):
        monkeypatch.setenv(datadir.DATA_DIR_ENV_VAR, blank)
        assert datadir.resolve_data_dir() == datadir.DEFAULT_DATA_DIR


def test_relative_override_is_resolved_absolute(tmp_path, monkeypatch):
    """A relative override is made absolute, so it can't drift with the CWD."""
    monkeypatch.setenv(datadir.DATA_DIR_ENV_VAR, "demo-data")
    resolved = datadir.resolve_data_dir()
    assert resolved.is_absolute()


def test_every_data_consumer_shares_one_data_dir():
    """All four routers resolve data/ through datadir — no independent derivations.

    This is the property that makes the override safe: a partial override would be
    worse than none.
    """
    for module in (
        settings_module,
        settingskv_module,
        mapdefaults_module,
        taxonomy_module,
    ):
        assert module.DATA_DIR == datadir.DATA_DIR, (
            f"{module.__name__} does not use the shared DATA_DIR"
        )


def test_derived_paths_sit_under_the_shared_data_dir():
    """The per-router file constants are built from the shared directory."""
    assert settings_module.EBIRD_FILE.parent == datadir.DATA_DIR
    assert settings_module.ML_FILE.parent == datadir.DATA_DIR
    assert settings_module.META_FILE.parent == datadir.DATA_DIR
    assert settingskv_module.SETTINGS_DIR.parent == datadir.DATA_DIR
    assert mapdefaults_module.MAP_DEFAULTS_FILE.parent == datadir.DATA_DIR
    assert taxonomy_module._DISK.parent == datadir.DATA_DIR
