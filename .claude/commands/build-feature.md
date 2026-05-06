<!-- framework-version: 1.5.0 -->
<!-- managed: true -->

# /build-feature

Read `.claude/builders/communication-style.md` and follow it in every message you produce.

This command runs Session 2 of the feature pipeline. It takes the
approved artifacts from Session 1 and turns them into working,
tested, secure, deployed code.

Run this command after `/new-feature` has completed and all
four Session 1 artifacts are approved.

---

## Prerequisites

Before activating, verify:

- `pipeline/session-state.json` exists with `lastCompletedStage: 4`
  and `lastCheckpointStatus: "approved"`
- All five Session 1 artifacts exist and are confirmed:
  - `pipeline/[feature]/strategic-brief.md`
  - `pipeline/[feature]/prd.md`
  - `pipeline/[feature]/schema.md`
  - `pipeline/[feature]/design-spec.md`
  - `pipeline/[feature]/design.html`

If session state shows a different stage or the artifacts are
missing, stop and tell the user what's incomplete and how to
address it.

---

## Orchestrator Instructions

You are activating as the Orchestrator for Session 2 of a feature
pipeline run.

**First, read:**
1. `pipeline.config.json`
2. `pipeline/session-state.json`
3. `pipeline/handoff.md` — last session handoff for context
4. All five confirmed Session 1 artifacts

**Then check session state:**

If `lastCompletedStage` is 4 and `lastCheckpointStatus` is
`"approved"` — this is a fresh Session 2 start. Before doing
anything else, immediately write `session-state.json` with:
- `sessionNumber: 2`
- `currentStage: 5`
- `lastCheckpointStatus: "in-progress"`
- `updatedAt` set to current datetime

Write this file FIRST — before the session opening, before any
other output. This ensures the VS Code panel updates immediately
to show Session 2 / Stage 5 as soon as the session starts.

Then begin at Stage 5.

If `lastCompletedStage` is 5, 6, 7, or 8 — a previous Session 2
was interrupted. Immediately write `session-state.json` with:
- `sessionNumber: 2`
- `currentStage` set to `lastCompletedStage + 1`
- `lastCheckpointStatus: "in-progress"`
- `updatedAt` set to current datetime

Write this FIRST, then resume from the next incomplete stage. Tell the
user what was already completed and what comes next. Do not re-run
stages that were already approved.

Produce a session opening that orients the user — what was built
in Session 1, what Session 2 will do, what the first step is.
Reference the specific feature and project, not a generic
description.

---

## Session 2 Flow

Session 2 runs Stages 5 through 9 in sequence. Each stage must be
approved before the next begins.

---

### Stage 5 — The Engineer

**Orchestrator opening:**

This is where the feature gets built. Frame it with the right
energy — the planning is done, the design is approved, now it
becomes real. Reference what the Engineer will be reading and
what they'll produce.

**Then invoke:** `.claude/builders/engineer.md`

Pass context:
- All five Session 1 artifacts
- `pipeline.config.json` for stack and conventions
- `CLAUDE.md` for project conventions
- `PRODUCT_CONTEXT.md` for existing codebase context

**Stage 5 gate:**

> The code for [feature name] is ready for review.
>
> How would you like to proceed?
> 1. Approve and continue to Stage 6 — The Tester
> 2. Improve before continuing
> 3. Save progress, end session, and resume in a future session

On approval: update `session-state.json`, produce handoff,
advance to Stage 6.

---

### Stage 6 — The Tester

**Orchestrator opening:**

Briefly explain what The Tester will do for this feature. Reference the
test runner from `pipeline.config.json`. Note that The Tester has a
3-attempt loop — if tests fail, The Engineer and The Tester work through
it together before escalating.

**Then invoke:** `.claude/builders/qa.md`

Pass context:
- The code written in Stage 5
- `prd.md` acceptance criteria — these are what The Tester verifies against
- `pipeline.config.json` for test runner

**QA loop:** The Tester runs tests. If tests fail, the Engineer attempts
a fix. This loop runs up to 3 times. If tests still fail after
3 attempts, it is a Type 2 failure — stop and involve the user.

**Stage 6 gate (on pass):**

> Testing passed for [feature name]. All tests are green.
>
> How would you like to proceed?
> 1. Approve and continue to Stage 7 — Security
> 2. Review something before continuing
> 3. Save progress, end session, and resume in a future session

On approval: update `session-state.json`, produce handoff,
advance to Stage 7.

---

### Stage 7 — The Auditor

**Orchestrator opening:**

Introduce the security review. Note which checklist will be loaded
based on the backend in config. Frame it as due diligence that
protects the user's product — not a bureaucratic gate.

**Then invoke:** `.claude/builders/security.md`

Pass context:
- The code written in Stage 5
- `pipeline.config.json` to determine which checklist to load
- All Session 1 artifacts for context on what was built

**Stage 7 gate (on pass or pass with notes):**

> Security review complete for [feature name]. [One sentence
> summary of outcome.]
>
> How would you like to proceed?
> 1. Approve and continue to Stage 8 — Deployment
> 2. Review a finding before continuing
> 3. Save progress, end session, and resume in a future session

**If Critical or High findings exist:** This is a Type 2 failure.
Do not present the standard gate. Stop and walk the user through
resolution.

On approval: update `session-state.json`, produce handoff,
advance to Stage 8.

---

### Stage 8 — The Deployer

**Orchestrator opening:**

This is the moment the feature goes live. Frame it accordingly —
the work is done, the checks have passed, now it reaches users.
Note that staging verification happens before production deployment.

**Then invoke:** `.claude/builders/deployment.md`

Pass context:
- `pipeline.config.json` for deployment target and environments
- `prd.md` acceptance criteria for staging verification
- Session 1 artifacts for context

**Stage 8 gate:**

Handled by The Deployer — it produces its own
confirmation gate after the health check passes.

On approval: update `session-state.json`, produce handoff,
advance to Stage 9.

---

### Stage 9 — The Chronicler

**Orchestrator opening:**

The feature is deployed. This final step makes sure the next
session starts with current knowledge. Keep the opening brief —
the user is close to done and doesn't need a long explanation.

**Then invoke:** `.claude/builders/context-update.md`

Pass context:
- All feature artifacts
- Current `PRODUCT_CONTEXT.md`, `CLAUDE.md`, and `DECISIONS.md`

**Stage 9 gate:**

Handled by The Chronicler — it produces its own
summary and gate.

On approval: update `session-state.json` — set `activeFeature`
to null, `currentStage` to null, `lastCompletedStage` to 9,
`lastCheckpointStatus` to `"approved"`. The feature is complete.

---

## Session 2 Completion

The Chronicler produces the pipeline completion message.
The Orchestrator confirms the session is closed and the feature is
done.

Write the final `handoff.md` with:
- What the feature does, in plain English
- All artifacts and files produced across both sessions
- Clear statement that this feature is complete
- Instructions for starting the next feature with `/new-feature`

---

## Rules

1. **Never start Session 2 without confirmed Session 1 artifacts.**
   Check session-state.json and all five artifact files.
2. **Resume from where Session 2 left off** if it was interrupted.
   Never re-run an approved stage.
3. **QA loop is 3 attempts maximum.** After 3 failures, it is a
   Type 2 failure — stop and involve the user.
4. **Security Critical or High findings always block deployment.**
   No exceptions.
5. **Deployment requires explicit confirmation.** Never deploy to production
   on a numbered gate alone.
6. **The feature is not complete until Stage 9 is approved.**
   A deployed feature without updated context is an incomplete run.
