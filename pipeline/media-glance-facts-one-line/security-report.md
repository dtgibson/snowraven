# Security Review — media-glance-facts-one-line

**Date:** 2026-06-10
**Feature:** media-glance-facts-one-line (Statistics → Media "At a glance" card: uniform fact tiles + busiest-day eBird checklist link)
**Stack:** python-fastapi backend / react-vite-tailwind frontend (this fix is frontend-only TypeScript/React)
**Checklist:** reference/checklists/security-react-vite.md (Input Handling, Dependencies, Build Output items applied; auth/CORS/secrets items N/A — no auth, network, or secrets surface touched)
**Lane:** fix — reviewed whether the fix introduces NEW attack surface (a new external link) or weakens an existing guard (the export parser). Unrelated pre-existing code was not re-audited.
**Outcome:** PASSED WITH NOTES (one Informational note; nothing blocking)

---

## Summary

This fix reworks the Media stats "At a glance" card into uniform grid tiles and adds one new external link: the busiest-day date now links to that day's dominant eBird checklist. The single new trust boundary — a checklist id read from the user's Macaulay Library CSV export interpolated into an `href` — is correctly defended in depth: the id is shape-validated to `/^S\d+$/` (the same `SUBMISSION_ID_RE` every other checklist link in the app uses) before the link is even constructed, AND the value is `encodeURIComponent`-wrapped at interpolation. A junk or `javascript:` value can never become a live link. The parser change strictly *tightens* date validation (out-of-range dates are now excluded rather than silently rolled over), no security control was removed or weakened, and no dependency was added or bumped. The link is rendered as escaped JSX with `rel="noreferrer"`; there is no `dangerouslySetInnerHTML` anywhere in the touched components.

---

## Findings

### Informational — external anchor uses `rel="noreferrer"` without an explicit `noopener`

**Severity:** Informational
**Location:** `frontend/src/components/MediaStatsSections.tsx:133` (the busiest-day checklist anchor)
**Description:** The new `target="_blank"` anchor sets `rel="noreferrer"` but not the explicit `noopener` token. `noreferrer` implies `noopener` in all current browsers (the new tab gets a null `window.opener`), so reverse-tabnabbing is already prevented. This is purely a note that the token list relies on the implication rather than stating `noopener` outright — and it is the established convention across the entire codebase (every existing `ebird.org/checklist` anchor in `BirdingStats.tsx`, `SpeciesDetail.tsx`, `ChecklistComparer.tsx`, `WeatherTidePanel.tsx`, `NamedBirdsTable.tsx` uses the same `rel="noreferrer"`). The destination (`ebird.org`) is also a fixed, trusted host, so the opener risk is theoretical here regardless.
**Remediation:** None required. The protection is effective as written and consistent with project convention. If the team ever wants the token spelled out, `rel="noopener noreferrer"` would be a cosmetic change — but standardizing it would be a project-wide convention decision, not a fix for this card alone (see Convention Flags).
**Status:** Accepted

---

## Checks Performed

| Check | Result |
|---|---|
| Input Handling — no `dangerouslySetInnerHTML` in touched components (`MediaStatsSections.tsx`, `statsPrimitives.tsx`) | Pass — grep confirms zero uses; link/date/label all render as escaped JSX children |
| Input Handling — external URL built from user/export data is validated before use in `href` (no `javascript:`/junk URLs) | Pass — `checklistId` is gated by `SUBMISSION_ID_RE = /^S\d+$/` in `mediaStats.ts:365` before `busiestDay.checklistId` is set; the link only renders when that non-null id exists |
| Input Handling — defense-in-depth on the interpolated href value | Pass — additionally `encodeURIComponent`-wrapped at `MediaStatsSections.tsx:132`; `/^S\d+$/` already forbids any unsafe character, so this is belt-and-braces |
| Input Handling — `SUBMISSION_ID_RE` matches the app's other checklist-link sites (no divergent/weaker pattern) | Pass — identical `/^S\d+$/` to `speciesStats.ts:9`, `BirdingStats.tsx:58`, `SpeciesDetail`/`ui` |
| Input Handling — `aria-label` / `title` carry untrusted data? | Pass — both are composed from a formatted date string and static literals; React escapes string attributes; no raw export text is interpolated |
| Trust boundary — does the fix add a new external link / attack surface? | Reviewed — yes, one new `ebird.org/checklist` anchor; assessed and guarded (see above). See Informational note on `rel`. |
| Parser change — does the date tightening weaken an existing guard? | Pass — `dayNumber()` in `mediaStats.ts` now *adds* a month/day range check (`mo 1–12, d 1–31`) matching `formatDate`'s `parseParts`; out-of-range dates excluded rather than rolled over. Strictly more restrictive. |
| Parser change — new `checklistId` column read safely | Pass — `parseMLExport.ts:207` reads via `col(cols, idx).trim()` (the same quote-stripping/trim accessor used for every other column); defaults to `''` when the column is absent; no new injection path |
| `col()` CSV accessor unchanged / not weakened | Pass — `col()` body untouched; trims and strips surrounding quotes as before |
| Date formatter — new `formatDateRange` / `formatSpanLength` throw or leak? | Pass — `formatDateRange` reuses `parseParts`/`formatDateCore`, returns `''` on unparseable input, never throws; `formatSpanLength` guards `!Number.isFinite || days < 0 → ''`; both produce display-only strings rendered as escaped React children |
| API Keys & Secrets — any secret/key introduced in source? | Pass — N/A; no keys, tokens, env vars, or `VITE_` values touched |
| CORS & API Communication — new network calls or third-party API calls? | Pass — N/A; no fetch/transport calls added; the anchor is a user-initiated navigation to a fixed eBird URL, not an app request |
| Authentication State — token/auth handling affected? | Pass — N/A; app has no auth |
| Dependencies — new or vulnerable package added/bumped? | Pass — `package.json` diff is the version field only (0.5.24 → 0.5.25); no dependency add/remove/version change |
| Build Output — source maps / debug code / sensitive console logs introduced? | Pass — no build config, source-map, or logging change in the diff |
| Privacy — does the new link expose the user's IP/data to a new provider? | Pass — eBird is an already-disclosed destination the app links to throughout; no new third party, no change to `PRIVACY_POLICY.md` warranted |

---

## Convention Flags

- A standing rule already governs this surface (CLAUDE.md → "Security — standing checks": map/checklist links built as escaped JSX, external URLs shape-validated before becoming hrefs) and this fix conforms to it. One optional addition the team may want to standardize: **all `target="_blank"` anchors use the full `rel="noopener noreferrer"` token pair.** The codebase currently relies uniformly on `rel="noreferrer"` (which implies `noopener`); this is safe today, but a one-line standing rule would make the intent explicit and future-proof against a browser that ever decouples the two. Optional — the current state is not a vulnerability.
