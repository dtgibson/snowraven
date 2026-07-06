# Design Spec — Named Birds Media

## Visual Direction
A media section that reads as native to the Named Birds tab: quiet utility,
restrained green, a tidy grid of labeled tiles rather than a wall of live
players. It extends the existing Species Detail "Recent Media" embed pattern
to a second surface and matches the map block's header voice exactly. No new
brand color and no new design tokens are introduced.

## Screens / Views

### Section header (under the map block)
- Mirrors the existing map header exactly: an uppercase micro-label
  (`0.6875rem`, `700`, `letter-spacing:0.04em`, `text-transform:uppercase`,
  `--sr-text-muted`) preceded by a Lucide `Play` icon (12px, stroke 2.2),
  reading **"Media of {name}"** — deliberately rhyming with "Where {name} has
  been seen".
- A quiet right-aligned count line — **"Showing 6 of 11"** — (`0.6875rem`,
  `--sr-text-gray`) appears only when there are more assets than shown. It
  wraps below the label on narrow widths.
- A 1px `--sr-border-subtle` separator sits between the map block and the media
  section (the section renders in the same position whether or not the
  individual has a map).

### Media grid + item layout
- Reuses the app's `.sr-media-grid` (3 columns desktop, collapses to 1 column
  at ≤640px) and `.sr-media-item` — no inline breakpoint styles.
- Each item is a framed tile: `.mi-frame` (1px `--sr-border`, radius 9px,
  `--sr-surface`) containing the player region on top and a meta row beneath.
- **Meta row (below the player):** a format marker + capture date + checklist
  link, all on one line, wrapping gracefully.
  - **Format marker:** follows the app's own media-type convention (Species
    Detail's uppercase muted micro-label) — a Lucide icon + uppercase
    `--sr-text-muted` text (PHOTO / AUDIO / VIDEO). **Not** a colored chip:
    color noise would fight the "one accent per surface" rule and compete with
    the checklist link, so the green stays reserved for the actionable link.
  - **Date:** `0.75rem`, `600`, `--sr-text` — via `formatDate` (honors the
    Settings date-format preference; omitted when the row's date is empty).
  - **Checklist link:** the shared `<ChecklistLink>` (accent color, 10px Lucide
    `ExternalLink`, hover-underline, `^S\d+$` guard, label-aware accessible
    name). A `·` separator (`--sr-text-disabled`) sits between date and link.

### Per-format player sizing
Same embed URL for all types (`.../asset/<id>/embed`); only the height class
differs, all responsive (`width:100%`, never a fixed px width):
- **Photo / Video:** 230px tall desktop, 280px ≤640 (wider single column).
- **Audio:** compact 116px desktop, 130px ≤640 — a waveform strip needs far
  less height than a photo, so audio tiles don't waste vertical space.
- Engineer note: these map to per-format modifier classes on `.sr-media-iframe`
  (e.g. `.sr-media-iframe--audio`), tokens/heights only — no hardcoded colors.

### Browse affordance
- **Initial batch of 6**, newest-first (OQ-02 / OQ-03 defaults adopted).
- A single **"Show more"** control below the grid: a real `<button>`
  (`.sr-touch-target`, ~36px desktop → 44px ≤640), accent text, `--sr-border-medium`
  outline, Lucide chevron-down icon, reading **"Show 5 more (of 11)"**.
  Accessible name: "Show N more media of {name}". Clicking reveals `batchSize`
  more (default = initialCount = 6). Focus ring is the app's standard 3px accent
  outline + 6px halo.
- Chosen over lazy-on-scroll because it is explicit, keyboard-friendly, and
  composes cleanly with the single-open accordion; IntersectionObserver still
  bounds *live* players within the revealed batch.

### Offline / can't-load placeholder
- Same tile footprint as the live player (no layout shift on switch).
- A muted "cloud-off" Lucide glyph, a `--sr-text-muted` line **"Media
  unavailable offline"**, and an `<OutboundLink>`-styled **"View on Macaulay
  Library"** button (accent text/border on `--sr-accent-bg`, `encodeURIComponent`-
  wrapped `mlAssetUrl(catalogId)`, "(opens in a new tab)" cue).
- The **date + checklist link are always shown** in the meta row, in both embed
  and fallback states (they're local — known offline). The compact audio variant
  drops the message line and keeps just the glyph + link-out to fit its shorter
  box.

### Empty state
- ML loaded but this bird has no name-tagged assets → a single quiet italic
  line **"No media matched to this bird."** (`0.78rem`, `--sr-text-muted`) under
  the header. Not an empty gap, not an error.
- No ML export loaded at all → the whole section is absent (nothing rendered),
  so an ML-less user's tab is unchanged.

### Loading / lazy state
- The placeholder tile (same footprint) with a subtle shimmer
  (`--sr-surface-subtle` → `--sr-surface-faint` sweep, `prefers-reduced-motion`
  honored) and the format's own icon, shown before the item scrolls into view /
  before its embed mounts.

## Component Usage
- `.sr-media-grid` / `.sr-media-item` / `.sr-media-iframe` (reused, extended with
  per-format height classes).
- `<ChecklistLink>` (unchanged) for every checklist link.
- `<OutboundLink>` treatment for the "View on Macaulay Library" link-out.
- Lucide icons: `Play` (header), `Image` (photo), `Mic`/waveform (audio),
  `Video` (video), `CloudOff` (offline), `ChevronDown` ("Show more").
- The map-block header micro-label pattern (copied from `NamedBirdRow`).

## Design Tokens Applied
No new tokens. Uses: `--sr-surface`, `--sr-surface-subtle`, `--sr-surface-faint`,
`--sr-bg`; `--sr-text`, `--sr-text-muted`, `--sr-text-gray`, `--sr-text-disabled`;
`--sr-border`, `--sr-border-subtle`, `--sr-border-medium`; `--sr-accent`,
`--sr-accent-bg`, `--sr-accent-border`, `--sr-accent-border-strong`;
`--sr-card-shadow`. Format markers use `--sr-text-muted`/`--sr-text-gray` (no
color chip). All correct in both light `:root` and `[data-theme="dark"]`.

## Interaction Notes (for the Engineer)
- Embeds mount only when the row is open AND the item is in view
  (IntersectionObserver), on top of the initial-6 cap + "Show more" reveal —
  concurrent live players stay bounded (FR-11/12/13, NFR-01).
- `revealCount` resets to `initialCount` on each false→true `open` transition so
  re-expanding never accumulates.
- Offline: primary trigger is the `useOnline` signal (SnowMap pattern); iframe
  `onError` + a mount-timeout are the best-effort belt for a loaded-but-broken
  embed. The metadata (date + checklist + link-out) is present regardless.
- Every iframe carries a descriptive `title` (`"{Format} of {name} ({date})"`).

## Content Notes
- Header: **"Media of {name}"**. Count: **"Showing X of Y"**. Empty:
  **"No media matched to this bird."** Offline: **"Media unavailable offline"** +
  **"View on Macaulay Library"**. "Show more" → **"Show N more (of Y)"**.
- Voice: informative and calm, matching the tab. Format markers are plain nouns
  (Photo / Audio / Video).

## Accessibility
- WCAG 2.1 AA: all text uses `--sr-text`/`-muted`/`-gray` at AA in both themes;
  placeholder/empty text uses `--sr-text-muted` (not `-disabled`). "Show more" and
  both links are real keyboard-operable controls with accessible names and ~44px
  phone touch targets; standard 3px accent focus ring. Responsive from ~320px,
  holds at 200% text scale (all rem), no horizontal page scroll; media
  `max-width:100%`. No hardcoded colors.

## Open Designer Choices (resolved with the user — approved as designed)
1. Browse affordance + default cap: **6 + "Show more" button** — approved.
2. Per-format sizing: **photo/video 230px, audio 116px** — approved.
3. Section header wording: **"Media of {name}"** — approved.
