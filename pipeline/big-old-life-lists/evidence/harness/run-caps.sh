#!/bin/bash
# Peak memory at candidate cap sizes (decisions.md entry 3): the shipped shape at
# today's 50 MB cap against the new shape at 50, 100, 150 and 190 MB, in
# Chromium, WebKit, the iOS 27 simulator and Chrome 133 on the API 36 emulator.
# Usage: run-caps.sh <port> <ios udid> <page results.jsonl> <out dir>
P=$1; U=$2; RES=$3; OUT=$4
cd "$(dirname "$0")"
for spec in "big-188000.csv shipped" "big-188000.csv packed" "big-377000.csv packed" "big-566000.csv packed" "big-716000.csv packed" "big-377000.csv shipped"; do
  set -- $spec
  node drive-browsers.mjs $P "$OUT/caps.jsonl" chromium 1 $1 $2 >/dev/null 2>&1
  node drive-browsers.mjs $P "$OUT/caps.jsonl" webkit 1 $1 $2 >/dev/null 2>&1
  ./run-ios-sim.sh $P $U "$RES" "$OUT/caps-ios.jsonl" $1 $2 >/dev/null 2>&1
  ./run-android.sh $P "$RES" "$OUT/caps-android.jsonl" $1 $2 >/dev/null 2>&1
done
echo done
