<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# /fix

Read `.claude/builders/communication-style.md` before producing
any output.

This command runs when something that used to work is broken.
It is not for new features. It is not for improvements. It is
for confirmed or suspected regressions, bugs, and broken behavior.

A Fix session runs in a single session across six stages:
The Evaluator, The Engineer, The Tester, The Auditor,
The Deployer, and The Chronicler.

---

## On Session Start

Read these files before doing anything else:

1. `pipeline.config.json` — stack, deployment target
2. `pipeline/session-state.json` — active fix, current stage
3. `PRODUCT_CONTEXT.md` — what the product is and how it works
4. `CLAUDE.md` — conventions and tool rules

**Then check session state:**

Before doing anything else, check `session-state.json` for any
active or paused session across any lane. The Orchestrator enforces
the single-active-session rule — if a paused or active session
exists in any lane (feature, maintain, or fix), surface it and
require an explicit choice before proceeding.

If `activeFeature` is null and `lastCheckpointStatus` is not
`"paused"` — this is a fresh Fix session. Ask the user what
is broken.

If `lastCheckpointStatus` is `"paused"` and `sessionType` is
`"fix"` — a previous Fix session was interrupted. Immediately
write `session-state.json` with `currentStage` set to the last
incomplete stage and `lastCheckpointStatus: "in-progress"`.
Tell the user what was already done and what comes next.

If `lastCheckpointStatus` is `"paused"` and `sessionType` is
`"feature"` or `"maintain"` — a different lane is paused. Surface
the cross-lane conflict before starting a new Fix session.

**Immediately after the user describes what is broken:**

Write `session-state.json` with:
- `activeFeature` set to a short kebab-case name for the fix
  (e.g. `abandon-button-not-copying`)
- `sessionNumber: 1`
- `sessionType: "fix"`
- `currentStage: 1`
- `lastCheckpointStatus: "in-progress"`
- `createdAt` and `updatedAt` set to current datetime

Write this BEFORE invoking The Evaluator. This ensures the
VS Code panel updates immediately.

---

## Fix Session Flow

Six stages in sequence. Each stage must be approved before
the next begins.

---

### Stage 1 — The Evaluator

Read `.claude/builders/evaluator.md` and run the fix
evaluation flow.

The Evaluator's job in a Fix session: confirm the bug is
real, reproducible, and scoped. Produce `bug-brief.md`.

On approval, write `session-state.json` with
`currentStage: 2` and `lastCompletedStage: 1` atomically,
then invoke The Engineer.

---

### Stage 2 — The Engineer

Read `.claude/builders/engineer.md` and implement the fix.

The Engineer reads `bug-brief.md` and fixes the confirmed
issue. One step at a time — confirm the fix is working before
presenting the gate.

On approval, write `session-state.json` with
`currentStage: 3` and `lastCompletedStage: 2` atomically,
then invoke The Tester.

---

### Stage 3 — The Tester

Read `.claude/builders/qa.md` and verify the fix.

The Tester confirms the bug is gone and checks for
regressions. Runs existing tests. If anything fails, routes
back to The Engineer.

On approval, write `session-state.json` with
`currentStage: 4` and `lastCompletedStage: 3` atomically,
then invoke The Auditor.

---

### Stage 4 — The Auditor

Read `.claude/builders/security.md` and review the fix.

For bug fixes, The Auditor checks whether the fix introduces
any new security surface or changes any trust boundary.
Most fixes will pass quickly. The stage is never skipped.

On approval, write `session-state.json` with
`currentStage: 5` and `lastCompletedStage: 4` atomically,
then invoke The Deployer.

---

### Stage 5 — The Deployer

Read `.claude/builders/deployment.md` and ship the fix.

On approval, write `session-state.json` with
`currentStage: 6` and `lastCompletedStage: 5` atomically,
then invoke The Chronicler.

---

### Stage 6 — The Chronicler

Read `.claude/builders/context-update.md` and record the fix.

The Chronicler notes what was broken, what was changed, and
whether any prior decision was touched. Updates DECISIONS.md
if the fix reverses or modifies a recorded decision.

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
   text-only fixes.
3. **Write session state atomically.** Every stage transition
   writes `currentStage`, `lastCompletedStage`, and
   `lastCheckpointStatus` in a single operation.
4. **Fix sessions are urgent.** Keep prose tight. No lengthy
   preambles. Get to the problem.
5. **The feature is not complete until Stage 6 is done.**
   A fix that isn't chronicled is a fix that will be
   forgotten.
