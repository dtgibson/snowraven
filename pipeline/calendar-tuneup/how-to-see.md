# How to see the Calendar tune-up (v0.5.61)

Run the app locally:

```
# Backend
cd backend && uvicorn main:app --reload --port 1620
# Frontend (separate terminal)
cd frontend && npm run dev
```

Open http://localhost:5173, load your eBird backup in Settings if you haven't, then go to the
**Calendar** tab.

## 1. Searchable species filter
- In the control row, the **Species** control is now a text box with a search icon (not a
  drop-down). Click it — a list opens.
- Type part of a common **or** scientific name — the list narrows as you type.
- Use ↓/↑ to move the highlight, **Enter** to pick, **Esc** to close. The whole calendar (cells,
  shading, legend, popup) redraws for that one species.
- Reopen and pick the **All species** row at the top (or press Enter on it) to clear the filter.
- Cross-check: **Species Detail** tab — its species picker is the same shared component and behaves
  identically (it was the reference implementation).

## 2. Phones show only the Large view
- On a desktop the **View: Large | Compact** toggle is visible; Compact shows the 3×4 mini-month
  overview.
- Narrow the browser to ≤640px (or use responsive mode / a phone). The View toggle disappears and
  the calendar always shows the big **Large** month grids in a single column — even if you had set
  Compact at a wider width first (resize from Compact-desktop → phone to confirm it switches to
  Large rather than stranding you in mini-months).
- Months stack with slightly tighter spacing and the day numbers read a touch larger on phones.

## 3. The date in every cell (the real fix)
- In the **Large** view, every day cell now shows its **day-of-month number in the top-left
  corner** (wall-calendar style) alongside the count. Blank no-birding days are dated too.
- Click **All years**. Because the combined view aligns weekday columns to a fixed reference year,
  a given cell *position* can be a different date than in a single-year view — now you read the
  **date in the corner**, so a day never looks like it "moved" when you switch a specific year ↔
  All years. The count itself was always correct; this just labels it.
- The Compact thumbnail view stays count-only (the date is in the hover tooltip).

## Themes / accessibility
- Toggle dark mode (Settings → Appearance) — the corner date uses the AA-guarded `--sr-cal-fg`
  on data cells and `--sr-text-muted` on blank/zero cells in both themes.
- At 200% in-app text scale and 320px width the date + count still fit (sizes are in rem).
