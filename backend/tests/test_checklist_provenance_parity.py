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
