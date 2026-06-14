# Seeing Current & Predict locally

The app is already running for you (backend on port 1620, web app on 5173).

1. Open this link in your browser: **http://localhost:5173**

2. You'll land on the **Weather** tab. Scroll to the bottom of the weather card — under a divider headed "Now, or any time ahead" you'll see two new buttons: **Current** and **Predict**.

3. Click **Current**. Allow location when the browser asks. You'll get live weather and the current tide for where you are. The familiar copy-ready text block is tucked behind a "Copy-ready block" toggle.

4. Click **Predict**. Type a coastal place like "Pillar Point Harbor" and press the search button — or tap the map to drop a pin and drag it to fine-tune. Pick a date a few days out and a time, then "Get forecast". You'll get the forecast weather and the predicted tide for that moment. (Days 3–8 show a clearly-labeled daily summary rather than an exact hour.)

5. Try a date more than about 8 days out. The weather drops out with a clear "no forecast reaches this far" note — but the tide still shows, because tide is astronomical and predictable far ahead.

To restart the servers later:
- Backend: `cd backend && .venv/bin/uvicorn main:app --port 1620 --reload`
- Web app: `cd frontend && npm run dev`
