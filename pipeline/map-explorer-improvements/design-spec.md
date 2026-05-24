# Design Spec — Map Explorer Improvements
**Feature:** map-explorer-improvements
**Session:** 001
**Date:** 2026-05-23
**Stage:** 4 — The Designer

---

## Feature A — Media Target Type Filter

### Layout

Filter pills appear inside the `{targetPins !== null && ...}` conditional block, between the mode header and the existing "Time Range" section. They are labeled with a `SidebarLabel` ("Filter by Type") and rendered as a horizontal pill row.

### Pills

| Label | Icon | Behavior |
|---|---|---|
| All | — | Mutually exclusive; default selected; resets type pills |
| Photo | Camera SVG (from MEDIA_ICONS) | Multi-select; deselects "All" when activated |
| Audio | Microphone SVG (from MEDIA_ICONS) | Multi-select; deselects "All" when activated |
| Video | Video camera SVG (from MEDIA_ICONS) | Multi-select; deselects "All" when activated |

Icons are the exact SVG paths already used in the pin rendering code (`MEDIA_ICONS` constant in MapExplorer.tsx). Size: 14×14px inline in the pill.

### Visual States

**Inactive pill:**
- Background: `var(--sr-bg-secondary)`
- Border: `var(--sr-border)`
- Text: `var(--sr-text-secondary)`

**Active pill:**
- Background: `var(--sr-is-target-bg)`
- Border: `var(--sr-is-target-border)`
- Text: `var(--sr-is-target-text)`
- No fill change on icons — icon color inherits from text color

### Species Count Label

The existing count label ("18 species") derives from `displayedTargetPins.length` after the filter is applied. No separate counter UI needed — the existing label automatically reflects the filtered count.

### Empty State

When `displayedTargetPins.length === 0` after filtering, show:

> No targets match this filter.

Displayed where the nearest-10 list would otherwise appear. Same text style as the existing "No targets found" empty state.

### Visibility

Pills are only rendered in Media Targets mode. The conditional is the existing `{targetPins !== null && ...}` wrapper — no additional condition needed.

---

## Feature B — Radius Fix

No UI changes. The radius fix is a silent correction: the public hotspot fetch now converts `radius` (miles) to km before passing to the eBird API. Personal pins continue using the existing `distanceMiles() <= radius` comparison unchanged.

The design mockup includes a before/after comparison panel for reference, but nothing new appears in the UI.

---

## Token Reference

| Purpose | Token |
|---|---|
| Active pill background | `var(--sr-is-target-bg)` |
| Active pill border | `var(--sr-is-target-border)` |
| Active pill text/icon | `var(--sr-is-target-text)` |
| Inactive pill background | `var(--sr-bg-secondary)` |
| Inactive pill border | `var(--sr-border)` |
| Inactive pill text | `var(--sr-text-secondary)` |
| Section label | `SidebarLabel` component (existing) |

---

## Mockup

See `design.html` in this directory for the four-panel interactive mockup showing:
1. Default — All selected (18 targets)
2. Photo filter active (11 targets)
3. Photo + Audio multi-select (AND logic)
4. Empty state
5. Radius fix before/after comparison
