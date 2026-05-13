<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# /maintain

Read `.claude/builders/communication-style.md` before producing
any output.

This command runs when existing code needs to be improved
without introducing new user-facing behavior. It covers
refactors, architectural improvements, dependency updates,
code quality, versioning, and convention compliance.

It is not for new features. If the work introduces something
a user can see, hear, or interact with that they couldn't
before — that is /new-feature territory.

A Maintain session runs in a single session across six stages:
The Evaluator, The Engineer, The Tester, The Auditor,
The Deployer, and The Chronicler.

---

## On Session Start

Read these files before doing anything else:

1. `pipeline.config.json` — stack, deployment target
2. `pipeline/session-state.json` — active task, current stage
3. `PRODUCT_CONTEXT.md` — what the product is and how it works
4. `CLAUDE.md` — conventions and tool rules
5. `DECISIONS.md` — prior product and pipeline decisions

**Then check session state:**

Before doing anything else, check `session-state.json` for any
active or paused session across any lane. The Orchestrator enforces
the single-active-session rule — if a paused or active session
exists in any lane (feature, maintain, or fix), surface it and
require an explicit choice before proceeding.

If `activeFeature` is null and `lastCheckpointStatus` is not
`"paused"` — this is a fresh Maintain session. Ask the user
what needs improving.

If `lastCheckpointStatus` is `"paused"` and `sessionType` is
`"maintain"` — a previous Maintain session was interrupted.
Immediately write `session-state.json` with `currentStage` set
to the last incomplete stage and `lastCheckpointStatus: "in-progress"`.
Tell the user what was already done and what comes next.

If `lastCheckpointStatus` is `"paused"` and `sessionType` is
`"feature"` or `"fix"` — a different lane is paused. Surface
the cross-lane conflict before starting a new Maintain session.

**Immediately after the user describes the improvement:**

Write `session-state.json` with:
- `activeFeature` set to a short kebab-case name for the task
  (e.g. `update-shadcn-dependencies`)
- `sessionNumber: 1`
- `sessionType: "maintain"`
- `currentStage: 1`
- `lastCheckpointStatus: "in-progress"`
- `createdAt` and `updatedAt` set to current datetime

Write this BEFORE invoking The Evaluator. This ensures the
VS Code panel updates immediately.

---

## Maintain Session Flow

Six stages in sequence. Each stage must be approved before
the next begins.

---

### Stage 1 — The Evaluator

Read `.claude/builders/evaluator.md` and run the maintain
evaluation flow.

The Evaluator's job in a Maintain session: confirm this work
belongs on the maintain track, scope it, surface any decisions
being touched, and produce `change-brief.md`.

**Feature check — runs before any gate:**

After scoping the work, The Evaluator applies the branch rules.
If the work introduces new user-facing behavior, new surfaces,
new design decisions, or anything a user can see or interact
with that they couldn't before — stop immediately and present
this finding as a standalone message before anything else:

> This looks like a feature, not a maintenance task.
>
> [One sentence explaining what crossed the line.]
>
> How would you like to proceed?
> 1. Switch to New Feature instead
> 2. Re-scope the work to stay on the Improve track

If the user selects 1, clear the session state and tell them
to run /new-feature with a brief summary of what was scoped.
If the user selects 2, return to scoping with the constraint
made explicit.

Do not present the standard approval gate until the feature
check has passed.

**Standard gate — only presented after feature check passes:**

> [One sentence summary of what was scoped and confirmed as
> maintain-territory.]
>
> How would you like to proceed?
> 1. Approve and continue to The Engineer
> 2. Make changes before continuing
> 3. Save progress, end session, and resume in a future session

On approval (option 1), write `session-state.json` with
`currentStage: 2` and `lastCompletedStage: 1` atomically,
then invoke The Engineer.

---

### Stage 2 — The Engineer

Read `.claude/builders/engineer.md` and implement the
improvement.

The Engineer reads `change-brief.md` and makes the changes.
One step at a time — confirm the improvement is working before
presenting the gate.

On approval, write `session-state.json` with
`currentStage: 3` and `lastCompletedStage: 2` atomically,
then invoke The Tester.

---

### Stage 3 — The Tester

Read `.claude/builders/qa.md` and verify the improvement.

The Tester confirms the improvement works as described in
`change-brief.md` and checks for regressions. Runs existing
tests. If anything fails, routes back to The Engineer.

On approval, write `session-state.json` with
`currentStage: 4` and `lastCompletedStage: 3` atomically,
then invoke The Auditor.

---

### Stage 4 — The Auditor

Read `.claude/builders/security.md` and review the improvement.

The Auditor checks whether the improvement introduces any new
security surface or changes any trust boundary. For
dependency updates, checks for known vulnerabilities in the
new versions. The stage is never skipped.

On approval, write `session-state.json` with
`currentStage: 5` and `lastCompletedStage: 4` atomically,
then invoke The Deployer.

---

### Stage 5 — The Deployer

Read `.claude/builders/deployment.md` and ship the improvement.

On approval, write `session-state.json` with
`currentStage: 6` and `lastCompletedStage: 5` atomically,
then invoke The Chronicler.

---

### Stage 6 — The Chronicler

Read `.claude/builders/context-update.md` and record the
improvement.

The Chronicler notes what changed, why, and whether any prior
decision was touched or reversed. Updates DECISIONS.md if
the improvement walks back a recorded decision. This step is
load-bearing — improvements that touch prior decisions must
be chronicled or the project record silently rots.

On completion, write `session-state.json` with:
- `activeFeature: null`
- `currentStage: null`
- `lastCompletedStage: 6`
- `lastCheckpointStatus: "complete"`
- `sessionType: null`

---

## Orchestrator Rules

1. **One thing at a time.** Present one step, wait for
   confirmation, continue.
2. **Never skip a stage.** The Auditor runs even for
   text-only changes.
3. **Write session state atomically.** Every stage transition
   writes `currentStage`, `lastCompletedStage`, and
   `lastCheckpointStatus` in a single operation.
4. **The Evaluator is the scope gate.** If the work grows
   during The Engineer stage and starts looking like a feature,
   stop and surface it. Do not silently expand scope.
5. **The feature is not complete until Stage 6 is done.**
   An improvement that isn't chronicled is an improvement
   that will be misunderstood by the next session.
