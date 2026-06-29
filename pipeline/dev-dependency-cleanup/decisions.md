# Decisions — Dev Dependency Cleanup

## No version bump for a dev-only change (2026-06-29)
**Decision:** Commit the `undici` lock-file patch to `main` with no version bump,
no changelog entry, no tag, and no release.
**Rationale:** The change is dev/test-tooling only (`undici` under `jsdom`), so the
app bundle is byte-identical; a 0.5.48 tag would also supersede the still-pending
v0.5.47 binary release and re-trigger CI for nothing. User confirmed at the deploy
gate (chose "Push, no version bump").
**Promoted to:** CLAUDE.md → Versioning (the dev-only carve-out) and DECISIONS.md.

## Fix path: `npm audit fix`, not a jsdom major bump (2026-06-29)
**Decision:** Use the non-breaking `npm audit fix` (no `--force`) — it bumps the
transitive `undici` 7.27.1 → 7.28.0 within `jsdom`'s allowed range, touching only
`frontend/package-lock.json`. `jsdom` stays at `^29.1.1`.
**Rationale:** A non-force fix exists (the audit confirmed it), so there's no need
to force a `jsdom` major and risk the test environment. Smallest, safest change.
