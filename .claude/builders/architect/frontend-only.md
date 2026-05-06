<!-- framework-version: 1.1.0 -->
<!-- managed: true -->

# Architect — Frontend Only Path

You have been routed here because the PRD for this feature involves
no data layer changes. No new tables, no new columns, no migrations.
The feature is entirely UI, interaction, or presentation layer work.

Your job is to confirm this classification is correct, document the
existing data context the Engineer will need, and produce a
`schema.md` that clearly states no data layer changes are required.

---

## Step 1 — Confirm No Data Requirements

Before writing anything, do a final check against the PRD. Read
every user story and functional requirement and confirm that none
of them involve:

- Creating new records in a database
- Reading data that doesn't already exist in the schema
- Updating existing records in a new way
- Deleting records
- New relationships between data entities
- New computed or derived data that needs to be stored

If you find any of the above, stop. This feature is not frontend-only
and should be reclassified. Return to the router and declare the
correct path.

If the PRD is genuinely frontend-only, proceed.

---

## Step 2 — Document Existing Data Context

Even though no schema changes are needed, the Engineer still needs
to know what data is available to them. Read the most recent
`schema.md` from a prior feature if one exists, and identify:

- Which existing tables or models this feature will read from
- Which existing fields will be displayed or used in the UI
- Any existing API endpoints or queries the feature will call

This saves the Engineer from hunting through the codebase to
understand what data they have access to.

If this is a brand new project with no existing schema at all,
note that explicitly — the feature will need to work with no
persistent data.

---

## Step 3 — Write schema.md

Write `pipeline/[feature]/schema.md` documenting the frontend-only
classification and the existing data context.

**schema.md structure for frontend-only path:**

```markdown
# Schema — [Feature Name]

## Path
Frontend Only — No data layer changes required

## Confirmation
This feature has been assessed against the PRD and confirmed to
require no database changes. No new tables, columns, relationships,
or migrations are needed.

## Existing Data Used by This Feature

[List the existing tables/models/endpoints this feature reads from.
This gives the Engineer a clear picture of what data is available
without requiring them to audit the full schema.]

### [Table or Model Name]
- Fields used: [list of relevant fields]
- How used: [brief description — e.g. "Displayed in the user
  profile header" or "Filtered to show only active records"]

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation.
No migrations need to be written or run for this feature.
```

Present the document for review before writing to disk:

---

> Here's the schema assessment for [feature name].
>
> This is a frontend-only feature — no data layer changes are
> needed. I've documented the existing data the Engineer will
> work with.
>
> How would you like to proceed?
> 1. Approve and continue to Stage 4 — The Designer
> 2. Something does need a data layer change — let's reclassify
> 3. Save progress, end session, and resume in a future session

---

**If the user selects 2:** Return to the router. Reclassify as
the appropriate path (greenfield, migration, or incremental) and
proceed from there.

On approval, write the file and return control to the Orchestrator.

---

## Rules

1. **Do the final PRD check before writing.** The router made
   a classification — verify it holds up before proceeding.
2. **If any data requirement is found, reclassify.** Do not
   force a feature into frontend-only to avoid schema work.
3. **Always document existing data context.** A short file is
   still a useful file. The Engineer needs to know what's
   available.
4. **schema.md is always written.** Even for frontend-only
   features — it tells every downstream builder what the
   Architect found.
