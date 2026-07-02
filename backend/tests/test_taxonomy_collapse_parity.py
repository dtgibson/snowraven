"""SHARED-FIXTURE PARITY TEST — the Python half of the dual-transport
taxonomy-collapse lockstep (mobile-prep-sweep tidy #1).

`routers/taxonomy.collapse_to_species_list` (web/Pi backend) and
`taxonomyService.collapseToSpeciesList` (desktop/Tauri) are twins kept "in
lockstep by comment" only. This test and its vitest sibling
(frontend/src/lib/taxonomyCollapse.parity.test.ts) both load the ONE shared
fixture (frontend/src/lib/taxonomyCollapse.fixture.json) and assert the SAME
species-level output, so if either twin drifts its own test fails.

The Python side derives the module dicts from the fixture's RAW eBird-shaped
taxonomy array via the router's own `_derive_from_taxonomy` (so the derivation is
under test too), applies them with `_apply_snapshot`, and calls the collapse with
NO network — the offline-floor primitives, exercised directly.

The fixture covers: plain species, issf-subspecies (reportAs -> species),
domestic subforms, spuh / slash / hybrid (no species parent -> dropped), and
duplicates (a repeated code + two subforms of one parent -> deduped, first-seen
taxonomic order preserved).
"""

import asyncio
import json
from pathlib import Path

import pytest

import routers.taxonomy as taxonomy_module

# The shared fixture lives beside the TS twin under frontend/src/lib/ (the
# weatherFormatter.golden.py precedent: cross-runtime shared assets resolve via
# __file__). backend/tests/ -> repo root -> frontend/src/lib/.
_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent.parent
    / "frontend" / "src" / "lib" / "taxonomyCollapse.fixture.json"
)


def _load_fixture() -> dict:
    return json.loads(_FIXTURE_PATH.read_text(encoding="utf-8"))


@pytest.fixture()
def loaded_from_fixture():
    """Populate the router's module dicts from the fixture's raw taxonomy via the
    router's OWN derivation, mark _loaded so no network path runs, and restore the
    prior module state afterward so other taxonomy tests are unaffected."""
    fx = _load_fixture()

    # Snapshot the module state so this test can't leak into the session-shared
    # module-level caches the other taxonomy tests reset themselves.
    saved = {
        "by_sci": dict(taxonomy_module._by_sci),
        "by_com": dict(taxonomy_module._by_com),
        "by_order": dict(taxonomy_module._by_order),
        "by_code": dict(taxonomy_module._by_code),
        "report_as": dict(taxonomy_module._report_as),
        "version": taxonomy_module._version,
        "loaded": taxonomy_module._loaded,
    }

    bundle = taxonomy_module._derive_from_taxonomy(fx["rawTaxonomy"])
    taxonomy_module._apply_snapshot(bundle)
    taxonomy_module._loaded = True  # no floor read, no network fetch

    try:
        yield fx
    finally:
        taxonomy_module._by_sci.clear()
        taxonomy_module._by_sci.update(saved["by_sci"])
        taxonomy_module._by_com.clear()
        taxonomy_module._by_com.update(saved["by_com"])
        taxonomy_module._by_order.clear()
        taxonomy_module._by_order.update(saved["by_order"])
        taxonomy_module._by_code.clear()
        taxonomy_module._by_code.update(saved["by_code"])
        taxonomy_module._report_as.clear()
        taxonomy_module._report_as.update(saved["report_as"])
        taxonomy_module._version = saved["version"]
        taxonomy_module._loaded = saved["loaded"]


def _collapse(codes):
    return asyncio.run(taxonomy_module.collapse_to_species_list(codes))


def test_collapse_matches_shared_fixture(loaded_from_fixture):
    """The whole fixture case: input codes -> the expected species-level list,
    byte-for-byte equal to what the TS twin asserts on the SAME fixture."""
    case = loaded_from_fixture["cases"]
    out = _collapse(case["inputCodes"])
    assert out == case["expected"]


def test_collapse_preserves_order_and_dedupes(loaded_from_fixture):
    case = loaded_from_fixture["cases"]
    out = _collapse(case["inputCodes"])
    assert [o["speciesCode"] for o in out] == ["amerob", "yerwar", "rocpig", "mallar3"]


def test_collapse_drops_spuh_slash_hybrid(loaded_from_fixture):
    case = loaded_from_fixture["cases"]
    out = _collapse(case["inputCodes"])
    codes = {o["speciesCode"] for o in out}
    assert "y00934" not in codes   # spuh
    assert "amwspa1" not in codes  # slash
    assert "x00001" not in codes   # hybrid


def test_collapse_issf_and_domestic_subforms(loaded_from_fixture):
    out = _collapse(["yerwar1", "rocpig1", "maldom1"])
    assert out == [
        {"speciesCode": "yerwar", "commonName": "Yellow-rumped Warbler"},
        {"speciesCode": "rocpig", "commonName": "Rock Pigeon"},
        {"speciesCode": "mallar3", "commonName": "Mallard"},
    ]


def test_collapse_all_non_countable_is_empty(loaded_from_fixture):
    assert _collapse(["y00934", "amwspa1", "x00001"]) == []


def test_collapse_empty_input_is_empty(loaded_from_fixture):
    assert _collapse([]) == []


def test_snapshot_matches_derivation(loaded_from_fixture):
    """The fixture's pre-derived `snapshot` (what the TS bundle floor consumes)
    must equal the router's derivation of the same rawTaxonomy — so the two forms
    the fixture carries can never silently disagree."""
    fx = loaded_from_fixture
    derived = taxonomy_module._derive_from_taxonomy(fx["rawTaxonomy"])
    snap = fx["snapshot"]
    for key in ("bySci", "byCom", "byOrder", "byCode", "reportAs"):
        assert derived[key] == snap[key], f"{key} drift between rawTaxonomy derivation and snapshot"
