# Design Spec — Species Links

## Visual Treatment

Two 14×14 px favicon icons rendered inline after each species common name. Icons sit in an `inline-flex` wrapper with 5px gap and 6px left margin from the name. At rest, icons are 75% opacity; on hover they reach full opacity. No border, background, label, or tooltip.

## SpeciesLinks Component

- **Renders:** when `speciesCode` is truthy
- **Returns null:** when `speciesCode` is undefined or empty
- **Wrapper:** `display: inline-flex; align-items: center; gap: 5px; margin-left: 6px; vertical-align: middle`
- **Each icon:** `<a target="_blank" rel="noreferrer">` wrapping `<img width=14 height=14>`
- **Error handling:** `onError → img.style.display = 'none'` — no broken-image placeholder

## Links and Favicons

| Site | Link | Favicon |
|------|------|---------|
| eBird | `https://ebird.org/species/{speciesCode}` | `https://ebird.org/favicon.ico` |
| Birds of the World | `https://birdsoftheworld.org/bow/species/{speciesCode}/cur/introduction` | `https://birdsoftheworld.org/favicon.ico` |

## Placement

**LifeListTable.tsx** — icons appear after the common name span, inside a flex row container. Scientific name remains below on its own line (column layout unchanged).

**SpeciesPanel.tsx** — icons appear after the species name text within each `<li>`. The `<li>` switches to `display: flex; align-items: center` to keep icons vertically centered.

## States

| State | Appearance |
|-------|-----------|
| Code available | Both icons visible at 75% opacity |
| Code not available (soundscape, pending fetch) | No icons rendered |
| One favicon fails to load | That `<img>` hidden; other icon still shows |
| Both favicons fail | No icons visible; no broken placeholder |

## Design Reference

`pipeline/species-links/design.html` — open with:
```
open "/Users/dtgibson/Library/Mobile Documents/com~apple~CloudDocs/Programming/weft.build/SnowRaven/pipeline/species-links/design.html"
```
