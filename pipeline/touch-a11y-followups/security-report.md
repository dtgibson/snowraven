# Security Review — touch-a11y-followups

**Date:** 2026-07-02
**Feature:** touch-a11y-followups (v0.5.56) — surface three hover-only / touch-inert affordances for touch users
**Stack:** react-vite (frontend-only change; the `python-fastapi` backend was untouched — no `backend/` file in the diff, pytest 172 green)
**Checklist:** `reference/checklists/security-react-vite.md`, plus the CLAUDE.md "Security — standing checks"
**Lane:** Improve (maintain) — focus is new attack surface, trust-boundary change, or weakened control
**Outcome:** PASSED

---

## Summary

This is a small, frontend-only presentation change: it adds visible-text meanings to the Breeding Codes legends (matrix footer + filter pills), reveals a numeric media count beside the comparer's media icons on the ≤640 phone tier via a new base-hidden CSS class, and removes an inert `position:sticky` declaration from the default-mode Life List `<thead>`. Every value newly rendered is either a bundled, trusted constant (`BREEDING_CODE_MAP` labels) or a numeric count (`MediaPresence.photo/audio/video`, typed `number`), rendered as an auto-escaped React child. No new attack surface, no trust-boundary change, no control weakened, no new dependency, no secrets, and no new network call or tile provider — so no `PRIVACY_POLICY.md` change is required. Nothing that a security review would gate on changed.

---

## Findings

No security issues found in this change.

---

## Trust-boundary / attack-surface analysis (Improve-lane focus)

- **No new attack surface.** The change adds no request handling, no route, no input parsing, no deserialization, no storage seam use, and no new external call. It renders already-loaded values in a new visual spot.
- **No trust boundary changed.** Data provenance is unchanged: the breeding-code labels are a hardcoded module constant (`frontend/src/lib/breedingCodes.ts` `BREEDING_CODES` → `BREEDING_CODE_MAP`), and the media counts come from the same comparer pipeline (`compareChecklists.ts` `MediaPresence`) that already fed the pre-existing `title`/`aria-label`. No previously-trusted value is now rendered from a less-trusted source, and vice-versa.
- **No control weakened or removed.** No id-validation regex (`SUBMISSION_ID_RE` / `/^L\d+$/` / `/^\d+$/`), no `encodeURIComponent`, no `escHtml`/`CommentText` path, and no popup-JSX pattern was touched. The `#5` A/B side-cell work (commit `081a2588`: `sideLabel` prop, `.sr-sidecell-tag`, `mode==='both' ? 'A'/'B'`) is preserved verbatim — the `#27` media-count reveal is an independent sibling span in `MediaIcons`, not an edit to `SideCell`'s tag logic.

---

## Requested confirmations

- **Legend text is trusted, escaped React children.** `BreedingCodeTable.tsx` renders `{BREEDING_CODE_MAP.get(code)!.label}` and `BreedingCodeList.tsx` renders `<span>{def.label}</span>` — both from the bundled constant table, as normal JSX children (auto-escaped). No `dangerouslySetInnerHTML`, no HTML-string building, no user/API text. Confirmed.
- **Comparer media-count reveal is a numeric child.** `ChecklistComparer.tsx:83` renders `<span className="sr-media-count" aria-hidden="true">{n}</span>`, where `n` is `MediaPresence.{photo,audio,video}` — typed `number`. Rendered as an escaped child (and numeric regardless). Confirmed.
- **No URL/href/id work.** Diff scan across all changed `.tsx` + `globals.css` found no `href`, `dangerouslySetInnerHTML`, `innerHTML`, `javascript:`, `encodeURIComponent`, `*_RE`, or id-validation add/remove. No popup switched away from escaped JSX. No new external link. Confirmed.
- **`.sr-media-count` + Life List sticky gating are pure CSS/style.** `.sr-media-count` is `display:none` base / `display:inline` inside the existing `@media (max-width:640px)` block — same idiom as `.sr-sidecell-tag`; no logic, no data flow. `LifeListTable.tsx:217` gates the (inert) sticky via `...(wideMode ? { position:'sticky', top:0 } : {})` — a pure style-object change, no trust boundary. Confirmed.
- **#5 A/B side-cell work (081a2588) and existing controls preserved.** `sideLabel` / `.sr-sidecell-tag` / A-B derivation intact; comment-toggle button, `BreedingBadge`, `MediaIcons` aria all unchanged apart from the additive count span. Confirmed.
- **No secrets, no new dependencies, no PRIVACY_POLICY change.** Full-diff scan for keys/tokens/secrets/`fetch`/`WebSocket`/`axios`/tile-provider/`dependencies` → none. `frontend/package.json` touched only the `version` field (0.5.55 → 0.5.56); no dependency line changed. No new network call or tile provider → `PRIVACY_POLICY.md` correctly unchanged. Confirmed.

---

## Checks Performed

| Check | Result |
|---|---|
| No API keys / tokens / secrets in any changed source file | Pass — full-diff secrets scan clean |
| Only non-sensitive values rendered client-side | Pass — bundled constant labels + numeric counts only |
| `.env` / `.env.local` gitignored; no credentials in config | Pass — N/A, no env/config touched (config diff = version bump only) |
| No credentials in `vite.config.ts` / committed config | Pass — `vite.config.ts` not in diff |
| API calls go through configured transport; no new third-party call | Pass — no network code touched; no `fetch`/`axios`/socket added |
| API base URLs are env-driven, not hardcoded | Pass — N/A, no API call added or changed |
| Error responses handled gracefully; no raw errors to users | Pass — N/A, no error-handling path touched |
| Auth tokens not in localStorage; auth state handling | Pass — N/A, app has no auth; no `localStorage` touched |
| User-generated HTML uses sanitization; no unsanitized `dangerouslySetInnerHTML` | Pass — no `dangerouslySetInnerHTML`; all new output is escaped JSX children |
| URLs from user/external data validated before `href`/`src`; no `javascript:` | Pass — no `href`/`src`/URL interpolation added; no id-validation removed |
| Form inputs affecting navigation/state validated | Pass — N/A, no form/input/navigation logic changed |
| No known-vulnerable packages / no new dependencies | Pass — `package.json` version-only; dependency graph unchanged |
| `react` / `vite` / direct deps on supported versions | Pass — N/A, no dependency change in this diff |
| No unused dependencies introduced | Pass — no dependency added |
| Source maps not deployed to production | Pass — N/A, build config unchanged |
| Console logs with sensitive data removed | Pass — no `console.*` added |
| No dev-only / debug code paths shipped | Pass — additive UI/CSS + one dead-CSS removal only |
| **Standing check** — map/atlas/marker popups stay escaped JSX (not `dangerouslySetInnerHTML`) | Pass — no popup touched |
| **Standing check** — eBird id shape-validation before it becomes a link | Pass — no id→href path added or removed |
| **Standing check** — user/API comment text renders only through `CommentText` | Pass — no comment-render path touched |
| **Standing check** — module-level `/g` regex hygiene / linear scans | Pass — no regex added or modified |
| **Standing check** — map tile provider change ⇒ `PRIVACY_POLICY.md` update | Pass — N/A, no basemap/provider change |
| Trust boundary unchanged (Improve-lane focus) | Pass — data provenance identical; bundled-constant + numeric-count values only |
| No security control weakened/removed (Improve-lane focus) | Pass — no validation, escaping, or gate removed; #5 A/B work preserved |

---

## Convention Flags

None. This change follows the existing CLAUDE.md standing conventions (surface hover-only info for touch; base-hide / ≤640 reveal via a `globals.css` class; escaped-JSX rendering of trusted bundled data) rather than establishing a new security rule.
