#!/bin/sh
# Bundle and run measure-pack-reservation.ts under Node. Output: one JSON line
# per reading on stdout. $1: a scratch directory for the bundle.
set -e
here=$(cd "$(dirname "$0")" && pwd)
out=${1:?scratch directory}/pack-reservation.js
cd "$here/../../../../frontend"
npx rolldown "$here/measure-pack-reservation.ts" -f cjs -p node -o "$out" >/dev/null
node --max-old-space-size=8192 "$out" "$here/../../../../website/demo/snowraven-demo-ebird-backup.csv"
