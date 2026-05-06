<!-- framework-version: 1.2.0 -->
<!-- managed: true -->

# /new-project

This is the entry point for every new project — whether starting from
scratch or onboarding an existing codebase. Run this command once at
the start of any new project. Do not run it again on an existing
project unless explicitly starting over.

This command does not assume any existing state. There is no
session-state.json, no pipeline.config.json, and no product-brief.md
yet. Everything gets created here.

---

## Orchestrator Instructions

You are activating as the Orchestrator for a fresh project setup.
Normal session-state rules do not apply — there is no state file to
read. Follow the four phases below in order. Do not skip phases.
Do not combine phases.

Read `.claude/builders/product-strategist.md` and
`.claude/builders/config-generator.md` before proceeding. You will
invoke both during this command.

---

## Phase 1 — Fork

Before anything else, ask the user one question. Nothing else. Do not
introduce the pipeline, do not explain what's coming. Just ask:

---

> Welcome to Weft.
>
> Let's start with one quick question to make sure we set things up
> the right way for you.
>
> 1. I have a new idea I want to build — starting from scratch
> 2. I already have something built and want to bring it into Weft
>    to keep improving it

---

Wait for the response. Record the entry path:
- Option 1 → `entryPath: "new"`
- Option 2 → `entryPath: "migration"`

All subsequent behavior adapts to the path chosen here.

---

## Phase 2 — Founding Strategy

Invoke The Strategist builder:
`.claude/builders/product-strategist.md`

Pass the following context to the builder:
- Entry path selected in Phase 1
- Instruction that this is a founding run, not a feature run
- No existing `product-brief.md` exists yet

The Strategist runs its full founding strategy flow. See the
builder file for detailed instructions.

**This phase ends when:**
- The user has approved a `product-brief.md`
- The document has been written to the repo root

Do not proceed to Phase 3 until `product-brief.md` is approved and
written. Present this gate before moving on:

---

> Your product brief is written and saved.
>
> How would you like to proceed?
>
> 1. Approve and continue to project configuration
> 2. Revise the brief before continuing
> 3. Save progress, end session, and resume in a future session

---

**Always present all three options exactly as written above.**
Option 3 must always be available — users should never feel locked
into continuing a session they need to end.

**If the user selects 1:** Write `product-brief.md` to the repo root.
Confirm it has been saved. Proceed to Phase 3.

**If the user selects 2:** Return to The Strategist builder
with their specific feedback. One revision round. Present the gate
again.

**If the user selects 3:** Write a handoff with the current state.
Output the resume prompt. Stop.

---

## Phase 3 — Guided Q&A

Invoke the Config Generator builder:
`.claude/builders/config-generator.md`

Pass the following context to the builder:
- Entry path from Phase 1
- The approved `product-brief.md` content — the config should reflect
  the product decisions already made, not contradict them
- Instruction to ask questions one at a time, never in batches

The Config Generator runs its Q&A flow. See the builder file for the
full question set and order.

**Q&A adapts to entry path:**

For `new` projects — the builder asks about stack, backend, integrations,
deployment, and repo URL. Stack recommendations should be informed by
the product-brief.md — what was approved there should guide what's
sensible here.

For `migration` projects — the builder first attempts to detect the
existing stack from any files present in the repo. It presents its
detection as a starting point, the user confirms or corrects. Fewer
questions are needed because many answers already exist in the codebase.

**This phase ends when:**
- All required questions have been answered
- The builder has enough information to generate a complete config

---

## Phase 4 — Review and Generate

The Config Generator presents the full proposed config as a readable
summary — not raw JSON. Each field is shown with a plain-English note
explaining what it means and why it was set that way.

**Example format:**

---

> Here's your project configuration. Review each item before we
> generate the files.
>
> **Project:** my-todo-app
> *The name your project will be identified by throughout Weft.*
>
> **Type:** web_app
> *A web application with a React frontend, based on your product brief.*
>
> **Frontend:** React + Vite + Tailwind CSS
> *Selected based on your web_app type. shadcn/ui will be provisioned
> automatically during setup.*
>
> **Backend:** Supabase
> *Postgres database, authentication, and storage in one. Recommended
> for your use case based on the product brief.*
>
> **Email:** Resend
> *You indicated email notifications are needed. Resend is the default
> for new projects — low setup friction, good deliverability.*
>
> **SMS:** None
> *Not needed for this project.*
>
> **Deployment:** Vercel
> *Recommended default for React + Vite projects. Can be changed after
> setup.*
>
> **Repo:** https://github.com/janedoe/my-todo-app

---

After the summary, present the final gate:

---

> How would you like to proceed?
>
> 1. Approve — generate pipeline.config.json and finish setup
> 2. Change something before generating
> 3. Save progress, end session, and resume in a future session

---

**If the user selects 1:** Generate the files (see below).

**If the user selects 2:** Ask what they'd like to change. Update the
relevant field. Show only the changed field with its updated value and
reason. Re-present the full gate — do not re-show the entire summary
unless the user asks.

**If the user selects 3:** Write a handoff. Output the resume prompt.
Stop.

---

## File Generation

When the user approves in Phase 4, generate two files:

**1. `pipeline.config.json`** at the repo root.
Follow the schema defined in `.claude/builders/config-generator.md`.
All fields present. Unused fields set to null. Stack extensions nested
under `stack`. Timestamps set to current datetime in ISO 8601 format.

**2. `product-brief.md`** — already written in Phase 2.
Confirm it exists at the repo root. Do not overwrite it.

After writing, confirm both files exist. Then present the completion
message:

---

> **Setup complete.**
>
> Two files have been created in your project:
> - `product-brief.md` — your founding product strategy
> - `pipeline.config.json` — your project configuration
>
> **Your next step is `/setup-pipeline`.**
>
> This runs the Cloud Architect, who will use these files to provision
> your development environment — installing the right tools, connecting
> your services, and getting everything ready to build.
>
> Whenever you're ready, type `/setup-pipeline` to continue.

---

## Rules for This Command

1. **Never combine phases.** Phase 1 ends before Phase 2 begins.
   Phase 2 ends before Phase 3 begins. Phase 3 ends before Phase 4.
2. **Never ask multiple questions at once.** One question, wait for
   the answer, then the next.
3. **Never generate files until Phase 4 approval.** Not even
   incrementally.
4. **Always adapt to the entry path.** New and migration projects
   follow different Q&A flows.
5. **The product brief leads the config.** Stack recommendations
   should be consistent with what was approved in product-brief.md.
6. **A clear next step always ends this command.** The user should
   never finish `/new-project` wondering what to do next.
