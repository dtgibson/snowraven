# Change Brief — copy-and-placeholder-cleanup

## What is changing

Three targeted copy and placeholder updates:

1. **Weather tab OpenWeather warning** (`frontend/src/App.tsx:378`): The warning "OpenWeather API key not configured — weather lookups won't return conditions." gains a second line clarifying that the Weather tab can be disabled or moved in Settings, for users who don't want weather features at all.

2. **README install heading** (`README.md:267`): The section `## Local installation (Mac/Linux)` becomes `## Local installation (Linux)`. Mac users should download the desktop binary, not run the server stack locally — the heading was causing confusion.

3. **Settings default location placeholders** (`frontend/src/components/Settings.tsx`):
   - Latitude: `e.g. 37.8716` → `e.g. 37.8275`
   - Longitude: `e.g. -122.2727` → `e.g. -122.4238`
   - Radius: `25` → `5`
   (New coordinates: Point Reyes National Seashore, a well-known birding destination.)

## Why now

User-reported: the OpenWeather warning leaves users with no OpenWeather key confused about their options. The Mac/Linux heading is misleading Mac users toward the server install path. The placeholder coordinates are UC Berkeley — an arbitrary choice; Point Reyes is a more evocative birding landmark.

## User-facing impact

The warning on the Weather tab gains one additional sentence. The README heading loses "(Mac/Linux)". Settings placeholder text changes. No functional behavior changes.

## Decisions touched

None.

## What done looks like

- Weather tab shows the updated warning text when OpenWeather key is absent
- README section heading reads "## Local installation (Linux)"
- Settings lat/lng/radius placeholders show the new values
