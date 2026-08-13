from fastapi import APIRouter, HTTPException, Query

from routers.taxonomy import resolve_species
from services.ebird import fetch_checklist_species

router = APIRouter()


@router.get("/checklists/{checklist_id}")
async def get_checklist(checklist_id: str, fields: str | None = Query(None)) -> dict:
    """A checklist's species (common name + eBird code + count string), in eBird's
    taxonomic order. Used by the Life List Comparer's checklist-compare mode and
    by the Statistics tab's exotic-provenance pass.

    `fields=provenance` is a flag on this existing path, not a separate endpoint:
    it skips the second outbound eBird call that resolves a readable location
    name, which the provenance pass does not need. The response shape is
    identical either way (locName falls back to the locId), and every field the
    Comparer reads is untouched. The desktop twin is transport.ts's
    `/checklists/` branch plus lib/tauri/checklistService.ts; keep them in
    lockstep."""
    try:
        data = await fetch_checklist_species(checklist_id, skip_loc_name=(fields == "provenance"))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
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

    codes = [s["speciesCode"] for s in data["species"]]
    resolved = await resolve_species(codes)
    species = [
        {
            # Normalize sub-forms (domestic/issf/form) to their parent species so
            # the same bird matches across checklists and shows its real name.
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
        "species": species,
    }
