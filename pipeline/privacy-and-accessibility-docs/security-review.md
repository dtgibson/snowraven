# Security Review — privacy-and-accessibility-docs

**Date:** 2026-05-29
**Scope:** Documentation-only change (PRIVACY_POLICY.md, ACCESSIBILITY.md, README.md)
**Outcome:** PASSED (no findings)

## Summary
No code, dependencies, build config, secrets, or runtime behavior changed — no attack surface. For a published privacy policy the relevant risk is *accuracy*: a policy that overstates "we collect nothing" while the app quietly does otherwise is a real liability. I checked the claims against the code and they hold.

## Privacy-claim verification
- **"No analytics/telemetry/accounts/tracking"** — verified: no such references in frontend or backend; no SnowRaven-operated server exists (desktop calls providers directly via TS services; Pi/web proxies through the user's own backend).
- **"Data stays on your device"** — consistent with the storage seam (`AppLocalData` on desktop; user's own host for web/Pi). No developer-side collection path exists.
- **Third-party calls disclosed, not hidden** — the policy explicitly names eBird, OpenWeather, and Nominatim and that requests use the user's own keys. This is the honest, defensible framing (it does not claim "nothing ever leaves the device," which would be false).

## Findings
No security issues found.

## Checks Performed
| Check | Result |
|---|---|
| No code/build/dependency changes | Pass — three markdown files only |
| No secrets in new text | Pass — no keys/tokens; contact email is intentional and public |
| Privacy claims match actual behavior | Pass — verified against code (no collection; third parties disclosed) |
| No instruction encouraging insecure action | Pass |
| External links benign | Pass — provider policy pages + mailto |

## Convention Flags
- None.
