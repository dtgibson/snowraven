#!/usr/bin/env bash
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

# Build frontend
echo "Building frontend..."
cd "$REPO_DIR/frontend"
npm ci --silent
npm run build

# Start backend (serves built frontend + API on port 8000)
echo "Starting SnowRaven on http://localhost:1620"
cd "$REPO_DIR/backend"
pip install -q -r requirements.txt
exec uvicorn main:app --host 0.0.0.0 --port 1620
