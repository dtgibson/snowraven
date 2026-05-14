# Design Spec — Multi-Select Filter Pills
**Feature:** multi-select-filter-pills
**Session:** 001
**Stage:** 4 — The Designer
**Source:** prd.md, schema.md (approved)

---

## Layout

### Controls row (both tabs)
Flex row, `justify-content: space-between`, `align-items: center`.
- **Left:** pills group — `display: flex; gap: 6px; flex-wrap: wrap; align-items: center`
- **Right:** count label + ghost action buttons (↓ Show all, Load new file)

### Pill ordering — Breeding Codes tab
`[All] [Clear] [code pills in tier order: Tier 4 → Tier 3 → Tier 2 → Tier 1]`

### Pill ordering — Media List tab
`[All] [Clear] [separator] [No photo] [No audio] [No video] [separator] [Has photo] [Has audio] [Has video]`

Separators are `1px × 20px` vertical rules (`background: #E4E4E7`), used to visually group the "No" pills from the "Has" pills.

---

## Pill Components

### Standard pill (Media List)
```
height: 30px
padding: 0 12px
border-radius: 6px
font-size: 12px
font-weight: 500
border: 1.5px solid #E4E4E7
background: #fff
color: #71717A
```

**Visual states:**
| State | Border | Background | Text |
|---|---|---|---|
| Inactive (default) | `#E4E4E7` | `#fff` | `#71717A` |
| Hover | `#E4E4E7` | `#F4F4F5` | `#71717A` |
| Active — All / Has | `rgba(45,134,83,0.25)` | `#E8F5EE` | `#2D8653` |
| Active — No | `rgba(239,68,68,0.3)` | `#FEF2F2` | `#DC2626` |

Each pill has a small (11×11px) inline SVG icon matching its media type (camera / mic / video camera) at `stroke-width: 2.5`.

### "All" pill
Same base style as standard pill. Shows `active-all` (green) style when no filters are active on its tab. Reverts to inactive when any filter is selected.

### "Clear" pill
Same base style as standard pill, always in inactive/neutral state (never changes color). Carries a small ✕ SVG icon (9×9px, `stroke-width: 2.5`). Clicking it calls the same reset function as "All". Placed immediately after "All" in the pills group, before any separators or code pills.

### Breeding code pill
```
height: 30px
padding: 0 12px
border-radius: 6px
font-size: 12px
font-weight: 500
border: 1.5px solid transparent
background: none
color: #71717A
```

Each code pill contains a 14×14px filled circle (the tier dot) before the code label.

**Inactive state:** `border: 1.5px solid #E4E4E7; background: #fff; color: #71717A`

**Active state:** border and background derived from tier color with low opacity:
- `background: rgba(R,G,B,0.08)` (tier color at 8%)
- `border-color: rgba(R,G,B,0.3)` (tier color at 30%)
- `color:` tier color at full opacity

**Tier colors:**
| Tier | Color | Codes |
|---|---|---|
| Confirmed (high) | `#3B0764` | NY NE FS FY CF FL ON UN DD |
| Confirmed (also) | `#6B21A8` | NB CN |
| Probable | `#9333EA` | PE B A N C T P M S7 |
| Possible | `#C084FC` | S H F |

---

## Count Label

`font-size: 12px; color: #71717A`

Format:
- No active filters: `"N species"` (e.g. `"47 species"`)
- Any active filters: `"X of N species"` (e.g. `"3 of 8 species"`)

The total N is the total count in state (all species in the loaded data), not a hardcoded value. X is the count of rows currently passing the filter.

---

## Callout Banner

Both tabs show an informational banner above the controls row when data is loaded. Green-tinted (`background: #E8F5EE; border: 1px solid rgba(45,134,83,0.2)`), 12px text, `color: #1A5C38`, with a small info circle SVG icon. Explains multi-select and mentions both "All" and "Clear" as reset options.

---

## Interaction Summary

### Media List
- `mlState = { photo: null, audio: null, video: null }` — each dimension independent
- Clicking a pill sets that dimension's state; clicking it again toggles it back to null
- Clicking "Has [type]" while "No [type]" is active replaces it (and vice versa) — no manual deselect needed
- "All" and "Clear" both reset all three dimensions to null
- Filter applied as AND: a species must pass every non-null dimension check

### Breeding Codes
- `bcActive = Set<string>` — empty = All, populated = AND filter
- Clicking an inactive code pill adds it to the set; clicking an active one removes it
- "All" and "Clear" both clear the set
- Filter applied as AND: a species must have every code in `bcActive`

---

## Reference
Interactive mockup: `pipeline/multi-select-filter-pills/design.html`
