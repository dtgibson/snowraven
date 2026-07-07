# Security Review — Mobile Breeding-Codes Matrix (Comfortable Phone View)

**Date:** 2026-07-07
**Feature:** mobile-wide-tables
**Stack:** full_stack (react-vite frontend + python-fastapi backend) — this feature is **frontend-only**
**Checklist:** `reference/checklists/security-react-vite.md` (applied). The `security-fastapi.md` checklist is **N/A for this feature** — no backend/Python code, routes, or data handling changed (verified: no `backend/` or `.py` file in the diff).
**Outcome:** PASSED

---

## Summary

This is a purely presentational, frontend-only change to one component: the Breeding Codes matrix table gets narrower code columns on phones (≤640px), thin CSS column separators, and a horizontally-sticky species-name column, with the page scrolling naturally instead of an inner capped-height box. The diff is three files — `BreedingCodeTable.tsx`, `BreedingCodeTable.test.tsx`, and `globals.css` — and touches only column widths, borders, sticky positioning, header font size, and tests. No new attack surface: no new user-controlled data reaching the DOM, no `dangerouslySetInnerHTML`, no new URLs/links/`href`/`src`, no network/fetch/storage/clipboard, no new dependencies, no secrets, and no weakening of any CLAUDE.md standing security check. Clean pass.

---

## Findings

No security issues found in this feature.

---

## Checks Performed

### React + Vite checklist

| Check | Result |
|---|---|
| No API keys/tokens/secrets in source | Pass — diff adds no literals; only widths/borders/font-size/class names. Grep for `key`/`token`/`secret`/`password`/`http(s)` in added lines returned only a `--sr-border-subtle` CSS-comment false-positive. |
| Only `VITE_`-prefixed vars client-side | Pass — no env vars added or referenced. |
| `VITE_` vars hold only non-sensitive values | Pass — N/A; none touched. |
| `.env` / `.env.local` gitignored | Pass — N/A; no env files touched by this feature. (Note: the DEV SCRATCH `backend/.env` placeholder is a Deployer-stage cleanup item, not part of this diff.) |
| No credentials in `vite.config.ts` / config | Pass — no config file changed. |
| API calls go through configured backend (no direct third-party key exposure) | Pass — feature adds **zero** network calls; grep for `fetch`/`transport`/`invoke`/`setZoom` in added lines = none. |
| API base URLs are env vars, not hardcoded | Pass — N/A; no API calls added. |
| API error responses handled gracefully (no raw detail to users) | Pass — N/A; no API interaction. |
| Auth headers appropriate; Bearer not in localStorage | Pass — N/A; no auth code. |
| Auth tokens in httpOnly cookies / in-memory (not localStorage) | Pass — N/A; no auth/token handling. This app is serverless/local-first (no accounts). |
| Logout clears all auth state | Pass — N/A; no auth. |
| Protected routes redirect unauthenticated users | Pass — N/A; no routing/auth. |
| Token refresh handles expiry gracefully | Pass — N/A; no tokens. |
| User-generated HTML uses sanitization; no `dangerouslySetInnerHTML` with unsanitized input | Pass — **no `dangerouslySetInnerHTML` added or present** in the component. The species name renders through `<BirdName>` (auto-escaped React children); the code header, dot count, and `.sr-only` tier text are all escaped JSX. |
| URLs from user/external data validated before `href`/`src`; no `javascript:` URLs | Pass — **no new `href`/`src`/URL of any kind** introduced. No link/anchor added to this surface by the feature. |
| Form inputs affecting navigation/state validated client-side | Pass — N/A; no inputs added (the sortable header `<button>` is unchanged; it toggles session sort state, not navigation). |
| No known-vulnerable packages | Pass — **no dependency change** (`package.json`/lockfile/`Cargo` untouched). |
| `react`/`vite`/direct deps on supported versions | Pass — unchanged by this feature. |
| Unused dependencies not present | Pass — no deps added; no new imports added to the component. |
| Source maps not deployed to production | Pass — build config unchanged; feature does not alter source-map settings. |
| Console logs with sensitive data removed | Pass — no `console.*` added in the diff. |
| Production build excludes dev-only/debug code | Pass — no dev-only branch or debug tooling added; the reverted experiment (`.sr-bc-scroll`, `MATRIX_MAX_HEIGHT`) is fully removed from source (see below). |

### Feature-specific verification (per the audit brief)

| Check | Result |
|---|---|
| No secrets/keys/tokens/credential exposure in diff | Pass |
| No new user-controlled data reaching the DOM | Pass — `code` comes from derived `codesPresent` keys; `def.label`/`def.tier` from the static `BREEDING_CODE_MAP`; `count` is a number; colors from `TIER_COLORS`/`TIER_TEXT_COLORS` tokens. Nothing new and untrusted is rendered. |
| No new `dangerouslySetInnerHTML` | Pass |
| Breeding-code labels/aria are static/derived, escaped JSX | Pass — `aria-label={`Sort by ${def.label} (${code})`}` interpolates static map + derived code into an attribute string (React auto-escapes); no HTML sink. |
| No new outbound URLs / external links | Pass |
| No new network/fetch, no clipboard, no storage writes | Pass — grep confirms none in added lines. |
| No new dependencies | Pass |
| Changed CSS is values-only (no data-driven CSS injection) | Pass — `.sr-bc-code-col`/`.sr-bc-name-col` set fixed `width`/`min-width`/`border`; the ≤640 block sets fixed width + `font-size`/`letter-spacing`. All colors via existing `var(--sr-border-subtle)`; no interpolated/attr-derived CSS values. |
| Reverted pieces left no dead/dangerous code | Pass — `MATRIX_MAX_HEIGHT`: **zero** references in `src/`. `.sr-bc-scroll`: the only occurrence is a test asserting its **absence** (a regression guard), not live code or CSS. |
| Standing security checks not weakened (JSX-not-innerHTML popups, id-shape `SUBMISSION_ID_RE`/`^L\d+$/`/`^\d+$`, `CommentText`, `/g` regex hygiene, pydantic `[0-9]`-not-`\d`) | Pass — **none of these files/patterns are touched**: no backend/router/`.py`, no `CommentText`/`ChecklistLink`/`HotspotLink`/`AtlasLayer`/`namedBirds`/`commentBlocks`, no regex added. This surface has no ids, links, comment text, or map popups. |

### Accessibility (WCAG 2.1 AA — SnowRaven standing contract)

| Check | Result |
|---|---|
| Code header keeps full `aria-label` | Pass — `Sort by ${def.label} (${code})` unchanged; header stays a real `<button>` with `aria-sort` and `role=columnheader`. |
| `.sr-only` tier text retained on count dots | Pass — `<span className="sr-only">, {tierCategoryName}</span>` (Confirmed/Probable/Possible) intact; narrowing the column removed no accessible info. |
| Sticky name column stays a real `th[scope=row]` | Pass — the name cell remains `<th scope="row">`; sticky `left:0` freeze preserved in Normal mode, dropped in `wideMode` (graceful escape), verified by tests. |
| No contrast token reused as a text color incorrectly | Pass — no token changes in this feature; `--sr-border-subtle` is used only as a `border` color (its intended fill/divider role), never as text. Contrast tokens untouched. |

---

## Convention Flags

None. No new standing security rule emerges from this change — it is a presentational CSS/layout change that stays entirely within existing conventions (class-lifted responsive widths, existing `--sr-*` tokens, escaped JSX, sticky-column hygiene). The existing "map popups stay JSX / id-shape validation / `CommentText`" standing checks remain the right guards and are unaffected here.
