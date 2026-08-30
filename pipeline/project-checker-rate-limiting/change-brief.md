# Change Brief — Project Checker Rate Limiting

## What is changing
The projects sweep (Statistics tab, `useChecklistProjects.ts`) gains progressive
pacing and an automatic pause. Today each 429 wave opens the shared cooldown
(2 s base, Retry-After honored), but one post-cooldown success resets the
ladder and the sweep resumes at the full 150 ms pace — so on a large backup it
bumps into eBird's limiter roughly every minute, forever, with no escalation
and no bound. The change: (a) after each 429 wave observed during a pass, the
sweep widens its own inter-request spacing for the rest of the pass (a pure
schedule; going slower than the gate's floor is always contract-compliant);
(b) after a bounded number of waves in one pass (~3), the sweep pauses itself
through the existing stop machinery and shows a new status state suggesting
the user try again in about an hour. Answers already paid for are kept; Resume
works exactly as it does after a manual Stop.

## Why now
Live-use feedback (the saved idea): "the warning that eBird wants the app to
slow down kicks in frequently after about a minute." That is the shipped
design operating as written — the v0.5.92 ladder resets on a single success,
so sustained sweep volume re-trips the limiter each minute. This is the same
class of finding as the v0.5.92 entry's own lesson: only real-key, real-volume
use exposes rate-limit behavior. The demand-spreading pause is also provider
etiquette, in the spirit of the Nominatim contract.

## User-facing impact
One new display state on the existing Projects card: after repeated
slow-downs the check pauses itself, states counts honestly in the shipped
register (tone/icon/note/actions), and suggests trying again in about an hour;
a Resume-style control stays offered. The existing cooldown state may be seen
less often mid-pass as spacing widens. Nothing else user-visible changes.
`docs/HELP.md`'s projects passage gets the one-line behavior update in the
same change. Version stays 1.0.8; the CHANGELOG bullet is appended to the
existing 1.0.8 entry (this joins build 1's bundle).

## Design pass
Not needed — the paused state is one new row in `projectsCopy.ts`'s copy
table, a system that file explicitly designs for ("a twelfth state is one row
of copy"), reusing the shipped icon/tone/status-line register; no new visual
treatment. It must coexist with build 1's densified card layout without
touching that layout. Copy follows the file's voice rules (no em dashes,
states say what the number is doing, agreement helpers).

## Decisions touched
- "One enforcement point per request, shared state across all of them"
  (v0.5.93): EXTENDED, not reversed. The sweep stays its own enforcement point
  over the shared `ebirdGate` state; the gate's key-global semantics (one
  cooldown, a 429 anywhere slows everywhere, Retry-After parsed/bounded/
  re-serialized identically on both transports, 429 never cached) are
  untouched. Recommended gate change is observation only: a monotonic
  wave counter so a pass can count waves over its own window.
- "A stubbed harness can never see a real rate limit" (v0.5.92): the pacing
  numbers gain a per-pass progressive layer; its test rules (client-observed
  request starts, fake timers, red-first) govern the new tests.
- "The projects store persists two raw fields and nothing derived" (v1.0.5):
  respected — the pause is SESSION-ONLY, no "paused until" timestamp is
  persisted. Deliberate: nothing about a stop is persisted today (that is what
  makes the honest `partial` state fall out on relaunch), and the hour is
  guidance copy, not an enforced lockout. Recorded as the in-lane choice.

## What done looks like
Fake-timer tests prove the behavior by work done, never elapsed time: a pass
fed N mocked 429 waves issues no further requests and lands in the paused
state (asserted on client-observed request starts and status transitions);
spacing after wave k is wider than after wave k−1; Resume after a pause asks
only about what is unanswered. The paused state joins `projectsCopy.test.ts`'s
sweep via the exported `restingStatus`/state machinery. Gate contract tests
stay green: Map Explorer single-shot lookups never inherit the sweep's pause,
and the Retry-After parity fixtures are byte-untouched on both transports (no
backend change — `checklists.py` already surfaces 429-as-429). `npm run build`
passes; version 1.0.8 unchanged, CHANGELOG appended, `docs/HELP.md` updated.

---

### Scope map (for The Engineer)
Will change: `frontend/src/lib/rateLimit.ts` (pure constants + progressive
per-pass spacing schedule + pause threshold), `frontend/src/lib/ebirdGate.ts`
(monotonic wave-count observation only), `frontend/src/lib/useChecklistProjects.ts`
(pause policy, per-pass extra spacing, new status kind),
`frontend/src/lib/projectsCopy.ts` (+ its test) (the new state's row),
`frontend/src/components/ProjectsSection.tsx` (action mapping only, if a new
action id is needed — build 1's layout untouched), `docs/HELP.md`,
`CHANGELOG.md`, plus the tests beside each lib file.

Will NOT change: `transport.ts` / `EBIRD_GATED_PATHS`, `gatedEbirdCall`'s
retry contract, the gate's cooldown/reset semantics for single-shot lookups,
`checklistProjectsCache.ts` and its schema, `backend/routers/checklists.py` /
`map.py`, the Retry-After twins and shared fixtures, `PRODUCT_CONTEXT.md`'s
cost framing, versions.

Recommended home for the auto-pause: the CONTROLLER (`useChecklistProjects`),
because pausing is sweep policy, not key-global policy — an hour-scale pause
must never leak into the Map Explorer's single-shot lookups, which the shared
gate governs correctly today. Thresholds and schedules live as pure values in
`rateLimit.ts`; the gate contributes only the wave observation.
