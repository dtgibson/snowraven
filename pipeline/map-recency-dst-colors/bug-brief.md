# Bug Brief: Map recency colors at daylight-saving changes

## What is broken
Confirmed by measurement. `recencyTier` (`frontend/src/lib/mapExplorerFormat.ts`) FLOORS the hours between two local midnights, so a span containing the 23-hour spring-forward day counts one day short: the defect `isWithinWindow` had until 1.0.39, deliberately left for its own change (DECISIONS.md v1.0.39, ROADMAP).
Under `TZ=America/Los_Angeles` with now 2026-03-09, a report from 2026-03-01 (8 calendar days) gets the "past 7 days" fresh color instead of mid, and one from 2026-02-21 (16 days) gets mid instead of old.
It lasts longer than the one day the idea names: the fresh/mid edge is wrong for the 8 days after the change (03-09 to 03-16) and the mid/old edge for 16 days (03-09 to 03-24), every year.
Same count (120 wrong cells a year) in Los Angeles, New York, London, Sydney, Lord Howe, Santiago and Havana; zero in Tokyo and UTC. Fall-back is not affected (floor of N days plus one hour is still N).

## Steps to reproduce
1. Run vitest with `TZ=America/Los_Angeles`; pin Date with `vi.useFakeTimers({ toFake: ['Date'] })` and `vi.setSystemTime(new Date('2026-03-09T19:00:00Z'))` (noon local, the day after spring-forward).
2. `recencyTier('2026-03-01 08:00')` (8 days back) returns `'fresh'`; expected `'mid'`. `recencyTier('2026-02-21 08:00')` (16 days) returns `'mid'`; expected `'old'`.
3. Pin now to `2026-03-24T19:00:00Z`: `recencyTier('2026-03-08 08:00')` (16 days) returns `'mid'`; expected `'old'`. Pin now to `2026-11-02T20:00:00Z` (after fall-back): 7, 8, 15 and 16 days back all tier correctly.
4. Time of day does not matter (00:05 and 23:30 local on 03-09 read the same). Evidence in the scratchpad: `recency/out.txt` (table) and `recency/sweep.txt` (every day of 2026 x 0 to 40 days back x 9 zones x 5 hours).

## Expected behavior
The tier counts calendar days on every day of the year: 0 to 7 days fresh, 8 to 15 mid, 16 and older old, as Help (`docs/HELP.md`, Media Targets) and the Media Targets popup already say, and in agreement with the fixed `isWithinWindow`.
The fix is ROADMAP's: `Math.round` in place of `Math.floor`, the same change `isWithinWindow` took. That candidate cleared all 74,825 swept cells in every zone, Santiago's midnight transitions included. No boundary, color token or visible label moves.

## Blast radius
One function, nine call sites, all Map Explorer: `MapExplorer.tsx` (windowed lifer tier ~1021, Targets in view dot ~2877), `map/NearbyLiferMarkers.tsx` (popup dot ~118), `map/TargetMarkers.tsx` (chip color ~70, popup tier label ~135), `nearbyLifers.ts` (~64, ~90: lifer pin color and the Lifers in view dot ~3023), `links/linkFocus.ts` (widget bird-tap focus ~81).
Targets, Statistics, the hotspot coloring and the iOS widgets do not call it (they use `isWithinWindow` or Swift's civil-day count); there is no Swift or Python twin. Spans with no spring-forward are whole multiples of 24 hours, so round and floor agree there, and a malformed date still falls to `'old'` (NaN).
Rider on the same boundary, found while scoping: the two screen-reader tier labels in `MapExplorer.tsx` (~2894, ~3023) say 8 to 14 and 15 to 30 days, while the function, the visible popup and Help say 8 to 15 and 16 to 30. Align them to 8 to 15 and 16 to 30 (in-app text, no approval stop).
A shared day-count helper, if extracted, must live in `mapExplorerFormat.ts` or a leaf module: `nearbyLifers.ts` already imports `mapExplorerFormat.ts`, so the reverse import is a cycle.

## What done looks like
DST rows in `frontend/src/lib/mapExplorerFormat.test.ts`, zone pinned to America/Los_Angeles with the "zone really is pinned" guard row (offset 420 vs 480) as in `nearbyLifers.test.ts`: on 2026-03-09, 7d fresh, 8d mid, 15d mid, 16d old; on 2026-03-24, 16d old; on 2026-11-02, the same four symmetric.
A structural row over a generated corpus (every day of 2026 x 0 to 20 days back): tier is fresh iff `isWithinWindow(d, 7, now)` and not old iff `isWithinWindow(d, 15, now)`, with no hand-typed expected column. Reverting to `Math.floor` turns the 8-day, 16-day and corpus rows red.
The two screen-reader labels name the same ranges as the function, pinned by a row.
