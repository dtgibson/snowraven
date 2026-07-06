# Security Report — Sex Terminology (v0.5.65)

**Date:** 2026-07-05 · **Stack:** react-vite frontend · **Outcome:** PASSED (proportional — no security surface)

## Summary
This change is a display-only terminology swap of four static UI strings
("Gender" → "Sex") plus doc/record wording and a version bump. It introduces
**no new attack surface**: no new data, network, providers, input handling,
rendering path, `dangerouslySetInnerHTML`, href construction, or dependency.
The strings are static literals; nothing user- or API-supplied is rendered
differently. No secrets. `PRIVACY_POLICY.md` / `ACCESSIBILITY.md` unaffected.

Proportional-security pass (per the Studio rule: a change with no security
surface — copy/labels/static strings — yields no findings). No findings.
