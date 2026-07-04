# How to see the Calendar tab locally

The Calendar tab is frontend-only and reads your already-stored eBird backup. You
can run it in the web/dev path (backend + Vite) or in the desktop app.

## Web / dev path (fastest)

1. **Start the backend** (needed so the tab can read your stored eBird backup via
   the storage seam / files-status):
   ```
   cd backend && uvicorn main:app --reload --port 1620
   ```
2. **Start the frontend dev server** in another terminal:
   ```
   cd frontend && npm run dev
   ```
3. Open the app at **http://localhost:5173**.
4. If you haven't already, go to **Settings → Default Files → eBird Backup** and
   upload your `MyEBirdData.csv` (from ebird.org → Download My Data). Without it the
   Calendar tab shows the "eBird Backup Required" setup screen.
5. Click the **Calendar** tab (it sits right after **Statistics** in the tab bar).

## Desktop app path

```
cd frontend && npm run desktop:dev
```
Then upload the backup in Settings if needed and open the Calendar tab.

## What to try

- **Species vs Checklists** — flip the **Show** toggle; every day re-labels and the
  grid re-shades. The legend title changes ("Species / day" ↔ "Checklists / day").
- **Year navigation** — the ‹ / › buttons jump to the previous/next year that has
  data (they disable at the ends of your range). **All years** folds every year into
  one combined grid.
- **View: Months | Year** — switch to **Year** for the 3×4 grid of mini-month
  heatmap thumbnails (no day numbers). Click a thumbnail to jump to that month's big
  grid.
- **Use Textures** — turn it on to see the colorblind crosshatch mode (density rises
  with the count) in both the big and mini grids; try it in dark mode too.
- **Count spuh, slash & hybrids** — the small toggle on the bottom settling row.
  Turn it on (Species metric) to watch some day numbers rise and any "0" days become
  real numbered days. It's dimmed and inactive under the Checklists metric.
- **A day popup** — click any shaded day (or a light "0" day) for its species and
  checklist counts and links straight to that day's eBird checklists. Close it with
  Escape, the Close button, or the backdrop.

## Fast checks without a backup

- **Tests:** `cd frontend && npm run test -- src/lib/calendar.test.ts
  src/lib/calendarTextures.test.ts src/lib/calendarContrast.test.ts
  src/components/Calendar.test.tsx`
- **The approved mockup** is `pipeline/calendar-tab/design.html` — open it in a
  browser; the metric, year, view-density, textures, and spuh toggles and the day
  popup are all live, and there's a light/dark theme toggle.
