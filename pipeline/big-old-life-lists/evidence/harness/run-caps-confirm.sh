#!/bin/bash
# Repeats at the chosen caps (decisions.md entry 3): the shipped shape at today's
# 50 MB beside the new shape at the cap, twice more each, so the comparison is
# against a spread rather than one reading.
# Usage: run-caps-confirm.sh <port> <ios udid> <page results.jsonl> <out dir>
P=$1; U=$2; RES=$3; OUT=$4
cd "$(dirname "$0")"
for k in 1 2; do
  ./run-ios-sim.sh $P $U "$RES" "$OUT/confirm-ios.jsonl" big-188000.csv shipped >/dev/null 2>&1
  ./run-ios-sim.sh $P $U "$RES" "$OUT/confirm-ios.jsonl" big-243000.csv packed >/dev/null 2>&1
  ./run-android.sh $P "$RES" "$OUT/confirm-android.jsonl" big-188000.csv shipped >/dev/null 2>&1
  ./run-android.sh $P "$RES" "$OUT/confirm-android.jsonl" big-377000.csv packed >/dev/null 2>&1
  node drive-browsers.mjs $P "$OUT/confirm-chromium.jsonl" chromium 1 big-188000.csv shipped >/dev/null 2>&1
  node drive-browsers.mjs $P "$OUT/confirm-chromium.jsonl" chromium 1 big-377000.csv packed >/dev/null 2>&1
done
echo done
