# PR — Project Checker Rate Limiting (v1.0.8, joins build 1's bundle)

## What this does

The projects sweep (Statistics tab) now escalates instead of oscillating when
eBird rate-limits it. Live use found the shipped v0.5.92 design operating as
written: the gate's cooldown ladder resets on a single post-cooldown success,
so a large backup's sweep re-trips eBird's limiter roughly every minute, for
the whole run, with no escalation and no bound.

Three changes, in three layers:

1. **`lib/rateLimit.ts`** gains the pure per-pass schedule: `sweepSpacingMs`
   (spacing widens by a factor of 4 per 429 wave observed during a pass,
   strictly monotonic) and `SWEEP_PAUSE_WAVES = 3` (the bound after which the
   pass stops asking). Pure, clock-free, base-as-parameter, so the
   zero-spacing test seam keeps every full-speed suite at full speed.
2. **`lib/ebirdGate.ts`** gains `waveCount`, a monotonic wave counter —
   observation ONLY. It advances in lockstep with the policy ladder but is
   never reset by a success and is never consulted by the gate's own policy,
   so the cooldown/reset semantics for single-shot lookups are untouched. A
   pass counts waves over its own window by differencing it.
3. **`lib/useChecklistProjects.ts`** owns the policy (the brief's recommended
   home — pausing is sweep policy, not key-global policy). After each wave
   the pump sleeps the full widened interval between items; after the third
   wave in one pass it pauses itself through the existing stop machinery and
   the new `paused` state renders: clock icon, warning tone, the tally with
   "every answer so far is kept", and a suggestion to try again in about an
   hour. Resume is the SHIPPED resume control and, after a pause, runs in
   'pending' mode — it asks about everything unanswered (failed AND
   never-reached), never about an answered checklist. Nothing about the pause
   is persisted: a relaunch resolves to `partial`, which claims nothing.

The `paused` state is one new row in `projectsCopy.ts`'s copy table — the
"a twelfth state is one row of copy" promise, exercised. `ProjectsSection.tsx`
is untouched: the row reuses the shipped `clock` icon, `warning` tone, and
`resume` action id, so no new mapping arm was needed and build 1's densified
layout is byte-identical.

## How to test

1. `cd frontend && npx vitest run` — full suite (3,626 tests, 233 files).
   The new coverage:
   - `rateLimit.test.ts` — the pure schedule: strict monotonicity per wave,
     the pinned bound and factor, clamping, the zeroed-seam identity.
   - `ebirdGate.test.ts` — the monotonic counter advances with the ladder,
     survives the ladder's reset, counts a burst as one wave, and never feeds
     the delay (ten historical waves later, a fresh 429 still backs off from
     the 2 s base).
   - `useChecklistProjects.test.tsx`, "the progressive pause" — full-duration
     passes through the real gate, asserted as work done: three real waves
     then not one request more and the `paused` state; answers paid for kept;
     resume asks exactly the unanswered set; widened spacing measured on
     client-observed request starts; `gatedEbirdCall` (the Map Explorer's own
     wrapper) still answers while the sweep is paused and its success does
     not resume the sweep; a fresh mount resolves to `partial`.
   - `projectsCopy.test.ts` — `paused` joined the `restingStatus`-driven
     corpus sweep (agreement rules, em-dash sweep, singulars) plus its own
     block, including the paused-re-check edge ("the other 0" is not
     expressible).
2. `npm run build` — passes (tsc -b + vite).
3. Mutation checks run red-first during the build: neutering the pause check,
   dropping the widened sleep, and reverting resume's pause branch each
   turned exactly their guard tests red; restore verified byte-identical.

## Notes for reviewer

- **The widened interval is slept in FULL between items, not "widened minus
  the gate's floor".** The gate spaces from the last global start, so its
  floor elapses during any sleep — the two do not add, and subtracting would
  quietly under-deliver the schedule. Slower than the floor is always
  contract-compliant. A comment in the pump records this.
- **The pause check sits at the loop top, so a pass whose LAST item rode the
  final wave simply ends** — `unanswered` stays `unanswered` (QA-47's
  single-checklist contract is unchanged and its test still passes untouched).
- **Precedence:** `paused` sits below `at-capacity` (resume cannot store
  anything there) and above `unanswered`/`never-run` — the waves usually
  exhaust at least one id's retries, and the one suggestion that helps (wait
  about an hour) must not be buried under the failure count.
- **Resume semantics fork on the pause flag:** the `{only: failed}` narrowing
  remains the `unanswered` state's behavior; after a pause, resume runs
  'pending' so the never-reached remainder is not stranded.
- The gate's reset seam and `ebirdGateState()` gained the `waveCount` field;
  the one `toEqual` on the reset shape was updated accordingly.
- Nothing on the brief's will-NOT-change list moved: `transport.ts`,
  `gatedEbirdCall`'s retry contract, the gate's cooldown/reset semantics,
  `checklistProjectsCache.ts`, backend routers, the Retry-After parity
  fixtures (byte-untouched), and versions (1.0.8 stays; the CHANGELOG bullet
  was appended to the existing 1.0.8 entry).
- Known limitation (stated in the brief as the in-lane choice): the hour is
  guidance copy, not an enforced lockout — a user can resume immediately, and
  the schedule simply starts a fresh pass window.

## Seeing it locally

This change only shows itself when eBird is actively rate-limiting, so the
honest way to see the STATES without waiting for that is the test suite above.
To see the card itself:

1. Open a terminal in your project folder.

2. Start the backend:
   `cd backend && uvicorn main:app --reload --port 1620`

3. In a second terminal, start the frontend:
   `cd frontend && npm run dev`

4. Open your browser and go to:
   `http://localhost:5173`

5. Go to the **Statistics** tab and scroll to the **Projects** card.

6. Press **Check projects** (or **Check again** if you have run it before).
   While it runs you will see the usual progress bar; if eBird asks the app
   to slow down you will see the amber "waiting" sentence, and the check will
   now also pace itself more gently for the rest of the run each time that
   happens.

7. What is new: if eBird asks three times in one run, the check stops on its
   own with a clock icon and this message shape: "eBird has asked the app to
   slow down several times, so the check paused itself. N of M checklists
   checked, and every answer so far is kept." — with a **Resume** button and
   a note suggesting you try again in about an hour. Resume picks up exactly
   where it left off; quitting the app loses nothing.
