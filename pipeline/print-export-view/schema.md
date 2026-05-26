# Schema — Print / Export View

## Path
Frontend Only — No data layer changes required

## Confirmation
This feature has been assessed against the PRD and confirmed to require no database changes. No new tables, columns, relationships, or migrations are needed. SnowRaven has no persistent database — all application data lives in React component state, derived from CSV files uploaded by the user.

## Existing Data Used by This Feature

### LifeList component state (`frontend/src/components/LifeList.tsx`)
- Fields used: `Phase` (idle / loading / ready), `LifeListEntry[]`, `mediaMap`, `sort`, `filter`, `source`
- How used: The Print button appears only in the `ready` phase. Auto-expand on print must render the full `LifeListEntry[]` array regardless of the current scroll state.

### LifeListTable component (`frontend/src/components/LifeListTable.tsx`)
- Fields used: `entries`, `mediaMap`, `sort`, `filter`
- How used: Currently renders inside a scroll container when not expanded. Print styles or a `beforeprint` event must remove the height/overflow constraint so all rows render.

### ListComparer component (`frontend/src/components/ListComparer.tsx`)
- Fields used: `ComparisonResult` (shared, aOnly, bOnly species arrays), `fileAName`, `fileBName`
- How used: The Print button appears in the results state. The three `SpeciesPanel` components each have a fixed height when collapsed — all three must render fully on print.

### SpeciesPanel component (`frontend/src/components/SpeciesPanel.tsx`)
- Fields used: `species: string[]`, `isExpanded: boolean`
- How used: Currently gates scroll height via the `isExpanded` prop. Print styles or a `beforeprint` handler must override this constraint.

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
