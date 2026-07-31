## Seeing Disable Embedded Media locally

1. Open a terminal in the SnowRaven project folder.

2. Start the backend server:

   ```bash
   cd backend && uvicorn main:app --reload --port 1620
   ```

3. In a second terminal in the SnowRaven project folder, start the frontend:

   ```bash
   npm --prefix frontend run dev
   ```

4. Open your browser and go to:

   http://localhost:5173

5. In Settings, load an eBird backup and a Macaulay Library export if they are not already saved. Open Species Detail for a species with media, or expand a Named Birds row that has matched media.

6. Return to Settings and turn on **Disable embedded media**. The switch is off by default.

7. Go back to the media surface. Its player area should say **“Embedded media is disabled in Settings.”** No player or loading shimmer should appear, while dates, checklist links, and direct Macaulay Library links remain usable.

8. Turn the setting off again. The existing players should return immediately without reloading the app.
