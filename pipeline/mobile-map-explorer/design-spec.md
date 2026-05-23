# Design Spec — Mobile Map Explorer

## Visual Direction
Consistent with the established SnowRaven brand: Irish clover green (#2D8653) as the sole accent, white surfaces, Inter sans-serif, 8px border radius throughout. The floating Filters button uses the brand green with a matching drop shadow to keep it prominent without feeling intrusive. All other additions are quiet — they blend into the existing Settings and Map Explorer UI rather than announcing themselves.

## Screens / Views

### Map Explorer — Mobile (sidebar closed)
- Map fills the full available height (100%) and full width — no sidebar in the flex row on ≤640px viewports
- A green pill button ("Filters" + funnel icon) floats in the bottom-right corner of the map at `bottom: 20px; right: 16px; z-index: 30`
- Button uses the primary green with a green-tinted drop shadow (`box-shadow: 0 4px 12px rgba(45,134,83,0.4)`)
- All existing map pins, heatmap, and interaction behavior unchanged

### Map Explorer — Mobile (sidebar open)
- Semi-transparent dark backdrop (`rgba(0,0,0,0.42)`) covers the full map area behind the sidebar
- Sidebar panel slides in from the left as `position: absolute; top: 0; left: 0; height: 100%; width: min(282px, 90vw)`
- Sidebar has a header row: "Map Filters" title (13px, weight 600) + circular close button (26px, muted background) with × icon
- Existing sidebar content (mode selector, address search, lat/lng/radius fields, Find button, legend) unchanged
- Tapping the backdrop dismisses the sidebar; tapping the close button dismisses the sidebar
- The floating Filters button is hidden while the sidebar is open
- Desktop (>640px): sidebar always visible in the flex row, no floating button, no backdrop — identical to current behavior

### Settings — Default Location section
- Positioned at the bottom of the Settings page, below Default Files
- Section title: "Default Location" (13px, weight 600) with a small "NEW" badge in green on primary-light background
- Description: "Set a home location for the Map Explorer. These coordinates load automatically every time you open the map tab." (12px, muted)
- Three inputs in a `grid-template-columns: 1fr 1fr 88px` row: Latitude, Longitude, Radius (mi)
- Inputs use monospace font for coordinate values; 8px border radius; focus ring in primary green
- Save button (primary green) + Clear button (muted/outline) + inline "✓ Saved" confirmation chip (green, appears on save, auto-hides after 2.5s)
- Clear resets all three inputs to empty; Save chip hidden on clear
- On mount: pre-fill inputs from `GET /settings/map-defaults` if saved; leave blank on 404

## Component Usage
- Floating Filters button: custom pill (`border-radius: 24px`), not a shadcn component — needs the pill shape and shadow
- Sidebar close button: 26px circle, muted background, no border — consistent with other icon-only buttons in the app
- Coord inputs: standard text inputs matching the existing `field-input` pattern
- Save/Clear buttons: match existing `btn-save` / `btn-clear` patterns used elsewhere in Settings
- Saved chip: inline success indicator — same green/primary-light pairing used for active state throughout the app

## Design Tokens Applied
- `--primary` (#2D8653) — Filters button background, Save button, focus rings, Saved chip text, badge
- `--primary-light` (#E8F5EE) — Saved chip background, NEW badge background
- `--primary-dark` (#1A5C38) — NEW badge text
- `--muted` (#F4F4F5) — Close button background, Clear button background
- `--muted-fg` (#71717A) — Field labels, section descriptions, close button icon
- `--border` (#E4E4E7) — Input borders, section dividers
- `--fg` (#0F1117) — Section titles, input values

## Interaction Notes
- `sidebarOpen: boolean` state in MapExplorer — false by default; toggled by Filters button and close/backdrop
- Backdrop click and close button both call the same `closeSidebar` handler
- Filters button hidden (`display: none`) while sidebar is open; restored on close
- Saved chip: 2500ms auto-hide via `setTimeout`; timer reset on repeated Save clicks
- Clear: resets all three inputs to `''` and hides the Saved chip immediately
- On MapExplorer mount: single fetch to `GET /settings/map-defaults`; on 200, set lat/lng/radius state for all three modes; on 404 or error, no-op

## Content Notes
- Section label: "Default Location" (both words capitalised, matching "API Keys" and "Default Files")
- Filters button label: "Filters" (not "Open Filters" or "Map Filters" — keep it short for the pill)
- Sidebar header: "Map Filters" (distinguishes it from the button label in context)
- Close button: aria-label="Close filters"; Filters button: aria-label="Open map filters"
- Saved chip copy: "Saved" (one word, with checkmark icon — no "successfully" or "changes saved")
