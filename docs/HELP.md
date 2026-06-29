# SnowRaven Documentation

SnowRaven is a toolkit for birders who use eBird. It runs as a standalone desktop app on Mac or Windows, or as a self-hosted server on a Raspberry Pi or any computer on your local network. It gives you weather lookups, life list analytics, media coverage tracking, breeding code history, and more.

This documentation covers every tab, how to obtain the API keys the app requires, and how to download and upload the data files that unlock most features.

## Getting Started

When you first open SnowRaven, go to the Settings tab. That is where you enter your API keys and upload your data files. Once your keys and files are in place, every other tab works automatically on each visit -- there is nothing to re-upload between sessions.

The recommended setup sequence is:

1. Enter your eBird API key in Settings. This is required for the Weather tab and the Map Explorer (including its Nearby Lifers section).
2. Enter your OpenWeather API key in Settings. This is required for the Weather tab.
3. Upload your eBird backup file (`MyEBirdData.csv`) in Settings. This powers the Species Detail, Statistics, Map Explorer, Breeding Codes, Multimedia, and List Comparer tabs.
4. Upload your ML export from Macaulay Library in Settings. This is optional but unlocks media-specific features in Multimedia, Species Detail, and Statistics.

---

## API Keys

An API key is a private code that identifies your account when the app contacts an external data service. Think of it like a password the app uses on your behalf. Both keys required by SnowRaven are free.

### eBird API key

The eBird API key lets SnowRaven fetch checklist metadata for weather lookups and retrieve recent bird sightings near your location for the Map Explorer's Nearby Lifers feature. The key is free and is tied to your standard eBird account.

To get your key:

1. Sign in to your eBird account at [ebird.org](https://ebird.org).
2. Go to [ebird.org/api/keygen](https://ebird.org/api/keygen).
3. Your key is displayed on that page. Copy it.
4. Open SnowRaven, go to Settings, and paste it into the eBird API Key field.

Keep your API key private. It is tied to your eBird account and should not be shared or published.

### OpenWeather API key

The OpenWeather API key lets SnowRaven retrieve historical weather for any eBird checklist you look up. The service is free for the first 1,000 requests per day -- well above what a typical user needs.

**Important:** After creating your OpenWeather account, you must subscribe to the "One Call by Call" plan separately. The key is not activated for this plan automatically when you create an account. Go to your account's Billing plans page and subscribe to One Call by Call. The free tier covers 1,000 calls per day at no cost. Without this step, weather lookups will return an error.

To get your key:

1. Create a free account at [openweathermap.org](https://openweathermap.org).
2. Go to API keys in your account dashboard. Copy the default key.
3. Go to Billing plans and subscribe to One Call by Call.
4. Open SnowRaven, go to Settings, and paste the key into the OpenWeather API Key field.

---

## Default Files

SnowRaven works with two data files you export from your own eBird and Macaulay Library accounts. Once uploaded in Settings, they are stored for you -- in the desktop app, in the app's local data directory; in web/Pi mode, on the server -- and load automatically every time you open the app.

### eBird backup

Your eBird backup is a full export of all your eBird observations -- every checklist, every species, every location. It is the primary data source for most of SnowRaven's features.

The file is called `MyEBirdData.csv`. To download it, sign in at [ebird.org](https://ebird.org) and go to [ebird.org/downloadMyData](https://ebird.org/downloadMyData). Click "Download My Data" and save the download; if it arrives as a `.zip`, unzip it to find `MyEBirdData.csv`. In SnowRaven, go to Settings and upload that CSV under Default Files.

The eBird backup is used by: Species Detail, Statistics, Map Explorer, Breeding Codes, Multimedia, and List Comparer.

eBird generates the export with all observations up to the download date. Re-upload the file whenever you want your tabs to reflect recent checklists.

### ML export

Your ML export is a spreadsheet of all the media you have uploaded to the Macaulay Library -- photos, audio recordings, and videos -- including catalog IDs, media types, and the species associated with each item.

To download it, sign in at [macaulaylibrary.org](https://macaulaylibrary.org) and go to My Media. Set the media-type filter to **All** rather than Birds, so the export includes every item you have uploaded, then click "Save Spreadsheet."

In SnowRaven, upload the file in Settings under Default Files, and **leave the filename unchanged**. The downloaded filename contains your Macaulay Library user ID, and SnowRaven reads that ID from the filename to link directly to your own media pages. If you rename the file, those links still work but are no longer personalized to your account.

The ML export is used by: Multimedia (media counts and species coverage), Species Detail (embedded recent media and media count indicators), and Statistics (the Media card). These features are not available from the eBird backup alone.

---

## Weather

The Weather tab retrieves historical weather data for any eBird checklist. Paste a checklist ID (for example, `S12345678`) or a full eBird checklist URL and click Get weather. The result is a formatted text block matching the output format used by raincrow.app -- ready to paste directly into your eBird checklist comment field.

The weather summary includes temperature range, wind speed and direction with Beaufort description, humidity, dew point, precipitation, conditions, and sunrise and sunset times. On a night checklist -- one where any sampled hour falls before sunrise or after sunset -- the moon-phase emoji is added to the condition emoji on the first line (for example, `☁️🌔`), computed from the checklist's start time; in the Southern Hemisphere the moon appears mirrored, the way it looks there. The formatted result is copied to your clipboard automatically on a successful lookup -- on the web, the Raspberry Pi server, and the macOS and Windows desktop apps alike -- so you can paste it straight in. A Copy button is always available too. An "Edit checklist comment on eBird" link opens your checklist's comment field directly in a new tab.

Both your eBird API key and OpenWeather API key must be configured in Settings for this tab to work.

### Tides

Below the weather, a Tides box fills in at the same time from the same checklist, showing the historical tide for that location and time from the nearest NOAA tide station. It needs no extra key — NOAA's Tides & Currents service is free and keyless.

The box shows the water level across your checklist's duration, labeled **Observed** when a real gauge reading exists or **Predicted** when it doesn't, whether the tide was rising or falling, the surrounding high and low tides with their local times, and the station name with its distance from your checklist. If a high or low tide turns during your checklist, the box notes it. Heights are in feet relative to MLLW (the standard US tide-table reference).

If the nearest station is more than 25 miles away, or your checklist is outside the US (NOAA only covers the US and its territories), the box explains that and offers a one-tap option to show the nearest US station anyway. A **Copy Weather and Tide Together** button copies both blocks at once, with a single SnowRaven credit at the bottom.

### Current and Predict

At the bottom of the Weather tab, two buttons let you look up weather and tide directly — no checklist needed.

- **Current** fetches the live weather and tide for where you are right now, in one tap. Your browser or device will ask permission to share your location the first time.
- **Predict** lets you choose a place — type a place name to search, or tap the map to drop a pin and drag it to fine-tune — along with a date and time, then shows the forecast weather and the predicted tide for that moment.

Weather forecasts reach about eight days out. Within the first couple of days you get an hour-by-hour reading; further out, you get that day's forecast summary, clearly labeled as a daily summary. Tide runs much further ahead, because tides are astronomical and predictable — so if you pick a date beyond the weather window, SnowRaven still shows you the tide and simply notes that no weather forecast reaches that far. Each result is a readable summary, with the same copy-ready block as the checklist lookup tucked behind a "Copy-ready block" toggle.

### SnowRaven Mini (browser extension)

SnowRaven Mini is a separate companion project: a small Chrome and Firefox extension that runs the same weather and tide lookup directly on an eBird checklist's Edit Comments page and copies the block for pasting, in the same format SnowRaven produces. It is independent of the app — nothing in SnowRaven requires or uses it — and it needs its own copies of the free eBird and OpenWeather keys. It is not yet on the extension stores; source, releases, and documentation live at [github.com/dtgibson/snowraven-mini](https://github.com/dtgibson/snowraven-mini).

---

## Species Detail

The Species Detail tab shows a complete history of your observations for any species. It requires your eBird backup loaded in Settings.

Select a species from the dropdown at the top -- type to search by common name or scientific name. All sections update immediately when you select a species. Switching species is instant; all data is parsed client-side from the stored file.

**Clicking bird names anywhere.** Throughout the app, a bird's common name is rendered in a consistent format: the name is a link that opens that species here on Species Detail (for any species in your data), followed by small icons linking to its eBird and Birds of the World pages, with the scientific name shown where there's room. So you can click a species in the Statistics lists, the Map Explorer, the Multimedia, Breeding Codes, or the List Comparer to jump straight to its full history. For a bird you haven't recorded yet (such as a nearby lifer or map target species), the name appears with the eBird/Birds of the World icons but without a Species Detail link, since there's no entry to open.

The tab shows the following sections for each species:

- Summary: common name, scientific name, media coverage indicators (Photo, Audio, Video -- filled when data is available from your ML export), and your highest breeding evidence category.
- Sightings: total checklist count, total individual count, personal best single-count observation, and first and last seen dates. Each date links to the original eBird checklist.
- Media: photo, audio, and video catalog counts, each linking to your personal Macaulay Library page filtered by species and media type. Requires ML export.
- Breeding Codes: every breeding code you have recorded for the species, with tier color, abbreviation, full label, and count.
- Reported With: species most frequently appearing on the same checklists as the selected species, ranked by co-occurrence percentage.
- Top Locations: ranked list of locations where you have observed the species. A location that is a public eBird hotspot is a link to its hotspot page on eBird; a personal location stays as plain text.
- Sighting Locations map: an interactive map with a pin at every unique observation coordinate. Click any pin to see the dates and checklist links for that location. Toggle between Pins and Heatmap view; in Heatmap mode a Heatmap Intensity slider (1–10) lets you dial the coverage from tighter to broader and hotter, the same control as the Map Explorer's My Sightings map.
- Comments: all your per-species field notes from the eBird backup, sortable by date and filterable by keyword.
- Recent Media: the most recently uploaded photo, audio recording, and video from your Macaulay Library, embedded inline. Requires ML export and at least one item in the catalog for this species.

Toolbar options:

- Show subspecies: off by default. Merges subspecies variants (for example, Yellow-rumped Warbler (Myrtle) and Yellow-rumped Warbler (Audubon's)) into the parent species. Toggle on to see each subspecies as a separate entry with its own stats.
- Show sp./slash: off by default. Hides uncertain identifications. Toggle on to include them in the species selector.

Graph options control the Sightings Over Time and Media Over Time charts that appear when you have enough data:

- Interval: Weekly, Monthly, or Yearly.
- Per Period / Cumulative: switches between counts per period and a running total.

County and date-range filters appear in the toolbar when your eBird backup contains county data. Active filters apply to all sections including the map, comments, breeding codes, and media counts.

A **Named Individuals** section appears when this species has birds you've named in your checklist comments with a `[name:…]` tag (see the Named Birds tab). Each individual lists its sightings with checklist links and the comment.

---

## Statistics

The Statistics tab shows a comprehensive analytics dashboard built from your eBird backup. A jump-nav at the top links to each section. The cards are described below. The eBird backup is required for all of them; the Media card additionally requires your ML export.

### Life List Totals

Your headline counts: total species, total checklists, total locations, years active, states and provinces, and countries. The accumulation chart shows how your life list grew over time. Use the interval toggle to switch between Weekly, Monthly, Yearly, and Total views. Total mode draws one step per new lifer in chronological order, with the species name shown in the tooltip at each step.

### Top Species

Two ranked top-10 lists: the species you've counted the most total **individuals** of, and the species you've reported on the most **checklists**. The individuals list excludes presence-only "X" records, which can't be summed. Each name links to its Species Detail entry.

### Firsts and Milestones

Milestone pills mark every threshold from 10 to 3,000 species, showing the species that hit each milestone and linking to the checklist where it was recorded. (Records like your biggest day and longest streak now live in Highlights & Records, below.)

### Temporal Stats

Checklist activity broken down by year, month, day of week, and start hour. Each breakdown shows count and percentage of total. The day-of-week view highlights weekend versus weekday birding patterns.

### Geographic Stats

A map of your most-visited locations alongside ranked lists of your top locations, counties, and states (shown by full name, e.g. Minnesota) by checklist count and species count. A top-location name that is a public eBird hotspot links to its hotspot page on eBird (personal locations stay plain); county and state entries link to their eBird region page. The map shows numbered markers for your top locations by checklists (green circles) and top locations by species (blue squares).

### Effort and Outings

How you bird, measured. **Totals** lead the section — total time afield (also spelled out as days / hours / minutes), total distance, and total area covered when your data has it. **Key metrics** cover average duration, average distance, average area, species per hour, and species per mile, plus a protocol distribution and an average-by-protocol table. An **observer summary** shows your percent solo, average observers, and largest group. **Notable Outings** highlights your single checklists that were the longest (duration), farthest (distance), largest-area, biggest (most species), and most-individuals — each linking to eBird. Area-based stats appear only if your data includes area-covered checklists (the eBird "Area" protocol).

### Data Quality

The consistency and completeness of your data: the ratio of numeric counts to X/presence-only records, and your comment coverage (checklist and species comments). (Record counts and rarity lists moved to Highlights & Records.)

If any of your checklist comments contain a weather or tide block (the kind SnowRaven or Raincrow pastes in), a **Weather & tide blocks** breakdown also appears, showing the number and percentage of checklists that carry: **any weather** block (the total), **Raincrow weather**, **SnowRaven weather**, **SnowRaven tide**, and **weather + tide** (a SnowRaven weather block and a tide block on the same checklist). A weather block from either app counts toward "any weather"; Raincrow blocks are recognized by their raincrow.app credit and SnowRaven blocks by their SnowRaven credit. Tide blocks are SnowRaven-only. The breakdown is hidden if none of your checklists carry these blocks.

### Highlights & Records

Your notable stats in one place: biggest single day, longest consecutive streak of days with any report, longest dry spell between reports, Shannon diversity index (a measure of evenness across species, from your numeric counts), biggest single counts (your largest flocks), Single-Checklist Birds (species recorded on exactly one checklist, excluding one-and-done), and One-and-Done Birds (species with a total individual count of exactly 1). Where applicable, entries link to the relevant checklist.

### Breeding Stats

Confirmed, Probable, and Possible species totals from your eBird backup. A stacked bar chart shows breeding activity by month. Use the filter buttons to isolate Confirmed, Probable, or Possible entries.

### Media

A deep look at your Macaulay Library archive, built from your ML export. It opens with a chart of how your photo, audio, video, and total media counts have grown over time (view it per period or as a cumulative total), then breaks the collection down several ways:

- **At a glance** — total media, species documented, the photo/audio/video split, your busiest media day (its date links to that day's eBird checklist; if the day spans several, the one with the most media), your longest streak of consecutive days with media (with the dates the streak ran), and your archive span — how long your collection stretches, from first upload to most recent.
- **Documentation coverage** — how much of your life list you have captured with media: the share documented with any media, and separately with a photo, audio, and video. This is where the lopsidedness most birders have (lots of photos, little audio) becomes visible.
- **Photos Tagged With Age or Gender** — two donuts showing the age-class mix (adult / immature / juvenile / unknown) and the gender mix (male / female / unknown) across your media, counted per individual, with the unknown share shown honestly and a note of how many are tagged.
- **Age coverage by species** — the species you have documented as a juvenile or immature, each with a row of dots marking which age classes you have captured (adult, immature, juvenile). It shows the first ten with a "Show all" / "Show fewer" toggle and can be sorted by name (A–Z) or taxonomic order, and it ends with a note of how many species you have documented only as adults so far (which still appears even if you have no young birds tagged yet).
- **Behaviors documented** — how many distinct behaviors you have captured and which are most common (foraging, flying, singing, and so on), plus a tally of species for which you hold media showing breeding behavior, grouped into confirmed, probable, and possible. Each behavior's count is a link that opens your Macaulay Library media filtered to that behavior — your flying shots, your feeding-young shots, and so on — and each breeding behavior is listed and linked individually in its own group just below, so you can open just your feeding-young or nest-building media directly.
- **When you capture media** — the time-of-day distribution of your captures, split by photo, audio, and video, so the dawn-chorus audio and golden-hour photo patterns stand out.

Below all of that, ranked lists show your most-photographed, most-recorded, and most-filmed species, each linking to your personal Macaulay Library page filtered by species and media type. The whole card requires your ML export; the age, gender, behavior, and time-of-day sections fill in to the extent your export carries those annotations.

### Frivolous Lists

At the very bottom of the Statistics page is a section just for the fun of it — eight self-completing collections that fill in from your own life list:

- **Avian American** — every bird whose name starts with "American," from the American Avocet to the American Woodcock. Each one you've recorded gets a checkmark, with a running count and a badge once you've seen them all.
- **California Dreamer** — the same idea for the "California" birds: Condor, Gnatcatcher, Gull, Quail, Scrub-Jay, Thrasher, and Towhee.
- **Phoebe Phanatic** — the three phoebes: Eastern, Black, and Say's.
- **Scrub Jay All Day** — the four scrub-jays: California, Woodhouse's, Florida, and Island.
- **Crow Pro / Raven Maven** — the crows and ravens: American, Fish, Tamaulipas, and Sinaloa Crows, plus the Common and Chihuahuan Ravens.
- **Heron is Carin' (and Egrets too)** — the true herons, egrets, night-herons, and bitterns, shown as those labeled sub-groups with a single badge for the whole set.
- **Best of the Crest** — a big "crested and crowned" collection spanning many families (cardinals, jays, titmice, kinglets, quail, mergansers, kingfishers, and more, down to the Crested Auklet and Tufted Puffin), shown by sub-group.
- **Rainbow Warrior** — the first bird of each rainbow color you ever logged: red, orange, yellow, green, blue, indigo, violet. Each filled color shows that bird with the date and place you first saw it and a link to the checklist. A color counts only when it appears as a whole word in a name, so "Red-tailed Hawk" fills red but "Reddish Egret" doesn't — and one bird can fill two colors (a Violet-green Swallow counts for both violet and green). Colors you haven't found yet wait with a blank, and a badge appears once all seven are filled.

These lists are built entirely from your loaded eBird data — nothing new to set up.

---

## Map Explorer

The Map Explorer tab provides four views of your birding locations and nearby activity. An eBird API key is required for Hotspots, Nearby Lifers, and Media Targets.

**Base maps and layers.** A control in the top-right of the map switches the base map between **Map** (a clean, light street map), **Satellite** (aerial imagery), and **Topo (US)** (USGS topographic, United States only), and toggles a **Trails** overlay that draws hiking paths on top of whichever base is active. Your selection is remembered between sessions. The same control appears on the Species Detail and Statistics maps.

A **fullscreen button** sits at the bottom-right of the map. Click it to expand the map to fill the entire window -- the app header, tab selector, and mode tabs are hidden so you get the maximum map area. Click it again (the button becomes a minimize icon) to return to the normal layout. On small or mobile screens, a **Filters** button sits beside it to open the controls sidebar.

Click **Use my location** in the map controls to center the map on your current position and place a blue pin at the detected location. The desktop app uses your operating system's native location service (macOS and Windows both supported). If location is off or denied, restore it in System Settings → Privacy & Security → Location Services on macOS, or Settings → Privacy & security → Location on Windows; in web/Pi mode, use your browser's site permissions.

**Drop a pin to set the center.** On the Hotspots, Nearby Lifers, and Media Targets views you can set the search center right on the map: **right-click** (desktop) or **long-press** (touch) anywhere to drop a center pin there, then **drag the pin** to fine-tune. Each placement re-runs that view's search for the new spot. This sets the center for the current session only -- it doesn't change your saved Default Location (set that in Settings). The place-name search, **Use my location**, and typed coordinates all still work and drive the same center.

### My Sightings

Shows all your personal observations on a map. Narrow what's shown with the panel filters: Species (a specific species), Breeding Code, Date Range, County (when your backup contains county data), and Media. The Radius control sets the map's starting zoom and the distance within which your saved personal locations appear.

Switch between Pins and Heatmap with the Map View toggle. In Heatmap mode, a Heatmap Intensity slider lets you dial the coverage from tighter to broader and hotter -- higher settings spread each sighting farther and make even sparse, low-count areas stand out, which also helps when reading density at different zoom levels.

A **Sightings in view** list in the panel mirrors the pins currently on screen: each row shows a location's name, observation count, and species count. In every Map Explorer panel this in-view list is the last section, below the map-overlay controls, so the controls stay near the top no matter how long the list gets. Each in-view list also has a chevron in its header that collapses or expands it (the count stays visible when collapsed), so you can tuck a long list away when you don't need it. Select a row (it is fully keyboard-operable -- Tab to it, then Enter or Space) to open that location's details popup on the map and pan to it, exactly as clicking the pin would. The list updates as you pan or zoom, so it always reflects what's visible; on very dense views it shows the busiest locations first with a note to zoom in to narrow it. This is the keyboard path to the map markers, which are otherwise mouse-only.

### Hotspots

Fetches eBird hotspots near a location. Hotspots you have visited (matched against your eBird backup) appear as green pins. Unvisited hotspots appear as blue pins. Locations from your personal location history appear as orange pins. Click any legend row to hide or show that category. Enter a place name or coordinates to search, then click Fetch hotspots. While a search is running, a small chip at the top of the map shows its progress.

A **Hotspots in view** list in the panel mirrors the teardrops currently on screen: each row shows a hotspot's name and whether it's visited, unvisited, or a personal location. Select a row (fully keyboard-operable -- Tab to it, then Enter or Space) to open that hotspot's details popup on the map and pan to it, exactly as clicking the teardrop would. The list updates as you pan or zoom and honors the legend's hidden categories. This is the keyboard path to the map markers, which are otherwise mouse-only.

Below the legend, the panel lists the ten closest hotspots you have not visited, ranked by distance from your center point. Selecting a row opens that hotspot's details popup on the map and pans to it; a small ↗ link beside each row still opens that hotspot's page on eBird.

**Atlas blocks overlay.** A **California atlas blocks** toggle overlays the official California Breeding Bird Atlas block boundaries on the map. The grid is drawn for the area you are looking at and appears once you zoom in; at very wide views a "Zoom in to see atlas blocks" hint appears instead, so the whole-state view stays uncluttered. Click any block to open a popup with its name, a link to its eBird California atlas page, and -- when shading is on -- your highest breeding code there plus how many of your breeding records fall inside it. The boundaries are generated from a compact bundled dataset, so the overlay works offline with no extra download, and outside California nothing is drawn. This overlay is available in the My Sightings, Hotspots, Nearby Lifers, and Media Targets panels.

When the overlay is on, a **Shade by My Highest Breeding Code** toggle appears. It tints each block by the strongest breeding code *you* have personally entered there -- darkest for Confirmed, down through Probable to Possible. The shading reflects only your own records, never anyone else's, and requires your eBird backup to be loaded in Settings. When shading is on, any heatmap or pins automatically dim so the tier colors stay legible on top.

With shading on, a **Use Textures** toggle (off by default) adds a distinct hatch per breeding level -- sparse dots for the lowest, dense cross-hatch for the highest -- so the levels are distinguishable without relying on color. Turn it on for colorblind-friendly reading; leave it off for the cleanest view of the map beneath.

**County lines & shading.** A **County lines** toggle draws US county boundaries over the area you are looking at -- recomputed as you pan and zoom, with a "Zoom in to see counties" hint at very wide views. With County lines on, a **Shade by species seen** toggle tints each county by how many species *you* have recorded there, drawn entirely from your loaded eBird backup, with a legend whose ranges are quantiles of your own county totals across a fine ten-step scale (so the breaks shift with your data and your well-birded counties stand apart from one another rather than all sharing the darkest shade). A **Species / Checklists** switch flips the shading between distinct species per county and total checklists per county; the legend and shading update together. Counties with no records stay as plain outlines, clearly distinct from shaded ones. Click any county for a popup with its name, state, your species and checklist counts there (the counts are how many of *your* checklists reported each species in that county, not a tally of individual birds), a link to its eBird county page, and -- depending on the metric -- your most-recorded species or your top locations in that county. A keyboard-accessible **Counties in view** panel (bottom-left) lists the in-view counties so the popups are reachable without a mouse. Only one shading ramp is active at a time: turning on the green county shading switches off the purple atlas breeding shading, and vice-versa (a tooltip on each shade toggle and a caption note the switch). The boundary *lines* can still both be shown -- it is the color fills that are mutually exclusive, since the two ramps competed for the same map. The boundaries are a compact bundled dataset (US Census, public domain), so the overlay works offline with no extra download and makes no network calls; outside the US, nothing is drawn. This overlay is available across all four Map Explorer views.

**Basemap muting while shading is on.** When either shading is active, the basemap's green land fills turn grey so the shading ramp stands out -- water, roads, and labels keep their color, and Satellite or Topo imagery desaturates the same way. Turn the shading off and the basemap's colors come back. The Trails overlay stays colored (it's your overlay, not the basemap). In heatmap mode, the heatmap dims and sits beneath the county ramp just as it already did beneath the atlas ramp, so the tier colors stay readable on top. This muting reuses the tiles already loaded -- no new download and no network calls.

### Nearby Lifers

Maps where species you have never recorded were reported recently near a chosen point -- not just which ones. It opens on your saved Default Location and offers the same controls as the other map sections: **Use my location**, a place-name search, and a Radius control, plus a **Time Range** filter to set the window to the last day, last week, or last 30 days.

Each spot is a labeled pin showing the lifer's name, or "{n} species" where several lifers were reported at one place. Pins are colored by how recently the bird was seen. Click a pin (or a row in the panel list) to see the lifers reported there, each with its date and a link to the eBird checklist. Lifer names appear with the eBird and Birds of the World icons but without a Species Detail link, since they are not in your recorded data.

Data comes from eBird's recent observations API for your location and radius. This view replaces the old flat Nearby Lifers list that lived on the Statistics tab.

### Media Targets

Shows recent sightings of species you are missing at least one media type for, within a search radius. Pins are color-coded by recency: bright green for the past 7 days, lighter for 8 to 15 days, and lightest for 16 to 30 days. A **Time Range** filter narrows the window to the last day, last week, or last 30 days. A **Targets in view** list in the sidebar mirrors the target pins currently on screen: each row shows the species, location, the most recent date, and (when you have a search center set) the distance, sorted nearest first. The list updates as you pan or zoom, so it always reflects what's visible; on very dense views it shows the closest first with a note to zoom in to narrow it. Selecting a row (via its keyboard-operable "show on map" button) opens that location's details popup on the map and pans to it. This is the keyboard path to the target chips, which are otherwise mouse-only.

---

## Multimedia

The Multimedia tab shows your complete life list with media coverage: which species you have photographed, audio-recorded, and video-recorded.

The tab loads automatically from your eBird backup and ML export saved in Settings. When both files are present, it enters Comprehensive mode, which builds the species list from your eBird observations so that every life-listed species appears even if it has no media yet. A Total column shows combined photo, audio, and video counts.

Each non-zero count in the Photo, Audio, and Video columns is a clickable link to your personal Macaulay Library page filtered by species and media type.

Toolbar options:

- Filter pills: All, Has media, Is Target (missing at least one media type), No photo, No audio, No video, Has photo, Has audio, Has video. Multiple pills combine with AND logic.
- Sex and Age dropdowns: filter the media by **sex** (Male, Female) and **age** (Juvenile, Immature, Adult). They combine with the pills, with each other, and with the county/date filters. While a facet is active, each species' counts reflect only the matching media, species with none drop out of the list, and the Macaulay Library links open scoped to the same filter. Choosing both an age and a sex targets a single kind of bird (e.g. a juvenile female); a single dropdown stays broad (any female, or any juvenile).
- A-Z / Taxonomic: switch between alphabetical and eBird taxonomic sort order.
- Merge subspecies: on by default; combines subspecies variants under the parent species name.
- Show sp./slash: off by default; hides uncertain identifications.
- Unbounded: removes the table's horizontal scroll constraint so the full row is visible on narrow screens.

County and date-range filters appear in the toolbar when county data is available. These filters narrow which observations are counted for each species.

### Media Comments

Below the species table, a **Media Comments** section surfaces the notes you attached to your Macaulay Library uploads — the asset **Caption** and **Media notes**. It shows the most recent comments, with a keyword filter, a Newest/Oldest sort, and a "Show all" control — just like the comments box on Species Detail. Each entry shows the species, the media type (photo/audio/video), the date and place, the comment (with a small label for which field it came from), and a link to that asset on the Macaulay Library. The filter matches across both comment fields. The section only appears when your ML export actually contains media comments. (The eBird observation comment isn't included here — the export copies it onto every media item from an observation, so it would just repeat; it's the comment on the media itself that's shown.)

When you have media comments, a short note at the top of the tab tells you how many are searchable and offers a **Jump to comments** link, so you can reach this section without scrolling past the whole species table.

---

## Breeding Codes

The Breeding Codes tab shows every species you have recorded a breeding code for, displayed as a matrix with a column for each breeding code you have recorded (out of the 23 the app tracks).

The tab loads automatically from your eBird backup saved in Settings.

Each cell shows how many times you recorded that code for that species. Cells are color-coded by eBird's four-tier system: darkest for the highest Confirmed codes, medium for lower Confirmed codes, lighter for Probable, and lightest for Possible. Empty cells are blank.

Click any column header to sort by that code's count. Click the species name column to sort alphabetically or by eBird taxonomic order using the A-Z / Taxonomic toggle.

The filter row above the table includes:

- All: shows all species.
- Confirmed, Probable, and Possible: selects all codes in that evidence category at once.
- Individual code pills: each limits the table to species with at least one observation for that specific code.

Multiple pills can be active simultaneously. The table shows only species that have at least one observation for every active selection.

The Unbounded toggle removes the table's horizontal scroll constraint for easier reading on narrow screens.

---

## Named Birds

The Named Birds tab tracks individual birds you've named in your eBird species comments. Tag a specific bird in a checklist's species comment with a `[name:…]` tag — for example `[name:Winky]` or `[name:one-leg-pete]` — and SnowRaven gathers every checklist where that name appears.

Each named bird shows its name, species, first- and last-seen dates, and total number of sightings, and expands to list every checklist it appears on — the date, the location (a link to the hotspot page on eBird when the location is a public hotspot), a link to that checklist on eBird, and the species comment — plus a small map of everywhere that individual has been seen. Cards open one at a time. Sort the list by **Name (Individual)**, **Alphabetical**, **Taxonomic**, or **Last Seen**.

A bird is identified by its name together with its species, so the same name used for two different species is tracked as two individuals, and name matching ignores case. This tab requires your eBird backup. The same information for a single species also appears as a **Named Individuals** section on the Species Detail tab.

---

## Checklists

The Checklists tab is the home for your checklists as whole outings: search every comment you've ever written, and browse or filter the full list of your checklists. It loads from your stored eBird backup; saving your ML export too adds media-type detail.

**Checklist Comments** lists every checklist-level comment — one entry per checklist, with its date (linking to that checklist on eBird) and location (a link to the hotspot page on eBird when the location is a public hotspot). The 10 most recent show first; expand to see all, switch **Newest/Oldest**, and type in the filter box to search within your comments.

**Species Comments** does the same for the observation notes you've written on individual sightings — across **all** species at once. Each entry leads with the species name; click it to open that species on the Species Detail tab.

**All Checklists** lists every checklist with its date (linking to eBird), location, protocol, effort (duration, distance, observers), species and individual counts, at-a-glance indicators (species comments, media, breeding codes), and the checklist comment. Filters combine: one pill per category cycles **any → has → doesn't have** for checklist comment, species comments, media, breeding codes, weather block, and tide block, plus a **Complete/Incomplete** pill, **photo/audio/video** pills (when your ML export is saved), and protocol, county, and date-range controls. The count label reads "N of M checklists" while anything is filtered, and **All** resets the pills.

**Show weather & tide blocks** (off by default) controls whether pasted SnowRaven weather/tide blocks appear anywhere on the tab. While hidden, block text is also excluded from search — so searching "Humidity" won't match every checklist you pasted a weather block into — and a comment that contains *only* a block counts as having no comment. Flip the toggle to see, and search, the blocks again. (The **Weather block** / **Tide block** filter pills work either way.)

---

## List Comparer

The List Comparer tab compares two lists and shows which species appear in both and which are unique to each. A toggle at the top switches between two modes: **Checklists** and **Life Lists**. Checklists opens first.

### Life Lists

Compares two full eBird life lists (CSV backups). If your eBird backup is saved in Settings, your list loads automatically as List A. You can also upload any eBird backup CSV file directly as List A. Drop a second eBird backup CSV file onto the List B slot, then click Compare Lists.

### Checklists mode

Compares two individual eBird checklists. Paste two checklist IDs or URLs (e.g. `S12345678` or `https://ebird.org/checklist/S12345678`), the same way you would in the Weather tab, then click Compare checklists. This mode uses your eBird API key (set in Settings) to fetch each checklist directly from eBird, so it works for any public checklist, not just your own.

Each checklist is identified by a card at the top showing its location, date, and ID — useful when comparing two visits to the same place. The card also shows the checklist's **effort and provenance**: type (Traveling, Stationary, Incidental, etc.), distance (in the unit you entered), duration, number of observers, and the app and version it was submitted from (e.g. "eBird iOS 3.6.5"). The **checklist ID links to the checklist on eBird**, and if the checklist has a checklist-level comment, a collapsible **Notes** disclosure shows it.

Each card also carries a **badge row** that summarizes the checklist at a glance: which media types were reported across all its species (**Photo**, **Audio**, **Video**), whether any **Breeding** codes were noted, and whether the checklist's comment already contains a SnowRaven **Weather** block and/or **Tide** block (handy for spotting which outing already has conditions pasted in). All six badges always show — filled when present, plain when absent — so the two cards line up side by side.

The "In Both" panel shows each species' details from both checklists side by side (A on the left, B on the right); the "Checklist A only" and "Checklist B only" panels appear below.

For each species on each checklist, you see:

- **Count** — the number recorded. Where one checklist recorded a higher number, that count is bolded with a ▲ marker. Presence-only entries (eBird's "X") show a dash and are never marked as higher.
- **Breeding code** — if a breeding-evidence code was entered, it appears as a small colored pill, colored by evidence tier (the same scheme as the Breeding Codes tab). Hover for the full code name.
- **Media icons** — small camera, microphone, and video icons indicate whether photos, audio, or video exist for that species on that checklist (across all observers). Hover for the counts.
- **Comments** — when a species has an observation note, a 💬 icon appears on that checklist's side (A, B, or both); click it to read the note. Any links in comments are clickable.

All comments are also gathered into a **Comments table** at the bottom, with each checklist's note side by side for easy comparison. There, an empty side reads "no comment" (the bird was on that checklist but had no note) or "not reported" (the bird wasn't on that checklist).

Below the comments, a **Weather & Tide** section lets you pull a fresh weather and tide reading for each checklist and compare the conditions of the two outings side by side. Press **Load weather & tide** — nothing is fetched until you ask, and unlike the Weather tab, **nothing is copied to your clipboard automatically**. Each side then shows its weather block and tide block (the same format the Weather tab produces), with its own **Copy weather**, **Copy tide**, and **Copy weather & tide together** buttons; copying only happens when you press a button. The two sides are independent — if one checklist can't be looked up, the other still shows its conditions. The same tide notices appear here as on the Weather tab (when the nearest station is far away or outside the US, with a one-tap option to show it anyway). If a checklist's comment already includes a weather block, a short note reminds you that OpenWeather revises its historical data over time, so a fresh lookup may differ from what's pasted in. If your eBird or OpenWeather API key isn't set, the species comparison and badges still work — only this section shows a nudge to add the missing key in Settings.

Birds reported as a sub-form (for example, a domestic Rock Pigeon) are matched and named by their parent species, so the same bird lines up across both checklists.

### Both modes

Three panels appear: species in both lists, species only in List A, and species only in List B. Each species name has icons linking to its eBird species account and Birds of the World page. Use the A-Z / Taxonomic toggle to switch sort order.

---

## Settings

The Settings tab is where you configure everything SnowRaven needs to function.

### Appearance

Set your color scheme: System (follows your operating system preference), Light, or Dark. Selecting Light or Dark shows a prompt to save your preference. Selecting System removes any saved preference.

**Text size.** Scale the app's text from 100% up to 200% (100% / 125% / 150% / 200%). This is in addition to your browser or device's own text-size setting, which SnowRaven already follows — handy in the desktop app, which has no separate browser zoom. Your choice is remembered across sessions. At the largest sizes, wide tables and the maps may scroll sideways, which is expected.

**Date format.** Choose how dates appear throughout the app: month-first (Jun 8, 2026), day-first (8 Jun 2026), or ISO (2026-06-08). The default is month-first. Your choice applies everywhere dates are shown and is remembered across sessions.

### API Keys

Enter and manage your eBird and OpenWeather API keys. Keys are saved securely -- in the desktop app, they are stored in the app's local data directory; in web/Pi mode, they are saved to the server's .env file. Changes take effect immediately without a restart. Saved keys are masked by default; use Show or Hide to reveal or re-mask them. Use Update to replace a key, or Clear to remove it.

### Default Files

Upload your eBird backup CSV and Macaulay Library export. Each file is stored for you -- in the desktop app, in the local app data directory; in web/Pi mode, on the server. Files load automatically when you open the relevant tab. Use Upload new to replace a stored file, or Clear to remove it.

### Default Location

Set a home location used by the Map Explorer. Click **Use my location** to fill in your coordinates automatically (the same detection the Map Explorer offers), or enter latitude and longitude by hand. Set a search radius in miles, then click Save. The radius defaults to 5 miles. The Map Explorer uses these coordinates as its starting center and zoom level, including the starting point for the Nearby Lifers section.

### Tab Layout

Reorder and show or hide individual tabs. Drag rows to reorder, or use the **Move up** / **Move down** buttons on each row for a keyboard-only alternative to dragging. Click the eye icon to toggle a tab's visibility. At least one tab must remain visible at all times. The Settings tab is always last and cannot be hidden.

On narrow screens and mobile browsers the tab bar automatically collapses into a compact dropdown that follows the same order and visibility choices, so every tab stays reachable without horizontal scrolling.

### Offline maps (desktop app)

In the Mac and Windows desktop apps, the Settings tab includes an **Offline maps** section for downloading map regions so the Map Explorer keeps full street detail when you have no connection. It is **off by default** -- nothing downloads until you turn it on -- and it does not appear in the web/Pi version, where this section instead explains that downloadable regions are a desktop-app feature.

To download a region:

1. Turn on **Enable offline maps**.
2. Pick a region and choose **Download**. The counties you bird are suggested automatically from your eBird backup; pick one of those, or download a whole state.
3. While a region downloads, you'll see its progress and a **Cancel** button.
4. Once it finishes, open the Map Explorer offline anywhere inside that region to pan and zoom with full street detail.

The manager lists each downloaded region with its size and a running total of the space in use. A region flagged **Out of date** can be updated to the latest tiles, and any region can be removed to reclaim space.

Note that only the **Map** (vector) base works offline; **Satellite**, **Topo**, and **Trails** need a connection and are disabled while you're offline.

### Troubleshooting (desktop app)

In the Mac and Windows desktop apps, the Settings tab includes a Troubleshooting section with a **Rebuild caches & restart** button. If the map or species lookups stop working, rebuilding the app's local caches usually fixes it; the app clears its cached taxonomy data and restarts. This section does not appear in the web/Pi version.

---

## Using SnowRaven offline

SnowRaven keeps working without a connection. Every analytical tab and every map **opens offline** once it has loaded online at least once, working entirely from your already-loaded, locally-stored data. Here's what's available offline, and what still needs a connection.

**What works offline:**

- **All your tabs and maps open.** Each analytical tab and map opens offline once you've visited it online at least once. The maps draw your sightings, the heatmap, and the atlas blocks, plus the base map's place labels.
- **Bird names stay complete from a cold start.** Even on a first-ever launch with no connection, bird names sort in taxonomic order and show their eBird and Birds of the World icons.
- **Previously-loaded weather and tide re-show.** A checklist's weather or tide reading you loaded online once re-appears when you reopen that checklist offline, marked as the last loaded result with the time it was loaded.
- **Honest messages when a live feature can't run.** When something needs the network and can't reach it, SnowRaven tells you plainly whether you're offline, missing an API key, or hit a server error -- rather than failing silently.

**What still needs a connection:**

- **Full street detail on the map** comes from the network unless you've downloaded that region (see **Offline maps** under Settings, desktop app only). Without a downloaded region, an offline map still shows your data and the base map's labels, but the full street detail needs a downloaded region. Only the **Map** (vector) base works offline; Satellite, Topo, and Trails are disabled while you're offline.
- **Live weather and tide lookups** are online-only, but a reading you've loaded before re-shows offline (above).
- **These features are online-only with no offline fallback** -- they show a clear "you're offline" message: place and address search, the Checklist Comparer, live nearby-bird overlays, and downloading an app update.

---

## Updating SnowRaven

In the Mac and Windows desktop apps, click **Check For Updates** in the footer. If a newer version is available, click **Install update** -- the app downloads and applies it, then prompts you to relaunch. Updates are cryptographically verified, so they are safe even though the Windows build is not yet code-signed.

In web/Pi installations, the footer also checks for updates; to apply one, run `./update.sh` in your SnowRaven directory (or `git pull` and rebuild), which pulls the latest code, rebuilds the frontend, updates dependencies, and restarts the service.
