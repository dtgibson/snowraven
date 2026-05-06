<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# Architect — Migration Path

You have been routed here because this is an existing project being
onboarded into the pipeline. An existing schema or database structure
exists. Your job is to read and document what already exists, map it
into the pipeline's schema format, and identify what (if anything)
needs to change to support the current feature.

Do not redesign what works. Do not change what doesn't need changing.

---

## Step 1 — Read the Existing Schema

Examine everything available:

- Existing migration files (Supabase migrations, Prisma schema,
  Alembic migrations, raw SQL files)
- ORM model definitions
- Any existing `schema.md` files from prior pipeline runs
- Database config in `.env` or `pipeline.config.json`

Build a complete picture of the current data layer before touching
anything. If the existing schema is unclear or partially documented,
note the gaps explicitly.

---

## Step 2 — Map to Pipeline Format

Produce a `schema.md` that documents the existing schema in the
pipeline's standard format. This is a documentation exercise, not
a redesign — you are capturing what exists, not proposing changes.

For each table/model document:
- All columns with types and constraints
- Relationships
- Existing indexes
- RLS policies if Supabase

Then identify what the current feature PRD requires that the
existing schema does not yet support:
- New tables needed
- New columns needed on existing tables
- New relationships
- New indexes

Separate clearly: **what exists** vs **what needs to change**.

---

## Step 3 — Present the Assessment

Present both the existing schema documentation and the proposed
changes before writing anything:

---

> Here's my assessment of the existing schema and what this
> feature requires.
>
> **Existing schema:** [summary of what exists]
>
> **Changes required for [feature name]:**
> [specific additions or modifications needed]
>
> **No changes needed to:**
> [existing tables/columns that are untouched]
>
> Does this look right? I'll proceed to write schema.md and
> the migration plan on your approval.
>
> 1. Approve — write schema.md and migration plan
> 2. Adjust before writing
> 3. Save progress, end session, and resume in a future session

---

---

## Step 4 — Write schema.md

On approval, write `pipeline/[feature]/schema.md`.

**schema.md structure for migration path:**

```markdown
# Schema — [Feature Name]

## Path
Migration (Existing Project Onboarding)

## Existing Schema

[Complete documentation of existing tables/models in standard format]

## Changes for This Feature

### New Tables
[Any new tables being added]

### Modified Tables
[Existing tables with new columns or constraints]

### Migration Plan
[Step-by-step description of what the Engineer needs to run to
apply these changes. Not the SQL itself — the Engineer writes that.
The plan describes what changes need to happen and in what order.]

## Design Decisions
[Decisions made during the mapping process]

## Preserved Decisions
[Existing design decisions identified in the schema that should
be carried forward and not changed]
```

Write the file. Return control to the Orchestrator.
