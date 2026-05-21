# Strategic Brief — Species Detail Visualizations

## What We're Building

Two new visualizations in the Species Detail tab: a time-series graph showing how many individuals of a selected species you've reported over time (with overlay lines for photos, audio, and video uploads), and a heatmap toggle on the existing sighting map that shows where you've most frequently encountered that species.

## Why Now

The Species Detail tab already has the raw data to power both of these — `ObservationEntry[]` records contain dates and counts, and every sighting has lat/lng coordinates. The visualizations are a natural next layer: they reveal patterns across time and space that the current summary cards and tables don't surface. For a birder who has been recording for years, seeing a population trend or a concentration area is genuinely useful — not decorative.

## The User Problem

When a birder selects a species in Species Detail, they can see their first and last sighting, their personal best count, and a map of individual sighting locations — but there's no way to see how their encounter rate has changed over the years, or where sightings tend to cluster spatially. A decade of observations looks the same as a single year at the summary level. The graph and heatmap make time and geography legible at a glance.

## Success Criteria

- A birder can open Species Detail for any species and immediately see a trend line of their sightings over time, with no extra steps
- The photo, audio, and video overlay lines appear automatically when an ML export is loaded; they're absent (not broken) when it isn't
- The user can switch between per-period and cumulative (running total) views without leaving the tab
- Toggling the heatmap on the existing map feels instant and doesn't displace the existing pin-based view — it's an overlay, not a replacement
- Both visualizations respond correctly to the county and date-range filters already in the tab

## Scope

- **Time-series graph:** Line chart with a time (x) axis and individual count (y) axis; one primary line for total individuals per time period; up to three overlay lines for photo/audio/video (only when ML export is loaded); a toggle between **per-period** and **cumulative (running total)** views; time period granularity TBD by The Planner (per-year likely; per-month as an option if feasible)
- **Heatmap toggle:** A button near the map that switches between the current pin view and a heatmap overlay; heatmap weights each lat/lng point by observation count; the toggle state resets when a new species is selected
- Both features work entirely client-side — no new backend endpoints
- Both features respect the active county and date filters

## Out of Scope

- Comparing two species on the same graph
- Exporting the graph as an image
- Heatmap configuration controls (radius, blur, intensity sliders)
- Any heatmap feature on tabs other than Species Detail

## Key Decisions

- The time-series graph requires a charting library — no SVG chart code exists in the project; The Planner should select one (Recharts is the most common React-compatible option; a lightweight native SVG approach is an alternative if the graph stays simple)
- The heatmap requires a Leaflet heatmap plugin — Leaflet.heat is the standard option; The Architect should confirm react-leaflet v5 compatibility before finalizing
- Both visualizations are additions to the existing Species Detail layout, not replacements; their position in the page flow is a design decision for The Planner and Designer
- Overlay lines on the graph should degrade gracefully: if ML export is absent, the graph still works with eBird data alone; missing individual lines are simply not rendered (no error state)
- Per-period and cumulative are two views of the same underlying data — the toggle switches the rendering mode, not the data source
