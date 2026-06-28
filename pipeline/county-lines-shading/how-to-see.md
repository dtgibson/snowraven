# Seeing County Lines & Shading locally

This is a plain, step-by-step guide to view and play with the new County Lines &
Shading overlay on your own machine. No prior experience running a dev server is
assumed.

SnowRaven has two parts that both need to be running: a small backend (Python) and
the web frontend. You'll start each in its own terminal window.

## 1. Start the backend

1. Open a terminal in your project folder.
2. Run:
   ```
   cd backend && uvicorn main:app --reload --port 1620
   ```
3. Leave this window running. (The county lines themselves don't need the backend,
   but the rest of the app expects it.)

## 2. Start the frontend

1. Open a **second** terminal in your project folder.
2. Run:
   ```
   cd frontend && npm run dev
   ```
3. Leave this window running too. It will print a local address.

## 3. Open the app

1. In your browser, go to:
   ```
   http://localhost:5173
   ```
2. If this is a fresh setup, open **Settings** and upload your eBird backup
   (`MyEBirdData.csv`) so the shading has data to draw from. (You can see the county
   *lines* without it — only the *shading* needs your backup.)

## 4. Turn on County lines

1. Click the **Map Explorer** tab.
2. In the left sidebar, find the **Map Overlays** group and switch on **County lines**.
3. US county boundaries draw over whatever part of the map you're looking at. Pan and
   zoom — the lines redraw for the new area. If you zoom far out, you'll see a small
   "Zoom in to see counties" chip instead (the whole-country view would be too dense);
   zoom back in and the counties return.

## 5. Shade the counties

1. With **County lines** on, switch on **Shade by species seen** (just below it).
2. Each county where you've birded tints from light mint (few species) to deep green
   (many). Counties you've never recorded stay as plain outlines. A legend appears
   showing the count ranges.
3. Use the **Species / Records** switch to flip between "distinct species per county"
   and "total checklists per county" — the shading and legend update together.

## 6. Click a county

1. Click any county on the map.
2. A popup shows the county name, its state, your species and checklist counts there,
   a link to its eBird county page, and either your **most-recorded species** (in
   Species mode) or your **top locations** (in Records mode) for that county.
3. Click a county you've never birded — the popup still opens and honestly shows 0
   species / 0 checklists.

## 7. Without a mouse (optional)

1. Look at the **Counties in view** panel in the bottom-left of the map.
2. Open it and use the keyboard (Tab + Enter) to move through the listed counties;
   activating one opens and centers its popup.

## What "working" looks like

- County lines draw and redraw as you move around the map.
- With your backup loaded and shading on, the counties you've birded are tinted green
  in proportion to your coverage, with a matching legend.
- Clicking any county opens a popup with the right name, state, and your counts.
- Turning **County lines** off removes the boundaries, shading, legend, and any open
  popup all at once.

If you ever ran SnowRaven with the breeding **California atlas blocks** overlay, this
feels just like it — same toggles, same popups — except the county shading is green
(not purple), so you can even have both overlays on at the same time.
