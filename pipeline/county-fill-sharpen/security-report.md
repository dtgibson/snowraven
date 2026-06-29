# Security Review — county-fill-sharpen

**Date:** 2026-06-29
**Feature:** county-fill-sharpen (Improve lane)
**Stack:** frontend react-vite-tailwind / backend python-fastapi
**Checklist:** react-vite (client) — scoped to the actual change surface
**Outcome:** PASSED

## Summary
This change regenerates a bundled, public-domain data asset (US Census county
geometry) at a higher simplification fidelity, plus a release-time build-script
comment/value, a version bump, and changelog/site copy. It introduces no new attack
surface, no new trust boundary, no new runtime dependency, and no new network call.
Clean pass.

## Findings
No security issues found in this change.

## Checks Performed
| Check | Result |
|---|---|
| New attack surface / trust boundary | Pass — none; data-only + docs |
| Untrusted input / injection | Pass — geometry is numeric coords + (geoid,name,stusps,statefp) strings from a trusted federal source; county name renders through escaped JSX in the CountyLayer popup |
| Data provenance / integrity | Pass — US Census Cartographic Boundary Files (public domain); the build script's hard guards validate feature count (>=3000), 5-digit geoid, coordinate range, and the gz budget |
| New network calls / third-party hosts | Pass — none; the asset is bundled and fetched from the app's own origin on demand; no PRIVACY_POLICY change |
| New / updated dependencies | Pass — mapshaper@0.6.102 is a pinned, release-time-only dev tool invoked via npx; NOT a shipped dependency, does not enter the app bundle |
| Secrets / credentials | Pass — none touched; no .env or key handling |
| Security controls weakened | Pass — no runtime code changed |

## Convention Flags
None.
