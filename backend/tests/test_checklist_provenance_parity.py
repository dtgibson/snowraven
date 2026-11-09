"""SHARED-FIXTURE PARITY TEST — the Python half of the dual-transport
exotic-provenance lockstep (escapee-count-toggle, schema.md 11.4, FR-39, QA-44).

`services.ebird._norm_token` applied to exoticCategory/userDoNotCount (web/Pi
backend) and `lib/tauri/checklistService.normalizeProvenancePair`
(desktop/Tauri) are twins kept in lockstep by comment only. This test and its
vitest sibling (frontend/src/lib/checklistProvenance.parity.test.ts) both load
the ONE shared fixture (frontend/src/lib/checklistProvenance.fixture.json) and
assert the SAME normalized pair, so if either twin drifts its own test fails.

THE TRAP THIS EXISTS FOR (v0.5.54). A pydantic/rust-regex `\\d` matches Unicode
decimal digits, so `US-CA-٠١٢` passed a pattern whose JS twin rejected it. Both
sides therefore write EXPLICIT ASCII CLASSES ([A-Z]), and the fixture carries an
Arabic-Indic digit run and a Cyrillic capital so a regression to `\\w`/`\\d`
turns THIS test red rather than reaching a user's data.

Both halves are driven through their SHIPPED code, never a retyped copy of the
pattern.
"""

import json
from pathlib import Path

from services.ebird import _DNC_RE, _EXOTIC_RE, _norm_token

_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "lib" / "checklistProvenance.fixture.json"
)


def _cases():
    with _FIXTURE.open(encoding="utf-8") as fh:
        return json.load(fh)["cases"]


def _normalize(obs):
    """The exact projection routers/checklists.py carries through, built from the
    service's own normalization of the raw observation."""
    return {
        "exoticCategory": _norm_token(obs.get("exoticCategory"), _EXOTIC_RE),
        "userDoNotCount": _norm_token(obs.get("userDoNotCount"), _DNC_RE),
    }


def test_every_shared_fixture_case_normalizes_to_the_expected_pair():
    for case in _cases():
        assert _normalize(case["obs"]) == case["expected"], case["why"]


def test_fixture_still_carries_the_discriminating_cases():
    """Non-vacuity: a fixture that had quietly lost its hostile rows would still
    pass the loop above."""
    cats = [c["obs"].get("exoticCategory") for c in _cases()]
    assert "٠١٢" in cats          # Arabic-Indic 012
    assert "Х" in cats                       # Cyrillic capital Ha
    assert any(not isinstance(v, str) for v in cats)
    for v in ("X", "N", "P", "Q"):
        assert v in cats
    # ANCHOR parity, not just class parity. Matching character classes are only
    # half of it: Python's `$` matches BEFORE a trailing newline and
    # JavaScript's does not, so `re.match` accepted "X\n" where `.test()`
    # rejected it, and the divergence was invisible to every row above.
    assert "X\n" in cats
    assert "\nX" in cats
    assert "X\nN" in cats
    assert len(cats) >= 15


def test_unicode_digits_and_letters_are_rejected_on_this_transport_too():
    """The direct form of the v0.5.54 guard. A rewrite to `\\w` or `\\d` would
    make these pass here while the JS twin keeps rejecting them, which is exactly
    the divergence the shared fixture exists to catch."""
    assert _norm_token("Х", _EXOTIC_RE) == ""            # Cyrillic Ha
    assert _norm_token("٠١٢", _EXOTIC_RE) == ""  # Arabic-Indic digits
    assert _norm_token("X", _EXOTIC_RE) == "X"
    assert _norm_token("DNC", _DNC_RE) == "DNC"


def test_anchors_agree_with_the_js_twin_on_newline_shapes():
    """The direct form of the anchor guard, and the reason the module uses
    `fullmatch` rather than `match`.

    Python's `$` matches before a trailing newline, so `_EXOTIC_RE.match("X\n")`
    succeeds while its JS twin's `.test("X\n")` does not. The token counted on
    both transports either way, so no species could be wrongly dropped; the harm
    was that "X\n" then failed the persisted store's own SEEN_TOKEN_RE on
    reload, silently discarding the whole species record and re-fetching it every
    session on web/Pi.

    Reverting `_norm_token` to `.match()` turns this red."""
    assert _norm_token("X\n", _EXOTIC_RE) == ""
    assert _norm_token("DNC\n", _DNC_RE) == ""
    assert _norm_token("\nX", _EXOTIC_RE) == ""
    assert _norm_token("X\nN", _EXOTIC_RE) == ""
    # ...and the valid values are untouched by the change.
    assert _norm_token("X", _EXOTIC_RE) == "X"
    assert _norm_token("DNC", _DNC_RE) == "DNC"


def test_a_rejected_value_normalizes_to_empty_which_counts():
    """The failure direction is the safe one: '' counts under FR-01, so a
    malformed response can never silently remove a species from a life list."""
    for case in _cases():
        out = _normalize(case["obs"])
        assert out["exoticCategory"] in ("", "X", "N", "P", "Q")


# ── ebird-request-economy (decisions.md D-02), extended by ebird-store-hygiene:
# whole answer bodies ──────────────────────────────────────────────────────────
#
# The fixture's `answers` rows are whole checklist/view bodies eBird answered
# with HTTP 200. Driven through the SHIPPED route (TestClient over the real
# handler and service, the outbound client faked with REAL httpx responses over
# each row's bytes), so the verdict is exactly what the escapee check and the
# List Comparer receive on web/Pi. The JS twin drives the shipped desktop
# service over the same rows.

from unittest.mock import AsyncMock, patch  # noqa: E402

import httpx  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import routers.taxonomy as taxonomy_module  # noqa: E402
from main import app  # noqa: E402

_client = TestClient(app)

_FAKE_TAXONOMY = [
    {"speciesCode": "amerob", "comName": "American Robin", "sciName": "Turdus migratorius",
     "taxonOrder": 27616, "category": "species"},
]


@pytest.fixture
def isolated_taxonomy(tmp_path, monkeypatch):
    """The same isolation as test_checklists_router.py: the taxonomy refresh
    persists a disk twin, which must never land in the real repo data/ dir."""
    monkeypatch.setattr(taxonomy_module, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(taxonomy_module, "_DISK", tmp_path / "data" / "taxonomy.json")
    monkeypatch.setattr(taxonomy_module, "_STATIC", tmp_path / "staticdata" / "ebird_taxonomy.json")
    monkeypatch.setattr(taxonomy_module, "_MIN_ENTRIES", 1)
    monkeypatch.setenv("EBIRD_API_KEY", "test-key")
    for d in (taxonomy_module._by_sci, taxonomy_module._by_com, taxonomy_module._by_order,
              taxonomy_module._by_code, taxonomy_module._report_as):
        d.clear()
    taxonomy_module._loaded = False


def _resp(content: bytes, status=200):
    return httpx.Response(status, content=content, request=httpx.Request("GET", "https://api.ebird.org/v2/x"))


def _bytes_of(row) -> bytes:
    """The exact bytes eBird answered with: `hex` as given, `text` in UTF-8,
    else `body` as JSON."""
    if "hex" in row:
        return bytes.fromhex(row["hex"])
    if "text" in row:
        return row["text"].encode("utf-8")
    return json.dumps(row["body"]).encode("utf-8")


def _answer(content, fields, urls):
    async def fake_get(url, *args, **kwargs):
        urls.append(url)
        if "/product/checklist/view/" in url:
            return _resp(content)
        if "/ref/region/info/" in url:
            return _resp(json.dumps({"result": "Somewhere"}).encode())
        if "/ref/taxonomy/ebird" in url:
            return _resp(json.dumps(_FAKE_TAXONOMY).encode())
        return _resp(b"{}", status=404)

    shared = AsyncMock()
    shared.get = AsyncMock(side_effect=fake_get)
    path = "/checklists/S12345678" + (f"?fields={fields}" if fields else "")
    with patch("services.ebird.get_client", return_value=shared), \
         patch("routers.taxonomy.get_client", return_value=shared):
        return _client.get(path)


def _answers():
    with _FIXTURE.open(encoding="utf-8") as fh:
        return json.load(fh)["answers"]


def test_every_answer_body_reaches_the_shared_verdict(isolated_taxonomy):
    for row in _answers():
        resp = _answer(_bytes_of(row), row["fields"], [])
        got = {"status": resp.status_code}
        if resp.status_code == 200:
            species = resp.json()["species"]
            got["species"] = len(species)
            if "first" in row["expected"]:
                got["first"] = {"breedingCode": species[0]["breedingCode"], "media": species[0]["media"]}
        assert got == row["expected"], row["why"]


def test_a_refused_body_is_the_routes_own_502_and_costs_no_second_request(isolated_taxonomy):
    for row in _answers():
        if row["expected"]["status"] != 502:
            continue
        urls = []
        resp = _answer(_bytes_of(row), row["fields"], urls)
        assert resp.status_code == 502, row["why"]
        # ONE fixed wording for every refused shape, written here as a literal:
        # never the decoder's, the interpreter's or the body's own text.
        assert resp.json()["detail"] == (
            "Could not fetch checklist: eBird's answer could not be read"
        ), row["why"]
        # The location-name lookup is never reached for a body the route refuses.
        assert len(urls) == 1, row["why"]


def _object_body(row):
    body = row.get("body")
    return body if isinstance(body, dict) else None


def _first_photo(row):
    """The raw `mediaCounts.P` of a row's first observation, or None when the
    row has no such value (any other shape)."""
    obs = (_object_body(row) or {}).get("obs")
    first = obs[0] if isinstance(obs, list) and obs and isinstance(obs[0], dict) else {}
    mc = first.get("mediaCounts")
    return mc.get("P") if isinstance(mc, dict) else None


def test_the_answer_rows_still_discriminate():
    failed = [r for r in _answers() if r["expected"]["status"] == 502]
    answered = [r for r in _answers() if r["expected"]["status"] == 200]
    assert len(failed) >= 8
    failed_obs = [
        ("NO OBJECT BODY" if _object_body(r) is None else r["body"].get("obs", "ABSENT"))
        for r in failed if "body" in r
    ]
    # Each falsy non-list `data.get("obs") or []` used to turn into an empty answer.
    for v in ("ABSENT", None, "", 0, False):
        assert any(o == v and type(o) is type(v) for o in failed_obs), v
    assert any(r["fields"] == "provenance" and (_object_body(r) or {}).get("obs") == [] for r in answered)
    assert any(r["fields"] == "projects" and _object_body(r) is not None
               and not isinstance(r["body"].get("obs"), list) for r in answered)
    # ebird-store-hygiene: the rows that separate the twins. A list item in an
    # observation list (`typeof [] === 'object'` in JS), a list body under
    # fields=projects, NaN (which json.loads accepts), bytes that are not
    # UTF-8, a dict in the breeding fallback `or` and `??` read differently,
    # and a bool media count (`isinstance(True, int)`).
    items = [o for r in failed for o in ((_object_body(r) or {}).get("obs") or [])
             if isinstance((_object_body(r) or {}).get("obs"), list)]
    assert any(isinstance(o, list) for o in items)
    assert any(o is None for o in items)
    assert any(r["fields"] == "projects" and isinstance(r.get("body"), list) for r in failed)
    assert any("NaN" in r.get("text", "") for r in failed)
    assert any("hex" in r for r in failed) and any("hex" in r for r in answered)
    assert any(r["expected"].get("first", {}).get("breedingCode") == "S" for r in answered)
    photos = [_first_photo(r) for r in answered if "first" in r["expected"]]
    assert any(p is True for p in photos)


def test_the_media_count_bound_is_the_fixtures_boundary_pair():
    """The JS twin declares the same bound again (`MEDIA_COUNT_MAX` in
    checklistService.ts); the pair of rows at the bound and one past it is what
    compares the two declarations, through both shipped paths."""
    from services.ebird import MEDIA_COUNT_MAX
    photos = [_first_photo(r) for r in _answers() if "first" in r["expected"]]
    assert MEDIA_COUNT_MAX in photos
    assert MEDIA_COUNT_MAX + 1 in photos
