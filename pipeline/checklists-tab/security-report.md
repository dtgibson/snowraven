# Security Review — Checklists Tab

**Date:** 2026-06-10
**Feature:** checklists-tab (v0.5.27, unreleased)
**Stack:** python-fastapi backend (untouched) + React/Vite frontend
**Checklist:** security-fastapi.md (N/A — zero backend changes, verified by diff) + house standing checks (CLAUDE.md) + four-lens adversarial review (XSS/rendering, regex safety, privacy/network, standing checks)
**Outcome:** PASSED WITH NOTES (all non-informational findings RESOLVED in-stage)

---

## Summary

Four independent reviewers audited the uncommitted diff — rendering of untrusted CSV text, regex robustness under hostile input, privacy/network surface, and the house standing checks — and every claimed finding was adversarially re-verified before acceptance (none refuted). The feature's rendering layer is sound: all CSV text renders as escaped JSX, links are gated (http(s)-only anchors; submission ids behind `SUBMISSION_ID_RE`), no new network surface exists, and the privacy policy needs no update. Three real code findings (one Medium, two Low) were found in the strip/render plumbing and **fixed and regression-tested within this stage**; three informationals were addressed or accepted.

---

## Findings

### 1. stripWeatherTideBlocks was O(n²) on attribution-spam comments
**Severity:** Medium · **Status:** RESOLVED
**Location:** `frontend/src/lib/commentBlocks.ts` (span loop + unbounded lazy `<a>` arm)
**Description:** Three per-iteration full-tail scans made a hostile comment quadratic — measured 4.1s at 400KB, ~26s extrapolated at 1MB, synchronously inside the tab's `useMemo`. Self-DoS only (the data is the user's own CSV), but the exact failure mode the house `NAME_TAG_RE` precedent guards against.
**Remediation applied:** marker/emoji positions are precomputed in single passes and binary-searched per attribution; the attribution regex's `<a>` arms are length-bounded. Post-fix: 414KB spam in ~5ms, 192KB unclosed-`<a>` spam in ~12ms. Real-backup results byte-identical (308 block-bearing comments: 281 emptied / 27 kept / 0 residue). Regression test added.

### 2. Stale shared-regex state made the strip fail order-dependently
**Severity:** Low (functional leak of supposedly hidden content) · **Status:** RESOLVED
**Location:** `frontend/src/lib/commentBlocks.ts` (fallback `matchAll` on module-level `/g` regex)
**Description:** `String.prototype.matchAll` clones a regex *including its current `lastIndex`* (ES spec). The no-attribution fallback inherited a stale offset from a previous call's `exec`, silently skipping markers — so an attribution-less block could render (and be searchable) with the toggle set to hidden, depending on comment processing order. Empirically reproduced by the reviewer.
**Remediation applied:** all global-regex scans run through a helper that resets `lastIndex` and scans once up front. Statelessness regression test added.

### 3. Double entity-decoding on the Checklists render path
**Severity:** Low · **Status:** RESOLVED
**Location:** `lib/checklistsTab.ts` (decode #1) → `components/Checklists.tsx` → `components/CommentText.tsx` (decode #2)
**Description:** Not XSS (output stays escaped JSX), but twice-decoded text could render differently than written (e.g. user-typed `&amp;lt;b&amp;gt;` becoming `<b>` as text, or double-encoded URLs becoming clickable), and broke the FR-06 display==search invariant for entity-shaped content. Found independently by two lenses.
**Remediation applied:** `CommentText` gained a `decoded` prop (linkify-only path) used by the Checklists tab; the comparer's raw/encoded contract is unchanged and documented in the component. Once-decoded rendering regression test added.

### 4. Real checklist id and comment fragments in a pipeline artifact
**Severity:** Informational · **Status:** RESOLVED
**Location:** `pipeline/checklists-tab/decisions.md`
**Description:** A real eBird submission id and verbatim fragments of the user's comments were quoted in the (untracked) decisions artifact.
**Remediation applied:** redacted/paraphrased. Pipeline feature folders remain untracked by established convention.

### 5. Absolute local filesystem paths in codebase-research.md
**Severity:** Informational · **Status:** ACCEPTED
**Location:** `pipeline/checklists-tab/codebase-research.md`
**Description:** `/home/parallels/...` paths appear throughout this research artifact. The folder is untracked by established convention and never ships; no committed file contains such paths (verified). Accepted as a local working note.

### 6. Pre-existing: species-link favicons (and Macaulay embeds) are third-party asset fetches not in the privacy policy's provider list
**Severity:** Informational (pre-existing, not introduced by this feature) · **Status:** RESOLVED (user-directed, in-stage)
**Location:** `frontend/src/components/SpeciesLinks.tsx` (favicons, app-wide since v0.5.8); `components/SpeciesDetail.tsx:1400` (Macaulay `…/asset/{id}/embed` iframes)
**Description:** Favicons load from ebird.org and birdsoftheworld.org, and Species Detail embeds media from macaulaylibrary.org — browser-to-provider fetches (IP + requested item; no user data, no keys). birdsoftheworld.org and the macaulaylibrary.org embeds were not explicitly covered by `PRIVACY_POLICY.md`'s provider list.
**Remediation applied:** added an "Embedded Bird Media and Link Icons" section to `PRIVACY_POLICY.md` (effective date bumped to 2026-06-10) disclosing all three Cornell Lab properties with a link to Cornell's privacy statement, and brought the provider claims in `README.md`, `website/index.html` (privacy band), and `product-brief.md` into agreement (each now defers to the policy as the full list).

---

## Checks Performed

| Check | Result |
|---|---|
| Backend untouched — zero `backend/` changes in diff (FastAPI checklist N/A) | Pass |
| No `dangerouslySetInnerHTML`/`innerHTML` in any new/changed frontend file | Pass |
| All CSV-derived text (comments, locations, counties, protocols, meta, species names) renders as escaped JSX children | Pass |
| Anchor scheme gating: linkify emits http(s) only; CommentText re-gates `/^https?:\/\//i`; no `javascript:`/`data:` path incl. via entities | Pass |
| `SUBMISSION_ID_RE` gating on every CSV-id-derived href (DateLink), plain-text fallback, junk-id regression test | Pass |
| External-link hygiene: `target="_blank"` with `rel="noreferrer"`/`noopener noreferrer` on all new anchors | Pass |
| CSV text in HTML attributes (title/aria) — React-escaped; new components use static labels | Pass |
| ChecklistComparer swap to shared CommentText — byte-identical logic, raw/encoded contract unchanged | Pass |
| Regex exponential backtracking (ReDoS) in new patterns — alternations disjoint, no nested ambiguous quantifiers | Pass |
| Regex polynomial blowup on hostile input | Finding 1 — resolved |
| Shared mutable regex state (`lastIndex`) across calls | Finding 2 — resolved |
| Zero-width-match infinite loops in exec loops | Pass (guarded) |
| Entity decode count along render path (display == written == searched) | Finding 3 — resolved |
| New network calls/providers/endpoints | Pass — only the existing batched `/taxonomy/codes` (local resolution on desktop; user's own backend on web/Pi; no species names leave the device on desktop) |
| Comment content logging/telemetry/sendBeacon | Pass — none |
| `PRIVACY_POLICY.md` impact | Pass — no update required (nothing new fetched); pre-existing favicon note flagged (Finding 6) |
| Website changes dependency-free, mock data fictional | Pass |
| No secrets/keys/credentials in any changed file | Pass |
| Theming via `var(--sr-*)` only; every `<button>` has `tabIndex={0}` | Pass |
| Personal data in pipeline artifacts | Findings 4/5 — redacted/accepted |
| Full suite after fixes (739 tests), typecheck, lint, production build | Pass |

## Convention Flags
- `String.prototype.matchAll` (and any reuse of module-level `/g` regexes) inherits the regex's current `lastIndex` — always reset or scan via a fresh/locally-reset regex. This silently skipped matches in shipped-quality code and is easy to reintroduce.
- Pure functions that scan untrusted text with regexes should be bounded/linear by construction (precompute positions, bound lazy quantifiers) — the `NAME_TAG_RE` posture, now applied to `commentBlocks.ts`.
