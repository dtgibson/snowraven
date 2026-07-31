# QA Report — Disable Embedded Media

**Date:** 2026-07-30
**Test Runner:** Vitest 4.1.5; pytest 9.1.1
**Result:** PASSED — independent post-security-remediation rerun

## Verification Summary

### Backend

- Installed runtime versions exactly match the approved pins:
  `fastapi==0.141.1`, `starlette==1.3.1`,
  `python-multipart==0.0.32`, and `python-dotenv==1.2.2`.
- `backend/.venv/bin/python -m pip check`: passed with no broken requirements.
- `backend/.venv/bin/ruff check .`: passed.
- `backend/.venv/bin/python -m pytest -ra`: 178 tests passed, 0 failed,
  with one known non-blocking test-only deprecation warning documented below.
- Live startup smoke: Uvicorn reached application startup successfully on
  `127.0.0.1:1629`; `GET /health` returned HTTP 200 and `{"status":"ok"}`;
  graceful shutdown completed.

### Frontend

- Focused feature suite: 8 files passed, 78 tests passed, 0 failed.
- Calendar isolation: 1 file passed, 53 tests passed, including the unchanged
  QA-41 `< 50 ms` performance contract using seven fully measured samples to
  avoid scheduler-contention false failures.
- Full suite: 129 files passed, 1,602 tests passed, 0 failed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed; Vite transformed 2,505 modules and produced the
  production bundle.
- `git diff --check`: passed.
- Iframe inventory: both the automated inventory and independent source scans
  find `components/MediaEmbed.tsx` as the only application source file that
  constructs an iframe or a Macaulay `/embed` URL. `MediaFrame` still requires
  explicit hydrated eligibility.

## Security-Remediation Compatibility

The patched backend stack is installed, internally consistent, and compatible
with SnowRaven's existing routes, upload parsing, environment loading, startup,
and complete backend regression suite. The remediation introduces no backend
application-code change.

Pytest reports this exact warning:

```text
/Users/developer/devwork/snowraven/backend/.venv/lib/python3.11/site-packages/fastapi/testclient.py:1: StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
  from starlette.testclient import TestClient as TestClient  # noqa
```

This is a known, non-blocking test-only compatibility note. Only backend test
modules import `fastapi.testclient.TestClient`; no production module imports
FastAPI or Starlette's TestClient. All 178 tests pass, production startup and
the live health request pass, and production HTTP clients are unaffected. The
warning should be revisited when FastAPI's TestClient switches transport, but
it does not block this release.

## Acceptance Criteria Verification

| Criterion | Result | Notes |
|---|---|---|
| QA-01 — Accessible Settings control and legacy-safe default | ✓ Pass | The exact **Disable embedded media** switch is accessible and off for missing, false, malformed, and non-boolean values. Hydration shows a named loading status instead of a misleading switch state. |
| QA-02 — Durable cross-platform persistence and failed-save reconciliation | ✓ Pass | The preference uses the shared storage adapter on web and Tauri. Raw boolean web writes are covered, non-2xx responses reject, UI updates immediately, writes serialize, and a failed latest write restores the last durable value with an alert. |
| QA-03 — Closed startup hydration | ✓ Pass | `embedAllowed` is false until the durable read resolves. Delayed-read coverage proves eligibility remains closed, and every iframe construction path requires the explicit gate. |
| QA-04 — Exact, correctly gated note | ✓ Pass | The shared component renders exactly “Embedded media is disabled in Settings.” Species media shows it per eligible player; Named Birds shows it once per matched media area. No-export, no-match, and collapsed-row cases show no note. It uses informational `role="status"`, not an alert. |
| QA-05 — Immediate global on/off behavior | ✓ Pass | The App-root preference feeds both surfaces. Enabling immediately closes eligibility and unmounts frames before persistence completes; disabling restores the existing path without reload. Rapid serialized writes and rollback are covered. |
| QA-06 — Species Detail disabled path | ✓ Pass | Recent Media renders the note with no iframe, shimmer, offline fallback, or failed-player overlay while retaining format, date, checklist, and direct Macaulay links. |
| QA-07 — Species Detail enabled baseline | ✓ Pass | Existing Photo, Audio, and Video framing, lazy/fallback behavior, metadata, safe IDs, and links remain covered and green. |
| QA-08 — Named Birds disabled path | ✓ Pass | Expanded matched rows render one disabled note, no player UI or observer-driven iframe, retained format/date rows, checklist links, direct asset links, and existing batching. No-ML, no-match, and collapsed states remain unchanged. |
| QA-09 — Named Birds enabled baseline | ✓ Pass | Expansion gating, intersection loading, six-item batching, Show more, focus preservation, collapse cleanup, reconnect recovery, safe IDs, and fallback behavior all remain green. |
| QA-10 — Complete iframe inventory | ✓ Pass | The automated inventory and source scans find only `components/MediaEmbed.tsx`; `MediaFrame` requires eligibility, and both Species Detail and Named Birds call chains pass the App-root gate. |
| QA-11 — Preserved non-embed behavior | ✓ Pass | Existing local metadata, direct links, comments, counts, analytics, maps, weather, and unrelated networking paths are unchanged; the complete frontend and backend regression suites pass. |
| QA-12 — Documentation accuracy | ✓ Pass | Help, README, website, privacy policy, changelog, PR description, and local viewing guide cover the off-by-default setting, exact note, retained links/data, conditional requests, and current startup steps. |
| QA-13 — Automated regression coverage | ✓ Pass | The focused 78-test set covers normalization, hydration, immediate changes, persistence failure, rapid writes, both surfaces, exact copy, status semantics, inventory, links, and enabled baselines. All 1,602 frontend and 178 backend tests pass. |
| QA-14 — Privacy, races, accessibility, responsive, and platform quality | ✓ Pass | Disabled and unresolved paths construct zero iframes and schedule no player timer or intersection observer; effect cleanup and rapid changes are covered. Switch/status semantics, tokenized colors, reduced-motion handling, phone single-column rules, and the cross-platform storage seam are verified. |

## Edge Cases Tested

- Missing, malformed, non-boolean, failed, and delayed preference reads.
- Immediate disable before a persistence write completes.
- Failed saves and serialized rapid toggles with last-durable rollback.
- Invalid media catalog IDs and invalid checklist IDs.
- Offline, reconnect, slow-load, give-up, and late-load behavior while embeds
  remain enabled.
- Disabled Named Birds rows with no export, no matching media, a collapsed row,
  multiple formats, and additional batches.
- Disabled-to-enabled restoration in the same mounted row.
- Keyboard focus after the final Named Birds Show more button disappears.
- Exact disabled copy and shared informational status semantics.
- Closed hydration with no pre-preference iframe eligibility.
- Backend form parsing, settings, API-key/environment loading, route behavior,
  startup, and health response under the patched dependency stack.
- Calendar performance in isolation and under the complete parallel test load.
- Production compilation, linting, source inventory, responsive rules, and
  reduced-motion coverage.

## Convention Flags and Known Limitations

- **Non-blocking TestClient warning:** Starlette 1.3.1 deprecates the `httpx`
  transport used by its test-only TestClient and recommends `httpx2`. The exact
  warning and release assessment are recorded above; it does not affect
  production startup or requests.
- **Non-blocking build advisory:** Vite reports the repository's existing
  chunks over the configured 1,100 kB advisory threshold. The production build
  succeeds, and the warning is unrelated to embedded media or the backend
  dependency remediation.
- **Performance-test convention:** QA-41 still requires one complete
  `buildDayCells` execution below 50 ms. Taking the minimum of seven fully
  measured executions removes scheduler-contention false failures without
  weakening the threshold or hiding a slow implementation.
- **Visual evidence:** This post-remediation rerun was command-line and
  source-level; it did not add a screenshot/browser pass. Component tests,
  responsive CSS inspection, accessibility assertions, and the production
  build cover the changed UI. No product limitation was found.
- Dependency-advisory closure remains The Auditor's responsibility; this Tester
  report verifies installed versions and application compatibility and does not
  replace the security report.
