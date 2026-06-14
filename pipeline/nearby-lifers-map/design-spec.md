# Design Spec — Nearby Lifers Map

## Visual Direction
Quiet utility, entirely within SnowRaven's established Map Explorer system — no new visual language. The new Nearby Lifers section reads identically to the existing Media Targets section: the same sidebar structure, the same recency-tier color language, the restrained green accent for active states. Approved against `design.html` (light + dark).

## Screens / Views

### Map Explorer — Nearby Lifers section
- Selected from the existing mode bar (pill, `aria-pressed`); binoculars/bird icon + "Nearby Lifers" label.
- Sidebar panel (268px): **Center** (place search + "Use my location"), **Radius** SegControl (5 / 10 / 25 / 50 mi), **Time range** SegControl (Day / Week / 30 days, default 30 days), a count line ("N spots · N lifers · radius, window"), the **atlas overlay** toggle, and the **in-view list** of locations.
- In-view rows: recency-tier count badge + location name + distance, with the lifer(s) beneath (single name + italic sci name, or "{n} species"). Active row uses the accent-bg highlight; rows are real buttons.
- Map: recency-tier-colored chips, each labeled with the lifer's name (or "{n} species" when a spot has several), mirroring the Media Targets markers; one state-driven popup per selected location listing each lifer (recency dot, `BirdName` plain + favicons, date, eBird `ChecklistLink`). User-location dot, fullscreen / Filters FAB, shared base-layer switcher.

### Media Targets section (consistency change)
- Gains the same **Time range** SegControl in its sidebar — identical control, position, and styling — with its own selected window. Nothing else about Media Targets changes.

## Component Usage
- Existing shared components: mode-bar pill, `SegControl` (radius + time range), `SidebarLabel`, `KeyNotice`, `InViewMarkerList`, `AddressSearch`, `CenterPointControl`, `RadiusControl`, `atlasOverlayControls`.
- New: `NearbyLiferMarkers` (DOM `<Marker>` per location, labeled chip — species name / "{n} species" — recency-tier color), cloned from `TargetMarkers`.
- `BirdName` for names (`hasEntry={false}` → plain + favicons), `ChecklistLink` for checklist links.

## Design Tokens Applied
- Recency tiers: `--sr-map-target-fresh` (#2D8653) / `--sr-map-target-mid` (#5EA07C) / `--sr-map-target-old` (#A8D4BB), with the matching `-text` tokens for the count badge.
- Accent: `--sr-accent` / `--sr-accent-bg` for active mode, active row, and selected SegControl segments.
- Surfaces, borders, and text from the standard `--sr-*` palette; both themes; no hardcoded colors.

## Interaction Notes
- Selecting the section auto-loads at the saved default location (no Find click).
- Time range re-filters client-side (no refetch); pins, badges, and list all update.
- Pin click and list-row activation open the same single popup (lifted selection).
- "Use my location" / place search re-center and refetch; radius change refetches; time-range change does not.
- Empty / loading / error / no-default-location / no-backup states each render their own message.

## Content Notes
- Realistic location and species naming; "{n} species" when a spot has several lifers; "N spots · N lifers" count line.
- Names never link to Species Detail (lifers aren't recorded) — favicons only.
- Plain, informative copy; no promotional tone.
