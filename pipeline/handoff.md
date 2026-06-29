## What We Accomplished

Cleared the high-severity `undici` advisory that `npm audit` flagged in the
frontend. `undici` is a dev/test-only dependency (pulled by `jsdom`, the vitest
jsdom test environment), so it never shipped in the app — the production-only
audit was, and remains, clean. A non-breaking `npm audit fix` bumped it
(7.27.1 → 7.28.0) and the audit is now clean with no high/critical findings.
**No version bump:** a dev-only change leaves the app bundle byte-identical, and
skipping the bump keeps the still-pending v0.5.47 binary release untouched.

## What Has Been Saved

- `frontend/package-lock.json` — `undici` 7.28.0; the lockfile's stale root
  metadata (`version` 0.5.44 → 0.5.47, the `engines` block) synced to
  `package.json`. App source untouched.
- `DECISIONS.md` — the cleanup and the explicit no-version-bump decision.
- `CLAUDE.md` — a Versioning carve-out: dev-only/toolchain changes that don't
  affect the bundle skip the version bump / changelog / tag / release.
- `pipeline/dev-dependency-cleanup/` — change-brief, pr-description, qa-report,
  security-report, decisions.
- Committed to `main` and pushed. No tag, no release (dev-only).

## Where We Are

Improvement complete — all six Improve-lane stages done. Source is on `main`.
No binary release for this change (dev-only, byte-identical bundle).

**Still pending on the Mac (unchanged by this run): the v0.5.47 binary release.**
On the Mac: `git checkout main && git pull --ff-only origin main`, then
`nvm install $(cat .nvmrc) && nvm use $(cat .nvmrc)`, then `zsh -lc ./release.sh`;
verify `gh release view v0.5.47`. This dev-dep fix rides along on `main`
harmlessly (version stays 0.5.47).

## Resume Prompt

To resume work, run `/weft` in a Claude Code session in this project — it reads
saved state and picks up from the current (idle) state.
