# Security Review — map-center-pin (0.5.43)

**Date:** 2026-06-17
**Feature:** map-center-pin
**Stack:** react-vite frontend (python-fastapi backend — untouched by this change)
**Checklist:** security-react-vite (frontend) + privacy / data-egress review
**Outcome:** PASSED

---

## Summary

A client-side Map Explorer interaction (right-click / long-press to set the search
center, plus a draggable pin). It adds no new attack surface: no new user input is
stored or sent beyond the chosen map coordinates, which flow only into the EXISTING
`/map/hotspots` and `/map/recent-obs` calls — the same path the place-name search and
"Use my location" already use — as numeric `toFixed(5)` values. No new routes, external
calls, HTML rendering, links, dependencies, or secret handling, and no existing security
control was removed or weakened.

---

## Findings

No security issues found in this change.

---

## Checks Performed

| Check | Result |
|---|---|
| New attack surface (input, routes, external calls) | Pass — none introduced |
| `dangerouslySetInnerHTML` / `innerHTML` / `eval` / `new Function` added | Pass — none |
| New external links / `target="_blank"` / new `http(s)` URLs | Pass — none (`CenterPin` renders a static SVG; the hint is static text) |
| Dropped-coordinate flow | Pass — `applyCenter` → `setLat`/`setLng` (numeric `toFixed(5)`) → the existing find handlers / `/map` routes; no new sink |
| Existing controls preserved (id-gating, comment escaping, links) | Pass — none touched (no checklist/location/comment rendering changed) |
| Secrets / API-key handling | Pass — not touched |
| Dependency supply chain | Pass — no dependency changes this run; `package-lock.json` only got the version-field bump |
| Data egress / privacy | Pass — the chosen map coordinates go to eBird's existing `/map` endpoints (already disclosed); session-only, no new persistence, no new third-party service. `PRIVACY_POLICY.md` needs no change |
| DoS / unbounded work | Pass — the long-press timer is bounded (550 ms, single instance); no new regex or parsing of untrusted input |

---

## Notes

- The temporary `vite --host` exposure for Tailscale testing is a dev-session
  convenience — not committed and not part of the shipped change.
