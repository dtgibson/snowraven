import httpx
from fastapi import APIRouter, HTTPException, Query

from routers.taxonomy import resolve_species
from services.ebird import (
    CHECKLIST_ID_RE,
    checklist_field_flags,
    fetch_checklist_species,
)
from services.ebird_errors import ebird_rate_limit_exception

router = APIRouter()


@router.get("/checklists/{checklist_id}")
async def get_checklist(checklist_id: str, fields: str | None = Query(None)) -> dict:
    """A checklist's species (common name + eBird code + count string), in eBird's
    taxonomic order. Used by the Life List Comparer's checklist-compare mode and
    by the Statistics tab's exotic-provenance pass.

    `fields=` is a flag on this existing path, not a separate endpoint.
    `provenance` skips the second outbound eBird call that resolves a readable
    location name, which the provenance pass does not need. `projects` skips
    that AND the species resolution, returning `species: []`, so a projects
    sweep costs exactly ONE outbound eBird request per checklist. The response
    shape is otherwise identical (locName falls back to the locId), and every
    field the Comparer reads is untouched. The flag table is
    `services.ebird.checklist_field_flags`, fixture-locked against its JS twin
    (lib/checklistFields.ts). The desktop twin of the whole route is
    transport.ts's `/checklists/` branch plus lib/tauri/checklistService.ts;
    keep them in lockstep.

    `projId` and `projectIds` are additive top-level fields, normalized in the
    service against explicit ASCII classes. A project identifier NEVER becomes a
    URL or steers an outbound request: no public eBird endpoint resolves one and
    this route invents no destination for it."""
    # Single-sourced on services.ebird, same as the weather/tide siblings; this
    # route was the one caller of fetch_checklist_species that reached outbound
    # eBird URL construction unguarded (v0.5.88 finding, deferred; closed by
    # checklists-route-guard). The reachable injection was the QUERY STRING ONLY:
    # `/checklists/S1%3Ffoo=bar` arrived as `S1?foo=bar` and built
    # `…/checklist/view/S1?foo=bar`. This guard now fronts the route; the SECOND,
    # independent ground is ROUTING — Starlette's default `str` path converter is
    # `[^/]+`, so the id is always exactly one segment and traversal/host
    # steering never reach the handler. Never change the route to
    # `{checklist_id:path}` (regex `.*`), which removes exactly that ground.
    # `fullmatch`, never `.match()` (Python's `$` admits a trailing newline), and
    # explicit ASCII `[0-9]`, never `\d` (v0.5.54/v0.5.88 parity rules — see the
    # constant's comment block in services/ebird.py).
    if not CHECKLIST_ID_RE.fullmatch(checklist_id):
        raise HTTPException(status_code=400, detail="That doesn't look like a valid eBird checklist ID.")

    skip_loc_name, skip_species = checklist_field_flags(fields)

    try:
        data = await fetch_checklist_species(
            checklist_id, skip_loc_name=skip_loc_name, skip_species=skip_species,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        # ORDER IS LOAD-BEARING: after LookupError/ValueError (fetch_checklist_species
        # special-cases 404 BEFORE raise_for_status) and before the bare
        # `except Exception` below, which would otherwise swallow a 429 into a 502.
        #
        # An upstream 429 is re-surfaced AS a 429 with the shared detail and a
        # bounded, re-serialized Retry-After, through the SAME mapper /map/*
        # uses — without it the client-side gate (lib/ebirdGate.ts) cannot see a
        # rate limit on this path at all and the pacing contract the projects
        # sweep depends on is unenforceable (FR-30).
        #
        # ONLY the 429 half is shared. `raise_ebird_http_error`'s non-429
        # fallback is `502 "eBird API error: {n}"`, which would REPLACE this
        # route's `502 "Could not fetch checklist: {exc}"` — a string the Life
        # List Comparer displays (FR-32). So this clause takes the 429 or falls
        # through to the route's own fallback.
        limited = ebird_rate_limit_exception(exc)
        if limited is not None:
            raise limited
        raise HTTPException(status_code=502, detail=f"Could not fetch checklist: {exc}")
    except Exception as exc:
        # PRE-EXISTING and deliberately UNCHANGED by the provenance work, which
        # only made this path hotter. The reflected string is an httpx error over
        # the eBird URL; the API key rides in a HEADER and never appears in it,
        # so there is no credential to leak, and the "client" here is the user's
        # own self-hosted backend talking to the user's own app. The detail is
        # load-bearing for the Life List Comparer, which SHOWS it. Narrowing it
        # would change a shipped error surface for a different feature, which is
        # not something to do inside a provenance change; the provenance pass
        # itself never surfaces this text, it only counts the failure.
        raise HTTPException(status_code=502, detail=f"Could not fetch checklist: {exc}")

    # Under `fields=projects` the service already returned no observations, so
    # the taxonomy resolution is skipped ENTIRELY rather than called with an
    # empty list (FR-25: "skip the species resolution entirely"). That also
    # keeps the local taxonomy snapshot off a sweep that has no use for it.
    if skip_species:
        species: list[dict] = []
    else:
        codes = [s["speciesCode"] for s in data["species"]]
        resolved = await resolve_species(codes)
        species = [
            {
                # Normalize sub-forms (domestic/issf/form) to their parent species
                # so the same bird matches across checklists and shows its real name.
                "speciesCode": resolved.get(s["speciesCode"], {}).get("speciesCode", s["speciesCode"]),
                "commonName": resolved.get(s["speciesCode"], {}).get("commonName", s["speciesCode"]),
                "count": s["count"],
                "breedingCode": s.get("breedingCode", ""),
                "comments": s.get("comments", ""),
                # Purely additive (FR-39): the Comparer ignores both fields and
                # renders identically. Values are RAW, already normalized against
                # explicit ASCII classes in the service.
                "exoticCategory": s.get("exoticCategory", ""),
                "userDoNotCount": s.get("userDoNotCount", ""),
                "media": s.get("media", {"photo": 0, "audio": 0, "video": 0}),
            }
            for s in data["species"]
        ]
    return {
        "locName": data["locName"],
        "obsDt": data["obsDt"],
        "protocolId": data.get("protocolId", ""),
        "durationHrs": data.get("durationHrs"),
        "distanceKm": data.get("distanceKm"),
        "distanceUnit": data.get("distanceUnit", ""),
        "numObservers": data.get("numObservers"),
        "submissionMethod": data.get("submissionMethod", ""),
        "submissionVersion": data.get("submissionVersion", ""),
        "comments": data.get("comments", ""),
        # Purely additive (FR-23): the Comparer ignores both and renders
        # identically. Normalized in the service against explicit ASCII classes;
        # never interpolated into a URL (FR-29).
        "projId": data.get("projId", ""),
        "projectIds": data.get("projectIds", []),
        "species": species,
    }
