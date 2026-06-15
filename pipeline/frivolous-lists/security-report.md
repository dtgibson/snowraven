# Security Review — Frivolous Lists

**Date:** 2026-06-15
**Feature:** frivolous-lists
**Stack:** python-fastapi backend + react-vite-tailwind frontend (this change is frontend-only)
**Checklist:** reference/checklists/security-react-vite.md (primary); security-fastapi.md (backend unchanged — not exercised)
**Outcome:** PASSED

---

## Summary

The feature is genuinely frontend-only and privacy-neutral: it renders a new Statistics section computed from the already-loaded eBird backup, reusing the app's escaped-JSX rendering and the shared, guarded `ChecklistLink`. A two-lens adversarial review (injection/XSS, and ReDoS/privacy/secrets) against the actual diff found **no issues at any severity**. No new network call, provider, dependency, or personal-data egress; `PRIVACY_POLICY.md` needs no change.

---

## Findings

No security issues found in this feature.

---

## Checks Performed

### Input handling / XSS (React + Vite checklist)
| Check | Result |
|---|---|
| No `dangerouslySetInnerHTML` / `innerHTML` with unsanitized input | Pass — grep across both new files and the composed shared components (BirdName, SpeciesLinks, ChecklistLink, statsPrimitives) returned zero matches; all values render as escaped JSX |
| Bird names / scientific name / location / color name / dates render escaped | Pass — React children/attributes only (location also used as a `title` attr, still escaped) |
| URLs from external data validated before `href` (no `javascript:`/`data:`) | Pass — the Rainbow checklist href is gated by `SUBMISSION_ID_RE` (`/^S\d+$/`) inside `ChecklistLink`; a junk id renders as plain text; `^S\d+$` cannot encode a scheme |
| Dynamic CSS `var(--sr-rainbow-${color})` not attacker-controllable | Pass — `color` is only ever one of the seven `RAINBOW_COLORS` string literals (`as const`); the seven tokens exist in both themes |
| `taxonCode` interpolation into favicon hrefs | Pass — eBird species code from the trusted `/taxonomy/codes` response, appended to a hardcoded `https://` origin+path (pre-existing `SpeciesLinks`); scheme/host are literals |
| Navigation inputs (`onOpenSpecies`) | Pass — receives only a normalized common-name string |

### ReDoS / regex hygiene
| Check | Result |
|---|---|
| Color regexes not global (no shared `lastIndex`) | Pass — `/\bred\b/i` … `/\bviolet\b/i`, non-global, used via stateless `.test()` |
| Regexes linear (no catastrophic backtracking) | Pass — single `\b…\b`-anchored literals, zero quantifiers; stress-tested to 2 MB inputs, worst case ~11 ms |
| Matching complexity bounded | Pass — Kuhn's over a fixed 7 colors; stress-tested with 350,000 color-word species → ~235 ms, linear in N (the 7-color cap prevents blowup) |

### Privacy / egress / secrets / dependencies
| Check | Result |
|---|---|
| No new network call / provider | Pass — computed from already-loaded observations |
| 29 hardcoded names added to `/taxonomy/codes` batch | Pass — public eBird taxonomy constants (not user-derived) on the EXISTING batch; routes to the local TS service (Tauri) or the user's own backend (web/Pi), no third-party egress |
| `PRIVACY_POLICY.md` accuracy | Pass — no new data egress or provider; existing taxonomy/local-processing language already covers this |
| No secrets / API keys / tokens in source | Pass — grep clean in both new files |
| No `console.*` leaking data / no debug code | Pass |
| Dependencies | Pass — `package.json` diff is a version bump only (0.5.35 → 0.5.36); no new packages |

### Backend (FastAPI checklist)
| Check | Result |
|---|---|
| Backend attack surface | Pass — no backend file changed by this feature; FastAPI checklist items are unaffected (no new endpoint, query, input, or dependency) |

---

## Known Limitations
None security-relevant. (The pre-split-eBird-name behavior is a product/data note, not a security issue — see the QA report / OQ-01.)
