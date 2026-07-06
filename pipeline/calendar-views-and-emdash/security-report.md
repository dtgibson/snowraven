# Security Review — Calendar Views + Em-Dash Removal (v0.5.68)

**Date:** 2026-07-06
**Feature:** calendar-views-and-emdash (Improve / maintain lane)
**Stack:** python-fastapi backend, react-vite-tailwind frontend
**Checklist:** reference/checklists/security-fastapi.md + security-react-vite.md (maintain-mode focus: new attack surface / weakened control)
**Outcome:** PASSED

---

## Summary

Two frontend-only refinements to already-shipped surfaces: (1) the Calendar tab's
Compact/Large view modes were fixed so both are reachable and distinct on mobile —
this removed a phone-force render branch and its supporting ≤640 CSS; (2) ~163 em
dashes were replaced with context-appropriate punctuation across ~30 files plus
`docs/HELP.md`. The review confirms no new network call, provider, telemetry, URL,
or user-input path was introduced, and that the copy sweep did not touch a single
URL/href construction, validation regex, id guard, or escaping context. No secrets,
no `dangerouslySetInnerHTML` added or removed, no change to any shared escaping path.
Backend was not modified. Clean pass.

---

## Findings

No security issues found in this feature.

Two informational notes (no action required — surfaced per policy):

### INFO-1 — Accepted residual em dash in provider-mandated Esri attribution

**Severity:** Informational
**Location:** `frontend/src/lib/mapStyle.ts:80` (unmodified)
**Description:** The Esri satellite attribution string retains an em dash. This is
provider-mandated wording, deliberately excluded from the sweep. `mapStyle.ts` was
not modified by this change (confirmed via `git status`).
**Remediation:** None — accepted, not a defect.
**Status:** Accepted

### INFO-2 — Data-parsing regex char class deliberately left intact

**Severity:** Informational
**Location:** `frontend/src/lib/mediaStats.ts:39`
**Description:** The behavior-count parser's `/^(.*?)\s*[–—-]\s*(\d+)\s*$/` char
class (which matches en dash, em dash, and hyphen in eBird/ML data being parsed) was
correctly left untouched. `mediaStats.ts` is not in the change set (confirmed via
`git status`); the copy sweep did not mangle this or any other parsing/validation
regex. Verified intact.
**Remediation:** None — correct behavior.
**Status:** Resolved (verified untouched)

---

## Checks Performed

| Check | Result |
|---|---|
| **Item 1 — Calendar mobile fix** | |
| No new network call / `fetch` / `transport` import added to `Calendar.tsx` | Pass |
| No `HotspotLink` / `OutboundLink` / `useHotspotSet` added — offline/zero-network guarantee intact | Pass |
| Plain-text (non-linked) popup location preserved; anti-HotspotLink comment still present | Pass |
| No `dangerouslySetInnerHTML` added to `Calendar.tsx` | Pass |
| No new provider / URL / user-input path in the Calendar change | Pass |
| Removed code (`useIsPhone` force, `effectiveMode`, `.sr-cal-bigday`) is render-branch/CSS only, no control weakened | Pass |
| **Item 2 — Em-dash removal (security-relevant surfaces)** | |
| No URL / href construction altered (`OutboundLink href` byte-identical; HELP.md link unchanged) | Pass |
| No id/format validation regex mangled (`SUBMISSION_ID_RE` / `LOCATION_ID_RE` / `/^\d+$/` untouched) | Pass |
| `mediaStats.ts:39` data-parsing char class `[–—-]` intact (file unmodified) | Pass |
| No escaping context altered — `escHtml` calls unchanged, `TargetMarkers` `labelHtml` still escapes | Pass |
| No `dangerouslySetInnerHTML` line added or removed anywhere in the diff | Pass |
| `checklistLinkAriaLabel` / `ChecklistLink` href construction unchanged in behavior | Pass |
| `OutboundLink` / `HotspotLink` href + attributes unchanged (copy-only edits to surrounding prose) | Pass |
| `CommentText` render path untouched (file not modified) | Pass |
| No em/en dash landed inside any code construct (regex, http, encode, target/rel/href) | Pass |
| `docs/HELP.md` edits are plain text — no injected markdown link, HTML tag, or new URL | Pass |
| No aria-label / title mangled into an injectable string (all remain plain text children/attrs) | Pass |
| **Cross-cutting** | |
| No new provider / telemetry / analytics / tracking / WebSocket / beacon token added | Pass |
| No secrets, API keys, or credentials introduced or exposed | Pass |
| `PRIVACY_POLICY.md` correctly needs no change (copy + CSS + render-branch only) | Pass |
| `ACCESSIBILITY.md` unaffected (aria-labels remain descriptive plain text) | Pass |
| Backend (`backend/`) not modified — no FastAPI route / pydantic / auth surface touched | Pass |
| Version bumped to 0.5.68 in both `package.json` and `tauri.conf.json` (matched) | Pass |

---

_No convention flags — the security posture here is entirely covered by existing
CLAUDE.md standing checks (offline Calendar guarantee, id-guard/`escHtml` escaping,
no-hardcoded-provider), all of which held._
