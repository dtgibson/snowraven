# Security Review — accessibility-followups

**Date:** 2026-06-13
**Feature:** accessibility-followups (v0.5.32)
**Stack:** react-vite-tailwind frontend / python-fastapi backend
**Scope reviewed:** frontend-only diff (link wrappers + records). No backend code changed.
**Outcome:** PASSED

---

## Summary

A frontend accessibility change: 14 checklist links folded into the shared `ChecklistLink`, ~20 external links routed through a new `OutboundLink` wrapper, plus comment cleanups and a version bump. The review focused on whether it adds attack surface or moves a trust boundary. It does neither — the one untrusted-input path (eBird comment URLs in `CommentText`) keeps its existing controls, every link href is shape-validated or carries a hardcoded `https://` scheme, and nothing new is fetched, stored, or sent. No new third-party request, so the privacy policy is unaffected.

---

## Findings

No security issues found in this change.

---

## Checks Performed

| Check | Result |
|---|---|
| Untrusted comment URLs (`CommentText`) still gated on `^https?://` before becoming a link | Pass — guard intact at `CommentText.tsx:23`; only an sr-only cue was added |
| Comment anchors keep `rel="noopener noreferrer"` (reverse-tabnabbing) | Pass — `CommentText.tsx:24` unchanged |
| No new `dangerouslySetInnerHTML` introduced | Pass — the only one in touched files (`TargetMarkers.tsx:86`) is the pre-existing escaped marker sprite, not modified |
| Checklist link href shape-validated before linking | Pass — `ChecklistLink` gates on `SUBMISSION_ID_RE` (`/^S\d+$/`); junk id renders plain text |
| External link hrefs cannot carry an attacker-controlled scheme | Pass — every `OutboundLink`/anchor href is a constant or a hardcoded `https://…/` prefix with an interpolated path segment (region code, locId, catalog id, atlas code — `encodeURIComponent` on the atlas code); no `javascript:`/`data:` reachable |
| `OutboundLink` `{...rest}` prop spread fed only trusted props | Pass — all call sites pass app-controlled hrefs/styles; no untrusted data sets props |
| New `title` pass-through on `ChecklistLink` | Pass — rendered as a React attribute (auto-escaped); value is app-built text |
| No new secrets / API keys in source | Pass — no keys added; Settings links are public signup URLs |
| No new network calls, data persistence, or third-party services | Pass — external links are user-initiated navigations that already existed; nothing new auto-fetched |
| Privacy policy impact (new browser→provider requests) | Pass — none; `PRIVACY_POLICY.md` needs no change |
| Backend trust boundary | Pass — no backend code changed |

---

## Convention Flags

None. The standing checklist-id shape-validation and the escaped-JSX map-popup rules already in `CLAUDE.md` continue to hold; this change moved the checklist-id guard *into* the shared `ChecklistLink` component, which strengthens it.
