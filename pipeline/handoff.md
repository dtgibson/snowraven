## What We Accomplished

Fixed a dark-mode bug on the Statistics tab: the "Firsts & Milestones" badges (and the matching
Frivolous Lists "Complete!" badges) rendered as bright white tiles with the bird's name nearly
invisible. They now use dark green / amber tiles in dark mode with the threshold number, name,
date, and check mark all re-tuned to WCAG AA. Light mode is unchanged. It's a pure CSS-token
change, plus a contrast regression test that parses the real tokens so the bug can't silently
return.

## What Has Been Saved

- frontend/src/globals.css (dark-theme `--sr-milestone-*` tokens re-tinted)
- frontend/src/lib/milestoneContrast.test.ts (new AA-contrast regression test)
- frontend/package.json, src-tauri/tauri.conf.json, frontend/package-lock.json (0.5.44)
- CHANGELOG.md, DECISIONS.md, CLAUDE.md, ROADMAP.md
- pipeline/milestone-badge-dark-contrast/ (bug-brief, pr-description, how-to-see, qa-report, security-report)

## Where We Are

Fix complete, recorded, committed, and pushed — `main` plus tag `v0.5.44` (which starts the
Windows CI build). The release publishes when `release.sh` runs on the Mac.

## Resume Prompt

To resume: run `/weft` in this project. The pipeline is idle. The remaining step is the Mac
release — `zsh -lc ./release.sh` — after the `v0.5.44` Windows CI run goes green (confirm its
headSha equals the tag commit before releasing).
