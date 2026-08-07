import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from http_client import close_client
from routers.apikeys import router as apikeys_router
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

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
