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
- **Scrim:** `--sr-scrim` is the modal backdrop, the app's own ink at an
  alpha rather than pure black (light `rgba(15,17,23,0.36)`, dark
  `rgba(9,9,11,0.6)`). Every fixed overlay backdrop uses it through
  `.sr-dlg-root`; do not re-inline an `rgba(0,0,0,...)` scrim. The shared
  shell is `components/ui/ModalDialog.tsx` (see Patterns).
- **Quote blocks:** `--sr-quote-bg`/`--sr-quote-border` (v0.5.26) for quoted
  user comments.
- **Tiers:** `--sr-tier-N` (+`-rgb` triplets) for breeding-code tiers.
- **Rainbow swatches:** `--sr-rainbow-{red,orange,yellow,green,blue,indigo,violet}` (Statistics → Frivolous Lists / Rainbow Warrior, v0.5.36) — decorative color dots, per-theme (saturated on light, luminous on dark), each with a 1px `--sr-border-medium` ring and `opacity: 0.30` when unfilled. The color NAME is the accessible text, so these are not held to text contrast.
- **County choropleth ramp:** `--sr-county-{1..10}` (+ `-rgb` triplets) — a sequential single-hue green ramp (light `#C3E8D1` → deep `#1A5C38`, geometric-luminance-spaced so every adjacent step stays legible, deepening toward `--sr-accent-strong`) for a magnitude choropleth drawn on a map (Map Explorer county shading). Use THIS ramp — not the purple `--sr-tier` breeding ramp — for any new map magnitude choropleth, so it reads as "how many" and stays visually distinct from the breeding-atlas overlay when both are on. The ten steps serve BOTH tier mappings — quantile classes for count metrics and fixed 0–100% bands for absolute-scale metrics (Completeness) — and the same steps drive the Use Textures density hatch and the popup progress-bar fill (each county's bar filled with its own band token). Declared IDENTICALLY in both themes because the map canvas is the always-light Positron basemap regardless of app theme (same posture as the map-pin / rank / milestone on-map tokens; theme-flipping would wash the fills out over a light base). On-map fills use the solid color at `fill-opacity ~0.85`; the unrecorded tier is outline-only (`fill-opacity 0`, still hit-tested). Legend swatches use the solid color with a `--sr-border-medium` ring; legend text uses the theme-flipping `--sr-text` / `--sr-text-muted` (AA). There is no on-fill map text, so no on-fill text pair is minted.
- **Calendar day-shade ramp (text-bearing):** `--sr-cal-{1..5}` (+ `-rgb`) with one white on-cell number `--sr-cal-fg` (`#FFFFFF`) — a sequential deep-green ramp (`#357E56 → #0C271A`) sized so the single on-fill number clears WCAG AA (≥4.5:1) on EVERY tier. Use THIS ramp — not the fill-only county ramp — whenever a shade cell CARRIES TEXT ON THE FILL: a fill-only ramp can't guarantee on-fill text contrast at every step (a mid ramp fill is a dead zone for any single text color), so a text-bearing surface gets its own ramp with a locked class count (here 5, forced by the AA + adjacency math) and one re-tuned on-fill text token. Declared IDENTICALLY in both themes (same posture as the county / map-pin / milestone on-surface tokens; theme-flipping would break the on-fill contrast guarantee). The steps also drive the colorblind crosshatch companion — a DOM CSS `repeating-linear-gradient` (`calHatchCss` over the `-rgb` tokens; the DOM analogue of the map's MapLibre-sprite hatch, reusing only the pure monotonic density shape). Guard the pair with a parse-the-tokens test asserting on-fill text ≥4.5:1 on every tier in both themes (the county ramp's contrast test omits this because it has no on-fill text).
- **Share pin:** `--sr-share-pin` (#B4341F) + `--sr-share-pin-ink` (#FFFFFF) — the transient user-planted map pin. Declared IDENTICALLY in both themes (map-anchored: only ever drawn on the always-light Positron basemap, same posture as `--sr-map-pin-*` / `--sr-rank-pin-*` / the county ramp; theme-flipping would wash it out over a light base). 5.38:1 on Positron land, 6.08:1 for the ink notch — both clear the 3:1 WCAG 1.4.11 bar for a non-text graphic with the margin that keeps it legible over satellite too. No text is painted on the fill, so no on-fill text pair is minted.
- **Searched-area indicator:** `--sr-search-area-rgb` (180, 52, 31) for the boundary of an area the app has actually queried, and `--sr-search-area-scrim-rgb` (15, 17, 23) for the wash over everything outside it. Both are `-rgb` triplets because both are only ever consumed at an alpha, and both are declared IDENTICALLY in `:root` and `[data-theme="dark"]` — the same map-anchored posture as `--sr-share-pin` / `--sr-map-pin-*` / `--sr-rank-pin-*` / the county ramp. The edge deliberately REUSES `--sr-share-pin`'s audited `#B4341F` rather than minting a near-neighbour: the two never co-occur as a data class (a planted flag against a boundary line) and shape already distinguishes them, so one red-orange in the palette is one fewer to keep audited. The scrim is `--sr-text`'s light value, the app's own ink and never pure black, which is the house rule for every shadow and overlay here. **Show a covered area by dimming what was NOT covered, rather than by drawing its boundary**, whenever the boundary can be off screen exactly when the feature is working — geometry then does the work and there is no visibility state to get wrong. **Its alpha is decided by what the scrim sits ON TOP OF, so it is settled by measuring the rendered stack, not by reasoning about the token**: over an active choropleth ramp the wash also moves that ramp's tiers, and a ramp guarded only at ~1.21:1 adjacency has little to give. Painting the scrim below the fills is not the answer (it blocks 85% of the mark exactly where the claim matters) — enforce the layer order, re-asserted on `styledata`, and pick the alpha against the rendered tiers. No text is painted on either fill, so no on-fill text pair is minted.
- **Hotspot value ramp:** `--sr-hotspot-{1..5}` (#2C89AA → #0E2A47) — a sequential
  cyan-blue ramp for the Hotspots view's color modes (personal species / checklists,
  community recent activity), strictly luminance-monotonic with every adjacent step
  ≥1.2:1, plus the off-ramp state tokens: `--sr-hotspot-unanswered` (gray, paired
  with a dashed stroke ring on the sprite), `--sr-hotspot-zero` (the hollow "asked,
  zero" rim — ONE token deliberately serving both the personal-zero and
  community-quiet states, whose wording differs but whose visual idea is the same;
  two identical-valued tokens would be a name waiting to drift),
  `--sr-hotspot-nodata` (pale "never birded by you") and its non-guarded companion
  `--sr-hotspot-pale` (the hollow inner disc). Declared IDENTICALLY in both themes
  (map-anchored, same posture as the county ramp / share pin). Two rules travel
  with it. **A state that must read as ABSENCE may be a pale fill whose ≥3:1
  boundary is supplied by its stroke ring rather than by the fill** — any
  guard-compliant dark fill inevitably reads as "something", the very confusion the
  state exists to prevent (the pin-scale twin of the county overlay's outline-only
  unrecorded tier). Its contrast guard then encodes the REPLACEMENT clauses (pale
  fill ≥3:1 vs the other state fills and ramp step 1; ring ≥3:1 vs land and vs the
  fill itself), never the uniform clause it deviates from, with the land reference
  bound to `TINT_GRASS` specifically — the stated binding case and the documented
  map-pin practice; an all-tints sweep fails the approved ramp, and the other TINT
  imports stay live so a rename breaks loudly (`hotspotContrast.test.ts`). And **at
  teardrop-pin scale the colorblind path is luminance + structure + words, not
  texture** — a county-style density crosshatch does not resolve on a 28px bulb, so
  the color-independent reading is the grayscale-ordered ramp, the structural
  states (dashed = not checked, hollow = zero, pale = never birded), the kind glyph
  on every pin (white on ramp/unanswered fills, dark slate on the two
  pale-centered states), and the popup + in-view list carrying every value in
  words. No text is painted on the fills, so no on-fill text pair is minted.
- **Sticky band haze:** `--sr-sticky-shadow` — the soft drop shadow under a header that has pinned over content scrolling beneath it, paired with an inset `--sr-border-medium` bottom line. A full-value shadow token (same convention as `--sr-card-shadow`), and one of the tokens that is NOT theme-identical: dark gets its own deeper value, because a light 12% haze is invisible against `--sr-bg` `#09090B`. Both values are tinted with the app's own ink, never pure black. The band's boundary is visual reinforcement only, not the means of identifying the component or its state (the header is identified by its text, the pinned state by the control's `aria-pressed` and its visible pressed styling), so it is deliberately a hairline at about 1.65:1 rather than a 3:1 rule that would read as a divider and break the register.
- **Rule:** every color via `var(--sr-*)`; new tokens go in BOTH themes before
  use; rgba alphas via the `-rgb` triplet pattern. **Before minting a new map
  color, check it is free on EVERY surface it will appear on** — the accent is
  the sighting pin, the search-center pin and the rank circle; blue is the
  Statistics rank square; amber and violet are Map Explorer's personal and
  target pins. When no color is free everywhere, let SHAPE carry the
  distinction and mint a token only to keep the new shape from reading as an
  existing data class. **On the Map Explorer canvas the palette is now
  spent**: green is sighting pins, the search-centre pin and the rank circle;
  amber is personal locations; violet is target pins; blue is rank; purple is
  the breeding ramp; green again is the county ramp; slate is every boundary
  line; red-orange is the planted share pin and the searched-area edge; and
  cyan-blue is the hotspot value ramp — the last family that was distinct from
  all of these at pin scale. A further map mark should expect to reuse an
  audited hue with a distinct shape rather than to find a free one.

## Type
Inter / system-ui. Three working roles: headline (1.125rem/700, -0.01em),
body (0.84375rem/1.55 for content, 0.8125rem for descriptions), label/caption
(0.75rem and 0.71875rem, muted; 600 for control labels). Scientific names
italic at 0.71875rem `--sr-text-gray`.

## Patterns (which component for what)
- **Main navigation:** one responsive nav over the eleven destinations at three
  densities (sidebar `13.5rem`, icon rail `3.75rem`, phone bottom bar of four
  favourites + a More sheet), chosen from measured available width against a
  640px content floor, never a device check. The saved order is flat and
  authoritative; the only separator is the structural hairline above Settings,
  because Settings is appended after that order and is never part of it, while
  every other destination is peer to every other. Active state is
  `--sr-accent-bg` + `--sr-accent` + weight + a 3px leading accent bar, so three
  cues carry it and one of them is a shape. Nav-scale lucide icons run 15 to 20px
  (a deliberate extension of the 11 to 15px in-content range: at these densities
  the icon is doing identification work rather than decorating a label). The
  brand block lives in the nav column at the wide densities and in the page
  header at phone width, so `<main>` starts at the top of the window.
  `--sr-nav-bar-shadow` is the upward twin of `--sr-sticky-shadow`. The width
  transition is opt-in (`.sr-nav-col--anim`) and runs on the manual collapse
  toggle ONLY: a derived density change during a window drag must be instant.
- **Cards:** `SectionCard` + `SectionHead` (icon tile + title + muted sub).
  Radius 10–12px, `--sr-card-shadow`, 1px `--sr-border`.
- **Quiet section (the Settings tab's quietest register):** a section whose job
  is reference or utility rather than configuration drops the icon tile, row
  title, and description entirely — the uppercase `SectionHeader` alone names
  it, over a card holding one quiet bordered button (the Rebuild caches /
  Replace register: 1.5px `--sr-border`, `--sr-surface` fill, `--sr-text`
  label, radius 6). Where the section has content to show, it opens as an
  inline grid-collapse disclosure inside the same card (`0fr/1fr` wrapper,
  `overflow: hidden` inner, `inert` while closed, no live region — the content
  is reference material, and `aria-expanded` carries the state change), with
  the accent appearing only in the toggle's open-state tint. Troubleshooting
  and Acknowledgments are the exemplars; pick this register over the
  icon-tile action row when the section should not compete for attention.
- **Confirmation dialog:** any fixed-position confirmation or short note
  that must be read before an action proceeds renders through the shared
  `components/ui/ModalDialog.tsx` shell (`.sr-dlg-*` in globals.css), never
  a re-inlined overlay. A `position: fixed; inset: 0` root on `--sr-scrim`
  centers a `--sr-surface` panel (`calc(100% - 32px)` wide, max 420px, max
  80vh with internal scroll, 1px `--sr-border`, radius 14,
  `--sr-card-shadow`): a `1rem/700` title over a `--sr-border-subtle` rule,
  body prose, then a right-aligned action row of 96px-minimum buttons that
  stack full width at the 44px posture on the phone tiers. The caller passes
  a `trigger` getter (the control that opened it: the origin of the scale-in
  and where focus returns on close) and, for a trigger that may unmount or
  go disabled while open, a `fallbackFocus`. Escape, the backdrop and every
  button close through one path; the focus trap re-queries its focusables
  per keydown; motion follows the global reduced-motion rule. Use it for the
  destructive or cross-device confirmation (the sync-on Clear, Remove from
  iCloud) and the pre-enable note; a plain local action that reads the same
  as before stays unconfirmed. A note that ends on one quiet promise ("Nothing
  is written to iCloud until you choose Turn on.") carries it in `.sr-dlg-fine`:
  0.75rem muted text over a `--sr-border-subtle` top rule, below the body and
  above the actions.
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
  evolution when categories are many (checklists-tab decisions.md). **On a phone
  every interactive control in a filter block reads at ONE size** — put `.sr-ctl-row`
  on the block and its buttons, selects and inputs share the iOS-safe scale-tracking
  size, so a pill never sits at 12px beside a 16px select and the relationship cannot
  invert at large text scale. The deliberately smaller uppercase section labels are
  spans and stay outside it by design; so does a trailing count-and-view cluster,
  which is not a filter.
- **Species pickers:** any species selection over a long list goes through the
  shared `SpeciesCombobox` type-to-find picker, never a scroll-only native
  `<select>`: search icon, text input (`role="combobox"` with full ARIA listbox
  wiring, `useId`-namespaced ids so two instances coexist on one page), a
  filtered listbox narrowing by common or scientific name, and an always-present
  unfiltered italic clearing row ("All species") so the control is always
  clearable; Enter commits the active option, else the first *species* match,
  and is a no-op on zero matches. Three size registers map onto their hosts —
  `md` (40px, the Species Detail hero scale), `sm` (30px, 220px cap), `panel`
  (34px / 0.8125rem / radius 6, full-width, the filter panel's SELECT_STYLE
  register) — pick by the host's control register, never restyle per consumer.
  Rows are escaped plain text with the scientific name muted (never `<BirdName>`
  inside a form control); the secondary span is capped at `max-width: 40%` with
  `.sr-truncate` on both spans, so the common name keeps the majority of the row
  at any width and text scale. The listbox opens with a 140ms ease-out entrance
  scaled from the input (`cubic-bezier(0.2, 0, 0, 1)`, transform-origin top
  center; reduced motion renders it instantly), shared across all sizes so the
  pickers cannot drift; close is instant. Placeholder is state-voiced ("All
  species"), so a filter column keeps reading as current values. Escape closes
  only the open listbox and bubbles once closed, so a hosting sheet or
  fullscreen surface keeps its own Escape behavior. `.sr-input-16` rides the
  `className` prop onto the `<input>` itself.
- **A preference whose copy multiplies:** when N independent switches mean 2^N
  labels, generate every string from ONE ordered manifest plus pure functions —
  the switch labels, their accessible names, the primary button, and the sentence
  naming what the action will produce — so a new option is one row and no new copy.
  Keep the manifest noun its own column, never the visible label lowercased. A
  button may collapse a complete family to a short collective ("map links") to stay
  inside a compact container ONLY when the line directly below always spells out
  which; state the character ceiling that collapse serves and keep a test on it.
  The all-off state is structural, not a further string: replace the live example
  with a sentence and **replace the primary control with a sentence rather than
  disabling it** — no control that looks pressable may put an empty string on the
  clipboard. The consequence must appear at the instant the last switch flips, in
  the same block and with zero animation, so it is never discovered later on the
  surface the preference governs.
- **Quoted comments:** `--sr-quote-bg` block, 3px `--sr-accent-border` left edge.
- **Bird names:** ALWAYS `<BirdName>` (link gated on hasEntry, favicons via
  taxon codes).
- **Links out:** eBird checklist links only behind `SUBMISSION_ID_RE`
  (`/^S\d+$/`); `target="_blank" rel="noreferrer"`; accent + ExternalLink glyph.
- **Icons:** Lucide, 11–15px, stroke ~2.2, purposeful only.
- **Maps:** `<SnowMap>`/`SightingsMap` wrappers only.
- **Map tools & transient pins:** a pointer gesture on a map (right-click /
  long-press) always has a VISIBLE companion control, not a hidden shortcut — a
  gesture-only feature has near-zero discoverability, and making the
  keyboard-reachable route the primary one serves both audiences with one
  control. The control is a small square icon button in the map's bottom-right
  corner (`.sr-share-corner`, 30px in compact), joining the existing
  `.sr-map-fab-cluster` as its FIRST item where that cluster exists, so no
  shipped control moves and the iOS safe-area handling is inherited. A pin the
  user plants is a distinct shape from any data pin (a planted flag against
  teardrops and circles: a precise point rather than a bulb, right for a "this
  exact spot" gesture), draggable to fine-tune, one at a time per map, session-
  scoped with nothing written to disk. Its popup carries the coordinate in
  `--font-mono`, one primary action, and a muted mode line naming what the
  action will produce. Success settles QUIETER, not louder — the button goes
  from accent-filled to accent-tinted (`--sr-accent-bg` on `--sr-accent`) with a
  `Check` icon for ~2s, never a toast. A failed clipboard write reveals the
  payload as selectable text plus a **Select all** control (Selection API only,
  so it cannot fail the way the copy just did) — "select the text below" is
  advice a phone user cannot follow by hand across wrapped lines in a map popup.
  **Compact reduces size, never meaning:** on a small host map the popup
  narrows, tightens padding and caps its body, but keeps every label, the mode
  line, the failure text and `Select all` — the same full-density-degradation
  rule as the inline-media placeholder, and the body cap floors at the
  touch-target size rather than shrinking the action out of reach. **The map surface
  has two anchors and they split by INTERACTIVITY, not by feature.** The
  top-centre anchor holds only transient `pointer-events: none` statements (the
  loading chip, a search-outcome line), because at 320px and 200% text scale
  anything there passes over the top-right layers switcher — tolerable only
  while the switcher stays fully operable underneath, which is true of a
  statement and false of a control. Every ACTION lives in the bottom FAB
  cluster. Beside the corner icon buttons and the full-width message row, the
  cluster also hosts a full-width **action** row on the same mechanism
  (`flex: 0 0 100%`, the cluster's own `row-gap` / `justify-content` /
  `max-width` doing the work): it is where a labelled action goes when the
  action needs words rather than a glyph, it spends none of the disc row's
  horizontal slack, and it inherits the cluster's bottom safe-area inset
  rather than needing a rule of its own. Two transferable rules come with it.
  **A row whose position must be stable under a neighbouring row's appearance
  goes BELOW that neighbour**, because the cluster is bottom-anchored and grows
  upward — that is what keeps a retry sitting where the thumb left it whatever
  else appears. And **a labelled action in this cluster takes the accent-TINTED
  active treatment, never the accent-filled slab**: a solid accent fill on this
  canvas means sighting pin, and the accent-filled Filters pill already sits in
  the same cluster, so two labelled pills in one place need two weights. Where
  a new row genuinely has nowhere to fit, WITHHOLD it and leave its function
  reachable where it already was — measured against a term the control cannot
  itself move, never gated at a fixed breakpoint.
- **Map fullscreen (a small map made to fill the window):** the toggle is the
  Map Explorer's own control repeated verbatim -- the same `.sr-map-fab` disc in
  the map's bottom-right corner, the same `Maximize2` / `Minimize2` glyphs, the
  same "Enter fullscreen" / "Exit fullscreen" names -- so the vocabulary is
  learned once and works everywhere it appears. On an embedded map it joins a
  `.sr-map-corner-row` holding the share button first, then the toggle; the
  Map Explorer's fuller cluster keeps its location button, and a map that is a
  location INPUT rather than a data view gets no row at all. **The exit is the
  same button in the same corner in its other state:** it does not move, does not
  become an X, does not gain a label, and does not change size on expanding -- a
  toggle whose exit moves is two controls wearing one name, and a control that
  grows under the finger that just pressed it is a second state change nobody
  asked for. Expanding is a class swap on the map's own container, so it is
  literally the same map: same pins, same base map, same centre and zoom, an open
  popup still open, a dropped pin still dropped. **No scrim** -- there is nothing
  behind to dim, a scrim is a modal gesture on something that is not a modal, and
  `--sr-scrim` belongs to the dialog shell. Border and radius drop while
  expanded, the clip stays, and the ground is opaque. Nothing animates but the
  corner row's entrance, because a scaling live canvas tears and a transform on
  the panel would break `position: fixed`. Escape exits and returns focus to the
  toggle; Tab stays inside; expanded, the map takes the scroll wheel and a
  one-finger pan, because the page it was sharing gestures with is no longer
  behind it. Controls that sit BESIDE a map rather than on it stay on the page:
  they are set before expanding, not duplicated into the overlay.
- **Inline media (ML embeds):** Macaulay Library `.../asset/<id>/embed` iframe in
  a `.sr-media-grid` (3-up → 1 col ≤640), `.sr-media-iframe` footprint. Height is a
  modifier class per surface, and each surface keeps its own classes so the two can
  be tuned independently: Named Birds uses per-format `--photo`/`--video`/`--audio`,
  Species Detail Recent Media one uniform `--recent`. **Audio is never a short tile
  anywhere** — the Macaulay audio player needs the full height (currently 230px, 280px
  ≤640, matching photo and video) or its transport controls clip under the frame's
  `overflow:hidden` and the embed is visible but unplayable. Each
  item labels its capture date + a `ChecklistLink`; the media-type marker follows
  the app's own convention (uppercase muted micro-label + Lucide icon, NOT a
  colored chip — the green stays reserved for the actionable link). A bounded
  initial batch (~6) + a keyboard-operable "Show more" (`.sr-touch-target`), lazy-
  mounted; offline/failed degrades to a same-footprint placeholder that keeps the
  date + checklist + an `OutboundLink` to the single-asset ML URL, never a broken
  frame — at full density, not an icon-only reduction, on every format.
  The app-wide disabled mode replaces only the player footprint with the shared
  neutral `EmbeddedMediaDisabled` presentation: exact copy “Embedded media is
  disabled in Settings.”, `role="status"` (never an alert), muted text on the
  existing faint/subtle surface, no shimmer or error treatment, and no note
  where embed-backed content is absent. Keep the surrounding date, format,
  checklist, and direct-asset links. Settings uses the existing trailing
  `ToggleSwitch` row with explanatory copy; no modal, Save button, or new token.
- **Switches:** the shared `ToggleSwitch` is a boxed pill-button when it carries
  its own visible label (the app-wide default): chrome on the `.sr-toggle` class
  (`--sr-border` 1.5px, `--sr-surface` fill, radius 6, height 30) with a hover
  state of `--sr-border-medium` + `--sr-surface-subtle` at 120ms ease-out, gated
  off `disabled` and `aria-disabled` so an inert switch stays at rest; the track
  is `--sr-gray-400` off / `--sr-accent` on. A row whose visible label is the
  row's own text (Settings-style title + description + trailing switch) passes
  `bare`: chromeless, larger 36×20 track / 16px knob, same thumb/track tokens,
  global focus ring, `.sr-touch-target`. Never leave the boxed chrome around a
  label-hidden switch (it reads as an empty box). A switch that is not operable
  but must say why in place (a sub-option gated on another switch) passes
  `ariaDisabled`: `aria-disabled="true"`, still focusable, ignores activation,
  takes the disabled look (`opacity: 0.72`, `cursor: not-allowed`), with the
  one-line reason in its `aria-describedby`; native `disabled` is for a switch
  with nothing to explain at the control.
- **Row status line (a row that reports where its data came from and its sync
  state):** the shared `SyncLine` in `Settings.tsx` (`.sr-sync-line`), a
  `role="status"` element rendered from the start inside the row's text column
  under the value line, empty when the row has no view, its children replaced
  on change and never unmounted or `display: none`, cross-fading between views
  (first fill and clear-to-empty instant; reduced motion instant). It is
  generic over the view and takes a render prop, so a new row kind supplies
  its content (`SyncContent`, `KeySyncContent`) and never forks the region:
  a 13px lucide cloud glyph (`aria-hidden`), the state as text (600, one of a
  closed label set), an sr-only full stop, then a muted detail span
  (`.sr-sync-more`, `overflow-wrap: anywhere`, its middot inside it) carrying
  provenance ("From this device, changed <time>", "Replaced by the key from
  <device>"), then an inline action (Retry, Download now). The one failure
  state colors the label `--sr-error` as reinforcement of the text, never
  alone. Phone tier: the label wraps and the inline action takes the full row
  width; the row's own value or filename line wraps too, so Show / Hide drops
  under the value at 320px and 200% text. Default Files rows and API Keys rows
  are the two instances.
- **Phone wide-table:** a wide matrix/table (many narrow columns beside a label
  column) is made comfortable on a phone by (1) narrowing the data columns to
  dot-width via a single CSS class at the ≤640 tier — never an inline width — with
  smaller (0.625rem) headers; (2) thin `--sr-border-subtle` column rules to keep
  the dense columns readable; (3) a horizontally-sticky first (label) column
  (`left:0`, no `top`); and (4) native viewport pinch-to-zoom for magnification —
  NO CSS `zoom` / `transform:scale` (unreliable in WKWebView). It stays a NATURAL
  full-height, page-scrolling table with any legend in normal flow after the last
  row — NOT a frozen-header / capped-height data-grid (pure CSS can't combine a
  page-frozen header + an unbounded table + contained horizontal scroll, so a
  frozen header forces a capped box; the natural table is the default). **A pinned
  header is offered only where it is FREE** — i.e. in an uncapped / "unbounded"
  view whose scrollport is the page, so a `position: sticky; top: 0` header anchors
  to the viewport and the table keeps its full natural height. Never offer it where
  it would force the capped box: at 200% text scale a capped box has no viable
  height unit (a `dvh` cap leaves a handful of rows with the legend stranded, a
  `rem` cap exceeds the viewport and puts the scrollport's top — and the pinned
  header with it — off screen). Make the mode opt-in, default off, session-only,
  and reachable in one press from either view under a **"pinned implies unbounded"**
  invariant, with the round trip leaving no residue; a muted status note names what
  the press did. `position: sticky` goes on each `<th>` individually, never on
  `<thead>`/`<tr>` (WKWebView honors sticky on cells only), `border-collapse:
  separate` is required, and the pinned CSS must live in the stylesheet rather than
  inline so the iOS variant can re-point `top` to `env(safe-area-inset-top)` under
  the `.sr-ios-app` gate. Guard keyboard focus from the band with `scroll-margin-top`
  on the focusable DESCENDANTS of the cells, not on the cells. To make the
  phone column widths AUTHORITATIVE — so the narrowing holds even in an uncapped /
  "unbounded" wide view (under the default `table-layout: auto` a cell width is
  only a floor a wide table grows past) — put `table-layout: fixed` on the
  `<table>` at ≤640 with a DEFINITE table width (`width: max-content; min-width: 0`),
  never `width: 100%` inside a `max-content`/shrink-to-fit container (a circular
  constraint that runs the table to the browser's element-width cap). A
  horizontally-scrolling card wrapping such a fixed-width table uses
  `width: min-content` (not `max-content`, which sizes to the columns' intrinsic
  width and leaves trailing whitespace) so the card hugs the table. The Breeding
  Codes matrix is the exemplar. No new tokens.

- **An expensive answer the app must go and FETCH is a thing you run, not a number
  that appears.** Where a section's figure costs thousands of provider requests, it
  is user-initiated and states the cost in plain words BEFORE the first request:
  how many things will be asked about and roughly how long that will take. It is
  stoppable at any moment, keeps every answer already paid for, and resumes by
  asking only about what is still unanswered. Every tally renders WITH its
  denominator ("3 projects across 412 of 3,300 checklists checked") so a partial
  answer reads as a floor rather than a finished total, and a section that has
  never been run shows **no number at all** — not a zero, which is a claim the app
  has not earned. Progress is a bounded live region plus a bar, both fed from one
  throttled frozen snapshot. The completed state still offers a re-check, routed
  through the same fetch chokepoint with a force flag rather than a second write
  path. Statistics' escapee pass and Projects section are the two exemplars.
- **A map popup is contained by what its container can ANCHOR, and becomes a sheet
  when it cannot.** MapLibre's side anchors place a popup EDGE at the click point,
  so a popup is anchorable only while its width stays under two thirds of the map;
  past that every click overflows. Cap the width at the anchorable maximum, and
  below the design's own readable body minimum stop anchoring and pin the popup to
  the container instead. The sheet is the form that makes a phone-width map usable;
  the anchored form is unchanged on any map wide enough to hold it, which is every
  desktop window. The county popup is the exemplar.
- **Share breakdown (one whole split into rows that sum to 100%):** a SectionCard
  opening with a headline stat pair — micro-caps `StatLabel` over a 1.25rem/700
  figure, the accent-colored figure being the share the section exists to answer —
  then one row per part: the name (through `BirdName` when it is a bird; display
  copy in `--sr-text-muted` when it is not), a right-aligned count with its unit
  and a weight-700 percentage in tabular numerals, and a 3px share bar under the
  line (track `--sr-border`, fill `--sr-accent`). The residual "none of the above"
  row is pinned last with a `--sr-gray-400` fill so it reads as a different kind
  of row without relying on color alone, and is absent when its count is zero.
  Percentages come from the shared shaping contract (`lib/subspeciesExplorer.ts`):
  integer tenths, a 0.1% floor for nonzero rows, residue absorbed by the largest
  row so the display sums to exactly 100.0, a flat "100%" for a single row. Where
  the section's total deliberately disagrees with a sibling figure, publish the
  difference as a muted footnote naming both numbers, never a silent discrepancy.
  Bars animate width from zero via a CSS mount animation keyed by a deterministic
  resetKey, so the animation replays exactly when the data changed (reduced-motion
  renders final width instantly); bars are reinforcement only — every value is
  present as text. The Species Detail Subspecies and Forms section is the exemplar.

## Accessibility commitments
Every `<button>` gets explicit `tabIndex={0}` (WKWebView Tab behavior); toggles
are `role="switch"`; live counts `aria-live="polite"`; visible focus states;
WCAG resize via in-app Text Size; reduced-motion honored for scrolls. A full-screen
overlay (or any pinned band) needs its own iOS safe-area inset — it does not inherit
the body's, so design it expecting a top inset that the status bar, Dynamic Island,
and landscape sensor housing occupy, and expect any viewport-height cap inside it to
be short by exactly that inset. Where a sticky band can cover a focused control, the
focus guard belongs on the focusable itself, not on its container. A live region belongs
OUTSIDE any `inert`-able disclosure that consumes it; where the collapsing content
IS what would be announced (a legend, a ramp, a table), it carries no live semantics
at all — announcing a whole reference panel on every open serves no one, and the
state change that prompted it is already carried by the control's own `aria-pressed`.

## References
brand.md (founding visual identity, #2D8653, dtgibson.com reference);
`frontend/src/globals.css` (authoritative values); the Multimedia, Breeding
Codes, Species Detail, and Named Birds tabs as pattern exemplars. The app
icon / brand mark is the serif SR with the raven's head in the S on the
brand green; its master artwork (vector trace, full-bleed and rounded
rasters, icns/ico) lives in `pipeline/ebird-cooldown-and-app-icon/
icon-source/` — regenerate every platform icon from it, never from a
derived asset (iOS from the FullBleed sources, flattened opaque; macOS on
the Apple icon grid; the web and website SVGs from the traced master).
In-app, the same raven is the `RavenGlyph` component
(`frontend/src/components/RavenGlyph.tsx`): an inline single-path SVG,
`fill="currentColor"` so the caller colors it with a token (`--sr-accent`
at both sites), square viewBox, a `size` prop driving width and height,
always `aria-hidden` + `focusable="false"` because the wordmark carries
the name. Any surface that wants the raven renders that component — never
a lucide bird, never a second inlined copy of the path. Its master SVG is
committed separately at `frontend/src/assets/snowraven-bird-glyph.svg`;
the archival master keeps its baked hex and `<title>`/`<desc>`, which the
component strips.

## Rationale
The green stays grounded and natural, not corporate; restraint is the brand.
Patterns are extracted from shipped, accessibility-audited UI rather than
invented per feature — new features extend these patterns and log deliberate
deviations in their feature `decisions.md`.
