# SnowRaven Documentation

SnowRaven is a toolkit for birders who use eBird. It runs as a standalone desktop app on Mac, or as a self-hosted server on a Raspberry Pi or any computer on your local network. It gives you weather lookups, life list analytics, media coverage tracking, breeding code history, and more.

This documentation covers every tab, how to obtain the API keys the app requires, and how to download and upload the data files that unlock most features.

## Getting Started

When you first open SnowRaven, go to the Settings tab. That is where you enter your API keys and upload your data files. Once your keys and files are in place, every other tab works automatically on each visit -- there is nothing to re-upload between sessions.

The recommended setup sequence is:

1. Enter your eBird API key in Settings. This is required for the Weather tab and the Top Local Target Species card in Statistics.
2. Enter your OpenWeather API key in Settings. This is required for the Weather tab.
3. Upload your eBird backup file (`MyEBirdData.csv`) in Settings. This powers the Breeding Codes, Media List, Species Detail, Statistics, and Life List Comparer tabs.
4. Upload your ML export from Macaulay Library in Settings. This is optional but unlocks media-specific features in Media List, Species Detail, and Statistics.

---

## API Keys

An API key is a private code that identifies your account when the app contacts an external data service. Think of it like a password the app uses on your behalf. Both keys required by SnowRaven are free.

### eBird API key

The eBird API key lets SnowRaven fetch checklist metadata for weather lookups and retrieve recent bird sightings near your location for the Top Local Target Species feature. The key is free and is tied to your standard eBird account.

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

SnowRaven works with two data files you export from your own eBird and Macaulay Library accounts. Once uploaded in Settings, they are stored on the server and load automatically every time you open the app.

### eBird backup

Your eBird backup is a full export of all your eBird observations -- every checklist, every species, every location. It is the primary data source for most of SnowRaven's features.

The file is called `MyEBirdData.csv`. To download it, sign in at [ebird.org](https://ebird.org) and go to [ebird.org/downloadMyData](https://ebird.org/downloadMyData). Click "Download My Data" and save the file. In SnowRaven, go to Settings and upload it under Default Files.

The eBird backup is used by: Breeding Codes, Media List, Species Detail, Statistics (all cards except Top Local Target Species), and Life List Comparer.

eBird generates the export with all observations up to the download date. Re-upload the file whenever you want your tabs to reflect recent checklists.

### ML export

Your ML export is a spreadsheet of all the media you have uploaded to the Macaulay Library -- photos, audio recordings, and videos -- including catalog IDs, media types, and the species associated with each item.

To download it, sign in at [macaulaylibrary.org](https://macaulaylibrary.org) and go to My Media. Set the media-type filter to **All** rather than Birds, so the export includes every item you have uploaded, then click "Save Spreadsheet."

In SnowRaven, upload the file in Settings under Default Files, and **leave the filename unchanged**. The downloaded filename contains your Macaulay Library user ID, and SnowRaven reads that ID from the filename to link directly to your own media pages. If you rename the file, those links still work but are no longer personalized to your account.

The ML export is used by: Media List (media counts and species coverage), Species Detail (embedded recent media and media count indicators), and Statistics (the Media card). These features are not available from the eBird backup alone.

---

## Weather

The Weather tab retrieves historical weather data for any eBird checklist. Paste a checklist ID (for example, `S12345678`) or a full eBird checklist URL and click Get weather. The result is a formatted text block matching the output format used by raincrow.app -- ready to paste directly into your eBird checklist comment field.

The weather summary includes temperature range, wind speed and direction with Beaufort description, humidity, dew point, precipitation, conditions, and sunrise and sunset times. An Edit on eBird link opens your checklist's comment field directly in a new tab.

Both your eBird API key and OpenWeather API key must be configured in Settings for this tab to work.

---

## Species Detail

The Species Detail tab shows a complete history of your observations for any species. It requires your eBird backup loaded in Settings.

Select a species from the dropdown at the top -- type to search by common name or scientific name. All sections update immediately when you select a species. Switching species is instant; all data is parsed client-side from the stored file.

The tab shows the following sections for each species:

- Summary: common name, scientific name, media coverage indicators (Photo, Audio, Video -- filled when data is available from your ML export), and your highest breeding evidence category.
- Sightings: total checklist count, total individual count, personal best single-count observation, and first and last seen dates. Each date links to the original eBird checklist.
- Media: photo, audio, and video catalog counts, each linking to your personal Macaulay Library page filtered by species and media type. Requires ML export.
- Breeding Codes: every breeding code you have recorded for the species, with tier color, abbreviation, full label, and count.
- Reported With: species most frequently appearing on the same checklists as the selected species, ranked by co-occurrence percentage.
- Top Locations: ranked list of locations where you have observed the species, with links to each location on eBird.
- Sighting Locations map: an interactive map with a pin at every unique observation coordinate. Click any pin to see the dates and checklist links for that location. Toggle between Pins and Heatmap view.
- Comments: all your per-species field notes from the eBird backup, sortable by date and filterable by keyword.
- Recent Media: the most recently uploaded photo, audio recording, and video from your Macaulay Library, embedded inline. Requires ML export and at least one item in the catalog for this species.

Toolbar options:

- Show subspecies: off by default. Merges subspecies variants (for example, Yellow-rumped Warbler (Myrtle) and Yellow-rumped Warbler (Audubon's)) into the parent species. Toggle on to see each subspecies as a separate entry with its own stats.
- Show sp./slash: off by default. Hides uncertain identifications. Toggle on to include them in the species selector.

Graph options control the Sightings Over Time and Media Over Time charts that appear when you have enough data:

- Interval: Weekly, Monthly, or Yearly.
- Per Period / Cumulative: switches between counts per period and a running total.

County and date-range filters appear in the toolbar when your eBird backup contains county data. Active filters apply to all sections including the map, comments, breeding codes, and media counts.

---

## Statistics

The Statistics tab shows a comprehensive analytics dashboard built from your eBird backup. All nine cards are described below. The eBird backup is required for all cards. The Media card additionally requires your ML export.

### Life List Totals

Your headline counts: total species, total checklists, total locations, years active, states and provinces, and countries. The accumulation chart shows how your life list grew over time. Use the interval toggle to switch between Weekly, Monthly, Yearly, and Total views. Total mode draws one step per new lifer in chronological order, with the species name shown in the tooltip at each step.

### Firsts and Milestones

Key records from your birding history: your biggest single day, longest consecutive streak of days with at least one checklist, longest dry spell between checklists, and your Shannon diversity index (a measure of evenness across species, calculated from your numeric counts). Milestone pills mark every threshold from 10 to 3,000 species, showing the species that hit each milestone and linking to the checklist where it was recorded.

### Temporal Stats

Checklist activity broken down by year, month, day of week, and start hour. Each breakdown shows count and percentage of total. The day-of-week view highlights weekend versus weekday birding patterns.

### Geographic Stats

A map of your most-visited locations alongside ranked lists of your top locations, counties, and states by checklist count and species count. County and state entries link to their eBird region page. The map shows numbered markers for your top locations by checklists (green circles) and top locations by species (blue squares).

### Effort and Methodology

How you bird, measured: protocol distribution (stationary, traveling, incidental, and so on), average checklist duration, average distance, species per hour, species per mile, and average observer count. An average-by-protocol table breaks effort metrics down by protocol type.

### Data Quality

Metrics about the consistency and completeness of your data: the ratio of numeric counts to X/presence-only records, comment coverage percentage, your top 10 highest individual species counts, Single-Checklist Birds (species recorded on exactly one checklist), and One-and-Done Birds (species where the total individual count is exactly 1).

### Breeding Stats

Confirmed, Probable, and Possible species totals from your eBird backup. A stacked bar chart shows breeding activity by month. Use the filter buttons to isolate Confirmed, Probable, or Possible entries.

### Media

A chart showing how your photo, audio, video, and total media counts have grown over time. View it per period or as a cumulative total. Below the chart, ranked lists show your most-photographed, most-recorded, and most-filmed species, each linking to your personal Macaulay Library page filtered by species and media type. Requires your ML export.

### Top Local Target Species

Species observed near your configured location in the past 30 days that do not appear on your life list, sorted by most recently seen.

The configured location is the Default Location set in Settings under Default Location. If no default location has been saved, this card shows no results. The search radius is also set there.

Data comes from eBird's recent observations API for your location and radius. Each species name links to its eBird species account page.

The dot next to each species name shows how recently it was seen:

- Red dot: seen within the past 7 days.
- Amber dot: seen 8 to 14 days ago.
- Grey dot: seen 15 to 30 days ago.

---

## Map Explorer

The Map Explorer tab provides three views of your birding locations and nearby activity. An eBird API key is required for all three modes.

Click **Use my location** in the map controls to center the map on your current position and place a blue pin at the detected location. The desktop app uses your operating system's native location service (macOS and Windows both supported). If location is off or denied, restore it in System Settings → Privacy & Security → Location Services on macOS, or Settings → Privacy & security → Location on Windows; in web/Pi mode, use your browser's site permissions.

### My Sightings

Shows your personal recent observations on a map with a heatmap overlay. Use the species filter to show only observations of a specific species. Use the breeding status and date-range filters to narrow results further.

### Hotspots

Fetches eBird hotspots near a location. Hotspots you have visited (matched against your eBird backup) appear as green pins. Unvisited hotspots appear as blue pins. Locations from your personal location history appear as orange pins. Click any legend row to hide or show that category. Enter a place name or coordinates to search, then click Fetch hotspots.

### Media Targets

Shows recent sightings of species you are missing at least one media type for, within a search radius. Pins are color-coded by recency: bright green for the past 7 days, lighter for 8 to 15 days, and lightest for 16 to 30 days. The sidebar shows the 10 nearest target pins ranked by distance. Clicking a row pans the map to that location.

---

## Media List

The Media List tab shows your complete life list with media coverage: which species you have photographed, audio-recorded, and video-recorded.

The tab loads automatically from your eBird backup and ML export saved in Settings. When both files are present, it enters Comprehensive mode, which builds the species list from your eBird observations so that every life-listed species appears even if it has no media yet. A Total column shows combined photo, audio, and video counts.

Each non-zero count in the Photo, Audio, and Video columns is a clickable link to your personal Macaulay Library page filtered by species and media type.

Toolbar options:

- Filter pills: All, Has media, Is Target (missing at least one media type), No photo, No audio, No video, Has photo, Has audio, Has video. Multiple pills combine with AND logic.
- A-Z / Taxonomic: switch between alphabetical and eBird taxonomic sort order.
- Merge subspecies: on by default; combines subspecies variants under the parent species name.
- Show sp./slash: off by default; hides uncertain identifications.
- Unbounded: removes the table's horizontal scroll constraint so the full row is visible on narrow screens.

County and date-range filters appear in the toolbar when county data is available. These filters narrow which observations are counted for each species.

---

## Breeding Codes

The Breeding Codes tab shows every species you have recorded a breeding code for, displayed as a matrix across all 23 eBird breeding codes.

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

## Life List Comparer

The Life List Comparer tab compares two life lists and shows which species appear in both and which are unique to each.

If your eBird backup is saved in Settings, your list loads automatically as List A. You can also upload any eBird backup CSV file directly as List A. Drop a second eBird backup CSV file onto the List B slot, then click Compare Lists.

Three panels appear: species in both lists, species only in List A, and species only in List B. Each species name has icons linking to its eBird species account and Birds of the World page. Use the A-Z / Taxonomic toggle to switch sort order. The Show all button expands all panels to full length.

---

## Settings

The Settings tab is where you configure everything SnowRaven needs to function.

### Appearance

Set your color scheme: System (follows your operating system preference), Light, or Dark. Selecting Light or Dark shows a prompt to save your preference to this browser's local storage. Selecting System removes any saved preference.

### API Keys

Enter and manage your eBird and OpenWeather API keys. Keys are saved securely -- in the desktop app, they are stored in the app's local data directory; in web/Pi mode, they are saved to the server's .env file. Changes take effect immediately without a restart. Saved keys are masked by default; use Show or Hide to reveal or re-mask them. Use Update to replace a key, or Clear to remove it.

### Default Files

Upload your eBird backup CSV and Macaulay Library export. Each file is stored for you -- in the desktop app, in the local app data directory; in web/Pi mode, on the server. Files load automatically when you open the relevant tab. Use Upload new to replace a stored file, or Clear to remove it.

### Default Location

Set a home location used by the Map Explorer and the Top Local Target Species card in Statistics. Enter latitude, longitude, and a search radius in miles, then click Save. The Map Explorer uses these coordinates as its starting center and zoom level. The Statistics tab uses this location to fetch nearby recent sightings for the target species list.

### Tab Layout

Reorder and show or hide individual tabs. Drag rows to reorder. Click the eye icon to toggle a tab's visibility. At least one tab must remain visible at all times. The Settings tab is always last and cannot be hidden.

On narrow screens and mobile browsers the tab bar automatically collapses into a compact dropdown that follows the same order and visibility choices, so every tab stays reachable without horizontal scrolling.
