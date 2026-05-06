<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# /abandon-feature

This command cleanly ends a feature that is no longer worth building.
It logs the decision, updates the project context, clears the active
feature state, and — if code was written — walks the user through
reversing those changes step by step.

This command is also triggered by the "Abandon Feature" button in
the VS Code pipeline panel.

---

## Orchestrator Instructions

When `/abandon-feature` is called:

**First, read `pipeline/session-state.json`** to determine:
- Which feature is active (`activeFeature`)
- Which stage was last completed (`lastCompletedStage`)
- Which artifacts were confirmed (`confirmedArtifacts`)

Then determine which path applies:

**Path A — No code was written** (lastCompletedStage is 1–4)
Strategy and design work only. No code changes to reverse.
Go to the No-Code Path below.

**Path B — Code was written** (lastCompletedStage is 5 or higher)
The Engineer has written code. It may be uncommitted, committed
locally, or pushed to a remote branch. Each case is handled
differently. Go to the Code Path below.

---

## Step 1 — Capture the Reason

Before doing anything else, ask the user why they're abandoning
this feature. Keep it simple — one question, no pressure:

---

> You're about to abandon [feature name]. That's completely fine —
> changing direction is part of building good products.
>
> Before we close this out, what made you decide not to build it?
> (Your answer will be logged so this idea isn't revisited without
> the full context of why it was set aside.)

---

Wait for the response. Record it. This becomes the abandonment
rationale logged to `DECISIONS.md`.

---

## No-Code Path (Stages 1–4 only)

No code was written. The abandonment is clean — just artifacts
and state files to update.

**What to do:**

1. Write the abandonment record to `DECISIONS.md`:

```markdown
## Abandoned — [Feature Name] — [Date]

**Stage reached:** [last completed stage name]
**Reason:** [user's response from Step 1]
**Artifacts produced:** [list from confirmedArtifacts]
**Decision:** Feature abandoned. Artifacts retained in
pipeline/[feature]/ for reference but will not be built.
```

2. Update `PRODUCT_CONTEXT.md` — add a note under a
   "Considered and Rejected" section:

```markdown
## Considered and Rejected

### [Feature Name]
Reached Stage [N]. Abandoned because: [reason]. Artifacts
available in pipeline/[feature]/ if context is needed later.
```

3. Update `session-state.json`:
   - Set `activeFeature` to null
   - Set `currentStage` to null
   - Set `lastCompletedStage` to null
   - Set `lastCheckpointStatus` to `"abandoned"`
   - Update `updatedAt`

4. Confirm to the user:

---

> **[Feature name] has been abandoned.**
>
> The decision and reasoning have been logged to DECISIONS.md
> so this context isn't lost.
>
> Your Weft artifacts are kept in pipeline/[feature]/ in
> case you want to reference them later — they won't affect
> your project.
>
> When you're ready to start a new feature, type `/new-feature`
> or click Start New Feature in the VS Code panel.

---

---

## Code Path (Stage 5 or higher)

Code has been written. The cleanup depends on where that code
currently lives. Walk the user through each step explicitly —
do not assume they know how to use git.

### Step 2a — Assess the Code State

Ask the user one question to determine the git state:

---

> Before we reverse the code changes, I need to know where
> things stand. Which of these describes your situation?
>
> 1. I haven't committed anything yet — the changes are
>    only on my machine
> 2. I've committed locally but haven't pushed to GitHub/GitLab
> 3. I've pushed to a branch on GitHub/GitLab
> 4. A PR has been opened
> 5. I'm not sure

---

**If the user selects 5 (not sure):** Walk them through checking:

> Open your terminal in VS Code (Terminal → New Terminal) and
> run this command:
>
> `git status`
>
> Tell me what you see and I'll figure out the right next step.

---

### Step 2b — Reversal Instructions

Provide the exact terminal commands for their situation.
Be explicit — copy-pasteable commands, not descriptions.

**Situation 1 — Uncommitted changes only:**

> Your changes haven't been committed yet, so this is the
> simplest case. Run these commands one at a time:
>
> **1. See what files were changed:**
> ```
> git status
> ```
>
> **2. Discard all uncommitted changes:**
> ```
> git restore .
> ```
>
> **3. Remove any new files that were added:**
> ```
> git clean -fd
> ```
>
> **4. Confirm everything is clean:**
> ```
> git status
> ```
> You should see "nothing to commit, working tree clean".

---

**Situation 2 — Committed locally, not pushed:**

> Your changes are committed locally but haven't been pushed.
> Run these commands one at a time:
>
> **1. See your recent commits:**
> ```
> git log --oneline -5
> ```
> Find the commit(s) made for [feature name].
>
> **2. Undo the commits but keep the files (safer option):**
> ```
> git reset --soft HEAD~[number of commits to undo]
> ```
> Replace [number] with how many commits to undo.
> Example: `git reset --soft HEAD~1` undoes the last commit.
>
> **3. Then discard the changes:**
> ```
> git restore .
> git clean -fd
> ```
>
> **4. Confirm everything is clean:**
> ```
> git status
> ```

---

**Situation 3 — Pushed to a branch:**

> Your changes have been pushed to a remote branch. Here's
> how to clean it up:
>
> **1. Make sure you're on the feature branch:**
> ```
> git branch
> ```
> The branch with a * next to it is your current branch.
>
> **2. Switch back to your main branch:**
> ```
> git checkout main
> ```
> (Or `git checkout master` if your main branch is called master)
>
> **3. Delete the feature branch locally:**
> ```
> git branch -D [branch-name]
> ```
>
> **4. Delete the feature branch on GitHub/GitLab:**
> ```
> git push origin --delete [branch-name]
> ```
>
> **5. Confirm you're on main with no leftover changes:**
> ```
> git status
> ```

---

**Situation 4 — A PR has been opened:**

> There's an open PR for this feature. Do this first:
>
> **1. Go to GitHub/GitLab and close the PR manually.**
>    Add a note explaining it was abandoned.
>    Do not merge it.
>
> Once the PR is closed, follow the steps for Situation 3
> above to clean up the branch locally and remotely.

---

### Step 2c — Confirm Cleanup

After providing the instructions, ask the user to confirm
before logging the abandonment:

---

> Once you've run those commands and `git status` shows
> "nothing to commit, working tree clean", let me know
> and I'll finish closing out this feature.
>
> 1. Done — the code is cleaned up
> 2. I ran into a problem — help me figure it out

---

If the user hits a problem, walk through it with them one
step at a time. Do not proceed to logging until the code
state is clean or the user explicitly asks to log anyway.

---

### Step 3 — Log and Clean Up

Once code is confirmed clean, follow the same steps as
the No-Code Path (Step 1 above) to write to `DECISIONS.md`,
update `PRODUCT_CONTEXT.md`, and clear `session-state.json`.

Then confirm:

---

> **[Feature name] has been abandoned and the code has
> been reversed.**
>
> Logged to DECISIONS.md:
> - Why it was abandoned
> - What stage it reached
> - What artifacts were produced
>
> Your codebase is back to its pre-feature state.
>
> When you're ready to start a new feature, type
> `/new-feature` or click Start New Feature in the
> VS Code panel.

---

## Rules

1. **Always capture the reason first.** The log is only
   useful if it records why — not just that it happened.
2. **Never reverse code without explicit user confirmation.**
   Provide instructions, wait for confirmation, then log.
3. **No-code and code paths are completely separate.**
   Never show git instructions if no code was written.
4. **Walk through git problems one step at a time.**
   A user who gets stuck on a git command needs help,
   not a wall of instructions to re-read.
5. **Artifacts are kept, not deleted.** The pipeline/[feature]/
   folder stays — it may be useful context later. Only
   code changes are reversed.
6. **`session-state.json` is always cleared.** The active
   feature must be null before `/new-feature` can run.
