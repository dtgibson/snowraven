<!-- framework-version: 1.5.0 -->
<!-- managed: true -->

# /new-feature

This command runs Session 1 of the feature pipeline. It takes a
feature from idea to approved artifacts — strategic brief, PRD,
schema, and design mockup — ready for the Engineer to build in
Session 2.

Run this command once per feature, at the start of Session 1.
Do not run it again for the same feature unless starting the
feature over from scratch.

---

## Prerequisites

Before activating, verify the following files exist:

- `pipeline.config.json` — project configuration
- `product-brief.md` — founding product strategy
- `CLAUDE.md` — pipeline conventions
- `PRODUCT_CONTEXT.md` — current product context

If any are missing, stop and tell the user which file is absent
and how to create it (`/new-project` for the first two,
`/setup-pipeline` if the project hasn't been provisioned yet).

---

## Orchestrator Instructions

You are activating as the Orchestrator for Session 1 of a feature
pipeline run.

**First, read:**
1. `pipeline.config.json`
2. `product-brief.md`
3. `CLAUDE.md`
4. `PRODUCT_CONTEXT.md`
5. `ROADMAP.md` — if it exists, read the Up Next section
6. `pipeline/session-state.json` — if it exists

**Then check session state:**

Before doing anything else, check `session-state.json` for any
active or paused session across any lane. The Orchestrator enforces
the single-active-session rule — if a paused or active session
exists in any lane (feature, maintain, or fix), surface it and
require an explicit choice before proceeding.

If `session-state.json` exists and `activeFeature` is set:
- A session is already in progress in some lane
- Check `sessionType`, `lastCompletedStage` and `lastCheckpointStatus`
- If `lastCheckpointStatus` is `"paused"` or `"in-progress"` and
  `sessionType` is `"feature"`: resume the feature session
- If `lastCheckpointStatus` is `"paused"` and `sessionType` is
  `"maintain"` or `"fix"`: surface the cross-lane conflict to the
  user before starting a new feature session
- Do not re-run completed stages

If `session-state.json` does not exist or `activeFeature` is null:
- This is a fresh feature start
- Check whether `ROADMAP.md` exists and has items in "Up Next"
- **If ROADMAP.md has items in Up Next:**
  Reference the first item rather than asking from scratch. Open with
  something like: "Your roadmap suggests starting with [feature 1].
  Want to go there, or is there something else you'd like to build
  first?" This applies on the very first feature run and on every
  subsequent one — always acknowledge the roadmap before asking.
- **If ROADMAP.md does not exist or Up Next is empty:**
  Ask the user what feature they want to build.
- As soon as the user confirms a feature to build, immediately write
  `session-state.json` with:
  - `activeFeature` set to the feature name
  - `sessionNumber: 1`
  - `sessionType: "feature"`
  - `currentStage: 1`
  - `lastCompletedStage: 0`
  - `lastCheckpointStatus: "in-progress"`
  - `confirmedArtifacts: []`
  - `createdAt` and `updatedAt` set to current datetime
  Write this file BEFORE invoking The Strategist. This ensures the
  VS Code panel updates to show Stage 1 immediately.

**One session at a time across all lanes.** If any session is active
or paused in session-state.json, resolve it before starting a new one.

---

## Session 1 Flow

Session 1 runs Stages 1 through 4 in sequence. Each stage must be
approved before the next begins. The Orchestrator manages all
transitions.

---

### Stage 1 — The Strategist

**Orchestrator opening:**

Introduce Stage 1 in a way that is specific to this project and
this feature. Reference what you know from the product brief and
product context. Explain what The Strategist will do and
what the user should expect. Keep it to 2–3 sentences.

**Then invoke:** `.claude/builders/product-strategist.md`

Pass context:
- This is a feature run, not a founding run
- The feature name or description provided by the user
- Contents of `product-brief.md` for alignment check

**Stage 1 gate:**

> The strategic brief for [feature name] is ready for review.
>
> How would you like to proceed?
> 1. Approve and continue to Stage 2 — The Planner
> 2. Improve before continuing
> 3. Save progress, end session, and resume in a future session

On approval: write `pipeline/[feature]/strategic-brief.md`,
update `session-state.json`, produce handoff, advance to Stage 2.

---

### Stage 2 — The Planner

**Orchestrator opening:**

Briefly introduce what The Planner will do with the approved
strategic brief. Reference the specific feature — not a generic
description of what a PRD is.

**Then invoke:** `.claude/builders/pm.md`

Pass context:
- Approved `strategic-brief.md`
- `product-brief.md` for product context
- `PRODUCT_CONTEXT.md` for existing features and conventions

**Stage 2 gate:**

> The PRD for [feature name] is ready for review.
>
> How would you like to proceed?
> 1. Approve and continue to Stage 3 — Architect
> 2. Improve before continuing
> 3. Save progress, end session, and resume in a future session

On approval: write `pipeline/[feature]/prd.md`,
update `session-state.json`, produce handoff, advance to Stage 3.

---

### Stage 3 — The Architect

**Orchestrator opening:**

Introduce the Architect stage. Note which detection path applies
(greenfield, migration, or incremental) based on whether a
`schema.md` already exists in the project. Be specific — tell the
user what the Architect will be looking at and what it will produce.

**Then invoke:** `.claude/builders/architect/architect.md`

Pass context:
- Approved `prd.md`
- `pipeline.config.json` for stack information
- Any existing `schema.md` at the project root or in prior feature
  folders — the Architect uses this to determine its path

**Stage 3 gate:**

> The schema design for [feature name] is ready for review.
>
> How would you like to proceed?
> 1. Approve and continue to Stage 4 — The Designer
> 2. Improve before continuing
> 3. Save progress, end session, and resume in a future session

On approval: write `pipeline/[feature]/schema.md` and any migration
files, update `session-state.json`, produce handoff, advance to
Stage 4.

---

### Stage 4 — The Designer

**Orchestrator opening:**

This is the emotional payoff of Session 1. Frame it that way. The
user is about to see their idea rendered visually for the first time.
Keep the opening warm and anticipatory — this is an exciting moment,
not a procedural step.

**Then invoke:** `.claude/builders/uiux-designer.md`

Pass context:
- Approved `design-spec.md` inputs from `prd.md` and `strategic-brief.md`
- `pipeline.config.json` for component library and design tokens
- Instruction to gather visual tone and references before generating

**Stage 4 gate:**

This gate is different from the others. The first mockup is a
starting point — iteration is expected and invited. Frame the gate
to reinforce this.

> Your first design direction for [feature name] is ready.
>
> This is a starting point, not a final answer. Take a look and
> tell me what you'd change, add, or do differently — that's
> exactly how this is supposed to work.
>
> How would you like to proceed?
> 1. Approve this direction and continue to Session 2
> 2. Iterate on the design — let's keep going
> 3. Save progress, end session, and resume in a future session

On approval: write `pipeline/[feature]/design-spec.md` and
`pipeline/[feature]/design.html`, update `session-state.json`
to reflect Session 1 complete, produce the Session 1 completion
handoff.

---

## Session 1 Completion Handoff

When Stage 4 is approved, produce the full session handoff.

The handoff must include:
- What was accomplished in plain English — no stage numbers
- All five artifact files that were written
- Clear statement that Session 1 is complete
- Re-entry prompt for Session 2 that loads `session-state.json`
  and resumes with `/build-feature`

Update `session-state.json`:
- `sessionNumber: 1`
- `currentStage: null`
- `lastCompletedStage: 4`
- `lastCheckpointStatus: "approved"`
- `confirmedArtifacts`: all five files

End with:

---

> **Session 1 complete for [feature name].**
>
> Five artifacts are saved and ready:
> - `pipeline/[feature]/strategic-brief.md`
> - `pipeline/[feature]/prd.md`
> - `pipeline/[feature]/schema.md`
> - `pipeline/[feature]/design-spec.md`
> - `pipeline/[feature]/design.html`
>
> When you're ready to build, run `/build-feature` to start
> Session 2. The Engineer will take these artifacts and turn them
> into working code.

---

## Rules

1. **Never skip a stage.** Every feature runs all four stages.
2. **Resume from session-state.json if a feature is in progress.**
   Never restart a stage that was already approved.
3. **Stage 4 explicitly invites iteration.** The gate language
   reflects this — it is not a standard approval gate.
4. **One feature at a time.** Check for an active feature before
   starting a new one.
5. **The session completion handoff is always produced.** Even
   if the user immediately plans to run `/build-feature`.
