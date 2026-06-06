from fastapi import APIRouter, HTTPException

from routers.taxonomy import resolve_species
from services.ebird import fetch_checklist_species

router = APIRouter()


@router.get("/checklists/{checklist_id}")
async def get_checklist(checklist_id: str) -> dict:
    """A checklist's species (common name + eBird code + count string), in eBird's
    taxonomic order. Used by the Life List Comparer's checklist-compare mode."""
    try:
        data = await fetch_checklist_species(checklist_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
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
