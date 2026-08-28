"""SHARED-FIXTURE PARITY TEST — the Python half of the dual-transport projects
lockstep (county-shading-and-project-stats, schema.md B.1/B.2, FR-24, FR-25,
NFR-12, QA-25, QA-26).

`services.ebird._norm_project_fields` / `checklist_field_flags` (web/Pi) and
`normalizeProjectFields` / `checklistFieldFlags` (desktop) are twins kept in
lockstep by comment only. This test and its vitest sibling
(frontend/src/lib/checklistProjects.parity.test.ts) both load the ONE shared
fixture (frontend/src/lib/checklistProjects.fixture.json) and assert the SAME
output, so if either twin drifts its own test fails.

THE TWO TRAPS THIS EXISTS FOR, both of which are live on THIS side:

  1. ANCHORS (v0.5.87). Python's `$` matches BEFORE a trailing newline, so
     `re.match(r"^[A-Z0-9_]{1,32}$", "EBIRD\\n")` succeeds where the JS
     `.test()` twin fails. `fullmatch` is what makes them agree, and the
     newline rows are what hold it.
  2. `isinstance(True, int)` is True, so a bare int check would normalize
     `projectIds: [True]` to `[1]` and invent a project id eBird never sent.
     JavaScript rejects a boolean for free.

Plus the v0.5.54 class trap: a `\\d`/`\\w` pattern matches Unicode digits here
and ASCII only in JS, so the fixture carries an Arabic-Indic run.

Both halves are driven through their SHIPPED code, never a retyped pattern.
"""

import json
from pathlib import Path

import pytest

from services.ebird import (
    MAX_PROJECT_IDS,
    PROJECT_ID_MAX,
    _norm_project_fields,
    checklist_field_flags,
)

_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "lib" / "checklistProjects.fixture.json"
)


def _fixture():
    with _FIXTURE.open(encoding="utf-8") as fh:
        return json.load(fh)


_DATA = _fixture()


def test_every_shared_fixture_proj_id_normalizes_to_the_expected_string():
    for row in _DATA["projIdRows"]:
        proj, _ = _norm_project_fields(row.get("value"), [])
        assert proj == row["expected"], row["why"]


def test_every_shared_fixture_project_ids_normalizes_to_the_expected_array():
    for row in _DATA["projectIdsRows"]:
        _, ids = _norm_project_fields("", row.get("value"))
        assert ids == row["expected"], row["why"]


def test_every_shared_fixture_fields_flag_pair_matches():
    for row in _DATA["fieldFlagRows"]:
        assert checklist_field_flags(row["fields"]) == (
            row["skipLocName"], row["skipSpecies"],
        ), row["why"]


# ── Non-vacuity, per block ───────────────────────────────────────────────────
# A fixture that had quietly lost its hostile rows would still pass every loop
# above. One assertion for the whole is not one assertion per part.

def test_the_proj_id_block_still_carries_the_discriminating_rows():
    values = [r.get("value") for r in _DATA["projIdRows"]]
    assert "EBIRD\n" in values          # the anchor trap
    assert "\nEBIRD" in values
    assert "EBIRD\nX" in values
    assert "٠١٢" in values              # the class trap (v0.5.54)
    assert any(isinstance(v, int) and not isinstance(v, bool) for v in values)
    assert any(isinstance(v, bool) for v in values)
    assert any(isinstance(v, str) and len(v) == 32 for v in values)
    assert any(isinstance(v, str) and len(v) == 33 for v in values)
    for v in ("EBIRD", "EBIRD_MERLIN", "EBIRD_ATL_CA"):
        assert v in values
    assert len(values) >= 15


def test_the_project_ids_block_still_carries_the_discriminating_rows():
    rows = [r.get("value") for r in _DATA["projectIdsRows"]]
    lists = [v for v in rows if isinstance(v, list)]
    # The bool trap, in the two shapes that separate a correct guard from a
    # bare int check. `True in [...]` would also match a 1, so compare types.
    assert any(any(isinstance(e, bool) for e in v) for v in lists)
    assert any(
        any(isinstance(e, bool) for e in v) and 1050 in v for v in lists
    )
    # The coercion trap: a string element must be REJECTED, and the non-ASCII
    # digit string is its live form.
    assert any("1050" in [e for e in v if isinstance(e, str)] for v in lists)
    assert any("١٠٥٠" in [e for e in v if isinstance(e, str)] for v in lists)
    # Both bounds, each at and over its limit.
    assert any(PROJECT_ID_MAX in v for v in lists)
    assert any(PROJECT_ID_MAX + 1 in v for v in lists)
    assert any(len(v) == MAX_PROJECT_IDS for v in lists)
    assert any(len(v) == MAX_PROJECT_IDS + 1 for v in lists)
    assert len(rows) >= 15


def test_the_fields_block_still_carries_every_value_both_transports_must_agree_on():
    values = [r["fields"] for r in _DATA["fieldFlagRows"]]
    for v in (None, "", "provenance", "projects", "PROJECTS", "projects,provenance", "bogus"):
        assert v in values
    assert "projects\n" in values


# ── Mutation guards, in the forms the defect could actually return in ────────

def test_anchors_agree_with_the_js_twin_on_newline_shapes():
    """The direct form of the anchor guard and the reason `_PROJ_ID_RE` is used
    with `fullmatch`. Reverting to `.match()` turns this red."""
    assert _norm_project_fields("EBIRD\n", [])[0] == ""
    assert _norm_project_fields("\nEBIRD", [])[0] == ""
    assert _norm_project_fields("EBIRD\nX", [])[0] == ""
    assert _norm_project_fields("EBIRD", [])[0] == "EBIRD"


def test_unicode_digits_are_rejected_on_this_transport_too():
    """A rewrite to `\\w`/`\\d` would make these pass here while the JS twin keeps
    rejecting them, which is exactly the v0.5.54 divergence."""
    assert _norm_project_fields("٠١٢", [])[0] == ""
    assert _norm_project_fields("ebird", [])[0] == ""
    assert _norm_project_fields("EBIRD_ATL_CA", [])[0] == "EBIRD_ATL_CA"


def test_a_boolean_element_is_rejected_not_counted_as_the_integer_one():
    """`isinstance(True, int)` is True, so dropping the explicit bool exclusion
    normalizes [True] to [1] here while JS still returns []. That would invent a
    project id eBird never sent."""
    assert _norm_project_fields("", [True])[1] == []
    assert _norm_project_fields("", [False])[1] == []
    assert _norm_project_fields("", [True, 1050])[1] == [1050]


def test_a_string_element_is_rejected_outright_never_coerced():
    """`int("١٠٥٠")` is 1050 under BOTH runtimes, so a coercing guard would admit
    a non-ASCII-digit string as a real project id."""
    assert _norm_project_fields("", ["1050"])[1] == []
    assert _norm_project_fields("", ["١٠٥٠"])[1] == []


def test_both_bounds_hold_at_and_over_their_limit():
    assert _norm_project_fields("", [PROJECT_ID_MAX])[1] == [PROJECT_ID_MAX]
    assert _norm_project_fields("", [PROJECT_ID_MAX + 1])[1] == []
    over = list(range(1, MAX_PROJECT_IDS + 2))
    assert len(_norm_project_fields("", over)[1]) == MAX_PROJECT_IDS
    assert _norm_project_fields("A" * 33, [])[0] == ""
    assert _norm_project_fields("A" * 32, [])[0] == "A" * 32


def test_fields_stays_whole_string_equality_never_a_comma_split():
    assert checklist_field_flags("projects,provenance") == (False, False)
    assert checklist_field_flags("provenance,projects") == (False, False)
    assert checklist_field_flags("provenance") == (True, False)
    assert checklist_field_flags("projects") == (True, True)


@pytest.mark.parametrize("hostile", ["__proto__", "constructor", "toString"])
def test_prototype_chain_names_are_ordinary_rejected_strings_here(hostile):
    """The JS twin reads its label table through Object.hasOwn for these; on this
    transport they are simply values outside the class, and must normalize to ''
    rather than anything else."""
    assert _norm_project_fields(hostile, [])[0] == ""


def test_the_normalized_entry_is_fixed_shape_and_length_bounded():
    """The reason the persisted document needs no JSON payload budget: every
    dimension is bounded HERE, so no unbounded string can reach the store.
    Stated structurally, never as a byte product."""
    proj, ids = _norm_project_fields("A" * 4096, [999_999_999] * 4096)
    assert proj == ""
    assert len(ids) == MAX_PROJECT_IDS
    proj2, ids2 = _norm_project_fields("A" * 32, [1, 2, 3])
    assert len(proj2) <= 32
    assert all(len(str(n)) <= 9 for n in ids2)
