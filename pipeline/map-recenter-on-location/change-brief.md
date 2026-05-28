# Change Brief — Map Recenter on Location Detection

## What is changing
After `handleUseMyLocation` successfully detects a location, two things should happen
automatically: (1) the map pans to the detected coordinates, and (2) a pin is placed at
that location so the user can see exactly where was detected.

Currently, `handleUseMyLocation` calls `setLat`/`setLng` to populate the coordinate fields
but never triggers a map pan or places any marker. The `MapPanner` component inside
`MapContainer` already handles panning via a `panTarget` state — the fix is to call
`setPanTarget({ lat: loc.lat, lng: loc.lng })` after setting coordinates. A new
`LocationPin` component (using Leaflet `Marker` or `CircleMarker`, matching existing
patterns in the file) will render only when a detected location exists. It is dismissed
when the user runs a search, clears coordinates, or pans manually.

No new design decisions. The pin uses the same `var(--sr-accent)` color token and marker
patterns already present in the file.

## Why now
User discovered the map doesn't move or indicate detected position after location detection,
making the feature feel incomplete.

## User-facing impact
Map pans to detected location and shows a pin there. No new controls, flows, or persistent
data — the pin is ephemeral UI state tied to the detected coordinates.

## Decisions touched
None.

## What done looks like
- Click "Use my location" in the Maps tab
- Location is detected (OS prompt fires, permission granted)
- Map pans to detected coordinates automatically
- A pin appears at the detected location
- Running a hotspot/sightings search or clearing coordinates dismisses the pin
