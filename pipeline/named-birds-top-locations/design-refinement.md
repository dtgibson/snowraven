# Design Refinement — Named Birds Top Locations

## Visual Direction

A third section of the existing Named Birds card, not a new component: same
uppercase micro-label idiom as "Where {name} has been seen" and "Media of
{name}", same flat treatment on `--sr-surface-faint` (no card inside a card),
same restrained color. Quiet utility — the block answers "where does this bird
hang out" in four lines and then gets out of the way.

## Screens / Views

### Named Birds card — expanded (Named Birds tab only)

Order inside the expanded body is unchanged except for the insertion:
sighting reports → **Top locations (new)** → sightings map → media section.

- **Section label:** micro-label, `MapPin` icon at 12px / strokeWidth 2.2,
  text `Top locations` — 0.6875rem, weight 700, `letter-spacing: 0.04em`,
  uppercase, `--sr-text-muted`, 6px gap, 7px bottom margin. Identical to the
  map and media labels. Deliberately NOT "Where {name} has been seen most" —
  the map header immediately below owns that phrasing.
- **Block padding:** `12px 14px 2px`, matching the map block's `12px 14px 14px`
  top and sides. Bottom padding closes to `14px` only when the block is the
  last thing in the card (no map, no media).
- **Row:** flex, 10px gap, `7px 0` padding, `1px solid --sr-border-subtle`
  bottom border, none on the last row.
  - **Rank:** `{n}.` — 0.6875rem, `--sr-text-muted`, `min-width: 16px`,
    right-aligned, tabular numerals, `flex-shrink: 0`.
  - **Name:** `HotspotLink` with `truncate`, 0.75rem, `flex: 1`, `min-width: 0`.
    Public hotspot → accent link to its eBird page; personal location → plain
    `--sr-text-muted` text. Same component and same rule as everywhere else.
  - **Count:** `{n} sighting` / `{n} sightings` — 0.6875rem, `--sr-text-muted`,
    `white-space: nowrap`, tabular numerals, `flex-shrink: 0`.
  - The name is the only thing that shrinks: a long place name ellipsizes and
    the count never leaves the row. Same behaviour as the report rows above.
- **Default cap: 5 rows.** Species Detail shows 10; a card inside a single-open
  accordion cannot afford that.
- **Expander (only when > 5 locations):** the app's existing control, scaled to
  the card — full width, `9px 0 10px`, top border `--sr-border-subtle`,
  transparent background (not `--sr-surface-faint`, which the card body already
  is), `ChevronDown` 13px, 0.75rem weight 500 `--sr-accent`. Label
  `Show all {n} locations` ⇄ `Show top 5`. `aria-expanded` on the button; hover
  fills `--sr-accent-bg`; `:focus-visible` gets a 2px accent outline inset.

### Degenerate shapes

- **Exactly one distinct location:** no ranking, no numbers, no expander — a
  single line reading `Every sighting at {location}.` with the location name in
  `--sr-text` weight 600 (a `HotspotLink` when it is a hotspot). It wraps
  normally rather than truncating.
- **No location names at all:** the whole block is absent — heading included.
  Mirrors the map, which does not render for a bird with no coordinates, and
  the report row, which omits the location when the export has none.

## Component Usage

- `HotspotLink` (`truncate`) for every location name. `useHotspotSet()` stays
  called once in `NamedBirdsTable`; `isHotspot` is already passed into
  `NamedBirdRow` and is reused here — never a per-row hook.
- `MapPin` and `ChevronDown` from lucide-react, both already imported elsewhere
  in the tab's tree.
- No new component library surface, no new dependency.

## Design Tokens Applied

`--sr-text-muted` (label, rank, count, personal location), `--sr-text` (the
single-location name), `--sr-accent` (hotspot links, expander), `--sr-accent-bg`
(expander hover), `--sr-border-subtle` (row separators, expander top border).
No new token is minted; no hardcoded color anywhere.

## Interaction Notes

- The block renders only when the row is expanded — it lives inside the
  existing `{open && (…)}` body, so it mounts and unmounts with the row.
- Show-all state is per-row and resets when the row collapses (the row unmounts,
  same as the media section's reveal count). No persisted setting.
- Gated to the Named Birds tab by the same `showMap` prop that gates the map and
  media. Species Detail's `NamedBirdsTable` reuse renders no block.
- Keyboard: the expander is a real `<button>`; rank numbers are decorative text,
  not a list the screen reader must enumerate as ranks.
- Holds at 320px and at 200% in-app text scale in both themes.

## Motion Spec

- Expander chevron rotate: `cubic-bezier(0.16, 1, 0.3, 1)`, 150ms,
  `transform-origin: center`, reduced-motion → 1ms, CSS.
- Expander hover fill: `cubic-bezier(0.16, 1, 0.3, 1)`, 140ms, no origin,
  reduced-motion → 1ms, CSS.
- Nothing animates on mount. The revealed rows appear instantly — an entrance
  animation on static content is exactly the anti-slop the doctrine names.

## Content Notes

- Label is sentence-case-in-uppercase: `Top locations`.
- Counts use the card's existing noun: "sighting" / "sightings", matching the
  header's "14 sightings", so the numbers on the card visibly reconcile.
- Single-location copy: `Every sighting at {location}.` — a statement, not an
  empty state.
- No em dashes in shipped copy (project rule).

## Considered and rejected

A proportion bar behind each row, showing dominance at a glance. Rejected: it
adds color to a surface that is deliberately almost uncolored, against the
system's stated "quiet utility" feel. Recorded here so a later run does not
re-litigate it blind.
