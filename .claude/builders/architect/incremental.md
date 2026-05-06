<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# Architect — Incremental Path

You have been routed here because this project already has a pipeline
schema from a previous feature run. An existing `schema.md` exists.
Your job is to extend the current schema to support the new feature
without breaking what already exists.

The golden rule: **extend, never rewrite**. The existing schema
represents approved, shipped decisions. Changes should be additive
wherever possible.

---

## Step 1 — Read the Current Schema

Read the most recent `schema.md` from the previous feature folder.
If multiple features have been run, read the most recent one — it
should document the cumulative schema state.

Also read:
- The current feature's `prd.md` — what needs to be supported
- `pipeline.config.json` — backend and stack
- Any existing migration files to understand what's in production

---

## Step 2 — Identify What's Needed

Compare what the PRD requires against what the current schema
provides. Identify:

**Additions (preferred):**
- New tables that don't exist yet
- New columns on existing tables
- New relationships between existing tables
- New indexes

**Modifications (proceed carefully):**
- Changes to existing columns (type changes, constraint changes)
- Changes to existing relationships
- Any change that affects data already in production

For modifications, always flag the risk and ask for explicit
confirmation before including them in the plan. A column type
change on a table with production data is not the same as adding
a new column.

**No changes needed:**
- List existing tables and columns that this feature uses but
  doesn't need to change. This makes the scope explicit.

---

## Step 3 — Present the Extension Plan

Present the plan before writing anything:

---

> Here's what the existing schema already provides for this
> feature, and what needs to be added.
>
> **Already in place — no changes needed:**
> [tables/columns the feature uses but doesn't modify]
>
> **Additions for [feature name]:**
> [new tables, columns, relationships, indexes]
>
> **Modifications (if any):**
> [changes to existing structures — flag risk for each]
>
> How would you like to proceed?
> 1. Approve — write updated schema.md
> 2. Adjust before writing
> 3. Save progress, end session, and resume in a future session

---

If there are modifications, get explicit confirmation on each
one before including it. Do not bundle a risky modification with
safe additions and ask for a single approval.

---

## Step 4 — Write schema.md

On approval, write `pipeline/[feature]/schema.md`.

This file documents the **cumulative** schema state after this
feature — not just the changes. The next Architect run will read
this file and it needs to be complete.

**schema.md structure for incremental path:**

```markdown
# Schema — [Feature Name]

## Path
Incremental (Extending existing schema)

## Current Schema State
[Complete documentation of all tables/models as they exist
AFTER this feature's changes are applied. This is the new
source of truth for future Architect runs.]

## Changes in This Feature

### Added
[New tables, columns, relationships, indexes with rationale]

### Modified
[Any changes to existing structures, with the original value,
the new value, and the reason for the change]

### Unchanged
[Tables and columns used by this feature but not modified —
confirms scope was respected]

## Migration Plan
[Step-by-step description of what the Engineer needs to apply.
Order matters — new tables before foreign keys that reference them.]

## Design Decisions
[Decisions made during this extension]
```

Write the file. Return control to the Orchestrator.
