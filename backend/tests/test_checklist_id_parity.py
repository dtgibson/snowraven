"""SHARED-FIXTURE PARITY TEST — the Python half of the dual-transport
checklist-id shape guard (backend-guard-anchor-parity, finding 2).

`services.ebird.CHECKLIST_ID_RE` (web/Pi backend, enforced by routers/weather.py
and routers/tide.py) and the JS guards -- `isValidChecklistId` in
`frontend/src/lib/checklistId.ts`, which gates the REQUEST for these very
routes, and `SUBMISSION_ID_RE` in `.../components/speciesDetail/ui.tsx`, which
gates the link -- are kept in lockstep by comment only. This test and its vitest
(frontend/src/lib/checklistId.parity.test.ts) both load the ONE shared fixture
(frontend/src/lib/checklistId.fixture.json) and assert the SAME verdict per id,
so if either twin drifts its own test fails.

THE TRAP THIS EXISTS FOR (v0.5.54). Python's `\\d` matches every Unicode decimal
digit, so `re.fullmatch(r"S\\d+", ...)` accepted an id written in Arabic-Indic
digits while the JS twin's ASCII-only `\\d` rejected it — the "same" pattern
validating differently on the two transports. The Python side now writes an
EXPLICIT ASCII CLASS, and reverting `[0-9]` to `\\d` turns this file red.

Both halves are driven through their SHIPPED code, never a retyped copy of the
pattern; retyping is how a reproduction quietly stops testing what ships.

SINGLE-SOURCING IS NOT THE SAME AS BEING TESTED ONCE. The guard used to be two
byte-identical copies inside the two routers and is now one constant, which
prevents the copies DRIFTING — it does nothing to prevent a copy being DROPPED.
So each router keeps its own route-level test (test_weather_router.py,
test_tide_router.py) alongside this one.

SCOPE OF THE SINGLE-SOURCING CLAIM: it is about THIS transport. The JS side
still holds several byte-identical copies of the same literal (the two named
above plus lib/mediaStats.ts, lib/speciesStats.ts, map/TargetMarkers.tsx and
map/NearbyLiferMarkers.tsx). They all agree today, and the vitest half asserts
the two on the weather/tide path agree with each other; consolidating the rest
is separate work, deliberately not swept in here.
"""

import json
from pathlib import Path

from services.ebird import CHECKLIST_ID_RE

_FIXTURE = (
    Path(__file__).resolve().parents[2]
    / "frontend" / "src" / "lib" / "checklistId.fixture.json"
)

# The three code points the character-class half of the guard turns on, pinned
# by VALUE rather than spelled as literals. This repo has had literal exotic
# characters silently flattened into ASCII four times across two builds, leaving
# the probe set weaker with every test still green.
_ARABIC_INDIC_012 = "S" + "\u0660\u0661\u0662"
_FULLWIDTH_012 = "S" + "\uff10\uff11\uff12"
_DEVANAGARI_012 = "S" + "\u0966\u0967\u0968"


def _cases():
    with _FIXTURE.open(encoding="utf-8") as fh:
        return json.load(fh)["cases"]


def _accepts(checklist_id: str) -> bool:
    """The shipped guard exactly as both routers apply it."""
    return bool(CHECKLIST_ID_RE.fullmatch(checklist_id))


def test_every_shared_fixture_case_gets_the_expected_verdict():
    for case in _cases():
        assert _accepts(case["id"]) is case["valid"], case["why"]


def test_fixture_still_carries_the_discriminating_cases():
    """Non-vacuity: a fixture that had quietly lost its hostile rows would still
    pass the loop above.

    The code points are asserted DIRECTLY, so a `\\uXXXX` escape flattened into
    an ordinary ASCII digit fails here instead of silently narrowing the probe
    set to inputs the old pattern also rejected."""
    ids = [c["id"] for c in _cases()]

    # Three separate Unicode Nd blocks. Any one alone would leave a `\d`
    # regression passing on two thirds of the probe set.
    assert _ARABIC_INDIC_012 in ids
    assert _FULLWIDTH_012 in ids
    assert _DEVANAGARI_012 in ids
    assert [ord(c) for c in _ARABIC_INDIC_012] == [0x53, 0x0660, 0x0661, 0x0662]
    assert [ord(c) for c in _FULLWIDTH_012] == [0x53, 0xFF10, 0xFF11, 0xFF12]
    assert [ord(c) for c in _DEVANAGARI_012] == [0x53, 0x0966, 0x0967, 0x0968]

    # The nastiest shape: well-formed right up to its last character.
    assert "S123\u0660" in ids
    # A look-alike leading letter (Cyrillic capital Dze).
    assert "\u0405123" in ids
    assert ord("\u0405") == 0x0405

    # The anchor rows the house rule requires of every twinned pattern.
    assert "S123\n" in ids
    assert "\nS123" in ids
    assert "S12\n3" in ids

    # ...and enough valid rows that a guard rejecting EVERYTHING would fail.
    assert "S12345678" in ids
    assert sum(1 for c in _cases() if c["valid"]) >= 3
    assert len(ids) >= 20


def test_unicode_digits_are_rejected_on_this_transport_too():
    """The direct form of the v0.5.54 guard, and the test that goes RED if the
    class fix alone is reverted.

    `re.fullmatch(r"S\\d+", ...)` accepts all three of these because Python's
    `\\d` is Unicode-aware; the JS twin's `\\d` is ASCII-only and rejects them.
    Explicit `[0-9]` is what makes the two transports agree."""
    assert _accepts(_ARABIC_INDIC_012) is False
    assert _accepts(_FULLWIDTH_012) is False
    assert _accepts(_DEVANAGARI_012) is False
    assert _accepts("S123\u0660") is False
    # ...and every well-formed id is untouched by the change.
    assert _accepts("S12345678") is True
    assert _accepts("S1") is True


def test_the_anchor_half_was_ALREADY_correct_on_this_pair():
    """These two findings are separate defects, and this is the evidence.

    The settingskv guard used `.match()` and admitted a trailing newline; this
    guard has always used `fullmatch`, so the newline shapes were rejected both
    before and after the class fix. Reverting `[0-9]` to `\\d` leaves every
    assertion here GREEN while the test above goes red — which is what "two
    bugs, not one" means. The converse is asserted in test_settingskv_router.py.
    """
    assert _accepts("S123\n") is False
    assert _accepts("\nS123") is False
    assert _accepts("S12\n3") is False
    assert _accepts("S123\r") is False


def test_the_pattern_is_whole_string_matched_at_every_call_site():
    """Structural: `fullmatch` is load-bearing, not decoration.

    The compiled pattern carries `^...$` for readability, but under `.match()`
    a `$` would admit a trailing newline in Python (and not in JS). Pin the
    difference directly so a future rewrite to `.match()` fails here."""
    assert CHECKLIST_ID_RE.match("S123\n") is not None      # what `$` allows
    assert CHECKLIST_ID_RE.fullmatch("S123\n") is None      # what ships
