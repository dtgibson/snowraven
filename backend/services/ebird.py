import os

from http_client import get_client


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


async def fetch_checklist_species(checklist_id: str) -> dict:
    """Fetch a checklist's species observations (eBird speciesCode + count string)
    plus a short header (location + date). eBird returns obs in taxonomic order;
    that order is preserved. Common names are resolved separately via the taxonomy."""
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
    if not loc_name and loc_id:
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
    for o in (data.get("obs") or []):
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
            "media": {
                "photo": int(mc.get("P", 0) or 0),
                "audio": int(mc.get("A", 0) or 0),
                "video": int(mc.get("V", 0) or 0),
            },
        })

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
        "species": species,
    }
