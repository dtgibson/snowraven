# Design Spec — Stats Enhancements
**Feature:** stats-enhancements
**Session:** 001
**Stage:** 4 — The Designer
**Date:** 2026-05-24

---

## Design Direction

Six targeted sections within `BirdingStats.tsx`, each with its own visual treatment. The overall aesthetic stays consistent with the existing stats tab: white cards, `var(--sr-*)` tokens, compact typography.

---

## Section 1: Life List Milestones (Denser Schedule)

**Layout:** Wrapped flex grid, `gap: 8px`, pills align to flex-start.

**Pill anatomy (uniform sizing, all pills identical dimensions):**
- `padding: 10px 14px`, `border-radius: 10px`, `min-width: 70px`
- `position: relative` — to anchor the checkmark badge
- Three stacked elements: number (top), species name (middle), date (bottom)

**Four color tiers — determined by milestone value:**

| Tier | Range | Background | Border | Number color | Date color |
|------|-------|------------|--------|--------------|------------|
| t1 | 10–90 | `linear-gradient(160deg, #F2FAF5, #E8F5EE)` | `rgba(45,134,83,0.28)` | `#2D8653` | `#5EA07C` |
| t2 | 100–475 | `linear-gradient(160deg, #E5F3EC, #D8EDE4)` | `rgba(28,100,60,0.32)` | `#1C6443` | `#3E7A56` |
| t3 | 500–950 | `linear-gradient(160deg, #D6EAE0, #C6E2D5)` | `rgba(18,74,44,0.38)` | `#14502E` | `#2D6644` |
| t4 | 1000+ | `linear-gradient(160deg, #FEFAEC, #FEF3C7)` | `rgba(146,64,14,0.32)` | `#92400E` | `#B45309` |

**Reached pills:**
- Tier background + border as above
- Checkmark badge: `position: absolute; top: 5px; right: 6px` — 13×13px filled circle, `background: #2D8653` (t1–t3) or `#B45309` (t4), white `✓` at 8px/700

**Unreached pills:**
- Plain `#FAFAFA` background, `#E4E4E7` border, `opacity: 0.28`
- Number in `#A1A1AA`, date in `#A1A1AA`, no checkmark badge

**Species name:** 10px, `#71717A`, truncated with ellipsis at `max-width: 84px`

---

## Section 2: Checklists by Year (Per-Year Stats)

**Layout:** Full-width table, 4 columns.

**Column headers:** 11px, uppercase, `#A1A1AA` — Year · Checklists · Species · Best Day

**Per-row data:**
- **Year:** 13px/600, `#0F1117`
- **Checklists:** inline bar (green fill, `#E8F5EE` track, proportional to max year) + count label right-aligned
- **Species:** 12px/500, `var(--sr-accent)` green, right-aligned
- **Best Day:** link to `https://ebird.org/checklist/{submissionId}` when submissionId passes `SUBMISSION_ID_RE`; plain text if not. Color matches species column when linked; `#71717A` when plain.

---

## Section 3: Top Locations Map

**Placement:** Below the two "Top Locations" text lists, above Counties, within Geographic Stats.

**Container:** `border-radius: 8px`, `border: 1px solid var(--sr-border)`, `height: 320px`

**Marker types:**
- **Set A — top by checklists:** Green filled circle, SVG `<circle>`, `fill: var(--sr-accent)` (or token equivalent)
- **Set B — top by species:** Blue filled square, SVG `<rect>` with slight `rx`, `fill: #3B82F6` (or token equivalent if defined)
- Each marker: rank number as centered white text label inside the shape
- Size: ~24px diameter / side

**Popup on click:** Location name + metric (e.g. "Radnor Lake · 47 checklists" or "Radnor Lake · 112 species")

**Legend:** Below map, flex row — green circle swatch + "Top by checklists" label; blue square swatch + "Top by species" label.

**Edge cases:**
- Location in both lists: receives one circle and one square at the same coordinates
- No locations with lat/lng: map section does not render at all

**Fit:** `fitBounds` with 20px padding; single-marker fallback uses `setView` at zoom 12.

---

## Section 4: Single-Checklist Birds (Renamed)

No visual change from current "One-and-Done Birds" section. Heading, subheading copy, and pill layout are identical — only the name changes.

**Subheading copy:** "Species you've seen on exactly one checklist · {n} birds"

---

## Section 5: One-and-Done Birds (New)

Identical visual treatment to Single-Checklist Birds above it.

**Subheading copy:** "Species where your total individual count is exactly 1 · {n} birds"

**Empty state:** "No one-and-done birds in your data."

---

## Section 6: Nemesis Birds

Same row layout as current implementation. Name becomes a link.

**Link style:** `color: var(--sr-accent)`, no underline at rest, underline on hover, `target="_blank" rel="noreferrer"`

**Fallback:** plain text in default color when taxon code is unresolvable — no broken link, no visual indicator of failure

---

## Color Tokens

All production code must use `var(--sr-*)` tokens. The design mockup uses hex equivalents for clarity. No new tokens are needed — existing `var(--sr-accent)`, `var(--sr-border)`, `var(--sr-text-muted)`, `var(--sr-bg-subtle)` cover all cases. The milestone tier colors are inline styles specific to the milestone pills.

If a blue token is not yet defined for the map's species markers, add `--sr-map-species` in both `:root` and `[data-theme="dark"]` in `globals.css` before use.
