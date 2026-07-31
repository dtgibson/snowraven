## What We Accomplished

Built and independently verified the off-by-default **Disable embedded media**
preference. It suppresses every current Macaulay Library iframe in Species
Detail and Named Birds, replaces players with the approved note, and preserves
dates, formats, checklist links, direct media links, comments, analytics, and
batching. The approved backend dependency and Calendar performance-test
remediations are also complete.

Independent QA passed all release-level checks: 178 backend tests, 1,602
frontend tests, the focused 78-test feature suite, Calendar isolation,
TypeScript, ESLint, Ruff, the production build, startup and health smoke,
dependency consistency, iframe inventory, and diff checks. The repeat security
review found no open security or privacy issues; all prior multipart, dotenv,
and Starlette findings are resolved, and the full resolved npm and Python
production graphs have zero current advisories.

## What Has Been Saved

- `pipeline/disable-embedded-media/strategic-brief.md`
- `pipeline/disable-embedded-media/prd.md`
- `pipeline/disable-embedded-media/schema.md`
- `pipeline/disable-embedded-media/design.html`
- `pipeline/disable-embedded-media/design-spec.md`
- `pipeline/disable-embedded-media/pr-description.md`
- `pipeline/disable-embedded-media/how-to-see.md`
- `pipeline/disable-embedded-media/qa-report.md`
- `pipeline/disable-embedded-media/security-report.md`
- Feature code and regression tests under `frontend/src/`
- Updated backend dependency pins, user documentation, privacy policy, website,
  changelog, and synchronized `0.5.72` desktop versions

## Where We Are

The feature is at Step 8 of 9 with The Deployer. The reviewed feature was
committed and pushed as `b23801dfb994c2d69b5a7262d4a3d5a6d8dd05b6`, and the
unpublished `v0.5.72` tag points to that exact commit. Pages and frontend CI
passed, but backend CI stopped before pytest because the workflow installed
unpinned Ruff 0.16.1 while independent QA used Ruff 0.15.20; the newer release
enabled 49 repo-wide rules. No GitHub `v0.5.72` release exists and `release.sh`
has not run.

The user approved the recovery: pin the already-verified Ruff and pytest
versions in CI, rerun local verification, commit and push that tooling-only
fix, then replace the unpublished `v0.5.72` tag at the corrected commit. The old
Windows run must be ignored and the replacement run's `headSha` must match the
replacement tag exactly.

## Resume Prompt

To resume this session: run `$weft` in a Codex session in this project. It reads
saved state and picks up exactly here.

---

Resume SnowRaven's `disable-embedded-media` feature at Step 8 with The Deployer.
The CI-toolchain remediation and replacement of the unpublished tag are
approved. Pin Ruff 0.15.20 and pytest 9.1.1 in the backend CI install, verify
locally, commit and push the tooling-only fix, replace the unpublished
`v0.5.72` tag at that exact new commit, and monitor only the replacement
Pipeline and Windows Build. Verify the successful Windows run's `headSha`
equals the peeled replacement tag before running
`CI=true zsh -lc ./release.sh`. Stop on any failure or SHA mismatch. After a
confirmed and healthy production release, continue to The Chronicler.
