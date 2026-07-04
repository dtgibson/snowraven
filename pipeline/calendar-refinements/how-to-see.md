## Seeing the Calendar refinements locally

These three changes all live on the **Calendar** tab, which reads the eBird backup you've
already loaded into SnowRaven. You'll need the app running with a backup saved in Settings.

### 1. Start the app

1. Open a terminal in your project folder (`snowraven`).

2. Start the backend (it serves your data on port 1620):

   ```
   cd backend && uvicorn main:app --reload --port 1620
   ```

3. Open a **second** terminal in the same project folder and start the frontend:

   ```
   cd frontend && npm run dev
   ```

4. Open your browser to:

   ```
   http://localhost:5173
   ```

5. If you haven't already, go to **Settings** and upload your eBird backup
   (`MyEBirdData.csv`). The Calendar tab needs it.

### 2. Open the Calendar tab

Click **Calendar** in the tab bar. You should see a year of your birding laid out as
twelve month grids, each day shaded green and numbered.

### 3. Try the new "Total count" metric

- In the **Show** control at the top, you'll now see **three** options:
  Species · Checklists · **Total count**.
- Click **Total count**. Every day repaints to the total number of *individual birds* you
  recorded that day (the eBird Count column, summed). The legend on the right now reads
  **"Individuals / day"** and the line under the year label reads
  **"Individuals recorded each day."**
- Notice that the low-emphasis **"Count spuh, slash & hybrids"** switch at the bottom is
  still active under Total count (it dims only under Checklists) — flip it and the grid
  re-shades.
- Click any day: the popup now shows **three** numbers — species, checklists, and
  individuals — no matter which metric the grid is on.
- A day where you only entered "X" (present, uncounted) reads **0 individuals**, but still
  opens as a shaded "birded" day.
- Pick a bird in the **Species** dropdown and keep Total count selected — now the calendar
  shows how many of *that one bird* you recorded each day across the view.

### 4. See the renamed View toggle

- On the right of the control strip, the **View** toggle now reads **Large | Compact**
  (it used to say Months | Year). Both show the whole year — only the cell size differs.
- **Large** is the big month grids (the default). **Compact** is the small all-months
  overview.

### 5. See day numbers in the Compact view

- Click **Compact**. You'll get the 3×4 grid of small month thumbnails.
- Each populated day now shows its **number** (matching the active metric — species,
  checklists, or total individuals). Days you birded but scored zero show a muted **"0"**.
- Click any mini-month's **"Open →"** — it expands back to the Large view and scrolls to
  that month.
- Make your browser window narrower (or the panel smaller). When the Compact cells get
  very small, the numbers gracefully disappear and the cells stay shaded-only — the grid
  never distorts, and the exact number is always available in the Large view or the day
  popup.

### What "working correctly" looks like

- Three metric options (Species, Checklists, Total count), each repainting the grid, legend,
  and sub-line.
- The View toggle reads Large | Compact and behaves exactly as Months | Year did before.
- Compact mini-cells carry legible numbers, degrading to shading-only when too small.
- The day popup always shows all three counts, and the individual total matches what you'd
  expect from the Statistics tab (an "X" adds nothing).
