import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers.weather import router as weather_router

load_dotenv()

app = FastAPI(title="SnowRaven")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

app.include_router(weather_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Serve built frontend in production (when running on Raspberry Pi or localhost without Vite)
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="static")
