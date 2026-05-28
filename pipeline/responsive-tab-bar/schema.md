# Schema — Responsive Tab Bar

## Path
Frontend Only — No data layer changes required

## Confirmation
Assessed against the PRD and confirmed: no database changes. No new tables, columns, relationships, or migrations. The feature is presentation and interaction only.

## Existing State the Feature Reads
The dropdown reuses the same in-memory state the current bar already consumes — no new store, no new persistence.

### `frontend/src/lib/tabLayout.ts`
- Used: `TabLayoutState` (`order: ConfigurableTab[]`, `hidden: Set<ConfigurableTab>`), `loadTabLayout()`, `saveTabLayout()`, `DEFAULT_TAB_ORDER`, `TAB_LABELS`, `ConfigurableTab`.
- How used: the dropdown lists `order.filter(t => !hidden.has(t))` then `'settings'` — identical to the bar's current visible-tab computation. Persistence (`localStorage`, key `sr-tab-layout`) is untouched.

### `frontend/src/App.tsx`
- Used: `activeTab` / `setActiveTab` state, `TAB_ICONS` lookup, and the existing `<nav role="tablist">` block (lines ~306–365) with its roving `tabIndex`, arrow-key handler, and `aria-controls`/`tabpanel` wiring.
- How used: this markup is what becomes the responsive component. The active-tab state and icon/label lookups are shared by both layouts; the tabpanels below are unchanged.

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations to write or run.
