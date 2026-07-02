# SnowRaven Design System

Canonical design source for all features. Established from the system already
in force across 61 shipped versions (formerly `brand.md`, which remains for
history); captured into the pipeline at the checklists-tab feature (2026-06-10).
Authoritative token values live in `frontend/src/globals.css` (`:root` +
`[data-theme="dark"]`) — this file records intent, patterns, and rationale.

## Feel
Quiet utility — simple, straightforward, intuitive; calm and purposeful, no
clutter. The tool gets out of the user's way. Color is restrained: the green
means "actionable or active," and almost nothing else is colored. Informative,
never promotional.

## Tokens (intent layer — values in globals.css, both themes)
- **Accent:** `--sr-accent` #2D8653 (Irish clover green; dark theme #34D399),
  with `--sr-accent-strong/bg/border`, `--sr-on-accent`. Used for links, active
  states, primary actions, key counts — one accent per surface, not everywhere.
- **Surfaces:** `--sr-bg` page, `--sr-surface` cards, `--sr-surface-subtle`
  hover/inset, `--sr-surface-faint` control strips and expanded panels.
- **Text:** `--sr-text` primary, `--sr-text-muted` secondary,
  `--sr-text-gray` metadata, `--sr-text-disabled` counts/placeholders.
- **Borders:** `--sr-border`, `--sr-border-subtle` (row separators),
  `--sr-border-medium` (interactive outlines).
- **Quote blocks:** `--sr-quote-bg`/`--sr-quote-border` (v0.5.26) for quoted
  user comments.
- **Tiers:** `--sr-tier-N` (+`-rgb` triplets) for breeding-code tiers.
- **Rainbow swatches:** `--sr-rainbow-{red,orange,yellow,green,blue,indigo,violet}` (Statistics → Frivolous Lists / Rainbow Warrior, v0.5.36) — decorative color dots, per-theme (saturated on light, luminous on dark), each with a 1px `--sr-border-medium` ring and `opacity: 0.30` when unfilled. The color NAME is the accessible text, so these are not held to text contrast.
- **County choropleth ramp:** `--sr-county-{1..10}` (+ `-rgb` triplets) — a sequential single-hue green ramp (light `#C3E8D1` → deep `#1A5C38`, geometric-luminance-spaced so every adjacent step stays legible, deepening toward `--sr-accent-strong`) for a magnitude choropleth drawn on a map (Map Explorer county shading). Use THIS ramp — not the purple `--sr-tier` breeding ramp — for any new map magnitude choropleth, so it reads as "how many" and stays visually distinct from the breeding-atlas overlay when both are on. The ten steps serve BOTH tier mappings — quantile classes for count metrics and fixed 0–100% bands for absolute-scale metrics (Completeness) — and the same steps drive the Use Textures density hatch and the popup progress-bar fill (each county's bar filled with its own band token). Declared IDENTICALLY in both themes because the map canvas is the always-light Positron basemap regardless of app theme (same posture as the map-pin / rank / milestone on-map tokens; theme-flipping would wash the fills out over a light base). On-map fills use the solid color at `fill-opacity ~0.85`; the unrecorded tier is outline-only (`fill-opacity 0`, still hit-tested). Legend swatches use the solid color with a `--sr-border-medium` ring; legend text uses the theme-flipping `--sr-text` / `--sr-text-muted` (AA). There is no on-fill map text, so no on-fill text pair is minted.
- **Rule:** every color via `var(--sr-*)`; new tokens go in BOTH themes before
  use; rgba alphas via the `-rgb` triplet pattern.

## Type
Inter / system-ui. Three working roles: headline (1.125rem/700, -0.01em),
body (0.84375rem/1.55 for content, 0.8125rem for descriptions), label/caption
(0.75rem and 0.71875rem, muted; 600 for control labels). Scientific names
italic at 0.71875rem `--sr-text-gray`.

## Patterns (which component for what)
- **Cards:** `SectionCard` + `SectionHead` (icon tile + title + muted sub).
  Radius 10–12px, `--sr-card-shadow`, 1px `--sr-border`.
- **Tab pages:** house header (30px accent-bg icon tile + h2 + one-line muted
  description); Phase union loading → SetupRequired → error → ready;
  defer-mount via App's `mountedTabs`.
- **Comment search boxes:** controls strip on `--sr-surface-faint` (Search-icon
  input, Newest/Oldest segmented toggle, aria-live count) over rows with
  "Show all N" expander — the Species Detail / MediaCommentsSection pattern.
- **Filters:** pills 30px/15px-radius (`aria-pressed`), accent positive state,
  tokenized negative tint, `Set` multi-select or tri-state; county/protocol via
  native `<select>`; paired native date inputs; accent filter-strip banner with
  "Clear filter". Cycling tri-state pill (one pill, off→has→no) is the approved
  evolution when categories are many (checklists-tab decisions.md).
- **Quoted comments:** `--sr-quote-bg` block, 3px `--sr-accent-border` left edge.
- **Bird names:** ALWAYS `<BirdName>` (link gated on hasEntry, favicons via
  taxon codes).
- **Links out:** eBird checklist links only behind `SUBMISSION_ID_RE`
  (`/^S\d+$/`); `target="_blank" rel="noreferrer"`; accent + ExternalLink glyph.
- **Icons:** Lucide, 11–15px, stroke ~2.2, purposeful only.
- **Maps:** `<SnowMap>`/`SightingsMap` wrappers only.

## Accessibility commitments
Every `<button>` gets explicit `tabIndex={0}` (WKWebView Tab behavior); toggles
are `role="switch"`; live counts `aria-live="polite"`; visible focus states;
WCAG resize via in-app Text Size; reduced-motion honored for scrolls.

## References
brand.md (founding visual identity, #2D8653, dtgibson.com reference);
`frontend/src/globals.css` (authoritative values); the Multimedia, Breeding
Codes, Species Detail, and Named Birds tabs as pattern exemplars.

## Rationale
The green stays grounded and natural, not corporate; restraint is the brand.
Patterns are extracted from shipped, accessibility-audited UI rather than
invented per feature — new features extend these patterns and log deliberate
deviations in their feature `decisions.md`.
