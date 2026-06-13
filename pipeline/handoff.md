# Handoff — accessibility-pass COMPLETE; v0.5.31 staged on main, not yet released

## What We Accomplished

A comprehensive WCAG 2.1 AA accessibility pass across the whole app, shipping as
v0.5.31 (staged on main; **not released** — it rides main until you push and the
Mac runs `release.sh`). A multi-phase audit confirmed 107 findings against 288
verified passes; the fix wave then resolved the critical finding and effectively
all of the serious tier, with the rest documented honestly. The published
`ACCESSIBILITY.md` was rewritten to match the shipped code — and the verification
loop caught and fixed two places where the statement had drifted from reality.

Highlights: accessible names on every filter/date/search control; a typed `--sr-*`
contrast retune in both light and dark themes; a rebuilt mobile-filter focus trap
with full focus-restore on every close path; DOM map markers as real buttons; a
keyboard route to the atlas blocks; keyboard tab-reordering in Settings; landmarks,
a skip link, and live-region announcements; and a shared `ChecklistLink`.

Final state: frontend 857/857, backend 110/110, `tsc` clean, production build
clean, security review clean (no Critical/High). Nothing is committed.

## What Has Been Saved

- `pipeline/accessibility-pass/` — the audit artifacts (change-brief.md,
  findings-appendix.md, work/ with per-group data, the token manifest, PROGRESS.md,
  and the raw workflow outputs).
- Code: `frontend/src/globals.css` (contrast tokens, both themes) + ~40 component
  files; `src-tauri/tauri.conf.json` + `frontend/package.json` (version 0.5.31);
  `src-tauri/capabilities/default.json`.
- Records: `ACCESSIBILITY.md` (rewritten true), `CHANGELOG.md` (0.5.31),
  `DECISIONS.md`, `PRODUCT_CONTEXT.md`, `CLAUDE.md`, `ROADMAP.md`,
  `website/index.html` (version pill).

## Where We Are

Improvement complete and recorded. Pipeline idle. v0.5.31 is staged and verified,
waiting on the release.

## To Release (your steps — this machine stops at the push)

1. Review the working tree, then commit and push to `main`.
2. Push the `v0.5.31` tag (starts the Windows CI build).
3. After CI finishes, run `./release.sh` from the Mac (notarized macOS build +
   signed Windows installer + `latest.json`).

## Follow-ups (optional, small a11y lane)

- Finish adopting the shared `ChecklistLink` across every checklist link (F064).
- A uniform "opens in a new tab" sweep on all external links (F078).
- Southern-Hemisphere moon-phase emoji — needs the checklist latitude threaded to
  the display layer + the byte-parity weatherFormatter trio (F082/F106).
- Stale "Leaflet panes" comment at `TabNav.tsx:281-282` (one-line touch-up).

## Resume Prompt

Run `/weft` to start the next thing. Load `pipeline/session-state.json` first.
