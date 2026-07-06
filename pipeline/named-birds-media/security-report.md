# Security Report — Named Birds Media (v0.5.66)

**Date:** 2026-07-05 · **Stack:** react-vite frontend (+ Tauri desktop, iOS) · **Outcome:** PASSED (no Critical/High)

## Scope
A new media section on the Named Birds tab that (a) matches a named bird's Macaulay
Library assets by parsing `[name:…]` tags from each asset's own comment in the
locally-loaded ML export, and (b) renders those assets as inline
`macaulaylibrary.org/asset/<id>/embed` iframes. Reviewed via a dedicated security
lens plus a privacy lens, each finding independently re-verified.

## Injection / XSS — CLEAN
- **Catalog id is shape-guarded and encoded before it can reach a URL.** The ML
  `catalogId` must pass a numeric guard (`/^\d+$/`) before it is interpolated into
  the iframe `src` or any link, and it is `encodeURIComponent`-wrapped (via the
  shared `mlAssetUrl`). A crafted/hostile catalog id from a malicious ML CSV cannot
  produce a `javascript:`, protocol-relative, or path-traversal src — a non-numeric
  id renders the plain fallback, never an embed.
- **Checklist ids** go through the shared `ChecklistLink` `^S\d+$` guard.
- **No `dangerouslySetInnerHTML`** anywhere in the new code. No raw asset
  caption/notes text is rendered as HTML — the section renders its own labels
  (date, format, checklist link); the bird name in the iframe `title`/`aria` is a
  React-escaped child, never interpolated into an `href`/`src`.

## Privacy — DISCLOSED and accurate
- This is the first **inline** third-party media fetch on the Named Birds tab
  (device → `macaulaylibrary.org`, exposing the user's IP + which asset is viewed).
  It extends the already-disclosed Species Detail embed pattern to a second tab.
- `PRIVACY_POLICY.md`'s "Embedded Bird Media" disclosure was extended to name the
  Named Birds tab, and the **effective date was advanced to July 5, 2026** to honor
  the policy's own "Changes to This Policy" clause (this was a review finding, now
  fixed). The disclosure is accurate and complete (host named, IP + specific-asset
  exposure stated), consistent with the Species Detail bullet.
- **No new data collection**, analytics, telemetry, backend route, account, or
  persistent storage is introduced — matching runs on the already-loaded local ML
  export; the only new network egress is the embed iframe, loaded **on demand**
  (only when a named bird is expanded and the item scrolls into view).

## Platform (CSP / webview)
- Verified no CSP/capability change is needed: `tauri.conf.json` `app.security.csp`
  is `null`, no desktop/mobile capability restricts webview navigation, and iOS
  (`tauri.ios.conf.json` + `Info.ios.plist`) has no ATS exception blocking the HTTPS
  `macaulaylibrary.org` origin. Confirmed for macOS, Windows, and iOS/iPadOS; the
  existing Species Detail embed is the working precedent.

## Findings
No Critical or High findings. The one privacy-lens finding (stale effective date on
the edited published policy — Low) was fixed and re-verified. Deployment is not
blocked.
