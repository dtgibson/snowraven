#!/bin/sh
# The browser matrix for decisions.md entry 1. Needs serve.mjs on <port>.
# Usage: run-browsers.sh <port> <out.jsonl>
P=$1; OUT=$2
cd "$(dirname "$0")"
for csv in reference.csv big-21856.csv big-300000.csv big-600000.csv big-1000000.csv; do
  for shape in shipped packed; do
    node drive-browsers.mjs $P "$OUT" chromium 1 $csv $shape || echo "{\"engine\":\"chromium\",\"csv\":\"$csv\",\"shape\":\"$shape\",\"error\":\"driver failed\"}" >> "$OUT"
    node drive-browsers.mjs $P "$OUT" webkit 1 $csv $shape || echo "{\"engine\":\"webkit\",\"csv\":\"$csv\",\"shape\":\"$shape\",\"error\":\"driver failed\"}" >> "$OUT"
  done
done
for rate in 4 6; do
  for csv in reference.csv big-300000.csv; do
    for shape in shipped packed; do
      node drive-browsers.mjs $P "$OUT" chromium $rate $csv $shape || echo "{\"engine\":\"chromium\",\"cpuThrottle\":$rate,\"csv\":\"$csv\",\"shape\":\"$shape\",\"error\":\"driver failed\"}" >> "$OUT"
    done
  done
done
