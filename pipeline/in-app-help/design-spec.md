# Design Spec -- In-App Help Documentation
**Feature:** in-app-help
**Session:** 001
**Stage:** 4 -- The Designer
**Source:** prd.md, schema.md (approved)

---

## Settings Tab -- Entry Point

### Section placement
Help & Documentation is the **first** section in Settings, above API Keys, Default Files, and Tab Layout. It uses the same section divider pattern as existing sections: a flex row with an icon (question-mark circle), "Help & Documentation" label (uppercase, `var(--sr-text-muted)`), and a `var(--sr-border)` divider line.

### Help entry card
A single card below the divider, using the same `section-card` border/radius/shadow style. Internal layout is a horizontal flex row with three elements:
- **Icon wrap** -- 40x40px, `border-radius: 10px`, background `var(--sr-accent-bg)`, border `var(--sr-accent-border)`, BookOpen SVG in `var(--sr-accent)`
- **Body** -- flex:1; title "SnowRaven Documentation" (13.5px, weight 600, `var(--sr-text)`); subtitle "Setup guides, feature walkthroughs, and API key instructions. Available offline. Also readable on GitHub." (12px, `var(--sr-text-muted)`)
- **Button** -- primary style ("Open documentation") with external-link icon

---

## Help Overlay

### Container
- `position: fixed; inset: 0; z-index: 1200`
- Background: `var(--sr-surface)`
- Flex column: sticky header + scrollable body

### Header (sticky)
- Height 52px, `border-bottom: 1px solid var(--sr-border)`
- Left: BookOpen icon in `var(--sr-accent)` + "SnowRaven Documentation" label (14px, weight 600)
- Right: X close button (32x32px, `aria-label="Close documentation"`)
- Stays fixed at top while content scrolls

### Body layout
- Two-column flex: sidebar TOC (200px, sticky) + main content (flex:1, max-width 680px)
- Max-width 1100px, centered, 24px horizontal padding, 40px gap

### Table of contents (sidebar)
- "CONTENTS" heading (10.5px, uppercase, `var(--sr-text-disabled)`)
- One button per top-level section; subsections indented 10px, slightly smaller
- Active item: `var(--sr-accent-bg)` background, `var(--sr-accent)` text, weight 600
- Hover: `var(--sr-surface-subtle)` background
- Sections: Getting Started, API Keys (eBird API key, OpenWeather API key), Default Files (eBird backup, ML export), Weather, Species Detail, Statistics, Map Explorer, Media List, Breeding Codes, Life List Comparer, Settings

### Content typography

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| H1 | 26px | 700 | `var(--sr-text)` |
| Intro paragraph | 15px | 400 | `var(--sr-text-muted)` |
| H2 | 18px | 700 | `var(--sr-text)` + `var(--sr-border-subtle)` underline |
| H2 icon | 22x22px badge | -- | `var(--sr-accent-bg)` bg, `var(--sr-accent)` icon |
| H3 | 11px | 700 | `var(--sr-text-muted)`, uppercase, letter-spacing 0.04em |
| Body | 14px | 400 | `var(--sr-text)`, line-height 1.75 |
| Inline code | 12.5px | 400 | `var(--sr-surface-subtle)` bg, `var(--sr-border)` border |
| Links | 14px | 400 | `var(--sr-accent)` |

### Callout boxes
- Background `var(--sr-accent-bg)`, border `var(--sr-accent-border)`, radius 8px
- Left-aligned icon in `var(--sr-accent)` + body text (13.5px)
- Used for: eBird key privacy note; OpenWeather One Call by Call subscription warning

### Numbered steps
- Circle badge (22px, `var(--sr-accent)` bg, white text, weight 700) + body text
- Used in Getting Started setup sequence

### Interaction
- Clicking "Open documentation" opens overlay (body overflow hidden)
- X button closes overlay
- Escape key closes overlay (global keydown listener)
- Focus is trapped within overlay while open (NFR-03)

---

## Theme Compliance
All colors use `var(--sr-*)` tokens exclusively. No hardcoded hex values in `HelpDocs.tsx`. The overlay inherits the active `data-theme` attribute from `<html>`.
