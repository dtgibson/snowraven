# Design Spec — Mobile Breeding-Codes Matrix (Comfortable Phone View)

**Feature:** mobile-wide-tables
**Stage:** 4 — The Designer
**Mockup:** `pipeline/mobile-wide-tables/design.html` (self-contained; light/dark
toggle + horizontal/rotated header toggle)
**Scope of change:** the ≤640 phone tier of the Breeding Codes matrix only.
Desktop/tablet (>640px) is byte-unchanged. Design reuses the existing matrix
styling — **zero new `--sr-*` tokens, zero design-system deviations.**

---

## Visual Direction
Quiet utility, unchanged. This is a refinement of an existing tab, not a new
look — the goal is that a phone user gets the *same* Breeding Codes tab they know
on desktop, just comfortably scannable. The only visible difference at the phone
tier is that each code column is narrower (44px → ~30px), so roughly twice as
many codes fit before the frozen name column. Every color, the purple tier dots,
the green accent reserved for links/active state, the house header, the tier
legend, and the filter pills are the app's existing tokens and patterns.

## Screens / Views

### Breeding Codes matrix — phone (≤640), the after state
- **Layout:** frozen species-name column on the left
  (`clamp(7.5rem, 40vw, 220px)`, unchanged), then a horizontally-scrollable strip
  of ~30px code columns, then the tier legend footer. Contained `overflow-x`
  scroll inside the card (no page-lurch).
- **Code column at ~30px:** the 28px tier-colored count dot centered in the cell
  with ~1px breathing room each side. The dot, its count, and its `.sr-only`
  tier-category text are unchanged from today.
- **Header treatment (the design decision):** the terse breeding code sits above
  the column, **horizontal, at 0.625rem** (one step down from today's
  0.6875rem). It stays a real sortable control with `aria-sort` on the `<th>` and
  a full-meaning accessible name (`Sort by Nest Building (NB)`). See "Key design
  decisions" below.
- **Sticky top-left corner:** the "Species ↑" header cell stays pinned at both
  `top:0` and `left:0` (z-index above the code headers), exactly as today.
- **Key design decisions for this screen:**
  1. Narrow the code column, **not** the dot — the dot stays the legible/tappable
     unit at 28px, so nothing about the count is lost.
  2. Header stays horizontal (recommended) — rotation is a reserved on-device
     fallback only if a real code overflows 30px.
  3. Contained scroll is the default; `↔ Unbounded` remains available and
     compatible with the narrowed columns.

### Before/after comparison (section 1 of the mockup)
Two 360px phone frames side by side: today's 44px columns (a ~3-column peephole,
with a code dot bleeding off the right edge — measured 3 fully-visible code
columns) vs the proposed ~30px columns (4+ fully-visible, more partials beyond —
measured, ≈ the "roughly twice as many" target). Same 8 species × 14 codes in
both, so the win is a like-for-like glance.

### The magnify feel (section 3 of the mockup)
- **Primary — native pinch:** annotated with a small "Pinch to zoom & pan" badge
  on the matrix. No custom UI ships. The whole page (frozen column included)
  scales under native viewport zoom; `position: sticky` scales correctly with it
  (unlike the reverted `transform: scale`).
- **Fallback — −/Fit/+ control:** drawn **dashed** to signal "designed but
  dormant." Three ≥44px buttons calling Tauri's native `setZoom()` (not CSS
  zoom). iOS-only, mounted only if the on-device check (QA-11) proves native
  pinch is declined — a conscious re-scope, not the default build.

## Component Usage
Reuses existing components/patterns as-is; nothing new is introduced:
- `BreedingCodeTable.tsx` — the matrix table (sticky name column, code `<th>`s,
  count-dot cells, tier legend). The only change is column width via a lifted
  class.
- `BreedingCodeList.tsx` — the tab chrome: house header, filter pills
  (All / category / per-code), A–Z/Taxonomic segmented sort, county/date
  filters, count, `↔ Unbounded` toggle.
- `<BirdName>` — the species name (green link when `hasEntry`, eBird + Birds of
  the World favicons, stacked italic scientific name).
- Tier legend footer — unchanged; spells every present code so the terse header
  is never the only place the meaning appears.

## Design Tokens Applied
All existing, both themes (no new tokens — NFR-07 / QA-18):
- **Count dots (purple tier ramp):** `--sr-tier-4` `#3B0764` (Confirmed, darkest)
  → `--sr-tier-3` `#6B21A8` → `--sr-tier-2` `#9333EA` → `--sr-tier-1` `#C084FC`
  (Possible), with the paired `--sr-tier-N-text` for the on-dot count (AA in both
  themes). Dark theme flips to `#6B21A8 / #7C3AED / #A855F7 / #C084FC`.
- **Accent (links, active state, icon tile):** `--sr-accent` `#277448` light /
  `#34D399` dark, `--sr-accent-bg` for active pill/tile fills. Green stays
  reserved for "actionable/active."
- **Surfaces/text/borders:** `--sr-bg`, `--sr-surface`, `--sr-surface-faint`
  (row hover), `--sr-text`, `--sr-text-muted` (code headers, sci names via
  `--sr-text-gray`), `--sr-border` / `--sr-border-subtle`.

## Interaction Notes (for the Engineer)
- **The width change is CSS-only.** Lift the inline `width:44` off the code
  `<th>`/`<td>` to a class (e.g. `.sr-bc-code-col`) whose base rule is `44px` and
  whose `@media (max-width:640px)` rule is `~30px`. No `useIsPhone` needed for the
  width; no `window`/`resize` read (NFR-01). Header font drops to 0.625rem at the
  phone tier via the same media query.
- **Everything else is untouched:** sticky name column + `scrollPaddingLeft`, the
  28px dot, per-column sort buttons + `aria-sort` + `aria-label`, the `.sr-only`
  tier text, filters, the tier legend, `↔ Unbounded`.
- **Magnify = native pinch, no code.** Do not add CSS `zoom` or
  `transform: scale()` (proven WKWebView failures — FR-08/NFR-03). Keep the
  viewport meta clamp-free (FR-09).
- **Fallback control is not built by default** — only on a QA-11 failure, gated
  on `isIOS()` + `useIsPhone()`, session-only `useState`, calling
  `getCurrentWebview().setZoom()`.
- **On-device gate (QA-11):** whether the shipping iOS WKWebView honors native
  pinch, and keeps the sticky column sane under it, is the one thing the mockup
  cannot prove and must be eyeballed on real hardware before ship.

## Content Notes
- Realistic data throughout: American Robin, Song Sparrow, House Finch, Barn
  Swallow, Northern Cardinal, Tree Swallow, Chipping Sparrow, House Wren, with a
  believable partial fill (not every cell filled) across the real eBird breeding
  codes (S, H, P, T, C, N, NB, CN, CF, FL, FY, ON, NE, NY) at their true tiers.
- Copy tone is informative and plain, matching the app ("Your confirmed &
  possible nesting, by species").

---

## Key design decisions (what the user should weigh)

### 1. Code-header treatment — CHOSEN: horizontal, one step smaller
The terse code stays horizontal above the dot at 0.625rem. eBird breeding codes
are 1–3 characters (S, H, CF, FL, NB, ON, S7), all of which fit in 30px. This is
the most faithful option (zero mechanism change), gives the biggest header tap
target, and carries no sticky-corner alignment risk.
- **Alternative shown (toggle in the mockup): rotated/vertical header.** Buys room
  for longer labels but grows the header band ~2×, complicates the sticky
  top-left corner, and makes a small header an awkward vertical tap target.
  Reserved as an on-device-only fallback *if* a real code overflows 30px.
- **Rejected: dot-only (legend header).** Cleanest look but strands the per-column
  sort control and breaks the "this column is CF" identity — a step too far.

### 2. The −/Fit/+ fallback control — RECOMMENDED: hidden by default
Ship native pinch alone; add the control only if QA-11 proves the WebView
declines pinch (iOS-only, conscious re-scope). A visible zoom control on a page
that already pinches invites confusion — but it is a one-line flip to always show
it on iOS if the user prefers a belt-and-braces affordance.
