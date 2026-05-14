# Design Spec — Media List Links and Sorting

## Visual Direction
Stays fully consistent with the established SnowRaven brand: white card surface, #E4E4E7 borders, #2D8653 green for interactive/active elements, #D1D5DB dash for zero. No new visual patterns introduced.

## Screens / Views

### Media Life List Table (updated)

**"Media" column — removed**
The column showing a checkmark (✓) for every row is gone. Table now has four columns: Entries, Photo, Audio, Video.

**Sort control button group — removed**
The `Taxonomic / A–Z` button group in the controls row is gone. No replacement button is added — sorting is handled entirely by column header clicks.

**Column headers — sortable**
All four column headers (Entries, Photo, Audio, Video) are clickable sort triggers:
- Cursor: pointer
- Hover color: #3F3F46 (one step darker than the default #71717A muted)
- Active sort column: color #0F1117 (dark ink)
- Sort direction indicator: green `↑` or `↓` appended after the label, color #2D8653, font-size 10px
- Inactive columns: no indicator shown

Default on load: Entries ↑ (A–Z ascending)

Sort direction defaults per column:
- Entries: first click = ↑ ascending; toggle = ↓ descending
- Photo / Audio / Video: first click = ↓ descending (highest count first); toggle = ↑ ascending

Tie-break for count columns: alphabetical by common name ascending.

**Count cells — non-zero**
When count > 0, renders as an `<a>` element:
- Font-size: 13px / font-weight: 600 / color: #2D8653
- Text-decoration: none at rest
- Text-decoration: underline on hover
- Cursor: pointer
- Opens ML catalog search in new tab

Link URL format:
```
https://search.macaulaylibrary.org/catalog?taxaName={encodeURIComponent(commonName)}&mediaType={Photo|Audio|Video}
```

**Count cells — zero**
Unchanged: Minus icon, #D1D5DB, no link.

## Component Usage
- Table structure: unchanged (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<td>`)
- Column header click: plain `onClick` on `<th>` element
- Count link: plain `<a>` element — no new component needed
- Dash display: existing `<Minus>` icon from lucide-react — unchanged

## Design Tokens Applied
- Active sort column header: `#0F1117`
- Sort arrow indicator: `#2D8653` (--primary)
- Count links: `#2D8653` (--primary) — matches existing count style
- Hover sort header: `#3F3F46`
- Inactive header: `#71717A` — unchanged
- Dash: `#D1D5DB` — unchanged

## Interaction Notes
- Column header click: if clicking a different column, sort by that column with its default direction. If clicking the active column, toggle direction.
- Count link click: opens new tab. No interaction with sort or filter state.
- All existing filter pill interactions unchanged.

## Content Notes
- No copy changes beyond what the column header removal implies.
- Soundscape rows: count links work normally — `taxaName=Soundscape` in the URL.
