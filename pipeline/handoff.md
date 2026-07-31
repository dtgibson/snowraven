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

The feature is at Step 8 of 9 with The Deployer. Reconciliation and pre-deploy
readiness checks pass: the refreshed remote `main` has not moved, all `0.5.72`
version surfaces agree, release tooling and credentials are present, and the
reviewed diff is clean. The user explicitly approved the complete production
release sequence; it is now ready to commit, push, verify CI and the tag SHA,
then sign, notarize, and publish.

## Resume Prompt

To resume this session: run `$weft` in a Codex session in this project. It reads
saved state and picks up exactly here.

---

Resume SnowRaven's `disable-embedded-media` feature at Step 8 with The Deployer.
Production release approval has been granted. Commit and push the complete
reviewed `0.5.72` working tree, tag that exact commit, wait for the new Pipeline
and Windows Build to pass with a matching tag SHA, then run
`CI=true zsh -lc ./release.sh` to publish the signed/notarized multi-platform
release. Stop on any failed check or SHA mismatch. After a confirmed and healthy
production release, continue to The Chronicler for final project-memory updates.
