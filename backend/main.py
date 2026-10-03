import os
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

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

# The Vite dev server's page origin. Its proxy (frontend/vite.config.ts, the
# string shorthand, which sets changeOrigin) rewrites Host to localhost:1620, so
# the Origin fallback below must name the page's origin itself. CORS names the
# same page, from the same tuple.
DEV_ORIGINS = ("http://localhost:5173",)

# Every method that can change state. POST is the one a browser sends cross-site
# with no preflight (a form post, a `no-cors` fetch), which CORS cannot stop:
# CORS only keeps the sender from READING the answer, and the write has already
# landed. PUT, PATCH and DELETE need a preflight, which CORS refuses for a
# foreign origin; they are listed so that refusal does not rest on CORS alone.
_UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})

_DEFAULT_PORTS = {"http": 80, "https": 443}


def _authority(value: str, default_port: int) -> tuple[str, int] | None:
    """(host, port) from a Host-style ``host[:port]``, or None when it is not one.

    A missing port takes the Origin's scheme default, so ``pi.local`` (Host)
    equals ``https://pi.local`` (Origin) behind a TLS-terminating proxy that
    keeps Host. Anything carrying a path, query, credentials or whitespace is
    not an authority and matches nothing.
    """
    value = value.strip()
    if not value or any(c in value for c in "/?#@\\ \t"):
        return None
    try:
        parts = urlsplit("//" + value)
        port = parts.port
    except ValueError:
        return None
    if not parts.hostname:
        return None
    return parts.hostname, port if port is not None else default_port


def _origin_is_this_server(origin: str, headers: Headers) -> bool:
    """Does a serialized Origin name the server this request reached?

    "This server" is the Host header, any X-Forwarded-Host a reverse proxy added
    (nginx rewrites Host to the upstream by default), or the dev page origin.
    A browser cannot set X-Forwarded-Host on a cross-site request without a
    preflight, so trusting it opens nothing. ``Origin: null`` (a sandboxed frame,
    a ``file:`` page, some redirects) has no scheme and matches nothing.
    """
    if origin in DEV_ORIGINS:
        return True
    try:
        parts = urlsplit(origin)
    except ValueError:
        return False
    if parts.scheme not in _DEFAULT_PORTS or parts.path or parts.query or parts.fragment:
        return False
    default_port = _DEFAULT_PORTS[parts.scheme]
    mine = _authority(parts.netloc, default_port)
    if mine is None:
        return False
    hosts = [headers.get("host", "")]
    for forwarded in headers.getlist("x-forwarded-host"):
        hosts.extend(forwarded.split(","))
    return any(_authority(h, default_port) == mine for h in hosts if h.strip())


def is_cross_site_write(method: str, headers: Headers) -> bool:
    """True when a browser sent this state-changing request from another site.

    ``Sec-Fetch-Site`` decides whenever it is present, and only ``same-origin``
    passes. Every current browser sends it, and it reads ``same-origin`` through
    the Vite dev proxy, ``./start.sh``, a LAN hostname or IP, nginx and
    ``tailscale serve`` alike, because the browser judges the origin before any
    proxy rewrites Host. ``same-site`` is refused because another port on the
    same host is another origin; ``none`` is refused because it means a
    user-initiated navigation, which is never a write, while SnowRaven's own
    writes are fetches from its own page and so always ``same-origin``.

    Without ``Sec-Fetch-Site`` (Safari before 16.4) the Origin decides: present
    and not this server refuses. Neither header (curl, the TestClient, Node
    ``fetch`` in website/tools) passes, because none of those is a browser
    carrying a page from another site. Never key on ``Sec-Fetch-Mode``: Node's
    ``fetch`` sends ``cors`` with no Origin at all.

    KNOWN LIMIT of the fallback: an old Safari reaching the app through a proxy
    that rewrites Host and adds no X-Forwarded-Host, or a dev page opened on a
    LAN host rather than localhost, is refused. Both are browsers without
    ``Sec-Fetch-Site``, and the refusal is a failed save, never a silent one.
    """
    if method not in _UNSAFE_METHODS:
        return False
    site = headers.get("sec-fetch-site")
    if site is not None:
        return site.strip().lower() != "same-origin"
    origin = headers.get("origin")
    if origin is None:
        return False
    return not _origin_is_this_server(origin.strip(), headers)


class CrossSiteWriteGuard:
    """Refuse (403) a state-changing request a browser sent from another site.

    The refusal happens before routing, so the request body is never read and
    nothing is written. Safe methods (GET, HEAD, OPTIONS) pass untouched; CORS
    still answers a preflight.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and is_cross_site_write(scope["method"], Headers(scope=scope)):
            response = JSONResponse({"detail": "Cross-site request refused."}, status_code=403)
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
# refuses before CORS or any route sees the request.
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
