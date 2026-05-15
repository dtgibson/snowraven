# Design Spec — Species Detail
**Feature:** species-detail
**Session:** 001
**Date:** 2026-05-15
**Stage:** 4 — The Designer (approved)

---

## Visual Direction

Species Detail follows the same quiet-utility tone as the rest of SnowRaven: white card surfaces on a light gray page, Inter throughout, green (#2D8653) used only for interactive elements and filled states. The summary card leads with large, confident typography — the species name at 24px/700 weight is the first thing the eye lands on. Stats and sections are organized into cards below it, with a two-column grid for the smaller stat panels (Sightings + Media) and full-width cards for the content-heavy sections (Breeding Codes, Comments).

---

## Screens / Views

### Species selected — main view

**Layout:** Vertical stack. Species selector at top (full width), summary card below it, then a two-column grid (Sightings left, Media right), then Breeding Codes full-width, then Comments full-width.

**Species selector:**
- Full-width input (height 40px, border-radius 8px) with a search icon on the left and chevron on the right
- Opens a dropdown panel below (border-color changes to accent green on open, bottom border removed to visually merge with dropdown)
- Dropdown has a sticky filter input at the top; list items show common name + italic scientific name; selected item has green background and a checkmark

**Summary card:**
- Species common name: 24px, weight 700, letter-spacing -0.02em
- Scientific name: 14px italic, muted color (#71717A), 3px below the common name
- Below names: a row of media indicator buttons (Photo, Audio, Video) and a breeding category pill
- Media buttons: height 28px, border-radius 6px — green background + border when the species has media of that type; gray background + border when absent
- Breeding category pill: shows the highest category only ("Confirmed", "Probable", "Possible", or "Observed"), not the specific code abbreviation — uses the tier color (tier 4 = #3B0764, tier 3 = #6B21A8, tier 2 = #9333EA, tier 1 = #C084FC) at 8% opacity for background, 20% opacity for border

**Sightings card:**
- 2×2 grid of stats: Total (large, 20px/700), Personal best (20px/700), First seen (14px/600), Last seen (14px/600)
- Stat labels: 11px, uppercase, letter-spacing 0.07em, color #A1A1AA
- **Personal best, First seen, and Last seen are all links** to the eBird checklist (`https://ebird.org/checklist/{submissionId}`) containing that observation — displayed in green (#2D8653) with a small external-link icon; opens in a new tab
- Total sightings is not linked (it is an aggregate, not tied to one checklist)

**Media card:**
- Three rows: Photos, Audio, Video
- Each row: small icon + label on the left, count on the right
- Count is a green link (`https://search.macaulaylibrary.org/catalog?mediaType={type}&taxonCode={code}`) when > 0; plain muted text when 0

**Breeding Codes card:**
- One row per unique code: tier-colored dot (8px), bold code abbreviation, full label, count pill (gray badge, right-aligned)
- Rows separated by a 1px #F4F4F5 rule; last row has no rule
- Section icon: green rounded square with a sprout SVG

**Comments card:**
- Controls row (gray #FAFAFA background): keyword filter input (left) + sort toggle (Newest/Oldest, right) + comment count (rightmost)
- Sort toggle: green accent-border container, active button uses green background (#E8F5EE) + green text
- Comment rows: date (12px/600) + separator dot + location (12px/muted), then comment text (13.5px/regular, line-height 1.55)
- **First 10 comments shown by default.** A "Show all N comments" button appears below the 10th row when more exist — full-width, gray background (#FAFAFA), green text, chevron-down icon. Clicking reveals all remaining comments and hides the button.
- Last comment row has no bottom border

### No species selected

Selector shown with placeholder text. A centered prompt card replaces the detail content: shield icon in a gray rounded square, "Choose a species to see your history with it" in muted text, smaller subtext below.

### eBird loaded, no ML export

Media card shows an inline info message: info icon + "Load your ML export in Settings to see photo, audio, and video counts." Section is visible but counts are not shown.

### No eBird backup

Upload drop zone: green icon in a green rounded square, headline, description text, a dashed drop area with upload icon + instruction text, footnote about the ML export being optional.

---

## Component Usage

- All cards: white background, 1px `#E4E4E7` border, `border-radius: 12px`, subtle box-shadow `0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.03)`
- Section headers: 28px icon square (green `#E8F5EE` background, `border-radius: 7px`), 13px/600 title, 1px `#F4F4F5` bottom rule
- Buttons (sort toggle, show all): always use the accent-border container pattern — `border: 1.5px solid rgba(45,134,83,0.25)`, active state `background: #E8F5EE; color: #2D8653`
- Filter inputs: `border: 1.5px solid #E4E4E7`, `border-radius: 6px`, focus state changes border to `#2D8653`

---

## Design Tokens Applied

| Element | Token |
|---|---|
| Page background | `var(--sr-bg)` (#F9FAFB) |
| Card background | `var(--sr-surface)` (#FFFFFF) |
| Card border | `var(--sr-border)` (#E4E4E7) |
| Section dividers | `var(--sr-border-subtle)` (#F4F4F5) |
| Primary text | `var(--sr-text)` (#0F1117) |
| Muted text | `var(--sr-text-muted)` (#71717A) |
| Disabled / count text | `var(--sr-text-disabled)` (#A1A1AA) |
| Accent (links, active states) | `var(--sr-accent)` (#2D8653) |
| Accent background | `var(--sr-accent-bg)` (#E8F5EE) |
| Accent border | `var(--sr-accent-border)` (rgba 45,134,83,0.25) |
| Tier 4 (Confirmed) | `var(--sr-tier-4)` (#3B0764) |
| Tier 3 (Probable) | `var(--sr-tier-3)` (#6B21A8) |
| Tier 2 (Possible) | `var(--sr-tier-2)` (#9333EA) |
| Tier 1 (Observed) | `var(--sr-tier-1)` (#C084FC) |
| Card shadow | `var(--sr-card-shadow)` |

---

## Interaction Notes

- **Species selector:** clicking the input opens the dropdown; clicking outside closes it; the filter input inside the dropdown narrows the list in real time (case-insensitive match against common name and scientific name)
- **Taxonomic sort:** applied to the species list once the `POST /taxonomy/codes` response arrives; list is usable in A–Z order before that response arrives
- **Species switch:** selecting a new species replaces all content instantly — no loading state, all data is already parsed
- **Personal best / First seen / Last seen links:** each opens `https://ebird.org/checklist/{submissionId}` in a new tab using the submissionId of the relevant observation row
- **Media count links:** open the Macaulay Library catalog filtered by species + media type; append `&userId={userId}` when the userId is available from the ML export filename
- **Show all comments:** clicking reveals hidden rows and removes the button; no "collapse" needed

---

## Content Notes

- Species name is displayed exactly as it appears in the eBird backup (including subspecies like "Yellow-rumped Warbler (Myrtle)")
- Scientific name is taken from the same row as the common name
- Breeding category pill label: tier 4 = "Confirmed", tier 3 = "Probable", tier 2 = "Possible", tier 1 = "Observed"
- Personal best displays the max numeric count; "—" when all observations are presence-only ("X")
- Dates formatted as "D Month YYYY" (e.g. "3 March 2014"), no zero-padding on day
- Comment rows exclude empty or whitespace-only speciesComments values
