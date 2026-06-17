# Security Review — frivolous-lists-expansion

**Date:** 2026-06-16
**Feature:** frivolous-lists-expansion — five new Statistics Frivolous Lists
**Stack:** react-vite-tailwind frontend (the change); python-fastapi backend untouched
**Checklist:** reference/checklists/security-react-vite.md
**Outcome:** PASSED

## Summary
Frontend-only change adding hardcoded themed bird lists plus a grouped renderer to the
Frivolous Lists card. No user input, no new network calls, no new dependencies, no
secrets, no auth, no backend change. The new species names are trusted compile-time
constants rendered as React-escaped text (no href/URL is built from them); they ride the
existing `/taxonomy/codes` batch (the same call `AVIAN_AMERICAN` already uses). No
injection or data-egress surface, and no privacy-policy change. Clean pass, no findings.

## Findings
No security issues found in this feature.

## Checks Performed
| Check | Result |
|---|---|
| No secrets/keys/tokens in new source | Pass |
| `VITE_` vars / `.env` / committed config credentials | Pass — N/A, none touched |
| API calls go through the backend; no key-exposing third-party calls | Pass — no new calls; the taxonomy batch is the existing app endpoint |
| No `dangerouslySetInnerHTML` with unsanitized input | Pass — names render as escaped JSX text |
| URLs validated before `href`; no `javascript:` URLs | Pass — the lists build NO URLs from names; favicons/Species-Detail links use validated taxon codes via the existing BirdName/SpeciesLinks |
| User input validated | Pass — N/A; the list data is hardcoded trusted constants |
| Auth state / tokens / protected routes | Pass — N/A, no auth in the app |
| No known-vulnerable / new dependencies | Pass — none added |
| ReDoS / regex on untrusted input | Pass — no new regex; matching reuses `normalizeSpeciesName` + a Set lookup |
| Source maps / console logs / dev-only code in prod | Pass — none added |

## Informational
- No `PRIVACY_POLICY.md` change required: no new providers; the hardcoded names join the
  existing eBird taxonomy-codes batch and the existing eBird/BoW favicon + Macaulay
  disclosures. The "collects nothing / no server" posture is unchanged.

## Convention Flags
None.
