# How to see the three improvements

Run the app (`cd frontend && npm run dev`, backend on 1620) with an eBird backup loaded in Settings.

## 1. Named Birds — sighting duration

1. Open the **Named Birds** tab (needs at least one `[name:…]` tag in an eBird species comment).
2. On each row, under the "first – last seen" date range, look for a small muted second line — e.g. **"2 yrs. 3 mos."**, **"5 mos."**, **"5 days"**.
3. A bird seen on only one date reads **"1 day"**. A row with an unparseable/missing date shows no duration line (no stray line, no crash).

## 2. Calendar — per-species filter

1. Open the **Calendar** tab.
2. In the top control row find the **Species** dropdown (defaults to **All species**). Pick a species.
3. The whole grid, shading tiers, legend, and any day popup redraw for just that species; the sub-line reads "… · {Species} only".
4. Note the **Count spuh, slash & hybrids** switch dims/disables while a concrete species is selected.
5. Pick a species with a subspecies/form in your data (e.g. "Dark-eyed Junco") — its form rows ("Dark-eyed Junco (Oregon)") are included under the parent.
6. Switch to **All years** — the filter folds that one species across every year. Set it back to **All species** to restore the normal view exactly.

## 3. Map Explorer — locator dot + Labels/Dots toggle

1. Open **Map Explorer** and select the **Media Targets** or **Nearby Lifers** view (needs an eBird API key + a search center). Run the search.
2. Each marker now shows a small **locator dot** at its exact coordinate, next to the name/media chip.
3. In the sidebar, find the **Marker Style** toggle (Labels | Dots), beside Time Range.
4. Switch to **Dots** — the label chips disappear, leaving just the dots for a clean overview of where the birds are.
5. Click (or Tab to + press Enter/Space on) a dot — the popup still opens listing every species at that spot, in either mode.
6. The two panels remember their own choice independently for the session.
