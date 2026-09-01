# Schema — Settings Acknowledgments

## Path
Frontend Only — No data layer changes required

## Confirmation
This feature has been assessed against the PRD and confirmed to require no database changes, no new persisted documents, and no migrations. Every user story (US-01 through US-05) and functional requirement (FR-01 through FR-17) was checked against the frontend-only criteria:

- **Nothing is created, read anew, updated, or deleted in persisted storage.** The acknowledgments content is fixed, static, in-component copy (FR-07, FR-08, FR-09). It is not loaded from a file, a settings document, or an API.
- **FR-13 is an explicit no-persisted-state requirement:** no new settings keys, no storage-seam writes, no `localStorage`, no reveal-state memory across sessions. Reveal state is session-only component state (`useState`), which is UI state, not data. QA-09 verifies `data/settings.json` is byte-unchanged after use.
- **FR-12 forbids network and API keys on reveal**, so there is no remote data dependency either. Optional outbound links (FR-11) are navigation, not data reads.
- **FR-17's edits** (`docs/HELP.md`, `README.md`, `website/`, `CHANGELOG.md`, the version bump in `frontend/package.json` and `src-tauri/tauri.conf.json`) are release bookkeeping in repo files, not a data layer.

Routing note: this project has dozens of prior `schema.md` files, so the default detection would read Incremental. Frontend Only takes precedence because the PRD involves no data-layer change of any kind; the classification was verified against the PRD rather than assumed from the project state.

## Existing Data Used by This Feature

None. This feature reads no CSV data (neither `data/ebird-backup.csv` nor `data/ml-export.csv`), no settings document, no API endpoint, and no cache. Its content is static strings compiled into the component. What the Engineer builds against is existing UI structure, not data:

### Settings section vocabulary (`frontend/src/components/Settings.tsx`)
- `SectionHeader` (module-private component, ~line 845): uppercase label + divider line. The new section renders `<SectionHeader label="Acknowledgments" />`.
- The "Help & Documentation" action row (~lines 1437-1474) is the shape precedent named by FR-01: a `.sr-action-row sr-action-row-stack` container (border `var(--sr-border)`, radius 10, background `var(--sr-surface)`) holding a 40x40 icon tile (`var(--sr-accent-bg)` / `var(--sr-accent-border)` / `var(--sr-accent)`, lucide icon at `size={18} strokeWidth={1.75}`), a title + one-line muted description with `minWidth: 0`, and a trailing accent button (height 34). Copy that shape exactly; the section-placement default is last in the tab (PRD Open Question 2).
- The row's button triggers the reveal. If the Designer chose an overlay, the wiring precedent is the `onOpenHelp: () => void` prop (Settings.tsx ~line 1187) passed from `App.tsx`.

### Overlay lazy-load precedent, if the reveal ships as an overlay (`frontend/src/App.tsx`)
- `HelpDocs` is code-split: `const importHelpDocs = () => import('./components/HelpDocs')` (line 46), `const HelpDocs = lazy(...)` (line 59), idle-time warm via `void importHelpDocs().catch(() => {})` (~line 424), and a conditional mount `{helpOpen && (<Suspense ...><HelpDocs onClose={() => setHelpOpen(false)} /></Suspense>)}` (~line 1401), driven by `const [helpOpen, setHelpOpen] = useState(false)`.
- `HelpDocs` exports `export function HelpDocs({ onClose }: { onClose: () => void })` and performs no storage or transport calls, which is exactly the posture the new surface must match. NFR-05 requires any new overlay component to follow this lazy pattern and keep `entryChunk.test.ts` green. An inline disclosure inside Settings.tsx needs no code-splitting (Settings is not on the entry chunk's guarded weight path the way maplibre is, and static text adds negligible bytes), but the collapsed content must be `inert` per the repo's CSS-collapsed-disclosure rule.

### Optional links (`frontend/src/components/OutboundLink.tsx`)
- If entry 1 links out (FR-11), it routes through the shared `OutboundLink` component with the canonical "(opens in a new tab)" cue, already imported and used in Settings.tsx. The Deven Simonson entry carries no link.

### Seams this feature must NOT touch
- `frontend/src/lib/storage.ts` (storage seam): no `getSetting`/`setSetting` calls, no new settings keys (FR-13).
- `frontend/src/lib/transport.ts` (transport seam): no `transport.get`/`transport.post` calls (FR-12).
- `frontend/src/lib/platform.ts`: no `isTauri()` or any platform branch (FR-14); one shared surface on all platforms.

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
