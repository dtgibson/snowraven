import os
import httpx


async def fetch_checklist(checklist_id: str) -> dict:
    api_key = os.getenv("EBIRD_API_KEY")
    if not api_key:
        raise ValueError("EBIRD_API_KEY not configured")

    headers = {"X-eBirdApiToken": api_key}

    async with httpx.AsyncClient() as client:
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
                    lat = loc_obj.get("lat") or loc_obj.get("latitude")
                    lng = loc_obj.get("lng") or loc_obj.get("longitude") or loc_obj.get("lon")
                elif isinstance(lists_data, dict):
                    loc_obj = lists_data.get("location") or lists_data.get("loc") or {}
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
        "lat": lat,
        "lng": lng,
        "duration_hrs": data.get("durationHrs") or 1,
    }
