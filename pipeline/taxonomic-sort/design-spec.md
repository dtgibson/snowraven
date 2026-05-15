# Design Spec — Taxonomic Sort

## Visual Direction

Consistent with the established SnowRaven brand: quiet utility, #2D8653 Irish clover green as the single active-state color, white cards on a #F9FAFB background. The sort toggle uses a segmented button group — a compact, familiar control that doesn't compete with the filter pills for visual weight.

---

## Screens / Views

### Media Life List — Controls Row

The controls row gains a sort toggle between the filter pills and the right-side count/action buttons.

**Layout (left to right):**
1. Filter pills (All · No photo · No audio · No video · Has photo · Has audio · Has video)
2. 1px vertical separator (`#E4E4E7`, 20px tall)
3. Sort toggle (segmented button group: A–Z | Taxonomic)
4. [right-aligned] Species count label · Show all ghost button · Load new file ghost button

**Sort toggle design:**
- Container: `display: inline-flex`, `border: 1.5px solid #E4E4E7`, `border-radius: 6px`, `overflow: hidden`
- Each button: `height: 30px`, `padding: 0 13px`, `font-size: 12px`, `font-weight: 500`
- Between buttons: `border-right: 1.5px solid #E4E4E7` on the left button
- **Inactive button:** `background: #fff`, `color: #71717A`; hover → `background: #F4F4F5`
- **Active button:** `background: #2D8653`, `color: #fff`
- Each button carries a small Lucide icon (left of label): A–Z gets a text-align lines icon; Taxonomic gets a bullet-list icon

**Table behavior:**
- Clicking A–Z or Taxonomic clears any active column-header sort and re-sorts by name
- When a count column (Entries/Photo/Audio/Video) is the active sort, the toggle retains its visual state and acts as tiebreaker for equal counts

### Breeding Codes — Controls Row

Identical sort toggle structure, placed after the breeding code filter pills. Default active state is A–Z (unlike Media List which defaults to the last-selected mode).

**Layout (left to right):**
1. Breeding code filter pills (All · NY · NE · CF · B · A · H · …)
2. 1px vertical separator
3. Sort toggle (A–Z | Taxonomic)
4. [right-aligned] Species count label · Show all ghost button · Load new file ghost button

**Table behavior:**
- Clicking A–Z or Taxonomic clears any active code-column sort
- When a code column is active, toggle acts as tiebreaker

---

## Component Usage

| Component | Usage |
|---|---|
| Segmented button group | Sort toggle on both tabs — custom implementation, no shadcn component needed |
| Existing filter pills | Unchanged; sort toggle added alongside |
| Existing ghost buttons | Unchanged |
| Existing table headers | Unchanged — column sort and toggle coexist |

---

## Design Tokens Applied

| Token | Value | Applied to |
|---|---|---|
| `--primary` | `#2D8653` | Active sort button background |
| `--primary-foreground` | `#FFFFFF` | Active sort button text |
| `--border` | `#E4E4E7` | Toggle border, separator |
| `--muted` | `#F4F4F5` | Inactive button hover |
| `--muted-foreground` | `#71717A` | Inactive button text, count label |
| `--radius` | `0.5rem` / `6px` | Toggle border radius (matches pill radius) |

---

## Interaction Notes

- **Clicking A–Z or Taxonomic:** Clears `mlColSort` / `bcColSort` to null; sets `nameSortMode`; re-renders table
- **Clicking a count column header (while toggle is active):** Sets column sort; toggle button stays visually active; column sort takes priority; toggle drives tiebreaker
- **Default on file load:** A–Z active (both tabs)
- **Before taxonomy fetch resolves (ML export only):** Taxonomic button is visible and clickable; table renders in A–Z order until `orders` map populates; re-sorts automatically when fetch completes — no spinner or disabled state required
- **Reset ("Load new file"):** Sort returns to `{ column: 'name', dir: 'asc', nameSortMode: 'az' }`

---

## Content Notes

- Drop zone copy for ML export: remove "no network lookups" / "entirely offline" claim; accurate replacement should note that a lightweight taxonomy fetch fires after file load (used for species links and taxonomic sort)
- Sort button labels: "A–Z" (en-dash) and "Taxonomic" — match Life List Comparer labels exactly
