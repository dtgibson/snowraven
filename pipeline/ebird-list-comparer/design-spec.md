# Design Spec — eBird List Comparer

## Visual Direction
Consistent with the established SnowRaven brand: clean, minimal, purposeful. Primary green (#2D8653) is used sparingly on the most important actions and highlights. Surfaces are white with light grey borders; the background is #F9FAFB. No visual distinction between the two tools — they feel like parts of the same app, not an embedded widget.

## Screens / Views

### Shared: Header + Tab Bar
- SnowRaven logo (Bird icon + wordmark) is retained at the top, centered
- Tagline updated to "Birding tools for your eBird workflow" to reflect the expanded scope
- Tab bar sits directly below the tagline, flush with a 1px bottom border
- Tabs: "Weather" (cloud icon) and "List Comparer" (sort/compare icon)
- Active tab: primary green text (#2D8653) with a 2px green underline indicator, margin-bottom: -1px to sit on the border
- Inactive tab: muted text (#71717A), full-opacity on hover
- Tab bar inner content max-width: 880px, left-aligned within that container

### List Comparer — Upload State
- Heading: "Compare two eBird life lists" — 22px, font-weight 600, tracking -0.4px
- Subheading: 14px muted text, line-height 1.55
- Two drop zones in a 2-column grid, gap 12px, max-width 600px
- Each drop zone: 1.5px dashed border (#E4E4E7), border-radius 10px, centered flex column content, 30px padding top
- Drop zone label: 11px uppercase caps, letter-spacing 0.08em, muted
- Drop zone icon: 30px upload icon in muted grey (#C4C4CE)
- Loaded state: solid border (#2D8653), background #E8F5EE, green check icon, filename in dark green (#1A5C38) semibold
- Hover state: border transitions to green, background to near-white
- Compare Lists button: full-width, 48px height, primary green, disabled (opacity 0.4) until both files loaded

### List Comparer — Results State
- Full viewport-height layout: panels extend to the bottom of the browser window
- Results header: 14px muted text "Comparing [File A] and [File B]" with filenames in semibold foreground; "Compare new files" ghost button (green border, green text, hover fills #E8F5EE) right-aligned
- Stats bar: 5-column grid, white cells with 1px right borders, border-radius 10px, 1px outer border
  - Stat value: 26px, font-weight 600, tracking -0.5px
  - "In Both" value highlighted in primary green (#2D8653)
  - Stat label: 10px uppercase, letter-spacing 0.08em, muted, truncated with ellipsis
- Three-column panel grid, gap 12px, fills remaining height (flex: 1)
- Each panel: white background, 1px border, border-radius 10px, flex column, overflow hidden
- Panel header: 13px semibold title, green badge showing count (background #E8F5EE, text #2D8653, pill shape)
- Panel scroll area: independent vertical scroll per column, 6px custom scrollbar in #E4E4E7
- Species items: 13px, 5px/16px padding, hover background #F9FAFB

## Component Usage
- No shadcn components used — all inline styles matching the SnowRaven design language from App.tsx
- Lucide icons: Bird (logo), Cloud (Weather tab), sort/compare icon (List Comparer tab), Upload (empty drop zone), Check (loaded drop zone), Search (weather button), undo arrow (reset button)

## Design Tokens Applied
- `--primary`: #2D8653 — active tab, loaded drop zone border, Compare button, badge text, stat highlight, panel badge background tint
- `--background`: #F9FAFB — page background, species item hover
- `--foreground`: #0F1117 — primary text, stat values, panel titles
- `--muted`: #F4F4F5 — demo toggle background
- `--muted-foreground`: #71717A — tab inactive, drop zone hints, stat labels, results label
- `--accent`: #E8F5EE — loaded drop zone background, reset button hover, panel badge background
- `--border`: #E4E4E7 — tab bar line, drop zone dashes, stats bar borders, panel borders
- `--radius`: 8–12px (card: 12px, buttons: 8px, panels: 10px, drop zones: 10px)

## Interaction Notes
- Tab switching: no page reload, no state reset on the inactive tool
- Drop zone: full area is clickable (opens file picker), also accepts drag-and-drop
- Compare button: disabled until both files parsed successfully; no visual feedback on hover when disabled
- Results panels: each scrolls independently; page itself does not scroll in results state
- Reset: returns to upload state, clears both drop zones

## Content Notes
- Panel titles use actual filenames (e.g. "dtgibson_ebird_2024.csv only"), not generic labels
- Stats bar labels truncate with ellipsis when filenames are long
- Footer text updated to "self-hosted birding tools" to reflect expanded scope
