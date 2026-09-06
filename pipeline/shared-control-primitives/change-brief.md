# Change Brief — Shared Control Primitives

## What is changing
**Nothing. DECLINED a second time, on fresh measurement — but the recorded
reason is wrong and is replaced.** The v1.0.19 entry's *deciding fact* ("the
guard's population is INTRINSIC TAGS, so every migrated site is a site the
guard stops watching") is not decisive: it is a solvable twenty-line change,
measured below, not a structural bar. The decline stands on the objection that
entry listed first and treated as secondary — there is no visual contract for a
primitive to own — which fresh measurement makes *stronger* than recorded, in a
way that changes the shape of the answer: the app already has its shared button
contract, and it is a CSS class register, not a React component.

## Why now
The idea was returned to the inbox at v1.0.19 with its measurements and the
user re-queued it for this spin. Re-measured at HEAD rather than deferred to
either the earlier decline or the re-queueing. Three builds have landed since
the tag (command palette, ML export hardening, playwright gate), so the
population moved and the figures in `DECISIONS.md`, `ROADMAP.md` and
`.claude/rules/ui.md` are stale again.

## User-facing impact
None. No code is written, no control changes, no keyboard behaviour moves.

## Design pass
**Not needed — no visual change.** The outcome is a decline with no code. Had a
primitive been scoped it would have been a pure passthrough refactor and still
needed no design pass; the design-system register pass that *would* give it a
visual contract remains a separate, unscheduled build.

## Decisions touched
- **v1.0.19, "Shared Button/Link primitives are DECLINED on measurement, and
  the deciding fact is that migrating a control REMOVES it from the guard..."
  (2026-09-05)** — its deciding fact is corrected; its conclusion stands on a
  different and better ground. Its `<Link>` half is also redundant, not merely
  costly: `OutboundLink` already is that primitive.
- **v1.0.16, "The WebKit default tab mode is a platform fact..." (2026-09-03)**
  — its "primitives need an override prop, and forgetting it is the same
  mistake one level up" is withdrawn: a primitive needs no override at all.
- Same stale claim rides in `ROADMAP.md` (Up Next) and `.claude/rules/ui.md:90`.

## What done looks like
Done is this brief plus the record correction at closeout; no code, no version
bump. **What would change the answer** — any one of: (1) a design-system
register pass that gives `sr-btn-quiet` / `sr-btn-accent` a component owner, at
which point the primitive carries a real contract and the guard is made
primitive-aware *before* the intrinsic population shrinks; (2) inline-style
sites falling well below today's 181 of 243, so a primitive would absorb
something; (3) a second app or surface needing the same controls, which is what
usually makes a passthrough worth its layer. Absent those, re-queueing this
should be answered with this brief.
