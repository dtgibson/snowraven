## Life Lists region filter

### What this does
Adds a **Region** control at the head of the Life Lists tab's control strip that narrows the list to one country, state or province, or county taken from the user's own eBird backup, and shows that region's life list: each species recorded there, dated to its first sighting inside the region, with that sighting's time, checklist, and place. Countries are labelled by English name from the engine's own locale data (`Intl.DisplayNames`), falling back to the code. Under the media buttons an asset counts toward a region only through its checklist in the backup. The choice is remembered per device under the settings key `lifeListsRegion`; nothing new goes over the network.

### How to test
1. Load the tracked demo export (`website/demo/`) as the eBird backup and the ML export, and open **Life Lists**.
2. The strip reads REGION, a field showing **Everywhere**, then the two switches and the Media pills. The list and sentence are exactly as before ("149 species, newest first by the date of your first sighting.").
3. Click the field (or Tab to it). A list opens: Everywhere, then Countries (United States), States and provinces (New Jersey, New York), Counties (Cape May, NJ to Suffolk, NY).
4. Type `pass`, press Enter. The field reads "Passaic, NJ", focus stays in it, and the sentence reads "122 species in **Passaic, NJ**, newest first by the date of your first sighting there." Rows are dated to the first sighting in Passaic County and renumber 122 down to 1.
5. Press **Photo**: the list is the species with a photo whose checklist is in Passaic, dated to the first such photo. The media marks on each row still show what the species has anywhere.
6. Reload the page: the tab opens on Passaic, NJ with no flash of the full list. Choose **Everywhere** and reload: it opens on Everywhere.
7. Keyboard: ArrowDown opens the list on the current choice, Up/Down/Home/End move, Enter chooses, Escape closes without changing anything, Tab closes and moves on.

### Notes for reviewer
- **Pure derivation, two new passes** in `lib/lifeListsRegion.ts`: pass 1R (regional first-sighting slots in three Map tiers keyed by the parsed cells, the checklist-to-cells join, the choices) and pass 2R (regional first-asset slots through the join). Both run once per files epoch in the load effect; a press materializes one region's records with pass 1's and pass 2's own (now exported) record constructors and re-runs `selectRows`, which gains one defaulted `presence` parameter so the media cell stays global. The unfiltered call is the shipped call, and a tab row compares Everywhere against `selectRows` over all 32 switch and media states, before and after a region round trip.
- **Unchanged by design:** the `/taxonomy/codes` batch effect, `useLifeListsProvenance` and the status line (no diff in those blocks); no new route, proxy entry, CSP or http permit entry, `docChains` key, `clearDerived.ts` row or iCloud item kind.
- **Bounds:** a State/Province cell over 16 characters or a County cell over 96 offers nothing, so every offered region survives the save and read-back (a corpus row asserts it). The stored value is read through `parseStoredRegion` (`Object.hasOwn`, level and length checks); a stored region is only ever matched against the derived choices and never rendered.
- **Measured** (decisions.md D-04): at the 150k-row cap pass 1R reads 87 ms first call and a press a few ms; the hostile every-row-its-own-region shape reads about 0.9 s and 187 MB, recorded as a residual. Linearity rows read 10 to 16 against limits of 20 to 29; the pass-1R mutant reads about 99.
- **Departures from the schema and design**, each with its reason, are in decisions.md D-05 (component name, the country-code shape gate, the bounded settings read, ordered writes, `aria-controls` only while open, the field-drawn focus ring, the 11px strip radius).
- **The card's clip is released** (`SectionCard style={{ overflow: 'visible' }}`, D-02) so the listbox hangs below the strip; the strip carries the card's top radius.
- **Published copy is held:** one proposed sentence for the README, website and listing, the What's New line, and an optional website screenshot refresh are in `held-copy.md`; nothing is written to those surfaces. No version bump here: the Deployer does it at the ship.
- Real-engine check: the built app on the demo data, Chromium and WebKit at 1280, 768, 390 and 320px wide, 100% and 200% text where it bears on layout: no page overflow with the list open or closed, nothing in the strip past its box, the list paints above the rows, focus stays on the input after a keyboard choice, and Everywhere restores the list.

## Seeing Life Lists region filter locally

These steps run the web version of SnowRaven on this Mac against the synthetic demo data, so none of your own sightings are involved. (If you are reviewing from your phone or another device, the person running the preview gives you a tailnet address instead of the `127.0.0.1` one in step 6; the rest is the same.)

1. Open a terminal in the project folder (`snowraven`).

2. Build the app:
   `cd frontend && npm run build && cd ..`

3. Make an empty scratch folder for the demo data, so your real data folder is never touched:
   `mkdir -p /tmp/sr-demo`

4. Start SnowRaven's server on port 1621, pointed at that folder:
   `cd backend && SR_DATA_DIR=/tmp/sr-demo .venv/bin/uvicorn main:app --port 1621`
   Leave this terminal running. (The server lives in `backend/.venv`; a bare `uvicorn` or `python` is not on the path.)

5. In a second terminal in the project folder, load the demo backup and ML export into it:
   `curl -H "X-SnowRaven-Request: 1" -F "file=@website/demo/snowraven-demo-ebird-backup.csv;filename=MyEBirdData.csv" http://127.0.0.1:1621/settings/files/ebird`
   `curl -H "X-SnowRaven-Request: 1" -F "file=@website/demo/snowraven-demo-ml-export.csv;filename=ML.csv" http://127.0.0.1:1621/settings/files/ml`

6. Open `http://127.0.0.1:1621` in your browser. If a Welcome screen appears, press Escape.

7. Click **Life Lists** in the sidebar (on a narrow window, tap **More**, then **Life Lists**).

8. What to look for:
   - The control strip starts with **REGION** and a field reading **Everywhere**; the list says "149 species, newest first by the date of your first sighting."
   - Click the field: the list shows Everywhere, then **Countries** (United States), **States and provinces** (New Jersey, New York) and **Counties** (Cape May, NJ through Suffolk, NY).
   - Type `pass` and press Enter: the sentence becomes "122 species in **Passaic, NJ**, newest first by the date of your first sighting there", and each row's date, time, checklist and place are its first sighting in Passaic County.
   - Choose **United States**: "149 species in United States", because every demo sighting is in the US.
   - Press **Photo** under a county: the list keeps only species with a photo taken on a checklist in that county; the small camera, microphone and video marks still show what each species has anywhere.
   - Reload the page: it opens on the region you chose. Choose **Everywhere** and reload: it opens on the full list.

9. When you are done, stop the server with Ctrl+C in the first terminal and delete the scratch folder: `rm -rf /tmp/sr-demo`.
