## Seeing the map center pin locally

1. Open a terminal in the project's `frontend` folder.

2. Start the dev server:
   `npm run dev`

3. Open your browser to:
   http://localhost:5173

4. Go to the Map Explorer tab and switch to **Hotspots** (or **Nearby Lifers**, or
   **Media Targets**).

5. Right-click anywhere on the map. A center pin drops at that spot, the
   latitude/longitude fields update, and the view re-runs its search centered there.

6. Drag the pin to a new spot — the search re-runs when you let go.

7. On a touch screen, long-press the map instead of right-clicking. (A left-click
   or tap still opens a result pin's popup, exactly as before.)

Note: Hotspots, Nearby Lifers, and Media Targets need your eBird API key (and
backup) configured in Settings to return results; the pin-drop gesture itself works
regardless.
