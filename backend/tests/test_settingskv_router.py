from urllib.parse import unquote

import pytest
from fastapi.testclient import TestClient

from routers import mapdefaults as mapdefaults_module
from routers import settings as settings_module
from routers import settingskv as settingskv_module
from main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def use_tmp_data(tmp_path, monkeypatch):
    monkeypatch.setattr(settingskv_module, "DATA_DIR", tmp_path)
    monkeypatch.setattr(settingskv_module, "SETTINGS_DIR", tmp_path / "settings")
    # Isolate the dedicated-route handlers' data dirs too, so the route-resolution
    # regression tests don't depend on the real repo data/ contents.
    monkeypatch.setattr(mapdefaults_module, "DATA_DIR", tmp_path)
    monkeypatch.setattr(mapdefaults_module, "MAP_DEFAULTS_FILE", tmp_path / "map-defaults.json")
    monkeypatch.setattr(settings_module, "DATA_DIR", tmp_path)
    monkeypatch.setattr(settings_module, "EBIRD_FILE", tmp_path / "ebird-backup.csv")
    monkeypatch.setattr(settings_module, "ML_FILE", tmp_path / "ml-export.csv")
    monkeypatch.setattr(settings_module, "META_FILE", tmp_path / "metadata.json")


# --- Round-trip: object value ---------------------------------------------

def test_object_value_roundtrips():
    blob = {"variant": "positron", "style": {"layers": [1, 2, 3]}, "savedAt": 1718841600000}
    resp = client.post("/settings/map-style-positron", json=blob)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}

    resp = client.get("/settings/map-style-positron")
    assert resp.status_code == 200
    assert resp.json() == blob


# --- Round-trip: scalar values --------------------------------------------

def test_scalar_bool_roundtrips():
    resp = client.post("/settings/welcomeSeen", json=True)
    assert resp.status_code == 200

    resp = client.get("/settings/welcomeSeen")
    assert resp.status_code == 200
    assert resp.json() is True


def test_scalar_string_roundtrips():
    client.post("/settings/dateFormat", json="iso")
    assert client.get("/settings/dateFormat").json() == "iso"


def test_scalar_number_roundtrips():
    client.post("/settings/map-zoom", json=7)
    assert client.get("/settings/map-zoom").json() == 7


# --- GET of unset key -> 404 ----------------------------------------------

def test_get_unset_key_404():
    resp = client.get("/settings/never-written")
    assert resp.status_code == 404


# --- POST overwrites -------------------------------------------------------

def test_post_overwrites():
    client.post("/settings/tab-layout", json=["a", "b"])
    client.post("/settings/tab-layout", json=["c"])
    assert client.get("/settings/tab-layout").json() == ["c"]


# --- DELETE ----------------------------------------------------------------

def test_delete_removes_value():
    client.post("/settings/map-base-layer", json="positron")
    resp = client.delete("/settings/map-base-layer")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}
    assert client.get("/settings/map-base-layer").status_code == 404


def test_delete_is_idempotent():
    # Deleting an absent key is a no-op success.
    resp = client.delete("/settings/never-existed")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


# --- Key sanitization (NFR-12) --------------------------------------------

def test_path_traversal_key_rejected_dotdot():
    # httpx/starlette normalizes a literal '..' segment in the path, so hit the
    # handler with an encoded traversal that survives routing.
    resp = client.get("/settings/..%2Fapi-keys")
    # Either the path doesn't match (404) or the key validator rejects it (422);
    # what matters is it never reads outside the settings dir.
    assert resp.status_code in (404, 422)


def test_key_with_slash_does_not_hit_generic_store():
    # A slash makes it a two-segment path; the single-segment {key} can't match,
    # so it can't traverse into another file via this route.
    resp = client.post("/settings/foo/bar", json=True)
    assert resp.status_code in (404, 405)


def test_invalid_char_key_rejected_422():
    resp = client.post("/settings/bad key with spaces", json=True)
    assert resp.status_code == 422
    # And GET of the same
    assert client.get("/settings/bad key with spaces").status_code == 422


def test_overlong_key_rejected_422():
    long_key = "a" * 129
    assert client.post(f"/settings/{long_key}", json=True).status_code == 422


# --- Anchor guard (backend-guard-anchor-parity, finding 1) -----------------
# `_key_path` used `_KEY_RE.match(key)`. Python's `$` matches BEFORE a trailing
# newline, so `"theme\n"` passed a guard written to shape-validate a value that
# becomes a FILENAME. `fullmatch` requires the whole string, which is the house
# form for the Python half of any shape guard (v0.5.87 anchor rule).
#
# NO SHARED FIXTURE HERE, deliberately. This key has no JS twin: the storage seam
# builds `/settings/{key}` from hardcoded keys and carries no shape guard of its
# own, so a cross-transport fixture would invent a parity that does not exist.
# The twinned guard in this change (the checklist id) does have one, in
# tests/test_checklist_id_parity.py.
#
# The newline rides in PERCENT-ENCODED in the request path (%0A), never as a
# literal character in this source, so the probe cannot be silently flattened
# into an ordinary space by an editor or a copy-paste. The decoded key each one
# produces is spelled out beside it, and the test at the bottom of this section
# asserts the decoded code point directly.

_TRAILING_NL_KEY = "theme%0A"       # decodes to "theme" + chr(10)
_TRAILING_NL_RESERVED = "keys%0A"   # decodes to "keys" + chr(10)


def test_trailing_newline_key_rejected_422():
    """The discriminating case. Under `.match()` this returned 200 and wrote a
    SECOND settings file whose name carried a newline, beside the real one.
    Reverting `fullmatch` to `match` turns this red."""
    # Pin the probe: the key the handler sees really is a trailing U+000A, so a
    # future edit to the escape cannot quietly turn this into an ordinary key.
    assert unquote(_TRAILING_NL_KEY) == "theme" + chr(10)

    resp = client.post(f"/settings/{_TRAILING_NL_KEY}", json="dark")
    assert resp.status_code == 422
    assert client.get(f"/settings/{_TRAILING_NL_KEY}").status_code == 422
    assert client.delete(f"/settings/{_TRAILING_NL_KEY}").status_code == 422


def test_trailing_newline_key_writes_no_file(tmp_path):
    """The harm, asserted at the filesystem rather than at the status code: a
    422 that still wrote the file would pass the test above."""
    assert client.post(f"/settings/{_TRAILING_NL_KEY}", json="dark").status_code == 422
    settings_dir = tmp_path / "settings"
    written = [p.name for p in settings_dir.iterdir()] if settings_dir.exists() else []
    assert written == [], written
    assert not any(chr(10) in name for name in written)

    # ...and the un-suffixed key still round-trips into exactly ONE file.
    assert client.post("/settings/theme", json="dark").status_code == 200
    assert client.get("/settings/theme").json() == "dark"
    assert sorted(p.name for p in settings_dir.iterdir()) == ["theme.json"]


def test_trailing_newline_no_longer_bypasses_the_reserved_key_guard():
    """`_RESERVED_KEYS` is defense-in-depth against a future route reorder, and
    the anchor bug walked straight past it: `POST /settings/keys%0A` returned 200
    where `POST /settings/keys` 404s. Both forms must now agree."""
    assert client.post(f"/settings/{_TRAILING_NL_RESERVED}", json=True).status_code == 422
    # The un-suffixed form it must now agree with. POST is not a dedicated route
    # (apikeys owns GET /settings/keys and POST /settings/keys/{key_name}), so it
    # falls through to this store and is refused by _RESERVED_KEYS.
    assert client.post("/settings/keys", json=True).status_code == 404

    # RECORDED, out of scope, and benign: Starlette compiles its OWN route
    # regexes with a `$` too, so "/settings/keys" + chr(10) still matches the
    # dedicated apikeys GET rather than reaching this store at all. That is why
    # the assertions above are on POST. Those dedicated handlers read and write
    # FIXED filenames and never interpolate the path, so no key shape reaches a
    # filename through them; asserted here so a later reader sees this was looked
    # at rather than mistaking it for this guard still leaking.
    assert client.get(f"/settings/{_TRAILING_NL_RESERVED}").status_code == 200
    assert set(client.get(f"/settings/{_TRAILING_NL_RESERVED}").json()) == {"ebird", "openweather"}


def test_leading_and_embedded_newline_keys_still_rejected():
    """These already failed under `.match()` (a `$` only forgives a TRAILING
    newline) and must keep failing. They are coverage, not discrimination: this
    test cannot go red on a revert, which is why the two above exist."""
    for key in ("%0Atheme", "th%0Aeme", "theme%0A%0A", "theme%0D", "theme%0D%0A"):
        assert client.post(f"/settings/{key}", json=True).status_code == 422, key


def test_valid_keys_are_untouched_by_the_anchor_fix():
    """Every shape the guard was always meant to admit still round-trips."""
    for key in ("theme", "a", "map-style-positron", "replay.v2_store", "A1._-", "a" * 128):
        assert client.post(f"/settings/{key}", json={"k": key}).status_code == 200, key
        assert client.get(f"/settings/{key}").json() == {"k": key}, key


def test_the_character_class_half_was_ALREADY_correct_on_this_key():
    """These two findings are separate defects, and this is the evidence.

    The checklist-id guard used a Unicode-aware `\\d` and admitted Arabic-Indic
    digits; `_KEY_RE` has always spelled its class out as explicit ASCII, so a
    non-ASCII digit was rejected both before and after the anchor fix. Swapping
    the class here changes nothing, exactly as swapping the anchor changes
    nothing on weather/tide (asserted in test_checklist_id_parity.py).

    U+0660..U+0662 are Arabic-Indic 012, written as escapes so a flattened
    literal fails rather than quietly becoming ASCII."""
    arabic_indic = "\u0660\u0661\u0662"
    assert [ord(c) for c in arabic_indic] == [0x0660, 0x0661, 0x0662]
    assert client.post(f"/settings/theme{arabic_indic}", json=True).status_code == 422
    assert client.post(f"/settings/{arabic_indic}", json=True).status_code == 422
    # A fullwidth digit is a second Nd block, rejected the same way.
    assert client.post("/settings/theme\uff10", json=True).status_code == 422


# --- Reserved-key guard ----------------------------------------------------

def test_reserved_key_keys_not_owned_by_generic_store():
    # GET /settings/keys must hit the DEDICATED apikeys handler, never this store.
    # (The dedicated handler returns the api-key slots dict, status 200.)
    resp = client.get("/settings/keys")
    assert resp.status_code == 200
    body = resp.json()
    assert "ebird" in body and "openweather" in body  # api-keys shape, not a stored value


# --- Body validation -------------------------------------------------------

def test_non_json_body_rejected_422():
    resp = client.post(
        "/settings/somekey",
        content=b"not json at all",
        headers={"content-type": "text/plain"},
    )
    assert resp.status_code == 422


# --- Route-resolution regression (QA-31 / QA-34) --------------------------
# After settingskv is registered as the final router, the specific /settings/*
# routes must STILL reach their dedicated handlers (a generic {key} registered
# first would shadow them).

def test_settings_keys_hits_apikeys_handler():
    resp = client.get("/settings/keys")
    assert resp.status_code == 200
    assert set(resp.json().keys()) == {"ebird", "openweather"}


def test_settings_files_hits_settings_handler():
    resp = client.get("/settings/files")
    assert resp.status_code == 200
    # The dedicated metadata handler returns the two-slot metadata shape.
    body = resp.json()
    assert "ebird" in body and "ml" in body


def test_settings_files_ebird_hits_dedicated_handler():
    # No eBird backup uploaded in the test data dir -> the dedicated GET returns
    # 404 (its own "no file stored"), NOT a generic-store 404 for a key 'ebird'.
    resp = client.get("/settings/files/ebird")
    assert resp.status_code == 404


def test_settings_map_defaults_hits_dedicated_handler():
    # The dedicated map-defaults GET returns 404 when none stored — proving the
    # generic store did not shadow it (a generic {key='map-defaults'} would 404
    # via the reserved-key guard too, but this confirms the literal route wins).
    resp = client.get("/settings/map-defaults")
    assert resp.status_code == 404


def test_generic_key_still_served_after_specific_routes():
    # A genuinely generic key round-trips through the new store.
    client.post("/settings/some-generic-key", json={"x": 1})
    assert client.get("/settings/some-generic-key").json() == {"x": 1}
    assert client.get("/settings/another-unset-generic").status_code == 404
