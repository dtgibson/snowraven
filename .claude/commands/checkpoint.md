<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# /checkpoint

This command saves your current progress and produces everything you
need to resume later. It works at any point — mid-stage, between
stages, or at the end of a session.

This is the same action triggered by the "Save & Pause" button in
the VS Code pipeline panel. The command is for users who prefer
typing; the button is for everyone else.

---

## Orchestrator Instructions

When `/checkpoint` is called:

1. **Note the current state** — read `session-state.json` to
   understand exactly where the pipeline is. If no session is
   active, record that no feature is in progress.

2. **Write session-state.json** with the current state:
   - `currentStage` — the stage in progress, or null if between stages
   - `lastCheckpointStatus: "paused"`
   - `updatedAt` — current datetime
   - All other fields unchanged

3. **Write handoff.md** — overwrite completely with the four
   standard sections:

   **What We Accomplished**
   Plain-English summary of what has been done since the last
   checkpoint or session start. No jargon. Readable by anyone.
   If nothing has been accomplished yet (very early in a session),
   say so honestly.

   **What Has Been Saved**
   Explicit list of all artifact files written so far for this
   feature. Full relative paths. If nothing has been written yet,
   say so.

   **Where We Are**
   Current position in the pipeline. If mid-stage, say which stage
   and roughly how far through it. One or two sentences.

   **Resume Prompt**

   To resume this session: copy the prompt below and paste it at
   the start of your next Claude Code conversation. Or hit Resume
   in the VS Code pipeline panel.

   ---

   [Specific re-entry prompt. Must include:
   - Project name from pipeline.config.json
   - Feature name from session-state.json
   - Last completed stage and what was approved
   - Current stage in progress (if any)
   - Which command to run to resume
   - Instruction to load session-state.json before proceeding]

4. **Output the resume prompt in chat** — paste it directly so
   the user sees it immediately without opening any file.

5. **Confirm what was saved** in one sentence.

---

## What a Good Resume Prompt Looks Like

The resume prompt must be specific enough that a fresh Claude Code
session can pick up without any reconstruction effort. It should
never require the user to remember anything.

**Too generic — do not do this:**
> Run /new-feature to continue building.

**Correct — specific and complete:**
> Resume Weft for project my-todo-app, feature
> user-authentication. Session 1. Stage 3 (Architect) is in progress
> — the greenfield schema proposal has been presented but not yet
> approved. Load pipeline/session-state.json and
> pipeline/user-authentication/prd.md before continuing. Run
> /new-feature to resume.

---

## Edge Cases

**No active feature:**
If `session-state.json` doesn't exist or `activeFeature` is null,
there is nothing meaningful to checkpoint. Tell the user clearly:

> There's no active feature to save progress on. When you start
> a feature with `/new-feature`, your progress will be saved
> automatically at each stage.

**Between sessions (Session 1 complete, Session 2 not started):**
Checkpoint is still valid and useful here. Record that Session 1
is complete, all artifacts are saved, and Session 2 has not started.
The resume prompt should tell the user to run `/build-feature`.

**During /new-project or /setup-pipeline:**
These commands have their own progress-saving behavior. If
`/checkpoint` is called during them, produce the standard handoff
but note in the resume prompt which command was in progress and
what step it was on.

---

## Rules

1. **Always write both files together.** `session-state.json` and
   `handoff.md` must never be out of sync.
2. **Always output the resume prompt in chat.** The user should
   not have to open a file to find it.
3. **Never refuse a checkpoint.** Even in edge cases, produce
   something useful. Partial progress is always worth saving.
4. **The resume prompt is specific.** It names the project, the
   feature, the stage, and the command. Never generic.
