# Design Spec — Named Birds Tab Upgrade

**Feature:** named-birds-tab-upgrade
**Stage:** 4 — The Designer
**Mode:** Extend the established SnowRaven design system (`brand.md` +
`frontend/src/globals.css`). No new design language, no new library. Every color
is a `var(--sr-*)` token; the one genuinely new shade is added to BOTH `:root`
and `[data-theme="dark"]` before use (per CLAUDE.md "Colors and theming").

## Visual Direction

Quiet utility — the same calm, content-first card the tab already ships, made
*legible*. The upgrade is corrective, not cosmetic: the layout, the card shape,
the green accent, the favicon treatment all stay. What changes is that real data
(dates, ranges, locations, comments) reads as primary data instead of receding,
the header looks deliberate, the comment is unmistakably a quote, and each
individual gets a small map that mirrors Species Detail. Verified in both light
and dark.

---

## Screens / Views

### Named Birds tab — header + sort + cards

Single column, max ~760px content width, matching the tab today. Card list with
a single-open accordion (the Architect's concurrency cap — opening one card
collapses the previously open one). One card is shown expanded with its map; the
rest collapsed.

Key decisions on this screen are the six items below.

---

## The six decisions (resolved, light + dark)

### 1 — Contrast lift (Parts 1 / FR-01–03)

The faint offenders move OFF the lowest-emphasis tokens. Token-only, no
hardcoded values.

| Element | Before | After | Rationale |
|---|---|---|---|
| Per-sighting **date** (expand-row) | `0.75rem` · `--sr-text-muted` | `0.75rem` **600** · **`--sr-text`** | It's the row's anchor — should read as primary. Weight + full-contrast color, not a new token. |
| Header **date-range** | `0.6875rem` · `--sr-text-muted` | **`0.75rem`** · **`--sr-text-gray`** | Lifted a legibility step (FR-03) and off muted onto the AA-safe gray (`#6B7280` light / `#8A8A92` dark). Supporting, not primary, so gray not full text. |
| **Checklist link** (`S… ↗`) | `0.6875rem` · `--sr-accent` | **`0.75rem`** · `--sr-accent` | Size nudge only (FR-03); accent already passes. |
| **Comment** | `0.8125rem` · `--sr-text` | unchanged color, now in a quoted block (item 3) | Already full-contrast; gains separation, not contrast. |
| **"N named birds"** count | `0.75rem` · `--sr-text-disabled` | **unchanged** | Explicitly permitted to stay lower-emphasis (FR-02 / QA-02) — it's passive chrome, not content. The ONLY element left on a disabled-class token. |
| **`· location ·`** | n/a (new) | `0.75rem` · `--sr-text-muted` | Muted is correct for supporting location text (matches the Media Comments pattern); it is not the weakest tier and is not `--sr-text-disabled`. |

No new contrast token is required — the lifts reuse existing tokens
(`--sr-text`, `--sr-text-gray`) which already carry documented AA ratios in both
themes. **The smallest content text is now `0.75rem`** (nothing real-content
stays at `0.6875rem`), satisfying QA-01.

### 2 — Name / species baseline alignment (Part 2 / FR-05–07)

**Root cause today:** the header row is `align-items: center`, so the large bold
individual name and the smaller species run are centered against each other and
read as misaligned.

**Fix (in `NamedBirdsTable` only, no `BirdName` default change):**
- Set the header row to **`align-items: baseline`** so the name's baseline and
  the species common-name's baseline share a line.
- The individual **name**: `0.9375rem` / weight **700** / `--sr-text` /
  `letter-spacing: -0.01em` (the display role — biggest, heaviest text on the
  card).
- The **species** still renders through `<BirdName size="sm">` (FR-07). Its
  common name is `0.84375rem` / 500, the italic scientific name `0.71875rem` /
  `--sr-text-gray` — the `sm` sizes already in `globals.css`. These sit inline
  next to the name on the shared baseline.
- The favicons and the chevron are the only header items that stay vertically
  centered (`align-self: center`) — icons have no baseline, so centering them is
  correct and reads as intentional.

If a `BirdName`-side touch is unavoidable, it is the **additive
`sr-birdname-inline`** path only (FR-06) — never a change to global `BirdName`
defaults that other tabs inherit.

Three distinct type roles on the header: **display** (name, 0.9375/700),
**body** (species common, 0.84375/500), **label/caption** (sci 0.71875 italic,
range 0.75 gray) — meaningful size and weight contrast, intentional.

### 3 — Comment quote block (Part 3 / FR-08–09)

Each comment gets its own container that is visibly distinct from both the card
surface (`--sr-surface`) and the expanded panel (`--sr-surface-faint`).

- Background: **`--sr-quote-bg`** — **NEW token** (see "New tokens" below). One
  step deeper than `--sr-surface-subtle` so the quote still separates even where
  the panel is already subtle.
- Border: `1px solid var(--sr-quote-border)` (NEW, paired) + a **3px left rule in
  `--sr-accent-border`** — the quoted-block tell, tinting it with the brand green
  without shouting.
- Radius **7px**, padding **8px 11px**, `margin-top: 5px`.
- Text stays `0.8125rem` / `--sr-text` / line-height 1.55.

> The schema's §"Styling/render changes" suggested reusing `--sr-surface-subtle`
> with no new token. I'm recommending a dedicated `--sr-quote-bg` instead: on the
> Named-Birds expand-row the panel is `--sr-surface-faint` and `--sr-surface-subtle`
> is only a hair off it in dark mode, so the quote doesn't separate cleanly. A
> purpose-named token (one step deeper) reads unambiguously as a quote in both
> themes and documents intent. **This is the deviation-from-schema flagged for
> the user** — if you'd rather not add a token, the fallback is
> `--sr-surface-subtle` + the 3px accent rule, which still reads but with less
> separation in dark. Either way it's token-only.

### 4 — Sort control, four options (Part 4 / FR-10)

Exact labels, exact order: **Name (Individual) · Alphabetical · Taxonomic · Last
Seen**.

The challenge is that **"Name (Individual)"** is far wider than the other three.
Treatment:
- Same segmented-pill group as today, but the group **`flex-wrap: wrap`**s and
  each button is `white-space: nowrap` so a label never breaks mid-word. Inner
  borders are drawn with `border-left` on every button except the first, so a
  wrapped second row still shows clean dividers (no dangling border on a row
  start — `:first-child` clears it).
- Border radius bumped 6 → **8px**, button height 28 → **30px**, horizontal
  padding **13px** — slightly more room so four labels don't feel cramped.
- Active pill: `--sr-accent-bg` fill + `--sr-accent` text + weight 600 (the one
  high-emphasis action). Inactive: `--sr-text-muted`, hovering to `--sr-text`
  on `--sr-surface-subtle`.
- The **"Sort"** label is lifted to `0.75rem` (off the old `0.6875rem`) for
  consistency with the contrast pass.

**Narrow-width behavior:** on a phone the group wraps to two rows — "Name
(Individual)" tends to take the first row alone, the three short labels share the
second — both rows full-width-comfortable, never a horizontal scroll, never
truncated. The "N named birds" count drops below the group (it's `margin-left:
auto` so it stays right-aligned until the row wraps).

**Species Detail keeps its reduced set** (Name (Individual) · Last Seen) — gated
on `showSpecies`, unchanged (FR-15).

### 5 — Location in the report row (Part 5 / FR-16–18)

Row form: **`date · location · S… ↗`**, location between date and checklist.

- Single flex row, `align-items: center`. **`date`** and **`checklist`** are
  `flex-shrink: 0`; the **`location`** is the only flexible item:
  `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
  — so a long location (e.g. *"Caswell Memorial State Park — Oak Woodland Trail,
  San Joaquin County"*) **ellipsizes** and the row stays single-line. The mockup
  shows exactly this truncation in the first report.
- Separators are a literal **`·`** in `--sr-text-disabled` with `padding: 0 7px`.
- **No location → the whole segment AND its separator are omitted** (the mockup's
  third report demonstrates: `date · checklist`, no empty `· ·`, no placeholder).
- Location text: `0.75rem` / `--sr-text-muted` — the muted-location style other
  tabs use (mirrors `MediaCommentsSection` line 134).

### 6 — The card map (Part 6 / FR-19–25)

Pins-only sightings map **below** the report list, **`.sr-named-map` = 220px**
height (the new CSS class; height-only, reuses `width:100%`). Mirrors Species
Detail: `<SnowMap>`, DOM `<Marker>` pins via `SP_PIN_HTML` (reused as-is, fill
`--sr-accent`), one state-driven `<Popup>` aggregating a coordinate's dates,
`MapBoundsFitter`. Rendered only while the card is expanded; absent when the
individual has no usable coordinates.

A small **uppercase label** ("Where {name} has been seen", `0.6875rem` / 700 /
`--sr-text-muted`) sits above the map so a 220px map reads as deliberate, not
orphaned. Map container: `border-radius: 10px`, `1px solid var(--sr-border)`.

**Basemap-switcher call → DROP it: `switcher={false}` on the card.**
The schema left this to me (its §6 Q5 note: ship `true` for parity, but pass
`switcher={false}` "if Stage 4 judges the switcher too heavy for the small
card"). My judgement: **drop it.**
- Reasoning: at 220px the Map/Satellite/Topo segmented control eats a meaningful
  corner of the canvas and competes with the pins for attention. A named bird has
  a handful of points — the *where* is the whole job; choosing a basemap is not.
  Species Detail is a full 300–380px analytical map where the switcher earns its
  space; the card is a glance.
- The seam stays (`switcher` defaults `true`, the card passes `false`), so it's a
  one-line change to restore if you disagree. The mockup defaults to **off** and
  has a checkbox so you can preview *with* the switcher and judge for yourself.

---

## Component Usage

| Component / element | Library / source | Customization |
|---|---|---|
| Card shell, header button, expand panel | existing `NamedBirdsTable` markup | baseline-aligned header; radius 10px; `--sr-card-shadow`; hover `--sr-surface-subtle` |
| Species name + favicons | shared `<BirdName size="sm">` (`BirdName.tsx`) | unchanged defaults; additive `sr-birdname-inline` only if needed |
| Icons | **Lucide** (already in-app): `Tag`, `ChevronDown`/`ChevronRight`, `ExternalLink`, `Map` (section label) | `strokeWidth` 2.2–2.5 to match existing usage |
| Sort pills | existing segmented group | wrap-aware, 4 labels, 30px tall |
| Map | shared `<SnowMap>` + `<SightingsMap>` (new extracted component) + `SP_PIN_HTML` pin | `switcher={false}`; `.sr-named-map` 220px; pins-only |
| Comment block | plain `<div>` | NEW `--sr-quote-bg` + 3px accent left rule |

No new design dependency. No card-grid layout — the content is a vertical history
list, so a single-column accordion is the correct structure.

## Design Tokens Applied

Existing: `--sr-surface`, `--sr-surface-subtle`, `--sr-surface-faint`,
`--sr-text`, `--sr-text-muted`, `--sr-text-disabled` (count only),
`--sr-text-gray`, `--sr-border`, `--sr-border-subtle`, `--sr-accent`,
`--sr-accent-bg`, `--sr-accent-border`, `--sr-accent-strong`, `--sr-card-shadow`.

### New tokens (added to BOTH `:root` and `[data-theme="dark"]`)

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--sr-quote-bg` | `#EFF1F3` | `#2E2E33` | Comment quote-block background — one step deeper than `--sr-surface-subtle` so a comment separates from the faint expanded panel in both themes. |
| `--sr-quote-border` | `#E0E2E6` | `#3A3A40` | Hairline border on the quote block, paired with the background. |

> If the user prefers zero new tokens, fall back to `--sr-surface-subtle` for the
> comment background (no `--sr-quote-border`; keep the 3px `--sr-accent-border`
> left rule). Flagged above as the one schema deviation.

The `.sr-named-map { height: 220px; width: 100%; }` class (per schema) is added
to `globals.css`.

## Interaction Notes

- **Single-open accordion** on the Named Birds tab: opening a card collapses the
  previously open one (the Architect's WebGL cap — at most one map mounts). The
  mockup demonstrates this. Species Detail's `NamedBirdsTable` stays multi-open
  (`singleOpen` prop gates it).
- **Map lifecycle:** the map subtree only exists while the card is open; collapse
  unmounts it (tears down the WebGL context). No map for a no-coordinate
  individual (no empty container).
- **Pin popup** aggregates all of a coordinate's sighting dates (newest first),
  each linking to its eBird checklist — identical to Species Detail.
- **Location truncation** keeps the report row single-line; full text is the
  title/native tooltip if the Engineer wishes (optional, not required).
- Chevron rotates right→down on expand; favicons/chevron stay vertically centered
  while text aligns on the baseline.

## Content Notes

- Realistic birder content throughout: individuals *Winky* (Great Horned Owl),
  *one-leg-pete* (Snowy Egret), *Scout* (Black-crowned Night-Heron),
  *Crooked-beak* (American Crow); real `[name:…]` tags in the comments; plausible
  California locations and eBird-style `S…` submission IDs.
- Comment copy reads like field notes ("notched left ear tuft", "branching
  owlet") — the kind of detail a birder writes to re-identify an individual,
  which is exactly what the comment block is for.
- The third report intentionally has **no location** to show the omit behavior;
  the first has a **long location** to show truncation.
