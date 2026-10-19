#!/bin/sh
# Re-runs every Node (V8) and jsc (JavaScriptCore) reading in decisions.md
# entries 1 and 2. Usage: run-engines.sh <bundle.js> <dir with the CSVs> <out.jsonl>
# The CSVs: reference.csv (the user's own export, never committed) and
# big-<rows>.csv from gen-big-export.mjs.
set -e
B=$1; D=$2; OUT=$3
J=/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc
here=$(cd "$(dirname "$0")" && pwd)
cd "$here"
for f in reference big-21856 big-300000 big-600000 big-1000000; do
  [ -f "$D/$f.csv" ] || continue
  node --expose-gc --max-old-space-size=14000 measure-proto-node.mjs "$B" "$D/$f.csv" parseEbirdObservations "$f" >> "$OUT"
  node --expose-gc --max-old-space-size=14000 measure-p4-node.mjs "$B" "$D/$f.csv" "$f" >> "$OUT"
  $J measure-proto-jsc.js -- "$B" "$D/$f.csv" parseEbirdObservations "$f" >> "$OUT"
  $J measure-p4-jsc.js -- "$B" "$D/$f.csv" "$f" >> "$OUT"
  node --max-old-space-size=14000 measure-tabs-node.mjs "$B" "$D/$f.csv" "$f" >> "$OUT"
  $J measure-tabs-jsc.js -- "$B" "$D/$f.csv" "$f" >> "$OUT"
done
