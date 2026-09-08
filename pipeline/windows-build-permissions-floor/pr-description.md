## Windows Build Permissions Floor

### What this does

Declares `contents: read` as the workflow-level `GITHUB_TOKEN` permission for the Windows release build. This pins the repository's current effective read-only default in version control so an external settings change cannot silently widen the workflow.

### How to test

1. Query `repos/dtgibson/snowraven/actions/permissions/workflow` and confirm the current effective default is `read`.
2. Parse `.github/workflows/windows-build.yml` and confirm its top-level `permissions` mapping contains exactly `contents: read`.
3. Confirm the workflow's triggers, job, build commands, ephemeral signing-key handling, caches, and artifact upload are otherwise unchanged.

### Notes for reviewer

GitHub identifies `dtgibson` as a user account, so there is no organization-level workflow-permissions endpoint for this repository. The repository endpoint is the authoritative effective setting. No permission was added for cache or artifact operations because those actions use GitHub Actions runtime services rather than broader `GITHUB_TOKEN` access.
