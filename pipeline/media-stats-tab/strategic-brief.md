# Strategic Brief — Media Card on the Statistics Tab

## What We're Building

A new Media card on the Statistics tab that consolidates all media-centric statistics in one place: the existing Most Photographed / Most Audio / Most Video rankings (moved from Other Statistics) and new portfolio-level charts showing how photo, audio, video, and total media counts have grown over time.

## Why Now

The Statistics tab is already where users go to understand their birding at a glance — lifetime totals, temporal trends, geographic patterns. Media activity belongs in the same view. The ML export data and Recharts infrastructure are already in place; this is about giving media its own card rather than leaving the top-10 lists buried at the bottom of a miscellaneous section.

## The User Problem

A birder uploading to Macaulay Library regularly has no way to see how their media catalog has grown over time, and the current "Most Photographed" lists in Other Statistics don't feel like they have a home. There's a temporal view for life list accumulation and for per-species sightings — but nothing equivalent for the media collection as a whole.

## Success Criteria

- The Statistics tab has a Media card showing photo, audio, video, and total media activity over time
- The user can view growth as a running cumulative total or as activity per period
- The interval (weekly / monthly / yearly / total) is user-controlled, defaulting to monthly
- Most Photographed, Most Audio, and Most Video rankings are part of the same Media card
- Other Statistics no longer contains those three ranking sections

## Scope

- Add a Media card to the Statistics tab with: four-line chart (Photo / Audio / Video / Total), cumulative/per-period toggle, four interval options (weekly/monthly/yearly/total, monthly default)
- Move Most Photographed / Most Audio / Most Video top-10 rankings into the Media card
- Remove those rankings from Other Statistics

## Out of Scope

- Per-species media trends over time (already in Species Detail)
- Changes to ML export parsing or data sourcing
- New tabs or changes to the tab order
- Any changes to the Media List tab

## Key Decisions

- Everything stays on the Statistics tab — a new card, not a new tab
- Charts powered by existing ML export data; no new backend endpoints needed
- Uses Recharts (already in use) and consistent graph patterns with the rest of the Statistics tab
- "Total" interval plots one cumulative step per media item uploaded, ordered chronologically — matching the life list accumulation Total mode
