## Seeing Nearby Lifers locally

1. Open a terminal in the project folder.

2. Start the backend:
   ```
   cd backend && uvicorn main:app --reload --port 1620
   ```

3. In a second terminal, start the frontend:
   ```
   cd frontend && npm run dev
   ```

4. Open your browser to:
   ```
   http://localhost:5173
   ```

5. Click the **Map Explorer** tab, then click **Nearby Lifers** in the row of mode buttons across the top of the map.

6. What you should see:
   - With a default location saved in Settings (and your eBird API key + backup loaded), pins appear for nearby spots where species you haven't recorded were reported recently. Each pin carries a number — how many of your lifers are there.
   - Click a pin, or a row in the left-hand list, to see exactly which lifers were reported there, when, and a link to the eBird checklist.
   - Use the **Time Range** buttons (Day / Week / 30 days) to narrow by how recently a bird was seen.
   - Re-center with **Use my location** or the place search, and change the radius — the same controls the other map sections use.

If you haven't set a default location yet, the panel will point you to Settings; if no eBird backup is loaded, it explains that one is needed to know which species are lifers for you.
