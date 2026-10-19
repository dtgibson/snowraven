#!/bin/sh
# Bundle entry.ts (the shipped parse and stats code) into one script for Node,
# the jsc shell and a browser page. Output: $1 (default ./harness-bundle.js).
set -e
here=$(cd "$(dirname "$0")" && pwd)
out=${1:-$here/harness-bundle.js}
cd "$here/../../../../frontend"
npx rolldown "$here/entry.ts" -f iife -p neutral -o "$out" >/dev/null
echo "$out"
