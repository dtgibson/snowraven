# Change Brief — Windows Build Permissions Floor

## What is changing
Add a workflow-level `permissions` block to `.github/workflows/windows-build.yml` that grants only `contents: read`. Keep the workflow's triggers, runner, build steps, ephemeral signing-key handling, caches, and artifact upload unchanged.

## Why now
The workflow currently inherits its token permission floor from a GitHub setting outside the repository. The live GitHub API reports `default_workflow_permissions: read` and `can_approve_pull_request_reviews: false` for this repository. The owner endpoint identifies `dtgibson` as a user rather than an organization, so there is no organization-level default endpoint; the repository workflow-permissions endpoint is the authoritative effective setting.

## User-facing impact
None. This makes the current read-only floor explicit in version control and prevents a future settings change from silently widening this workflow.

## Design pass
Not needed — configuration-only hardening with no visual or interaction change.

## Decisions touched
None. This implements the already-recorded security convention and resolves the tracked `windows-build.yml` permissions item without changing the Windows release-signing design.

## What done looks like
The workflow declares only `contents: read`, and every unlisted `GITHUB_TOKEN` scope therefore defaults to none. A structural check confirms the block is workflow-level and minimal; a step-by-step review confirms checkout is the only step needing repository contents and the cache/artifact actions use their separate Actions runtime services. Existing workflow behavior and repository defaults remain unchanged.
