# Design Spec — Media Sex & Age Filters

## Visual Direction
Quiet utility, fully within the established SnowRaven system. The two new filters are native `<select>` controls indistinguishable in style from the existing County filter; accent green appears only when a facet is active. No new visual language, no deviations from `design-system.md`.

## Screens / Views

### Multimedia tab — controls row (`LifeList.tsx`)
- Two native `<select>` dropdowns added to the existing controls cluster, placed **after the Has-photo/audio/video pills** (the media-content group), before the County select:
  - **Sex** — options: *Any sex* (default/clear), Male, Female.
  - **Age** — options: *Any age* (default/clear), Juvenile, Immature, Adult.
- Each control: the default option labels the category (*Any sex* / *Any age*); a `▾` chevron; **no leading icon** (no purposeful Lucide glyph for these; the design system uses icons only where they aid comprehension).
- **Active state** (a value selected): accent styling identical to the County control when active — `--sr-accent-border-strong` border, `--sr-accent-bg` background, `--sr-accent` text.
- Key decisions: native `<select>` per the design system's categorical-filter pattern (not pills, not the cycling tri-state); placement in the media cluster (movable beside County on request); self-labeling default option in lieu of an icon.

### Multimedia tab — table + count (`LifeListTable.tsx`)
- Per-species photo/audio/video counts reflect the active facet (filtered subset); a count of 0 renders muted (non-link), as today.
- Species with zero matching media are hidden while a facet is active.
- The header "X of N species" count updates (existing `aria-live` region).

## Component Usage
- Native `<select>` (the established County/protocol filter pattern) — not shadcn Select; this tab uses inline-styled native controls throughout and the new filters match them.
- Existing media pills, sort toggle, toggles, County select, and date inputs are unchanged.
- Macaulay links continue through the shared `OutboundLink` / `mlCatalogUrl`.

## Design Tokens Applied
- Inactive control: `--sr-border`, `--sr-surface`, `--sr-text-muted`.
- Active control: `--sr-accent-border-strong`, `--sr-accent-bg`, `--sr-accent`.
- Type: 0.75rem / 500 control text (the label/caption role), matching the existing controls.
- Every color via `var(--sr-*)`; both themes inherited, no new tokens.

## Interaction Notes
- Selecting a facet immediately re-filters the table, updates the per-species counts and the species count, applies the active styling, and appends the facet to the Macaulay links.
- The existing **All** reset clears the Sex and Age selections along with the media pills.
- Composes (AND) with every existing filter (media pills, Has media, Is Target, County, date range).
- Keyboard operable; each control carries an explicit accessible name ("Sex", "Age").

## Content Notes
- Default option text: "Any sex" / "Any age" (self-labeling, neutral).
- Option labels: Male, Female; Juvenile, Immature, Adult — matching the parser's vocabulary and the birder's mental model.
- No promotional copy; the controls are silent utility.
