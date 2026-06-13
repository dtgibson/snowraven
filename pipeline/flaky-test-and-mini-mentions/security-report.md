# Security Review — flaky-test-and-mini-mentions

**Date:** 2026-06-10
**Feature:** flaky-test-and-mini-mentions (Improve lane, v0.5.29)
**Stack:** react-vite frontend / python-fastapi backend (backend untouched this change)
**Scope:** Working-tree `git diff` plus new untracked `frontend/src/test-setup.ts`; pipeline bookkeeping files excluded
**Outcome:** PASSED

---

## Summary

Reviewed the two-part change: (A) test-infrastructure shims fixing the flaky
`BirdingStats.test.tsx` suite failures, and (B) three informational mentions of
the SnowRaven Mini browser extension plus 0.5.29 version chores. The change adds
no new attack surface, changes no trust boundary, adds no dependencies, makes no
new network requests, and leaves every standing security check untouched. No
findings at any severity.

---

## Findings

No security issues found in this change.

---

## Checks Performed

### 1. New external link in App.tsx (the Weather-tab mention)

| Check | Result |
|---|---|
| Href is a static hardcoded string literal — no user/API data interpolation (`App.tsx:898`) | Pass |
| `target="_blank"` paired with `rel="noreferrer"` (blocks tabnabbing via `window.opener`; suppresses the Referer header; `noreferrer` implies `noopener`) | Pass |
| Plain text anchor — no favicon, no image, no fetch; zero network activity until the user clicks | Pass |
| Rendered as JSX (auto-escaped React children), not `dangerouslySetInnerHTML` | Pass |
| Styling via CSS token (`var(--sr-text-footer)`) and `inherit` only — no hardcoded colors | Pass |
| `PRIVACY_POLICY.md` correctly unchanged (empty diff — a plain href adds no provider) | Pass |

### 2. Test-infrastructure shims (test-setup.ts + vite.config.ts)

| Check | Result |
|---|---|
| Shims fill only **undefined** globals — both guarded by `typeof globalThis.X === 'undefined'`; jsdom-env files keep their native rAF/cAF, and `vi.stubGlobal` overrides still win during stubbed tests | Pass |
| No monkey-patching of existing implementations, no wrapping, no behavior changes where globals exist | Pass |
| No global error swallowing — no try/catch, no `process.on('unhandledRejection'/...)` handlers, no `dangerouslyIgnoreUnhandledErrors` vitest option anywhere in the diff | Pass |
| Cannot mask real failures: the shim adds a baseline capability that all real browser targets have natively; it does not alter assertions, suppress errors, or change test outcomes (QA's 18-run negative control confirms the shim is the fix, not a mask) | Pass |
| `vite.config.ts` addition is strictly under the `test` key (vitest-only; Vite's build pipeline ignores it) — not `plugins`, not `build`; the only other line is a type-only `/// <reference types="vitest/config" />` directive with no runtime effect | Pass |
| Production build unaffected — `test-setup.ts` is never imported by application code, only loaded by the vitest runner via `setupFiles` | Pass |

### 3. Documentation content (HELP.md, README.md, website)

| Check | Result |
|---|---|
| New HELP.md section is plain markdown — prose plus one `[text](url)` link; no raw HTML, no script, no images | Pass |
| HelpDocs.tsx renders markdown links as escaped JSX `<a target="_blank" rel="noreferrer">` (`HelpDocs.tsx:61`) — href and label go through React props/children, never innerHTML | Pass |
| Renderer's parsing regex is function-local (fresh instance per call, `HelpDocs.tsx:34`) — no shared-`lastIndex` hazard from the new content | Pass |
| README addition is one plain-markdown paragraph with one link | Pass |
| Website diff is exactly two version-string hunks (pill `index.html:48`, footer `index.html:502`) — no new third-party requests; the site stays dependency-free | Pass |

### 4. Standing checks (CLAUDE.md "Security — standing checks")

| Check | Result |
|---|---|
| `frontend/src/lib/commentBlocks.ts` — empty diff | Pass |
| `frontend/src/components/CommentText.tsx` — empty diff | Pass |
| All weather/tide formatters — empty diffs (no formatter files in the changed set; backend untouched entirely) | Pass |
| `frontend/src/components/BirdingStats.test.tsx` — empty diff (stubs and assertions untouched, per the brief) | Pass |
| No new module-level `/g` regexes anywhere in the diff; no `new RegExp`, `matchAll`, `innerHTML`, `dangerouslySetInnerHTML`, or `eval` additions | Pass |
| No new dependencies: `frontend/package.json` diff is the version line only; `package-lock.json` and `src-tauri/Cargo.toml` unchanged | Pass |
| Map popups / atlas JSX posture — untouched by this diff | Pass |

### 5. Supply chain — the SnowRaven Mini repository URL

| Check | Result |
|---|---|
| URL byte-identical in all shipped locations — `App.tsx:898`, `README.md:23`, `CHANGELOG.md:8`, `docs/HELP.md:96` (href and visible link text): `https://github.com/dtgibson/snowraven-mini` | Pass |
| Owner spelling verified character-by-character: `dtgibson` — matches the existing, already-shipped `dtgibson/snowraven` repo links in App.tsx and README.md, the repo URL in `pipeline.config.json`, and the author's own domain | Pass |
| Pure-ASCII check on every URL — no homoglyph/Unicode substitution characters in any link in the diff | Pass |
| No extension-store or third-party landing links added (per the brief: GitHub repo only) | Pass |

### 6. Version chores

| Check | Result |
|---|---|
| `frontend/package.json` and `src-tauri/tauri.conf.json` both at 0.5.29 (matched pair per CLAUDE.md) | Pass |
| CHANGELOG entry content accurate; its link uses the same verified URL | Pass |

---

## Verdict

**PASSED.** All 25 checks green. No findings. The change is safe to proceed
to deployment.
