import asyncio

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

_CDN = "https://cdn.download.ams.birds.cornell.edu/api/v2/asset"

# Cap concurrent CDN connections to avoid triggering rate limits.
# Shared across all requests to the endpoint.
_sem = asyncio.Semaphore(8)


async def _detect_type(client: httpx.AsyncClient, catalog_id: str) -> tuple[str, str | None]:
    """Return (catalog_id, mediaType) by probing CDN HEAD endpoints sequentially.

    Checks Photo first since it is by far the most common type — short-circuits
    after one request for the majority of assets.

    CDN URL patterns:
      Photo  — /{id}/1200     → 200
      Audio  — /{id}/mp3      → 200
      Video  — /{id}/mp4/1280 → 200 (also serves /1200 as thumbnail; checked last)
    """
    async with _sem:
        img = await client.head(f"{_CDN}/{catalog_id}/1200")
        if img.status_code == 200:
            # Could be Photo or Video (Video assets also serve a /1200 thumbnail).
            # Check the video URL to disambiguate.
            mp4 = await client.head(f"{_CDN}/{catalog_id}/mp4/1280")
            if mp4.status_code == 200:
                return catalog_id, "Video"
            return catalog_id, "Photo"
        mp3 = await client.head(f"{_CDN}/{catalog_id}/mp3")
        if mp3.status_code == 200:
            return catalog_id, "Audio"
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
