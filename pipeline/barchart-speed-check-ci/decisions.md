# Decisions — barchart-speed-check-ci

## 2026-10-02 — The decoder row's narrower reach is accepted, not fixed in this build (Auditor M1, with L1)

**Decision (coordinator, this build).** `parseBarChart.ts` stays unchanged. The decoder row keeps its new legs (16,000 -> 32,000 -> 64,000), its 0.1 ms floor and the 3.2 limit. The measured loss of reach below is written down rather than closed. The slice-based fix that would close it is queued separately as an idea. This follows CLAUDE.md's rule that a decision not to act on a measured difference is written down as a decision. The security review that measured it (`security-report.md`) is a gitignored run record, so the evidence is copied here.

**Why the legs moved at all.** The old 512,000 -> 1,024,000 leg read 2.95 to 9.35 on CI's Node 20 with the decoder unchanged. It was timing Node 20's one-character-at-a-time string building, not the decoder, so on CI it carried no signal.

**Evidence: what the smaller legs no longer catch.**
- **How it was measured.** The Auditor used scratch copies of the parser outside the repo, where the unbounded `;` search (`text.indexOf(';', i + 1)`) runs at every k-th `&` only. That is a quadratic 1/k as strong as the fully reverted lookahead.
- **Settings.** Each copy was timed with the repo's `bestPerCallCpuMs`, the row's floor and its 20 ms batched samples. V8's young generation was pre-grown (`--min-semi-space-size=16`) to match the in-file context, where the shipped row reads about 2.0.
- **Sample.** Two runs per Node per cell unless noted.

| Decoder variant | New 16K -> 32K | New 32K -> 64K | Old first leg 64K -> 128K (Node 24, 1 run) |
|---|---|---|---|
| Shipped | 1.99 to 2.12 | 1.95 to 2.15 | 2.06 |
| Lookahead reverted (full strength) | 3.55 to 3.65 | 3.76 to 3.81 | 4.04 |
| 1/4 strength | 3.20 to 3.24 (red 3 of 4) | 3.45 to 3.51 (red 4 of 4) | not run |
| 1/8 strength | 2.85 to 2.93 | 3.11 to 3.21 (red 2 of 4) | 3.59 (red) |
| 1/16 strength | 2.55 to 2.70 | 2.90 to 2.97 | 3.30 (red) |

The row still catches the defect it was written for, the fully reverted lookahead, on both legs and both Nodes. It also reliably catches a quadratic a quarter as strong. One-eighth strength is a coin flip, and one-sixteenth is missed, where the old first leg caught it. In a fresh process with the default heap, the 1/8 variant was red in 5 of 6 runs and the 1/16 variant in 0 of 6. Slower-growth regressions (n log n, n^1.5) were never caught by a 3.2 limit at any size, so nothing changed for them.

**Why the miss is bounded.**
- **The raw name-cell bound.** While `MAX_RAW_NAME_CELL` (2,048) is in place, no file hands the decoder enough characters for such a quadratic to show. At 2,048 -> 4,096, the 1/8 variant reads 1.15 and even the fully reverted decoder reads 2.80.
- **The line cap.** A missed quadratic matters only if that bound is also removed. `MAX_LINE_CHARS` (65,536) then still caps each cell, so the cost is a constant factor per row, not a hang.
- **Measured double fault.** With the raw bound removed and the 1/8 quadratic in place, the file-level M1 B row reads 2.76 to 2.87, then 3.03 to 3.13, which is green. A 4 MB input then parses in 427 to 435 ms against 108 to 121 ms shipped, about 4x. By extrapolation, a 50 MB file of such rows takes about 5 s instead of 1.5 s. HEAD's old decoder row would have caught that double fault at its first leg (3.59).

**The same cause also sets the row's passing margin (Auditor L1).**
- **How it happens.** `out += ch` keeps a chain of one-character pieces alive for the whole call. When V8's young generation is small against that chain, collections during the call copy it repeatedly, so the cost grows faster than the input.
- **Inside this file.** The row runs after the allocation-heavy file-level rows, and read 1.95 to 2.19 over 40 runs on each Node.
- **In a bare Node process.** Node 20 read 2.66 to 3.06 over 15 runs (worst 4% under the limit), and Node 24 read 2.26 to 2.44.
- **With the young generation capped.** Under `NODE_OPTIONS=--max-semi-space-size=1`, the real row goes red on Node 24 with the decoder unchanged: 5.49, 6.02 and 5.60 alone, and 5.39 in a full-file run.
- **What could bring a false red back.** Moving the row, reordering the tests, a V8 change to how that area is sized, or a runner's `NODE_OPTIONS`. The test file's comments now say this (comment-only change, this build).

**What would reverse this decision (reopen it).**
1. Any change to `decodeEntities`, `stripTags`, `tidy` or `splitNameCell` in `frontend/src/lib/barChart/parseBarChart.ts`. The row no longer catches a decoder quadratic weaker than about a quarter of the reverted lookahead, so such a change needs its own linearity measurement, through the real entry point at doubling sizes (`.claude/rules/security.md`), not trust in the row.
2. `MAX_RAW_NAME_CELL` or `MAX_LINE_CHARS` raised or removed, or `splitNameCell` gaining a caller that does not apply them. These two bounds are what make the miss harmless.
3. The decoder row reading red with the decoder unchanged, under any heap history (the L1 trigger).
4. The fix below landing. The row then restores larger legs.

**The fix, and where it goes.**
- **Where.** In `frontend/src/lib/barChart/parseBarChart.ts`: `decodeEntities` (the `out += ch` loop), `stripTags`, and `tidy`. For `tidy`, this is the same cure the 512/513 names row's known residual already names.
- **What.** Build each output from the unchanged runs of its input, appending one run per stretch between edits, instead of one `out += ch` per character. That removes the per-character string building that Node 20 and a small young generation turn superlinear.
- **Constraint.** The kept name must not retain the file. The cell `splitNameCell` receives is `text.slice(pos, nameEnd)`, a SlicedString that holds the whole file text alive. Today `tidy` copies character by character, so a kept name is a fresh string. A slice of that cell, or a one-part `[x].join('')`, which V8 may return as that very part, would keep the whole file alive for as long as the rows do. In `.claude/rules/testing.md` (v1.0.13), holding one slice of a 148.4 MB export retained 152.2 MB, against 3.8 MB for a character copy. So the fix measures retention the way v1.0.13 did before it ships.
- **Then, in `frontend/src/lib/barChart/parseBarChart.test.ts`.** Restore a 64,000 -> 128,000 first leg, or larger, for the decoder row. Choose the legs only after measuring the shipped decoder on Node 20 in a bare process and under `--max-semi-space-size=1`, not only inside the file. Keep the legs above `MAX_RAW_NAME_CELL`. Re-run the 1/4, 1/8 and 1/16 mutants above to confirm the reach is back.
