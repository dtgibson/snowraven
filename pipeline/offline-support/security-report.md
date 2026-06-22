# Security Review — Offline Support

**Date:** 2026-06-21
**Feature:** offline-support
**Stack:** python-fastapi (backend) + react-vite-tailwind (frontend)
**Checklists:** `security-fastapi.md`, `security-react-vite.md`, plus this project's standing security rules (CLAUDE.md → Security — standing checks)
**Outcome:** PASSED

---

## Summary

The offline-support feature was reviewed against the FastAPI and React/Vite checklists and the project's own standing security rules. The attack surface is narrow and well-defended: the new generic `/settings/{key}` backend route shape-validates the key before it ever touches a path, every region file path is guarded by a strict id check at the storage seam, and the only externally-interpolated value (the region id in a download URL) is both shape-validated and `encodeURIComponent`-wrapped. No injection, traversal, XSS, secret-exposure, or unintended-egress issue was found. **No Critical, High, Medium, or Low findings.** One Informational item: the feature adds a new, user-initiated, off-by-default network egress (region downloads to GitHub), which is correct and fully disclosed in the privacy policy.

---

## Findings

### New region-download egress is opt-in and disclosed

**Severity:** Informational
**Location:** `frontend/src/lib/regionDownload.ts` (`downloadRegion`), `frontend/src/assets/regions-catalog.json` (baseUrl → GitHub Releases), `PRIVACY_POLICY.md`
**Description:** Region downloads introduce the feature's only new network egress: the device fetches a `.pmtiles` file from GitHub, exposing the user's IP and which region they downloaded to GitHub at that moment. This is inherent to the feature and is not a vulnerability.
**Remediation:** No fix required. It is correctly gated (off by default, user-initiated, never automatic — FR-11a), the URL host is enumerated in the privacy policy's Map Tiles section, and the egress + local-storage behavior is disclosed in the new "Offline maps" privacy section (FR-43/44). Verified the host-diff between `lib/mapStyle.ts`/catalog and the policy is empty.
**Status:** Accepted (intended, disclosed behavior)

---

## Checks Performed

### FastAPI — `/settings/{key}` store, taxonomy, version

| Check | Result |
|---|---|
| No injection — key shape-validated (`_KEY_RE` `[A-Za-z0-9._-]{1,128}`) before path use; blocks `..`/`/` traversal into CSVs / api-keys.json / settings.json | Pass |
| Reserved-key guard (`keys`/`files`/`map-defaults` → 404) — generic store can't shadow typed handlers; route registered last in `main.py` | Pass |
| Request body validated as JSON; oversized payload rejected (16 MB cap → 413) | Pass |
| No `eval`/`exec`/`subprocess`/`os.system` on user input; no SQL (no DB) | Pass |
| Error handling — generic 422/500, no stack traces or internal detail leaked to clients | Pass |
| No new secrets; `.env` and `data/` are gitignored (verified, not assumed) | Pass |
| No new auth surface — local single-user app; the route is local file I/O on the user's own device | Pass (N/A auth) |
| No new compute-heavy / external endpoint introduced needing rate limiting | Pass (N/A) |

### React/Vite — region download, map protocol, offline UI

| Check | Result |
|---|---|
| No API keys/tokens/secrets in new source files | Pass |
| Region id shape-validated (`REGION_ID_RE` `^[a-z]{2}(-[a-z0-9-]{1,40})?$`) AND `encodeURIComponent`-wrapped before interpolation into the download fetch URL (NFR-12/QA-39) | Pass |
| Region file paths guarded by `assertRegionId` at the storage seam — every write/rename/read/remove validates the id, defending traversal in depth | Pass |
| `srpm://` protocol loader parses a strict anchored regex; the id is decoded then passed only to the id-guarded `readRegionBytes`; no eval/injection | Pass |
| No `dangerouslySetInnerHTML` / `innerHTML` / `eval` / `new Function` in new code; region/county names render as auto-escaped React text | Pass |
| No `javascript:` URL risk — no user-controlled value reaches an `href`/`src`; catalog `baseUrl` is bundled/trusted | Pass |
| No `localStorage`/`sessionStorage` for relaunch-critical state — all through the storage seam (NFR-06) | Pass |
| No `console.log`/debug statements left in new code | Pass |
| New dependency `pmtiles@^4.4.0` — the official Protomaps library, widely used, no known critical advisories | Pass |
| Error responses handled gracefully — the three-state offline/no-key/server-error messaging never dumps raw error detail as a broken control | Pass |

### Project standing checks (CLAUDE.md)

| Check | Result |
|---|---|
| Ids from data shape-validated before becoming a path/URL (region id, settings key) | Pass |
| Regex hygiene — no global-`/g` `lastIndex` reuse hazard; `SRPM_TILE_RE` / `_KEY_RE` / `REGION_ID_RE` are anchored, bounded, linear | Pass |
| Map popups / rendered external text remain escaped JSX (no new `dangerouslySetInnerHTML` on the maps) | Pass |
| Privacy-first promise held — no analytics/telemetry/account/always-on third-party added; website stays third-party-free; new egress disclosed (NFR-13/14) | Pass |

---

## Convention Flags

(None — the id-shape-validation-before-path/URL pattern this feature follows is already a standing rule in CLAUDE.md.)
