# Schema — Accessibility

## Path
Frontend Only — No data layer changes required

## Confirmation
This feature has been assessed against all 31 functional requirements in `prd.md` and confirmed to require no database changes. No new tables, columns, relationships, or migrations are needed. The work is entirely ARIA attributes, CSS changes, keyboard event handlers, and semantic HTML corrections applied to existing components.

## Existing Data Used by This Feature

This feature does not consume new data. The Engineer will be modifying the presentation and interaction layer of existing components. No existing endpoints are added, removed, or changed. The components being audited and modified are:

### Tab Bar (App.tsx)
- How used: The tab bar and its `activeTab` state drive which panel is visible. The Engineer will add `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, and `role="tabpanel"` attributes to the existing JSX without touching the tab switching logic.

### Weather Tab (App.tsx)
- How used: The checklist ID input and weather result container are already rendered in `App.tsx`. The Engineer will add `aria-label` to the input, `aria-live="polite"` to the result container, and an `aria-label` to the copy and clear buttons.

### Media List (LifeList.tsx, LifeListTable.tsx)
- How used: Filter pills, sort column headers, toggle switches, and the species count label are already rendered. The Engineer will add `aria-pressed`, `aria-sort`, `role="switch"`, `aria-checked`, and `aria-live` to the appropriate elements.

### Breeding Codes (BreedingCodeList.tsx, BreedingCodeTable.tsx)
- How used: The matrix table, filter pills, tier badge circles, and sort headers are already rendered. The Engineer will add table semantics or ARIA grid roles to the matrix, `aria-pressed` to pills, `aria-sort` to headers, a visually-hidden tier label to each badge circle, and fix the tier-1 badge text contrast.

### Species Detail (SpeciesDetail.tsx)
- How used: The species selector, section cards, segmented graph controls, and toggle switches are already rendered. The Engineer will implement the ARIA combobox pattern on the species selector, add `role="switch"` to toggles, and add `role="group"` + `aria-pressed` to segmented controls.

### Birding Statistics (BirdingStats.tsx)
- How used: Segmented controls (interval, view mode) and section headings are already rendered. The Engineer will add `role="group"` + `aria-pressed` to segmented controls and verify heading hierarchy.

### Map Explorer (MapExplorer.tsx)
- How used: The mobile Filters sidebar, sidebar close button, recency tier dots in the nearest-10 list, and the Leaflet map container are already rendered. The Engineer will add a focus trap + Escape handler to the mobile sidebar, visually-hidden recency labels, and `aria-label` on the map container.

### Settings (Settings.tsx)
- How used: The appearance theme selector, API key show/hide buttons, file clear buttons, and the Help overlay trigger are already rendered. The Engineer will add `role="radiogroup"` + `role="radio"` to the theme selector, `aria-label` to icon-only buttons, and verify the HelpDocs focus trap.

### HelpDocs (HelpDocs.tsx)
- How used: The full-screen overlay already has a focus trap per PRODUCT_CONTEXT.md. The Engineer will verify the implementation is correct (focus moves on open, returns on close, traps while open, closes on Escape).

### Shared / CSS (globals.css)
- How used: Color tokens (`--sr-*`) drive all contrast values. The Engineer will audit contrast ratios for body text and interactive elements and adjust any failing tokens. A global `.sr-only` utility class will be added if not already present, for use by visually-hidden ARIA labels throughout the codebase.

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
