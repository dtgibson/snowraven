# Design Spec — Checklist Confirmation Header

## Visual Direction
Quiet and subordinate — the confirmation line should read like a reference tag, not a UI headline. It uses monospace type and muted color to stay out of the way of the weather output while still being immediately readable.

## Screens / Views

### Weather Tab — Success State

The confirmation line is inserted between the `<hr>` divider and the "Weather output" label row. It occupies a single line and requires no additional container or card.

Key design decisions:
- Font: `ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace` — matches the output pre block, giving the line a "reference code" quality
- Font size: 12px
- Color: `#71717A` (muted-foreground token) — visually subordinate to the weather output
- Margin: `margin-bottom: 14px` to give breathing room before the "Weather output" label row
- No icon, no border, no background — plain text only
- Format: `{checklist_id} / {loc_name} / {obs_dt}`

## Component Usage
No new components. The confirmation is a plain `<div>` with inline styles consistent with the rest of App.tsx.

## Design Tokens Applied
- `#71717A` — muted-foreground, for the confirmation text color
- `ui-monospace` font stack — same as the `<pre>` output block

## Interaction Notes
- Rendered only when `state.status === 'success'`
- No hover state, no interaction — display only
- Disappears when a new lookup begins (loading state) or on error

## Content Notes
Format is fixed: `{checklist_id} / {loc_name} / {obs_dt}` where `obs_dt` is `YYYY-MM-DD HH:MM` (or `YYYY-MM-DD` if no time is available). No label prefix, no punctuation beyond the slashes.
