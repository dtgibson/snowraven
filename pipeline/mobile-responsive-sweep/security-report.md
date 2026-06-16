# Security Review — mobile-responsive-sweep

**Date:** 2026-06-16
**Stack:** python-fastapi backend (untouched) + react-vite frontend
**Outcome:** PASSED

## Summary

This is a frontend-only CSS/layout change — new responsive class hooks in
`globals.css`, className swaps and `min-width`/`flex-wrap`/`overflow-wrap`
adjustments across ~35 components, deletion of two dead stylesheets, and a
version bump. It introduces no new attack surface, no new trust boundary, no new
data flow, and no new dependency or network call. No security issues found.

## Findings

No security issues found in this change.

## Checks Performed

| Check | Result |
|---|---|
| No new `dangerouslySetInnerHTML` (grep over full diff) | Pass — none added |
| Comment rendering still escapes (CommentText.tsx) | Pass — only a `Fragment`→styled `<span>` swap; the escaped-JSX segments and the validated-`http(s)`-only anchor branch are unchanged |
| Map / atlas popups stay escaped JSX (AtlasLayer.tsx, map/*Markers) | Pass — only width clamp / `.sr-wrap-anywhere` styling; no switch to HTML strings, popup JSX + `encodeURIComponent` URL intact |
| eBird id validation (ChecklistLink / SUBMISSION_ID_RE) | Pass — link/id-validation logic untouched (layout-only edits) |
| No new dependencies | Pass — `package.json` diff is the version string only |
| No new network calls / fetch / transport / listeners | Pass — none in the diff |
| Tile providers / external requests (privacy) | Pass — no map provider or external request change; `PRIVACY_POLICY.md` unaffected |
| Backend / trust boundary | Pass — backend not touched; no new routes, inputs, or auth surface |

## Notes

Privacy posture unchanged: no analytics, telemetry, accounts, or new third-party
services were added. The published `PRIVACY_POLICY.md` and `ACCESSIBILITY.md`
statements remain accurate (accessibility behavior is preserved — focus traps,
rem-based text scaling, and aria/role/testid attributes were not altered).
