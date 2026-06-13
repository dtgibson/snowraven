# Handoff — accessibility-followups COMPLETE; v0.5.32 committed & pushed (release pending from the Mac)

## What We Accomplished

Finished the three deferred accessibility follow-ups from the 0.5.31 pass and corrected the records that described them. Every "open checklist on eBird" link now flows through one shared component (with a compact icon-only mode for dense spots and an accessible name that leads with the visible date so Voice Control can activate it); every external link announces it opens in a new tab via a new shared wrapper, with the wording unified app-wide; and the stale records were truthed up — including that the Southern-Hemisphere moon phase had actually shipped back in 0.5.28, not deferred. No user-facing feature changed. Ships as v0.5.32.

## What Has Been Saved

- Code: `frontend/src/components/ChecklistLink.tsx` (compact mode, label-aware name, `title` prop), new `frontend/src/components/OutboundLink.tsx`, and the migrated call sites across ~14 files; new tests `ChecklistLink.test.tsx` + `OutboundLink.test.tsx` (and updated BirdingStats / HelpDocs / SpeciesLinks / LifeListTable tests).
- Version: `frontend/package.json` + `src-tauri/tauri.conf.json` → 0.5.32; `CHANGELOG.md` entry.
- Records: `ACCESSIBILITY.md`, `DECISIONS.md`, `CLAUDE.md`, `PRODUCT_CONTEXT.md`, `ROADMAP.md`.
- Pipeline artifacts: `pipeline/accessibility-followups/` (change-brief, qa-report, security-report, deploy-readiness).
- **Committed and pushed to `main` from this VM** (rebased onto the Mac's "mark 0.5.31 released" commit). The release itself is still the manual step from the Mac.

## Where We Are

Improvement complete, verified (frontend 869, backend 110, production build + security review clean, adversarial regression review done), committed, and pushed to `main`. Pipeline idle. The release of v0.5.32 is pending from the Mac.

## To Release (your steps from the Mac — this VM stops at the push)

1. (Done on the VM: 0.5.32 is committed and pushed to `main`.)
2. Push the `v0.5.32` tag (starts the Windows CI build).
3. After CI finishes, run `./release.sh` from the Mac (notarized macOS build + signed Windows installer + `latest.json`).

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
