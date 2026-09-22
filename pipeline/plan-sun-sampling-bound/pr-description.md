## Planner sampling bounds (plan-sun-sampling-bound)

### What this does

Four loops in the Weather/tide Planner were driven by numbers an untrusted document
supplies and enforced no ceiling of their own: the sun track's quarter marks and
`sunPeakByDay`'s per-day marks in `lib/planSun.ts`, and the two gridline loops in
`PlanChart.tsx`. This adds two clamp chokepoints rather than four clamps. `composePlan`
now bounds the window span, each day's own span and the day count, so every sun consumer
inherits one ceiling; `planGeometry` bounds the tide y-domain, so both chart loops inherit
theirs and `PlanChart.tsx` is not edited at all.

It also corrects the record. `lib/planSun.ts`'s header declared a 1,568-sample bound the
code never enforced, and `schema.md` section 8 rested that figure on `PLAN_DAYS_MAX`,
which caps the day COUNT at the producer and never bounded a window SPAN. The v1.0.30
review recorded this as reachable only by hand-editing `replay.json`; that is false. A
live One Call body whose 16 daily entries carry `dt` a year apart yields a 5,475-day
window and 525,667 samples through the shipped builder on both transports.

No user-facing change. Every fixture family clears every clamp by a wide margin and its
composed document is byte-identical before and after.

### How to test

1. `cd frontend && npx vitest run src/lib/planSpanBound.test.ts` (68 rows: hostile
   spans, day counts and tide magnitudes; the loop-anchor magnitude rows; the live-path
   row; the whole-day normalization equality rows; the swept DST direction-2 row; the
   growth check; the 12 byte-identical fixture rows).
2. `npx vitest run src/lib/plan.test.ts src/lib/planSun.test.ts src/lib/planChartGeometry.test.ts src/lib/entryChunk.test.ts`
3. `npm run typecheck && npm run lint && npm run build`
4. In the app: Weather tab, Plan mode, fetch a plan for any location. The chart, the
   sun track, the day list and the tide scale should be exactly as before.

### Notes for reviewer

- **The clamps are in the merge, not in the four loops.** That is the point: the bound
  becomes a property of the document `composePlan` emits, so a fifth consumer added later
  inherits it. `components/PlanChart.tsx` has no diff.
- **`lib/plan.ts` declares its own `PLAN_COMPOSE_DAYS_MAX` rather than importing
  `weatherPlan.ts`'s `PLAN_DAYS_MAX`,** because `entryChunk.test.ts` pins that module's
  closure to exactly itself. The two are held equal by a row in the new guard, the same
  way `weatherTidePlanBound.test.ts` pins `PLAN_MAX_CODE_UNITS * 10` to
  `REPLAY_MAX_BYTES`.
- **`PLAN_DAY_MAX_S` is 26 h, not 24 h, and the value came from a measurement.** A real
  fall-back day measures 89,999 s in the `dst-fall` family, so a 24 h clamp would refuse a
  conforming day. The guard sweeps every calendar day of seven years in the three fixture
  zones (7,671 days, 42 of them DST days) rather than rostering the known one.
- **Two things the brief did not specify, both argued in `decisions.md` E1:** a clamped
  window blanks its end LABEL (the producer computed it for the unclamped instant, and
  `''` is already a reachable value for that field), and the y-domain clamp needs a
  degenerate fallback because a curve lying wholly beyond the ceiling would collapse the
  domain and divide by zero in `y`.
- **The guard's gridline counter carries a hard iteration cap on purpose.** With the
  domain clamp removed and `v` at `Number.MAX_VALUE`, `v += 2` does not advance
  `Math.ceil(yMin)` at all, so the shipped loop never terminates. A red-first mutation has
  to fail, not hang.
- Red-first results for all four clamps, with the named failing row for each, are in
  `decisions.md` E4. Files restored and verified byte-identical by SHA-256.
- **A fifth constant closes the security review's Medium in place: `PLAN_TS_ABS_MAX`
  bounds the loop ANCHOR, not a span.** A span clamp says nothing about where the span
  sits, and from |t| >= 2^63 one ulp of a double exceeds the 900 s quarter step, so both
  sun loops stop advancing and hang. Its value is 8.64e12 SECONDS, the ECMAScript Date
  range converted into this document's unit; the unconverted 8.64e15 admits a band where
  `solarNoonTs`'s day normalization hangs by a different mechanism, which is named as a
  second non-termination one level down, at `solarNoonTs`, and that one is closed in the
  same build (`decisions.md` R1 and R2). Ten guard rows, red-first 8 failed in 14 ms, and
  they walk a capped replica of each loop before the real call because a `testTimeout`
  cannot interrupt a synchronous loop.
- **`solarNoonTs`'s whole-day normalization is now one arithmetic step
  (`wholeDayNormalize`), not a loop.** The loop ran |eot| / 1440 times and `eot` is
  unbounded past |t| about 2.1e12 s, so it needed 9.19e18 iterations at an instant the
  merge admits. **The rounding is half-toward-zero, not `Math.round`:** the loop's
  conditions are strict, so an offset of exactly +43,200 s stays put, and the obvious
  one-liner would move it a whole day -- a tie reachable at lng 0 with a zero equation of
  time from a UTC midnight. Equality is asserted against a capped private copy of the old
  loop over a generated corpus, never a hand-typed column; the 12 golden families are
  byte-identical, which is the check that the live path is untouched.
- `.claude/rules/security.md`'s `paths` frontmatter gains the four files; the body is
  untouched. The rule's linearity entry names these exact loops as its shipped instances
  and none of the files loaded it.

### Changelog line

- Planner: the sun track, the per-day sun peaks and the tide chart's gridlines are now bounded by the plan document itself, so a malformed or absurd forecast cannot make the Weather tab hang while it draws. No change to any plan a real forecast produces.
