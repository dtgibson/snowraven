# Security Review — idle-flake-and-doc-rot

**Date:** 2026-06-11
**Feature:** idle-flake-and-doc-rot (Improve lane — test determinism + record corrections)
**Stack:** python-fastapi backend · react-vite frontend (full stack)
**Checklist:** `security-fastapi.md` + `security-react-vite.md` (Improve-lane focus: new attack surface / changed trust boundaries in the diff)
**Outcome:** PASSED

---

## Summary

This change touches only two frontend test files and four record documents — the brief's "tests and records only, nothing ships" claim was verified mechanically, not assumed. The diff contains zero production code, zero dependency or config changes, no weakened test assertions, no sensitive data in the rewritten docs, and no new SnowRaven Mini content. Every security-relevant surface in the codebase — including all files named in CLAUDE.md's binding standing checks — has an empty diff.

---

## Findings

No security issues found in this change.

---

## Checks Performed

### 1. No-new-surface verification (the core improve-lane question)

| Check | Result |
|---|---|
| Diff confined to allowed set — `git diff --stat` shows only `CHANGELOG.md`, `DECISIONS.md`, `PRODUCT_CONTEXT.md`, `ROADMAP.md`, `frontend/src/components/BirdingStats.test.tsx`, `frontend/src/components/MediaStatsSections.test.tsx` (+ `pipeline/*` bookkeeping, out of audit scope) | Pass |
| Zero production-code changes — empty diff on `frontend/` outside the two test files, `backend/`, `src-tauri/`, `website/` | Pass |
| Zero manifest/lockfile/config changes — `git diff --name-only` grep for `package.json`, lockfiles, `*.config.*`, `tauri.conf`, `*.toml`, `*.yml`, `.env`: no hits | Pass |
| `vite.config.ts` and `test-setup.ts` untouched (the brief's rejected approaches stayed rejected) | Pass |
| No new dependencies imported by the test changes — only `afterAll` added to existing `vitest` imports | Pass |
| Untracked files are `pipeline/` bookkeeping dirs only — nothing untracked outside `pipeline/` | Pass |

### 2. Test changes strengthen determinism only

| Check | Result |
|---|---|
| Only removed lines in both test files are the two `import` lines, each re-added with `afterAll` appended — zero `expect` calls removed, zero assertions weakened | Pass |
| Additions are purely strengthening: a `waitFor` on the file-local `rafQueue` stub precondition (`BirdingStats.test.tsx:151`), a non-load-bearing `idleQueue` diagnostic expect (`:212`), and two 120 ms `afterAll` teardown waits | Pass |
| `rafQueue`/`idleQueue` are file-local stub arrays (declared `:11-12`, reset in `beforeEach :105-106`) — no global state, no shared mutable surface | Pass |
| No `test.skip` / `.only` / `xit` / `xdescribe` / `test.todo` introduced | Pass |
| No `try`/`catch` or `.catch()` added — no error swallowing | Pass |
| `afterAll(() => new Promise((r) => setTimeout(r, 120)))` is a pure delay — no network, no filesystem, no environment mutation | Pass |

### 3. Record content — leak and instruction review

| Check | Result |
|---|---|
| Added-line grep (diff excluding `pipeline/`) for API keys, tokens, secrets, bearer/`sk-`/`ghp_`/`AKIA` patterns: no hits | Pass |
| Added-line grep for absolute home paths (`/home/…`, `/Users/…`): no hits | Pass |
| Added-line grep for email addresses: no hits (not even the author's public one) | Pass |
| Added-line grep for coordinate-shaped numbers (4+ decimal places): no hits — the rewritten docs describe code, not the user's sighting data | Pass |
| No instruction-like text contradicting the binding standing checks — the rewrites *reinforce* them: the v0.5.9 anchor entry records popups as "a single state-driven `<Popup>` per map, escaped JSX", and the annotated Key Decision now states new popup code MUST use `var(--sr-*)` tokens per CLAUDE.md's color rule. Nothing tells future builders to bypass escaping or id validation | Pass |

### 4. Standing-check surfaces (CLAUDE.md "Security — standing checks") — empty diffs verified

| Check | Result |
|---|---|
| `frontend/src/lib/commentBlocks.ts` untouched | Pass |
| `frontend/src/components/CommentText.tsx` untouched | Pass |
| `weatherFormatter.ts` / `tideFormatter.ts` untouched | Pass |
| Popup code untouched — `AtlasLayer.tsx`, `MapExplorer.tsx`, `components/namedBirds/`, `components/speciesDetail/` all empty diffs | Pass |
| `PRIVACY_POLICY.md`, `docs/HELP.md`, `README.md`, `website/` untouched (no tile-provider or disclosure changes possible) | Pass |

### 5. Outside-project boundary (SnowRaven Mini)

| Check | Result |
|---|---|
| Per-file "Mini" occurrence counts identical HEAD vs working tree (DECISIONS 18/18, CHANGELOG 8/8, ROADMAP 3/3, PRODUCT_CONTEXT 8/8) | Pass |
| The only diff lines containing "Mini" are the two edited lines (DECISIONS header, ROADMAP lead-in) where the pre-existing Mini phrasing passes through byte-identical — the edits change only the flake-claim wording around it | Pass |

### 6. Stack checklists (improve-lane sweep — surfaces unchanged by this diff)

The diff touches no backend code, no auth, no API calls, no input handling, no dependencies, and no build config; each checklist area was confirmed untouched via the empty-diff proofs above rather than assumed.

| Checklist area | Result |
|---|---|
| FastAPI — Authentication & Authorization | Pass — backend untouched by this change |
| FastAPI — Injection | Pass — backend untouched |
| FastAPI — Dependencies | Pass — no dependency changes |
| FastAPI — Input Validation | Pass — backend untouched |
| FastAPI — Error Handling | Pass — backend untouched |
| FastAPI — Environment Variables | Pass — no env/credential changes; no credentials in any added line |
| FastAPI — CORS & Headers | Pass — backend untouched |
| FastAPI — Rate Limiting | Pass — backend untouched |
| React/Vite — API Keys & Secrets | Pass — no keys/secrets in any added line; `vite.config.ts` untouched |
| React/Vite — CORS & API Communication | Pass — no API-call code in the diff |
| React/Vite — Authentication State | Pass — no auth code in the diff |
| React/Vite — Input Handling | Pass — no rendering/input code in the diff; no `dangerouslySetInnerHTML` introduced |
| React/Vite — Dependencies | Pass — `package.json`/lockfile unchanged |
| React/Vite — Build Output | Pass — test files are not part of the production bundle; no build-config changes |
