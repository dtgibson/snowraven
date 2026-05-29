## Privacy Policy + Accessibility docs

### What this does
Adds two root-level documentation files, modeled on the skyjo-scorekeeper house style and adapted to SnowRaven, plus links from README. Docs-only.

### Changes
- **PRIVACY_POLICY.md** (new) — local-first, no-collection story: no analytics/telemetry/accounts/ads, no SnowRaven server; your keys/settings/eBird backup/ML export live only on your device (or your own Pi/web host); you own and can delete your data. Honest section on the direct, key-authenticated calls to eBird, OpenWeather, and Nominatim (no SnowRaven middleman), each linking to the provider's policy. Effective date May 29, 2026; contact developer@dtgibson.com.
- **ACCESSIBILITY.md** (new) — SnowRaven's real web/desktop a11y from the v0.3.28 pass: full keyboard navigation (tablist arrows, combobox keys, dropdown), screen-reader/ARIA support, a visible green focus ring, color-never-sole-indicator + WCAG-AA contrast (incl. the 6.8:1 tier-1 badge) + dark mode, responsive/zoom, and focus management (Map Explorer mobile sidebar trap). Deliberately omits reduced-motion (not implemented). Feedback → developer@dtgibson.com.
- **README.md** — Documentation section now links both.

### Accuracy notes
- "No analytics/telemetry" verified by grep across frontend + backend (none found).
- Third-party services verified in code: api.ebird.org, api.openweathermap.org, nominatim.openstreetmap.org.
- Accessibility claims drawn from the verified v0.3.28 entry in PRODUCT_CONTEXT; no `prefers-reduced-motion` handling exists, so it is not claimed.

### How to test
Read PRIVACY_POLICY.md and ACCESSIBILITY.md at the repo root; confirm README links resolve. Frontend build clean (these root docs aren't bundled into the app).

### Notes for reviewer
No app code or behavior change. Filenames uppercase to match the skyjo convention.

## Convention Flags
- None new.
