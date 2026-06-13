# Security Review — weather-block-raincrow-parity (moon phase on night weather blocks)

**Date:** 2026-06-10
**Feature:** weather-block-raincrow-parity (Improve lane)
**Stack:** python-fastapi + react-vite-tailwind (full stack)
**Checklists:** security-fastapi.md, security-react-vite.md (Improve-lane focus: new attack surface and trust-boundary changes introduced by the diff), plus the binding CLAUDE.md "Security — standing checks"
**Outcome:** PASSED WITH NOTES

---

## Summary

Reviewed the uncommitted working-tree diff that appends a moon-phase emoji to the
weather block header on night checklists. The change is pure local arithmetic on
fields the app already fetched — no new network calls, providers, dependencies,
or parsing of untrusted text — and the emoji can only ever be one of sixteen
hardcoded characters. No security issues found; one informational note on
backend error posture, which matches pre-existing behavior.

---

## Scope

The uncommitted diff (pipeline bookkeeping excluded), 20 files:

- **Production code (4 files):** `frontend/src/lib/weatherFormatter.ts`,
  `frontend/src/lib/tauri/weatherService.ts`, `backend/formatters/weather.py`,
  `backend/routers/weather.py`
- **Tests/oracle (10 files):** additive night fixtures and the `lat`/`dt`
  plumbing in shared fixtures; `weatherFormatter.golden.py` oracle extended
- **Docs/chores (6 files):** `CHANGELOG.md`, `README.md`, `docs/HELP.md`,
  `website/index.html`, version bumps in `frontend/package.json` and
  `src-tauri/tauri.conf.json` (both 0.5.28)

---

## Findings

### Backend formatter raises on a malformed OpenWeather hour (pre-existing posture)

**Severity:** Informational
**Location:** `backend/formatters/weather.py` — `_is_night_hour()` (new), called from `format_weather()`
**Description:** `_is_night_hour` hard-indexes `dt`, `sunrise`, and `sunset` on
every sampled hour, so an OpenWeather response missing one of those keys raises
`KeyError`, surfacing as a generic 500 from `/weather/{checklist_id}`. This is
not a new class of failure — the formatter already hard-indexes `temp`,
`humidity`, `clouds`, etc. across all hours, and FastAPI returns a generic 500
with no stack trace to the client. The slight delta is that `sunrise`/`sunset`
were previously only read from the first hour and are now read from all hours.
The data source is the authenticated OpenWeather API (server-side key), not
user input. The frontend port is even safer: a missing/NaN `dt` makes the
comparisons false (treated as day, no moon, no throw).
**Remediation:** None required. If the team ever hardens the weather route
against partial API payloads, do it for all fields at once, not just the moon
path.
**Status:** Accepted (matches existing posture; surfaced for the record)

No other findings. Nothing blocks deployment.

---

## Checks Performed

Improve-lane review: every checklist area the diff could touch, plus the
CLAUDE.md standing checks, verified against the actual working-tree code.

| Check | Result |
|---|---|
| **New attack surface** — new input parsing, network calls, endpoints, or trust-boundary changes | Pass — none. Both runtimes compute the phase locally from `dt`/`sunrise`/`sunset`/`lat`, all already present in the data each caller held. `git diff` shows no new fetch/HTTP call, no new endpoint, no new URL. |
| **Output containment** — moon emoji restricted to the hardcoded sets | Pass — every return path in `moonPhaseEmoji` (TS) and `moon_phase_emoji` (Python) indexes `MOON_NORTH`/`MOON_SOUTH` (8 elements each); no external data is interpolated into the header. Day blocks verified byte-identical by golden tests. |
| **Adversarial values** — NaN/missing/extreme `dt`, `lat` | Pass — TS: NaN/undefined `dt` fails the night comparisons (day block, no moon); NaN age falls through all bins to `emojis[0]`. No throw, no loop (fixed 8-iteration scan). Python: junk `lat` would fail upstream in `get_timezone`/`fetch_historical` before reaching the formatter; missing keys raise — see Informational finding. `lat < 0` selects an array; equator uses the Northern set (tested). |
| **Standing check: `commentBlocks.ts` / `checklistsTab.ts` unchanged** | Pass — `git diff` on both files is empty, as the brief mandates. The strip's `EMOJI_RUN_RE` (`\p{Extended_Pictographic}`, line 154) already covers U+1F311–1F318, so the unspaced header stays one emoji run; new strip regressions (built via the real formatter, per house rule) pass. |
| **Standing check: module-level `/g` regex hygiene (0.5.27 post-mortem)** | Pass — no new module-level regex anywhere in the diff. The only added regex is an inline `/\n/g` literal inside a test's `.replace()` call (fresh object per evaluation, no shared `lastIndex`, test-only). The linearity perf guard in `commentBlocks.test.ts` remains and passes. |
| **Standing check: comment rendering (CommentText, escaped JSX, anchors)** | Pass — `CommentText.tsx` untouched; no new `dangerouslySetInnerHTML`; the ATTRIBUTION anchor constant is unchanged in the diff. The entity-encoded night-block strip case is covered by a new test. The moon character is plain text from a fixed set, escaped like any other comment text when rendered. |
| **Standing check: eBird id shape validation** | Pass — untouched; the route still gates on `re.fullmatch(r"S\d+", checklist_id)`. |
| **Injection (FastAPI)** — string-built queries, eval/exec/subprocess, path traversal | Pass — none in the diff; the new code is arithmetic and list indexing only. |
| **Input validation (FastAPI)** — typed params, validated bodies | Pass — no new endpoints or parameters; `format_weather` gained a `lat: float` taken from the already-fetched checklist, which the route had already passed to `get_timezone` and `fetch_historical`. |
| **Error handling (FastAPI)** — no stack traces to clients | Pass with note — generic 500 posture unchanged; see Informational finding. |
| **API keys & secrets (React/Vite + FastAPI)** | Pass — no new key usage; keys still flow through the storage seam (Tauri) and `.env` (backend); nothing hardcoded in the diff. |
| **Dependencies / supply chain** | Pass — zero diffs to `frontend/package-lock.json`, `src-tauri/Cargo.toml`, `Cargo.lock`, `backend/requirements.txt`; `package.json` changes only the version field. `lunarphase-js` was NOT added — grep over all dependency manifests finds no hit; the algorithm is a hand-ported, commented copy (provenance noted in both files, pinned to 2.0.3 with the deliberate pure-UTC deviation documented). |
| **Privacy** — new providers, outbound requests, policy accuracy | Pass — no new providers or requests in either runtime; `PRIVACY_POLICY.md` correctly untouched (the phase is computed locally). `website/index.html` diff is feature copy only — no scripts, no third-party requests added; the site stays dependency-free. |
| **Version/release chores (CLAUDE.md)** | Pass — `frontend/package.json` and `src-tauri/tauri.conf.json` both at 0.5.28; CHANGELOG, README, HELP.md, and website copy updated in the same change. |
| **Test integrity** — no loosened or deleted assertions | Pass — all test diffs are additive or plumbing-only (`dt` in fixtures, `lat` argument); one day-block assertion was strengthened (`startswith("☁️\n")`). Spot re-run: `weatherFormatter.test.ts` + `commentBlocks.test.ts` — 140/140 pass. |

---

## Verdict

**PASSED WITH NOTES.** The change introduces no new attack surface, no new
dependencies, no new outbound requests, and no change to any security control.
The one informational note matches pre-existing error-handling posture.
Deployment is not blocked.
