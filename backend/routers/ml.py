import asyncio

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_CDN = "https://cdn.download.ams.birds.cornell.edu/api/v2/asset"


async def _detect_type(client: httpx.AsyncClient, catalog_id: str) -> tuple[str, str | None]:
    """Return (catalog_id, mediaType) by probing CDN HEAD endpoints.

    CDN URL patterns:
      Photo  — /{id}/1200     → 200
      Audio  — /{id}/mp3      → 200
      Video  — /{id}/mp4/1280 → 200 (also serves /1200 as thumbnail)
    """
    mp3, mp4, img = await asyncio.gather(
        client.head(f"{_CDN}/{catalog_id}/mp3"),
        client.head(f"{_CDN}/{catalog_id}/mp4/1280"),
        client.head(f"{_CDN}/{catalog_id}/1200"),
    )
    if mp3.status_code == 200:
        return catalog_id, "Audio"
    if mp4.status_code == 200:
        return catalog_id, "Video"
    if img.status_code == 200:
        return catalog_id, "Photo"
    return catalog_id, None


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
            detections = await asyncio.gather(
                *[_detect_type(client, cid) for cid in body.catalog_ids]
            )
            for catalog_id, media_type in detections:
                if media_type is not None:
                    result[catalog_id] = media_type
    except httpx.HTTPError:
        raise HTTPException(
            status_code=503,
            detail="Could not reach the Macaulay Library. Please try again.",
        )

    return MediaTypesResponse(media_types=result)
