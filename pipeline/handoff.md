# Handoff — Mobile-responsive sweep pushed (v0.5.37); awaiting Mac release.sh

## What We Accomplished

Shipped the **mobile-responsive sweep (0.5.37)** off this machine: every screen
now flows from a ~320px phone up to a large desktop with no overlapping rows and
no sideways scrolling, and large screens cap to a comfortable width. It was built
by generalizing the app's existing CSS-class responsive system — a small shared
vocabulary of layout hooks plus breakpoint tiers (480 / 640 / 1024 + a 1280px
desktop cap) — and migrating ~35 components onto it, rather than inline-styling.
Two dead leftover stylesheets (`index.css`, `App.css`) were removed.

Verified by driving the real app with Playwright at 320 / 360 / 1440px across all
ten tabs (zero horizontal page scroll everywhere) plus the full CI mirror — lint,
typecheck, 932 tests, production build, all green. One accepted limitation: the
Statistics tab still scrolls ~34px sideways only at 200% in-app text size.

## What Has Been Saved

- Code: responsive changes across ~35 components + new hooks in
  `frontend/src/globals.css`; `index.css` and `App.css` deleted.
- Version: `frontend/package.json` + `src-tauri/tauri.conf.json` → `0.5.37`;
  `CHANGELOG.md` entry added.
- Pipeline artifacts: `pipeline/mobile-responsive-sweep/` (change-brief,
  responsive-audit, qa-report, security-report); `pipeline/project.json` created.
- Records: `DECISIONS.md` (responsive system + the two page-scroll lessons),
  `CLAUDE.md` (Responsive layout conventions), `ROADMAP.md` (Shipped → 72).
- Committed to `main` and pushed; tag `v0.5.37` pushed (starts Windows CI).

## Where We Are

Improvement complete and pushed from the VM. **Next: on the Mac, once Windows CI
is green, run `zsh -lc './release.sh'`** (login shell — the Apple signing creds
live only in the login profile). Before releasing, verify the selected Windows CI
run's `headSha == git rev-parse v0.5.37^{commit}` (tag-re-push guard; this is a
fresh single-push tag, so no hazard expected). After release.sh, confirm the six
assets return HTTP 200 and `/releases/latest` shows v0.5.37 as Latest, then mark
`releasedVersion` 0.5.37.

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
