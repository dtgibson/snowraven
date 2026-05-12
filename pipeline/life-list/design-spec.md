# Design Spec — Life List
**Feature:** life-list
**Date:** 2026-05-12
**Stage:** 4 — The Designer
**Source:** prd.md, strategic-brief.md (approved)

---

## Layout

The Life List tab follows the same display-toggle pattern as Weather and List Comparer. It owns a full-height flex column panel containing:
1. Controls row (filter buttons + count + sort toggle + expand toggle + load new file)
2. Table (flex: 1, min-height: 0, overflow-y: auto in default mode)

In **expanded mode** the table switches to `flex: none; overflow-y: visible` and `body` overflow becomes `auto`, allowing the full species list to render for printing.

---

## Controls Row

Single flex row, `justifyContent: 'space-between'`, `alignItems: 'center'`, `gap: 12`, `marginBottom: 14`.

**Left — filter buttons:**

```tsx
// pill buttons, one active at a time
// All · No photo · No audio · No video
// Each "No X" button includes the relevant lucide icon (12px) inline
```

Active filter button style:
- `background: '#E8F5EE'`, `color: '#2D8653'`, `border: '1.5px solid rgba(45,134,83,0.25)'`

Inactive:
- `background: '#fff'`, `color: '#71717A'`, `border: '1.5px solid #E4E4E7'`

All buttons: `height: 30px`, `padding: '0 12px'`, `borderRadius: 6`, `fontSize: 12`, `fontWeight: 500`.

**Right — count + sort + expand + reset:**

- **Count label:** `fontSize: 12`, `color: '#71717A'` — e.g. `"312 species"` or `"47 of 312 species"`
- **Sort toggle:** segmented control (two joined buttons), `height: 28`, `fontSize: 11`, `fontWeight: 500`. Active segment: `background: '#F4F4F5'`, `color: '#0F1117'`. Inactive: `background: '#fff'`, `color: '#71717A'`. Border between segments: `1.5px solid #E4E4E7`.
- **Show all / Collapse button:** same ghost style as "Load new file". When expanded: `background: '#E8F5EE'`, `color: '#2D8653'`, `border: '1.5px solid rgba(45,134,83,0.25)'`.
- **Load new file button:** `height: 28`, `padding: '0 10px'`, `background: 'none'`, `border: '1.5px solid #E4E4E7'`, `borderRadius: 6`, `fontSize: 11`, `fontWeight: 500`, `color: '#71717A'`.

---

## Table

Container: `border: '1px solid #E4E4E7'`, `borderRadius: 10`, `background: '#fff'`.

Default mode: `flex: 1`, `minHeight: 0`, `overflowY: 'auto'`.
Expanded mode: `flex: 'none'`, `minHeight: 'auto'`, `overflowY: 'visible'`.

### Header row

`position: sticky`, `top: 0`, `background: '#F9FAFB'`, `borderBottom: '1px solid #E4E4E7'`.
`fontSize: 11`, `fontWeight: 600`, `letterSpacing: '0.06em'`, `textTransform: 'uppercase'`, `color: '#71717A'`.
`padding: '10px 14px'`.

Column headers (with lucide icons at 11px, strokeWidth 2.5):
- **Species** — left-aligned, `minWidth: 200`, no icon
- **Seen** — centered, `width: 72` — `Eye` icon
- **Photo** — centered, `width: 72` — `Camera` icon
- **Audio** — centered, `width: 72` — `Mic` icon
- **Video** — centered, `width: 72` — `Video` icon

### Data rows

`borderBottom: '1px solid #F4F4F5'`. Last row: no border. Hover: `background: '#FAFAFA'`.
`padding: '9px 14px'`, `verticalAlign: 'middle'`.

**Species cell** — two-line flex column, `gap: 1`:
- Common name: `fontSize: 13.5`, `fontWeight: 500`, `color: '#0F1117'`
- Scientific name: `fontSize: 11.5`, `color: '#9CA3AF'`, `fontStyle: 'italic'`

**Media cells** — centered, `width: 72`.

### Status indicators

✓ present: `<Check size={16} strokeWidth={2.5} style={{ color: '#2D8653' }} />`
— absent: `<Minus size={16} strokeWidth={2.5} style={{ color: '#D1D5DB' }} />`

Seen column is always ✓.

---

## Loading State

Full-height centered flex column, `gap: 16`:
- Spinning `Loader2` icon, `size={32}`, `color: '#2D8653'`
- Label: `"Looking up media… batch 4 of 11"`, `fontSize: 13`, `color: '#71717A'`
- Progress bar: track `280px × 4px`, `background: '#E4E4E7'`, `borderRadius: 2`. Fill: `background: '#2D8653'`, width driven by `current/total` ratio.
- Sub-label: `"{n} species · checking Macaulay Library"`, `fontSize: 12`, `color: '#9CA3AF'`

---

## Drop Zone State

Reuses existing `DropZone` component. Label: `"Drop your eBird backup file here"`. Sub-label: `"Or click to browse — select MyEBirdData.csv"`.

---

## Icon Reference (lucide-react)

| Usage | Icon | Size | StrokeWidth |
|---|---|---|---|
| Life List tab | `List` | 14 | 2.5 |
| Seen column header | `Eye` | 11 | 2.5 |
| Photo column header | `Camera` | 11 | 2.5 |
| Audio column header | `Mic` | 11 | 2.5 |
| Video column header | `Video` | 11 | 2.5 |
| No photo filter | `Camera` | 11 | 2.5 |
| No audio filter | `Mic` | 11 | 2.5 |
| No video filter | `Video` | 11 | 2.5 |
| ✓ present | `Check` | 16 | 2.5 |
| — absent | `Minus` | 16 | 2.5 |
| Loading spinner | `Loader2` | 32 | 2 |

---

## Token Reference

| Token | Value |
|---|---|
| Green accent | `#2D8653` |
| Green tint bg | `#E8F5EE` |
| Green tint border | `rgba(45,134,83,0.25)` |
| Border default | `#E4E4E7` |
| Muted text | `#71717A` |
| Very muted text | `#9CA3AF` |
| Row separator | `#F4F4F5` |
| Row hover | `#FAFAFA` |
| ✓ color | `#2D8653` |
| — color | `#D1D5DB` |
