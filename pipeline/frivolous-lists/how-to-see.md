## Seeing Frivolous Lists locally

1. Open a terminal in the project folder.

2. Start the app (two servers — backend on 1620, frontend dev server on 5173):
   - Backend: `cd backend && uvicorn main:app --reload --port 1620`
   - Frontend: `cd frontend && npm run dev`

3. Open your browser to:
   `http://localhost:5173`

4. Go to the **Statistics** tab. If it asks for data, load your eBird backup in **Settings** first, then come back.

5. Scroll to the very bottom. You'll see a **Frivolous Lists** section with three blocks:
   - **Avian American** and **California Dreamer** — each "American" / "California" bird, with a checkmark on the ones you've recorded, a `recorded / total` count, and a badge when you've completed the set.
   - **Rainbow Warrior** — seven color rows. Each filled color shows the first bird of that color you ever logged, with the date and place you first saw it and a link to that checklist. Colors you haven't found yet wait with a blank.

6. Click a bird's name to jump to its Species Detail entry; click a Rainbow date to open that checklist on eBird. Use the theme toggle to check light and dark.

You can also jump straight there with the **Frivolous Lists** chip in the section navigation at the top of the Statistics page.
