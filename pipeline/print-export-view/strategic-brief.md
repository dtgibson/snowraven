# Strategic Brief — Print / Export View

## What We're Building

A print-optimised view for the Media Life List and Life List Comparer tabs that strips away navigation and input chrome and presents only the content in a clean single-column layout, triggered by a print button and rendered via CSS `@media print` rules.

## Why Now

The "Show all / Collapse" toggle already signals that printing is a real use case — users reach for it when they want a full-page view of their life list or comparison. Completing that intent with proper print styles is low-effort, high-value, and unblocks a workflow that's already partially there.

## The User Problem

A birder who wants to save or print their life list or comparison hits two obstacles: the SnowRaven header and tab bar consume space at the top of every page, and input controls and filter pills clutter the content area. The result is a messy printout that requires manual cropping or screenshot editing.

## Success Criteria

- Printing the Media Life List or Life List Comparer produces a clean document with only the content visible (no header, no tab bar, no input zones, no filter controls)
- The species table and comparison panels print all entries (not just what's visible in the scroll container) without requiring the user to manually enable "Show all" first
- The layout is single-column and readable in both portrait and landscape
- A visible "Print" button gives users a clear affordance — they don't need to discover Cmd+P themselves
- The Weather tab is unaffected and unchanged

## Scope

- CSS `@media print` rules that hide navigation and input chrome on the Media Life List and Life List Comparer tabs
- Auto-expand species list and comparison panels when printing (no manual "Show all" required)
- A "Print" button on each of those two tabs that calls `window.print()`
- Clean typography and spacing in the printed output

## Out of Scope

- Print support for the Weather tab
- PDF generation via a server-side renderer
- Export to file formats other than browser print/PDF
- Custom paper size or margin controls
- Print-specific headers or footers with page numbers
- Any backend changes

## Key Decisions

- Use `@media print` CSS rather than a separate print route — keeps the implementation simple and works with the existing display-toggle tab architecture
- Auto-expand on print rather than requiring "Show all" first — the user clicked Print, they want everything
- A dedicated Print button is preferred over relying solely on Cmd+P — makes the feature discoverable and ensures the right state is set before the dialog opens
