"""The shared eBird HTTP-error mapping for this transport.

Extracted from `routers/map.py` (county-shading-and-project-stats, FR-30) so
`routers/checklists.py` can surface an upstream 429 AS a 429 through the SAME
mapper rather than a second copy of it. The projects sweep paces itself on the
shared client-side gate (`lib/ebirdGate.ts`), which can only see a 429 if the
route emits one; as shipped, `checklists.py` caught everything in a bare
`except Exception` and returned 502, so the pacing contract was unenforceable
on that path.

WHAT IS SHARED AND WHAT IS DELIBERATELY NOT (FR-30/FR-31 vs FR-32).

Only the 429 half is single-sourced. `raise_ebird_http_error` below is the FULL
mapper the map router already used, and its non-429 fallback is
`502 "eBird API error: {status}"`. The checklist route's shipped non-429 detail
is `502 "Could not fetch checklist: {exc}"`, and the Life List Comparer DISPLAYS
that string, so delegating the whole mapper there would change a shipped error
surface for an unrelated feature. `ebird_rate_limit_exception` therefore returns
the 429 `HTTPException` or **None**, and each route applies its own non-429
fallback. Do not "simplify" the checklist route onto the full mapper.

Per the v0.5.88 per-consumer rule, single-sourcing prevents the copies DRIFTING
but does nothing to prevent a call site being DROPPED, so every route keeps its
own 429 test: mutating one call site must turn exactly one test red.
"""

import re

import httpx
from fastapi import HTTPException

# ── The 429 contract, identical on both transports ───────────────────────────
# Fixture-locked (hotspotActivity.fixture.json rateLimit; the Tauri twin
# lib/tauri/ebirdErrors.ts throws the same detail string).
EBIRD_RATE_LIMIT_DETAIL = "eBird is limiting requests right now. Try again in a moment."

RETRY_AFTER_CAP_SEC = 60

# Seconds form only, 1-3 digits (length-bounded). Explicit [0-9], never \d
# (Python's \d matches Unicode digits — the v0.5.54 twinned-guard rule), and
# fullmatch, the house form for a hand-called guard (a trailing newline must
# not pass — the pydantic pattern= carve-out does NOT apply here, this is
# stdlib re, not a Rust-regex constraint).
_RETRY_AFTER_RE = re.compile(r"[0-9]{1,3}")


def parse_retry_after_seconds(value) -> int | None:
    """Twin of frontend lib/rateLimit.ts parseRetryAfterSeconds — the shared
    fixture's rateLimit.retryAfterRows pin both member by member. Returns
    bounded whole seconds, or None for absent/malformed/zero (an HTTP-date
    form parses as None; the client's default backoff covers it). Values over
    the cap are capped, not rejected."""
    if not isinstance(value, str) or _RETRY_AFTER_RE.fullmatch(value) is None:
        return None
    n = int(value)
    if n < 1:
        return None
    return min(n, RETRY_AFTER_CAP_SEC)


def ebird_rate_limit_exception(exc: httpx.HTTPStatusError) -> HTTPException | None:
    """The 429 HALF of the shared mapper: the 429 HTTPException when upstream
    said 429, else None so the caller applies ITS OWN non-429 fallback.

    The upstream Retry-After is parsed, bounded and RE-SERIALIZED, never
    reflected raw."""
    if exc.response.status_code != 429:
        return None
    retry_after = parse_retry_after_seconds(exc.response.headers.get("Retry-After"))
    return HTTPException(
        status_code=429,
        detail=EBIRD_RATE_LIMIT_DETAIL,
        headers={"Retry-After": str(retry_after)} if retry_after is not None else None,
    )


def raise_ebird_http_error(exc: httpx.HTTPStatusError):
    """The one non-2xx mapping for every eBird call in routers/map.py: the 429
    above, else the generic 502 shape. Twin: lib/tauri/ebirdErrors.ts
    throwEbirdHttpError — keep both in lockstep.

    NOT for routers/checklists.py: its non-429 detail is load-bearing (see the
    module docstring)."""
    limited = ebird_rate_limit_exception(exc)
    if limited is not None:
        raise limited
    raise HTTPException(
        status_code=502,
        detail=f"eBird API error: {exc.response.status_code}",
    )
