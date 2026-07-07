# Security Review — Unbounded Column Narrowing (Breeding Codes matrix)

**Date:** 2026-07-07
**Feature:** unbounded-column-narrowing (IMPROVE lane)
**Stack:** full_stack (react-vite frontend + python-fastapi backend) — **this change is frontend-only, purely presentational**
**Checklist:** react-vite security categories (XSS/DOM injection, secrets, dependencies/supply-chain, data-to-DOM, outbound URLs/network, storage/clipboard, accessibility-as-contract). The `reference/checklists/` directory does not exist in this repo; the change was worked against the standard react-vite categories used across SnowRaven's prior security-report artifacts. The **fastapi checklist is N/A** — zero backend code changed.
**Outcome:** PASSED

---

## Summary

Clean pass. This IMPROVE change is entirely presentational: it lifts two inline width values (the matrix `<table>` width/min-width and the wideMode card width) onto CSS classes (`.sr-bc-matrix`, `.sr-bc-card`) and adds a `≤640`-only `table-layout: fixed` + width override so the existing 30px dot-column narrowing binds in the Unbounded (wideMode) view. No user-controlled data, no new DOM sinks, no network, no URLs, no dependencies, no storage/clipboard, and no backend surface are introduced, so the change adds no attack surface and touches no trust boundary. Nothing found.

---

## Findings

No security issues found in this feature.

---

## Improve-lane focus (new attack surface / trust boundaries)

Per the IMPROVE lane, the review focused on whether the change introduces any new attack surface or alters a trust boundary. It does neither:

- **New attack surface:** none. The diff is width/`table-layout`/`min-width` CSS literals moved between an inline `style` and a CSS class, plus the two class hooks on one `<table>` and one card `<div>`. No new data flows into the DOM.
- **Trust boundaries:** unchanged. No new network calls, routes, external URLs, or data sources. The component still reads only the bundled, trusted `BREEDING_CODE_MAP`/`TIER_COLORS` and pre-parsed `BreedingEntry` props, and renders them as escaped JSX (`<BirdName>`, code strings, integer counts, static tier labels).
- **Dependency posture:** no dependency added, removed, or version-changed — no supply-chain delta to assess.
- **Security controls removed/weakened:** none. All standing SnowRaven security checks are absent from the changed files (no map popups, no id-shape validation, no `CommentText`, no comment-scanning regex, no pydantic twin), so none could be weakened.

## Standing SnowRaven security checks (CLAUDE.md → "Security — standing checks")

| Standing check | Relevant here? | Result |
|---|---|---|
| Map popups built as escaped JSX, not `dangerouslySetInnerHTML` | No — no map code touched | Not affected |
| eBird id shape-validated (`SUBMISSION_ID_RE` / `L\d+` / `\d+`) before becoming an href | No — no id/href in changed files | Not affected |
| User/API comment text only through `CommentText` | No — no comment rendering | Not affected |
| Module-level `/g` regex hygiene (`lastIndex`, linear scans) | No — no regex added | Not affected |
| Backend pydantic pattern uses `[0-9]` not `\d` in twinned guards | No — zero backend change | Not affected |

## Accessibility (WCAG 2.1 AA — standing SnowRaven contract)

Confirmed unchanged by this diff (verified against the file):

- Header sort `<button>`s retain full `aria-label` (`Sort by ${def.label} (${code})`).
- The `.sr-only` per-cell tier text (`, Confirmed/Probable/Possible`) remains.
- The sticky species-name column remains a real `th[scope="row"]`; header cells keep `scope="col"` + `aria-sort`.
- No token misused as a text color — there is **no token/color change** in this diff at all (only width/`table-layout`).

---

## Checks Performed

| Check | Result |
|---|---|
| Secrets / API keys / tokens in diff | Pass — none (grep for api-key/secret/token/bearer/EBIRD_/OPENWEATHER_/appid/PRIVATE KEY: empty) |
| `.env` / credential exposure | Pass — no env or credential reference added |
| New `dangerouslySetInnerHTML` / `innerHTML` | Pass — none introduced |
| Other DOM/JS sinks (`eval`, `new Function`, `document.write`) | Pass — none |
| New user-controlled data reaching the DOM | Pass — none; renders bundled/trusted data as escaped JSX only |
| XSS via rendered strings | Pass — code strings, integer counts, static labels; auto-escaped by React |
| New outbound URLs / links / `href` / `src` | Pass — none added |
| New network / `fetch` / `XMLHttpRequest` / SSRF surface | Pass — none |
| Open-redirect / `window.open` | Pass — none |
| Clipboard writes (`navigator.clipboard` / `copyText`) | Pass — none |
| Storage writes (`localStorage` / storage seam) | Pass — none; no persisted setting added |
| New dependencies / supply-chain delta | Pass — no package.json/lockfile change |
| Dynamic / interpolated / data-driven CSS (`url()`, `attr()`, `expression()`, `env()`) | Pass — added CSS is width/`table-layout`/`min-width` literals only |
| Lifted inline→class values byte-identical (no behavior change on desktop/Normal) | Pass — base `.sr-bc-matrix` = `width:100%;min-width:max-content`; base `.sr-bc-card` = `width:max-content` match the removed inline values |
| a11y — header button `aria-label` retained | Pass |
| a11y — `.sr-only` tier text retained | Pass |
| a11y — sticky name column stays `th[scope="row"]` | Pass |
| a11y — no token misused as text color (no token/color change) | Pass |
| Standing check — map popups stay escaped JSX | Pass (N/A — no map code) |
| Standing check — id shape-validation before href | Pass (N/A — no id/href) |
| Standing check — `CommentText` for comment rendering | Pass (N/A — no comment text) |
| Standing check — `/g` regex hygiene | Pass (N/A — no regex) |
| Standing check — pydantic `[0-9]` twin | Pass (N/A — no backend change) |
| No dead / experimental / leftover code from live-caught iterations | Pass — diff is the 3 source files + session-state; final CSS only, no stray inline overrides |
| Dev scratch (data/ CSVs, backend/.env, .claude/launch.json) not in diff | Pass — untracked, absent from the code diff (Deployer pre-commit concern, not a code-security issue) |
| Tests present & green | Pass — 28/28 in BreedingCodeTable.test.tsx; full suite 1569 green per QA |

---

*No Convention Flags — the change already follows the established "lift responsive width to a class, don't inline it" convention (CLAUDE.md), so nothing new to standardize.*
