import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import JSONResponse

from http_client import close_client
from routers.apikeys import router as apikeys_router
from routers.barcharts import router as barcharts_router
from routers.checklists import router as checklists_router
from routers.map import router as map_router
from routers.mapdefaults import router as mapdefaults_router
from routers.media import router as media_router
from routers.nominatim import router as nominatim_router
from routers.settings import router as settings_router
from routers.settingskv import router as settingskv_router
from routers.taxonomy import router as taxonomy_router
from routers.tide import router as tide_router
from routers.version import router as version_router
from routers.weather import router as weather_router

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: nothing — the shared httpx client is a LAZY singleton created on
    # first use (get_client()), NOT here, so the module-level TestClient(app)
    # tests (which never run lifespan startup) still work.
    yield
    # Shutdown: close the shared client if it was ever created.
    await close_client()


app = FastAPI(title="SnowRaven", lifespan=lifespan)


# ── Browser-facing protections (upload-origin-table-wrap-copy) ────────────────
#
# Both matter only on the web/Pi transport. The Mac, Windows, iPhone and iPad
# apps never call this backend: `storage.ts` and `transport.ts` pick their Tauri
# halves whenever `isTauri()`.

# The request header every web/Pi write from SnowRaven's own page carries. The
# frontend's one declaration is `frontend/src/lib/appRequestHeader.ts`, and
# tests/test_browser_protections.py compares the two rather than restating them.
APP_REQUEST_HEADER = "X-SnowRaven-Request"
APP_REQUEST_HEADER_VALUE = "1"

# The origins CORS admits: none. The app's own page is always same-origin with
# this server (`./start.sh`, a Pi, nginx, `tailscale serve`) or with the Vite dev
# server whose proxy forwards to it, so it never sends a preflight and needs no
# entry. `http://localhost:5173` used to be listed, and it let ANY page served on
# Vite's default port (another project's dev server) pass the preflight, add
# APP_REQUEST_HEADER, write here and read the stored API keys. Every origin added
# here gets the same power (is_refused_browser_write).
DEV_ORIGINS: tuple[str, ...] = ()

# Every method that can change state. POST is the one a browser sends cross-site
# with no preflight (a form post, a `no-cors` fetch), which CORS cannot stop:
# CORS only keeps the sender from READING the answer, and the write has already
# landed. PUT, PATCH and DELETE need a preflight, which CORS refuses for a
# foreign origin; they are listed so that refusal does not rest on CORS alone.
_UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def is_refused_browser_write(method: str, headers: Headers) -> bool:
    """True when a browser sent this state-changing request without the app's header.

    A request comes from a browser when it carries ``Origin`` or
    ``Sec-Fetch-Site``. Every current browser sends ``Origin`` on a POST, PUT,
    PATCH or DELETE, same-origin or cross-site (as ``null`` from a sandboxed
    frame or a ``file:`` page, which is still present), so ``Origin`` is the
    marker that holds everywhere. ``Sec-Fetch-Site`` cannot be relied on alone:
    Chromium and WebKit send no ``Sec-Fetch-*`` header at all to a plain-HTTP
    address that is not loopback (measured at QA, decisions.md 1 and 4), which
    is every LAN Pi and every dev page opened by LAN address. Never key on
    ``Sec-Fetch-Mode``: Node's ``fetch`` sends ``cors`` with no Origin, and the
    Node tooling in website/tools posts here.

    Such a request passes only with ``APP_REQUEST_HEADER: APP_REQUEST_HEADER_VALUE``.
    A page on another origin cannot add a custom header without a CORS
    preflight, and CORSMiddleware below admits no origin (``DEV_ORIGINS`` is
    empty), so it refuses every such preflight and the header proves the request
    came from a page this server (or the Vite dev proxy in front of it) served.
    No Host, Origin or proxy header is compared, so it works the same on
    ``./start.sh``, a LAN hostname or IP, the Vite dev proxy, nginx with or
    without ``X-Forwarded-Host``, and ``tailscale serve``. It does not cover DNS
    rebinding: an attacker's hostname re-pointed at this server's address makes
    the attacker's page same-origin, so it adds the header with no preflight,
    and nothing here checks Host (equally open before this guard existed).

    THE GUARANTEE RESTS ON CORS, here AND in front of here. Adding any origin to
    ``allow_origins`` (a single origin, a ``*``, or a regex) lets every page
    served from what it admits send the header, and so write, and read the API
    keys; so does a proxy that answers a preflight itself instead of passing it
    on. Vite's dev server does that by default for any localhost origin, which
    is why frontend/vite.config.ts sets ``cors: false`` (measured: with the
    default, a page on another local port wrote through the dev proxy in
    Chromium and WebKit).

    A request carrying neither ``Origin`` nor ``Sec-Fetch-Site`` (curl, the
    TestClient, Node ``fetch`` in website/tools) passes without the header:
    none of those is a browser carrying another site's page. A tab still running a bundle from
    before this fix sends no header and is refused until it is reloaded.
    """
    if method not in _UNSAFE_METHODS:
        return False
    if "origin" not in headers and "sec-fetch-site" not in headers:
        return False
    return headers.get(APP_REQUEST_HEADER, "").strip() != APP_REQUEST_HEADER_VALUE


class CrossSiteWriteGuard:
    """Refuse (403) a state-changing browser request that lacks the app's header.

    The refusal happens before routing, so the request body is never read and
    nothing is written. Safe methods (GET, HEAD, OPTIONS) pass untouched; CORS
    still answers a preflight.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and is_refused_browser_write(scope["method"], Headers(scope=scope)):
            response = JSONResponse(
                {"detail": "Request refused: not sent by SnowRaven's own page."},
                status_code=403,
            )
            await response(scope, receive, send)
            return
        await self.app(scope, receive, send)


# On EVERY response, the static SPA included, since framing protection is for
# the page. `frame-ancestors 'none'` is the only CSP directive: a CSP with just
# this restricts nothing else, and a full CSP is out of scope (it would need the
# index.html anti-flash script, inline styles, workers, tile and favicon hosts
# and the Macaulay frame). `X-Frame-Options` covers browsers without CSP 2.
# `strict-origin-when-cross-origin` is today's browser default, so no outbound
# request changes; `no-referrer` would strip what tile hosts and the Macaulay
# embed see. `nosniff` cannot break a load here: Vite's `<script type="module">`
# and module workers already require a JavaScript MIME type, Python's mimetypes
# serves `.js`/`.mjs` as JavaScript and `.css` as text/css on every host we ship
# to (tests/test_browser_protections.py checks the running host), and the map's
# `.pbf` glyphs are fetched as bytes, which nosniff does not govern. No
# environment override: nothing frames the app (decisions.md 2; the reversal is
# an env-gated frame-ancestors allowlist here). An unhandled exception's 500 is
# written by Starlette's ServerErrorMiddleware, outside this one, and carries
# only a plain-text body.
SECURITY_HEADERS = (
    ("X-Frame-Options", "DENY"),
    ("Content-Security-Policy", "frame-ancestors 'none'"),
    ("X-Content-Type-Options", "nosniff"),
    ("Referrer-Policy", "strict-origin-when-cross-origin"),
)


class SecurityHeaders:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in SECURITY_HEADERS:
                    headers[name] = value
            await send(message)

        await self.app(scope, receive, send_with_headers)


# Order is load-bearing: the LAST added is the OUTERMOST. The headers wrap
# everything (a CORS preflight answer and a 403 refusal included); the guard
# refuses before CORS or any route sees the request. An empty `allow_origins` is
# what makes APP_REQUEST_HEADER unforgeable (is_refused_browser_write): add no
# origin to it. CORSMiddleware stays so a foreign preflight gets an explicit 400.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(DEV_ORIGINS),
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)
app.add_middleware(CrossSiteWriteGuard)
app.add_middleware(SecurityHeaders)

app.include_router(apikeys_router)
app.include_router(checklists_router)
app.include_router(map_router)
app.include_router(mapdefaults_router)
app.include_router(media_router)
app.include_router(weather_router)
app.include_router(tide_router)
app.include_router(version_router)
app.include_router(nominatim_router)
app.include_router(taxonomy_router)
app.include_router(settings_router)
# targets-tab: the eBird bar-chart file routes (/settings/barcharts[...]). Before
# the generic store below, so `GET /settings/barcharts` is this router's, never
# a {key} match ("barcharts" is also a reserved key there, defense in depth).
app.include_router(barcharts_router)
# Generic /settings/{key} store — MUST be the FINAL include_router. A {key}
# match registered before the specific /settings/keys|files|map-defaults routes
# (first-match-wins, registration order) would silently shadow them. Kept ahead
# of the StaticFiles mount so an unmatched key reaches a real handler, not the
# SPA fallback.
app.include_router(settingskv_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Serve built frontend in production (when running on Raspberry Pi or localhost without Vite)
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="static")
