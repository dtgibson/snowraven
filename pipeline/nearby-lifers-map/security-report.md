# Security Review — Nearby Lifers Map

**Date:** 2026-06-14
**Feature:** nearby-lifers-map
**Stack:** python-fastapi (backend) + react-vite (frontend)
**Checklists:** reference/checklists/security-fastapi.md, reference/checklists/security-react-vite.md
**Outcome:** PASSED

---

## Summary

Two independent passes (backend + frontend) reviewed the change against the FastAPI and React-Vite checklists. No Critical or High findings; nothing blocks release. One Low finding (missing coordinate/distance bounds on the route this feature now relies on) was **fixed in-stage**. The remaining items are Informational and pre-existing. SnowRaven is local-first with no accounts, no auth, and no database, so the auth/DB checklist sections are not applicable — data flows browser/app → backend → eBird using the user's own API key, and the response carries only public eBird observation data.

---

## Findings

### Missing lat/lng/dist bounds on /map/recent-obs
**Severity:** Low
**Location:** backend/routers/map.py (get_recent_obs)
**Description:** Deleting `/stats/nemesis` removed the only map-data route that enforced explicit coordinate/distance bounds (lat −90..90, lng −180..180, dist 1..200). Since this feature makes `/map/recent-obs` its data source, the route should validate the same ranges rather than forward absurd values to eBird. No injection/SSRF (params are sent as a structured httpx dict, never interpolated); impact was limited to a wasted round-trip on the user's own rate-limited key.
**Remediation:** Added `Query(..., ge/le)` bounds to `get_recent_obs` (lat −90..90, lng −180..180, dist 1..200), matching the deleted route. Out-of-range input now returns 422 before any eBird call. Covered by three new tests; live-verified (`lat=999` → 422).
**Status:** Resolved

### /map/hotspots also lacks coordinate/distance bounds
**Severity:** Informational
**Location:** backend/routers/map.py (get_hotspots)
**Description:** The same missing-bounds pattern exists on `/map/hotspots`, which powers the existing Hotspots mode (not part of this feature). Pre-existing; left unchanged to respect this feature's scope.
**Remediation:** Optional future Improve-lane task: apply the same `Query` bounds to `get_hotspots`.
**Status:** Accepted (pre-existing, out of scope)

### eBird speciesCode interpolated into favicon hrefs without a shape guard
**Severity:** Informational
**Location:** frontend/src/components/SpeciesLinks.tsx (via BirdName in the popup)
**Description:** `SpeciesLinks` interpolates the eBird taxon code into ebird.org / birdsoftheworld.org hrefs with no shape validation. The code is a controlled eBird taxonomy token (e.g. `amerob`), fixed-prefixed into an https URL — no scheme-injection risk. Identical to every existing tab; not introduced or changed by this feature.
**Remediation:** None required. Optional later app-wide hardening: a lowercase-alphanumeric guard on `speciesCode`, mirroring `SUBMISSION_ID_RE` / `LOCATION_ID_RE`.
**Status:** Accepted (pre-existing)

### Error detail surfaced to the UI (graceful, bounded)
**Severity:** Informational
**Location:** frontend/src/components/MapExplorer.tsx (handleFindLifers)
**Description:** Errors show a fixed message on 401 or a controlled detail/message string with a generic fallback — no raw body or stack rendered, mirroring the existing sightings/hotspots handlers. Recorded only to note error handling was reviewed and is appropriate.
**Status:** Accepted

---

## Checks Performed

### Backend (FastAPI)
| Check | Result |
|---|---|
| Auth/Authz (JWT/API-key/expiry/roles) | N/A — no accounts or auth (local-first) |
| Injection — eval/exec/subprocess/os.system | Pass |
| Injection/SSRF — outbound eBird URL & params (lat/lng/dist/codes) | Pass — hardcoded base, structured httpx params, no interpolation |
| Injection — DB queries / file paths | N/A — no DB, no user file paths |
| Input validation — lat/lng/dist bounds | Pass (fixed this stage) |
| Input validation — `codes` (optional, in-memory filter only) | Pass |
| Error handling — generic 500 / no stack traces | Pass |
| Error handling — eBird/HTTP errors mapped to 502 | Pass |
| Secrets — eBird key from env, none committed | Pass |
| CORS / headers | Pass |
| Rate limiting / external-call abuse (empty-codes all-species) | Pass — user's own rate-limited key |
| Trust boundary vs the removed /stats/nemesis | Pass — same endpoint, no new exposure |
| Dual-transport parity (Tauri mapService) | Pass |

### Frontend (React-Vite)
| Check | Result |
|---|---|
| API keys/secrets in source; VITE_ usage | Pass — none added |
| API calls via the transport seam (no raw third-party fetch) | Pass |
| API errors handled gracefully (no raw dumps) | Pass |
| Auth state / token storage | N/A — no auth |
| Input handling — `dangerouslySetInnerHTML` with unsanitized input | Pass — NearbyLiferMarkers renders the chip label and popup as escaped JSX text (no dangerouslySetInnerHTML) |
| Input handling — URLs from external data validated before href | Pass — checklist id via ChecklistLink (`SUBMISSION_ID_RE`); no `javascript:` URLs; comName/locName escaped |
| New client-side third-party calls | Pass — none |
| Dependencies — none added | Pass |
| Build output — no source maps / sensitive logs / debug paths added | Pass |

*Reviewer note:* the automated frontend pass returned a thin checklist table; the key frontend items (no `dangerouslySetInnerHTML`, escaped JSX for eBird text, `ChecklistLink` id validation, no new third-party calls) were independently re-verified against `NearbyLiferMarkers.tsx` and confirmed.

---

## Privacy

No new data providers, endpoints, telemetry, or analytics. The feature reuses the eBird `/data/obs/geo/recent` endpoint already in the app (via `/map/recent-obs`). No change to data sent off-device. **`PRIVACY_POLICY.md` needs no update.**
