## barchart-speed-check-ci: bar-chart speed checks steady on Node 20

### What this does
Three speed checks in `frontend/src/lib/barChart/parseBarChart.test.ts` now pass with wide margin on Node 20, which CI runs, and on Node 24. All three still fail when the protection they guard is removed. The change is test-only. `parseBarChart.ts` and `src/test/cpuTiming.ts` are unchanged, and so is the 3.2 limit.

- **Entity decoder row.** Its legs move from 64,000 to 1,024,000 characters down to 16,000 -> 32,000 -> 64,000. The floor drops from 0.5 ms to 0.1 ms, because one call at the new small leg takes about 0.35 ms. (The floor is the smallest small-leg time a reading is divided by. I read the brief's "limit argument" as this floor, since the 3.2 limit is not an argument of `assertLinear`.)
- **All-tabs row.** The text and the legs are unchanged, including the 2 MB -> 4 MB leg. The input is now built with `join`, so it is one flat string from the start; before, it was built with `+` and `repeat`. The cause was how the string was built, not the leg size (below).
- **`&`-cell (M1 B) row.** Added at the coordinator's decision because it has the same cause. Its input is now built with `join` too. Its legs, limit and 0.5 ms floor are unchanged.
- The header, `assertLinear` and shape comments now record both engine effects and the readings behind them.

### Why the rows failed (measured on this Mac, Node 20.20.2 and 24.18.0)
- **Decoder.** The brief's diagnosis holds. Node 20 builds a long string one character at a time superlinearly. The shipped decoder reads 2.04 to 2.11 up to 32K -> 64K on Node 20, 2.27 to 2.33 at 64K -> 128K, and 3.03 to 3.20 at 128K -> 256K. Node 24 reads 2.0 at every size. The new legs stay above `MAX_RAW_NAME_CELL` (2,048), where the reverted decoder reads only about 3.1 (the brief's figure).
- **All tabs and M1 B: a different cause from the brief's "same signature".**
  - The same text built with `+`/`repeat` parses at one of two speeds per character: 3.17 against 1.93 ns on Node 20, and 2.54 against 1.92 ns on Node 24.
  - Which speed a leg gets depends on what was allocated before it is timed. The likely mechanism is whether the variable still reaches the text through the flattened cons string, or the collector has since replaced it with the flat copy.
  - Both parses allocate almost nothing, so no collection evens the legs out. A small leg at the fast speed against a large leg at the slow one reads 3.28 (all tabs) and 3.49 (M1 B) on Node 20.
- **Why not smaller legs.** A plain-Node replay of the all-tabs row's exact sequence read 3.27 at 512K -> 1.024M on Node 20, and 2.64 to 2.76 on Node 24, so shrinking the leg does not remove the split. Built with `join`, the same replay read 1.97 to 2.00 at every leg from 256K to 4M on both Nodes.
- **Same text.** Both `join`-built inputs equal the old text byte for byte at all four leg sizes (checked).

### How to test
1. `cd frontend && npx vitest run src/lib/barChart/parseBarChart.test.ts`: 55 pass.
2. `PATH=~/.nvm/versions/node/v20.20.2/bin:$PATH npx vitest run src/lib/barChart/parseBarChart.test.ts`: 55 pass.
3. `npm run typecheck` and `npx eslint src/lib/barChart/parseBarChart.test.ts` pass.

### Notes for reviewer

**Runs of the whole file, quiet machine (load 1.5 to 5).** A temporary line in `assertLinear` recorded each quotient. It was removed afterwards, and a diff against the saved final file showed only the instrumentation lines.
- The decoder and all-tabs rows have 40 recorded runs per Node: 20 before the M1 B change and 20 after. Their code is identical in both sets.
- The M1 B row has 20 recorded runs per Node with its new input.
- Each column below gives the **raw** quotient (large over small). Where the 0.5 ms floor applied, the **asserted** reading is shown after a slash.
- Every run passed, 55 of 55 tests each: 40 recorded runs per Node, plus 40 unrecorded runs per Node (20 before the M1 B change and 20 of the final file).

| Row, leg | Node 24.18.0 | Node 20.20.2 | Limit |
|---|---|---|---|
| Decoder, 16,000 -> 32,000 | 1.95 to 2.04 | 1.98 to 2.12 | 3.2 |
| Decoder, 32,000 -> 64,000 | 1.96 to 2.09 | 2.08 to 2.19 | 3.2 |
| All tabs, 256,000 -> 512,000 | 1.95 to 2.00 / 1.66 to 1.73 (floor in 40 of 40) | 1.92 to 2.03 | 3.2 |
| All tabs, 2,000,000 -> 4,000,000 | 1.99 to 2.00 | 1.97 to 2.01 | 3.2 |
| M1 B, 256,000 -> 512,000 | 1.97 to 1.98 / 1.63 to 1.64 (floor in 20 of 20) | 1.97 to 2.00 / 1.63 to 2.00 (floor in 19 of 20) | 3.2 |
| M1 B, 2,000,000 -> 4,000,000 | 1.99 to 2.00 | 1.98 to 2.00 | 3.2 |

The worst raw reading is 2.19, which leaves 46% headroom under 3.2. The floor only lowers the asserted first-leg reading, and the raw readings are about 2.0 with or without it. The measurement gave no reason to change M1 B's floor.

**Before, for comparison.**
- **HEAD's file, decoder and all-tabs rows only, 5 runs per Node.** Node 24 passed 5 of 5. Node 20 failed 3 of 5: the all-tabs row once (3.29 at 2M -> 4M), and the decoder twice (6.06 and 7.73 at 512K -> 1.024M).
- **The M1 B row with its old input, 20 runs per Node.** On Node 20 the first leg's raw reading ranged 1.97 to 3.49; one run split, small leg 0.42 ms against large 1.45 ms. It passed at 2.91 only because the floor applied. The large leg ranged 1.39 to 2.00. Node 24 read 1.94 to 2.03.

**Mutation proof.**
- **How each mutation was made.** Each is a scratch edit of `parseBarChart.ts`, made from a snapshot whose hash matches HEAD. Each pattern must match exactly once, and the mutated file must differ from the snapshot.
- **How each was undone.** After each mutation, the file was restored from that snapshot and its sha256 checked against HEAD's (`17f1206d...`). `git diff` on the app file is empty at the end.
- **What the readings are.** "Red" means the real row with its assertion. "Both legs" uses a temporary switch that records both legs without asserting.

| Mutation | Row | Node 24 | Node 20 |
|---|---|---|---|
| Decoder lookahead reverted to an unbounded `const semi = text.indexOf(';', i + 1)` with `semi !== -1 && semi - i <= ENTITY_WINDOW` | Decoder | Red 3 of 3 at the first leg: 3.62, 3.62, 3.63 (under 0.6 s). Both legs: 3.62 to 3.68, then 3.78 to 3.80 | Red 3 of 3: 3.57, 3.62, 3.57. Both legs: 3.61, then 3.78 |
| Per-line prefix rescan: three lines after `const nl = text.indexOf('\n', pos)` count the newlines before `pos` with an `indexOf` loop (the subtle form that hides at the 512/513 shape's first leg) | All tabs | Red 3 of 3 at the first leg: 3.35, 3.36, 3.36. Both legs: 3.32 to 3.37, then 3.89 to 3.90 | Red 3 of 3: 3.38, 3.38, 3.39. Both legs: 3.38 to 3.39, then 3.89 to 3.90 |
| The M1 B path reopened: the `MAX_RAW_NAME_CELL` pre-check deleted AND the decoder lookahead reverted as above | M1 B | Red 3 of 3 at the first leg: 3.63, 3.65, 3.66 (about 2.3 s). Both legs: 3.66, then 3.81 | Red 3 of 3: 3.64, 3.65, 3.65. Both legs: 3.66, then 3.76 |
| Controls: each M1 B protection removed alone | M1 B | Green: decoder reverted alone 1.94 / 1.99, pre-check deleted alone 2.10 / 2.00 | Green: 1.95 / 2.06, and 2.13 / 1.93 |

- **The controls behave as the row's comment says.** M1 B guards the whole path, so it goes red only when both protections are gone. The decoder row pins the lookahead by itself.
- **The all-tabs first leg goes red by only about 5%.** The large leg, at 3.89 to 3.90, is where the margin is, and the row asserts both legs. That is why the large leg was kept and the cause fixed, rather than the leg shrunk.
- **A plain-Node check of the decoder mutant agreed:** 3.59 to 3.67, then 3.72 to 3.80.

**Bundle.** The built CSS is byte-identical to a build made with HEAD's test file (`index-BKEQZO0m.css`, sha256 `1ecf3813...`). I checked again after the final comment edit, with `dist` and the Vite cache cleared before each build. So the new comments add no Tailwind rules.

**Security review notes (M1, L1): recorded as a decision, app unchanged.** The smaller decoder legs no longer catch a decoder quadratic much weaker than a quarter of the reverted lookahead. The row's passing margin also depends on V8's young generation (the area where new objects start), not only on input size: 2.66 to 3.06 on Node 20 in a bare process. Both are now stated in the test file's comments (comment-only). `decisions.md` records the evidence, why the miss is bounded (`MAX_RAW_NAME_CELL` and `MAX_LINE_CHARS`), what would reopen it, and the fix (build the decoder's output from runs, not one character at a time, then restore larger legs).

**Findings outside the brief, not changed.**
- **The 512/513 names row's known residual is not this cause.** Built with `join` in a plain-Node replay, it still read 2.46 to 2.88 on Node 24, consistent with the collector cost already recorded at that row.
- **A correction to my first report.** The all-tabs first leg's 1.66 to 1.73 on Node 24 is the floor at work (its small leg runs 0.42 ms, under 0.5 ms), not a speed difference between two flat strings. Its raw reading is 1.95 to 2.00.
- CI's Node pin is unchanged (a separate decision). ROADMAP line 33 closes at the end of the run.

**No version bump, CHANGELOG line or copy change.** This is a test-only change with an identical app bundle (CLAUDE.md, dev-only changes). Nothing is committed.

Nothing in the app changed, so there is no "how to see it" guide.

## Convention Flags
- A same-run timing row whose timed call allocates almost nothing builds its input as one flat string (`[...].join('')`), never with `+` or `repeat`. A cons-built string's speed per character depends on when the collector last ran, and that split the two legs by up to 1.75x on Node 20 (3.49 against a linear 2.0).
- A doubling leg that times code which builds a string one character at a time stays at 64,000 characters or fewer, because Node 20 (CI's Node) turns superlinear above that. Size such legs against the slowest engine CI runs, and measure them there.
- When a timing row reports its readings, give the raw quotient beside the floored one. A floor that applies silently can be mistaken for a measured effect.
