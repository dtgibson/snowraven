# Design Spec — Color-Coded Hotspots

**Feature:** color-coded-hotspots
**Date:** 2026-08-24
**Stage:** 4 — The Designer (approved direction 1)
**Sources:** design.html (the definitive rendered record), decisions.md (logged deviations and measured ratios), schema.md (token/guard contract), prd.md (FR ids)

---

## Visual Direction

The Hotspots view gains three opt-in readings without changing its shipped face: a cyan-blue five-class ramp (deliberately apart from the county green, atlas purple, personal amber, and share-pin red-orange — FR-27) carries every number, and everything that is not a number gets structure instead of hue — a dashed ring for "not checked," a hollow pin for "asked, answer is zero," a pale empty pin for "never birded." The design system is extended, not evolved: existing type, spacing, pill/label/button patterns, popup structure, and the accent's role are all unchanged; the only new color is the hotspot token family. The ramp is strictly luminance-monotonic so it orders itself in grayscale, and every value is also stated in words in the popup and the "Hotspots in view" list, so nothing depends on perceiving color.

---

## Screens / Views

### The sidebar mode control (Hotspots view only, FR-01/FR-04)

A new block in the existing sidebar filter column, below the Find Hotspots button/result note and above the Legend block, following the house `sb-block` pattern (top border + 14px padding-top):

- **Section label:** `Color pins by` (the standard uppercase sidebar label style).
- **Mode pills:** a 2-column grid (`grid-template-columns: 1fr 1fr; gap: 6px`) of four pill buttons — `Visited status` (default), `My species`, `My checklists`, `Recent activity`. Pill anatomy: 15px border-radius, `min-height: 30px`, padding 4px 10px, 0.75rem/600 text, `--sr-border-medium` border on `--sr-surface`; hover `--sr-surface-subtle`; selected (`aria-pressed="true"`) fills `--sr-accent` with `--sr-on-accent` text and accent border; `:focus-visible` 2px accent outline, 2px offset.
- **Window row (mode 3 only, FR-10):** revealed only while Recent activity is active, via an animated collapse (see Motion Spec). Contains a small muted label `Time window`, then two pills `Week` / `30 days` in the same 2-up grid, same pill anatomy, defaulting to Week.
- **Status line:** directly under the window pills — an always-rendered `aria-live="polite"` region (`min-height: 1.2em` so idle reserves the line), 0.71875rem muted text, optionally led by an 11px spinner. Below it, a 3px progress track (`--sr-border-subtle`) with an accent fill, shown only while a pass is running.

### The map pins, all four modes

All pins remain the shipped 28x40 teardrop (same path, same `--sr-map-pin-stroke` #3F3F46 ring at 1.5px) on the GL symbol layer. Mode fills REPLACE the kind fill; the kind survives as the glyph baked into every sprite (FR-22): visited = check stroke (`M8 15L12 19L20 11`, width 2.5, round caps/joins), unvisited = two dots (r 3.5 at 10,13 and 18,13), personal = five-point star.

1. **Visited status (default):** byte-identical to shipped — visited `--sr-map-pin-visited`, unvisited `--sr-map-pin-unvisited`, personal `--sr-map-pin-personal`, white glyphs (FR-03).
2. **My species / My checklists:** nonzero values on ramp classes 1–5 (`--sr-hotspot-1..5`), white glyph. Visited-with-zero renders the **zero** state: `--sr-hotspot-zero` rim with a hollow inner disc (circle cx 14, cy 14, r 8.5, fill `--sr-hotspot-pale`), glyph in dark slate #43424A. Never-birded renders the **nodata** state: `--sr-hotspot-nodata` pale fill, glyph #52525B; the dark stroke ring supplies the boundary (FR-08).
3. **Recent activity:** answered nonzero on the same ramp; answered-zero renders **quiet** — visually identical to zero (same hollow construction, shared token, distinct wording; FR-13); not-yet-answered renders **unanswered** — `--sr-hotspot-unanswered` fill plus a DASHED stroke ring (`stroke-dasharray: 3 2.6`), white glyph (FR-12).
4. **Personal locations (every mode, FR-21):** the shipped amber star pin, always. Personal pins never join a ramp, never enter tier computation, and are never fetched.

Sprite inventory is the schema's fixed table: 16 mode sprites (5 tiers x 2 kinds, quiet x 2, unanswered x 2, nodata unvisited-only, zero visited-only) beside the 3 shipped ones. Glyph color per state: white #FFFFFF on ramp and unanswered fills; #43424A on the hollow pale disc; #52525B on the nodata fill (decisions.md item 6). These glyph colors are sprite-baked literals under the basemap-anchored GL exception, not tokens.

### The legend (FR-24)

**Activating any color mode auto-reveals the legend content** (the FR-24 call, decided). Two renderings:

- **Default mode (shipped shape):** note `Click a row to hide or show that pin category.` and three full-width rows — mini pin (22x31) + `Visited` / `Unvisited` / `Personal` + count — each an `aria-pressed` toggle; a hidden kind's row drops to 0.4 opacity.
- **Mode active:** a bolded legend title with a middle-dot suffix:
  - `My species · your countable species per hotspot, this search`
  - `My checklists · your checklists per hotspot, this search`
  - `Recent activity · species in the last week` / `· species in the last 30 days`

  Then one row per RENDERED ramp class: mini pin (18x26) in the class fill + the class's true min–max value range from the current result set (`3` or `6–15` style, tabular numerals, en dash). Then only the off-ramp states in effect, each with its meaning in words:
  - `Not birded by you` (nodata mini, modes 1/2, always in effect)
  - `Visited, 0 countable species` (zero mini, mode 1, only when some pin has it)
  - `Quiet, no reports in this window` (hollow mini, mode 3, only when present)
  - `Not checked yet` (dashed mini, mode 3, only while any pin is unanswered)
  - `Personal location` (personal mini, always — FR-21)

  Then the kind filters as **glyph chips** (FR-23 keeps working under a mode; color no longer encodes kind, so the glyph carries it): note `Show or hide kinds. Glyphs carry the kind while a mode is active.` and three `aria-pressed` chips — `✓ Visited 15` / `•• Unvisited 4` / `★ Personal 2` (glyph, label, muted count; 26px min-height, 15px radius; off = 0.4 opacity). Glyphs are decorative (`aria-hidden`); the chip's accessible name is the label.

### The popup, every condition (FR-25)

The shipped popup structure is retained in full (name, visited-state species-recorded line, last visit, personal tag + observations, the eBird link). A **mode line** joins it directly under the name while a mode is active: a 10px rounded-square swatch (3px radius, 1px `--sr-map-pin-stroke` border) + the reading in words. Exact wording per state is in Content Notes; conditions covered: ramp value (modes 1/2 and mode 3 with window), zero (+ its explanatory line), never birded, quiet (+ its explanatory line), unanswered, cached (+ as-of line), and personal (no mode line — the shipped Personal Location card unchanged). The swatch shows the class fill on ramp; `--sr-hotspot-pale` for zero AND quiet (the hollow center is what the eye matches); `--sr-hotspot-nodata` for never birded; `--sr-hotspot-unanswered` for unanswered. Close affordances: the x button and Escape, one close path (house rule). Hiding a selected pin's kind via the filters also closes its popup.

### The "Hotspots in view" list (FR-26)

Shipped rows keep their name + secondary line (`Visited · 71 species` / `Unvisited hotspot` / `Personal location · 214 observations`). While a mode is active each row adds: a state-matched 9px leading dot (ramp fill; hollow variant = 8px disc in `--sr-hotspot-pale` with a 2.5px `--sr-hotspot-zero` rim; dashed variant = 1.5px dashed `--sr-map-pin-stroke` ring on `--sr-hotspot-unanswered`) and a right-aligned value column (tabular numerals): the number for ramp, muted `0` for zero/quiet, muted `not birded` for nodata, muted `…` for unanswered. With the default selected the list is unchanged. This is the keyboard/no-color reading path (the mock's DOM pin focus ring is mock-only; on the GL layer the list + popup carry keyboard parity, as shipped).

### Progressive fetch and degradation states (mode 3, FR-12/FR-14/FR-19)

All in the sidebar status area under the window pills; pins already answered ALWAYS keep their colors, and unanswered pins stay in the dashed gray:

- **Checking:** spinner + `Checking activity: 14 of 19 hotspots` + progress bar filling per arrival. Cached answers color first, before any network activity.
- **Done:** `All 19 hotspots checked just now.` (no spinner, track hidden).
- **Cached pass:** `Activity from cache, fetched 9:40 AM.` — instant recolor, zero requests.
- **Window flip while data is held:** confirmation status (`Window switches never refetch.` appended to the cached line, or `Window switched. Zero new requests, one cached call answers both.` after a live pass), zero requests.
- **Offline:** the classified warn box `You're offline. This needs a connection.` + a cached-coverage line (`Showing cached activity for 11 hotspots, fetched 9:40 AM. 8 more stay in the not-checked gray until you're back online.`) + `↻ Retry` pill + the reassurance `My species and My checklists still work fully offline.`
- **No eBird key:** warn box `eBird API key not configured. Add it in Settings.` + `Recent activity needs your own eBird key. Pins stay in the not-checked gray until one is added.` + `↻ Retry`.
- **Lookup failed:** warn box `Something went wrong. Please try again.` + `12 hotspots kept the answers that already arrived. Retry re-asks only the 7 that failed.` + `↻ Retry`. Retry never re-runs the hotspot search (FR-14).
- **Cap reached (FR-19):** `Checked the 200 hotspots nearest your search center.` + `14 more stay in the not-checked gray. Search a smaller area to cover them. Cached hotspots never count against the 200.`

---

## Component Usage

- **Mode + window pills:** plain `<button>`s with `aria-pressed` (the SegControl/pill convention), inside the sidebar filter block. Layout via lifted classes, never inline breakpoint styles; the block takes `.sr-ctl-row`, each pill `.sr-touch-target` (NFR-07).
- **Status region:** always-rendered `role="status"` / `aria-live="polite"` with a sequence-keyed message child (the SharePopup pattern). This is a per-arrival progress surface: **throttle the emission, not the announcement** (the v0.5.87 rule) — sentence, progress bar, and N-of-M stay one source of truth; never throttle a terminal status or the first definite figure.
- **Spinner:** lucide `Loader2` twin, 11px, `aria-hidden` (the text carries the state). **Progress bar:** 3px track + accent fill divs.
- **Warn boxes:** the app's existing classified-error treatment on the warn tokens (`--sr-warn-bg/-border/-text`), driven by the shared `classifyLiveError` / `OFFLINE_MESSAGE_SHORT` / `GENERIC_ERROR_MESSAGE` constants — the mock's box copy matches them; do not fork the strings.
- **Retry:** a pill button in the accent-outline style (accent text on `--sr-accent-bg`, accent border, 15px radius, min-height 30px), `.sr-touch-target` on phone; the `↻` glyph `aria-hidden`.
- **Legend rows / kind chips / in-view rows:** the existing MapSidebarUI legend and `ivrow` patterns extended as above; legend mini pins and in-view dots must derive from the SAME sprite/geometry source the layer paints from (the CountyDensitySwatch precedent, NFR-10 — the legend cannot drift from the map).
- **Pins:** GL symbol-layer sprites in `HotspotMarkers.tsx` + `lib/mapPins.ts` per the schema (baked `ImageData` variants; mode/window/readings are PROPS, never in the marker `key`; default-mode path byte-identical). No per-pin DOM.
- **Popup:** the existing single state-driven popup, escaped JSX; the eBird link is the shipped hotspot-link affordance, unchanged.

---

## Design Tokens Applied

All hotspot tokens are **map-anchored and theme-identical**: the same values in `:root` AND `[data-theme="dark"]` of `globals.css`, because they only ever paint on the always-light basemap (the `--sr-map-pin-*` precedent; state the identity in a comment, as the mock does). Each ships with its `-rgb` twin per the schema. GL reads them at runtime and re-resolves on the `data-theme` MutationObserver (NFR-03).

### Ramp (both themes)

| Token | Value | vs TINT_GRASS (measured) |
|---|---|---|
| `--sr-hotspot-1` | `#2C89AA` | 3.27:1 |
| `--sr-hotspot-2` | `#24709A` | 4.46:1 |
| `--sr-hotspot-3` | `#1C5883` | 6.21:1 |
| `--sr-hotspot-4` | `#153F63` | 8.95:1 |
| `--sr-hotspot-5` | `#0E2A47` | 11.95:1 |

Luminance strictly monotonic (grayscale-ordered, NFR-02). Adjacent-step ratios, measured: 1.36 / 1.39 / 1.44 / 1.34 — guard floor stays **1.2:1** (the county floor; the mock prose's "at least 1.33" describes the measured minimum, it is not the guard clause).

### State tokens (both themes)

| Token | Value | Role | Measured |
|---|---|---|---|
| `--sr-hotspot-unanswered` | `#6A6A72` | solid fill + dashed sprite ring | 4.39:1 vs land |
| `--sr-hotspot-zero` | `#565661` | the hollow rim; SHARED by zero and quiet (decisions.md item 1 — confirmed, not split) | 5.94:1 vs land |
| `--sr-hotspot-nodata` | `#EDE9E3` | pale "empty pin"; ring supplies boundary | see deviation below |
| `--sr-hotspot-pale` | `#F1EEE8` | non-guarded companion: the hollow-center inner disc (and the popup swatch for zero/quiet) | exempt from fill clauses |

State pairwise separations, measured: unanswered/zero 1.35, step1/unanswered 1.34, step1/zero 1.82 (guard floor 1.2:1 pairwise, and each vs ramp step 1).

### The nodata deviation — exact guard clauses for `hotspotContrast.test.ts`

`--sr-hotspot-nodata` **deviates from the schema's uniform "every state fill ≥3:1 vs land" clause, by design** (decisions.md item 2): "never birded by me" must read as absence, and any guard-compliant dark gray reads as "something" — the FR-08 confusion the state exists to prevent. It is the pin-scale twin of the county overlay's "unrecorded = outline only." The guard encodes these REPLACEMENT clauses for nodata (all other ramp/state fills keep the ≥3:1-vs-land clause as written):

1. The nodata fill is LIGHT: **≥3:1 against each of the other two state fills** (`--sr-hotspot-unanswered`, `--sr-hotspot-zero`) **and against ramp step 1** (`--sr-hotspot-1`) — measured 3.30:1 vs step 1.
2. The ring (`--sr-map-pin-stroke` #3F3F46) is **≥3:1 against the land tints** (measured 8.56:1 vs TINT_GRASS, the palest/binding tint) **and against the nodata fill itself** (measured 8.64:1).

Additional guard content per schema: every token + `-rgb` twin present in BOTH theme blocks (and identical); land contrast computed against the exported `TINT_*` constants in `lib/mapStyle.ts` with TINT_GRASS as the binding case; and a stated dormant clause — no text rides any pin fill, so the 4.5:1 on-fill rule does not apply, said in the test so a future number-on-pin change trips over it. `--sr-hotspot-pale` is deliberately outside the fill clauses (it is an inner-disc surface bounded by the zero rim, never a pin boundary against the map); assert its presence/theme-identity only.

### Sprite-baked glyph literals (not tokens; basemap-anchored exception)

- White `#FFFFFF` glyph on all ramp fills and on unanswered.
- Dark slate `#43424A` glyph on the hollow pale disc (computed 8.56:1 vs `#F1EEE8`).
- `#52525B` glyph on the nodata fill (computed 6.39:1 vs `#EDE9E3`).
- Ring/dash color everywhere: `--sr-map-pin-stroke` `#3F3F46`, width 1.5; dash pattern `3 2.6`.

---

## Interaction Notes

- **Mode switching** is a cosmetic in-place re-render: no remount, no re-fit, no popup dismissal (NFR-04; mode/window/readings are props, never in the marker `key`). An open popup's mode line updates live on switch. Selecting Visited status restores the shipped rendering exactly.
- **Legend auto-reveal:** activating any color mode reveals the mode legend content described above (FR-24, decided); deactivating returns the default kind legend.
- **Recent activity pass:** on activation, cached answers (fresh AND stale) color immediately, then the remainder arrives pin by pin — in-view first, then nearest the search center, cap 200 with the cap sentence in words (FR-12, FR-19). The status line and progress bar track N of M; the dashed not-checked gray is the only state an unanswered pin can show.
- **Week / 30-day flip:** instant, zero requests, always — one cached entry answers both windows (FR-16). Pins, legend title, class ranges, and any open popup all recompute; the status line states the zero-request fact. Quantile breaks recompute per mode/window/result set (fewer distinct values, fewer classes — FR-20).
- **The four honest non-values**, never confusable (FR-08/FR-13): **zero** (modes 1/2: visited, asked-of-your-data, answer 0 — hollow), **quiet** (mode 3: fetched, answer 0 — hollow, different words), **not checked** (mode 3 only: no answer exists — dashed solid gray), **never birded** (modes 1/2: no data rows at all — pale empty pin). Zero and quiet share fill and can never co-occur; quiet requires an ANSWER, so a failed fetch is always "not checked," never quiet. None can occupy the ramp's lowest band.
- **Kind filters under a mode:** the legend's glyph chips hide/show the same pins as today (FR-23); hiding the selected pin's kind closes its popup.
- **Failure and retry:** classified into exactly offline / no key / lookup error; answered pins keep colors; `↻ Retry` re-asks only the unanswered remainder without re-running the hotspot search (FR-14).
- **Popup close:** one close path — the x, Escape, or hiding its kind — per the house overlay rule.
- **Keyboard/no-color path:** every control (`modepill`, window pill, kind chip, legend row, in-view row, retry, popup close) is a real focusable button with `:focus-visible` accent outline; the full reading is available from the in-view list and popup without color (FR-25/FR-26, NFR-02).
- **Phone tier (NFR-07, at 320px and 200% text scale):** the mode grid, window pills, and retry join the sidebar filter block under `.sr-ctl-row` (every interactive descendant at the `max(16px, 0.75rem)` floor) with `.sr-touch-target` for the ~44px posture at ≤640; the mode and window grids stay two-up (the 2-column grid wraps 2 x 2); all layout via lifted classes, no inline breakpoint styles, no page horizontal scroll leak.

---

## Motion Spec

- Pin fill recolor (mode/window switch, arrival): ease-out, 180ms, fill cross-fade (no transform), reduced-motion instant, mock CSS transition — on the GL symbol layer an `icon-image` swap is instantaneous and that is ACCEPTED (do not add DOM pins to buy the fade); any GL paint `-transition` used must pass duration 0 under `prefersReducedMotion()` (v0.5.91 rule).
- Answer-arrival pop: cubic-bezier(0.16, 1, 0.3, 1), 220ms, transform-origin the pin tip (14px 40px), scale 0.82 to 1; reduced-motion none (answers land in one batch, no pop) — mock CSS keyframe; on the GL layer the recolor itself is the arrival cue and the scale pop does NOT ship (no per-feature entrance animation on a symbol layer; NFR-04).
- Popup open: cubic-bezier(0.16, 1, 0.3, 1), 160ms, transform-origin 50% 100% (the anchor tip), opacity 0 to 1 + scale 0.92 to 1, reduced-motion instant, CSS animation on the DOM popup.
- Window-row reveal/collapse: ease-out, 180ms max-height + margin with 160ms opacity, collapses toward the top, reduced-motion instant, CSS transition on a lifted class.
- Progress fill: ease-out, 200ms width, n/a, reduced-motion instant, CSS transition.
- Loading spinner: linear, 1s/revolution continuous (a loading indicator, exempt from the enter/exit motion ceiling), center origin, reduced-motion static ring (the N-of-M text carries progress), CSS keyframe on the Loader2 twin.
- Control hover/press (mode/window pills, kind chips, legend rows, in-view rows, retry): ease-out, 120ms background/color/opacity (filter brightness on Find/Retry), n/a, reduced-motion instant, CSS transitions.
- Pin hover: ease-out, 140ms brightness + drop-shadow in the mock; on GL this ships as the existing `updateMapCursor` pointer affordance only, no filter animation; reduced-motion n/a.

---

## Content Notes

Tone: plain, honest, unhurried — states are answers, not apologies. No em dashes anywhere in this copy (middle dots and en dashes as shown are the sanctioned glyphs). `9:40 AM` and all counts below are demo values; the app renders real times/counts. Window words in sentences are lowercase `week` and `30 days`.

**Controls:** `Color pins by` · `Visited status` · `My species` · `My checklists` · `Recent activity` · `Time window` · `Week` · `30 days` · `↻ Retry`.

**Legend:** titles `My species · your countable species per hotspot, this search`, `My checklists · your checklists per hotspot, this search`, `Recent activity · species in the last week` / `30 days`; class rows show true min–max ranges (`6–15`); state rows `Not birded by you`, `Visited, 0 countable species`, `Quiet, no reports in this window`, `Not checked yet`, `Personal location`; chips note `Show or hide kinds. Glyphs carry the kind while a mode is active.`; default-mode note `Click a row to hide or show that pin category.`

**Status line:** `Checking activity: {n} of {m} hotspots` · `All {m} hotspots checked just now.` · `Activity from cache, fetched {time}.` · `Activity from cache, fetched {time}. Window switches never refetch.` · `Window switched. Zero new requests, one cached call answers both.` · `Checked the {cap} hotspots nearest your search center.`

**Degradation panels:** warn boxes reuse the shared constants (`You're offline. This needs a connection.` / `eBird API key not configured. Add it in Settings.` / `Something went wrong. Please try again.`); supporting lines: `Showing cached activity for {n} hotspots, fetched {time}. {k} more stay in the not-checked gray until you're back online.` · `Recent activity needs your own eBird key. Pins stay in the not-checked gray until one is added.` · `{n} hotspots kept the answers that already arrived. Retry re-asks only the {k} that failed.` · `{k} more stay in the not-checked gray. Search a smaller area to cover them. Cached hotspots never count against the {cap}.` · `My species and My checklists still work fully offline.`

**Popup mode lines:** `My species: {value}` · `My checklists: {value}` · `{value} species reported in the last week` / `in the last 30 days` · zero adds `Only spuh and slash entries so far.` · never birded: `You have not birded this hotspot` · quiet: `No species reported in the last {window}` plus `Quiet right now. An answer, not a gap.` · unanswered: `Activity not checked yet` · cached adds `From cache, fetched {time}.` Mode 3's label is deliberately `species reported` — eBird's taxa as returned, no countable-form collapse (the Architect's flagged Note, confirmed) — while modes 1/2 say `My species` / `My checklists`; the mode-1 number and the shipped `{n} species recorded` line legitimately differ on the same popup (countable rule vs raw), both render, labeled. All shipped popup content (name, `{n} species recorded`, `Last visit: {date}`, `Personal Location` tag, `{n} observations`, `View on eBird`) is retained verbatim.

**In-view list:** shipped secondary lines retained (`Visited · {n} species`, `Unvisited hotspot`, `Personal location · {n} observations`); value column renders the number, muted `0`, muted `not birded`, or muted `…`.

**Discrepancies resolved (decisions.md wins):** the guard's adjacency clause is the 1.2:1 floor with 1.36/1.39/1.44/1.34 as the measured record (the mock prose's "at least 1.33" is description, not a clause); `--sr-hotspot-pale` (#F1EEE8) appears in decisions.md but not the schema's token list — it ships as the non-guarded companion exactly as decisions.md states. The mock's states-gallery caption sentences (e.g. "Personal pins keep their orange star in every mode.") are presentation-frame annotation, not app copy.
