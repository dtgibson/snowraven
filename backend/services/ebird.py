import os
import re

from http_client import get_client

# The shape guard for an eBird checklist id, and the SINGLE SOURCE for it on this
# transport. Three routes gate on it: `/weather/{checklist_id}` and
# `/tide/{checklist_id}` each check it before calling `fetch_checklist` below
# (two byte-identical copies inside those routers until v0.5.88), and
# `/checklists/{checklist_id}` (routers/checklists.py) checks it before calling
# `fetch_checklist_species` (checklists-route-guard, discharging the v0.5.88
# deferral this block previously recorded).
#
# IT IS STILL NOT A MODULE-WIDE INVARIANT. The guard lives at the ROUTES, not in
# these functions, so a NEW caller of `fetch_checklist` or
# `fetch_checklist_species` does NOT inherit it — gate at the call site. Before
# its route gated, an unvalidated id reached `fetch_checklist_species`'s
# outbound eBird URL construction; what that permitted was measured END TO END
# through that route on a live server, not on the URL builder in isolation: the
# reachable injection was the QUERY STRING ONLY. A request for
# `/checklists/S1%3Ffoo=bar` arrived as `S1?foo=bar` and produced
# `…/checklist/view/S1?foo=bar`. The guard closes that; the route's own tests
# pin it (test_checklists_router.py, 400 with the outbound fetch never awaited).
#
# What stopped the rest, because a future reader needs the tripwire — and it
# remains the SECOND, INDEPENDENT ground now that the guard fronts the route:
# Starlette's DEFAULT `str` PATH CONVERTER is `[^/]+`, so `{checklist_id}` is
# always exactly one path segment and can never contain a `/`. Traversal
# therefore never reaches the handler at all — `..%2F..%2Fetc/passwd` and
# friends 404 at routing, and `%252F`, backslash, overlong UTF-8 `%C0%AF` and
# fullwidth solidus U+FF0F all arrive as themselves rather than as a separator.
# httpx WILL normalize `../` once a literal slash is present
# (`httpx.URL(base + "../../etc/passwd")` really does collapse to
# `/etc/passwd`), which is why measuring the builder alone OVER-STATES this —
# the route cannot deliver the slash that would trigger it. Changing any of the
# three routes to `{checklist_id:path}` (regex `.*`) removes exactly that
# protection. The host also cannot be steered (`@`, `://`, `//` all still
# resolve to api.ebird.org) and the request cannot be split (httpx rejects CR
# and LF as non-printable ASCII).
#
# Its JS counterparts are `isValidChecklistId` (frontend/src/lib/checklistId.ts),
# which gates the REQUEST to the weather/tide routes and the Comparer's
# `/checklists/` calls (ChecklistComparer.tsx), and `SUBMISSION_ID_RE`
# (components/speciesDetail/ui.tsx), which gates whether an id becomes a link
# and the provenance pass's `/checklists/` calls (useExoticProvenance.ts).
# The JS side is NOT single-sourced — four further byte-identical copies live in
# lib/mediaStats.ts, lib/speciesStats.ts, map/TargetMarkers.tsx and
# map/NearbyLiferMarkers.tsx — so the single-sourcing claim above is about THIS
# transport only. The shared fixture drives both of the two named guards and
# asserts they agree, so neither can drift away from this constant unnoticed.
#
# `[0-9]`, NEVER `\d` (v0.5.54): Python's `\d` matches Unicode decimal digits, so
# `S٠١٢` (Arabic-Indic) passed the backend guard while the JS twin's ASCII-only
# `\d` rejected it — the "same" pattern validating differently on the two
# transports. Explicit ASCII classes are what make the two agree.
#
# `fullmatch` at every call site for the anchor half of the same parity (see the
# _EXOTIC_RE note below); the shared fixture carries newline rows that hold it.
#
# `{1,15}` (length-bound-checklist-id): the ceiling exists to ALIGN the guards,
# not to model eBird. Real ids are ~10 digits, so 15 keeps ~5 orders of
# magnitude of headroom; what picks 15 over ROADMAP's `{1,20}` candidate is the
# shipped persisted-key guard `SUBMISSION_KEY_RE = /^S[0-9]{1,15}$/`
# (frontend/src/lib/exoticProvenanceCache.ts). A 16-20-digit id would pass
# every request/link guard yet fail that store's own key guard — the v0.5.87
# silent-discard shape. The bound also discharges the v0.5.88 deferral: a
# 65,001-character id passed the unbounded guard and issued an outbound eBird
# request, deviating from the house SSRF rule (the reference guard
# /media/embed-status is explicitly bounded). The six JS guard sites carry the
# same `{1,15}` in lockstep, and the shared fixture's at-ceiling / over-ceiling
# rows hold it on both transports.
CHECKLIST_ID_RE = re.compile(r"^S[0-9]{1,15}$")


async def fetch_checklist(checklist_id: str) -> dict:
    api_key = os.getenv("EBIRD_API_KEY")
    if not api_key:
        raise ValueError("EBIRD_API_KEY not configured")

    headers = {"X-eBirdApiToken": api_key}

    client = get_client()
    resp = await client.get(
        f"https://api.ebird.org/v2/product/checklist/view/{checklist_id}",
        headers=headers,
        timeout=10.0,
    )
    if resp.status_code == 404:
        raise LookupError("Checklist not found. Check the ID and try again.")
    resp.raise_for_status()
    data = resp.json()

    loc_id = data["locId"]
    loc_name = data.get("locName", "")
    lat = lng = None

    # Primary: ref/region/info returns bounding box; use centre point.
    # This matches raincrow's coordinate strategy exactly.
    region_resp = await client.get(
        f"https://api.ebird.org/v2/ref/region/info/{loc_id}",
        headers=headers,
        timeout=10.0,
    )
    if region_resp.status_code == 200 and region_resp.content.strip():
        region_data = region_resp.json()
        if not loc_name:
            loc_name = region_data.get("result") or region_data.get("name", "")
        bounds = region_data.get("bounds") or {}
        if all(k in bounds for k in ("minX", "maxX", "minY", "maxY")):
            lat = (bounds["minY"] + bounds["maxY"]) / 2
            lng = (bounds["minX"] + bounds["maxX"]) / 2

    # Fallback: product/lists — exact GPS pin from loc object
    if lat is None or lng is None:
        lists_resp = await client.get(
            f"https://api.ebird.org/v2/product/lists/{loc_id}",
            headers=headers,
            params={"maxResults": 1},
            timeout=10.0,
        )
        if lists_resp.status_code == 200 and lists_resp.content.strip():
            lists_data = lists_resp.json()
            if isinstance(lists_data, list) and lists_data:
                loc_obj = lists_data[0].get("loc") or lists_data[0].get("location") or {}
                if not loc_name:
                    loc_name = loc_obj.get("name", "")
                lat = loc_obj.get("lat") or loc_obj.get("latitude")
                lng = loc_obj.get("lng") or loc_obj.get("longitude") or loc_obj.get("lon")
            elif isinstance(lists_data, dict):
                loc_obj = lists_data.get("location") or lists_data.get("loc") or {}
                if not loc_name:
                    loc_name = loc_obj.get("name", "")
                lat = loc_obj.get("lat") or loc_obj.get("latitude")
                lng = loc_obj.get("lng") or loc_obj.get("longitude") or loc_obj.get("lon")

    # Last resort: recent observations
    if lat is None or lng is None:
        obs_resp = await client.get(
            f"https://api.ebird.org/v2/data/obs/{loc_id}/recent",
            headers=headers,
            params={"back": 365},
            timeout=10.0,
        )
        if obs_resp.status_code == 200 and obs_resp.content.strip():
            obs_list = obs_resp.json()
            if obs_list:
                lat = obs_list[0].get("lat")
                lng = obs_list[0].get("lng")

    if lat is None or lng is None:
        raise ValueError(f"Could not find coordinates for location {loc_id}.")

    return {
        "obs_dt": data["obsDt"],
        "loc_name": loc_name or loc_id,
        "lat": lat,
        "lng": lng,
        "duration_hrs": data.get("durationHrs") or 1,
    }


# The eBird response is untrusted input. Both provenance fields are normalized
# against EXPLICIT ASCII CLASSES ([A-Z]), never `\w` — the desktop twin in
# lib/tauri/checklistService.ts uses the identical explicit classes for the same
# reason. The v0.5.54 finding was a rust-regex `\d` admitting `٠١٢` while its JS
# twin did not, so the "same" pattern validated differently on the two
# transports. Anything not matching becomes "", which counts.
#
# THE CHARACTER CLASSES ARE ONLY HALF OF PARITY; THE ANCHORS ARE THE OTHER HALF,
# and this pair shipped divergent on exactly that. Python's `$` matches BEFORE a
# trailing newline and JavaScript's does not, so `re.match(r"^[A-Z]{1,4}$", ...)`
# accepted "X\n" while its `.test()` twin rejected it. The token still counted on
# both transports, so no species could be wrongly dropped, but "X\n" then failed
# the persisted store's own SEEN_TOKEN_RE on reload, which silently discarded the
# whole species record and re-fetched it every session on web/Pi.
#
# `fullmatch` is what makes the anchors agree: it requires the WHOLE string, so
# the trailing newline is unconsumed and the value is rejected, exactly as in JS.
# The shared fixture carries a trailing-newline row, and reverting to `.match()`
# turns the parity tests red on both transports.
_EXOTIC_RE = re.compile(r"^[A-Z]{1,4}$")
_DNC_RE = re.compile(r"^[A-Z]{1,8}$")


def _norm_token(value, pattern) -> str:
    return value if isinstance(value, str) and pattern.fullmatch(value) else ""


# ── The projects seam (county-shading-and-project-stats, FR-24, FR-25) ────────
# Same posture as the provenance pair above and the SAME two halves of parity.
# Its JS twin is `normalizeProjectFields` in lib/tauri/checklistService.ts, and
# ONE shared fixture (frontend/src/lib/checklistProjects.fixture.json) drives
# both, so neither can drift without its own test failing.
#
# TWO TRAPS ARE LIVE HERE IN A WAY THEY WERE NOT FOR exoticCategory, and both
# appear as fixture ROWS rather than comments:
#
#  1. ANCHORS. `re.match(r"^[A-Z0-9_]{1,32}$", "EBIRD\n")` SUCCEEDS, because
#     Python's `$` matches before a trailing newline; the JS `.test()` twin
#     rejects it. `fullmatch` with the pattern unanchored in the literal is the
#     house form (the v0.5.87 rule) and is what makes the two agree.
#  2. `isinstance(True, int)` is True, so a bare int check would normalize
#     `projectIds: [True]` to 1 while JS rejects a boolean for free. The
#     element guard therefore excludes bool EXPLICITLY.
#
# And never `int(v)` / `str.isdigit()` on a STRING element: `int("١٠٥٠")` is
# 1050 under both runtimes, so a string element is REJECTED outright rather
# than coerced. Non-conforming elements are DROPPED, never defaulted.
_PROJ_ID_RE = re.compile(r"[A-Z0-9_]{1,32}")

# 9-digit ceiling, so the persisted number's string form is length-bounded.
PROJECT_ID_MAX = 999_999_999

# Array length cap. Sampled data carries 1; 8 mirrors MAX_SEEN_PER_SPECIES.
MAX_PROJECT_IDS = 8


def _norm_project_fields(proj_id, project_ids) -> tuple[str, list[int]]:
    """Normalize eBird's `projId` / `projectIds` to the shape both transports
    return. Rejected `projId` -> ""; bad `projectIds` elements are dropped and
    the array is capped at MAX_PROJECT_IDS."""
    proj = proj_id if isinstance(proj_id, str) and _PROJ_ID_RE.fullmatch(proj_id) else ""
    ids: list[int] = []
    if isinstance(project_ids, list):
        for v in project_ids:
            if len(ids) >= MAX_PROJECT_IDS:
                break
            # `isinstance(True, int)` is True — exclude bool EXPLICITLY.
            if not isinstance(v, int) or isinstance(v, bool):
                continue
            if v < 0 or v > PROJECT_ID_MAX:
                continue
            ids.append(v)
    return proj, ids


def checklist_field_flags(fields: str | None) -> tuple[bool, bool]:
    """(skip_loc_name, skip_species) for a `fields=` query value.

    SINGLE-VALUED WHOLE-STRING EQUALITY, deliberately: both transports match
    the whole string today and there is no comma-splitting precedent anywhere in
    this seam, so introducing one would put the byte-identical guarantee for the
    shipped `provenance` caller at risk for no caller that wants it. The shared
    fixture's `fieldFlagRows` pin this table on both runtimes. Its JS twin is
    `checklistFieldFlags` in lib/checklistFields.ts."""
    if fields == "provenance":
        return True, False
    if fields == "projects":
        return True, True
    return False, False


async def fetch_checklist_species(
    checklist_id: str, skip_loc_name: bool = False, skip_species: bool = False,
) -> dict:
    """Fetch a checklist's species observations (eBird speciesCode + count string)
    plus a short header (location + date). eBird returns obs in taxonomic order;
    that order is preserved. Common names are resolved separately via the taxonomy.

    `skip_loc_name` suppresses the SECOND outbound eBird call (ref/region/info)
    that resolves a readable location name from the locId. The exotic-provenance
    pass does not need one and is capped at one request per checklist, so with
    the flag set `locName` falls back to the locId exactly as it already does
    when resolution fails. The response shape is unchanged either way.

    `skip_species` additionally suppresses the per-observation projection, so
    the route can skip its own species resolution and return `species: []`
    (FR-25). Under `fields=projects` both flags are set, which is what makes a
    projects sweep cost exactly ONE outbound eBird request per checklist."""
    api_key = os.getenv("EBIRD_API_KEY")
    if not api_key:
        raise ValueError("EBIRD_API_KEY not configured")

    headers = {"X-eBirdApiToken": api_key}
    client = get_client()
    resp = await client.get(
        f"https://api.ebird.org/v2/product/checklist/view/{checklist_id}",
        headers=headers,
        timeout=10.0,
    )
    if resp.status_code == 404:
        raise LookupError("Checklist not found. Check the ID and try again.")
    resp.raise_for_status()
    data = resp.json()

    # checklist/view has no locName — only locId. Resolve a human-readable
    # location name so the two checklists are easy to tell apart.
    loc_id = data.get("locId", "")
    loc_name = data.get("locName", "")
    if not loc_name and loc_id and not skip_loc_name:
        try:
            region_resp = await client.get(
                f"https://api.ebird.org/v2/ref/region/info/{loc_id}",
                headers=headers,
                timeout=10.0,
            )
            if region_resp.status_code == 200 and region_resp.content.strip():
                region_data = region_resp.json()
                loc_name = region_data.get("result") or region_data.get("name", "")
        except Exception:
            pass  # Location name is a nicety; fall through to the locId.

    species = []
    for o in ([] if skip_species else (data.get("obs") or [])):
        code = o.get("speciesCode")
        if not code:
            continue
        # Breeding code lives in obsAux (one per species per checklist). The value is
        # eBird's INTERNAL code (e.g. "S1") — the frontend translates it to the display
        # code. Media presence is in mediaCounts: {"P": n, "A": n, "V": n}.
        breeding = ""
        for aux in (o.get("obsAux") or []):
            if aux.get("fieldName") == "breeding_code":
                breeding = aux.get("value") or aux.get("auxCode") or ""
                break
        mc = o.get("mediaCounts") or {}
        species.append({
            "speciesCode": code,
            "count": o.get("howManyStr", "X"),
            "breedingCode": breeding,
            "comments": o.get("comments") or "",   # per-species note (HTML-entity encoded)
            # Exotic provenance rides on the OBSERVATION, so it lands on the
            # collapsed parent species code in the router below. Raw values,
            # never a derived countability boolean: 'X' escapee, 'N'
            # naturalized, 'P' provisional, "" absent.
            "exoticCategory": _norm_token(o.get("exoticCategory"), _EXOTIC_RE),
            "userDoNotCount": _norm_token(o.get("userDoNotCount"), _DNC_RE),
            "media": {
                "photo": int(mc.get("P", 0) or 0),
                "audio": int(mc.get("A", 0) or 0),
                "video": int(mc.get("V", 0) or 0),
            },
        })

    proj_id, project_ids = _norm_project_fields(data.get("projId"), data.get("projectIds"))

    return {
        "locName": loc_name or loc_id,
        "obsDt": data.get("obsDt", ""),
        # Effort + provenance metadata (the frontend formats/labels these). The
        # frontend also decodes/ linkifies the comment text. effortDistanceKm is in
        # km regardless of the unit the observer entered (distanceUnit).
        "protocolId": data.get("protocolId", ""),
        "durationHrs": data.get("durationHrs"),
        "distanceKm": data.get("effortDistanceKm"),
        "distanceUnit": data.get("effortDistanceEnteredUnit", ""),
        "numObservers": data.get("numObservers"),
        "submissionMethod": data.get("submissionMethodCode", ""),
        "submissionVersion": data.get("submissionMethodVersionDisp", ""),
        "comments": data.get("comments") or "",   # checklist-level note (HTML-entity encoded)
        # Purely additive (FR-23): every existing caller ignores both fields and
        # renders identically. Values are normalized against explicit ASCII
        # classes above; a project identifier NEVER becomes a URL (FR-29).
        "projId": proj_id,
        "projectIds": project_ids,
        "species": species,
    }
