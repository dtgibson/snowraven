# Design Spec — Accessibility

## Visual Direction

The accessibility pass makes no changes to the established SnowRaven brand aesthetic — calm, purposeful, green-accented, clean. The one visible color change (tier-1 badge text) improves legibility while staying within the existing purple tier palette. Focus rings use the existing `--ring: #2D8653` token, consistent with the brand's primary color.

## Screens / Views

### Tier-1 Badge — Contrast Fix

The only visible color change in this pass. The tier-1 ("Possible") breeding code badge changes its text color from `white` to `#3B0764` (dark purple) to achieve ≥4.5:1 contrast against the `#C084FC` background.

- Before: `color: white` on `#C084FC` → 2.7:1 (fails AA)
- After: `color: #3B0764` on `#C084FC` → 6.8:1 (passes AA)
- Tiers 2, 3, 4 are unaffected — white text on their darker backgrounds already passes

The fix is applied in `BreedingCodeTable.tsx` where badge inline styles are rendered. In dark mode, verify the same dark-text rule applies.

### Focus Ring — All Interactive Elements

A consistent `:focus-visible` style applies to all interactive controls:

```css
outline: 3px solid var(--sr-accent);   /* #2D8653 in light mode */
outline-offset: 3px;
box-shadow: 0 0 0 6px rgba(45, 134, 83, 0.15);
```

For inputs, `outline-offset: 0` is used instead (ring hugs the border). Applied globally via `globals.css` — no per-component overrides needed.

### Warning Card — Text Label Added

The API key missing warning card gains an explicit "Warning:" prefix in the card title and the existing warning icon is confirmed present, so the alert conveys its meaning through text and iconography, not color alone.

## Component Usage

- **Filter pills** — existing `<button>` elements gain `aria-pressed="true/false"`. No visual change.
- **Toggle switches** — existing toggle buttons gain `role="switch"` and `aria-checked`. No visual change.
- **Tab bar** — existing tab buttons gain `role="tab"`, `aria-selected`, `aria-controls`. Tab panels gain `role="tabpanel"`, `id`, `aria-labelledby`. No visual change.
- **Sort headers** — existing `<th>` elements gain `aria-sort`. No visual change.
- **Species combobox** — existing search input gains full ARIA combobox pattern (`role="combobox"`, `aria-expanded`, `aria-autocomplete`, `aria-activedescendant`). Listbox gains `role="listbox"`; each option gains `role="option"` and `aria-selected`. No visual change.
- **Segmented controls** — existing button groups gain `role="group"` with `aria-label`. Each option button gains `aria-pressed`. No visual change.
- **Appearance theme selector** — gains `role="radiogroup"` and each option gains `role="radio"` with `aria-checked`. No visual change.

## Design Tokens Applied

All existing `--sr-*` tokens. No new tokens required except:
- `tier-1 badge text color: #3B0764` — may use the existing `--sr-tier-4` token value if it matches.

## Interaction Notes

**Focus trap — HelpDocs and Map Filters sidebar:**
- On open: move focus to first focusable element inside the overlay
- Tab/Shift-Tab: cycle within the overlay only
- Escape: close and return focus to the trigger element
- HelpDocs already has this — verify and apply the same pattern to the Map Filters mobile sidebar

**Keyboard navigation — tab bar:**
- Tab reaches the tab bar
- Arrow keys (Left/Right) cycle between tab buttons
- Non-active tabs have `tabindex="-1"` so Tab skips them; only the active tab is in the natural tab order
- Enter/Space on a focused tab button activates it

**Live regions:**
- `aria-live="polite" aria-atomic="true"` on the weather result container — announces on result load and on error
- `aria-live="polite"` on species count labels in Media List and Breeding Codes
- `aria-live="polite"` on the footer update-check status area
- `aria-busy="true/false"` on data tab content containers during auto-load

## Content Notes

**Visually-hidden labels (`.sr-only`):**
- Breeding code tier badges: append `, Possible` / `, Probable` / `, Confirmed` after the code abbreviation
- Map recency dots: add `Recent (≤7 days)` / `Seen 8–14 days ago` / `Seen 15–30 days ago`
- `.sr-only` utility class added to `globals.css` if not already present

**Form input labels (hidden where visible label would clutter UI):**
- Checklist ID input: `aria-label="eBird checklist ID or URL"`
- API key inputs: `aria-label="eBird API key"` / `aria-label="OpenWeather API key"`
- Lat/lng/radius inputs: `aria-label="Latitude"` / `"Longitude"` / `"Radius in miles"`
- Address search: `aria-label="Search for a location"`

**Keyboard-inaccessible (documented limitation):**
- Drag-to-reorder tab layout in Settings — note in the Settings UI as a known limitation for this release
