# Design Spec — Is Target Filter and Map Icons

## Visual Direction

Extends the existing SnowRaven aesthetic — clean, quiet utility with restrained green accent (#2D8653). The "Is Target" concept gets its own amber/orange tone (#C2410C on #FFF7ED) to distinguish it from both the positive green pills ("Has media") and the negative red pills ("No photo"). Map pin icons follow the existing pill label system exactly — same font, same border, same shadow — with 10px SVG icons appended to the right.

## Screens / Views

### Media List — Filter Bar

- "Is Target" pill appears immediately after "Has media," before the first `pill-sep` divider
- Pill uses amber styling: `background: #FFF7ED; color: #C2410C; border-color: rgba(194,65,12,0.35); font-weight: 600`
- Includes a small 10px target/crosshair SVG icon to the left of the text label
- When active, follows the same font-weight-600 pattern as other active pills
- "All" resets this pill along with all others
- Count bar reads "N of M species · Is Target filter active" when the filter is applied

### Map Explorer — Target Pin Labels

- Pin labels retain their existing pill shape: `padding: 3px 8px; border-radius: 10px; border: 1.5px solid rgba(255,255,255,0.85); box-shadow: 0 2px 6px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.1); display: inline-block`
- Missing-type icons appear to the right of the species name, separated by a 5px gap (via flexbox on the inner content)
- Icons are 10px SVGs using `stroke="currentColor"` — they inherit the label's text color automatically
- Icon gap between each icon: 3px
- Camera SVG = missing Photo; Mic SVG = missing Audio; Video camera SVG = missing Video
- Only missing types are shown; never the types the species already has

### Map Explorer — Sidebar Target Count

- "N target species" text rendered as a styled `<button>` or `<span>` with `cursor: pointer`
- Color: `var(--sr-accent)` (#2D8653)
- Text decoration: `underline; text-decoration-color: rgba(45,134,83,0.4); text-underline-offset: 2px`
- Hover: `text-decoration-color: var(--sr-accent)` (full opacity)
- Sub-label text updated from "from ML export · no media recorded" to "from ML export · missing ≥1 media type"

## Component Usage

- **Filter pills** — inline `<button>` elements with class-equivalent inline styles (existing pattern in `LifeList.tsx`). "Is Target" uses a new amber style variant alongside the existing `positive`, `negative`, and `none` variants.
- **Pin label content** — Leaflet `divIcon` with `display: inline-block` inner div (established in v0.1.2 maintain session). Icons appended as inline SVG strings inside the same div, using `escHtml()` for the species name portion.
- **Target count link** — clickable `<span>` inside the existing target count card in `MapExplorer.tsx`.

## Design Tokens Applied

- Is Target pill bg: `#FFF7ED` (amber-50, not in current token set — add as inline style or new token)
- Is Target pill text: `#C2410C` (orange-700)
- Is Target pill border: `rgba(194,65,12,0.35)`
- Target count link color: `var(--sr-accent)` (#2D8653)
- Pin icons: `currentColor` (inherits from pin label text, either white or `var(--sr-map-target-old-text)`)

## Interaction Notes

- **"Is Target" pill toggle:** clicking activates/deactivates; "All" always resets it
- **"Is Target" + "Has media" combination:** AND logic — shows only partial-coverage species (has some, missing at least one)
- **Target count link click:** calls `onNavigateToMediaList()` prop → App.tsx switches tab to `'life-list'` and sets `mediaListFilter: 'is-target'` → LifeList activates the pill via `requestedFilter` prop → App resets `mediaListFilter` to null
- **Pin icon rendering:** computed when building `displayedTargetPins` useMemo — each pin gets `missingTypes` array derived from `mediaTypes.get(pin.comName)`

## Content Notes

- "Is Target" — two words, title case, no hyphen
- Sub-label: "from ML export · missing ≥1 media type" (middle dot separator, consistent with existing sub-labels)
- Count bar suffix: "· Is Target filter active" appended when filter is on
- No tooltip needed on pin icons — the icon shapes (camera, mic, video) are self-explanatory at this size
