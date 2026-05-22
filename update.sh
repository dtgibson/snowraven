#!/bin/bash
set -e

trap 'echo "" && echo "✗ Update failed. See the error above for details." >&2' ERR

echo "→ Pulling latest changes..."
git pull

echo "→ Rebuilding frontend..."
(cd frontend && npm ci && npm run build)

echo "→ Updating backend dependencies..."
(cd backend && .venv/bin/pip install -r requirements.txt)

if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files snowraven.service >/dev/null 2>&1; then
  echo "→ Restarting service..."
  sudo systemctl restart snowraven
else
  echo "  No systemd service found — restart the app manually to apply the update."
fi

echo ""
echo "✓ SnowRaven updated successfully."
