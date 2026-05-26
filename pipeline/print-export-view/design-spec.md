# Design Spec — Print / Export View

## Visual Direction

Quiet and functional — the Print button fits naturally into the existing controls row without demanding attention. It uses the brand green border to signal a distinct, constructive action while matching the weight and scale of the surrounding ghost buttons.

## Screens / Views

### Media Life List — Ready State (with Print button)

A single Print button is added to the right controls area, positioned after the Sort control and "Show all" toggle, and before "Load new file". This ordering keeps the destructive reset action last.

- Button height: 28px — matches existing ghost buttons in the controls row
- Border: 1.5px solid rgba(45,134,83,0.35) — brand green at reduced opacity, lighter than primary actions
- Background: transparent, hover → #E8F5EE (brand accent)
- Text color: #2D8653
- Icon: Lucide `Printer` at 11px, left of label
- Label: "Print"
- Visible only in the `ready` phase — not shown during idle, error, or loading states

### Life List Comparer — Results View (with Print button)

A Print button is added to the results header action group, positioned after the Sort control and "Show all" toggle, and before "Compare new files".

- Button height: 34px — matches existing buttons in the comparer header
- Same border/color/icon treatment as the Media Life List variant, scaled to match the larger button size
- Visible only when a comparison result is displayed

### Print Output — Media Life List

The printed page shows only the species table. No header, tab bar, filter pills, sort controls, count label, toggle, or reset button. Table columns (Seen, Photo, Audio, Video) retain their headers. All species rows render regardless of scroll state. Font size: 12px. Row spacing is tighter than the screen view — readable at standard paper sizes.

### Print Output — Life List Comparer

The printed page shows a summary counts row (In Both / A Only / B Only as large numerals with labels) followed by three species lists in a two-column layout. No header, tab bar, sort controls, stats bar, or action buttons. All species in all three panels render regardless of scroll state. Section headings (e.g. "In Both (247)") appear above each list.

## Component Usage

- Lucide `Printer` icon — added to the import list in `LifeList.tsx` and `ResultsView.tsx`
- No new shadcn components introduced
- Existing ghost button style reused with green border variant

## Design Tokens Applied

- Border color: rgba(45,134,83,0.35) — `--primary` at reduced opacity
- Hover background: #E8F5EE — `--accent`
- Text: #2D8653 — `--primary`

## Interaction Notes

- Clicking Print calls `window.print()`
- A `beforeprint` event listener auto-expands lists before the print dialog opens, ensuring all rows are rendered
- After printing (or cancelling), a `afterprint` event restores the previous expanded/collapsed state
- The button is hidden from printed output via `@media print { .print-btn { display: none } }`

## Content Notes

- Button label is simply "Print" — no "Export" or "Save as PDF" variant; the browser handles the save-as-PDF path natively through the print dialog
- No tooltip needed — the Printer icon communicates the action clearly
