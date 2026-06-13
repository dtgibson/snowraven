# Security Review — media-sex-age-filters

**Date:** 2026-06-13
**Feature:** media-sex-age-filters (v0.5.33)
**Stack:** react-vite-tailwind frontend / python-fastapi backend
**Scope reviewed:** frontend-only diff (`mediaStats.ts`, `LifeList.tsx`, `LifeListTable.tsx`). No backend code changed.
**Outcome:** PASSED

---

## Summary

A frontend filter feature on the Multimedia tab. It adds no attack surface: the new filter logic is pure over data already parsed from the user's own Macaulay export, the filter values come from a fixed dropdown vocabulary (never free user input), and the Macaulay links keep a hardcoded `https://` scheme. Nothing new is fetched, stored, or sent. The links' base moved to `media.ebird.org/catalog` — the same Cornell Lab/eBird media search the app already links to (user-initiated navigation), so the privacy policy needs no change.

---

## Findings

No security issues found in this change.

---

## Checks Performed

| Check | Result |
|---|---|
| No new `dangerouslySetInnerHTML` introduced | Pass — none in any changed file |
| Filter values cannot carry injected input | Pass — Sex/Age come from fixed `<option>` values (Male/Female; Juvenile/Immature/Adult) cast to a union type; only those values or null reach the URL |
| ML link cannot carry an attacker-controlled scheme | Pass — base is the constant `https://media.ebird.org/catalog`; facet appended as `&age=`/`&sex=` from the lowercased fixed vocab; `taxaName` is `encodeURIComponent`-wrapped |
| New pure logic is injection-safe | Pass — `assetMatchesFacet` / `buildCatalogAgeSex` operate on already-parsed `AgeSexGroup` data; no DOM, no eval, no URL building |
| No secrets / API keys added | Pass — none |
| No new network calls, data persistence, or third-party services | Pass — reads only the already-loaded ML export; ML links are user-initiated navigations that already existed |
| Privacy policy impact (new browser→provider requests) | Pass — `media.ebird.org` is Cornell Lab/eBird, already covered by the disclosure; no new provider, no auto-fetch; `PRIVACY_POLICY.md` needs no change |
| Backend trust boundary | Pass — no backend code changed |

---

## Convention Flags
- For the Chronicler: the Multimedia tab's ML links now use `media.ebird.org/catalog` (was `search.macaulaylibrary.org/catalog`) — same media search, already within the privacy disclosure. `BirdingStats` still uses the older base; consolidating the two link builders is a possible future cleanup, not this feature.
