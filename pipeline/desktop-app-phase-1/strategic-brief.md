# Strategic Brief — Desktop App Phase 1: Weather Formatter

## What We're Building
A TypeScript implementation of SnowRaven's weather formatting function — a pure function that takes eBird checklist metadata and OpenWeather timemachine API responses as inputs and produces the same formatted text block as the Python backend. Accompanied by a golden test suite that verifies the outputs match exactly.

## Why Now
Phase 0 established the transport and storage seams — `TauriTransport` is ready to call external APIs directly as soon as the formatting layer is proven safe. Phase 1 creates that proof: the TypeScript formatter must produce byte-for-byte identical output to the Python reference before any Phase 3 migration can flip. The golden tests are the trust mechanism that makes future migrations verifiable rather than assumed.

## The User Problem
To get formatted weather for an eBird checklist today, the user must have a running Python backend. The long-term goal is eliminating that dependency for desktop users. Phase 1 is the first verifiable milestone on that path: proving the JavaScript formatter is equivalent to the Python one under identical test conditions.

## Success Criteria
- The TypeScript formatter accepts the same input shape as the Python backend: eBird checklist metadata plus an array of OpenWeather timemachine hour responses
- Formatted output matches the Python reference for all golden test cases
- Golden tests cover: all Beaufort wind scale boundaries, all 16 cardinal and intercardinal directions, multi-hour checklists with multiple weather snapshots, and at least one real production checklist
- All tests pass in vitest and CI passes green

## Scope
- Pure TypeScript formatting function in `frontend/src/lib/`
- Golden test suite in vitest
- Function signature and logic mirrors `backend/formatters/weather.py` exactly
- Tests run in the existing CI pipeline with no new dependencies

## Out of Scope
- Any UI changes
- Any Tauri-specific code or plugin integration
- Phase 2 (keychain), Phase 3 (transport migration), or any other phase
- Modifying the Python backend formatter in any way

## Key Decisions
- The TypeScript formatter is a pure function: no side effects, no API calls, no fetch
- Output must be byte-for-byte identical to Python output for the same inputs; any difference is a test failure, not a warning
- Golden test inputs are drawn from real eBird and OpenWeather response shapes captured from production
- The formatter lives in `frontend/src/lib/` alongside the existing seams, consistent with the Phase 0 architecture
