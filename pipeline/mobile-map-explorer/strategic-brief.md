# Strategic Brief — Mobile Map Explorer

## What We're Building
Two improvements to the Map Explorer tab: a mobile-optimized full-screen map layout with a togglable filter panel, and a persistent default map location the user can save in Settings.

## Why Now
The Map Explorer was designed and tested at desktop widths. On a phone, the fixed 268px sidebar consumes roughly half the screen, leaving the map too small to browse. These two additions — full-screen map on mobile, remembered home location — are the difference between the tab being useful on a phone and not.

## The User Problem
A birder heading out to a local patch opens the Map Explorer on their phone to check nearby hotspots or recent target sightings. The sidebar crowds the map and they have to re-enter their home coordinates every visit. Neither is a fundamental technical problem — both are fixable with straightforward layout and persistence work.

## Success Criteria
- On mobile, the map fills the full viewport and is navigable without the sidebar present
- A visible control toggles the filter panel in and out without losing map or query state
- The user can save a default lat/lng (and optionally a default radius) in Settings
- The Map Explorer opens at the saved location on every subsequent visit
- The desktop layout is unchanged

## Scope
- Mobile-responsive Map Explorer layout (breakpoint: ≤640px, matching existing `.sr-two-col` pattern)
- Floating toggle button on mobile to show/hide the sidebar as an overlay
- Sidebar renders as a drawer/overlay on mobile rather than a fixed split pane
- Default map location (lat, lng, radius) saved and retrieved via a new Settings endpoint
- Map Explorer reads the saved default on mount when no override is in play

## Out of Scope
- Any changes to the desktop layout
- Native touch gestures beyond what Leaflet provides by default
- Per-mode defaults (one global default location covers all three map modes)
- Animated transitions or complex drawer mechanics — functional is enough

## Key Decisions
- Mobile breakpoint: ≤640px (consistent with existing responsive patterns in the codebase)
- Sidebar on mobile: overlay/panel on top of the map, not a bottom sheet
- Default location storage: server-side, new endpoint(s) in the Settings family — exact shape for The Architect to decide
- Desktop experience: zero changes
