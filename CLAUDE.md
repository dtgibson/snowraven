# CLAUDE.md

This file is auto-loaded by Claude Code at the start of every session.
It holds pipeline conventions, tool rules, and project-specific
decisions that all builders must follow.

## Pipeline Overview

This project uses the Weft framework. Run /new-feature to start a new feature.

## Conventions

### Ports
- Backend runs on port **1620** (not 8000)
- Frontend dev server runs on port **5173** (Vite default)
- Vite proxies `/weather` and `/health` to `http://localhost:1620`

### Environment
- API keys live in `backend/.env` — never commit this file
- Required keys: `EBIRD_API_KEY`, `OPENWEATHER_API_KEY`
- OpenWeather key must be subscribed to "One Call by Call" at openweathermap.org

### Stack
- Backend: Python 3.10+, FastAPI, uvicorn, httpx, timezonefinder
- Frontend: React, Vite, TypeScript, Tailwind CSS v4, shadcn/ui
- Tests: pytest (backend, 35 tests), vitest (frontend)
- CI: GitHub Actions (`.github/workflows/pipeline.yml`)

### Running locally
```
# Backend
cd backend && uvicorn main:app --reload --port 1620

# Frontend
cd frontend && npm run dev
```

### Running tests
```
cd backend && python -m pytest tests/ -v
```

### Production build
```
./start.sh
```
Builds frontend into `frontend/dist/`, starts uvicorn on port 1620.
FastAPI serves the built frontend as static files automatically.
