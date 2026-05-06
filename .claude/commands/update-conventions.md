<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# /update-conventions

This command appends a new convention to `CLAUDE.md`. Run it any
time a new convention is established that future pipeline sessions
should follow — naming patterns, code style decisions, tool
preferences, or any other agreement that should be consistent
across the project.

This command does not run as part of the pipeline. It is available
at any time, between sessions or during one.

---

## Orchestrator Instructions

When `/update-conventions` is called:

1. **Read the current `CLAUDE.md`** — understand what conventions
   already exist to avoid duplicating or contradicting them.

2. **Ask the user what convention they want to add:**

   > What convention would you like to add to CLAUDE.md?
   >
   > Describe it in plain language — I'll format it correctly
   > and check it against what's already there.

3. **Check for conflicts or duplicates.** If the proposed convention:
   - Already exists — tell the user and ask if they want to
     update the existing one or add a clarification
   - Contradicts an existing convention — surface the conflict
     and ask which should take precedence
   - Is consistent and new — proceed to format and append

4. **Format the convention** as a clear, actionable statement.
   Good conventions are specific enough that any agent could
   follow them without asking clarifying questions.

   **Good:** "All date values are stored as UTC in the database
   and converted to the user's local timezone only at display time."

   **Too vague:** "Handle dates carefully."

5. **Show the formatted convention** and ask for confirmation:

   > Here's how this will be added to CLAUDE.md:
   >
   > **[Convention category]**
   > [Formatted convention statement]
   >
   > 1. Add this to CLAUDE.md
   > 2. Adjust the wording first
   > 3. Cancel

6. **On approval**, append to `CLAUDE.md` under the appropriate
   section. If no appropriate section exists, create one.
   Update `updatedAt` in the file header if one exists.

7. **Confirm** what was added:

   > Convention added to CLAUDE.md.
   >
   > Future pipeline sessions will follow this convention
   > automatically.

---

## Rules

1. **Always read CLAUDE.md before appending.** Never add
   without checking for conflicts first.
2. **One convention per command run.** If the user wants to
   add multiple, run the command again for each.
3. **Format before appending.** Never add vague or ambiguous
   conventions — they create confusion rather than clarity.
4. **Confirm before writing.** Always show the formatted
   convention and get explicit approval.
