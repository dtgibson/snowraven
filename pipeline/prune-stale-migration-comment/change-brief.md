# Change Brief — Prune Stale Migration Comment

## What is changing
`CLAUDE.md` line 81 currently reads: "Phase 3 target: `TauriTransport` will call external APIs
directly." Phase 3 has been complete since v0.3.2. The comment should describe current reality
(TauriTransport routes each API path to a direct TypeScript service call; WebTransport delegates
to the Python backend for Pi/web mode), not a future target.

## Why now
A full codebase audit found no dead code, no unused backend routes, no unreachable Rust commands,
and no migration-era scaffolding — the codebase is clean. This one comment is the only stale
artifact. Leaving it as "Phase 3 target" implies the migration is incomplete, which would
mislead future sessions.

## User-facing impact
None. CLAUDE.md is a developer-facing convention file, not user-visible.

## Decisions touched
Touches the transport seam description under "Desktop app seams" — clarifies completion, does not
reverse or modify any decision.

## What done looks like
CLAUDE.md line 81 reads as completed fact, not future intent. The seam description remains
accurate for both Tauri and web/Pi modes.
