# Change Brief — weather-info-copy

## What
Update the Weather tab's helper text (the `<p>` under the lookup button in
`frontend/src/App.tsx`).

- **Before:** "Tide information is also shown below if available."
- **After:** "Weather information is automatically copied to the clipboard on a
  successful lookup. Tidal information will also be shown below if available."

## Why
The auto-copy behavior wasn't discoverable from the UI; the helper text now sets that
expectation, and the tide line is reworded for clarity.

## Decisions
- Finalized "on a successful lookup" (precise: the clipboard copy only fires on a
  successful lookup, not on an invalid/failed ID).
- Grammar fix from the requested "will also shown" → "will also be shown".

## Scope / feature-check
Copy-only. No new behavior, surface, or data. Stays in the Improve lane.

## Files
- `frontend/src/App.tsx` — one `<p>` of helper text.
