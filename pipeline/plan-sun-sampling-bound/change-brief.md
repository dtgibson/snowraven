# Change Brief — plan-sun-sampling-bound

## What is changing

Four loops in the Planner are driven by numbers a document supplies and enforce no
ceiling of their own: the sun track's quarter marks and `sunPeakByDay`'s per-day marks
(both in `lib/planSun.ts`), and the gridline and y-tick loops in `PlanChart.tsx`. The
fix is two clamp chokepoints rather than four clamps: `composePlan` bounds the window
span, each day's own span and the day count, so every sun consumer inherits one bound;
and `planGeometry` bounds the y-domain, so both chart loops inherit theirs without
`PlanChart.tsx` being touched at all. `schema.md` §8 and `planSun.ts`'s header then
declare the bound the code HAS rather than the one the design intended, which closes the
paired Informational item in the same change.

## Why now

Two open items from the v1.0.30 security review (ROADMAP Up Next, a Low accepted for
ship and an Informational), taken together because `.claude/rules/security.md`'s widened
linearity rule names these exact two loops as its shipped instances. Scoping measured
the Low's own framing to be **understated**: its "no shipped path can produce such a
document" is false. A live OpenWeather body whose 16 daily entries carry spread-out `dt`
values yields a 5,475-day window through the shipped producer on both transports —
525,667 samples, 191.74 ms, no hand-edited `replay.json` anywhere. The tide `v` driving
the gridlines is `parseFloat` plus a finiteness check with no magnitude bound, so it is
live-reachable too. Details and measurements in `decisions.md`.

## User-facing impact

None. Every conforming fixture family was measured against every proposed clamp and
clears it by a wide margin: window span 4.37–7.75 d against a 17.33 d clamp, day span at
most 89,999 s (the `dst-fall` 25-hour day) against 26 h, max |v| 5.08 ft against 100 ft,
723 samples against a declared 1,696. No drawn pixel, string or layout changes for any
document a producer can write. A document that DOES trip a clamp is truncated silently —
a deliberate decision with its reversal condition recorded in `decisions.md` §D4.

## Design pass

Not needed — no visual change. This is logic-only hardening of existing arithmetic; no
new surface, no new copy, no CSS, no token, no user-visible string.

## Decisions touched

- `DECISIONS.md` v1.0.30, the two-security-findings paragraph (line 97): its Low and
  Informational are both closed by this build, and its "no shipped path produces such a
  document" clause is **corrected**, not merely marked done.
- `DECISIONS.md` v1.0.29, the `composePlan`-as-untrusted-merge paragraph (line 117): this
  build extends that merge's guard from field SHAPES to numeric MAGNITUDES.
- Not touched and deliberately left open: `composePlan` does not re-apply the producer's
  array-LENGTH caps (own ROADMAP line). This build caps `days` only, because that array
  drives a loop; `cells`, `events` and `curve` stay out of scope.

## What done looks like

`sunTrack`, `sunPeakByDay`, the gridline loop and the y-tick loop each have a stated
ceiling that holds for any input reaching them, live or replayed, and `schema.md` §8
declares those ceilings with the `sideAt` day-scan the old table omitted. A guard asserts
each ceiling over hostile spans, day counts and tide magnitudes, with a growth check
carrying an explicit `testTimeout` and an argued absolute budget, and each of the four
clamps has a named red-first mutation. Both ROADMAP items are rewritten as DONE with the
live-path correction stated.
