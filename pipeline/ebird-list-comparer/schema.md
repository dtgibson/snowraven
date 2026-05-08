# Schema — eBird List Comparer

## Path
Frontend Only — No data layer changes required

## Confirmation
Every user story and functional requirement in the PRD has been reviewed. No data is created, stored, updated, or deleted. Files are read from the user's local filesystem via the browser File API, processed entirely in memory, and discarded when the session ends or the user resets. No tables, columns, relationships, or migrations are needed.

## Existing Data Used by This Feature

This feature makes no use of any external API or the existing backend. It does not call `/weather` or any other endpoint.

### Browser File API
- Source: User's local filesystem, two eBird backup `.csv` files
- Access method: `FileReader.readAsText()` triggered by drag-and-drop or file picker
- Fields consumed: The "Common Name" column of each CSV file
- Lifetime: In-memory React state, cleared on reset or page reload

### Internal Data Flow (no network)
```
File A (CSV) ──► parseEbirdCSV() ──► Set<string>
                                          │
                                          ▼
                                   compareSpecies() ──► { both[], aOnly[], bOnly[], totalA, totalB }
                                          ▲
File B (CSV) ──► parseEbirdCSV() ──► Set<string>
```

### Existing Backend Endpoint (not used by this feature)
The `GET /weather/{checklist_id}` endpoint introduced in the Checklist Weather Lookup feature remains untouched. The List Comparer has no server interaction.

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
