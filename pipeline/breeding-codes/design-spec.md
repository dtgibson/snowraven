# Design Spec — Breeding Code List

## Circle Cells

- **Diameter:** 28px · `border-radius: 50%`
- **Text:** white · 11px · font-weight 700 · letter-spacing -0.3px · centered via inline-flex
- **Empty cells:** no element rendered — truly blank, no dash or placeholder

## Tier Colors

| Tier | Category | Color |
|------|----------|-------|
| 4 | Confirmed (highest): NY NE FS FY CF FL ON UN DD | `#3B0764` |
| 3 | Confirmed (also): NB CN | `#6B21A8` |
| 2 | Probable: PE B A N C T P M S7 | `#9333EA` |
| 1 | Possible: S H F | `#C084FC` |

## Column Headers

- Font: 11px · uppercase · font-weight 600 · letter-spacing 0.06em
- Active column: `#0F1117` · sort indicator `↑` or `↓` in `#2D8653` · 10px
- Inactive columns: `#71717A`
- Header background: `#F9FAFB` · sticky top
- Full code label in `title` attribute for tooltip discoverability
- Code column width: 44px

## Species Name Column

- Width: 190px (min-width)
- Font: 13.5px · font-weight 500 · `#0F1117`
- Sticky left: `position: sticky; left: 0; background: #fff; z-index: 1`
- Right edge separator: `box-shadow: 1px 0 0 #E4E4E7`

## Table Scroll

- Wrapper: `overflow-x: auto`
- Species column always visible; code columns scroll horizontally
- Row hover: `background: #FAFAFA` (both sticky and non-sticky cells)

## Filter Pills

- Layout: `display: flex; flex-wrap: wrap; gap: 6px`
- **All pill (active):** `background: #E8F5EE; border: 1.5px solid rgba(45,134,83,0.25); color: #2D8653`
- **Code pill (inactive):** ghost button — `border: 1.5px solid #E4E4E7; background: #fff; color: #71717A`
- **Code pill (active):** border and background tinted with tier color:
  - Tier 4 active: `background: rgba(59,7,100,0.08); border-color: rgba(59,7,100,0.3); color: #3B0764`
  - Tier 3 active: `background: rgba(107,33,168,0.08); border-color: rgba(107,33,168,0.3); color: #6B21A8`
  - Tier 2 active: `background: rgba(147,51,234,0.08); border-color: rgba(147,51,234,0.3); color: #7E22CE`
  - Tier 1 active: `background: rgba(192,132,252,0.15); border-color: rgba(192,132,252,0.5); color: #7E22CE`
- Each pill: 14px colored dot (`border-radius: 50%`, tier color) + code text label
- Pill height: 30px · padding: 0 12px · font-size: 12px · font-weight 500

## Legend

- Rendered at the bottom of the table card, inside the border
- `background: #FAFAFA; border-top: 1px solid #F4F4F5; padding: 12px 16px`
- `display: flex; flex-wrap: wrap; gap: 16px`
- Each item: 18px colored circle + 11px `#71717A` label text listing codes for that tier

## Count Label

- Format: `"8 species"` (all) or `"3 of 8 species"` (filtered)
- Font: 12px · color `#71717A`

## Design Reference

`pipeline/breeding-codes/design.html` — open with:
```
open "/Users/dtgibson/Library/Mobile Documents/com~apple~CloudDocs/Programming/weft.build/SnowRaven/pipeline/breeding-codes/design.html"
```
