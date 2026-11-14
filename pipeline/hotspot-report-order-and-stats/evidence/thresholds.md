# Thresholds re-measured in the built app (decisions.md D-08)

Production build, `website/tools/verify/verify-hotspot-reports.mjs` (raw output: `verify-harness-fixed.txt`), Playwright 1.62, Chromium and WebKit. **Every reading below is identical in the two engines.** Machine load near 470 from other sessions during the run; geometry does not depend on it.

## The coupled pair: report one column at 53.25em and under, list stacked at 28em and under

| Leg | 100% | 125% | 150% | 200% |
|---|---|---|---|---|
| Wide life-list row forced above 28em (+0.25 to +4em): worst ink | 0px | 0px | 0px | 0px |
| Two columns (rail first) forced above 53.25em (+0.25 to +4em): worst ink | 0px | 0px | 0px | 0px |
| Real window where two columns begin, classic 15px scrollbar | 1,133px (report 53.375em) | 1,399px (53.300em) | never | never |
| Real window where two columns begin, overlay scrollbar | 1,117px (53.313em) | 1,385px (53.350em) | never | never |

"Never": `.sr-panel` is capped at 1280px, so the report is at most 1,232px and cannot reach 53.25em above about 144% text. Two columns over a stacked list: 0 of 608 window configurations. Both thresholds unchanged.

## At a glance: tiles at an 8rem track minimum, facts at `max(19rem, 34%)`

Card body width (px) at which each track first appears, swept in 2px steps; predicted = the track minimum times n plus the gaps.

| | 100% | 125% | 150% | 200% |
|---|---|---|---|---|
| 2 tiles | 272 (pred. 272) | 336 (336) | 400 (400) | 528 (528) |
| 3 tiles | 416 (416) | 512 (512) | 608 (608) | 800 (800) |
| 4 tiles | 560 (560) | 688 (688) | 816 (816) | 1,072 (1,072) |
| 5 tiles | 704 (704) | 864 (864) | 1,024 (1,024) | 1,344 (1,344) |
| 2 fact columns | 644 (644) | 796 (796) | 948 (948) | 1,252 (1,252) |
| Worst ink in the card across the sweeps | 0px | 0px | 0.02px (Chromium), 0px (WebKit) | 0px |
| Tile labels wrapped where tiles are 2+ across | 0 | 0 | 0 | 0 |
| Facts not side by side where facts are 2 across | 0 | 0 | 0 | 0 |

Phones, card body (px) / tile tracks / fact tracks, stress place (the one-species place reads the same):

| Phone width | 100% | 200% |
|---|---|---|
| 320 | 242 / 1 / 1 | 242 / 1 / 1 |
| 390 | 312 / 2 / 1 | 312 / 1 / 1 |
| 640 | 562 / 4 / 1 | 562 / 2 / 1 |

Both track minima unchanged.

## Overhangs found

- **Most-recorded row, new, fixed:** 8.2px past its cell at 320px / 200% ("Laughingthrush" in a 181px cell), both engines. After `overflow-wrap: anywhere` on the row's name: 0 of 176 phone configurations fail.
- **Life list name cell, pre-existing, FIXED in the D-11 errand (to 0px in every configuration; the allowance was removed from the harness):** with "Laughingthrush", "MacGillivray's" and "Superciliaried" in the name cell at 320 to 375px, 150% and 200% text. At 320px / 200%: 67.81px Chromium, 67.72px WebKit; at 320px / 150%: 2.63px and 2.66px. The same figures to the hundredth on a scratch build of HEAD (`probe-cell-overhang.mjs`, run against both dists). Inside the card, no page scroll.
