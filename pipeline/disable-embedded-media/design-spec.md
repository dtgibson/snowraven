# Design Spec — Disable Embedded Media

## Visual Direction

Extend SnowRaven's established quiet-utility design without introducing a new visual language. The control should feel like a normal Settings preference, while the disabled media state should read as calm, intentional, and informational rather than as an error or empty-data state.

## Screens / Views

### Settings

Add one row labeled **Disable embedded media** in the existing display/media preferences area. Use the shipped Settings row hierarchy: a short 600–700-weight label, muted explanatory copy beneath it, and the existing keyboard-operable switch aligned at the trailing edge.

- The switch is off by default, so embedded media remains enabled.
- Supporting copy: “Prevents inline Macaulay Library players from loading. Direct media links remain available.”
- No new card, modal, confirmation, or Save button.
- A successful change applies immediately. A persistence failure restores the last durable value and uses the existing inline Settings error treatment.
- While the saved preference is hydrating, embed eligibility stays closed; the control must not flash a misleading durable state.

### Species Detail — Recent Media

Keep the existing Recent Media section, format labels, capture dates, checklist links, and Macaulay Library links. When embeds are disabled, replace each eligible player region with one restrained inset state carrying the exact sentence **“Embedded media is disabled in Settings.”**

- Do not render an iframe, shimmer, player error, or offline-player fallback.
- Use the existing player footprint so surrounding content does not jump.
- The note is neutral and centered, with muted text and an optional purposeful media-off glyph; it is not styled as an error.
- Do not show the note when the species has no embed-backed recent media.

### Named Birds — Media

Keep each named individual's existing media heading, format/date metadata, checklist links, direct asset links, batching, and no-media states. For an expanded individual with matched media, replace the player region with the same disabled state used by Species Detail.

- Show one consistent disabled note for the individual's media area.
- Do not show the note when no ML export is loaded or the individual has no matched assets.
- Turning embeds back on restores the current lazy, resilient player treatment without reopening the row.

## Component Usage

- Reuse the existing Settings row and `ToggleSwitch` conventions; do not introduce a new switch component.
- Keep `MediaFrame` as the sole Macaulay iframe constructor and preserve the current `RecentMediaEmbed` and `NamedBirdMedia` composition.
- Add one shared disabled-player presentation so Species Detail and Named Birds cannot drift in copy or appearance.
- Continue using `ChecklistLink`, `OutboundLink`, and `mlAssetUrl` for the retained destinations.
- Use existing Lucide icon conventions only where the media-off glyph clarifies the state.

## Design Tokens Applied

- Typography: SnowRaven's existing headline, body, and label roles; no font change.
- Backgrounds: `--sr-surface`, `--sr-surface-faint`, and `--sr-surface-subtle`.
- Text: `--sr-text`, `--sr-text-muted`, and `--sr-text-gray`.
- Borders: `--sr-border`, `--sr-border-subtle`, and `--sr-border-medium`.
- Interactive state: `--sr-accent`, `--sr-accent-bg`, `--sr-accent-border`, and `--sr-on-accent`.
- Radius, shadows, spacing, focus rings, dark theme, and touch targets remain the existing shipped values. No new color token is required.

## Interaction Notes

- Toggle changes propagate app-wide in the current session and persist without a separate Save action.
- Enabling disablement immediately unmounts any live Macaulay iframe and prevents delayed intersection, timer, or load callbacks from remounting it.
- Disabling the preference immediately restores embed eligibility on both surfaces.
- The disabled note is readable by assistive technology as informational status, not an alert.
- Tab order, focus visibility, 320px layouts, and 200% text resizing follow existing SnowRaven behavior.

## Motion Spec

- Settings switch: ease-out, 180ms, thumb origin at its current position, transition removed under `prefers-reduced-motion`, CSS.
- Player-to-disabled-state swap: ease-out, 180ms opacity plus at most 5px vertical settle, origin at the player region, no animation under `prefers-reduced-motion`, CSS.
- Disabled-to-player restore: use the existing embed loading/fallback behavior; do not add decorative entrance motion.

## Content Notes

The voice is plain and factual. Use **“Embedded media is disabled in Settings.”** exactly wherever a player is suppressed. Avoid warnings, blame toward Macaulay Library, troubleshooting copy, or language implying the user's media data has been removed. Settings copy should make the boundary explicit: inline players stop loading, while direct links remain available.
