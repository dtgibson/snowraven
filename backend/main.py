import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers.apikeys import router as apikeys_router
from routers.ml import router as ml_router
from routers.settings import router as settings_router
from routers.taxonomy import router as taxonomy_router
from routers.version import router as version_router
from routers.weather import router as weather_router

load_dotenv()

app = FastAPI(title="SnowRaven")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

app.include_router(apikeys_router)
app.include_router(weather_router)
app.include_router(version_router)
app.include_router(ml_router)
app.include_router(taxonomy_router)
app.include_router(settings_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Serve built frontend in production (when running on Raspberry Pi or localhost without Vite)
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="static")
