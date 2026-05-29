# Change Brief — privacy-and-accessibility-docs

## What is changing
Add two new documentation files at the repo root, modeled on the structure/tone of the skyjo-scorekeeper versions, adapted to SnowRaven's reality:
1. **`PRIVACY_POLICY.md`** — SnowRaven collects nothing: no analytics, telemetry, accounts, ads, or tracking, and there is no SnowRaven-operated server. Your data (eBird backup, ML export, settings, API keys) lives only on your device — or, in self-hosted Pi/web mode, on your own machine — by choice and design; you keep and control it and can delete it anytime. Honestly notes that the app makes requests directly to eBird, OpenWeather, and Nominatim (OpenStreetMap) using your own API keys to fetch the data you ask for, with no intermediary, and links to those providers' policies.
2. **`ACCESSIBILITY.md`** — describes SnowRaven's actual web/desktop accessibility features from the v0.3.28 pass: full keyboard navigation, screen-reader/ARIA support, a visible focus ring, WCAG-AA color contrast with dark mode and color-never-the-sole-indicator, and responsive layout/zoom. Feedback section pointing to developer@dtgibson.com.

## Why now
SnowRaven has a privacy story worth stating plainly (local-first, no data collection) and a real accessibility pass already shipped, but neither is documented for users. A sibling project (skyjo-scorekeeper) already has both, giving a consistent house style to follow.

## User-facing impact
None in the app. Two new root-level docs; both linked from README so they're discoverable.

## Decisions touched
None.

## Key facts (verified)
- No analytics/telemetry/accounts/tracking anywhere; no SnowRaven server (desktop talks direct via TS services; Pi/web proxies through the user's own backend).
- Third parties: eBird (`api.ebird.org`), OpenWeather (`api.openweathermap.org`), Nominatim (`nominatim.openstreetmap.org`) — all called with the user's own keys/queries.
- No `prefers-reduced-motion` handling — accessibility doc will not claim it.
- Accessibility features to document are real (keyboard nav, ARIA roles/states, `:focus-visible` ring, AA contrast incl. the tier-1 badge fix, `.sr-only` labels, dark mode), per the v0.3.28 accessibility pass in PRODUCT_CONTEXT.
- Effective date: 2026-05-29. Contact: developer@dtgibson.com.

## Reference
Model files: `dtgibson/skyjo-scorekeeper` → `PRIVACY_POLICY.md`, `ACCESSIBILITY.md` (uppercase names; match that convention).

## What done looks like
- `PRIVACY_POLICY.md` and `ACCESSIBILITY.md` exist at the repo root, accurate and in the skyjo house style, adapted to SnowRaven.
- Both linked from README.
- No app code or behavior changes.
