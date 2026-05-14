# Design Spec — Media Life List Improvements

## Visual Direction
Stays fully consistent with the established SnowRaven brand: white card surface, #E4E4E7 borders, #2D8653 green for positive values, #D1D5DB dash for zero. No new visual patterns introduced.

## Screens / Views

### Media Life List Table (updated)

The table receives three visible changes; everything else — layout, filter pills, sort controls, expand toggle — is unchanged.

**Column header — leftmost column**
- Label changes from "Species" to "Entries"
- Rationale: "Entries" is accurate for soundscape recordings and any future non-species Macaulay Library item; "Species" is not

**Column header — "Seen" renamed to "Media"**
- Label changes from "Seen" to "Media"
- The Eye icon and the always-present per-row checkmark remain unchanged
- Rationale: "Seen" is inaccurate for audio-only entries

**Photo / Audio / Video cells**
- When count > 0: render the integer in 13px / font-weight 600 / color #2D8653
- When count = 0: render the existing dash (Minus icon, #D1D5DB) — no change from current zero state
- The cell layout (flex, centered) is unchanged

**Soundscape rows**
- Soundscape entries appear in the table like any other row
- Scientific name cell renders empty (soundscape entries carry no scientific name in the ML export)
- All filter pills, sort order, and count cells apply normally

## Component Usage
- Table structure: unchanged (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>`)
- Count display: plain `<span>` — no new component needed
- Dash display: existing `<Minus>` icon from lucide-react — unchanged

## Design Tokens Applied
- Count numbers: `#2D8653` (--primary) — matches the existing check color
- Dash: `#D1D5DB` — matches existing zero-state color
- All other tokens unchanged from current implementation

## Interaction Notes
- No new interactions. Filter pills continue to evaluate soundscape entries the same way they evaluate any other entry — no special-casing needed.

## Content Notes
- "Entries" and "Media" are the only copy changes
- Soundscape rows display "Soundscape" exactly as it appears in the ML export common name field
