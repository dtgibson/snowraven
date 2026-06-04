# Security Review — Standardized Bird-Name Format

**Date:** 2026-06-04 · **Lane:** New Feature
**Stack:** react-vite-tailwind frontend (no backend changes)
**Outcome:** PASSED (no findings)

## Summary
A shared presentational component (`BirdName`) + cross-tab navigation state.
No backend, no new runtime dependencies (jsdom is dev-only), no secrets, no new
network calls, no data collection. Species/taxon data is the user's own,
resolved via the existing `/taxonomy/codes` endpoint already in use.

## Checks
| Check | Result |
|---|---|
| Markup injection (BirdName) | Pass — renders `commonName`/`scientificName` as React text children (auto-escaped); no `dangerouslySetInnerHTML`. URLs in SpeciesLinks are `encodeURIComponent`-free but built from eBird taxon codes (server-resolved `/^[a-z0-9]+$/`-style codes), not user free-text |
| Map popup names | Pass — the React `<Popup>` species name now renders via `<BirdName>` (escaped). The on-map divIcon label remains an HTML string but still uses the existing `escHtml(pin.comName)` (unchanged) |
| Cross-tab navigation | Pass — `requestedSpecies` is a plain string used only to match against the user's own species list; no eval, no routing injection |
| New dependencies | Pass — only `jsdom` (devDependency, test env); no runtime deps added |
| Network / backend surface | Pass — Stats now resolves taxon codes for all observed species via the EXISTING `/taxonomy/codes` (one batched, cached call); no new endpoints |
| Data collection / privacy | Pass — all data is the user's local backup/ML; nothing transmitted beyond the existing taxonomy lookup; PRIVACY_POLICY.md unaffected |
| External links | Pass — eBird/BoW/ML/checklist links unchanged (`target="_blank" rel="noreferrer"`) |
| A11y of interactive name | Pass — name link is a `<button tabIndex={0}>`; favicons are sibling anchors (no nested interactive elements) |

## Notes
- The `BirdName` link is a `<button>` (in-app nav), favicons are separate
  `<a>` siblings — no invalid interactive nesting.
- Taxon codes come from the server taxonomy and are interpolated into eBird/BoW
  URLs; they are controlled identifiers, not user free-text — no URL-injection
  surface beyond what already shipped in SpeciesLinks.
