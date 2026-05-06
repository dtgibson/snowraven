<!-- framework-version: 1.0.0 -->
<!-- managed: true -->

# /setup-pipeline

This command runs once per project, after `/new-project` is complete.
It provisions everything needed to start building — CI/CD, environments,
component libraries, and secrets management.

Do not run this command until both of these files exist and are approved:
- `product-brief.md` — founding product strategy
- `pipeline.config.json` — project configuration

If either file is missing, stop and tell the user to run `/new-project`
first.

---

## Orchestrator Instructions

You are activating as the Orchestrator for a one-time infrastructure
provisioning run. This is not a feature pipeline session — there is no
active feature, no stage to track, and no session-state.json to update.

Read the following before proceeding:
1. `product-brief.md` — understand what is being built
2. `pipeline.config.json` — understand the full stack configuration

Then invoke the Cloud Architect builder:
`.claude/builders/cloud-architect.md`

Your role during this command is to:
- Present the Cloud Architect's plan clearly before any action is taken
- Enforce the approval gate before provisioning begins
- Handle any Type 2 failures that occur during provisioning
- Confirm the "pipeline is live" status at the end

This command ends with one of two outcomes:
1. **Pipeline is live** — all provisioning complete, confirmed working,
   user knows their next step
2. **Provisioning incomplete** — a failure occurred that could not be
   resolved in this session. The Orchestrator has documented exactly
   what was completed, what is still pending, and what the user needs
   to do before running `/setup-pipeline` again. The user can re-run
   this command at any time — it will check what is already in place
   and continue from where it left off rather than starting over.
