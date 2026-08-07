"""Is the Macaulay Library inline-embed endpoint currently behind a bot check?

Cornell put Anubis (a proof-of-work anti-scraper gate) in front of
macaulaylibrary.org. Its interstitial needs a cookie that a cross-site iframe
cannot hold, so an embedded player renders Cornell's "Missing feature Cookies"
card instead of the media. The page cannot be detected in the browser: it is a
same-status HTTP 200 in a cross-origin frame, and the endpoint sends no CORS
headers, so neither `onError` nor `fetch` can see it. This route is the web/Pi
half of the out-of-band probe (`lib/tauri/mediaService.ts` is the desktop twin
and MUST stay in lockstep with it).
"""

from fastapi import APIRouter, HTTPException, Query

from http_client import get_client

router = APIRouter()

_EMBED_URL = "https://macaulaylibrary.org/asset/{catalog_id}/embed"

# A browser-shaped User-Agent. The gate only challenges requests that look like a
# browser: with httpx's default UA the real page comes back and the probe would
# report "not gated" while every actual viewer is blocked.
_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/26.0 Safari/605.1.15"
)

# Structural markers from the interstitial as served. The visible "Missing
# feature Cookies" string is deliberately NOT one of them: that text is not in
# the HTML at all, it is rendered later by the challenge's own script once the
# cookie test fails. Match the page that is served, not the symptom it produces.
_CHALLENGE_BODY_MARKERS = ('id="anubis_challenge"', "/.within.website/x/cmd/anubis/")
_CHALLENGE_COOKIE_MARKER = "anubis"

# The interstitial is ~4 KB and the real embed page ~750 KB, so the markers are
# always well inside this. Capping the read keeps the probe cheap on a Pi.
_MAX_SNIFF_BYTES = 65536

_CATALOG_ID_RE = r"^[0-9]+$"


@router.get("/media/embed-status")
async def embed_status(
    # ASCII class, never \d: pydantic's rust regex reads \d as Unicode decimal,
    # so \d{1,} would accept non-ASCII digits the JS twin's guard rejects.
    catalogId: str = Query(..., pattern=_CATALOG_ID_RE, max_length=20),
):
    url = _EMBED_URL.format(catalog_id=catalogId)
    client = get_client()

    try:
        async with client.stream(
            "GET",
            url,
            headers={"User-Agent": _BROWSER_UA, "Accept": "text/html"},
            timeout=8.0,
        ) as resp:
            if resp.status_code >= 400:
                raise HTTPException(
                    status_code=502,
                    detail="Macaulay Library returned an error.",
                )

            # Two independent signals, so a change to either the interstitial's
            # markup or its cookie naming does not silently blind the probe.
            cookies = "".join(resp.headers.get_list("set-cookie")).lower()
            if _CHALLENGE_COOKIE_MARKER in cookies:
                return {"gated": True}

            head = b""
            async for part in resp.aiter_bytes():
                head += part
                if len(head) >= _MAX_SNIFF_BYTES:
                    break

    except HTTPException:
        raise
    except Exception:
        # Connection-level failure (offline / DNS / timeout). The app treats any
        # error here as "not gated" and shows the real embed, so a probe that
        # cannot run never hides working media.
        raise HTTPException(
            status_code=503,
            detail="Could not reach Macaulay Library.",
        )

    text = head.decode("utf-8", errors="ignore")
    return {"gated": any(marker in text for marker in _CHALLENGE_BODY_MARKERS)}
