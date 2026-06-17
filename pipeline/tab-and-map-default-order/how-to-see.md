## Seeing Tab and Map Default Order locally

1. Open a terminal in the project folder.

2. Start the frontend development server:
   `cd frontend && npm run dev`

3. Open the app in your browser:
   `http://localhost:5173`

4. To see the default tab order, clear the saved tab layout from Settings or browser storage, then reload. The configurable tabs should read Weather, Statistics, Species Detail, Map Explorer, Checklists, Multimedia, Breeding Codes, List Comparer, Named Birds. Settings stays pinned separately by the app shell.

5. Open List Comparer. Checklists should be selected by default, and the mode switch should read Checklists, then Life Lists.

6. Open Map Explorer. The mode buttons should read My Sightings, Hotspots, Nearby Lifers, then Media Targets.

7. The automated verification run for this stage was:
   - `npx vitest run src/lib/tabLayout.test.ts src/components/ListComparer.test.tsx src/lib/mapViewModes.test.ts`
   - `npm run build`
   - `npm run test`
   - `npm run lint`
