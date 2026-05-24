# Design Spec — Tab Order Settings

## Visual Direction
Matches the existing Settings page exactly — same card style, section headers, border radius, and color tokens. The Tab Layout section feels native to the page, not added on. The only visual novelty is the drag handle and the hidden/shown eye-toggle states.

## Screens / Views

### Settings Page — Tab Layout Section

Positioned below the Default Location section. Follows the identical section-header pattern used throughout Settings: `11px uppercase 600-weight muted label` + horizontal rule. A "NEW" badge (green, bordered, same as Default Location) appears next to the section label.

**Card interior:**
- A `card-intro` row (12px muted text, bottom border) reads: "Drag to reorder. Use the eye icon to show or hide individual tabs."
- Below it: a `<ul>` of draggable rows, one per configurable tab
- Each row: `10px 16px` padding, flex layout with three elements: drag handle · tab name · eye button
- Rows separated by `1px var(--sr-border-subtle)` top borders (same as all other Settings card rows)
- Drag-over state: `var(--sr-accent-bg)` background highlight
- Dragging item: `opacity: 0.35`

**Tab row states:**
- **Visible:** Tab name in `var(--sr-text)`, eye-on icon in `var(--sr-text-muted)`
- **Hidden:** Tab name in `var(--sr-text-disabled)`, "hidden" badge in `var(--sr-text-disabled)` (10px, `letter-spacing: 0.02em`), eye-off icon in `var(--sr-text-disabled)`
- **Last-visible (disabled eye):** Eye button non-interactive; `cursor: not-allowed`; icon color `var(--sr-border)`

**Drag handle:** 6-dot grip pattern (two columns of three dots, 1.1px radius each), `var(--sr-text-disabled)` at rest, `var(--sr-text-muted)` on hover, `cursor: grab`

**Eye button:** 28×28px borderless button, `border-radius: 6px`. Hover: `var(--sr-surface-subtle)` background. Uses Lucide-style eye / eye-off SVG (15×15px).

**Locked Settings row:** `var(--sr-surface-subtle)` background, name in `var(--sr-text-muted)`, drag handle lines (not dots — communicates non-draggable), lock icon + "always last" label in `var(--sr-text-disabled)`, no eye button.

**"Restore defaults" button:** Appears flush-right below the card (not inside it). `30px` height, `12px` text, `var(--sr-surface-subtle)` background, `var(--sr-border)` border. On click: text changes to "Restored" with `var(--sr-accent)` color for 1.5s, then reverts.

## Component Usage
- Card container: same `border: 1px solid var(--sr-border); border-radius: 10px; background: var(--sr-surface); overflow: hidden` pattern used throughout Settings
- Section header: same pattern as Appearance, API Keys, Default Files, Default Location
- Buttons: consistent with existing inline action buttons (Save / Clear in Default Location)

## Design Tokens Applied
- `--sr-accent` — "Restore defaults" confirmation state, badge text
- `--sr-accent-bg` — badge background, drag-over row highlight, badge border color via `--sr-accent-border`
- `--sr-text`, `--sr-text-muted`, `--sr-text-disabled` — three tiers of text: visible tab names, inactive icons, hidden labels
- `--sr-border`, `--sr-border-subtle` — card border, row dividers
- `--sr-surface`, `--sr-surface-subtle` — card background, locked row, button background

## Interaction Notes
- HTML5 drag-and-drop: `dragstart`, `dragover`, `drop`, `dragend` on each `<li>`; drop target idx adjusted for direction of drag (FR-04)
- Eye toggle fires immediately — no save/apply needed (FR-05, strategic brief: "changes are live")
- Active-tab-hidden guard: if `activeTab` is hidden, switch to first visible tab (FR-08)
- Last-visible protection: eye button `disabled` when `visibleCount() === 1` and this tab is the only visible one (FR-07)
- Restore button: resets `tabs` state to default order with all visible; brief "Restored" confirmation (FR-09)
- Tab bar re-renders on every state change — order and visibility reflected immediately (FR-04, FR-05)

## Content Notes
- Intro text is instructional, not decorative: "Drag to reorder. Use the eye icon to show or hide individual tabs." — direct and minimal
- "hidden" badge is lowercase — consistent with the existing `var(--sr-text-disabled)` label style elsewhere
- "always last" lock label matches the tone of other Settings captions (descriptive, lowercase)
- "Restore defaults" — not "Reset" (which implies danger); "Restore" implies recovering something, which is accurate and non-threatening
