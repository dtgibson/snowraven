import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_ML_SEARCH = "https://search.macaulaylibrary.org/api/v1/search"


def _normalize_id(val: object) -> str:
    return "".join(c for c in str(val) if c.isdigit())


class MediaTypesRequest(BaseModel):
    catalog_ids: list[str]


class MediaTypesResponse(BaseModel):
    media_types: dict[str, str]


@router.post("/ml/media-types")
async def get_media_types(body: MediaTypesRequest) -> MediaTypesResponse:
    result: dict[str, str] = {}

    if not body.catalog_ids:
        return MediaTypesResponse(media_types=result)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            for catalog_id in body.catalog_ids:
                resp = await client.get(
                    _ML_SEARCH,
                    params={"q": catalog_id, "mediaType": "all", "count": 5},
                )
                resp.raise_for_status()
                data = resp.json()
                for item in data.get("results", []):
                    if _normalize_id(item.get("catalogId")) == catalog_id:
                        media_type = item.get("mediaType")
                        if media_type:
                            result[catalog_id] = media_type
                        break
    except httpx.HTTPError:
        raise HTTPException(
            status_code=503,
            detail="Could not reach the Macaulay Library. Please try again.",
        )

    return MediaTypesResponse(media_types=result)
