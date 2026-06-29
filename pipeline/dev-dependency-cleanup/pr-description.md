## Dev Dependency Cleanup — patch undici (dev-only)

### What this does
Updates `undici` from `7.27.1` to `7.28.0` in `frontend/package-lock.json` to
clear a high-severity `npm audit` advisory (7 CVEs: TLS cert-validation bypass,
Set-Cookie header injection, cache poisoning, WebSocket DoS, SameSite downgrade,
cross-origin routing, info disclosure). `undici` is a transitive dependency of
`jsdom` (the vitest jsdom test environment) — a dev-only dependency. The shipped
production bundle is unaffected (`npm audit --omit=dev` was, and remains, clean).

### How to test
- `cd frontend && npm audit` → 0 vulnerabilities
- `npm audit --omit=dev` → 0 vulnerabilities
- Full CI mirror green: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`

### Notes for reviewer
- **Lock-file-only change.** `package.json` is untouched; `jsdom` stays at `^29.1.1`.
- `npm audit fix` (no `--force`) also synced the lockfile's stale root metadata
  (`version` `0.5.44 → 0.5.47`, added the `engines` block) to match the
  already-committed `package.json`. This is the lockfile catching up to the
  current package version, **not** a new version bump.
- **No app version bump.** This dev-only change yields a byte-identical app
  bundle, and a `v0.5.47` binary release is still pending on the Mac; a 0.5.48
  tag would supersede it and re-trigger CI for zero app change.
