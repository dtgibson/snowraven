# Schema -- In-App Help Documentation

## Path
Frontend Only -- No data layer changes required

## Confirmation
Assessed against all functional requirements and user stories. No new tables, columns, relationships, or migrations are needed. The documentation content is a static markdown file imported as a string at build time via Vite's `?raw` mechanism. No runtime data access of any kind.

## Existing Data Used by This Feature

This feature does not read from any existing API endpoints or data models. It is entirely self-contained. The Engineer should be aware of the following existing structure they will work within:

### Settings component (`frontend/src/components/Settings.tsx`)
- The Help button and section are added at the bottom of this component, below `TabLayoutSection`
- The component exports a single default function receiving `onKeysSaved`, `tabOrder`, `tabHidden`, `onReorder`, `onToggleVisibility`, and `onRestoreDefaults` props -- no new props are needed for Help
- Existing section divider pattern: a flex row with an icon, label text, and a `<div style={{ flex: 1, height: 1, background: 'var(--sr-border)' }} />` line -- the Help section header should match this

### Vite config (`frontend/vite.config.ts`)
- `manualChunks` is already configured with a function form
- The markdown renderer (if a library is used) should be handled in the existing `manualChunks` function -- either added to an existing vendor chunk or given its own small chunk to stay under 500 kB per NFR-02

### TypeScript config (`frontend/tsconfig.json`)
- Must include `"vite/client"` in `compilerOptions.types` for the `?raw` import to typecheck without a `declare module '*.md?raw'` shim. Check before assuming it is present.

### Theme tokens (relevant to HelpDocs.tsx)
- `var(--sr-surface)` -- overlay background
- `var(--sr-surface-subtle)` -- code block background
- `var(--sr-text)` -- body text
- `var(--sr-text-muted)` -- secondary text, H2/H3 headings
- `var(--sr-accent)` -- links, H1 color
- `var(--sr-border)` -- horizontal rules, code block borders
- `var(--sr-border-subtle)` -- light dividers within content

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation and documentation writing. No migrations need to be written or run for this feature.
