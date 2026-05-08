# Strategic Brief — Checklist Confirmation Header

## What We're Building
A one-line confirmation displayed below the weather output that shows the resolved checklist ID, location name, and observation time — matching the format raincrow.app uses (e.g. `S334315671 / Berkeley Community Garden / 2026-05-07 17:26`).

## Why Now
The weather lookup already returns the right data from the eBird API — checklist ID, location name, date, and time are all present in the backend response. This surfaces that information visibly, giving users a quick way to confirm the lookup resolved to the right checklist before they copy and paste the output.

## The User Problem
When a user pastes a checklist ID and gets weather back, there's no visible confirmation of which checklist was resolved or what location and time were used. If the eBird API resolved to an unexpected location (e.g. a shared hotspot vs. a personal location), the user has no easy way to catch it at a glance.

## Success Criteria
- After a successful lookup, the checklist ID, resolved location name, and observation time are visible on screen
- The format matches raincrow.app: `S334315671 / Berkeley Community Garden / 2026-05-07 17:26`
- The confirmation is clearly associated with the result, not floating independently
- It doesn't clutter the layout or distract from the weather output itself

## Scope
- Display checklist ID, location name, and datetime string returned by the backend
- Shown only on successful lookup, in the results area
- Formatted as a single line in the raincrow.app style

## Out of Scope
- Linking the checklist ID back to ebird.org
- Displaying additional metadata (observer name, species count, etc.)
- Any changes to how the backend fetches or formats the data (unless the field isn't already returned)

## Key Decisions
- Format follows raincrow.app convention: `{id} / {location} / {datetime}`
- This is a display-only change; the backend already has this data or needs only a minor addition to expose it
