## Seeing the 0.5.42 changes locally

1. Open a terminal in the project's `frontend` folder.

2. Start the dev server:
   `npm run dev`

3. Open your browser to:
   http://localhost:5173

4. Look at the tab bar across the top. The order is now: Weather, Statistics,
   Species Detail, Map Explorer, Multimedia, Breeding Codes, **Checklists**,
   List Comparer, Named Birds, then Settings. Checklists now sits between
   Breeding Codes and List Comparer. (If you've customized your tab order
   before, yours is preserved — this only changes the out-of-the-box default.)

5. The load speed-up is invisible by design — the app simply fetches less on
   first open. To confirm it, run `npm run build`: there's no "chunks are larger
   than 500 kB" warning, and the maps' large library no longer loads until you
   actually open a map.
