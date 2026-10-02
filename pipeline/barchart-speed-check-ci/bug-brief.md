# Bug Brief — barchart-speed-check-ci

## What is broken
`parseBarChart.test.ts` > "the name cell's entity decoder ... doubling the CELL" fails on CI's Node 20 often, not always: 9 of the last 18 completed `main` Pipeline runs (latest `36945772684` ran it and passed). Its 512,000 -> 1,024,000 leg read 2.95 to 9.35 against a 3.2 limit there; the Mac's Node 24 reads 1.9 to 2.4.
Cause, measured on this Mac: Node 20 builds a million-character string one character at a time superlinearly (a bare `out += ch` loop reads 10x at that leg on Node 20, 2.0 on Node 24), so that leg times the engine, not the decoder. The app never hands the decoder more than `MAX_RAW_NAME_CELL` (2,048) characters.
Same file, same signature, lower rate: the "all tabs" row's 2M -> 4M leg failed 2 of those 18 runs (3.29, 3.57) and 1 of 3 local Node 20 trials (3.28); Node 24 reads 2.00. In scope.

## Steps to reproduce
1. `cd frontend && PATH=~/.nvm/versions/node/v20.20.2/bin:$PATH npx vitest run src/lib/barChart/parseBarChart.test.ts -t "entity decoder"` (Node 20.20.2 is installed via nvm; CI pins `node-version: '20'` in `.github/workflows/pipeline.yml`).
2. Repeat 3 to 5 times: fails intermittently at `512000 -> 1024000` (seen 6.08 locally; 9 of 15 probe trials over 3.2, small leg bimodal at 11/21/30 ms, large leg steady at ~87 ms).
3. Same command on Node 24.18.0: passes every time. CI evidence: `gh run view 36942903636 --log-failed` (3.37), `36932503306` (9.35).

## Expected behavior
The speed checks pass with comfortable margin on CI's Node 20 and on Node 24, and still go red when the protection they exist for is removed: the decoder's six-character entity lookahead (Auditor M1 B, `.claude/rules/security.md` linearity) and the file-level scans' linearity.
Measured band that does both for the decoder row, on both Nodes: 16K -> 32K and 32K -> 64K read 1.99 to 2.17 shipped and 3.60 to 3.79 with the lookahead reverted to an unbounded `indexOf(';')`. At the app's real 2,048 bound the reverted decoder reads only ~3.1, so the row must stay above the bound; it must not time the engine's million-character string building.

## Blast radius
Test-only: `frontend/src/lib/barChart/parseBarChart.test.ts` (the decoder row's legs and limit argument, the all-tabs row's large leg, and the header and `assertLinear` comments that cite CI readings). No app code; `parseBarChart.ts` is untouched.
`frontend/src/test/cpuTiming.ts` is shared by other timing files: leave it unchanged. The large file-level leg exists for a documented reason (a prefix-rescan quadratic hides at the first leg on the 512/513 shape), so any change to `FILE_LEGS` keeps that shape's large leg.
Out of scope: the 512/513 names row's known residual (load-sensitive, not seen on CI in these runs) and `verify-plan-daylabels.mjs`'s Escape race (ROADMAP line 69), which also reddened 2 of these 18 runs. ROADMAP line 33 is this item and is closed at the end.

## What done looks like
On Node 20.20.2 and Node 24 locally, the changed rows pass 20 of 20 file runs with the quotient's worst reading recorded and well under the limit, and both go red on Node 20 AND Node 24 with the lookahead reverted (decoder) or a per-line prefix rescan (file-level), each mutation run and recorded.
The Pipeline frontend job runs these rows green on the bundle's push to `main`.
